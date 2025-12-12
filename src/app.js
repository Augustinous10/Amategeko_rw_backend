require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// ✅ Import payment scheduler
const { paymentScheduler } = require('./utils/paymentUtils');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const digitalProductRoutes = require('./routes/digitalProduct.routes');
const questionRoutes = require('./routes/question.routes');
const examRoutes = require('./routes/exam.routes');
const paymentRoutes = require('./routes/payment.routes');

// Initialize express app
const app = express();

// ===== MIDDLEWARE =====

// Security headers
app.use(helmet());

// ✅ FIXED CORS configuration - Allow multiple origins
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:5173',
    process.env.CLIENT_URL
  ].filter(Boolean), // Remove undefined values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// ===== ROUTES =====

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UMUHANDA API is running',
    database: 'MongoDB Connected',
    payment: 'Payment system active',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/products', digitalProductRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ===== SERVER =====

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // ✅ Start payment scheduler
    paymentScheduler.start();

    // Start server
    app.listen(PORT, () => {
      console.log('=================================');
      console.log(`🚗 UMUHANDA API Server`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Database: MongoDB`);
      console.log(`💳 Payment: ITECPay Integrated`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`💚 Health check: http://localhost:${PORT}/health`);
      console.log(`🔓 CORS: Multiple origins allowed for development`);
      console.log('=================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // ✅ Stop scheduler before exit
  paymentScheduler.stop();
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // ✅ Stop scheduler before exit
  paymentScheduler.stop();
  process.exit(1);
});

// ✅ Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  paymentScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  paymentScheduler.stop();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
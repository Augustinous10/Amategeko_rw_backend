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

// Security headers - Updated for production
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// ✅ PRODUCTION-READY CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'https://itara.co.rw',
  'https://www.itara.co.rw',
  'https://rwanda-drive-prep-production.up.railway.app', // Your Railway frontend
];

// Add CORS_ORIGIN from env if it exists
if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  allowedOrigins.push(...envOrigins);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('⚠️  CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // 10 minutes
}));

// Handle preflight requests
app.options('*', cors());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting - More strict in production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
if (process.env.RATE_LIMIT_ENABLED !== 'false') {
  app.use('/api/', limiter);
}

// Trust proxy - Important for Railway deployment
app.set('trust proxy', 1);

// ===== ROUTES =====

// Health check - Enhanced for production
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ITARA API is running',
    environment: process.env.NODE_ENV || 'development',
    database: 'MongoDB Connected',
    payment: 'ITECPay Integrated',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to ITARA API',
    documentation: '/api/docs',
    health: '/health'
  });
});
// 🌱 SEED ENDPOINT - ADMIN ONLY (Remove after seeding!)
app.post('/api/admin/seed-subscriptions', async (req, res) => {
  try {
    const { Subscription } = require('./models');
    const { SUBSCRIPTION_TYPES } = require('./utils/constants');

    const subscriptionPlans = [
      {
        type: SUBSCRIPTION_TYPES.SINGLE_EXAM,
        name: { rw: 'Ikizamini kimwe', en: '1 Exam', fr: '1 Examen' },
        description: { rw: 'Ikizamini kimwe', en: 'Single exam attempt', fr: 'Une tentative d\'examen' },
        pricing: { rw: 100, en: 200, fr: 200 },
        currency: 'RWF',
        examLimit: 1,
        durationDays: null,
        isActive: true,
        features: { examAttempts: 1 }
      },
      {
        type: SUBSCRIPTION_TYPES.FIVE_EXAMS,
        name: { rw: 'Ibizamini 5', en: '5 Exams', fr: '5 Examens' },
        description: { rw: 'Ibizamini bitanu', en: 'Five exam attempts', fr: 'Cinq tentatives d\'examen' },
        pricing: { rw: 500, en: 800, fr: 800 },
        currency: 'RWF',
        examLimit: 5,
        durationDays: null,
        isActive: true,
        features: { examAttempts: 5 }
      },
      {
        type: SUBSCRIPTION_TYPES.SEVEN_DAYS,
        name: { rw: 'Iminsi 7 bidashira', en: '7 Days Unlimited', fr: '7 Jours Illimité' },
        description: { rw: 'Ibizamini bidashira mu minsi 7', en: 'Unlimited exams for 7 days', fr: 'Examens illimités pendant 7 jours' },
        pricing: { rw: 2500, en: 3000, fr: 3000 },
        currency: 'RWF',
        examLimit: null,
        durationDays: 7,
        isActive: true,
        features: { examAttempts: 0 }
      },
      {
        type: SUBSCRIPTION_TYPES.FIFTEEN_DAYS,
        name: { rw: 'Iminsi 15 bidashira', en: '15 Days Unlimited', fr: '15 Jours Illimité' },
        description: { rw: 'Ibizamini bidashira mu minsi 15', en: 'Unlimited exams for 15 days', fr: 'Examens illimités pendant 15 jours' },
        pricing: { rw: 4500, en: 5000, fr: 5000 },
        currency: 'RWF',
        examLimit: null,
        durationDays: 15,
        isActive: true,
        features: { examAttempts: 0 }
      },
      {
        type: SUBSCRIPTION_TYPES.THIRTY_DAYS,
        name: { rw: 'Ukwezi kumwe bidashira', en: '30 Days Unlimited', fr: '30 Jours Illimité' },
        description: { rw: 'Ibizamini bidashira mu kwezi kumwe', en: 'Unlimited exams for 30 days', fr: 'Examens illimités pendant 30 jours' },
        pricing: { rw: 7000, en: 8000, fr: 8000 },
        currency: 'RWF',
        examLimit: null,
        durationDays: 30,
        isActive: true,
        features: { examAttempts: 0 }
      }
    ];

    // Clear existing
    await Subscription.deleteMany({});
    
    // Insert new
    const result = await Subscription.insertMany(subscriptionPlans);

    res.json({
      success: true,
      message: `Seeded ${result.length} subscription plans`,
      plans: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
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
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('=================================');
      console.log(`🚗 ITARA API Server`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️  Database: MongoDB Connected`);
      console.log(`💳 Payment: ITECPay Integrated`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`🔗 API URL: http://0.0.0.0:${PORT}`);
      console.log(`💚 Health check: /health`);
      console.log(`🔓 CORS: Production origins allowed`);
      console.log(`🛡️  Security: Helmet & Rate Limiting enabled`);
      console.log(`📊 Scheduler: Payment monitoring active`);
      console.log('=================================');
    });

    // Graceful shutdown handler
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        
        // Stop payment scheduler
        paymentScheduler.stop();
        console.log('✅ Payment scheduler stopped');
        
        // Close database connection
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  paymentScheduler.stop();
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  paymentScheduler.stop();
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
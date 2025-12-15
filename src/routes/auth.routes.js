const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  register, 
  login, 
  refreshToken, 
  getMe,
  logout,
  changePassword,
  checkUserExists,
  resetPassword
} = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

// 🔧 RATE LIMITER - Apply ONLY to sensitive routes
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    message: 'Too many attempts. Please wait a moment and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip in development (optional)
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Public routes - WITH rate limiting
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/check-user', authLimiter, checkUserExists);
router.put('/reset-password', authLimiter, resetPassword);

// Public routes - NO rate limiting (these are fine)
router.post('/refresh', refreshToken);

// Protected routes - NO rate limiting needed (already protected by auth)
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  refreshToken, 
  getMe,
  logout,
  changePassword,
  checkUserExists,  // ← Changed from forgotPassword
  resetPassword
} = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/check-user', checkUserExists);  // ← Changed route
router.put('/reset-password', resetPassword);  // ← Removed /:token param

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
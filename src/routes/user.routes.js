const express = require('express');
const router = express.Router();
const { 
  getProfile,
  updateProfile,
  changeLanguage,
  getUserStats,
  getUserById,
  deleteUser,
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  changeUserRole,
  getAnalytics
} = require('../controllers/user.controller');
const { authenticate, isAdmin } = require('../middlewares/auth');

// ⚠️ IMPORTANT: Order matters! Specific routes BEFORE dynamic :id routes

// ========================================
// CLIENT PROTECTED ROUTES (Authentication Required)
// ========================================
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/language', authenticate, changeLanguage);
router.get('/stats', authenticate, getUserStats);

// ========================================
// ADMIN PROTECTED ROUTES (Admin Role Required)
// ========================================
router.get('/admin/all', authenticate, isAdmin, getAllUsers);
router.get('/admin/analytics', authenticate, isAdmin, getAnalytics);
router.get('/admin/:id', authenticate, isAdmin, getUserDetails);
router.put('/admin/:id/ban', authenticate, isAdmin, toggleUserStatus);
router.put('/admin/:id/role', authenticate, isAdmin, changeUserRole);

// ========================================
// PUBLIC & DYNAMIC ROUTES (Must be LAST)
// ========================================
router.get('/:id', getUserById); // Public - get any user's profile
router.delete('/:id', authenticate, deleteUser); // Delete own account or admin delete

module.exports = router;
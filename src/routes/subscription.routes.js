const express = require('express');
const router = express.Router();
const { 
  getSubscriptionPlans,
  purchaseSubscription,
  confirmSubscriptionPayment,
  getActiveSubscription,
  getSubscriptionHistory,
  getAllSubscriptions,
  cancelSubscription,
  getAllPayments  // ← ADD THIS
} = require('../controllers/subscription.controller');
const { authenticate, isAdmin } = require('../middlewares/auth');

// Public routes
router.get('/plans', getSubscriptionPlans);

// Protected routes (require authentication)
router.post('/purchase', authenticate, purchaseSubscription);
router.get('/active', authenticate, getActiveSubscription);
router.get('/history', authenticate, getSubscriptionHistory);

// Internal/webhook route
router.post('/confirm-payment', confirmSubscriptionPayment);

// Admin routes
router.get('/admin/all', authenticate, isAdmin, getAllSubscriptions);
router.get('/admin/payments', authenticate, isAdmin, getAllPayments);  // ← ADD THIS
router.put('/:id/cancel', authenticate, isAdmin, cancelSubscription);

module.exports = router;
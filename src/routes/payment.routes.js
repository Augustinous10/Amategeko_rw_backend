const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  verifyPayment,
  checkPaymentStatus,
  getPaymentHistory,
  cancelPayment,
  manualVerifyPayment  // ✅ Add this
} = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth');
const { validatePaymentInitiation } = require('../middlewares/paymentMiddleware');

// @route   POST /api/payments/initiate
router.post('/initiate', authenticate, validatePaymentInitiation, initiatePayment);

// @route   POST /api/payments/verify
router.post('/verify', verifyPayment);

// @route   GET /api/payments/:id/status
router.get('/:id/status', authenticate, checkPaymentStatus);

// @route   GET /api/payments/history
router.get('/history', authenticate, getPaymentHistory);

// @route   PUT /api/payments/:id/cancel
router.put('/:id/cancel', authenticate, cancelPayment);

// ✅ NEW: Manual verification endpoint for testing
// @route   POST /api/payments/:id/manual-verify
router.post('/:id/manual-verify', authenticate, manualVerifyPayment);

module.exports = router;
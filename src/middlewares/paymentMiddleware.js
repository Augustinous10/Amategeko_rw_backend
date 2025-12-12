const { Payment } = require('../models');
const { PAYMENT_STATUS, PAYMENT_METHODS } = require('../utils/constants');

// Validate payment initiation request
const validatePaymentInitiation = async (req, res, next) => {
  try {
    const { paymentId } = req.body;

    // Check if paymentId is provided
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Check if payment exists
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment belongs to the user
    if (payment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this payment'
      });
    }

    // Check if payment is in pending status
    if (payment.status !== PAYMENT_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Cannot initiate payment with status: ${payment.status}`
      });
    }

    // Attach payment to request for controller use
    req.payment = payment;

    next();
  } catch (error) {
    next(error);
  }
};

// Validate phone number format
const validatePhoneNumber = (req, res, next) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  // Rwanda phone number format: 07XXXXXXXX (10 digits)
  const phoneRegex = /^07[0-9]{8}$/;

  if (!phoneRegex.test(phoneNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Must be 10 digits starting with 07'
    });
  }

  next();
};

// Validate payment method
const validatePaymentMethod = (req, res, next) => {
  const { paymentMethod } = req.body;

  const validMethods = Object.values(PAYMENT_METHODS);

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      message: 'Payment method is required'
    });
  }

  if (!validMethods.includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`
    });
  }

  next();
};

// Validate amount
const validateAmount = (req, res, next) => {
  const { amount } = req.body;

  if (!amount) {
    return res.status(400).json({
      success: false,
      message: 'Amount is required'
    });
  }

  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be a positive number'
    });
  }

  // Set minimum payment amount (100 RWF - matches SINGLE_EXAM minimum)
  const MIN_AMOUNT = 100;
  if (numAmount < MIN_AMOUNT) {
    return res.status(400).json({
      success: false,
      message: `Minimum payment amount is ${MIN_AMOUNT} RWF`
    });
  }

  // Set maximum payment amount (1,000,000 RWF)
  const MAX_AMOUNT = 1000000;
  if (numAmount > MAX_AMOUNT) {
    return res.status(400).json({
      success: false,
      message: `Maximum payment amount is ${MAX_AMOUNT} RWF`
    });
  }

  next();
};

// Check for duplicate pending payments
const checkDuplicatePayment = async (req, res, next) => {
  try {
    const { referenceId, paymentType } = req.body;
    const userId = req.user._id;

    if (!referenceId) {
      // Skip check if no referenceId (general payment)
      return next();
    }

    // Check if user has a pending payment for the same reference
    const existingPayment = await Payment.findOne({
      user: userId,
      referenceId,
      paymentType,
      status: PAYMENT_STATUS.PENDING
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending payment for this item',
        data: {
          paymentId: existingPayment._id,
          status: existingPayment.status
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Verify webhook signature (for production security)
const verifyWebhookSignature = (req, res, next) => {
  // TODO: Implement webhook signature verification
  // This should verify that the request actually came from ITEC Payment
  // Example: Check X-Signature header against expected signature
  
  const signature = req.headers['x-signature'];
  const webhookSecret = process.env.ITEC_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // In development, skip verification
    console.warn('⚠️ ITEC_WEBHOOK_SECRET not set - skipping webhook verification');
    return next();
  }

  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Webhook signature missing'
    });
  }

  // TODO: Verify signature using crypto
  // const crypto = require('crypto');
  // const expectedSignature = crypto
  //   .createHmac('sha256', webhookSecret)
  //   .update(JSON.stringify(req.body))
  //   .digest('hex');

  // if (signature !== expectedSignature) {
  //   return res.status(401).json({
  //     success: false,
  //     message: 'Invalid webhook signature'
  //   });
  // }

  next();
};

module.exports = {
  validatePaymentInitiation,
  validatePhoneNumber,
  validatePaymentMethod,
  validateAmount,
  checkDuplicatePayment,
  verifyWebhookSignature
};
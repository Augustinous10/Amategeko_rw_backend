const axios = require('axios');
const { Payment, UserSubscription, Purchase, DigitalProduct, Subscription } = require('../models');
const { PAYMENT_STATUS, PAYMENT_TYPES, PAYMENT_METHODS } = require('../utils/constants');

// ITEC Payment API Configuration
const ITEC_API_URL = process.env.ITECPAY_API_URL || 'https://pay.itecpay.rw/api'; // ✅ Fixed!

// Multiple API keys - one for each payment method
// Multiple API keys - one for each payment method
const ITEC_API_KEYS = {
  [PAYMENT_METHODS.MTN_MOMO]: process.env.ITECPAY_MTN_KEY,        // ✅ Fixed!
  [PAYMENT_METHODS.AIRTEL_MONEY]: process.env.ITECPAY_AIRTEL_KEY, // ✅ Fixed!
  [PAYMENT_METHODS.SPENN]: process.env.ITECPAY_SPENN_KEY          // ✅ Fixed!
};
// Helper: Get API key for payment method
const getApiKeyForMethod = (paymentMethod) => {
  const key = ITEC_API_KEYS[paymentMethod];
  if (!key) {
    throw new Error(`No API key configured for payment method: ${paymentMethod}`);
  }
  return key;
};
// @desc    Initiate payment with ITEC API
// @route   POST /api/payments/initiate
// @access  Private
const initiatePayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Get payment record
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

    // Check if payment is already completed
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed'
      });
    }

    // Check if API key is configured for this payment method
    const apiKey = getApiKeyForMethod(payment.paymentMethod);
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: `Payment method ${payment.paymentMethod} not configured. Please contact support.`
      });
    }

    // Prepare ITEC API request
    const itecPayload = {
      amount: payment.amount,
      phone: payment.phoneNumber,
      key: apiKey // Use the correct key for this payment method
    };

    console.log('🔄 Initiating ITEC Payment:', {
      paymentId: payment._id,
      amount: payment.amount,
      phone: payment.phoneNumber,
      method: payment.paymentMethod
    });

    // Call ITEC Payment API
    const itecResponse = await axios.post(`${ITEC_API_URL}/pay`, itecPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });

    console.log('📥 ITEC Response:', JSON.stringify(itecResponse.data, null, 2));

    // Check ITEC response
    if (itecResponse.data.status === 200 && itecResponse.data.data.transID) {
      const transactionId = itecResponse.data.data.transID;
      
      // Update payment with transaction ID
      payment.transactionId = transactionId;
      
      // ✅ AUTO-COMPLETE: Mark as completed immediately when transactionId is received
      payment.status = PAYMENT_STATUS.COMPLETED;
      payment.completedAt = new Date();
      await payment.save();

      console.log('✅ ITEC Payment completed automatically:', payment.transactionId);

      // Process the payment based on type
      if (payment.paymentType === PAYMENT_TYPES.SUBSCRIPTION) {
        await processSubscriptionPayment(payment);
      } else if (payment.paymentType === PAYMENT_TYPES.PRODUCT) {
        await processProductPayment(payment);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment completed successfully!',
        data: {
          paymentId: payment._id,
          transactionId: payment.transactionId,
          amount: payment.amount,
          phoneNumber: payment.phoneNumber,
          status: payment.status
        }
      });
    } else {
      // Payment initiation failed
      payment.status = PAYMENT_STATUS.FAILED;
      payment.failedAt = new Date();
      payment.errorMessage = 'Payment initiation failed';
      await payment.save();

      console.error('❌ ITEC Payment failed:', itecResponse.data);

      return res.status(400).json({
        success: false,
        message: 'Payment initiation failed. Please try again.',
        data: {
          paymentId: payment._id
        }
      });
    }
  } catch (error) {
    console.error('❌ ITEC Payment Error:', error.message);

    // Update payment status to failed if possible
    if (req.body.paymentId) {
      try {
        await Payment.findByIdAndUpdate(req.body.paymentId, {
          status: PAYMENT_STATUS.FAILED,
          failedAt: new Date(),
          errorMessage: error.response?.data?.message || error.message
        });
      } catch (updateError) {
        console.error('Failed to update payment status:', updateError);
      }
    }

    // Handle ITEC API errors
    if (error.response) {
      return res.status(error.response.status || 400).json({
        success: false,
        message: error.response.data?.data?.message || 'Payment failed',
        error: error.response.data
      });
    }

    next(error);
  }
};
// @desc    Verify payment status (webhook/callback)
// @route   POST /api/payments/verify
// @access  Public (but should be secured with webhook signature)
const verifyPayment = async (req, res, next) => {
  try {
    const { transactionId, status } = req.body;

    console.log('🔔 Payment verification webhook received:', { transactionId, status });

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Find payment by transaction ID
    const payment = await Payment.findOne({ transactionId });

    if (!payment) {
      console.error('❌ Payment not found for transactionId:', transactionId);
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if already processed
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      console.log('⚠️ Payment already processed:', transactionId);
      return res.status(200).json({
        success: true,
        message: 'Payment already processed'
      });
    }

    // Update payment based on webhook status
    if (status === 'success' || status === 200) {
      payment.status = PAYMENT_STATUS.COMPLETED;
      payment.completedAt = new Date();
      await payment.save();

      console.log('✅ Payment completed:', transactionId);

      // Process the payment based on type
      if (payment.paymentType === PAYMENT_TYPES.SUBSCRIPTION) {
        await processSubscriptionPayment(payment);
      } else if (payment.paymentType === PAYMENT_TYPES.PRODUCT) {
        await processProductPayment(payment);
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified and processed successfully'
      });
    } else {
      payment.status = PAYMENT_STATUS.FAILED;
      payment.failedAt = new Date();
      payment.errorMessage = 'Payment failed at gateway';
      await payment.save();

      console.log('❌ Payment failed:', transactionId);

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('❌ Verify Payment Error:', error);
    next(error);
  }
};

// Helper: Process subscription payment
// Helper: Process subscription payment
const processSubscriptionPayment = async (payment) => {
  try {
    console.log('=== PROCESS SUBSCRIPTION PAYMENT START ===');
    console.log('Payment ID:', payment._id);
    console.log('Payment metadata:', JSON.stringify(payment.metadata, null, 2));

    const { subscriptionId, language, expiryDate } = payment.metadata;

    // Validation
    if (!subscriptionId) {
      console.error('❌ NO subscriptionId in payment metadata!');
      console.error('Available metadata keys:', Object.keys(payment.metadata));
      throw new Error('No subscriptionId in payment metadata');
    }

    console.log('✓ Found subscriptionId:', subscriptionId);

    // Get subscription plan
    const subscriptionPlan = await Subscription.findById(subscriptionId);

    if (!subscriptionPlan) {
      console.error('❌ Subscription plan not found for ID:', subscriptionId);
      throw new Error('Subscription plan not found');
    }

    console.log('✓ Subscription plan found:', subscriptionPlan.name);

    // Calculate dates
    const startDate = new Date();
    let endDate;

    if (expiryDate) {
      endDate = new Date(expiryDate);
      console.log('✓ Using expiryDate from metadata:', endDate);
    } else {
      // For exam-count based subscriptions
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 10);
      console.log('✓ Exam-count subscription, setting far future endDate:', endDate);
    }

    // ✅ CHECK IF USER ALREADY HAS ACTIVE SUBSCRIPTION
    const existingSubscription = await UserSubscription.findOne({
      user: payment.user,
      isActive: true,
      endDate: { $gte: new Date() }
    });

    if (existingSubscription) {
      console.log('⚠️ User already has active subscription:', existingSubscription._id);
      console.log('Current plan:', existingSubscription.subscription);
      console.log('New plan to apply:', subscriptionPlan._id);
      console.log('Updating existing subscription instead of creating new one');
      
      // ⭐ CRITICAL FIX: Update ALL relevant fields including subscription plan reference
      existingSubscription.subscription = subscriptionPlan._id; // Update plan reference
      existingSubscription.startDate = startDate; // Reset start date
      existingSubscription.endDate = endDate; // Update end date
      existingSubscription.examAttemptsUsed = 0; // Reset attempts counter
      existingSubscription.isActive = true; // Ensure it's active
      await existingSubscription.save();
      
      console.log('✅ Existing subscription updated:', existingSubscription._id);
      console.log('New subscription plan ID:', existingSubscription.subscription);
      console.log('Exam attempts reset to:', existingSubscription.examAttemptsUsed);
      console.log('Start date:', existingSubscription.startDate);
      console.log('End date:', existingSubscription.endDate);
      
      return existingSubscription;
    }

    // Create new user subscription
    const subscriptionData = {
      user: payment.user,
      subscription: subscriptionPlan._id,
      startDate,
      endDate,
      isActive: true,
      examAttemptsUsed: 0
    };

    console.log('Creating UserSubscription with data:', JSON.stringify(subscriptionData, null, 2));

    const userSubscription = await UserSubscription.create(subscriptionData);

    console.log('✅ Subscription activated successfully!');
    console.log('UserSubscription ID:', userSubscription._id);
    console.log('User ID:', userSubscription.user);
    console.log('Subscription Plan ID:', userSubscription.subscription);
    console.log('Start Date:', userSubscription.startDate);
    console.log('End Date:', userSubscription.endDate);
    console.log('Is Active:', userSubscription.isActive);
    console.log('=== PROCESS SUBSCRIPTION PAYMENT END ===');

    return userSubscription;
  } catch (error) {
    console.error('=== PROCESS SUBSCRIPTION ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};
const debugPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check subscription
    const subscription = await UserSubscription.findOne({
      user: payment.user,
      isActive: true
    }).populate('subscription');
    
    res.status(200).json({
      success: true,
      data: {
        payment: {
          _id: payment._id,
          status: payment.status,
          amount: payment.amount,
          metadata: payment.metadata,
          completedAt: payment.completedAt
        },
        subscription: subscription ? {
          _id: subscription._id,
          isActive: subscription.isActive,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          plan: subscription.subscription.name
        } : null,
        analysis: {
          paymentCompleted: payment.status === 'completed',
          hasMetadata: !!payment.metadata,
          hasSubscriptionId: !!(payment.metadata && payment.metadata.subscriptionId),
          subscriptionExists: !!subscription,
          subscriptionActive: subscription ? subscription.isActive : false
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
// Helper: Process product payment
const processProductPayment = async (payment) => {
  try {
    console.log('📦 Processing product payment...');

    const productId = payment.referenceId;

    // Get product
    const product = await DigitalProduct.findById(productId);

    if (!product) {
      throw new Error('Product not found');
    }

    // Create purchase record
    const purchase = await Purchase.create({
      user: payment.user,
      product: productId,
      payment: payment._id,
      purchaseDate: new Date()
    });

    console.log('✅ Product purchase created:', purchase._id);

    return purchase;
  } catch (error) {
    console.error('❌ Process Product Error:', error);
    throw error;
  }
};

// @desc    Check payment status
// @route   GET /api/payments/:id/status
// @access  Private
const checkPaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);

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

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const count = await Payment.countDocuments(filter);

    const payments = await Payment.find(filter)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { payments }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel pending payment
// @route   PUT /api/payments/:id/cancel
// @access  Private
const cancelPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);

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

    // Can only cancel pending payments
    if (payment.status !== PAYMENT_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel payment with status: ${payment.status}`
      });
    }

    payment.status = PAYMENT_STATUS.CANCELLED;
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data: { payment }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually verify payment (for testing without webhooks)
// @route   POST /api/payments/:id/manual-verify
// @access  Private
const manualVerifyPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);

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

    // Check if already completed
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed'
      });
    }

    // Manually mark as completed
    payment.status = PAYMENT_STATUS.COMPLETED;
    payment.completedAt = new Date();
    await payment.save();

    console.log('✅ Payment manually verified:', payment._id);

    // Process the payment based on type
    if (payment.paymentType === PAYMENT_TYPES.SUBSCRIPTION) {
      await processSubscriptionPayment(payment);
    } else if (payment.paymentType === PAYMENT_TYPES.PRODUCT) {
      await processProductPayment(payment);
    }

    res.status(200).json({
      success: true,
      message: 'Payment manually verified and processed',
      data: {
        paymentId: payment._id,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('❌ Manual Verify Error:', error);
    next(error);
  }
};

module.exports = {
  initiatePayment,
  verifyPayment,
  checkPaymentStatus,
  getPaymentHistory,
  cancelPayment,
  manualVerifyPayment,
  debugPayment
};
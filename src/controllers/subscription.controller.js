const { UserSubscription, Payment, Subscription } = require('../models');
const { 
  SUBSCRIPTION_TYPES, 
  SUBSCRIPTION_STATUS,
  PAYMENT_TYPES,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  LANGUAGES,
  getSubscriptionPrice,
  getExamLimits,
  getLanguageDisplayName,
  getSubscriptionDisplayName
} = require('../utils/constants');

// @desc    Get available subscription plans
// @route   GET /api/subscriptions/plans
// @access  Public
const getSubscriptionPlans = async (req, res, next) => {
  try {
    const { language } = req.query;
    
    // Validate language if provided
    if (language && !Object.values(LANGUAGES).includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language. Must be one of: ${Object.values(LANGUAGES).join(', ')}`
      });
    }
    
    // Fetch from database
    const plans = await Subscription.find({ isActive: true }).sort({ examLimit: 1, durationDays: 1 });
    
    const formattedPlans = plans.map(plan => {
      // If language is specified, return only that language's data
      if (language) {
        return {
          id: plan._id,
          type: plan.type,
          name: plan.name[language],
          description: plan.description[language],
          price: plan.pricing[language],
          currency: plan.currency,
          limits: {
            exams: plan.examLimit || 'Unlimited',
            days: plan.durationDays || null
          },
          features: plan.features
        };
      }
      
      // If no language specified, return all languages
      return {
        id: plan._id,
        type: plan.type,
        name: plan.name,
        description: plan.description,
        pricing: plan.pricing,
        currency: plan.currency,
        limits: {
          exams: plan.examLimit || 'Unlimited',
          days: plan.durationDays || null
        },
        features: plan.features
      };
    });
    
    res.status(200).json({
      success: true,
      data: { plans: formattedPlans }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Purchase subscription (CREATE PAYMENT RECORD)
// @route   POST /api/subscriptions/purchase
// @access  Private
const purchaseSubscription = async (req, res, next) => {
  try {
    const { subscriptionType, language, paymentMethod, phoneNumber } = req.body;
    
    // Validate input
    if (!subscriptionType || !language || !paymentMethod || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide subscriptionType, language, paymentMethod, and phoneNumber'
      });
    }
    
    // Validate language
    if (!Object.values(LANGUAGES).includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language. Must be one of: ${Object.values(LANGUAGES).join(', ')}`
      });
    }

    // Validate payment method
    if (!Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}`
      });
    }

    // Validate phone number
    const phoneRegex = /^07[0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must be 10 digits starting with 07'
      });
    }
    
    // Find the subscription plan by type
    const subscriptionPlan = await Subscription.findOne({ 
      type: subscriptionType,
      isActive: true 
    });
    
    if (!subscriptionPlan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }
    
    // Get price for selected language
    const price = subscriptionPlan.pricing[language];
    
    if (!price) {
      return res.status(400).json({
        success: false,
        message: `Price not available for language: ${language}`
      });
    }
    
    // Calculate expiry date
    let expiryDate = null;
    if (subscriptionPlan.durationDays) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + subscriptionPlan.durationDays);
    }
    
    // Create payment record
    const payment = await Payment.create({
      user: req.user._id,
      paymentType: PAYMENT_TYPES.SUBSCRIPTION,
      amount: price,
      currency: subscriptionPlan.currency,
      paymentMethod,
      phoneNumber,
      status: PAYMENT_STATUS.PENDING,
      metadata: {
        subscriptionId: subscriptionPlan._id,
        subscriptionType: subscriptionPlan.type,
        language,
        examLimit: subscriptionPlan.examLimit,
        expiryDate
      }
    });
    
    console.log('✅ Payment record created:', payment._id);
    
    res.status(201).json({
      success: true,
      message: 'Payment created. Please proceed to initiate payment.',
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        phoneNumber: payment.phoneNumber,
        subscriptionDetails: {
          type: subscriptionPlan.type,
          name: subscriptionPlan.name[language],
          description: subscriptionPlan.description[language],
          language: getLanguageDisplayName(language),
          price,
          limits: {
            exams: subscriptionPlan.examLimit || 'Unlimited',
            days: subscriptionPlan.durationDays
          }
        },
        nextStep: {
          endpoint: '/api/payments/initiate',
          method: 'POST',
          body: {
            paymentId: payment._id
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm subscription payment (CALLED BY PAYMENT WEBHOOK)
// @route   POST /api/subscriptions/confirm-payment
// @access  Private/Internal
const confirmSubscriptionPayment = async (req, res, next) => {
  try {
    const { paymentId, transactionId } = req.body;
    
    console.log('=== CONFIRM SUBSCRIPTION PAYMENT START ===');
    console.log('PaymentId:', paymentId);
    console.log('TransactionId:', transactionId);
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }
    
    // Get payment
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    console.log('Payment status:', payment.status);
    
    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed'
      });
    }
    
    // Update payment status
    payment.status = PAYMENT_STATUS.COMPLETED;
    if (transactionId) {
      payment.transactionId = transactionId;
    }
    payment.completedAt = new Date();
    await payment.save();
    
    console.log('✓ Payment updated to completed');
    
    // Get subscription plan
    const { subscriptionId, language, expiryDate } = payment.metadata;
    
    if (!subscriptionId) {
      throw new Error('No subscriptionId in payment metadata');
    }
    
    const subscriptionPlan = await Subscription.findById(subscriptionId);
    
    if (!subscriptionPlan) {
      throw new Error('Subscription plan not found in database');
    }
    
    console.log('✓ Subscription plan found:', subscriptionPlan.name.en);
    
    // Calculate dates
    const startDate = new Date();
    let endDate;
    
    if (expiryDate) {
      endDate = new Date(expiryDate);
      console.log('Using expiry date from metadata:', endDate);
    } else {
      // For exam-count based subscriptions, set far future date
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 10);
      console.log('Exam-count subscription, setting far future endDate');
    }
    
    console.log('Dates:', { startDate, endDate });
    
    // Prepare subscription data
    const subscriptionData = {
      user: payment.user,
      subscription: subscriptionPlan._id,
      startDate,
      endDate,
      isActive: true,
      examAttemptsUsed: 0
    };
    
    console.log('Creating UserSubscription with data:', JSON.stringify(subscriptionData, null, 2));
    
    // Create user subscription
    const userSubscription = await UserSubscription.create(subscriptionData);
    
    console.log('✓ UserSubscription created successfully:', userSubscription._id);
    console.log('=== CONFIRM SUBSCRIPTION PAYMENT END ===');
    
    // Return response with translated plan info
    const userLanguage = language || LANGUAGES.ENGLISH;
    
    res.status(201).json({
      success: true,
      message: 'Subscription activated successfully',
      data: { 
        subscription: userSubscription,
        plan: {
          name: subscriptionPlan.name[userLanguage],
          description: subscriptionPlan.description[userLanguage],
          type: subscriptionPlan.type,
          examLimit: subscriptionPlan.examLimit,
          durationDays: subscriptionPlan.durationDays
        }
      }
    });
  } catch (error) {
    console.error('=== SUBSCRIPTION CONFIRMATION ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack:', error.stack);
    next(error);
  }
};

// @desc    Get user's active subscription
// @route   GET /api/subscriptions/active
// @access  Private
const getActiveSubscription = async (req, res, next) => {
  try {
    const { language = LANGUAGES.ENGLISH } = req.query;
    
    // Validate language
    if (!Object.values(LANGUAGES).includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language. Must be one of: ${Object.values(LANGUAGES).join(', ')}`
      });
    }
    
    const subscription = await UserSubscription.findOne({
      user: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() }
    }).populate('subscription');
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const plan = subscription.subscription;
    
    res.status(200).json({
      success: true,
      data: {
        subscription,
        plan: {
          name: plan.name[language],
          description: plan.description[language],
          type: plan.type,
          examLimit: plan.examLimit,
          durationDays: plan.durationDays,
          price: plan.pricing[language]
        },
        daysRemaining,
        examAttemptsUsed: subscription.examAttemptsUsed
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscription history
// @route   GET /api/subscriptions/history
// @access  Private
const getSubscriptionHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, language = LANGUAGES.ENGLISH } = req.query;
    const skip = (page - 1) * limit;
    
    // Validate language
    if (!Object.values(LANGUAGES).includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language. Must be one of: ${Object.values(LANGUAGES).join(', ')}`
      });
    }
    
    const count = await UserSubscription.countDocuments({ user: req.user._id });
    
    const subscriptions = await UserSubscription.find({ user: req.user._id })
      .populate('subscription')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });
    
    // Format subscriptions with translated data
    const formattedSubscriptions = subscriptions.map(sub => ({
      _id: sub._id,
      startDate: sub.startDate,
      endDate: sub.endDate,
      isActive: sub.isActive,
      examAttemptsUsed: sub.examAttemptsUsed,
      createdAt: sub.createdAt,
      plan: {
        name: sub.subscription.name[language],
        description: sub.subscription.description[language],
        type: sub.subscription.type,
        examLimit: sub.subscription.examLimit,
        durationDays: sub.subscription.durationDays,
        price: sub.subscription.pricing[language]
      }
    }));
    
    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { subscriptions: formattedSubscriptions }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Get all user subscriptions (Admin)
// @route   GET /api/subscriptions/admin/all
// @access  Private/Admin
const getAllSubscriptions = async (req, res, next) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const skip = (page - 1) * limit;

    const count = await UserSubscription.countDocuments();
    
    const subscriptions = await UserSubscription.find()
      .populate('user', 'fullName email')
      .populate('subscription')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { subscriptions }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Cancel subscription (for admin)
// @route   PUT /api/subscriptions/:id/cancel
// @access  Private/Admin
const cancelSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { language = LANGUAGES.ENGLISH } = req.query;
    
    const subscription = await UserSubscription.findById(id).populate('subscription');
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }
    
    subscription.isActive = false;
    await subscription.save();
    
    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: { 
        subscription: {
          _id: subscription._id,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          isActive: subscription.isActive,
          examAttemptsUsed: subscription.examAttemptsUsed,
          plan: {
            name: subscription.subscription.name[language],
            type: subscription.subscription.type
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubscriptionPlans,
  purchaseSubscription,
  confirmSubscriptionPayment,
  getActiveSubscription,
  getSubscriptionHistory,
  getAllSubscriptions,
  cancelSubscription
};
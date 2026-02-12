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
    
    console.log('📦 Fetched plans from DB:', plans.length);
    console.log('📦 First plan sample:', JSON.stringify(plans[0], null, 2));
    
    const formattedPlans = plans.map(plan => {
      // Convert to plain object to ensure all fields are accessible
      const planObj = plan.toObject ? plan.toObject() : plan;
      
      console.log('Processing plan:', planObj.type, 'Has name?', !!planObj.name);
      
      // If language is specified, return only that language's data
      if (language) {
        return {
          _id: planObj._id,
          type: planObj.type,
          name: planObj.name?.[language] || planObj.name?.en || 'Unknown',
          description: planObj.description?.[language] || planObj.description?.en || '',
          price: planObj.pricing?.[language] || planObj.pricing?.en || 0,
          currency: planObj.currency || 'RWF',
          examLimit: planObj.examLimit,
          durationDays: planObj.durationDays,
          limits: {
            exams: planObj.examLimit || 'Unlimited',
            days: planObj.durationDays || null
          },
          features: planObj.features || []
        };
      }
      
      // If no language specified, return all languages
      return {
        _id: planObj._id,
        type: planObj.type,
        name: planObj.name || { en: 'Unknown', fr: 'Unknown', rw: 'Unknown' },
        description: planObj.description || { en: '', fr: '', rw: '' },
        pricing: planObj.pricing || { en: 0, fr: 0, rw: 0 },
        currency: planObj.currency || 'RWF',
        examLimit: planObj.examLimit,
        durationDays: planObj.durationDays,
        limits: {
          exams: planObj.examLimit || 'Unlimited',
          days: planObj.durationDays || null
        },
        features: planObj.features || []
      };
    });
    
    console.log('✅ Formatted plans:', formattedPlans.length);
    console.log('✅ First formatted plan:', JSON.stringify(formattedPlans[0], null, 2));
    
    res.status(200).json({
      success: true,
      data: { plans: formattedPlans }
    });
  } catch (error) {
    console.error('❌ Error in getSubscriptionPlans:', error);
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

// ============================================================================
// 🔧 MANUAL FIX ENDPOINT - Activate subscription for completed payment
// ============================================================================
// @desc    Manually activate subscription for completed payment (Admin Fix)
// @route   POST /api/subscriptions/admin/activate-payment/:paymentId
// @access  Private/Admin
const manuallyActivateSubscription = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    
    console.log('=== MANUAL SUBSCRIPTION ACTIVATION START ===');
    console.log('PaymentId:', paymentId);
    console.log('Admin user:', req.user.email);
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }
    
    // Get payment
    const payment = await Payment.findById(paymentId).populate('user', 'fullName email phoneNumber');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if payment is completed
    if (payment.status !== PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: `Payment is not completed. Current status: ${payment.status}`
      });
    }
    
    // Check if payment is for subscription
    if (payment.paymentType !== PAYMENT_TYPES.SUBSCRIPTION) {
      return res.status(400).json({
        success: false,
        message: `This is not a subscription payment. Payment type: ${payment.paymentType}`
      });
    }
    
    console.log('✓ Payment verified:', payment._id);
    console.log('  User:', payment.user.fullName, '(', payment.user.email, ')');
    console.log('  Amount:', payment.amount, payment.currency);
    console.log('  Phone:', payment.phoneNumber);
    
    // Check if subscription already exists
    const existingSubscription = await UserSubscription.findOne({
      user: payment.user._id,
      subscription: payment.metadata.subscriptionId
    }).sort({ createdAt: -1 });
    
    if (existingSubscription) {
      console.log('⚠️ Subscription already exists:', existingSubscription._id);
      return res.status(200).json({
        success: true,
        message: 'Subscription already exists for this payment',
        data: { 
          subscription: existingSubscription,
          alreadyExists: true
        }
      });
    }
    
    // Get subscription plan
    const { subscriptionId, language, expiryDate } = payment.metadata;
    
    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription plan information in payment metadata'
      });
    }
    
    const subscriptionPlan = await Subscription.findById(subscriptionId);
    
    if (!subscriptionPlan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found in database'
      });
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
    
    // Prepare subscription data
    const subscriptionData = {
      user: payment.user._id,
      subscription: subscriptionPlan._id,
      startDate,
      endDate,
      isActive: true,
      examAttemptsUsed: 0
    };
    
    console.log('Creating UserSubscription...');
    
    // Create user subscription
    const userSubscription = await UserSubscription.create(subscriptionData);
    
    console.log('✅ UserSubscription created successfully:', userSubscription._id);
    console.log('=== MANUAL SUBSCRIPTION ACTIVATION END ===');
    
    // Return response with user and plan info
    const userLanguage = language || LANGUAGES.ENGLISH;
    
    res.status(201).json({
      success: true,
      message: `Subscription manually activated successfully for ${payment.user.fullName}`,
      data: { 
        subscription: userSubscription,
        user: {
          id: payment.user._id,
          name: payment.user.fullName,
          email: payment.user.email,
          phone: payment.user.phoneNumber
        },
        payment: {
          id: payment._id,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          completedAt: payment.completedAt
        },
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
    console.error('=== MANUAL ACTIVATION ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    next(error);
  }
};

// @desc    Get all payments (subscriptions + digital products) - Admin
// @route   GET /api/subscriptions/admin/payments
// @access  Private/Admin
const getAllPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, paymentType } = req.query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { status: PAYMENT_STATUS.COMPLETED };
    if (paymentType && [PAYMENT_TYPES.SUBSCRIPTION, PAYMENT_TYPES.PRODUCT].includes(paymentType)) {
      filter.paymentType = paymentType;
    }

    const count = await Payment.countDocuments(filter);
    
    const payments = await Payment.find(filter)
      .populate('user', 'fullName email phoneNumber')
      .populate({
        path: 'referenceId',
        select: 'title name description productType language pricing'
      })
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ completedAt: -1, createdAt: -1 });

    // Format payments with detailed information
    const formattedPayments = payments.map(payment => {
      const baseData = {
        _id: payment._id,
        user: payment.user,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        phoneNumber: payment.phoneNumber,
        status: payment.status,
        paymentType: payment.paymentType,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt || payment.createdAt
      };

      // Add specific details based on payment type
      if (payment.paymentType === PAYMENT_TYPES.SUBSCRIPTION) {
        return {
          ...baseData,
          itemDetails: {
            type: 'subscription',
            name: payment.metadata?.subscriptionType || 'Subscription',
            language: payment.metadata?.language,
            examLimit: payment.metadata?.examLimit,
            expiryDate: payment.metadata?.expiryDate
          }
        };
      } else if (payment.paymentType === PAYMENT_TYPES.PRODUCT) {
        // For digital products, referenceId points to the product
        const product = payment.referenceId;
        return {
          ...baseData,
          itemDetails: {
            type: 'product',
            name: product?.title || 'Digital Product',
            productType: product?.productType,
            language: product?.language,
            description: product?.description
          }
        };
      }

      return baseData;
    });

    // Calculate revenue by type
    const subscriptionRevenue = payments
      .filter(p => p.paymentType === PAYMENT_TYPES.SUBSCRIPTION)
      .reduce((sum, p) => sum + p.amount, 0);
    
    const productRevenue = payments
      .filter(p => p.paymentType === PAYMENT_TYPES.PRODUCT)
      .reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { 
        payments: formattedPayments,
        stats: {
          totalRevenue: subscriptionRevenue + productRevenue,
          subscriptionRevenue,
          productRevenue,
          totalPayments: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Directly activate subscription for a user (Admin only - NO PAYMENT NEEDED)
// @route   POST /api/subscriptions/admin/direct-activate
// @access  Private/Admin
const directActivateSubscription = async (req, res, next) => {
  try {
    const { userId, subscriptionType, planDetails } = req.body;
    
    console.log('=== DIRECT SUBSCRIPTION ACTIVATION START ===');
    console.log('Admin:', req.user?.email);
    console.log('Target user ID:', userId);
    console.log('Subscription type:', subscriptionType);
    
    // Validate required fields
    if (!userId || !subscriptionType) {
      return res.status(400).json({
        success: false,
        message: 'userId and subscriptionType are required'
      });
    }

    // 1. Verify user exists
    const { User } = require('../models');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✓ User found:', user.fullName);

    // 2. Get subscription plan details
    const plan = await Subscription.findOne({ type: subscriptionType });
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    console.log('✓ Plan found:', plan.name.en);

    // 3. Calculate subscription dates
    const startDate = new Date();
    let endDate = null;
    
    if (plan.durationDays) {
      // Time-based subscription (7/15/30 days unlimited)
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationDays);
      console.log('Time-based subscription, endDate:', endDate);
    } else {
      // Exam-based subscription (1/5 exams) - set far future date
      endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 10);
      console.log('Exam-based subscription, no expiry');
    }

    // 🔧 Clean up any incomplete exams from previous attempts
    const { ExamAttempt } = require('../models');
    const abandonedCount = await ExamAttempt.updateMany(
      { 
        user: userId, 
        status: 'in_progress' 
      },
      { 
        $set: { 
          status: 'abandoned',
          endTime: new Date()
        } 
      }
    );

    if (abandonedCount.modifiedCount > 0) {
      console.log(`✓ Abandoned ${abandonedCount.modifiedCount} incomplete exam(s)`);
    }

    // 🔧 Deactivate any existing active subscriptions for this user
    const deactivatedCount = await UserSubscription.updateMany(
      {
        user: userId,
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );

    if (deactivatedCount.modifiedCount > 0) {
      console.log(`✓ Deactivated ${deactivatedCount.modifiedCount} old subscription(s)`);
    }

    // 4. Create the user subscription
    const userSubscription = await UserSubscription.create({
      user: userId,
      subscription: plan._id,
      startDate,
      endDate,
      isActive: true,
      examAttemptsUsed: 0,
      // Track admin activation
      activatedBy: 'admin',
      activatedByAdmin: req.user?._id,
      activationNote: `Direct activation by admin ${req.user?.fullName || 'System'}`,
      planSnapshot: {
        type: plan.type,
        name: planDetails?.name || plan.name.en,
        examLimit: plan.examLimit,
        durationDays: plan.durationDays
      }
    });

    console.log('✅ Subscription created:', userSubscription._id);
    console.log('=== DIRECT SUBSCRIPTION ACTIVATION END ===');

    // 5. Return success response
    res.status(201).json({
      success: true,
      message: `Subscription successfully activated for ${user.fullName}!`,
      data: {
        subscription: {
          id: userSubscription._id,
          type: plan.type,
          planName: plan.name,
          startDate: userSubscription.startDate,
          endDate: userSubscription.endDate,
          examLimit: plan.examLimit,
          isActive: userSubscription.isActive,
          user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email
          }
        }
      }
    });

  } catch (error) {
    console.error('=== DIRECT ACTIVATION ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
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
  cancelSubscription,
  manuallyActivateSubscription,  // 👈 NEW ENDPOINT!
  directActivateSubscription,  // 👈 NEW ENDPOINT!
  getAllPayments 
};
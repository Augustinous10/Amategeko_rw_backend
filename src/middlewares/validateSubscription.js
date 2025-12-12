const { UserSubscription, Subscription } = require('../models');
const { USER_ROLES } = require('../utils/constants');

/**
 * Check if user has active subscription
 * This middleware MUST come before hasExamAttempts
 */
const hasActiveSubscription = async (req, res, next) => {
  try {
    // Admins bypass subscription check
    if (req.user.role === USER_ROLES.ADMIN) {
      req.isAdmin = true;
      return next();
    }

    // Find active subscription
    const activeSubscription = await UserSubscription.findOne({
      user: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() } // Changed from $gt to $gte (includes today)
    }).populate('subscription');

    if (!activeSubscription) {
      return res.status(403).json({
        success: false,
        message: 'You need an active subscription to access this feature. Please purchase a subscription plan.',
        requiresSubscription: true,
        code: 'NO_SUBSCRIPTION'
      });
    }

    // Double-check if subscription has actually expired (safety check)
    const now = new Date();
    if (activeSubscription.endDate < now) {
      // Mark as inactive
      activeSubscription.isActive = false;
      await activeSubscription.save();

      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please renew your subscription.',
        requiresSubscription: true,
        subscriptionExpired: true,
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Attach subscription to request for use in next middleware/controller
    req.userSubscription = activeSubscription;
    req.subscriptionPlan = activeSubscription.subscription;
    
    next();
  } catch (error) {
    console.error('Subscription validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating subscription',
      error: error.message
    });
  }
};

/**
 * Check if user has exam attempts remaining
 * MUST be used AFTER hasActiveSubscription middleware
 */
const hasExamAttempts = async (req, res, next) => {
  try {
    // Admins bypass attempt check
    if (req.user.role === USER_ROLES.ADMIN || req.isAdmin) {
      return next();
    }

    // This should have been set by hasActiveSubscription middleware
    const subscription = req.userSubscription;
    const plan = req.subscriptionPlan;
    
    if (!subscription || !plan) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription found.',
        code: 'NO_SUBSCRIPTION'
      });
    }

    // Check the examLimit field from the Subscription model (not features.examAttempts)
    const examLimit = plan.examLimit;
    
    // If examLimit is null or 0, it means UNLIMITED exams (time-based subscription)
    if (examLimit === null || examLimit === 0) {
      console.log('Unlimited exam subscription - allowing access');
      return next();
    }

    // For count-based subscriptions, check if limit reached
    const attemptsUsed = subscription.examAttemptsUsed || 0;
    const attemptsRemaining = examLimit - attemptsUsed;

    if (attemptsUsed >= examLimit) {
      return res.status(403).json({
        success: false,
        message: `You have used all ${examLimit} exam attempts. Please purchase more exams to continue.`,
        examLimitReached: true,
        attemptsUsed,
        attemptsLimit: examLimit,
        attemptsRemaining: 0,
        code: 'EXAM_LIMIT_REACHED'
      });
    }

    // Warn user if running low on attempts (optional - adds to request)
    if (attemptsRemaining <= 2 && attemptsRemaining > 0) {
      req.examWarning = `Warning: You have only ${attemptsRemaining} exam attempt(s) remaining.`;
    }

    // Add attempt info to request for use in controller
    req.examAttempts = {
      used: attemptsUsed,
      limit: examLimit,
      remaining: attemptsRemaining
    };

    next();
  } catch (error) {
    console.error('Exam attempts check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking exam attempts',
      error: error.message
    });
  }
};

/**
 * Check if subscription includes specific feature
 * Optional middleware for feature-gating
 */
const hasFeature = (featureName) => {
  return (req, res, next) => {
    try {
      // Admins bypass feature check
      if (req.user.role === USER_ROLES.ADMIN || req.isAdmin) {
        return next();
      }

      const subscription = req.userSubscription;
      
      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found.',
          code: 'NO_SUBSCRIPTION'
        });
      }

      const features = subscription.subscription.features || {};
      const hasAccess = features[featureName];
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Your subscription does not include access to ${featureName}. Please upgrade your plan.`,
          code: 'FEATURE_NOT_INCLUDED'
        });
      }

      next();
    } catch (error) {
      console.error('Feature check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: error.message
      });
    }
  };
};

/**
 * Combined middleware: Check subscription AND exam attempts in one go
 * More efficient than chaining two separate middlewares
 */
const canTakeExam = async (req, res, next) => {
  try {
    // Admins bypass all checks
    if (req.user.role === USER_ROLES.ADMIN) {
      req.isAdmin = true;
      return next();
    }

    // 1. Check active subscription
    const activeSubscription = await UserSubscription.findOne({
      user: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() }
    }).populate('subscription');

    if (!activeSubscription) {
      return res.status(403).json({
        success: false,
        message: 'You need to purchase a subscription plan to take exams.',
        requiresSubscription: true,
        code: 'NO_SUBSCRIPTION'
      });
    }

    // 2. Check if subscription expired
    const now = new Date();
    if (activeSubscription.endDate < now) {
      activeSubscription.isActive = false;
      await activeSubscription.save();

      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please renew your plan.',
        requiresSubscription: true,
        subscriptionExpired: true,
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    const plan = activeSubscription.subscription;
    const examLimit = plan.examLimit;
    const attemptsUsed = activeSubscription.examAttemptsUsed || 0;

    // 3. Check exam attempts (for count-based subscriptions)
    if (examLimit !== null && examLimit > 0) {
      const attemptsRemaining = examLimit - attemptsUsed;

      if (attemptsUsed >= examLimit) {
        return res.status(403).json({
          success: false,
          message: `You have used all ${examLimit} exam attempts. Please purchase more exams.`,
          examLimitReached: true,
          attemptsUsed,
          attemptsLimit: examLimit,
          attemptsRemaining: 0,
          code: 'EXAM_LIMIT_REACHED'
        });
      }

      // Add warning if running low
      if (attemptsRemaining <= 2 && attemptsRemaining > 0) {
        req.examWarning = `You have ${attemptsRemaining} exam attempt(s) remaining.`;
      }

      req.examAttempts = {
        used: attemptsUsed,
        limit: examLimit,
        remaining: attemptsRemaining
      };
    } else {
      // Unlimited exams (time-based subscription)
      req.examAttempts = {
        used: attemptsUsed,
        limit: 'Unlimited',
        remaining: 'Unlimited'
      };
    }

    // All checks passed - attach to request
    req.userSubscription = activeSubscription;
    req.subscriptionPlan = plan;
    req.hasActiveSubscription = true;

    next();
  } catch (error) {
    console.error('Can take exam check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying exam eligibility',
      error: error.message
    });
  }
};

module.exports = {
  hasActiveSubscription,
  hasExamAttempts,
  hasFeature,
  canTakeExam // ⭐ Recommended: Use this for exam routes
};
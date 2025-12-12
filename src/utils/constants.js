// utils/constants.js - COMPLETE UPDATED VERSION

// User Roles - FIXED TO MATCH FRONTEND
const USER_ROLES = {
  CLIENT: 'client',  // ← Changed from USER: 'user'
  ADMIN: 'admin'
};

// Languages
const LANGUAGES = {
  KINYARWANDA: 'rw',
  ENGLISH: 'en',
  FRENCH: 'fr'
};

// Exam Configuration
const EXAM_CONFIG = {
  TOTAL_QUESTIONS: 20,
  PICTURE_QUESTIONS_MIN: 4,
  TIME_LIMIT_MINUTES: 20,
  PASSING_SCORE: 12,
  PASSING_PERCENTAGE: 60
};

// Question Difficulty
const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

// Product Types (for digital products)
const PRODUCT_TYPES = {
  IGAZETE: 'igazete',
  QUESTIONS_400: 'questions_400'
};

// Payment Methods
const PAYMENT_METHODS = {
  MTN_MOMO: 'mtn_momo',
  AIRTEL_MONEY: 'airtel_money',
  SPENN: 'spenn'
};

// Payment Status
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Payment Types
const PAYMENT_TYPES = {
  SUBSCRIPTION: 'subscription',
  PRODUCT: 'product'
};

// Exam Status
const EXAM_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned'
};

// ========== NEW: SUBSCRIPTION SYSTEM ==========

// Subscription Types
const SUBSCRIPTION_TYPES = {
  SINGLE_EXAM: 'single_exam',
  FIVE_EXAMS: 'five_exams',
  SEVEN_DAYS: 'seven_days',
  FIFTEEN_DAYS: 'fifteen_days',
  THIRTY_DAYS: 'thirty_days'
};

// Subscription Status
const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
};

// Pricing structure based on language and subscription type (in RWF)
const SUBSCRIPTION_PRICING = {
  [SUBSCRIPTION_TYPES.SINGLE_EXAM]: {
    [LANGUAGES.KINYARWANDA]: 100,
    [LANGUAGES.ENGLISH]: 200,
    [LANGUAGES.FRENCH]: 200
  },
  [SUBSCRIPTION_TYPES.FIVE_EXAMS]: {
    [LANGUAGES.KINYARWANDA]: 500,
    [LANGUAGES.ENGLISH]: 800,
    [LANGUAGES.FRENCH]: 800
  },
  [SUBSCRIPTION_TYPES.SEVEN_DAYS]: {
    [LANGUAGES.KINYARWANDA]: 2500,
    [LANGUAGES.ENGLISH]: 3000,
    [LANGUAGES.FRENCH]: 3000
  },
  [SUBSCRIPTION_TYPES.FIFTEEN_DAYS]: {
    [LANGUAGES.KINYARWANDA]: 4500,
    [LANGUAGES.ENGLISH]: 5000,
    [LANGUAGES.FRENCH]: 5000
  },
  [SUBSCRIPTION_TYPES.THIRTY_DAYS]: {
    [LANGUAGES.KINYARWANDA]: 7000,
    [LANGUAGES.ENGLISH]: 8000,
    [LANGUAGES.FRENCH]: 8000
  }
};

// Digital product pricing (fixed for all languages)
const DIGITAL_PRODUCT_PRICES = {
  IGAZETE: 4000,
  QUESTION_BANK_400: 4000
};

// ========== HELPER FUNCTIONS ==========

// Get subscription price based on type and language
const getSubscriptionPrice = (subscriptionType, language) => {
  if (!SUBSCRIPTION_PRICING[subscriptionType]) {
    throw new Error('Invalid subscription type');
  }
  
  if (!SUBSCRIPTION_PRICING[subscriptionType][language]) {
    throw new Error('Invalid language for this subscription');
  }
  
  return SUBSCRIPTION_PRICING[subscriptionType][language];
};

// Get exam limits based on subscription type
const getExamLimits = (subscriptionType) => {
  const limits = {
    [SUBSCRIPTION_TYPES.SINGLE_EXAM]: { exams: 1, days: null },
    [SUBSCRIPTION_TYPES.FIVE_EXAMS]: { exams: 5, days: null },
    [SUBSCRIPTION_TYPES.SEVEN_DAYS]: { exams: Infinity, days: 7 },
    [SUBSCRIPTION_TYPES.FIFTEEN_DAYS]: { exams: Infinity, days: 15 },
    [SUBSCRIPTION_TYPES.THIRTY_DAYS]: { exams: Infinity, days: 30 }
  };
  
  return limits[subscriptionType] || { exams: 0, days: 0 };
};

// Get language display name
const getLanguageDisplayName = (languageCode) => {
  const names = {
    [LANGUAGES.KINYARWANDA]: 'Kinyarwanda',
    [LANGUAGES.ENGLISH]: 'English',
    [LANGUAGES.FRENCH]: 'French'
  };
  return names[languageCode] || languageCode;
};

// Get subscription type display name
const getSubscriptionDisplayName = (subscriptionType) => {
  const names = {
    [SUBSCRIPTION_TYPES.SINGLE_EXAM]: '1 Exam',
    [SUBSCRIPTION_TYPES.FIVE_EXAMS]: '5 Exams',
    [SUBSCRIPTION_TYPES.SEVEN_DAYS]: '7 Days Unlimited',
    [SUBSCRIPTION_TYPES.FIFTEEN_DAYS]: '15 Days Unlimited',
    [SUBSCRIPTION_TYPES.THIRTY_DAYS]: '30 Days Unlimited'
  };
  return names[subscriptionType] || subscriptionType;
};

// ========== LEGACY (kept for backward compatibility) ==========
const SUBSCRIPTION_PLANS = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
  PRO: 'Pro'
};

// ========== EXPORTS ==========
module.exports = {
  // User & Auth
  USER_ROLES,
  
  // Languages
  LANGUAGES,
  
  // Exam
  EXAM_CONFIG,
  EXAM_STATUS,
  
  // Questions
  DIFFICULTY,
  
  // Products
  PRODUCT_TYPES,
  DIGITAL_PRODUCT_PRICES,
  
  // Payments
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  
  // Subscriptions (NEW)
  SUBSCRIPTION_TYPES,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PRICING,
  
  // Legacy
  SUBSCRIPTION_PLANS,
  
  // Helper Functions
  getSubscriptionPrice,
  getExamLimits,
  getLanguageDisplayName,
  getSubscriptionDisplayName
};
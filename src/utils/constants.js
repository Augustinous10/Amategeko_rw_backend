// User Roles
const USER_ROLES = {
  USER: 'user',
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

// Question Categories
const QUESTION_CATEGORIES = {
  ROAD_SIGNS: 'road_signs',
  TRAFFIC_RULES: 'traffic_rules',
  SAFETY: 'safety',
  PARKING: 'parking',
  EMERGENCY: 'emergency',
  VEHICLE_OPERATION: 'vehicle_operation'
};

// Product Categories
const PRODUCT_CATEGORIES = {
  THEORY: 'theory',
  ROAD_SIGNS: 'road_signs',
  PRACTICE_TESTS: 'practice_tests',
  GENERAL: 'general'
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

// Subscription Plans
const SUBSCRIPTION_PLANS = {
  BASIC: 'Basic',
  PREMIUM: 'Premium',
  PRO: 'Pro'
};

module.exports = {
  USER_ROLES,
  LANGUAGES,
  EXAM_CONFIG,
  DIFFICULTY,
  QUESTION_CATEGORIES,
  PRODUCT_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  EXAM_STATUS,
  SUBSCRIPTION_PLANS
};
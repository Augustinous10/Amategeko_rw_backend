// Import all Mongoose models
const User = require('./User');
const Subscription = require('./Subscription'); // Make sure this line exists
const UserSubscription = require('./UserSubscription');
const DigitalProduct = require('./DigitalProduct');
const Purchase = require('./Purchase');
const Question = require('./Question');
const QuestionTranslation = require('./QuestionTranslation');
const ExamAttempt = require('./ExamAttempt');
const ExamAnswer = require('./ExamAnswer');
const Payment = require('./Payment');

// Export all models
module.exports = {
  User,
  Subscription,
  UserSubscription,
  DigitalProduct,
  Purchase,
  Question,
  QuestionTranslation,
  ExamAttempt,
  ExamAnswer,
  Payment
};
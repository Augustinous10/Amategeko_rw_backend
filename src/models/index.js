const User = require('./User');
const Subscription = require('./Subscription');
const UserSubscription = require('./UserSubscription');
const DigitalProduct = require('./DigitalProduct');
const Purchase = require('./Purchase');
const Question = require('./Question');
const QuestionTranslation = require('./QuestionTranslation');
const ExamAttempt = require('./ExamAttempt');
const ExamAnswer = require('./ExamAnswer');
const Payment = require('./Payment');

// ===== ASSOCIATIONS =====

// User <-> UserSubscription (One-to-Many)
User.hasMany(UserSubscription, { foreignKey: 'userId', as: 'userSubscriptions' });
UserSubscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Subscription <-> UserSubscription (One-to-Many)
Subscription.hasMany(UserSubscription, { foreignKey: 'subscriptionId', as: 'userSubscriptions' });
UserSubscription.belongsTo(Subscription, { foreignKey: 'subscriptionId', as: 'subscription' });

// User <-> Purchase (One-to-Many)
User.hasMany(Purchase, { foreignKey: 'userId', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// DigitalProduct <-> Purchase (One-to-Many)
DigitalProduct.hasMany(Purchase, { foreignKey: 'productId', as: 'purchases' });
Purchase.belongsTo(DigitalProduct, { foreignKey: 'productId', as: 'product' });

// Payment <-> Purchase (One-to-Many)
Payment.hasMany(Purchase, { foreignKey: 'paymentId', as: 'purchases' });
Purchase.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// User <-> Payment (One-to-Many)
User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Question <-> QuestionTranslation (One-to-Many)
Question.hasMany(QuestionTranslation, { foreignKey: 'questionId', as: 'translations' });
QuestionTranslation.belongsTo(Question, { foreignKey: 'questionId', as: 'question' });

// User <-> ExamAttempt (One-to-Many)
User.hasMany(ExamAttempt, { foreignKey: 'userId', as: 'examAttempts' });
ExamAttempt.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ExamAttempt <-> ExamAnswer (One-to-Many)
ExamAttempt.hasMany(ExamAnswer, { foreignKey: 'examAttemptId', as: 'answers' });
ExamAnswer.belongsTo(ExamAttempt, { foreignKey: 'examAttemptId', as: 'examAttempt' });

// Question <-> ExamAnswer (One-to-Many)
Question.hasMany(ExamAnswer, { foreignKey: 'questionId', as: 'examAnswers' });
ExamAnswer.belongsTo(Question, { foreignKey: 'questionId', as: 'question' });

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
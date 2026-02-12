const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  examAttemptsUsed: {
    type: Number,
    default: 0
  },
  
  // Admin activation fields
  activatedBy: {
    type: String,
    enum: ['payment', 'admin'],
    default: 'payment'
  },
  activatedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  activationNote: {
    type: String,
    required: false
  },
  planSnapshot: {
    type: {
      type: String
    },
    name: String,
    examLimit: Number,
    durationDays: Number
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSubscriptionSchema.index({ user: 1, isActive: 1, endDate: 1 });

// Prevent OverwriteModelError on hot reload
module.exports = mongoose.models.UserSubscription || mongoose.model('UserSubscription', userSubscriptionSchema);
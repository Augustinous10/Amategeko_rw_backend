const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Subscription type is required'],
    unique: true,
    trim: true
  },
  name: {
    rw: { type: String, required: true },  // Kinyarwanda
    en: { type: String, required: true },  // English
    fr: { type: String, required: true }   // French
  },
  description: {
    rw: { type: String },
    en: { type: String },
    fr: { type: String }
  },
  pricing: {
    rw: {
      type: Number,
      required: true,
      min: 0
    },
    en: {
      type: Number,
      required: true,
      min: 0
    },
    fr: {
      type: Number,
      required: true,
      min: 0
    }
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  durationDays: {
    type: Number,
    default: null
  },
  examLimit: {
    type: Number,
    default: null
  },
  features: {
    examAttempts: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

subscriptionSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
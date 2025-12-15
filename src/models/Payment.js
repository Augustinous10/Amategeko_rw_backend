const mongoose = require('mongoose');
const { PAYMENT_STATUS, PAYMENT_TYPES, PAYMENT_METHODS } = require('../utils/constants');

const paymentSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment type (subscription or product)
  paymentType: {
    type: String,
    enum: Object.values(PAYMENT_TYPES),
    required: true
  },
  
  // Reference ID (subscription ID or product ID)
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Made optional for general payments
  },
  
  // Amount and currency
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'RWF',
    enum: ['RWF']
  },
  
  // Payment method and phone
  paymentMethod: {
    type: String,
    required: true,
    enum: Object.values(PAYMENT_METHODS)
  },
  
  // ✅ UPDATED: Accept multiple phone number formats
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Remove spaces and dashes for validation
        const cleaned = v.replace(/[\s-]/g, '');
        
        // Accept these formats:
        // 0781234567 (10 digits starting with 07)
        // +250781234567 (with +250)
        // 250781234567 (with 250)
        // 781234567 (9 digits starting with 7)
        return /^(\+?250|0)?7[0-9]{8}$/.test(cleaned);
      },
      message: 'Please enter a valid Rwandan phone number (e.g., 0781234567, +250781234567)'
    }
  },
  
  // Payment status
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING
  },
  
  // ITEC Payment transaction ID
  transactionId: {
    type: String,
    default: null
  },
  
  // Metadata (store additional info like subscription details)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Timestamps
  completedAt: {
    type: Date,
    default: null
  },
  
  failedAt: {
    type: Date,
    default: null
  },
  
  // Cancellation tracking
  cancelledAt: {
    type: Date,
    default: null
  },
  
  cancellationReason: {
    type: String,
    default: null
  },
  
  // Error message if payment failed
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// ==========================================
// PRE-SAVE HOOK - NORMALIZE PHONE NUMBERS
// ==========================================

/**
 * ✅ Normalize phone numbers to standard Rwanda format (07XXXXXXXX)
 * 
 * This ensures all phone numbers are stored consistently regardless
 * of how users enter them (with/without country code, with/without +)
 */
paymentSchema.pre('save', function(next) {
  if (this.phoneNumber && this.isModified('phoneNumber')) {
    // Remove spaces, dashes, and plus signs
    let cleaned = this.phoneNumber.replace(/[\s\-+]/g, '');
    
    // If it starts with 250 (country code), remove it and add 0
    if (cleaned.startsWith('250')) {
      cleaned = '0' + cleaned.substring(3);
    }
    
    // If it doesn't start with 0, add it
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
    
    // Store in normalized format: 07XXXXXXXX
    this.phoneNumber = cleaned;
  }
  next();
});

// Index for faster queries
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ transactionId: 1 }, { sparse: true });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ user: 1, paymentType: 1, referenceId: 1 });
paymentSchema.index({ status: 1, createdAt: 1 }); // For expired payment queries

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * ✅ Cancel expired pending payments
 * 
 * PURPOSE: Mobile money payments typically expire after 15 minutes.
 * This method automatically cancels any pending payments that are older
 * than 15 minutes to keep the database clean and prevent confusion.
 * 
 * HOW IT WORKS:
 * 1. Calculates the expiry time (15 minutes ago from now)
 * 2. Finds all payments that are:
 *    - Still in 'pending' status
 *    - Created more than 15 minutes ago
 * 3. Updates them to 'cancelled' status
 * 4. Records when and why they were cancelled
 * 
 * RUNS AUTOMATICALLY: Every 5 minutes via the payment scheduler
 * 
 * @returns {Promise<Object>} Result object with number of cancelled payments
 */
paymentSchema.statics.cancelExpiredPayments = async function() {
  try {
    // Calculate expiry time: 15 minutes ago
    const EXPIRY_MINUTES = 15;
    const expiryTime = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000);
    
    console.log(`🔍 Checking for payments older than ${EXPIRY_MINUTES} minutes...`);
    console.log(`   Expiry cutoff time: ${expiryTime.toISOString()}`);
    
    // Find and update expired payments
    const result = await this.updateMany(
      {
        status: PAYMENT_STATUS.PENDING,  // Only pending payments
        createdAt: { $lt: expiryTime }   // Created before expiry time
      },
      {
        $set: { 
          status: PAYMENT_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: `Payment expired after ${EXPIRY_MINUTES} minutes of inactivity`
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`✅ Cancelled ${result.modifiedCount} expired payment(s)`);
    } else {
      console.log('✓ No expired payments found');
    }
    
    return {
      success: true,
      cancelledCount: result.modifiedCount,
      message: `Cancelled ${result.modifiedCount} expired payment(s)`
    };
    
  } catch (error) {
    console.error('❌ Error cancelling expired payments:', error);
    throw error;
  }
};

/**
 * ✅ Get payment statistics for a user
 * 
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} Payment statistics
 */
paymentSchema.statics.getUserPaymentStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
  
  return stats;
};

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Mark payment as completed
 */
paymentSchema.methods.markAsCompleted = function(transactionId) {
  this.status = PAYMENT_STATUS.COMPLETED;
  this.completedAt = new Date();
  this.transactionId = transactionId;
  return this.save();
};

/**
 * Mark payment as failed
 */
paymentSchema.methods.markAsFailed = function(errorMessage) {
  this.status = PAYMENT_STATUS.FAILED;
  this.failedAt = new Date();
  this.errorMessage = errorMessage;
  return this.save();
};

/**
 * Mark payment as cancelled
 */
paymentSchema.methods.markAsCancelled = function(reason) {
  this.status = PAYMENT_STATUS.CANCELLED;
  this.cancelledAt = new Date();
  this.cancellationReason = reason || 'Cancelled by user';
  return this.save();
};

module.exports = mongoose.model('Payment', paymentSchema);
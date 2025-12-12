// utils/paymentUtils.js

const { Payment } = require('../models');
const { PAYMENT_STATUS } = require('./constants');

/**
 * Format phone number for ITECPay
 * Ensures phone number is in correct format
 */
const formatPhoneNumber = (phoneNumber) => {
  // Remove any spaces or special characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Ensure it starts with 07
  if (!cleaned.startsWith('07')) {
    throw new Error('Phone number must start with 07');
  }
  
  // Ensure it's 10 digits
  if (cleaned.length !== 10) {
    throw new Error('Phone number must be 10 digits');
  }
  
  return cleaned;
};

/**
 * Validate Rwandan phone number
 */
const isValidRwandaPhone = (phoneNumber) => {
  const regex = /^07[2389]\d{7}$/;
  return regex.test(phoneNumber);
};

/**
 * Get payment method display name
 */
const getPaymentMethodName = (method) => {
  const names = {
    mtn_momo: 'MTN Mobile Money',
    airtel_money: 'Airtel Money',
    spenn: 'SPENN'
  };
  return names[method] || method;
};

/**
 * Calculate transaction fee (if applicable)
 * ITECPay might charge fees - adjust as needed
 */
const calculateTransactionFee = (amount, paymentMethod) => {
  // Example: 1% fee with minimum 10 RWF
  const feePercent = 0.01;
  const fee = Math.max(amount * feePercent, 10);
  return Math.round(fee);
};

/**
 * Format amount for display
 */
const formatAmount = (amount, currency = 'RWF') => {
  return `${amount.toLocaleString()} ${currency}`;
};

/**
 * Check if payment can be retried
 */
const canRetryPayment = (payment) => {
  if (!payment) return false;
  
  const allowedStatuses = [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED];
  return allowedStatuses.includes(payment.status);
};

/**
 * Auto-cancel expired pending payments
 * Should be run periodically (e.g., every 5 minutes)
 */
const cancelExpiredPayments = async () => {
  try {
    const result = await Payment.cancelExpiredPayments();
    
    if (result.modifiedCount > 0) {
      console.log(`Auto-cancelled ${result.modifiedCount} expired payment(s)`);
    }
    
    return result;
  } catch (error) {
    console.error('Error cancelling expired payments:', error);
    throw error;
  }
};

/**
 * Get payment summary statistics
 */
const getPaymentStats = async (userId, startDate, endDate) => {
  const matchFilter = {
    user: userId,
    createdAt: {
      $gte: startDate || new Date(0),
      $lte: endDate || new Date()
    }
  };
  
  const stats = await Payment.aggregate([
    { $match: matchFilter },
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

/**
 * Scheduler to run periodic tasks
 */
class PaymentScheduler {
  constructor() {
    this.intervals = [];
  }
  
  // Start the scheduler
  start() {
    console.log('Payment scheduler started');
    
    // Cancel expired payments every 5 minutes
    const cancelInterval = setInterval(async () => {
      try {
        await cancelExpiredPayments();
      } catch (error) {
        console.error('Scheduled task error (cancel expired):', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    this.intervals.push(cancelInterval);
    
    // Initial run
    cancelExpiredPayments().catch(err => 
      console.error('Initial cancel expired payments failed:', err)
    );
  }
  
  // Stop the scheduler
  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('Payment scheduler stopped');
  }
}

// Create singleton instance
const paymentScheduler = new PaymentScheduler();

module.exports = {
  formatPhoneNumber,
  isValidRwandaPhone,
  getPaymentMethodName,
  calculateTransactionFee,
  formatAmount,
  canRetryPayment,
  cancelExpiredPayments,
  getPaymentStats,
  paymentScheduler
};
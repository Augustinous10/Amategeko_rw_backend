const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { PAYMENT_TYPES, PAYMENT_STATUS, PAYMENT_METHODS } = require('../utils/constants');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  paymentType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'payment_type',
    validate: {
      isIn: [[PAYMENT_TYPES.SUBSCRIPTION, PAYMENT_TYPES.PRODUCT]]
    }
  },
  referenceId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'reference_id',
    comment: 'subscription_id or product_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'RWF'
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'payment_method',
    validate: {
      isIn: [[
        PAYMENT_METHODS.MTN_MOMO,
        PAYMENT_METHODS.AIRTEL_MONEY,
        PAYMENT_METHODS.SPENN
      ]]
    }
  },
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number'
  },
  transactionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    field: 'transaction_id',
    comment: 'ITECPay transaction ID'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: PAYMENT_STATUS.PENDING,
    validate: {
      isIn: [[
        PAYMENT_STATUS.PENDING,
        PAYMENT_STATUS.COMPLETED,
        PAYMENT_STATUS.FAILED,
        PAYMENT_STATUS.CANCELLED
      ]]
    }
  },
  paymentResponse: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'payment_response',
    comment: 'Store full ITECPay response'
  }
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true
});

module.exports = Payment;
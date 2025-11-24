const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserSubscription = sequelize.define('UserSubscription', {
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
  subscriptionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'subscription_id',
    references: {
      model: 'subscriptions',
      key: 'id'
    }
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_date'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_date'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  examAttemptsUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'exam_attempts_used'
  }
}, {
  tableName: 'user_subscriptions',
  timestamps: true,
  underscored: true
});

module.exports = UserSubscription;
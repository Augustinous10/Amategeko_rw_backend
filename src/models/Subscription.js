const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  durationDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'duration_days',
    comment: 'Duration in days (e.g., 30, 90, 365)'
  },
  features: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
    comment: 'JSON: { exam_attempts: 10, video_access: true, materials_access: true }'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'subscriptions',
  timestamps: true,
  underscored: true
});

module.exports = Subscription;
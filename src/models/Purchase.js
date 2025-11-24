const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Purchase = sequelize.define('Purchase', {
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
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'digital_products',
      key: 'id'
    }
  },
  paymentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'payment_id',
    references: {
      model: 'payments',
      key: 'id'
    }
  },
  purchaseDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'purchase_date'
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'download_count'
  },
  lastDownloadAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_download_at'
  }
}, {
  tableName: 'purchases',
  timestamps: false
});

module.exports = Purchase;
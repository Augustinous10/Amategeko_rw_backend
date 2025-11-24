const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { LANGUAGES, PRODUCT_CATEGORIES } = require('../utils/constants');

const DigitalProduct = sequelize.define('DigitalProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
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
  language: {
    type: DataTypes.STRING(2),
    allowNull: false,
    validate: {
      isIn: [[LANGUAGES.KINYARWANDA, LANGUAGES.ENGLISH, LANGUAGES.FRENCH]]
    }
  },
  fileUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'file_url'
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'file_size',
    comment: 'File size in bytes'
  },
  cloudinaryPublicId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'cloudinary_public_id'
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isIn: [[
        PRODUCT_CATEGORIES.THEORY,
        PRODUCT_CATEGORIES.ROAD_SIGNS,
        PRODUCT_CATEGORIES.PRACTICE_TESTS,
        PRODUCT_CATEGORIES.GENERAL
      ]]
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  downloadsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'downloads_count'
  }
}, {
  tableName: 'digital_products',
  timestamps: true,
  underscored: true
});

module.exports = DigitalProduct;
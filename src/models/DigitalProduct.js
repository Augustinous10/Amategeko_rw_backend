// models/DigitalProduct.js

const mongoose = require('mongoose');
const { PRODUCT_TYPES, LANGUAGES } = require('../utils/constants');

const digitalProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide product title'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  productType: {
    type: String,
    enum: Object.values(PRODUCT_TYPES),
    required: [true, 'Please specify product type']
  },
  language: {
    type: String,
    enum: Object.values(LANGUAGES),
    required: [true, 'Please specify language']
  },
  price: {
    type: Number,
    required: [true, 'Please provide price'],
    min: 0
  },
  currency: {
    type: String,
    default: 'RWF'
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  fileSize: {
    type: Number
  },
  cloudinaryPublicId: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  downloadsCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
digitalProductSchema.index({ productType: 1, language: 1, isActive: 1 });

// Ensure only one product per type per language (no duplicates)
digitalProductSchema.index({ productType: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('DigitalProduct', digitalProductSchema);
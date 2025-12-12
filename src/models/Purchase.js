const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DigitalProduct',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadAt: {
    type: Date
  }
});

// Index for user purchases
purchaseSchema.index({ user: 1, product: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
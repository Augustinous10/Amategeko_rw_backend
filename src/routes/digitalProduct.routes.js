const express = require('express');
const router = express.Router();
const { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  purchaseProduct,
  getMyPurchases,
  downloadProduct
} = require('../controllers/digitalProduct.controller');
const { authenticate, isAdmin } = require('../middlewares/auth');
const { uploadPDF } = require('../middlewares/upload');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);

// Protected user routes
router.post('/:id/purchase', authenticate, purchaseProduct);
router.get('/my-purchases', authenticate, getMyPurchases);
router.get('/:id/download', authenticate, downloadProduct);

// Admin routes
router.post('/', authenticate, isAdmin, uploadPDF.single('file'), createProduct);
router.put('/:id', authenticate, isAdmin, uploadPDF.single('file'), updateProduct);
router.delete('/:id', authenticate, isAdmin, deleteProduct);

module.exports = router;
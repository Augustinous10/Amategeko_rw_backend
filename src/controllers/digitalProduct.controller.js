const { DigitalProduct, Purchase, Payment } = require('../models');
const cloudinary = require('../config/cloudinary');
const { PAYMENT_TYPES, PAYMENT_STATUS, PRODUCT_TYPES, DIGITAL_PRODUCT_PRICES } = require('../utils/constants');

// @desc    Get all products (with filters)
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res, next) => {
  try {
    const { language, productType, page = 1, limit = 10 } = req.query;
    
    const filter = { isActive: true };
    if (language) filter.language = language;
    if (productType) filter.productType = productType;

    const skip = (page - 1) * limit;

    const count = await DigitalProduct.countDocuments(filter);
    const products = await DigitalProduct.find(filter)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { products }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await DigitalProduct.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product (Admin only)
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res, next) => {
  try {
    const { title, description, productType, language } = req.body;

    // Validate required fields
    if (!title || !productType || !language || !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, productType, language, and PDF file'
      });
    }

    // Validate product type
    if (!Object.values(PRODUCT_TYPES).includes(productType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product type. Must be igazete or questions_400'
      });
    }

    // Get fixed price based on product type
    const price = DIGITAL_PRODUCT_PRICES[productType.toUpperCase()] || DIGITAL_PRODUCT_PRICES.IGAZETE;

    // Upload PDF to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          folder: 'umuhanda/products',
          format: 'pdf'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Create product
    const product = await DigitalProduct.create({
      title,
      description,
      price,
      productType,
      language,
      fileUrl: uploadResult.secure_url,
      fileSize: req.file.size,
      cloudinaryPublicId: uploadResult.public_id
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product (Admin only)
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;

    const product = await DigitalProduct.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update PDF file if provided
    if (req.file) {
      // Delete old file from Cloudinary
      if (product.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(product.cloudinaryPublicId, { resource_type: 'raw' });
      }

      // Upload new file
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'umuhanda/products',
            format: 'pdf'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      product.fileUrl = uploadResult.secure_url;
      product.fileSize = req.file.size;
      product.cloudinaryPublicId = uploadResult.public_id;
    }

    // Update other fields (price and productType cannot be changed)
    if (title) product.title = title;
    if (description) product.description = description;
    if (typeof isActive === 'boolean') product.isActive = isActive;

    await product.save();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (Admin only)
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await DigitalProduct.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete file from Cloudinary
    if (product.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(product.cloudinaryPublicId, { resource_type: 'raw' });
    }

    await DigitalProduct.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Purchase product (initiate payment)
// @route   POST /api/products/:id/purchase
// @access  Private
const purchaseProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentMethod, phoneNumber } = req.body;

    // Validate input
    if (!paymentMethod || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide paymentMethod and phoneNumber'
      });
    }

    // Get product
    const product = await DigitalProduct.findById(id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    // Check if user already purchased
    const existingPurchase = await Purchase.findOne({
      user: req.user._id,
      product: id
    });

    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this product'
      });
    }

    // Create payment record
    const payment = await Payment.create({
      user: req.user._id,
      paymentType: PAYMENT_TYPES.PRODUCT,
      referenceId: id,
      amount: product.price,
      currency: 'RWF',
      paymentMethod,
      phoneNumber,
      status: PAYMENT_STATUS.PENDING
    });

    // TODO: Integrate with ITECPay API here

    res.status(201).json({
      success: true,
      message: 'Payment initiated. Complete payment on your phone.',
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        phoneNumber: payment.phoneNumber,
        productDetails: product
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Confirm product payment (webhook/callback handler)
// @route   POST /api/products/confirm-payment
// @access  Private/Internal (called by payment gateway)
const confirmProductPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;

    // Get payment
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status === PAYMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed'
      });
    }

    // Update payment status
    payment.status = PAYMENT_STATUS.COMPLETED;
    await payment.save();

    // Create purchase record
    const purchase = await Purchase.create({
      user: payment.user,
      product: payment.referenceId,
      payment: payment._id,
      purchaseDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Product purchased successfully',
      data: { purchase }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's purchased products
// @route   GET /api/products/my-purchases
// @access  Private
const getMyPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ user: req.user._id })
      .populate('product')
      .sort({ purchaseDate: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: { purchases }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download purchased product
// @route   GET /api/products/:id/download
// @access  Private
const downloadProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if user purchased the product
    const purchase = await Purchase.findOne({
      user: req.user._id,
      product: id
    }).populate('product');

    if (!purchase) {
      return res.status(403).json({
        success: false,
        message: 'You have not purchased this product'
      });
    }

    // Update download count
    purchase.downloadCount += 1;
    purchase.lastDownloadAt = new Date();
    await purchase.save();

    // Update product download count
    await DigitalProduct.findByIdAndUpdate(id, {
      $inc: { downloadsCount: 1 }
    });

    // Return download URL
    res.status(200).json({
      success: true,
      data: {
        downloadUrl: purchase.product.fileUrl,
        fileName: `${purchase.product.title}.pdf`
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  purchaseProduct,
  confirmProductPayment,
  getMyPurchases,
  downloadProduct
};
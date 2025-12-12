const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();

// File filter for PDFs
const pdfFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
  }
};

// Upload configuration for PDFs (max 20MB)
const uploadPDF = multer({
  storage,
  fileFilter: pdfFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

// Upload configuration for images (max 5MB)
const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// ✅ NEW: Upload configuration for questions with multiple images
const uploadQuestionImages = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB per file
  }
}).fields([
  { name: 'questionImage', maxCount: 1 },      // Main question image
  { name: 'optionImages', maxCount: 4 }        // Up to 4 option images
]);

module.exports = {
  uploadPDF,
  uploadImage,
  uploadQuestionImages  // ✅ Add this export
};
const mongoose = require('mongoose');

// ============================================
// QUESTION SCHEMA - MATCHES EXAM CONTROLLER STRUCTURE
// Each question exists in ONE language only
// ============================================

const optionSchema = new mongoose.Schema({
  optionText: {
    type: String,
    default: null
  },
  optionImage: {
    type: String,
    default: null
  },
  is_correct: {  // CRITICAL: Must be is_correct (with underscore) to match exam controller
    type: Boolean,
    required: true
  },
  order: {
    type: Number,
    required: true,
    min: 0,
    max: 3
  }
}, { _id: false });

const questionContentSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  image_url: {  // CRITICAL: Must be image_url (nested in question object) for picture question detection
    type: String,
    default: null
  }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  // Language for this question
  language: {
    type: String,
    required: [true, 'Language is required'],
    enum: ['en', 'fr', 'rw'], // English, French, Kinyarwanda
    index: true
  },
  
  // Question content (nested structure to match exam controller)
  question: {
    type: questionContentSchema,
    required: true
  },
  
  // Four options (each can have text, image, or both)
  options: {
    type: [optionSchema],
    required: true,
    validate: {
      validator: function(options) {
        // Must have exactly 4 options
        if (options.length !== 4) return false;
        
        // Must have exactly one correct answer
        const correctCount = options.filter(opt => opt.is_correct).length;
        if (correctCount !== 1) return false;
        
        // Each option must have either text or image
        return options.every(opt => opt.optionText || opt.optionImage);
      },
      message: 'Must have exactly 4 options with one correct answer, and each option must have text or image'
    }
  },
  
  // Optional fields
  category: {
    type: String,
    default: null
  },
  
  difficulty: {
    type: String,
    default: null
  },
  
  explanation: {
    type: String,
    default: null
  },
  
  tags: {
    type: [String],
    default: []
  },
  
  // Active status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  
  // ✅ FIXED: isPictureQuestion - set in pre-save hook
  isPictureQuestion: {
    type: Boolean,
    default: false,
    index: true  // Add index for faster exam generation queries
  },
  
  cloudinaryPublicId: {
    type: String,
    default: null
  },
  
  // Admin who created this question
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================
// Compound index for efficient exam generation (matches exam controller queries)
questionSchema.index({ language: 1, isActive: 1 });
questionSchema.index({ language: 1, isActive: 1, isPictureQuestion: 1 }); // ✅ Updated index
questionSchema.index({ language: 1, isActive: 1, "question.image_url": 1 });
questionSchema.index({ createdAt: -1 });

// ============================================
// VIRTUALS
// ============================================
// Get correct answer index (0-3)
questionSchema.virtual('correctAnswerIndex').get(function() {
  return this.options.findIndex(opt => opt.is_correct);
});

// Get correct answer letter (a, b, c, d)
questionSchema.virtual('correctAnswerLetter').get(function() {
  const index = this.options.findIndex(opt => opt.is_correct);
  return ['a', 'b', 'c', 'd'][index];
});

// Check if this is a picture question (legacy - use isPictureQuestion field instead)
questionSchema.virtual('hasPicture').get(function() {
  return this.isPictureQuestion;
});

// ============================================
// INSTANCE METHODS
// ============================================
// Check if selected answer is correct
questionSchema.methods.isAnswerCorrect = function(selectedIndex) {
  if (selectedIndex < 0 || selectedIndex >= this.options.length) {
    return false;
  }
  return this.options[selectedIndex].is_correct === true;
};

// Get correct answer details
questionSchema.methods.getCorrectAnswer = function() {
  return this.options.find(opt => opt.is_correct === true);
};

// Increment usage count
questionSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================
// Get random questions for exam by language (matches exam controller logic)
questionSchema.statics.getRandomQuestions = async function(language, count = 40, filters = {}) {
  const query = {
    language,
    isActive: true,
    ...filters
  };
  
  return this.aggregate([
    { $match: query },
    { $sample: { size: count } }
  ]);
};

// Get questions by language with pagination
questionSchema.statics.getByLanguage = function(language, page = 1, limit = 20, filters = {}) {
  const skip = (page - 1) * limit;
  
  return this.find({
    language,
    isActive: true,
    ...filters
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Count questions by language
questionSchema.statics.countByLanguage = function(language, filters = {}) {
  return this.countDocuments({
    language,
    isActive: true,
    ...filters
  });
};

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
questionSchema.pre('save', function(next) {
  // Ensure options are ordered correctly (0-3)
  this.options.forEach((opt, index) => {
    opt.order = index;
  });
  
  // ✅ FIXED: Calculate isPictureQuestion by checking BOTH question image AND option images
  const hasQuestionImage = !!(
    this.question?.image_url && 
    typeof this.question.image_url === 'string' &&
    this.question.image_url.trim() !== '' &&
    this.question.image_url.startsWith('http')
  );
  
  const hasOptionImages = !!(
    this.options && 
    Array.isArray(this.options) &&
    this.options.some(opt => 
      opt.optionImage && 
      typeof opt.optionImage === 'string' &&
      opt.optionImage.trim() !== '' &&
      opt.optionImage.startsWith('http')
    )
  );
  
  // A question is a "picture question" if it has EITHER a question image OR option images
  this.isPictureQuestion = hasQuestionImage || hasOptionImages;
  
  next();
});

// Fix for nodemon hot reload
module.exports = mongoose.models.Question || mongoose.model('Question', questionSchema);
const Question = require('../models/Question');
const cloudinary = require('../config/cloudinary');
const { EXAM_CONFIG } = require('../utils/constants');

// @desc    Get all questions (Admin only)
// @route   GET /api/questions
// @access  Private/Admin
const getQuestions = async (req, res, next) => {
  try {
    const { 
      language,
      isPictureQuestion, 
      page = 1, 
      limit = 20 
    } = req.query;

    const filter = { isActive: true };
    
    // Filter by language if provided
    if (language) filter.language = language;
    
    // ✅ FIXED: Filter by question type if provided
    if (isPictureQuestion !== undefined) {
      if (isPictureQuestion === 'true') {
        // Picture questions: has question image OR has option images
        filter.$or = [
          { 
            'question.image_url': { 
              $exists: true, 
              $ne: null, 
              $ne: '' 
            } 
          },
          { 
            'options': { 
              $elemMatch: { 
                optionImage: { 
                  $exists: true, 
                  $ne: null, 
                  $ne: '' 
                } 
              } 
            } 
          }
        ];
      } else {
        // Text-only questions: NO question image AND NO option images
        filter.$and = [
          {
            $or: [
              { 'question.image_url': { $exists: false } },
              { 'question.image_url': null },
              { 'question.image_url': '' }
            ]
          },
          {
            'options': { 
              $not: { 
                $elemMatch: { 
                  optionImage: { 
                    $exists: true, 
                    $ne: null, 
                    $ne: '' 
                  } 
                } 
              } 
            }
          }
        ];
      }
    }

    const skip = (page - 1) * limit;

    const count = await Question.countDocuments(filter);
    const questions = await Question.find(filter)
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { questions }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single question (Admin only)
// @route   GET /api/questions/:id
// @access  Private/Admin
const getQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { question }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create question (Admin only)
// @route   POST /api/questions
// @access  Private/Admin
const createQuestion = async (req, res, next) => {
  try {
    const { 
      language,
      questionText,
      options,
      category,
      difficulty,
      explanation,
      tags
    } = req.body;

    // Validate required fields
    if (!language || !['en', 'fr', 'rw'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid language (en, fr, or rw)'
      });
    }

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide question text'
      });
    }

    // Parse options if it's a string
    let parsedOptions;
    try {
      parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid options format'
      });
    }

    if (!parsedOptions || !Array.isArray(parsedOptions) || parsedOptions.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'Please provide exactly 4 options'
      });
    }

    // Validate each option has either text or image
    for (const option of parsedOptions) {
      if (!option.optionText && !option.hasImage) {
        return res.status(400).json({
          success: false,
          message: 'Each option must have either text or image'
        });
      }
    }

    // Validate exactly one correct answer
    const correctCount = parsedOptions.filter(opt => opt.isCorrect || opt.is_correct).length;
    if (correctCount !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Exactly one option must be marked as correct'
      });
    }

    let questionImageUrl = null;
    let questionCloudinaryPublicId = null;

    // Upload main question image if provided
    if (req.files && req.files.questionImage && req.files.questionImage[0]) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'umuhanda/questions',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.files.questionImage[0].buffer);
      });

      questionImageUrl = uploadResult.secure_url;
      questionCloudinaryPublicId = uploadResult.public_id;
    }

    // Upload option images if provided
    const optionImageUrls = {};
    if (req.files && req.files.optionImages) {
      for (let i = 0; i < req.files.optionImages.length; i++) {
        const file = req.files.optionImages[i];
        const originalName = file.originalname;
        
        // Extract option index from filename (e.g., "option_0")
        const match = originalName.match(/option_(\d+)/);
        if (match) {
          const optionIndex = parseInt(match[1]);
          
          const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'umuhanda/options',
                transformation: [
                  { width: 400, height: 400, crop: 'limit' },
                  { quality: 'auto' }
                ]
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            uploadStream.end(file.buffer);
          });

          optionImageUrls[optionIndex] = uploadResult.secure_url;
        }
      }
    }

    // Process options with uploaded image URLs
    const processedOptions = parsedOptions.map((option, index) => ({
      optionText: option.optionText || null,
      optionImage: optionImageUrls[index] || null,
      is_correct: option.isCorrect || option.is_correct || false,
      order: index
    }));

    // Create question with nested structure
    const questionData = {
      language,
      question: {
        description: questionText.trim(),
        image_url: questionImageUrl
      },
      options: processedOptions,
      cloudinaryPublicId: questionCloudinaryPublicId,
      createdBy: req.user?._id
    };

    // Add optional fields if provided
    if (category) questionData.category = category;
    if (difficulty) questionData.difficulty = difficulty;
    if (explanation) questionData.explanation = explanation;
    if (tags && Array.isArray(tags)) questionData.tags = tags;

    const question = await Question.create(questionData);

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: { question }
    });
  } catch (error) {
    console.error('Create question error:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    next(error);
  }
};

// @desc    Update question (Admin only)
// @route   PUT /api/questions/:id
// @access  Private/Admin
const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      language,
      questionText,
      options,
      category,
      difficulty,
      explanation,
      tags
    } = req.body;

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Update language
    if (language && ['en', 'fr', 'rw'].includes(language)) {
      question.language = language;
    }

    // Update question text
    if (questionText) {
      if (!question.question) question.question = {};
      question.question.description = questionText.trim();
    }

    // Parse options if it's a string
    let parsedOptions;
    if (options) {
      try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid options format'
        });
      }

      if (Array.isArray(parsedOptions) && parsedOptions.length === 4) {
        // Validate exactly one correct answer
        const correctCount = parsedOptions.filter(opt => opt.isCorrect || opt.is_correct).length;
        if (correctCount !== 1) {
          return res.status(400).json({
            success: false,
            message: 'Exactly one option must be marked as correct'
          });
        }

        // Upload new option images if provided
        const optionImageUrls = {};
        if (req.files && req.files.optionImages) {
          for (let i = 0; i < req.files.optionImages.length; i++) {
            const file = req.files.optionImages[i];
            const originalName = file.originalname;
            
            const match = originalName.match(/option_(\d+)/);
            if (match) {
              const optionIndex = parseInt(match[1]);
              
              // Delete old option image if exists
              const oldOption = question.options[optionIndex];
              if (oldOption && oldOption.optionImage && oldOption.optionImage.includes('cloudinary')) {
                const publicIdMatch = oldOption.optionImage.match(/\/v\d+\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                  try {
                    await cloudinary.uploader.destroy(publicIdMatch[1]);
                  } catch (err) {
                    console.error('Error deleting old option image:', err);
                  }
                }
              }
              
              const uploadResult = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                  {
                    folder: 'umuhanda/options',
                    transformation: [
                      { width: 400, height: 400, crop: 'limit' },
                      { quality: 'auto' }
                    ]
                  },
                  (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                  }
                );
                uploadStream.end(file.buffer);
              });

              optionImageUrls[optionIndex] = uploadResult.secure_url;
            }
          }
        }

        // Process options, keeping existing images if no new ones uploaded
        question.options = parsedOptions.map((option, index) => ({
          optionText: option.optionText || null,
          optionImage: optionImageUrls[index] || option.optionImage || null,
          is_correct: option.isCorrect || option.is_correct || false,
          order: index
        }));
      }
    }

    // Update question image if provided
    if (req.files && req.files.questionImage && req.files.questionImage[0]) {
      // Delete old image if exists
      if (question.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(question.cloudinaryPublicId);
      }

      // Upload new image
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'umuhanda/questions',
            transformation: [
              { width: 800, height: 600, crop: 'limit' },
              { quality: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.files.questionImage[0].buffer);
      });

      if (!question.question) question.question = {};
      question.question.image_url = uploadResult.secure_url;
      question.cloudinaryPublicId = uploadResult.public_id;
    }

    // Update optional fields
    if (category !== undefined) question.category = category;
    if (difficulty !== undefined) question.difficulty = difficulty;
    if (explanation !== undefined) question.explanation = explanation;
    if (tags && Array.isArray(tags)) question.tags = tags;

    await question.save();

    res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: { question }
    });
  } catch (error) {
    console.error('Update question error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    next(error);
  }
};

// @desc    Delete question (Admin only)
// @route   DELETE /api/questions/:id
// @access  Private/Admin
const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Delete question image from Cloudinary if exists
    if (question.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(question.cloudinaryPublicId);
      } catch (err) {
        console.error('Error deleting question image from Cloudinary:', err);
      }
    }

    // Delete option images from Cloudinary if they exist
    if (question.options && Array.isArray(question.options)) {
      for (const option of question.options) {
        if (option.optionImage && option.optionImage.includes('cloudinary')) {
          // Extract public_id from Cloudinary URL and delete
          const publicIdMatch = option.optionImage.match(/\/v\d+\/(.+)\.\w+$/);
          if (publicIdMatch && publicIdMatch[1]) {
            try {
              await cloudinary.uploader.destroy(publicIdMatch[1]);
            } catch (err) {
              console.error('Error deleting option image from Cloudinary:', err);
            }
          }
        }
      }
    }

    // Soft delete: set isActive to false instead of hard delete
    question.isActive = false;
    await question.save();

    // OR Hard delete (uncomment if you prefer):
    // await Question.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get question bank statistics (Admin only)
// @route   GET /api/questions/stats
// @access  Private/Admin
// Improved getStats function with stricter image checking
// @desc    Get question bank statistics (Admin only)
// @route   GET /api/questions/stats
// @access  Private/Admin
const getStats = async (req, res, next) => {
  try {
    const totalQuestions = await Question.countDocuments({ isActive: true });
    
    // ✅ IMPROVED: Use regex to only count valid image URLs
    const pictureQuestions = await Question.countDocuments({ 
      isActive: true,
      $or: [
        { 
          'question.image_url': { 
            $exists: true, 
            $ne: null, 
            $ne: '',
            $regex: /^https?:\/\/.+/  // ✅ Only count actual URLs
          } 
        },
        { 
          'options': { 
            $elemMatch: { 
              optionImage: { 
                $exists: true, 
                $ne: null, 
                $ne: '',
                $regex: /^https?:\/\/.+/  // ✅ Only count actual URLs
              } 
            } 
          } 
        }
      ]
    });
    
    const textQuestions = totalQuestions - pictureQuestions;

    // Get counts by language
    const questionsByLanguage = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$language', count: { $sum: 1 } } }
    ]);

    const languageStats = {};
    questionsByLanguage.forEach(item => {
      languageStats[item._id] = item.count;
    });

    // ✅ IMPROVED: Get picture questions by language with regex
    const pictureQuestionsByLanguage = await Question.aggregate([
      { 
        $match: { 
          isActive: true,
          $or: [
            { 
              'question.image_url': { 
                $exists: true, 
                $ne: null, 
                $ne: '',
                $regex: /^https?:\/\/.+/
              } 
            },
            { 
              'options': { 
                $elemMatch: { 
                  optionImage: { 
                    $exists: true, 
                    $ne: null, 
                    $ne: '',
                    $regex: /^https?:\/\/.+/
                  } 
                } 
              } 
            }
          ]
        } 
      },
      { $group: { _id: '$language', count: { $sum: 1 } } }
    ]);

    const pictureStats = {};
    pictureQuestionsByLanguage.forEach(item => {
      pictureStats[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalQuestions,
        pictureQuestions,
        textQuestions,
        byLanguage: {
          english: {
            total: languageStats.en || 0,
            picture: pictureStats.en || 0,
            text: (languageStats.en || 0) - (pictureStats.en || 0)
          },
          french: {
            total: languageStats.fr || 0,
            picture: pictureStats.fr || 0,
            text: (languageStats.fr || 0) - (pictureStats.fr || 0)
          },
          kinyarwanda: {
            total: languageStats.rw || 0,
            picture: pictureStats.rw || 0,
            text: (languageStats.rw || 0) - (pictureStats.rw || 0)
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Check if question bank is ready for exams by language (Admin only)
// @route   GET /api/questions/readiness
// @access  Private/Admin
const checkReadiness = async (req, res, next) => {
  try {
    const { language } = req.query;

    if (!language || !['en', 'fr', 'rw'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid language (en, fr, or rw)'
      });
    }

    const totalQuestions = await Question.countDocuments({ 
      isActive: true,
      language 
    });
    
    // ✅ FIXED: Count picture questions correctly
    const pictureQuestions = await Question.countDocuments({ 
      isActive: true,
      language,
      $or: [
        { 
          'question.image_url': { 
            $exists: true, 
            $ne: null, 
            $ne: '' 
          } 
        },
        { 
          'options': { 
            $elemMatch: { 
              optionImage: { 
                $exists: true, 
                $ne: null, 
                $ne: '' 
              } 
            } 
          } 
        }
      ]
    });

    const textQuestions = totalQuestions - pictureQuestions;

    // ✅ FIXED: Check text questions too
    const isReady = totalQuestions >= EXAM_CONFIG.TOTAL_QUESTIONS && 
                    pictureQuestions >= EXAM_CONFIG.PICTURE_QUESTIONS_MIN &&
                    textQuestions >= (EXAM_CONFIG.TOTAL_QUESTIONS - EXAM_CONFIG.PICTURE_QUESTIONS_MIN);

    const languageNames = {
      en: 'English',
      fr: 'French',
      rw: 'Kinyarwanda'
    };

    res.status(200).json({
      success: true,
      data: {
        language,
        languageName: languageNames[language],
        isReady,
        totalQuestions,
        requiredQuestions: EXAM_CONFIG.TOTAL_QUESTIONS,
        pictureQuestions,
        requiredPictureQuestions: EXAM_CONFIG.PICTURE_QUESTIONS_MIN,
        textQuestions,
        requiredTextQuestions: EXAM_CONFIG.TOTAL_QUESTIONS - EXAM_CONFIG.PICTURE_QUESTIONS_MIN,
        message: isReady 
          ? `✓ Question bank is ready for exams in ${languageNames[language]}` 
          : `Need ${Math.max(0, EXAM_CONFIG.TOTAL_QUESTIONS - totalQuestions)} more total questions (${Math.max(0, EXAM_CONFIG.PICTURE_QUESTIONS_MIN - pictureQuestions)} picture, ${Math.max(0, (EXAM_CONFIG.TOTAL_QUESTIONS - EXAM_CONFIG.PICTURE_QUESTIONS_MIN) - textQuestions)} text) in ${languageNames[language]}`
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getStats,
  checkReadiness
};
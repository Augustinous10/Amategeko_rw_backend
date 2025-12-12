const { ExamAttempt, ExamAnswer, Question, QuestionTranslation, UserSubscription } = require('../models');
const { EXAM_CONFIG, EXAM_STATUS } = require('../utils/constants');

// @desc    Start new exam
// @route   POST /api/exams/start
// @access  Private (requires active subscription)
const startExam = async (req, res, next) => {
  try {
    console.log('🔥🔥🔥 NEW CODE VERSION - USING isPictureQuestion FIELD 🔥🔥🔥');
    const userId = req.user._id;
    
    // ✅ Get language from request body (real-time selection)
    const language = req.body.language || req.user.preferredLanguage || 'en';
    
    console.log(`📝 User ${userId} attempting to start exam in language: ${language}`);

    // ✅ CHECK 1: Verify user has active subscription
    const userSubscription = await UserSubscription.findOne({
      user: userId,
      isActive: true,
      endDate: { $gte: new Date() }
    }).populate('subscription');

    console.log('🔍 Subscription check:', userSubscription ? {
      id: userSubscription._id,
      isActive: userSubscription.isActive,
      examAttemptsUsed: userSubscription.examAttemptsUsed,
      endDate: userSubscription.endDate,
      planExamLimit: userSubscription.subscription?.examLimit
    } : 'NONE FOUND');

    if (!userSubscription) {
      console.log('❌ NO ACTIVE SUBSCRIPTION');
      return res.status(403).json({
        success: false,
        message: 'Active subscription required to start exam',
        code: 'NO_SUBSCRIPTION'
      });
    }

    // ✅ CHECK 2: Verify user has remaining exam attempts
    const subscriptionPlan = userSubscription.subscription;
    const examLimit = subscriptionPlan.examLimit;
    const attemptsUsed = userSubscription.examAttemptsUsed || 0;

    console.log(`📊 Exam attempts: ${attemptsUsed}/${examLimit || 'Unlimited'}`);

    // If examLimit is null or 0, unlimited exams (time-based subscription)
    if (examLimit !== null && examLimit > 0) {
      if (attemptsUsed >= examLimit) {
        return res.status(403).json({
          success: false,
          message: 'No exam attempts remaining. Please purchase more exams.',
          code: 'NO_ATTEMPTS_REMAINING',
          data: {
            attemptsUsed,
            examLimit
          }
        });
      }
    }

    // ✅ CHECK 3: Check if user has incomplete exam
    const incompleteExam = await ExamAttempt.findOne({
      user: userId,
      status: EXAM_STATUS.IN_PROGRESS
    });

    if (incompleteExam) {
      return res.status(400).json({
        success: false,
        message: 'You have an incomplete exam. Please complete or abandon it first.',
        examId: incompleteExam._id,
        code: 'INCOMPLETE_EXAM'
      });
    }

    // ✅ CHECK 4: Verify sufficient questions available in selected language
    const totalAvailableQuestions = await Question.countDocuments({ 
      isActive: true,
      language 
    });

    console.log(`📊 Total available questions in ${language}: ${totalAvailableQuestions}`);

    if (totalAvailableQuestions < EXAM_CONFIG.TOTAL_QUESTIONS) {
      return res.status(500).json({
        success: false,
        message: `Not enough questions available in ${language}. Need at least ${EXAM_CONFIG.TOTAL_QUESTIONS} questions, but only ${totalAvailableQuestions} found.`,
        code: 'INSUFFICIENT_QUESTIONS',
        data: {
          required: EXAM_CONFIG.TOTAL_QUESTIONS,
          available: totalAvailableQuestions,
          language: language
        }
      });
    }

    // ✅ FIXED: COUNT PICTURE QUESTIONS using isPictureQuestion field
    const availablePictureQuestions = await Question.countDocuments({ 
      isActive: true,
      language,
      isPictureQuestion: true
    });

    console.log(`📊 Available picture questions in ${language}: ${availablePictureQuestions}`);
    console.log(`📊 Required picture questions: ${EXAM_CONFIG.PICTURE_QUESTIONS_MIN}`);

    if (availablePictureQuestions < EXAM_CONFIG.PICTURE_QUESTIONS_MIN) {
      return res.status(500).json({
        success: false,
        message: `Not enough picture questions in ${language}. Need at least ${EXAM_CONFIG.PICTURE_QUESTIONS_MIN} picture questions, but only ${availablePictureQuestions} found.`,
        code: 'INSUFFICIENT_PICTURE_QUESTIONS',
        data: {
          required: EXAM_CONFIG.PICTURE_QUESTIONS_MIN,
          available: availablePictureQuestions,
          language: language
        }
      });
    }

    // ✅ All checks passed - proceed with exam creation

    // Get recently used questions by this user (last 3 exams)
    const recentExams = await ExamAttempt.find({
      user: userId,
      status: EXAM_STATUS.COMPLETED
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('_id');

    const recentExamIds = recentExams.map(e => e._id);
    
    // Get questions used in recent exams
    const recentlyUsedQuestionIds = await ExamAnswer.find({
      examAttempt: { $in: recentExamIds }
    }).distinct('question');

    // Create unique random seed using multiple factors
    const userIdNumber = parseInt(userId.toString().slice(-8), 16);
    const timestamp = Date.now();
    const randomFactor = Math.floor(Math.random() * 1000000);
    const uniqueSeed = userIdNumber + timestamp + randomFactor;

    console.log(`🎲 Starting exam for user ${userId} with seed: ${uniqueSeed}`);

    // ✅ FIXED: STEP 1: Get PICTURE questions using isPictureQuestion field
    const pictureQuestionPool = await Question.aggregate([
      { 
        $match: { 
          isActive: true,
          language,
          isPictureQuestion: true,
          _id: { $nin: recentlyUsedQuestionIds }
        } 
      },
      { $sample: { size: EXAM_CONFIG.PICTURE_QUESTIONS_MIN * 3 } }
    ]);

    console.log(`📊 Initial picture question pool: ${pictureQuestionPool.length}`);

    // If not enough unused picture questions, get from all available
    if (pictureQuestionPool.length < EXAM_CONFIG.PICTURE_QUESTIONS_MIN) {
      const additionalNeeded = EXAM_CONFIG.PICTURE_QUESTIONS_MIN - pictureQuestionPool.length;
      
      console.log(`📊 Need ${additionalNeeded} more picture questions`);
      
      const additionalPictureQuestions = await Question.aggregate([
        { 
          $match: { 
            isActive: true,
            language,
            isPictureQuestion: true,
            _id: { 
              $nin: [
                ...recentlyUsedQuestionIds,
                ...pictureQuestionPool.map(q => q._id)
              ]
            }
          } 
        },
        { $sample: { size: additionalNeeded * 2 } }
      ]);
      
      pictureQuestionPool.push(...additionalPictureQuestions);
      console.log(`📊 After adding additional picture questions: ${pictureQuestionPool.length}`);
    }

    const shuffledPicturePool = pictureQuestionPool
      .sort(() => Math.random() - 0.5)
      .slice(0, EXAM_CONFIG.PICTURE_QUESTIONS_MIN);

    console.log(`✅ Selected ${shuffledPicturePool.length} picture questions`);

    // Calculate text questions needed
    const textQuestionsNeeded = EXAM_CONFIG.TOTAL_QUESTIONS - shuffledPicturePool.length;
    const pictureQuestionIds = shuffledPicturePool.map(q => q._id);

    console.log(`📊 Need ${textQuestionsNeeded} text-only questions`);

    // ✅ FIXED: STEP 2: Get TEXT-ONLY questions using isPictureQuestion field
    const textQuestionPool = await Question.aggregate([
      { 
        $match: { 
          isActive: true,
          language,
          isPictureQuestion: false,
          _id: { 
            $nin: [
              ...pictureQuestionIds,
              ...recentlyUsedQuestionIds
            ]
          }
        } 
      },
      { $sample: { size: textQuestionsNeeded * 3 } }
    ]);

    console.log(`📊 Text question pool: ${textQuestionPool.length}`);

    // If not enough unused text questions, get from all available
    if (textQuestionPool.length < textQuestionsNeeded) {
      const additionalNeeded = textQuestionsNeeded - textQuestionPool.length;
      
      console.log(`📊 Need ${additionalNeeded} more text questions`);
      
      const additionalTextQuestions = await Question.aggregate([
        { 
          $match: { 
            isActive: true,
            language,
            isPictureQuestion: false,
            _id: { 
              $nin: [
                ...pictureQuestionIds,
                ...recentlyUsedQuestionIds,
                ...textQuestionPool.map(q => q._id)
              ]
            }
          } 
        },
        { $sample: { size: additionalNeeded * 2 } }
      ]);
      
      textQuestionPool.push(...additionalTextQuestions);
      console.log(`📊 After adding additional text questions: ${textQuestionPool.length}`);
    }

    const shuffledTextPool = textQuestionPool
      .sort(() => Math.random() - 0.5)
      .slice(0, textQuestionsNeeded);

    console.log(`✅ Final text questions selected: ${shuffledTextPool.length}`);

    if (shuffledTextPool.length < textQuestionsNeeded) {
      return res.status(500).json({
        success: false,
        message: `Not enough text-only questions in ${language}. Need ${textQuestionsNeeded} but only ${shuffledTextPool.length} available.`,
        code: 'INSUFFICIENT_TEXT_QUESTIONS',
        data: {
          required: textQuestionsNeeded,
          available: shuffledTextPool.length,
          language: language,
          totalActive: totalAvailableQuestions,
          pictureQuestionsUsed: shuffledPicturePool.length
        }
      });
    }

    // Combine all questions
    const allQuestions = [...shuffledPicturePool, ...shuffledTextPool];

    // Triple shuffle for randomization
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor((Math.random() * uniqueSeed) % (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    allQuestions.sort(() => Math.random() - 0.5);

    allQuestions.sort((a, b) => {
      const aHash = (a._id.toString().charCodeAt(0) + uniqueSeed) % 100;
      const bHash = (b._id.toString().charCodeAt(0) + uniqueSeed) % 100;
      return aHash - bHash;
    });

    console.log(`✅ Selected ${allQuestions.length} unique questions for exam in ${language}`);
    console.log(`   - Picture questions: ${shuffledPicturePool.length}`);
    console.log(`   - Text-only questions: ${shuffledTextPool.length}`);

    const questionIds = allQuestions.map(q => q._id);

    // Create exam attempt
    const examAttempt = await ExamAttempt.create({
      user: userId,
      language,
      startTime: new Date(),
      timeLimitMinutes: EXAM_CONFIG.TIME_LIMIT_MINUTES,
      status: EXAM_STATUS.IN_PROGRESS,
      totalQuestions: EXAM_CONFIG.TOTAL_QUESTIONS,
      pictureQuestionsCount: shuffledPicturePool.length,
      passingScore: EXAM_CONFIG.PASSING_SCORE
    });

    // Create exam answers
    const answerPromises = allQuestions.map(async (question) => {
      const correctOption = question.options.find(opt => opt.is_correct === true);
      const correctAnswer = correctOption ? String.fromCharCode(97 + correctOption.order) : 'a';
      
      return ExamAnswer.create({
        examAttempt: examAttempt._id,
        question: question._id,
        correctAnswer: correctAnswer,
        userAnswer: null,
        isCorrect: null
      });
    });

    await Promise.all(answerPromises);

    // Update question usage count
    await Question.updateMany(
      { _id: { $in: questionIds } },
      { $inc: { usageCount: 1 } }
    );

    // ✅ Decrement user's exam attempts
    await UserSubscription.findByIdAndUpdate(userSubscription._id, {
      $inc: { 
        examAttemptsUsed: 1,
        examAttemptsRemaining: -1
      }
    });

    // Format questions for response
    const questionsForExam = allQuestions.map((question, index) => {
      const shuffledOptions = [...question.options].sort((a, b) => {
        const aHash = (a.optionText ? a.optionText.charCodeAt(0) : 0 + uniqueSeed + index) % 100;
        const bHash = (b.optionText ? b.optionText.charCodeAt(0) : 0 + uniqueSeed + index) % 100;
        return aHash - bHash;
      });
      
      // ✅ Use isPictureQuestion field from database
      const isPictureQuestion = question.isPictureQuestion || false;
      
      return {
        questionNumber: index + 1,
        questionId: question._id,
        isPictureQuestion: isPictureQuestion,
        imageUrl: question.question?.image_url || null,
        questionText: question.question?.description,
        options: shuffledOptions.map((opt, idx) => ({
          label: String.fromCharCode(97 + idx),
          text: opt.optionText,
          image: opt.optionImage
        }))
      };
    });

    res.status(201).json({
      success: true,
      message: 'Exam started successfully',
      data: {
        examId: examAttempt._id,
        startTime: examAttempt.startTime,
        timeLimitMinutes: examAttempt.timeLimitMinutes,
        totalQuestions: EXAM_CONFIG.TOTAL_QUESTIONS,
        passingScore: EXAM_CONFIG.PASSING_SCORE,
        language,
        questions: questionsForExam,
        remainingAttempts: userSubscription.examAttemptsRemaining - 1
      }
    });
  } catch (error) {
    console.error('❌ Error starting exam:', error);
    next(error);
  }
};

// @desc    Get exam attempt details
// @route   GET /api/exams/:id
// @access  Private
const getExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const exam = await ExamAttempt.findOne({ _id: id, user: userId });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { exam }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit answer for a question
// @route   POST /api/exams/:id/answer
// @access  Private
const submitAnswer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionId, answer } = req.body;
    const userId = req.user._id;

    // Validate answer
    if (!answer || !['a', 'b', 'c', 'd'].includes(answer.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answer. Must be a, b, c, or d'
      });
    }

    // Get exam
    const exam = await ExamAttempt.findOne({
      _id: id,
      user: userId,
      status: EXAM_STATUS.IN_PROGRESS
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found or already completed'
      });
    }

    // Check if time limit exceeded
    const timeElapsed = (new Date() - new Date(exam.startTime)) / 1000 / 60; // minutes
    if (timeElapsed > exam.timeLimitMinutes) {
      // Auto-submit exam
      return await submitExam(req, res, next);
    }

    // Find exam answer
    const examAnswer = await ExamAnswer.findOne({
      examAttempt: id,
      question: questionId
    });

    if (!examAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Question not found in this exam'
      });
    }

    // Update answer
    const userAnswer = answer.toLowerCase();
    examAnswer.userAnswer = userAnswer;
    examAnswer.isCorrect = userAnswer === examAnswer.correctAnswer;
    examAnswer.answeredAt = new Date();
    await examAnswer.save();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      data: {
        questionId,
        answered: true
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit entire exam (calculate score)
// @route   POST /api/exams/:id/submit
// @access  Private
const submitExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Get exam
    const exam = await ExamAttempt.findOne({
      _id: id,
      user: userId,
      status: EXAM_STATUS.IN_PROGRESS
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found or already completed'
      });
    }

    // Get all answers
    const answers = await ExamAnswer.find({ examAttempt: id });

    // Calculate score
    const correctAnswers = answers.filter(a => a.isCorrect === true).length;
    const score = correctAnswers;
    const passed = score >= EXAM_CONFIG.PASSING_SCORE;

    // Update exam
    exam.endTime = new Date();
    exam.status = EXAM_STATUS.COMPLETED;
    exam.score = score;
    exam.passed = passed;
    await exam.save();

    const percentage = ((score / EXAM_CONFIG.TOTAL_QUESTIONS) * 100).toFixed(2);
    const timeTaken = Math.round((new Date(exam.endTime) - new Date(exam.startTime)) / 1000 / 60);

    res.status(200).json({
      success: true,
      message: passed 
        ? `🎉 Congratulations! You passed with ${score}/${EXAM_CONFIG.TOTAL_QUESTIONS} (${percentage}%)` 
        : `Unfortunately, you scored ${score}/${EXAM_CONFIG.TOTAL_QUESTIONS}. You need ${EXAM_CONFIG.PASSING_SCORE} to pass. Keep practicing!`,
      data: {
        examId: exam._id,
        score,
        totalQuestions: EXAM_CONFIG.TOTAL_QUESTIONS,
        passingScore: EXAM_CONFIG.PASSING_SCORE,
        passed,
        percentage,
        correctAnswers,
        incorrectAnswers: EXAM_CONFIG.TOTAL_QUESTIONS - correctAnswers,
        timeTaken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get exam history
// @route   GET /api/exams/history
// @access  Private
const getHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const count = await ExamAttempt.countDocuments({
      user: req.user._id,
      status: EXAM_STATUS.COMPLETED
    });

    const exams = await ExamAttempt.find({
      user: req.user._id,
      status: EXAM_STATUS.COMPLETED
    })
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: { exams }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Review completed exam with correct answers
// @route   GET /api/exams/:id/review
// @access  Private
const reviewExam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Get completed exam
    const exam = await ExamAttempt.findOne({
      _id: id,
      user: userId,
      status: EXAM_STATUS.COMPLETED
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Completed exam not found'
      });
    }

    // Get all answers with questions
    const answers = await ExamAnswer.find({ examAttempt: id }).populate('question');

    // Format review data
    const reviewData = answers.map((answer, index) => {
      const question = answer.question;
      
      return {
        questionNumber: index + 1,
        questionText: question.question?.description,
        imageUrl: question.question?.image_url,
        options: question.options.map((opt, idx) => ({
          label: String.fromCharCode(97 + idx),
          text: opt.optionText,
          image: opt.optionImage,
          isCorrect: opt.is_correct
        })),
        userAnswer: answer.userAnswer,
        correctAnswer: answer.correctAnswer,
        isCorrect: answer.isCorrect,
        explanation: question.explanation
      };
    });

    res.status(200).json({
      success: true,
      data: {
        examId: exam._id,
        score: exam.score,
        totalQuestions: exam.totalQuestions,
        passingScore: EXAM_CONFIG.PASSING_SCORE,
        passed: exam.passed,
        questions: reviewData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user exam statistics
// @route   GET /api/exams/stats
// @access  Private
const getExamStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const totalExams = await ExamAttempt.countDocuments({
      user: userId,
      status: EXAM_STATUS.COMPLETED
    });

    const passedExams = await ExamAttempt.countDocuments({
      user: userId,
      status: EXAM_STATUS.COMPLETED,
      passed: true
    });

    const avgScoreResult = await ExamAttempt.aggregate([
      {
        $match: {
          user: userId,
          status: EXAM_STATUS.COMPLETED
        }
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' },
          maxScore: { $max: '$score' }
        }
      }
    ]);

    const stats = avgScoreResult[0] || { avgScore: 0, maxScore: 0 };

    res.status(200).json({
      success: true,
      data: {
        totalExams,
        passedExams,
        failedExams: totalExams - passedExams,
        passRate: totalExams > 0 ? ((passedExams / totalExams) * 100).toFixed(2) : 0,
        averageScore: stats.avgScore ? parseFloat(stats.avgScore).toFixed(2) : 0,
        highestScore: stats.maxScore || 0,
        passingScore: EXAM_CONFIG.PASSING_SCORE,
        totalQuestions: EXAM_CONFIG.TOTAL_QUESTIONS
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startExam,
  getExam,
  submitAnswer,
  submitExam,
  getHistory,
  reviewExam,
  getExamStats
};
const mongoose = require('mongoose');

const examAnswerSchema = new mongoose.Schema({
  examAttempt: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt',
    required: [true, 'Exam attempt is required'],
    index: true // ⭐ Add index
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: [true, 'Question is required'],
    index: true // ⭐ Add index
  },
  userAnswer: {
    type: String,
    enum: {
      values: ['a', 'b', 'c', 'd', null],
      message: '{VALUE} is not a valid answer option'
    },
    lowercase: true,
    default: null, // ⭐ Explicit default
    trim: true
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required'],
    enum: {
      values: ['a', 'b', 'c', 'd'],
      message: '{VALUE} is not a valid answer option'
    },
    lowercase: true,
    trim: true
  },
  isCorrect: {
    type: Boolean,
    default: null // ⭐ null until answered
  },
  answeredAt: {
    type: Date,
    default: null // ✅ Fixed: null until actually answered (not Date.now)
  },
  // ⭐ NEW: Track time taken to answer this specific question
  timeToAnswer: {
    type: Number, // in seconds
    min: 0
  }
}, {
  timestamps: true // ⭐ Add timestamps for tracking
});

// ⭐ Compound indexes for better query performance
examAnswerSchema.index({ examAttempt: 1, question: 1 }, { unique: true }); // Prevent duplicate answers
examAnswerSchema.index({ examAttempt: 1, isCorrect: 1 }); // For scoring queries
examAnswerSchema.index({ question: 1, isCorrect: 1 }); // For question difficulty analysis

// ⭐ Virtual: Check if question has been answered
examAnswerSchema.virtual('isAnswered').get(function() {
  return this.userAnswer !== null && this.userAnswer !== undefined;
});

// ⭐ Instance method: Check if user's answer is correct
examAnswerSchema.methods.checkAnswer = function() {
  if (this.userAnswer === null || this.userAnswer === undefined) {
    return null; // Not answered yet
  }
  return this.userAnswer === this.correctAnswer;
};

// ⭐ Instance method: Submit answer
examAnswerSchema.methods.submitAnswer = function(answer, examStartTime) {
  // Validate answer
  const validAnswers = ['a', 'b', 'c', 'd'];
  if (!validAnswers.includes(answer.toLowerCase())) {
    throw new Error('Invalid answer. Must be a, b, c, or d');
  }

  // Set answer
  this.userAnswer = answer.toLowerCase();
  this.answeredAt = new Date();
  
  // Check if correct
  this.isCorrect = this.userAnswer === this.correctAnswer;
  
  // Calculate time taken (if exam start time provided)
  if (examStartTime) {
    this.timeToAnswer = Math.round((this.answeredAt - examStartTime) / 1000); // seconds
  }
  
  return this.isCorrect;
};

// ⭐ Instance method: Clear answer (for retry/reset)
examAnswerSchema.methods.clearAnswer = function() {
  this.userAnswer = null;
  this.isCorrect = null;
  this.answeredAt = null;
  this.timeToAnswer = null;
};

// ⭐ Static method: Get all answers for an exam
examAnswerSchema.statics.getExamAnswers = async function(examAttemptId, populate = false) {
  const query = this.find({ examAttempt: examAttemptId }).sort({ createdAt: 1 });
  
  if (populate) {
    query.populate('question');
  }
  
  return await query;
};

// ⭐ Static method: Calculate score for an exam
examAnswerSchema.statics.calculateScore = async function(examAttemptId) {
  const answers = await this.find({ examAttempt: examAttemptId });
  
  const total = answers.length;
  const correct = answers.filter(a => a.isCorrect === true).length;
  const incorrect = answers.filter(a => a.isCorrect === false).length;
  const unanswered = answers.filter(a => a.userAnswer === null).length;
  
  return {
    total,
    correct,
    incorrect,
    unanswered,
    score: correct,
    percentage: total > 0 ? ((correct / total) * 100).toFixed(2) : 0
  };
};

// ⭐ Static method: Get question difficulty statistics
examAnswerSchema.statics.getQuestionStats = async function(questionId) {
  const stats = await this.aggregate([
    {
      $match: {
        question: mongoose.Types.ObjectId(questionId),
        userAnswer: { $ne: null } // Only count answered questions
      }
    },
    {
      $group: {
        _id: '$question',
        totalAttempts: { $sum: 1 },
        correctAttempts: {
          $sum: { $cond: ['$isCorrect', 1, 0] }
        },
        averageTimeToAnswer: { $avg: '$timeToAnswer' }
      }
    },
    {
      $project: {
        totalAttempts: 1,
        correctAttempts: 1,
        incorrectAttempts: { $subtract: ['$totalAttempts', '$correctAttempts'] },
        successRate: {
          $multiply: [
            { $divide: ['$correctAttempts', '$totalAttempts'] },
            100
          ]
        },
        averageTimeToAnswer: { $round: ['$averageTimeToAnswer', 0] }
      }
    }
  ]);
  
  return stats[0] || {
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    successRate: 0,
    averageTimeToAnswer: 0
  };
};

// ⭐ Static method: Get most difficult questions (lowest success rate)
examAnswerSchema.statics.getDifficultQuestions = async function(limit = 10) {
  const results = await this.aggregate([
    {
      $match: {
        userAnswer: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$question',
        totalAttempts: { $sum: 1 },
        correctAttempts: {
          $sum: { $cond: ['$isCorrect', 1, 0] }
        }
      }
    },
    {
      $match: {
        totalAttempts: { $gte: 5 } // Only questions attempted at least 5 times
      }
    },
    {
      $project: {
        question: '$_id',
        totalAttempts: 1,
        correctAttempts: 1,
        successRate: {
          $multiply: [
            { $divide: ['$correctAttempts', '$totalAttempts'] },
            100
          ]
        }
      }
    },
    {
      $sort: { successRate: 1 } // Lowest success rate first
    },
    {
      $limit: limit
    }
  ]);
  
  return results;
};

// ⭐ Pre-save middleware: Auto-calculate isCorrect when userAnswer is set
examAnswerSchema.pre('save', function(next) {
  // Only calculate if userAnswer has been set/modified
  if (this.isModified('userAnswer') && this.userAnswer !== null) {
    this.isCorrect = this.userAnswer === this.correctAnswer;
    
    // Set answeredAt if not already set
    if (!this.answeredAt) {
      this.answeredAt = new Date();
    }
  }
  
  // If userAnswer is cleared, clear isCorrect and answeredAt too
  if (this.userAnswer === null) {
    this.isCorrect = null;
    this.answeredAt = null;
    this.timeToAnswer = null;
  }
  
  next();
});

// ⭐ Pre-save middleware: Prevent changing correctAnswer after creation
examAnswerSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('correctAnswer')) {
    return next(new Error('Cannot modify correct answer after creation'));
  }
  next();
});

// ⭐ Ensure virtuals are included in JSON/Object output
examAnswerSchema.set('toJSON', { virtuals: true });
examAnswerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ExamAnswer', examAnswerSchema);
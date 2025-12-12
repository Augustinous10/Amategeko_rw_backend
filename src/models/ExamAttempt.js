const mongoose = require('mongoose');
const { LANGUAGES, EXAM_STATUS, EXAM_CONFIG } = require('../utils/constants');

const examAttemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true // ⭐ Add index for faster queries
  },
  language: {
    type: String,
    required: [true, 'Language is required'],
    enum: {
      values: Object.values(LANGUAGES),
      message: '{VALUE} is not a valid language'
    }
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    validate: {
      validator: function(value) {
        // endTime must be after startTime
        return !value || value >= this.startTime;
      },
      message: 'End time must be after start time'
    }
  },
  timeLimitMinutes: {
    type: Number,
    default: EXAM_CONFIG.TIME_LIMIT_MINUTES,
    min: [1, 'Time limit must be at least 1 minute'],
    max: [180, 'Time limit cannot exceed 3 hours']
  },
  status: {
    type: String,
    enum: {
      values: Object.values(EXAM_STATUS),
      message: '{VALUE} is not a valid exam status'
    },
    default: EXAM_STATUS.IN_PROGRESS,
    index: true // ⭐ Add index for filtering by status
  },
  score: {
    type: Number,
    min: [0, 'Score cannot be negative'],
    max: [EXAM_CONFIG.TOTAL_QUESTIONS, `Score cannot exceed ${EXAM_CONFIG.TOTAL_QUESTIONS}`], // ✅ Fixed: Use constant
    validate: {
      validator: function(value) {
        // Score can only be set when status is COMPLETED
        return this.status === EXAM_STATUS.COMPLETED || value === undefined;
      },
      message: 'Score can only be set for completed exams'
    }
  },
  passingScore: {
    type: Number,
    default: EXAM_CONFIG.PASSING_SCORE, // Default: 12
    min: [1, 'Passing score must be at least 1'],
    max: [EXAM_CONFIG.TOTAL_QUESTIONS, `Passing score cannot exceed ${EXAM_CONFIG.TOTAL_QUESTIONS}`] // ✅ Fixed: Add validation
  },
  passed: {
    type: Boolean,
    default: null // ⭐ null until exam is completed
  },
  totalQuestions: {
    type: Number,
    default: EXAM_CONFIG.TOTAL_QUESTIONS, // Default: 20
    required: true,
    min: [1, 'Total questions must be at least 1'],
    max: [100, 'Total questions cannot exceed 100']
  },
  pictureQuestionsCount: {
    type: Number,
    min: [0, 'Picture questions count cannot be negative'],
    max: [EXAM_CONFIG.TOTAL_QUESTIONS, 'Picture questions cannot exceed total questions'],
    default: EXAM_CONFIG.PICTURE_QUESTIONS_MIN // ⭐ Add default
  }
}, {
  timestamps: true
});

// ⭐ Compound indexes for better query performance
examAttemptSchema.index({ user: 1, status: 1, createdAt: -1 });
examAttemptSchema.index({ user: 1, passed: 1 }); // For pass/fail statistics
examAttemptSchema.index({ createdAt: -1 }); // For recent exams

// ⭐ Virtual field: Calculate percentage
examAttemptSchema.virtual('percentage').get(function() {
  if (this.score === undefined || this.score === null) return null;
  return ((this.score / this.totalQuestions) * 100).toFixed(2);
});

// ⭐ Virtual field: Calculate time taken (in minutes)
examAttemptSchema.virtual('timeTaken').get(function() {
  if (!this.endTime || !this.startTime) return null;
  return Math.round((this.endTime - this.startTime) / 1000 / 60);
});

// ⭐ Virtual field: Check if time limit exceeded
examAttemptSchema.virtual('timeExceeded').get(function() {
  if (!this.endTime || !this.startTime) return false;
  const timeTaken = (this.endTime - this.startTime) / 1000 / 60;
  return timeTaken > this.timeLimitMinutes;
});

// ⭐ Instance method: Calculate if passed based on score
examAttemptSchema.methods.calculatePassed = function() {
  if (this.score === undefined || this.score === null) return null;
  return this.score >= this.passingScore;
};

// ⭐ Instance method: Check if exam can be submitted
examAttemptSchema.methods.canSubmit = function() {
  return this.status === EXAM_STATUS.IN_PROGRESS;
};

// ⭐ Instance method: Check if exam has expired
examAttemptSchema.methods.hasExpired = function() {
  if (this.status !== EXAM_STATUS.IN_PROGRESS) return false;
  const now = new Date();
  const timeElapsed = (now - this.startTime) / 1000 / 60; // minutes
  return timeElapsed > this.timeLimitMinutes;
};

// ⭐ Pre-save middleware: Auto-calculate passed status when score is set
examAttemptSchema.pre('save', function(next) {
  // If score is being set/updated and exam is completed, calculate passed status
  if (this.isModified('score') && this.score !== null && this.score !== undefined) {
    this.passed = this.score >= this.passingScore;
  }
  
  // If status is being set to completed, ensure endTime is set
  if (this.isModified('status') && this.status === EXAM_STATUS.COMPLETED && !this.endTime) {
    this.endTime = new Date();
  }
  
  next();
});

// ⭐ Static method: Get user's exam statistics
examAttemptSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        status: EXAM_STATUS.COMPLETED
      }
    },
    {
      $group: {
        _id: null,
        totalExams: { $sum: 1 },
        passedExams: {
          $sum: { $cond: ['$passed', 1, 0] }
        },
        averageScore: { $avg: '$score' },
        highestScore: { $max: '$score' },
        lowestScore: { $min: '$score' }
      }
    }
  ]);
  
  return stats[0] || {
    totalExams: 0,
    passedExams: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0
  };
};

// ⭐ Static method: Check if user has incomplete exam
examAttemptSchema.statics.hasIncompleteExam = async function(userId) {
  const incompleteExam = await this.findOne({
    user: userId,
    status: EXAM_STATUS.IN_PROGRESS
  });
  
  return incompleteExam !== null;
};

// ⭐ Ensure virtuals are included in JSON/Object output
examAttemptSchema.set('toJSON', { virtuals: true });
examAttemptSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ExamAttempt', examAttemptSchema);
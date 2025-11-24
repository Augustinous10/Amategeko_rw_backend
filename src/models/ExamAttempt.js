const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { LANGUAGES, EXAM_STATUS, EXAM_CONFIG } = require('../utils/constants');

const ExamAttempt = sequelize.define('ExamAttempt', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  language: {
    type: DataTypes.STRING(2),
    allowNull: false,
    validate: {
      isIn: [[LANGUAGES.KINYARWANDA, LANGUAGES.ENGLISH, LANGUAGES.FRENCH]]
    }
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'end_time'
  },
  timeLimitMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: EXAM_CONFIG.TIME_LIMIT_MINUTES,
    field: 'time_limit_minutes'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: EXAM_STATUS.IN_PROGRESS,
    validate: {
      isIn: [[EXAM_STATUS.IN_PROGRESS, EXAM_STATUS.COMPLETED, EXAM_STATUS.ABANDONED]]
    }
  },
  score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Score out of 20'
  },
  passingScore: {
    type: DataTypes.INTEGER,
    defaultValue: EXAM_CONFIG.PASSING_SCORE,
    field: 'passing_score'
  },
  passed: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  totalQuestions: {
    type: DataTypes.INTEGER,
    defaultValue: EXAM_CONFIG.TOTAL_QUESTIONS,
    field: 'total_questions'
  },
  pictureQuestionsCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'picture_questions_count'
  }
}, {
  tableName: 'exam_attempts',
  timestamps: true,
  underscored: true
});

module.exports = ExamAttempt;
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExamAnswer = sequelize.define('ExamAnswer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  examAttemptId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'exam_attempt_id',
    references: {
      model: 'exam_attempts',
      key: 'id'
    }
  },
  questionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'question_id',
    references: {
      model: 'questions',
      key: 'id'
    }
  },
  userAnswer: {
    type: DataTypes.CHAR(1),
    allowNull: true,
    field: 'user_answer',
    validate: {
      isIn: [['a', 'b', 'c', 'd', null]]
    }
  },
  correctAnswer: {
    type: DataTypes.CHAR(1),
    allowNull: false,
    field: 'correct_answer',
    validate: {
      isIn: [['a', 'b', 'c', 'd']]
    }
  },
  isCorrect: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    field: 'is_correct'
  },
  answeredAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'answered_at'
  }
}, {
  tableName: 'exam_answers',
  timestamps: false
});

module.exports = ExamAnswer;
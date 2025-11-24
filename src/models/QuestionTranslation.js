const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { LANGUAGES } = require('../utils/constants');

const QuestionTranslation = sequelize.define('QuestionTranslation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  language: {
    type: DataTypes.STRING(2),
    allowNull: false,
    validate: {
      isIn: [[LANGUAGES.KINYARWANDA, LANGUAGES.ENGLISH, LANGUAGES.FRENCH]]
    }
  },
  questionText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'question_text'
  },
  optionA: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'option_a'
  },
  optionB: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'option_b'
  },
  optionC: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'option_c'
  },
  optionD: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'option_d'
  },
  correctAnswer: {
    type: DataTypes.CHAR(1),
    allowNull: false,
    field: 'correct_answer',
    validate: {
      isIn: [['a', 'b', 'c', 'd']]
    }
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional explanation for correct answer'
  }
}, {
  tableName: 'question_translations',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['question_id', 'language']
    }
  ]
});

module.exports = QuestionTranslation;
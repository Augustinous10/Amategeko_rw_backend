const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { DIFFICULTY, QUESTION_CATEGORIES } = require('../utils/constants');

const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isIn: [[
        QUESTION_CATEGORIES.ROAD_SIGNS,
        QUESTION_CATEGORIES.TRAFFIC_RULES,
        QUESTION_CATEGORIES.SAFETY,
        QUESTION_CATEGORIES.PARKING,
        QUESTION_CATEGORIES.EMERGENCY,
        QUESTION_CATEGORIES.VEHICLE_OPERATION
      ]]
    }
  },
  difficulty: {
    type: DataTypes.STRING(20),
    defaultValue: DIFFICULTY.MEDIUM,
    validate: {
      isIn: [[DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD]]
    }
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'image_url',
    comment: 'Cloudinary URL for picture-based questions'
  },
  cloudinaryPublicId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'cloudinary_public_id'
  },
  isPictureQuestion: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_picture_question'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'usage_count',
    comment: 'Track how many times used in exams'
  }
}, {
  tableName: 'questions',
  timestamps: true,
  underscored: true
});

module.exports = Question;
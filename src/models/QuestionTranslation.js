const mongoose = require('mongoose');
const { LANGUAGES } = require('../utils/constants');

const questionTranslationSchema = new mongoose.Schema({
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  language: {
    type: String,
    required: [true, 'Language is required'],
    enum: Object.values(LANGUAGES)
  },
  questionText: {
    type: String,
    required: [true, 'Question text is required']
  },
  optionA: {
    type: String,
    required: [true, 'Option A is required']
  },
  optionB: {
    type: String,
    required: [true, 'Option B is required']
  },
  optionC: {
    type: String,
    required: [true, 'Option C is required']
  },
  optionD: {
    type: String,
    required: [true, 'Option D is required']
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required'],
    enum: ['a', 'b', 'c', 'd'],
    lowercase: true
  },
  explanation: {
    type: String
  }
});

// Compound unique index for question + language
questionTranslationSchema.index({ question: 1, language: 1 }, { unique: true });

// Fix for nodemon hot reload
module.exports = mongoose.models.QuestionTranslation || 
                 mongoose.model('QuestionTranslation', questionTranslationSchema);
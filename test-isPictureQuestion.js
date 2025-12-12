// test-isPictureQuestion.js
const mongoose = require('mongoose');
const Question = require('./src/models/Question');

mongoose.connect('mongodb://localhost:27017/amategeko_rw', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testIsPictureQuestion() {
  try {
    // Count text questions
    const textCount = await Question.countDocuments({
      isActive: true,
      language: 'rw',
      isPictureQuestion: false
    });
    console.log('✅ Text questions (isPictureQuestion: false):', textCount);

    // Check if some questions might not have the field
    const noField = await Question.countDocuments({
      isActive: true,
      language: 'rw',
      isPictureQuestion: { $exists: false }
    });
    console.log('⚠️ Questions without isPictureQuestion field:', noField);

    // Check for null values
    const nullField = await Question.countDocuments({
      isActive: true,
      language: 'rw',
      isPictureQuestion: null
    });
    console.log('⚠️ Questions with isPictureQuestion: null:', nullField);

    // List all values
    const allQuestions = await Question.find({
      isActive: true,
      language: 'rw'
    }).select('_id isPictureQuestion question.image_url');

    console.log('\n📋 All Questions:');
    allQuestions.forEach(q => {
      console.log(`ID: ${q._id} | isPictureQuestion: ${q.isPictureQuestion} | Has URL: ${!!q.question?.image_url}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testIsPictureQuestion();
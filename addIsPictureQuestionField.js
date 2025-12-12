// Add isPictureQuestion field to all questions
// Save as: addIsPictureQuestionField.js

require('dotenv').config();
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  language: { type: String, enum: ['en', 'fr', 'rw'], required: true },
  question: {
    description: { type: String, required: true },
    image_url: { type: String, default: null }
  },
  options: [{
    optionText: { type: String, default: null },
    optionImage: { type: String, default: null },
    is_correct: { type: Boolean, default: false },
    order: { type: Number, required: true }
  }],
  isPictureQuestion: { type: Boolean, default: false }, // ✅ New field
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);

async function addIsPictureQuestionField() {
  try {
    console.log('🔧 Adding isPictureQuestion field to all questions...\n');
    
    // Get all questions
    const questions = await Question.find({});
    
    console.log(`📊 Found ${questions.length} questions to process`);
    
    let updatedCount = 0;
    let pictureCount = 0;
    let textCount = 0;
    
    for (const question of questions) {
      // Check if question has image
      const hasQuestionImage = !!(
        question.question?.image_url && 
        typeof question.question.image_url === 'string' &&
        question.question.image_url.trim() !== '' &&
        question.question.image_url.startsWith('http')
      );
      
      // Check if any option has image
      const hasOptionImages = !!(
        question.options && 
        Array.isArray(question.options) &&
        question.options.some(opt => 
          opt.optionImage && 
          typeof opt.optionImage === 'string' &&
          opt.optionImage.trim() !== '' &&
          opt.optionImage.startsWith('http')
        )
      );
      
      const isPicture = hasQuestionImage || hasOptionImages;
      
      // Update the field
      question.isPictureQuestion = isPicture;
      await question.save();
      
      updatedCount++;
      if (isPicture) {
        pictureCount++;
      } else {
        textCount++;
      }
      
      if (updatedCount % 10 === 0) {
        console.log(`✅ Processed ${updatedCount}/${questions.length} questions...`);
      }
    }
    
    console.log('\n✅ Migration completed!');
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total questions: ${questions.length}`);
    console.log(`   Picture questions: ${pictureCount}`);
    console.log(`   Text questions: ${textCount}`);
    
    // Verify
    const verifyPicture = await Question.countDocuments({ 
      isActive: true,
      isPictureQuestion: true 
    });
    
    const verifyText = await Question.countDocuments({ 
      isActive: true,
      isPictureQuestion: false 
    });
    
    console.log(`\n🔍 Verification:`);
    console.log(`   Active picture questions: ${verifyPicture}`);
    console.log(`   Active text questions: ${verifyText}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ Error: MONGODB_URI not found');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected\n');
    
    await addIsPictureQuestionField();
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected');
    console.log('\n🎉 Done! Now you can start exams.');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
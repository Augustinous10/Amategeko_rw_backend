// Database Cleanup Script for Questions
// Save as: cleanupQuestions.js in your backend root folder

require('dotenv').config();
const mongoose = require('mongoose');

// Define Question Schema inline (in case model path is different)
const questionSchema = new mongoose.Schema({
  language: {
    type: String,
    enum: ['en', 'fr', 'rw'],
    required: true
  },
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
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);

async function inspectAndCleanQuestions() {
  try {
    console.log('🔍 Inspecting questions...\n');

    // Get all active questions
    const questions = await Question.find({ isActive: true });
    
    let pictureCount = 0;
    let textCount = 0;
    let needsCleanup = [];

    for (const question of questions) {
      let hasPicture = false;
      let hasIssue = false;
      
      // Check question image
      const hasQuestionImage = !!(
        question.question?.image_url && 
        typeof question.question.image_url === 'string' &&
        question.question.image_url.trim() !== '' &&
        question.question.image_url.startsWith('http')
      );
      
      // Check option images
      let hasOptionImages = false;
      let emptyOptionImages = [];
      
      if (question.options && Array.isArray(question.options)) {
        question.options.forEach((opt, idx) => {
          // Check if optionImage field exists
          if (opt.optionImage !== undefined && opt.optionImage !== null) {
            if (typeof opt.optionImage === 'string') {
              if (opt.optionImage.trim() === '' || !opt.optionImage.startsWith('http')) {
                emptyOptionImages.push(idx);
                hasIssue = true;
              } else {
                hasOptionImages = true;
              }
            }
          }
        });
      }
      
      hasPicture = hasQuestionImage || hasOptionImages;
      
      if (hasPicture) {
        pictureCount++;
      } else {
        textCount++;
      }
      
      // If question has empty optionImage fields, mark for cleanup
      if (hasIssue) {
        needsCleanup.push({
          _id: question._id,
          description: question.question?.description?.substring(0, 60),
          emptyOptionImages,
          questionImage: question.question?.image_url || 'none'
        });
      }
    }

    console.log('📊 Current Statistics:');
    console.log(`Total Questions: ${questions.length}`);
    console.log(`Picture Questions: ${pictureCount}`);
    console.log(`Text Questions: ${textCount}`);
    console.log(`Questions needing cleanup: ${needsCleanup.length}\n`);

    if (needsCleanup.length > 0) {
      console.log('⚠️  Sample questions with issues (showing first 10):');
      needsCleanup.slice(0, 10).forEach((q, idx) => {
        console.log(`${idx + 1}. ${q.description}...`);
        console.log(`   - Question Image: ${q.questionImage}`);
        console.log(`   - Empty Option Images at indices: ${q.emptyOptionImages.join(', ')}\n`);
      });
      
      console.log(`\n🔧 Cleaning up ${needsCleanup.length} questions...`);
      
      let cleanedCount = 0;
      // Clean up empty optionImage fields
      for (const item of needsCleanup) {
        const question = await Question.findById(item._id);
        
        if (question && question.options) {
          let modified = false;
          question.options.forEach(opt => {
            // Set to null if empty string or invalid URL
            if (opt.optionImage === '' || 
                (typeof opt.optionImage === 'string' && !opt.optionImage.startsWith('http'))) {
              opt.optionImage = null;
              modified = true;
            }
          });
          
          if (modified) {
            await question.save();
            cleanedCount++;
          }
        }
      }
      
      console.log(`✅ Cleaned up ${cleanedCount} questions!`);
      
      // Re-count after cleanup
      const afterPictureCount = await Question.countDocuments({ 
        isActive: true,
        $or: [
          { 
            'question.image_url': { 
              $exists: true, 
              $ne: null, 
              $ne: '',
              $regex: /^https?:\/\/.+/
            } 
          },
          { 
            'options': { 
              $elemMatch: { 
                optionImage: { 
                  $exists: true, 
                  $ne: null, 
                  $ne: '',
                  $regex: /^https?:\/\/.+/
                } 
              } 
            } 
          }
        ]
      });
      
      const totalAfter = await Question.countDocuments({ isActive: true });
      
      console.log('\n📊 After Cleanup:');
      console.log(`Total Questions: ${totalAfter}`);
      console.log(`Picture Questions: ${afterPictureCount}`);
      console.log(`Text Questions: ${totalAfter - afterPictureCount}`);
    } else {
      console.log('✅ No cleanup needed - all questions are properly formatted!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Connect to database and run cleanup
async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ Error: MONGODB_URI not found in environment variables');
      console.log('Make sure you have a .env file with MONGODB_URI defined');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');
    
    // Run inspection and cleanup
    await inspectAndCleanQuestions();
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
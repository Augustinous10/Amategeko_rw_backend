// Fix "null" strings in database
// Save as: fixNullStrings.js

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
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);

async function fixNullStrings() {
  try {
    console.log('🔧 Fixing "null" string values...\n');
    
    // Fix question.image_url that are "null" strings
    const result1 = await Question.updateMany(
      { 'question.image_url': 'null' },
      { $set: { 'question.image_url': null } }
    );
    
    console.log(`✅ Fixed ${result1.modifiedCount} questions with "null" string in question.image_url`);
    
    // Fix option.optionImage that are "null" strings
    const result2 = await Question.updateMany(
      { 'options.optionImage': 'null' },
      { $set: { 'options.$[elem].optionImage': null } },
      { arrayFilters: [{ 'elem.optionImage': 'null' }] }
    );
    
    console.log(`✅ Fixed ${result2.modifiedCount} questions with "null" string in optionImage`);
    
    // Also fix empty strings
    const result3 = await Question.updateMany(
      { 'question.image_url': '' },
      { $set: { 'question.image_url': null } }
    );
    
    console.log(`✅ Fixed ${result3.modifiedCount} questions with empty string in question.image_url`);
    
    const result4 = await Question.updateMany(
      { 'options.optionImage': '' },
      { $set: { 'options.$[elem].optionImage': null } },
      { arrayFilters: [{ 'elem.optionImage': '' }] }
    );
    
    console.log(`✅ Fixed ${result4.modifiedCount} questions with empty string in optionImage`);
    
    // Verify the fix
    console.log('\n📊 Verification:\n');
    
    const total = await Question.countDocuments({ isActive: true });
    
    const pictureCount = await Question.countDocuments({ 
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
    
    console.log(`Total Questions: ${total}`);
    console.log(`Picture Questions: ${pictureCount}`);
    console.log(`Text Questions: ${total - pictureCount}`);
    
    // Check if any "null" strings remain
    const nullStringsRemain = await Question.countDocuments({
      $or: [
        { 'question.image_url': 'null' },
        { 'options.optionImage': 'null' }
      ]
    });
    
    if (nullStringsRemain > 0) {
      console.log(`\n⚠️  Warning: ${nullStringsRemain} questions still have "null" strings`);
    } else {
      console.log('\n✅ All "null" strings have been fixed!');
    }
    
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
    
    await fixNullStrings();
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected');
    console.log('\n🎉 Done! Now restart your backend server and refresh your frontend.');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
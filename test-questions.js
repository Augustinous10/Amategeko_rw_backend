const mongoose = require('mongoose');
const Question = require('./src/models/Question'); // Adjust path if needed

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/amategeko_rw', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testQueries() {
  try {
    console.log('🧪 Testing Question Queries...\n');

    // Test 1: Total questions
    const total = await Question.countDocuments({ 
      isActive: true, 
      language: 'rw' 
    });
    console.log('✅ Total questions:', total);

    // Test 2: Picture questions
    const pictures = await Question.countDocuments({
      isActive: true,
      language: 'rw',
      'question.image_url': { $exists: true, $ne: null, $ne: '' }
    });
    console.log('✅ Picture questions:', pictures);

    // Test 3: Text questions
    const texts = await Question.countDocuments({
      isActive: true,
      language: 'rw',
      $or: [
        { 'question.image_url': { $exists: false } },
        { 'question.image_url': null },
        { 'question.image_url': '' }
      ]
    });
    console.log('✅ Text questions:', texts);

    // Test 4: Show actual picture questions
    const picList = await Question.find({
      isActive: true,
      language: 'rw',
      'question.image_url': { $exists: true, $ne: null, $ne: '' }
    }).select('_id question.image_url');
    
    console.log('\n📸 Picture Questions:');
    picList.forEach((q, i) => {
      console.log(`   ${i+1}. ${q._id}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testQueries();
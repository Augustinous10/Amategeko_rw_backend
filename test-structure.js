// test-structure.js
const mongoose = require('mongoose');
const Question = require('./src/models/Question');

mongoose.connect('mongodb://localhost:27017/amategeko_rw', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkStructure() {
  try {
    // Get one question without image
    const textQ = await Question.findOne({ 
      _id: '69346b408893e4aeffc43f59' 
    });
    
    console.log('📝 Text Question Structure:');
    console.log(JSON.stringify(textQ, null, 2));
    
    // Get one question with image
    const picQ = await Question.findOne({ 
      _id: '69346c6a8893e4aeffc43f91' 
    });
    
    console.log('\n📸 Picture Question Structure:');
    console.log(JSON.stringify(picQ, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkStructure();
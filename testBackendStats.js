// Backend Stats Diagnostic Script
// Save as: testBackendStats.js

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

async function testBackendQueries() {
  try {
    console.log('🧪 Testing Backend Stat Queries\n');
    
    const totalQuestions = await Question.countDocuments({ isActive: true });
    console.log(`✅ Total Questions: ${totalQuestions}`);
    
    // Test 1: Current backend query (without regex)
    console.log('\n--- Test 1: Current Backend Query (without $regex) ---');
    const pictureQuery1 = await Question.countDocuments({ 
      isActive: true,
      $or: [
        { 
          'question.image_url': { 
            $exists: true, 
            $ne: null, 
            $ne: '' 
          } 
        },
        { 
          'options': { 
            $elemMatch: { 
              optionImage: { 
                $exists: true, 
                $ne: null, 
                $ne: '' 
              } 
            } 
          } 
        }
      ]
    });
    console.log(`Picture Questions (current query): ${pictureQuery1}`);
    console.log(`Text Questions (current query): ${totalQuestions - pictureQuery1}`);
    
    // Test 2: With regex (improved query)
    console.log('\n--- Test 2: Improved Query (with $regex) ---');
    const pictureQuery2 = await Question.countDocuments({ 
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
    console.log(`Picture Questions (improved query): ${pictureQuery2}`);
    console.log(`Text Questions (improved query): ${totalQuestions - pictureQuery2}`);
    
    // Test 3: Find questions that match current but not improved query
    console.log('\n--- Test 3: Finding Problematic Questions ---');
    const problematicQuestions = await Question.find({ 
      isActive: true,
      $or: [
        { 
          'question.image_url': { 
            $exists: true, 
            $ne: null, 
            $ne: '' 
          } 
        },
        { 
          'options': { 
            $elemMatch: { 
              optionImage: { 
                $exists: true, 
                $ne: null, 
                $ne: '' 
              } 
            } 
          } 
        }
      ],
      // But NOT matching the improved query
      $nor: [
        { 
          'question.image_url': { 
            $regex: /^https?:\/\/.+/
          } 
        },
        { 
          'options': { 
            $elemMatch: { 
              optionImage: { 
                $regex: /^https?:\/\/.+/
              } 
            } 
          } 
        }
      ]
    }).limit(5);
    
    console.log(`Found ${problematicQuestions.length} problematic questions`);
    
    if (problematicQuestions.length > 0) {
      console.log('\nSample problematic questions:');
      problematicQuestions.forEach((q, idx) => {
        console.log(`\n${idx + 1}. ${q.question.description.substring(0, 60)}...`);
        console.log(`   Question Image: "${q.question.image_url}"`);
        console.log(`   Options with images:`);
        q.options.forEach((opt, optIdx) => {
          if (opt.optionImage !== null && opt.optionImage !== undefined) {
            console.log(`      Option ${optIdx}: "${opt.optionImage}"`);
          }
        });
      });
    }
    
    // Test 4: Check by language
    console.log('\n--- Test 4: By Language Stats ---');
    const languages = ['en', 'fr', 'rw'];
    
    for (const lang of languages) {
      const total = await Question.countDocuments({ isActive: true, language: lang });
      const picture = await Question.countDocuments({ 
        isActive: true,
        language: lang,
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
      
      const langName = { en: 'English', fr: 'French', rw: 'Kinyarwanda' }[lang];
      console.log(`${langName}: Total=${total}, Picture=${picture}, Text=${total - picture}`);
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
    
    await testBackendQueries();
    
    await mongoose.disconnect();
    console.log('\n👋 Disconnected');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
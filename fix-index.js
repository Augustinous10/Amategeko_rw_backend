const mongoose = require('mongoose');

async function fixIndex() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/amategeko_rw');
    console.log('✅ Connected');

    const db = mongoose.connection.db;
    const collection = db.collection('payments');

    // Drop the problematic unique index
    console.log('🗑️  Dropping transactionId indexes...');
    try {
      await collection.dropIndex('transactionId_sparse_unique');
      console.log('   ✅ Dropped transactionId_sparse_unique');
    } catch (e) {
      console.log('   (Index may not exist)');
    }
    
    try {
      await collection.dropIndex('transactionId_1');
      console.log('   ✅ Dropped transactionId_1');
    } catch (e) {
      console.log('   (Index may not exist)');
    }

    // Create the correct index (NON-UNIQUE, but sparse)
    console.log('🔧 Creating correct sparse index (non-unique)...');
    await collection.createIndex(
      { transactionId: 1 },
      { sparse: true }  // ✅ NO unique constraint
    );
    console.log('   ✅ Created sparse index without unique constraint');

    // Verify
    console.log('\n✅ Verification:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      if (idx.name.includes('transactionId')) {
        console.log(`   - ${idx.name}: unique=${idx.unique || false}, sparse=${idx.sparse || false}`);
      }
    });

    console.log('\n🎉 Fix complete! Restart your backend now.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIndex();
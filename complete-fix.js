const mongoose = require('mongoose');
require('dotenv').config();

async function completeFix() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('payments');
    
    // 1. Show current state
    console.log('📊 Current state:');
    const count = await collection.countDocuments();
    console.log(`   Total payments: ${count}`);
    
    const indexes = await collection.indexes();
    console.log('   Current indexes:', indexes.map(i => i.name).join(', '));
    
    // 2. Delete ALL payments (fresh start)
    console.log('\n🗑️  Deleting all payment records...');
    const deleteResult = await collection.deleteMany({});
    console.log(`   Deleted: ${deleteResult.deletedCount} records`);
    
    // 3. Drop ALL indexes completely
    console.log('\n🔨 Dropping all indexes...');
    try {
      await collection.dropIndexes();
      console.log('   ✅ All indexes dropped');
    } catch (err) {
      console.log('   ⚠️  Some indexes might not exist, continuing...');
    }
    
    // 4. Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 5. Create ONLY the sparse unique index
    console.log('\n🔧 Creating sparse unique index...');
    await collection.createIndex(
      { transactionId: 1 }, 
      { 
        sparse: true, 
        unique: true,
        name: 'transactionId_sparse_unique'
      }
    );
    console.log('   ✅ Created: transactionId_sparse_unique');
    
    // 6. Verify
    console.log('\n✅ Verification:');
    const newIndexes = await collection.indexes();
    console.log('   Final indexes:');
    newIndexes.forEach(idx => {
      const flags = [];
      if (idx.unique) flags.push('UNIQUE');
      if (idx.sparse) flags.push('SPARSE');
      console.log(`   - ${idx.name} ${flags.length ? '[' + flags.join(', ') + ']' : ''}`);
    });
    
    await mongoose.connection.close();
    console.log('\n🎉 Complete fix done! Now restart your backend.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

completeFix();
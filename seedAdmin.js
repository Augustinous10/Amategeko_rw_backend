require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const createAdminUser = async () => {
  try {
    // Get MongoDB URI from environment variable
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/amategeko_rw';
    
    if (!MONGO_URI) {
      console.error('❌ Error: MONGODB_URI is not defined in .env file');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);

    console.log('✅ MongoDB Connected...');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ phone: '0781345944' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('📱 Phone:', existingAdmin.phone);
      console.log('👤 Name:', existingAdmin.fullName);
      console.log('🔑 Role:', existingAdmin.role);
      
      // Update to admin if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log('✅ User role updated to admin!');
      }
      
      await mongoose.connection.close();
      console.log('📦 MongoDB connection closed');
      process.exit(0);
      return;
    }

    // Create new admin user
    const adminUser = await User.create({
      fullName: 'System Administrator',
      phone: '0781345944',
      password: '0781345944', // Will be hashed by User model pre-save hook
      role: 'admin',
      isActive: true,
      preferredLanguage: 'rw'
    });

    console.log('✅ Admin user created successfully!');
    console.log('=========================================');
    console.log('📱 Phone Number: 0781345944');
    console.log('🔒 Password: 0781345944');
    console.log('👤 Full Name: System Administrator');
    console.log('🔑 Role: admin');
    console.log('=========================================');
    console.log('🚀 You can now login with these credentials');
    console.log('⚠️  Please change the password after first login!');

    // Close connection
    await mongoose.connection.close();
    console.log('📦 MongoDB connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error('Full error:', error);
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the script
createAdminUser();
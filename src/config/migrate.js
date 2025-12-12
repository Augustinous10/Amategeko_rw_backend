require('dotenv').config();
const connectDB = require('./database');
const { User, Subscription } = require('../models');

const seed = async () => {
  try {
    console.log('🔄 Starting database seeding...');

    // Connect to MongoDB
    await connectDB();

    // Create default admin user if not exists
    const adminExists = await User.findOne({ email: 'admin@umuhanda.rw' });
    
    if (!adminExists) {
      await User.create({
        email: 'admin@umuhanda.rw',
        password: 'Admin@123',
        fullName: 'Admin User',
        role: 'admin',
        phone: '+250788000000',
        preferredLanguage: 'en'
      });
      console.log('✅ Default admin user created');
      console.log('   Email: admin@umuhanda.rw');
      console.log('   Password: Admin@123');
      console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create default subscription plans if not exist
    const plansExist = await Subscription.countDocuments();
    
    if (plansExist === 0) {
      await Subscription.insertMany([
        {
          name: 'Basic',
          description: 'Perfect for getting started with exam preparation',
          price: 5000,
          durationDays: 30,
          features: {
            examAttempts: 5,
            videoAccess: false,
            materialsAccess: true
          }
        },
        {
          name: 'Premium',
          description: 'Most popular plan with unlimited practice',
          price: 15000,
          durationDays: 90,
          features: {
            examAttempts: -1, // unlimited
            videoAccess: true,
            materialsAccess: true
          }
        },
        {
          name: 'Pro',
          description: 'Annual plan with all features',
          price: 50000,
          durationDays: 365,
          features: {
            examAttempts: -1, // unlimited
            videoAccess: true,
            materialsAccess: true
          }
        }
      ]);
      console.log('✅ Default subscription plans created');
    } else {
      console.log('ℹ️  Subscription plans already exist');
    }

    console.log('✅ Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
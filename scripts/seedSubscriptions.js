const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');
const { SUBSCRIPTION_TYPES } = require('../src/utils/constants');
require('dotenv').config();

const subscriptionPlans = [
  {
    type: SUBSCRIPTION_TYPES.SINGLE_EXAM,
    name: {
      rw: 'Ikizamini kimwe',
      en: '1 Exam',
      fr: '1 Examen'
    },
    description: {
      rw: 'Ikizamini kimwe',
      en: 'Single exam attempt',
      fr: 'Une tentative d\'examen'
    },
    pricing: {
      rw: 100,
      en: 200,
      fr: 200
    },
    currency: 'RWF',
    examLimit: 1,
    durationDays: null,
    features: {
      examAttempts: 1
    }
  },
  {
    type: SUBSCRIPTION_TYPES.FIVE_EXAMS,
    name: {
      rw: 'Ibizamini 5',
      en: '5 Exams',
      fr: '5 Examens'
    },
    description: {
      rw: 'Ibizamini bitanu',
      en: 'Five exam attempts',
      fr: 'Cinq tentatives d\'examen'
    },
    pricing: {
      rw: 500,
      en: 800,
      fr: 800
    },
    currency: 'RWF',
    examLimit: 5,
    durationDays: null,
    features: {
      examAttempts: 5
    }
  },
  {
    type: SUBSCRIPTION_TYPES.SEVEN_DAYS,
    name: {
      rw: 'Iminsi 7 bidashira',
      en: '7 Days Unlimited',
      fr: '7 Jours Illimité'
    },
    description: {
      rw: 'Ibizamini bidashira mu minsi 7',
      en: 'Unlimited exams for 7 days',
      fr: 'Examens illimités pendant 7 jours'
    },
    pricing: {
      rw: 2500,
      en: 3000,
      fr: 3000
    },
    currency: 'RWF',
    examLimit: null,
    durationDays: 7,
    features: {
      examAttempts: 0
    }
  },
  {
    type: SUBSCRIPTION_TYPES.FIFTEEN_DAYS,
    name: {
      rw: 'Iminsi 15 bidashira',
      en: '15 Days Unlimited',
      fr: '15 Jours Illimité'
    },
    description: {
      rw: 'Ibizamini bidashira mu minsi 15',
      en: 'Unlimited exams for 15 days',
      fr: 'Examens illimités pendant 15 jours'
    },
    pricing: {
      rw: 4500,
      en: 5000,
      fr: 5000
    },
    currency: 'RWF',
    examLimit: null,
    durationDays: 15,
    features: {
      examAttempts: 0
    }
  },
  {
    type: SUBSCRIPTION_TYPES.THIRTY_DAYS,
    name: {
      rw: 'Ukwezi kumwe bidashira',
      en: '30 Days Unlimited',
      fr: '30 Jours Illimité'
    },
    description: {
      rw: 'Ibizamini bidashira mu kwezi kumwe',
      en: 'Unlimited exams for 30 days',
      fr: 'Examens illimités pendant 30 jours'
    },
    pricing: {
      rw: 7000,
      en: 8000,
      fr: 8000
    },
    currency: 'RWF',
    examLimit: null,
    durationDays: 30,
    features: {
      examAttempts: 0
    }
  }
];

async function seedSubscriptions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');
    
    const deleted = await Subscription.deleteMany({});
    console.log(`✓ Cleared ${deleted.deletedCount} existing subscriptions`);
    
    const result = await Subscription.insertMany(subscriptionPlans);
    console.log(`✓ Seeded ${result.length} subscription plans successfully\n`);
    
    console.log('Created plans:');
    result.forEach(sub => {
      console.log(`  - ${sub.name.en} (${sub.type})`);
      console.log(`    Names: RW="${sub.name.rw}" EN="${sub.name.en}" FR="${sub.name.fr}"`);
      console.log(`    Prices: RW=${sub.pricing.rw} EN=${sub.pricing.en} FR=${sub.pricing.fr}`);
      console.log(`    Limits: ${sub.examLimit || 'Unlimited'} exams, ${sub.durationDays || 'No time limit'} days\n`);
    });
    
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error seeding subscriptions:', error);
    process.exit(1);
  }
}

seedSubscriptions();
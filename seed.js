const mongoose = require('mongoose');
const User = require('./models/User');
const Badge = require('./models/Badge');
require('dotenv').config();

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/skill_wallet');
        console.log('Connected to DB for seeding...');

        // Clear existing data (if any) just in case
        await User.deleteMany({});
        await Badge.deleteMany({});

        // Create a mock user
        const newUser = new User({
            username: 'demo_student',
            stats: {
                listening: 80,
                speaking: 75,
                reading: 90,
                writing: 85,
                overallScore: 82
            },
            privacy: {
                visibility: 'public'
            }
        });

        const savedUser = await newUser.save();
        console.log(`Created mock user with ID: ${savedUser._id}`);

        // Create a mock badge for this user
        const newBadge = new Badge({
            userId: savedUser._id,
            language: 'English',
            proficiencyLevel: 'B2 Upper Intermediate'
        });

        await newBadge.save();
        console.log('Created mock badge.');

        console.log('✅ Seeding completed! The "skill_wallet" database should now be visible.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding DB:', error);
        process.exit(1);
    }
};

seedDB();

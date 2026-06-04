require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const email = process.argv[2];

if (!email) {
    console.error('Usage: node promote.js <email>');
    console.error('Example: node promote.js admin@example.com');
    process.exit(1);
}

async function promoteUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/skill_wallet');
        
        const user = await User.findOne({ email });
        if (!user) {
            console.error(`User with email "${email}" not found.`);
            process.exit(1);
        }

        if (user.role === 'admin') {
            console.log(`User "${user.username}" (${email}) is already an admin.`);
            process.exit(0);
        }

        user.role = 'admin';
        await user.save();
        console.log(`✅ Successfully promoted "${user.username}" (${email}) to Admin.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

promoteUser();

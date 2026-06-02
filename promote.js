require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function promoteAll() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/skillwallet');
        const res = await User.updateMany({}, { $set: { role: 'admin' } });
        console.log(`Successfully promoted ${res.modifiedCount} users to Admin.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
promoteAll();

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        // Fallback to local mongo if running directly instead of docker
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skill_wallet');

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`Error connecting to MongoDB: ${err.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;

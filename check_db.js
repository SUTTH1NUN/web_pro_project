require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./models/Question');

async function checkDB() {
    await mongoose.connect(process.env.MONGO_URI);
    const counts = await Question.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    console.log('DB Counts:', counts);
    process.exit(0);
}
checkDB();

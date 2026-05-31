const mongoose = require('mongoose');

const TestResultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    moduleType: {
        type: String,
        enum: ['chatbot', 'gamification', 'quiz', 'speaking'],
        required: true
    },
    score: {
        type: Number,
        default: 0
    },
    details: {
        type: Object // Flexible object to store specific test metadata like answers or fluency score
    },
    testedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TestResult', TestResultSchema);

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    stats: {
        listening: { type: Number, default: 0 },
        speaking: { type: Number, default: 0 },
        reading: { type: Number, default: 0 },
        writing: { type: Number, default: 0 },
        overallScore: { type: Number, default: 0 }
    },
    privacy: {
        visibility: {
            type: String,
            enum: ['public', 'link_only', 'request'],
            default: 'request'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);

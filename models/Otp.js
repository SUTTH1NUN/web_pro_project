const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // TTL index: automatically deleted after 10 minutes (600 seconds)
    }
});

module.exports = mongoose.model('Otp', OtpSchema);

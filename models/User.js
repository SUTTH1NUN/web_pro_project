const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: false, // Not required if logging in via Google
    },
    googleId: {
        type: String,
        required: false, // Only for Google users
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
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Encrypt password using bcrypt before saving to DB
UserSchema.pre('save', async function() {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return;
    }
    
    if (this.password) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

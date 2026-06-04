const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['certificate', 'speaking_sample'],
        required: true
    },
    testType: {
        type: String,
        enum: ['TOEIC', 'Linguaskill', 'IELTS', 'TOEFL', 'Duolingo English Test', 'TETET', 'CU-TEP'],
        required: function() { return this.type === 'certificate'; }
    },
    providedName: {
        type: String,
    },
    extractedData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    extractedScore: {
        type: String,
        default: 'N/A'
    },
    verificationStatus: {
        type: String,
        enum: ['processing', 'pending', 'verified', 'rejected'],
        default: 'processing'
    },
    rejectionReason: {
        type: String,
        default: ''
    },
    filename: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Evidence', EvidenceSchema);

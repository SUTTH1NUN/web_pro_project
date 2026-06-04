const Evidence = require('../models/Evidence');
const User = require('../models/User');
const { convertTo10PointScale } = require('./scoreConverter');

async function updateUserStats(userId) {
    try {
        const evidences = await Evidence.find({ userId: userId, verificationStatus: 'verified' });
        
        let maxStats = { speaking: 0, listening: 0, reading: 0, writing: 0 };
        
        for (const ev of evidences) {
            if (ev.extractedData) {
                const scaled = convertTo10PointScale(ev.extractedData, ev.testType);
                if (scaled.speaking > maxStats.speaking) maxStats.speaking = scaled.speaking;
                if (scaled.listening > maxStats.listening) maxStats.listening = scaled.listening;
                if (scaled.reading > maxStats.reading) maxStats.reading = scaled.reading;
                if (scaled.writing > maxStats.writing) maxStats.writing = scaled.writing;
            }
        }
        
        await User.findByIdAndUpdate(userId, { stats: maxStats });
    } catch (err) {
        console.error('Error recalculating user stats:', err);
    }
}

module.exports = { updateUserStats };

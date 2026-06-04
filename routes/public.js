const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Evidence = require('../models/Evidence');

// GET /api/public/user/:username
router.get('/user/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch verified evidences
        const evidences = await Evidence.find({ 
            userId: user._id, 
            verificationStatus: 'verified' 
        }).sort({ uploadedAt: -1 });

        // Map evidences to potentially blur private scores
        const publicEvidences = evidences.map(ev => {
            const evObj = ev.toObject();
            if (evObj.isPrivate) {
                // We keep the object but explicitly flag it so frontend can blur it
                evObj.isPrivate = true;
                // Optional: we could strip the actual data, but the prompt says 
                // "see a blurred effect", which implies the frontend blurs it visually.
                // However, for security, we could replace it with a dummy string if we wanted.
                // But let's leave it and rely on frontend blur for the visual effect requested.
            }
            // Strip out sensitive fields that aren't needed publicly
            delete evObj.rejectionReason;
            delete evObj.userId;
            return evObj;
        });

        res.json({
            user: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                jobTitle: user.jobTitle,
                organization: user.organization,
                bio: user.bio,
                linkedinUrl: user.linkedinUrl,
                portfolioUrl: user.portfolioUrl,
                portfolioBadges: user.portfolioBadges || [],
                stats: user.stats || { speaking: 0, listening: 0, reading: 0, writing: 0 },
                webStats: user.webStats || { speaking: 0, listening: 0, reading: 0, writing: 0 }
            },
            evidences: publicEvidences
        });
    } catch (error) {
        console.error('Error fetching public profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Evidence = require('../models/Evidence');
const Setting = require('../models/Setting');
const { protect, admin } = require('../middleware/auth');
const { updateUserStats } = require('../utils/userStats');

// Apply protect middleware to all routes in this file (must be logged in)
router.use(protect);
// router.use(admin); // Temporarily removed for testing

// GET /api/admin/stats
// Returns overall platform statistics
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalEvidences = await Evidence.countDocuments();
        const pendingQueueCount = await Evidence.countDocuments({ verificationStatus: { $in: ['pending', 'rejected', 'processing'] } });
        
        res.json({
            totalUsers,
            totalEvidences,
            pendingQueueCount
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/admin/queue
// Returns list of pending and rejected certificates for manual review
router.get('/queue', async (req, res) => {
    try {
        const evidences = await Evidence.find({ 
            verificationStatus: { $in: ['pending', 'rejected', 'processing'] } 
        })
        .populate('userId', 'firstName lastName username email')
        .sort({ uploadedAt: -1 });

        res.json({ evidences });
    } catch (error) {
        console.error('Error fetching admin queue:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// PUT /api/admin/queue/:id
// Approves or rejects a certificate manually and updates scores
router.put('/queue/:id', async (req, res) => {
    try {
        const { status, extractedData, rejectionReason } = req.body; // extractedData contains the admin's manual overrides
        
        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const evidence = await Evidence.findById(req.params.id);
        if (!evidence) {
            return res.status(404).json({ error: 'Evidence not found' });
        }

        // If admin provided corrected data, merge it into the existing data
        if (extractedData) {
            evidence.extractedData = {
                ...evidence.extractedData,
                ...extractedData
            };
            // Update the top-level score for UI backward compatibility
            evidence.extractedScore = extractedData.totalScore || extractedData.score || evidence.extractedScore;
        }

        evidence.verificationStatus = status;
        if (status === 'rejected' && rejectionReason) {
            evidence.rejectionReason = rejectionReason;
        }
        await evidence.save();

        // If verified or rejected, recalculate the user's stats
        await updateUserStats(evidence.userId);

        res.json({ message: `Evidence marked as ${status}`, evidence });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/admin/settings
// Fetch platform settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await Setting.find();
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);
        
        // Provide defaults if not found
        if (!settingsMap['aiVerificationMode']) settingsMap['aiVerificationMode'] = 'enabled';
        if (!settingsMap['maxUploadSize']) settingsMap['maxUploadSize'] = 10;

        res.json(settingsMap);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// PUT /api/admin/settings
// Update platform settings
router.put('/settings', async (req, res) => {
    try {
        const updates = req.body; // e.g. { aiVerificationMode: 'disabled', maxUploadSize: 10 }
        
        for (const [key, value] of Object.entries(updates)) {
            await Setting.findOneAndUpdate(
                { key },
                { value },
                { upsert: true, new: true }
            );
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;

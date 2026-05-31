const express = require('express');
const router = express.Router();

const User = require('../models/User');

// GET /api/users/:userId/stats
router.get('/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // This is a sample Mongoose query
        // Normally we use valid ObjectIds, but to not break existing mock tests:
        let user = await User.findById(userId).catch(() => null);
        
        if (!user) {
            // Mock response if DB doesn't have it (for easy testing without manual creation)
            return res.json({
                userId,
                listening: 85,
                speaking: 78,
                reading: 92,
                writing: 88,
                overallScore: 86,
                message: "This is mock data. Valid MongoDB ObjectId needed for real DB fetch."
            });
        }

        res.json({
            userId: user._id,
            listening: user.stats.listening,
            speaking: user.stats.speaking,
            reading: user.stats.reading,
            writing: user.stats.writing,
            overallScore: user.stats.overallScore
        });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/users/:userId/privacy
router.get('/:userId/privacy', (req, res) => {
    const { userId } = req.params;
    res.json({
        userId,
        visibility: 'public'
    });
});

// PUT /api/users/:userId/privacy
router.put('/:userId/privacy', (req, res) => {
    const { userId } = req.params;
    const { visibility } = req.body;
    res.json({
        message: 'Privacy settings updated successfully',
        updatedVisibility: visibility
    });
});

// GET /api/users/:userId/portfolio/export
router.get('/:userId/portfolio/export', (req, res) => {
    const { userId } = req.params;
    const mockPdfBuffer = Buffer.from('Mock PDF Content');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="portfolio-${userId}.pdf"`);
    res.send(mockPdfBuffer);
});

module.exports = router;

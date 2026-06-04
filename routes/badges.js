const express = require('express');
const router = express.Router();

// GET /api/badges/:badgeId
router.get('/:badgeId', (req, res) => {
    const { badgeId } = req.params;

    res.json({
        id: badgeId,
        userId: 'user-123',
        language: 'English',
        proficiencyLevel: 'C1 Advanced',
        issuedAt: new Date().toISOString()
    });
});

module.exports = router;

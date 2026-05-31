const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for memory storage (mocking upload)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/evidence/upload
router.post('/upload', upload.single('file'), (req, res) => {
    const file = req.file;
    const { type } = req.body;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    res.status(201).json({
        message: 'Evidence uploaded successfully',
        type: type || 'unknown',
        filename: file.originalname,
        size: file.size
    });
});

module.exports = router;

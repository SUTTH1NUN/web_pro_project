const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const { extractCertificateData } = require('../utils/gemini');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for disk storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

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
        filename: file.filename,
        size: file.size
    });
});

// POST /api/evidence/upload-cert
router.post('/upload-cert', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const { testType } = req.body;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (!testType) {
            return res.status(400).json({ error: 'Test type is required' });
        }

        // Mock User: Since auth middleware is not present, fetch the first user or create a dummy one
        let user = await User.findOne();
        if (!user) {
            user = await User.create({ username: 'testuser', email: 'test@example.com', password: 'password123', firstName: 'John', lastName: 'Doe' });
        }

        const providedName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;

        // Read file into buffer for Gemini
        const filePath = path.join(uploadDir, file.filename);
        const fileBuffer = fs.readFileSync(filePath);
        
        // Call Gemini API
        const extractedData = await extractCertificateData(fileBuffer, file.mimetype, testType);

        // Verify name
        let verificationStatus = 'pending';
        if (extractedData.fullName && providedName) {
            const providedLower = providedName.toLowerCase().replace(/\s+/g, ' ');
            const extractedLower = extractedData.fullName.toLowerCase().replace(/\s+/g, ' ');
            
            if (extractedLower.includes(providedLower) || providedLower.includes(extractedLower)) {
                verificationStatus = 'verified';
            } else {
                verificationStatus = 'rejected';
            }
        }



        const evidence = new Evidence({
            userId: user._id,
            type: 'certificate',
            testType: testType,
            providedName: providedName,
            filename: file.filename,
            size: file.size,
            extractedData: extractedData,
            verificationStatus: verificationStatus
        });

        await evidence.save();

        res.status(201).json({
            message: 'Certificate uploaded and processed successfully',
            evidence: evidence
        });
    } catch (error) {
        console.error('Error processing certificate:', error);
        res.status(500).json({ error: 'Internal server error during certificate processing' });
    }
});

module.exports = router;

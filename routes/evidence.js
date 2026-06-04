const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const Setting = require('../models/Setting');
const { extractCertificateData } = require('../utils/gemini');
const { updateUserStats } = require('../utils/userStats');
const { protect } = require('../middleware/auth');

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

async function processCertificateAsync(evidenceId, userId, filename, mimetype, testType, providedName) {
    try {
        const filePath = path.join(uploadDir, filename);
        const fileBuffer = fs.readFileSync(filePath);
        
        // Fetch AI setting
        let aiMode = 'enabled';
        try {
            const aiSetting = await Setting.findOne({ key: 'aiVerificationMode' });
            if (aiSetting) aiMode = aiSetting.value;
        } catch (e) {
            console.error("Failed to read setting, defaulting to enabled");
        }

        let extractedData = {};
        let verificationStatus = 'pending'; // Default to pending if anything is missing

        if (aiMode === 'disabled') {
            console.log("AI Verification is disabled. Pushing to manual review directly.");
            extractedData = { fullName: providedName, testDate: new Date().toISOString() };
            verificationStatus = 'pending';
        } else {
            extractedData = await extractCertificateData(fileBuffer, mimetype, testType);

            // Strict Check: Ensure core data exists
            const hasCoreData = extractedData && extractedData.fullName && extractedData.testDate && (extractedData.totalScore || extractedData.score);
            
            if (hasCoreData && providedName) {
                const providedLower = providedName.toLowerCase().replace(/\s+/g, ' ');
                const extractedLower = extractedData.fullName.toLowerCase().replace(/\s+/g, ' ');
                
                // Auto-Approve only if name matches and data is complete
                if (extractedLower.includes(providedLower) || providedLower.includes(extractedLower)) {
                    verificationStatus = 'verified';
                }
            }
        }
        // If it fails the strict check, name doesn't match, or AI is disabled, it remains 'pending' for manual review

        await Evidence.findByIdAndUpdate(evidenceId, {
            extractedData: extractedData,
            extractedScore: extractedData.totalScore || extractedData.score || 'N/A', // Fallback if AI ignores prompt
            verificationStatus: verificationStatus
        });

        // Trigger stats recalculation if verified
        if (verificationStatus === 'verified') {
            await updateUserStats(userId);
        }

    } catch (error) {
        console.error('Failed to process certificate:', error);
        await Evidence.findByIdAndUpdate(evidenceId, { verificationStatus: 'pending' }); // Fallback to pending on error
    }
}

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
router.post('/upload-cert', protect, upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const { testType } = req.body;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (!testType) {
            return res.status(400).json({ error: 'Test type is required' });
        }

        const user = req.user;

        const providedName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;

        const evidence = new Evidence({
            userId: user._id,
            type: 'certificate',
            testType: testType,
            providedName: providedName,
            filename: file.filename,
            size: file.size,
            verificationStatus: 'processing'
        });

        await evidence.save();

        res.status(202).json({
            message: 'Certificate uploaded and processing started',
            evidence: evidence
        });

        // Background async processing
        processCertificateAsync(evidence._id, user._id, file.filename, file.mimetype, testType, providedName).catch(err => {
            console.error('Background processing error:', err);
        });
    } catch (error) {
        console.error('Error processing certificate:', error);
        res.status(500).json({ error: 'Internal server error during certificate processing' });
    }
});

// GET /api/evidence
router.get('/', protect, async (req, res) => {
    try {
        const evidences = await Evidence.find({ userId: req.user._id }).sort({ uploadedAt: -1 });
        res.json({ evidences });
    } catch (error) {
        console.error('Error fetching evidence:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/evidence/:id
router.delete('/:id', protect, async (req, res) => {
    try {
        const evidence = await Evidence.findOne({ _id: req.params.id, userId: req.user._id });
        
        if (!evidence) {
            return res.status(404).json({ error: 'Evidence not found or unauthorized' });
        }

        // Optional: delete file from filesystem
        const filePath = path.join(uploadDir, evidence.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await Evidence.deleteOne({ _id: req.params.id });
        res.json({ message: 'Evidence deleted successfully' });
    } catch (error) {
        console.error('Error deleting evidence:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

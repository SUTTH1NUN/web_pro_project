const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Evidence = require('../models/Evidence');
const Setting = require('../models/Setting');
const Question = require('../models/Question');
const { protect, admin } = require('../middleware/auth');
const { updateUserStats } = require('../utils/userStats');

// Apply protect middleware to all routes in this file (must be logged in)
router.use(protect);
router.use(admin);

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

// POST /api/admin/questions
// Create a new test question
router.post('/questions', async (req, res) => {
    try {
        const { type, cefrLevel, article, questions } = req.body;

        if (!type || !cefrLevel || !article) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newQuestion = new Question({
            type,
            cefrLevel,
            article,
            questions: questions || []
        });

        await newQuestion.save();
        res.status(201).json({ message: 'Question created successfully', question: newQuestion });
    } catch (error) {
        console.error('Error creating question:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/admin/questions/batch
// Create multiple test questions from JSON
router.post('/questions/batch', async (req, res) => {
    try {
        const { questions } = req.body;
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty questions array' });
        }

        const inserted = await Question.insertMany(questions);
        res.status(201).json({ message: `${inserted.length} questions added successfully`, count: inserted.length });
    } catch (error) {
        console.error('Error in batch question upload:', error);
        res.status(500).json({ error: 'Server Error. Check your JSON format.' });
    }
});

// GET /api/admin/questions
// Fetch questions by type and cefrLevel
router.get('/questions', async (req, res) => {
    try {
        const { type, cefrLevel } = req.query;
        let query = {};
        if (type) query.type = type;
        if (cefrLevel) query.cefrLevel = cefrLevel;
        
        const questions = await Question.find(query).sort({ createdAt: -1 });
        res.json({ questions });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/admin/users
// Fetch list of all registered users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE /api/admin/users/:id
// Delete a specific user by ID
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await user.deleteOne();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// PUT /api/admin/users/:id/role
// Promote or demote a user
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.role = role;
        await user.save();
        
        res.json({ message: 'User role updated successfully', user: { _id: user._id, username: user.username, role: user.role } });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// PUT /api/admin/questions/:id
// Update an existing test question
router.put('/questions/:id', async (req, res) => {
    try {
        const { type, cefrLevel, article, questions } = req.body;

        const updatedQuestion = await Question.findByIdAndUpdate(
            req.params.id,
            { type, cefrLevel, article, questions: questions || [] },
            { new: true, runValidators: true }
        );

        if (!updatedQuestion) {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.json({ message: 'Question updated successfully', question: updatedQuestion });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE /api/admin/questions/:id
// Delete a specific test question
router.delete('/questions/:id', async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        await question.deleteOne();
        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// PUT /api/admin/users/:id/cheat
// Inject cheat scores for Demo purposes
router.put('/users/:id/cheat', async (req, res) => {
    try {
        const { external, web } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (external) {
            user.stats.listening = external.listening || 0;
            user.stats.reading = external.reading || 0;
            user.stats.speaking = external.speaking || 0;
            user.stats.writing = external.writing || 0;
            user.stats.overallScore = Math.round((user.stats.listening + user.stats.reading + user.stats.speaking + user.stats.writing) / 4);
        }

        if (web) {
            user.webStats.listening = web.listening || 0;
            user.webStats.reading = web.reading || 0;
            user.webStats.speaking = web.speaking || 0;
            user.webStats.writing = web.writing || 0;
            user.webStats.overallScore = Math.round((user.webStats.listening + user.webStats.reading + user.webStats.speaking + user.webStats.writing) / 4);
        }

        await user.save();
        
        res.json({ message: 'Cheat scores injected successfully', user });
    } catch (error) {
        console.error('Error injecting cheat scores:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;

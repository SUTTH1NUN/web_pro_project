const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/tests/chatbot/interact
router.post('/chatbot/interact', (req, res) => {
    const { message, sessionId } = req.body;

    res.json({
        reply: `You said: "${message}". I am the Node.js chatbot, this is a mock reply.`,
        assessmentUpdate: {
            fluency: 'Good',
            grammarIssues: []
        }
    });
});

// GET /api/tests/quiz
router.get('/quiz', (req, res) => {
    const mockQuestions = [
        {
            id: 'q1',
            question: 'Which of the following is correct?',
            options: ['He go to school', 'He goes to school', 'He going to school', 'He gone to school']
        }
    ];
    res.json(mockQuestions);
});

const { protect } = require('../middleware/auth');
const User = require('../models/User');

// POST /api/tests/quiz/submit
router.post('/quiz/submit', protect, async (req, res) => {
    try {
        const { answers, testType } = req.body;
        const safeAnswers = answers || {};
        
        let correctAnswers = 0;
        let totalQuestions = 0;

        if (testType === 'reading') {
            totalQuestions = 2;
            if (safeAnswers.q1 === 'B') correctAnswers++; // "He goes to school every day."
            if (safeAnswers.q2 === 'B') correctAnswers++; // "its"
        } else if (testType === 'listening') {
            totalQuestions = 2;
            if (safeAnswers.l1 === 'B') correctAnswers++; // Example answer
            if (safeAnswers.l2 === 'A') correctAnswers++; // Example answer
        }

        // Calculate a score out of 10
        let score = 0;
        if (totalQuestions > 0) {
            score = (correctAnswers / totalQuestions) * 10;
        }

        // Save to user profile
        const user = await User.findById(req.user._id);
        if (user) {
            if (!user.webStats) {
                user.webStats = { listening: 0, speaking: 0, reading: 0, writing: 0, overallScore: 0 };
            }
            
            if (testType === 'reading') user.webStats.reading = score;
            if (testType === 'listening') user.webStats.listening = score;
            if (testType === 'writing') user.webStats.writing = score;
            if (testType === 'speaking') user.webStats.speaking = score;

            // Recalculate overall score
            const ws = user.webStats;
            let activeSkills = 0;
            let sumScore = 0;
            ['listening', 'speaking', 'reading', 'writing'].forEach(skill => {
                if (ws[skill] > 0) {
                    sumScore += ws[skill];
                    activeSkills++;
                }
            });
            ws.overallScore = activeSkills > 0 ? (sumScore / activeSkills) : 0;
            
            // Explicitly mark as modified to ensure Mongoose saves nested objects correctly
            user.markModified('webStats');
            await user.save();
        }

        res.json({
            message: 'Quiz graded successfully',
            score: score,
            totalQuestions
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/tests/speaking/submit
router.post('/speaking/submit', upload.single('audioFile'), (req, res) => {
    const audioFile = req.file;

    if (!audioFile) {
        return res.status(400).json({ error: 'No audio file provided' });
    }

    res.json({
        message: 'Speaking test submitted for evaluation',
        status: 'processing'
    });
});

module.exports = router;

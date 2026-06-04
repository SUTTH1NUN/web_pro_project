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

// POST /api/tests/quiz/submit
router.post('/quiz/submit', (req, res) => {
    const { answers } = req.body;

    res.json({
        message: 'Quiz graded successfully',
        score: 85,
        totalQuestions: answers ? answers.length : 0
    });
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

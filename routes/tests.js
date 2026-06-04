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

const mongoose = require('mongoose');
const Question = require('../models/Question');
const TestResult = require('../models/TestResult');

// Helper to get CEFR level from score (0-10)
function getCefrFromScore(score) {
    if (score < 2.0) return 'A1';
    if (score < 4.0) return 'A2';
    if (score < 6.0) return 'B1';
    if (score < 8.0) return 'B2';
    if (score < 9.6) return 'C1';
    return 'C2';
}

// POST /api/tests/adaptive/next
router.post('/adaptive/next', protect, async (req, res) => {
    try {
        const { testType = 'reading', currentScore = 0, seenQuestionIds = [] } = req.body;
        
        const cefrLevel = getCefrFromScore(currentScore);
        
        // Map testType to Question schema type
        let questionTypes = ['Short Comprehension', 'Cloze Test']; // Mix both by default
        if (testType === 'reading_cloze') {
            questionTypes = ['Cloze Test'];
        } else if (testType === 'reading_short') {
            questionTypes = ['Short Comprehension'];
        }
        
        // Find a random question matching the CEFR level that hasn't been seen
        const questions = await Question.aggregate([
            { $match: { 
                cefrLevel: cefrLevel, 
                type: { $in: questionTypes },
                _id: { $nin: seenQuestionIds.map(id => new mongoose.Types.ObjectId(id)) } 
            }},
            { $sample: { size: 1 } }
        ]);

        if (!questions || questions.length === 0) {
            return res.status(404).json({ message: 'No more questions available for this level.' });
        }

        const questionDoc = questions[0];
        
        // Strip out the correct answer before sending to frontend
        const safeQuestions = questionDoc.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options
        }));

        res.json({
            questionId: questionDoc._id,
            cefrLevel: questionDoc.cefrLevel,
            article: questionDoc.article,
            questions: safeQuestions
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/tests/adaptive/submit
router.post('/adaptive/submit', protect, async (req, res) => {
    try {
        const { questionId, subQuestionId, userAnswer, currentScore, step } = req.body;
        
        const questionDoc = await Question.findById(questionId);
        if (!questionDoc) {
            return res.status(404).json({ error: 'Question not found' });
        }

        let isCorrect = false;
        let correctAnswer = null;
        
        // Find the specific sub-question
        const subQ = subQuestionId ? 
            questionDoc.questions.find(q => q._id.toString() === subQuestionId) : 
            questionDoc.questions[0];

        if (subQ) {
            correctAnswer = subQ.answer;
            isCorrect = (userAnswer === correctAnswer);
        }

        // Calculate Step Size based on step (1 to 10)
        let stepSize = 1.0;
        if (step <= 3) stepSize = 2.0;
        else if (step <= 6) stepSize = 1.0;
        else stepSize = 0.5;

        let newScore = currentScore;
        if (isCorrect) {
            newScore = Math.min(10, currentScore + stepSize);
        } else {
            newScore = Math.max(0, currentScore - (stepSize / 2));
        }

        res.json({
            isCorrect,
            correctAnswer,
            newScore,
            previousScore: currentScore,
            cefrLevel: getCefrFromScore(newScore)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/tests/adaptive/finish
router.post('/adaptive/finish', protect, async (req, res) => {
    try {
        const { testType, finalScore, details } = req.body;

        // Save to TestResult
        await TestResult.create({
            userId: req.user._id,
            moduleType: 'quiz',
            score: finalScore,
            details: {
                testType,
                ...details
            }
        });

        // Update User Profile
        const user = await User.findById(req.user._id);
        if (user) {
            if (!user.webStats) {
                user.webStats = { listening: 0, speaking: 0, reading: 0, writing: 0, overallScore: 0 };
            }
            
            // Map testType to webStats field if matches
            if (['reading', 'listening', 'writing', 'speaking'].includes(testType)) {
                user.webStats[testType] = finalScore;
            }

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
            
            user.markModified('webStats');
            await user.save();
        }

        res.json({
            message: 'Adaptive test completed and saved',
            finalScore,
            cefrLevel: getCefrFromScore(finalScore)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;

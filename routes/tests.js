const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require("@google/generative-ai");

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

// GET /api/tests/writing/scenario
router.get('/writing/scenario', async (req, res) => {
    try {
        const count = await Question.countDocuments({ type: 'Writing Prompt' });
        if (count === 0) {
            return res.json({ prompt: "You are a project manager. Write a professional email to your client apologizing for a 2-day delay in delivering the final report. Ensure you maintain a polite and professional tone." });
        }
        
        const random = Math.floor(Math.random() * count);
        const randomQuestion = await Question.findOne({ type: 'Writing Prompt' }).skip(random);
        
        res.json({ prompt: randomQuestion.article, cefrLevel: randomQuestion.cefrLevel });
    } catch (err) {
        console.error("Error fetching writing scenarios from DB:", err);
        res.json({ prompt: "You are a project manager. Write a professional email to your client apologizing for a 2-day delay in delivering the final report. Ensure you maintain a polite and professional tone." });
    }
});

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
        } else if (testType === 'listening') {
            questionTypes = ['Listening Comprehension'];
        }

        // Find a random question matching the CEFR level that hasn't been seen
        const questions = await Question.aggregate([
            {
                $match: {
                    cefrLevel: cefrLevel,
                    type: { $in: questionTypes },
                    _id: { $nin: seenQuestionIds.map(id => new mongoose.Types.ObjectId(id)) }
                }
            },
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
            correctAnswer = subQ.answer || subQ.correctAnswer;
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

// POST /api/tests/writing/submit
router.post('/writing/submit', protect, async (req, res) => {
    try {
        const { text, prompt } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        let score = 0;
        let cefrLevel = 'A1';
        let feedback = 'No feedback available.';

        let usedMock = false;
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

                const aiPrompt = `You are an expert IELTS/TOEFL English examiner. 
The student was given this writing prompt: "${prompt}"

Here is the student's response:
"""
${text}
"""

Please evaluate their writing based on:
1. Task Achievement (Did they answer the prompt fully and accurately?)
2. Grammar and Vocabulary (Are there grammatical errors? Is the vocabulary appropriate?)

Provide a fair score out of 10. If they followed the prompt well and have minimal errors, give them a high score (8-10). If they completely ignored the prompt, give them a low score.

Return your evaluation STRICTLY as a JSON object with the following structure (do not include markdown formatting or backticks):
{
  "score": <number 0-10, up to 1 decimal place>,
  "cefrLevel": "<A1, A2, B1, B2, C1, or C2 based on their writing skill>",
  "feedback": "<A brief 2-3 sentence feedback written in Thai language. Explain why they got this score, highlight what they did well, and point out any major mistakes.>"
}`;

                const result = await model.generateContent(aiPrompt);
                const responseText = result.response.text().trim().replace(/```json/gi, '').replace(/```/g, '');
                const parsed = JSON.parse(responseText);
                score = parsed.score;
                cefrLevel = parsed.cefrLevel;
                feedback = parsed.feedback;
            } catch (apiErr) {
                console.error("Gemini API Error, falling back to mock:", apiErr.message);
                usedMock = true;
            }
        } else {
            usedMock = true;
        }

        if (usedMock) {
            // Fallback mock
            const wordCount = text.split(/\s+/).length;
            score = Math.min(10, wordCount / 5);
            cefrLevel = getCefrFromScore(score);
            feedback = "ประเมินงานเขียนจากความยาวของเนื้อหาเนื่องจากระบบ AI ขัดข้องชั่วคราว หรือตั้งค่า API Key ไม่ถูกต้อง";
        }

        // Save to TestResult
        await TestResult.create({
            userId: req.user._id,
            moduleType: 'writing',
            score: score,
            details: {
                testType: 'writing',
                prompt,
                submittedText: text,
                feedback,
                cefrLevel
            }
        });

        // Update User Profile
        const user = await User.findById(req.user._id);
        if (user) {
            if (!user.webStats) {
                user.webStats = { listening: 0, speaking: 0, reading: 0, writing: 0, overallScore: 0 };
            }

            user.webStats.writing = score;

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
            message: 'Writing evaluated successfully',
            score,
            cefrLevel,
            feedback
        });
    } catch (err) {
        console.error("Writing submit error:", err);
        res.status(500).json({ error: 'Server Error during evaluation' });
    }
});

// --- SPEAKING TEST ROUTES ---

router.get('/seed-speaking', async (req, res) => {
    try {
        const speakingPrompts = [
            "Describe a memorable vacation you took. Where did you go, who did you go with, and why was it special?",
            "Do you think social media brings people closer together or pushes them further apart? Explain your reasoning.",
            "Talk about a person who has had a significant influence on your life. What qualities do you admire about them?",
            "If you could have dinner with any historical figure, who would it be and what would you ask them?",
            "What are the main advantages and disadvantages of studying abroad? Provide examples from your own experience or knowledge.",
            "Describe your favorite hobby or leisure activity. How did you start doing it, and why do you enjoy it so much?",
            "In your opinion, what is the most pressing environmental issue today? How can individuals help solve this problem?",
            "Some people prefer to plan their activities in their free time very carefully. Others prefer not to make any plans. Which do you prefer and why?",
            "Describe a challenging situation you faced at work or school. How did you overcome it, and what did you learn?",
            "If you had an unlimited budget to start a business, what kind of business would it be and why?"
        ];
        await Question.deleteMany({ type: 'Speaking Prompt' });
        const docs = speakingPrompts.map(prompt => ({
            type: 'Speaking Prompt',
            cefrLevel: 'B2',
            article: prompt,
            questions: [],
            sourceDataset: 'Generated Speaking Prompts'
        }));
        await Question.insertMany(docs);
        res.json({ message: "Seeded speaking prompts successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tests/speaking/scenario
router.get('/speaking/scenario', async (req, res) => {
    try {
        const count = await Question.countDocuments({ type: 'Speaking Prompt' });
        if (count === 0) {
            return res.json({ prompt: "Please describe a memorable vacation you took." });
        }
        const random = Math.floor(Math.random() * count);
        const scenario = await Question.findOne({ type: 'Speaking Prompt' }).skip(random);
        res.json({ prompt: scenario.article });
    } catch (err) {
        console.error('Error fetching speaking scenario:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// POST /api/tests/speaking/submit
router.post('/speaking/submit', protect, upload.single('audio'), async (req, res) => {
    try {
        const file = req.file ? req.file : null;
        if (!file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }
        const prompt = req.body.prompt;
        
        let score = 0;
        let cefrLevel = 'A1';
        let feedback = 'No feedback available.';
        let transcription = '';

        let usedMock = false;
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

                const audioPart = {
                    inlineData: {
                        data: file.buffer.toString("base64"),
                        mimeType: file.mimetype || "audio/webm"
                    }
                };

                const aiPrompt = `You are an expert IELTS/TOEFL English examiner.
The student was asked to speak about this prompt: "${prompt}"

I have provided their spoken audio. Please transcribe what they said, and then evaluate their speaking based on:
1. Pronunciation & Fluency
2. Task Achievement (Relevance to prompt)
3. Grammar & Vocabulary

Provide a fair score out of 10.
CRITICAL INSTRUCTION: You MUST write the "feedback" field entirely in THAI language (ภาษาไทย). Explain the score, what they did well, and major mistakes.

Return your evaluation STRICTLY as a JSON object with the following structure (do not include markdown formatting or backticks):
{
  "transcription": "<The exact text of what they said in English>",
  "score": <number 0-10, up to 1 decimal place>,
  "cefrLevel": "<A1, A2, B1, B2, C1, or C2 based on their speaking skill>",
  "feedback": "<Feedback written entirely in THAI (ภาษาไทย)>"
}`;

                const result = await model.generateContent([aiPrompt, audioPart]);
                const responseText = result.response.text().trim().replace(/```json/gi, '').replace(/```/g, '');
                const parsed = JSON.parse(responseText);
                score = parsed.score;
                cefrLevel = parsed.cefrLevel;
                feedback = parsed.feedback;
                transcription = parsed.transcription;
            } catch (apiErr) {
                console.error("Gemini API Error (Speaking):", apiErr.message);
                usedMock = true;
            }
        } else {
            usedMock = true;
        }

        if (usedMock) {
            score = 5.0;
            cefrLevel = 'B1';
            feedback = 'ไม่สามารถประเมินเสียงได้ในขณะนี้เนื่องจากระบบ AI ขัดข้อง';
            transcription = '[Audio evaluation unavailable]';
        }

        // Save to TestResult
        await TestResult.create({
            userId: req.user._id,
            moduleType: 'speaking',
            score: score,
            details: {
                testType: 'speaking',
                prompt,
                transcription,
                feedback,
                cefrLevel
            }
        });

        // Update User Profile
        const user = await User.findById(req.user._id);
        if (user) {
            if (!user.webStats) {
                user.webStats = { listening: 0, speaking: 0, reading: 0, writing: 0, overallScore: 0 };
            }
            user.webStats.speaking = score;

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
            message: 'Speaking evaluated successfully',
            score,
            cefrLevel,
            transcription,
            feedback
        });
    } catch (err) {
        console.error("Speaking submit error:", err);
        res.status(500).json({ error: 'Server Error during evaluation' });
    }
});

module.exports = router;

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Question = require('./models/Question');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skill_wallet';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function determineCefrLevel(promptText) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const aiPrompt = `Analyze the following English writing test prompt and determine its CEFR level (A1, A2, B1, B2, C1, C2) based on the vocabulary, complexity, and required writing skills. 
        Return ONLY the 2-character CEFR level string, nothing else.
        Prompt: "${promptText}"`;

        const result = await model.generateContent(aiPrompt);
        let level = result.response.text().trim();
        
        // Clean up any extra characters just in case
        const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
        level = level.substring(0, 2).toUpperCase();
        if (!validLevels.includes(level)) {
            console.warn(`Unexpected level "${level}" returned for prompt. Defaulting to B2.`);
            return 'B2';
        }
        return level;
    } catch (err) {
        console.error("Error evaluating CEFR level with Gemini:", err);
        return 'B2'; // Fallback
    }
}

async function seedWritingPrompts() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to DB.');

        const filePath = path.join(__dirname, 'writting_listening.json');
        const data = fs.readFileSync(filePath, 'utf8');
        const scenarios = JSON.parse(data);

        console.log(`Found ${scenarios.length} scenarios. Beginning evaluation and insertion...`);
        let count = 0;

        for (const scenario of scenarios) {
            // Check if it already exists to prevent duplicates
            const existing = await Question.findOne({ article: scenario, type: 'Writing Prompt' });
            if (existing) {
                console.log(`Scenario already exists, skipping...`);
                continue;
            }

            console.log(`Evaluating scenario ${count + 1}/${scenarios.length}...`);
            const level = await determineCefrLevel(scenario);
            
            const newQuestion = new Question({
                type: 'Writing Prompt',
                cefrLevel: level,
                article: scenario,
                sourceDataset: 'writting_listening.json'
            });

            await newQuestion.save();
            console.log(`Saved scenario with label [${level}].`);
            count++;
            
            // Brief pause to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`Successfully seeded ${count} new writing prompts.`);
    } catch (err) {
        console.error('Seeding error:', err);
    } finally {
        mongoose.connection.close();
        console.log('Database connection closed.');
    }
}

seedWritingPrompts();

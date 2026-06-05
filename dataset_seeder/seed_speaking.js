const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Question = require('./models/Question');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skill_wallet';

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

async function seedSpeaking() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Delete existing Speaking Prompts
        await Question.deleteMany({ type: 'Speaking Prompt' });
        console.log('Cleared existing Speaking Prompts');

        const docs = speakingPrompts.map(prompt => ({
            type: 'Speaking Prompt',
            cefrLevel: 'B2', // Default assignment, could be varied
            article: prompt,
            questions: [],
            sourceDataset: 'Generated Speaking Prompts'
        }));

        await Question.insertMany(docs);
        console.log(`Successfully seeded ${docs.length} speaking prompts.`);

        mongoose.connection.close();
    } catch (error) {
        console.error('Seeding error:', error);
        mongoose.connection.close();
        process.exit(1);
    }
}

seedSpeaking();

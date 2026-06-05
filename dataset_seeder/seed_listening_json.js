const fs = require('fs');
const mongoose = require('mongoose');
const Question = require('./models/Question');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function seedListeningFromJson() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skill_wallet');
    console.log("Connected to MongoDB");

    try {
        const path = require('path');
        const filePath = path.join(__dirname, 'listening_data.json');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Extract blocks of JSON array using a regular expression
        // It looks for /* LEVEL */ followed by an array [...]
        const regex = /\/\*(A1|A2|B1|B2|C1|C2)\*\/\s*(\[[\s\S]*?\])(?=\s*\/\*|$)/g;
        
        let match;
        let totalQuestions = 0;

        while ((match = regex.exec(fileContent)) !== null) {
            const level = match[1];
            const jsonArrayStr = match[2];
            
            try {
                const questionsArray = JSON.parse(jsonArrayStr);
                console.log(`Parsed ${questionsArray.length} questions for level ${level}`);
                
                for (const q of questionsArray) {
                    await Question.create({
                        type: 'Listening Comprehension',
                        cefrLevel: level,
                        article: q.article,
                        questions: [{
                            question: q.question,
                            options: q.options,
                            answer: q.answer
                        }],
                        sourceDataset: 'Custom_AI_Gen'
                    });
                    totalQuestions++;
                }
                console.log(`✅ Saved questions for ${level}`);
            } catch (parseErr) {
                console.error(`Error parsing JSON for level ${level}:`, parseErr.message);
            }
        }

        console.log(`🎉 Seeding complete! Total questions inserted: ${totalQuestions}`);
    } catch (e) {
        console.error("Error reading or processing file:", e);
    } finally {
        process.exit(0);
    }
}

seedListeningFromJson();

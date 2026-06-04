require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModels() {
    try {
        const models = ['gemini-1.5-flash-latest', 'gemini-flash-latest', 'gemini-1.0-pro'];
        
        for (const m of models) {
            console.log(`Testing ${m}...`);
            try {
                const model = genAI.getGenerativeModel({ model: m });
                const res = await model.generateContent("Hello");
                console.log(`✅ ${m} WORKS: ${res.response.text().substring(0, 30)}`);
            } catch (err) {
                console.error(`❌ ${m} FAILED: ${err.message}`);
            }
        }
    } catch (e) {
        console.error("Fatal:", e);
    }
}

testModels();

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const Question = require('./models/Question');

// ตั้งค่าจำนวนข้อที่ต้องการต่อระดับ (CEFR)
const TARGET_PER_LEVEL = 10;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// ตัวแปรสำหรับนับจำนวนที่ดึงมาได้แล้ว
const counters = {
    'Short Comprehension': { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
    'Cloze Test': { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 }
};

// ใช้โมเดล Zero-Shot Classifier จาก Hugging Face แทนเนื่องจากโมเดลเดิมไม่รองรับ API ฟรี
const CLASSIFIER_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli";

// ฟังก์ชันสำหรับเรียก AI ประเมินระดับ CEFR
async function getCEFRLevel(text) {
    try {
        const response = await axios.post(
            CLASSIFIER_URL,
            { 
                inputs: text.substring(0, 1000), // ตัดแค่ 1000 ตัวอักษรแรกส่งไปประเมินเพื่อลดโหลด
                parameters: { candidate_labels: LEVELS }
            },
            {
                headers: { 
                    Authorization: `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );
        
        // รองรับรูปแบบข้อมูลหลายแบบจาก Hugging Face
        let label = null;
        if (response.data && Array.isArray(response.data)) {
            if (response.data[0] && response.data[0].label) {
                label = response.data[0].label;
            } else if (Array.isArray(response.data[0]) && response.data[0][0]) {
                label = response.data[0][0].label;
            }
        } else if (response.data && response.data.labels) {
            label = response.data.labels[0];
        }

        return LEVELS.includes(label) ? label : null;
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.log("⚠️ API Rate Limit Hit, waiting 10 seconds...");
            await new Promise(resolve => setTimeout(resolve, 10000));
            return getCEFRLevel(text); // ลองใหม่
        }
        if (error.response && error.response.status === 503) {
            console.log("⏳ Model is loading (Cold Start), waiting 20 seconds...");
            await new Promise(resolve => setTimeout(resolve, 20000));
            return getCEFRLevel(text);
        }
        console.error("Error classifying CEFR:", error.message);
        return null;
    }
}

// ตรวจสอบว่าประเภทนี้ (RACE หรือ CLOTH) โหลดครบ 60 ข้อหรือยัง
function isTypeComplete(type) {
    return LEVELS.every(level => counters[type][level] >= TARGET_PER_LEVEL);
}

// โหลดข้อสอบ RACE (Short Comprehension)
async function seedRace() {
    let offset = 0;
    const type = 'Short Comprehension';
    console.log(`\n📚 Starting to load ${type}...`);

    while (!isTypeComplete(type)) {
        try {
            const res = await axios.get(`https://datasets-server.huggingface.co/rows?dataset=ehovy/race&config=high&split=train&offset=${offset}&length=50`);
            const rows = res.data.rows;
            if (rows.length === 0) break;

            for (let item of rows) {
                if (isTypeComplete(type)) break;

                const data = item.row;
                const cefr = await getCEFRLevel(data.article);
                
                if (cefr && counters[type][cefr] < TARGET_PER_LEVEL) {
                    await Question.create({
                        type: type,
                        cefrLevel: cefr,
                        article: data.article,
                        questions: [{
                            question: data.question,
                            options: data.options,
                            answer: data.answer
                        }],
                        sourceDataset: 'RACE'
                    });
                    counters[type][cefr]++;
                    console.log(`✅ [${type}] Retrieved level ${cefr} (Total: ${counters[type][cefr]}/${TARGET_PER_LEVEL})`);
                }
                // หน่วงเวลาเล็กน้อยกัน HF API แบน
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            offset += 50;
        } catch (err) {
            console.error("Error loading RACE:", err.message);
            break;
        }
    }
}

// โหลดข้อสอบ CLOTH (Cloze Test)
async function seedCloth() {
    let offset = 0;
    const type = 'Cloze Test';
    console.log(`\n📚 Starting to load ${type}...`);

    while (!isTypeComplete(type)) {
        try {
            const res = await axios.get(`https://datasets-server.huggingface.co/rows?dataset=AndyChiang/cloth&config=default&split=train&offset=${offset}&length=50`);
            const rows = res.data.rows;
            if (rows.length === 0) break;

            for (let item of rows) {
                if (isTypeComplete(type)) break;

                const data = item.row;
                const textForCefr = data.article || data.sentence || "";
                if (!textForCefr) continue;
                
                const cefr = await getCEFRLevel(textForCefr);
                
                if (cefr && counters[type][cefr] < TARGET_PER_LEVEL) {
                    // ปรับโครงสร้างคำถามสำหรับ Cloze
                    const questions = [{
                        question: "Fill in the [MASK]",
                        options: data.distractors ? [...data.distractors, data.answer] : [],
                        answer: data.answer
                    }];

                    await Question.create({
                        type: type,
                        cefrLevel: cefr,
                        article: data.sentence,
                        questions: questions,
                        sourceDataset: 'CLOTH'
                    });
                    counters[type][cefr]++;
                    console.log(`✅ [${type}] Retrieved level ${cefr} (Total: ${counters[type][cefr]}/${TARGET_PER_LEVEL})`);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            offset += 50;
        } catch (err) {
            console.error("Error loading CLOTH:", err.message);
            break;
        }
    }
}

async function main() {
    if (!process.env.HF_TOKEN) {
        console.error("❌ HF_TOKEN not found in .env file");
        console.error("Please create a Token from https://huggingface.co/settings/tokens and add it to your .env file");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skill_wallet');
        console.log("🚀 Connected to MongoDB successfully. Starting...");

        // await seedRace();
        await seedCloth();

        console.log("\n🎉 Success! Loaded all 120 questions (A1-C2).");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();

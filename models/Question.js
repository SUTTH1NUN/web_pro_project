const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['Short Comprehension', 'Cloze Test'], 
        required: true 
    },
    cefrLevel: { 
        type: String, 
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], 
        required: true 
    },
    article: { 
        type: String, 
        required: true 
    },
    // สำหรับเก็บคำถาม (RACE มักมีคำถามเดียวต่อ 1 แถว, ส่วน CLOTH มีหลายช้อยส์ต่อช่องว่าง)
    questions: [{
        question: String, // คำถาม (หรือข้อความบอกช่องว่าง)
        options: [String], // ตัวเลือก
        answer: String // เฉลยที่ถูกต้อง
    }],
    sourceDataset: String,
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Question', questionSchema);

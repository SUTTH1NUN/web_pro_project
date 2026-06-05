# 🎓 สรุปความเชื่อมโยงโปรเจกต์กับบทเรียน (Project & Coursework Mapping)

โปรเจกต์ **Skill Wallet** ถูกออกแบบและพัฒนาโดยใช้เทคโนโลยีที่สอดคล้องกับเนื้อหาในรายวิชา โดยสามารถแบ่งแยกตามสไลด์เลกเชอร์พร้อมตัวอย่างโค้ดที่ใช้จริงในโปรเจกต์ได้ดังนี้:

---

## 📘 Lecture 02 & 03: JSON API & gRPC
**เนื้อหาในบทเรียน:** การออกแบบ RESTful API และการสื่อสารด้วยรูปแบบ JSON
**การนำมาใช้ในโปรเจกต์:** ใช้สถาปัตยกรรม RESTful API 100% ในการรับส่งข้อมูลระหว่างหน้าเว็บกับเซิร์ฟเวอร์
**ตัวอย่างโค้ด:**

*การตั้งค่า Server ให้คุยด้วย JSON (`server.js`):*
```javascript
// บังคับให้แอปพลิเคชันรับ-ส่งข้อมูลทั้งหมดในรูปแบบ JSON
app.use(express.json());
```

*การสร้าง API ตอบกลับเป็น JSON (`routes/users.js`):*
```javascript
router.get('/me', protect, async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    // แปลง Object ให้กลายเป็น JSON string และส่งกลับไปให้ Client
    res.json({ user }); 
});
```

*การยิง API แบบ JSON จากหน้าเว็บ (`public/js/profile.js`):*
```javascript
const response = await fetch('/api/users/me', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
});
// รอรับผลลัพธ์ที่แปลงจาก JSON เป็น Javascript Object
const data = await response.json(); 
```

---

## 📘 Lecture 04: ORM (Object-Relational Mapping)
**เนื้อหาในบทเรียน:** การใช้โค้ดแบบ Object เพื่อจัดการฐานข้อมูลแทนการเขียน SQL/Query
**การนำมาใช้ในโปรเจกต์:** ใช้ **Mongoose (ODM)** ในการจัดการฐานข้อมูล MongoDB
**ตัวอย่างโค้ด:**

*การกำหนดโครงสร้าง (Schema) โดยไม่ต้องสร้างตารางเอง (`models/User.js`):*
```javascript
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }
});
const User = mongoose.model('User', userSchema);
```

*การทำงานกับฐานข้อมูลด้วย OOP แทน SQL Query (`routes/auth.js`):*
```javascript
// สร้างและบันทึกข้อมูล (เทียบเท่า INSERT INTO)
const user = await User.create({ username, email, password });

// ค้นหาข้อมูล (เทียบเท่า SELECT * FROM WHERE)
const existingUser = await User.findOne({ email: req.body.email });
```

---

## 📘 Lecture 05: Authentication
**เนื้อหาในบทเรียน:** ระบบยืนยันตัวตน, การเข้ารหัสผ่าน, และ Session/Token
**การนำมาใช้ในโปรเจกต์:** มีระบบ Authentication ครอบคลุมทั้ง JWT Token และ Google OAuth 2.0
**ตัวอย่างโค้ด:**

*การเข้ารหัสผ่านก่อนลงฐานข้อมูลด้วย Bcrypt (`models/User.js`):*
```javascript
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) next();
    const salt = await bcrypt.genSalt(10); // สร้าง Salt
    this.password = await bcrypt.hash(this.password, salt); // เข้ารหัสทางเดียว
});
```

*การสร้าง JWT Token สำหรับ Stateless Login (`routes/auth.js`):*
```javascript
const generateToken = (id) => {
    // เซ็นชื่อกำกับ Token ด้วย Secret Key ป้องกันการปลอมแปลง
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};
```

*การใช้ Middleware กรองคนเข้าใช้ API (`middleware/auth.js`):*
```javascript
const protect = async (req, res, next) => {
    // ดึง Token ออกมาจาก Header ของ Request
    let token = req.headers.authorization.split(' ')[1];
    // ยืนยันความถูกต้องของ Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next(); // ยอมจำนนให้ทำงานต่อไป
};
```

---

## 📘 Lecture 06: Javascript Concurrency & Network Foundations
**เนื้อหาในบทเรียน:** การทำงานแบบ Asynchronous, Promises, และการเชื่อมต่อเครือข่าย
**การนำมาใช้ในโปรเจกต์:** ใช้ Non-blocking I/O เพื่อไม่ให้เซิร์ฟเวอร์ค้างเมื่อทำงานหนักๆ เช่น ตอนค้นหาข้อมูลหรือติดต่อกับ AI
**ตัวอย่างโค้ด:**

*การใช้ async/await ในการรอผลลัพธ์แบบขนาน (`routes/tests.js`):*
```javascript
// ฟังก์ชันจะไม่หยุดทำงานทั้งหมดระหว่างที่รอฐานข้อมูล
router.get('/writing/scenario', async (req, res) => {
    try {
        const count = await Question.countDocuments({ type: 'Writing Prompt' });
        // รอข้อมูลจาก DB โดยไม่หยุดบล็อกการทำงานของผู้ใช้คนอื่นที่เข้าเว็บมาพร้อมกัน
        const randomQuestion = await Question.findOne({ type: 'Writing Prompt' }).skip(random);
        res.json({ prompt: randomQuestion.article });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});
```

---

## 📘 Lecture 07: Web Workers
**เนื้อหาในบทเรียน:** การประมวลผลเบื้องหลัง (Background Thread) โดยไม่รบกวน Main Thread ของหน้าเว็บ
**การนำมาใช้ในโปรเจกต์:** ใช้สร้าง "ระบบจับเวลาทำข้อสอบ" เพื่อป้องกันเวลาเดินเพี้ยนเวลาผู้ใช้พับหน้าจอเว็บทิ้งไว้
**ตัวอย่างโค้ด:**

*ไฟล์เบื้องหน้า (Main Thread) สั่งเริ่มงาน:*
```javascript
// หน้าเว็บหลัก
const timerWorker = new Worker('js/timer-worker.js');

// สั่ง Worker ให้เริ่มจับเวลา
timerWorker.postMessage({ action: 'start', duration: 3600 }); 

// คอยรับสัญญาณจาก Worker เพื่อมาอัปเดตหน้าจอโดยที่หน้าจอไม่ค้าง
timerWorker.onmessage = function(e) {
    if (e.data.action === 'tick') {
        document.getElementById('timer').innerText = e.data.timeRemaining;
    }
};
```

*ไฟล์เบื้องหลัง (Background Thread / Worker) ทำงานหนักแทน:*
```javascript
// js/timer-worker.js
self.onmessage = function(e) {
    if (e.data.action === 'start') {
        let time = e.data.duration;
        setInterval(() => {
            time--;
            // โยนผลลัพธ์กลับไปให้หน้าเว็บหลักแสดงผล
            self.postMessage({ action: 'tick', timeRemaining: time });
        }, 1000);
    }
};
```

---

## 📘 Lecture 08 & 09: Security & Testing
**เนื้อหาในบทเรียน:** ความปลอดภัยของเว็บแอปพลิเคชันและการทดสอบระบบ
**การนำมาใช้ในโปรเจกต์:**
**ตัวอย่างโค้ด:**

*Security: การแยกความลับออกจาก Source Code (`server.js` และ `.env`):*
```javascript
// โค้ดจะอ่านค่าจาก Environment ของระบบแทนการเขียนรหัสผ่านลงในโค้ดโดยตรง
const JWT_SECRET = process.env.JWT_SECRET;
const DB_URL = process.env.MONGO_URI;
```

*Security: การจำกัดการเข้าถึงข้ามโดเมน CORS (`server.js`):*
```javascript
const cors = require('cors');
// ป้องกันไม่ให้เว็บอื่น (Domain อื่น) สามารถใช้ Ajax/Fetch มาดึงข้อมูลจาก API เราได้
app.use(cors({
    origin: 'http://localhost:3000' 
}));
```

*Testing: การรันสภาพแวดล้อมให้เหมือนกัน 100% ด้วย Docker (`Dockerfile`):*
```dockerfile
# ใช้ Docker จำลองคอมพิวเตอร์ขนาดเล็กสำหรับรันเทสต์ เพื่อตัดปัญหา "ทำไมรันในเครื่องผมได้แต่เครื่องเพื่อนไม่ได้"
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "node", "server.js" ]
```

---

> [!TIP] 
> **คำแนะนำสำหรับการนำเสนอ (Presentation):**
> โปรเจกต์นี้มีทีเด็ดครบทุกบทเลยครับ ตอนพรีเซนต์ให้เปิดโชว์ตัวอย่างโค้ดเหล่านี้ควบคู่ไปด้วย โดยเฉพาะเรื่อง **Web Worker จับเวลา (บท 7)**, **ระบบ Authentication แบบ JWT (บท 5)**, และการแปลงข้อมูลแบบรัดกุมผ่าน **Mongoose Schema (บท 4)** จะช่วยให้เห็นภาพการประยุกต์ใช้ความรู้ได้ชัดเจนมากครับ

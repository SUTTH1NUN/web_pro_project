const mongoose = require('mongoose');
const Question = require('./models/Question');
require('dotenv').config();

const TARGET_PER_LEVEL = 15;

const names = ['Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Fiona', 'George', 'Hannah', 'Ian', 'Julia', 'Kevin', 'Luna', 'Mike', 'Nina', 'Oscar'];
const places = ['New York', 'London', 'Paris', 'Tokyo', 'Sydney', 'Berlin', 'Rome', 'Toronto', 'Dubai', 'Singapore', 'Madrid', 'Seoul', 'Mumbai', 'Cairo', 'Moscow'];
const foods = ['pizza', 'sushi', 'tacos', 'pasta', 'burgers', 'curry', 'salad', 'steak', 'noodles', 'sandwiches', 'soup', 'pancakes', 'waffles', 'rice', 'chicken'];

function generateQuestions(level) {
    const qs = [];
    for (let i = 0; i < TARGET_PER_LEVEL; i++) {
        const n1 = names[i % names.length];
        const n2 = names[(i + 3) % names.length];
        const place = places[i % places.length];
        const food = foods[i % foods.length];

        let article, question, options, correctAnswer;

        if (level === 'A1') {
            article = `Hi, I am ${n1}. I live in ${place}. My favorite food is ${food}.`;
            question = `Where does ${n1} live?`;
            options = [place, 'London', 'Tokyo', 'Paris'];
            if (!options.includes(place)) options[0] = place;
            correctAnswer = place;
        } else if (level === 'A2') {
            article = `Excuse me, do you know where the train station is? Yes, ${n1}, just go straight past the ${food} restaurant and turn left towards ${place} Avenue.`;
            question = `What is next to the restaurant?`;
            options = ['The train station', 'A park', 'A school', 'A hospital'];
            correctAnswer = 'The train station';
        } else if (level === 'B1') {
            article = `Hey ${n2}, I was thinking of taking a vacation to ${place}. The ${food} there is supposed to be amazing, but I'm worried about the weather.`;
            question = `What is ${n1} worried about?`;
            options = ['The weather', 'The food', 'The flight cost', 'The hotel'];
            correctAnswer = 'The weather';
        } else if (level === 'B2') {
            article = `In today's meeting, ${n1} emphasized that our expansion into ${place} heavily relies on analyzing local consumption of ${food}. We must adjust our logistics accordingly.`;
            question = `What does the expansion rely on?`;
            options = ['Analyzing local consumption', 'Hiring new staff', 'Building new factories', 'Changing the company name'];
            correctAnswer = 'Analyzing local consumption';
        } else if (level === 'C1') {
            article = `The socioeconomic impact of globalization in metropolitan areas like ${place} has fundamentally altered traditional paradigms, particularly in the fusion of culinary arts such as ${food}.`;
            question = `What has globalization altered according to the passage?`;
            options = ['Traditional paradigms', 'Weather patterns', 'Political boundaries', 'Educational systems'];
            correctAnswer = 'Traditional paradigms';
        } else if (level === 'C2') {
            article = `Notwithstanding the empirical anomalies observed in the ${place} demographic, the epistemological framework surrounding the consumption of ${food} elucidates a profound dichotomy in modern consumer behavior.`;
            question = `What does the framework elucidate?`;
            options = ['A profound dichotomy', 'A simple solution', 'An economic crisis', 'A biological mutation'];
            correctAnswer = 'A profound dichotomy';
        }

        // Shuffle options and ensure correct answer is present
        options = [...new Set(options)];
        while (options.length < 4) { options.push(`Random Option ${options.length}`); }
        options = options.sort(() => Math.random() - 0.5);

        qs.push({ article, question, options, correctAnswer });
    }
    return qs;
}

async function seedListening() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skill_wallet');
    console.log("Connected to MongoDB");

    const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    for (const level of LEVELS) {
        const qs = generateQuestions(level);
        
        for (const q of qs) {
            await Question.create({
                type: 'Listening Comprehension',
                cefrLevel: level,
                article: q.article,
                questions: [{
                    question: q.question,
                    options: q.options,
                    answer: q.correctAnswer
                }],
                sourceDataset: 'Procedural'
            });
        }
        console.log(`✅ Saved ${qs.length} questions for ${level}`);
    }

    console.log("🎉 Seeding complete!");
    process.exit(0);
}

seedListening().catch(console.error);

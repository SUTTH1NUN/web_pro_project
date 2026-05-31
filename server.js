const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

// Frontend is now served by Nginx, so we don't serve static files here anymore

// API Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const evidenceRoutes = require('./routes/evidence');
const badgesRoutes = require('./routes/badges');
const testsRoutes = require('./routes/tests');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/tests', testsRoutes);



app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

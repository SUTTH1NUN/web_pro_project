const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_12345';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Generate JWT Helper
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to temporary OTP collection (upsert replaces if already exists)
        await Otp.findOneAndUpdate(
            { email },
            { code: otp, createdAt: new Date() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Send OTP via email/console
        await sendOtpEmail(email, otp);

        res.json({ message: 'OTP sent successfully' });
    } catch (err) {
        console.error('Error in send-otp:', err);
        res.status(500).json({ error: 'Server Error during sending OTP' });
    }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, otpCode } = req.body;

        if (!otpCode) {
            return res.status(400).json({ error: 'OTP code is required' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Verify OTP
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.code !== otpCode) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Create the user since OTP matches
        const user = await User.create({ username, email, password, firstName, lastName });
        
        // Delete the used OTP
        await Otp.deleteOne({ email });

        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
        });
    } catch (err) {
        console.error('Error during signup:', err);
        res.status(500).json({ error: 'Server Error during signup' });
    }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Server Error during signin' });
    }
});

// GET /api/auth/google-client-id
router.get('/google-client-id', (req, res) => {
    res.json({ clientId: GOOGLE_CLIENT_ID });
});

// POST /api/auth/google-login
router.post('/google-login', async (req, res) => {
    try {
        const { idToken } = req.body;
        
        // Skip actual verification if it's a mock token for testing purposes
        let email, name, googleId;
        
        if (idToken === 'mock_google_token_123') {
            email = 'mockuser@gmail.com';
            name = 'Mock User';
            googleId = 'google_123';
        } else {
            // Verify real Google Token
            const ticket = await googleClient.verifyIdToken({
                idToken: idToken,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            email = payload.email;
            name = payload.name;
            googleId = payload.sub;
        }

        // Check if user already exists
        let user = await User.findOne({ email });

        if (user) {
            // Existing user, just return token
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
        } else {
            // New user, create them without a password
            user = await User.create({
                username: name,
                email: email,
                googleId: googleId,
                role: idToken === 'mock_google_token_123' ? 'admin' : 'user', // Auto-admin for testing
                password: '' // No password for OAuth users
            });
        }

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            token: generateToken(user._id)
        });

    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Invalid Google Token' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate a simple token (In production, use crypto.randomBytes)
        const resetToken = Math.random().toString(36).substring(2, 15);
        
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // In a real app, send an email with nodemailer here.
        // We'll mock it for now.
        console.log(`[Email Service] Reset Password Link: http://localhost:3001/reset-password?token=${resetToken}`);

        res.json({ message: 'Password reset link sent to email' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error during forgot password' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save(); // Bcrypt pre-save will hash the new password

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        res.status(500).json({ error: 'Server Error during reset password' });
    }
});

module.exports = router;

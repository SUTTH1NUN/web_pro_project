const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpEmail, sendResetOtpEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not defined in environment variables!');
    process.exit(1);
}
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

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
            role: user.role,
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
                role: user.role,
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
        if (!googleClient || !GOOGLE_CLIENT_ID) {
            return res.status(503).json({ error: 'Google Login is not configured on this server' });
        }

        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }

        // Verify real Google Token
        const ticket = await googleClient.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const googleId = payload.sub;

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
                role: 'user',
                password: ''
            });
        }

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
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
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate a 6-digit OTP code for password reset
        const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.resetPasswordToken = resetOtp;
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        // Send OTP email
        await sendResetOtpEmail(email, resetOtp);

        res.json({ message: 'OTP sent to your email' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Server Error during forgot password' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otpCode, newPassword } = req.body;
        if (!email || !otpCode || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        const user = await User.findOne({
            email,
            resetPasswordToken: otpCode,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired OTP code' });
        }

        // Update user password and clear reset tokens
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save(); // Bcrypt pre-save handles hashing the new password

        res.json({ message: 'Password reset successful' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Server Error during reset password' });
    }
});

module.exports = router;

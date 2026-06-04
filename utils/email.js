const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
let resend = null;

if (RESEND_API_KEY) {
    resend = new Resend(RESEND_API_KEY);
}

const sendOtpEmail = async (email, otp) => {
    if (resend) {
        try {
            await resend.emails.send({
                from: 'onboarding@resend.dev', // Default testing domain by Resend
                to: email,
                subject: 'Zentry Verification - OTP Code',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Welcome to Zentry!</h2>
                        <p>You're almost there. Please use the following One-Time Password (OTP) to complete your registration:</p>
                        <div style="font-size: 24px; font-weight: bold; background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0; color: #4f46e5; letter-spacing: 2px;">
                            ${otp}
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you did not request this, please ignore this email.</p>
                    </div>
                `
            });
            console.log(`[Email Service] OTP email successfully sent to ${email} via Resend`);
        } catch (error) {
            console.error('[Email Service] Resend error:', error);
            // Fallback to console log on error so developer knows the code
            console.log(`\n==================================================`);
            console.log(`[Email Service] (Resend Error Fallback)`);
            console.log(`[Email Service] OTP for ${email}: ${otp}`);
            console.log(`==================================================\n`);
        }
    } else {
        console.log(`\n==================================================`);
        console.log(`[Email Service] (Resend API Key Not Set in .env)`);
        console.log(`[Email Service] OTP for ${email}: ${otp}`);
        console.log(`==================================================\n`);
    }
};

const sendResetOtpEmail = async (email, otp) => {
    if (resend) {
        try {
            await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: email,
                subject: 'Zentry - Reset Password OTP',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Password Reset Request</h2>
                        <p>We received a request to reset your password. Please use the following One-Time Password (OTP) to complete the reset:</p>
                        <div style="font-size: 24px; font-weight: bold; background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0; color: #ef4444; letter-spacing: 2px;">
                            ${otp}
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you did not request this, you can safely ignore this email.</p>
                    </div>
                `
            });
            console.log(`[Email Service] Reset OTP successfully sent to ${email} via Resend`);
        } catch (error) {
            console.error('[Email Service] Resend reset error:', error);
            console.log(`\n==================================================`);
            console.log(`[Email Service] (Resend Error Fallback)`);
            console.log(`[Email Service] Reset OTP for ${email}: ${otp}`);
            console.log(`==================================================\n`);
        }
    } else {
        console.log(`\n==================================================`);
        console.log(`[Email Service] (Resend API Key Not Set in .env)`);
        console.log(`[Email Service] Reset OTP for ${email}: ${otp}`);
        console.log(`==================================================\n`);
    }
};

module.exports = { sendOtpEmail, sendResetOtpEmail };

const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

let transporter = null;

if (EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    });
}

const sendOtpEmail = async (email, otp) => {
    if (transporter) {
        const mailOptions = {
            from: `"Zentry Verification" <${EMAIL_USER}>`,
            to: email,
            subject: 'Zentry Verification - OTP Code',
            text: `Your OTP for registration is: ${otp}. It will expire in 10 minutes.`,
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
        };
        await transporter.sendMail(mailOptions);
        console.log(`[Email Service] OTP email successfully sent to ${email}`);
    } else {
        console.log(`\n==================================================`);
        console.log(`[Email Service] (SMTP Credentials Not Set in .env)`);
        console.log(`[Email Service] OTP for ${email}: ${otp}`);
        console.log(`==================================================\n`);
    }
};

module.exports = { sendOtpEmail };

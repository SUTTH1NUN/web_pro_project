const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
// It will throw if GEMINI_API_KEY is not set, so we use a fallback or check
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

async function extractCertificateData(fileBuffer, mimeType, testType) {
    if (!apiKey) {
        console.warn("GEMINI_API_KEY is not set. Returning mock data.");
        return { fullName: "John Doe (Mock)", testDate: "2024-01-01", verificationCode: "MOCK12345", score: "8.5" };
    }

    try {
        // Determine the model to use
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        // Prepare the part for the model
        const filePart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType
            },
        };

        const prompt = `You are an AI assistant that extracts data from language proficiency certificates.
This is a ${testType} certificate.
Please extract the following information and return ONLY a valid JSON object:
{
    "fullName": "The full name of the test taker as written on the certificate",
    "testDate": "The date the test was taken (format: YYYY-MM-DD)",
    "verificationCode": "The verification code, candidate number, or TRF number on the certificate",
    "score": "The total or overall score/band on the certificate as a string or number"
}
If a field is not found, set its value to null. DO NOT wrap the output in markdown, just output raw JSON.`;

        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();
        
        // Parse the JSON. The response might have markdown code block wrappers.
        let jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse Gemini response or API error:", e);
        return { fullName: null, testDate: null, verificationCode: null, score: null };
    }
}

module.exports = {
    extractCertificateData
};

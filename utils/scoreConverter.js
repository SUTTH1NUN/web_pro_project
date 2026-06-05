/**
 * Converts raw test scores into a standardized 0.0 - 10.0 scale.
 */
function convertTo10PointScale(rawScores, testType) {
    const standardized = {
        speaking: 0,
        listening: 0,
        reading: 0,
        writing: 0
    };

    const type = (testType || "").toUpperCase();

    // Helper to safely parse numbers
    const parse = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    const rSpk = parse(rawScores.rawSpeaking);
    const rLis = parse(rawScores.rawListening);
    const rRdn = parse(rawScores.rawReading);
    const rWrt = parse(rawScores.rawWriting);

    switch (type) {
        case 'TOEIC':
            // TOEIC Listening and Reading are max 495 each.
            // TOEIC Speaking and Writing are max 200 each.
            standardized.speaking = rSpk > 0 ? (rSpk / 200) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 495) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 495) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 200) * 10 : 0;
            break;
            
        case 'IELTS':
            // IELTS is already on a 0-9.0 band scale. We can map it directly or scale to 10.
            // Let's scale 9.0 to 10.0. (Score / 9.0 * 10)
            standardized.speaking = rSpk > 0 ? (rSpk / 9.0) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 9.0) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 9.0) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 9.0) * 10 : 0;
            break;

        case 'TOEFL':
            // TOEFL iBT max is 30 per section.
            standardized.speaking = rSpk > 0 ? (rSpk / 30) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 30) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 30) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 30) * 10 : 0;
            break;

        case 'DUOLINGO ENGLISH TEST':
        case 'DUOLINGO':
            // Duolingo English Test max is 160.
            standardized.speaking = rSpk > 0 ? (rSpk / 160) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 160) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 160) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 160) * 10 : 0;
            break;

        case 'LINGUASKILL':
            // Linguaskill max is 180+.
            standardized.speaking = rSpk > 0 ? (rSpk / 180) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 180) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 180) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 180) * 10 : 0;
            break;

        case 'TETET':
            // TETET is on a 1-7 band scale.
            standardized.speaking = rSpk > 0 ? (rSpk / 7.0) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 7.0) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 7.0) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 7.0) * 10 : 0;
            break;

        case 'CU-TEP':
            // CU-TEP max scores: Listening 30, Reading 60, Writing 30. (Speaking is optional, max 30)
            standardized.speaking = rSpk > 0 ? (rSpk / 30) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 30) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 60) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 30) * 10 : 0;
            break;

        default:
            // Fallback if testType is unknown. Assuming 100 as max score fallback.
            standardized.speaking = rSpk > 0 ? (rSpk / 100) * 10 : 0;
            standardized.listening = rLis > 0 ? (rLis / 100) * 10 : 0;
            standardized.reading = rRdn > 0 ? (rRdn / 100) * 10 : 0;
            standardized.writing = rWrt > 0 ? (rWrt / 100) * 10 : 0;
            break;
    }

    // Ensure all scores are bounded between 0 and 10, and formatted to 1 decimal place.
    const clamp = (val) => Math.min(Math.max(val, 0), 10);
    
    return {
        speaking: parseFloat(clamp(standardized.speaking).toFixed(1)),
        listening: parseFloat(clamp(standardized.listening).toFixed(1)),
        reading: parseFloat(clamp(standardized.reading).toFixed(1)),
        writing: parseFloat(clamp(standardized.writing).toFixed(1))
    };
}

module.exports = {
    convertTo10PointScale
};

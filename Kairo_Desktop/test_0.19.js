// Item 0.19 — Gemini API countTokens validation
// Model: gemini-2.0-flash (aligned with PRD and runtime evidence)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = process.env.GEMINI_API_KEY;
if (!key) {
    console.error('FAIL: GEMINI_API_KEY is not set');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(key);
async function run() {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.countTokens('Hello Kairo');
    if (result.totalTokens > 0) {
        console.log('PASS: totalTokens=' + result.totalTokens);
    } else {
        console.error('FAIL: ' + JSON.stringify(result));
        process.exit(1);
    }
}
run().catch(err => {
    console.error('FAIL: ' + err.message);
    process.exit(1);
});

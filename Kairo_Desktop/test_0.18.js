// Item 0.18 — Gemini API generateContent smoke test
// Model: gemini-2.5-flash (aligned with PRD and runtime evidence)
const { GoogleGenerativeAI } = require('@google/generative-ai');
const key = process.env.GEMINI_API_KEY;
if (!key) {
    console.error('FAIL: GEMINI_API_KEY environment variable is not set');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(key);
async function run() {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('Respond with exactly: KAIRO_SMOKE_OK');
    const text = result.response.text().trim();
    if (text.includes('KAIRO_SMOKE_OK')) {
        console.log('PASS: ' + text);
    } else {
        console.error('FAIL: unexpected response: ' + text);
        process.exit(1);
    }
}
run().catch(err => {
    console.error('FAIL: ' + err.message);
    process.exit(1);
});


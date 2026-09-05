import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from '../services/secretManager.js';

async function testAllActive() {
  const apiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  const list = [
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-flash-lite'
  ];

  for (const m of list) {
    const start = Date.now();
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Say: "OK"');
      console.log(`✓ SUCCESS [${m}] in ${Date.now() - start}ms:`, res.response.text().trim());
    } catch (err) {
      console.log(`✗ FAIL [${m}]: ${err.message.substring(0, 120)}`);
    }
  }
}

testAllActive();

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from '../services/secretManager.js';

async function test35Flash() {
  const apiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const start = Date.now();
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
    const res = await model.generateContent('Say: "Gemini 3.5 Flash Lite is working"');
    console.log(`Success in ${Date.now() - start}ms:`, res.response.text());
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test35Flash();

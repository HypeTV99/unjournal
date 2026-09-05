import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from '../services/secretManager.js';

async function benchmark() {
  const apiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  const modelsToTest = [
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash'
  ];

  console.log('Testing active available models for speed and TTFT...');

  for (const m of modelsToTest) {
    const start = Date.now();
    try {
      const model = genAI.getGenerativeModel({ 
        model: m,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100
        }
      });
      const stream = await model.generateContentStream('Say hello in 5 words.');
      let firstChunkTime = null;
      let fullText = '';
      for await (const chunk of stream.stream) {
        if (!firstChunkTime) {
          firstChunkTime = Date.now() - start;
        }
        fullText += chunk.text();
      }
      const totalTime = Date.now() - start;
      console.log(`✓ ${m}: TTFT = ${firstChunkTime}ms | Total = ${totalTime}ms | Text: "${fullText.trim()}"`);
    } catch (err) {
      console.log(`✗ ${m}: FAILED (${err.message.substring(0, 80)})`);
    }
  }
}

benchmark().catch(console.error);

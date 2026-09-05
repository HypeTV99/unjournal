import { getGeminiApiKey } from '../services/secretManager.js';

async function listModels() {
  const apiKey = await getGeminiApiKey();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log('Available models:');
    data.models.forEach(m => {
      if (m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`- ${m.name.replace('models/', '')}`);
      }
    });
  } else {
    console.log('Response:', data);
  }
}

listModels().catch(console.error);

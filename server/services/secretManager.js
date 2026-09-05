import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

let cachedGeminiKey = null;
let secretClient = null;

/**
 * Retrieves the Gemini API key securely:
 * 1. Checks Google Cloud Secret Manager (if GCP_PROJECT_ID & GEMINI_SECRET_NAME are present)
 * 2. Falls back to process.env.GEMINI_API_KEY (for local development or container env injection)
 * 
 * Never exposes the key to client-side code.
 */
export async function getGeminiApiKey() {
  if (cachedGeminiKey) {
    return cachedGeminiKey;
  }

  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const secretName = process.env.GEMINI_SECRET_NAME || 'gemini-api-key';
  const secretVersion = process.env.GEMINI_SECRET_VERSION || 'latest';

  // Attempt to fetch from GCP Secret Manager if configured
  if (projectId && !process.env.SKIP_SECRET_MANAGER) {
    try {
      if (!secretClient) {
        secretClient = new SecretManagerServiceClient();
      }
      const name = `projects/${projectId}/secrets/${secretName}/versions/${secretVersion}`;
      console.log(`[SecretManager] Accessing secret version: ${name}...`);
      
      const [version] = await secretClient.accessSecretVersion({ name });
      const payload = version.payload.data.toString('utf8').trim();
      
      if (payload) {
        cachedGeminiKey = payload;
        console.log(`[SecretManager] Successfully loaded Gemini API key from Google Cloud Secret Manager.`);
        return cachedGeminiKey;
      }
    } catch (err) {
      console.warn(`[SecretManager] Notice: Could not retrieve key from GCP Secret Manager (${err.message}). Falling back to environment variable.`);
    }
  }

  // Fallback to local environment variable
  const envKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    cachedGeminiKey = envKey.trim();
    console.log(`[SecretManager] Using Gemini API key from environment configuration.`);
    return cachedGeminiKey;
  }

  throw new Error(
    'CRITICAL SECURITY ERROR: Gemini API Key not found. Please configure Google Cloud Secret Manager (GCP_PROJECT_ID and GEMINI_SECRET_NAME) or set GEMINI_API_KEY in your environment.'
  );
}

/**
 * Returns security audit status for diagnostics without leaking keys
 */
export async function getSecretStatus() {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'Not configured';
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);
  
  let keySource = 'unresolved';
  let isOperational = false;
  
  try {
    const key = await getGeminiApiKey();
    if (key) {
      isOperational = true;
      keySource = cachedGeminiKey === (process.env.GEMINI_API_KEY || '').trim() ? 'Environment / Container Injection' : 'GCP Secret Manager';
    }
  } catch (err) {
    isOperational = false;
    keySource = `Error: ${err.message}`;
  }

  return {
    isOperational,
    keySource,
    gcpProjectId: projectId,
    secretManagerEnabled: !process.env.SKIP_SECRET_MANAGER && projectId !== 'Not configured',
    hasEnvKeyFallback: hasEnvKey,
    keyFingerprint: cachedGeminiKey ? `${cachedGeminiKey.substring(0, 4)}...${cachedGeminiKey.substring(cachedGeminiKey.length - 4)}` : 'None'
  };
}

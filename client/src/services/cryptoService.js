/**
 * Zero-Dependency Client-Side Encryption Service (WebCrypto API)
 * Standard: AES-GCM 256-bit with PBKDF2 Key Derivation (100,000 rounds of SHA-256)
 * Guarantees zero-knowledge storage: Plain text never touches Firestore or network when locked.
 */

// Helper to convert Buffer/ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an AES-GCM 256-bit key from user passphrase using PBKDF2
 */
async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plain text using AES-GCM 256-bit
 * @param {string} plainText 
 * @param {string} passphrase 
 * @returns {Promise<string>} Format: "ENC:v1:{salt}:{iv}:{ciphertext}"
 */
export async function encryptText(plainText, passphrase) {
  if (!plainText) return '';
  if (!passphrase) throw new Error('Passphrase is required for encryption.');

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const encodedData = encoder.encode(plainText);

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );

  const saltB64 = arrayBufferToBase64(salt);
  const ivB64 = arrayBufferToBase64(iv);
  const cipherB64 = arrayBufferToBase64(encrypted);

  return `ENC:v1:${saltB64}:${ivB64}:${cipherB64}`;
}

/**
 * Decrypt cipher bundle using AES-GCM 256-bit
 * @param {string} encryptedString - Format: "ENC:v1:{salt}:{iv}:{ciphertext}"
 * @param {string} passphrase 
 * @returns {Promise<string>} Plaintext string
 */
export async function decryptText(encryptedString, passphrase) {
  if (!encryptedString || !encryptedString.startsWith('ENC:v1:')) {
    return encryptedString; // Return as-is if not encrypted
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 5) {
    throw new Error('Invalid encrypted bundle format.');
  }

  const salt = base64ToUint8Array(parts[2]);
  const iv = base64ToUint8Array(parts[3]);
  const ciphertext = base64ToUint8Array(parts[4]);

  const key = await deriveKey(passphrase, salt);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    throw new Error('Incorrect encryption passphrase or corrupted data.');
  }
}

/**
 * Check if a text payload is encrypted with WebCrypto
 */
export function isEncryptedPayload(text) {
  return typeof text === 'string' && text.startsWith('ENC:v1:');
}

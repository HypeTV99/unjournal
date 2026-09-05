/**
 * Client-Side Zero-Knowledge Encryption for Private Vault Mode
 * Uses native Web Crypto API:
 * - PBKDF2 with SHA-256 (100,000 iterations) for key derivation
 * - AES-GCM 256-bit encryption with 12-byte random IV
 */

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
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
 * Encrypts arbitrary object or text with user PIN
 */
export async function encryptVaultData(data, pin) {
  if (!pin || pin.length < 4) {
    throw new Error('PIN must be at least 4 characters long.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  const enc = new TextEncoder();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const encodedData = enc.encode(plaintext);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encodedData
  );

  return {
    isEncrypted: true,
    cipherPayload: arrayBufferToBase64(ciphertext),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    encryptedAt: new Date().toISOString()
  };
}

/**
 * Decrypts vault data back to original content
 */
export async function decryptVaultData(encryptedRecord, pin) {
  if (!encryptedRecord || !encryptedRecord.cipherPayload) {
    throw new Error('Invalid encrypted payload.');
  }

  const salt = new Uint8Array(base64ToArrayBuffer(encryptedRecord.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedRecord.iv));
  const ciphertext = base64ToArrayBuffer(encryptedRecord.cipherPayload);

  const key = await deriveKey(pin, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    const decryptedString = dec.decode(decryptedBuffer);

    try {
      return JSON.parse(decryptedString);
    } catch {
      return decryptedString;
    }
  } catch {
    throw new Error('Decryption failed. Incorrect PIN or corrupted data.');
  }
}

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDemo123456789",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "personal-gemini-journal.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "personal-gemini-journal",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "personal-gemini-journal.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef123456789"
};

// Check if real Firebase configuration is present
export const isRealFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !import.meta.env.VITE_FIREBASE_API_KEY.includes('Dummy')
);

// Initialize Firebase safely
let app;
let auth;
let db;
let storage;
let googleProvider;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  try {
    storage = getStorage(app);
  } catch (sErr) {
    console.warn('[Firebase Storage] Notice:', sErr.message);
  }
  googleProvider = new GoogleAuthProvider();
  // Request strictly name and email permissions - no sensitive or additional scopes
  googleProvider.addScope('profile');
  googleProvider.addScope('email');
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (error) {
  console.warn('[Firebase] Client initialization notice:', error.message);
}

export { app, auth, db, storage, googleProvider };

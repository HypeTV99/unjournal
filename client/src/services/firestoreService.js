import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, isRealFirebaseConfigured } from '../config/firebase';

/**
 * Isolated User Storage Service
 * Enforces path convention: /users/{userId}/journals/{journalId}
 */

// Helper to get local isolated storage key per user
function getLocalKey(userId) {
  return `gemini_isolated_journals_user_${userId}`;
}

export async function saveJournalEntry(userId, entryData) {
  if (!userId) throw new Error('Security Violation: userId is required to save journal.');

  const entryId = entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const record = {
    ...entryData,
    id: entryId,
    userId: userId,
    updatedAt: timestamp,
    createdAt: entryData.createdAt || timestamp
  };

  // 1. If real Firebase is configured, persist to Cloud Firestore
  if (isRealFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'users', userId, 'journals', entryId);
      await setDoc(docRef, {
        ...record,
        firestoreTimestamp: serverTimestamp()
      }, { merge: true });
      console.log(`[Firestore] Entry saved to /users/${userId}/journals/${entryId}`);
    } catch (err) {
      console.warn(`[Firestore] Remote write failed, saving to isolated local cache:`, err.message);
    }
  }

  // 2. Always maintain user-isolated local state for fast UX & fallback
  try {
    const localKey = getLocalKey(userId);
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const index = existing.findIndex(item => item.id === entryId);
    
    if (index >= 0) {
      existing[index] = record;
    } else {
      existing.unshift(record);
    }

    localStorage.setItem(localKey, JSON.stringify(existing));
  } catch (storageErr) {
    console.error('[Storage] Local cache write error:', storageErr);
  }

  return record;
}

export async function fetchUserJournals(userId) {
  if (!userId) throw new Error('Security Violation: userId is required to fetch journals.');

  let records = [];

  // 1. Try fetching from Cloud Firestore
  if (isRealFirebaseConfigured && db) {
    try {
      const userJournalsRef = collection(db, 'users', userId, 'journals');
      const q = query(userJournalsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      querySnapshot.forEach((docSnapshot) => {
        records.push({ id: docSnapshot.id, ...docSnapshot.data() });
      });

      if (records.length > 0) {
        // Sync local cache
        localStorage.setItem(getLocalKey(userId), JSON.stringify(records));
        return records;
      }
    } catch (err) {
      console.warn(`[Firestore] Remote fetch failed, reading from isolated local store:`, err.message);
    }
  }

  // 2. Read from isolated user local cache
  try {
    const localKey = getLocalKey(userId);
    const raw = localStorage.getItem(localKey);
    if (raw) {
      records = JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Storage] Error parsing local records:', e);
  }

  // Seed sample initial entry if completely empty for newly created user
  if (records.length === 0) {
    const initialEntry = {
      id: `welcome_${Date.now()}`,
      userId: userId,
      title: "Welcome to Personal Gemini Journal",
      summary: "Welcome to your secure AI cognitive sanctuary. Every reflection, brainstorming thread, and action item is isolated strictly to your account with zero-leakage security directives.",
      conversation: [
        {
          role: 'model',
          content: 'Hello! I am your Gemini cognitive partner. What is on your mind today? We can brainstorm ideas, unpack complex decisions, or organize your goals.'
        }
      ],
      rawNotes: "Initial system onboarding and setup verification.",
      key_insights: [
        "Your data is isolated to your UID in Cloud Firestore.",
        "Toggle personas anytime to switch between empathetic, Socratic, action, or creative modes.",
        "Use Vault Mode to encrypt sensitive reflections client-side with your own PIN."
      ],
      action_items: [
        { task: "Start your first multi-turn journaling conversation", priority: "high" },
        { task: "Try switching to Socratic Stoic or Creative Catalyst mode", priority: "medium" }
      ],
      sentiment: "energized",
      emotional_valence: 0.9,
      cognitive_clarity_score: 9,
      thematic_tags: ["Welcome", "Getting Started", "Security"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEncrypted: false
    };

    records = [initialEntry];
    localStorage.setItem(getLocalKey(userId), JSON.stringify(records));
  }

  return records;
}

export async function deleteUserJournal(userId, journalId) {
  if (!userId || !journalId) return false;

  if (isRealFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'users', userId, 'journals', journalId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('[Firestore] Remote delete failed:', err.message);
    }
  }

  try {
    const localKey = getLocalKey(userId);
    const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
    const filtered = existing.filter(item => item.id !== journalId);
    localStorage.setItem(localKey, JSON.stringify(filtered));
  } catch (err) {
    console.error('[Storage] Local delete failed:', err);
  }

  return true;
}

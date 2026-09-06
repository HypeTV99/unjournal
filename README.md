# UnJournal ((UN) JOURNAL) — Autonomous Cognitive Sanctuary

> **Google Cloud Run AI Challenge Hackathon Entry**  
> **Mandatory Verification Label:** `dev-tutorial=cloud-run-ai-challenge`  
> **Live Cloud Run URL:** [https://unjournal-1021404915767.asia-south1.run.app](https://unjournal-1021404915767.asia-south1.run.app)  
> **GitHub Repository:** [https://github.com/HypeTV99/unjournal](https://github.com/HypeTV99/unjournal)

---

## 🌟 Overview & Standout Features

UnJournal is a production-grade, voice-first personal cognitive reflection partner designed with zero-trust architecture. It combines Google's Gemini models with client-side Firestore isolation and Google Cloud Run autoscaling.

- 🎙️ **Voice-First Reflection Hero:** Centered audio intake powered by `thinking-orbs` visual feedback, hands-free 3.5s silence auto-submission, and borderless fullscreen listening takeover.
- 🌅 **Yesterday-to-Today Morning Digest Loop:** Automatically synthesizes yesterday's reflections into concrete events, insights, carryover open loops, and a 60-second spoken briefing with an instant "Begin Today" bridge.
- 🛡️ **Centralized AI Guardrails (`JOURNAL_GUARDRAILS`):** Enforces strict anti-hallucination discipline (never fabricates memories or dates), prevents indirect prompt injection, and establishes safe emotional boundaries without medical diagnoses.
- 🔍 **Ask Your Journal (Semantic Retrospection):** Inquires across lifetime memories with cosine vector ranking and privacy-filtered context injection.
- 📍 **Epiphany Horizon Maps:** Ambient geolocation tagging with interactive map horizon exploration.
- 🔒 **Zero-Trust Multi-Tenant Storage:** Multi-tier client Firestore isolation (`/users/{userId}/*`) with strict server-side authentication verification.

---

## 🚀 Deployment Instructions

### Prerequisites
1. [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
2. An active Google Cloud Project (`unjournal-ai-2026`).
3. Enabled APIs: Cloud Run, Cloud Build, Artifact Registry, Secret Manager.

### One-Click Automated Deployment to Google Cloud Run

#### Using PowerShell (Windows):
```powershell
./deploy-cloud-run.ps1
```

#### Using Bash (Linux/macOS):
```bash
chmod +x deploy-cloud-run.sh
./deploy-cloud-run.sh
```

#### Manual Deployment Command with Required Label:
```bash
gcloud run deploy unjournal \
  --source . \
  --region asia-south1 \
  --project unjournal-ai-2026 \
  --platform managed \
  --allow-unauthenticated \
  --labels dev-tutorial=cloud-run-ai-challenge \
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=unjournal-ai-2026,GCP_PROJECT_ID=unjournal-ai-2026,GEMINI_SECRET_NAME=gemini-api-key,GEMINI_SECRET_VERSION=latest
```

---

## 🛡️ Cloud Firestore Security Rules

UnJournal implements a strict per-user sandbox in [`firestore.rules`](./firestore.rules). Users have access exclusively to their own subtree:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Default deny all access to root or undefined collections
    match /{document=**} {
      allow read, write: if false;
    }

    // Strict User-Isolated Multi-Tenant Security Boundary
    // Every user has complete read/write access ONLY to their own subtree: /users/{userId}
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // User's journal entries collection with per-entry privacy enforcement
      match /journals/{journalId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's cognitive summaries and analytical snapshots
      match /summaries/{summaryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's unresolved cognitive open loops
      match /open_loops/{loopId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // User's private settings and preferences
      match /settings/{settingId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### Deploying Firestore Rules:
```bash
firebase deploy --only firestore:rules --project echo-journal-44260
```

---

## ⚙️ Environment Configuration

### Server Configuration (`server/.env`)
```env
PORT=5000
NODE_ENV=production
FIREBASE_PROJECT_ID=echo-journal-44260
GEMINI_API_KEY=your_gemini_api_key_from_ai_studio
# Or configure Google Cloud Secret Manager:
# GCP_PROJECT_ID=echo-journal-44260
# GEMINI_SECRET_NAME=gemini-api-key
```

### Client Configuration (`client/.env`)
```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=echo-journal-44260.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=echo-journal-44260
VITE_FIREBASE_STORAGE_BUCKET=echo-journal-44260.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=423004584337
VITE_FIREBASE_APP_ID=1:423004584337:web:c722f38a39eeb376d38230
VITE_API_BASE_URL=/api
```

---

## 🧪 Local Development

```bash
# 1. Install all dependencies
npm run install:all

# 2. Run both server and client concurrently
npm run dev
```
Client: `http://localhost:5173`  
Server: `http://localhost:5000`

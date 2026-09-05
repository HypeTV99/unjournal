# UnJournal ((UN) JOURNAL) — Autonomous Cognitive Sanctuary

> **Google Cloud Run AI Challenge Hackathon Entry**  
> **Mandatory Deployment Label:** `dev-tutorial=cloud-run-ai-challenge`  
> **Live App:** [http://localhost:5173](http://localhost:5173)

---

## ⚡ Quick Start

### 1. Run Locally
```bash
# Start Backend (Port 5000)
npm --prefix server start

# Start Frontend (Port 5173)
npm --prefix client run dev
```

### 2. Deploy to Google Cloud Run
```bash
# Automated deployment with mandatory label:
./deploy-cloud-run.sh
```

---

## 🌟 Standout Features
- 🔍 **Ask Your Journal:** Semantic reasoning enclave powered by Gemini 3.6 Flash across all life memories.
- 📍 **Epiphany Maps:** Ambient geolocation tagging and Google Maps horizon viewer.
- 💬 **Discord / Slack Webhook Sync:** One-click morning briefing and open loop dispatcher.
- 🎙️ **Dual-Engine Voice Dictation:** Real-time Web Speech + native Gemini 3.6 Multimodal Audio transcription.
- 🛡️ **Zero-Trust AI Architecture:** GCP Secret Manager key protection + multi-tenant Firestore isolation (`/users/{userId}/*`).

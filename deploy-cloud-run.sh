#!/usr/bin/env bash
# ==============================================================================
# UnJournal (Personal Gemini Journal) — Google Cloud Run Automated Deploy Script
# Mandatory Verification Label Attached: dev-tutorial=cloud-run-ai-challenge
# ==============================================================================

set -e

echo "=================================================================="
echo "🚀 Deploying UnJournal to Google Cloud Run"
echo "🏷️  Required Verification Label: dev-tutorial=cloud-run-ai-challenge"
echo "=================================================================="

# Check for GCP Project ID
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
else
  PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
fi

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: Google Cloud Project ID is not set. Run 'gcloud config set project <PROJECT_ID>' first."
  exit 1
fi

REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME="unjournal-app"

echo "📍 Target Project: $PROJECT_ID"
echo "📍 Target Region:  $REGION"
echo "📦 Service Name:   $SERVICE_NAME"

# Enable required GCP APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project "$PROJECT_ID"

# Build and Deploy to Cloud Run with Required Verification Label
echo "🏗️  Building container and deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --set-labels "dev-tutorial=cloud-run-ai-challenge" \
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID"

echo "=================================================================="
echo "✅ Deployment Successful!"
echo "🏷️  Verification Label 'dev-tutorial=cloud-run-ai-challenge' attached."
echo "🌐 Service URL:"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)'
echo "=================================================================="

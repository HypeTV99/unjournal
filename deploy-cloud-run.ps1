# ==============================================================================
# UnJournal — Google Cloud Run Automated Deploy Script (PowerShell)
# Mandatory Verification Label: dev-tutorial=cloud-run-ai-challenge
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "🚀 Deploying UnJournal to Google Cloud Run" -ForegroundColor Cyan
Write-Host "🏷️  Required Verification Label: dev-tutorial=cloud-run-ai-challenge" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Cyan

$projectId = (gcloud config get-value project 2>$null)
if (-not $projectId) {
    Write-Host "❌ Error: Google Cloud Project ID is not set. Run 'gcloud config set project <PROJECT_ID>' first." -ForegroundColor Red
    exit 1
}

$region = if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }
$serviceName = "unjournal-app"

Write-Host "📍 Project: $projectId" -ForegroundColor Green
Write-Host "📍 Region:  $region" -ForegroundColor Green
Write-Host "📦 Service: $serviceName" -ForegroundColor Green

Write-Host "🏗️  Deploying container to Google Cloud Run..." -ForegroundColor Yellow

gcloud run deploy $serviceName `
  --source . `
  --region $region `
  --project $projectId `
  --platform managed `
  --allow-unauthenticated `
  --set-labels dev-tutorial=cloud-run-ai-challenge `
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=$projectId

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete with label dev-tutorial=cloud-run-ai-challenge" -ForegroundColor Green
gcloud run services describe $serviceName --region $region --project $projectId --format 'value(status.url)'
Write-Host "==================================================================" -ForegroundColor Cyan

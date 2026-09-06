# UnJournal Cloud Run Automated Deploy Script (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "Deploying UnJournal to Google Cloud Run..." -ForegroundColor Cyan

$projectId = if ($env:GCP_PROJECT_ID) { $env:GCP_PROJECT_ID } else { "unjournal-ai-2026" }
$region = if ($env:GCP_REGION) { $env:GCP_REGION } else { "asia-south1" }
$serviceName = "unjournal"

Write-Host "Project: $projectId" -ForegroundColor Green
Write-Host "Region:  $region" -ForegroundColor Green
Write-Host "Service: $serviceName" -ForegroundColor Green

gcloud run deploy $serviceName --source . --region $region --project $projectId --platform managed --allow-unauthenticated --labels dev-tutorial=cloud-run-ai-challenge --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=$projectId,GCP_PROJECT_ID=$projectId,GEMINI_SECRET_NAME=gemini-api-key,GEMINI_SECRET_VERSION=latest" --quiet

Write-Host "Deployment Complete with label dev-tutorial=cloud-run-ai-challenge" -ForegroundColor Green
gcloud run services describe $serviceName --region $region --project $projectId --format "value(status.url)"

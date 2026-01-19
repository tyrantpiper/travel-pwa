$ErrorActionPreference = "Stop"

$ProjectID = "antigravity-prod-2026"  # 您的 Project ID
$SA_EMAIL = "github-actions-deployer@$ProjectID.iam.gserviceaccount.com"

Write-Host "🚀 Applying COMPREHENSIVE Permissions Fix for $SA_EMAIL..." -ForegroundColor Cyan

# 完整的權限清單 (包含基本 Cloud Run 和 Source Build 所需的所有權限)
$AllRequiredRoles = @(
    "roles/run.admin",                       # Fixes: run.services.get denied
    "roles/iam.serviceAccountUser",          # Fixes: actAs permission
    "roles/cloudbuild.builds.editor",        # Fixes: source deploy build
    "roles/artifactregistry.admin",          # Fixes: push image
    "roles/storage.admin",                   # Fixes: storage bucket access
    "roles/serviceusage.serviceUsageConsumer" # Fixes: API usage quota
)

foreach ($Role in $AllRequiredRoles) {
    Write-Host "  + Granting $Role..."
    # 使用 --condition=None 清除任何可能存在的限制條件
    gcloud projects add-iam-policy-binding $ProjectID --member="serviceAccount:$SA_EMAIL" --role="$Role" --condition=None -q | Out-Null
}

Write-Host "`n✅ Super Fix Complete!" -ForegroundColor Green
Write-Host "Please Re-run the GitHub Action job now."

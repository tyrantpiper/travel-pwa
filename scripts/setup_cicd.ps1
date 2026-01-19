$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Google Cloud Service Account for GitHub Actions..." -ForegroundColor Cyan

# 1. Check gcloud availability
if (!(Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "❌ 'gcloud' command not found. Please install Google Cloud SDK or run this in a terminal where gcloud is available."
    exit 1
}

# 2. Config Project ID
$DefaultProject = "antigravity-prod-2026"
$ProjectID = Read-Host "Enter your Google Cloud Project ID (default: $DefaultProject)"
if ([string]::IsNullOrWhiteSpace($ProjectID)) {
    $ProjectID = $DefaultProject
}

Write-Host "✅ Target Project: $ProjectID" -ForegroundColor Green

# 3. Create Service Account
$SA_NAME = "github-actions-deployer"
$SA_EMAIL = "$SA_NAME@$ProjectID.iam.gserviceaccount.com"

Write-Host "Creating Service Account: $SA_NAME..."
gcloud iam service-accounts create $SA_NAME --display-name="GitHub Actions Deployer" --project $ProjectID -q
if ($LASTEXITCODE -ne 0) { Write-Warning "Service account might already exist, continuing..." }

# 4. Assign Roles
Write-Host "Assigning IAM Roles..."
$Roles = @("roles/run.admin", "roles/storage.admin", "roles/iam.serviceAccountUser")

foreach ($Role in $Roles) {
    Write-Host "  + Granting $Role..."
    gcloud projects add-iam-policy-binding $ProjectID --member="serviceAccount:$SA_EMAIL" --role="$Role" -q | Out-Null
}

# 5. Generate Key
Write-Host "Generating JSON Key..."
$KeyFile = "github-sa-key.json"
gcloud iam service-accounts keys create $KeyFile --iam-account=$SA_EMAIL --project $ProjectID -q

Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
Write-Host "============================"
Write-Host "PLEASE DO THE FOLLOWING NOW:"
Write-Host "============================"
Write-Host "1. Go to GitHub Repo -> Settings -> Secrets and variables -> Actions"
Write-Host "2. Create New Repository Secret: 'GCP_SA_KEY'"
Write-Host "3. Paste the content of '$KeyFile' into the Value."
Write-Host "4. ALSO Add these 2 Secrets (Required for backend):"
Write-Host "   - ARCGIS_API_KEY"
Write-Host "   - CLOUDINARY_API_SECRET"
Write-Host "   (Values can be found in your local .env or by asking me)"
Write-Host "5. Delete '$KeyFile' after saving to GitHub."

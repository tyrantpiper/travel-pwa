<#
.SYNOPSIS
    Tabidachi 全站廣播推播腳本
.DESCRIPTION
    透過 notify-broadcast Edge Function 將通知推送到所有使用者的裝置。
    同時觸發站內鈴鐺 (Realtime) 和系統層級推播 (Web Push)。
.EXAMPLE
    .\scripts\broadcast.ps1 -Title "✨ v2.0 新功能" -Body "全新 AI 行程推薦上線！"
.EXAMPLE
    .\scripts\broadcast.ps1 -Title "🎄 聖誕特別版" -Body "限時主題上線中" -Link "/" -BroadcastId "xmas-2026"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Title,

    [Parameter(Mandatory=$true)]
    [string]$Body,

    [string]$Link = "/",

    [string]$BroadcastId = ""
)

# === Config ===
$PROJECT_URL = "https://oudnkmigfueuyvxqpqwn.supabase.co"
$EDGE_FN_URL = "$PROJECT_URL/functions/v1/notify-broadcast"

# Read BROADCAST_SECRET from environment or prompt
$secret = $env:BROADCAST_SECRET
if (-not $secret) {
    $secret = Read-Host -Prompt "Enter BROADCAST_SECRET"
}

# === Build payload ===
$payload = @{
    title = $Title
    body  = $Body
    link  = $Link
}

if ($BroadcastId) {
    $payload.broadcast_id = $BroadcastId
}

$jsonBody = $payload | ConvertTo-Json -Compress

Write-Host ""
Write-Host "📡 Broadcasting to all Tabidachi users..." -ForegroundColor Cyan
Write-Host "   Title: $Title" -ForegroundColor White
Write-Host "   Body:  $Body" -ForegroundColor White
Write-Host "   Link:  $Link" -ForegroundColor Gray
if ($BroadcastId) {
    Write-Host "   ID:    $BroadcastId" -ForegroundColor Gray
}
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $EDGE_FN_URL `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $secret"
            "Content-Type"  = "application/json"
        } `
        -Body $jsonBody

    Write-Host "✅ Broadcast sent successfully!" -ForegroundColor Green
    Write-Host "   Users notified:   $($response.users_notified)" -ForegroundColor White
    Write-Host "   Web Pushes sent:  $($response.pushes_sent)" -ForegroundColor White
    Write-Host "   Web Pushes failed: $($response.pushes_failed)" -ForegroundColor Yellow
    Write-Host "   Expired cleaned:  $($response.expired_cleaned)" -ForegroundColor Gray
    Write-Host ""
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Broadcast failed (HTTP $statusCode)" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}

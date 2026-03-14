$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot

Write-Host "--- v16 Precision Server Restart ---" -ForegroundColor Cyan

# 🎯 Step 1: 精確清理開發埠號 (3000, 8000)，不殺死 VS Code 內部的 Python LSP
$TargetPorts = @(3000, 8000)
foreach ($Port in $TargetPorts) {
    try {
        # 找出佔用該埠號的 PID
        $Conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($Conn) {
            $PIDToKill = $Conn.OwningProcess
            $ProcName = (Get-Process -Id $PIDToKill).Name
            Write-Host "埠號 $Port 正被 $ProcName (PID: $PIDToKill) 佔用，正在強制解除..." -ForegroundColor Yellow
            Stop-Process -Id $PIDToKill -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1 # 等待 OS 釋放埠號
        }
    } catch {
        Write-Warning "無法自動清除埠號 $Port，可能需要手動檢查。"
    }
}

# 🚀 Step 2: 啟動後端伺服器
Write-Host "正在開啟後端伺服器 (FastAPI)..." -ForegroundColor Green
$BackendPath = Join-Path $ScriptDir "..\backend"
$PythonExec = Join-Path $ScriptDir "..\.venv\Scripts\python.exe"

# 使用原生 PowerShell 啟動並處理路徑空格
# -WindowStyle Normal 確保用戶能看到控制台
$backendCmd = "Set-Location -Path '$BackendPath'; & '$PythonExec' -m uvicorn main:app --reload"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal

# 🚀 Step 3: 啟動前端伺服器
Write-Host "正在開啟前端伺服器 (Next.js)..." -ForegroundColor Green
$FrontendPath = Join-Path $ScriptDir "..\frontend"
$frontendCmd = "Set-Location -Path '$FrontendPath'; npm run dev"
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

Write-Host "`n✅ 所有伺服器指令已發送。請檢查新開啟的視窗。" -ForegroundColor Cyan
Write-Host "若側邊欄仍有警告，請關閉此終端機並重新開啟一個新的 PowerShell 視窗。"

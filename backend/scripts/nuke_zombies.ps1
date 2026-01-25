# Nuke Zombie Python Processes (Windows)
$targetName = "python"
$pIds = Get-Process $targetName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id

if ($pIds) {
    Write-Host "🕵️ Found $($pIds.Count) zombie processes: $pIds" -ForegroundColor Yellow
    foreach ($id in $pIds) {
        try {
            # Try to see what files are locked (requires handle.exe or similar, but we'll stick to basic forensics)
            $proc = Get-Process -Id $id
            Write-Host "💀 Killing PID $id ($($proc.MainWindowTitle))" -ForegroundColor Red
            Stop-Process -Id $id -Force
        } catch {
            Write-Host "⚠️ Failed to kill PID $id" -ForegroundColor Gray
        }
    }
    Write-Host "✅ Field cleared." -ForegroundColor Green
} else {
    Write-Host "✨ No zombie processes found." -ForegroundColor Gray
}

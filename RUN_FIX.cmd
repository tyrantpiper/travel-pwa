@echo off
echo ===================================================
echo   Running Permission Fix Script for Cloud Run...
echo ===================================================
echo.

WHERE gcloud >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 'gcloud' command was NOT found.
    echo Please ensure you have Google Cloud SDK installed and added to your PATH.
    echo You may need to run 'gcloud init' first.
    echo.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\fix_permissions.ps1"

echo.
echo ===================================================
echo   If you saw "Super Fix Complete!" above, 
echo   you can now go to GitHub and click "Re-run".
echo ===================================================
pause

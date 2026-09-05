@echo off
title BullionAI API Server
cd /d D:\BullionAI-PineTest

echo ==========================================
echo        BULLIONAI API SERVER
echo ==========================================
echo.
echo  Freeing port 8787 if occupied...
powershell -NoProfile -Command "$c = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Write-Host '  -> stopped old server' } else { Write-Host '  -> port already free' }"
echo.
echo  Charts  : work immediately
echo  LIVE    : paste your fresh Shoonya
echo            redirect URL when prompted
echo            (or drop it into:
echo             data\shoonya-auth.txt)
echo.
echo  Frontend: http://localhost:5173
echo  Health  : http://localhost:8787/health
echo.
echo ==========================================
echo.

node backend/src/server/bullionai-api.js %*

echo.
echo Server exited. Press any key to close.
pause >nul
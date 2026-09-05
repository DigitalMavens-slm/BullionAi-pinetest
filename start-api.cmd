@echo off
cd /d "%~dp1"
node backend/src/server/bullionai-api.js >NUL 2>&1
timeout /t 3 /nobreak >NUL
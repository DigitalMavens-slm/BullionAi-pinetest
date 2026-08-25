@echo off
cd /d "%~dp1"
set BULLIONAI_API_PORT=8787
node src/server/bullionai-api.js >NUL 2>&1
timeout /t 3 /nobreak >NUL
echo Server started on port %BULLIONAI_API_PORT%
@rem Start BullionAI API server
@echo off
cd /d "%~dp1"
echo Starting BullionAI API server...
node backend/src/server/bullionai-api.js
pause
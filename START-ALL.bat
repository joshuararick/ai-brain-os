@echo off
title Josh's AI System
echo Starting Josh's AI servers...
echo.
start "Brain MCP" /MIN node "C:\Users\joshu\Brain of Ai\brain-server\brain.js"
timeout /t 1 /nobreak >nul
start "OpenAI Bridge" /MIN node "C:\Users\joshu\Brain of Ai\brain-server\openai-bridge.js"
timeout /t 2 /nobreak >nul
echo Brain:   http://localhost:3336/mcp
echo OpenAI:  http://localhost:3337/mcp
echo.
echo Done. You can close this window.
pause

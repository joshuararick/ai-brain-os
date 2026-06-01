@echo off
title Josh's AI System — Starting All Bridges
echo Starting all AI bridges...
echo.
start "Brain MCP" /MIN node "C:\Users\joshu\Brain of Ai\brain-server\brain.js"
timeout /t 1 /nobreak >nul
start "OpenAI Bridge" /MIN node "C:\Users\joshu\Brain of Ai\brain-server\openai-bridge.js"
timeout /t 1 /nobreak >nul
start "Perplexity Bridge" /MIN node "C:\Users\joshu\Brain of Ai\brain-server\perplexity-bridge.js"
timeout /t 1 /nobreak >nul
start "Gemini Bridge" /MIN node "C:\Users\joshu\Brain of Ai\brain-server\gemini-bridge.js"
timeout /t 2 /nobreak >nul
echo.
start "Page Generator" /MIN node "C:\Users\joshu\Brain of Ai\generate-pages.js"
echo.
echo All bridges started:
echo   Brain:       http://localhost:3336/mcp
echo   OpenAI:      http://localhost:3337/mcp
echo   Perplexity:  http://localhost:3338/mcp
echo   Gemini:      http://localhost:3339/mcp
echo.
pause

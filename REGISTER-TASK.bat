@echo off
echo Registering AI Page Generation scheduled task...

schtasks /delete /tn "AI-PageGeneration" /f 2>nul

schtasks /create /tn "AI-PageGeneration" /tr "node \"C:\Users\joshu\Brain of Ai\generate-pages.js\"" /sc daily /st 08:00 /rl highest /f

if %errorlevel% equ 0 (
  echo.
  echo SUCCESS! Task registered. Pages will regenerate every day at 8am.
  echo.
  schtasks /query /tn "AI-PageGeneration" /fo list
) else (
  echo.
  echo FAILED. Try right-clicking this file and selecting "Run as administrator"
)

pause

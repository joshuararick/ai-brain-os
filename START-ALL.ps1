$brainJs = "C:\Users\joshu\Brain of Ai\brain-server\brain.js"
$openaiJs = "C:\Users\joshu\Brain of Ai\brain-server\openai-bridge.js"

Write-Host "Starting Josh's AI servers..." -ForegroundColor Cyan

$brain = Start-Process -FilePath "node" -ArgumentList "`"$brainJs`"" -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 1000
$openai = Start-Process -FilePath "node" -ArgumentList "`"$openaiJs`"" -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 2000

Write-Host "Brain MCP:    http://localhost:3336/mcp" -ForegroundColor Green
Write-Host "OpenAI Bridge: http://localhost:3337/mcp" -ForegroundColor Green
Write-Host ""
Write-Host "Both servers running. Keep this window open or close it - they run in background." -ForegroundColor Gray

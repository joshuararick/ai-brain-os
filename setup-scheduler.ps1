# Auto-registers the page generation task in Windows Task Scheduler
# Run once — then it runs itself every morning at 8am forever

$taskName   = "AI-PageGeneration"
$scriptPath = "C:\Users\joshu\Brain of Ai\generate-pages.js"
$nodePath   = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $nodePath) {
  Write-Host "ERROR: Node.js not found. Install from nodejs.org" -ForegroundColor Red
  exit 1
}

# Remove old task if exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action  = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$scriptPath`"" -WorkingDirectory "C:\Users\joshu\Brain of Ai"
$trigger = New-ScheduledTaskTrigger -Daily -At "08:00AM"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force

Write-Host "SUCCESS: Task '$taskName' registered. Runs daily at 8am." -ForegroundColor Green
Write-Host "Next run: $(Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo | Select-Object -ExpandProperty NextRunTime)"

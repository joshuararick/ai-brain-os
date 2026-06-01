' Josh's AI Brain — Silent Auto-Starter
' Runs brain.js and openai-bridge.js invisibly on Windows startup
Dim sh
Set sh = CreateObject("WScript.Shell")

' Start Brain MCP (port 3336)
sh.Run "node ""C:\Users\joshu\Brain of Ai\brain-server\brain.js""", 0, False

' Wait 1 second
WScript.Sleep 1000

' Start OpenAI Bridge (port 3337)
sh.Run "node ""C:\Users\joshu\Brain of Ai\brain-server\openai-bridge.js""", 0, False

' Wait 2 seconds then regenerate all landing pages
WScript.Sleep 2000
sh.Run "node ""C:\Users\joshu\Brain of Ai\generate-pages.js""", 0, False

Set sh = Nothing

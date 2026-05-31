Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "node ""C:\Users\joshu\Brain of Ai\brain-server\openai-bridge.js""", 0, False
WScript.Echo "OpenAI Bridge starting on port 3337..."

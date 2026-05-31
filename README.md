# AI Brain OS

A personal AI operating system built on top of [Claude Cowork](https://claude.ai). 
Connect Claude, GPT-4o, Perplexity, and your local AI agents through a shared brain that knows your goals, priorities, and life context.

## What This Is

A local MCP (Model Context Protocol) server system that gives Claude a persistent memory of who you are and what you're working on — plus bridges to other AI systems so they all share the same context.

**AI Stack:**
- 🧠 **Brain MCP** — your goals, priorities, notes, wins (port 3336)
- 🤖 **OpenAI Bridge** — GPT-4o, Codex, o1 (port 3337)
- 🔍 **Perplexity Bridge** — web search AI (port 3338) *(coming soon)*

## Quick Install

### 1. Clone the repo
```
git clone https://github.com/joshuararick/ai-brain-os
cd ai-brain-os
```

### 2. Set up your keys
```
copy .env.example .env
```
Edit `.env` and add your API keys.

### 3. Copy your brain data template
```
copy brain-server\data.example.json brain-server\data.json
```
Edit `brain-server\data.json` with your actual goals and life context.

### 4. Install the Cowork plugin
Open [Claude Cowork](https://claude.ai), then install `cowork-plugin\joshs-brain.plugin` by dragging it into the app.

### 5. Start the servers
Double-click `startup\START-SILENT.vbs` to start all servers in the background.

**Or add to Windows startup** (recommended): Copy `startup\START-SILENT.vbs` to:
```
C:\Users\YourName\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\
```

### 6. Test it
In Claude Cowork, say: **"check my brain"** — Claude will read your context and respond with what it knows about you.

## Project Structure

```
ai-brain-os/
├── brain-server/
│   ├── brain.js              ← Brain MCP HTTP server (port 3336)
│   ├── openai-bridge.js      ← OpenAI bridge (port 3337)
│   └── data.example.json     ← Template brain data
├── cowork-plugin/            ← Claude Cowork plugin source
├── startup/
│   └── START-SILENT.vbs      ← Windows auto-start script
├── .env.example              ← API key template
└── README.md
```

## Life Areas

The brain tracks 6 life areas: **Health · Family · Creator · Finance · Mind · Home**

Each area has a goal, priority, notes, wins, and a focus item. Claude reads these before every conversation so advice is always grounded in your actual life.

## Adding New AI Bridges

Each bridge follows the same pattern as `openai-bridge.js`:
- Node.js HTTP server
- Exposes MCP tools at `/mcp`
- Health check at `/health`
- Logs activity to shared `activity.json`

## Built By

Joshua Rarick — Father, Husband, Creator  
[Rally Point Automations](https://github.com/joshuararick/rally-point)

---

*This is v0.1 — built in one session, tested in production.*

#!/usr/bin/env node
const http = require('http');
const fs = require('fs');

const PORT = 3336;
const DATA_FILE = 'C:/Users/joshu/Brain of Ai/brain-server/data.json';

const DEFAULTS = {
  identity: { name: 'Josh', roles: ['Father', 'Husband', 'Creator'] },
  life_areas: {
    Health:  { goal: 'Stay strong and energized so I can show up for my family', priority: 3 },
    Family:  { goal: 'Be fully present with my kids and wife every day', priority: 1 },
    Creator: { goal: 'Build a sustainable creative business that funds our life', priority: 2 },
    Finance: { goal: 'Build 6-month emergency fund and grow investments', priority: 3 },
    Mind:    { goal: '', priority: 4 },
    Home:    { goal: '', priority: 5 }
  },
  priorities: [], wins: [], notes: [],
  focus: { date: '', text: '', area: '' },
  weekly_theme: 'Getting systems in place',
  context: {}
};

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e) {}
  }
  return JSON.parse(JSON.stringify(DEFAULTS));
}
function save(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }
function today() { return new Date().toISOString().slice(0, 10); }
function now() { return new Date().toLocaleString(); }

var TOOLS = [
  { name: 'get_context',       description: "Get Josh's full life context. Call before giving advice.", inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_priorities',    description: 'Get active priorities. Filter by area.', inputSchema: { type: 'object', properties: { area: { type: 'string' } } } },
  { name: 'get_notes',         description: "Get Josh's notes.", inputSchema: { type: 'object', properties: { area: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'get_wins',          description: "Get Josh's logged wins.", inputSchema: { type: 'object', properties: { area: { type: 'string' } } } },
  { name: 'get_focus',         description: "Get today's focus.", inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'set_goal',          description: 'Set a goal for a life area.', inputSchema: { type: 'object', properties: { area: { type: 'string' }, goal: { type: 'string' } }, required: ['area','goal'] } },
  { name: 'add_priority',      description: 'Add a priority.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, area: { type: 'string' }, due: { type: 'string' } }, required: ['text'] } },
  { name: 'complete_priority', description: 'Complete priority by number, logs as win.', inputSchema: { type: 'object', properties: { index: { type: 'number' } }, required: ['index'] } },
  { name: 'add_note',          description: 'Capture a note.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, area: { type: 'string' } }, required: ['text'] } },
  { name: 'log_win',           description: 'Log a win.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, area: { type: 'string' } }, required: ['text'] } },
  { name: 'set_focus',         description: "Set today's focus.", inputSchema: { type: 'object', properties: { text: { type: 'string' }, area: { type: 'string' } }, required: ['text'] } },
  { name: 'set_weekly_theme',  description: "Set the week's theme.", inputSchema: { type: 'object', properties: { theme: { type: 'string' } }, required: ['theme'] } },
  { name: 'set_context',       description: 'Store key-value context.', inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key','value'] } },
  { name: 'brain_status',      description: 'Quick brain summary.', inputSchema: { type: 'object', properties: {}, required: [] } }
];

function runTool(name, args) {
  args = args || {};
  var d = load();
  if (name === 'get_context') {
    var lines = ['# Josh Brain ' + today() + '\nRoles: ' + d.identity.roles.join(', ')];
    if (d.weekly_theme) lines.push('Theme: ' + d.weekly_theme);
    if (d.focus.text && d.focus.date === today()) lines.push('Focus: [' + d.focus.area + '] ' + d.focus.text);
    lines.push('\n## Goals');
    Object.keys(d.life_areas).forEach(function(a) { lines.push('  ' + a + ': ' + (d.life_areas[a].goal || '(none)')); });
    if (d.priorities.length) { lines.push('\n## Priorities'); d.priorities.slice(-10).forEach(function(p,i) { lines.push('  ' + (i+1) + '. [' + (p.area||'-') + '] ' + p.text); }); }
    var wins = d.wins.filter(function(w) { return (w.date||'').slice(0,7) >= today().slice(0,7); }).slice(-5);
    if (wins.length) { lines.push('\n## Wins'); wins.forEach(function(w) { lines.push('  + [' + w.area + '] ' + w.text); }); }
    if (d.notes.length) { lines.push('\n## Notes'); d.notes.slice(-5).forEach(function(n) { lines.push('  [' + n.area + '] ' + n.text); }); }
    if (Object.keys(d.context).length) { lines.push('\n## Context'); Object.keys(d.context).forEach(function(k) { lines.push('  ' + k + ': ' + d.context[k]); }); }
    return lines.join('\n');
  }
  if (name === 'get_priorities') { var items = d.priorities; if (args.area) items = items.filter(function(p) { return (p.area||'').toLowerCase() === args.area.toLowerCase(); }); return items.length ? items.map(function(p,i) { return (i+1)+'. ['+p.area+'] '+p.text; }).join('\n') : 'None.'; }
  if (name === 'get_notes') { var notes = d.notes; if (args.area) notes = notes.filter(function(n) { return (n.area||'').toLowerCase() === args.area.toLowerCase(); }); return notes.slice(-(args.limit||20)).reverse().map(function(n) { return '['+n.area+'] '+n.text; }).join('\n') || 'None.'; }
  if (name === 'get_wins') { var wins2 = d.wins; if (args.area) wins2 = wins2.filter(function(w) { return (w.area||'').toLowerCase() === args.area.toLowerCase(); }); return wins2.slice(-10).reverse().map(function(w) { return '+ ['+w.area+'] '+w.text; }).join('\n') || 'None yet!'; }
  if (name === 'get_focus') { if (!d.focus.text) return 'No focus set.'; return 'Focus: ['+d.focus.area+'] '+d.focus.text; }
  if (name === 'set_goal') { if (!d.life_areas[args.area]) return 'Bad area.'; d.life_areas[args.area].goal = args.goal; save(d); return 'Goal set: '+args.area+': '+args.goal; }
  if (name === 'add_priority') { d.priorities.push({ text: args.text, area: args.area||'General', due: args.due||'', created: today() }); save(d); return 'Added: '+args.text; }
  if (name === 'complete_priority') { if (args.index < 1 || args.index > d.priorities.length) return 'Bad index.'; var item = d.priorities.splice(args.index-1,1)[0]; d.wins.push({ text: item.text, area: item.area, date: today() }); save(d); return 'Done: '+item.text; }
  if (name === 'add_note') { d.notes.push({ text: args.text, area: args.area||'General', date: now() }); save(d); return 'Saved.'; }
  if (name === 'log_win') { d.wins.push({ text: args.text, area: args.area||'General', date: today() }); save(d); return 'Win: '+args.text; }
  if (name === 'set_focus') { d.focus = { text: args.text, area: args.area||'General', date: today() }; save(d); return 'Focus: '+args.text; }
  if (name === 'set_weekly_theme') { d.weekly_theme = args.theme; save(d); return 'Theme: '+args.theme; }
  if (name === 'set_context') { d.context[args.key] = args.value; save(d); return args.key+'='+args.value; }
  if (name === 'brain_status') { var g = Object.values(d.life_areas).filter(function(a){return a.goal;}).length; return 'Goals:'+g+'/6 Priorities:'+d.priorities.length+' Notes:'+d.notes.length+' Wins:'+d.wins.length+' Theme:'+(d.weekly_theme||'none'); }
  return 'Unknown: '+name;
}

function handleMessage(msg) {
  var id = msg.id, method = msg.method, params = msg.params || {};
  if (method === 'initialize') return { jsonrpc: '2.0', id: id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'joshs-brain', version: '1.0.0' } } };
  if (method === 'ping') return { jsonrpc: '2.0', id: id, result: {} };
  if (method === 'tools/list') return { jsonrpc: '2.0', id: id, result: { tools: TOOLS } };
  if (method === 'tools/call') { var r; try { r = runTool(params.name, params.arguments); } catch(e) { r = 'Error: '+e.message; } return { jsonrpc: '2.0', id: id, result: { content: [{ type: 'text', text: r }] } }; }
  if (id !== undefined) return { jsonrpc: '2.0', id: id, error: { code: -32601, message: 'Not found: '+method } };
  return null;
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/health' && req.method === 'GET') { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({status:'ok',port:PORT})); return; }
  if ((req.url === '/mcp' || req.url === '/') && req.method === 'POST') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var msg = JSON.parse(body);
        var response = Array.isArray(msg) ? msg.map(handleMessage).filter(Boolean) : handleMessage(msg);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(response));
      } catch(e) { res.writeHead(400); res.end('Bad request'); }
    });
    return;
  }
  if ((req.url === '/mcp' || req.url === '/') && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    res.write('event: endpoint\ndata: /mcp\n\n');
    var iv = setInterval(function() { res.write(': ping\n\n'); }, 15000);
    req.on('close', function() { clearInterval(iv); });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', function() {
  process.stderr.write("Josh's Brain MCP running at http://127.0.0.1:" + PORT + "/mcp\n");
});
server.on('error', function(e) { if (e.code === 'EADDRINUSE') { process.stderr.write('Port '+PORT+' in use\n'); process.exit(1); } throw e; });

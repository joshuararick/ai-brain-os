#!/usr/bin/env node
// Grok Bridge MCP — HTTP server, port 3340 (xAI API)
const http = require('http');
const https = require('https');
const fs = require('fs');
// Load ../.env (git-ignored) so API keys never live in source
try { fs.readFileSync(require("path").join(__dirname, "..", ".env"), "utf8").split(/\r?\n/).forEach(function (l) { var m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }); } catch (e) {}

const PORT = 3340;
const API_KEY = process.env.GROK_API_KEY || '';
const ACTIVITY_LOG = 'C:/Users/joshu/Brain of Ai/brain-server/activity.json';

function logActivity(agent, action, detail) {
  var log = [];
  try { log = JSON.parse(fs.readFileSync(ACTIVITY_LOG, 'utf8')); } catch(e) {}
  log.unshift({ timestamp: new Date().toISOString(), agent, action, detail: detail || '' });
  if (log.length > 100) log = log.slice(0, 100);
  try { fs.writeFileSync(ACTIVITY_LOG, JSON.stringify(log, null, 2)); } catch(e) {}
}

function grokRequest(model, messages, cb) {
  var data = JSON.stringify({ model: model, messages: messages, max_tokens: 2000 });
  var options = {
    hostname: 'api.x.ai',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  var req = https.request(options, function(res) {
    var responseData = '';
    res.on('data', function(c) { responseData += c; });
    res.on('end', function() {
      try {
        var parsed = JSON.parse(responseData);
        if (parsed.error) cb(parsed.error.message, null);
        else cb(null, parsed);
      } catch(e) { cb('Parse error: ' + responseData.slice(0, 200), null); }
    });
  });
  req.on('error', function(e) { cb(e.message, null); });
  req.write(data);
  req.end();
}

var TOOLS = [
  { name: 'grok_chat', description: 'Chat with Grok (xAI). Great for real-time info, X/Twitter insights, and a different AI perspective with a bold personality.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, model: { type: 'string', description: 'grok-3 (default) or grok-3-mini' } }, required: ['message'] } },
  { name: 'grok_think', description: 'Use Grok with deep reasoning mode for complex analysis.', inputSchema: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] } },
  { name: 'check_status', description: 'Check if Grok API key is configured.', inputSchema: { type: 'object', properties: {}, required: [] } }
];

function runTool(name, args, cb) {
  args = args || {};
  if (name === 'check_status') {
    cb(API_KEY ? 'Grok key configured. Grok-3 ready.' : 'No GROK_API_KEY set. Get it at console.x.ai');
    return;
  }
  if (!API_KEY) { cb('No GROK_API_KEY configured.'); return; }
  if (name === 'grok_chat') {
    var model = args.model || 'grok-3';
    logActivity('Claude', 'routing to Grok', args.message.slice(0, 80));
    grokRequest(model, [{ role: 'user', content: args.message }], function(err, res) {
      if (err) { cb('Error: ' + err); return; }
      var reply = res.choices[0].message.content;
      logActivity('Grok', 'responded', reply.slice(0, 80));
      cb('[Grok ' + model + ']\n\n' + reply);
    });
    return;
  }
  if (name === 'grok_think') {
    logActivity('Claude', 'Grok deep think', args.problem.slice(0, 80));
    grokRequest('grok-3', [
      { role: 'system', content: 'Think through this step by step with full reasoning before answering.' },
      { role: 'user', content: args.problem }
    ], function(err, res) {
      if (err) { cb('Error: ' + err); return; }
      var reply = res.choices[0].message.content;
      logActivity('Grok Think', 'complete', reply.slice(0, 80));
      cb('[Grok Deep Think]\n\n' + reply);
    });
    return;
  }
  cb('Unknown tool: ' + name);
}

function handleMessage(msg, cb) {
  var id = msg.id, method = msg.method, params = msg.params || {};
  if (method === 'initialize') { cb({ jsonrpc: '2.0', id: id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'grok-bridge', version: '1.0.0' } } }); return; }
  if (method === 'ping') { cb({ jsonrpc: '2.0', id: id, result: {} }); return; }
  if (method === 'tools/list') { cb({ jsonrpc: '2.0', id: id, result: { tools: TOOLS } }); return; }
  if (method === 'tools/call') {
    runTool(params.name, params.arguments, function(result) {
      cb({ jsonrpc: '2.0', id: id, result: { content: [{ type: 'text', text: result }] } });
    });
    return;
  }
  if (id !== undefined) cb({ jsonrpc: '2.0', id: id, error: { code: -32601, message: 'Not found: ' + method } });
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url === '/health' && req.method === 'GET') { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({status:'ok',port:PORT,ai:'grok'})); return; }
  if ((req.url === '/mcp' || req.url === '/') && req.method === 'POST') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try { handleMessage(JSON.parse(body), function(r) { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(r)); }); }
      catch(e) { res.writeHead(400); res.end('Bad request'); }
    });
    return;
  }
  if ((req.url === '/mcp' || req.url === '/') && req.method === 'GET') {
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    res.write('event: endpoint\ndata: /mcp\n\n');
    var iv = setInterval(function() { res.write(': ping\n\n'); }, 15000);
    req.on('close', function() { clearInterval(iv); });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', function() {
  process.stderr.write('Grok Bridge running at http://127.0.0.1:' + PORT + '/mcp\n');
});
server.on('error', function(e) { if (e.code === 'EADDRINUSE') { process.exit(1); } throw e; });

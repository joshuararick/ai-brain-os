#!/usr/bin/env node
// Gemini Bridge MCP — HTTP server, port 3339
const http = require('http');
const https = require('https');
const fs = require('fs');
// Load keys from ../.env, then the master key file (~/.secrets/api-keys.env); never from source
[require("path").join(__dirname, "..", ".env"), require("path").join(require("os").homedir(), ".secrets", "api-keys.env")].forEach(function (f) {
  try { fs.readFileSync(f, "utf8").split(/\r?\n/).forEach(function (l) { var m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && m[2].trim() && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }); } catch (e) {}
});

const PORT = 3339;
const API_KEY = process.env.GEMINI_API_KEY || '';
const ACTIVITY_LOG = 'C:/Users/joshu/Brain of Ai/brain-server/activity.json';

function logActivity(agent, action, detail) {
  var log = [];
  try { log = JSON.parse(fs.readFileSync(ACTIVITY_LOG, 'utf8')); } catch(e) {}
  log.unshift({ timestamp: new Date().toISOString(), agent, action, detail: detail || '' });
  if (log.length > 100) log = log.slice(0, 100);
  try { fs.writeFileSync(ACTIVITY_LOG, JSON.stringify(log, null, 2)); } catch(e) {}
}

// Models are tried in order; Google retires model IDs often and the free tier has no Pro quota
var DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
var FALLBACK_MODELS = [DEFAULT_MODEL, 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
var RETRYABLE = [404, 429, 500, 503];

function geminiRequest(model, prompt, maxTokens, cb) {
  var data = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } });
  var options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: '/v1beta/models/' + model + ':generateContent?key=' + API_KEY,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  var req = https.request(options, function(res) {
    var responseData = '';
    res.on('data', function(c) { responseData += c; });
    res.on('end', function() {
      try {
        var parsed = JSON.parse(responseData);
        if (parsed.error) { cb({ status: res.statusCode, message: parsed.error.message }, null); return; }
        var parts = (((parsed.candidates || [])[0] || {}).content || {}).parts || [];
        var text = parts.filter(function(p) { return p.text && !p.thought; }).map(function(p) { return p.text; }).join('');
        if (!text) cb({ status: 0, message: 'Empty response (finishReason: ' + (((parsed.candidates || [])[0] || {}).finishReason || 'unknown') + ')' }, null);
        else cb(null, text);
      } catch(e) { cb({ status: res.statusCode, message: 'Parse error: ' + responseData.slice(0, 200) }, null); }
    });
  });
  req.on('error', function(e) { cb({ status: 0, message: e.message }, null); });
  req.write(data);
  req.end();
}

// Try the requested model, then the fallbacks, skipping retired/over-quota/overloaded models
function geminiWithFallback(firstModel, prompt, maxTokens, cb) {
  var models = [firstModel].concat(FALLBACK_MODELS.filter(function(m) { return m !== firstModel; }));
  var errors = [];
  (function next(i) {
    if (i >= models.length) { cb(errors.join(' | '), null, null); return; }
    geminiRequest(models[i], prompt, maxTokens, function(err, text) {
      if (!err) { cb(null, text, models[i]); return; }
      errors.push(models[i] + ': ' + err.message.slice(0, 120));
      if (RETRYABLE.indexOf(err.status) === -1) { cb(errors.join(' | '), null, null); return; }
      next(i + 1);
    });
  })(0);
}

var TOOLS = [
  { name: 'gemini_chat', description: 'Chat with Google Gemini Flash. Great for analysis, long documents, multimodal tasks, and as a third AI perspective.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, model: { type: 'string', description: DEFAULT_MODEL + ' (default), gemini-flash-latest, gemini-3.8-flash. Falls back automatically if a model is unavailable.' } }, required: ['message'] } },
  { name: 'gemini_think', description: 'Use Gemini with extended thinking for complex reasoning tasks.', inputSchema: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] } },
  { name: 'check_status', description: 'Check if Gemini API key is configured.', inputSchema: { type: 'object', properties: {}, required: [] } }
];

function runTool(name, args, cb) {
  args = args || {};
  if (name === 'check_status') {
    cb(API_KEY ? 'Gemini key configured. Default model: ' + DEFAULT_MODEL + '.' : 'No GEMINI_API_KEY set.');
    return;
  }
  if (!API_KEY) { cb('No GEMINI_API_KEY configured.'); return; }
  if (name === 'gemini_chat') {
    var model = args.model || DEFAULT_MODEL;
    logActivity('Claude', 'routing to Gemini ' + model, args.message.slice(0, 80));
    geminiWithFallback(model, args.message, 4000, function(err, reply, usedModel) {
      if (err) { cb('Error: ' + err); return; }
      logActivity('Gemini', 'responded', reply.slice(0, 80));
      cb('[Gemini ' + usedModel + ']\n\n' + reply);
    });
    return;
  }
  if (name === 'gemini_think') {
    logActivity('Claude', 'Gemini deep think', args.problem.slice(0, 80));
    // Current Flash models reason internally; give them room for thinking plus the answer
    geminiWithFallback(DEFAULT_MODEL, args.problem, 16000, function(err, reply, usedModel) {
      if (err) { cb('Error: ' + err); return; }
      logActivity('Gemini Think', 'complete', reply.slice(0, 80));
      cb('[Gemini Thinking: ' + usedModel + ']\n\n' + reply);
    });
    return;
  }
  cb('Unknown tool: ' + name);
}

function handleMessage(msg, cb) {
  var id = msg.id, method = msg.method, params = msg.params || {};
  if (method === 'initialize') { cb({ jsonrpc: '2.0', id: id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'gemini-bridge', version: '1.0.0' } } }); return; }
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
  if (req.url === '/health' && req.method === 'GET') { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({status:'ok',port:PORT,ai:'gemini'})); return; }
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
  process.stderr.write('Gemini Bridge running at http://127.0.0.1:' + PORT + '/mcp\n');
});
server.on('error', function(e) { if (e.code === 'EADDRINUSE') { process.exit(1); } throw e; });

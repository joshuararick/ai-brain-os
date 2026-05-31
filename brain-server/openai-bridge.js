#!/usr/bin/env node
// Josh's OpenAI Bridge MCP — HTTP server, zero dependencies, port 3337
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3337;
const API_KEY = process.env.OPENAI_API_KEY || '';
const ACTIVITY_LOG = 'C:/Users/joshu/Brain of Ai/brain-server/activity.json';

function logActivity(agent, action, detail) {
  var log = [];
  try { log = JSON.parse(fs.readFileSync(ACTIVITY_LOG, 'utf8')); } catch(e) {}
  log.unshift({ timestamp: new Date().toISOString(), agent, action, detail: detail || '' });
  if (log.length > 100) log = log.slice(0, 100);
  try { fs.writeFileSync(ACTIVITY_LOG, JSON.stringify(log, null, 2)); } catch(e) {}
}

function openaiRequest(endpoint, body, cb) {
  var data = JSON.stringify(body);
  var options = {
    hostname: 'api.openai.com',
    port: 443,
    path: endpoint,
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
  { name: 'gpt4_chat', description: 'Send a message to GPT-4o. Use for reasoning, writing, analysis, or second opinions.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, system: { type: 'string' }, model: { type: 'string' } }, required: ['message'] } },
  { name: 'codex_code', description: 'Use GPT-4o for code generation, debugging, or technical tasks.', inputSchema: { type: 'object', properties: { task: { type: 'string' }, language: { type: 'string' }, context: { type: 'string' } }, required: ['task'] } },
  { name: 'o1_think', description: 'Use o1-mini for deep reasoning, complex problems, math, or logic.', inputSchema: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] } },
  { name: 'check_status', description: 'Check if OpenAI API key is configured.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_activity_log', description: 'Get recent AI agent activity log.', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } }
];

function runTool(name, args, cb) {
  args = args || {};
  if (name === 'check_status') {
    cb(API_KEY ? 'OpenAI key configured (' + API_KEY.slice(0,10) + '...). GPT-4o, Codex, o1 ready.' : 'No API key. Set OPENAI_API_KEY.');
    return;
  }
  if (name === 'get_activity_log') {
    var log = [];
    try { log = JSON.parse(fs.readFileSync(ACTIVITY_LOG, 'utf8')); } catch(e) {}
    var limit = args.limit || 20;
    var lines = log.slice(0, limit).map(function(e) {
      return '[' + new Date(e.timestamp).toLocaleTimeString() + '] ' + e.agent + ': ' + e.action + (e.detail ? ' — ' + e.detail : '');
    });
    cb(lines.length ? lines.join('\n') : 'No activity yet.');
    return;
  }
  if (!API_KEY) { cb('No OPENAI_API_KEY configured.'); return; }
  if (name === 'gpt4_chat') {
    var model = args.model || 'gpt-4o';
    var messages = [];
    if (args.system) messages.push({ role: 'system', content: args.system });
    messages.push({ role: 'user', content: args.message });
    logActivity('Claude', 'routing to ' + model, args.message.slice(0, 80));
    openaiRequest('/v1/chat/completions', { model: model, messages: messages, max_tokens: 2000 }, function(err, res) {
      if (err) { cb('Error: ' + err); return; }
      var reply = res.choices[0].message.content;
      logActivity(model, 'responded', reply.slice(0, 80));
      cb('[' + model + ']\n\n' + reply);
    });
    return;
  }
  if (name === 'codex_code') {
    var sys = 'You are an expert software engineer. Write clean, well-commented code.' + (args.language ? ' Use ' + args.language + '.' : '');
    var msg = args.task + (args.context ? '\n\nContext:\n' + args.context : '');
    logActivity('Claude', 'code task -> GPT-4o', args.task.slice(0, 80));
    openaiRequest('/v1/chat/completions', { model: 'gpt-4o', messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }], max_tokens: 4000 }, function(err, res) {
      if (err) { cb('Error: ' + err); return; }
      logActivity('GPT-4o', 'code generated', args.task.slice(0, 80));
      cb('[GPT-4o Code]\n\n' + res.choices[0].message.content);
    });
    return;
  }
  if (name === 'o1_think') {
    logActivity('Claude', 'deep reasoning -> o1-mini', args.problem.slice(0, 80));
    openaiRequest('/v1/chat/completions', { model: 'o1-mini', messages: [{ role: 'user', content: args.problem }], max_completion_tokens: 4000 }, function(err, res) {
      if (err) { cb('Error: ' + err); return; }
      logActivity('o1-mini', 'reasoning complete', res.choices[0].message.content.slice(0, 80));
      cb('[o1-mini]\n\n' + res.choices[0].message.content);
    });
    return;
  }
  cb('Unknown tool: ' + name);
}

function handleMessage(msg, cb) {
  var id = msg.id, method = msg.method, params = msg.params || {};
  if (method === 'initialize') { cb({ jsonrpc: '2.0', id: id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'openai-bridge', version: '1.0.0' } } }); return; }
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
  if (req.url === '/health' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok', port: PORT, openai: !!API_KEY })); return; }
  if ((req.url === '/mcp' || req.url === '/') && req.method === 'POST') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        handleMessage(JSON.parse(body), function(response) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        });
      } catch(e) { res.writeHead(400); res.end('Bad request'); }
    });
    return;
  }
  if ((req.url === '/mcp' || req.url === '/') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write('event: endpoint\ndata: /mcp\n\n');
    var iv = setInterval(function() { res.write(': ping\n\n'); }, 15000);
    req.on('close', function() { clearInterval(iv); });
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', function() {
  process.stderr.write('OpenAI Bridge MCP running at http://127.0.0.1:' + PORT + '/mcp\n');
  process.stderr.write('OpenAI key: ' + (API_KEY ? 'configured' : 'MISSING') + '\n');
});
server.on('error', function(e) { if (e.code === 'EADDRINUSE') { process.stderr.write('Port ' + PORT + ' in use\n'); process.exit(1); } throw e; });

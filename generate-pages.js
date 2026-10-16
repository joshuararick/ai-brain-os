#!/usr/bin/env node
/**
 * AI Page Generation Engine
 * Reads projects.json → calls OpenAI → writes content.json for each project
 * Logs all activity to activity.json for human tracking
 *
 * Usage:
 *   node generate-pages.js              ← regenerate all projects
 *   node generate-pages.js phoenix-fence ← single project
 *   node generate-pages.js --dry-run    ← show what would happen, no writes
 *
 * Schedule: Add to Windows Task Scheduler or run via START-ALL.bat
 */

const fs   = require('fs');
const path = require('path');
const http = require('https');

const BASE = __dirname;
const PROJECTS_FILE = path.join(BASE, 'projects.json');
const ACTIVITY_FILE = path.join(BASE, 'activity.json');

// ── Load .env, then the master key file (no dotenv dependency) ────────────
function loadEnv() {
  const env = {};
  const files = [path.join(__dirname, '.env'), path.join(require('os').homedir(), '.secrets', 'api-keys.env')];
  for (const envPath of files) {
    if (!fs.existsSync(envPath)) continue;
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].trim();
    });
  }
  return env;
}

// ── Activity log ───────────────────────────────────────────────────────────
function logActivity(entry) {
  let data = { log: [] };
  if (fs.existsSync(ACTIVITY_FILE)) {
    try { data = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8')); } catch(e) {}
  }
  data.log.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
    ts_human:  new Date().toLocaleString()
  });
  // Keep last 500 entries
  data.log = data.log.slice(0, 500);
  fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(data, null, 2));
}

// ── OpenAI call ────────────────────────────────────────────────────────────
function callOpenAI(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert copywriter for local businesses and personal brands. Write compelling, authentic content. Always respond with valid JSON only — no markdown, no code blocks, just raw JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text = json.choices[0].message.content.trim();
          resolve(JSON.parse(text));
        } catch(e) {
          reject(new Error('Parse error: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Grok call (xAI) ───────────────────────────────────────────────────────
function callGrok(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'grok-3',
      messages: [
        { role: 'system', content: 'You are a bold, authentic copywriter. Real voice, no corporate speak. Always respond with valid JSON only — no markdown, no code blocks, just raw JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500
    });

    const options = {
      hostname: 'api.x.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text = json.choices[0].message.content.trim();
          resolve(JSON.parse(text));
        } catch(e) {
          reject(new Error('Grok parse error: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Fallback content (no API key) ─────────────────────────────────────────
function generateFallbackContent(project) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  if (project.type === 'business') {
    return {
      hero: {
        headline: `${project.name} — Built on Quality`,
        subheadline: `Serving ${project.location} with pride. ${project.services.slice(0,2).join(', ')}, and more.`,
        cta: 'Get a Free Quote'
      },
      about: {
        heading: `Why Choose ${project.name}?`,
        body: `We believe your fence is more than a boundary — it's the first thing people see. That's why we do every job like it's our own yard. Local, reliable, and built to last.`
      },
      services: project.services.map(s => ({
        name: s.charAt(0).toUpperCase() + s.slice(1),
        description: `Professional ${s} installation and repair. Quality materials, expert craftsmanship.`
      })),
      testimonial: {
        quote: "Best fence company I've ever used. They were on time, clean, and the quality is outstanding.",
        author: "Happy Customer"
      },
      cta_section: {
        heading: 'Ready to Build Something Great?',
        body: 'Get a free estimate today. No pressure, no surprises.',
        button: 'Request a Quote'
      },
      meta: { generated_by: 'fallback-engine', generated_at: date, version: 1 }
    };
  }

  if (project.type === 'personal') {
    return {
      hero: {
        headline: 'Josh Rarick',
        subheadline: 'Father. Husband. Builder of things that matter.',
        cta: "See What I'm Building"
      },
      about: {
        heading: 'What I Do',
        body: "I build AI systems, automations, and tools that make life run better. Currently obsessed with multi-agent systems that do the boring stuff so humans can do the meaningful stuff."
      },
      projects: [
        { name: 'AI Brain OS', description: 'A personal operating system connecting Claude, GPT-4o, Grok, and Gemini through shared memory.' },
        { name: 'Phoenix Fence', description: 'Running a fence business powered by AI-generated landing pages and automation.' },
        { name: 'Blue Ridge Fence', description: 'Expanding the fence operation to the Blue Ridge region.' }
      ],
      cta_section: {
        heading: "Let's Build Something",
        body: "Got an idea? I'm always open to interesting projects.",
        button: 'Get in Touch'
      },
      meta: { generated_by: 'fallback-engine', generated_at: date, version: 1 }
    };
  }
}

// ── Build AI prompt for a project ─────────────────────────────────────────
function buildPrompt(project) {
  if (project.type === 'business') {
    return `Generate fresh landing page content for "${project.name}", a ${project.description} in ${project.location}.
Services: ${project.services.join(', ')}.
Tone: ${project.tone}.
Today's date: ${new Date().toLocaleDateString()}.

Return a JSON object with this exact structure:
{
  "hero": { "headline": "...", "subheadline": "...", "cta": "..." },
  "about": { "heading": "...", "body": "..." },
  "services": [{ "name": "...", "description": "..." }],
  "testimonial": { "quote": "...", "author": "..." },
  "cta_section": { "heading": "...", "body": "...", "button": "..." },
  "meta": { "generated_by": "gpt-4o-mini", "generated_at": "${new Date().toLocaleDateString()}", "version": 1 }
}`;
  }

  return `Generate a personal brand landing page for Josh Rarick — Father, Husband, Builder.
He builds AI systems and automation tools. He runs fence businesses powered by AI.
Tone: authentic, direct, builder mindset. Not corporate. Real.
Today: ${new Date().toLocaleDateString()}.

Return JSON:
{
  "hero": { "headline": "...", "subheadline": "...", "cta": "..." },
  "about": { "heading": "...", "body": "..." },
  "projects": [{ "name": "...", "description": "..." }],
  "cta_section": { "heading": "...", "body": "...", "button": "..." },
  "meta": { "generated_by": "gpt-4o-mini", "generated_at": "${new Date().toLocaleDateString()}", "version": 1 }
}`;
}

// ── Generate content for one project ──────────────────────────────────────
async function generateProject(project, env, dryRun) {
  const outDir  = path.join(BASE, project.outputDir);
  const outFile = path.join(outDir, 'content.json');

  console.log(`\n[${project.name}] Starting generation...`);

  // Load existing content to bump version
  let existing = null;
  if (fs.existsSync(outFile)) {
    try { existing = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch(e) {}
  }
  const prevVersion = existing?.meta?.version || 0;

  let content;
  let agent = 'fallback-engine';

  const preferredAgent = project.agent || 'openai';

  if (preferredAgent === 'grok' && env.GROK_API_KEY) {
    try {
      console.log(`  → Calling Grok-3 (xAI)...`);
      content = await callGrok(env.GROK_API_KEY, buildPrompt(project));
      content.meta = content.meta || {};
      content.meta.generated_by = 'grok-3';
      content.meta.generated_at = new Date().toLocaleDateString();
      content.meta.version = prevVersion + 1;
      agent = 'grok-3';
      console.log(`  ✓ Grok content generated`);
    } catch(e) {
      console.log(`  ⚠ Grok failed (${e.message}) — falling back to OpenAI`);
      // fall through to OpenAI below
      if (env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'sk-proj-your-key-here') {
        try {
          content = await callOpenAI(env.OPENAI_API_KEY, buildPrompt(project));
          content.meta = content.meta || {};
          content.meta.generated_by = 'gpt-4o-mini';
          content.meta.generated_at = new Date().toLocaleDateString();
          content.meta.version = prevVersion + 1;
          agent = 'gpt-4o-mini';
        } catch(e2) {
          content = generateFallbackContent(project);
          content.meta.version = prevVersion + 1;
        }
      } else {
        content = generateFallbackContent(project);
        content.meta.version = prevVersion + 1;
      }
    }
  } else if (env.OPENAI_API_KEY && env.OPENAI_API_KEY !== 'sk-proj-your-key-here') {
    try {
      console.log(`  → Calling GPT-4o-mini...`);
      content = await callOpenAI(env.OPENAI_API_KEY, buildPrompt(project));
      content.meta = content.meta || {};
      content.meta.generated_by = 'gpt-4o-mini';
      content.meta.generated_at = new Date().toLocaleDateString();
      content.meta.version = prevVersion + 1;
      agent = 'gpt-4o-mini';
      console.log(`  ✓ AI content generated`);
    } catch(e) {
      console.log(`  ⚠ OpenAI failed (${e.message}) — using fallback`);
      content = generateFallbackContent(project);
      content.meta.version = prevVersion + 1;
    }
  } else {
    console.log(`  → No API key — using fallback content engine`);
    content = generateFallbackContent(project);
    content.meta.version = prevVersion + 1;
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would write to: ${outFile}`);
    console.log(`  Preview:`, JSON.stringify(content.hero, null, 2));
    return;
  }

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(outFile, JSON.stringify(content, null, 2));
  console.log(`  ✓ Written: ${outFile}`);

  logActivity({
    project_id:   project.id,
    project_name: project.name,
    agent:        agent,
    action:       'content_generated',
    version:      content.meta.version,
    headline:     content.hero?.headline || '(no headline)',
    file:         outFile
  });

  return content;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const filter  = args.find(a => !a.startsWith('--'));
  const env     = loadEnv();

  console.log('═══════════════════════════════════════');
  console.log('  AI Page Generation Engine');
  console.log(`  ${new Date().toLocaleString()}`);
  if (dryRun) console.log('  MODE: DRY RUN');
  console.log('═══════════════════════════════════════');

  const { projects } = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  const toGenerate   = filter ? projects.filter(p => p.id === filter || p.name.toLowerCase().includes(filter.toLowerCase())) : projects.filter(p => p.status === 'active');

  if (toGenerate.length === 0) {
    console.log('No matching projects found.');
    process.exit(0);
  }

  console.log(`\nGenerating ${toGenerate.length} project(s)...`);

  for (const project of toGenerate) {
    try {
      await generateProject(project, env, dryRun);
    } catch(e) {
      console.error(`  ✗ Error on ${project.name}:`, e.message);
      logActivity({
        project_id:   project.id,
        project_name: project.name,
        agent:        'system',
        action:       'generation_failed',
        error:        e.message
      });
    }
  }

  console.log('\n✓ Done. Activity logged to activity.json');
  console.log('  Humans can view at: Brain of Ai/pages/*/index.html');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

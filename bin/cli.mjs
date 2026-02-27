#!/usr/bin/env node
// claude-wrapped CLI
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { loadProject } from '../src/extract.mjs';
import { analyze } from '../src/analyze.mjs';
import { getComparisons } from '../src/comparisons.mjs';
import { render } from '../src/render.mjs';

const args = process.argv.slice(2);

function arg(flag, def = null) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : def;
}

// Return all values for a repeatable flag e.g. --sessions a --sessions b → ['a','b']
function argAll(flag) {
  const vals = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) vals.push(args[i + 1]);
  }
  return vals;
}

function flag(f) { return args.includes(f); }

// List available projects
if (flag('--list')) {
  const claudeProjects = join(homedir(), '.claude', 'projects');
  try {
    const { readdirSync, statSync } = await import('fs');
    const entries = readdirSync(claudeProjects)
      .filter(e => { try { return statSync(join(claudeProjects, e)).isDirectory(); } catch { return false; } });
    console.log(`\n  Projects in ${claudeProjects}:\n`);
    for (const e of entries) {
      const files = existsSync(join(claudeProjects, e))
        ? (await import('fs')).readdirSync(join(claudeProjects, e)).filter(f => f.endsWith('.jsonl')).length
        : 0;
      console.log(`    ${e}  (${files} sessions)`);
    }
    console.log(`\n  Use --pick <name> to include specific projects (repeatable)\n`);
  } catch { console.error('  Could not read ~/.claude/projects'); }
  process.exit(0);
}

if (flag('--help') || flag('-h')) {
  console.log(`
  claude-wrapped — Spotify Wrapped for your Claude Code sessions

  Usage:
    claude-wrapped [options]

  Options:
    --sessions <path>   Path to a project dir with .jsonl files (repeatable)
                        Defaults to ALL projects in ~/.claude/projects/
    --pick    <name>    Pick a specific project by folder name (repeatable)
                        e.g. --pick my-app --pick other-app
    --list              List all available projects and exit
    --project <name>    Display name  (default: folder name or "My Projects")
    --author  <name>    Your name (optional, shown in footer)
    --tagline <text>    Custom subtitle shown in hero
    --out     <dir>     Output directory  (default: ./wrapped)
    --config  <file>    Load options from a JSON config file
    --help              Show this help

  Examples:
    claude-wrapped --list
    claude-wrapped --pick my-saas --project "My SaaS" --author "Jake"
    claude-wrapped --sessions ~/code/project-a --sessions ~/code/project-b
    claude-wrapped --sessions ~/.claude/projects/my-app --out ./site
  `);
  process.exit(0);
}

// Load config file if provided or if claude-wrapped.config.json exists locally
let config = {};
const configFile = arg('--config') || (existsSync('./claude-wrapped.config.json') ? './claude-wrapped.config.json' : null);
if (configFile) {
  try {
    config = JSON.parse(readFileSync(configFile, 'utf8'));
    console.log(`  Config loaded from ${configFile}`);
  } catch (e) {
    console.error(`  Could not read config file: ${configFile}`);
  }
}

// CLI args override config
if (arg('--project')) config.project = arg('--project');
if (arg('--author'))  config.author  = arg('--author');
if (arg('--tagline')) config.tagline = arg('--tagline');
if (arg('--out'))     config.out     = arg('--out');

const outDir      = resolve(config.out || './wrapped');
const sessionsArg = arg('--sessions') || config.sessions;

// Resolve sessions path(s)
let sessionsDirs = [];
const claudeProjects = join(homedir(), '.claude', 'projects');

const multiSessions = argAll('--sessions');
const picks         = argAll('--pick').concat(argAll('-p'));

if (multiSessions.length > 0) {
  // Explicit --sessions flags (repeatable)
  sessionsDirs = multiSessions.map(p => resolve(p.replace('~', homedir())));
} else if (picks.length > 0) {
  // --pick by folder name
  sessionsDirs = picks.map(name => join(claudeProjects, name));
} else if (sessionsArg) {
  // Single legacy --sessions value from config
  sessionsDirs = [resolve(sessionsArg.replace('~', homedir()))];
} else {
  // Auto-detect all projects
  try {
    const { readdirSync, statSync } = await import('fs');
    const entries = readdirSync(claudeProjects);
    sessionsDirs = entries
      .map(e => join(claudeProjects, e))
      .filter(p => { try { return statSync(p).isDirectory(); } catch { return false; } });
    console.log(`  Found ${sessionsDirs.length} project(s) in ${claudeProjects}`);
  } catch {
    console.error(`  Could not find ~/.claude/projects — use --sessions <path> or --pick <name>`);
    process.exit(1);
  }
}

// Load all sessions
console.log(`\n  Loading sessions...`);
let allSessions = [];
for (const dir of sessionsDirs) {
  try {
    const sessions = await loadProject(dir);
    allSessions = allSessions.concat(sessions);
    process.stdout.write(`  ✓ ${dir.split(/[/\\]/).pop()} — ${sessions.length} sessions\n`);
  } catch (e) {
    process.stdout.write(`  ✗ ${dir.split(/[/\\]/).pop()} — skipped (${e.message})\n`);
  }
}

if (allSessions.length === 0) {
  console.error('\n  No sessions found. Check your --sessions path.\n');
  process.exit(1);
}

allSessions.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

// Derive project name from folder if not set
if (!config.project && sessionsArg) {
  config.project = sessionsArg.split(/[/\\]/).pop().replace(/^C--/, '').replace(/-/g, ' ');
}
config.project = config.project || 'My Project';

// Analyze + render
console.log(`\n  Analyzing ${allSessions.length} sessions...`);
const stats       = analyze(allSessions);
const comparisons = getComparisons(stats);

console.log(`  Rendering...`);
const html = render(stats, comparisons, config);

// Write output
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html, 'utf8');

const sizeKB = Math.round(html.length / 1024);
console.log(`\n  ✓ Built: ${join(outDir, 'index.html')} ${sizeKB}KB`);
console.log(`  Open: file://${join(outDir, 'index.html')}\n`);

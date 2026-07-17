#!/usr/bin/env node
/**
 * doc-graph.js — regenerate auto-generated regions in docs/SYSTEMS.md
 *
 * Per Rule 7 + Rule 9 (PROTOCOLS/doc-updates-on-ship.md):
 *   1. Use madge to parse ES module import graph from src/**.
 *   2. Read Module(s) from every docs/SYSTEMS/<sys>/README.md.
 *   3. Apply Rule 10 ownership: plain path | (scope: name) | (meta: orchestration).
 *   4. Build system→system call graph (skip outward edges from meta:orchestration files).
 *   5. Atomic-write the diagram + table into SYSTEMS.md between markers.
 *
 * Errors: file in two Module(s) without (scope: ...) qualifier → exit 1.
 * Tolerant of pre-Phase-6 state: missing SYSTEMS.md / SYSTEMS/ → exit 0 with note.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const SYSTEMS_MD = join(REPO_ROOT, 'docs', 'SYSTEMS.md');
const SYSTEMS_DIR = join(REPO_ROOT, 'docs', 'SYSTEMS');
const SRC_DIR = join(REPO_ROOT, 'src');

const START_GRAPH = '<!-- AUTO-GENERATED: graph (npm run doc-graph) -->';
const END_GRAPH = '<!-- /AUTO-GENERATED -->';
const START_TABLE = '<!-- AUTO-GENERATED: table (npm run doc-graph) -->';
const END_TABLE = '<!-- /AUTO-GENERATED -->';

// ---- Pre-flight: tolerate pre-Phase-6 state ----

if (!existsSync(SYSTEMS_MD)) {
  console.log('docs/SYSTEMS.md not found — nothing to update (expected pre-Phase-6).');
  process.exit(0);
}

if (!existsSync(SYSTEMS_DIR)) {
  console.log('docs/SYSTEMS/ not found — nothing to update.');
  process.exit(0);
}

// ---- Parse Module(s) sections from all SYSTEMS/<sys>/README.md ----

const fileToSystem = new Map();        // 'src/foo.js' (scope?) → {system, scope?, meta?}
const orchestrationFiles = new Set();  // files flagged meta: orchestration
const systems = [];

for (const entry of readdirSync(SYSTEMS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const slug = entry.name;
  const readmePath = join(SYSTEMS_DIR, slug, 'README.md');
  if (!existsSync(readmePath)) continue;

  systems.push(slug);
  const text = readFileSync(readmePath, 'utf8');

  // Find Module(s) section
  // NB: the terminator must be next-heading or TRUE end-of-string — a bare `$` under /m
  // matches every line end, truncating the captured section to its first line (latent bug,
  // unexercised while app-shell's one-module README was the only system; caught 2026-07-14
  // when the 24-module worldengine README parsed as zero modules).
  const moduleMatch = text.match(/^##\s+Module\(s\)\s*\n([\s\S]*?)(?=\n##\s|\n# |$(?![\s\S]))/m);
  if (!moduleMatch) continue;

  const moduleBlock = moduleMatch[1];
  const lineRe = /^-\s+`([^`]+)`(?:\s+\(([^)]+)\))?\s*$/gm;
  let m;
  while ((m = lineRe.exec(moduleBlock)) !== null) {
    const filePath = m[1].trim();
    const qualifier = m[2]?.trim() || null;

    let scope = null;
    let meta = null;
    if (qualifier) {
      const scopeMatch = qualifier.match(/^scope:\s*(.+)$/);
      const metaMatch = qualifier.match(/^meta:\s*(.+)$/);
      if (scopeMatch) scope = scopeMatch[1].trim();
      else if (metaMatch) meta = metaMatch[1].trim();
    }

    // Duplicate detection per Rule 10
    if (fileToSystem.has(filePath) && !scope) {
      const existing = fileToSystem.get(filePath);
      if (!existing.scope) {
        console.error(`error: file ${filePath} listed in two systems' Module(s) without (scope: ...) qualifier:`);
        console.error(`  - ${existing.system}`);
        console.error(`  - ${slug}`);
        console.error(`Fix per Rule 10: move to one system OR qualify both with (scope: function-name).`);
        process.exit(1);
      }
    }

    if (scope) {
      fileToSystem.set(`${filePath}#${scope}`, { system: slug, scope, meta });
    } else {
      fileToSystem.set(filePath, { system: slug, scope: null, meta });
    }

    if (meta === 'orchestration') {
      orchestrationFiles.add(filePath);
    }
  }
}

if (systems.length === 0) {
  console.log('No SYSTEMS/<sys>/README.md files found — nothing to map.');
  // Still update SYSTEMS.md with empty regions so markers stay healthy.
}

// ---- Run madge to get import graph ----

let madge;
try {
  madge = (await import('madge')).default;
} catch (e) {
  console.error('error: madge not installed. Run: npm install --save-dev madge');
  process.exit(1);
}

const madgeResult = await madge(SRC_DIR, {
  fileExtensions: ['js', 'mjs'],
  detectiveOptions: { es6: { mixedImports: true } },
});

// madge returns object keyed by paths relative to SRC_DIR.
// We need paths relative to REPO_ROOT (matching Module(s) format).
const importGraph = new Map(); // 'src/foo.js' → ['src/bar.js', ...]
const tree = madgeResult.obj();
for (const [from, toList] of Object.entries(tree)) {
  const fromRel = `src/${from}`;
  importGraph.set(fromRel, toList.map(t => `src/${t}`));
}

// ---- Resolve file → owning system (handles scope: qualifier) ----

function ownerOf(filePath) {
  // Exact match (whole file owned)
  if (fileToSystem.has(filePath)) return fileToSystem.get(filePath);
  // No scope-resolution needed for graph edges — we treat scope-qualified
  // files as owned by their first system found for graph purposes
  // (granularity below function-level isn't worth modeling here).
  for (const key of fileToSystem.keys()) {
    if (key.startsWith(`${filePath}#`)) return fileToSystem.get(key);
  }
  return null;
}

// ---- Build system→system call graph ----

const sysCalls = new Map();      // system → Set of called systems
const sysCalledBy = new Map();   // system → Set of caller systems
for (const s of systems) {
  sysCalls.set(s, new Set());
  sysCalledBy.set(s, new Set());
}

const unclaimedFiles = new Set();
let dynamicImportEdges = 0;

for (const [from, toList] of importGraph.entries()) {
  const fromOwner = ownerOf(from);
  if (!fromOwner) {
    unclaimedFiles.add(from);
    continue;
  }

  // Skip outward propagation from orchestration files (Gap I fix)
  if (orchestrationFiles.has(from)) {
    // app-shell's calls ARE still rendered in the diagram (just not in
    // Called-by columns of receiving systems). Handle this by tracking
    // diagram edges separately if needed; for now, sysCalls still gets
    // them so diagram shows fanout, but we'll exclude from Called-by below.
  }

  for (const to of toList) {
    const toOwner = ownerOf(to);
    if (!toOwner) {
      unclaimedFiles.add(to);
      continue;
    }
    if (fromOwner.system === toOwner.system) continue; // intra-system edge

    sysCalls.get(fromOwner.system).add(toOwner.system);
    // Called-by EXCLUDES orchestration callers (Gap I asymmetry)
    if (!orchestrationFiles.has(from)) {
      sysCalledBy.get(toOwner.system).add(fromOwner.system);
    }
  }
}

// ---- Generate mermaid diagram ----

const mermaidLines = ['```mermaid', 'graph LR'];
for (const s of systems) {
  for (const target of [...sysCalls.get(s)].sort()) {
    mermaidLines.push(`  ${s} --> ${target}`);
  }
}
mermaidLines.push('```');
const mermaidBlock = mermaidLines.join('\n');

// ---- Generate Systems table ----

const tableLines = [
  '| System | Calls | Called by | Has deep dive |',
  '|---|---|---|---|',
];
for (const s of systems.sort()) {
  const calls = [...sysCalls.get(s)].sort().join(', ') || '—';
  const calledBy = [...sysCalledBy.get(s)].sort().join(', ') || '—';
  const deepDive = existsSync(join(SYSTEMS_DIR, s, 'README.md')) ? `📄 SYSTEMS/${s}/` : '—';
  tableLines.push(`| ${s} | ${calls} | ${calledBy} | ${deepDive} |`);
}
const tableBlock = tableLines.join('\n');

// ---- Splice into SYSTEMS.md ----

function spliceBetweenMarkers(content, startMarker, endMarker, newInner) {
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker, startIdx + startMarker.length);
  if (startIdx === -1 || endIdx === -1) {
    console.error(`error: markers not found in SYSTEMS.md:`);
    console.error(`  start: ${startMarker}`);
    console.error(`  end:   ${endMarker}`);
    process.exit(1);
  }
  return (
    content.slice(0, startIdx + startMarker.length) +
    '\n' + newInner + '\n' +
    content.slice(endIdx)
  );
}

let content = readFileSync(SYSTEMS_MD, 'utf8');
content = spliceBetweenMarkers(content, START_GRAPH, END_GRAPH, mermaidBlock);
content = spliceBetweenMarkers(content, START_TABLE, END_TABLE, tableBlock);

// Atomic write
const tmpPath = SYSTEMS_MD + '.tmp';
writeFileSync(tmpPath, content, 'utf8');
renameSync(tmpPath, SYSTEMS_MD);

// ---- Report ----

console.log(`SYSTEMS.md regenerated:`);
console.log(`  systems with README: ${systems.length}`);
console.log(`  total inter-system edges: ${[...sysCalls.values()].reduce((a, b) => a + b.size, 0)}`);
if (unclaimedFiles.size > 0) {
  console.log(`  unclaimed src/ files: ${unclaimedFiles.size} (run npm run doc-rot for list)`);
}
if (orchestrationFiles.size > 0) {
  console.log(`  orchestration files: ${orchestrationFiles.size} (outward edges in diagram only, excluded from Called-by)`);
}

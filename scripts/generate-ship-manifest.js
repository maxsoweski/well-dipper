#!/usr/bin/env node

// Scans public/assets/ships/ subdirectories and generates manifest.json
// Usage: node scripts/generate-ship-manifest.js

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shipsDir = join(__dirname, '..', 'public', 'assets', 'ships');

const archetypes = ['fighters', 'shuttles', 'freighters', 'cruisers', 'capitals', 'explorers'];

const manifest = {};

for (const archetype of archetypes) {
  const dir = join(shipsDir, archetype);
  let files = [];
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.glb'));
  } catch {
    // directory might not exist yet
  }

  manifest[archetype] = files.map(f => {
    const size = statSync(join(dir, f)).size;
    return {
      file: `${archetype}/${f}`,
      sizeKB: Math.round(size / 1024)
    };
  });
}

const outPath = join(shipsDir, 'manifest.json');
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

const total = Object.values(manifest).reduce((sum, arr) => sum + arr.length, 0);
console.log(`Ship manifest: ${total} models across ${archetypes.length} archetypes`);
for (const [k, v] of Object.entries(manifest)) {
  if (v.length > 0) console.log(`  ${k}: ${v.length}`);
}
console.log(`Written to ${outPath}`);

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN = path.resolve(__dirname, '../../main.js');

describe('NPC ship spawning is disabled at the single switch', () => {
  const code = readFileSync(MAIN, 'utf8');

  it('declares a SHIPS_ENABLED flag set to false', () => {
    expect(code).toMatch(/const\s+SHIPS_ENABLED\s*=\s*false\s*;/);
  });

  it('gates spawnForSystem behind SHIPS_ENABLED', () => {
    // The spawnForSystem call must be guarded so it cannot run while ships
    // are disabled. Assert the call is preceded by an `if (SHIPS_ENABLED)`.
    const m = code.match(/if\s*\(\s*SHIPS_ENABLED\s*\)\s*\{[\s\S]{0,400}?shipSpawner\.spawnForSystem\(/);
    expect(m, 'spawnForSystem must sit inside an `if (SHIPS_ENABLED) { … }` block').not.toBeNull();
  });

  it('exposes window._lab.shipsEnabled() for gated integration tests', () => {
    expect(code).toMatch(/shipsEnabled\s*\(\s*\)\s*\{[\s\S]{0,80}?return\s+SHIPS_ENABLED\s*;/);
  });
});

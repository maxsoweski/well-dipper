// tests/worldengine-base-shell-structure.test.js
// Increment 1 (world-engine-shell-relief): the despun / ice-shell relief writer
// (writeShellReliefSphere, shellRelief.js) — sibling of plates.js for icy-active / volatile-cold /
// eyeball-despun bodies. Three-free, deterministic, generative-not-simulative.
//
// SLICE A (math-independent) covers: shellRegimeOf resolution, AC1 determinism/no-RNG, AC6 variety.
// SLICE B (needs the pinned stress-field math) adds AC2 structure / AC3 latitude / AC4 tilted-band /
// AC5 noise controls.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { shellRegimeOf, SHELL_REGIMES, SHELL_EXCLUDE, writeShellReliefSphere, SHELL_BOUND, RELAX_PASSES } from '../src/worldengine/base/shellRelief.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const REGIMES = ['icy-active', 'volatile-cold', 'eyeball-despun'];
const SHELL_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/shellRelief.js', import.meta.url)), 'utf8');
const carrierOf = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));
const buildShell = (macroSeed, regime) => {
  const c = carrierOf();
  const diag = writeShellReliefSphere(c, {}, { macroSeed, regime });
  return { c, diag };
};

// ── shellRegimeOf — the canonical regime-resolution predicate (the dispatch blocker, resolved) ──
// Accepts BOTH the short lab keys (PRESET_ARCHETYPE) and the canonical long keys, plus the
// locked-fallback that catches the archetype=null+locked Europa-class fall-through. SHELL_EXCLUDE
// stops a locked gas/lava/earthlike body from wrongly matching.
describe('shellRelief — shellRegimeOf regime resolution', () => {
  it('short lab keys map to the normalized regime tag', () => {
    expect(shellRegimeOf('ice', false)).toBe('icy-active');        // Frozen (airless), locked:false
    expect(shellRegimeOf('eyeball', true)).toBe('eyeball-despun');  // Eyeball (locked temperate)
    expect(shellRegimeOf('volatile', false)).toBe('volatile-cold'); // Titan (methane seas), coined key
  });

  it('canonical long keys map to themselves (future caller / game-port parity)', () => {
    expect(shellRegimeOf('icy-active', false)).toBe('icy-active');
    expect(shellRegimeOf('volatile-cold', false)).toBe('volatile-cold');
  });

  it('locked-fallback: archetype=null + locked routes to eyeball-despun (the Europa fall-through)', () => {
    expect(shellRegimeOf(null, true)).toBe('eyeball-despun');
    expect(shellRegimeOf(undefined, true)).toBe('eyeball-despun');
  });

  it('SHELL_EXCLUDE: a locked gas/lava/sub-neptune/exotic body does NOT match (dispatch safety)', () => {
    expect(shellRegimeOf('gas-giant', true)).toBe(null);    // locked Hot-Jupiter-class never gets ice cracks
    expect(shellRegimeOf('lava', true)).toBe(null);         // locked Lava/Magma is E7 territory
    expect(shellRegimeOf('sub-neptune', true)).toBe(null);
    expect(shellRegimeOf('carbon', true)).toBe(null);
    expect(shellRegimeOf('crystal', true)).toBe(null);
  });

  it('earthlike keys never match (claimed by the plate gate), locked or not', () => {
    expect(shellRegimeOf('terrestrial', false)).toBe(null);
    expect(shellRegimeOf('ocean', false)).toBe(null);
    expect(shellRegimeOf('terrestrial', true)).toBe(null);  // locked terrestrial => despun, not shell
    expect(shellRegimeOf('ocean', true)).toBe(null);
  });

  it('non-shell unlocked bodies never match (keep their despun/plate path)', () => {
    expect(shellRegimeOf('gas-giant', false)).toBe(null);
    expect(shellRegimeOf('impact-airless', false)).toBe(null);
    expect(shellRegimeOf(null, false)).toBe(null);
    expect(shellRegimeOf(undefined, false)).toBe(null);
  });

  it('SHELL_EXCLUDE is the pinned non-shell set', () => {
    for (const k of ['terrestrial', 'ocean', 'gas-giant', 'sub-neptune', 'lava', 'carbon', 'crystal']) {
      expect(SHELL_EXCLUDE.has(k)).toBe(true);
    }
    expect(SHELL_REGIMES.ice).toBe('icy-active');
    expect(SHELL_REGIMES.volatile).toBe('volatile-cold');
  });

  it('no-RNG static source guard: shellRelief.js contains no Math.random / Date.now call', () => {
    const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/shellRelief.js', import.meta.url)), 'utf8');
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SRC).not.toMatch(/Date\.now\s*\(/);
  });
});

// ── AC1 — determinism / bounds / render-once (SLICE A scaffold; stress fields stubbed) ──────────────
describe('shellRelief — AC1 determinism + bounds + render-once', () => {
  it('byte-identical determinism across seeds x regimes', () => {
    for (const r of REGIMES) for (const s of [1, 2, 3, 7, 42]) {
      const a = buildShell(s, r), b = buildShell(s, r);
      expect(Array.from(a.c.height)).toEqual(Array.from(b.c.height));
      expect(Array.from(a.diag.U)).toEqual(Array.from(b.diag.U));
      expect(Array.from(a.diag.cellId)).toEqual(Array.from(b.diag.cellId));
      expect(Array.from(a.diag.w0)).toEqual(Array.from(b.diag.w0));
      expect(Array.from(a.diag.stressTensile)).toEqual(Array.from(b.diag.stressTensile));
    }
  });

  it('REPLACE: carrier.height === returned U', () => {
    const { c, diag } = buildShell(1, 'icy-active');
    expect(Array.from(c.height)).toEqual(Array.from(diag.U));
  });

  it('finite + bounded (|U| < SHELL_BOUND) + non-trivial, all regimes', () => {
    for (const r of REGIMES) {
      const { diag } = buildShell(7, r);
      let maxAbs = 0, finite = true;
      for (let i = 0; i < diag.U.length; i++) { const v = diag.U[i]; if (!Number.isFinite(v)) { finite = false; break; } maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(finite).toBe(true);
      expect(maxAbs).toBeLessThan(SHELL_BOUND);
      expect(maxAbs).toBeGreaterThan(0);
    }
  });

  it('render-once: fixed relaxation bound, no convergence / time-step loop', () => {
    const { diag } = buildShell(1, 'icy-active');
    expect(diag.relaxPasses).toBe(RELAX_PASSES);
    expect(Number.isInteger(RELAX_PASSES)).toBe(true);
    expect(RELAX_PASSES).toBeGreaterThan(0);
    expect(RELAX_PASSES).toBeLessThanOrEqual(12);
    expect(SHELL_SRC).toMatch(/for\s*\(let pass = 0; pass < PASSES;/);
    const whileCount = (SHELL_SRC.match(/while\s*\(/g) || []).length;
    expect(whileCount).toBe(1);                          // the ONLY loop is the O(N) cell-distance BFS drain
    expect(SHELL_SRC).toMatch(/while\s*\(qh < qt\)/);
    expect(SHELL_SRC).not.toMatch(/while\s*\([^)]*(tol|eps|converg|residual|delta)/i);
  });

  it("uses the disjoint 'shell:' alea namespace (never 'plates:' / 'e6:')", () => {
    expect(SHELL_SRC).toMatch(/alea\('shell:/);
    expect(SHELL_SRC).not.toMatch(/alea\('plates:/);
    expect(SHELL_SRC).not.toMatch(/alea\('e6:/);
  });
});

// ── AC6 — seed variety (SLICE A: paleo-axis + convection-cell partition; lineament-network variety is SLICE B) ──
describe('shellRelief — AC6 seed variety (partition + paleo-axis)', () => {
  const mesh = buildIrregularSphere(TARGET_N, LLOYD);
  const seeds = [1, 2, 3, 4, 5];
  const runs = seeds.map((s) => {
    const c = makeSphereField(mesh);
    const d = writeShellReliefSphere(c, {}, { macroSeed: s, regime: 'icy-active' });
    return { s, w0: Array.from(d.w0), cellCount: d.cellCount, cellId: d.cellId };
  });

  it('paleo-spin axis w0 differs across seeds', () => {
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      expect(runs[i].w0).not.toEqual(runs[j].w0);
    }
  });

  it('convection-cell count is not constant across seeds', () => {
    expect(new Set(runs.map((r) => r.cellCount)).size).toBeGreaterThan(1);
  });

  it('cell partition geometry differs substantively (>30% nodes reclassified for the closest pair)', () => {
    let minDisagree = 1;
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i].cellId, b = runs[j].cellId;
      let same = 0; for (let k = 0; k < a.length; k++) if (a[k] === b[k]) same++;
      minDisagree = Math.min(minDisagree, 1 - same / a.length);
    }
    expect(minDisagree).toBeGreaterThan(0.3);
  });
});

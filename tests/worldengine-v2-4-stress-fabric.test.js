// tests/worldengine-v2-4-stress-fabric.test.js — World Engine V2-4 slice-2 (SP-STRESS-FABRIC) GATE.
//
// AC-FABRIC: the new owned module (src/worldengine/base/stressFabric.js) reproduces ALL FOUR steeredNoise3
// call sites bit-for-bit; the four writers' outputs are typed-array-equal pre/post extraction. Proven in
// THREE layers (the V2-7d lidDisruption dual-run mold — family module, own validation suite, zero behavior
// change):
//
//   (1) FUNCTION-LEVEL DUAL-RUN — the extracted steeredNoise3 vs the pre-extraction source embedded VERBATIM
//       here, across a swept battery {sign ±1}×{ridged T/F or regime ∈ {NORMAL,STRIKESLIP,THRUST}}×{angle}×
//       {freq}×{deterministic dirs/frames}. Immune to capture-order (the reference is literal pre-extraction
//       text, not a captured artifact). TWO reference forms are embedded: the ridged-boolean form (the
//       shellRelief/mixedInterior/stagnantLid copies) AND the tectonic regime-ternary form (the ONE call
//       site whose arg changed: `carrier.regime[i]` → `carrier.regime[i] !== REGIME.NORMAL`), so the
//       arithmetic identity of that adaptation is proven directly.
//   (2) WRITER-LEVEL FIXTURE EQUALITY — each of the four writers, driven post-extraction on the deterministic
//       mesh across seeds {1,2,3,7,42}, produces carrier.height byte-identical to the PRE-EXTRACTION goldens
//       captured in tests/fixtures/v2-4-stress-fabric-goldens.json (SHA-256 compare; the golden was captured
//       before any source edit — capture-order guard, lens A-M3). This is the only pre/post byte anchor for
//       mixedInterior (off the writeBodyRelief dispatch, so absent from the 75-carrier golden). Non-vacuity
//       is asserted: the mixed/stagnant tessera fold+ribbon call sites actually fire (tessera nodes > 0).
//   (3) MODULE VALIDATION — steeredNoise3 is exported, pure (deterministic; no Math.random/Date.now), and
//       three-free (imports nothing); the ridged=true/false lobes are exact negations (0.5-|n| ⊕ |n|-0.5 = 0).
//
// The tectonic (writeHeightSphere despun) + shellRelief writers are ALSO covered by the 75-carrier byte
// golden and stagnantLid by the lid byte-anchors; layer (2) makes that pre/post coverage explicit and adds
// mixedInterior. Metered-safe: pure node/vitest, no claude -p.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import alea from 'alea';
import { createNoise3D } from 'simplex-noise';

import { steeredNoise3 } from '../src/worldengine/base/stressFabric.js';
import { REGIME } from '../src/worldengine/base/substrate.js';
import { computeAllFixtures, SEEDS, CALL_SITES } from './fixtures/v2-4-stress-fabric-golden.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(readFileSync(path.resolve(__dirname, 'fixtures', 'v2-4-stress-fabric-goldens.json'), 'utf8'));

// ── PRE-EXTRACTION reference #1: the ridged-boolean form (shellRelief.js / mixedInterior.js / stagnantLid.js
//    copies, embedded VERBATIM). ──
function ridgedRef(noise3, dir, east, north, angle, ridged, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  const sU = freq * fScale * along;
  const sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa;
  const uy = east[1] * ca + north[1] * sa;
  const uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca;
  const vy = -east[1] * sa + north[1] * ca;
  const vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV;
  const py = dir[1] * freq + uy * sU + vy * sV;
  const pz = dir[2] * freq + uz * sU + vz * sV;
  const nVal = noise3(px, py, pz);
  return ridged ? (0.5 - Math.abs(nVal)) : (Math.abs(nVal) - 0.5);
}

// ── PRE-EXTRACTION reference #2: the tectonic.js form (embedded VERBATIM) — the ONE copy whose final
//    transform was a REGIME ternary. The extraction adapts its call site to `ridged = regime !== NORMAL`;
//    this reference proves that mapping is bit-identical. ──
function tectonicRef(noise3, dir, east, north, angle, regime, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along  = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  const sU = freq * fScale * along;
  const sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa;
  const uy = east[1] * ca + north[1] * sa;
  const uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca;
  const vy = -east[1] * sa + north[1] * ca;
  const vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV;
  const py = dir[1] * freq + uy * sU + vy * sV;
  const pz = dir[2] * freq + uz * sU + vz * sV;
  const nVal = noise3(px, py, pz);
  return regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal);
}

// ── deterministic battery inputs (no Math.random) ──
function fibDirs(n) {
  const out = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    out.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return out;
}
// Orthonormal tangent frame ⟂ dir (the exact frame is irrelevant — both fns use the same one).
function frameAt(dir) {
  const ref = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let ex = ref[1] * dir[2] - ref[2] * dir[1];
  let ey = ref[2] * dir[0] - ref[0] * dir[2];
  let ez = ref[0] * dir[1] - ref[1] * dir[0];
  const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
  const nx = dir[1] * ez - dir[2] * ey;
  const ny = dir[2] * ex - dir[0] * ez;
  const nz = dir[0] * ey - dir[1] * ex;
  return { east: [ex, ey, ez], north: [nx, ny, nz] };
}

const NOISE = createNoise3D(alea('v2-4-stress-fabric-test'));
const DIRS = fibDirs(13);
const ANGLES = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI, 1.234, -0.7];
const FREQS = [2.5, 5.0, 9.0, 11.0, 13.5];
const SIGNS = [+1, -1];
const REGIMES = [REGIME.NORMAL, REGIME.STRIKESLIP, REGIME.THRUST];

describe('V2-4 slice-2 AC-FABRIC — (1) function-level dual-run: extracted steeredNoise3 === pre-extraction source, bit-for-bit', () => {
  it('reproduces the ridged-boolean form (shellRelief / mixedInterior / stagnantLid copies) across the swept battery', () => {
    let checks = 0;
    for (const dir of DIRS) {
      const { east, north } = frameAt(dir);
      for (const sign of SIGNS) for (const ridged of [true, false]) for (const angle of ANGLES) for (const freq of FREQS) {
        const got = steeredNoise3(NOISE, dir, east, north, angle, ridged, freq, sign);
        const exp = ridgedRef(NOISE, dir, east, north, angle, ridged, freq, sign);
        // Object.is: exact float bits (also pins any NaN parity).
        expect(Object.is(got, exp), `ridged=${ridged} sign=${sign} angle=${angle} freq=${freq}`).toBe(true);
        checks++;
      }
    }
    expect(checks).toBeGreaterThan(1000);
  });

  it('reproduces the tectonic regime-ternary form under the call-site adaptation ridged = regime !== NORMAL, bit-for-bit', () => {
    let checks = 0;
    for (const dir of DIRS) {
      const { east, north } = frameAt(dir);
      for (const sign of SIGNS) for (const regime of REGIMES) for (const angle of ANGLES) for (const freq of FREQS) {
        // extracted module, called exactly as tectonic.js:151 now calls it
        const got = steeredNoise3(NOISE, dir, east, north, angle, regime !== REGIME.NORMAL, freq, sign);
        // pre-extraction tectonic writer, called exactly as it did (raw regime int)
        const exp = tectonicRef(NOISE, dir, east, north, angle, regime, freq, sign);
        expect(Object.is(got, exp), `regime=${regime} sign=${sign} angle=${angle} freq=${freq}`).toBe(true);
        checks++;
      }
    }
    expect(checks).toBeGreaterThan(1000);
  });

  it('default sign (+1) === explicit sign=+1 (the omitted-arg contraction default is preserved)', () => {
    const dir = DIRS[3]; const { east, north } = frameAt(dir);
    expect(Object.is(
      steeredNoise3(NOISE, dir, east, north, 0.4, true, 9.0),
      steeredNoise3(NOISE, dir, east, north, 0.4, true, 9.0, +1),
    )).toBe(true);
  });
});

describe('V2-4 slice-2 AC-FABRIC — (2) writer-level fixture equality: all four writers byte-identical pre/post extraction', () => {
  // Recompute the four writers' carrier.height hashes POST-extraction and compare to the PRE-extraction
  // committed golden. Green ⇒ the extraction moved zero output bytes at any of the four call sites.
  const recomputed = computeAllFixtures();
  const sites = Object.keys(CALL_SITES);

  it('covers all four call sites × 5 seeds = 20 height hashes', () => {
    expect(sites).toEqual(['tectonic-grain', 'shell-ridge', 'mixed-tessera', 'stagnant-tessera']);
    let n = 0;
    for (const site of sites) { for (const seed of SEEDS) { expect(GOLDEN.fixtures[site].hashes).toHaveProperty(String(seed)); n++; } }
    expect(n).toBe(20);
  });

  for (const site of ['tectonic-grain', 'shell-ridge', 'mixed-tessera', 'stagnant-tessera']) {
    for (const seed of SEEDS) {
      it(`carrier.height byte-identical post-extraction: ${site} @ seed ${seed}`, () => {
        expect(recomputed[site].hashes[String(seed)]).toBe(GOLDEN.fixtures[site].hashes[String(seed)]);
      });
    }
  }

  it('non-vacuity: the mixed + stagnant tessera fold+ribbon call sites actually fired (tessera nodes > 0 every seed)', () => {
    for (const seed of SEEDS) {
      expect(recomputed['mixed-tessera'].witness[String(seed)].tesseraNodes, `mixed @${seed}`).toBeGreaterThan(0);
      expect(recomputed['stagnant-tessera'].witness[String(seed)].tesseraNodes, `stagnant @${seed}`).toBeGreaterThan(0);
    }
  });
});

describe('V2-4 slice-2 AC-FABRIC — (3) module validation: exported, pure, three-free', () => {
  const SRC = readFileSync(path.resolve(__dirname, '..', 'src/worldengine/base/stressFabric.js'), 'utf8');
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  it('exports steeredNoise3 as a function', () => {
    expect(typeof steeredNoise3).toBe('function');
  });

  it('imports NOTHING (pure leaf module — the noise3 sampler is passed in)', () => {
    expect(/^\s*import\b/m.test(CODE), 'no import statements').toBe(false);
    expect([...CODE.matchAll(/from\s+['"][^'"]+['"]/g)].length, 'zero import specifiers').toBe(0);
  });

  it('no Math.random / Date.now (deterministic; RNG-free)', () => {
    expect(/Math\.random\s*\(/.test(CODE), 'no Math.random').toBe(false);
    expect(/Date\.now\s*\(/.test(CODE), 'no Date.now').toBe(false);
  });

  it('deterministic: identical args → identical output (called twice)', () => {
    const dir = DIRS[5]; const { east, north } = frameAt(dir);
    const a = steeredNoise3(NOISE, dir, east, north, 1.1, true, 7.0, -1);
    const b = steeredNoise3(NOISE, dir, east, north, 1.1, true, 7.0, -1);
    expect(Object.is(a, b)).toBe(true);
  });

  it('ridged=true and ridged=false lobes are exact negations: (0.5-|n|) + (|n|-0.5) === 0, and outputs finite', () => {
    for (const dir of DIRS) {
      const { east, north } = frameAt(dir);
      for (const angle of ANGLES) for (const freq of FREQS) for (const sign of SIGNS) {
        const up = steeredNoise3(NOISE, dir, east, north, angle, true, freq, sign);
        const dn = steeredNoise3(NOISE, dir, east, north, angle, false, freq, sign);
        expect(Number.isFinite(up) && Number.isFinite(dn)).toBe(true);
        expect(up + dn).toBe(0);
      }
    }
  });
});

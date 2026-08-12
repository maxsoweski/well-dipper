// tests/worldengine-v2-4-host-channels.test.js — World Engine V2-4 slice-1 (host channels).
// Covers AC-CHANNELS (+ AC-0 ch.2 driver/consumer for the two new fields).
//
// The two NEW carrier channels `sediment` + `accommodation` (BUILD-PLAN §1):
//   • present on BOTH carriers (makeSphereField AND makeSubstrate), parity;
//   • NEW arrays — NOT aliases of the E9 reserves maturity/baseLevel (distinct identity + independent mutation);
//   • accommodation ∈ [0,1] across presets × seeds, written by the SINK-RANKING writeAccommodation (no
//     volumetric / mass term — asserted by source-slice grep);
//   • non-degeneracy: on a live-relief plate world accommodation VARIES (variance > 0) and is INVERSELY
//     associated with height (deeper-below-datum ⇒ higher accommodation) — so `clamp01 of nothing = 0` cannot
//     pass the bounds AC vacuously;
//   • written on EVERY dispatch path (all five closures — plate/shell/despun/volcanic/stagnant-lid) via the
//     §0 post-dispatch IIFE-capture seam;
//   • a V2-8-shaped stub consumer reads accommodation + writes sediment at the documented seam with no rework.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { makeSubstrate } from '../src/worldengine/base/substrate.js';
import { writeAccommodation, initSedimentHost } from '../src/worldengine/base/hostChannels.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { TARGET_N, LLOYD, QUALITY_TIER, SEEDS } from './fixtures/v2-0-carrier-golden.mjs';

// ONE deterministic mesh, reused (each run gets a FRESH carrier; routing never depends on carrier bytes).
const MESH = buildIrregularSphere(TARGET_N, LLOYD);
const NAMES = Object.keys(DRIVER_PRESETS);            // all 17 presets ⇒ every dispatch path exercised

// Production-shaped condition-BEARING bundle (mirrors the dispatch-oracle test's bundle17).
function bundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: {
      ...buildNeutralBodyDrivers(u, fp),
      condition: deriveConditionVector(fp, u, fp.radiusEarth),
    },
    macroSeed: seed,
    heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}
const runRelief = (name, seed) => {
  const carrier = makeSphereField(MESH);
  const relief = writeBodyRelief(carrier, bundle(name, seed));
  return { carrier, relief };
};

// Pearson correlation over two equal-length arrays.
function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}
function variance(arr) {
  const n = arr.length;
  let m = 0; for (let i = 0; i < n; i++) m += arr[i]; m /= n;
  let v = 0; for (let i = 0; i < n; i++) { const d = arr[i] - m; v += d * d; }
  return v / n;
}

describe('V2-4 AC-CHANNELS — host channels present + distinct on both carriers', () => {
  it('makeSphereField exposes sediment + accommodation as Float32Array of length count', () => {
    const c = makeSphereField(MESH);
    expect(c.sediment).toBeInstanceOf(Float32Array);
    expect(c.accommodation).toBeInstanceOf(Float32Array);
    expect(c.sediment.length).toBe(c.count);
    expect(c.accommodation.length).toBe(c.count);
  });

  it('makeSubstrate exposes sediment + accommodation as Float32Array of length count (parity)', () => {
    const s = makeSubstrate({ n: 16, lat0Deg: -80, lat1Deg: 80, domainKm: 1000 });
    expect(s.sediment).toBeInstanceOf(Float32Array);
    expect(s.accommodation).toBeInstanceOf(Float32Array);
    expect(s.sediment.length).toBe(s.count);
    expect(s.accommodation.length).toBe(s.count);
  });

  it('the new channels are NEW arrays — NOT aliases of the E9 reserves (maturity/baseLevel) on both carriers', () => {
    for (const c of [makeSphereField(MESH), makeSubstrate({ n: 16, lat0Deg: -80, lat1Deg: 80, domainKm: 1000 })]) {
      // distinct object identity
      expect(c.sediment).not.toBe(c.maturity);
      expect(c.sediment).not.toBe(c.baseLevel);
      expect(c.accommodation).not.toBe(c.maturity);
      expect(c.accommodation).not.toBe(c.baseLevel);
      expect(c.sediment).not.toBe(c.accommodation);
      // independent mutation: writing the host channels leaves the E9 reserves untouched (allocated-and-unwritten)
      c.sediment[0] = 7; c.accommodation[1] = 0.5;
      expect(c.maturity[0]).toBe(0);
      expect(c.maturity[1]).toBe(0);
      expect(c.baseLevel[0]).toBe(0);
      expect(c.baseLevel[1]).toBe(0);
    }
  });
});

describe('V2-4 AC-CHANNELS — accommodation is bounded [0,1] on every dispatch path × seed', () => {
  it('accommodation ∈ [0,1], finite, on all 17 presets × seeds {1,2,3,7,42}', () => {
    for (const name of NAMES) {
      for (const seed of SEEDS) {
        const { carrier } = runRelief(name, seed);
        for (let i = 0; i < carrier.count; i++) {
          const a = carrier.accommodation[i];
          expect(Number.isFinite(a), `${name}@${seed} node ${i} finite`).toBe(true);
          expect(a, `${name}@${seed} node ${i} ≥ 0`).toBeGreaterThanOrEqual(0);
          expect(a, `${name}@${seed} node ${i} ≤ 1`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('the post-dispatch seam runs on EVERY dispatch path (plate/shell/despun/volcanic/stagnant-lid)', () => {
    const paths = new Set();
    for (const name of NAMES) paths.add(runRelief(name, 1).relief.path);
    // the five closures the seam must fire behind — accommodation is written on all of them
    for (const p of ['plate', 'shell', 'despun', 'volcanic', 'stagnant-lid']) {
      expect(paths.has(p), `dispatch path "${p}" exercised by some preset`).toBe(true);
    }
  });

  it('the seam fires behind every closure: a relief-bearing world of each path has positive accommodation', () => {
    // one representative preset per closure (relief-bearing ⇒ some sink below datum ⇒ positive accommodation)
    const perPath = {
      plate: 'Rocky (Earthlike)', shell: 'Europa (icy moon)', despun: 'Mars (arid rocky)',
      volcanic: 'Lava (hot airless)', 'stagnant-lid': 'Venus (sulfuric shroud)',
    };
    for (const [path, name] of Object.entries(perPath)) {
      const { carrier, relief } = runRelief(name, 1);
      expect(relief.path, `${name} takes the ${path} path`).toBe(path);
      expect(Math.max(...carrier.accommodation), `${path} (${name}) seam wrote positive accommodation`).toBeGreaterThan(0);
    }
  });
});

describe('V2-4 AC-CHANNELS non-degeneracy — accommodation is a real sink-ranking, not vacuous zero', () => {
  it('on a live-relief plate world accommodation varies (variance > 0) AND is inversely associated with height', () => {
    const { carrier } = runRelief('Rocky (Earthlike)', 42);
    const acc = carrier.accommodation;
    // (1) not a dead all-zero channel: it varies across nodes
    expect(variance(acc), 'accommodation variance > 0').toBeGreaterThan(0);
    expect(Math.max(...acc), 'some node reaches meaningful accommodation').toBeGreaterThan(0.1);
    // (2) inverse-with-height: deeper-below-datum ⇒ higher accommodation ⇒ negative correlation
    const r = pearson(carrier.height, acc);
    expect(r, `corr(height, accommodation) = ${r.toFixed(3)} should be clearly negative`).toBeLessThan(-0.2);
    // (3) tercile robustness: mean accommodation of the deepest third > shallowest third
    const idx = [...carrier.height.keys()].sort((i, j) => carrier.height[i] - carrier.height[j]);
    const k = Math.floor(idx.length / 3);
    const meanOf = (ids) => ids.reduce((s, i) => s + acc[i], 0) / ids.length;
    const deepThird = meanOf(idx.slice(0, k));         // lowest heights
    const highThird = meanOf(idx.slice(-k));           // highest heights
    expect(deepThird, 'deep third accommodation > high third').toBeGreaterThan(highThird);
  });

  it('writeAccommodation is deterministic (double-run bit-identical) and RNG-free', () => {
    const a = makeSphereField(MESH); writeBodyRelief(a, bundle('Rocky (Earthlike)', 7));
    const b = makeSphereField(MESH); writeBodyRelief(b, bundle('Rocky (Earthlike)', 7));
    expect(Buffer.from(a.accommodation.buffer)).toEqual(Buffer.from(b.accommodation.buffer));
    expect(Buffer.from(a.sediment.buffer)).toEqual(Buffer.from(b.sediment.buffer));
  });
});

describe('V2-4 AC-CHANNELS — writeAccommodation is SINK-RANKING, not a volumetric computation', () => {
  const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/hostChannels.js', import.meta.url)), 'utf8');
  // slice the writeAccommodation function body (balanced-brace, starting past the signature's `{ datum }` param)
  function fnBody(code, sig) {
    const start = code.indexOf(sig);
    expect(start, `"${sig}" found`).toBeGreaterThan(-1);
    const open = start + sig.length - 1;                // sig ends with the body-opening `{`
    let depth = 0, i = open;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) break; }
    }
    return code.slice(open, i + 1);
  }
  const BODY = fnBody(SRC, 'export function writeAccommodation(carrier, { datum = null } = {}) {');

  it('the writer body reads height + writes accommodation via clamp01 (a ranking read)', () => {
    expect(BODY).toMatch(/height/);
    expect(BODY).toMatch(/accommodation/);
    expect(BODY).toMatch(/clamp01/);
  });

  it('the writer body has NO volumetric / mass-conservation term (no *= budget, no += accumulation, no mass)', () => {
    expect(BODY, 'no compound multiply-assign into a budget').not.toMatch(/\*=/);
    expect(BODY, 'no accumulation into a budget').not.toMatch(/\+=/);
    expect(BODY, 'no mass term').not.toMatch(/\bmass\b/i);
    expect(BODY, 'no volume term').not.toMatch(/\bvolume\b/i);
  });
});

describe('V2-4 AC-CHANNELS — V2-8-shaped stub consumer reads accommodation + writes sediment at the seam', () => {
  it('a sink-ranking deposition stub reads accommodation, writes sediment, needs no new plumbing', () => {
    const { carrier } = runRelief('Rocky (Earthlike)', 1);
    // sediment starts pristine (zero host)
    expect(carrier.sediment.some((v) => v !== 0), 'sediment pristine after V2-4').toBe(false);
    // V2-8-shaped consumer: rank sinks by accommodation, deposit into the sediment host (the documented seam)
    let deposited = 0;
    for (let i = 0; i < carrier.count; i++) {
      if (carrier.accommodation[i] > 0.5) { carrier.sediment[i] = carrier.accommodation[i] * 0.1; deposited++; }
    }
    expect(deposited, 'some sinks ranked high enough to receive deposition').toBeGreaterThan(0);
    expect(carrier.sediment.some((v) => v > 0), 'stub wrote into the sediment host').toBe(true);
  });

  it('initSedimentHost zeroes the host and is re-runnable (idempotent)', () => {
    const c = makeSphereField(MESH);
    c.sediment[0] = 9; c.sediment[5] = -3;
    initSedimentHost(c);
    expect(Array.from(c.sediment).every((v) => v === 0)).toBe(true);
    initSedimentHost(c);   // idempotent
    expect(Array.from(c.sediment).every((v) => v === 0)).toBe(true);
  });

  it('writeAccommodation runs cleanly on a fresh (zero-height) substrate carrier — bounded, no crash', () => {
    const s = makeSubstrate({ n: 16, lat0Deg: -80, lat1Deg: 80, domainKm: 1000 });
    expect(() => writeAccommodation(s)).not.toThrow();
    for (let i = 0; i < s.count; i++) {
      expect(s.accommodation[i]).toBeGreaterThanOrEqual(0);
      expect(s.accommodation[i]).toBeLessThanOrEqual(1);
    }
  });
});

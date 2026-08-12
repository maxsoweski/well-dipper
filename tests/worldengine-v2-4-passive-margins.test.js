// tests/worldengine-v2-4-passive-margins.test.js — World Engine V2-4 slice-3 (passive continental margins).
// Covers AC-MARGIN(a/b/c/d) + AC-0 (driver/consumer) for the new `shelfDepth` channel (BUILD-PLAN §3).
//
// The passive-margin channel (BUILD-PLAN §3, calibration §6.1):
//   (a) shelfDepth writes the shelf→break→slope→rise morphology at passive continent/ocean transitions ONLY
//       (active convergent/divergent boundaries keep their plates.js relief — zero shelfDepth there);
//   (b) carrier.height is byte-UNTOUCHED — margins live on their own channel (own-channel discipline);
//   (c) the volatiles-driven shelfWidthFactor moves shelf observables monotonically above the jitter noise
//       floor, ISOLATED from the repartition confound (partition/seed held fixed; lens B-m3);
//   (d) deterministic — double-run bit-identical (RNG-free; 'margin:' namespace reserved-not-consumed).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writePlateUpliftSphere } from '../src/worldengine/base/plates.js';
import {
  writePassiveMargins, marginProfileFrac, shelfWidthFactor, marginTotalWidth,
  SHELF_W_RAD, SLOPE_W_RAD, RISE_W_RAD, MARGIN_LIFT_N, PASSIVE_STRESS_MAX, MARGIN_VF0,
} from '../src/worldengine/base/passiveMargins.js';
import { buildIrregularSphere, writeBodyRelief, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { TARGET_N, LLOYD, QUALITY_TIER } from './fixtures/v2-0-carrier-golden.mjs';

// Deterministic meshes: a FINE mesh so the passive belt spans ≥3 hop bins (margin ≈ 5.57° vs meanEdgeAngle
// ≈ 2.5° at N=8000 ⇒ hops 0/1/2), and the golden-N mesh for the byte-untouched anchor.
const MESH_FINE = buildIrregularSphere(8000, 2);
const MESH_GOLDEN = buildIrregularSphere(TARGET_N, LLOYD);

// Build a live plate world on a given mesh + seed; returns { carrier, diag, cont }.
function plateWorld(mesh, seed) {
  const carrier = makeSphereField(mesh);
  const diag = writePlateUpliftSphere(carrier, {}, { macroSeed: seed });
  const N = carrier.N;
  const cont = new Uint8Array(N);
  for (let i = 0; i < N; i++) cont[i] = diag.plateType[diag.plateId[i]];
  return { carrier, diag, cont, N };
}

// Multi-source BFS hop distance to the passive-transition seed set (mirrors the writer's own BFS) — used to
// bin applied shelfDepth by shoreline distance for the monotonicity assertion.
function passiveHopDist({ carrier, diag, cont, N }) {
  const adj = carrier.adj, bs = diag.boundaryStress;
  const dist = new Int32Array(N).fill(-1);
  const q = new Int32Array(N); let h = 0, t = 0;
  for (let i = 0; i < N; i++) {
    let isT = false;
    for (const j of adj[i]) if (cont[j] !== cont[i]) { isT = true; break; }
    if (isT && Math.abs(bs[i]) < PASSIVE_STRESS_MAX) { dist[i] = 0; q[t++] = i; }
  }
  while (h < t) { const c = q[h++]; for (const nb of adj[c]) if (dist[nb] < 0) { dist[nb] = dist[c] + 1; q[t++] = nb; } }
  return dist;
}

// Production-shaped condition-BEARING bundle (mirrors the host-channels test's bundle).
function bundle(name, seed) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  return {
    archetype: PRESET_ARCHETYPE[name] ?? null,
    locked: !!(fp && fp.tidalState && fp.tidalState.locked),
    grainDrivers: DEFAULT_GRAIN_DRIVERS,
    bodyDrivers: { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) },
    macroSeed: seed,
    heightSeed: 'e6:' + (seed | 0),
    T_eq: (fp && fp.T_eq != null) ? fp.T_eq : 288,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('V2-4 AC-MARGIN(a) — shelf→break→slope→rise morphology (profile function, mesh-independent)', () => {
  const shelfW = SHELF_W_RAD * shelfWidthFactor(MARGIN_VF0);
  const totalW = shelfW + SLOPE_W_RAD + RISE_W_RAD;
  const p = (s) => marginProfileFrac(s, shelfW);

  it('is 1 at the coast, 0 at/beyond the rise foot, and finite throughout', () => {
    expect(p(0)).toBe(1);
    expect(p(totalW)).toBe(0);
    expect(p(totalW * 2)).toBe(0);
    expect(p(-0.01)).toBe(1);
  });

  it('is monotonically decreasing across the whole belt (no re-introduced step)', () => {
    let prev = p(0);
    for (let k = 1; k <= 400; k++) {
      const cur = p((k / 400) * totalW);
      expect(cur, `profile non-increasing at k=${k}`).toBeLessThanOrEqual(prev + 1e-9);
      prev = cur;
    }
  });

  it('has the four-zone structure — a STEEP slope between a gentle shelf and a gentle rise (the break)', () => {
    const slopeEnd = shelfW + SLOPE_W_RAD;
    const grad = (a, b) => (p(b) - p(a)) / (b - a);
    const gShelf = Math.abs(grad(0, shelfW));
    const gSlope = Math.abs(grad(shelfW, slopeEnd));
    const gRise = Math.abs(grad(slopeEnd, totalW));
    // slope descends far more steeply than either the shelf or the rise ⇒ a real shelf-break inflection
    expect(gSlope, `slope gradient ${gSlope.toFixed(1)} >> shelf ${gShelf.toFixed(1)}`).toBeGreaterThan(gShelf * 5);
    expect(gSlope, `slope gradient ${gSlope.toFixed(1)} >> rise ${gRise.toFixed(1)}`).toBeGreaterThan(gRise * 5);
    // shelf + rise are the gentle zones (both far gentler than the slope)
    expect(gShelf).toBeLessThan(gSlope);
    expect(gRise).toBeLessThan(gSlope);
  });
});

describe('V2-4 AC-MARGIN(a) — applied channel: shelves at PASSIVE margins only, monotone seaward', () => {
  it('shelfDepth fires only on oceanic passive-margin nodes; zero on continent / active-boundary nodes', () => {
    for (const seed of [1, 2, 42]) {
      const w = plateWorld(MESH_FINE, seed);
      writePassiveMargins(w.carrier, w.diag, { condition: { composition: { volatileFraction: MARGIN_VF0 } } }, { macroSeed: seed });
      const sd = w.carrier.shelfDepth, bs = w.diag.boundaryStress;
      let nz = 0;
      for (let i = 0; i < w.N; i++) {
        if (sd[i] !== 0) {
          nz++;
          expect(w.cont[i], `node ${i} with shelfDepth is oceanic (seaward)`).toBe(0);           // seaward only
        }
        // active boundaries (high |stress|) keep their plates.js relief — no shelf there
        if (Math.abs(bs[i]) >= PASSIVE_STRESS_MAX) {
          expect(sd[i], `active-boundary node ${i} has zero shelfDepth`).toBe(0);
        }
      }
      expect(nz, `seed ${seed}: a healthy passive-margin belt exists`).toBeGreaterThan(50);
    }
  });

  it('shelfDepth decreases monotonically with geodesic distance from the passive shoreline', () => {
    const seed = 1;
    const w = plateWorld(MESH_FINE, seed);
    writePassiveMargins(w.carrier, w.diag, { condition: { composition: { volatileFraction: MARGIN_VF0 } } }, { macroSeed: seed });
    const sd = w.carrier.shelfDepth;
    const dist = passiveHopDist(w);
    const bins = new Map();
    for (let i = 0; i < w.N; i++) if (sd[i] !== 0) { const h = dist[i]; (bins.get(h) || bins.set(h, []).get(h)).push(sd[i]); }
    const hops = [...bins.keys()].sort((a, b) => a - b);
    expect(hops.length, 'at least three shoreline-distance bins on the fine mesh').toBeGreaterThanOrEqual(3);
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    let prev = Infinity;
    for (const h of hops) {
      const m = mean(bins.get(h));
      expect(m, `mean shelfDepth at hop ${h} (${m.toFixed(4)}) < previous (${prev.toFixed(4)})`).toBeLessThan(prev);
      prev = m;
    }
  });

  it('via the writeBodyRelief seam: a plate preset populates shelfDepth; a non-plate preset leaves it zero', () => {
    const plate = makeSphereField(MESH_GOLDEN);
    const rp = writeBodyRelief(plate, bundle('Rocky (Earthlike)', 1));
    expect(rp.path, 'Rocky takes the plate path').toBe('plate');
    expect(plate.shelfDepth.some((v) => v !== 0), 'plate seam wrote shelfDepth').toBe(true);

    const despun = makeSphereField(MESH_GOLDEN);
    const rd = writeBodyRelief(despun, bundle('Mars (arid rocky)', 1));
    expect(rd.plateDiag, 'Mars has no plateDiag (non-plate path)').toBeNull();
    expect(Array.from(despun.shelfDepth).every((v) => v === 0), 'non-plate path leaves shelfDepth all-zero').toBe(true);
  });
});

describe('V2-4 AC-MARGIN(b) — carrier.height byte-untouched (own-channel discipline)', () => {
  it('writePassiveMargins writes ONLY shelfDepth — carrier.height is byte-identical before/after', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const w = plateWorld(MESH_FINE, seed);
      const heightBefore = Buffer.from(Float32Array.from(w.carrier.height).buffer);
      writePassiveMargins(w.carrier, w.diag, { condition: { composition: { volatileFraction: 0.3 } } }, { macroSeed: seed });
      const heightAfter = Buffer.from(w.carrier.height.buffer, w.carrier.height.byteOffset, w.carrier.height.byteLength);
      expect(heightAfter.equals(heightBefore), `seed ${seed}: carrier.height byte-identical`).toBe(true);
      expect(w.carrier.shelfDepth.some((v) => v !== 0), `seed ${seed}: shelfDepth actually changed`).toBe(true);
    }
  });

  it('the full writeBodyRelief seam leaves carrier.height byte-identical to a margins-suppressed run', () => {
    // run the real seam (margins ON) vs a manual plate build (margins never called): height must match
    const seamed = makeSphereField(MESH_GOLDEN);
    writeBodyRelief(seamed, bundle('Rocky (Earthlike)', 42));
    const manual = plateWorld(MESH_GOLDEN, 42);   // writePlateUpliftSphere only — no margin/host writes
    // both wrote carrier.height = U via the same plate writer + seed ⇒ byte-identical height
    const a = Buffer.from(seamed.height.buffer, seamed.height.byteOffset, seamed.height.byteLength);
    const b = Buffer.from(manual.carrier.height.buffer, manual.carrier.height.byteOffset, manual.carrier.height.byteLength);
    expect(a.equals(b), 'seam height == plate-only height (margins never touched height)').toBe(true);
  });
});

describe('V2-4 AC-MARGIN(c) — driver response, ISOLATED from the repartition confound (lens B-m3)', () => {
  it('shelfWidthFactor(vf) is a pure monotone-increasing transfer function anchored 1.0 at Earth vf', () => {
    expect(shelfWidthFactor(MARGIN_VF0)).toBeCloseTo(1.0, 12);
    const sweep = [0.02, 0.05, 0.10, 0.15, 0.25, 0.35, 0.50];
    let prev = -Infinity;
    for (const vf of sweep) {
      const f = shelfWidthFactor(vf);
      expect(f, `shelfWidthFactor(${vf}) strictly increasing`).toBeGreaterThan(prev);
      prev = f;
    }
    // above the ±6% jitter noise floor: the endpoints differ by far more than the jitter band
    expect(shelfWidthFactor(0.50) - shelfWidthFactor(0.02)).toBeGreaterThan(0.5);
    // total belt width tracks the shelf-width law monotonically
    expect(marginTotalWidth(0.50)).toBeGreaterThan(marginTotalWidth(0.02));
  });

  it('applied: on a FIXED partition/seed, sweeping vf moves total shelf extent monotonically up', () => {
    const seed = 3;
    const w = plateWorld(MESH_FINE, seed);   // ONE partition, reused for every vf ⇒ repartition confound excluded
    const sums = [];
    for (const vf of [0.05, 0.15, 0.30, 0.50]) {
      writePassiveMargins(w.carrier, w.diag, { condition: { composition: { volatileFraction: vf } } }, { macroSeed: seed });
      let s = 0;
      for (let i = 0; i < w.N; i++) s += w.carrier.shelfDepth[i];
      sums.push(s);
    }
    for (let k = 1; k < sums.length; k++) {
      expect(sums[k], `Σ shelfDepth increases at step ${k} (${sums[k].toFixed(3)} > ${sums[k - 1].toFixed(3)})`).toBeGreaterThan(sums[k - 1]);
    }
    // endpoints separated well above the jitter floor (jitter is symmetric ⇒ averages out over the belt)
    expect((sums[sums.length - 1] - sums[0]) / sums[0], 'wet vs dry shelf extent differs clearly').toBeGreaterThan(0.02);
  });
});

describe('V2-4 AC-MARGIN(d) — determinism (RNG-free, double-run bit-identical)', () => {
  it('two fresh runs (mesh+seed+drivers fixed) produce byte-identical shelfDepth', () => {
    const mk = () => {
      const w = plateWorld(MESH_FINE, 7);
      writePassiveMargins(w.carrier, w.diag, { condition: { composition: { volatileFraction: 0.3 } } }, { macroSeed: 7 });
      return Buffer.from(w.carrier.shelfDepth.buffer, w.carrier.shelfDepth.byteOffset, w.carrier.shelfDepth.byteLength);
    };
    expect(mk().equals(mk()), 'shelfDepth double-run bit-identical').toBe(true);
  });

  it('via the writeBodyRelief seam: shelfDepth is byte-identical across two runs', () => {
    const a = makeSphereField(MESH_GOLDEN); writeBodyRelief(a, bundle('Rocky (Earthlike)', 2));
    const b = makeSphereField(MESH_GOLDEN); writeBodyRelief(b, bundle('Rocky (Earthlike)', 2));
    expect(Buffer.from(a.shelfDepth.buffer).equals(Buffer.from(b.shelfDepth.buffer)), 'seam shelfDepth deterministic').toBe(true);
  });

  it('writePassiveMargins is RNG-free (no Math.random / Date.now / alea in the source)', () => {
    const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/passiveMargins.js', import.meta.url)), 'utf8');
    expect(SRC, 'no Math.random').not.toMatch(/Math\.random/);
    expect(SRC, 'no Date.now').not.toMatch(/Date\.now/);
    expect(SRC, "no alea import (draws are pure derivation)").not.toMatch(/from 'alea'|from "alea"/);
  });
});

describe('V2-4 AC-MARGIN — no-op safety on non-plate / degenerate input', () => {
  it('writePassiveMargins(carrier, null) is a no-op (shelfDepth all-zero)', () => {
    const c = makeSphereField(MESH_GOLDEN);
    c.shelfDepth[0] = 5;   // pre-dirty
    writePassiveMargins(c, null);
    expect(Array.from(c.shelfDepth).every((v) => v === 0), 'null plateDiag zeroes + skips').toBe(true);
  });

  it('the two new carriers expose shelfDepth as a Float32Array of length count (parity)', () => {
    const c = makeSphereField(MESH_GOLDEN);
    expect(c.shelfDepth).toBeInstanceOf(Float32Array);
    expect(c.shelfDepth.length).toBe(c.count);
    // distinct from the E9 reserves + the other host channels
    expect(c.shelfDepth).not.toBe(c.baseLevel);
    expect(c.shelfDepth).not.toBe(c.accommodation);
  });
});

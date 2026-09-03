// tests/fixtures/ray-pack-corpus.mjs — the ONE corpus + resolution + timing helper shared by
// `scripts/capture-ray-pack-baseline.mjs` (which runs it at the PARENT) and
// `tests/driver-pack-ejectarays.test.js` (which runs it at HEAD).
//
// ⭐ WHY IT IS SHARED RATHER THAN WRITTEN TWICE. AC-3 compares resolved driver values across a
// commit boundary and AC-6 compares RESOLVE TIMES across the same boundary. Both comparisons are
// only meaningful if the two sides execute the identical harness: a second transcription of the
// corpus builder or of the resolve loop would put a harness difference inside a number the contract
// reads as a code difference. One module, imported by both sides.
//
// ⛔ A PLANET-CLASS MOON IS AN ENTRY WRAPPING `planetData` (river wire 2026-09-02, trap 3) — the
// mount is mirrored here, not the wrapper read.
import { DRIVER_PRESETS } from '../../driver-presets.js';
import { deriveUniforms } from '../../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../../src/worldengine/base/e1Regime.js';
import { StarSystemGenerator } from '../../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../../src/worldengine/port/conditionFromBody.js';
import { labPackCtx } from '../../src/objects/Planet.js';
import { PACKS, gatesFor } from '../../src/worldengine/drivers/index.js';
import { resolveDriver } from '../../src/worldengine/port/writePackUniforms.js';
import { rockySurfacePack } from '../../src/worldengine/drivers/rockySurface.js';
import { craterDeckPack } from '../../src/worldengine/drivers/craterDeck.js';
import { solidOpticsPack } from '../../src/worldengine/drivers/solidOptics.js';   // ⭐ THE CALIBRATOR, not a subject — see `timeBothPacks`.
import { fibonacciSphere, MESH_N } from './giantdeck-preset-baseline.mjs';

export const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
export const MESH = { positions: fibonacciSphere(MESH_N, 1.0), count: MESH_N, radius: 1.0 };
export { MESH_N };

/** FNV-1a over a typed array's bytes — the storm suite's attribute digest, so hashes compare across commits. */
export const fnv = (arr) => {
  const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
};

export function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      const d = e.planetData || e;
      out.push({ seed, kind: 'planet', d, id: `${seed}/planet/${d._ordinal}` });
      for (const m of (e.moons || [])) {
        const md = m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m;
        out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: md, id: `${seed}/${m.isPlanetMoon ? 'planet-moon' : 'moon'}/${md._ordinal}` });
      }
    }
  }
  for (const b of out) { b.cond = conditionFromBody(b.d); b.cls = compositionClass(b.cond); }
  return out;
}

/** Every pack that CLAIMS this condition, resolved through the writer exactly as the material write would. */
export function resolvedPacks(cond, ctx) {
  const out = {};
  for (const entry of PACKS) {
    if (entry.applies(cond, ctx) !== true) continue;
    const packCtx = { ...ctx, gates: gatesFor(entry) };
    const r = entry.pack(cond, packCtx);
    const drivers = {};
    for (const n of Object.keys(r.drivers)) drivers[n] = resolveDriver(n, r.drivers[n], packCtx);
    const attributes = {};
    for (const n of Object.keys(r.attributes)) attributes[n] = fnv(r.attributes[n]);
    out[entry.name] = { drivers, attributes };
  }
  return out;
}

/** The 18 driver presets, in the shape the storm suite already compares them in. */
export function presetRows() {
  const rows = [];
  for (const name of Object.keys(DRIVER_PRESETS)) {
    const fp = DRIVER_PRESETS[name];
    const R = fp.radiusEarth ?? 1;
    const cond = deriveConditionVector(fp, deriveUniforms(fp, 1.0), R);
    const dFake = { ...fp, _systemSeed: 'preset', _ordinal: name, radius: 1 };
    const ctx = { ...labPackCtx(dFake, cond, MESH), rotationHours: fp.rotationHours ?? 24 };
    rows.push({ name, cond, ctx });
  }
  return rows;
}

// ── AC-6's instrument ────────────────────────────────────────────────────────────────────────────
// ⚠ THE MEASUREMENT IS A MIN OF PASSES, NOT A MEAN OF THEM, and the reason is that the parent and
// HEAD numbers are taken in DIFFERENT PROCESSES minutes apart on a laptop under WSL. A mean carries
// whatever else the machine was doing; the minimum of N passes is the closest available reading of
// the work itself. Stated here rather than in a commit message because the +10 % gate reads it.
// ⛔⛔ AND IT WARMS BEFORE IT MEASURES, WHICH IS THE OTHER HALF OF THE SAME PROBLEM. MEASURED
// 2026-09-03: the SAME code reads 0.00124 ms/body cold and 0.00082 ms warm on `craterDeckPack` — a
// 34 % swing, three times the size of the +10 % gate AC-6 asks this instrument to decide. A parent
// captured cold against a HEAD measured warm (or the reverse) reports JIT state as a code change in
// either direction. Two discarded passes put both sides on warm code.
export const TIMING = Object.freeze({ reps: 5, passes: 3, warmups: 2 });

/** Per-body ms for one pack over the corpus: min over `passes`, each pass the mean of `reps` calls. */
export function timePackOverCorpus(pack, bodies, { reps = TIMING.reps, passes = TIMING.passes, warmups = TIMING.warmups } = {}) {
  const best = new Array(bodies.length).fill(Infinity);
  const ctxs = bodies.map((b) => ({ ...labPackCtx(b.d, b.cond, MESH), gates: { craters: true, ejecta: true, greatSpot: true, stormTrain: true } }));
  for (let w = 0; w < warmups; w++) for (let i = 0; i < bodies.length; i++) for (let r = 0; r < reps; r++) pack(bodies[i].cond, ctxs[i]);
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < bodies.length; i++) {
      const cond = bodies[i].cond; const ctx = ctxs[i];
      const t0 = performance.now();
      for (let r = 0; r < reps; r++) pack(cond, ctx);
      const ms = (performance.now() - t0) / reps;
      if (ms < best[i]) best[i] = ms;
    }
  }
  return best;
}

export function statsOf(times) {
  const s = [...times].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const p95 = s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
  return { n: s.length, mean, p95, min: s[0], max: s[s.length - 1] };
}

/**
 * The two packs AC-6 costs, timed over the whole corpus (both are callable on either class), PLUS a
 * CALIBRATOR.
 *
 * ⛔⛔ THE CALIBRATOR IS WHAT MAKES A CROSS-COMMIT TIMING GATE SURVIVE A FULL SUITE RUN, and it was
 * added because the gate failed without it. MEASURED 2026-09-03: the identical HEAD code reads
 * `craterDeckPack` at 1.16× the parent when this file runs alone and blows any fixed bound when it
 * runs inside `npx vitest run --dir tests` — 196 test files on an oversubscribed CPU, where even a
 * min-of-passes reading inflates. A stored number from a quiet machine cannot be compared to a
 * reading from a loaded one.
 * `solidOpticsPack` is a scalar pack over the same corpus that this workstream does not touch by one
 * line, so (pack ÷ solidOptics) is a MACHINE-FREE ratio: the load scales both terms together and
 * cancels. AC-6 compares that ratio across the commit boundary, and records the raw ms beside it.
 */
export function timeBothPacks(bodies, opts) {
  return {
    rockySurface: statsOf(timePackOverCorpus(rockySurfacePack, bodies, opts)),
    craterDeck: statsOf(timePackOverCorpus(craterDeckPack, bodies, opts)),
    solidOptics: statsOf(timePackOverCorpus(solidOpticsPack, bodies, opts)),
  };
}

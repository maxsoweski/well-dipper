// tests/worldengine-base-storm-e.test.js
// Increment-3b Slice-P UNIT/INTEGRATION acceptance for the driver-organized storm/vortex placement +
// storm/convection MASK writer (storm-e.js). Covers AC-WRITER(a,b,c,d,e), AC-FIELDS(a,d), AC-PARITY(a),
// and the gas-gate / envelope guards. Molds: climate-e5 static-source + golden-hash + arm's-length
// re-derivation. Contract: docs/WORKSTREAMS/world-engine-atmo-3b-storms-2026-07-14/contract.json
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { E5_REGIME, resolveParams, jetShear, jetShearPeak } from '../src/worldengine/base/climate-e5.js';
import {
  STORM_PHYS,
  resolveStormE, resolveStormPlacement, rankStormCandidates,
  writeStormESphere, bakeStormEAttributes,
  chromophoreColor, CHROMOPHORE_STOPS,
} from '../src/worldengine/base/storm-e.js';

const TARGET_N = 4000, LLOYD = 2;
const SHARED_MESH = buildIrregularSphere(TARGET_N, LLOYD);
const freshCarrier = () => makeSphereField(SHARED_MESH);
const GAS = { composition: 'h2-he' };
const REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN, E5_REGIME.SUB_NEPTUNE];
const SEEDS = [1, 2, 7, 42];

const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/storm-e.js', import.meta.url)), 'utf8');
// source with comments stripped — static guards must inspect CODE, not documentation prose
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const LAB = readFileSync(fileURLToPath(new URL('../planet-lod-lab.html', import.meta.url)), 'utf8');
// deterministic int32 hash over a Float32Array (byte-stable since the field is deterministic)
const hashField = (f) => { let h = 0x811c9dc5 | 0; for (let i = 0; i < f.length; i++) h = (Math.imul(h, 31) + Math.round(f[i] * 1e6)) | 0; return h; };
const run = (regime, macroSeed, stormSeed = 1234, drivers = GAS) => resolveStormE(regime, drivers, macroSeed, stormSeed);

describe('worldengine base — storm-e vortex placement + mask writer (increment 3b Slice P)', () => {
  // ── AC-WRITER(a): DETERMINISM + NO-RNG STATIC SOURCE ───────────────────────────────────────────
  it('[AC-WRITER a] no Math.random()/Date.now() call form; every alea() is stormE-namespaced', () => {
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SRC).not.toMatch(/Date\.now\s*\(/);
    for (const m of SRC.matchAll(/alea\(([^)]*)\)/g)) expect(m[1]).toContain('stormE:');
    // the four disjoint sub-namespaces are all present (F5: stormE:polar is its own stream)
    for (const ns of ['stormE:place', 'stormE:age', 'stormE:phase', 'stormE:polar']) expect(SRC).toContain(ns);
    // static place-once: no uTime concept anywhere in the writer CODE (comments may mention it)
    expect(CODE).not.toMatch(/uTime/);
  });
  it('[AC-WRITER a] byte-identical records + mask across two runs of the same (regime, seed) — every archetype × seed', () => {
    for (const regime of REGIMES) for (const s of SEEDS) {
      expect(JSON.stringify(run(regime, s))).toEqual(JSON.stringify(run(regime, s)));
      const a = writeStormESphere(freshCarrier(), GAS, { regime, macroSeed: s, stormSeed: 1234 });
      const b = writeStormESphere(freshCarrier(), GAS, { regime, macroSeed: s, stormSeed: 1234 });
      expect(Array.from(a.mask)).toEqual(Array.from(b.mask));
    }
  });
  it('[AC-WRITER b] golden byte snapshot of the mask at (gas-giant, macroSeed 1, stormSeed 1234)', () => {
    const out = writeStormESphere(freshCarrier(), GAS, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1, stormSeed: 1234 });
    expect(hashField(out.mask)).toBe(GOLDEN_STORM_MASK_HASH);
  });

  // ── AC-WRITER(c): ARGMAX PLACEMENT + DETERMINISTIC TIE-BREAK ────────────────────────────────────
  it('[AC-WRITER c] placement ranks by staircase anticyclonic-shear score, primary sits at the argmax', () => {
    const P = resolveParams(E5_REGIME.GAS_GIANT, {}, 1);
    const { ranked } = resolveStormPlacement(P);
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    const rec = run(E5_REGIME.GAS_GIANT, 1);
    expect(rec.primary.lat).toBe(ranked[0].lat);          // primary placed at the strongest-shear belt
  });
  it('[AC-WRITER c] tie-break is lowest-|lat| then lowest node index (the ATMOSPHERE-PLAN pin)', () => {
    const tied = [
      { lat: 0.5, score: 1, node: 9 },
      { lat: -0.3, score: 1, node: 4 },
      { lat: 0.3, score: 1, node: 2 },
    ];
    const r = rankStormCandidates(tied);
    expect([r[0].node, r[1].node, r[2].node]).toEqual([2, 4, 9]);   // |0.3|node2 → |0.3|node4 → |0.5|node9
  });

  // ── AC-WRITER(d): ARM'S-LENGTH RE-DERIVATION FROM RETURNED PARAMS ALONE ─────────────────────────
  it('[AC-WRITER d] primary + train latitudes reproduce from resolveStormPlacement(returned params) alone', () => {
    for (const regime of REGIMES) {
      const rec = run(regime, 3);
      const { ranked } = resolveStormPlacement(rec.params);      // independent search from returned params
      expect(rec.primary.lat).toBe(ranked[0].lat);
      // every discrete vortex latitude is one of the shear-maxima the independent search returns
      const belts = new Set(ranked.map((c) => c.lat));
      for (const v of rec.vortices) expect(belts.has(v.lat)).toBe(true);
    }
  });

  // ── AC-WRITER(e): RESEED SWEEP — longitude/phase vary, latitude frozen (designDecision-3 carve-out) ─
  it('[AC-WRITER e] reseed varies longitude/phase but SHARES latitude (frozen shear inputs)', () => {
    const a = run(E5_REGIME.GAS_GIANT, 5, 111);
    const b = run(E5_REGIME.GAS_GIANT, 5, 222);              // same macroSeed/drivers, different stormSeed
    expect(a.primary.lat).toBe(b.primary.lat);              // latitude repeats per seed (carve-out)
    expect(a.primary.lon).not.toBe(b.primary.lon);          // longitude varies
    expect(a.primary.phaseScalar).not.toBe(b.primary.phaseScalar);   // phase bank varies
    // identical seed ⇒ identical placement
    expect(JSON.stringify(run(E5_REGIME.GAS_GIANT, 5, 111))).toEqual(JSON.stringify(a));
  });

  // ── AC-FIELDS(a): the MASK is a real physics field ─────────────────────────────────────────────
  it('[AC-FIELDS a] mask bounded [0,1], finite, shear-correlated (≥ 0.4), lifted at placed vortices', () => {
    const c = freshCarrier();
    const out = writeStormESphere(c, GAS, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1, stormSeed: 1234 });
    const P = out.params, sp = jetShearPeak(P) || 1;
    let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0, sumM = 0;
    const shearN = new Float64Array(c.N);
    for (let i = 0; i < c.N; i++) {
      const m = out.mask[i];
      expect(Number.isFinite(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
      const lat = Math.asin(Math.max(-1, Math.min(1, c.verts[i][1])));
      const x = Math.abs(jetShear(lat, P)) / sp;
      shearN[i] = x; sumM += m;
      sx += x; sy += m; sxy += x * m; sxx += x * x; syy += m * m;
    }
    const n = c.N;
    const cov = sxy / n - (sx / n) * (sy / n);
    const corr = cov / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2));
    expect(corr).toBeGreaterThanOrEqual(0.4);              // stated correlation floor
    // mask is lifted toward the maxima at the placed vortex centers: the node nearest each vortex
    // reads above the global mean mask.
    const meanM = sumM / n;
    for (const v of out.vortices) {
      let best = -2, bi = 0;
      for (let i = 0; i < c.N; i++) { const d = c.verts[i][0] * v.center[0] + c.verts[i][1] * v.center[1] + c.verts[i][2] * v.center[2]; if (d > best) { best = d; bi = i; } }
      expect(out.mask[bi]).toBeGreaterThan(meanM);
    }
  });
  it('[AC-FIELDS d] every vortex carries a place-once age ∈ [0,1] and phase ∈ [0,2π] (the static bank)', () => {
    const rec = run(E5_REGIME.GAS_GIANT, 7);
    for (const v of rec.vortices) {
      expect(v.ageScalar).toBeGreaterThanOrEqual(0); expect(v.ageScalar).toBeLessThanOrEqual(1);
      expect(v.phaseScalar).toBeGreaterThanOrEqual(0); expect(v.phaseScalar).toBeLessThanOrEqual(Math.PI * 2 + 1e-9);
    }
    expect(rec.pole.phaseScalar).toBeGreaterThanOrEqual(0);
  });

  // ── AC-PARITY(a): bake ↔ writer node equality (the aStorm attribute IS the tested mask field) ──
  it('[AC-PARITY a] bakeStormEAttributes.aStorm === writeStormESphere.mask at matching node directions', () => {
    const R = 7.3;
    for (const regime of [E5_REGIME.GAS_GIANT, E5_REGIME.NEPTUNIAN]) {
      const c = freshCarrier();
      const out = writeStormESphere(c, GAS, { regime, macroSeed: 5, stormSeed: 1234 });
      const positions = new Float32Array(c.N * 3);
      for (let i = 0; i < c.N; i++) { positions[3 * i] = c.verts[i][0] * R; positions[3 * i + 1] = c.verts[i][1] * R; positions[3 * i + 2] = c.verts[i][2] * R; }
      const bake = bakeStormEAttributes(positions, c.N, R, { regime, drivers: GAS, macroSeed: 5, stormSeed: 1234 });
      let worst = 0;
      for (let i = 0; i < c.N; i++) worst = Math.max(worst, Math.abs(bake.aStorm[i] - out.mask[i]));
      expect(worst).toBeLessThan(1e-4);
    }
  });

  // ── GAS GATE (designDecision-5) + regime reads ─────────────────────────────────────────────────
  it('[gate] gas gate keys on composition h2-he: non-gas ⇒ count 0, mask all-zero, pole off', () => {
    const solid = resolveStormE(E5_REGIME.GAS_GIANT, { composition: 'n2-o2' }, 1, 1234);
    expect(solid.count).toBe(0);
    expect(solid.strength).toBe(0);
    expect(solid.pole.strength).toBe(0);
    const out = writeStormESphere(freshCarrier(), { composition: 'n2-o2' }, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    expect(Array.from(out.mask).every((m) => m === 0)).toBe(true);
    // gas ⇒ storms present
    const gas = run(E5_REGIME.GAS_GIANT, 1);
    expect(gas.count).toBeGreaterThan(0);
    expect(gas.pole.strength).toBe(1);
  });
  it('[regime] ice-giant primary is a dark cleared spot (mode 1); Jovian primary is a warm GRS (mode 0)', () => {
    expect(run(E5_REGIME.NEPTUNIAN, 1).primary.mode).toBe(1);
    expect(run(E5_REGIME.GAS_GIANT, 1).primary.mode).toBe(0);
    // rot sign encodes anticyclonic spin (cyclonic/anticyclonic in .rot sign — the carriage .x convention)
    expect(Math.abs(run(E5_REGIME.GAS_GIANT, 1).primary.rot)).toBeGreaterThan(0);
  });

  // ── AC-FIELDS(b): CHROMOPHORE AGE → COLOR is monotonic white→red (V-α.4) ───────────────────────
  it('[AC-FIELDS b] chromophoreColor(age,0) is monotone white→red — redness rises, green falls, endpoints pinned', () => {
    const N = 41, prev = { rg: -Infinity, rb: -Infinity, g: Infinity };
    for (let k = 0; k < N; k++) {
      const age = k / (N - 1);
      const [r, g, b] = chromophoreColor(age, 0);
      for (const ch of [r, g, b]) { expect(Number.isFinite(ch)).toBe(true); expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(1); }
      expect(r - g).toBeGreaterThanOrEqual(prev.rg - 1e-9);   // redness (vs green) non-decreasing
      expect(r - b).toBeGreaterThanOrEqual(prev.rb - 1e-9);   // redness (vs blue) non-decreasing
      expect(g).toBeLessThanOrEqual(prev.g + 1e-9);           // green channel non-increasing
      prev.rg = r - g; prev.rb = r - b; prev.g = g;
    }
    const white = chromophoreColor(0, 0), brick = chromophoreColor(1, 0);
    expect(white[2]).toBeGreaterThan(0.85);                   // young ⇒ near-white (high blue)
    expect(brick[0] - brick[2]).toBeGreaterThan(0.4);         // old ⇒ strongly red (r ≫ b)
    expect(brick[0]).toBeGreaterThan(brick[1]);               // and r > g (brick, not grey)
    // the exported stops are themselves monotone per channel (the ramp's backbone)
    for (let i = 1; i < CHROMOPHORE_STOPS.length; i++) for (let ch = 0; ch < 3; ch++)
      expect(CHROMOPHORE_STOPS[i].c[ch]).toBeLessThanOrEqual(CHROMOPHORE_STOPS[i - 1].c[ch] + 1e-9);
  });
  it('[AC-FIELDS b] chromophoreColor(age,1) is a cleared DARK neutral — never reddens (ice-giant branch)', () => {
    for (let k = 0; k <= 10; k++) {
      const [r, g, b] = chromophoreColor(k / 10, 1);
      expect(Math.max(r, g, b)).toBeLessThan(0.55);           // dark hole, not a bright cap
      expect(Math.abs(r - b)).toBeLessThan(0.12);             // neutral — NOT reddened
      expect(r).toBeLessThanOrEqual(b + 1e-9);                // if anything, cooler (cleared aerosol) — never r>b redness
    }
  });

  // ── V-α.5: DS2 sign-packed companion — magnitude = strength, sign = placement ──────────────────
  it('[V-α.5] ice-giant dark-spot companion is sign-packed |0.8|; BOTH DS2(centered,−) and GDS(offset,+) are reachable; warm GRS carries none', () => {
    // gas-giant warm primary (mode 0, GRS) never carries a companion
    for (const s of SEEDS) expect(run(E5_REGIME.GAS_GIANT, s).primary.companion).toBe(0);
    // ice-giant primary always carries a |0.8| companion; sign selects DS2 vs GDS
    let sawNeg = false, sawPos = false;
    for (let s = 1; s <= 24; s++) {
      const c = run(E5_REGIME.NEPTUNIAN, s).primary.companion;
      expect(Math.abs(c)).toBeCloseTo(0.8, 12);
      if (c < 0) sawNeg = true; if (c > 0) sawPos = true;
    }
    expect(sawNeg).toBe(true);   // DS2 bright-cored variant (centered) is reachable
    expect(sawPos).toBe(true);   // GDS offset companion is reachable
  });

  // ── ENVELOPE GUARD: exactly ONE new baked attribute (the mask), no new storm uniform (Slice P wire-in) ─
  it('[envelope] lab wires exactly ONE new baked attribute aStorm (mask is an attribute, not a uniform)', () => {
    expect(LAB).toContain('bakeStormEAttributes');                       // writer imported + used
    expect((LAB.match(/attribute float aStorm\b/g) || []).length).toBe(1);   // exactly one new attribute
    expect(LAB).not.toMatch(/uStormMask/);                               // NOT a new uniform
    expect(LAB).toContain('resolveStormE');                              // placement re-pointed to the writer
    // the legacy mulberry32 storm/polar closures are DELETED (preset-radius mulberry32 at :1929 survives)
    expect(LAB).not.toContain('_spotRng');
    expect(LAB).not.toContain('_polRng');
    expect(LAB).toContain('mulberry32');                                 // drawPresetRadius PRNG carve-out survives
  });
});

// Golden snapshot constant — byte-stable / deterministic (alea + IEEE Float32 rounding).
const GOLDEN_STORM_MASK_HASH = 568852786;

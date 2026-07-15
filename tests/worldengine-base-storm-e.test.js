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
  STORM_PHYS, POLAR_CANONICAL_N, POLAR_PRESENCE_PRIOR, POLAR_N_DELTA_WEIGHTS,
  resolveStormE, resolveStormPlacement, rankStormCandidates,
  writeStormESphere, bakeStormEAttributes,
  chromophoreColor, CHROMOPHORE_STOPS, iceGiantLifecyclePhase,
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
// arm's-length copy of storm-e's private dirFromLatLon (lon 0 = +x, +lat = +y) — used to assert that a
// non-lifecycle vortex's rendered .center is EXACTLY its (lat,lon) direction (kills a .center jitter cheat).
const dirFromLatLon = (lat, lon) => { const c = Math.cos(lat); return [c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon)]; };
const modeOf = (arr) => { const m = new Map(); for (const x of arr) m.set(x, (m.get(x) || 0) + 1); let best = null, bc = -1; for (const [k, c] of m) if (c > bc) { bc = c; best = k; } return best; };
const stdevOf = (arr) => { const mu = arr.reduce((a, b) => a + b, 0) / arr.length; return Math.sqrt(arr.reduce((a, b) => a + (b - mu) ** 2, 0) / arr.length); };
// Slice P (derive-not-freeze): the pinned 12-macroSeed sweep (measured 2026-07-15 to contain a PRESENCE
// flip for BOTH Neptunian and Sub-Neptune; Jovian/Saturnian are all-present at their ≥0.97 priors — see
// the AC-POLAR presence-gating test). stormSeed fixed at 1234 to match `run`.
const POLAR_SWEEP = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

  // ── AC-LAT anti-cheat (derive-not-freeze [RESOLVED-BY-REVISE-2 minor-2]): a NON-lifecycle vortex's ──
  //    rendered .center must be EXACTLY dirFromLatLon(.lat, .lon). This closes the loophole where a
  //    .center jitter evades the AC-WRITER(d) `.lat`-argmax equality bar. ONLY dark-spot LIFECYCLE
  //    primaries are exempt (they legitimately re-point .center to the lifecycle-drifted renderLat).
  it('[AC-LAT anti-cheat] non-lifecycle vortex .center == dirFromLatLon(lat,lon) exactly; only lifecycle primaries drift', () => {
    let sawLifecycleDrift = false;
    for (const regime of REGIMES) for (const s of POLAR_SWEEP) {
      const rec = run(regime, s);
      for (const v of rec.vortices) {
        if (v.lifecycle === undefined) {
          // GRS primary + ALL train members: center is the bit-exact (lat,lon) direction, no jitter.
          expect(v.center).toEqual(dirFromLatLon(v.lat, v.lon));
        } else {
          // lifecycle primary: .lat stays the birth (argmax) latitude; .center may drift off it (renderLat).
          const birth = dirFromLatLon(v.lat, v.lon);
          const drifted = v.center[0] !== birth[0] || v.center[1] !== birth[1] || v.center[2] !== birth[2];
          if (drifted) sawLifecycleDrift = true;
        }
      }
    }
    // the exemption is real: at least one ice-giant lifecycle primary actually drifts its center off .lat
    expect(sawLifecycleDrift).toBe(true);
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
  it('[gate] gas gate keys on composition h2-he: non-gas ⇒ count 0, mask all-zero, pole OFF (never consulted)', () => {
    // Slice P (derive-not-freeze) revision: the pole is no longer ALWAYS-ON when gas — presence is
    // per-seed gated (see the AC-POLAR presence test). This [gate] test now pins only the COMPOSITION
    // gate: non-gas ⇒ everything off (pole never even consults its prior, because stormsOn=false), and
    // gas ⇒ discrete STORMS present (count>0, independent of pole presence) with pole.strength a valid
    // 0/1 presence flag gated by the regime prior (asserted concretely in the AC-POLAR test below).
    const solid = resolveStormE(E5_REGIME.GAS_GIANT, { composition: 'n2-o2' }, 1, 1234);
    expect(solid.count).toBe(0);
    expect(solid.strength).toBe(0);
    expect(solid.pole.strength).toBe(0);          // non-gas: pole off regardless of any prior
    const out = writeStormESphere(freshCarrier(), { composition: 'n2-o2' }, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    expect(Array.from(out.mask).every((m) => m === 0)).toBe(true);
    // gas ⇒ discrete storms present; pole presence is prior-GATED, not forced (Jovian prior 0.98 ⇒
    // seed 1 present here, but that is a probability, not the old always-on invariant).
    const gas = run(E5_REGIME.GAS_GIANT, 1);
    expect(gas.count).toBeGreaterThan(0);
    expect([0, 1]).toContain(gas.pole.strength);  // valid presence flag (no longer pinned to 1)
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

  // ── V-β.2: POLAR presence gating + N-around-prior (derive-not-freeze Slice P — canonical-N demotion) ──
  // Max re-ruling 2026-07-15 (supersedes Rider B's PIN): polar N is a regime-conditioned PRIOR the seed
  // varies around, and vortex PRESENCE is gated per seed so poles "don't always appear" (atmo-3b UAT
  // finding 5). These tests replace the old frozen-N / always-present assertions (this increment's
  // behavioral golden to move, per BUILD-PLAN §5 — NOT the byte-immutable mask golden, which reads only
  // stormE:place vortices and is UNCHANGED). Floors: BUILD-PLAN §6 AC-POLAR (1)-(4).
  it('[V-β.2] POLAR_PRESENCE_PRIOR + POLAR_N_DELTA_WEIGHTS are the pinned named constants (de-floated prior)', () => {
    // pinned priors (DERIVE-FORMS §4): the AC-POLAR floor asserts these EXACT numbers so a presence-
    // always-on build cannot satisfy "flips" vacuously by shipping prior≈1 for every regime.
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.GAS_GIANT]).toBe(0.98);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.SATURNIAN]).toBe(0.97);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.NEPTUNIAN]).toBe(0.55);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.SUB_NEPTUNE]).toBe(0.45);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.HOT_JUPITER]).toBeUndefined();   // storm-gate-off ⇒ no entry
    // the ratified constraints: Jovian/Saturnian ≥ 0.95 (persistent), Neptunian/Sub-Neptune ≤ 0.8 (transient)
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.GAS_GIANT]).toBeGreaterThanOrEqual(0.95);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.SATURNIAN]).toBeGreaterThanOrEqual(0.95);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.NEPTUNIAN]).toBeLessThanOrEqual(0.8);
    expect(POLAR_PRESENCE_PRIOR[E5_REGIME.SUB_NEPTUNE]).toBeLessThanOrEqual(0.8);
    // N-delta weights: {−1:.25, 0:.50, +1:.25}, modal delta 0 ⇒ modal N == canonical
    expect(POLAR_N_DELTA_WEIGHTS).toEqual({ '-1': 0.25, '0': 0.50, '+1': 0.25 });
    expect(POLAR_N_DELTA_WEIGHTS['0']).toBeGreaterThan(POLAR_N_DELTA_WEIGHTS['-1'] + POLAR_N_DELTA_WEIGHTS['+1'] - 1e-9);  // 0 is the modal bin
    expect(POLAR_N_DELTA_WEIGHTS['-1'] + POLAR_N_DELTA_WEIGHTS['0'] + POLAR_N_DELTA_WEIGHTS['+1']).toBeCloseTo(1, 12);
  });
  it('[V-β.2] presence is per-seed gated: sub-1-prior regimes FLIP across the sweep; ≥0.95-prior regimes may stay all-present', () => {
    // AC-POLAR floor (1): for regimes whose prior ≤ 0.8, BOTH present AND absent occur across the pinned
    // sweep (0 < Σpresent < 12). Jovian/Saturnian (prior ~1) may be all-present — assert the PRIOR there.
    for (const [regime, subOne] of [
      [E5_REGIME.GAS_GIANT, false], [E5_REGIME.SATURNIAN, false],
      [E5_REGIME.NEPTUNIAN, true], [E5_REGIME.SUB_NEPTUNE, true],
    ]) {
      const present = POLAR_SWEEP.map((s) => run(regime, s).pole.strength);
      const nPresent = present.reduce((a, b) => a + b, 0);
      if (subOne) {
        expect(nPresent).toBeGreaterThan(0);          // some seeds DO show a pole
        expect(nPresent).toBeLessThan(POLAR_SWEEP.length);   // and some DON'T — the flip (kills always-on)
      } else {
        // high-prior regime: all-present here is CORRECT (Juno crystal / Saturn hexagon are persistent);
        // the anti-vacuous guard is the pinned-prior assertion above, not a forced flip.
        expect(nPresent).toBe(POLAR_SWEEP.length);
      }
    }
    // measured rates (2026-07-15): Neptunian 4/12, Sub-Neptune 7/12 — a genuine, non-trivial flip.
    expect(POLAR_SWEEP.map((s) => run(E5_REGIME.NEPTUNIAN, s).pole.strength).reduce((a, b) => a + b, 0)).toBe(4);
    expect(POLAR_SWEEP.map((s) => run(E5_REGIME.SUB_NEPTUNE, s).pole.strength).reduce((a, b) => a + b, 0)).toBe(7);
  });
  it('[V-β.2] polar N draws AROUND the canonical prior: modal N == canonical, non-degenerate, clamped 5..8', () => {
    const lo = STORM_PHYS.POLAR_N_MIN, hi = STORM_PHYS.POLAR_N_MIN + STORM_PHYS.POLAR_N_SPAN;
    expect([lo, hi]).toEqual([5, 8]);
    expect(POLAR_CANONICAL_N[E5_REGIME.SATURNIAN].sides).toBe(6);       // Saturn hexagon prior
    expect(POLAR_CANONICAL_N[E5_REGIME.GAS_GIANT].ring).toBe(8);        // Juno Jovian cluster ≈ 8 prior
    for (const regime of REGIMES) {
      const canon = POLAR_CANONICAL_N[regime];
      const present = POLAR_SWEEP.filter((s) => run(regime, s).pole.strength === 1);
      const sides = present.map((s) => run(regime, s).pole.sides);
      const ring = present.map((s) => run(regime, s).pole.ring);
      // AC-POLAR floor (2): N non-degenerate (varies) AND modal N == the canonical prior (Saturn modal 6,
      // NOT pinned). Modal asserted on `sides` (the polygon N the floor names); ring likewise varies.
      expect(new Set(sides).size).toBeGreaterThanOrEqual(2);
      expect(modeOf(sides)).toBe(canon.sides);
      expect(new Set(ring).size).toBeGreaterThanOrEqual(2);
      // every drawn N stays inside the plausible 5..8 physics band (clamp respected)
      for (const n of [...sides, ...ring]) { expect(n).toBeGreaterThanOrEqual(lo); expect(n).toBeLessThanOrEqual(hi); }
    }
  });
  it('[V-β.2] polar size/position vary per seed (r0/phase stdev > 0); same seed reproduces exactly', () => {
    // AC-POLAR floor (3): size (r0) and position (phase) vary across present seeds. Floor (4): determinism.
    for (const regime of REGIMES) {
      const present = POLAR_SWEEP.filter((s) => run(regime, s).pole.strength === 1);
      const r0 = present.map((s) => run(regime, s).pole.r0);
      const phase = present.map((s) => run(regime, s).pole.phase);
      expect(stdevOf(r0)).toBeGreaterThan(0);
      expect(stdevOf(phase)).toBeGreaterThan(0);
      // same-seed bit-identity of the whole pole record
      for (const s of present) expect(JSON.stringify(run(regime, s).pole)).toEqual(JSON.stringify(run(regime, s).pole));
    }
  });

  // ── V-β.3: ice-giant dark-spot LIFECYCLE phases (Q6 ratified: three) — no new rng ──────────────
  it('[V-β.3] iceGiantLifecyclePhase is a deterministic 3-band map on age; precursor has no core, mature drifts poleward, dissipating goes equatorward', () => {
    const pre = iceGiantLifecyclePhase(0.1, 0.4);
    const mat = iceGiantLifecyclePhase(0.5, 0.4);
    const dis = iceGiantLifecyclePhase(0.9, 0.4);
    expect(pre.phase).toBe('precursor');   expect(pre.coreScale).toBe(0.0);   // companion-only, no dark core
    expect(mat.phase).toBe('mature');      expect(mat.coreScale).toBe(1.0);
    expect(dis.phase).toBe('dissipating'); expect(dis.coreScale).toBeLessThan(1.0);
    expect(Math.abs(mat.renderLat)).toBeGreaterThan(0.4);   // mature drifts POLEWARD of birth |lat|
    expect(Math.abs(dis.renderLat)).toBeLessThan(0.4);      // dissipating drifts toward the EQUATOR
    expect(pre.renderLat).toBe(0.4);                         // precursor sits at the birth latitude
  });
  it('[V-β.3] ice-giant dark-spot primary carries a lifecycle + coreScale; warm GRS primary carries neither; birth latitude preserved', () => {
    for (let s = 1; s <= 12; s++) {
      const ice = run(E5_REGIME.NEPTUNIAN, s).primary;
      expect(['precursor', 'mature', 'dissipating']).toContain(ice.lifecycle);
      expect(ice.coreScale).toBeGreaterThanOrEqual(0); expect(ice.coreScale).toBeLessThanOrEqual(1);
      // .lat stays the shear-argmax birth latitude (AC-WRITER d re-derivation guard) even as center drifts
      const { ranked } = resolveStormPlacement(run(E5_REGIME.NEPTUNIAN, s).params);
      expect(ice.lat).toBe(ranked[0].lat);
    }
    const grs = run(E5_REGIME.GAS_GIANT, 1).primary;
    expect(grs.lifecycle).toBeUndefined();
    expect(grs.coreScale).toBeUndefined();
  });

  // ── V-β.5: URANIAN variant (Rider A) — Neptunian regime + high obliquity, NOT a preset ─────────
  it('[V-β.5] high-obliquity Neptunian ⇒ Uranian read: near-empty slots (count 1), mode-0 polar hood, uranian flag; normal Neptunian is unaffected', () => {
    const uran = resolveStormE(E5_REGIME.NEPTUNIAN, { composition: 'h2-he', obliquityDeg: 90 }, 3, 1234);
    expect(uran.uranian).toBe(true);
    expect(uran.count).toBe(1);                 // faint primary alone, no train (near-empty)
    expect(uran.pole.mode).toBe(0);             // seasonal polar hood = single mode-0 cap
    expect(uran.primary.coreScale).toBeLessThanOrEqual(0.5);   // faint 2006-type spot
    const norm = resolveStormE(E5_REGIME.NEPTUNIAN, { composition: 'h2-he' }, 3, 1234);
    expect(norm.uranian).toBe(false);
    expect(norm.count).toBeGreaterThan(1);      // normal Neptunian keeps its scooter train
    // obliquity below the Uranian threshold does NOT trip the variant
    expect(resolveStormE(E5_REGIME.NEPTUNIAN, { composition: 'h2-he', obliquityDeg: 40 }, 3).uranian).toBe(false);
  });

  // ── V-β.6: HOT-JUPITER suppression policy (Q1/F6: explicit regime gate, not emergent) ──────────
  it('[V-β.6] hot-Jupiter is suppressed by an explicit regime gate: no storms, all-zero mask, pole off — even though composition is h2-he', () => {
    const hj = resolveStormE(E5_REGIME.HOT_JUPITER, { composition: 'h2-he', T_eq: 1400 }, 1, 1234);
    expect(hj.hotJupiter).toBe(true);
    expect(hj.count).toBe(0);
    expect(hj.strength).toBe(0);
    expect(hj.primary).toBe(null);
    expect(hj.pole.strength).toBe(0);
    const out = writeStormESphere(freshCarrier(), { composition: 'h2-he', T_eq: 1400 }, { regime: E5_REGIME.HOT_JUPITER, macroSeed: 1 });
    expect(Array.from(out.mask).every((m) => m === 0)).toBe(true);   // filamentation term (∝ mask) vanishes regardless of flank shear
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

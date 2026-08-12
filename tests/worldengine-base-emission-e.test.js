// tests/worldengine-base-emission-e.test.js
// Increment-#2 (Blackbody Emission v1) Slice-1 UNIT acceptance (AC1–AC3) for the reusable blackbody
// thermal-emission DATA register src/worldengine/base/emission-e.js, PLUS the mandatory CPU↔GLSL
// one-curve parity test (the regression-safety gap the reshape identified).
// Mirrors tests/worldengine-base-climate-e5.test.js harness discipline (SHARED_MESH, freshCarrier,
// int32 hashField, comment-stripped CODE static-grep).
// Contract: docs/WORKSTREAMS/world-engine-blackbody-emission-2026-07-01/contract.json
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { E5_REGIME, writeClimateE5Sphere, wardInsolation } from '../src/worldengine/base/climate-e5.js';
import {
  EMISSION_PHYS, EMISSION_BB_STOPS,
  emissiveBlackbody, visibleLuminance, blackbodyEmission,
  writeEmissionESphere, bakeEmissionEAttributes,
} from '../src/worldengine/base/emission-e.js';

const TARGET_N = 4000, LLOYD = 2;
const SHARED_MESH = buildIrregularSphere(TARGET_N, LLOYD);
const SEEDS = [1, 2, 7, 42];
const freshCarrier = () => makeSphereField(SHARED_MESH);

const EMISSION_SRC_PATH = fileURLToPath(new URL('../src/worldengine/base/emission-e.js', import.meta.url));
const GLSL_SRC_PATH = fileURLToPath(new URL('../src/worldengine/shaders/height.glsl.js', import.meta.url));
const EMISSION_SRC = readFileSync(EMISSION_SRC_PATH, 'utf8');
// source with comments stripped — static guards must inspect CODE, not documentation prose
const CODE = EMISSION_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// deterministic int32 hash over a Float32Array (byte-stable since the field is deterministic)
const hashField = (f) => { let h = 0x811c9dc5 | 0; for (let i = 0; i < f.length; i++) h = (Math.imul(h, 31) + Math.round(f[i] * 1e6)) | 0; return h; };
// #3a golden bandField hash (must stay byte-stable — #2 never edits the reflectance path)
const GOLDEN_BANDFIELD_HASH = -1329854088;
const angleBetween = (a, b) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const la = Math.hypot(a[0], a[1], a[2]), lb = Math.hypot(b[0], b[1], b[2]);
  return Math.acos(Math.max(-1, Math.min(1, d / (la * lb))));
};

describe('worldengine base — blackbody emission-E register (#2 Slice 1 AC1–AC3 + CPU↔GLSL parity)', () => {
  // ── AC1: PLANCK → RGB COLOR LAW ────────────────────────────────────────────────────────────────
  it('[AC1] visibleLuminance ~0 (<1e-3) below ~800 K, anchored to 1 at 1800 K, strictly increasing for T≥1100', () => {
    // anchor exactly 1 at LUM_ANCHOR_K
    expect(visibleLuminance(EMISSION_PHYS.LUM_ANCHOR_K)).toBeCloseTo(1, 6);
    // cold: negligible visible emission (peak buried in the IR)
    for (const T of [150, 300, 800]) expect(visibleLuminance(T)).toBeLessThan(1e-3);
    // strictly increasing across the visible-threshold sweep
    const hot = [1100, 1500, 2000, 2500, 3500];
    for (let i = 1; i < hot.length; i++) {
      expect(visibleLuminance(hot[i])).toBeGreaterThan(visibleLuminance(hot[i - 1]));
    }
    // monotonic across the whole documented sweep too (never decreasing)
    const sweep = [150, 300, 800, 1100, 1500, 2000, 2500, 3500];
    for (let i = 1; i < sweep.length; i++) {
      expect(visibleLuminance(sweep[i])).toBeGreaterThanOrEqual(visibleLuminance(sweep[i - 1]));
    }
  });

  it('[AC1] blackbodyEmission hue progresses red→orange→white (R maxed, G then B climb); all in-gamut', () => {
    const sweep = [150, 300, 800, 1100, 1500, 2000, 2500, 3500];
    const out = sweep.map((T) => blackbodyEmission(T));
    for (const o of out) {
      // chroma finite + in [0,1], R channel dominant/maxed
      for (const ch of o.rgb) { expect(Number.isFinite(ch)).toBe(true); expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(1); }
      expect(o.rgb[0]).toBeCloseTo(1, 6);                    // red saturates first and stays maxed
      expect(o.rgb[0]).toBeGreaterThanOrEqual(o.rgb[1]);
      expect(o.rgb[1]).toBeGreaterThanOrEqual(o.rgb[2]);
      // tonemapped finite + in-gamut [0,1]
      for (const ch of o.rgbTonemapped) { expect(Number.isFinite(ch)).toBe(true); expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(1); }
    }
    // G then B monotonically rise with T (non-decreasing across the sweep, strictly across the hot end)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].rgb[1]).toBeGreaterThanOrEqual(out[i - 1].rgb[1] - 1e-9);
      expect(out[i].rgb[2]).toBeGreaterThanOrEqual(out[i - 1].rgb[2] - 1e-9);
    }
    expect(out[out.length - 1].rgb[1]).toBeGreaterThan(out[3].rgb[1]);   // 3500 K greener than 1100 K
    expect(out[out.length - 1].rgb[2]).toBeGreaterThan(out[3].rgb[2]);   // and bluer
    // visible luminance rises with the same ordering as the on-screen brightness intuition
    expect(out[7].lum).toBeGreaterThan(out[4].lum);          // 3500 K brighter than 1500 K
  });

  // ── AC2: ABSOLUTE T-FIELD CONSTRUCTION ─────────────────────────────────────────────────────────
  it('[AC2] LOCKED hot-Jupiter (tempEq=1400): argmax(T) near hotspotDir, hotspot east of substellar, min≥floor, bounded', () => {
    for (const s of SEEDS) {
      const c = freshCarrier();
      const o = writeEmissionESphere(c, {}, { regime: E5_REGIME.HOT_JUPITER, macroSeed: s, tempEq: 1400, locked: true, eqSign: 1 });
      // bounded [nightFloorK, dayPeakK] + finite for every node
      let argmax = -1, maxT = -Infinity, minT = Infinity;
      for (let i = 0; i < o.emitT.length; i++) {
        const T = o.emitT[i];
        expect(Number.isFinite(T)).toBe(true);
        expect(T).toBeGreaterThanOrEqual(o.nightFloorK - 1e-3);
        expect(T).toBeLessThanOrEqual(o.dayPeakK + 1e-3);
        if (T > maxT) { maxT = T; argmax = i; }
        if (T < minT) minT = T;
      }
      // nightside floor holds (min ≈ 1100 K, not black)
      expect(minT).toBeGreaterThanOrEqual(EMISSION_PHYS.NIGHT_FLOOR_K - 1e-3);
      expect(minT).toBeLessThan(o.dayPeakK);                 // there IS a cold nightside
      // hotspot advected EAST of the substellar longitude (carrier east = (0,1,0)×substellar = (0,0,-1))
      const sub = Array.from(o.substellarDir), hot = Array.from(o.hotspotDir);
      const eastAtSub = [sub[2], 0, -sub[0]];                // (0,1,0) × sub, unnormalized (unit here)
      expect(hot[0] * eastAtSub[0] + hot[1] * eastAtSub[1] + hot[2] * eastAtSub[2]).toBeGreaterThan(0);
      // brightest node sits within a small angular radius of the hotspot direction
      expect(angleBetween(c.verts[argmax], hot)).toBeLessThan(0.15);   // < ~8.6°, well inside mesh spacing margin
      // and that brightest node is itself east of the substellar meridian
      const vmax = c.verts[argmax];
      expect(vmax[0] * eastAtSub[0] + vmax[1] * eastAtSub[1] + vmax[2] * eastAtSub[2]).toBeGreaterThan(0);
      // emitLum finite + non-negative everywhere
      for (let i = 0; i < o.emitLum.length; i++) { expect(Number.isFinite(o.emitLum[i])).toBe(true); expect(o.emitLum[i]).toBeGreaterThanOrEqual(0); }
    }
  });

  it('[AC2] NON-LOCKED Jovian (tempEq=125): latitude-only + matches tempEq·1.15·wardInsolation re-derivation (<1e-3)', () => {
    for (const s of SEEDS) {
      const c = freshCarrier();
      const o = writeEmissionESphere(c, {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: s, tempEq: 125, locked: false });
      const P = o.params;
      let worst = 0;
      for (let i = 0; i < c.N; i++) {
        const y = Math.max(-1, Math.min(1, c.verts[i][1]));
        const ref = 125 * EMISSION_PHYS.DAY_LIFT * wardInsolation(y, P.obliquityDeg);   // arm's-length
        expect(Number.isFinite(o.emitT[i])).toBe(true);
        worst = Math.max(worst, Math.abs(o.emitT[i] - ref));
      }
      expect(worst).toBeLessThan(1e-3);
      // latitude-only: nodes at (nearly) the same latitude but different longitude get (nearly) the same T
      const buckets = new Map();
      for (let i = 0; i < c.N; i++) {
        const y = Math.max(-1, Math.min(1, c.verts[i][1]));
        const key = Math.round(y * 4000);                    // ~0.00025 sinLat bins (dT/dy slop only)
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(o.emitT[i]);
      }
      let spread = 0;
      for (const arr of buckets.values()) {
        if (arr.length < 2) continue;
        spread = Math.max(spread, Math.max(...arr) - Math.min(...arr));
      }
      expect(spread).toBeLessThan(0.5);                      // no longitudinal variation (only tiny bin-width slop)
    }
  });

  // ── AC3: INVARIANTS + DETERMINISM ──────────────────────────────────────────────────────────────
  it('[AC3] no Math.random()/Date.now() call form anywhere; every rng is emissionE:-namespaced alea', () => {
    expect(EMISSION_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(EMISSION_SRC).not.toMatch(/Date\.now\s*\(/);
    expect(EMISSION_SRC).toContain('emissionE:');
    for (const m of EMISSION_SRC.matchAll(/alea\(([^)]*)\)/g)) expect(m[1]).toContain('emissionE:');
    // never touches carrier relief (comment-stripped CODE)
    expect(CODE).not.toMatch(/carrier\.height/);
    expect(CODE).not.toMatch(/\.height\s*\[/);
  });

  it('[AC3] byte-identical emission fields across two runs of the same (regime, seed, opts)', () => {
    const cases = [
      { regime: E5_REGIME.HOT_JUPITER, tempEq: 1400, locked: true, eqSign: 1 },
      { regime: E5_REGIME.GAS_GIANT, tempEq: 125, locked: false },
    ];
    for (const base of cases) for (const s of SEEDS) {
      const a = writeEmissionESphere(freshCarrier(), {}, { ...base, macroSeed: s });
      const b = writeEmissionESphere(freshCarrier(), {}, { ...base, macroSeed: s });
      expect(Array.from(a.emitT)).toEqual(Array.from(b.emitT));
      expect(Array.from(a.emitLum)).toEqual(Array.from(b.emitLum));
      expect(Array.from(a.hotspotDir)).toEqual(Array.from(b.hotspotDir));
    }
  });

  it('[AC3] writeEmissionESphere leaves carrier.height + all carrier fields byte-identical (writes nothing to carrier)', () => {
    const c = freshCarrier();
    const snap = {};
    for (const k of ['height', 'grainAngle', 'grainMag', 'faultDensity', 'flowAccum', 'baseLevel', 'maturity', 'regime', 'standing']) {
      snap[k] = Array.from(c[k]);
    }
    writeEmissionESphere(c, {}, { regime: E5_REGIME.HOT_JUPITER, macroSeed: 1, tempEq: 1400, locked: true });
    for (const k of Object.keys(snap)) expect(Array.from(c[k])).toEqual(snap[k]);
  });

  it('[AC3] writeEmissionESphere does not perturb the #3a climate-e5 fields on a shared carrier', () => {
    const c = freshCarrier();
    const before = writeClimateE5Sphere(c, {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    writeEmissionESphere(c, {}, { regime: E5_REGIME.HOT_JUPITER, macroSeed: 1, tempEq: 1400, locked: true });
    const after = writeClimateE5Sphere(c, {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    for (const k of ['bandField', 'bandNorm', 'turbulence', 'mushball', 'W', 'shearMag']) {
      expect(Array.from(after[k])).toEqual(Array.from(before[k]));
    }
  });

  it('[AC3] #3a golden bandField hash is still -1329854088 after the emission writer exists/runs', () => {
    const c = freshCarrier();
    writeEmissionESphere(c, {}, { regime: E5_REGIME.HOT_JUPITER, macroSeed: 1, tempEq: 1400, locked: true });
    const clim = writeClimateE5Sphere(freshCarrier(), {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 });
    expect(hashField(clim.bandField)).toBe(GOLDEN_BANDFIELD_HASH);
  });

  // ── CPU↔GLSL ONE-CURVE PARITY (the reshape's regression-safety gap) ────────────────────────────
  it('[parity] the GLSL emissiveBlackbody stops + smoothstep breakpoints equal the CPU EMISSION_BB_STOPS (≤1e-6)', () => {
    const glslSrc = readFileSync(GLSL_SRC_PATH, 'utf8');
    // isolate the emissiveBlackbody GLSL function body
    const start = glslSrc.indexOf('vec3 emissiveBlackbody');
    expect(start).toBeGreaterThan(-1);
    const body = glslSrc.slice(start, glslSrc.indexOf('}', start));
    // extract color stops: initial `vec3 c = vec3(r,g,b)` + each `mix(c, vec3(r,g,b), ...)` target
    const colors = [...body.matchAll(/vec3\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)]
      .map((m) => [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    // extract smoothstep breakpoints in order
    const breaks = [...body.matchAll(/smoothstep\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*tempK\s*\)/g)]
      .map((m) => [parseFloat(m[1]), parseFloat(m[2])]);

    // 5 color stops, 4 smoothstep segments
    expect(colors.length).toBe(EMISSION_BB_STOPS.length);
    expect(breaks.length).toBe(EMISSION_BB_STOPS.length - 1);

    // colors match the CPU stops in order
    for (let i = 0; i < EMISSION_BB_STOPS.length; i++) {
      for (let ch = 0; ch < 3; ch++) expect(Math.abs(colors[i][ch] - EMISSION_BB_STOPS[i].c[ch])).toBeLessThanOrEqual(1e-6);
    }
    // smoothstep breakpoints match consecutive CPU stop temperatures
    for (let i = 0; i < breaks.length; i++) {
      expect(Math.abs(breaks[i][0] - EMISSION_BB_STOPS[i].T)).toBeLessThanOrEqual(1e-6);
      expect(Math.abs(breaks[i][1] - EMISSION_BB_STOPS[i + 1].T)).toBeLessThanOrEqual(1e-6);
    }
  });

  it('[parity] the CPU emissiveBlackbody chained-mix agrees with an independent re-eval of the same stops (≤1e-6)', () => {
    // independent re-implementation of the chained-mix from the stop table (guards the loop itself)
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const ref = (T) => {
      if (T <= EMISSION_BB_STOPS[0].T) return EMISSION_BB_STOPS[0].c.slice();
      if (T >= EMISSION_BB_STOPS[EMISSION_BB_STOPS.length - 1].T) return EMISSION_BB_STOPS[EMISSION_BB_STOPS.length - 1].c.slice();
      let c = EMISSION_BB_STOPS[0].c.slice();
      for (let i = 1; i < EMISSION_BB_STOPS.length; i++) {
        const w = ss(EMISSION_BB_STOPS[i - 1].T, EMISSION_BB_STOPS[i].T, T);
        c = c.map((v, ch) => v + (EMISSION_BB_STOPS[i].c[ch] - v) * w);
      }
      return c;
    };
    for (const T of [500, 800, 1100, 1500, 2000, 2500, 3500, 4000, 5000, 6500, 8000]) {
      const a = emissiveBlackbody(T), b = ref(T);
      for (let ch = 0; ch < 3; ch++) expect(Math.abs(a[ch] - b[ch])).toBeLessThanOrEqual(1e-6);
    }
  });

  // ── bake parity stub sanity (optional; substrate for #5/#6) ────────────────────────────────────
  it('[bake] bakeEmissionEAttributes.aEmitT === writeEmissionESphere.emitT at matching node directions', () => {
    const R = 7.3;
    for (const cfg of [
      { regime: E5_REGIME.HOT_JUPITER, tempEq: 1400, locked: true },
      { regime: E5_REGIME.GAS_GIANT, tempEq: 125, locked: false },
    ]) {
      const c = freshCarrier();
      const o = writeEmissionESphere(c, {}, { ...cfg, macroSeed: 5 });
      const positions = new Float32Array(c.N * 3);
      for (let i = 0; i < c.N; i++) { positions[3 * i] = c.verts[i][0] * R; positions[3 * i + 1] = c.verts[i][1] * R; positions[3 * i + 2] = c.verts[i][2] * R; }
      const bake = bakeEmissionEAttributes(positions, c.N, R, { ...cfg, macroSeed: 5 });
      let worst = 0;
      for (let i = 0; i < c.N; i++) worst = Math.max(worst, Math.abs(bake.aEmitT[i] - o.emitT[i]));
      expect(worst).toBeLessThan(1.0);                       // float32 render-position round-trip slop
    }
  });
});

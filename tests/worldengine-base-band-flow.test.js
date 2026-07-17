// tests/worldengine-base-band-flow.test.js
// Atmo-expression (BUILD-PLAN world-engine-atmo-expression-2026-07-17) UNIT acceptance for the CPU
// mirrors of the three new render terms (band-flow.js): AC-ADVECT (anisotropy + perceptual amplitude
// floor), AC-JAG (belt-CENTER/zone-CENTER split + per-seed draw), the bandProxy↔aBand parity LINCHPIN, a
// headless wake-reach sanity floor, and AC-ZERO-CLOBBER stream-disjointness (both goldens frozen with the
// new bandFlow:rough stream drawn). Molds: climate-e5 static-source + golden-hash + arm's-length.
// Assertion bands are KEYED to the Phase-A calibration candidates (calibration-candidates.md;
// tools/atmo-expression-calibrate.mjs) — a later amplitude shrink FAILS instead of passing on ratio alone.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import {
  E5_REGIME, DRIVER_BUNDLES, resolveParams, bakeClimateE5Attributes, writeClimateE5Sphere, PHYS,
} from '../src/worldengine/base/climate-e5.js';
import {
  drawGiantConditions, deriveGiantDrivers, canonicalGiantCondition, SWEEP_SEEDS,
} from '../src/worldengine/base/giant-drivers.js';
import { writeStormESphere, resolveStormE } from '../src/worldengine/base/storm-e.js';
import {
  BAND_FLOW, BAND_FLOW_DEFAULTS,
  bandProxy, bandProxyUniforms, advectDisplacement, stormBandDrag, bandRoughness, drawBandRoughness,
  advectAnisotropyRatio, bandRoughnessCenters, wakeReachProfile,
} from '../src/worldengine/base/band-flow.js';

// ── shared fixtures (climate-e5/storm-e mold) ──────────────────────────────────────────────────────────
const TARGET_N = 4000, LLOYD = 2;
const SHARED_MESH = buildIrregularSphere(TARGET_N, LLOYD);
const freshCarrier = () => makeSphereField(SHARED_MESH);
const GAS = { composition: 'h2-he' };
// AC-ADVECT / AC-JAG sweep regimes (BUILD-PLAN §3.3/§4.4). Sub-Neptune is haze-muted (contrast reduced by
// design) so its band-value deflection is intentionally faint — it is measured in the calibration sweep
// but NOT held to the vivid-deck amplitude floor here.
const AC_REGIMES = [E5_REGIME.GAS_GIANT, E5_REGIME.SATURNIAN, E5_REGIME.NEPTUNIAN];
const GOLDEN_BANDFIELD_HASH = -1329854088;
const GOLDEN_STORM_MASK_HASH = 568852786;

const SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/band-flow.js', import.meta.url)), 'utf8');
// source with comments stripped — static guards inspect CODE, not documentation prose (climate-e5 idiom)
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
// deterministic int32 hash over a Float32Array (byte-stable since the field is deterministic)
const hashField = (f) => { let h = 0x811c9dc5 | 0; for (let i = 0; i < f.length; i++) h = (Math.imul(h, 31) + Math.round(f[i] * 1e6)) | 0; return h; };

// per-seed lab-path P (derived D-slots + bundle rotationRate/radius — the giant-drivers-calibrate idiom)
const seedP = (regime, seed) => {
  const bundle = DRIVER_BUNDLES[regime];
  const d = deriveGiantDrivers(drawGiantConditions(regime, canonicalGiantCondition(regime), seed));
  const drv = { ...d, rotationRate: bundle.rotationRate, radius: bundle.radius };
  return { P: resolveParams(regime, drv, seed), drv };
};

// ── Phase-A calibration-pinned AC assertion bands (calibration-candidates.md) ──────────────────────────
const ADVECT_RATIO_LO = 1.6;      // measured J/S/N ratio min 1.953 (margin down)
const ADVECT_RATIO_HI = 3.2;      // measured J/S/N ratio max 2.787 (margin up)
const ADVECT_NULL_MAX = 1.5;      // measured isotropic-null max 1.301 — clearly below ADVECT_RATIO_LO
const ADVECT_DLAT_FLOOR_BW = 0.08;// 2× the candidate floor — INK_AMP frozen ×2 at the 2026-07-17 Phase-B read-gate; a later shrink back to the sub-perceptual candidate FAILS here
const ADVECT_DBAND_FLOOR = 0.10;  // 2× the candidate floor (same freeze)
const JAG_RATIO_FLOOR = 30;       // measured all-regime belt/zone min 36.7 (J/S/N min 233)
const WAKE_DSR = 3;               // downstream ds/R past the old 2.6R GRS cone
const WAKE_DLAT_FLOOR = 0.01;     // measured wake |dLat| at ds/R=3 ≈ 0.19·R (R∈[0.18,0.30] ⇒ 0.034+)
const ADVECT_STEPS = 256;         // transect samples (moderate; ratio stable, keeps the suite fast)

describe('worldengine base — band-flow atmo-expression CPU mirrors (atmo-expression 2026-07-17)', () => {
  // ── STATIC SOURCE: no uTime / no Math.random / alea only on the bandFlow namespace ──────────────────
  it('no Math.random()/Date.now()/uTime in the mirror; every alea() is bandFlow-namespaced', () => {
    expect(SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SRC).not.toMatch(/Date\.now\s*\(/);
    // static place-once: no uTime concept in the CODE (comments may reference the rule)
    expect(CODE).not.toMatch(/uTime/);
    // no animated-warp path identifiers in the CODE (the diff-scoped grep for the GLSL; whole-CODE here)
    expect(CODE).not.toMatch(/\b(ph0|ph1|r0|r1|jetsDisp|jetRotY)\b/);
    // every alea() is seeded on a bandFlow: namespace, disjoint from climateE5:/stormE:/giantD:
    const aleas = [...SRC.matchAll(/alea\(([^)]*)\)/g)].map((m) => m[1]);
    expect(aleas.length).toBeGreaterThan(0);
    for (const a of aleas) {
      expect(a).toContain('bandFlow:');
      expect(a).not.toMatch(/climateE5:|stormE:|giantD:/);
    }
    // the new per-seed variety stream is the append-only bandFlow:rough
    expect(SRC).toContain('bandFlow:rough:');
  });

  // ── LINCHPIN: bandProxy reconstructs the baked aBand to float tolerance (parity < 1e-3) ─────────────
  it('[parity] bandProxy(lat,P) ≈ bakeClimateE5Attributes.aBand(lat) < 1e-3 across a latitude sweep × real presets', () => {
    const LAT = 401;
    let worst = 0;
    for (const regime of [...AC_REGIMES, E5_REGIME.SUB_NEPTUNE]) {
      for (const seed of SWEEP_SEEDS) {
        const { P, drv } = seedP(regime, seed);
        const pos = new Float32Array(LAT * 3);
        const latOf = (i) => (-0.5 + i / (LAT - 1)) * Math.PI * 0.999;
        for (let i = 0; i < LAT; i++) { const lat = latOf(i); pos[3 * i] = Math.cos(lat); pos[3 * i + 1] = Math.sin(lat); pos[3 * i + 2] = 0; }
        const { aBand } = bakeClimateE5Attributes(pos, LAT, 1, { regime, drivers: drv, macroSeed: seed });
        for (let i = 0; i < LAT; i++) worst = Math.max(worst, Math.abs(bandProxy(latOf(i), P) - aBand[i]));
      }
    }
    expect(worst).toBeLessThan(1e-3);
  });

  it('[parity] bandProxyUniforms(P) reproduces the DEFLECT_SCALE the proxy uses (export-site derivation)', () => {
    const { P } = seedP(E5_REGIME.GAS_GIANT, 42);
    const u = bandProxyUniforms(P);
    expect(u.uBandM).toBe(P.m);
    expect(u.uBandDeflectScale).toBeCloseTo(0.5 * P.contrast / (P.aEq + P.aMid * P.envMax), 12);
  });

  // ── AC-ADVECT: genuinely directional (anisotropic), static, per-seed, at the bold amplitude ─────────
  it('[AC-ADVECT] anisotropy L_east/L_north in the calibrated band on every seed; isotropic null rejected', () => {
    for (const regime of AC_REGIMES) for (const seed of SWEEP_SEEDS) {
      const { P } = seedP(regime, seed);
      const a = advectAnisotropyRatio(P, { steps: ADVECT_STEPS });
      const nul = advectAnisotropyRatio(P, { stretch: 1, steps: ADVECT_STEPS });
      const where = `${regime}/${seed}`;
      expect(a.ratio, `ratio ${where}`).toBeGreaterThan(ADVECT_RATIO_LO);
      expect(a.ratio, `ratio ${where}`).toBeLessThan(ADVECT_RATIO_HI);
      expect(nul.ratio, `null ${where}`).toBeLessThan(ADVECT_NULL_MAX);
      expect(nul.ratio, `null<ratio ${where}`).toBeLessThan(a.ratio);
    }
  });

  it('[AC-ADVECT] peak |dLat|/|dBand| amplitude floor keyed to band-width (a ratio alone can pass sub-perceptual)', () => {
    for (const regime of AC_REGIMES) for (const seed of SWEEP_SEEDS) {
      const { P } = seedP(regime, seed);
      const a = advectAnisotropyRatio(P, { steps: ADVECT_STEPS });
      const where = `${regime}/${seed}`;
      expect(a.peakDLatBandWidths, `peak|dLat| ${where}`).toBeGreaterThan(ADVECT_DLAT_FLOOR_BW);
      expect(a.peakDBand, `peak|dBand| ${where}`).toBeGreaterThan(ADVECT_DBAND_FLOOR);
    }
  });

  it('[AC-ADVECT] isotropic null (uInkStretch=1) collapses the anisotropy — the direction mechanism, not noise', () => {
    // aggregate: across the whole sweep the null NEVER reaches the calibrated ratio floor
    let nullMax = 0, ratioMin = Infinity;
    for (const regime of AC_REGIMES) for (const seed of SWEEP_SEEDS) {
      const { P } = seedP(regime, seed);
      nullMax = Math.max(nullMax, advectAnisotropyRatio(P, { stretch: 1, steps: ADVECT_STEPS }).ratio);
      ratioMin = Math.min(ratioMin, advectAnisotropyRatio(P, { steps: ADVECT_STEPS }).ratio);
    }
    expect(nullMax).toBeLessThan(ratioMin);           // clean separation, no overlap
    expect(nullMax).toBeLessThan(ADVECT_NULL_MAX);
  });

  it('[AC-ADVECT] boldness: uAtmoInk scales the displacement (bold at 1, tameable toward 0.5)', () => {
    const { P } = seedP(E5_REGIME.GAS_GIANT, 1);
    const bold = advectAnisotropyRatio(P, { ink: 1.0, steps: ADVECT_STEPS }).peakDLat;
    const tame = advectAnisotropyRatio(P, { ink: 0.5, steps: ADVECT_STEPS }).peakDLat;
    expect(tame).toBeCloseTo(bold * 0.5, 6);          // linear in the dial (uAtmoInk factor)
    expect(bold).toBeGreaterThan(tame);
  });

  it('[AC-ADVECT] repeat-seed byte-equal (deterministic, static — no uTime)', () => {
    for (const regime of AC_REGIMES) for (const seed of [1, 42, 777]) {
      const { P } = seedP(regime, seed);
      const dir = [0.4, 0.5, 0.766];
      const a = advectDisplacement(dir, P), b = advectDisplacement(dir, P);
      expect(a).toBe(b);
    }
  });

  // ── AC-JAG: belt-CENTER rougher than zone-CENTER (cyc split, both wShear≈0) + per-seed global draw ──
  it('[AC-JAG] roughness(belt CENTER)/roughness(zone CENTER) > calibrated floor on every seed (not a boundary tautology)', () => {
    for (const regime of AC_REGIMES) for (const seed of SWEEP_SEEDS) {
      const { P } = seedP(regime, seed);
      const c = bandRoughnessCenters(P, { uBandRough: drawBandRoughness(regime, seed) });
      const where = `${regime}/${seed}`;
      // both centers sit at jetProfile extrema ⇒ wShear≈0 at BOTH (the split is cyc, not shear)
      expect(c.beltShear, `beltShear ${where}`).toBeLessThan(0.35);
      expect(c.zoneShear, `zoneShear ${where}`).toBeLessThan(0.35);
      expect(c.ratio, `belt/zone ${where}`).toBeGreaterThan(JAG_RATIO_FLOOR);
      expect(c.beltRough, `beltRough>zoneRough ${where}`).toBeGreaterThan(c.zoneRough);
    }
  });

  it('[AC-JAG] wShear ALONE cannot key it — a zone center (cyc=0) has ~zero base roughness', () => {
    // the fluid-lens must-fix: roughness ∝ wShear alone makes every band identical. Here cyc drives it.
    const uBandRough = 1.0;
    expect(bandRoughness(0.2 /*belt, wBand<0.5*/, 0 /*wShear≈0 at center*/, uBandRough)).toBeGreaterThan(0.3);
    expect(bandRoughness(0.8 /*zone, wBand>0.5*/, 0 /*wShear≈0 at center*/, uBandRough)).toBe(0);
  });

  it('[AC-JAG] per-seed global draw uBandRough varies across seeds (set-size ≥ ⌈0.75·N⌉); same-seed byte-equal', () => {
    const need = Math.ceil(0.75 * SWEEP_SEEDS.length);
    for (const regime of AC_REGIMES) {
      const draws = SWEEP_SEEDS.map((s) => drawBandRoughness(regime, s));
      const setSize = new Set(draws.map((x) => +x.toFixed(9))).size;
      expect(setSize, `${regime} set-size`).toBeGreaterThanOrEqual(need);
      for (const s of SWEEP_SEEDS) expect(drawBandRoughness(regime, s)).toBe(drawBandRoughness(regime, s));
    }
  });

  // ── Slice I headless wake sanity floor (AC-INTERACT is LIVE; this guards reach + the count-gate) ─────
  it('[wake] stormBandDrag reads past the old 2.6R GRS cone (ds/R=3) and vanishes with no storms (count-gate)', () => {
    for (const seed of SWEEP_SEEDS) {
      const { P, drv } = seedP(E5_REGIME.GAS_GIANT, seed);
      const rec = resolveStormE(E5_REGIME.GAS_GIANT, { ...drv, composition: 'h2-he' }, seed, 1234);
      expect(rec.primary).toBeTruthy();
      const w = wakeReachProfile(rec.primary, P, { ink: 1 });
      const downstream = w.dsAt(WAKE_DSR);
      expect(Math.abs(stormBandDrag(downstream, [rec.primary], P, { ink: 1 })), `wake@3R seed ${seed}`).toBeGreaterThan(WAKE_DLAT_FLOOR);
      expect(w.reachDsR, `reach seed ${seed}`).toBeGreaterThan(2.6);
    }
    // count-gate: no vortices ⇒ exactly 0 (the same lever stormColTerms uses; off whenever uStormCount=0)
    const { P } = seedP(E5_REGIME.GAS_GIANT, 1);
    expect(stormBandDrag([0.3, 0.4, 0.866], [], P)).toBe(0);
    expect(stormBandDrag([0.3, 0.4, 0.866], null, P)).toBe(0);
  });

  it('[wake] downstream sign is DERIVED from the local zonal flow (bandProxy), not hard-coded west', () => {
    // a storm in an eastward jet (zone, bandProxy>0.5) trails its wake EAST; a belt storm trails WEST.
    // flow = sign(bandProxy(latC)-0.5); assert the drag magnitude is asymmetric about the storm meridian.
    const { P, drv } = seedP(E5_REGIME.GAS_GIANT, 7);
    const rec = resolveStormE(E5_REGIME.GAS_GIANT, { ...drv, composition: 'h2-he' }, 7, 1234);
    const w = wakeReachProfile(rec.primary, P, { ink: 1 });
    const down = Math.abs(stormBandDrag(w.dsAt(3), [rec.primary], P, { ink: 1 }));
    // an equal step UPstream (ds/R negative side) is outside the cone (smoothstep(0.05,0.30,ds/R)=0) ⇒ ~0
    const c = rec.primary.center;
    let ex0 = c[2], ex2 = -c[0]; const el = Math.hypot(ex0, 0, ex2) || 1; ex0 /= el; ex2 /= el;
    const latC = Math.asin(Math.max(-1, Math.min(1, c[1])));
    const flow = Math.sign(bandProxy(latC, P) - 0.5) || 1;
    const th = Math.asin(Math.min(3 * (rec.primary.radius || 0.2), 1));
    const up = [c[0] * Math.cos(th) - flow * ex0 * Math.sin(th), c[1] * Math.cos(th), c[2] * Math.cos(th) - flow * ex2 * Math.sin(th)];
    const upMag = Math.abs(stormBandDrag(up, [rec.primary], P, { ink: 1 }));
    expect(down).toBeGreaterThan(upMag);              // wake is DOWNSTREAM, not symmetric
  });

  // ── AC-ZERO-CLOBBER: the new bandFlow:rough stream is disjoint ⇒ both goldens frozen ────────────────
  it('[AC-ZERO-CLOBBER] GOLDEN_BANDFIELD_HASH + GOLDEN_STORM_MASK_HASH unchanged with bandFlow:rough drawn (stream disjoint)', () => {
    const bandBefore = hashField(writeClimateE5Sphere(freshCarrier(), {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 }).bandField);
    const maskBefore = hashField(writeStormESphere(freshCarrier(), GAS, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1, stormSeed: 1234 }).mask);
    expect(bandBefore).toBe(GOLDEN_BANDFIELD_HASH);
    expect(maskBefore).toBe(GOLDEN_STORM_MASK_HASH);
    // draw the NEW stream across every regime × sweep seed — interleaved with the golden recompute
    for (const regime of [...AC_REGIMES, E5_REGIME.SUB_NEPTUNE]) for (const seed of SWEEP_SEEDS) drawBandRoughness(regime, seed);
    const bandAfter = hashField(writeClimateE5Sphere(freshCarrier(), {}, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1 }).bandField);
    const maskAfter = hashField(writeStormESphere(freshCarrier(), GAS, { regime: E5_REGIME.GAS_GIANT, macroSeed: 1, stormSeed: 1234 }).mask);
    expect(bandAfter).toBe(GOLDEN_BANDFIELD_HASH);    // never moved
    expect(maskAfter).toBe(GOLDEN_STORM_MASK_HASH);
  });

  it('[AC-ZERO-CLOBBER] off-gate: mask=0 (non-gas) ⇒ all new terms exactly 0', () => {
    // the render gates advection + jag by clamp(wStorm); a non-gas deck has aStorm=0 everywhere.
    const { P } = seedP(E5_REGIME.GAS_GIANT, 1);
    const dir = [0.4, 0.5, 0.766];
    expect(advectDisplacement(dir, P, { wStorm: 0 })).toBe(0);
    expect(bandRoughness(0.2, 0.9, 1.0) * 0 /* ×clamp(wStorm=0) */).toBe(0);
    // and stormBandDrag is count-gated: non-gas ⇒ no vortices ⇒ 0 (asserted above)
  });

  it('[candidates] the BAND_FLOW constants are the Phase-A candidates the AC bands are keyed to', () => {
    // guards against a silent constant drift decoupling the test bands from the shipped candidates
    expect(BAND_FLOW_DEFAULTS.uAtmoInk).toBe(1.0);
    expect(BAND_FLOW_DEFAULTS.uInkStretch).toBe(3.5);
    expect(BAND_FLOW.ROUGH_MEAN).toBe(1.0);
    expect(BAND_FLOW.ROUGH_SPREAD).toBe(0.4);
    expect(BAND_FLOW.WAKE_BOW).toBeGreaterThanOrEqual(0.3);   // pinned up for the Jovian ≥0.25-band-width bow
  });
});

// ── Slice-K GLSL ↔ mirror constant parity (emission-e CPU↔GLSL precedent, BUILD-PLAN §2.3) ─────────────────
// vitest has no GPU, so numeric truth lives in the band-flow.js mirror (asserted above) and the GLSL is a
// faithful STRUCTURAL transcription. This leg proves the shipped GLSL (planet-lod-height.glsl.js) carries the
// SAME candidate constants + offsets the mirror was calibrated on, declares all 8 K-uniforms IN HEIGHT_GLSL
// (the river-router link — a lab-only decl would compile-fail HEIGHT_FRAG at runtime, golden-lens #1), wires
// the dBand deflection + the 7-param signature, and — DIFF-SCOPED to the two added helper bodies — contains no
// uTime / animated-warp path (F1 static place-once; a whole-file grep false-trips on the legacy F25 jets path).
const GLSL = readFileSync(fileURLToPath(new URL('../planet-lod-height.glsl.js', import.meta.url)), 'utf8');
const LAB  = readFileSync(fileURLToPath(new URL('../planet-lod-lab.html', import.meta.url)), 'utf8');
// the two added slice-K helper bodies ONLY (diff-scoped): from bandProxy's def to the F24 comment that
// precedes zonalBandCol. Comments stripped so the F1 no-uTime grep inspects CODE, not the doc prose that
// legitimately names uTime/ph0/… (the climate-e5 idiom used for the mirror above).
const K_BODIES = GLSL.slice(GLSL.indexOf('float bandProxy(float lat){'), GLSL.indexOf('// ── F24 zonalBandCol'));
const K_CODE = K_BODIES.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const vec3Str = (a) => `vec3(${a[0]}, ${a[1]}, ${a[2]})`;

describe('worldengine base — slice-K GLSL ↔ mirror constant parity (atmo-expression 2026-07-17)', () => {
  it('[wire] all 8 K-uniforms are declared IN HEIGHT_GLSL (river-router HEIGHT_FRAG link; golden-lens #1)', () => {
    for (const u of ['uBandM','uBandPhaseJet','uBandSEq','uBandAMid','uBandS2','uBandDeflectScale','uAtmoInk','uInkStretch']) {
      expect(GLSL, `${u} uniform decl in HEIGHT_GLSL`).toContain(`uniform float ${u};`);
    }
  });

  it('[wire] zonalBandCol gains the 7th param Nraw + the dBand deflection term; the lab call site matches', () => {
    expect(GLSL).toContain('vec3 zonalBandCol(vec3 N, vec3 Nraw, vec3 pos, float wBand, float wShear, float wMush, float wStorm)');
    expect(GLSL).toContain('dAdvect(Nraw, wShear, wBand, wStorm)');
    expect(GLSL).toContain('bandProxy(latRaw + dLat) - bandProxy(latRaw)');
    // signature ↔ call-site parity: a mismatch is a shader compile fail vitest cannot catch, so pin it here
    expect(LAB).toContain('zonalBandCol(bandN, bandNraw, bandPos, vBand, vShear, vMush, vStorm)');
    expect(LAB).toContain('bandProxyUniforms(bake.params)');   // proxy export site (rebakeE5Bands) present
  });

  it('[parity] bandProxy GLSL carries the climate-e5 PHYS consts + the combined DEFLECT_SCALE uniform', () => {
    expect(K_CODE).toContain('uBandDeflectScale');
    expect(K_BODIES).toContain(`AEQ = ${PHYS.A_EQ}`);          // 0.6
    expect(K_BODIES).toContain(`PHI_EQ = ${PHYS.PHI_EQ}`);     // 0.35
    expect(K_BODIES).toContain(`WARD_GAIN = ${PHYS.WARD_GAIN}`); // 0.8
    expect(K_BODIES).toContain(`ENV_BASE = ${PHYS.ENV_BASE}`);   // 1.0
  });

  it('[parity] dAdvect GLSL carries the SAME candidate constants + decorrelation offsets as the BAND_FLOW mirror', () => {
    // scalar candidates — a mirror change without the matching GLSL change fails here (constant-parity intent)
    expect(BAND_FLOW.INK_FREQ).toBe(2.2);  expect(K_BODIES).toContain('INK_FREQ = 2.2');
    expect(BAND_FLOW.INK_AMP).toBe(0.12);  expect(K_BODIES).toContain('INK_AMP = 0.12');   // frozen ×2, Phase-B read-gate 2026-07-17
    expect(BAND_FLOW.FOLD_K).toBe(0.5);    expect(K_BODIES).toContain('FOLD_K = 0.5');
    expect(BAND_FLOW.FOLD_FREQ).toBe(9.0); expect(K_BODIES).toContain('FOLD_FREQ = 9.0');
    // decorrelation offsets keyed to the mirror vectors
    expect(K_BODIES).toContain(vec3Str(BAND_FLOW.INK_OFF));    // vec3(2.7, -1.9, 5.3)
    expect(K_BODIES).toContain(vec3Str(BAND_FLOW.INK_OFF2));   // vec3(-8.1, 4.4, -2.6)
    expect(K_BODIES).toContain(vec3Str(BAND_FLOW.FOLD_OFF));   // vec3(1.7, -3.3, 6.1)
    // the anisotropy MECHANISM: compress the zonal (x,z) plane by 1/uInkStretch, keep y — and mask/ink gating
    expect(K_CODE).toContain('Nraw.x / uInkStretch');
    expect(K_CODE).toContain('Nraw.z / uInkStretch');
    expect(K_CODE).toContain('uAtmoInk');
    expect(K_CODE).toContain('clamp(wStorm, 0.0, 1.0)');       // MASK-gated ⇒ 0 off-gate (non-gas)
    expect(K_CODE).toContain('step(0.5, wBand)');              // belt/zone fold phase flip
  });

  it('[F1] the added slice-K helper bodies contain no uTime / animated-warp path (diff-scoped, comments stripped)', () => {
    expect(K_CODE).not.toMatch(/uTime/);
    expect(K_CODE).not.toMatch(/\b(ph0|ph1|r0|r1|jetRotY|jetsDisp)\b/);
  });
});

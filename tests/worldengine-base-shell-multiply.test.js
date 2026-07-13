// tests/worldengine-base-shell-multiply.test.js
// World-Engine increment V2-5s (world-engine-v2-5s-shell-multiply): the SHELL-side driver→tune MULTIPLY pass
// over the shipped ICE-SHELL relief writer (writeShellReliefSphere, shellRelief.js). The fourth instance of
// the shipped MULTIPLY template (#2 plates driversToTune/D_EARTH, #4-M magmaDriversToTune/MAGMA_REF, V2-2b-1
// stagnantDriversToTune/VENUS_REF): the per-body D-vector (bodyDrivers) is mapped to a `tune` override via
// shellDriversToTune(drivers, regime), anchored PER REGIME so shellDriversToTune(SHELL_REFS[r], r) === null →
// each shipped icy preset (Europa/Titan/Eyeball) renders BYTE-IDENTICAL, non-null off-REF → within-regime
// variety (low-g vs high-g icy worlds differ — the D2-MF5 north-star gap for the icy family).
//
// SLICE A (this file) discharges the writer/builder-level UNIT ACs: AC-0 spine conformance; AC1 determinism +
// zero-RNG + 'shell:'-disjoint + bound; AC-TUNE-NULL byte anchor (null/{}/SHELL_REFS/live-bundle → null,
// exact-slot equality, non-circular); AC-BYTE-SHELL (null-tune ≡ omitted-tune per preset); AC-TUNE-RESPONSE
// (monotone correct-sign per axis, NON-STRICT per the lens fold); AC-VARIETY (per-observable clearance, the
// AMENDED contract AC); AC-ORDER (anti-mush falsifier + key-set + blast-radius). The dispatch wiring + lab +
// integration ACs (AC-ZERO-CLOBBER, AC-LAB, AC-UAT) are SLICE B — NOT this file.
//
// Anti-circularity: every AC-ORDER predictor is rebuilt ARM'S-LENGTH from the PUBLISHED stress geometry
// (diag.thetaTraj + max(0,stressTensile)) with the APPLIED-tune CREST — NEVER from U or lineamentNode. The
// shipped structure suite (worldengine-base-shell-structure.test.js) stays byte-untouched and green.
//
// Calibration evidence for every asserted magnitude lives in
// docs/WORKSTREAMS/world-engine-v2-5s-shell-multiply-2026-07-12/calibration/*.mjs (run FROM REPO ROOT).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createNoise3D } from 'simplex-noise';
import alea from 'alea';
import {
  writeShellReliefSphere, shellDriversToTune, SHELL_REFS, SHELL_BOUND,
} from '../src/worldengine/base/shellRelief.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, DEFAULT_GRAIN_DRIVERS } from '../planet-lod-rivers.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { buildNeutralBodyDrivers } from '../body-drivers.js';
import { deriveConditionVector } from '../body-condition-vector.js';
import { deriveUniforms } from '../planet-lod-lab-core.js';

// N=600, LLOYD=2 — the SAME mesh the shipped shell structure suite + every V2-5s calibration script use. ONE
// mesh reused, fresh carrier per build (== the calibration idiom). SEEDS mirror the sibling MULTIPLY passes.
const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const REGIMES = ['icy-active', 'volatile-cold', 'eyeball-despun'];
const PRESET_OF = { 'icy-active': 'Europa (icy moon)', 'volatile-cold': 'Titan (methane seas)', 'eyeball-despun': 'Eyeball (locked temperate)' };
const SHELL_SRC = readFileSync(fileURLToPath(new URL('../src/worldengine/base/shellRelief.js', import.meta.url)), 'utf8');
const mesh = buildIrregularSphere(TARGET_N, LLOYD);
const carrierOf = () => makeSphereField(mesh);

// build via the NEW tune-threaded path: tune = shellDriversToTune(drivers, regime) (null at each REF). drivers
// is void'd by the writer (seed-only body), so `?? {}` is only signature hygiene — the tune carries all response.
const build = (macroSeed, regime, drivers) => {
  const c = carrierOf();
  const tune = shellDriversToTune(drivers, regime);
  const diag = writeShellReliefSphere(c, drivers ?? {}, { macroSeed, regime, tune });
  return { c, diag, tune };
};

// ── the live bundle the 83-golden harness builds for each shipped icy preset — the NON-CIRCULAR anchor:
//    SHELL_REFS[regime] must equal THIS (built through the real derive pipeline), not just itself. ──────────
const fpOf = (regime) => DRIVER_PRESETS[PRESET_OF[regime]];
const uniformsOf = (regime) => deriveUniforms(fpOf(regime), 1.0);
const liveBundleOf = (regime) => {
  const fp = fpOf(regime), u = uniformsOf(regime);
  return { ...buildNeutralBodyDrivers(u, fp), condition: deriveConditionVector(fp, u, fp.radiusEarth) };
};

// ── observables (verbatim from calibration/gain-probes.mjs observe()) ────────────────────────────────────
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
const stdev = (a) => { const m = mean(a); let v = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - m; v += d * d; } return Math.sqrt(v / a.length); };
function observe(diag) {
  let lin = 0, chaos = 0;
  for (let i = 0; i < diag.lineamentNode.length; i++) if (diag.lineamentNode[i]) lin++;
  for (let i = 0; i < diag.chaosMask.length; i++) if (diag.chaosMask[i] > 1e-6) chaos++;
  const N = diag.U.length;
  return { linN: lin, linFrac: lin / N, stdU: stdev(diag.U), chaosFrac: chaos / N, cellCount: diag.cellCount };
}
const obsOf = (macroSeed, regime, drivers) => observe(build(macroSeed, regime, drivers).diag);
// per-observable noise floor = the 5-seed spread at REF drivers (null → tune null → shipped preset). The
// V2-2b-1 delta-min discipline generalized to the shell observable vector.
function floors(regime) {
  const rows = SEEDS.map((s) => obsOf(s, regime, null));
  const f = {};
  for (const k of ['linN', 'linFrac', 'stdU', 'chaosFrac', 'cellCount']) { const v = rows.map((o) => o[k]); f[k] = Math.max(...v) - Math.min(...v); }
  return f;
}

// ── AC-ORDER arm's-length predictor (verbatim from calibration/order-probe.mjs; CREST parameterized by the
//    APPLIED tune — SHOULDER/TROUGH/RIDGE_FREQ are load-bearing, untuned). Rebuilt ONLY from PUBLISHED
//    thetaTraj + max(0,stressTensile), NEVER from U/lineamentNode. The REF point (tune null) uses the writer's
//    default CREST_THRESH (0.94, shellRelief.js:83) — the ONE mirrored default; every driven point reads the
//    tune's own CREST. ──────────────────────────────────────────────────────────────────────────────────────
const D_CREST_THRESH = 0.94;   // mirror of SHELL_DEFAULTS.CREST_THRESH (shellRelief.js:83); used only at REF (null tune)
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den;
}
const varExplained = (x, y) => { const r = pearson(x, y); return r * r; };
const clamp01T = (x) => Math.max(0, Math.min(1, x));
const smoothstepT = (a, b, x) => { const t = clamp01T((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// contraction (sign>=0) anisotropy constants — MATCH the writer's default steeredNoise3 call.
function steeredNoise3T(noise3, dir, east, north, angle, freq) {
  const ca = Math.cos(angle), sa = Math.sin(angle), fScale = 0.7, along = 0.25, across = 1.9;
  const sU = freq * fScale * along, sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa, uy = east[1] * ca + north[1] * sa, uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca, vy = -east[1] * sa + north[1] * ca, vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV, py = dir[1] * freq + uy * sU + vy * sV, pz = dir[2] * freq + uz * sU + vz * sV;
  return 0.5 - Math.abs(noise3(px, py, pz));
}
function stressPredictor(c, diag, seed, tune) {
  const N = c.N, ridgeNoise = createNoise3D(alea('shell:ridge:' + seed));
  const CREST = tune ? tune.CREST_THRESH : D_CREST_THRESH, SHOULDER = 1.2, TROUGH = 0.55, RIDGE_FREQ = 7.0;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const { east, north } = c.tangentFrameAt(i);
    const R = steeredNoise3T(ridgeNoise, c.verts[i], east, north, diag.thetaTraj[i] + Math.PI / 2, RIDGE_FREQ) + 0.5;
    const t = clamp01T((R - CREST) / (1 - CREST));
    const dr = SHOULDER * 4 * t * (1 - t) - TROUGH * smoothstepT(0.6, 1.0, t);
    raw[i] = Math.max(0, diag.stressTensile[i]) * dr;
  }
  const cur = raw.slice(), tmp = new Float32Array(N);
  for (let pass = 0; pass < 4; pass++) { for (let i = 0; i < N; i++) { let s = cur[i], cnt = 1; const nb = c.adj[i]; for (let k = 0; k < nb.length; k++) { s += cur[nb[k]]; cnt++; } tmp[i] = cur[i] * 0.5 + (s / cnt) * 0.5; } cur.set(tmp); }
  return cur;
}
function lineamentInteriorRatio(diag) {
  const U = diag.U, lin = diag.lineamentNode, N = U.length, m = mean(U);
  let ls = 0, lc = 0, qs = 0, qc = 0;
  for (let i = 0; i < N; i++) { const a = Math.abs(U[i] - m); if (lin[i]) { ls += a; lc++; } else { qs += a; qc++; } }
  const lm = lc ? ls / lc : 0, qm = qc ? qs / qc : 1e-6;
  return qm > 0 ? lm / qm : Infinity;
}
function latFields(c, w0) {
  const N = c.N, latY = new Float64Array(N), latW = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const y = Math.max(-1, Math.min(1, c.verts[i][1])); latY[i] = 1 - y * y;    // r² invariant vs sin²(lat)
    const cw = Math.max(-1, Math.min(1, c.verts[i][0] * w0[0] + c.verts[i][1] * w0[1] + c.verts[i][2] * w0[2])); latW[i] = 1 - cw * cw;
  }
  return { latY, latW };
}

// ── function-body slice by brace-matching (AC-0's denylist must scope to the BUILDER BODY, not the whole
//    file — shellRegimeOf(/archetype/PRESET_ARCHETYPE appear at shellRegimeOf's own definition + in prose, so
//    a whole-file grep self-defeats; verbatim from the stagnant multiply test). ──────────────────────────────
function funcBody(src, name) {
  const start = src.indexOf('export function ' + name);
  let depth = 0, end = -1;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return src.slice(start, end);
}
const TUNE_BODY = funcBody(SHELL_SRC, 'shellDriversToTune');
// The frozen SAFE-KEY allowlist (contract designDecision "SAFE-KEYS vs LOAD-BEARING") + the load-bearing
// keys the tune must NEVER return (STRESS_REF calibration / cross-section shape / structural constants).
const ALLOWED_KEYS = new Set(['CELL_MIN', 'CREST_THRESH', 'TENSILE_THRESH', 'CHAOS_THRESH', 'RIDGE_AMP', 'CHAOS_AMP', 'CHAOS_BASE']);
const FORBIDDEN_KEYS = ['DESPIN_REF', 'DIUR_REF', 'DIUR_PEAK', 'SHOULDER_HT', 'TROUGH_DEPTH', 'SHELL_BASE', 'RELAX_PASSES', 'REGIME_WEIGHTS',
  'BELT_RADIANS', 'WARP_FREQ', 'WARP_AMP', 'DETAIL_FREQ', 'DETAIL_AMP', 'RIDGE_FREQ', 'CHAOS_FREQ', 'CELL_SPAN'];
// each knob → its named observable consumer (contract AC-0(2)) — every returned key MUST have one.
const KNOB_CONSUMERS = {
  CELL_MIN: 'cellCount', CREST_THRESH: 'lineamentNodeCount', TENSILE_THRESH: 'lineamentNodeCount',
  RIDGE_AMP: 'stdU', CHAOS_AMP: 'stdU', CHAOS_BASE: 'stdU', CHAOS_THRESH: 'chaosFrac',
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-0 — spine conformance (Rule 15). The builder reads ONLY D-slot channels; NO archetype/label/radiusEarth.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC-0 — spine conformance (driver-connectivity, no archetype, seed-stability radiusEarth ban)', () => {
  it('(1) the shellDriversToTune BODY reads NO archetype input: no archetype string, no shellRegimeOf(, no PRESET_ARCHETYPE, no e1.label', () => {
    // body-scoped (whole-file would self-defeat: shellRegimeOf(/archetype/PRESET_ARCHETYPE live at shellRegimeOf's
    // own export + in module prose comments).
    expect(TUNE_BODY).not.toMatch(/\barchetype\b/);
    expect(TUNE_BODY).not.toMatch(/shellRegimeOf\(/);
    expect(TUNE_BODY).not.toMatch(/PRESET_ARCHETYPE/);
    expect(TUNE_BODY).not.toMatch(/e1\.label/);
    // e1.label appears NOWHERE in the file (stronger whole-file guard — the builder takes no e1 at all).
    expect(SHELL_SRC).not.toMatch(/e1\.label/);
  });

  it('(1) SEED-STABILITY: the BODY never reads condition.radiusEarth (the DRAWN radius — seed-varying)', () => {
    // the load-bearing new-for-shell rule (designDecision "SEED-STABILITY"): radiusEarth must be grep-clean in
    // the builder body even though the module JSDoc mentions it (as the thing it must NOT read).
    expect(TUNE_BODY).not.toMatch(/radiusEarth/);
  });

  it('(1) the BODY reads ONLY the sanctioned D-slot read surface: flat massGravity/volatileFraction/tidalHeating + NESTED condition?.T_eq', () => {
    expect(TUNE_BODY).toMatch(/drivers\.massGravity/);            // FLAT g D-slot
    expect(TUNE_BODY).toMatch(/drivers\.volatileFraction/);       // FLAT V D-slot
    expect(TUNE_BODY).toMatch(/drivers\.tidalHeating/);           // FLAT tidal D-slot
    expect(TUNE_BODY).toMatch(/drivers\.condition\?\.T_eq/);      // NESTED T_eq (optional-chained, never-throw)
    // the regime parameter is the sanctioned derived-context REF selector (NOT a label read inside the builder).
    expect(TUNE_BODY).toMatch(/SHELL_REFS\[regime\]/);
  });

  it('(2) every tuned knob has a named observable consumer (no dead knobs): the return ⊆ the 7 SAFE knobs', () => {
    const t = shellDriversToTune({ massGravity: 0.07, volatileFraction: 0.9, tidalHeating: 5000, condition: { T_eq: 250 } }, 'icy-active');
    expect(t).not.toBeNull();
    for (const k of Object.keys(t)) {
      expect(ALLOWED_KEYS.has(k), `${k} is a SAFE knob`).toBe(true);
      expect(KNOB_CONSUMERS[k], `${k} has a named observable consumer`).toBeDefined();
    }
    // the named consumers are all real observables produced by observe()/the writer diag.
    const o = observe(build(7, 'icy-active', { massGravity: 0.07 }).diag);
    for (const consumer of new Set(Object.values(KNOB_CONSUMERS))) {
      const present = consumer === 'lineamentNodeCount' ? 'linN' in o : consumer in o;
      expect(present, `named consumer ${consumer} is an observable`).toBe(true);
    }
  });

  it('(3) taxonomy: SLICE A adds NO lab slider / *Enabled key to the writer source (driver overrides only)', () => {
    expect(SHELL_SRC).not.toMatch(/\w+Enabled\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC1 — determinism + zero new RNG + 'shell:' namespace disjoint + |U| bound
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC1 — determinism + zero-RNG + shell: disjoint + |U| bound', () => {
  it('shellDriversToTune is a pure deterministic mapper (no Math.random / Date.now) with read-only inputs', () => {
    expect(String(shellDriversToTune)).not.toMatch(/Math\.random|Date\.now/);
    const drv = { massGravity: 0.09, volatileFraction: 0.7, tidalHeating: 3000, condition: { T_eq: 200 } };
    const before = JSON.stringify(drv);
    shellDriversToTune(drv, 'icy-active');
    expect(JSON.stringify(drv)).toBe(before);                                       // never mutates its arg
    expect(shellDriversToTune(drv, 'icy-active')).toEqual(shellDriversToTune(drv, 'icy-active')); // deterministic
  });

  it('the builder opens NO alea stream; the writer keeps its disjoint shell: namespace (never lid:/disrupt:/plates:)', () => {
    expect(TUNE_BODY).not.toMatch(/alea\(/);                    // the builder computes DEFAULTS overrides only
    expect(SHELL_SRC).not.toMatch(/Math\.random\s*\(/);
    expect(SHELL_SRC).not.toMatch(/Date\.now\s*\(/);
    expect(SHELL_SRC).toMatch(/alea\('shell:/);                 // writer still keys the shell: stream
    expect(SHELL_SRC).not.toMatch(/alea\('lid:/);               // V2-2b/V2-7d namespaces stay untouched
    expect(SHELL_SRC).not.toMatch(/alea\('disrupt:/);
    expect(SHELL_SRC).not.toMatch(/alea\('plates:/);
  });

  it('same (drivers, regime, seed) → byte-identical carrier + diag on repeat builds (null + non-null tune), |U| < SHELL_BOUND', () => {
    const cases = [null, { massGravity: 0.07, volatileFraction: 0.9, tidalHeating: 5000, condition: { T_eq: 240 } }];
    for (const drv of cases) {
      for (const r of REGIMES) {
        for (const s of SEEDS) {
          const a = build(s, r, drv), b = build(s, r, drv);
          const tag = `${r} seed ${s} tune=${a.tune ? 'nonnull' : 'null'}`;
          expect(Array.from(a.c.height), `${tag}: carrier.height`).toEqual(Array.from(b.c.height));
          expect(Array.from(a.diag.U), `${tag}: U`).toEqual(Array.from(b.diag.U));
          expect(Array.from(a.diag.stressTensile), `${tag}: stressTensile`).toEqual(Array.from(b.diag.stressTensile));
          expect(Array.from(a.diag.lineamentNode), `${tag}: lineamentNode`).toEqual(Array.from(b.diag.lineamentNode));
          expect(Array.from(a.diag.cellId), `${tag}: cellId`).toEqual(Array.from(b.diag.cellId));
          let maxAbs = 0, finite = true;
          for (let i = 0; i < a.diag.U.length; i++) { const v = a.diag.U[i]; if (!Number.isFinite(v)) finite = false; maxAbs = Math.max(maxAbs, Math.abs(v)); }
          expect(finite, `${tag}: finite`).toBe(true);
          expect(maxAbs, `${tag}: |U|max=${maxAbs.toFixed(3)} < ${SHELL_BOUND}`).toBeLessThan(SHELL_BOUND);
        }
      }
    }
  });

  it("NAMED NON-ISSUE: a CELL_MIN override changes the 'shell:cells:' draw count — deterministic per (seed, tune), NOT a determinism break", () => {
    // exactly the stagnant CORONA_POOL precedent: more cells ⇒ more randDir draws, but the count is a pure
    // function of (seed, tune) so it is bit-stable on repeat — asserted here so a reviewer doesn't misread it.
    for (const s of SEEDS) {
      const ref = build(s, 'icy-active', null);                                   // CELL_MIN default (tune null)
      const warm = build(s, 'icy-active', { condition: { T_eq: 250 } });          // CELL_MIN raised (finer cells)
      const warm2 = build(s, 'icy-active', { condition: { T_eq: 250 } });
      expect(warm.tune.CELL_MIN, `seed ${s}: CELL_MIN raised over default`).toBeGreaterThan(9);
      expect(warm.diag.cellCount, `seed ${s}: cellCount moved with CELL_MIN`).toBeGreaterThan(ref.diag.cellCount);
      expect(warm.diag.cellCount, `seed ${s}: draw-count deterministic on repeat`).toBe(warm2.diag.cellCount);
      expect(Array.from(warm.diag.cellId)).toEqual(Array.from(warm2.diag.cellId));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-TUNE-NULL — the byte anchor ×3 regimes, non-circular
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC-TUNE-NULL — byte anchor (null/{}/SHELL_REFS/live-bundle → null, exact-slot, non-circular)', () => {
  it('(a0) the null-guard fires FIRST: shellDriversToTune(null, r) === null AND ({}, r) === null, every regime', () => {
    for (const r of REGIMES) {
      expect(shellDriversToTune(null, r), `${r}: null → null`).toBeNull();
      expect(shellDriversToTune({}, r), `${r}: {} → null`).toBeNull();
    }
  });

  it('(a) shellDriversToTune(SHELL_REFS[r], r) === null per regime (exact-only identity guard)', () => {
    for (const r of REGIMES) expect(shellDriversToTune(SHELL_REFS[r], r), `${r}: REF → null`).toBeNull();
  });

  it('(b) the ACTUALLY-CONSTRUCTED live Europa/Titan/Eyeball bundle → null (non-circular; catches g/tidal/T_eq drift)', () => {
    for (const r of REGIMES) expect(shellDriversToTune(liveBundleOf(r), r), `${r}: live-bundle → null`).toBeNull();
  });

  it('(c) SHELL_REFS is frozen and every read slot === the live-derived slot to full float precision', () => {
    expect(Object.isFrozen(SHELL_REFS)).toBe(true);
    for (const r of REGIMES) {
      expect(Object.isFrozen(SHELL_REFS[r]), `${r}: frozen`).toBe(true);
      expect(Object.isFrozen(SHELL_REFS[r].condition), `${r}: condition frozen`).toBe(true);
      const u = uniformsOf(r), live = liveBundleOf(r);
      // massGravity is a load-bearing exactness: the mass/R² derivation EXPRESSION === deriveUniforms.surfaceGravity.
      expect(SHELL_REFS[r].massGravity, `${r}: massGravity === u.surfaceGravity`).toBe(u.surfaceGravity);
      expect(SHELL_REFS[r].massGravity, `${r}: massGravity === live`).toBe(live.massGravity);
      // tidalHeating derived via the plates ioRef formula === deriveUniforms.tidalHeat (no hand-typed decimal).
      expect(SHELL_REFS[r].tidalHeating, `${r}: tidalHeating === u.tidalHeat`).toBe(u.tidalHeat);
      expect(SHELL_REFS[r].tidalHeating, `${r}: tidalHeating === live`).toBe(live.tidalHeating);
      expect(SHELL_REFS[r].volatileFraction, `${r}: volatileFraction === live`).toBe(live.volatileFraction);
      expect(SHELL_REFS[r].condition.T_eq, `${r}: condition.T_eq === live`).toBe(live.condition.T_eq);
      // the builder must NEVER read radiusEarth — it IS on the live bundle's condition (the seed-stability trap).
      expect(live.condition.radiusEarth, `${r}: live carries the drawn radiusEarth`).toBeDefined();
      expect(SHELL_REFS[r].condition.radiusEarth, `${r}: REF has NO radiusEarth slot`).toBeUndefined();
    }
  });

  it('(d) a slightly-perturbed vector returns a non-null override ⊆ the 7 SAFE knobs (non-vacuousness), every regime', () => {
    for (const r of REGIMES) {
      for (const drv of [{ massGravity: SHELL_REFS[r].massGravity * 0.5 }, { tidalHeating: SHELL_REFS[r].tidalHeating * 100 }, { condition: { T_eq: SHELL_REFS[r].condition.T_eq + 80 } }]) {
        const t = shellDriversToTune(drv, r);
        expect(t, `${r} perturbed ${JSON.stringify(drv)} → non-null`).not.toBeNull();
        for (const k of Object.keys(t)) expect(ALLOWED_KEYS.has(k), `${r}: ${k} ∈ SAFE knobs`).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-BYTE-SHELL — null-tune ≡ omitted-tune (the ZERO-CLOBBER core, dual-carrier, 3 presets × seeds {1,2,3,7,42})
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC-BYTE-SHELL — the null-tune path is bit-for-bit the shipped preset, every regime × seed', () => {
  it('writeShellReliefSphere(grainDrivers, no tune) === writeShellReliefSphere(live-bundle, tune:shellDriversToTune(SHELL_REFS[r],r)=null)', () => {
    for (const r of REGIMES) {
      const live = liveBundleOf(r);
      const refTune = shellDriversToTune(SHELL_REFS[r], r);
      expect(refTune, `${r}: REF tune is null (the byte anchor)`).toBeNull();
      for (const s of SEEDS) {
        // baseline = the SHIPPED dispatch call shape (grainDrivers = DEFAULT_GRAIN_DRIVERS, tune omitted).
        const cBase = carrierOf();
        const base = writeShellReliefSphere(cBase, DEFAULT_GRAIN_DRIVERS, { macroSeed: s, regime: r });
        // new path = the live body bundle as the drivers arg (writer voids it) + tune (=== null by construction).
        const cRef = carrierOf();
        const ref = writeShellReliefSphere(cRef, live, { macroSeed: s, regime: r, tune: refTune });
        const tag = `${r} seed ${s}`;
        expect(Array.from(cRef.height), `${tag}: carrier.height`).toEqual(Array.from(cBase.height));
        expect(Array.from(cRef.grainAngle), `${tag}: carrier.grainAngle`).toEqual(Array.from(cBase.grainAngle));
        expect(Array.from(cRef.faultDensity), `${tag}: carrier.faultDensity`).toEqual(Array.from(cBase.faultDensity));
        expect(Array.from(ref.U), `${tag}: U`).toEqual(Array.from(base.U));
        expect(Array.from(ref.stressTensile), `${tag}: stressTensile`).toEqual(Array.from(base.stressTensile));
        expect(Array.from(ref.thetaTraj), `${tag}: thetaTraj`).toEqual(Array.from(base.thetaTraj));
        expect(Array.from(ref.lineamentNode), `${tag}: lineamentNode`).toEqual(Array.from(base.lineamentNode));
        expect(Array.from(ref.chaosMask), `${tag}: chaosMask`).toEqual(Array.from(base.chaosMask));
        expect(Array.from(ref.cellId), `${tag}: cellId`).toEqual(Array.from(base.cellId));
        expect(ref.cellCount, `${tag}: cellCount`).toBe(base.cellCount);
        const lnRef = ref.lineamentNode.reduce((a, v) => a + v, 0), lnBase = base.lineamentNode.reduce((a, v) => a + v, 0);
        expect(lnRef, `${tag}: lineamentNodeCount`).toBe(lnBase);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-TUNE-RESPONSE — the MULTIPLY core: NON-STRICT monotone correct-sign per axis, measurable above floor,
// exact collapse at each REF. NON-STRICT (v[i] >= v[i-1], no downward inversion) per the lens fold MF#1/MF#2:
// CREST_THRESH saturates on a clamp plateau and integer round(CELL_MIN) plateaus, so a STRICT adjacent-pair
// read would falsely fail — the contract's phrasing is "no sign inversion inside the domain".
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC-TUNE-RESPONSE — monotone correct-sign per axis (non-strict, measurable, REF-collapse)', () => {
  it('A1 gravity: std(U) NON-DECREASING as g↓ every seed + ratio(min-g/max-g) > 3 (multiplicative headline axis)', () => {
    const gSweep = [1.75, 0.70, 0.28, 0.14, 0.0448];   // g DOWN across the gFactor clamp [0.4,2.5]
    for (const s of SEEDS) {
      const vals = gSweep.map((g) => obsOf(s, 'icy-active', { massGravity: g }).stdU);
      for (let i = 1; i < vals.length; i++) expect(vals[i], `seed ${s}: std(U) non-decreasing as g↓ (${vals.map((x) => x.toFixed(4))})`).toBeGreaterThanOrEqual(vals[i - 1] - 1e-9);
      const lo = obsOf(s, 'icy-active', { massGravity: 0.0448 }).stdU, hi = obsOf(s, 'icy-active', { massGravity: 1.75 }).stdU;
      expect(lo / hi, `seed ${s}: low-g/high-g std(U) ratio=${(lo / hi).toFixed(2)} > 3`).toBeGreaterThan(3);
    }
  });

  it('A2 tidal (icy + Titan): lineamentNodeCount NON-DECREASING as tidal↑, endpoint Δ > linN-floor, every seed', () => {
    const fIcy = floors('icy-active'), fVc = floors('volatile-cold');
    const REFt = SHELL_REFS['icy-active'].tidalHeating;
    // icy: full clamp span; Titan: INTERIOR sweep (MF#1 — the REF..1.0 range sits on the CREST_LO plateau → equal linN).
    const cases = [
      { regime: 'icy-active', floor: fIcy.linN, ths: [REFt / 100, REFt, REFt * 100, REFt * 10000] },
      { regime: 'volatile-cold', floor: fVc.linN, ths: [SHELL_REFS['volatile-cold'].tidalHeating, 1e-6, 1e-4, 1e-2] },
    ];
    for (const { regime, floor, ths } of cases) {
      for (const s of SEEDS) {
        const vals = ths.map((th) => obsOf(s, regime, { tidalHeating: th }).linN);
        for (let i = 1; i < vals.length; i++) expect(vals[i], `${regime} seed ${s}: linN non-decreasing in tidal (${vals})`).toBeGreaterThanOrEqual(vals[i - 1]);
        expect(Math.abs(vals[vals.length - 1] - vals[0]), `${regime} seed ${s}: linN endpoint Δ=${Math.abs(vals[vals.length - 1] - vals[0])} > floor ${floor}`).toBeGreaterThan(floor);
      }
    }
  });

  it('A3 vigor (icy + Titan): cellCount NON-DECREASING as T_eq↑ (in-domain), endpoint Δ > cellCount-floor, every seed', () => {
    const fIcy = floors('icy-active'), fVc = floors('volatile-cold');
    // driven by T_eq (MF#2 — an in-domain vf≤1.0 sweep clears only Δ=floor exactly; T_eq clears > floor every seed).
    const cases = [
      { regime: 'icy-active', floor: fIcy.cellCount, teqs: [110, 170, 210, 250] },
      { regime: 'volatile-cold', floor: fVc.cellCount, teqs: [94, 160, 230] },
    ];
    for (const { regime, floor, teqs } of cases) {
      for (const s of SEEDS) {
        const vals = teqs.map((T) => obsOf(s, regime, { condition: { T_eq: T } }).cellCount);
        for (let i = 1; i < vals.length; i++) expect(vals[i], `${regime} seed ${s}: cellCount non-decreasing in T_eq (${vals})`).toBeGreaterThanOrEqual(vals[i - 1]);
        expect(Math.abs(vals[vals.length - 1] - vals[0]), `${regime} seed ${s}: cellCount endpoint Δ=${Math.abs(vals[vals.length - 1] - vals[0])} > floor ${floor}`).toBeGreaterThan(floor);
      }
    }
  });

  it('A4 warmth (icy): CHAOS_THRESH knob strictly ↓ in T_eq + chaos-area NON-DECREASING (in-domain) + measurable in AGGREGATE', () => {
    // (1) the CHAOS_THRESH knob strictly decreasing on the UNSATURATED interior (T_eq < ~246 where the clamp floor
    //     0.30 is reached) — a pure function of T_eq, so "every seed" is trivial; read from the returned tune.
    const knobTeqs = [130, 160, 190, 220];
    const knob = knobTeqs.map((T) => shellDriversToTune({ condition: { T_eq: T } }, 'icy-active').CHAOS_THRESH);
    for (let i = 1; i < knob.length; i++) expect(knob[i], `CHAOS_THRESH strictly ↓ (${knob.map((x) => x.toFixed(4))})`).toBeLessThan(knob[i - 1]);
    // (2) chaos-area NON-DECREASING / no-inversion, every seed, INSIDE the unsaturated CHAOS_THRESH domain [110,230]
    //     (beyond it the knob saturates + the convection planform shifts → the seed-fragile top per variety-probe).
    const areaTeqs = [110, 170, 230];
    for (const s of SEEDS) {
      const vals = areaTeqs.map((T) => obsOf(s, 'icy-active', { condition: { T_eq: T } }).chaosFrac);
      for (let i = 1; i < vals.length; i++) expect(vals[i], `seed ${s}: chaosFrac non-decreasing in T_eq (${vals.map((x) => x.toFixed(4))})`).toBeGreaterThanOrEqual(vals[i - 1] - 1e-9);
    }
    // (3) measurable in AGGREGATE (seed 42's stress field is chaos-resistant, so the mean over seeds is the honest
    //     measurability gate, per calibration/variety-probe.mjs): mean chaosFrac @T_eq=290 − @REF > chaosFrac-floor.
    const fIcy = floors('icy-active');
    const mRef = mean(SEEDS.map((s) => obsOf(s, 'icy-active', null).chaosFrac));
    const mWarm = mean(SEEDS.map((s) => obsOf(s, 'icy-active', { condition: { T_eq: 290 } }).chaosFrac));
    expect(mWarm - mRef, `aggregate warm-REF chaos Δ=${(mWarm - mRef).toFixed(4)} > floor ${fIcy.chaosFrac.toFixed(4)}`).toBeGreaterThan(fIcy.chaosFrac);
  });

  it('REF-collapse: at each regime REF the tuned field === the shipped preset field exactly (no response)', () => {
    for (const r of REGIMES) {
      expect(shellDriversToTune(SHELL_REFS[r], r), `${r}: REF tune null`).toBeNull();
      for (const s of SEEDS) {
        const cBase = carrierOf(); writeShellReliefSphere(cBase, {}, { macroSeed: s, regime: r });
        const cRef = carrierOf(); writeShellReliefSphere(cRef, SHELL_REFS[r], { macroSeed: s, regime: r, tune: shellDriversToTune(SHELL_REFS[r], r) });
        expect(Array.from(cRef.height), `${r} seed ${s}: REF-collapse height`).toEqual(Array.from(cBase.height));
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-VARIETY — the D2-MF5 objective proxy (AMENDED 2026-07-13, lens minor #e): PER-OBSERVABLE clearance for
// the observables each regime's LOW↔HIGH corner pair actually moves; non-clearing observables are DOCUMENTED
// exclusions (never folded in); the composite floor-normalized distance is a REPORTED summary, not the gate.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC-VARIETY — driver-varied worlds differ per-observable MORE than the 5-seed noise floor', () => {
  const LOW = { massGravity: 1.75, volatileFraction: 0.05, tidalHeating: 1e-3, condition: { T_eq: 60 } };   // subdued corner
  const HIGH = { massGravity: 0.0448, volatileFraction: 1.0, tidalHeating: 1e6, condition: { T_eq: 330 } };  // busy corner (vf capped ≤1.0)
  // the observables each regime's corner pair CLEARS (min normΔ > 1, every seed) — per the amended contract AC.
  const CLAIMED = { 'icy-active': ['linFrac', 'stdU', 'cellCount'], 'volatile-cold': ['stdU', 'chaosFrac', 'cellCount'] };
  // documented NOT-CLAIMED exclusions (seed-fragile / tidal-saturated at these corners — never silently folded in).
  const EXCLUDED = { 'icy-active': ['chaosFrac'], 'volatile-cold': ['linFrac'] };

  it('for every CLAIMED observable: LOW↔HIGH Δ > that observable\'s own 5-seed floor at EVERY seed; exclusions do NOT clear', () => {
    for (const r of ['icy-active', 'volatile-cold']) {
      const f = floors(r);
      for (const k of CLAIMED[r]) {
        let minNorm = Infinity;
        for (const s of SEEDS) minNorm = Math.min(minNorm, Math.abs(obsOf(s, r, HIGH)[k] - obsOf(s, r, LOW)[k]) / f[k]);
        expect(minNorm, `${r}.${k}: min normΔ=${minNorm.toFixed(3)} > 1 (clears every seed)`).toBeGreaterThan(1);
      }
      // the documented exclusions genuinely do NOT clear (they are honestly not-claimed, not silently dropped).
      for (const k of EXCLUDED[r]) {
        let minNorm = Infinity;
        for (const s of SEEDS) minNorm = Math.min(minNorm, Math.abs(obsOf(s, r, HIGH)[k] - obsOf(s, r, LOW)[k]) / f[k]);
        expect(minNorm, `${r}.${k}: documented exclusion, min normΔ=${minNorm.toFixed(3)} <= 1`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the seed-only baseline stays WITHIN the floor: max pairwise normΔ across the 5 REF-driver rerolls <= 1 (by construction)', () => {
    for (const r of ['icy-active', 'volatile-cold']) {
      const f = floors(r);
      for (const k of ['linFrac', 'stdU', 'chaosFrac', 'cellCount']) {
        let maxNorm = 0;
        for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++)
          maxNorm = Math.max(maxNorm, Math.abs(obsOf(SEEDS[i], r, null)[k] - obsOf(SEEDS[j], r, null)[k]) / f[k]);
        expect(maxNorm, `${r}.${k}: seed-only max normΔ=${maxNorm.toFixed(4)} <= 1`).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('the composite floor-normalized distance (REPORTED summary, NOT the gate): min driver-corner dist > max seed-only dist', () => {
    // kept as a documented summary metric (the V2-2b-1 discipline) — not a pass criterion, per the amended AC.
    for (const r of ['icy-active', 'volatile-cold']) {
      const f = floors(r), KEYS = ['linFrac', 'stdU', 'chaosFrac', 'cellCount'];
      const dist = (a, b) => { let s = 0; for (const k of KEYS) s += ((a[k] - b[k]) / f[k]) ** 2; return Math.sqrt(s); };
      let minDriver = Infinity, maxSeed = 0;
      for (const s of SEEDS) minDriver = Math.min(minDriver, dist(obsOf(s, r, LOW), obsOf(s, r, HIGH)));
      for (let i = 0; i < SEEDS.length; i++) for (let j = i + 1; j < SEEDS.length; j++) maxSeed = Math.max(maxSeed, dist(obsOf(SEEDS[i], r, null), obsOf(SEEDS[j], r, null)));
      expect(minDriver, `${r}: composite driver-dist=${minDriver.toFixed(2)} > seed-only=${maxSeed.toFixed(2)}`).toBeGreaterThan(maxSeed);
    }
  });

  it('the headline low-g/high-g std(U) ratio > 3 per seed (icy-active — the multiplicative variety axis)', () => {
    for (const s of SEEDS) {
      const lo = obsOf(s, 'icy-active', { massGravity: 0.0448 }).stdU, hi = obsOf(s, 'icy-active', { massGravity: 1.75 }).stdU;
      expect(lo / hi, `seed ${s}: ratio=${(lo / hi).toFixed(2)} > 3`).toBeGreaterThan(3);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// AC-ORDER — anti-mush, structural, across EVERY sweep point: the falsifier stays green under tune (stress
// beats latitude), lineaments stay relief-carrying, the tune touches ONLY the 7 SAFE knobs, and the stress
// machinery (grainAngle/faultDensity) is byte-stable. The predictor is arm's-length (tuned CREST, never U).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('V2-5s AC-ORDER — falsifier + key-set + blast-radius across the tune sweep, every seed', () => {
  // the order-probe sweep: gravity/tidal/thermal/combo excursions (incl. an OUT-OF-domain-adversarial 'wet'
  // point capped at vf=1.0 — the falsifier must survive even the busy corner). REF (tune null) uses default CREST.
  const SWEEP = {
    'icy-active': [
      { l: 'REF', d: null }, { l: 'low-g', d: { massGravity: 0.07 } }, { l: 'high-g', d: { massGravity: 0.70 } },
      { l: 'hi-tidal', d: { tidalHeating: SHELL_REFS['icy-active'].tidalHeating * 10000 } }, { l: 'lo-tidal', d: { tidalHeating: 1.0 } },
      { l: 'warm', d: { condition: { T_eq: 290 } } }, { l: 'wet', d: { volatileFraction: 1.0 } },
      { l: 'combo', d: { massGravity: 0.07, volatileFraction: 0.9, tidalHeating: 5000, condition: { T_eq: 250 } } },
    ],
    'volatile-cold': [
      { l: 'REF', d: null }, { l: 'low-g', d: { massGravity: 0.05 } }, { l: 'hi-tidal', d: { tidalHeating: 100 } }, { l: 'warm', d: { condition: { T_eq: 230 } } },
    ],
    'eyeball-despun': [
      { l: 'REF', d: null }, { l: 'low-g', d: { massGravity: 0.3 } }, { l: 'hi-tidal', d: { tidalHeating: 10 } },
    ],
  };

  it('(i) varExplainedByStress > varExplainedByLatitudeY AND > varExplainedByLatitudeW0, AND (ii) lineamentInteriorRatio > 1 — every point × seed', () => {
    for (const regime of REGIMES) {
      for (const { l, d } of SWEEP[regime]) {
        for (const s of SEEDS) {
          const { c, diag, tune } = build(s, regime, d);
          const { latY, latW } = latFields(c, diag.w0);
          const vePred = varExplained(stressPredictor(c, diag, s, tune), diag.U);
          const veLatY = varExplained(latY, diag.U), veLatW = varExplained(latW, diag.U);
          const tag = `${regime}/${l}/seed${s}`;
          expect(vePred, `${tag}: stress(${vePred.toFixed(3)}) > latY(${veLatY.toFixed(3)})`).toBeGreaterThan(veLatY);
          expect(vePred, `${tag}: stress(${vePred.toFixed(3)}) > latW0(${veLatW.toFixed(3)})`).toBeGreaterThan(veLatW);
          expect(lineamentInteriorRatio(diag), `${tag}: lineamentInteriorRatio > 1`).toBeGreaterThan(1);
        }
      }
    }
  });

  it('(iii) KEY-SET: every non-null tune ⊆ the 7 SAFE knobs — never a STRESS_REF/cross-section/structural key', () => {
    for (const regime of REGIMES) {
      for (const { l, d } of SWEEP[regime]) {
        const t = shellDriversToTune(d, regime);
        if (t === null) continue;                                     // REF point collapses to null (correct)
        for (const k of Object.keys(t)) expect(ALLOWED_KEYS.has(k), `${regime}/${l}: ${k} ∈ SAFE knobs`).toBe(true);
        for (const forbidden of FORBIDDEN_KEYS) expect(forbidden in t, `${regime}/${l}: NEVER returns ${forbidden}`).toBe(false);
      }
    }
  });

  it('(iv) BLAST-RADIUS: carrier.grainAngle + faultDensity byte-identical under the strongest tune vs REF (the tune touches no stress machinery)', () => {
    for (const regime of REGIMES) {
      const refB = build(7, regime, null);
      for (const { l, d } of SWEEP[regime]) {
        const dv = build(7, regime, d);
        expect(Array.from(dv.c.grainAngle), `${regime}/${l}: grainAngle byte-stable`).toEqual(Array.from(refB.c.grainAngle));
        expect(Array.from(dv.c.faultDensity), `${regime}/${l}: faultDensity byte-stable`).toEqual(Array.from(refB.c.faultDensity));
      }
    }
  });
});

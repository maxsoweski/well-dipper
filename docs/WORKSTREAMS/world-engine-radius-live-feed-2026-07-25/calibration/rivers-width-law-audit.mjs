// calibration/rivers-width-law-audit.mjs — AC-RIVERS (law-audit half): what IS the river width law,
// and in which FRAME is it stated?  RUNNABLE PROOF, with a planted-defect positive control.
//
// WHY THIS EXISTS
// The RADIUS-CENSUS could only mark rivers SOURCE-TRACED: it read `widthRadiusFactor` off the source
// and said the law "appears to" respond to radius. AC-RIVERS says that stops being a claim. This
// script establishes the composed law by EXECUTION (not by reading), states where it stops being a
// power law, and proves the instrument by breaking the law six ways and showing each break is caught.
//
// WHAT IT AUDITS (three radius-bearing seams, all fed by the ONE kernel):
//   K   planet-lod-rivers.js:264  widthRadiusFactor(radiusEarth, params)   — the kernel k(R)
//   P   planet-lod-rivers.js:287  paramsForRadius(params, R, widthSeedMul) — scales WIDTH_SCALE/MIN/MAX by k
//   W1  planet-lod-rivers.js:828  widthAt        (water ribbon)        ─┐ the three consumers of the
//   W2  planet-lod-rivers.js:945  halfWidthAt    (valley carve)         ├ scaled params — extracted
//   W3  planet-lod-tributary-patch.js:157 widthLaw (Fork B fine ribbon)─┘ from source and EXECUTED
//
// NO-TASTE-CONSTANTS POSTURE: every constant below (REF_RADIUS_EARTH, WIDTH_RADIUS_FLOOR/CEIL,
// WIDTH_SCALE/MIN/MAX/PHI/EXP, WIDTH_SEED_LO/HI, the slider endpoints) is IMPORTED from the shipped
// modules. Nothing physical is typed here. The three width expressions are not transcribed either —
// they are read out of the live source files at runtime and executed, so an edit to any of them
// either changes this audit's numbers or trips the extraction guard. It ships NO code and edits
// nothing: it is its own proof.
//
// Pure node ESM, runnable from any cwd, no network, no RNG, no wall-clock — every number reproduces
// exactly on re-run.  Exit 0 iff the real law passes every check AND every planted defect is caught
// by the check predicted for it.
//
//   node docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/calibration/rivers-width-law-audit.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';

import { widthRadiusFactor, paramsForRadius, DEFAULT_PARAMS } from '../../../../planet-lod-rivers.js';
import { RADIUS_SLIDER_MIN, RADIUS_SLIDER_MAX, radiusFromT } from '../../../../src/worldengine/base/labCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..', '..');

// ─────────────────────────── imported constants → derived breakpoints ───────────────────────────
const REF   = DEFAULT_PARAMS.REF_RADIUS_EARTH;
const FLOOR = DEFAULT_PARAMS.WIDTH_RADIUS_FLOOR;
const CEIL  = DEFAULT_PARAMS.WIDTH_RADIUS_CEIL;
const SEED_LO = DEFAULT_PARAMS.WIDTH_SEED_LO, SEED_HI = DEFAULT_PARAMS.WIDTH_SEED_HI;
// The clamp bites where ref/R crosses a bound, i.e. at R = REF/CEIL (small worlds) and R = REF/FLOOR
// (large worlds). DERIVED, never typed.
const R_CEIL_BREAK  = REF / CEIL;    // below this the law is a constant plateau (exponent 0)
const R_FLOOR_BREAK = REF / FLOOR;   // above this, likewise

// ────────────────────────────────── assertion plumbing ──────────────────────────────────────────
// Every check carries an id, a numeric threshold, and the REASON that threshold is the right one.
// A check with no stated reason is not a measurement, it is an opinion.
const THRESHOLDS = {
  'K-INTERIOR-IDENTITY': { eps: 1e-12, why:
    'k is one IEEE double division, so k·R/REF differs from 1 by ≲2 ulp ≈ 4.4e-16. 1e-12 leaves ~3 ' +
    'orders of round-off headroom and is still ~1e9× tighter than the smallest exponent change worth ' +
    'catching (−1 → −0.999 gives |k·R−1| ≈ 2.5e-3 at R=12).' },
  'K-SLOPE': { eps: 1e-9, why:
    'slope = ln(k₂/k₁)/ln(R₂/R₁) over adjacent log-spaced samples with ln-ratio ≥ 0.08; double log ' +
    'round-off bounds the error at ~1e-14. 1e-9 sits 5 orders above the achievable noise and 6 orders ' +
    'below the smallest semantically meaningful exponent change (1e-3).' },
  'K-CEIL-PLATEAU': { eps: 0, why:
    'BIT equality (Object.is), not a tolerance: Math.min returns the CEIL operand itself, so a plateau ' +
    'value that is merely close means the clamp was replaced by something else (a soft-min, a lerp). ' +
    'A tolerance here would hide exactly the defect the check exists for.' },
  'K-FLOOR-PLATEAU': { eps: 0, why: 'Same as K-CEIL-PLATEAU, on the Math.max side.' },
  'K-BREAK-CONTINUITY': { eps: 3e-9, why:
    'measured as |k(R_b(1−δ)) − k(R_b(1+δ))| / plateau with δ=1e-9. A continuous law of |dlnk/dlnR| ≤ 1 ' +
    'can differ by at most ~2δ across that pair; 3δ adds round-off headroom. A genuinely discontinuous ' +
    'clamp jumps by a fraction of the clamp gap (≥1e-2 here), i.e. ~7 orders over threshold.' },
  'K-MONOTONE': { eps: 0, why:
    'exact non-increase over 2001 samples of the REAL slider parameterisation radiusFromT(t). Equality ' +
    'is allowed (the plateaus are flat); any increase at all means a bigger world grew its rivers, ' +
    'which contradicts the law\'s stated intent, so the tolerance is zero by construction.' },
  'K-CHORD': { eps: 1e-12, why:
    'the whole-slider chord ln(k(Rmax)/k(Rmin))/ln(Rmax/Rmin) must equal ln(FLOOR/CEIL)/ln(Rmax/Rmin) ' +
    'computed from the IMPORTED clamp constants — a non-circular cross-check that BOTH plateaus are ' +
    'actually reached inside the slider domain. Pure double arithmetic ⇒ 1e-12 is round-off headroom.' },
  'W-COVARIANCE': { eps: 1e-12, why:
    'the crux. clamp(k·S·φ, k·MIN, k·MAX) = k·clamp(S·φ, MIN, MAX) is an EXACT algebraic identity, so ' +
    'the only admissible deviation is the ≤3 double ops of re-association (~5e-16). 1e-12 gives ~3 ' +
    'orders of margin while being ~1e10× tighter than the failure it guards: a law that scales ' +
    'WIDTH_SCALE but not WIDTH_MIN/MAX delivers exponent 0 on saturated trunks (deviation ~0.9 at R=8).' },
  'W-SEED-SEPARABLE': { eps: 1e-12, why:
    'the radius exponent measured at three seed draws (LO / 1 / HI) must agree. The field-measurement ' +
    'half runs at ONE fixed seed; if the seed draw contaminated the radius exponent that number would ' +
    'be seed-specific and the census row would be wrong. Same round-off budget as W-COVARIANCE.' },
  'P-IDENTITY': { eps: 0, why:
    'OBJECT identity (===) at R = REF with no seed draw. AC-BYTE\'s golden byte-identity depends on the ' +
    'same params object flowing through untouched, not on an approximately-equal copy, so the only ' +
    'correct criterion is reference equality.' },
  'P-DEGENERATE': { eps: 0, why:
    'exact equality on the divide-by-zero / null guards. If any of these returned NaN or Infinity, ' +
    'WIDTH_SCALE would become NaN and EVERY river would silently vanish — a catastrophic-but-quiet ' +
    'failure, so the criterion is exactness, not tolerance.' },
  'H-SHADOW-FIDELITY': { eps: 0, why:
    'BIT equality between the real paramsForRadius and the harness re-implementation the planted ' +
    'defects are injected into. If the shadow differed at all, the defect runs would be perturbing a ' +
    'law that is not the shipped one, and the positive control would prove nothing.' },
  'X-PATCH-GRIDRES-BREAK': { eps: 'BRACKET', why:
    'SECONDARY / dormant path. The extracted deriveTributaryGridRes takes a Math.ceil, so its saturation ' +
    'radius is not a single number but a BRACKET: ceil(x) ≥ 560 ⟺ x > 559, so the first saturating R lies ' +
    'in [R(559), R(560)] where R(c) = c·s_feat/(2·sin(α)·6371). Asserting a point value here would be ' +
    'wrong by up to one cell — the bracket IS the honest criterion, and it is still ~0.2% wide, i.e. tight ' +
    'enough that any change to α, s_feat or the 560 cap moves the measured breakpoint out of it.' },
};

// ────────────────────────────── source extraction (execute the shipped bytes) ────────────────────
// The three width expressions are NOT transcribed. They are cut out of the live source and executed,
// so this audit cannot drift away from the code it audits without the guard tripping.
const RIVERS_SRC = readFileSync(join(REPO, 'planet-lod-rivers.js'), 'utf8');
const PATCH_SRC  = readFileSync(join(REPO, 'planet-lod-tributary-patch.js'), 'utf8');
const LAB_SRC    = readFileSync(join(REPO, 'world-engine-lab.html'), 'utf8');

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

function extract(src, re, label, mustContain) {
  const m = re.exec(src);
  if (!m) throw new Error(`EXTRACTION FAILED for ${label} — the source shape changed; this audit is stale.`);
  const text = m[1];
  for (const tok of mustContain) {
    if (!text.includes(tok)) throw new Error(`EXTRACTION GUARD failed for ${label}: missing ${tok}`);
  }
  if (text.length > 400) throw new Error(`EXTRACTION GUARD failed for ${label}: captured ${text.length} chars (too much)`);
  return { text, line: lineOf(src, m.index) };
}

const WIDTH_TOKENS = ['WIDTH_SCALE', 'WIDTH_MIN', 'WIDTH_MAX', 'Math.pow'];
const exWidthAt     = extract(RIVERS_SRC, /const widthAt = \(i\) => \{([\s\S]*?)\n  \};/,        'planet-lod-rivers.js widthAt',     WIDTH_TOKENS);
const exHalfWidthAt = extract(RIVERS_SRC, /const halfWidthAt = \(i\) => \{([\s\S]*?)\n  \};/,    'planet-lod-rivers.js halfWidthAt', WIDTH_TOKENS.concat(['VALLEY_WIDTH_MUL']));
const exWidthLaw    = extract(PATCH_SRC,  /const widthLaw = \(accum\) => ([\s\S]*?);\n/,          'planet-lod-tributary-patch.js widthLaw', WIDTH_TOKENS);

// indexed form: body uses accum[i] → call with a 1-element array
const mkIndexed = (body) => {
  const f = new Function('params', 'THREE', 'accum', 'i', `
    const { WIDTH_PHI, WIDTH_EXP, WIDTH_SCALE, WIDTH_MIN, WIDTH_MAX, VALLEY_WIDTH_MUL } = params;
    ${body}
  `);
  return (params, a) => f(params, THREE, [a], 0);
};
// expression form: RHS references the arrow parameter name `accum`
const mkExpr = (expr) => {
  const f = new Function('params', 'THREE', 'accum', `
    const { WIDTH_PHI, WIDTH_EXP, WIDTH_SCALE, WIDTH_MIN, WIDTH_MAX } = params;
    return (${expr});
  `);
  return (params, a) => f(params, THREE, a);
};

const CONSUMERS = [
  { id: 'W1 widthAt      (water ribbon,  planet-lod-rivers.js:'          + exWidthAt.line     + ')', fn: mkIndexed(exWidthAt.text) },
  { id: 'W2 halfWidthAt  (valley carve,  planet-lod-rivers.js:'          + exHalfWidthAt.line + ')', fn: mkIndexed(exHalfWidthAt.text) },
  { id: 'W3 widthLaw     (fine ribbon, tributary-patch.js:'              + exWidthLaw.line    + ')', fn: mkExpr(exWidthLaw.text) },
];

// ──────────────────────────────────── sampling grids ────────────────────────────────────────────
const logspace = (lo, hi, n) => Array.from({ length: n }, (_, i) => lo * Math.pow(hi / lo, i / (n - 1)));

// interior = strictly between the two clamp breakpoints (the only region that can BE a power law)
const R_INTERIOR = logspace(R_CEIL_BREAK * 1.001, R_FLOOR_BREAK * 0.999, 41);
const R_CEILPLAT = logspace(RADIUS_SLIDER_MIN, R_CEIL_BREAK * 0.999, 15);
const R_FLOORPLAT = logspace(R_FLOOR_BREAK * 1.001, RADIUS_SLIDER_MAX, 15);
const R_ALL = [...R_CEILPLAT, ...R_INTERIOR, ...R_FLOORPLAT];

// accum grid: chosen to straddle BOTH clamp regimes of the width expression itself, since the clamp
// is the thing under audit. The two boundary values are solved from the imported params, not guessed:
//   raw(a) = WIDTH_SCALE·WIDTH_PHI·a^WIDTH_EXP ;  a* = (bound/(WIDTH_SCALE·WIDTH_PHI))^(1/WIDTH_EXP)
const aStar = (bound) => Math.pow(bound / (DEFAULT_PARAMS.WIDTH_SCALE * DEFAULT_PARAMS.WIDTH_PHI), 1 / DEFAULT_PARAMS.WIDTH_EXP);
const A_MIN_BOUNDARY = aStar(DEFAULT_PARAMS.WIDTH_MIN);
const A_MAX_BOUNDARY = aStar(DEFAULT_PARAMS.WIDTH_MAX);
const ACCUM = [1, 3, A_MIN_BOUNDARY, 10, 30, 100, 300, A_MAX_BOUNDARY, 1000, 3000, 10000, 40000];

// ─────────────────────────────────────── numerics ───────────────────────────────────────────────
const relDiff = (a, b) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
const slope = (r1, k1, r2, k2) => Math.log(k2 / k1) / Math.log(r2 / r1);

// ─────────────────────── the law under test: real, shadow, and the six defects ──────────────────
// The harness re-implementation of paramsForRadius. Defects are injected HERE (dependency injection)
// so planet-lod-rivers.js is never touched. H-SHADOW-FIDELITY proves this is the shipped arithmetic.
function shadowParamsForRadius(kernel, opts = {}) {
  return (params, radiusEarth, widthSeedMul = 1) => {
    let kR = (radiusEarth == null) ? 1 : kernel(radiusEarth, params);
    const kS = widthSeedMul ?? 1;
    if (opts.seedContaminatesRadius && radiusEarth != null) {
      // DEFECT: the radius exponent itself bends with the per-planet seed draw.
      kR = Math.pow(kR, 1 + 0.1 * (kS - 1));
    }
    const k = kR * kS;
    if (Math.abs(k - 1) < 1e-9) return params;
    if (opts.scaleOnly) {
      // DEFECT: WIDTH_SCALE scaled, the clamp bounds left at reference — saturated trunks stop
      // answering radius entirely.
      return { ...params, WIDTH_SCALE: params.WIDTH_SCALE * k,
        _widthRadiusFactor: kR, _widthSeedMul: kS, _widthFactor: k };
    }
    return { ...params,
      WIDTH_SCALE: params.WIDTH_SCALE * k, WIDTH_MIN: params.WIDTH_MIN * k, WIDTH_MAX: params.WIDTH_MAX * k,
      _widthRadiusFactor: kR, _widthSeedMul: kS, _widthFactor: k };
  };
}
const mkKernel = ({ exp = 1, clamped = true, guards = true }) => (radiusEarth, params = DEFAULT_PARAMS) => {
  const ref = params.REF_RADIUS_EARTH ?? 1.0;
  const R = guards ? Math.max(radiusEarth || ref, 1e-6) : radiusEarth;
  const f = Math.pow(ref / R, exp);
  if (!clamped) return f;
  return Math.min(params.WIDTH_RADIUS_CEIL ?? 2.5, Math.max(params.WIDTH_RADIUS_FLOOR ?? 0.2, f));
};

// ───────────────────────────────────────── the audit ────────────────────────────────────────────
function runAudit(label, kernel, paramsFor, { verbose = false } = {}) {
  const failed = new Set();
  const notes = [];
  const metrics = {};   // reported for every run (pass or fail) so the evidence doc can cite them
  const fail = (id, detail) => { failed.add(id); notes.push(`      ✗ ${id}: ${detail}`); };
  const t = (id) => THRESHOLDS[id].eps;

  // ── K-INTERIOR-IDENTITY: is the unclamped branch exactly ref/R ?
  {
    let worst = 0, at = null;
    for (const R of R_INTERIOR) {
      const d = Math.abs(kernel(R, DEFAULT_PARAMS) * R / REF - 1);
      if (d > worst) { worst = d; at = R; }
    }
    if (!(worst <= t('K-INTERIOR-IDENTITY'))) fail('K-INTERIOR-IDENTITY', `max |k·R/REF − 1| = ${worst.toExponential(3)} at R=${at.toFixed(4)}`);
    else if (verbose) notes.push(`      ✓ K-INTERIOR-IDENTITY  max |k·R/REF − 1| = ${worst.toExponential(3)}`);
  }

  // ── K-SLOPE: local log–log exponent on the unclamped branch
  {
    let worst = 0, at = null, sAt = 0;
    for (let i = 0; i + 1 < R_INTERIOR.length; i++) {
      const R1 = R_INTERIOR[i], R2 = R_INTERIOR[i + 1];
      const s = slope(R1, kernel(R1, DEFAULT_PARAMS), R2, kernel(R2, DEFAULT_PARAMS));
      const d = Math.abs(s - (-1));
      if (d > worst) { worst = d; at = R1; sAt = s; }
      if (i === Math.floor(R_INTERIOR.length / 2)) metrics.midSlope = s;
    }
    if (!(worst <= t('K-SLOPE'))) fail('K-SLOPE', `max |slope − (−1)| = ${worst.toExponential(3)} (slope ${sAt.toFixed(6)} near R=${at.toFixed(4)})`);
    else if (verbose) notes.push(`      ✓ K-SLOPE              max |slope − (−1)| = ${worst.toExponential(3)}`);
  }

  // ── K-CEIL-PLATEAU / K-FLOOR-PLATEAU: bit-exact plateaus
  for (const [id, grid, want] of [['K-CEIL-PLATEAU', R_CEILPLAT, CEIL], ['K-FLOOR-PLATEAU', R_FLOORPLAT, FLOOR]]) {
    let bad = null;
    for (const R of grid) { const k = kernel(R, DEFAULT_PARAMS); if (!Object.is(k, want)) { bad = [R, k]; break; } }
    if (bad) fail(id, `k(${bad[0].toFixed(4)}) = ${bad[1]} ≠ ${want} (bit)`);
    else if (verbose) notes.push(`      ✓ ${id}${' '.repeat(id.length < 15 ? 15 - id.length : 1)}k ≡ ${want} across ${grid.length} samples`);
  }

  // ── K-BREAK-CONTINUITY: no visible jump in river width as the slider crosses a breakpoint
  {
    const d = 1e-9;
    let worst = 0, at = null;
    for (const [Rb, plateau] of [[R_CEIL_BREAK, CEIL], [R_FLOOR_BREAK, FLOOR]]) {
      const jump = Math.abs(kernel(Rb * (1 - d), DEFAULT_PARAMS) - kernel(Rb * (1 + d), DEFAULT_PARAMS)) / plateau;
      if (jump > worst) { worst = jump; at = Rb; }
    }
    if (!(worst <= t('K-BREAK-CONTINUITY'))) fail('K-BREAK-CONTINUITY', `max relative jump = ${worst.toExponential(3)} at R=${at}`);
    else if (verbose) notes.push(`      ✓ K-BREAK-CONTINUITY   max relative jump across breakpoints = ${worst.toExponential(3)}`);
  }

  // ── K-MONOTONE: over the REAL slider travel
  {
    let bad = null, prev = Infinity, prevR = 0;
    for (let i = 0; i <= 2000; i++) {
      const R = radiusFromT(i / 2000), k = kernel(R, DEFAULT_PARAMS);
      if (k > prev) { bad = [prevR, prev, R, k]; break; }
      prev = k; prevR = R;
    }
    if (bad) fail('K-MONOTONE', `k rose: k(${bad[0].toFixed(4)})=${bad[1]} → k(${bad[2].toFixed(4)})=${bad[3]}`);
    else if (verbose) notes.push('      ✓ K-MONOTONE           non-increasing over 2001 slider samples');
  }

  // ── K-CHORD: both plateaus actually reached inside the slider domain
  {
    const chord = slope(RADIUS_SLIDER_MIN, kernel(RADIUS_SLIDER_MIN, DEFAULT_PARAMS), RADIUS_SLIDER_MAX, kernel(RADIUS_SLIDER_MAX, DEFAULT_PARAMS));
    metrics.chord = chord;
    const want = Math.log(FLOOR / CEIL) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN);
    const d = relDiff(chord, want);
    if (!(d <= t('K-CHORD'))) fail('K-CHORD', `whole-slider chord = ${chord.toFixed(6)}, clamp-derived prediction = ${want.toFixed(6)} (rel ${d.toExponential(3)})`);
    else if (verbose) notes.push(`      ✓ K-CHORD              whole-slider chord = ${chord.toFixed(6)} = ln(FLOOR/CEIL)/ln(Rmax/Rmin)`);
  }

  // ── W-COVARIANCE: the composed law through the three REAL width expressions
  {
    let worst = 0, at = null;
    for (const c of CONSUMERS) {
      const pRef = paramsFor(DEFAULT_PARAMS, REF, 1);
      for (const R of R_ALL) {
        const k = kernel(R, DEFAULT_PARAMS);
        const p = paramsFor(DEFAULT_PARAMS, R, 1);
        for (const a of ACCUM) {
          const got = c.fn(p, a), want = k * c.fn(pRef, a);
          const d = relDiff(got, want);
          if (d > worst) { worst = d; at = `${c.id} R=${R.toFixed(4)} accum=${a.toFixed(2)} got ${got.toExponential(6)} want ${want.toExponential(6)}`; }
        }
      }
    }
    if (!(worst <= t('W-COVARIANCE'))) fail('W-COVARIANCE', `max rel dev = ${worst.toExponential(3)} — ${at}`);
    else if (verbose) notes.push(`      ✓ W-COVARIANCE         max rel |w(R,a) − k(R)·w(REF,a)| = ${worst.toExponential(3)} over ${CONSUMERS.length}×${R_ALL.length}×${ACCUM.length} cells`);
  }

  // ── W-SEED-SEPARABLE: does the per-planet seed draw bend the RADIUS exponent?
  {
    const R1 = 1.0, R2 = 8.0;            // both strictly interior for the real law
    const a = 100;                        // an unsaturated accum (checked by W-COVARIANCE anyway)
    const exps = [SEED_LO, 1, SEED_HI].map((kS) => {
      const w1 = CONSUMERS[0].fn(paramsFor(DEFAULT_PARAMS, R1, kS), a);
      const w2 = CONSUMERS[0].fn(paramsFor(DEFAULT_PARAMS, R2, kS), a);
      return slope(R1, w1, R2, w2);
    });
    const spread = Math.max(...exps) - Math.min(...exps);
    if (!(spread <= t('W-SEED-SEPARABLE'))) fail('W-SEED-SEPARABLE', `exponent at seedMul ${SEED_LO}/1/${SEED_HI} = ${exps.map((e) => e.toFixed(6)).join(' / ')} (spread ${spread.toExponential(3)})`);
    else if (verbose) notes.push(`      ✓ W-SEED-SEPARABLE     exponent ≡ ${exps[1].toFixed(6)} at seedMul ${SEED_LO}/1/${SEED_HI} (spread ${spread.toExponential(3)})`);
  }

  // ── P-IDENTITY: byte-identity seam at canonical radius
  {
    const got = paramsFor(DEFAULT_PARAMS, REF, 1);
    if (got !== DEFAULT_PARAMS) fail('P-IDENTITY', 'paramsForRadius(params, REF, 1) returned a NEW object — the golden byte-identity seam is broken');
    else if (verbose) notes.push('      ✓ P-IDENTITY           paramsForRadius(params, REF, 1) === params (same object)');
  }

  // ── P-DEGENERATE: the divide-by-zero / null guards
  {
    const cases = [
      ['null (unspecified)', null, 1],
      ['0 (falsy → treated as unspecified, NOT as the ceil)', 0, 1],
      ['NaN (falsy → unspecified)', NaN, 1],
      ['−1 (negative → 1e-6 floor → ceil)', -1, CEIL],
      ['1e-9 (sub-floor → ceil)', 1e-9, CEIL],
    ];
    let bad = null;
    for (const [name, R, want] of cases) {
      const p = paramsFor(DEFAULT_PARAMS, R, 1);
      const kR = (p === DEFAULT_PARAMS) ? 1 : p._widthRadiusFactor;
      if (!Object.is(kR, want)) { bad = `${name}: kR = ${kR}, expected ${want}`; break; }
    }
    if (bad) fail('P-DEGENERATE', bad);
    else if (verbose) notes.push(`      ✓ P-DEGENERATE         all ${cases.length} guard cases exact`);
  }

  return { label, failed, notes, metrics };
}

// ═══════════════════════════════════════════ RUN ════════════════════════════════════════════════
console.log('=== AC-RIVERS law audit — planet-lod-rivers.js widthRadiusFactor / paramsForRadius ===\n');
console.log('IMPORTED CONSTANTS (nothing typed here):');
console.log(`  REF_RADIUS_EARTH = ${REF}   WIDTH_RADIUS_FLOOR = ${FLOOR}   WIDTH_RADIUS_CEIL = ${CEIL}`);
console.log(`  WIDTH_SCALE = ${DEFAULT_PARAMS.WIDTH_SCALE}  WIDTH_MIN = ${DEFAULT_PARAMS.WIDTH_MIN}  WIDTH_MAX = ${DEFAULT_PARAMS.WIDTH_MAX}`);
console.log(`  WIDTH_PHI = ${DEFAULT_PARAMS.WIDTH_PHI}  WIDTH_EXP = ${DEFAULT_PARAMS.WIDTH_EXP}  VALLEY_WIDTH_MUL = ${DEFAULT_PARAMS.VALLEY_WIDTH_MUL}`);
console.log(`  WIDTH_SEED_LO/HI = ${SEED_LO}/${SEED_HI}   slider domain = [${RADIUS_SLIDER_MIN}, ${RADIUS_SLIDER_MAX}] RE\n`);
console.log('DERIVED BREAKPOINTS (clamp bites where ref/R crosses a bound):');
console.log(`  R_ceil  = REF/CEIL  = ${R_CEIL_BREAK}   (below → k pinned at ${CEIL})`);
console.log(`  R_floor = REF/FLOOR = ${R_FLOOR_BREAK}  (above → k pinned at ${FLOOR})\n`);
console.log('EXTRACTED (executed, not transcribed):');
for (const c of CONSUMERS) console.log(`  ${c.id}`);
console.log(`  clamp-boundary accum values solved from params: a(MIN)=${A_MIN_BOUNDARY.toFixed(4)}  a(MAX)=${A_MAX_BOUNDARY.toFixed(4)}\n`);

// hand-derived form, printed so the prediction is on the record BEFORE the numbers
console.log('HAND-DERIVED COMPOSED FORM (the thing being asserted):');
console.log('  k(R) = clamp(REF/R, FLOOR, CEIL)                       [kernel]');
console.log('  paramsForRadius scales WIDTH_SCALE, WIDTH_MIN, WIDTH_MAX all by k = k(R)·k_seed');
console.log('  ⇒ every width expression is clamp(k·S·φ, k·MIN, k·MAX) = k·clamp(S·φ, MIN, MAX)');
console.log('  ⇒ delivered width(R, accum) = k(R) · width(REF, accum)  EXACTLY, for every accum');
console.log(`  ⇒ d ln w / d ln R = −1 on ${R_CEIL_BREAK} ≤ R ≤ ${R_FLOOR_BREAK}, and 0 outside it.`);
console.log('  The law is therefore a power law of exponent −1 on the interior ONLY; it is NOT a power');
console.log('  law across the whole slider, and a single whole-range fit would report a lie.\n');

// the response table (the numbers the evidence doc quotes)
{
  const tRow = (R) => {
    const k = widthRadiusFactor(R, DEFAULT_PARAMS);
    const p = paramsForRadius(DEFAULT_PARAMS, R, 1);
    const trunk = CONSUMERS[0].fn(p, 40000), head = CONSUMERS[0].fn(p, 3);
    return `  R=${String(R).padStart(6)} RE   k=${k.toFixed(6)}   regime=${k === CEIL ? 'CEIL-PLATEAU' : k === FLOOR ? 'FLOOR-PLATEAU' : 'power −1   '}   trunk w=${trunk.toExponential(4)}   headwater w=${head.toExponential(4)}`;
  };
  console.log('RESPONSE TABLE (real law, widthSeedMul = 1):');
  for (const R of [RADIUS_SLIDER_MIN, 0.35, R_CEIL_BREAK, 0.5, 1, 2, 4, 8, R_FLOOR_BREAK, 14, RADIUS_SLIDER_MAX]) console.log(tRow(R));
  const fracInterior = Math.log(R_FLOOR_BREAK / R_CEIL_BREAK) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN);
  console.log(`\n  slider travel that is a live −1 power law : ${(100 * fracInterior).toFixed(2)}%`);
  console.log(`  slider travel pinned at the CEIL plateau  : ${(100 * Math.log(R_CEIL_BREAK / RADIUS_SLIDER_MIN) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN)).toFixed(2)}%`);
  console.log(`  slider travel pinned at the FLOOR plateau : ${(100 * Math.log(RADIUS_SLIDER_MAX / R_FLOOR_BREAK) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN)).toFixed(2)}%`);
  console.log(`  whole-slider CHORD exponent (weak stat)   : ${(Math.log(FLOOR / CEIL) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN)).toFixed(6)}\n`);
}

console.log('THRESHOLDS AND WHY EACH IS THE RIGHT ONE:');
for (const [id, { eps, why }] of Object.entries(THRESHOLDS)) {
  console.log(`  ${id}  (eps = ${eps === 0 ? 'EXACT' : eps})`);
  console.log(`      ${why.replace(/\s+/g, ' ')}`);
}
console.log('');

// ── H-SHADOW-FIDELITY: prove the injection target is the shipped arithmetic ──────────────────────
let shadowOK = true;
{
  const shadow = shadowParamsForRadius(widthRadiusFactor);
  let mism = null;
  outer:
  for (const c of CONSUMERS) {
    for (const R of [...R_ALL, null, 0, -1, 1e-9]) {
      for (const kS of [SEED_LO, 1, SEED_HI]) {
        const a = 100;
        const w1 = c.fn(paramsForRadius(DEFAULT_PARAMS, R, kS), a);
        const w2 = c.fn(shadow(DEFAULT_PARAMS, R, kS), a);
        if (!Object.is(w1, w2)) { mism = `${c.id} R=${R} kS=${kS}: real ${w1} vs shadow ${w2}`; break outer; }
      }
    }
  }
  shadowOK = !mism;
  console.log('── H-SHADOW-FIDELITY (the injection target is the shipped arithmetic) ──');
  console.log(shadowOK
    ? `  ✓ real paramsForRadius ≡ harness shadow, BIT-exact over ${CONSUMERS.length}×${R_ALL.length + 4}×3 cells (${CONSUMERS.length} consumers × ${R_ALL.length} radii + 4 degenerate × 3 seed draws)`
    : `  ✗ FAIL — ${mism}`);
  console.log('');
}

// ── the REAL law ────────────────────────────────────────────────────────────────────────────────
const real = runAudit('REAL (shipped planet-lod-rivers.js)', widthRadiusFactor, paramsForRadius, { verbose: true });
console.log('── REAL LAW ────────────────────────────────────────────────────────────');
for (const n of real.notes) console.log(n);
console.log(`  ⇒ ${real.failed.size === 0 ? 'ALL CHECKS PASS' : `${real.failed.size} CHECK(S) FAILED: ${[...real.failed].join(', ')}`}\n`);

// ── PLANTED-DEFECT POSITIVE CONTROL ─────────────────────────────────────────────────────────────
// Every defect is injected by DEPENDENCY INJECTION into the harness shadow. planet-lod-rivers.js is
// never edited, never written, never staged. Each defect names the check that MUST catch it; a defect
// caught only by some unrelated check would be weak evidence, so the predicted id is asserted.
const DEFECTS = [
  { id: 'D1 EXPONENT-HALF',   why: 'width ∝ R^−0.5 instead of R^−1',
    mustCatch: 'K-INTERIOR-IDENTITY', kernel: mkKernel({ exp: 0.5 }), opts: {} },
  { id: 'D2 CRATER-FRAME',    why: 'width ∝ R^−2 — the "make rivers match craters" mutation',
    mustCatch: 'K-SLOPE', kernel: mkKernel({ exp: 2 }), opts: {} },
  { id: 'D3 NO-CLAMP',        why: 'the FLOOR/CEIL clamp removed (pure 1/R everywhere)',
    mustCatch: 'K-CEIL-PLATEAU', kernel: mkKernel({ exp: 1, clamped: false }), opts: {} },
  { id: 'D4 SCALE-ONLY',      why: 'WIDTH_SCALE scaled by k but WIDTH_MIN/MAX left at reference',
    mustCatch: 'W-COVARIANCE', kernel: widthRadiusFactor, opts: { scaleOnly: true } },
  { id: 'D5 SEED-BENDS-R',    why: 'the radius exponent bends with the per-planet seed draw (identity at seedMul 1)',
    mustCatch: 'W-SEED-SEPARABLE', kernel: widthRadiusFactor, opts: { seedContaminatesRadius: true } },
  { id: 'D6 GUARDS-REMOVED',  why: 'the `|| ref` and 1e-6 divide-by-zero guards deleted',
    mustCatch: 'P-DEGENERATE', kernel: mkKernel({ exp: 1, guards: false }), opts: {} },
];

console.log('── PLANTED-DEFECT POSITIVE CONTROL (injected, never written to source) ──');
let controlOK = true;
for (const d of DEFECTS) {
  const r = runAudit(d.id, d.kernel, shadowParamsForRadius(d.kernel, d.opts));
  const caught = r.failed.has(d.mustCatch);
  if (!caught) controlOK = false;
  console.log(`  ${d.id} — ${d.why}`);
  console.log(`    predicted catcher: ${d.mustCatch}  →  ${caught ? 'CAUGHT ✓' : 'NOT CAUGHT ✗'}`);
  // reported for EVERY defect, pass or fail: the whole-slider chord is the statistic a naive
  // single-power-law field fit would produce. Where it matches the real law's −0.865577, that defect
  // is INVISIBLE to such a fit — the reason §2d says do not fit across the whole slider.
  console.log(`    whole-slider chord = ${r.metrics.chord.toFixed(6)}  (real law: ${real.metrics.chord.toFixed(6)}${Math.abs(r.metrics.chord - real.metrics.chord) < 1e-12 ? '  ← IDENTICAL: invisible to a whole-range fit' : ''});  mid-interior local slope = ${r.metrics.midSlope.toFixed(6)}`);
  console.log(`    all checks failed: ${r.failed.size ? [...r.failed].join(', ') : '(none — instrument blind!)'}`);
  for (const n of r.notes) console.log(n.replace('      ✗', '      ·'));
  if (r.failed.size === 0) controlOK = false;
  console.log('');
}

// ── SECONDARY (dormant path): the OTHER river radius law, in the lab, not the module ─────────────
// deriveTributaryGridRes (world-engine-lab.html) sets the fine-lattice density ∝ R, clamped [56,560].
// Extracted and executed the same way. Reported because "do rivers answer radius" is a question about
// the SYSTEM, not one function — but flagged dormant: patchStrength defaults to 0.
let secondaryOK = true;
{
  const capDeg = /const RIVER_LOD_REF_CAP_DEG = ([\d.]+);/.exec(LAB_SRC);
  const sFeat  = /const RIVER_LOD_S_FEAT_KM\s+= ([\d.]+);/.exec(LAB_SRC);
  const body   = /function deriveTributaryGridRes\(\)\{([\s\S]*?)\n    \}/.exec(LAB_SRC);
  console.log('── SECONDARY: deriveTributaryGridRes (world-engine-lab.html, DORMANT — patchStrength default 0) ──');
  if (!capDeg || !sFeat || !body) {
    console.log('  ✗ X-PATCH-GRIDRES-BREAK: extraction failed — lab source shape changed.');
    secondaryOK = false;
  } else {
    const CAP_DEG = +capDeg[1], S_FEAT = +sFeat[1];
    const f = new Function('THREE', 'state', 'RIVER_LOD_REF_CAP_DEG', 'RIVER_LOD_S_FEAT_KM', `${body[1]}`);
    const gridRes = (R) => f(THREE, { planetRadiusEarth: R }, CAP_DEG, S_FEAT);
    // closed form WITH the Math.ceil accounted for: ceil(x) ≥ 560 ⟺ x > 559, so the saturation radius is
    // a bracket [R(559), R(560)], not a point. (First pass used the point 560 and FAILED by 8 sample steps
    // — a defect in the audit's own threshold derivation, recorded here rather than quietly retuned.)
    const kmPerRE = 6371;
    const R_of = (cells) => cells * S_FEAT / (2 * Math.sin(THREE.MathUtils.degToRad(CAP_DEG)) * kmPerRE);
    const R_lo = R_of(559), R_hi = R_of(560);
    let firstSat = null;
    for (let i = 0; i <= 20000; i++) { const R = radiusFromT(i / 20000); if (gridRes(R) >= 560) { firstSat = R; break; } }
    const inBracket = firstSat != null && firstSat >= R_lo && firstSat <= R_hi;
    console.log(`  extracted: REF_CAP_DEG=${CAP_DEG}  S_FEAT_KM=${S_FEAT}  (lab lines ${lineOf(LAB_SRC, capDeg.index)}, ${lineOf(LAB_SRC, sFeat.index)}, ${lineOf(LAB_SRC, body.index)})`);
    console.log(`  gridRes: R=0.3 → ${gridRes(0.3)},  R=1 → ${gridRes(1)},  R=1.26 → ${gridRes(1.26)},  R=4 → ${gridRes(4)},  R=16 → ${gridRes(16)}`);
    console.log(`  closed-form saturation bracket = [${R_lo.toFixed(6)}, ${R_hi.toFixed(6)}] RE ; first saturating sample = ${firstSat != null ? firstSat.toFixed(6) : 'none'} RE`);
    console.log(`  ${inBracket ? '✓' : '✗'} X-PATCH-GRIDRES-BREAK — sampled breakpoint inside the ceil-aware closed-form bracket`);
    console.log(`  FINDING: the fine-lattice density is CEIL-PINNED for R ≳ ${R_hi.toFixed(3)} RE, i.e. over ${(100 * Math.log(RADIUS_SLIDER_MAX / R_hi) / Math.log(RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN)).toFixed(1)}% of slider travel.`);
    secondaryOK = inBracket;
  }
  console.log('');
}

// ─────────────────────────────────────────── verdict ────────────────────────────────────────────
const ok = shadowOK && real.failed.size === 0 && controlOK && secondaryOK;
console.log('════════════════════════════════════════════════════════════════════════');
console.log(`  shadow fidelity        : ${shadowOK ? 'PASS' : 'FAIL'}`);
console.log(`  real law               : ${real.failed.size === 0 ? 'PASS (all checks)' : 'FAIL'}`);
console.log(`  planted-defect control : ${controlOK ? `PASS (${DEFECTS.length}/${DEFECTS.length} caught by their predicted check)` : 'FAIL'}`);
console.log(`  secondary (dormant)    : ${secondaryOK ? 'PASS' : 'FAIL'}`);
console.log(`  VERDICT: ${ok ? 'AUDIT PASSES — the law is exactly clamp(REF/R, FLOOR, CEIL), and the instrument is proven.' : 'AUDIT FAILED'}`);
console.log('════════════════════════════════════════════════════════════════════════');
process.exit(ok ? 0 : 1);

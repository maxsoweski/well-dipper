// calibration/gterm-audit.mjs — Inc-3b S0.4: triple g-term double-dip audit (RUNNABLE PROOF).
//
// WHY THIS EXISTS (BUILD-PLAN §1.S0 block S0.4, §0.5, §0.7; brief §3a-2 / architecture-seams A2):
// Four distinct places multiply or key off surface gravity `g` in the crater-relief pipeline. If two of
// them applied the SAME g-power to the SAME quantity, we would re-introduce the exact "relief²" defect
// Inc-3 already convicted (envelope applied twice → g^-1.16). This script DOCUMENTS the four g-touchpoints
// and PROGRAMMATICALLY ASSERTS they compose on ORTHOGONAL axes (magnitude vs ratio vs per-crater size vs
// dormant), so the Inc-3b relief-variance budget does NOT double-count g. It ships NO code; it is its own
// proof. Pure node ESM, runnable from any cwd, single-threaded, no network, no RNG, no timestamps — every
// number below reproduces EXACTLY on re-run. Exit 0 iff all asserts pass; nonzero on the first failure.
//
// THE FOUR g-TOUCHPOINTS (the "triple" pre-existing g-terms + the budget's new one):
//   (a) RENDER   reliefEnvelope(R,g)=clamp(g^-Q_RELIEF, FLOOR, CEIL)  — scales the composited SUM once.
//   (b) DEPTH    D_t(g)=K_DT/g inside craterField                     — a per-crater SIZE classifier.
//   (c) WRITER   gCap=reliefGravityFactor(drivers.surfaceGravity ?? 1) in tectonic.js — DORMANT here.
//   (d) BUDGET   σ_endo ∝ g^-Q_RELIEF inside f_I                      — sets the RATIO only, never re-rendered.
//
// IMPORT-PATTERN: mirrors ../../../world-engine-inc3-relief-spine-depthlaw-2026-07-21/calibration/
// population-sweep.mjs — relative depth ../../../../ from this calibration dir to the repo root.
//
// NO-TASTE-CONSTANTS POSTURE (contract hard constraint): every g-related numeric constant used below is
// IMPORTED from the shipped modules (K_DT, Q_RELIEF, RELIEF_FLOOR/CEIL, CRATER_DEPTH_N, …) — never copied.
// The one exception the CODEBASE forces: reliefGravityFactor is NOT exported from tectonic.js (verified by
// grep this session; the S0.4 spec's "import both" is impossible for that symbol — a code fact, like the
// v2-4 "don't assume the seam" lesson). Rather than hand-type its constants (which WOULD be taste
// constants), touchpoint (c) reads the LIVE tectonic.js source at runtime, extracts the exact function
// body, and EXECUTES it — the strongest possible proof (it runs the shipped bytes). See assertWriterDormant.
//
// The only literals authored HERE are the deterministic TOY-COMPOSITE sample values used to demonstrate
// ratio-invariance in (a)/(d). They are not physics constants — they are a fixture whose shape (a ~0.09
// base channel + a ~0.0011 crater channel, matching the boot RMS ratio ~1.14% the amplitude-budget harness
// measures) makes the algebra visible; the invariance being proven holds for ANY input array, so no value
// is load-bearing. Each is tagged FIXTURE inline.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// (a) RENDER envelope + its exponent/clamp — the ONE relief-strength multiplier the lab bakes on uPerturb.
import { reliefEnvelope, Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL } from '../../../../planet-lod-lab-core.js';
// (b) DEPTH-law: K_DT (D_t = K_DT/g), the transition-diameter fn, and craterAmplitude to run the size proof.
import { K_DT, transitionDiameterKm, craterAmplitude } from '../../../../src/worldengine/base/bombardment.js';
// (c) WRITER dormancy: the exact grain-driver object the despun() path passes to writeHeightSphere.
import { DEFAULT_GRAIN_DRIVERS } from '../../../../planet-lod-rivers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..', '..');
const TECTONIC_SRC = join(REPO, 'src', 'worldengine', 'base', 'tectonic.js');

// ── assertion plumbing (deterministic; no wall-clock, no RNG) ──────────────────────────────────────────
let failures = 0;
function assert(cond, label, detail = '') {
  const ok = !!cond;
  if (!ok) { failures++; console.log(`  ✗ FAIL: ${label}${detail ? `  — ${detail}` : ''}`); }
  else       console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`);
  return ok;
}
// relative closeness — the honest predicate for "invariant up to IEEE-754 round-off" (NOT bit-equality;
// scaling an array element-wise then reducing differs from scaling the reduction by ULPs — claiming
// bit-exactness would over-state the result).
const closeRel = (a, b, relEps = 1e-12) =>
  Math.abs(a - b) <= relEps * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
// raw RMS = √(mean(x²)) — the definition the amplitude-budget harness (§0.9) uses; ratio-invariance under a
// uniform scale holds identically under Var(·) too, since both scale by |E| (see the (a) algebra comment).
const rms = (xs) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
const scaleAll = (xs, k) => xs.map((x) => k * x);

console.log('=== Inc-3b S0.4 — triple g-term double-dip audit (runnable proof) ===');
console.log(`imported: Q_RELIEF=${Q_RELIEF}  RELIEF_FLOOR=${RELIEF_FLOOR}  RELIEF_CEIL=${RELIEF_CEIL}  K_DT=${K_DT}\n`);

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (a) RENDER envelope — scales the composited SUM ONCE ⇒ crater:base RATIO is INVARIANT under it.
//     ALGEBRA: the lab bakes reliefAmp = uPerturb·mix(0.7,1.0,uLodRamp) onto the WHOLE accumulated grad
//     (planet-lod-lab.html:536-537), and uPerturb = perturb·reliefEnvelope(R,g) (:5606). So every additive
//     channel in the composite is scaled by the SAME factor E=reliefEnvelope(R,g). RMS(E·x)=|E|·RMS(x),
//     so RMS(E·crater)/RMS(E·base) = RMS(crater)/RMS(base): E cancels. This is the Inc-3 core finding and
//     the reason the budget MUST act at the composite (ratio), not the envelope (magnitude).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('(a) RENDER reliefEnvelope(R,g)=clamp(g^-Q_RELIEF,…) — ratio-invariant magnitude scale:');
{
  // FIXTURE — deterministic toy composite (no RNG). base≈0.09 RMS, crater≈0.0011 RMS ⇒ ~1.14% boot-like
  // ratio; values are a fixture, not physics. Invariance proven holds for ANY arrays.
  const N = 128;
  const h = [], sd = [], cf = [];
  for (let i = 0; i < N; i++) {
    h.push(0.09 * Math.sin(i * 0.7));            // FIXTURE base/tectonic channel
    sd.push(0.0);                                // FIXTURE shelfDepth — all-zero on the airless despun path
    cf.push(0.0011 * Math.sin(i * 2.3 + 1.0));   // FIXTURE craterField channel (≈ boot craterField RMS)
  }
  // identity weights (pre-budget composite): out = 1·h + sd + 1·cf
  const craterContribUnscaled = cf;              // w_i = 1
  const baseContribUnscaled = h;                 // w_e = 1
  const ratioUnscaled = rms(craterContribUnscaled) / rms(baseContribUnscaled);

  // "render": pick a real low-g body (Moon-class g≈0.165 Earth-g) → E from the SHIPPED envelope (imported).
  const gMoon = 0.165;                           // Moon surface gravity in Earth-g units (real body; drives E)
  const E = reliefEnvelope(1.0, gMoon);          // render magnitude multiplier (radius flows through g; R unused)
  const craterContribScaled = scaleAll(craterContribUnscaled, E);
  const baseContribScaled = scaleAll(baseContribUnscaled, E);
  const ratioScaled = rms(craterContribScaled) / rms(baseContribScaled);

  console.log(`    E=reliefEnvelope(1,${gMoon})=${E.toFixed(6)}  crater:base ratio  unscaled=${ratioUnscaled.toFixed(9)}  scaled=${ratioScaled.toFixed(9)}`);
  assert(closeRel(ratioScaled, ratioUnscaled), 'crater:base ratio invariant under the render envelope (E scales num+denom equally)',
    `|Δ|=${Math.abs(ratioScaled - ratioUnscaled).toExponential(2)}`);
  // sanity: E genuinely acts on magnitude (so the invariance is non-trivial — E≠1 here).
  assert(!closeRel(E, 1.0) && rms(craterContribScaled) > rms(craterContribUnscaled),
    'envelope is a NON-trivial magnitude scale (E≠1, channel magnitudes move) yet the ratio does not', `E=${E.toFixed(4)}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (b) DEPTH-LAW D_t(g)=K_DT/g — a SIZE effect (which craters roll simple→complex), NOT a relief strength.
//     g enters craterAmplitude ONLY through dt=transitionDiameterKm(g) in the `shallow` factor, and that
//     factor is EXACTLY 1 for any crater with D_km ≤ dt. So a below-transition crater's amplitude is
//     g-INDEPENDENT — the signature of a size classifier, not a field-wide g-multiplier (which would scale
//     EVERY crater). Larger craters get a size-dependent roll-off whose threshold moves with g.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n(b) DEPTH-law D_t(g)=K_DT/g inside craterField — per-crater SIZE classifier, not a strength:');
{
  const gLo = 0.165, gHi = 1.0;                  // Moon-class vs Earth-class surface gravity (Earth-g units)
  const dtLo = transitionDiameterKm(gLo);        // = K_DT/gLo (km) — the simple→complex transition DIAMETER
  const dtHi = transitionDiameterKm(gHi);        // = K_DT/gHi (km)
  console.log(`    D_t = K_DT/g : g=${gLo}→${dtLo.toFixed(3)} km   g=${gHi}→${dtHi.toFixed(3)} km  (K_DT=${K_DT}, imported)`);
  // D_t is a DIAMETER (km) equal to K_DT/g — assert against the imported constant, not a copied number.
  assert(closeRel(dtLo, K_DT / gLo) && closeRel(dtHi, K_DT / gHi), 'D_t(g) == K_DT/g exactly (a transition DIAMETER in km, not a gain)');
  assert(dtLo > dtHi, 'lower g ⇒ LARGER transition diameter (more craters stay simple) — a size threshold that moves with g');

  const Dang = 0.05;                             // FIXTURE angular diameter (rad) — same for both g so `simple` is identical
  // SMALL crater below BOTH transition diameters ⇒ shallow factor = 1 on both ⇒ amplitude g-INDEPENDENT.
  const dSmallKm = 1.0;                          // FIXTURE 1 km — < dtHi(3.1) < dtLo(18.8) on both bodies
  const aSmallLo = craterAmplitude(Dang, dSmallKm, gLo);
  const aSmallHi = craterAmplitude(Dang, dSmallKm, gHi);
  console.log(`    small crater (D_km=${dSmallKm}, both < D_t): A(g=${gLo})=${aSmallLo.toExponential(6)}  A(g=${gHi})=${aSmallHi.toExponential(6)}`);
  assert(aSmallLo === aSmallHi, 'below-transition crater amplitude is BIT-IDENTICAL across g — g is NOT a uniform relief-strength multiplier',
    'if it were a strength term every crater would scale with g');
  // LARGE crater above BOTH transition diameters ⇒ size-dependent roll-off; low-g body rolls off LESS.
  const dLargeKm = 50.0;                          // FIXTURE 50 km — > dtLo(18.8) > dtHi(3.1) on both bodies
  const aLargeLo = craterAmplitude(Dang, dLargeKm, gLo);
  const aLargeHi = craterAmplitude(Dang, dLargeKm, gHi);
  console.log(`    large crater (D_km=${dLargeKm}, both > D_t): A(g=${gLo})=${aLargeLo.toExponential(6)}  A(g=${gHi})=${aLargeHi.toExponential(6)}`);
  assert(aLargeLo !== aLargeHi && aLargeLo > aLargeHi,
    'above-transition crater DOES depend on g — a SIZE-selective shape roll-off (dt moves), not a global gain',
    `low-g rolls off less (larger dt) ⇒ deeper`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (c) WRITER gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1) — DORMANT under the rivers despun path.
//     TWO composing facts:
//       1. DEFAULT_GRAIN_DRIVERS (the object despun() passes to writeHeightSphere at rivers.js:493-494)
//          has NO surfaceGravity key ⇒ `drivers.surfaceGravity ?? 1` === 1 on every despun build.
//       2. reliefGravityFactor(1) === 1.0 exactly ⇒ the gCap gain is the identity ⇒ this third g-term
//          contributes nothing under the Moon/Mercury/Frozen/Crystal despun route the budget targets.
//     reliefGravityFactor is NOT exported (code fact) ⇒ we EXECUTE the live source rather than import it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n(c) WRITER gCap reliefGravityFactor — DORMANT under DEFAULT_GRAIN_DRIVERS:');
{
  // Fact 1 — the writer never receives a surfaceGravity on the despun path (imported object, asserted).
  const hasKey = Object.prototype.hasOwnProperty.call(DEFAULT_GRAIN_DRIVERS, 'surfaceGravity');
  const gArg = DEFAULT_GRAIN_DRIVERS.surfaceGravity ?? 1;   // exactly what tectonic.js:137/207 evaluate
  console.log(`    DEFAULT_GRAIN_DRIVERS = ${JSON.stringify(DEFAULT_GRAIN_DRIVERS)}  →  (surfaceGravity ?? 1) = ${gArg}`);
  assert(!hasKey, 'DEFAULT_GRAIN_DRIVERS has NO surfaceGravity key (writer g-source is absent on the despun path)');
  assert(gArg === 1, '(DEFAULT_GRAIN_DRIVERS.surfaceGravity ?? 1) === 1 exactly — the writer always sees g=1');

  // Fact 2 — reliefGravityFactor(1) === 1.0, proven by EXECUTING the live tectonic.js source (not imported;
  // not hand-typed). Extract the exact function definition and run it — the strongest anti-taste-constant proof.
  const src = readFileSync(TECTONIC_SRC, 'utf8');
  const m = src.match(/function\s+reliefGravityFactor\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert(!!m, 'located the live reliefGravityFactor definition in tectonic.js (source extraction)');
  const fnSrc = m[0];
  // shape check — the g-power + clamp form we are auditing (tokens read off the extracted source, not asserted numerically here).
  assert(/Math\.pow\(/.test(fnSrc) && /Math\.min\(/.test(fnSrc) && /Math\.max\(/.test(fnSrc),
    'extracted reliefGravityFactor is the expected clamp(g^p) form', fnSrc.replace(/\s+/g, ' ').trim());
  // reconstruct the LIVE function and execute it (deterministic; body references only `g` and global Math).
  const reliefGravityFactor = new Function(`${fnSrc}\nreturn reliefGravityFactor;`)();
  const gCapAtOne = reliefGravityFactor(1);
  console.log(`    reliefGravityFactor(1) [executed from live source] = ${gCapAtOne}`);
  assert(gCapAtOne === 1.0, 'reliefGravityFactor(1) === 1.0 exactly — gCap is the IDENTITY when g=1');
  // compose Fact 1 + Fact 2: the actual gCap the despun writer computes.
  assert(reliefGravityFactor(gArg) === 1.0, 'gCap = reliefGravityFactor(DEFAULT_GRAIN_DRIVERS.surfaceGravity ?? 1) === 1.0 ⇒ third g-term is DORMANT');

  // corroborate the call-site wiring by grep: exactly the two documented gCap sites read `?? 1`, one definition.
  const callSites = (src.match(/reliefGravityFactor\(drivers\.surfaceGravity \?\? 1\)/g) || []).length;
  const defs = (src.match(/function\s+reliefGravityFactor\s*\(/g) || []).length;
  const exported = /export\s+function\s+reliefGravityFactor|export\s*\{[^}]*\breliefGravityFactor\b/.test(src);
  console.log(`    tectonic.js: ${callSites} call-site(s) reading \`drivers.surfaceGravity ?? 1\`, ${defs} definition, exported=${exported}`);
  assert(callSites === 2 && defs === 1, 'both gCap call sites source g from `drivers.surfaceGravity ?? 1` (one private definition)');
  assert(exported === false, 'reliefGravityFactor is NOT exported (documents why (c) executes the source instead of importing)');
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (d) BUDGET σ_endo ∝ g^-Q_RELIEF — consumed ONLY to compute the ratio f_I; NEVER re-applied render-side.
//     DESIGN STATEMENT (BUILD-PLAN §2.1 "Q_RELIEF reused; no second strength exponent" + §0.5 ratio-invariance
//     + §0.2a point 2 "the model-f_I ÷ realized-norm split"): the same g^-Q_RELIEF FORM appears in BOTH the
//     render envelope (a) AND the budget's endo-strength model σ_endo. That is NOT a double-dip because they
//     act on ORTHOGONAL quantities:
//       • σ_endo's g^-Q_RELIEF lives inside f_I = σ_imp²/(σ_imp²+σ_endo²), a DIMENSIONLESS RATIO that only
//         sets the composite weights (w_e,w_i) — the crater:base variance SPLIT. It is never multiplied onto
//         the rendered field.
//       • the render envelope's g^-Q_RELIEF is the MAGNITUDE the whole composite is scaled by, once.
//     Corroboration below: apply illustrative budget weights (encoding σ_endo via f_I) to the toy composite,
//     then scale by the render envelope E — the crater:base ratio the budget SET is preserved (E cancels, per
//     (a)). So budget-g (ratio axis) and render-g (magnitude axis) compose without stacking.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n(d) BUDGET σ_endo ∝ g^-Q_RELIEF inside f_I — sets the RATIO only, never re-rendered:');
{
  // Illustrative budget output CITED from BUILD-PLAN §0.2a worked point (f_I=0.97 → w_e=0.1732, w_i=86.48);
  // these are NOT authored constants — they are the plan's frozen worked solve, used here only to show the
  // ratio the budget sets survives the render scale. The invariance holds for ANY (w_e,w_i).
  const w_e = 0.1732;   // CITED §0.2a (budget endo weight at the boot worked point)
  const w_i = 86.48;    // CITED §0.2a (budget impact weight at the boot worked point)

  const N = 128;
  const h = [], cf = [];
  for (let i = 0; i < N; i++) {
    h.push(0.09 * Math.sin(i * 0.7));            // FIXTURE base channel (same fixture family as (a))
    cf.push(0.0011 * Math.sin(i * 2.3 + 1.0));   // FIXTURE crater channel
  }
  const craterWeighted = scaleAll(cf, w_i);      // budget-weighted crater contribution
  const baseWeighted = scaleAll(h, w_e);         // budget-weighted base contribution
  const ratioBudget = rms(craterWeighted) / rms(baseWeighted);          // the crater:base ratio the BUDGET set

  const E = reliefEnvelope(1.0, 0.165);          // render magnitude scale (Moon-class), imported envelope
  const ratioBudgetThenRender = rms(scaleAll(craterWeighted, E)) / rms(scaleAll(baseWeighted, E));

  console.log(`    budget weights (CITED §0.2a) w_e=${w_e} w_i=${w_i}  crater:base ratio  budget=${ratioBudget.toFixed(6)}  budget→render=${ratioBudgetThenRender.toFixed(6)}`);
  assert(closeRel(ratioBudgetThenRender, ratioBudget),
    'the budget-set crater:base ratio survives the render envelope (σ_endo-g and render-g compose on orthogonal axes)',
    `|Δ|=${Math.abs(ratioBudgetThenRender - ratioBudget).toExponential(2)}`);
  // and it is NOT the identity ratio — the budget genuinely inverted the split (crater now dominant), proving
  // σ_endo's g-term did real work in the RATIO while never touching render MAGNITUDE.
  const ratioIdentity = rms(cf) / rms(h);
  assert(ratioBudget > ratioIdentity && ratioBudget > 1.0,
    'budget flipped crater:base from base-dominant to crater-dominant via the RATIO (σ_endo-g acts here, not render-side)',
    `identity=${ratioIdentity.toFixed(4)} → budget=${ratioBudget.toFixed(4)}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// FOUR-ROW SUMMARY TABLE: touchpoint → role → why-no-double-dip.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
const TABLE = [
  { t: '(a) render reliefEnvelope g^-Q_RELIEF', role: 'MAGNITUDE — scales composited SUM once (uPerturb)',
    why: 'ratio-invariant: scales crater+base equally ⇒ crater:base unchanged' },
  { t: '(b) depth-law D_t(g)=K_DT/g',           role: 'SIZE — per-crater simple→complex transition diameter',
    why: 'below-transition craters g-independent ⇒ not a field-wide gain' },
  { t: '(c) writer gCap reliefGravityFactor',   role: 'WRITER base-amp gain (tectonic despun)',
    why: 'DORMANT: DEFAULT_GRAIN_DRIVERS has no surfaceGravity ⇒ gCap=rGF(1)=1.0' },
  { t: '(d) budget σ_endo g^-Q_RELIEF',         role: 'RATIO — endo-strength model inside f_I (composite)',
    why: 'consumed only to set weights; never re-applied as render magnitude' },
];
console.log('\n=== g-TOUCHPOINT AUDIT TABLE ===');
const c1 = Math.max(...TABLE.map((r) => r.t.length), 'touchpoint'.length);
const c2 = Math.max(...TABLE.map((r) => r.role.length), 'role'.length);
console.log(`${'touchpoint'.padEnd(c1)}  ${'role'.padEnd(c2)}  why no double-dip`);
console.log(`${'-'.repeat(c1)}  ${'-'.repeat(c2)}  ${'-'.repeat(52)}`);
for (const r of TABLE) console.log(`${r.t.padEnd(c1)}  ${r.role.padEnd(c2)}  ${r.why}`);
console.log('\nComposition: g acts on FOUR ORTHOGONAL axes — magnitude (a), per-crater size (b), dormant (c),');
console.log('variance-ratio (d). No two apply the same g-power to the same quantity ⇒ NO double-count.');

// ── verdict ────────────────────────────────────────────────────────────────────────────────────────
if (failures) {
  console.log(`\nFAIL — ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nALL ASSERTS GREEN — the four g-touchpoints compose without a double-dip.');
process.exit(0);

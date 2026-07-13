// V2-5s calibration #2+#3 — NOISE FLOORS + GAIN/CLAMP PROBES.
// (a) 5-seed spreads of the AC-VARIETY observable vector at REF drivers per regime => noise floors.
// (b) A candidate shellDriversToTune (the exact code the builder will ship) probed per-axis:
//     monotone correct-sign ABOVE the floor across the clamped domain, EXACT collapse at each REF,
//     |U|<SHELL_BOUND at every point, and the blast-radius property (grainAngle+faultDensity byte-identical).
// Run FROM REPO ROOT:  node docs/WORKSTREAMS/world-engine-v2-5s-shell-multiply-2026-07-12/calibration/gain-probes.mjs
import { writeShellReliefSphere, SHELL_BOUND } from '/home/ax/projects/well-dipper/src/worldengine/base/shellRelief.js';
import { makeSphereField } from '/home/ax/projects/well-dipper/src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '/home/ax/projects/well-dipper/planet-lod-rivers.js';

const TARGET_N = 600, LLOYD = 2;
const SEEDS = [1, 2, 3, 7, 42];
const REGIMES = ['icy-active', 'volatile-cold', 'eyeball-despun'];
const mesh = buildIrregularSphere(TARGET_N, LLOYD);
const carrierOf = () => makeSphereField(mesh);

// ── the SHELL_DEFAULTS the tune re-tunes (mirror shellRelief.js:67) ──
const D = { CELL_MIN: 9, CREST_THRESH: 0.94, TENSILE_THRESH: 0.05, CHAOS_THRESH: 0.6, RIDGE_AMP: 1.4, CHAOS_AMP: 0.12, CHAOS_BASE: -0.04 };
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));

// ── SHELL_REFS (byte-exact per ref-slots.mjs) ──
const IO_TIDAL_REF = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
const tid = (ecc, star, R, orbit) => (ecc * ecc * star * star * Math.pow(R, 5) / Math.pow(orbit, 5)) / IO_TIDAL_REF;
const SHELL_REFS = {
  'icy-active':     { massGravity: 0.07 / (0.5 * 0.5),   volatileFraction: 0.5,  tidalHeating: tid(0.1, 332946, 0.5, 2500),   condition: { T_eq: 110 } },
  'volatile-cold':  { massGravity: 0.025 / (0.4 * 0.4),  volatileFraction: 0.4,  tidalHeating: tid(0.03, 332946, 0.4, 120000), condition: { T_eq: 94 } },
  'eyeball-despun': { massGravity: 1 / (1 * 1),          volatileFraction: 0.25, tidalHeating: tid(0.01, 332946, 1, 23455),    condition: { T_eq: 270 } },
};

// ── CANDIDATE gains (this is what the probe TUNES; the winning set goes into the builder) ──
const G = {
  SPAN_DECADES: 6,      // A2 log10-ratio normalizer
  K_CREST: 0.09, CREST_LO: 0.82, CREST_HI: 0.985,
  K_TENSILE: 0.03, TENSILE_LO: 0.01, TENSILE_HI: 0.12,
  K_CELL: 7, T_VIGOR_SPAN: 120, CELL_LO: 4, CELL_HI: 22,
  K_CHAOSTHRESH: 0.28, T_WARM_SPAN: 120, CHAOS_LO: 0.30, CHAOS_HI: 0.80,
};

// ── the CANDIDATE builder (pure; mirror the sibling null-guard-first / exact-only-=== discipline) ──
function shellDriversToTune(drivers, regime) {
  if (drivers == null) return null;
  const REF = SHELL_REFS[regime] || SHELL_REFS['icy-active'];
  const g   = drivers.massGravity     ?? REF.massGravity;
  const vf  = drivers.volatileFraction ?? REF.volatileFraction;
  const th  = drivers.tidalHeating    ?? REF.tidalHeating;
  const Teq = drivers.condition?.T_eq ?? REF.condition.T_eq;

  // A1 gravity → one common gFactor onto RIDGE_AMP + CHAOS_AMP + CHAOS_BASE (relief ∝ 1/g; house convention)
  const gFactor = clamp(0.4, 2.5, Math.pow(g / REF.massGravity, -0.5));
  const RIDGE_AMP  = D.RIDGE_AMP  * gFactor;
  const CHAOS_AMP  = D.CHAOS_AMP  * gFactor;
  const CHAOS_BASE = D.CHAOS_BASE * gFactor;

  // A2 tidal → CREST_THRESH (+ TENSILE_THRESH) down as tidal rises (more crack density). log-ratio: 0 at REF.
  const tidalDev = clamp(-1, 1, Math.log10(Math.max(th, 1e-30) / REF.tidalHeating) / G.SPAN_DECADES);
  const CREST_THRESH   = clamp(G.CREST_LO, G.CREST_HI, D.CREST_THRESH - G.K_CREST * tidalDev);
  const TENSILE_THRESH = clamp(G.TENSILE_LO, G.TENSILE_HI, D.TENSILE_THRESH - G.K_TENSILE * tidalDev);

  // A3 thermal vigor (T_eq + vf) → CELL_MIN (finer convection planform). 0 at REF.
  const vigor = (Teq - REF.condition.T_eq) / G.T_VIGOR_SPAN + (vf - REF.volatileFraction);
  const CELL_MIN = clamp(G.CELL_LO, G.CELL_HI, Math.round(D.CELL_MIN + G.K_CELL * vigor));

  // A4 T_eq → CHAOS_THRESH down on warm shells (more melt-through chaos). 0 at REF.
  const warmDev = (Teq - REF.condition.T_eq) / G.T_WARM_SPAN;
  const CHAOS_THRESH = clamp(G.CHAOS_LO, G.CHAOS_HI, D.CHAOS_THRESH - G.K_CHAOSTHRESH * warmDev);

  // exact-only identity guard: ALL === DEFAULT (the REF point) → null (byte-identical shipped preset)
  if (CELL_MIN === D.CELL_MIN && CREST_THRESH === D.CREST_THRESH && TENSILE_THRESH === D.TENSILE_THRESH &&
      CHAOS_THRESH === D.CHAOS_THRESH && RIDGE_AMP === D.RIDGE_AMP && CHAOS_AMP === D.CHAOS_AMP && CHAOS_BASE === D.CHAOS_BASE) {
    return null;
  }
  return { CELL_MIN, CREST_THRESH, TENSILE_THRESH, CHAOS_THRESH, RIDGE_AMP, CHAOS_AMP, CHAOS_BASE };
}

// ── observables ──
const stdev = (a) => { let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length; let v = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - m; v += d * d; } return Math.sqrt(v / a.length); };
function observe(diag) {
  let lin = 0, chaos = 0;
  for (let i = 0; i < diag.lineamentNode.length; i++) if (diag.lineamentNode[i]) lin++;
  for (let i = 0; i < diag.chaosMask.length; i++) if (diag.chaosMask[i] > 1e-6) chaos++;
  const N = diag.U.length;
  return { linN: lin, linFrac: lin / N, stdU: stdev(diag.U), chaosFrac: chaos / N, cellCount: diag.cellCount };
}
function build(seed, regime, drivers) {
  const c = carrierOf();
  const tune = shellDriversToTune(drivers, regime);
  const diag = writeShellReliefSphere(c, drivers ?? {}, { macroSeed: seed, regime, tune });
  return { c, diag, tune, obs: observe(diag) };
}
const liveRef = (regime) => ({ ...SHELL_REFS[regime], massGravity: SHELL_REFS[regime].massGravity, volatileFraction: SHELL_REFS[regime].volatileFraction, tidalHeating: SHELL_REFS[regime].tidalHeating, condition: { T_eq: SHELL_REFS[regime].condition.T_eq } });

// ════ (a) NOISE FLOORS: 5-seed spread at REF drivers per regime ════
console.log('\n#### NOISE FLOORS (5-seed spread at REF drivers; floor = max-min across seeds {1,2,3,7,42}) ####');
const FLOOR = {};
for (const r of REGIMES) {
  const rows = SEEDS.map((s) => build(s, r, null).obs);   // null drivers => tune null => shipped preset (seed-only)
  const spread = (key) => { const v = rows.map((o) => o[key]); return { min: Math.min(...v), max: Math.max(...v), floor: Math.max(...v) - Math.min(...v) }; };
  FLOOR[r] = { linN: spread('linN'), stdU: spread('stdU'), chaosFrac: spread('chaosFrac'), cellCount: spread('cellCount') };
  console.log(`\n${r}:`);
  for (const k of ['linN', 'stdU', 'chaosFrac', 'cellCount']) {
    const s = FLOOR[r][k];
    console.log(`  ${k.padEnd(10)} min=${s.min.toFixed ? s.min.toFixed(4) : s.min}  max=${s.max.toFixed ? s.max.toFixed(4) : s.max}  FLOOR=${(s.floor.toFixed ? s.floor.toFixed(4) : s.floor)}`);
  }
}

// ════ null-at-REF byte anchor (exact collapse) ════
console.log('\n#### EXACT COLLAPSE: shellDriversToTune(liveREF, regime) === null ####');
for (const r of REGIMES) {
  const atRefFrozen = shellDriversToTune(SHELL_REFS[r], r);
  const atRefLive = shellDriversToTune(liveRef(r), r);
  console.log(`  ${r.padEnd(15)} frozenREF->${atRefFrozen === null ? 'null' : 'NON-NULL!'}   liveREF->${atRefLive === null ? 'null' : 'NON-NULL!'}`);
}
console.log(`  null-guard: shellDriversToTune(null,'icy-active')=${shellDriversToTune(null, 'icy-active')}   shellDriversToTune({},'icy-active')=${JSON.stringify(shellDriversToTune({}, 'icy-active'))}`);

// ════ blast-radius: grainAngle + faultDensity byte-identical under the strongest tune ════
console.log('\n#### BLAST-RADIUS: grainAngle + faultDensity byte-identical under tune (icy-active, seed 7) ####');
{
  const base = build(7, 'icy-active', null);
  const driven = build(7, 'icy-active', { massGravity: 0.05, volatileFraction: 0.6, tidalHeating: 5000, condition: { T_eq: 320 } });
  let gaEq = true, fdEq = true, hEq = true;
  for (let i = 0; i < base.c.grainAngle.length; i++) { if (base.c.grainAngle[i] !== driven.c.grainAngle[i]) gaEq = false; if (base.c.faultDensity[i] !== driven.c.faultDensity[i]) fdEq = false; if (base.c.height[i] !== driven.c.height[i]) hEq = false; }
  console.log(`  grainAngle byte-identical: ${gaEq}   faultDensity byte-identical: ${fdEq}   (height changed: ${!hEq} <- must be true)`);
  console.log(`  tune applied: ${JSON.stringify(driven.tune, (k, v) => typeof v === 'number' ? +v.toFixed(5) : v)}`);
}

// ════ (b) PER-AXIS SWEEPS ════
const fmt = (x) => (typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(4)) : x);
function sweep(title, regime, seed, driversList, obsKey) {
  console.log(`\n#### ${title}  [${regime} seed ${seed}]  observable=${obsKey}  FLOOR=${fmt(FLOOR[regime][obsKey].floor)} ####`);
  let maxAbsU = 0, prev = null, monoUp = true, monoDown = true;
  const vals = [];
  for (const { label, drivers } of driversList) {
    const r = build(seed, regime, drivers);
    for (let i = 0; i < r.diag.U.length; i++) maxAbsU = Math.max(maxAbsU, Math.abs(r.diag.U[i]));
    const v = r.obs[obsKey];
    vals.push(v);
    if (prev !== null) { if (v < prev - 1e-9) monoUp = false; if (v > prev + 1e-9) monoDown = false; }
    prev = v;
    const t = r.tune;
    const tk = t ? `CREST=${fmt(t.CREST_THRESH)} CELL=${t.CELL_MIN} RIDGE=${fmt(t.RIDGE_AMP)} CHTHR=${fmt(t.CHAOS_THRESH)}` : 'null';
    console.log(`  ${label.padEnd(22)} ${obsKey}=${fmt(v)}   [${tk}]`);
  }
  const delta = Math.abs(vals[vals.length - 1] - vals[0]);
  const floor = FLOOR[regime][obsKey].floor;
  console.log(`  => range Δ=${fmt(delta)}  vs floor ${fmt(floor)}  ABOVE-FLOOR=${delta > floor}  monotone(up=${monoUp},down=${monoDown})  |U|max=${maxAbsU.toFixed(3)}<${SHELL_BOUND}=${maxAbsU < SHELL_BOUND}`);
  return { delta, floor, monoUp, monoDown };
}

// A1 gravity DOWN => bolder relief (std(U) up). Domain within the gFactor clamp [0.4,2.5] => g in [REF*0.16, REF*6.25].
sweep('A1 gravity → std(U) (gravity DOWN ⇒ relief UP)', 'icy-active', 7, [
  { label: 'g=2.5×REF (0.70)', drivers: { massGravity: 0.28 * 2.5 } },
  { label: 'g=REF (0.28)',      drivers: { massGravity: 0.28 } },
  { label: 'g=0.5×REF (0.14)',  drivers: { massGravity: 0.14 } },
  { label: 'g=0.25×REF(0.07)',  drivers: { massGravity: 0.07 } },
], 'stdU');

// A2 tidal UP => more cracks (lineamentNodeCount up). Sweep within clamp domain.
sweep('A2 tidal → lineamentNodeCount (tidal UP ⇒ cracks UP)', 'icy-active', 7, [
  { label: 'tidal=REF/100',   drivers: { tidalHeating: 136.745 / 100 } },
  { label: 'tidal=REF',        drivers: { tidalHeating: 136.745 } },
  { label: 'tidal=REF×100',    drivers: { tidalHeating: 136.745 * 100 } },
  { label: 'tidal=REF×10000',  drivers: { tidalHeating: 136.745 * 10000 } },
], 'linN');

// A2 on volatile-cold (Titan) — tidal UP from its tiny REF (the lab's feasible direction on Titan)
sweep('A2 tidal → lineamentNodeCount (Titan; tidal UP)', 'volatile-cold', 7, [
  { label: 'tidal=REF',       drivers: { tidalHeating: 1.582697265646129e-8 } },
  { label: 'tidal=0.01',       drivers: { tidalHeating: 0.01 } },
  { label: 'tidal=1.0',        drivers: { tidalHeating: 1.0 } },
  { label: 'tidal=100',        drivers: { tidalHeating: 100 } },
], 'linN');

// A3 vigor (volatileFraction, isolates CELL_MIN) => cellCount up. icy-active.
sweep('A3 vigor(vf) → cellCount (wetter ⇒ finer cells)', 'icy-active', 7, [
  { label: 'vf=0.1',  drivers: { volatileFraction: 0.1 } },
  { label: 'vf=REF(0.5)', drivers: { volatileFraction: 0.5 } },
  { label: 'vf=0.9',  drivers: { volatileFraction: 0.9 } },
  { label: 'vf=1.4',  drivers: { volatileFraction: 1.4 } },
], 'cellCount');

// A3 vigor via T_eq on volatile-cold (Titan) => cellCount up
sweep('A3 vigor(T_eq) → cellCount (Titan; warmer ⇒ finer cells)', 'volatile-cold', 7, [
  { label: 'T_eq=REF(94)', drivers: { condition: { T_eq: 94 } } },
  { label: 'T_eq=160',      drivers: { condition: { T_eq: 160 } } },
  { label: 'T_eq=230',      drivers: { condition: { T_eq: 230 } } },
], 'cellCount');

// A4 T_eq UP => more chaos area (icy-active).
sweep('A4 T_eq → chaos-area-fraction (warmer ⇒ more chaos)', 'icy-active', 7, [
  { label: 'T_eq=REF(110)', drivers: { condition: { T_eq: 110 } } },
  { label: 'T_eq=170',       drivers: { condition: { T_eq: 170 } } },
  { label: 'T_eq=230',       drivers: { condition: { T_eq: 230 } } },
  { label: 'T_eq=290',       drivers: { condition: { T_eq: 290 } } },
], 'chaosFrac');

// ════ AC-VARIETY proxy: low-g vs high-g at fixed seed exceeds the floor; seed-only stays within ════
console.log('\n#### AC-VARIETY: low-g vs high-g at fixed seed (icy-active) vs seed-only baseline ####');
for (const seed of [1, 7]) {
  const lo = build(seed, 'icy-active', { massGravity: 0.07 }).obs;   // low-g
  const hi = build(seed, 'icy-active', { massGravity: 0.70 }).obs;   // high-g
  console.log(`  seed ${seed}: Δstd(U)=${(Math.abs(hi.stdU - lo.stdU)).toFixed(4)} vs floor ${FLOOR['icy-active'].stdU.floor.toFixed(4)}  ->${Math.abs(hi.stdU - lo.stdU) > FLOOR['icy-active'].stdU.floor}`);
}

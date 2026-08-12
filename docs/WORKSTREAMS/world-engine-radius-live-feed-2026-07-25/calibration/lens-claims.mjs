// Verify the remaining lens claims against real source + real modules.
import { readFileSync } from 'node:fs';
import { DRIVER_PRESETS, drawPresetRadius } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveUniforms, radiusFromT, RADIUS_SLIDER_MIN, RADIUS_SLIDER_MAX } from '../../../../src/worldengine/base/labCore.js';
import { E5_REGIME, resolveParams, bakeClimateE5Attributes } from '../../../../src/worldengine/base/climate-e5.js';
import { drawGiantConditions, deriveGiantDrivers } from '../../../../src/worldengine/base/giant-drivers.js';
import { craterRelevanceOf, MESH_FLOOR_RAD, D_SFD_MIN_KM, C_ATMO_KM, P_ATMO_EXP,
         G_REF, K_GS, P_SURF_MAX } from '../../../../src/worldengine/base/bombardment.js';
import { KM_PER_EARTH_RADIUS } from '../../../../src/worldengine/base/baseStep.js';

const LAB = readFileSync(new URL('../../../../planet-lod-lab.html', import.meta.url), 'utf8');
const TIER = 1.0;

// ── [5] TAUTOLOGY: replicate the test's construction on deliberately BROKEN sources ──────────────
console.log('=== [5] is "BYTE-INERT AT CANONICAL" able to fail? ===');
const SRC = LAB.match(/state\.bandCount\s*=\s*(.+?);\s*$/m)[1].trim();
console.log('bandCount source under test:\n   ' + SRC);
const mk = (s) => new Function('env', `const { state, _fp, _gas, _rotH, _gcond, _scond } = env; return (${s});`);
const canonicalR = (p) => DRIVER_PRESETS[p].radiusEarth ?? 1;
const envFor = (p, R) => {
  const _fp = DRIVER_PRESETS[p];
  const u = deriveUniforms(_fp, TIER);
  const cond = deriveConditionVector(_fp, u, R);
  return { state: { planetRadiusEarth: R }, _fp, _gcond: cond, _scond: cond,
           _gas: _fp.atmosphere?.composition === 'h2-he', _rotH: _fp.rotationHours ?? 24 };
};
const CASES = [
  ['(1) the REAL source — baseline', SRC],
  ['(2) BROKEN: rotation divisor tripled', SRC.replace('/ _rotH', '/ (3*_rotH)')],
  ['(3) BROKEN: band ladder doubled', SRC.replace('12 *', '24 *')],
  ['(4) BROKEN: radius multiplied by ZERO (feed fully dead, hard-coded 5)', 'Math.min(16, Math.max(3, Math.round(5 + 0*(state.planetRadiusEarth ?? 1))))'],
  ['(5) BROKEN: +99 (clamps to 16 everywhere)', SRC.replace('Math.round(', 'Math.round(99 + ')],
];
for (const [label, src] of CASES) {
  const live = mk(src), frozen = mk(src.replace('state.planetRadiusEarth', '_fp.radiusEarth'));
  let pass = true;
  for (const p of Object.keys(DRIVER_PRESETS)) {
    const env = envFor(p, canonicalR(p));
    if (!Object.is(live(env), frozen(env))) pass = false;
  }
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`);
}

// ── [should-fix] the frozen massEarth co-driver: where does it diverge from the coherent mass? ────
console.log('\n=== massEarth co-driver: frozen vs coherent M_c*(R/R_c)^3, cloud-regime verdict ===');
const N = 4001, SWEEP = Array.from({ length: N }, (_, i) => radiusFromT(i / (N - 1)));
for (const p of Object.keys(DRIVER_PRESETS)) {
  const fp = DRIVER_PRESETS[p];
  const gas = fp.atmosphere?.composition === 'h2-he';
  if (!gas) continue;
  const Rc = fp.radiusEarth ?? 1, Mc = fp.massEarth ?? 1;
  let lo = null, hi = null, n = 0;
  for (const R of SWEEP) {
    const frozenV = gas && R < 6 && Mc < 10;
    const coherentV = gas && R < 6 && Mc * Math.pow(R / Rc, 3) < 10;
    if (frozenV !== coherentV) { n++; if (lo === null) lo = R; hi = R; }
  }
  console.log(`${p.padEnd(28)} Rc=${Rc} Mc=${Mc}  verdict differs on ${n}/${N} sampled radii` +
    (n ? `  band ~[${lo.toFixed(3)}, ${hi.toFixed(3)}] RE  (drawn range for this preset is reachable there: ${p.includes('Neptun') || p.includes('Sub-') ? '[2.5,4.0] YES' : 'n/a'})` : ''));
}

// ── [note] crater-boot floor: the true reachable floor of state.planetRadiusEarth ─────────────────
console.log('\n=== crater-boot bound vs the TRUE reachable radius floor ===');
const P_MAX_IMPACT = P_SURF_MAX - 0.1;
const D_LO_MAX = Math.max(D_SFD_MIN_KM, C_ATMO_KM * Math.pow(P_MAX_IMPACT, P_ATMO_EXP));
const L_MAX = D_LO_MAX * Math.pow(G_REF / 1e-6, K_GS);
const R_FLIP_MAX = L_MAX / (MESH_FLOOR_RAD * KM_PER_EARTH_RADIUS);
console.log(`R_FLIP_MAX = ${R_FLIP_MAX}`);
console.log(`vs RADIUS_SLIDER_MIN ${RADIUS_SLIDER_MIN}: headroom ${(RADIUS_SLIDER_MIN / R_FLIP_MAX).toFixed(3)}x`);
console.log(`vs LAB_UNLOCKED floor 0.27:              headroom ${(0.27 / R_FLIP_MAX).toFixed(3)}x`);
// how much of the Moon/Mercury draw band sits below the slider floor?
let below = 0;
for (let s = 0; s < 20000; s++) if (drawPresetRadius('Moon/Mercury (impact-airless)', s, { labUnlock: true }) < RADIUS_SLIDER_MIN) below++;
console.log(`Moon/Mercury draws below RADIUS_SLIDER_MIN: ${below}/20000 (${(100*below/20000).toFixed(1)}%)`);
// does craterRelevanceOf flip anywhere on [0.27, 16] for any preset?
const EXT = Array.from({ length: 501 }, (_, i) => 0.27 * Math.pow(16 / 0.27, i / 500));
const flippers = Object.keys(DRIVER_PRESETS).filter((p) => {
  const fp = DRIVER_PRESETS[p], u = deriveUniforms(fp, TIER);
  const vals = EXT.map((R) => craterRelevanceOf(deriveConditionVector(fp, u, R)));
  return new Set(vals).size > 1;
});
console.log(`presets whose craterRelevanceOf flips over [0.27, 16]: ${JSON.stringify(flippers)}`);

// ── [should-fix] COHERENCE claim: bandCount (linear R) vs Rhines m (sqrt R) ───────────────────────
console.log('\n=== COHERENCE: does rewiring BOTH ladders hold their ratio fixed? ===');
const P = 'Gas giant (Jovian)', SEED = 7;
const bandLadder = (R) => Math.min(16, Math.max(3, Math.round(12 * R / (DRIVER_PRESETS[P].rotationHours ?? 24))));
const mAt = (R, live) => {
  const env = envFor(P, R);
  const gd = deriveGiantDrivers(drawGiantConditions(E5_REGIME.GAS_GIANT, env._gcond, SEED));
  const drivers = { ...gd, rotationRate: 9.9 / (DRIVER_PRESETS[P].rotationHours ?? 24),
                    radius: (live ? R : (DRIVER_PRESETS[P].radiusEarth ?? 1)) / 11.2 };
  return resolveParams(E5_REGIME.GAS_GIANT, drivers, SEED).m;
};
console.log('   R      bandCount(live)  m(live)  ratio | bandCount(frozen) m(frozen) ratio');
for (const R of [0.3, 1, 2, 4, 8, 11.2, 16]) {
  const bl = bandLadder(R), ml = mAt(R, true);
  const bf = bandLadder(DRIVER_PRESETS[P].radiusEarth), mf = mAt(R, false);
  console.log(`  ${String(R).padStart(5)}  ${String(bl).padStart(8)}  ${String(ml).padStart(8)}  ${(bl/ml).toFixed(3).padStart(6)} | ${String(bf).padStart(8)} ${String(mf).padStart(8)} ${(bf/mf).toFixed(3).padStart(8)}`);
}

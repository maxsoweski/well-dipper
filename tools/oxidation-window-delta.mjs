// tools/oxidation-window-delta.mjs — the committed delta table for B2 leg 2 (the oxidation window).
//
// ⭐ WHAT THIS MEASURES. `surfaceMaterial.js`'s oxidiser gate `smoothstep(OX_VOL_LO, OX_VOL_HI, vf)`
// had its two edges re-derived from reference bodies on 2026-08-20 (0.03/0.12 -> 0.02/0.10). Those two
// constants are spent inside `surfaceAlbedoOf`, which BOTH front-ends reach through `surfacePaletteOf`
// (`PlanetGenerator.js:809` bakes `landPalette`, `rockySurface.js:272` derives the pack's palette), so a
// single edit moves both and they cannot disagree.
//
// ⛔ IT RESTATES NO LAW. The AFTER column calls the SHIPPED `surfacePaletteOf`. The BEFORE column calls a
// parameterised MIRROR of `surfaceAlbedoOf` pinned to the pre-leg pair, and the mirror's CONTROL — printed
// first, every run — is that at the SHIPPED constants it reproduces the shipped function bit-for-bit over
// all 18 driver presets and all four endmembers. If that control ever fails, every number below is void.
//
// ⛔ SOL IS NOT IN THE CORPUS AND CANNOT BE. The corpus is `lab-procedural-0…199`.
//
// Usage:  node tools/oxidation-window-delta.mjs
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';
import { DRIVER_PRESETS } from '../driver-presets.js';
import * as SM from '../src/worldengine/base/surfaceMaterial.js';

const CORPUS_N = 200;
// The pre-leg pair, pinned here as the thing corrected. Never read from the module — that is the point.
const PRE = { VOL_LO: 0.03, VOL_HI: 0.12, MAX: 0.60 };
const NOW = { VOL_LO: SM.OX_VOL_LO, VOL_HI: SM.OX_VOL_HI, MAX: SM.OX_MAX };

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ── the parameterised mirror (same order, same constants; only the three under test are arguments) ────
function albedoAt(cond, opts, K) {
  const altered = opts?.altered !== false, asFines = opts?.sediment === true, stable = opts?.stable === true;
  const iron = cond?.composition?.ironFraction ?? 0.3;
  const vf   = cond?.composition?.volatileFraction ?? 0;
  const co   = cond?.composition?.carbonToOxygen ?? 0;
  const T    = cond?.T_eq ?? 288;
  const age  = cond?.age ?? SM.AGE_OX_REF;
  const maturity = clamp01(age / SM.AGE_OX_REF);
  const erosion  = SM.erosionOf(cond);
  const airless  = SM.airlessnessOf(cond);
  let col = mix3(SM.FELSIC_ROCK, SM.MAFIC_ROCK, smoothstep(SM.IRON_FELSIC, SM.IRON_MAFIC, iron));
  const ox = !altered ? 0 : K.MAX * clamp01(
    smoothstep(SM.OX_FE_LO, SM.OX_FE_HI, iron) * smoothstep(K.VOL_LO, K.VOL_HI, vf) *
    (1 - SM.icenessOf(cond)) * smoothstep(SM.OX_T_LO, SM.OX_T_HI, T) *
    maturity * (stable ? 1 : (1 - erosion)));
  col = mix3(col, SM.OXIDE_RUST, ox);
  const w = !altered ? 0 : clamp01(airless * (1 - erosion) * (1 - SM.resurfacingRateOf(cond)) * maturity) * SM.SW_STRENGTH;
  col = [col[0] * (1 - w * SM.SW_TILT_R), col[1] * (1 - w * SM.SW_TILT_G), col[2] * (1 - w * SM.SW_TILT_B)];
  if (asFines) col = mix3(col, SM.SED_FINES, SM.SED_LIGHTEN);
  col = mix3(col, SM.CARBON_CRUST, smoothstep(1.0, 1.3, co));
  col = mix3(col, SM.MELT_GLASS, smoothstep(SM.T_MELT_LO, SM.T_MELT_HI, T));
  return [clamp01(col[0]), clamp01(col[1]), clamp01(col[2])];
}
const paletteAt = (c, K) => ({ fresh: albedoAt(c, { altered: false }, K), weathered: albedoAt(c, undefined, K),
                               craton: albedoAt(c, { stable: true }, K), sediment: albedoAt(c, { sediment: true }, K) });
const oxAt = (c, stable, K) => K.MAX * clamp01(
  smoothstep(SM.OX_FE_LO, SM.OX_FE_HI, c?.composition?.ironFraction ?? 0.3) *
  smoothstep(K.VOL_LO, K.VOL_HI, c?.composition?.volatileFraction ?? 0) *
  (1 - SM.icenessOf(c)) * smoothstep(SM.OX_T_LO, SM.OX_T_HI, c?.T_eq ?? 288) *
  clamp01((c?.age ?? SM.AGE_OX_REF) / SM.AGE_OX_REF) * (stable ? 1 : (1 - SM.erosionOf(c))));

// ── CONTROL ───────────────────────────────────────────────────────────────────────────────────────────
let bad = 0;
for (const [n, p] of Object.entries(DRIVER_PRESETS)) {
  const a = SM.surfacePaletteOf(p), b = paletteAt(p, NOW);
  for (const k of ['fresh', 'weathered', 'craton', 'sediment'])
    for (let i = 0; i < 3; i++) if (!Object.is(a[k][i], b[k][i])) { bad++; console.log('MIRROR MISMATCH', n, k, i); }
}
console.log(`CONTROL: mirror vs shipped surfacePaletteOf over ${Object.keys(DRIVER_PRESETS).length} presets x 4 endmembers — ${bad === 0 ? 'BIT-IDENTICAL' : bad + ' MISMATCHES (table below is VOID)'}`);
console.log(`BEFORE = [${PRE.VOL_LO}, ${PRE.VOL_HI}] x ${PRE.MAX}   AFTER (shipped) = [${NOW.VOL_LO}, ${NOW.VOL_HI}] x ${NOW.MAX}\n`);

// ── reference bodies ──────────────────────────────────────────────────────────────────────────────────
const hex = (c) => '#' + c.map((x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0')).join('');
const REF = ['Moon/Mercury (impact-airless)', 'Venus (sulfuric shroud)', 'Mars (arid rocky)',
             'Rocky (Earthlike)', 'Europa (icy moon)', 'Titan (methane seas)'];
console.log('── REFERENCE BODIES (driver-presets.js) ──');
console.log('preset'.padEnd(31), 'vf'.padStart(5), 'volGate>'.padStart(9), 'volGate<'.padStart(9),
            'ox_w>'.padStart(7), 'ox_w<'.padStart(7), 'ox_c>'.padStart(7), 'ox_c<'.padStart(7), ' weathered  craton');
for (const n of REF) {
  const p = DRIVER_PRESETS[n];
  const before = applyAlbedoTransfer(paletteAt(p, PRE)), after = applyAlbedoTransfer(SM.surfacePaletteOf(p));
  console.log(n.padEnd(31), String(p.composition.volatileFraction).padStart(5),
    smoothstep(PRE.VOL_LO, PRE.VOL_HI, p.composition.volatileFraction).toFixed(4).padStart(9),
    smoothstep(NOW.VOL_LO, NOW.VOL_HI, p.composition.volatileFraction).toFixed(4).padStart(9),
    oxAt(p, false, PRE).toFixed(4).padStart(7), oxAt(p, false, NOW).toFixed(4).padStart(7),
    oxAt(p, true, PRE).toFixed(4).padStart(7), oxAt(p, true, NOW).toFixed(4).padStart(7),
    ' ', hex(before.weathered) + '->' + hex(after.weathered), hex(before.craton) + '->' + hex(after.craton));
}

// ── corpus ────────────────────────────────────────────────────────────────────────────────────────────
const raw = [];
for (let i = 0; i < CORPUS_N; i++) {
  const sys = StarSystemGenerator.generate(`lab-procedural-${i}`, null);
  (sys.planets || []).forEach((e, pi) => {
    raw.push({ kind: 'planet', body: e.planetData });
    (e.moons || []).forEach((m) => raw.push(m.planetData ? { kind: 'planet-class', body: m.planetData } : { kind: 'plain-moon', body: m }));
  });
}
const all = raw.map((r) => ({ kind: r.kind, cond: conditionFromBody(r.body) }));
const gas = all.filter((r) => compositionClass(r.cond) === 'gas');
const rocky = all.filter((r) => compositionClass(r.cond) !== 'gas');
const kinds = rocky.reduce((m, r) => (m[r.kind] = (m[r.kind] || 0) + 1, m), {});
console.log(`\n── CORPUS lab-procedural-0…${CORPUS_N - 1}: ${all.length} bodies = ${rocky.length} NON-GAS (${kinds.planet} planets + ${kinds['plain-moon']} plain moons + ${kinds['planet-class']} planet-class) + ${gas.length} gas ──`);

const B = rocky.map((r) => applyAlbedoTransfer(paletteAt(r.cond, PRE), { extra: { pigment: SM.BIO_PIGMENT } }));
const A = rocky.map((r) => applyAlbedoTransfer(SM.surfacePaletteOf(r.cond), { extra: { pigment: SM.BIO_PIGMENT } }));
const maxch = (x, y) => Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
const LEVELS = 6, Q = 1 / LEVELS, DITHER = 0.4 / LEVELS;   // uniforms.js uLevels default; posterize edgeWidth 0.4

console.log(`\n── CHANGE FROM TODAY, display domain, against the uLevels ${LEVELS} quantum ${Q.toFixed(4)} ──`);
console.log('endmember'.padEnd(11), 'moved'.padStart(5), `>${DITHER.toFixed(4)}(dither)`.padStart(16), '>0.5q'.padStart(6), '>1q'.padStart(5), 'median'.padStart(8), 'p90'.padStart(8), 'max'.padStart(8));
for (const k of ['weathered', 'sediment', 'craton', 'fresh']) {
  const d = A.map((a, i) => maxch(a[k], B[i][k])).sort((x, y) => x - y);
  console.log(k.padEnd(11), String(d.filter((x) => x > 0).length).padStart(5),
    String(d.filter((x) => x > DITHER).length).padStart(16), String(d.filter((x) => x > Q / 2).length).padStart(6),
    String(d.filter((x) => x > Q).length).padStart(5), d[Math.floor(d.length / 2)].toFixed(4).padStart(8),
    d[Math.floor(d.length * 0.9)].toFixed(4).padStart(8), d[d.length - 1].toFixed(4).padStart(8));
}
const eq = (P) => P.filter((p) => p.craton[0] === p.weathered[0] && p.craton[1] === p.weathered[1] && p.craton[2] === p.weathered[2]).length;
const dist = (P, k) => new Set(P.map((p) => p[k].join(','))).size;
console.log(`\ncraton === weathered exactly : ${eq(B)} -> ${eq(A)} of ${rocky.length}`);
console.log(`distinct weathered colours   : ${dist(B, 'weathered')} -> ${dist(A, 'weathered')}`);
console.log(`distinct oxidation values    : ${new Set(rocky.map((r) => oxAt(r.cond, false, PRE))).size} -> ${new Set(rocky.map((r) => oxAt(r.cond, false, NOW))).size}`);
console.log(`oxidation exactly 0          : ${rocky.filter((r) => oxAt(r.cond, false, PRE) === 0).length} -> ${rocky.filter((r) => oxAt(r.cond, false, NOW) === 0).length}`);

console.log(`\n── BODY-PAIR SEPARATION, all C(${rocky.length},2) pairs, max-channel on \`weathered\` ──`);
function pairFrac(P, q) { const c = P.map((p) => p.weathered); let t = 0, g = 0;
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) { t++; if (maxch(c[i], c[j]) > q) g++; } return [g, t]; }
for (const L of [6, 8, 12, 16, 24]) {
  const [gb, t] = pairFrac(B, 1 / L), [ga] = pairFrac(A, 1 / L);
  console.log(`uLevels ${String(L).padStart(2)} (quantum ${(1 / L).toFixed(4)}) : pairs separated by > 1 quantum  ${(100 * gb / t).toFixed(2)}% -> ${(100 * ga / t).toFixed(2)}%   of ${t} pairs`);
}

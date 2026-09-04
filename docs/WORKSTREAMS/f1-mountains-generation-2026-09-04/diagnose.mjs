// READ-ONLY: why does the PLATE path claim 0 of 124 corpus solid bodies?
// Walks the exact dispatch chain in src/worldengine/dispatch/bodyRelief.js and records where each
// body falls out, then measures each term of the seeded band SEPARATELY so the binding one is named.
import { corpus } from '/home/ax/projects/well-dipper/tests/fixtures/ray-pack-corpus.mjs';
import { computeE1, inSeededBand, modalRegime } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';
import { isUnbrokenLidPath } from '/home/ax/projects/well-dipper/src/worldengine/base/lidResponse.js';
import { labPackCtx } from '/home/ax/projects/well-dipper/src/objects/Planet.js';
import { writeFileSync } from 'node:fs';

const BAND = { MASS_LO: 0.6, MASS_HI: 1.6, T_LO: 250, T_HI: 320, V_MIN: 0.12 };
const solid = corpus().filter((b) => b.cls !== 'gas');

const fell = {}; const rows = [];
let bandPass = 0, plateReached = 0;
const termPass = { mass: 0, T: 0, V: 0, all: 0 };
const massVals = [], tVals = [], vVals = [];

for (const b of solid) {
  const cond = b.cond;
  const macroSeed = labPackCtx(b.d, cond, null).macroSeed;
  const e1 = computeE1(cond, macroSeed);
  const cls = e1.compositionClass;
  const locked = !!cond.tidalState?.locked;
  const mass = (cond.surfaceGravity ?? 1) * Math.pow(cond.radiusEarth ?? 1, 2);   // e1Regime.js:237 massEarthOf — g·R² (the §4.2 named derivation; the vector carries no mass)
  const T = cond.T_eq ?? 288;
  const V = cond.composition?.volatileFraction ?? 0.15;
  massVals.push(mass); tVals.push(T); vVals.push(V);
  if (mass >= BAND.MASS_LO && mass <= BAND.MASS_HI) termPass.mass++;
  if (T >= BAND.T_LO && T <= BAND.T_HI) termPass.T++;
  if (V >= BAND.V_MIN) termPass.V++;
  const band = inSeededBand(cond);
  if (band) { termPass.all++; bandPass++; }

  let where, path;
  if (cls === 'gas' || cls === 'carbon') { where = '1 composition terminal (gas/carbon)'; path = 'despun'; }
  else if (cls === 'icy') { where = '2 icy'; path = e1.geodynamicRegime === 'icy' ? 'shell' : 'despun'; }
  else if (e1.m_hp > 0) { where = '3 heat-pipe (m_hp>0)'; path = 'unbrokenLid'; }
  else if (locked) { where = '4 tidally LOCKED -> shell(eyeball-despun)'; path = 'shell'; }
  else if (isUnbrokenLidPath(e1)) { where = '5 unbroken lid (hot stagnant, L>=0.63)'; path = 'unbrokenLid'; }
  else if (band) { const m = modalRegime(V, T); where = `6 IN BAND -> modal '${m}'`; path = m === 'stagnant' ? 'stagnant-lid' : 'PLATE'; }
  else if (e1.geodynamicRegime === 'mobile') { where = '7 regime mobile'; path = 'PLATE'; }
  else { where = `8 fallthrough (regime '${e1.geodynamicRegime}')`; path = 'despun'; }

  if (path === 'PLATE') plateReached++;
  fell[where] = (fell[where] || 0) + 1;
  rows.push({ id: b.id, cls, mass, T, V, locked, L: e1.L, regime: e1.geodynamicRegime, m_hp: e1.m_hp, band, where, path });
}

const pct = (n) => `${n}/${solid.length}`;
console.log(`corpus: ${solid.length} solid bodies\n`);
console.log('WHERE EACH BODY LEAVES THE DISPATCH CHAIN:');
for (const [k, v] of Object.entries(fell).sort((a, b) => b[1] - a[1])) console.log('  ', String(v).padStart(4), k);
console.log(`\nPLATE path reached by: ${plateReached} of ${solid.length}`);

console.log('\nTHE SEEDED BAND, TERM BY TERM (a body needs ALL FOUR):');
console.log(`   mass in [${BAND.MASS_LO}, ${BAND.MASS_HI}] M⊕   : ${pct(termPass.mass)}`);
console.log(`   T_eq in [${BAND.T_LO}, ${BAND.T_HI}] K        : ${pct(termPass.T)}`);
console.log(`   volatileFraction >= ${BAND.V_MIN}        : ${pct(termPass.V)}`);
console.log(`   ALL FOUR (inSeededBand)             : ${pct(termPass.all)}`);

const stat = (a, n) => { const s = a.slice().sort((x, y) => x - y); return `${n}: min ${s[0].toFixed(4)}  median ${s[Math.floor(s.length/2)].toFixed(4)}  max ${s[s.length-1].toFixed(4)}`; };
console.log('\nTHE THREE INPUTS, over the corpus:');
console.log('  ', stat(massVals, 'massEarth       '));
console.log('  ', stat(tVals, 'T_eq            '));
console.log('  ', stat(vVals, 'volatileFraction'));
console.log(`\n  bodies at or above MASS_LO ${BAND.MASS_LO}: ${massVals.filter((m) => m >= BAND.MASS_LO).length} of ${solid.length}`);
console.log(`  heaviest solid body: ${Math.max(...massVals).toFixed(4)} M⊕`);
console.log('\nregime distribution:', Object.entries(rows.reduce((a, r) => { a[r.regime] = (a[r.regime]||0)+1; return a; }, {})).map(([k,v])=>`${k} ${v}`).join(' · '));
writeFileSync(new URL('./diagnose.json', import.meta.url), JSON.stringify({ solid: solid.length, plateReached, fell, termPass, rows }, null, 1));

// ── PHASE 2: split the two blocks apart ──────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(78));
console.log('PHASE 2 — the two blocks, separated\n');
const planets = rows.filter((r) => r.id.includes('/planet/'));
const moons = rows.filter((r) => !r.id.includes('/planet/'));
console.log(`planets ${planets.length} · moons ${moons.length}`);
const byKind = (set, label) => {
  const f = {};
  for (const r of set) f[r.where] = (f[r.where] || 0) + 1;
  console.log(`\n  ${label}:`);
  for (const [k, v] of Object.entries(f).sort((a, b) => b[1] - a[1])) console.log('    ', String(v).padStart(3), k);
};
byKind(planets, 'PLANETS'); byKind(moons, 'MOONS');

console.log('\n── BLOCK A: the `locked` gate, which sits ABOVE the band test ──');
console.log(`  locked: ${rows.filter((r) => r.locked).length} of ${rows.length}  (planets ${planets.filter((r) => r.locked).length}/${planets.length}, moons ${moons.filter((r) => r.locked).length}/${moons.length})`);
const lockedButWouldBand = rows.filter((r) => r.locked && r.band);
console.log(`  locked AND would pass the band: ${lockedButWouldBand.length}`);
const lockedRocky = rows.filter((r) => r.locked && r.cls === 'rocky');
console.log(`  locked AND rocky: ${lockedRocky.length}`);

console.log('\n── BLOCK B: the seeded band, PAIRWISE (why the intersection is empty) ──');
const B = { MASS_LO: 0.6, MASS_HI: 1.6, T_LO: 250, T_HI: 320, V_MIN: 0.12 };
const okM = (r) => r.mass >= B.MASS_LO && r.mass <= B.MASS_HI;
const okT = (r) => r.T >= B.T_LO && r.T <= B.T_HI;
const okV = (r) => r.V >= B.V_MIN;
console.log(`  mass only        : ${rows.filter(okM).length}`);
console.log(`  T only           : ${rows.filter(okT).length}`);
console.log(`  V only           : ${rows.filter(okV).length}`);
console.log(`  mass AND T       : ${rows.filter((r) => okM(r) && okT(r)).length}`);
console.log(`  mass AND V       : ${rows.filter((r) => okM(r) && okV(r)).length}`);
console.log(`  T AND V          : ${rows.filter((r) => okT(r) && okV(r)).length}`);
console.log(`  ALL THREE        : ${rows.filter((r) => okM(r) && okT(r) && okV(r)).length}`);
const mt = rows.filter((r) => okM(r) && okT(r));
if (mt.length) {
  console.log('\n  bodies passing mass AND T — their volatiles (the term that then kills them):');
  for (const r of mt.slice(0, 12)) console.log(`     ${r.id.padEnd(26)} M ${r.mass.toFixed(3)}  T ${r.T.toFixed(1)}  V ${r.V.toFixed(4)}  ${r.V >= B.V_MIN ? 'PASS' : `< ${B.V_MIN}`}  locked=${r.locked}`);
}

console.log('\n── THE ONE MOBILE BODY (regime === "mobile" would reach plate() at step 7) ──');
for (const r of rows.filter((r) => r.regime === 'mobile')) {
  console.log(`  ${r.id}  cls=${r.cls} mass=${r.mass.toFixed(3)} T=${r.T.toFixed(1)} V=${r.V.toFixed(4)} L=${r.L.toFixed(3)} locked=${r.locked}`);
  console.log(`     -> left the chain at: ${r.where}   (path ${r.path})`);
}

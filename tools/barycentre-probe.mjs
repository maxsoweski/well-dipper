#!/usr/bin/env node
/**
 * barycentre-probe — the read-only measurement behind
 * docs/WORKSTREAMS/binary-barycentre-render-2026-08-18/.
 *
 * ⭐ WHY THIS IS A COMMITTED TOOL. The scoping doc's own probe was "archived at
 * `scratchpad/probe-binary-criteria.mjs`" and was gone within a day, so the
 * 13-of-713 figure it produced could not be re-derived — a discovery pass in
 * this lane flagged exactly that. Every number `intent.md` cites is re-derived
 * here, on demand, from the shipped generators.
 *
 * WHAT IT ANSWERS
 *   1. BLAST RADIUS — how many moon/parent pairs get a visible barycentre
 *      offset r1/R_p, split companion vs pre-existing. Feeds intent.md.
 *   2. RING BUDGET — per-planet dominance share vs moon count. The render rule
 *      gives a planet ONE extra (barycentric) ring when a single moon accounts
 *      for >= DOMINANCE of its excursion; this reports the worst-case ring
 *      count so `CONIC_MAX` (OrbitConicField.js:51 = 64) can be shown to be
 *      out of reach rather than assumed to be.
 *   3. SOL — the one system Max knows by eye, and the one with NO massEarth
 *      anywhere (`grep -c massEarth src/generation/SolarSystemData.js` = 0).
 *      Reports what each Sol planet's excursion would be, and what happens
 *      WITHOUT the estimateMassEarth fallback (answer: NaN).
 *   4. MASS RULE — the shipped rule vs the one scoping §6 item 4 proposed but
 *      never landed, so the divergence is a measured number, not an argument.
 *
 * ⛔ Scene units throughout. That is what the renderer draws, and r1/R_p is
 * only meaningful against radiusScene.
 *
 * USAGE   node tools/barycentre-probe.mjs [--dominance=0.99] [--json=out.json]
 * EXITS   0 always — this measures, it does not judge.
 */

import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { generateSolarSystem } from '../src/generation/SolarSystemData.js';
import { MoonGenerator } from '../src/generation/MoonGenerator.js';
import { estimateMassEarth } from '../src/generation/PhysicsEngine.js';

const argv = process.argv.slice(2);
const arg = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const DOMINANCE = parseFloat(arg('dominance', '0.99'));
const JSON_OUT = arg('json', null);

// ── the mass rule ────────────────────────────────────────────────────────────
// Transcribed from GravityField._estimateMoonMass (src/physics/GravityField.js:179-189)
// and GravityField.js:122. The renderer MUST use this exact rule, or render and
// physics disagree about where the barycentre is.
const moonMassEarth = (m) => {
  if (m.planetData?.massEarth != null) return m.planetData.massEarth;
  const r = m.radiusEarth ?? 0.01;
  if (m.type === 'terrestrial') return estimateMassEarth(r, 'rocky');
  return Math.pow(r, 2.5) * 0.5;
};
// ⚠ The fallback is NOT optional: Sol carries no massEarth at all.
const planetMassEarth = (pd) => pd.massEarth ?? estimateMassEarth(pd.radiusEarth, pd.type);
// The rule scoping §6 item 4 proposed and never landed — plain moons DO carry a
// generator-computed mass (MoonGenerator.js:266) that the shipped rule ignores.
const moonMassProposed = (m) => m.planetData?.massEarth ?? m.massEarth ?? moonMassEarth(m);

/** Per-planet barycentre geometry, in scene units. */
function analyse(entry, massOf = moonMassEarth) {
  const ms = entry.moons || [];
  const pd = entry.planetData;
  const Mp = planetMassEarth(pd);
  const Rp = pd.radiusScene;
  const Mtot = Mp + ms.reduce((s, m) => s + massOf(m), 0);
  // |contribution| of moon i to the primary's excursion: (m_i / M_total) * a_i
  const contrib = ms.map((m) => massOf(m) * (m.orbitRadiusScene ?? 0) / Mtot);
  const sum = contrib.reduce((a, b) => a + b, 0);
  const top = contrib.length ? Math.max(...contrib) : 0;
  return {
    n: ms.length, Rp, Mp, Mtot, contrib, sum,
    sumOverRp: Rp > 0 ? sum / Rp : 0,
    share: sum > 0 ? top / sum : 1,
    perMoon: ms.map((m, i) => ({ r1OverRp: Rp > 0 ? contrib[i] / Rp : 0, q: massOf(m) / Mp, isPM: !!m.isPlanetMoon })),
  };
}

/** FENCE-221 — tests/body-identity-fence.test.js:93-136, :442-444. */
function fence221() {
  const map = new GalacticMap('body-identity-fence');
  const bulk = Array.from({ length: 192 }, (_, i) => [`wd-${i}`, null]);
  const pinned = ['wd-356', 'wd-395', 'wd-614', 'wd-2232', 'wd-1403'].map((s) => [s, null]);
  const gc = Array.from({ length: 24 }, (_, i) => {
    const R = 0.4 + i * 0.75, th = i * 2.399963229728653, sign = i % 6 < 3 ? 1 : -1;
    return [`gc-${i}`, map.deriveGalaxyContext({ x: R * Math.cos(th), y: R * Math.sin(th), z: i % 3 === 0 ? 0 : i % 3 === 1 ? 0.15 * sign : 1.4 * sign })];
  });
  return [...bulk, ...pinned, ...gc];
}

const out = { dominance: DOMINANCE };
const pairs = [], planetsOut = [];

for (const [seed, ctx] of fence221()) {
  const sys = StarSystemGenerator.generate(seed, ctx);
  (sys.planets || []).forEach((entry, pi) => {
    const a = analyse(entry);
    if (!a.n) return;
    planetsOut.push({ seed, pi, ...a, type: entry.planetData.type });
    const ms = entry.moons;
    a.perMoon.forEach((pm, mi) => {
      // companion signature: last moon, planet-class, q inside the channel's band
      const isComp = mi === ms.length - 1 && !!ms[mi].isPlanetMoon
        && pm.q >= MoonGenerator.BINARY_Q_MIN - 1e-9 && pm.q <= MoonGenerator.BINARY_Q_MAX + 1e-9;
      pairs.push({ seed, pi, mi, ...pm, isComp });
    });
  });
}

// ── 1. blast radius ──────────────────────────────────────────────────────────
console.log(`\n=== 1. BLAST RADIUS — FENCE-221, ${planetsOut.length} moon-bearing planets, ${pairs.length} pairs ===`);
console.log('  r1/R_p >=      companions   other pairs   |   planets (summed)');
for (const t of [0.1, 0.25, 0.5, 1, 2, 5]) {
  const c = pairs.filter((p) => p.isComp && p.r1OverRp >= t).length;
  const o = pairs.filter((p) => !p.isComp && p.r1OverRp >= t).length;
  const pl = planetsOut.filter((p) => p.sumOverRp >= t).length;
  console.log(`  ${String(t).padStart(6)}       ${String(c).padStart(10)}   ${String(o).padStart(11)}   |   ${String(pl).padStart(7)} in ${new Set(planetsOut.filter((p) => p.sumOverRp >= t).map((p) => p.seed)).size} systems`);
}

// ── 2. ring budget ───────────────────────────────────────────────────────────
const dominated = planetsOut.filter((p) => p.share >= DOMINANCE);
const worstRings = Math.max(...planetsOut.map((p) => p.n + (p.share >= DOMINANCE ? 1 : 0)));
console.log(`\n=== 2. RING BUDGET — dominance >= ${DOMINANCE} earns one extra barycentric ring ===`);
console.log(`  dominated planets: ${dominated.length} / ${planetsOut.length}`);
console.log(`  max moons on ONE planet: ${Math.max(...planetsOut.map((p) => p.n))}`);
console.log(`  max moons on a DOMINATED planet: ${Math.max(...dominated.map((p) => p.n))}`);
console.log(`  worst-case rings for one planet (moons + extra): ${worstRings}`);
const byType = {};
for (const p of dominated) byType[p.type] = (byType[p.type] || 0) + 1;
console.log(`  dominated by planet type: ${JSON.stringify(byType)}`);
const bigDom = dominated.filter((p) => p.n >= 5).sort((a, b) => b.n - a.n).slice(0, 5);
console.log(`  dominated planets with >= 5 moons: ${dominated.filter((p) => p.n >= 5).length}`);
bigDom.forEach((p) => console.log(`    ${p.seed}/${p.pi} ${p.type} n=${p.n} share=${p.share.toFixed(4)} sum/Rp=${p.sumOverRp.toFixed(2)}`));

// ── 3. Sol ───────────────────────────────────────────────────────────────────
console.log(`\n=== 3. SOL — the system Max knows by eye ===`);
const sol = generateSolarSystem();
let solNaN = 0;
(sol.planets || []).forEach((entry, pi) => {
  const ms = entry.moons || [];
  if (!ms.length) return;
  const a = analyse(entry);
  const noFallback = (entry.planetData.massEarth ?? NaN);
  if (Number.isNaN(noFallback)) solNaN++;
  const name = entry.planetData.profileId || entry.planetData._canonicalName || `planet ${pi}`;
  console.log(`  ${String(name).padEnd(14)} n=${String(a.n).padStart(2)}  excursion ${a.sumOverRp.toFixed(3)} R_p   share ${a.share.toFixed(3)}   ${a.share >= DOMINANCE ? '[bary rings]' : ''}`);
});
console.log(`  ⛔ Sol planets whose planetData.massEarth is absent (would be NaN without the estimateMassEarth fallback): ${solNaN}`);

// ── 4. mass-rule divergence ──────────────────────────────────────────────────
console.log(`\n=== 4. MASS RULE — shipped _estimateMoonMass vs scoping §6 item 4's unlanded fix ===`);
let moved = 0, worst = null;
for (const [seed, ctx] of fence221()) {
  const sys = StarSystemGenerator.generate(seed, ctx);
  (sys.planets || []).forEach((entry, pi) => {
    if (!(entry.moons || []).length) return;
    const A = analyse(entry, moonMassEarth), B = analyse(entry, moonMassProposed);
    const d = Math.abs(A.sumOverRp - B.sumOverRp);
    if (d > 1e-9) moved++;
    if (!worst || d > worst.d) worst = { seed, pi, d, a: A.sumOverRp, b: B.sumOverRp };
  });
}
console.log(`  planets whose excursion changes at all: ${moved}`);
console.log(`  worst: ${worst.seed}/${worst.pi}  shipped ${worst.a.toFixed(4)} R_p -> proposed ${worst.b.toFixed(4)} R_p  (delta ${worst.d.toFixed(4)})`);
console.log(`  ⭐ The renderer must match the SHIPPED rule, or render and physics disagree about the barycentre.\n`);

if (JSON_OUT) {
  const fs = await import('node:fs');
  fs.writeFileSync(JSON_OUT, JSON.stringify({ ...out, pairs, planets: planetsOut }, null, 2));
  console.log(`wrote ${JSON_OUT}`);
}

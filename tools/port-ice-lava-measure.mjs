// tools/port-ice-lava-measure.mjs — measure the LAW ACROSS THE POPULATION before wiring port slice 2.
//
// Port slice 1 wired rocky + terrestrial LAND colour to the condition-derived palette. Slice 2 is the
// ice and lava paths, which still fall through to the legacy `mix(baseColor, accentColor)` branch in
// ROCKY_BODY. Before wiring either, this answers the two questions that decide whether the wiring is
// honest:
//
//   ICE  — does `icenessOf(cond)` actually OPEN on game bodies of type 'ice', and does it VARY?
//          (It was totally broken until the kg/m^3 -> g/cc fix at the seam, so this has never been
//          measured on real game bodies.) If it is pinned at 1.0 everywhere, a derived ice mix is a
//          constant and the port buys nothing over a hard-coded ice colour.
//   LAVA — does a game 'lava' body ever reach the surfaceMaterial MELT window (T_MELT_LO 900 K ->
//          T_MELT_HI 1400 K)? If not, the palette's melt-glass stage never engages and a lava world's
//          derived bedrock is just ordinary rock, which would be a silent lie.
//
// ⚠ METHOD (the lesson blocker C cost): sweep ORBIT *and* METALLICITY. A spread measured at fixed
// parameters is NOT the population's spread — that error produced a withdrawn blocker last session.
//
// Run: node tools/port-ice-lava-measure.mjs
import { PlanetGenerator } from '../src/generation/PlanetGenerator.js';
import { conditionFromPlanet } from '../src/worldengine/port/conditionFromPlanet.js';
import { surfacePaletteOf, icenessOf, T_MELT_LO, T_MELT_HI } from '../src/worldengine/base/surfaceMaterial.js';
import { applyAlbedoTransfer } from '../src/worldengine/display/albedoTransfer.js';
import { SeededRandom } from '../src/generation/SeededRandom.js';

const hex = (c) => '#' + c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('');
const ORBITS = [0.05, 0.1, 0.2, 0.4, 0.6, 1.0, 1.6, 2.5, 4.0, 6.0, 9.0];
const METALS = [-0.5, -0.25, 0.0, 0.15, 0.3, 0.5];

function population(type) {
  const rows = [];
  for (const au of ORBITS) {
    for (const met of METALS) {
      const rng = new SeededRandom(`${type}:${au}:${met}`);
      const zones = { metallicity: met, frostLine: 4.85 };
      let p;
      try { p = PlanetGenerator.generate(rng, au, null, zones, type); } catch (e) { continue; }
      const cond = conditionFromPlanet(p);
      rows.push({ au, met, p, cond, pal: applyAlbedoTransfer(surfacePaletteOf(cond)) });
    }
  }
  return rows;
}

const span = (rows, f) => {
  const v = rows.map(f).filter((x) => Number.isFinite(x));
  return v.length ? [Math.min(...v), Math.max(...v)] : [NaN, NaN];
};
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '  -  ');

for (const type of ['ice', 'lava', 'rocky', 'ocean', 'terrestrial']) {
  const rows = population(type);
  if (!rows.length) { console.log(`\n### ${type}: NO BODIES GENERATED`); continue; }
  const ice = span(rows, (r) => icenessOf(r.cond));
  const Ts = span(rows, (r) => r.cond?.T_eq ?? NaN);          // engine SURFACE temp
  const Tg = span(rows, (r) => r.p?.T_eq ?? NaN);             // game equilibrium temp
  const dens = span(rows, (r) => r.cond?.composition?.density ?? NaN);
  const vf = span(rows, (r) => r.cond?.composition?.volatileFraction ?? NaN);
  // NB: read the CONDITION's atmosphere, not the game planet's — the game nests physics one level
  // down and reading the wrapper is exactly the bug atmosphereFromPlanet was added to close.
  const P = span(rows, (r) => r.cond?.atmosphere?.pressure ?? 0);
  const melt = rows.filter((r) => (r.cond?.T_eq ?? 0) >= T_MELT_LO).length;
  const hot = rows.filter((r) => (r.cond?.T_eq ?? 0) >= T_MELT_HI).length;
  const distinct = new Set(rows.map((r) => hex(r.pal.weathered))).size;
  // How often does the palette actually give the shader THREE separable colours? The game binds
  // fresh/weathered/sediment; if erosion collapses fresh onto weathered, the elevation zones lose a band.
  const collapsed = rows.filter((r) => hex(r.pal.fresh) === hex(r.pal.weathered)).length;
  const icy = rows.filter((r) => icenessOf(r.cond) > 0.5).length;

  console.log(`\n### ${type}  (n=${rows.length})`);
  console.log(`  T_eq game    ${f2(Tg[0])} .. ${f2(Tg[1])} K`);
  console.log(`  T_surf engine ${f2(Ts[0])} .. ${f2(Ts[1])} K   pressure ${f2(P[0])} .. ${f2(P[1])} bar`);
  console.log(`  density g/cc ${f2(dens[0])} .. ${f2(dens[1])}   volatileFraction ${f2(vf[0])} .. ${f2(vf[1])}`);
  console.log(`  ICENESS      ${f2(ice[0])} .. ${f2(ice[1])}   (${icy}/${rows.length} bodies read icy, >0.5)`);
  console.log(`  fresh==weathered (band collapse): ${collapsed}/${rows.length}`);
  console.log(`  MELT WINDOW  ${melt}/${rows.length} bodies >= ${T_MELT_LO} K,  ${hot}/${rows.length} >= ${T_MELT_HI} K (full melt glass)`);
  console.log(`  distinct derived weathered colours: ${distinct}/${rows.length}`);
  // A few sample rows so the numbers are inspectable, not just summarised.
  for (const r of [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]) {
    console.log(`    au ${String(r.au).padStart(4)} [Fe/H] ${String(r.met).padStart(5)}  T_surf ${(r.cond.T_eq).toFixed(0).padStart(4)}K` +
      `  ice ${icenessOf(r.cond).toFixed(3)}  legacy ${hex(r.p.baseColor)}/${hex(r.p.accentColor)}` +
      `  derived w${hex(r.pal.weathered)} f${hex(r.pal.fresh)} s${hex(r.pal.sediment)}`);
  }
}

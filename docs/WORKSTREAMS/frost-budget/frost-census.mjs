// frost-census.mjs — the BEFORE/AFTER instrument for the snow budget (arc 2).
//
// It reads the ENGINE's own frost law through `deriveUniforms`, so it cannot drift from the code it
// audits. It also reproduces the SHADER's snowline test in JS — the shader is where the temperature
// decision actually happens today, and a budget number alone says nothing about coverage.
//
//   node docs/WORKSTREAMS/frost-budget/frost-census.mjs
//   NSEEDS=500 node docs/WORKSTREAMS/frost-budget/frost-census.mjs
import { StarSystemGenerator } from '../../../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../../../src/worldengine/port/conditionFromBody.js';
import { compositionClass } from '../../../src/worldengine/base/e1Regime.js';
import { deriveUniforms } from '../../../src/worldengine/base/labCore.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── The shader's own snowline, transcribed (height.glsl.js:3168-3178, frostCoverage) ──
// coldFactor = mix(sin²lat, 1, latBias*0.6);  localT = Teq*(1 - chill*coldFactor) - h*lapse*Teq
// frost where localT < condensationT. At sea level (h=0) this inverts to a latitude.
// Returns the fraction of the SPHERE's area poleward of the snowline (2*(1-sin(lat))/2 per cap → 1-sin).
function snowlineFraction(Teq, condT, latBias, chill) {
  if (!(condT > 0) || !(Teq > 0)) return 0;
  // solve Teq*(1 - chill*coldFactor) = condT  →  coldFactor* = (1 - condT/Teq)/chill
  const cfStar = (1 - condT / Teq) / chill;
  if (cfStar <= 0) return 1;          // even the equator is below freezing → whole sphere
  const b = latBias * 0.6;
  if (cfStar >= 1) return 0;          // even the pole is above freezing → nothing
  // coldFactor = b + (1-b)*sin²lat  →  sin²lat* = (cfStar - b)/(1-b)
  const s2 = (cfStar - b) / (1 - b);
  if (s2 <= 0) return 1;
  if (s2 >= 1) return 0;
  return 1 - Math.sqrt(s2);           // area fraction of the two caps combined
}

// ⛔ NOT hard-coded: uniforms.js builds its defaults inside makeUniforms(THREE), which cannot be
// imported headlessly, so the knob is READ OUT OF THE SOURCE. If the declaration ever moves, this
// throws rather than silently censusing a stale number.
const UNIFORMS_SRC = readFileSync(fileURLToPath(new URL('../../../src/worldengine/shaders/uniforms.js', import.meta.url)), 'utf8');
const knob = (name) => {
  const m = UNIFORMS_SRC.match(new RegExp(name + '\\s*:\\s*\\{\\s*value:\\s*([0-9.]+)'));
  if (!m) throw new Error(`census cannot find ${name} in shaders/uniforms.js — the law moved, fix the census`);
  return Number(m[1]);
};
const CHILL = knob('uFrostLatChill');
const LAPSE = knob('uFrostLapseRate');

const N = Number(process.env.NSEEDS || 200);
const rows = [];
for (let i = 0; i < N; i++) {
  for (const e of StarSystemGenerator.generate(`rocky-${i}`, null).planets) {
    const d = e.planetData || e;
    const c = conditionFromBody(d);
    if (compositionClass(c) === 'gas') continue;
    const u = deriveUniforms(c);
    const T = c.T_eq ?? 288;
    const budget = u.frostMaxCoverage ?? 0;
    const condT = u.frostCondensationT ?? 0;
    const latBias = u.frostLatitudeBias ?? 0;
    const geom = snowlineFraction(T, condT, latBias, CHILL);
    rows.push({
      seed: `rocky-${i}`, name: d.name,
      T, V: c.composition?.volatileFraction ?? 0,
      budget, condT, latBias,
      geom,                       // fraction of sphere below the snowline at SEA LEVEL
      painted: budget * geom,     // what the shader actually lays down (coverage × budget)
    });
  }
}

const pct = (x) => (100 * x).toFixed(1) + '%';
const band = (lo, hi) => rows.filter(r => r.T >= lo && r.T < hi);
console.log(`\nFROST CENSUS — ${rows.length} solid bodies over ${N} seeds  (uFrostLatChill=${CHILL})\n`);
console.log('T_eq band        n     mean budget   mean sea-level snow   worlds >30% snow');
for (const [lo, hi, label] of [[0,150,'  <150 K'],[150,220,'150–220 K'],[220,273,'220–273 K'],[273,320,'273–320 K'],[320,500,'320–500 K'],[500,5000,'  >500 K']]) {
  const b = band(lo, hi); if (!b.length) { console.log(`${label}  ${String(b.length).padStart(5)}       —`); continue; }
  const mb = b.reduce((s,r)=>s+r.budget,0)/b.length;
  const mp = b.reduce((s,r)=>s+r.painted,0)/b.length;
  const over = b.filter(r=>r.painted>0.30).length;
  console.log(`${label}  ${String(b.length).padStart(5)}      ${mb.toFixed(3)}          ${pct(mp).padStart(6)}            ${over} / ${b.length}`);
}

// ⭐ THE HEADLINE NUMBER: worlds WARMER than Earth's T_eq (255 K) that carry MORE snow than Earth (~10%).
const EARTH_TEQ = 255, EARTH_SNOW = 0.10;
const wrong = rows.filter(r => r.T > EARTH_TEQ && r.painted > EARTH_SNOW);
console.log(`\n⭐ WARMER THAN EARTH (T_eq > ${EARTH_TEQ} K) YET SNOWIER THAN EARTH (>${pct(EARTH_SNOW)}): ${wrong.length} of ${rows.filter(r=>r.T>EARTH_TEQ).length} such worlds`);
console.log(`   worst 10:`);
for (const r of wrong.sort((a,b)=>b.painted-a.painted).slice(0,10))
  console.log(`     ${r.seed.padEnd(11)} ${String(r.name||'').padEnd(22)} T_eq ${r.T.toFixed(0).padStart(4)} K  V ${r.V.toFixed(3)}  budget ${r.budget.toFixed(3)}  snow ${pct(r.painted)}`);

// The other direction: does the budget discriminate temperature AT ALL today?
const hot = rows.filter(r => r.T > 500), cold = rows.filter(r => r.T < 200);
const mean = (a,f)=>a.length? a.reduce((s,r)=>s+f(r),0)/a.length : NaN;
console.log(`\n⭐ DOES THE BUDGET READ TEMPERATURE? mean budget  hot(>500K) ${mean(hot,r=>r.budget).toFixed(3)}  vs  cold(<200K) ${mean(cold,r=>r.budget).toFixed(3)}`);
console.log(`   (identical means the budget is temperature-BLIND — the shader is the only thing saving hot worlds)\n`);

// The anchor body from the handoff.
const anchor = rows.find(r => r.seed === 'rocky-126' && r.T > 285 && r.T < 300);
if (anchor) console.log(`ANCHOR rocky-126: ${anchor.name}  T_eq ${anchor.T.toFixed(1)} K  V ${anchor.V.toFixed(3)}  budget ${anchor.budget.toFixed(3)}  condT ${anchor.condT}  sea-level snow ${pct(anchor.geom)}  painted ${pct(anchor.painted)}\n`);

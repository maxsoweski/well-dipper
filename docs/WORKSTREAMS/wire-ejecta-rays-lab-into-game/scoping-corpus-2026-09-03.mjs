// F3 scoping corpus — the 24 rocky-* seeds, planets + moons (planet-class moons read through the
// inner record with the mount's stamps, per tests/river-bake-host.test.js:210-224). Read-only.
import { StarSystemGenerator } from '/home/ax/projects/well-dipper/src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '/home/ax/projects/well-dipper/src/worldengine/port/conditionFromBody.js';
import { fluvialClassOf } from '/home/ax/projects/well-dipper/src/worldengine/drivers/fluvialDeck.js';
import { airlessnessOf, erosionOf } from '/home/ax/projects/well-dipper/src/worldengine/base/surfaceMaterial.js';
import { deriveUniforms } from '/home/ax/projects/well-dipper/src/worldengine/base/labCore.js';
import { compositionClass } from '/home/ax/projects/well-dipper/src/worldengine/base/e1Regime.js';
import { writeFileSync } from 'node:fs';

const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const rows = [];
for (const seed of SEEDS) {
  const sys = StarSystemGenerator.generate(seed, null);
  sys.planets.forEach((e, pi) => {
    const push = (kind, d, m, mi) => {
      let cond; try { cond = conditionFromBody(d); } catch (err) { rows.push({ seed, kind, p: pi, m: mi, err: String(err) }); return; }
      const cls = compositionClass(cond);
      if (cls === 'gas') { rows.push({ seed, kind, p: pi, m: mi, cls, skip: 'gas' }); return; }
      const hasAtmo = !!cond.atmosphere;
      const sh = cond.surfaceHistory || {};
      const erosion = sh.erosion ?? sh.erosionLevel ?? 0;
      const rayLaw = clamp01(1 - erosion) * (hasAtmo ? 0 : 1);
      let rayDerived = null; try { rayDerived = deriveUniforms(cond).rayBrightness ?? null; } catch (err) { rayDerived = 'ERR ' + String(err).slice(0, 80); }
      let fluv = null; try { fluv = fluvialClassOf(cond); } catch (err) { fluv = 'ERR'; }
      rows.push({ seed, kind, p: pi, m: mi, cls, type: d.type ?? null, radiusEarth: cond.radiusEarth ?? d.radiusEarth ?? null,
        ageGyr: cond.age ?? d.age ?? null, T_eq: cond.T_eq ?? null,
        atmoNull: !hasAtmo, atmoProv: cond._provenance?.atmosphere ?? null, pressure: cond.atmosphere?.pressure ?? null,
        rawAtmo: d.atmosphere == null ? 'null' : (d.atmosphere.physics ? 'physics' : 'visual-only'),
        fluvial: typeof fluv === 'object' && fluv ? (fluv.klass ?? fluv.class ?? JSON.stringify(fluv).slice(0, 40)) : fluv,
        erosion, erosionSpelling: sh.erosion != null ? 'erosion' : (sh.erosionLevel != null ? 'erosionLevel' : 'none'),
        airlessnessOf: airlessnessOf(cond), erosionOf: erosionOf(cond), rayLaw, rayDerived });
    };
    push('planet', e.planetData || e, null, null);
    (e.moons || []).forEach((m, mi) => push(m.isPlanetMoon ? 'planet-moon' : 'moon',
      m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m, m, mi));
  });
}
const solid = rows.filter(r => !r.skip && !r.err);
const by = (f) => solid.reduce((a, r) => { const k = f(r); a[k] = (a[k] || 0) + 1; return a; }, {});
const summary = {
  total: rows.length, gas: rows.filter(r => r.skip).length, errors: rows.filter(r => r.err).length, solid: solid.length,
  byKind: by(r => r.kind), atmoNullByKind: by(r => `${r.kind}:${r.atmoNull ? 'airless' : 'air'}`),
  rawAtmoByKind: by(r => `${r.kind}:${r.rawAtmo}`), fluvialByKind: by(r => `${r.kind}:${r.fluvial}`),
  rayLawPositive: solid.filter(r => r.rayLaw > 0).length, rayDerivedPositive: solid.filter(r => typeof r.rayDerived === 'number' && r.rayDerived > 0).length,
  lawVsDerivedMismatch: solid.filter(r => typeof r.rayDerived === 'number' && Math.abs(r.rayDerived - r.rayLaw) > 1e-9).length,
  airlessnessPositive: solid.filter(r => r.airlessnessOf > 0).length,
  airlessTerrestrialMoons: solid.filter(r => r.atmoNull && r.rawAtmo === 'visual-only').length,
  rayOnAirless: (() => { const a = solid.filter(r => r.atmoNull).map(r => r.rayLaw).sort((x, y) => x - y); return a.length ? { n: a.length, min: a[0], p25: a[Math.floor(a.length * .25)], median: a[Math.floor(a.length / 2)], max: a[a.length - 1], zeros: a.filter(v => v === 0).length } : null; })(),
  erosionSpellingByKind: by(r => `${r.kind}:${r.erosionSpelling}`),
  minPlanetPressure: Math.min(...solid.filter(r => r.kind !== 'moon' && r.pressure != null).map(r => r.pressure)),
  atmoProvByKind: by(r => `${r.kind}:${r.atmoProv}`),
};
const out = '/tmp/claude-1000/-home-ax/2512145e-c9d5-478a-9ae7-5fdcce59aadd/scratchpad/f3-corpus.json';
writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log('examples (airless, ray>0.9):', solid.filter(r => r.atmoNull && r.rayLaw > 0.9).slice(0, 5).map(r => `${r.seed} p${r.p}m${r.m} ${r.type} R${(r.radiusEarth ?? 0).toFixed(3)} ray${r.rayLaw.toFixed(2)}`).join(' | '));

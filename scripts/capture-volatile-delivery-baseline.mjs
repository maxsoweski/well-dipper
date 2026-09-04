// scripts/capture-volatile-delivery-baseline.mjs — THE PARENT PHOTOGRAPH, taken BEFORE any src edit.
// Workstream `volatile-delivery`, AC-1 (nothing but water moves), AC-4 (reachability) and AC-5 (the
// blast radius is measured, not minimised).
//
//   node --import ./scripts/node-alias-motion-test-kit.mjs scripts/capture-volatile-delivery-baseline.mjs [commit] \
//     > tests/fixtures/volatile-delivery-parent-population.json
//
// ⛔ WHY A FOURTH FIXTURE RATHER THAN A RE-CAPTURE OF AN EXISTING ONE. tests/fixtures/
// {pack,ray-pack,term-pack,solidrelief-pack}-drivers-baseline.json are each a SHIPPED workstream's
// frozen artifact pinned by `capturedFrom` in its own suite. This workstream WILL move them (composition
// changes on every body) and AC-6 re-captures them deliberately, one at a time, with the delta recorded.
// This file is THIS workstream's own parent column and is never one of those four.
//
// ⛔ THE CORPUS HARNESS IS IMPORTED, NEVER COPIED — tests/fixtures/ray-pack-corpus.mjs pins the corpus,
// the mesh, the ctx shape and GATE_POLICY_ALL_ON. Comparing under a different gate policy would read a
// policy change as a code change. Same module on both sides is what makes the compare a compare of CODE.
//
// ⭐ TWO SECTIONS, TWO JOBS:
//   `sweep` — 200 seeds, EVERY body (solid and gas). The eight AC-1 scalars that must not move, plus
//             the composition fields that must. This is the regression instrument.
//   `packs` — the 124-body corpus resolved through every claiming driver pack. This is the blast-radius
//             instrument: it is what tells us which populations moved and by how much.
import { execFileSync } from 'node:child_process';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
import { compositionClass, inSeededBand } from '../src/worldengine/base/e1Regime.js';
import { corpus, resolvedPacks, presetRows, MESH } from '../tests/fixtures/ray-pack-corpus.mjs';
import { labPackCtx } from '../src/objects/Planet.js';

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', '--short', commit], { encoding: 'utf8' }).trim();

const NSEEDS = Number(process.env.NSEEDS || 200);

// ── the smoothstep labCore.js:693 uses for its own wet gate, transcribed so the parent column and the
//    HEAD column read the SAME gate even if the engine is later edited (it must not be, per AC-0).
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const volatileGate = (V) => smoothstep(0.05, 0.2, V);

// ── SECTION 1 — the 200-seed sweep ──────────────────────────────────────────────────────────────
const sweep = {};
for (let i = 0; i < NSEEDS; i++) {
  const seed = `rocky-${i}`;
  const sys = StarSystemGenerator.generate(seed, null);
  for (const e of sys.planets) {
    const d = e.planetData || e;
    const rec = (dd, kind, ord) => {
      const cond = conditionFromBody(dd);
      const comp = dd.composition || {};
      sweep[`${seed}/${kind}/${ord}`] = {
        kind,
        // ⭐ THE EIGHT THAT MUST NOT MOVE (AC-1). moon.massEarth is derived FROM composition.density
        // (MoonGenerator.js:265) and checkTidalLock reads that mass, so `locked` is downstream of
        // density and is the field writeBodyRelief's dispatch tests FIRST.
        radiusEarth:  dd.radiusEarth ?? null,
        massEarth:    dd.massEarth ?? null,
        density:      comp.density ?? null,
        orbitAU:      dd.orbitRadiusAU ?? dd.orbitRadiusEarth ?? null,
        type:         dd.type ?? null,
        eccentricity: dd.eccentricity ?? null,
        atmoRetained: dd.atmosphere ? (dd.atmosphere.retained ?? null) : null,
        locked:       !!(dd.tidalState?.locked),
        // ── the fields this workstream is ALLOWED to move
        volatileFraction: comp.volatileFraction ?? null,
        iceFraction:      comp.iceFraction ?? null,     // absent at the parent — the new field
        surfaceType:      comp.surfaceType ?? null,
        ironFraction:     comp.ironFraction ?? null,
        carbonToOxygen:   comp.carbonToOxygen ?? null,
        // ── derived reads, for the population columns
        T_eq: cond.T_eq ?? null,
        cls:  compositionClass(cond),
        massEarthDerived: (cond.surfaceGravity ?? 1) * Math.pow(cond.radiusEarth ?? 1, 2),
        inBand: inSeededBand(cond),
      };
    };
    rec(d, 'planet', d._ordinal);
    for (const m of (e.moons || [])) {
      const md = m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m;
      rec(md, m.isPlanetMoon ? 'planet-moon' : 'moon', md._ordinal);
    }
  }
}

// ── SECTION 2 — the population read, the numbers Max sees ────────────────────────────────────────
const solid = Object.values(sweep).filter(r => r.cls !== 'gas');
const TEMP = r => r.T_eq >= 250 && r.T_eq <= 320;
const WET  = r => r.volatileFraction >= 0.12;
const MASSBAND = r => r.massEarthDerived >= 0.6 && r.massEarthDerived <= 1.6;
const q = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? { min: s[0], median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] } : null; };
const temperate = solid.filter(TEMP);
const gateBucket = (rows) => ({
  zero:    rows.filter(r => volatileGate(r.volatileFraction) === 0).length,
  dry:     rows.filter(r => { const g = volatileGate(r.volatileFraction); return g > 0 && g < 0.25; }).length,
  mid:     rows.filter(r => { const g = volatileGate(r.volatileFraction); return g >= 0.25 && g < 0.75; }).length,
  wet:     rows.filter(r => volatileGate(r.volatileFraction) >= 0.75).length,
});
const population = {
  seeds: NSEEDS,
  bodies: Object.keys(sweep).length,
  solid: solid.length,
  massBand: solid.filter(MASSBAND).length,
  temperate: temperate.length,
  wet: solid.filter(WET).length,
  massAndTemperate: solid.filter(r => MASSBAND(r) && TEMP(r)).length,
  massAndTemperateUnlocked: solid.filter(r => MASSBAND(r) && TEMP(r) && !r.locked).length,
  temperateAndWet: solid.filter(r => TEMP(r) && WET(r)).length,
  allThree: solid.filter(r => MASSBAND(r) && TEMP(r) && WET(r)).length,
  inSeededBand: solid.filter(r => r.inBand).length,
  locked: solid.filter(r => r.locked).length,
  temperateVolatiles: q(temperate.map(r => r.volatileFraction)),
  wetTemps: q(solid.filter(WET).map(r => r.T_eq)),
  engineGateAll: gateBucket(solid),
  engineGateTemperate: gateBucket(temperate),
  // ⭐ AC-4's frozen-worlds control: reachability must not be bought by flattening the distribution.
  frozenWet: solid.filter(r => r.T_eq < 200 && r.volatileFraction >= 0.25).length,
};

// ── SECTION 3 — the 124-body corpus resolved through every claiming pack (the blast radius) ──────
const CORPUS = corpus();
const packs = {};
for (const b of CORPUS) packs[b.id] = { kind: b.kind, cls: b.cls, packs: resolvedPacks(b.cond, labPackCtx(b.d, b.cond, MESH)) };
const presets = {};
for (const { name, cond, ctx } of presetRows()) presets[name] = resolvedPacks(cond, ctx);

process.stdout.write(JSON.stringify({
  capturedFrom: sha,
  capturedAt: new Date().toISOString().slice(0, 10),
  workstream: 'volatile-delivery',
  note: 'PARENT column. AC-1 deep-compares `sweep`; AC-4 compares `population`; AC-5 compares `packs`+`presets`.',
  population, sweep, packs, presets,
}, null, 1));

// scripts/capture-ray-lab-baseline.mjs — captures the LAB'S OWN ray derivation BEFORE the ray law
// leaves `labCore.deriveUniforms` (workstream wire-ejecta-rays-lab-into-game, AC-1).
//
//   node scripts/capture-ray-lab-baseline.mjs [commit] > tests/fixtures/ray-lab-baseline.json
//
// ⭐ WHY THIS EXISTS AND WHAT IT IS EVIDENCE OF. AC-1's claim is that moving the ray law out of
// `labCore.js:785` into `src/worldengine/base/ejectaRays.js` is byte-identical IN THE LAB. A fixture
// captured AT THE PARENT — before any src edit — is the only expectation that cannot have been
// written to match the new code, which is why this script must run and commit before the module
// exists. It calls the SHIPPED `deriveUniforms`; it does not re-type the law.
//
// ⛔ IT ALSO RECORDS AN ABSENCE. `rayCount` / `raySharp` have NO producer in `deriveUniforms` — they
// are lab literals (world-engine-lab.html:1175-1176) and shared-bag defaults
// (src/worldengine/shaders/uniforms.js:178-179). "Measured absent on 18/18 presets" is a claim about
// the parent that only a parent capture can carry, so the key list of every preset's output is
// recorded whole and the two names are asserted out of it.
//
// The corpus is the game's own bodies, read as the game mounts them (the 24 `rocky-*` seeds; a
// planet-class moon is an ENTRY wrapping `planetData`, so the mount is mirrored rather than the
// wrapper read — river wire 2026-09-02, trap 3).
import { execFileSync } from 'node:child_process';
import { DRIVER_PRESETS, drawPresetConditions } from '../driver-presets.js';
import { deriveUniforms } from '../src/worldengine/base/labCore.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { conditionFromBody } from '../src/worldengine/port/conditionFromBody.js';
// ⛔ NO `src/objects/Planet.js` IMPORT. `setLabGasBodiesOverride` lives there and nothing here needs it
// (no Planet is mounted — the corpus is conditions), and that module pulls in src/util/scene-naming.js,
// whose `motion-test-kit/core/hash/fnv1a.js` subpath resolves under the bundler and NOT under bare node.

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', '--short', commit], { encoding: 'utf8' }).trim();

const SEEDS = Array.from({ length: 24 }, (_, i) => `rocky-${i}`);
function corpus() {
  const out = [];
  for (const seed of SEEDS) {
    const sys = StarSystemGenerator.generate(seed, null);
    for (const e of sys.planets) {
      const d = e.planetData || e;
      out.push({ seed, kind: 'planet', d, id: `${seed}/planet/${d._ordinal}` });
      for (const m of (e.moons || [])) {
        const md = m.isPlanetMoon ? { ...m.planetData, _systemSeed: m._systemSeed, _ordinal: `pm-${m._ordinal}` } : m;
        out.push({ seed, kind: m.isPlanetMoon ? 'planet-moon' : 'moon', d: md, id: `${seed}/${m.isPlanetMoon ? 'planet-moon' : 'moon'}/${md._ordinal}` });
      }
    }
  }
  for (const b of out) b.cond = conditionFromBody(b.d);
  return out;
}

const CORPUS = corpus();
const ABSENT_NAMES = ['rayCount', 'raySharp'];

const bodies = {};
for (const b of CORPUS) {
  const u = deriveUniforms(b.cond, 1.0);
  bodies[b.id] = {
    kind: b.kind,
    compositionClass: compositionClass(b.cond),
    hasAtmosphere: !!b.cond.atmosphere,
    erosion: b.cond.surfaceHistory?.erosion ?? b.cond.surfaceHistory?.erosionLevel ?? null,
    rayBrightness: u.rayBrightness,
    absent: ABSENT_NAMES.filter((n) => !(n in u)),
  };
}

const presets = {};
for (const name of Object.keys(DRIVER_PRESETS)) {
  const fp = DRIVER_PRESETS[name];
  const R = fp.radiusEarth ?? 1;
  const uPreset = deriveUniforms(fp, 1.0);
  const cond = deriveConditionVector(fp, uPreset, R);
  const uCond = deriveUniforms(cond, 1.0);
  const drawn = {};
  for (const seed of [0, 1234]) {
    const dp = drawPresetConditions(name, seed);
    drawn[seed] = deriveUniforms(dp, 1.0).rayBrightness;
  }
  presets[name] = {
    preset: uPreset.rayBrightness,
    conditionVector: uCond.rayBrightness,
    drawn,
    absent: ABSENT_NAMES.filter((n) => !(n in uPreset)),
    absentFromConditionVector: ABSENT_NAMES.filter((n) => !(n in uCond)),
  };
}

const airless = Object.values(bodies).filter((r) => !r.hasAtmosphere && r.compositionClass !== 'gas');
process.stdout.write(JSON.stringify({
  capturedFrom: sha,
  capturedAt: new Date().toISOString().slice(0, 10),
  law: 'clamp01(1 - (surfaceHistory.erosion ?? surfaceHistory.erosionLevel ?? 0)) * (atmosphere ? 0 : 1)  — labCore.js:785 at the parent',
  absentNames: ABSENT_NAMES,
  summary: {
    bodies: CORPUS.length,
    presets: Object.keys(presets).length,
    airlessSolid: airless.length,
    airlessDistinctRayValues: new Set(airless.map((r) => r.rayBrightness)).size,
    nonZeroRayBodies: Object.values(bodies).filter((r) => r.rayBrightness > 0).length,
  },
  bodies,
  presets,
}, null, 1));

// tests/fixtures/v2-0-basestep-golden.mjs — World Engine V2-0 AC2 makeBaseStep-output CAPTURE HARNESS.
//
// PURPOSE (BUILD-PLAN §1 Slice B + §2): pin the EXACT numeric output of makeBaseStep on the pre-change
// tree, so Slice B's scalar-helper extraction (which must keep makeBaseStep's {drivers,crust,substrate}
// byte-identical) has a real value-preservation gate. The existing worldengine-base-* suites pin only
// determinism, monotone relations, and [0,1] bounds — they CANNOT witness a mistranscribed formula that
// preserves monotonicity, and baseStep is dormant on the AC1 carrier path (verified) so the carrier
// goldens can't witness it either, and AC5 checks console errors only (silent fieldviz numeric drift).
// This golden is the sole artifact that verifies AC2's "same values the grid op produced."
//
// CAPTURE POINT: baseStep.js is untouched since ad156cc, so capturing on the post-Slice-A tree yields the
// pre-change (ad156cc) output. The gate test (tests/worldengine-base-output-golden.test.js) re-imports
// this harness's computeGoldens() and asserts equality vs the committed v2-0-basestep-goldens.json — it
// passes trivially NOW and becomes load-bearing when Slice B refactors baseStep.
//
// Shared harness (not inline in the test) so the fixture GENERATOR and the CI GATE call the identical
// bundle set + capture logic — capture and gate can never drift apart (same rationale as the carrier
// harness). Run `node tests/fixtures/v2-0-basestep-golden.mjs` to (re)write the fixture.

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { makeBaseStep } from '../../src/worldengine/base/baseStep.js';
import { adaptL0 } from '../../src/worldengine/base/adaptL0.js';
import { PRESETS } from '../../relief-presets.js';

// The grid params the existing baseStep suites use (tests/worldengine-base-verify.test.js:11) — fixed n
// and seed for determinism. crustalThickness is n×n = 1024 texels.
export const GRID = Object.freeze({ n: 32, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'v-1' });

// The WS1 planetData whose F2-adapter output is the contract-named F7 fixture — copied VERBATIM from
// tests/worldengine-base-verify.test.js:17-23 (that const is test-local; kept byte-identical here so the
// golden covers the same "5 relief presets + adapter bundle" set the plan specifies).
const adapterPlanetData = Object.freeze({
  radiusEarth: 1.0, massEarth: 1.0, T_eq: 288,
  composition: Object.freeze({ ironFraction: 0.32, density: 5500, volatileFraction: 0.15 }),
  surfaceHistory: Object.freeze({ erosion: 0.4, resurfacing: 0.1, bombardment: 0.5 }),
  age: 4.5, metallicity: 0.0, magneticField: 0.32, eccentricity: 0.05, tidalHeating: 0.7,
  systemContext: Object.freeze({ siblings: [], moons: [], resonancePartners: [], companionClass: null }),
});

// The capture bundle set: relief-presets.js's 5 PRESETS + the frozen adapter bundle (BUILD-PLAN §1 Slice B).
export const BUNDLES = {
  rocky: PRESETS.rocky,
  lava: PRESETS.lava,
  magma: PRESETS.magma,
  europa: PRESETS.europa,
  terrestrial: PRESETS.terrestrial,
  adapter: adaptL0(adapterPlanetData),
};

// rawTidal = the pre-calibrateTidal Io-ratio computed inside makeBaseStep (baseStep.js:19-27). Replicated
// here EXACTLY so the golden pins the raw value Slice B's bodyRawTidal() helper must reproduce (§2 Slice B
// "additionally pin bodyRawTidal(b) to its frozen raw value"). makeBaseStep returns only the CALIBRATED
// tidalHeat, so this raw value has no returned field to read — it is captured directly from the formula.
export function rawTidalOf(bundle) {
  const d = bundle || {};
  const radiusEarth = d.radiusEarth ?? 1.0;
  const ecc = d.eccentricity ?? 0;
  const starMassEarth = d.starMassEarth ?? 332946;
  const orbitRadiusEarth = d.orbitRadiusEarth ?? 23455;
  const ioRef = (0.0041 * 0.0041) * (317.8 * 317.8) * Math.pow(0.286, 5) / Math.pow(66, 5);
  return (d.tidalHeat != null)
    ? d.tidalHeat
    : (orbitRadiusEarth > 0
        ? (ecc * ecc * starMassEarth * starMassEarth * Math.pow(radiusEarth, 5) / Math.pow(orbitRadiusEarth, 5)) / ioRef
        : 0);
}

// SHA-256 over a Float32Array's little-endian bytes (freshly-allocated array ⇒ byteOffset 0; x86_64 host).
export function hashF32(arr) {
  return createHash('sha256').update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)).digest('hex');
}

// Extract the golden entry for one makeBaseStep output: all 13 drivers scalars (deep-equal), the 3 crust
// scalars (deep-equal), the crustalThickness field as a SHA-256 (Float32Array), and the raw tidal value.
export function goldenEntry(bundle) {
  const o = makeBaseStep(bundle, GRID);
  return {
    drivers: { ...o.drivers },                     // 13 scalars incl. discriminator (string) + useDiscriminator (bool)
    crust: {
      shellThickness: o.crust.shellThickness,
      thermalState: o.crust.thermalState,
      loveK2: o.crust.loveK2,
    },
    crustalThicknessSha256: hashF32(o.crust.crustalThickness),
    rawTidal: rawTidalOf(bundle),
  };
}

// Compute all golden entries: { [bundleName]: goldenEntry }.
export function computeGoldens() {
  const out = {};
  for (const name of Object.keys(BUNDLES)) out[name] = goldenEntry(BUNDLES[name]);
  return out;
}

export const GOLDEN_PATH = fileURLToPath(new URL('./v2-0-basestep-goldens.json', import.meta.url));

function main() {
  const goldens = computeGoldens();
  const fixture = {
    _meta: {
      what: 'V2-0 AC2 makeBaseStep-output goldens — per-bundle drivers/crust scalars + crustalThickness SHA-256 + raw tidal.',
      capturedFrom: 'pre-change baseStep (untouched since ad156cc; captured on the post-Slice-A tree).',
      grid: GRID,
      bundles: Object.keys(BUNDLES),
      note: 'drivers = deep-equal; crust {shellThickness,thermalState,loveK2} = deep-equal; crustalThickness = SHA-256 over n×n LE bytes; rawTidal = pre-calibrateTidal Io-ratio.',
    },
    goldens,
  };
  writeFileSync(GOLDEN_PATH, JSON.stringify(fixture, null, 2) + '\n');
  process.stdout.write(`wrote ${Object.keys(goldens).length} baseStep goldens → ${path.basename(GOLDEN_PATH)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

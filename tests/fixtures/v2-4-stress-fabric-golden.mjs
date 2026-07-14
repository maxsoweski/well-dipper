// tests/fixtures/v2-4-stress-fabric-golden.mjs — World Engine V2-4 slice-2 (SP-STRESS-FABRIC) CAPTURE HARNESS.
//
// PURPOSE (BUILD-PLAN §2 + AC-FABRIC): record the PRE-EXTRACTION output of every one of the four
// steeredNoise3 call sites, so the extraction (the four verbatim copies → one owned stressFabric.js
// module) can be proven byte-exact by a dual-run compare. Each call site is exercised by driving its
// REAL writer on the deterministic headless mesh across the standard seed sweep, then SHA-256-hashing
// the sole steeredNoise3-dependent output (carrier.height) — the same byte-identity idiom the V2-0
// carrier golden uses (tests/fixtures/v2-0-carrier-golden.mjs).
//
// THE FOUR CALL SITES (BUILD-PLAN §2 / contract AC-FABRIC):
//   tectonic-grain   — tectonic.js:173      writeHeightSphere steered tectonic grain (regime-branched;
//                                            exercises BOTH the NORMAL/ridged=false and non-NORMAL/ridged=true
//                                            arms of steeredNoise3 across the mesh's regime bands).
//   shell-ridge      — shellRelief.js:382    writeShellReliefSphere ridge/trajectory (ridged=true).
//   mixed-tessera    — mixedInterior.js:373-374  tessera fold+ribbon double-fabric (ridged=true) — the
//                                            one call site the 75-carrier golden does NOT reach (mixedInterior
//                                            is lab-only, off the writeBodyRelief dispatch), so this fixture
//                                            is its only pre/post byte anchor. A tessera-node witness is
//                                            recorded in _meta so the capture cannot be silently vacuous.
//   stagnant-tessera — stagnantLid.js:356-357   tessera fold+ribbon double-fabric (ridged=true).
//
// CAPTURE-ORDER GUARD (lens A-M3): this file is written and RUN while the four steeredNoise3 copies are
// still their pre-extraction verbatim selves. The committed JSON therefore encodes pre-extraction bytes;
// the gate (tests/worldengine-v2-4-stress-fabric.test.js) re-imports computeAllFixtures() and recomputes
// AFTER the extraction, so a green compare proves the extraction was byte-inert. Running this capture
// after the extraction would compare extracted-to-extracted (vacuous) — so it is run FIRST, before any
// source edit. (The test also carries an INDEPENDENT function-level dual-run against a verbatim-embedded
// pre-extraction reference, immune to capture-order entirely — belt and suspenders.)
//
// WHY a harness module (not inline): the drive logic is SHARED between the one-time capture
// (`node tests/fixtures/v2-4-stress-fabric-golden.mjs`) and the CI gate — single source ⇒ they cannot drift.
// METERED-SAFE: pure node, no claude -p. No Math.random / Date.now (buildIrregularSphere is fibonacci +
// Lloyd, deterministic; all writers are seeded alea).

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { makeSphereField } from '../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere, DEFAULT_GRAIN_DRIVERS } from '../../planet-lod-rivers.js';
import { writeGrainSphere, writeHeightSphere } from '../../src/worldengine/base/tectonic.js';
import { writeShellReliefSphere } from '../../src/worldengine/base/shellRelief.js';
import { writeMixedInteriorSphere } from '../../src/worldengine/base/mixedInterior.js';
import { writeStagnantLidReliefSphere } from '../../src/worldengine/base/stagnantLid.js';

// Same deterministic mesh the composer / structure / multiply suites use (1500/2 gives ample tessera
// coverage so the mixed/stagnant fold+ribbon call sites actually fire). Mesh is Math.random-free, so
// capture and gate build the identical mesh.
export const TARGET_N = 1500;
export const LLOYD = 2;
export const SEEDS = [1, 2, 3, 7, 42];

// Tharsis E1 coordinate — the hand-set 'mixed' interior coordinate from the composer suite
// (tests/worldengine-mixed-composer.test.js), chosen because it places ancient (tessera-forming) centers,
// so the tessera fold+ribbon steeredNoise3 call sites (:373-374) are actually exercised.
export const THARSIS_E1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.551, Φ: 0.27, n: 6 };

const ID_TESSERA = 6;   // mixedInterior primitiveId enum value for tessera (composer-test-local copy)

const freshCarrier = () => makeSphereField(buildIrregularSphere(TARGET_N, LLOYD));

// SHA-256 over the little-endian bytes of a typed array (x86_64 host is LE; arrays are freshly allocated
// at byteOffset 0). Identical hashing to the V2-0 carrier golden.
function hashArray(arr) {
  return createHash('sha256').update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)).digest('hex');
}

// ── the four call-site drivers: each returns { height, witness } where `height` is the steeredNoise3-fed
//    output array and `witness` proves the call site was actually reached. Drivers mirror the canonical
//    direct-drive calls the existing suites use (stagnantlid-structure.test.js:321-324; composer build()). ──

function driveTectonicGrain(seed) {
  const c = freshCarrier();
  writeGrainSphere(c, DEFAULT_GRAIN_DRIVERS);                                         // precondition (grain before height)
  writeHeightSphere(c, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, 'e6:' + (seed | 0));
  let nz = 0; for (let i = 0; i < c.height.length; i++) if (c.height[i] !== 0) nz++;
  return { height: c.height, witness: { nonzeroHeight: nz } };
}

function driveShellRidge(seed) {
  const c = freshCarrier();
  writeShellReliefSphere(c, DEFAULT_GRAIN_DRIVERS, { macroSeed: seed, regime: 'icy-active' });
  let nz = 0; for (let i = 0; i < c.height.length; i++) if (c.height[i] !== 0) nz++;
  return { height: c.height, witness: { nonzeroHeight: nz } };
}

function driveMixedTessera(seed) {
  const c = freshCarrier();
  const diag = writeMixedInteriorSphere(c, { e1: THARSIS_E1, rawTidal: 0, macroSeed: seed, tune: null });
  let tess = 0; const pid = diag.primitiveId; for (let i = 0; i < pid.length; i++) if (pid[i] === ID_TESSERA) tess++;
  return { height: c.height, witness: { tesseraNodes: tess } };
}

function driveStagnantTessera(seed) {
  const c = freshCarrier();
  const diag = writeStagnantLidReliefSphere(c, {}, { macroSeed: seed });
  // stagnant-lid tessera nodes are diag-reported via the isTessera mask (stagnantLid.js:485-488) — a
  // >0 count proves the tessera fold+ribbon steeredNoise3 call sites (:356-357) actually fired.
  let tess = 0;
  if (diag && diag.isTessera) { for (let i = 0; i < diag.isTessera.length; i++) if (diag.isTessera[i]) tess++; }
  return { height: c.height, witness: { tesseraNodes: tess } };
}

export const CALL_SITES = {
  'tectonic-grain': driveTectonicGrain,
  'shell-ridge': driveShellRidge,
  'mixed-tessera': driveMixedTessera,
  'stagnant-tessera': driveStagnantTessera,
};

// { [callSite]: { hashes: { [seed]: sha256 }, witness: { [seed]: {...} } } }
export function computeAllFixtures() {
  const out = {};
  for (const [site, drive] of Object.entries(CALL_SITES)) {
    out[site] = { hashes: {}, witness: {} };
    for (const seed of SEEDS) {
      const { height, witness } = drive(seed);
      out[site].hashes[String(seed)] = hashArray(height);
      out[site].witness[String(seed)] = witness;
    }
  }
  return out;
}

export const GOLDEN_PATH = fileURLToPath(new URL('./v2-4-stress-fabric-goldens.json', import.meta.url));

function main() {
  const fixtures = computeAllFixtures();
  const payload = {
    _meta: {
      what: 'V2-4 slice-2 SP-STRESS-FABRIC pre-extraction goldens — SHA-256 of carrier.height per (call-site, seed) across the four steeredNoise3 call sites.',
      capturedFrom: 'PRE-EXTRACTION tree (four verbatim steeredNoise3 copies still in tectonic/shellRelief/mixedInterior/stagnantLid). Capture-order guard: run before any source edit.',
      targetN: TARGET_N, lloyd: LLOYD, seeds: SEEDS,
      callSites: Object.keys(CALL_SITES),
      note: 'mixed-tessera + stagnant-tessera witness records tessera-node counts (>0 proves the tessera fold+ribbon call sites fired); tectonic/shell witness records nonzero-height counts.',
    },
    fixtures,
  };
  writeFileSync(GOLDEN_PATH, JSON.stringify(payload, null, 2) + '\n');
  const n = Object.keys(CALL_SITES).length * SEEDS.length;
  process.stdout.write(`wrote ${n} stress-fabric height hashes → ${path.basename(GOLDEN_PATH)}\n`);
  for (const site of Object.keys(CALL_SITES)) {
    const w = fixtures[site].witness['1'];
    process.stdout.write(`  ${site} @seed1 witness: ${JSON.stringify(w)}\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

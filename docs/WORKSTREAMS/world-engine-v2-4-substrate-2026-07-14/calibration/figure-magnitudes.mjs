// docs/WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/calibration/figure-magnitudes.mjs
// World Engine V2-4 slice-5 (E2-figure descriptor) — MAGNITUDE calibration probe (BUILD-PLAN §6.4).
//
// PURPOSE: print the OBSERVED flattening f (and the present/fossil split) across all 17 presets so the
// AC-FIGURE(b) bands are pinned to real numbers, not assumed. It drives the REAL derivation path — the same
// deriveUniforms → deriveConditionVector → deriveFigureDescriptor chain the writeBodyRelief seam runs — so
// the printed f is exactly what `relief.figure.fPresent` carries in the lab/tests.
//
// THE GATE IS ORDERING, NOT THE EXACT NUMBER (BUILD-PLAN §5/§6.4, lens B-m5): the homogeneous (5/4) Maclaurin
// coefficient overestimates a centrally-condensed body ~2× (Jupiter ~0.11 vs the real ~0.065). So the Jupiter
// band [0.04, 0.15] sits deliberately ABOVE the contract's "~0.06" — Earth ≪ Jupiter is the real check.
// The Darwin–Radau response-coefficient refinement (needs a per-body moment-of-inertia factor we have no
// driver for) is a documented, parked non-goal.
//
// METERED-SAFE: pure `node`, no `claude -p`.  Run:  node docs/WORKSTREAMS/.../calibration/figure-magnitudes.mjs
import { DRIVER_PRESETS } from '../../../../driver-presets.js';
import { deriveConditionVector } from '../../../../src/worldengine/base/conditionVector.js';
import { deriveFigureDescriptor } from '../../../../src/worldengine/base/bodyFigure.js';
import { deriveUniforms } from '../../../../src/worldengine/base/labCore.js';
import { QUALITY_TIER } from '../../../../tests/fixtures/v2-0-carrier-golden.mjs';

const out = [];
const p = (s) => out.push(s);
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('  V2-4 slice-5 E2-FIGURE MAGNITUDE calibration  (figure-magnitudes.mjs — BUILD-PLAN §6.4)');
p('  f = (5/4)·ω²·a/g   (homogeneous Maclaurin; a = BODY radius, g = surface gravity)');
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
p('');
p('  preset                        rotH     ω(rad/s)   radiusE   g(Earth)     fPresent      fFossil   despun');
p('  ──────────────────────────────────────────────────────────────────────────────────────────────────');

let earthF = null, jupiterF = null;
const despunSplits = [];
for (const name of Object.keys(DRIVER_PRESETS)) {
  const fp = DRIVER_PRESETS[name];
  const u = deriveUniforms(fp, QUALITY_TIER);
  const cond = deriveConditionVector(fp, u, fp.radiusEarth);
  const fig = deriveFigureDescriptor(cond);
  p(`  ${name.padEnd(28)} ${String(fig.rotationHours).padStart(6)}  ${fig.presentW0.toExponential(3)}  ${cond.radiusEarth.toFixed(2).padStart(6)}  ${cond.surfaceGravity.toFixed(3).padStart(8)}   ${fig.fPresent.toExponential(4)}  ${fig.fFossil.toExponential(4)}   ${fig.despun ? 'YES' : ' · '}`);
  if (name === 'Rocky (Earthlike)') earthF = fig.fPresent;
  if (name === 'Gas giant (Jovian)') jupiterF = fig.fPresent;
  if (fig.despun) despunSplits.push({ name, fPresent: fig.fPresent, fFossil: fig.fFossil, presentW0: fig.presentW0, fossilW0: fig.fossilW0 });
}

p('');
p('── BAND CHECKS (AC-FIGURE b) ────────────────────────────────────────────────────────────────────────');
p(`  Earth-like (Rocky)   fPresent = ${earthF.toExponential(4)}  → 1/${(1 / earthF).toFixed(0)}   band [2e-3, 6e-3]:  ${earthF >= 2e-3 && earthF <= 6e-3 ? 'PASS' : 'FAIL'}`);
p(`  Jupiter (Jovian)     fPresent = ${jupiterF.toExponential(4)}  → 1/${(1 / jupiterF).toFixed(0)}   band [0.04, 0.15]:  ${jupiterF >= 0.04 && jupiterF <= 0.15 ? 'PASS' : 'FAIL'}`);
p(`  ORDERING             Earth ≪ Jupiter (${earthF.toExponential(2)} ≪ ${jupiterF.toExponential(2)}):  ${earthF < jupiterF ? 'PASS' : 'FAIL'}  (ratio ${(jupiterF / earthF).toFixed(0)}×)`);
p('');
p('── DESPUN / FOSSIL SPLIT (AC-FIGURE b — locked bodies split present/fossil) ──────────────────────────');
for (const d of despunSplits) {
  p(`  ${d.name.padEnd(28)} fPresent ${d.fPresent.toExponential(3)}  fFossil ${d.fFossil.toExponential(3)}   split(fPresent≠fFossil): ${d.fPresent !== d.fFossil ? 'YES' : 'NO'}  ${d.fFossil > d.fPresent ? '(fossil larger — despun-slower)' : '(fossil smaller — present spins faster than the 8h fiducial)'}`);
}
p('══════════════════════════════════════════════════════════════════════════════════════════════════');
process.stdout.write(out.join('\n') + '\n');

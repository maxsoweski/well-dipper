// scripts/capture-term-lab-baseline.mjs — captures THE LAB'S OWN TERMINATOR STATE as the lab
// authors it today, BEFORE the retyped width law at world-engine-lab.html:2505 is deleted and
// before `TERMINATOR_ENABLED` exists (workstream wire-terminator-gradient-lab-into-game, AC-0/AC-1).
//
//   node scripts/capture-term-lab-baseline.mjs <commit> > tests/fixtures/term-lab-baseline.json
//
// ⭐ WHY IT EXISTS. AC-0 deletes one line of the lab: `state.termWidth = Math.min(0.30, Math.max(0.06,
// 0.12 + 0.09 * Math.log10(_tp)))`. On a NON-GAS preset that line is superseded IN-FUNCTION at :2630
// (`if (_so) Object.assign(state, solidOpticsLabState(_so))`, inside the same applyDrivers), so the
// deletion is a supersession. ⛔ ON GAS IT IS THE OTHER WAY ROUND: the gas mirror lives at :2821 inside
// `ensureNetworkRouted`, a DIFFERENT function, and the lab's own note there records applyDrivers
// re-writing the triple afterwards — so on gas the retype runs LAST and the deletion is admissible
// ONLY because the two values are EQUAL. This fixture is the proof of that equality, and it is taken
// in BOTH call orders because "equal" has to hold whichever function ran last.
//
// ⛔ IT DOES NOT RE-TYPE THE LAB'S LAW. Nine live regions are SLICED out of a PINNED git blob of
// world-engine-lab.html and run through `new Function` against the real modules — the precedent is
// scripts/capture-storm-lab-baseline.mjs, which sliced `applyStormState` the same way. The slicer and
// the runner live in `tests/fixtures/term-lab-harness.mjs` so that THIS side and the HEAD side in
// tests/driver-pack-terminator.test.js execute the identical harness; a second transcription would
// put a harness difference inside a number the contract reads as a code difference.
//
// ⚠ WHAT IS REPLICATED RATHER THAN SLICED, and why it is faithful. The gas mirror's argument is
// `_bodyDrivers.condition`, built by the lab's `buildBodyDrivers` (:1668) out of
// `deriveConditionVector(drawPresetConditions(preset, macroSeed), _u, state.planetRadiusEarth)` with
// every driver-override slider UNTOUCHED — which is exactly the object :2464 builds for `_atmoCond`.
// At the lab's defaults (no override touched, `_driverAbMode` not 'override') the two are the same
// derive, so ONE condition object is built and handed to both sliced regions. A dragged slider would
// separate them; the lab boots with none dragged and AC-4 probes the live page.
//
// ⚠ AC-1's CHANGE-SET CONTROL IS ITS SIBLING, `scripts/capture-term-pack-baseline.mjs` — the per-body
// `uTermStrength` every pack resolves at the PARENT under `gatesFor(entry)` (which at the parent IS
// `GATE_POLICY_ALL_ON`). Two captures because they measure two different producers: this one is the
// LAB's `state`, that one is the GAME's resolved drivers, and conflating them would let one cover
// for the other's silence.
import { execFileSync } from 'node:child_process';
import { DRIVER_PRESETS } from '../driver-presets.js';
import { DEFAULT_DRESSING, ASSOCIATIONS } from '../planet-feature-associations.js';
import { sliceLab, runLabRows, readStateLiteralTokens, TERM_FIELDS, MACRO_SEEDS } from '../tests/fixtures/term-lab-harness.mjs';
// ⛔ NO `src/objects/Planet.js` IMPORT — the same reason capture-ray-lab-baseline.mjs gives: that
// module's `motion-test-kit` subpath resolves under the bundler and not under bare node, and nothing
// here mounts a Planet.

const commit = process.argv[2] || 'HEAD';
const sha = execFileSync('git', ['rev-parse', '--short', commit], { encoding: 'utf8' }).trim();
const labSrc = execFileSync('git', ['show', `${sha}:world-engine-lab.html`], { encoding: 'utf8', maxBuffer: 64e6 });

const slice = sliceLab(labSrc);
// The lab's state literals AS THEY STAND AT THE CAPTURED COMMIT — read out of that same blob rather
// than assumed, so a capture cannot silently describe a different lab from the one it sliced.
// ⛔ AT THE PARENT ALL THREE ARE BOOLEAN LITERALS and this script REFUSES anything else: once they
// become constant NAMES the capture would have to import the constants, i.e. it would be measuring
// the change instead of the state before it.
const tokens = readStateLiteralTokens(labSrc);
const asBool = (name, tok) => {
  if (tok === 'true') return true;
  if (tok === 'false') return false;
  throw new Error(`world-engine-lab.html's ${name} reads \`${tok}\` at ${sha}, not a boolean literal — this capture only describes the pre-wire lab`);
};
const rows = runLabRows(slice, {
  literals: {
    terminatorEnabled: asBool('terminatorEnabled', tokens.terminatorEnabled),
    limbBypass: asBool('limbBypass', tokens.limbBypass),
    termBypass: asBool('termBypass', tokens.termBypass),
  },
  dressing: (preset) => (DEFAULT_DRESSING[preset] || []).includes('terminator'),
});
for (const r of rows) r.rendersTerminator = ASSOCIATIONS.terminator.rendersOn.includes(r.preset);

process.stdout.write(JSON.stringify({
  capturedFrom: sha,
  capturedAt: new Date().toISOString().slice(0, 10),
  file: 'world-engine-lab.html',
  method: 'nine regions sliced from the pinned blob (:2464 :2465 :2477 :2497 :2504 :2505 :2511, the :2630 solid mirror fragment, the :2821 gas mirror fragment) and run through new Function against the real modules; gas presets in BOTH call orders',
  retypeLiveAtCapture: slice.retypeLive,
  stateLiteralTokens: tokens,
  gatePolicyAtCapture: 'gatesFor(entry) default — GATE_POLICY_ALL_ON at this commit',
  grid: { macroSeeds: MACRO_SEEDS, presets: Object.keys(DRIVER_PRESETS) },
  termFields: TERM_FIELDS,
  summary: {
    rows: rows.length,
    gasRows: rows.filter((r) => r.gas).length,
    presets: Object.keys(DRIVER_PRESETS).length,
    dressingEntriesWithTerminator: Object.values(DEFAULT_DRESSING).filter((v) => v.includes('terminator')).length,
    terminatorRendersOn: ASSOCIATIONS.terminator.rendersOn.length,
  },
  rows,
}, null, 1));

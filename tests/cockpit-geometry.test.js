// tests/cockpit-geometry.test.js
//
// SCOPE: the headless half of workstream cockpit-lab-geometry-2026-07-28
// (docs/WORKSTREAMS/cockpit-lab-geometry-2026-07-28/contract.json).
// Covers the three unit-layer ACs — AC-FORM, AC-METRIC, AC-REPRO — by parsing the
// exported GLB directly (tests/helpers/glb-parse.mjs; no three.js, no browser, no DOM).
//
// ── WHAT THE RE-SPEC CHANGED (2026-07-28) ────────────────────────────────────
// Max replaced the form language at UAT on 1056f30. The old suite asserted an
// octagonal Cockpit_Frame ring, flat 0.30 x 0.20 m screen panels mounted on its bevel
// pads, and a Hull_Nose. All three are gone:
//
//   screens   flat quad          -> a BOX: a display face 50% larger (0.45 x 0.30 m),
//                                  a ~1 inch bezel around it, a ~2 inch deep body
//                                  behind it, and the face RECESSED so the bezel reads
//   mounting  seated on a pillar -> carried on ARMS whose roots are outside the
//                                  70 deg / 16:9 view frustum
//   frame     octagonal ring     -> TWO vertical ribs lying on a forward-protruding
//                                  Canopy_Glass shell, PLUS a thin faceted perimeter
//                                  band (Canopy_Frame) around the canopy opening
//   nose      Hull_Nose          -> DELETED. Its presence is now an AC-FORM failure.
//
// ── THE PERIMETER FRAME (added 2026-07-28, after the reference images) ───────
// Max's two form references both show a clear faceted edge where the glass meets the
// hull, and it is that edge — including a plain lower SILL under the screens — that makes
// the thing read as a cockpit rather than as four monitors on two lamp-posts. "Fairly
// thin" was mis-briefed as "absent". Canopy_Frame is the band; the ribs now terminate ON
// it at both ends instead of floating. See the workstream's reference/README.md.
//
// ── WHAT AN ADVERSARIAL REVIEW FOUND, AND WHAT REPLACED IT ───────────────────
// Three assertions here could not fail. Each is now written so a planted defect makes it
// red, and each planted defect is exercised by a self-test in this file:
//
//   1. the node inventory was SUBSET-shaped ("these must be present"), so a stray Cube,
//      a duplicated ScreenBody_UL_001 or a leftover datablock node was unconstrained.
//      It is now an EXHAUSTIVE set comparison, in both directions, and so is
//      metrics.objects. Self-test: "reports extra, missing and duplicated names".
//   2. the rib-on-shell check used GLB.distanceToTriangleList, which is UNSIGNED, so a
//      rib bolted to the OUTSIDE of the canopy or punched through it measured exactly
//      the same as one lying correctly inboard and the fraction stayed 1.0. Sidedness
//      now comes from a ray out of the pilot's eye (GLB.insideShellFromEye), the same
//      predicate the screen units use. Self-test: "decides sidedness from the eye".
//   3. the glass-exclusion check filtered diagnostics for a key matching /glass/i AND
//      /occl/i and looped over the result — with no such key the loop body never ran and
//      the test passed. Confirmed against a sidecar carrying no glass key at all. The key
//      is now REQUIRED to exist before it is required to be zero. Self-test: "treats a
//      missing glass-occlusion term as absent, not as satisfied".
//
// The screen containment checks that used to measure against the frame ring's inner
// cavity are replaced by containment against the canopy shell (a ray from the eye
// through each screen vertex must reach that vertex before it reaches the glass).
//
// DEFERRED to live verification by working-Claude: AC-FRAME (the occluded fraction at
// 70 degrees / 16:9, measured in chrome-devtools) and AC-LAB (the lab page loads, the
// eye button works, the cabin light is off by default). Neither is assertable from the
// container alone. NOTE that AC-FRAME is now MEASURE-AND-REPORT: the old [0.25, 0.30]
// band was derived from the frame-plus-nose design Max deleted, and the amended
// contract retires it rather than have geometry padded to hit a stale number. Nothing
// in this file asserts an occlusion band, on purpose.
//
// ── MISSING ARTEFACTS ARE A FAILURE, NOT A SKIP ──────────────────────────────
// If public/assets/cockpit/cockpit.glb or cockpit-metrics.json is absent, this suite
// FAILS with instructions for generating them. That is deliberate: an earlier version
// skipped the entire artefact block on a missing file, so a run that parsed zero bytes
// of GLB reported "7 passed | 15 skipped", exit 0, and a deleted or gitignored asset
// was indistinguishable from a green build.
//
// The pre-artist window (harness lands before the Blender run) is the ONLY legitimate
// reason to be missing artefacts, and it is an explicit opt-in:
//
//     COCKPIT_ARTEFACTS_OPTIONAL=1 npx vitest run tests/cockpit-geometry.test.js
//
// which downgrades the gate to a skip and leaves AC-FORM / AC-METRIC unmeasured.
// The parser self-tests always run either way, so "green" is never vacuous — they
// prove the measuring instrument works before there is anything to measure.
// See feedback_measurement-channels-need-planted-defects.md.
//
// ── AC-REPRO GENUINELY RE-RUNS THE GENERATOR ─────────────────────────────────
// The reproducibility block spawns the committed Blender script TWICE into separate
// temp paths and compares the decoded geometry. It does not hash one file twice —
// that would report green for a generator with nondeterministic vertex ordering,
// which is the only failure mode the AC is about. When Blender cannot be spawned
// (absent executable, no WSL interop, sandboxed shell) it SKIPS with a printed
// reason. A skip is acceptable; a false green is not. Set COCKPIT_SKIP_BLENDER=1
// to opt out deliberately (each run takes tens of seconds).
//
// ── DIMENSIONS COME FROM THE SIDECAR, WITH A CAVEAT ──────────────────────────
// Most dimensional assertions are against public/assets/cockpit/cockpit-metrics.json,
// the sidecar the Blender script writes in the same run as the GLB, so retuning a
// constant in the script retunes the expectation with it. But note what that class of
// check can and cannot catch — see the "NEAR-TAUTOLOGY" comments below. The checks
// that are independent of the generator's self-report are marked INDEPENDENT.
//
// The one place the test file is the AUTHORITY rather than the sidecar is the inch
// derivation: a generator that declared a 0.5 m "bezel" and built one would satisfy
// every geometry-vs-sidecar comparison, so the declared constants are themselves
// checked against the inches Max named.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as GLB from './helpers/glb-parse.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const GLB_PATH = path.join(ROOT, 'public/assets/cockpit/cockpit.glb');
const METRICS_PATH = path.join(ROOT, 'public/assets/cockpit/cockpit-metrics.json');
const GEN_SCRIPT = path.join(ROOT, 'scripts/cockpit-gen.py');

const BLENDER_EXE = process.env.BLENDER_EXE
  || '/mnt/c/Program Files/Blender Foundation/Blender 5.1/blender.exe';
const ARTEFACTS_OPTIONAL = process.env.COCKPIT_ARTEFACTS_OPTIONAL === '1';
const SKIP_BLENDER = process.env.COCKPIT_SKIP_BLENDER === '1';
const BLENDER_RUN_TIMEOUT_MS = 240_000; // one headless run; the script itself is seconds, Blender's startup is not

/**
 * WSL path -> the form the Windows Blender binary understands.
 * /mnt/c/... is a real Windows drive; anything else lives in the distro and is
 * reachable over the \\wsl.localhost UNC share.
 */
function toWindowsPath(p) {
  const drive = /^\/mnt\/([a-z])\//i.exec(p);
  if (drive) return `${drive[1].toUpperCase()}:\\${p.slice(7).replace(/\//g, '\\')}`;
  const distro = process.env.WSL_DISTRO_NAME || 'Ubuntu';
  return `\\\\wsl.localhost\\${distro}${p.replace(/\//g, '\\')}`;
}

/** The exact shell command that regenerates the artefacts, ready to paste. */
function generateCommand(outGlb = GLB_PATH, outMetrics = METRICS_PATH) {
  return `'${BLENDER_EXE}' --background \\\n`
    + `  --python '${toWindowsPath(GEN_SCRIPT)}' -- \\\n`
    + `  --out '${toWindowsPath(outGlb)}' \\\n`
    + `  --metrics '${toWindowsPath(outMetrics)}'`;
}

/**
 * Print a reason that has to survive a GREEN run.
 *
 * NOT console.warn: vitest's default reporter drops console output entirely when every
 * test in a file passes, which is exactly the run where a skipped AC most needs to
 * announce itself — a silent skip is how "AC-REPRO is verified" gets believed on a run
 * that never started Blender. A raw stderr write escapes the reporter's console capture
 * and prints either way. (The reason is ALSO attached to each skipped test via
 * ctx.skip(note), which `--reporter=verbose` shows per test.)
 */
function notify(message) {
  process.stderr.write(`\n${message}\n`);
}

const missing = [GLB_PATH, METRICS_PATH].filter((p) => !existsSync(p)).map((p) => path.relative(ROOT, p));
const HOW_TO_GENERATE =
  `The cockpit artefacts are missing: ${missing.join(', ') || '(none)'}.\n\n`
  + 'AC-FORM and AC-METRIC cannot be measured without them, so this is a FAILURE rather than\n'
  + 'a skip — otherwise a deleted or gitignored asset would look exactly like a green build.\n\n'
  + 'Generate them by running the committed Blender script from the worktree root:\n\n'
  + `${generateCommand()}\n\n`
  + 'Blender must be launched by working-Claude: reaching /mnt/c and the Windows binary needs a\n'
  + 'sandbox override that subagents do not have.\n\n'
  + 'DURING THE PRE-ARTIST WINDOW ONLY, set COCKPIT_ARTEFACTS_OPTIONAL=1 to downgrade this gate\n'
  + 'to a skip. Anything that claims this increment is done must run WITHOUT that variable.';

if (missing.length) {
  notify(
    `[cockpit-geometry] ${ARTEFACTS_OPTIONAL ? 'DEFERRED (COCKPIT_ARTEFACTS_OPTIONAL=1)' : 'FAILING'} — `
    + `${missing.join(', ')} not present.\n${HOW_TO_GENERATE}`,
  );
}

// glTF axes: +X right, +Y up, forward is -Z. Blender's +Y forward maps to glTF -Z
// under export_yup=True, so a forward distance F metres in the script is z = -F here.
const EYE = [0, 0, 0];
const QUADRANT_SUFFIXES = ['UL', 'UR', 'LL', 'LR'];
const SCREEN_NAMES = QUADRANT_SUFFIXES.map((q) => `Screen_${q}`);
const BODY_NAMES = QUADRANT_SUFFIXES.map((q) => `ScreenBody_${q}`);
// An arm is FIVE PARTS now, not one tapered stick. Max: "we need to model their arms
// though, and the arms should probably affix to the ribs somewhere."
const ARM_PART_SUFFIXES = ['Mount', 'BoomA', 'Elbow', 'BoomB', 'Head'];
const ARM_NAMES = QUADRANT_SUFFIXES.flatMap((q) => ARM_PART_SUFFIXES.map((p) => `Arm_${q}_${p}`));
const ARM_ROOT_PART = (q) => `Arm_${q}_Mount`;
const ARM_TIP_PART = (q) => `Arm_${q}_Head`;

// Every structural member is named for the SEAM of the vault it lies on. Two families:
//   FOLD  two panels meet  -> the four interior ribs and the mid arch
//   RIM   one panel only   -> the two sill rails and the bow / aft arches
// AC-FORM(b) -- "a rib not lying on a panel-to-panel seam is a failure" -- is measured
// against the FOLD family specifically, so a rib cannot pass by sitting near a rim.
const SILL_NAMES = ['Sill_L', 'Sill_R'];
const RIB_NAMES = ['Rib_Shoulder_L', 'Rib_Shoulder_R', 'Rib_RoofEdge_L', 'Rib_RoofEdge_R'];
const ARCH_NAMES = ['Arch_Bow', 'Arch_Mid', 'Arch_Aft'];
const FOLD_MEMBER_NAMES = [...RIB_NAMES, 'Arch_Mid'];
const MEMBER_NAMES = [...SILL_NAMES, ...RIB_NAMES, ...ARCH_NAMES];

const GLASS_NAME = 'Canopy_Glass';
const BULKHEAD_NAME = 'Bulkhead_Aft';
const FLOOR_NAME = 'Floor_Pan';
const HULL_NAMES = [BULKHEAD_NAME, FLOOR_NAME];
const FRAME_MATERIAL = 'Mat_Frame';
const EYE_NODE_NAME = 'Eye_Point';
const PART_NAMES = [
  ...SCREEN_NAMES, ...BODY_NAMES, ...ARM_NAMES, ...MEMBER_NAMES, ...HULL_NAMES, GLASS_NAME,
];

// EXHAUSTIVE. Every node the exported file may contain — nothing else is allowed, not
// "nothing else named Screen_*". The whole inventory is enumerated here because the
// failure mode this replaces is a node nobody thought to name: a stray Cube from an
// interactive Blender session, a ScreenBody_UL_001 duplicated by a partial re-run, an
// empty left behind by a deleted parent. Extras are not cosmetic — they are rendered in
// the lab, counted by the occlusion predictor, and shipped in the GLB.
const EXPECTED_NODE_NAMES = [EYE_NODE_NAME, ...PART_NAMES];

// Expected sign of (x, y) for each screen centre in glTF axes. Left/right are the
// PILOT's. Looking forward down -Z with +Y up, the pilot's right hand points along +X
// and their left along -X — so "UL" (upper-left) sits at (-x, +y) and "LR"
// (lower-right) at (+x, -y). Same convention names the ribs: Canopy_Rib_L is at -x.
const QUADRANTS = {
  Screen_UL: [-1, +1],
  Screen_UR: [+1, +1],
  Screen_LL: [-1, -1],
  Screen_LR: [+1, -1],
};
const RIB_SIDES = {
  Sill_L: -1, Rib_Shoulder_L: -1, Rib_RoofEdge_L: -1,
  Sill_R: +1, Rib_Shoulder_R: +1, Rib_RoofEdge_R: +1,
};

const MAX_SCREEN_ANGLE_DEG = 20; // contract AC-FORM

// The FOV the framing is judged against, from src/ui/Settings.js:40 via the contract.
// These are the TEST's authority, not the sidecar's: a generator that quietly retuned
// its own GAME_FOV_DEG would otherwise move the goalposts for the arm-root check.
const GAME_FOV_DEG = 70;
const GAME_ASPECT = 16 / 9;
const FRUSTUM = GLB.frustumTanExtents(GAME_FOV_DEG, GAME_ASPECT);

// Max's re-spec, in the units he used. The test file owns these because they are the
// spec, not an output: "screens about 50% bigger", "about one inch bezel and two inches
// thick backing".
const INCH = 0.0254;
const PREV_FACE_W = 0.30;
const PREV_FACE_H = 0.20;
const MIN_FACE_AREA = 1.5 * PREV_FACE_W * PREV_FACE_H; // 0.09 m^2
// How far a DECLARED constant may drift from the inch Max named before the declaration
// itself is wrong (as opposed to the geometry disagreeing with it). Wide on purpose —
// "about one inch" is not "exactly 25.4 mm" — but nowhere near wide enough to admit a
// bezel that reads as a frame or a body that reads as a panel.
const INCH_BAND = 0.5;

// Vertex-level containment slack, metres. Coordinates are float32 at ~1.5 m, so the
// storage noise floor is ~1e-7 m; 0.1 mm is generous for "flush against the surface"
// while still nearly three orders of magnitude tighter than the authoring mistake this
// was written against (92 mm through the canopy plane, 87 mm through the pillar).
const VERTEX_TOL = 1e-4;
// Agreement between a measured dimension and the constant the script declares for it.
// 1 mm: three orders of magnitude above float32 noise, an order of magnitude below the
// smallest thing being measured (a 25 mm bezel).
const DIMENSION_TOL = 1e-3;
// Thickness of the slab of body vertices treated as lying on the front (bezel) plane.
const FRONT_SLAB_TOL = 1e-3;
// A rib is a strip laid ON the shell, so its far face stands off by its own thickness.
// The tolerance is derived per-rib from that measured thickness plus this margin, rather
// than being a literal — a rib floating 0.3 m off the canopy still fails loudly.
const RIB_ON_SHELL_MARGIN = 0.02;
// Fraction of a rib's vertices that must lie on the shell. Not 100%: a rib that runs a
// little past the glass onto the hull at its foot is legitimate, a rib that floats is not.
const RIB_ON_SHELL_FRACTION = 0.9;
// How close an arm must come to the screen box it carries. Generous: this is an
// anti-vacuity check (an arm floating in space outside the frustum would otherwise
// satisfy the root-outside-the-frame assertion trivially), not a joinery spec.
const ARM_ATTACH_TOL = 0.10;
// How far an arm's MOUNT PLATE may sit from the member it claims to bolt to. Tight,
// unlike ARM_ATTACH_TOL: the generator places the plate ON that member's inboard face, so
// anything measurable here means it is bolted to nothing.
const ARM_MOUNT_TOL = 0.02;
// Minimum turn between an arm's two booms for it to read as ARTICULATED rather than as
// one bent bar. Max asked for modelled monitor arms; a stick with a kink is not one.
const ARM_MIN_BEND_DEG = 12;

// ── Seam members: two sill rails, four ribs, three arches ───────────────────
// "Fairly thin" is the brief, measured as smallest bounding extent over largest. 0.34
// admits the bow arch -- the heaviest section in the model -- and rejects a slab.
const MEMBER_THIN_RATIO = 0.34;
// How far a member's vertex may sit from the nearest FOLD edge of the glass. A member
// STRADDLES its seam and stands inboard of it, so this admits half its width plus its
// depth; what it rejects is a member lying somewhere else entirely.
const MEMBER_SEAM_TOL = 0.16;
// Displacement used to prove the seam instrument can register a defect. Well clear of
// MEMBER_SEAM_TOL, or the anti-vacuity check is itself vacuous.
const PLANTED_SEAM_OFFSET = 0.60;
// Fraction of a member's vertices whose eye-ray must actually meet the shell before the
// SIDED result means anything. Members running out to the rim legitimately leave the
// glazed cone at their ends; those vertices are skipped rather than counted either way.
const MEMBER_SIDED_MIN_FRACTION = 0.40;
// How far outboard of the glass a member vertex may sit. Its outer corners ride right on
// the surface by design; what must not happen is breaking THROUGH.
const MEMBER_OUTBOARD_TOL = 0.02;

// ── The enclosure measurement (AC-FORM a) ──────────────────────────────────
// Sphere sampling for "does turning the head find cockpit, or empty space?". Coarser
// than the generator's own grid on purpose: this is an independent confirmation that
// runs on every invocation, not a re-derivation of the generator's arithmetic.
const SPHERE_LAT = 30;
const SPHERE_LON = 60;
const SECTOR_HALF_ANGLE_DEG = 45;
// Minimum coverage looking ABOVE / LEFT / RIGHT / BEHIND. The flat window this replaces
// scored near zero in all four, so this is the assertion that separates the form Max
// rejected from the one he asked for.
const ENCLOSURE_SECTOR_MIN = 0.90;
// ...and the forward aperture must NOT read as covered, or the instrument cannot tell an
// opening from hull and every figure above would be meaningless.
const APERTURE_MAX_COVERAGE = 0.75;
// |dot| above which two faces sharing an edge are treated as COPLANAR — i.e. that edge is
// a quad's internal tessellation diagonal, not a fold. Without this the diagonals of every
// panel would count as seams and "a rib lies on a seam" would be nearly free.
const FOLD_COPLANAR_DOT = 0.999;
// Fraction of a rib's vertices whose eye-ray must actually meet the shell before the
// SIDED containment result means anything. Not 0.9: a rib that runs onto the perimeter
// frame at its ends legitimately leaves the glazed cone there, and those vertices are
// skipped rather than counted either way.
const RIB_SIDED_MIN_FRACTION = 0.5;
// Minimum forward bulge of the canopy shell beyond its own rim for "protruding" to mean
// anything. A flat shell spanning the opening measures 0 here.
const MIN_CANOPY_PROTRUSION = 0.02;

// ── Canopy_Frame, the perimeter band ────────────────────────────────────────
// Spacing at which the canopy rim is sampled before asking "is there frame here?". The
// band's own VERTICES cluster at its corners — a perfectly good four-sided frame has
// none at all along the middle of its bottom run — so the question has to be asked from
// the rim's side, densely, not from the frame's.
const RIM_SAMPLE_SPACING = 0.05;
// How far a rim sample may be from the frame solid, and vice versa. GENEROUS on purpose:
// this is a TOPOLOGY check ("is there frame along this stretch of the edge at all?"), not
// a joinery spec, and the defect it exists for — a missing bottom sill on a 2.9 m opening
// — is more than a metre, an order of magnitude clear of this.
const FRAME_RIM_TOL = 0.25;
// Share of the frame's own geometry that must sit near the rim, so a "frame" that is
// really a plate across the opening fails even though it covers the rim. A plate spanning
// this canopy measures exactly 0.80 (its eight corners and the eight side-face centroids
// are on the rim; only the four centroids of its front and back faces are not), so the
// floor is set above that rather than at it.
const FRAME_ON_RIM_FRACTION = 0.85;
// How far the frame's bounding box may fall short of the rim's on any axis. The band
// straddles the rim, so it normally OVERSHOOTS by half its width.
const FRAME_RIM_SPAN_TOL = 0.10;
// "Fairly thin", as a ratio: the band's equivalent cross-section side (recovered as
// sqrt(volume / run), since a closed ring's bounding box says nothing about its width)
// against the run it covers. 0.02 of a ~15 m perimeter is a 0.30 m section — a ceiling,
// not a target. The declared-constant check below is the sharper of the two.
const FRAME_THIN_RATIO = 0.02;
// Max briefed the frame's width as "a named constant in the same ballpark as RIB_WIDTH".
// This is the test file being the AUTHORITY, in the same idiom as the inch check: a
// generator that declared a 0.5 m "thin band" and built one would otherwise satisfy every
// geometry-vs-sidecar comparison in this file.
const FRAME_WIDTH_VS_RIB = [0.5, 3.0];
// And the measured section against that declaration. Wide because the section is
// recovered as sqrt(width x depth) — a band 0.065 wide and 0.25 deep measures 1.96x its
// declared WIDTH and is still a thin band.
const FRAME_SECTION_VS_DECLARED = [0.4, 2.5];
// insideShellFromEye measures overshoot ALONG THE RAY, so a depth error at the corner of
// the opening is amplified by 1/cos of the angle off the view axis — at this canopy's rim
// corner (2.35, 1.54, -1.70) that is 1.93x. A band straddling the shell may therefore read
// up to ~2x its own section outboard while being correctly placed. 3x leaves headroom and
// still fires on a band bolted 0.1 m proud of the glass.
const FRAME_SIDED_RAY_FACTOR = 3.0;
// Admissible spellings for the two width constants the frame is judged by. The generator
// names its own constants; the contract names the QUANTITY.
const FRAME_WIDTH_NAMES = [
  'CANOPY_FRAME_WIDTH', 'FRAME_WIDTH', 'PERIMETER_FRAME_WIDTH', 'PERIMETER_WIDTH',
  'FRAME_BAND_WIDTH', 'FRAME_W', 'SILL_WIDTH',
];
const RIB_WIDTH_NAMES = ['RIB_WIDTH', 'CANOPY_RIB_WIDTH', 'RIB_W'];
// Share of a rib's run treated as its end region when asking whether it lands on the
// frame. 5% of a ~2.9 m rib is ~0.15 m of end.
const RIB_END_FRACTION = 0.05;
// How close a rib's end must come to the frame solid to count as terminating ON it. The
// rib stands off inboard of the glass by its own depth, so a rib butted against a band
// sitting at the rim reads a few centimetres out even when correctly joined. The defect
// this exists for — ribs that reach nothing, the "monitors on two lamp-posts" read — is
// the full standoff from the rim, not centimetres.
const RIB_TERMINATION_TOL = 0.10;

/**
 * EXACT set comparison in both directions, plus duplicates.
 *
 * Written as a pure function rather than inline so the planted defect it exists for can
 * be exercised directly (see the self-test below). The version this replaces asked only
 * "is each expected name present?", which is satisfied by a file containing anything at
 * all as long as it also contains the right things.
 */
function compareNameSets(actual, expected) {
  const counts = new Map();
  for (const n of actual) counts.set(n, (counts.get(n) ?? 0) + 1);
  const expectedSet = new Set(expected);
  return {
    missing: expected.filter((n) => !counts.has(n)).slice().sort(),
    unexpected: [...counts.keys()].filter((n) => !expectedSet.has(n)).sort(),
    duplicates: [...counts.entries()].filter(([, c]) => c > 1).map(([n, c]) => `${n} x${c}`).sort(),
  };
}

const NO_NAME_DIFF = { missing: [], unexpected: [], duplicates: [] };

/** Human-readable form of a compareNameSets result, for the failure message. */
function describeNameDiff(diff) {
  const lines = [];
  if (diff.missing.length) lines.push(`  MISSING (expected, not found): ${diff.missing.join(', ')}`);
  if (diff.unexpected.length) lines.push(`  UNEXPECTED (found, not expected): ${diff.unexpected.join(', ')}`);
  if (diff.duplicates.length) lines.push(`  DUPLICATED: ${diff.duplicates.join(', ')}`);
  return lines.join('\n') || '  (no difference)';
}

// Spellings the generator might plausibly use for its per-part glass occlusion term. Only
// used to make the failure message actionable — the check itself is a pattern match, so a
// spelling not on this list is fine as long as it names the glass and its occlusion.
const GLASS_OCCLUSION_KEY_EXAMPLES = [
  'predictedOcclusionByCanopyGlass', 'canopyGlassOcclusion', 'occlusionFromGlass',
];

/**
 * The generator's own per-part occlusion term(s) for the canopy glass.
 *
 * Pure, and returning a LIST rather than looping internally, because the bug this
 * replaces was that an empty list read as success: the old inline version filtered
 * diagnostics and looped over the result, so a sidecar declaring no glass key at all
 * passed vacuously. The caller must assert the list is non-empty first.
 */
function glassOcclusionTerms(metrics) {
  return Object.entries(metrics?.diagnostics ?? {})
    .filter(([k, v]) => /glass/i.test(k) && /occl/i.test(k) && typeof v === 'number');
}

/**
 * Read a script-declared constant out of the sidecar, tolerating SCREAMING_SNAKE or
 * camelCase spelling and an optional `constants` sub-object. Throws (rather than
 * silently defaulting) when the sidecar fails to declare something the contract says
 * it must — a missing declaration is itself an AC failure.
 */
function declared(metrics, name) {
  const camel = name.toLowerCase().replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  const candidates = [name, camel, name.toLowerCase()];
  for (const pool of [metrics, metrics.constants, metrics.declared]) {
    if (!pool || typeof pool !== 'object') continue;
    for (const key of candidates) {
      if (typeof pool[key] === 'number') return pool[key];
    }
  }
  return undefined;
}

/**
 * The first of several admissible spellings the sidecar actually declares.
 *
 * The generator names its own constants; the contract names the QUANTITY ("a ~1 inch
 * bezel", "a ~2 inch deep body"). Accepting a small set of spellings keeps the test
 * asserting the quantity rather than a spelling, and the error names every spelling it
 * tried so a rename is a two-second fix rather than a mystery.
 *
 * `extra` is searched first: per-screen sidecar entries may carry the value locally.
 */
function declaredAny(metrics, names, { label, extra = null } = {}) {
  if (extra && typeof extra === 'object') {
    for (const key of Object.keys(extra)) {
      const norm = key.toLowerCase();
      for (const n of names) {
        if (norm === n.toLowerCase().replace(/_/g, '') || norm === n.toLowerCase()) {
          if (typeof extra[key] === 'number') return extra[key];
        }
      }
    }
  }
  for (const n of names) {
    const v = declared(metrics, n);
    if (v !== undefined) return v;
  }
  throw new Error(
    `cockpit-metrics.json does not declare ${label ?? names[0]}. Tried: ${names.join(', ')} `
    + '(top level, .constants, .declared, camelCase, and the per-screen entry). The Blender '
    + 'script must write every named constant to the sidecar — the tests assert geometry '
    + 'against script-declared values, not against literals copied into a test file.',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The instrument itself. Always runs — synthetic geometry with known answers, so a
// broken parser fails loudly instead of turning every assertion below green.
// ─────────────────────────────────────────────────────────────────────────────

/** Hand-assembled minimal GLB: one node "Probe" at +1 Y holding one triangle. */
function buildSyntheticGLB() {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, -1]);
  const indices = new Uint16Array([0, 1, 2]);
  const posBytes = new Uint8Array(positions.buffer);
  const idxBytes = new Uint8Array(indices.buffer);
  const idxOffset = posBytes.byteLength; // 36, already 4-aligned
  const binLength = idxOffset + idxBytes.byteLength;
  const binPadded = binLength + ((4 - (binLength % 4)) % 4);

  const json = {
    asset: { version: '2.0', generator: 'cockpit-geometry.test.js synthetic' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'Probe', translation: [0, 1, 0], mesh: 0 }],
    meshes: [{ name: 'ProbeMesh', primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, -1], max: [1, 0, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.byteLength },
    ],
    buffers: [{ byteLength: binPadded }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = jsonBytes.byteLength + ((4 - (jsonBytes.byteLength % 4)) % 4);
  const total = 12 + 8 + jsonPadded + 8 + binPadded;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonPadded, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonPadded); // JSON pads with spaces
  const binChunk = 20 + jsonPadded;
  dv.setUint32(binChunk, binPadded, true);
  dv.setUint32(binChunk + 4, 0x004e4942, true); // 'BIN\0'
  out.set(posBytes, binChunk + 8);
  out.set(idxBytes, binChunk + 8 + idxOffset);
  return out;
}

/**
 * Axis-aligned box as a world-space triangle list, wound so every face normal points
 * OUT of the box (or, with `flip`, into it — the convention a ring solid's inner wall
 * uses, and the one the half-space containment self-test below relies on).
 */
function boxTriangles(min, max, { flip = false } = {}) {
  const tris = [];
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const w = (axis + 2) % 3;
    for (const side of [0, 1]) {
      const corner = (su, sw) => {
        const p = [0, 0, 0];
        p[axis] = side ? max[axis] : min[axis];
        p[u] = su ? max[u] : min[u];
        p[w] = sw ? max[w] : min[w];
        return p;
      };
      // (u, w, axis) is a cyclic permutation, so e_u x e_w = e_axis: this ring is CCW
      // seen from +axis and its winding normal is +e_axis.
      let ring = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)];
      if (!side) ring = ring.slice().reverse(); // the min-side face points at -e_axis
      if (flip) ring = ring.slice().reverse();
      tris.push({ a: ring[0], b: ring[1], c: ring[2] });
      tris.push({ a: ring[0], b: ring[2], c: ring[3] });
    }
  }
  return tris;
}

/** A rectangle in the z = `atZ` plane, `w` x `h`, rotated by `roll` about its normal. */
function rectangleTriangles(w, h, atZ, roll = 0) {
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const at = (sx, sy) => {
    const x = (sx * w) / 2;
    const y = (sy * h) / 2;
    return [x * cos - y * sin, x * sin + y * cos, atZ];
  };
  const p00 = at(-1, -1); const p10 = at(1, -1); const p11 = at(1, 1); const p01 = at(-1, 1);
  // CCW seen from +Z, so the winding normal is +Z.
  return [{ a: p00, b: p10, c: p11 }, { a: p00, b: p11, c: p01 }];
}

describe('GLB parse harness (instrument self-test — runs with or without the cockpit artefacts)', () => {
  const bytes = buildSyntheticGLB();

  it('parses the container header and both chunks', () => {
    const { json, bin } = GLB.parseGLB(bytes);
    expect(json.asset.version).toBe('2.0');
    expect(bin.byteLength).toBeGreaterThanOrEqual(42);
    expect(GLB.findNode(json, 'Probe').index).toBe(0);
    expect(GLB.listMeshes(json)[0].name).toBe('ProbeMesh');
  });

  it('decodes accessors exactly', () => {
    const { json, bin } = GLB.parseGLB(bytes);
    const pos = GLB.readAccessor(json, bin, 0);
    expect(pos.count).toBe(3);
    expect(Array.from(pos.array)).toEqual([0, 0, 0, 1, 0, 0, 0, 0, -1]);
    expect(Array.from(GLB.readAccessor(json, bin, 1).array)).toEqual([0, 1, 2]);
    expect(GLB.accessorMinMax(json, 0)).toEqual({ min: [0, 0, -1], max: [1, 0, 0] });
  });

  it('composes world transforms and applies them to geometry', () => {
    const { json, bin } = GLB.parseGLB(bytes);
    const world = GLB.nodeWorldMatrix(json, 0);
    expect(GLB.matrixTranslation(world)).toEqual([0, 1, 0]);
    expect(GLB.matrixScale(world).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 1, 1]);
    const tris = GLB.nodeWorldTriangles(json, bin, 0);
    expect(tris).toHaveLength(1);
    expect(tris[0].a).toEqual([0, 1, 0]);
    expect(tris[0].c).toEqual([0, 1, -1]);
  });

  it('derives the winding normal, the centroid and the bounding box', () => {
    const { json, bin } = GLB.parseGLB(bytes);
    const tris = GLB.nodeWorldTriangles(json, bin, 0);
    // CCW winding of (0,0,0)->(1,0,0)->(0,0,-1) faces +Y.
    expect(GLB.triangleListNormal(tris).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 1, 0]);
    const c = GLB.triangleListCentroid(tris);
    expect(c[0]).toBeCloseTo(1 / 3, 6);
    expect(c[1]).toBeCloseTo(1, 6);
    expect(c[2]).toBeCloseTo(-1 / 3, 6);
    const box = GLB.sceneBoundingBox(json, bin);
    expect(box.min).toEqual([0, 1, -1]);
    expect(box.max).toEqual([1, 1, 0]);
  });

  it('measures angles the way AC-FORM does, including the winding-flip case', () => {
    expect(GLB.angleBetweenDegrees([0, 0, -1], [0, 0, -1])).toBeCloseTo(0, 9);
    expect(GLB.angleBetweenDegrees([0, 0, -1], [0, 1, 0])).toBeCloseTo(90, 9);
    expect(GLB.angleBetweenDegrees([0, 0, -1], [0, 0, 1])).toBeCloseTo(180, 9);
  });

  it('groups coplanar faces into planes, and keeps genuinely distinct ones apart', () => {
    const tris = [
      // one unit square in the y=0 plane, split into two triangles, both facing +Y
      { a: [0, 0, 0], b: [1, 0, 0], c: [1, 0, -1] },
      { a: [0, 0, 0], b: [1, 0, -1], c: [0, 0, -1] },
      // same normal, different offset -> a separate plane
      { a: [0, 1, 0], b: [1, 1, 0], c: [1, 1, -1] },
      // same offset, opposite winding -> also a separate plane (it bounds from the other side)
      { a: [0, 0, 0], b: [1, 0, -1], c: [1, 0, 0] },
    ];
    const planes = GLB.trianglePlanes(tris);
    expect(planes).toHaveLength(3);

    expect(planes[0].triangleCount).toBe(2);
    expect(planes[0].area).toBeCloseTo(1, 9);
    expect(planes[0].d).toBeCloseTo(0, 9);
    planes[0].normal.forEach((v, i) => expect(v).toBeCloseTo([0, 1, 0][i], 9));
    expect(planes[1].d).toBeCloseTo(1, 9);
    planes[2].normal.forEach((v, i) => expect(v).toBeCloseTo([0, -1, 0][i], 9));

    expect(GLB.signedDistanceToPlane(planes[0], [0.5, 2, -0.5])).toBeCloseTo(2, 9);
    expect(GLB.signedDistanceToPlane(planes[0], [0.5, -3, -0.5])).toBeCloseTo(-3, 9);
  });

  it('turns a closed solid into the half-spaces that bound it', () => {
    const planes = GLB.trianglePlanes(boxTriangles([-1, -1, -1], [1, 1, 1]));
    expect(planes).toHaveLength(6);
    for (const p of planes) {
      expect(p.area).toBeCloseTo(4, 9);
      expect(p.d, 'every face of a 2 m box centred on the origin sits 1 m along its own normal')
        .toBeCloseTo(1, 9);
      expect(GLB.signedDistanceToPlane(p, [0, 0, 0]), 'outward normals put the centre INSIDE every face')
        .toBeCloseTo(-1, 9);
    }
    expect(planes.some((p) => GLB.signedDistanceToPlane(p, [0, 5, 0]) > 0),
      'a point outside the box must be outside at least one face').toBe(true);
  });

  it('reads an inward-wound shell as a cavity (the enclosure convention)', () => {
    // A shell wound so its normals point into the hole makes "inside" the intersection
    // of the POSITIVE half-spaces. Kept as documentation of the convention even though
    // the frame ring that used it is gone: it is what any future enclosure check reads.
    const planes = GLB.trianglePlanes(boxTriangles([-1, -1, -1], [1, 1, 1], { flip: true }));
    expect(planes).toHaveLength(6);
    const inside = (p) => planes.every((pl) => GLB.signedDistanceToPlane(pl, p) >= 0);
    expect(inside([0, 0, 0])).toBe(true);
    expect(inside([0.9, -0.9, 0.9])).toBe(true);
    expect(inside([1.1, 0, 0]), 'a point through the wall must read as outside').toBe(false);
  });

  it('measures triangle-list area, which is how a display face is sized', () => {
    expect(GLB.triangleListArea(rectangleTriangles(0.45, 0.30, -1.2))).toBeCloseTo(0.135, 9);
    expect(GLB.triangleListArea(rectangleTriangles(0.45, 0.30, -1.2, 0.7)),
      'area is orientation-independent — a rolled panel is not a bigger panel').toBeCloseTo(0.135, 9);
    expect(GLB.triangleListArea(boxTriangles([0, 0, 0], [2, 2, 2])),
      'a 2 m cube has six 4 m^2 faces').toBeCloseTo(24, 9);
  });

  it('finds the open boundary of a shell, and reports none for a closed solid', () => {
    // A quad split into two triangles: the shared diagonal is used twice and drops out,
    // leaving exactly the four sides. That is what lets planarFrame recover a panel's
    // own axes instead of its diagonal.
    const quad = GLB.boundaryEdges(rectangleTriangles(0.4, 0.2, 0));
    expect(quad).toHaveLength(4);
    const lengths = quad.map((e) => Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]))
      .map((v) => Math.round(v * 1e6) / 1e6).sort((a, b) => a - b);
    expect(lengths).toEqual([0.2, 0.2, 0.4, 0.4]);
    expect(GLB.boundaryEdges(boxTriangles([0, 0, 0], [1, 1, 1])),
      'a closed box has no rim').toHaveLength(0);
  });

  it('recovers a panel\'s own oriented rectangle, whatever its roll', () => {
    // INSTRUMENT PROOF for the bezel measurement: the frame must come out the same for a
    // rolled panel as for an axis-aligned one, or a "bezel" would just be measuring tilt.
    for (const roll of [0, 0.35, 1.2, -0.9]) {
      const frame = GLB.planarFrame(rectangleTriangles(0.45, 0.30, -1.2, roll));
      expect(frame.halfU, `roll ${roll}: long half-extent`).toBeCloseTo(0.225, 6);
      expect(frame.halfW, `roll ${roll}: short half-extent`).toBeCloseTo(0.150, 6);
      expect(frame.centre[2]).toBeCloseTo(-1.2, 9);
      expect(GLB.angleBetweenDegrees(frame.normal, [0, 0, 1]), 'winding normal is +Z').toBeCloseTo(0, 6);
      // u, w, normal are right-handed and mutually perpendicular.
      expect(frame.u[0] * frame.w[0] + frame.u[1] * frame.w[1] + frame.u[2] * frame.w[2]).toBeCloseTo(0, 9);
    }
    // frameCoords/frameExtents put a bigger concentric rectangle symmetrically outside.
    const frame = GLB.planarFrame(rectangleTriangles(0.45, 0.30, -1.2, 0.4));
    const outer = rectangleTriangles(0.45 + 2 * INCH, 0.30 + 2 * INCH, -1.2, 0.4)
      .flatMap((t) => [t.a, t.b, t.c]);
    const ext = GLB.frameExtents(frame, outer);
    expect(ext.u.max - 0.225, 'a 1-inch surround reads as 1 inch on every side').toBeCloseTo(INCH, 6);
    expect(ext.w.max - 0.150).toBeCloseTo(INCH, 6);
    expect(ext.n.max, 'a coplanar rectangle has no depth in this frame').toBeCloseTo(0, 6);
  });

  it('projects into the pilot\'s tan-space and classifies the view frame', () => {
    expect(GLB.tanSpaceProject([0, 0, -2]), 'straight ahead is the centre of the frame').toEqual([0, 0]);
    expect(GLB.tanSpaceProject([1, 0.5, -1])).toEqual([1, 0.5]);
    expect(GLB.tanSpaceProject([2, 1, -2]), 'tan-space is scale-invariant along the ray').toEqual([1, 0.5]);
    expect(GLB.tanSpaceProject([0, 0, 0]), 'a point AT the eye has no projection').toBeNull();
    expect(GLB.tanSpaceProject([0.2, 0, 0.5]), 'a point behind the eye has no projection').toBeNull();

    const f = GLB.frustumTanExtents(70, 16 / 9);
    expect(f.tanV).toBeCloseTo(Math.tan((35 * Math.PI) / 180), 12);
    expect(f.tanH).toBeCloseTo(f.tanV * (16 / 9), 12);
    expect(GLB.insideTanFrame([0, 0, -1], f)).toBe(true);
    expect(GLB.insideTanFrame([f.tanH * 0.99, 0, -1], f)).toBe(true);
    expect(GLB.insideTanFrame([f.tanH * 1.01, 0, -1], f), 'past the left/right edge').toBe(false);
    expect(GLB.insideTanFrame([0, f.tanV * 1.01, -1], f), 'past the top edge').toBe(false);
    expect(GLB.insideTanFrame([0, 0, 0.5], f), 'behind the eye is out of view at any FOV').toBe(false);
  });

  it('measures distance to a surface, in the face, edge and vertex cases', () => {
    const tri = [{ a: [0, 0, 0], b: [1, 0, 0], c: [0, 1, 0] }];
    expect(GLB.distanceToTriangleList(tri, [0.2, 0.2, 0.5]).distance,
      'hovering over the face').toBeCloseTo(0.5, 9);
    expect(GLB.distanceToTriangleList(tri, [-1, 0, 0]).distance,
      'beyond a vertex, in the plane').toBeCloseTo(1, 9);
    expect(GLB.distanceToTriangleList(tri, [0.5, -1, 0]).distance,
      'beyond an edge, in the plane').toBeCloseTo(1, 9);
    expect(GLB.distanceToTriangleList(tri, [0.25, 0.25, 0]).distance,
      'a point on the surface is at zero').toBeCloseTo(0, 9);
    const shell = rectangleTriangles(1, 1, -1.5);
    expect(GLB.distanceToTriangleList(shell, [0, 0, -1.47]).distance).toBeCloseTo(0.03, 9);
    expect(GLB.distanceToTriangleList(shell, [0, 0, -1.0]).distance,
      'a rib floating 0.5 m off the shell reads as 0.5 m').toBeCloseTo(0.5, 9);
  });

  it('casts a ray at a surface, which is how "inside the canopy" is decided', () => {
    const shell = rectangleTriangles(2, 2, -3);
    const straight = GLB.rayTriangleListHits(EYE, [0, 0, -1], shell);
    // A ray landing exactly on the diagonal the quad was split along registers against
    // BOTH triangles — inclusive edge tests are what stop a ray leaking through a seam.
    // Harmless here and everywhere it is used, because callers read the NEAREST hit.
    expect(straight.length).toBeGreaterThanOrEqual(1);
    expect(straight[0], 'nearest hit is the shell, 3 m ahead').toBeCloseTo(3, 9);
    const offCentre = GLB.rayTriangleListHits(EYE, [0.3, 0.2, -1], shell);
    expect(offCentre, 'a ray through one triangle\'s interior hits once').toHaveLength(1);
    expect(offCentre[0]).toBeCloseTo(Math.hypot(0.9, 0.6, 3), 9);
    expect(GLB.rayTriangleListHits(EYE, [0, 1, 0], shell), 'a miss returns nothing').toEqual([]);
    expect(GLB.rayTriangleListHits(EYE, [0, 0, 1], shell),
      'the shell is behind the ray, not in front of it').toEqual([]);
    // Off the seam on purpose (an axial ray would cross both faces' split diagonals and
    // register four times, per the note above).
    const box = boxTriangles([-1, -1, -4], [1, 1, -2]);
    const through = GLB.rayTriangleListHits(EYE, [0.1, 0.05, -1], box);
    expect(through, 'a ray through a solid enters and exits').toHaveLength(2);
    expect(through[0], 'entering the near face').toBeCloseTo(Math.hypot(0.2, 0.1, 2), 9);
    expect(through[1], 'leaving the far face').toBeCloseTo(Math.hypot(0.4, 0.2, 4), 9);
    expect(GLB.distanceToBox({ min: [-1, -1, -1], max: [1, 1, 1] }, [0, 0, 0]),
      'inside a box is zero distance from it').toBe(0);
    expect(GLB.distanceToBox({ min: [-1, -1, -1], max: [1, 1, 1] }, [1, 1, 4])).toBeCloseTo(3, 9);
  });

  it('decides sidedness from the eye, which unsigned distance cannot', () => {
    // PLANTED-DEFECT PROOF for the rib and perimeter-frame containment checks.
    //
    // The two probes below are the SAME unsigned distance from the shell — one 0.1 m
    // inboard, one 0.1 m outboard, i.e. bolted to the outside of the canopy. That is
    // exactly the pair the old distanceToTriangleList check could not tell apart, and
    // why "the fraction stayed 1.0" for a rib on the wrong side of the glass.
    const shell = rectangleTriangles(4, 4, -3);
    expect(GLB.distanceToTriangleList(shell, [0, 0, -2.9]).distance,
      'unsigned distance reads the same for inboard...').toBeCloseTo(0.1, 9);
    expect(GLB.distanceToTriangleList(shell, [0, 0, -3.1]).distance,
      '...and for outboard. This is the blindness being fixed.').toBeCloseTo(0.1, 9);

    expect(GLB.insideShellFromEye(shell, [[0, 0, -2.9]]).worst.over,
      'inboard is NEGATIVE: reached 0.1 m before the shell').toBeCloseTo(-0.1, 9);
    expect(GLB.insideShellFromEye(shell, [[0, 0, -3.1]]).worst.over,
      'outboard is POSITIVE: reached 0.1 m after the shell').toBeCloseTo(0.1, 9);

    // A part punched THROUGH the shell has vertices on both sides; `worst` reports the
    // one that is furthest out, so a partial penetration is as red as a total one.
    const punched = GLB.insideShellFromEye(shell, [[0, 0, -2.9], [0, 0, -3.05], [0.1, 0.1, -3.2]]);
    expect(punched.tested).toBe(3);
    expect(punched.worst.over).toBeGreaterThan(0.19);

    // A vertex whose eye-ray misses the shell is SKIPPED, never silently counted inside.
    const past = GLB.insideShellFromEye(shell, [[10, 0, -1]]);
    expect(past.tested).toBe(0);
    expect(past.skipped).toBe(1);
    expect(past.worst.over).toBe(-Infinity);
  });

  it('measures a rim run, the distance to it, and the volume of a closed band', () => {
    // The instruments behind "fairly thin": a perimeter frame's bounding box says nothing
    // about its width, so the section is recovered as volume / run.
    const rim = GLB.boundaryEdges(rectangleTriangles(4, 2, -1.7));
    expect(rim).toHaveLength(4);
    expect(GLB.polylineLength(rim), 'a 4 x 2 m opening has a 12 m perimeter').toBeCloseTo(12, 9);
    expect(GLB.distanceToSegmentList(rim, [0, 1.05, -1.7]).distance,
      'just outside the top edge').toBeCloseTo(0.05, 9);
    expect(GLB.distanceToSegmentList(rim, [0, 0, -1.7]).distance,
      'the middle of the opening is a metre from the nearest edge').toBeCloseTo(1, 9);
    expect(GLB.closedMeshVolume(boxTriangles([-1, -1, -1], [1, 1, 1])),
      'a 2 m cube holds 8 m^3').toBeCloseTo(8, 9);
    expect(GLB.closedMeshVolume(boxTriangles([-1, -1, -1], [1, 1, 1], { flip: true })),
      'winding does not change how much material is in a solid').toBeCloseTo(8, 9);
    // volume / run recovers the section of a band: a 12 m run of 0.06 x 0.05 section.
    expect(Math.sqrt((12 * 0.06 * 0.05) / 12)).toBeCloseTo(Math.sqrt(0.003), 12);
  });

  it('samples a rim densely enough to notice a missing bottom run', () => {
    // PLANTED-DEFECT PROOF for "the frame follows the canopy edge the whole way round
    // INCLUDING THE BOTTOM". Asking the question from the FRAME's side does not work: a
    // four-sided band has vertices only at its corners, so any angular or per-vertex
    // histogram reports a perfectly good frame as full of holes. Asking it from the RIM's
    // side does: every sampled point along the edge must have frame near it.
    const rim = GLB.boundaryEdges(rectangleTriangles(4, 2, -1.7));
    const samples = GLB.sampleSegments(rim, { spacing: RIM_SAMPLE_SPACING });
    expect(samples.length, 'a 12 m rim at 5 cm spacing').toBeGreaterThan(200);
    const worstFull = Math.max(...samples.map((p) => GLB.distanceToSegmentList(rim, p).distance));
    expect(worstFull, 'a band covering the whole rim leaves no sample stranded').toBeLessThan(1e-9);

    // The defect: delete the lower run — the "no sill" cockpit.
    const noSill = rim.filter((e) => !(e.a[1] < -0.99 && e.b[1] < -0.99));
    expect(noSill).toHaveLength(3);
    const worstHoled = Math.max(...samples.map((p) => GLB.distanceToSegmentList(noSill, p).distance));
    expect(worstHoled, 'the missing sill strands rim samples 2 m from any frame').toBeGreaterThan(1.9);
    // ...while the bounding box is untouched, which is why a bbox check would not do.
    const ends = (segs) => GLB.boundsOfPoints(segs.flatMap((e) => [e.a, e.b]));
    expect(ends(noSill).min, 'the C-shape still reaches the bottom corners').toEqual(ends(rim).min);
  });

  it('finds the two ends of a long thin part along its own dominant axis', () => {
    // Behind "both ribs terminate ON the frame". The axis is derived from the geometry,
    // so a re-authored rib that kinks forward is still measured end-to-end.
    const bar = [];
    for (let i = 0; i <= 20; i++) {
      const y = -1.5 + (i * 3) / 20;
      bar.push([0.03, y, -1.2], [-0.03, y, -1.2 - 0.2 * Math.sin((i / 20) * Math.PI)]);
    }
    const ends = GLB.principalAxisEnds(bar, { fraction: 0.05 });
    expect(ends.axis, 'the bar runs in Y, not in the Z it bows through').toBe(1);
    expect(ends.span).toBeCloseTo(3, 9);
    expect(ends.low.length).toBeGreaterThan(0);
    expect(ends.high.length).toBeGreaterThan(0);
    expect(ends.low.every((p) => p[1] <= -1.35), 'the low end is the bottom 5%').toBe(true);
    expect(ends.high.every((p) => p[1] >= 1.35), 'the high end is the top 5%').toBe(true);
    expect(ends.low.some((p) => p[1] > 1), 'the two ends must not overlap').toBe(false);
    expect(GLB.principalAxisEnds([]), 'no points has no ends').toBeNull();
  });

  it('hashes geometry stably, and the hash actually responds to a moved vertex', () => {
    const a = GLB.hashGeometry(bytes);
    expect(a.positions).toMatch(/^[0-9a-f]{64}$/);
    expect(GLB.hashGeometry(bytes.slice()).positions).toBe(a.positions);

    const mutated = bytes.slice();
    const { json, bin } = GLB.parseGLB(mutated);
    const range = GLB.accessorByteRange(json, 0);
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    dv.setFloat32(range.start, dv.getFloat32(range.start, true) + 0.001, true);
    expect(GLB.hashGeometry(mutated).positions).not.toBe(a.positions);
  });

  it('rejects a non-GLB buffer with a diagnosable error', () => {
    expect(() => GLB.parseGLB(new Uint8Array(64))).toThrow(/Not a GLB/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The two pure helpers behind the assertions an adversarial review found could not fail.
// Both are exercised here against the exact defect that used to slip through, so the
// claim "this now catches it" is itself tested rather than asserted in a comment.
// ─────────────────────────────────────────────────────────────────────────────

describe('assertion helpers (planted-defect self-test — the checks that used to be unfalsifiable)', () => {
  it('reports extra, missing and duplicated names, not just missing ones', () => {
    // PLANTED DEFECT: the subset-shaped inventory this replaces accepted a file that
    // contained everything expected AND a stray "Cube" AND a "ScreenBody_UL_001" left
    // behind by a partial re-run. Only "missing" was ever computed.
    expect(compareNameSets(['A', 'B'], ['A', 'B'])).toEqual(NO_NAME_DIFF);
    expect(compareNameSets(['B', 'A'], ['A', 'B']), 'order is not part of the inventory').toEqual(NO_NAME_DIFF);

    const dirty = compareNameSets(['A', 'B', 'B', 'Cube', 'ScreenBody_UL_001'], ['A', 'B', 'C']);
    expect(dirty.missing, 'the old check saw this much and no more').toEqual(['C']);
    expect(dirty.unexpected, 'and was blind to exactly this').toEqual(['Cube', 'ScreenBody_UL_001']);
    expect(dirty.duplicates, 'a name used twice is two nodes, not one').toEqual(['B x2']);
    expect(describeNameDiff(dirty)).toMatch(/UNEXPECTED .*Cube/);
    expect(describeNameDiff(NO_NAME_DIFF)).toBe('  (no difference)');
  });

  it('treats a missing glass-occlusion term as absent, not as satisfied', () => {
    // PLANTED DEFECT: the old inline version filtered diagnostics for /glass/i AND
    // /occl/i and looped over the result. Given the sidecar below — real diagnostics, no
    // glass key anywhere — the loop body never executed and the test reported green,
    // which is how "the predictor excludes the glass" could be believed of a predictor
    // that said nothing about the glass at all.
    expect(
      glassOcclusionTerms({ diagnostics: { frameHalfAngleHorizontalDeg: 54, canopyMinDistance: 2.58 } }),
      'no glass term must read as ZERO terms — the caller has to fail on that, not iterate it',
    ).toEqual([]);
    expect(glassOcclusionTerms({}), 'no diagnostics object at all is also zero terms').toEqual([]);
    expect(glassOcclusionTerms(null)).toEqual([]);
    expect(
      glassOcclusionTerms({ diagnostics: { predictedOcclusionByCanopyGlass: '0' } }),
      'a string is a claim, not a measurement',
    ).toEqual([]);
    expect(glassOcclusionTerms({ diagnostics: { canopyGlassOcclusionFraction: 0, ribOcclusion: 0.03 } }),
      'and a real term is found whatever the exact spelling').toEqual([['canopyGlassOcclusionFraction', 0]]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The gate. Without this the whole artefact suite could skip itself green.
// ─────────────────────────────────────────────────────────────────────────────

describe('cockpit artefacts — the gate that stops this suite reporting green on zero bytes of GLB', () => {
  it.skipIf(missing.length > 0 && ARTEFACTS_OPTIONAL)(
    'exports cockpit.glb and cockpit-metrics.json into public/assets/cockpit/',
    () => {
      expect(missing, HOW_TO_GENERATE).toEqual([]);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// The contract ACs, against the real exported artefacts.
//
// Skipped when the artefacts are absent — but the gate above has already failed by
// then unless COCKPIT_ARTEFACTS_OPTIONAL=1 was set, so these skips can never be the
// whole story of a green run.
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(missing.length > 0)('cockpit.glb — increment 1 geometry (re-spec)', () => {
  let glbBytes;
  let gltf;
  let bin;
  let metrics;
  let glassTris;

  beforeAll(() => {
    glbBytes = readFileSync(GLB_PATH);
    const parsed = GLB.parseGLB(glbBytes);
    gltf = parsed.json;
    bin = parsed.bin;
    metrics = JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
  });

  // Every part is read NON-recursively. The named nodes each carry their own mesh (the
  // inventory test below pins that), so a recursive walk could only ever mix a screen
  // face into its body or an arm into its screen and make the measurements meaningless.
  const partTris = (name) => GLB.nodeWorldTriangles(gltf, bin, GLB.requireNode(gltf, name).index, { recursive: false });
  const partVerts = (name) => GLB.nodeWorldPositions(gltf, bin, GLB.requireNode(gltf, name).index, { recursive: false });
  const partBounds = (name) => GLB.boundsOfPoints(partVerts(name));
  const glass = () => {
    if (!glassTris) glassTris = partTris(GLASS_NAME);
    return glassTris;
  };
  /** Material names on a named part's own primitives, for the Mat_Frame check. */
  const partMaterials = (name) => {
    const { node } = GLB.requireNode(gltf, name);
    const mesh = (gltf.meshes ?? [])[node.mesh];
    return (mesh?.primitives ?? []).map((p) => (
      p.material === undefined ? '<no material>' : (gltf.materials?.[p.material]?.name ?? `<material #${p.material}>`)
    ));
  };
  /** The Canopy_Glass rim: its open boundary, and points sampled densely along it. */
  let rimCache;
  const rim = () => {
    if (!rimCache) {
      const edges = GLB.boundaryEdges(glass());
      rimCache = {
        edges,
        samples: GLB.sampleSegments(edges, { spacing: RIM_SAMPLE_SPACING }),
        run: GLB.polylineLength(edges),
        bounds: GLB.boundsOfPoints(edges.flatMap((e) => [e.a, e.b])),
      };
    }
    return rimCache;
  };

  /** World centroid + winding normal of a named display-face quad. */
  const screen = (name) => {
    const tris = partTris(name);
    return { tris, centre: GLB.triangleListCentroid(tris), normal: GLB.triangleListNormal(tris) };
  };

  /** The sidecar's own entry for a screen, or undefined. */
  const screenDecl = (name) => (metrics.screens ?? []).find((s) => s.name === name);

  /**
   * INDEPENDENT. Every dimension of one screen unit, measured in the display face's OWN
   * oriented frame rather than in world axes — the units are rotated to face the pilot,
   * so a world-axis bounding box would report the tilt, not the bezel.
   *
   * Frame axes: `u` the face's long side, `w` its short side, `n` its winding normal,
   * which AC-FORM requires to point at the eye. So along `n`, LARGER is nearer the
   * pilot: the body's max-n slab is its front (bezel) plane and the display face, which
   * sits at n = 0 by construction of the frame, must be behind it.
   */
  const unit = (suffix) => {
    const faceTris = partTris(`Screen_${suffix}`);
    const frame = GLB.planarFrame(faceTris);
    const faceVerts = partVerts(`Screen_${suffix}`);
    const bodyVerts = partVerts(`ScreenBody_${suffix}`);
    const face = GLB.frameExtents(frame, faceVerts);
    const body = GLB.frameExtents(frame, bodyVerts);
    const frontSlab = bodyVerts.filter((p) => body.n.max - GLB.frameCoords(frame, p)[2] <= FRONT_SLAB_TOL);
    const front = frontSlab.length >= 3 ? GLB.frameExtents(frame, frontSlab) : null;
    return {
      frame, faceTris, faceVerts, bodyVerts, face, body, front,
      frontSlabCount: frontSlab.length,
      faceWidth: 2 * frame.halfU,
      faceHeight: 2 * frame.halfW,
      faceArea: GLB.triangleListArea(faceTris),
      bodyDepth: body.n.max - body.n.min,
      recess: body.n.max - face.n.max,
      bezels: front ? {
        left: face.u.min - front.u.min,
        right: front.u.max - face.u.max,
        bottom: face.w.min - front.w.min,
        top: front.w.max - face.w.max,
      } : null,
    };
  };

  // ── AC-FORM ────────────────────────────────────────────────────────────────
  // "(a) FOUR SCREEN UNITS, one per quadrant ... each a BOX not a flat panel — a display
  //  face 50% larger than the previous 0.30x0.20 m panel, surrounded by a ~1 inch bezel
  //  and backed by a ~2 inch deep body, with the display face recessed so the bezel
  //  reads; each display face's normal points within 20 degrees of the vector from its
  //  centre to the eye-point ... (b) each screen carried by an ARM whose root lies
  //  demonstrably OUTSIDE the 70 degree / 16:9 view frustum ... (c) the canopy frame
  //  reduced to TWO VERTICAL RIBS following the canopy shell's surface ... (d) a
  //  Canopy_Glass shell node present ... NO ship nose — any Hull_Nose node is a failure."
  describe('AC-FORM — form language: boxy corner screens on arms, two canopy ribs, no nose', () => {
    it('contains EXACTLY the expected node inventory — nothing missing, nothing extra, nothing duplicated', () => {
      // INDEPENDENT, and EXHAUSTIVE. This replaces a subset-shaped check that only ever
      // asked "is each expected node present?" — so a stray Cube, a ScreenBody_UL_001
      // duplicated by a partial re-run, or a leftover empty was unconstrained unless it
      // happened to be named Screen_*, Canopy_Rib* or /nose/i. An extra node is not
      // cosmetic: it renders in the lab, it is counted by the occlusion predictor, and it
      // ships in the GLB.
      //
      // Unnamed nodes are listed as <unnamed #i> and are themselves unexpected: every
      // node in this file is a part the increments downstream address by name.
      const nodes = GLB.listNodes(gltf);
      const names = nodes.map((n) => n.name ?? `<unnamed #${n.index}>`);
      const diff = compareNameSets(names, EXPECTED_NODE_NAMES);
      expect(
        diff,
        `the GLB node set is not the expected inventory.\n${describeNameDiff(diff)}\n\n`
        + `expected exactly (${EXPECTED_NODE_NAMES.length}): ${EXPECTED_NODE_NAMES.join(', ')}\n`
        + `found (${names.length}): ${names.join(', ')}`,
      ).toEqual(NO_NAME_DIFF);
    });

    it('carries every named part on its own node: five-part arms, nine seam members, glass, bulkhead, floor', () => {
      const nodes = GLB.listNodes(gltf);
      const byName = new Map(nodes.filter((n) => n.name).map((n) => [n.name, n]));
      for (const name of PART_NAMES) {
        const hits = nodes.filter((n) => n.name === name);
        expect(
          hits.length,
          `expected exactly one node named "${name}", found ${hits.length}. Nodes present: `
          + `${nodes.map((n) => n.name ?? `<unnamed #${n.index}>`).join(', ')}`,
        ).toBe(1);
        // The mesh must hang off the named node itself. Increment 2's CRT material
        // targets Screen_* by name, and every measurement below reads each part
        // non-recursively — a part whose geometry lived on an unnamed child would
        // measure as empty rather than wrong.
        expect(
          hits[0].node.mesh,
          `node "${name}" carries no mesh of its own (geometry parented to a child would make `
          + 'every measurement below silently empty)',
        ).toBeDefined();
      }
      // Every seam member is a distinct node. The member set is what AC-FORM(b) is
      // measured over, so a doubled or missing one would silently inflate or shrink every
      // seam assertion below.
      const memberIndices = new Set(MEMBER_NAMES.map((n) => byName.get(n).index));
      expect(memberIndices.size, 'every seam member must be its own distinct node')
        .toBe(MEMBER_NAMES.length);

      // Each arm is FIVE parts. Four single sticks would satisfy "an arm per screen"
      // while being exactly the form Max rejected, so the count is pinned per quadrant.
      for (const q of QUADRANT_SUFFIXES) {
        const parts = nodes
          .filter((n) => new RegExp(`^Arm_${q}_`).test(n.name ?? ''))
          .map((n) => n.name).sort();
        expect(
          parts,
          `Arm_${q} must be modelled as ${ARM_PART_SUFFIXES.length} parts `
          + `(${ARM_PART_SUFFIXES.join(', ')}), found ${parts.length}. A single strut is the form Max `
          + 'rejected: "we need to model their arms though".',
        ).toEqual(ARM_PART_SUFFIXES.map((p) => `Arm_${q}_${p}`).sort());
      }

      // Nothing may still be named for the flat-window era's members.
      const stale = nodes.map((n) => n.name ?? '').filter((n) => /^Canopy_Rib/.test(n));
      expect(stale, 'Canopy_Rib_* belonged to the flat window; members are now named for their seam')
        .toEqual([]);
      // No named part may be a descendant of another, or non-recursive reads would be
      // reading a different subtree than the recursive scene walk does.
      const parents = GLB.buildParentMap(gltf);
      for (const name of PART_NAMES) {
        const p = parents[byName.get(name).index];
        const parentName = p === -1 ? null : gltf.nodes[p]?.name;
        expect(
          PART_NAMES.includes(parentName ?? ''),
          `"${name}" is parented to "${parentName}" — named parts must be siblings, not nested`,
        ).toBe(false);
      }
    });

    it('contains no ship nose, no Cockpit_Frame ring and no Canopy_Frame band — all three superseded', () => {
      // INDEPENDENT and deliberately broader than the node inventory above: Hull_Nose_001,
      // a stray nose mesh DATABLOCK or a nose material would all still put the deleted
      // geometry in the file, and a datablock is not a node. The re-spec removes the nose
      // entirely (increment 1 has no exterior hull) and the octagonal ring (the perimeter
      // band that replaces it is Canopy_Frame, a different thing: an edge, not a ring
      // standing in front of the glass).
      const named = [
        ...(gltf.nodes ?? []).map((n) => ['node', n.name]),
        ...(gltf.meshes ?? []).map((m) => ['mesh', m.name]),
        ...(gltf.materials ?? []).map((m) => ['material', m.name]),
      ].filter(([, n]) => typeof n === 'string');
      const offenders = named
        .filter(([, n]) => /nose/i.test(n)
          || /cockpit[_ -]?frame/i.test(n)
          || /canopy[_ -]?frame/i.test(n))
        .map(([kind, n]) => `${kind} "${n}"`);
      expect(
        offenders,
        `the GLB still contains ${offenders.join(', ')}. Hull_Nose and the octagonal Cockpit_Frame were `
        + 'deleted by Max at UAT on 1056f30. Canopy_Frame — the flat perimeter BAND of ceb277e — is gone '
        + 'too: an ENCLOSURE has no window-edge trim, because its edge is Arch_Bow, a real structural rim '
        + 'lying on a real seam. Delete them from scripts/cockpit-gen.py and regenerate.',
      ).toEqual([]);
      for (const key of ['noseVisibleLength', 'noseFractionOfHull', 'noseSlopeLength',
        'noseTipDistanceFromEye', 'noseTipFractionOfHull', 'noseDropFromLip']) {
        expect(metrics[key], `cockpit-metrics.json still declares "${key}" for deleted geometry`)
          .toBeUndefined();
      }
    });

    it('places one screen in each quadrant of the canopy aperture', () => {
      for (const [name, [sx, sy]] of Object.entries(QUADRANTS)) {
        const { centre } = screen(name);
        expect(centre[0] * sx, `${name} centre x=${centre[0].toFixed(4)} is on the wrong side (want sign ${sx})`)
          .toBeGreaterThan(1e-3);
        expect(centre[1] * sy, `${name} centre y=${centre[1].toFixed(4)} is on the wrong side (want sign ${sy})`)
          .toBeGreaterThan(1e-3);
      }
    });

    it('keeps every screen-unit vertex forward of the eye', () => {
      // INDEPENDENT, and vertex-level on purpose: a box tilted to face the eye spans
      // ~0.05 m in Z, so a centroid-only version of this check would pass while a corner
      // sat level with the pilot's head. The arms are exempt — their roots are supposed
      // to be aft of the eye, which is the whole point of them.
      for (const suffix of QUADRANT_SUFFIXES) {
        for (const name of [`Screen_${suffix}`, `ScreenBody_${suffix}`]) {
          const box = partBounds(name);
          expect(box, `${name} carries no geometry`).not.toBeNull();
          expect(
            box.max[2],
            `${name} has a vertex at z=${box.max[2].toFixed(4)}, at or behind the eye — screen units `
            + 'live forward of the pilot',
          ).toBeLessThan(0);
        }
      }
    });

    it('sizes every display face at least 1.5x the panel it replaces', () => {
      // INDEPENDENT. Max: "screens about 50% bigger". The previous panel was
      // 0.30 x 0.20 m = 0.06 m^2, so the floor is 0.09 m^2; the re-spec's 0.45 x 0.30 m
      // is 0.135 m^2, comfortably clear of it. Area rather than width-and-height so the
      // aspect ratio stays the generator's business.
      for (const name of SCREEN_NAMES) {
        const area = GLB.triangleListArea(partTris(name));
        expect(
          area,
          `${name} display face is ${area.toFixed(4)} m^2. The old panel was `
          + `${PREV_FACE_W} x ${PREV_FACE_H} = ${(PREV_FACE_W * PREV_FACE_H).toFixed(4)} m^2 and Max asked `
          + `for ~50% bigger, so the floor is ${MIN_FACE_AREA.toFixed(4)} m^2.`,
        ).toBeGreaterThanOrEqual(MIN_FACE_AREA - VERTEX_TOL);
      }
    });

    it('encloses every display face inside its ScreenBody box', () => {
      // INDEPENDENT. "Boxy, not flat panel" means the face is the front of a solid, not a
      // quad floating near one. Measured in the face's own frame, so a body that is
      // correctly sized but rotated relative to its face fails here rather than silently
      // widening the bezel measurement below.
      for (const suffix of QUADRANT_SUFFIXES) {
        const u = unit(suffix);
        expect(u.bodyVerts.length, `ScreenBody_${suffix} carries no vertices`).toBeGreaterThan(0);
        expect(
          u.bodyDepth,
          `ScreenBody_${suffix} has depth ${u.bodyDepth.toFixed(5)} m along its face normal — it is a `
          + 'flat panel, not a box',
        ).toBeGreaterThan(0.005);
        for (const [axis, f, b] of [['u', u.face.u, u.body.u], ['w', u.face.w, u.body.w], ['n', u.face.n, u.body.n]]) {
          expect(
            f.min - b.min,
            `Screen_${suffix} overhangs ScreenBody_${suffix} on the -${axis} side by `
            + `${(b.min - f.min).toFixed(5)} m`,
          ).toBeGreaterThanOrEqual(-VERTEX_TOL);
          expect(
            b.max - f.max,
            `Screen_${suffix} overhangs ScreenBody_${suffix} on the +${axis} side by `
            + `${(f.max - b.max).toFixed(5)} m`,
          ).toBeGreaterThanOrEqual(-VERTEX_TOL);
        }
      }
    });

    it('measures a ~1 inch bezel and a ~2 inch body depth, matching the script\'s declared constants', () => {
      // INDEPENDENT of the generator's arithmetic in the direction that matters: the
      // bezel is (front-plane extent - display-face extent) read off the exported mesh,
      // on all four sides separately, so an off-centre display or a bezel authored on
      // two sides only fails here.
      //
      // The DECLARED constant is then checked against the inch Max named. Without that
      // second step a generator could declare BEZEL = 0.5 m, build it, and satisfy every
      // geometry-vs-sidecar comparison in this file.
      const bezelNames = ['SCREEN_BEZEL', 'SCREEN_BEZEL_W', 'SCREEN_BEZEL_WIDTH', 'BEZEL_W', 'BEZEL_WIDTH', 'BEZEL'];
      const depthNames = ['SCREEN_BODY_DEPTH', 'SCREEN_BACKING_DEPTH', 'BODY_DEPTH', 'BACKING_DEPTH', 'SCREEN_DEPTH'];

      for (const suffix of QUADRANT_SUFFIXES) {
        const u = unit(suffix);
        const decl = screenDecl(`Screen_${suffix}`);
        const declBezel = declaredAny(metrics, bezelNames, { label: 'the screen bezel width in metres', extra: decl });
        const declDepth = declaredAny(metrics, depthNames, { label: 'the screen body depth in metres', extra: decl });

        expect(
          declBezel,
          `the declared bezel is ${declBezel} m = ${(declBezel / INCH).toFixed(2)} inch. Max asked for `
          + '"about one inch"; a declaration this far off is wrong even if the geometry matches it.',
        ).toBeGreaterThan(INCH * (1 - INCH_BAND));
        expect(declBezel).toBeLessThan(INCH * (1 + INCH_BAND));
        expect(
          declDepth,
          `the declared body depth is ${declDepth} m = ${(declDepth / INCH).toFixed(2)} inch. Max asked for `
          + '"two inches thick backing".',
        ).toBeGreaterThan(2 * INCH * (1 - INCH_BAND));
        expect(declDepth).toBeLessThan(2 * INCH * (1 + INCH_BAND));

        expect(
          u.frontSlabCount,
          `ScreenBody_${suffix} has no identifiable front face (only ${u.frontSlabCount} vertices within `
          + `${FRONT_SLAB_TOL} m of its most eye-ward extent) — there is no bezel plane to measure`,
        ).toBeGreaterThanOrEqual(3);

        for (const [side, measured] of Object.entries(u.bezels)) {
          expect(
            Math.abs(measured - declBezel),
            `ScreenBody_${suffix} ${side} bezel measures ${measured.toFixed(5)} m, script declares `
            + `${declBezel} m (${(declBezel / INCH).toFixed(2)} inch)`,
          ).toBeLessThanOrEqual(DIMENSION_TOL);
        }
        expect(
          Math.abs(u.bodyDepth - declDepth),
          `ScreenBody_${suffix} measures ${u.bodyDepth.toFixed(5)} m deep along the face normal, script `
          + `declares ${declDepth} m (${(declDepth / INCH).toFixed(2)} inch)`,
        ).toBeLessThanOrEqual(DIMENSION_TOL);
      }
    });

    it('recesses every display face behind its bezel plane — not flush, not proud', () => {
      // INDEPENDENT. The recess is what makes the bezel read as a bezel from the seat: a
      // flush face is a sticker on a box, a proud face is a panel with a frame behind it.
      for (const suffix of QUADRANT_SUFFIXES) {
        const u = unit(suffix);
        const decl = screenDecl(`Screen_${suffix}`);
        const hint = u.recess < 0
          ? ' A NEGATIVE recess means the face sits in FRONT of the body, or the face winding is '
            + 'inverted so its normal points away from the eye (see the 20-degree angle check).'
          : '';
        expect(
          u.recess,
          `Screen_${suffix} sits ${(u.recess * 1000).toFixed(2)} mm behind the ScreenBody_${suffix} front `
          + `plane. Flush (0) makes the bezel invisible from the seat.${hint}`,
        ).toBeGreaterThan(0.001);
        expect(
          u.recess,
          `Screen_${suffix} is recessed ${(u.recess * 1000).toFixed(2)} mm into a body only `
          + `${(u.bodyDepth * 1000).toFixed(2)} mm deep — the display has been pushed out the back`,
        ).toBeLessThan(u.bodyDepth - 0.001);

        // If the script declares a recess constant, the geometry must match it. Absent is
        // acceptable: the contract names the bezel and the backing in inches, not this.
        let declRecess;
        try {
          declRecess = declaredAny(metrics, ['SCREEN_RECESS', 'SCREEN_FACE_RECESS', 'FACE_RECESS', 'RECESS_DEPTH', 'RECESS'],
            { extra: decl });
        } catch { declRecess = undefined; }
        if (declRecess !== undefined) {
          expect(
            Math.abs(u.recess - declRecess),
            `Screen_${suffix} recess measures ${u.recess.toFixed(5)} m, script declares ${declRecess} m`,
          ).toBeLessThanOrEqual(DIMENSION_TOL);
        }
      }
    });

    it(`angles every display face at the pilot's eye, within ${MAX_SCREEN_ANGLE_DEG} degrees`, () => {
      // NEAR-TAUTOLOGY, read the green carefully. The generator builds each face's basis
      // FROM the centre->eye vector, so the measured angle is ~0 by construction and the
      // 20-degree band cannot be approached by any change to the aperture or mounting
      // constants. What this can still catch: a winding flip (~180 degrees, hinted below),
      // an axis-conversion bug in the export, and a future generator that goes back to
      // hand-tuned Euler angles. It is NOT evidence that the angle was designed well.
      for (const name of SCREEN_NAMES) {
        const { centre, normal } = screen(name);
        const toEye = [EYE[0] - centre[0], EYE[1] - centre[1], EYE[2] - centre[2]];
        const angle = GLB.angleBetweenDegrees(normal, toEye);
        const hint = angle > 90
          ? ` The face points AWAY from the eye — its winding is inverted; reverse the face index order. `
            + `Unoriented misalignment is only ${(180 - angle).toFixed(2)} degrees.`
          : '';
        expect(
          angle,
          `${name}: normal [${normal.map((v) => v.toFixed(3))}] is ${angle.toFixed(2)} degrees off the `
          + `centre->eye vector (limit ${MAX_SCREEN_ANGLE_DEG}).${hint}`,
        ).toBeLessThanOrEqual(MAX_SCREEN_ANGLE_DEG);
      }
    });

    it('matches the display-face centres, normals and sizes the sidecar declares', () => {
      // NEAR-TAUTOLOGY, by construction. The sidecar is written by the SAME run from the
      // SAME vertex lists, so this compares the script against its own arithmetic. What it
      // genuinely exercises is the path BETWEEN them: the Blender scene build, the
      // export_yup axis conversion, transform baking, float32 quantisation. It cannot tell
      // you the geometry is right — only that what left Blender is what Python computed.
      expect(Array.isArray(metrics.screens), 'cockpit-metrics.json must declare a screens array').toBe(true);
      expect(metrics.screens.map((s) => s.name).slice().sort()).toEqual(SCREEN_NAMES.slice().sort());
      for (const decl of metrics.screens) {
        const { centre, normal } = screen(decl.name);
        for (let i = 0; i < 3; i++) {
          expect(
            Math.abs(centre[i] - decl.centre[i]),
            `${decl.name} centre axis ${i}: measured ${centre[i].toFixed(5)}, declared ${decl.centre[i]} `
            + '(sidecar values must be in glTF axes)',
          ).toBeLessThanOrEqual(1e-3);
        }
        const drift = GLB.angleBetweenDegrees(normal, decl.normal);
        expect(
          drift,
          `${decl.name} normal: measured [${normal.map((v) => v.toFixed(3))}], declared `
          + `[${decl.normal}] — ${drift.toFixed(2)} degrees apart (sidecar values must be in glTF axes)`,
        ).toBeLessThanOrEqual(1);

        const u = unit(decl.name.slice('Screen_'.length));
        for (const [key, measured] of [['width', u.faceWidth], ['height', u.faceHeight]]) {
          if (typeof decl[key] !== 'number') continue;
          const pair = [u.faceWidth, u.faceHeight];
          expect(
            pair.some((v) => Math.abs(v - decl[key]) <= DIMENSION_TOL),
            `${decl.name} declares ${key}=${decl[key]} m; the exported face measures `
            + `${u.faceWidth.toFixed(4)} x ${u.faceHeight.toFixed(4)} m (measured ${key} ${measured.toFixed(4)})`,
          ).toBe(true);
        }
      }
    });

    it('affixes every arm to the rib it names — the retired frustum rule replaced', () => {
      // INDEPENDENT, and this is what replaces "the root lies outside the 70 degree / 16:9
      // frustum". That rule is RETIRED and deliberately not reimplemented: Max resolved the
      // ambiguity it encoded — "arms coming from outside the player's POV" means the origin
      // is HIDDEN BY STRUCTURE, not that it sits beyond the view.
      //
      // It was also satisfiable by hanging in EMPTY SPACE, which is precisely how the
      // previous build passed every assertion in this file while reading, in Max's words,
      // as four monitors on two lamp-posts. "Is on a named member's solid" cannot be
      // satisfied that way, so it is strictly the stronger property.
      for (const suffix of QUADRANT_SUFFIXES) {
        const mountName = ARM_ROOT_PART(suffix);
        const mountVerts = partVerts(mountName);
        expect(mountVerts.length, `${mountName} carries no vertices`).toBeGreaterThan(0);

        // Read the sidecar's CLAIM about which member it bolts to, then test the geometry
        // against that claim — so a wrong claim fails here instead of being believed.
        const decl = (metrics.arms ?? []).find((a) => a.name === `Arm_${suffix}`);
        expect(decl, `cockpit-metrics.json declares no arm entry for Arm_${suffix}`).toBeDefined();
        expect(
          MEMBER_NAMES,
          `Arm_${suffix} claims to mount on "${decl.mountedOn}", which is not a seam member at all`,
        ).toContain(decl.mountedOn);

        // Measured from the plate's CENTROID, not its worst corner. A bolt-on plate is
        // wider than the rail it bolts to — its corners overhang, exactly as a real bracket
        // does — so a worst-vertex test would be measuring the overhang, not the mounting.
        const memberTris = partTris(decl.mountedOn);
        const centroid = [0, 1, 2].map((k) => mountVerts.reduce((t, v) => t + v[k], 0) / mountVerts.length);
        const seated = GLB.distanceToTriangleList(memberTris, centroid).distance;
        expect(
          seated,
          `${mountName} sits ${seated.toFixed(4)} m from ${decl.mountedOn}. The plate must lie ON the member `
          + 'it bolts to; a plate merely near one is the lamp-post defect wearing a better name.',
        ).toBeLessThanOrEqual(ARM_MOUNT_TOL);

        // ANTI-VACUITY: the same measurement against the FURTHEST other member must be
        // clearly larger. Without this, "it is near a member" could be true of every point
        // in a cabin criss-crossed by nine of them, and the assertion would say nothing.
        const others = MEMBER_NAMES.filter((n) => n !== decl.mountedOn);
        const farthest = Math.max(...others.map(
          (n) => GLB.distanceToTriangleList(partTris(n), centroid).distance,
        ));
        expect(
          farthest,
          `${mountName} is no further from the most distant other member than from its own ${decl.mountedOn}, `
          + 'so "affixed to a rib" is not discriminating between members',
        ).toBeGreaterThan(ARM_MOUNT_TOL * 10);
      }
    });

    it('models every arm as a jointed chain, not a tapered stick', () => {
      // Max: "we need to model their arms though ... there should be plenty of references,
      // maybe even 3d models of monitor arms to refer to."
      //
      // Articulation is MEASURED, not inferred from the node count: the two booms have to
      // actually turn at the elbow, the elbow has to touch both, and it has to be FATTER
      // than either — that step in section is what reads as a joint rather than as a kink.
      for (const suffix of QUADRANT_SUFFIXES) {
        // Direction of a boom: between the centroids of its two ends along its own
        // dominant axis, so a boom lying at any angle in world space still measures right.
        const mean = (pts) => [0, 1, 2].map((k) => pts.reduce((t, p) => t + p[k], 0) / pts.length);
        const dir = (name) => {
          const e = GLB.principalAxisEnds(partVerts(name), { fraction: 0.2 });
          const lo = mean(e.low);
          const hi = mean(e.high);
          const d = [0, 1, 2].map((k) => hi[k] - lo[k]);
          const L = Math.hypot(...d);
          return d.map((c) => c / L);
        };
        const a = dir(`Arm_${suffix}_BoomA`);
        const b = dir(`Arm_${suffix}_BoomB`);
        const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
        const bend = (Math.acos(Math.min(1, dot)) * 180) / Math.PI;
        expect(
          bend,
          `Arm_${suffix}: BoomA and BoomB are only ${bend.toFixed(1)} degrees apart, so the arm reads as one `
          + `straight stick. Minimum ${ARM_MIN_BEND_DEG} degrees — the articulation is the whole point.`,
        ).toBeGreaterThanOrEqual(ARM_MIN_BEND_DEG);

        const elbowVerts = partVerts(`Arm_${suffix}_Elbow`);
        for (const boom of ['BoomA', 'BoomB']) {
          const tris = partTris(`Arm_${suffix}_${boom}`);
          const gap = Math.min(...elbowVerts.map((v) => GLB.distanceToTriangleList(tris, v).distance));
          expect(
            gap,
            `Arm_${suffix}_Elbow never touches ${boom} (nearest ${gap.toFixed(4)} m) — the joint is not joining`,
          ).toBeLessThanOrEqual(ARM_ATTACH_TOL);
        }

        // Section = how far the part's own vertices stand off its own centreline. A world
        // -axis bounding box is useless here: BoomB runs diagonally, so its box is large on
        // all three axes and would report a section three times its real one.
        const section = (name) => {
          const pts = partVerts(name);
          const e = GLB.principalAxisEnds(pts, { fraction: 0.2 });
          const lo = mean(e.low);
          const hi = mean(e.high);
          const ax = [0, 1, 2].map((k) => hi[k] - lo[k]);
          const L = Math.hypot(...ax);
          const u = ax.map((c) => c / L);
          return Math.max(...pts.map((p) => {
            const d = [0, 1, 2].map((k) => p[k] - lo[k]);
            const t = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
            return Math.hypot(...[0, 1, 2].map((k) => d[k] - t * u[k]));
          }));
        };
        expect(
          section(`Arm_${suffix}_Elbow`),
          `Arm_${suffix}_Elbow is no fatter than the booms it joins, so the chain reads as a bent bar rather `
          + 'than as a jointed arm',
        ).toBeGreaterThan(Math.max(section(`Arm_${suffix}_BoomA`), section(`Arm_${suffix}_BoomB`)));
      }
    });

    it('reaches each arm all the way to the screen box it carries', () => {
      // ANTI-VACUITY for both checks above: an arm correctly bolted to a rib and correctly
      // articulated, but stopping short of its screen, would satisfy every one of them
      // while carrying nothing at all.
      for (const suffix of QUADRANT_SUFFIXES) {
        const headVerts = partVerts(ARM_TIP_PART(suffix));
        const bodyBox = partBounds(`ScreenBody_${suffix}`);
        const nearest = Math.min(...headVerts.map((v) => GLB.distanceToBox(bodyBox, v)));
        expect(
          nearest,
          `${ARM_TIP_PART(suffix)} never comes closer than ${nearest.toFixed(4)} m to ScreenBody_${suffix} — `
          + 'it is not carrying the screen, so everything above says nothing about the screen',
        ).toBeLessThanOrEqual(ARM_ATTACH_TOL);
      }
    });

    it('makes every seam member thin — a strip, not a slab', () => {
      // INDEPENDENT. Max: "fairly thin". Measured for ALL nine members rather than the two
      // interior ribs alone, because the sill rails and the bow arch carry the heaviest
      // sections in the model and are exactly where a re-author produces a slab.
      for (const name of MEMBER_NAMES) {
        const box = partBounds(name);
        expect(box, `${name} carries no geometry`).not.toBeNull();
        const [sx, sy, sz] = box.size;
        const longest = Math.max(sx, sy, sz);
        const thinnest = Math.min(sx, sy, sz);
        expect(
          thinnest / longest,
          `${name} measures ${sx.toFixed(3)} x ${sy.toFixed(3)} x ${sz.toFixed(3)} m — its thinnest extent is `
          + `${((thinnest / longest) * 100).toFixed(1)}% of its longest, which is a slab, not a strip`,
        ).toBeLessThan(MEMBER_THIN_RATIO);
      }
      // Mirrored members sit on their own side of the pilot.
      for (const [name, side] of Object.entries(RIB_SIDES)) {
        const box = partBounds(name);
        const midX = (box.min[0] + box.max[0]) / 2;
        expect(Math.sign(midX), `${name} sits at x=${midX.toFixed(3)}, on the wrong side of the pilot`)
          .toBe(side);
      }
    });

    it('lays every rib ON a real panel-to-panel seam of the canopy', () => {
      // ── THE ASSERTION THE WHOLE RE-SPEC TURNS ON ──────────────────────────
      // Max: "the point of ribs is they act as a seam between flat panels of canopy ...
      // The ribs run along the seams of the canopy." The previous build's ribs lay on a
      // near-flat pane that HAD no seams, which is precisely why they read as decoration.
      //
      // The seams are recovered from the EXPORTED GLASS MESH — edges where two panels of
      // different facing meet — and NOT read from the sidecar, so the generator cannot
      // declare its way to a pass.
      const tris = glass();
      const key = (p) => p.map((c) => c.toFixed(5)).join(',');
      const counts = new Map();
      for (const t of tris) {
        for (const [p, q] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
          const k = [key(p), key(q)].sort().join('|');
          const e = counts.get(k) ?? { n: 0, a: p, b: q, normals: [] };
          e.n += 1;
          e.normals.push(GLB.triangleListNormal([t]));
          counts.set(k, e);
        }
      }
      // A quad panel is two triangles, so its own DIAGONAL is shared by two faces too --
      // and those two are coplanar. A fold is a shared edge whose faces genuinely differ in
      // facing, which is what makes it a crease rather than a tessellation artefact.
      const foldEdges = [];
      for (const e of counts.values()) {
        if (e.n !== 2) continue;
        const [m, n] = e.normals;
        const dot = Math.abs(m[0] * n[0] + m[1] * n[1] + m[2] * n[2]);
        if (dot < FOLD_COPLANAR_DOT) foldEdges.push({ a: e.a, b: e.b });
      }
      expect(
        foldEdges.length,
        'the canopy mesh has no folds at all — it is a flat pane, which is the form Max rejected, and "a rib '
        + 'lies on a seam" cannot mean anything against it',
      ).toBeGreaterThanOrEqual(FOLD_MEMBER_NAMES.length);

      for (const name of FOLD_MEMBER_NAMES) {
        const verts = partVerts(name);
        const worst = Math.max(...verts.map((v) => GLB.distanceToSegmentList(foldEdges, v).distance));
        expect(
          worst,
          `${name} strays ${worst.toFixed(4)} m from the nearest fold of ${GLASS_NAME}. A rib that is not on a `
          + 'seam is decoration lying on a pane — the exact defect Max identified in ceb277e.',
        ).toBeLessThanOrEqual(MEMBER_SEAM_TOL);
      }

      // ANTI-VACUITY. If every point in the cabin were within tolerance of some fold, the
      // loop above would pass for any geometry whatsoever.
      const probe = partVerts(FOLD_MEMBER_NAMES[0])[0];
      const planted = [probe[0], probe[1] - PLANTED_SEAM_OFFSET, probe[2]];
      expect(
        GLB.distanceToSegmentList(foldEdges, planted).distance,
        `a point planted ${PLANTED_SEAM_OFFSET} m off the seam still measures as on one, so this assertion `
        + 'cannot fail and its passes carry no information',
      ).toBeGreaterThan(MEMBER_SEAM_TOL);
    });

    it('holds every member INBOARD of the glass — signed, on the pilot side', () => {
      // The UNSIGNED version of this check is what let ceb277e ship: distanceToTriangleList
      // has no sign, so a rib bolted to the OUTSIDE of the canopy measured identically to
      // one correctly inboard, and 48/48 tests passed a build with the structure on the
      // wrong side of the glass. Sidedness comes from a ray out of the pilot's eye.
      const shell = glass();
      for (const name of MEMBER_NAMES) {
        const verts = partVerts(name);
        const sided = GLB.insideShellFromEye(shell, verts, { eye: EYE });
        // FOLD members run down the middle of panels, so most of their vertices sit on an
        // eye-ray that meets the glass and the fraction is meaningful. RIM members run
        // along the shell's OPEN edge — the bow aperture especially — where most rays leave
        // the cockpit entirely. Demanding the same fraction of them would be demanding the
        // canopy be closed at the front. Both still have to clear the outboard bound below;
        // what differs is only how much of each is answerable.
        const isFold = FOLD_MEMBER_NAMES.includes(name);
        expect(
          sided.tested,
          `${name}: not one of its ${verts.length} vertices lies on an eye-ray that meets ${GLASS_NAME}, so `
          + 'nothing at all is being asked about which side of the glass it is on',
        ).toBeGreaterThan(0);
        if (isFold) {
          expect(
            sided.tested / verts.length,
            `${name} is a FOLD member, so most of it should lie under the glazed cone, but only `
            + `${sided.tested} of its ${verts.length} vertices do (${sided.skipped} skipped). A pass that `
            + 'measured almost nothing is not a pass.',
          ).toBeGreaterThanOrEqual(MEMBER_SIDED_MIN_FRACTION);
        }
        expect(
          sided.worst.over,
          `${name} has a vertex at [${sided.worst.point?.map((v) => v.toFixed(4))}] sitting `
          + `${sided.worst.over.toFixed(4)} m OUTSIDE ${GLASS_NAME} — the structure is on the far side of the `
          + 'glass it is supposed to be lying on.',
        ).toBeLessThanOrEqual(MEMBER_OUTBOARD_TOL);
      }
    });

    it('is an ENCLOSURE, not a window: cockpit above, to BOTH sides and behind', () => {
      // ── AC-FORM(a), measured ──────────────────────────────────────────────
      // Max: "Think fighter-pilot type of cockpit — the player should be situated with
      // canopy above, in front, and to either side of them."
      //
      // No amount of dimension-checking would have caught the failure this replaces. The
      // previous build was a flat pane spanning the view frustum, and every assertion about
      // its width, height, ribs and screens PASSED. What was wrong is that turning your
      // head found empty space. So that is what is measured, directly: rays cast from the
      // eye over the whole sphere, asking how many of them find cockpit.
      const shell = [...glass(), ...partTris(BULKHEAD_NAME), ...partTris(FLOOR_NAME)];
      const dirs = [];
      for (let a = 0; a < SPHERE_LAT; a++) {
        const lat = -Math.PI / 2 + (Math.PI * (a + 0.5)) / SPHERE_LAT;
        for (let b = 0; b < SPHERE_LON; b++) {
          const lon = -Math.PI + (2 * Math.PI * (b + 0.5)) / SPHERE_LON;
          dirs.push({
            d: [Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon)],
            w: Math.cos(lat),
          });
        }
      }
      // glTF axes: +Y up, forward is -Z. AHEAD is deliberately NOT in the required set --
      // the bow aperture is supposed to be open, and requiring coverage there would be
      // requiring a windscreen made of hull.
      const sectors = { above: [0, 1, 0], left: [-1, 0, 0], right: [1, 0, 0], behind: [0, 0, 1] };
      const cosLim = Math.cos((SECTOR_HALF_ANGLE_DEG * Math.PI) / 180);
      const coverage = (axis) => {
        let hit = 0;
        let tot = 0;
        for (const { d, w } of dirs) {
          if (d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2] < cosLim) continue;
          tot += w;
          if (GLB.rayTriangleListHits(EYE, d, shell).length > 0) hit += w;
        }
        return tot > 0 ? hit / tot : 0;
      };
      const measured = Object.fromEntries(
        Object.entries(sectors).map(([name, axis]) => [name, coverage(axis)]),
      );
      const report = Object.entries(measured)
        .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(', ');
      for (const [name, fraction] of Object.entries(measured)) {
        expect(
          fraction,
          `looking ${name}, only ${(fraction * 100).toFixed(1)}% of the view finds cockpit — the rest is empty `
          + `space. That is a WINDOW, which is the form Max rejected. All sectors: ${report}.`,
        ).toBeGreaterThanOrEqual(ENCLOSURE_SECTOR_MIN);
      }

      // ANTI-VACUITY: the instrument must be able to report an OPEN direction, or it would
      // pass a solid block as readily as a cockpit.
      expect(
        coverage([0, 0, -1]),
        'the coverage instrument reports the forward aperture as enclosed too, so it cannot tell an opening '
        + 'from hull and every figure above is meaningless',
      ).toBeLessThan(APERTURE_MAX_COVERAGE);
    });

    it('keeps the screen units inside the canopy, not poking through the glass', () => {
      // INDEPENDENT. Replaces the two frame-ring containment checks the re-spec deleted,
      // and catches the same defect class they were written against (screens hanging 92 mm
      // out through the canopy plane). Ray-based rather than plane-based because the shell
      // now curves: for each screen-unit vertex, walk from the eye towards it and require
      // it to be reached BEFORE the glass is.
      //
      // Vertices whose eye-ray misses the shell entirely are not counted — they are
      // outside the glazed cone, which is legitimate for a corner unit. That makes the
      // check partial by construction, so the tested count is asserted non-zero rather
      // than left to be quietly zero.
      const shell = glass();
      let tested = 0;
      let worst = { over: -Infinity, name: null, vertex: null, hit: null };
      for (const suffix of QUADRANT_SUFFIXES) {
        for (const name of [`Screen_${suffix}`, `ScreenBody_${suffix}`]) {
          const r = GLB.insideShellFromEye(shell, partVerts(name), { eye: EYE });
          tested += r.tested;
          if (r.worst.over > worst.over) {
            worst = { over: r.worst.over, name, vertex: r.worst.point, hit: r.worst.hit };
          }
        }
      }
      expect(
        tested,
        'no screen-unit vertex lies along a ray that meets Canopy_Glass at all. Either the shell does not '
        + 'span the canopy opening or the screens sit entirely outside it — establish which before '
        + 'relaxing this test; as written it would otherwise be measuring nothing.',
      ).toBeGreaterThan(0);
      expect(
        worst.over,
        `${worst.name} has a vertex at [${worst.vertex?.map((v) => v.toFixed(4))}], `
        + `${worst.over?.toFixed(4)} m FURTHER from the eye than the Canopy_Glass surface along the same ray `
        + `(glass at ${worst.hit?.toFixed(4)} m). The screen unit is through the canopy — it would be visible `
        + 'hanging outside the ship from the orbit view.',
      ).toBeLessThanOrEqual(VERTEX_TOL);
    });

    it('declares every exported part in the sidecar, and reports no overshoot of its own', () => {
      // NEAR-TAUTOLOGY on the dimensions (the sidecar and the GLB come from the same
      // vertex lists, so this exercises the Blender build and the export_yup conversion
      // rather than the authoring) but NOT vacuous on the inventory: a part that was
      // built and exported without being declared, or declared without being built,
      // fails here. The sidecar is what increments 2-4 read to place their materials
      // and cameras, so a part missing from it is a real gap.
      expect(Array.isArray(metrics.objects), 'cockpit-metrics.json must declare an objects array').toBe(true);
      // EXACT, not superset. The old form asked only "is each part declared?", so an
      // object entry for geometry that no longer exists — a deleted nose, a renamed rib,
      // a duplicate — sat in the sidecar unchallenged, and increments 2-4 read this
      // sidecar to place their materials and cameras.
      const objectDiff = compareNameSets(metrics.objects.map((o) => o.name), PART_NAMES);
      expect(
        objectDiff,
        `cockpit-metrics.json's objects array is not the exported part list.\n${describeNameDiff(objectDiff)}\n\n`
        + `expected exactly (${PART_NAMES.length}): ${PART_NAMES.join(', ')}\n`
        + `declared (${metrics.objects.length}): ${metrics.objects.map((o) => o.name).join(', ')}`,
      ).toEqual(NO_NAME_DIFF);

      const declaredObjects = new Map(metrics.objects.map((o) => [o.name, o]));
      for (const name of PART_NAMES) {
        const decl = declaredObjects.get(name);
        expect(
          decl,
          `cockpit-metrics.json declares no object entry for "${name}". Declared: `
          + `${[...declaredObjects.keys()].join(', ')}`,
        ).toBeDefined();
        const box = partBounds(name);
        for (let i = 0; i < 3; i++) {
          expect(
            Math.abs(box.min[i] - decl.boundingBox.min[i]),
            `${name} bbox min axis ${i}: measured ${box.min[i].toFixed(5)}, declared ${decl.boundingBox.min[i]}`,
          ).toBeLessThanOrEqual(1e-3);
          expect(
            Math.abs(box.max[i] - decl.boundingBox.max[i]),
            `${name} bbox max axis ${i}: measured ${box.max[i].toFixed(5)}, declared ${decl.boundingBox.max[i]}`,
          ).toBeLessThanOrEqual(1e-3);
        }
      }

      // CROSS-CHECK, empty-tolerant by design: any diagnostics key the generator names
      // "*Overshoot" or "*Penetration" is its own report of how far something ran past a
      // limit it set. The geometric checks above are the independent evidence; this
      // exists so a generator that KNOWS it failed cannot ship green, and so a regression
      // names itself in the generator's language as well as the GLB's.
      const diag = metrics.diagnostics ?? {};
      expect(typeof diag, 'cockpit-metrics.json must declare a diagnostics object').toBe('object');
      expect(Object.keys(diag).length, 'the diagnostics object is empty').toBeGreaterThan(0);
      for (const [key, value] of Object.entries(diag)) {
        if (typeof value !== 'number' || !/overshoot|penetrat/i.test(key)) continue;
        expect(
          value,
          `the generator reports diagnostics.${key} = ${value} m of overshoot; it must author the geometry `
          + 'clear of its limits, not merely report that it did not',
        ).toBeLessThanOrEqual(VERTEX_TOL);
      }
    });
  });

  // ── AC-FRAME, headless half ────────────────────────────────────────────────
  // The AC is MEASURE-AND-REPORT: the amended contract retired the [0.25, 0.30] band
  // because it was derived from the frame-plus-nose design Max deleted, and the new band
  // is re-set from the live chrome-devtools measurement with Max's agreement. So nothing
  // here asserts a band. What IS assertable headless is that the analytic predictor still
  // exists and still excludes the see-through shell.
  describe('AC-FRAME — the predictor is present and excludes the glass (the band is live-measured)', () => {
    it('declares an analytic occlusion fraction that gives Canopy_Glass no credit', () => {
      const fraction = declaredAny(
        metrics,
        ['predictedOcclusionFraction', 'occlusionFraction', 'predictedOcclusion'],
        { label: 'the analytic occlusion fraction' },
      );
      expect(
        fraction,
        `predicted occlusion is ${fraction}. A cockpit that occludes none of the frame is not a cockpit, `
        + 'and one that occludes all of it is a wall. NOTE: no band is asserted here on purpose — AC-FRAME '
        + 'is measure-and-report until Max accepts one.',
      ).toBeGreaterThan(0);
      expect(fraction).toBeLessThan(1);

      // BLOCKING FIX. Canopy_Glass is see-through by design and must not be counted — and
      // this used to be an OPT-IN check: it filtered diagnostics for a key matching
      // /glass/i AND /occl/i and looped over the result, so a generator that declared no
      // such key never entered the loop and the test passed. Confirmed against a sidecar
      // carrying no glass key at all. The generator's own statement that it gave the glass
      // zero credit is now REQUIRED to exist before it is required to be zero.
      const glassTerms = glassOcclusionTerms(metrics);
      const diagKeys = Object.keys(metrics.diagnostics ?? {});
      expect(
        glassTerms.length,
        'cockpit-metrics.json declares no numeric diagnostics key naming BOTH the glass and its occlusion '
        + `contribution (e.g. ${GLASS_OCCLUSION_KEY_EXAMPLES.join(' / ')}). Without it there is no evidence `
        + 'in the sidecar that the predictor excluded Canopy_Glass — and an absent key used to pass this '
        + `test vacuously.\ndiagnostics keys present: ${diagKeys.join(', ') || '(none)'}`,
      ).toBeGreaterThan(0);
      for (const [key, value] of glassTerms) {
        expect(
          value,
          `diagnostics.${key} = ${value}: Canopy_Glass is excluded from the occlusion measurement `
          + '(see-through by design), so its contribution must be zero',
        ).toBe(0);
      }
    });

    it('excludes ONLY the glass — the new perimeter frame must be counted', () => {
      // INDEPENDENT of the fraction itself, and the guard on the other half of the
      // exclusion rule. Canopy_Frame is opaque structure sitting right on the edge of the
      // opening; a predictor that quietly dropped it would under-report the occlusion and
      // disagree with the browser measurement AC-FRAME is actually settled on. This
      // asserts what the generator DECLARES it excluded; that the frame contributes a
      // positive amount is the live measurement's business, not a headless one's.
      const excludes = metrics.occlusion?.excludes;
      expect(
        Array.isArray(excludes),
        'cockpit-metrics.json must declare occlusion.excludes — the list of parts the analytic predictor '
        + 'left out. AC-FRAME excludes exactly one thing (the see-through shell) and the sidecar has to say '
        + `so in its own words. metrics.occlusion = ${JSON.stringify(metrics.occlusion)}`,
      ).toBe(true);
      const diff = compareNameSets(excludes, [GLASS_NAME]);
      expect(
        diff,
        `the predictor's exclusion list is not exactly [${GLASS_NAME}].\n${describeNameDiff(diff)}\n`
        + `declared: ${excludes.join(', ') || '(empty)'}. Anything else listed here is opaque structure `
        + 'being given away for free — most importantly Canopy_Frame, which is the band around the opening.',
      ).toEqual(NO_NAME_DIFF);
    });
  });

  // ── AC-METRIC ──────────────────────────────────────────────────────────────
  // "1 unit = 1 metre, Y-up, the pilot's eye-point at exactly (0,0,0), and no scale
  //  normalisation anywhere in the exported node hierarchy."
  describe('AC-METRIC — metric convention: metres, Y-up, eye at the origin, no normalisation', () => {
    it('leaves every node at scale (1,1,1)', () => {
      // INDEPENDENT. This is the check that catches the ships pipeline's
      // mesh.scale.setScalar(1/radius) habit leaking in — explicitly wrong for the one
      // object whose real size matters.
      for (const { index, name, node } of GLB.listNodes(gltf)) {
        const label = name ?? `<unnamed #${index}>`;
        const local = GLB.nodeLocalScale(node);
        const world = GLB.matrixScale(GLB.nodeWorldMatrix(gltf, index));
        for (let i = 0; i < 3; i++) {
          expect(Math.abs(local[i] - 1), `node "${label}" local scale [${local}]`).toBeLessThanOrEqual(1e-6);
          expect(Math.abs(world[i] - 1), `node "${label}" world scale [${world}]`).toBeLessThanOrEqual(1e-6);
        }
      }
    });

    it("puts the pilot's eye-point at exactly the origin", () => {
      const eye = GLB.requireNode(gltf, 'Eye_Point');
      const at = GLB.matrixTranslation(GLB.nodeWorldMatrix(gltf, eye.index));
      for (let i = 0; i < 3; i++) {
        expect(Math.abs(at[i]), `Eye_Point world position [${at.map((v) => v.toFixed(6))}] must be the origin`)
          .toBeLessThanOrEqual(1e-4);
      }
    });

    it('exports the bounding box the script declares in metres', () => {
      // NEAR-TAUTOLOGY of the same family as the screen-sidecar check: it compares the
      // GLB against the same run's own declaration, so it exercises the export path
      // rather than the authoring. The metre-scale check below is the independent one.
      const box = GLB.sceneBoundingBox(gltf, bin);
      const decl = metrics.sceneBoundingBox;
      expect(decl && Array.isArray(decl.min) && Array.isArray(decl.max),
        'sidecar must declare sceneBoundingBox {min:[x,y,z], max:[x,y,z]} in glTF axes').toBe(true);
      for (let i = 0; i < 3; i++) {
        expect(
          Math.abs(box.min[i] - decl.min[i]),
          `bbox min axis ${i}: measured ${box.min[i].toFixed(5)}, declared ${decl.min[i]}`,
        ).toBeLessThanOrEqual(1e-3);
        expect(
          Math.abs(box.max[i] - decl.max[i]),
          `bbox max axis ${i}: measured ${box.max[i].toFixed(5)}, declared ${decl.max[i]}`,
        ).toBeLessThanOrEqual(1e-3);
      }
    });

    it('is authored at human metre scale, independently of what the sidecar claims', () => {
      // INDEPENDENT. Guards the case a self-consistent sidecar would hide: the whole asset
      // authored in centimetres, or run through a 1/radius normalisation, would still
      // "match" its own declaration. A cockpit around a seated pilot is metres, not 0.1 m
      // or 50 m.
      const box = GLB.sceneBoundingBox(gltf, bin);
      const largest = Math.max(...box.size);
      expect(largest, `largest scene dimension is ${largest.toFixed(4)} units — not a metre-scale cockpit`)
        .toBeGreaterThan(0.5);
      expect(largest, `largest scene dimension is ${largest.toFixed(4)} units — not a metre-scale cockpit`)
        .toBeLessThan(20);
    });

    it('is Y-up: the vault straddles the eye in z and the ribs run fore-aft, not vertically', () => {
      // INDEPENDENT. Only true if export_yup ran. Without it, Blender's +Z up would leave
      // the vault stacked in +Z, the longitudinal members running in the exported Z, and
      // the screens' up/down split flattened onto the wrong axis.
      //
      // WHAT CHANGED, AND WHY THE OLD FORM OF THIS TEST WAS WRONG: it asserted that the
      // whole canopy sits FORWARD of the eye (z < 0). That was true of a window and is
      // false of an enclosure by definition — a shell that wraps past the pilot's
      // shoulders has to reach behind them. Asserting it would have made a correct
      // enclosure permanently unbuildable, so it is replaced rather than relaxed: the
      // vault must now STRADDLE the eye plane, which is the same axis fact stated for the
      // form actually being built.
      const shell = partBounds(GLASS_NAME);
      expect(shell, 'Canopy_Glass carries no geometry').not.toBeNull();
      expect(
        shell.min[2],
        `Canopy_Glass reaches only to z=${shell.min[2].toFixed(4)} — the vault must extend AHEAD of the eye`,
      ).toBeLessThan(0);
      expect(
        shell.max[2],
        `Canopy_Glass stops at z=${shell.max[2].toFixed(4)}, entirely ahead of the pilot. An enclosure wraps `
        + 'PAST the shoulders; a shell that stops at the eye plane is the window Max rejected.',
      ).toBeGreaterThan(0);

      // Under export_yup the longitudinal members run fore-aft (Z dominant); the transverse
      // arches run across (X dominant). Without it both would be swapped into Blender's Z.
      for (const name of [...SILL_NAMES, ...RIB_NAMES]) {
        const box = partBounds(name);
        expect(
          box.size[2],
          `${name} spans ${box.size[2].toFixed(3)} m in Z and ${box.size[1].toFixed(3)} m in Y — a `
          + 'longitudinal member runs fore-aft, and under Blender +Z up without export_yup these swap',
        ).toBeGreaterThan(box.size[1]);
      }
      for (const name of ARCH_NAMES) {
        const box = partBounds(name);
        expect(
          box.size[0],
          `${name} spans ${box.size[0].toFixed(3)} m in X and ${box.size[2].toFixed(3)} m in Z — a transverse `
          + 'arch runs across the cockpit, not along it',
        ).toBeGreaterThan(box.size[2]);
      }

      // The bulkhead is a thin slab facing the pilot: it is the flattest thing in Z.
      const bulk = partBounds(BULKHEAD_NAME);
      expect(bulk.size[2], `${BULKHEAD_NAME} must be a thin aft closure, not a box`)
        .toBeLessThan(Math.min(bulk.size[0], bulk.size[1]));
      expect(bulk.min[2], `${BULKHEAD_NAME} must sit BEHIND the eye`).toBeGreaterThan(0);
      // ...and the floor is the flattest thing in Y, below the pilot.
      const floor = partBounds(FLOOR_NAME);
      expect(floor.size[1], `${FLOOR_NAME} must be a flat pan, not a box`)
        .toBeLessThan(Math.min(floor.size[0], floor.size[2]));
      expect(floor.max[1], `${FLOOR_NAME} must sit BELOW the eye`).toBeLessThan(0);

      const upper = partBounds('Screen_UL');
      const lower = partBounds('Screen_LL');
      expect(upper.min[1], 'the upper screens must sit entirely above the eye plane').toBeGreaterThan(0);
      expect(lower.max[1], 'the lower screens must sit entirely below the eye plane').toBeLessThan(0);
    });
  });

  // ── AC-REPRO, instrument half ──────────────────────────────────────────────
  // The AC's real observable — two headless runs, identical decoded buffers — is
  // asserted in the "two independent generator runs" block below, which actually
  // spawns Blender. These three pin the comparison instrument against the committed
  // artefact: stable, total (no mesh escapes it), and sensitive to one moved vertex.
  // On their own they would NOT catch a nondeterministic generator; they hash one
  // file twice.
  describe('AC-REPRO — the digest instrument, against the committed GLB', () => {
    it('produces a stable digest for the committed GLB', () => {
      const a = GLB.hashGeometry(glbBytes);
      const b = GLB.hashGeometry(readFileSync(GLB_PATH));
      expect(a.positions).toMatch(/^[0-9a-f]{64}$/);
      expect(a.indices).toMatch(/^[0-9a-f]{64}$/);
      expect(a.positions).toBe(b.positions);
      expect(a.indices).toBe(b.indices);
    });

    it('covers every mesh in the file, so no geometry escapes the digest', () => {
      const meshes = GLB.listMeshes(gltf);
      expect(meshes.length, 'the GLB must contain geometry').toBeGreaterThan(0);
      for (const { mesh, name, index } of meshes) {
        for (const prim of mesh.primitives ?? []) {
          expect(prim.attributes?.POSITION,
            `mesh "${name ?? index}" has a primitive with no POSITION accessor — it would be invisible to the digest`)
            .toBeDefined();
        }
      }
    });

    it('responds to a single moved vertex (the digest is not vacuous)', () => {
      const baseline = GLB.hashGeometry(glbBytes);
      const mutated = Uint8Array.from(glbBytes);
      const parsed = GLB.parseGLB(mutated);
      const firstPos = parsed.json.meshes[0].primitives[0].attributes.POSITION;
      const range = GLB.accessorByteRange(parsed.json, firstPos);
      const dv = new DataView(parsed.bin.buffer, parsed.bin.byteOffset, parsed.bin.byteLength);
      dv.setFloat32(range.start, dv.getFloat32(range.start, true) + 0.01, true);
      expect(GLB.hashGeometry(mutated).positions).not.toBe(baseline.positions);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-REPRO, the actual observable.
//
// "Run the committed Blender script headless twice into separate output paths; decode
//  the vertex-position and index buffers from each GLB and hash them. SHA-256 ...
//  identical across the two runs, for every mesh in the file."
//
// This block spawns the generator for real. It lives OUTSIDE the artefact gate above
// because it makes its own artefacts — it is meaningful even during the pre-artist
// window. Byte-identity of the GLB FILE is deliberately not asserted anywhere; the
// exporter stamps its own metadata. Geometric identity is.
// ─────────────────────────────────────────────────────────────────────────────

const REPRO = { skipReason: null, a: null, b: null, metricsA: null, metricsB: null, glbA: null };

describe('AC-REPRO — geometric identity across two independent generator runs', () => {
  beforeAll(() => {
    const skip = (why) => {
      REPRO.skipReason = why;
      notify(`[cockpit-geometry] AC-REPRO NOT VERIFIED (skipped) — ${why}`);
    };

    if (SKIP_BLENDER) return skip('COCKPIT_SKIP_BLENDER=1 was set. Unset it to actually verify AC-REPRO.');
    if (!existsSync(GEN_SCRIPT)) return skip(`the generator ${path.relative(ROOT, GEN_SCRIPT)} does not exist.`);
    if (!existsSync(BLENDER_EXE)) {
      return skip(
        `Blender was not found at "${BLENDER_EXE}". Set BLENDER_EXE to its path, or run this suite from a `
        + 'shell that can reach /mnt/c. AC-REPRO is UNVERIFIED until this runs.',
      );
    }

    const dir = mkdtempSync(path.join(tmpdir(), 'cockpit-repro-'));
    try {
      const runs = [];
      for (const tag of ['a', 'b']) {
        const outGlb = path.join(dir, `run-${tag}.glb`);
        const outMetrics = path.join(dir, `run-${tag}.json`);
        const args = [
          '--background',
          '--python', toWindowsPath(GEN_SCRIPT),
          '--',
          '--out', toWindowsPath(outGlb),
          '--metrics', toWindowsPath(outMetrics),
        ];
        const res = spawnSync(BLENDER_EXE, args, {
          encoding: 'utf8',
          timeout: BLENDER_RUN_TIMEOUT_MS,
          maxBuffer: 32 * 1024 * 1024,
          // A Windows process cannot chdir into a WSL path; give it a real drive so it
          // does not fall back to the Windows directory with a warning.
          cwd: existsSync('/mnt/c') ? '/mnt/c' : undefined,
        });

        if (res.error) {
          // Spawn never got off the ground: no WSL interop, sandboxed shell, timeout,
          // permissions. Environmental, not evidence about the generator.
          return skip(
            `could not spawn Blender (${res.error.code || res.error.message}). This is expected inside a `
            + 'sandboxed shell — WSL interop to /mnt/c is blocked there. Run it from an unsandboxed WSL '
            + `shell:\n\n${generateCommand(outGlb, outMetrics)}\n\nAC-REPRO is UNVERIFIED until this runs.`,
          );
        }
        if (res.status !== 0 || !existsSync(outGlb)) {
          // Non-zero exit is ambiguous, and the ambiguity matters: inside a sandboxed
          // shell the Windows binary launches and is then killed by the blocked interop
          // socket ("<3>WSL (...) ERROR: UtilConnectUnix:524: socket failed 1", exit 1)
          // WITHOUT Blender ever starting. Reporting that as an AC-REPRO failure would be
          // a false red about the generator. So: if the output carries no evidence Blender
          // itself ran, treat it as environmental and SKIP; if Blender did run and the
          // script still failed, that IS AC-REPRO failing and must stay red.
          const out = `${res.stdout || ''}\n${res.stderr || ''}`;
          const blenderRan = /Blender\s+\d+\.\d+|Traceback \(most recent call last\)|Blender quit/.test(out);
          const tail = `\ncommand:\n${generateCommand(outGlb, outMetrics)}\n\n`
            + `exit status: ${res.status}${res.signal ? ` (signal ${res.signal})` : ''}\n\n`
            + `stderr:\n${(res.stderr || '(empty)').slice(-4000)}\n\nstdout:\n${(res.stdout || '(empty)').slice(-2000)}`;
          if (!blenderRan) {
            return skip(
              'Blender was launched but never started — no Blender banner and no Python traceback in its '
              + 'output, which is what a blocked WSL interop socket looks like. Environmental, not a '
              + `generator fault. Re-run from an unsandboxed WSL shell.\n${tail}\n\n`
              + 'AC-REPRO is UNVERIFIED until this runs.',
            );
          }
          throw new Error(
            `Blender ran but the generator did not produce a GLB on run "${tag}". AC-REPRO requires the `
            + `committed script to run clean from a clean checkout.\n${tail}`,
          );
        }
        runs.push({ tag, outGlb, outMetrics });
      }

      REPRO.glbA = readFileSync(runs[0].outGlb);
      REPRO.a = GLB.hashGeometry(REPRO.glbA);
      REPRO.b = GLB.hashGeometry(readFileSync(runs[1].outGlb));
      for (const r of runs) {
        if (!existsSync(r.outMetrics)) continue;
        const parsed = JSON.parse(readFileSync(r.outMetrics, 'utf8'));
        if (r.tag === 'a') REPRO.metricsA = parsed; else REPRO.metricsB = parsed;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, BLENDER_RUN_TIMEOUT_MS * 2 + 60_000);

  it('hashes identical positions and indices from run A and run B', (ctx) => {
    if (REPRO.skipReason) ctx.skip(REPRO.skipReason);
    expect(REPRO.a.positions).toMatch(/^[0-9a-f]{64}$/);
    expect(
      REPRO.a.positions,
      'two headless runs of the committed script produced DIFFERENT vertex positions. Something in the '
      + 'generator is order- or float-nondeterministic (iteration over a set/dict, a bpy operator, a '
      + 'modifier, an RNG). AC-REPRO is the guarantee that proportions can be re-authored by editing '
      + 'constants — it does not hold.',
    ).toBe(REPRO.b.positions);
    expect(
      REPRO.a.indices,
      'two headless runs produced identical positions but DIFFERENT index buffers — the same vertices are '
      + 'being assembled into faces in a different order between runs.',
    ).toBe(REPRO.b.indices);
  });

  it('hashed real geometry, not an empty file', (ctx) => {
    if (REPRO.skipReason) ctx.skip(REPRO.skipReason);
    // Without this, a generator that silently exported nothing would hash two empty
    // digests and report the AC green.
    const { json } = GLB.parseGLB(REPRO.glbA);
    expect((json.meshes ?? []).length, 'the generated GLB contains no meshes').toBeGreaterThan(0);
    const nodes = GLB.listNodes(json);
    const named = nodes.map((n) => n.name ?? `<unnamed #${n.index}>`);
    // EXHAUSTIVE here too — a fresh run that emits an extra node is a fresh run whose
    // geometry nobody has measured, and the committed-artefact checks above never see it.
    const diff = compareNameSets(named, EXPECTED_NODE_NAMES);
    expect(
      diff,
      `a freshly generated GLB does not carry the expected node inventory.\n${describeNameDiff(diff)}\n`
      + `found (${named.length}): ${named.join(', ')}`,
    ).toEqual(NO_NAME_DIFF);
    expect(
      named.filter((n) => /nose/i.test(n ?? '')),
      'a freshly generated GLB still contains nose geometry, which the re-spec deleted',
    ).toEqual([]);
  });

  it('declares identical metrics from both runs', (ctx) => {
    if (REPRO.skipReason) ctx.skip(REPRO.skipReason);
    // Beyond the letter of the AC, and cheap: the sidecar is what every dimensional
    // assertion above is measured against, so a sidecar that varies between runs would
    // make those assertions unreproducible even with identical geometry.
    expect(REPRO.metricsA, 'run A wrote no metrics sidecar').not.toBeNull();
    expect(REPRO.metricsB).toEqual(REPRO.metricsA);
  });

  it.skipIf(missing.length > 0)('reproduces the committed cockpit.glb', (ctx) => {
    if (REPRO.skipReason) ctx.skip(REPRO.skipReason);
    const committed = GLB.hashGeometry(readFileSync(GLB_PATH));
    expect(
      committed.positions,
      'the committed public/assets/cockpit/cockpit.glb is NOT what the committed scripts/cockpit-gen.py '
      + 'produces. Either the script changed without regenerating the asset, or the asset was edited by '
      + `hand. Regenerate it:\n\n${generateCommand()}`,
    ).toBe(REPRO.a.positions);
    expect(committed.indices).toBe(REPRO.a.indices);
  });
});

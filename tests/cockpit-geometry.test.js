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
const ARM_NAMES = QUADRANT_SUFFIXES.map((q) => `Arm_${q}`);
const RIB_NAMES = ['Canopy_Rib_L', 'Canopy_Rib_R'];
const GLASS_NAME = 'Canopy_Glass';
const FRAME_NAME = 'Canopy_Frame';
const FRAME_MATERIAL = 'Mat_Frame';
const EYE_NODE_NAME = 'Eye_Point';
const PART_NAMES = [...SCREEN_NAMES, ...BODY_NAMES, ...ARM_NAMES, ...RIB_NAMES, GLASS_NAME, FRAME_NAME];

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
const RIB_SIDES = { Canopy_Rib_L: -1, Canopy_Rib_R: +1 };

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
// Root end of an arm = vertices at least this fraction of the way out from its screen.
const ARM_ROOT_FRACTION = 0.75;
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

    it('carries every named part on its own node: a body and an arm per screen, two ribs, glass, perimeter frame', () => {
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
      for (const [outer, inner] of [['Canopy_Rib_L', 'Canopy_Rib_R']]) {
        expect(byName.get(outer).index, `${outer}/${inner} must be distinct nodes`)
          .not.toBe(byName.get(inner).index);
      }
      // Exactly two ribs — "two strips running vertically", not three, not a full frame.
      const ribs = nodes.filter((n) => /^Canopy_Rib/.test(n.name ?? '')).map((n) => n.name);
      expect(ribs.slice().sort(), 'the canopy frame is exactly two vertical ribs')
        .toEqual(RIB_NAMES.slice().sort());
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

    it('contains no ship nose and no octagonal Cockpit_Frame ring — both were deleted at Max\'s instruction', () => {
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
        .filter(([, n]) => /nose/i.test(n) || /cockpit[_ -]?frame/i.test(n))
        .map(([kind, n]) => `${kind} "${n}"`);
      expect(
        offenders,
        `the GLB still contains ${offenders.join(', ')}. Max removed the nose and the octagonal ring at `
        + 'UAT; AC-FORM now fails on their presence. Delete them from scripts/cockpit-gen.py and '
        + `regenerate. (The perimeter band added since is "${FRAME_NAME}" — do not rename it back.)`,
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

    it('roots every arm outside the 70 degree / 16:9 view frustum', () => {
      // INDEPENDENT, and the machine-checkable form of Max's "screens on arms coming from
      // outside the player's POV". The root end is identified geometrically — the vertices
      // furthest from the screen box the arm carries — so it does not depend on the
      // generator labelling which end is which.
      //
      // "Outside" includes AT OR BEHIND the eye plane: an arm rooted slightly aft of the
      // pilot has no tan-space projection at all, and that is out of view at any FOV.
      for (const suffix of QUADRANT_SUFFIXES) {
        const armName = `Arm_${suffix}`;
        const verts = partVerts(armName);
        expect(verts.length, `${armName} carries no vertices`).toBeGreaterThan(0);
        const bodyBox = partBounds(`ScreenBody_${suffix}`);
        const anchor = [0, 1, 2].map((i) => (bodyBox.min[i] + bodyBox.max[i]) / 2);

        const withDistance = verts.map((v) => ({
          v, d: Math.hypot(v[0] - anchor[0], v[1] - anchor[1], v[2] - anchor[2]),
        }));
        const maxD = Math.max(...withDistance.map((e) => e.d));
        const root = withDistance.filter((e) => e.d >= ARM_ROOT_FRACTION * maxD);
        expect(root.length, `${armName} has no identifiable root end`).toBeGreaterThan(0);

        const outside = root.filter((e) => !GLB.insideTanFrame(e.v, FRUSTUM));
        const worst = root.reduce((best, e) => {
          const t = GLB.tanSpaceProject(e.v);
          if (!t) return { over: Infinity, at: e.v };
          const over = Math.max(Math.abs(t[0]) / FRUSTUM.tanH, Math.abs(t[1]) / FRUSTUM.tanV);
          return over > best.over ? { over, at: e.v } : best;
        }, { over: -Infinity, at: null });

        expect(
          outside.length,
          `${armName}: none of its ${root.length} root vertices (the ones furthest from `
          + `ScreenBody_${suffix}, up to ${maxD.toFixed(3)} m away) lie outside the ${GAME_FOV_DEG} degree / `
          + `${GAME_ASPECT.toFixed(3)} frame. The furthest out reaches `
          + `${Number.isFinite(worst.over) ? `${(worst.over * 100).toFixed(1)}% of the frame half-extent` : 'behind the eye'} `
          + `at [${worst.at?.map((v) => v.toFixed(3))}]. Max asked for arms "coming from outside the player's `
          + 'POV" — root them further outboard, or further aft of the eye.',
        ).toBeGreaterThan(0);
      }
    });

    it('reaches each arm all the way to the screen box it carries', () => {
      // ANTI-VACUITY for the check above: an arm authored as a stick floating somewhere
      // out of frame would satisfy "a root vertex is outside the frustum" trivially while
      // carrying nothing. The arms must actually meet their boxes.
      for (const suffix of QUADRANT_SUFFIXES) {
        const armVerts = partVerts(`Arm_${suffix}`);
        const bodyBox = partBounds(`ScreenBody_${suffix}`);
        const nearest = Math.min(...armVerts.map((v) => GLB.distanceToBox(bodyBox, v)));
        expect(
          nearest,
          `Arm_${suffix} never comes closer than ${nearest.toFixed(4)} m to ScreenBody_${suffix} — it is not `
          + 'carrying the screen, so "the arm root is outside the frustum" says nothing about the screen',
        ).toBeLessThanOrEqual(ARM_ATTACH_TOL);
      }
    });

    it('makes the two canopy ribs thin, vertical, and one to each side', () => {
      // INDEPENDENT. Max: "fairly thin — two strips running vertically". Thin is measured
      // as the ratio of the rib's smallest bounding extent to its longest; vertical as Y
      // dominating the world-axis extents (which, under export_yup, is also evidence the
      // export ran — see the AC-METRIC Y-up check).
      for (const name of RIB_NAMES) {
        const box = partBounds(name);
        expect(box, `${name} carries no geometry`).not.toBeNull();
        const [sx, sy, sz] = box.size;
        const longest = Math.max(sx, sy, sz);
        const thinnest = Math.min(sx, sy, sz);
        expect(
          thinnest / longest,
          `${name} measures ${sx.toFixed(3)} x ${sy.toFixed(3)} x ${sz.toFixed(3)} m — its thinnest extent is `
          + `${((thinnest / longest) * 100).toFixed(1)}% of its longest, which is a slab, not a strip`,
        ).toBeLessThanOrEqual(0.25);
        expect(
          sy,
          `${name} runs ${sy.toFixed(3)} m vertically but ${sx.toFixed(3)} m across and ${sz.toFixed(3)} m `
          + 'fore-aft — a "strip running vertically" must be tallest in Y',
        ).toBeGreaterThan(Math.max(sx, sz));

        const centroid = GLB.triangleListCentroid(partTris(name));
        const side = RIB_SIDES[name];
        expect(
          centroid[0] * side,
          `${name} is centred at x=${centroid[0].toFixed(4)}; the pilot's left is -X and their right is +X, `
          + 'so the L and R ribs look swapped',
        ).toBeGreaterThan(1e-3);
      }
    });

    it('lays both ribs on the Canopy_Glass surface — near it, and INBOARD of it', () => {
      // INDEPENDENT, and now SIDED. A rib floating off the shell does not read as a canopy
      // rib — it reads as a bar hanging in space — and it is exactly what conveys the
      // protruding shape if it follows the surface. Proximity tolerance is derived from
      // each rib's OWN measured thickness (a strip laid on a shell stands off by its own
      // thickness) plus a margin, so it adapts to a re-authored rib without admitting a
      // floating one.
      //
      // BLOCKING FIX. Proximity alone was the WHOLE check, and GLB.distanceToTriangleList
      // is Math.hypot of the closest-point difference — unsigned. A rib bolted to the
      // OUTSIDE of the canopy, or punched clean through it, measured identically to one
      // lying correctly inboard: the fraction stayed 1.0 and the test passed. Sidedness
      // cannot come from a distance, so it comes from the pilot: every rib vertex whose
      // eye-ray meets the shell must be reached BEFORE the shell is. Same predicate as
      // the screen-unit containment below; see the "decides sidedness from the eye"
      // self-test, which pins two probes at identical unsigned distance on opposite sides.
      const shell = glass();
      expect(shell.length, 'Canopy_Glass carries no triangles to lie on').toBeGreaterThan(0);
      for (const name of RIB_NAMES) {
        const box = partBounds(name);
        const thickness = Math.min(...box.size);
        const tol = thickness + RIB_ON_SHELL_MARGIN;
        const verts = partVerts(name);
        const distances = verts.map((v) => GLB.distanceToTriangleList(shell, v).distance);
        const on = distances.filter((d) => d <= tol).length;
        const fraction = on / verts.length;
        const worst = Math.max(...distances);
        expect(
          fraction,
          `${name}: only ${(fraction * 100).toFixed(1)}% of its ${verts.length} vertices lie within `
          + `${tol.toFixed(3)} m of the Canopy_Glass surface (its own thickness ${thickness.toFixed(3)} m `
          + `plus ${RIB_ON_SHELL_MARGIN} m). The furthest is ${worst.toFixed(3)} m off the shell — a rib that `
          + 'floats does not convey the canopy\'s shape.',
        ).toBeGreaterThanOrEqual(RIB_ON_SHELL_FRACTION);

        const sided = GLB.insideShellFromEye(shell, verts);
        expect(
          sided.tested,
          `${name}: only ${sided.tested} of its ${verts.length} vertices lie along an eye-ray that meets `
          + `Canopy_Glass at all (${sided.skipped} skipped), so "is it inboard of the glass?" is barely being `
          + 'asked. Either the rib has left the glazed cone or the shell no longer spans the opening — '
          + 'establish which before relaxing this.',
        ).toBeGreaterThanOrEqual(Math.ceil(RIB_SIDED_MIN_FRACTION * verts.length));
        expect(
          sided.worst.over,
          `${name} has a vertex at [${sided.worst.point?.map((v) => v.toFixed(4))}] that is `
          + `${sided.worst.over?.toFixed(4)} m FURTHER from the eye than Canopy_Glass along the same ray `
          + `(glass at ${sided.worst.hit?.toFixed(4)} m). The rib is on the OUTSIDE of the canopy, or `
          + 'punched through it. Unsigned distance to the shell cannot see this — it reads the same either '
          + 'side — which is why this assertion exists separately from the proximity one above.',
        ).toBeLessThanOrEqual(VERTEX_TOL);
      }
    });

    // ── Canopy_Frame ─────────────────────────────────────────────────────────
    // Added 2026-07-28 after Max's form references. "I want the canopy's frame to be
    // fairly thin, two strips running vertically" was briefed to the generator as "two
    // vertical ribs are the ONLY frame structure, there is no ring any more" — but a thin
    // frame is not an absent frame, and with the ring gone the model read in the orbit
    // view as four monitors mounted on two lamp-posts floating in space. Both references
    // show a clear faceted perimeter where the glass meets the hull, including a plain
    // lower sill under the screens. Canopy_Frame is that edge.
    describe('Canopy_Frame — the perimeter band where the glass meets the hull', () => {
      let frameTrisCache;
      const frame = () => {
        if (!frameTrisCache) frameTrisCache = partTris(FRAME_NAME);
        return frameTrisCache;
      };
      /**
       * The band's equivalent cross-section side, in metres.
       *
       * A closed ring's BOUNDING BOX says nothing about how thick the ring is — a 4.7 m
       * opening framed in dental floss and one framed in railway sleepers measure the
       * same box. Volume divided by the run it covers is the cross-sectional AREA of a
       * band of roughly constant section, so its square root is the equivalent side.
       */
      const frameSection = () => Math.sqrt(GLB.closedMeshVolume(frame()) / rim().run);

      it('carries a closed Canopy_Frame solid, in Mat_Frame', () => {
        // INDEPENDENT. Closure is load-bearing for everything below it: an unclosed band
        // has no volume, so it has no measurable cross-section, and a band with an open
        // end is a strip that stops rather than a perimeter that closes.
        const tris = frame();
        expect(tris.length, `${FRAME_NAME} carries no triangles`).toBeGreaterThan(0);
        const open = GLB.boundaryEdges(tris);
        expect(
          open.length,
          `${FRAME_NAME} has ${open.length} open boundary edges — it is a shell or an unclosed strip, not a `
          + 'closed solid, so its volume (and the cross-section measured from it) is meaningless. The first '
          + `open edge runs [${open[0]?.a.map((v) => v.toFixed(3))}] -> [${open[0]?.b.map((v) => v.toFixed(3))}].`,
        ).toBe(0);
        const mats = [...new Set(partMaterials(FRAME_NAME))];
        expect(
          mats,
          `${FRAME_NAME} uses ${mats.join(', ')}. The brief assigns it the existing "${FRAME_MATERIAL}": the `
          + 'band and the ribs are the same folded metal, and increment 2 lights them as one.',
        ).toEqual([FRAME_MATERIAL]);
      });

      it('runs the whole way round the canopy edge, INCLUDING the bottom sill', () => {
        // INDEPENDENT, and the assertion Max's second reference is about — "bottom can be
        // simpler, more like this" is simpler, not absent. Asked from the RIM's side and
        // densely: a four-sided band has no vertices at all along the middle of its bottom
        // run, so any per-vertex or angular histogram would report a perfectly good frame
        // as full of holes. See the "samples a rim densely enough" self-test, where
        // deleting the bottom run strands rim samples 2 m from any frame while leaving the
        // bounding box untouched.
        const { samples, bounds: rimBox, edges } = rim();
        expect(edges.length, 'Canopy_Glass has no open rim for the frame to follow').toBeGreaterThanOrEqual(3);
        const tris = frame();

        const gaps = samples.map((p) => ({ p, d: GLB.distanceToTriangleList(tris, p).distance }));
        const worst = gaps.reduce((a, b) => (b.d > a.d ? b : a));
        const midY = (rimBox.min[1] + rimBox.max[1]) / 2;
        const worstLower = gaps.filter((g) => g.p[1] < midY).reduce((a, b) => (b.d > a.d ? b : a), { d: -1, p: null });
        expect(
          worst.d,
          `the canopy rim is UNFRAMED at [${worst.p.map((v) => v.toFixed(3))}]: the nearest ${FRAME_NAME} `
          + `geometry is ${worst.d.toFixed(3)} m away (limit ${FRAME_RIM_TOL} m). The worst gap along the `
          + `LOWER half of the rim is ${worstLower.d.toFixed(3)} m at y=${worstLower.p?.[1]?.toFixed(3)} — if `
          + 'that is the one failing, the sill is missing, and the sill is what puts a floor under the '
          + 'screens instead of leaving them hanging in space.',
        ).toBeLessThanOrEqual(FRAME_RIM_TOL);

        // ...and the band's own extent must REACH the rim's, or it is a smaller ring
        // sitting inside the opening that the sampling above cannot distinguish from a
        // correctly placed one if the tolerance ever grows.
        const frameBox = partBounds(FRAME_NAME);
        for (const [axis, label] of [[0, 'X (across)'], [1, 'Y (up)']]) {
          expect(
            frameBox.min[axis] - rimBox.min[axis],
            `${FRAME_NAME} stops at ${label} = ${frameBox.min[axis].toFixed(3)} but the canopy rim reaches `
            + `${rimBox.min[axis].toFixed(3)} — the band does not cover the opening`,
          ).toBeLessThanOrEqual(FRAME_RIM_SPAN_TOL);
          expect(
            rimBox.max[axis] - frameBox.max[axis],
            `${FRAME_NAME} stops at ${label} = ${frameBox.max[axis].toFixed(3)} but the canopy rim reaches `
            + `${rimBox.max[axis].toFixed(3)} — the band does not cover the opening`,
          ).toBeLessThanOrEqual(FRAME_RIM_SPAN_TOL);
        }

        // ...and the band must BE the edge rather than a plate across the opening that
        // happens to touch it. Face centroids as well as vertices, so a plate's interior
        // is counted (its vertices are all at the rim).
        const probes = [...partVerts(FRAME_NAME), ...tris.map((t) => GLB.triangleListCentroid([t]))];
        const near = probes.filter((p) => GLB.distanceToSegmentList(edges, p).distance <= FRAME_RIM_TOL).length;
        const fraction = near / probes.length;
        expect(
          fraction,
          `only ${(fraction * 100).toFixed(1)}% of ${FRAME_NAME}'s geometry (${probes.length} vertices and `
          + `face centroids) lies within ${FRAME_RIM_TOL} m of the Canopy_Glass rim. A perimeter band hugs `
          + 'the edge; anything reaching across the opening is a panel, and Max asked for none.',
        ).toBeGreaterThanOrEqual(FRAME_ON_RIM_FRACTION);
      });

      it('keeps the band FAIRLY THIN — the brief that was mis-read as "absent"', () => {
        // INDEPENDENT on the measurement, AUTHORITATIVE on the declaration, in the same
        // two-step idiom as the inch check: a generator that declared a 0.5 m "thin band"
        // and faithfully built one would satisfy every geometry-vs-sidecar comparison in
        // this file, so the declared constant is itself checked — against RIB_WIDTH, which
        // is the ballpark Max named for it.
        const run = rim().run;
        const volume = GLB.closedMeshVolume(frame());
        expect(run, 'the canopy rim has no length to run around').toBeGreaterThan(1);
        expect(volume, `${FRAME_NAME} encloses no volume — it is not a solid band`).toBeGreaterThan(0);
        const section = Math.sqrt(volume / run);
        expect(
          section / run,
          `${FRAME_NAME} holds ${volume.toFixed(4)} m^3 over a ${run.toFixed(2)} m run, an equivalent section `
          + `of ${(section * 1000).toFixed(0)} mm — ${((section / run) * 100).toFixed(2)}% of the run it `
          + `covers, against a ceiling of ${FRAME_THIN_RATIO * 100}%. That is a chunky ring, not the thin `
          + 'faceted edge in Max\'s references.',
        ).toBeLessThanOrEqual(FRAME_THIN_RATIO);

        const declRib = declaredAny(metrics, RIB_WIDTH_NAMES, { label: 'the canopy rib width in metres' });
        const declFrame = declaredAny(metrics, FRAME_WIDTH_NAMES, { label: 'the perimeter frame width in metres' });
        const ratio = declFrame / declRib;
        expect(
          ratio,
          `the declared frame width is ${declFrame} m against a declared rib width of ${declRib} m — `
          + `${ratio.toFixed(2)}x. Max briefed it as "a named constant in the same ballpark as RIB_WIDTH", `
          + `so the admissible range is ${FRAME_WIDTH_VS_RIB[0]}x to ${FRAME_WIDTH_VS_RIB[1]}x.`,
        ).toBeGreaterThanOrEqual(FRAME_WIDTH_VS_RIB[0]);
        expect(ratio).toBeLessThanOrEqual(FRAME_WIDTH_VS_RIB[1]);

        const built = section / declFrame;
        expect(
          built,
          `${FRAME_NAME} measures an equivalent section of ${(section * 1000).toFixed(1)} mm but the script `
          + `declares a width of ${(declFrame * 1000).toFixed(1)} mm — ${built.toFixed(2)}x. The section is `
          + 'sqrt(width x depth), so a band deeper than it is wide reads above 1; this range admits that and '
          + 'still rejects a declaration the geometry does not honour.',
        ).toBeGreaterThanOrEqual(FRAME_SECTION_VS_DECLARED[0]);
        expect(built).toBeLessThanOrEqual(FRAME_SECTION_VS_DECLARED[1]);
      });

      it('keeps the band off the OUTSIDE of the glass', () => {
        // INDEPENDENT and SIDED, the same predicate the ribs and screen units use, for the
        // same reason: unsigned distance to the shell reads identically for a band lying
        // on the inboard face of the canopy and one bolted to its outboard face. The
        // tolerance is derived from the band's OWN measured section — it straddles the
        // surface, so part of it legitimately sits outboard by up to that much — times the
        // ray-angle amplification at the corner of the opening. Unlike the ribs, which are
        // held to zero because they lie flat ON the inboard face, the band has no inboard
        // side to lie on: it IS the edge.
        const shell = glass();
        const verts = partVerts(FRAME_NAME);
        const tol = FRAME_SIDED_RAY_FACTOR * frameSection() + VERTEX_TOL;
        const sided = GLB.insideShellFromEye(shell, verts, { eye: EYE });
        expect(
          sided.tested,
          `none of ${FRAME_NAME}'s ${verts.length} vertices lies along an eye-ray that meets Canopy_Glass, so `
          + 'nothing about which side of the shell it is on is being tested. The band is supposed to sit ON '
          + 'the rim, half of it inside the glazed cone — if it has been moved entirely outboard of the '
          + 'glass, say so deliberately rather than leaving this measuring nothing.',
        ).toBeGreaterThan(0);
        expect(
          sided.worst.over,
          `${FRAME_NAME} has a vertex at [${sided.worst.point?.map((v) => v.toFixed(4))}] that is `
          + `${sided.worst.over?.toFixed(4)} m FURTHER from the eye than Canopy_Glass along the same ray `
          + `(glass at ${sided.worst.hit?.toFixed(4)} m), against a tolerance of ${tol.toFixed(4)} m — `
          + `${FRAME_SIDED_RAY_FACTOR}x its own ${(frameSection() * 1000).toFixed(0)} mm section. The band is `
          + 'on the outside of the canopy, where it would read as an exterior rib rather than as the edge.',
        ).toBeLessThanOrEqual(tol);
      });

      it('terminates BOTH ribs on the band — one end on its lower run, one on its upper', () => {
        // INDEPENDENT, and THE assertion that would have caught what Max saw in the orbit
        // view: two ribs and four screen boxes with nothing joining them to anything, so
        // the model read as "four monitors mounted on two lamp-posts floating in space".
        //
        // PLANTED DEFECTS VERIFIED AGAINST (both fire, see the task record):
        //   * a rib scaled to 0.8 of its length about its own centre, so both ends stop
        //     ~0.29 m short of the band — the distance half goes red, naming the rib and
        //     the gap.
        //   * a rib translated so both of its end regions sit against the band's UPPER run
        //     — the lower/upper half goes red even though both ends are touching frame.
        // Neither is caught by any other assertion in this file.
        const tris = frame();
        const rimBox = rim().bounds;
        const midY = (rimBox.min[1] + rimBox.max[1]) / 2;
        for (const name of RIB_NAMES) {
          const verts = partVerts(name);
          const ends = GLB.principalAxisEnds(verts, { fraction: RIB_END_FRACTION });
          expect(ends, `${name} carries no vertices`).not.toBeNull();
          expect(
            ends.axis,
            `${name}'s longest extent is along ${'XYZ'[ends.axis]}, not Y — its "ends" are not the ends of a `
            + 'vertical strip, so this measurement would be meaningless (see the vertical-strip check above)',
          ).toBe(1);

          for (const [label, group, wantAbove] of [['lower', ends.low, false], ['upper', ends.high, true]]) {
            expect(group.length, `${name} has no ${label} end region`).toBeGreaterThan(0);
            let best = { distance: Infinity, point: null, from: null };
            for (const p of group) {
              const hit = GLB.distanceToTriangleList(tris, p);
              if (hit.distance < best.distance) best = { ...hit, from: p };
            }
            expect(
              best.distance,
              `${name}'s ${label} end never comes closer than ${best.distance.toFixed(3)} m to ${FRAME_NAME} `
              + `(limit ${RIB_TERMINATION_TOL} m). Its nearest end vertex is at `
              + `[${best.from?.map((v) => v.toFixed(3))}]. A rib that terminates on nothing is a lamp-post: `
              + 'run it from the band\'s lower run, up and forward over the crest, to its upper run.',
            ).toBeLessThanOrEqual(RIB_TERMINATION_TOL);
            const landedY = best.point[1];
            expect(
              wantAbove ? landedY > midY : landedY < midY,
              `${name}'s ${label} end lands on ${FRAME_NAME} at y=${landedY.toFixed(3)}, on the wrong side of `
              + `the opening's mid-height (y=${midY.toFixed(3)}). Each rib must bridge the band's LOWER run to `
              + 'its UPPER run — both ends on the same run is a staple, not an A-pillar.',
            ).toBe(true);
          }
        }
      });
    });

    it('bulges the Canopy_Glass forward of its own rim', () => {
      // INDEPENDENT, and the geometric meaning of Max's "giving you a sense of the
      // canopy's protruding shape": a shell that merely spans the opening has its
      // most-forward point ON the rim. A protruding one reaches past it.
      const shell = glass();
      const rim = GLB.boundaryEdges(shell);
      expect(
        rim.length,
        'Canopy_Glass has no open boundary — it is a closed solid, not a shell spanning the canopy '
        + 'opening, so "does it bulge past its own rim?" has no answer',
      ).toBeGreaterThanOrEqual(3);

      const rimPoints = rim.flatMap((e) => [e.a, e.b]);
      const shellMinZ = Math.min(...partVerts(GLASS_NAME).map((p) => p[2]));
      const rimMinZ = Math.min(...rimPoints.map((p) => p[2]));
      const protrusion = rimMinZ - shellMinZ; // forward is -Z, so a bulge is more negative
      expect(
        protrusion,
        `Canopy_Glass reaches z=${shellMinZ.toFixed(4)} at its most forward point and z=${rimMinZ.toFixed(4)} `
        + `at its rim: it protrudes ${(protrusion * 1000).toFixed(1)} mm. A flat shell measures 0 here. `
        + `The floor for "protruding" is ${MIN_CANOPY_PROTRUSION * 1000} mm — this is a floor, not a design target.`,
      ).toBeGreaterThanOrEqual(MIN_CANOPY_PROTRUSION);
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

    it('is Y-up: the canopy sits forward at negative z and the ribs run up the Y axis', () => {
      // INDEPENDENT. Only true if export_yup ran. Without it, Blender's +Z up would leave
      // the canopy stacked in +Z, the ribs running fore-aft in the exported Z, and the
      // screens' up/down split flattened onto the wrong axis. (This used to be checked via
      // the frame ring and the nose; both were deleted in the re-spec.)
      const shell = partBounds(GLASS_NAME);
      expect(shell, 'Canopy_Glass carries no geometry').not.toBeNull();
      expect(
        shell.max[2],
        `Canopy_Glass reaches back to z=${shell.max[2].toFixed(4)} — the whole canopy must sit forward of `
        + 'the eye (z < 0)',
      ).toBeLessThan(0);
      for (const name of RIB_NAMES) {
        const rib = partBounds(name);
        expect(
          rib.size[1],
          `${name} spans ${rib.size[1].toFixed(3)} m in Y and ${rib.size[2].toFixed(3)} m in Z — under `
          + "Blender's +Z up without export_yup these would be swapped",
        ).toBeGreaterThan(rib.size[2]);
      }
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

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
//                                  Canopy_Glass shell
//   nose      Hull_Nose          -> DELETED. Its presence is now an AC-FORM failure.
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
const PART_NAMES = [...SCREEN_NAMES, ...BODY_NAMES, ...ARM_NAMES, ...RIB_NAMES, GLASS_NAME];

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
// Minimum forward bulge of the canopy shell beyond its own rim for "protruding" to mean
// anything. A flat shell spanning the opening measures 0 here.
const MIN_CANOPY_PROTRUSION = 0.02;

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
    it('has exactly the four named display-face nodes and no others', () => {
      for (const name of SCREEN_NAMES) {
        const hits = GLB.listNodes(gltf).filter((n) => n.name === name);
        expect(hits.length, `expected exactly one node named "${name}", found ${hits.length}`).toBe(1);
      }
      const screenish = GLB.listNodes(gltf).filter((n) => /^Screen_/.test(n.name ?? '')).map((n) => n.name);
      expect(screenish.slice().sort(), 'no extra Screen_* nodes may exist').toEqual(SCREEN_NAMES.slice().sort());
    });

    it('carries every named part on its own node: a body and an arm per screen, two ribs, one glass', () => {
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

    it('contains no ship nose anywhere — it was removed at Max\'s instruction', () => {
      // INDEPENDENT and deliberately broader than the exact name: Hull_Nose_001, a
      // stray nose mesh datablock or a nose material would all still put the deleted
      // geometry in the file. The re-spec removes the nose entirely; increment 1 has no
      // exterior hull.
      const named = [
        ...(gltf.nodes ?? []).map((n) => ['node', n.name]),
        ...(gltf.meshes ?? []).map((m) => ['mesh', m.name]),
        ...(gltf.materials ?? []).map((m) => ['material', m.name]),
      ].filter(([, n]) => typeof n === 'string');
      const offenders = named.filter(([, n]) => /nose/i.test(n)).map(([kind, n]) => `${kind} "${n}"`);
      expect(
        offenders,
        `the GLB still contains ${offenders.join(', ')}. Max removed the nose at UAT; AC-FORM now `
        + 'fails on its presence. Delete the nose build from scripts/cockpit-gen.py and regenerate.',
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

    it('lays both ribs on the Canopy_Glass surface', () => {
      // INDEPENDENT. A rib floating off the shell does not read as a canopy rib — it reads
      // as a bar hanging in space, and it is exactly what conveys the protruding shape if
      // it follows the surface. The tolerance is derived from each rib's OWN measured
      // thickness (a strip laid on a shell stands off by its own thickness) plus a margin,
      // so it adapts to a re-authored rib without admitting a floating one.
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
      }
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
          for (const v of partVerts(name)) {
            const range = Math.hypot(v[0], v[1], v[2]);
            if (range < 1e-6) continue;
            const hits = GLB.rayTriangleListHits(EYE, v, shell);
            if (!hits.length) continue;
            tested += 1;
            const over = range - hits[0];
            if (over > worst.over) worst = { over, name, vertex: v, hit: hits[0] };
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

      // Canopy_Glass is see-through by design and must not be counted. If the generator
      // reports a per-part occlusion term for it, that term has to be zero.
      const glassTerms = Object.entries(metrics.diagnostics ?? {})
        .filter(([k, v]) => /glass/i.test(k) && /occl/i.test(k) && typeof v === 'number');
      for (const [key, value] of glassTerms) {
        expect(
          value,
          `diagnostics.${key} = ${value}: Canopy_Glass is excluded from the occlusion measurement `
          + '(see-through by design), so its contribution must be zero',
        ).toBe(0);
      }
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
    const named = GLB.listNodes(json).map((n) => n.name);
    for (const expected of [...PART_NAMES, 'Eye_Point']) {
      expect(named, `a freshly generated GLB is missing node "${expected}"`).toContain(expected);
    }
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

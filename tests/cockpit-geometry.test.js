// tests/cockpit-geometry.test.js
//
// SCOPE: the headless half of workstream cockpit-lab-geometry-2026-07-28
// (docs/WORKSTREAMS/cockpit-lab-geometry-2026-07-28/contract.json).
// Covers the three unit-layer ACs — AC-FORM, AC-METRIC, AC-REPRO — by parsing the
// exported GLB directly (tests/helpers/glb-parse.mjs; no three.js, no browser, no DOM).
//
// DEFERRED to live verification by working-Claude: AC-FRAME (occlusion percentage at
// 70 degrees / 16:9, measured in chrome-devtools) and AC-LAB (the lab page loads and
// the eye button works). Neither is assertable from the container alone.
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
const SCREEN_NAMES = ['Screen_UL', 'Screen_UR', 'Screen_LL', 'Screen_LR'];
// Expected sign of (x, y) for each screen centre in glTF axes. Left/right are the
// PILOT's. Looking forward down -Z with +Y up, the pilot's right hand points along +X
// and their left along -X — so "UL" (upper-left) sits at (-x, +y) and "LR"
// (lower-right) at (+x, -y).
const QUADRANTS = {
  Screen_UL: [-1, +1],
  Screen_UR: [+1, +1],
  Screen_LL: [-1, -1],
  Screen_LR: [+1, -1],
};
const MAX_SCREEN_ANGLE_DEG = 20; // contract AC-FORM
// Vertex-level containment slack, metres. Coordinates are float32 at ~1.5 m, so the
// storage noise floor is ~1e-7 m; 0.1 mm is generous for "flush against the surface"
// while still nearly three orders of magnitude tighter than the authoring mistake this
// was written against (92 mm through the canopy plane, 87 mm through the pillar).
const VERTEX_TOL = 1e-4;

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
  throw new Error(
    `cockpit-metrics.json does not declare "${name}" (tried ${candidates.join(', ')}, `
    + 'at the top level and under .constants/.declared). The Blender script must write '
    + 'every named constant to the sidecar — the tests assert against script-declared '
    + 'values, not hard-coded literals.',
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
 * uses, and the one the frame-containment check below relies on).
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

  it('reads an inward-wound shell as a cavity (the frame-containment convention)', () => {
    // A ring solid's INNER wall faces the hole, so its winding normals point into the
    // cavity and "inside" is the intersection of the positive half-spaces. This is
    // exactly the predicate the screen-containment check below applies to the real frame.
    const planes = GLB.trianglePlanes(boxTriangles([-1, -1, -1], [1, 1, 1], { flip: true }));
    expect(planes).toHaveLength(6);
    const inside = (p) => planes.every((pl) => GLB.signedDistanceToPlane(pl, p) >= 0);
    expect(inside([0, 0, 0])).toBe(true);
    expect(inside([0.9, -0.9, 0.9])).toBe(true);
    expect(inside([1.1, 0, 0]), 'a point through the wall must read as outside').toBe(false);
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

describe.skipIf(missing.length > 0)('cockpit.glb — increment 1 geometry', () => {
  let glbBytes;
  let gltf;
  let bin;
  let metrics;

  beforeAll(() => {
    glbBytes = readFileSync(GLB_PATH);
    const parsed = GLB.parseGLB(glbBytes);
    gltf = parsed.json;
    bin = parsed.bin;
    metrics = JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
  });

  /** World centroid + winding normal of a named screen quad. */
  const screen = (name) => {
    const node = GLB.requireNode(gltf, name);
    const tris = GLB.nodeWorldTriangles(gltf, bin, node.index);
    return { node, tris, centre: GLB.triangleListCentroid(tris), normal: GLB.triangleListNormal(tris) };
  };

  /**
   * INDEPENDENT. The half-spaces bounding the canopy frame's inner cavity, measured
   * from the exported frame mesh — not reconstructed from the generator's constants,
   * which would only prove the generator agrees with itself.
   *
   * How the classification works: the frame is a ring solid, so the area-weighted
   * centroid of its surface lands in the HOLE, not in the material. Faces whose
   * winding normal points towards that interior point are the inner wall; the outer
   * wall and both rims point away from it and drop out. The rims dropping out is
   * what makes the result a laterally-bounding, depth-unbounded prism: a screen
   * retracted behind the rear rim is still legitimately inside the cockpit, whereas
   * a screen pushed through a pillar is not.
   *
   * If a future frame stops being a ring, this classification stops being meaningful
   * — the lateral-closure probe in the test below is what turns that into a loud
   * failure rather than a silent pass.
   */
  const frameCavity = () => {
    const tris = GLB.nodeWorldTriangles(gltf, bin, GLB.requireNode(gltf, 'Cockpit_Frame').index);
    const interior = GLB.triangleListCentroid(tris);
    const planes = GLB.trianglePlanes(tris);
    const inward = planes.filter((p) => GLB.signedDistanceToPlane(p, interior) > 0);
    return { interior, planes, inward };
  };

  // ── AC-FORM ────────────────────────────────────────────────────────────────
  // "four screen mounting planes, one in each quadrant of the canopy aperture (two
  //  upper, two lower), each plane's normal pointing within 20 degrees of the vector
  //  from that plane's centre to the eye-point at the origin ... plus ship-nose hull
  //  geometry below the median and forward of the eye, whose authored extents are a
  //  script-declared fraction of the Bible section 8A ~20 m house-sized hull."
  describe('AC-FORM — form language: four eye-facing corner screens plus the ship nose', () => {
    it('has exactly the four named screen nodes and no others', () => {
      for (const name of SCREEN_NAMES) {
        const hits = GLB.listNodes(gltf).filter((n) => n.name === name);
        expect(hits.length, `expected exactly one node named "${name}", found ${hits.length}`).toBe(1);
      }
      const screenish = GLB.listNodes(gltf).filter((n) => /^Screen_/.test(n.name ?? '')).map((n) => n.name);
      expect(screenish.slice().sort(), 'no extra Screen_* nodes may exist').toEqual(SCREEN_NAMES.slice().sort());
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

    it('keeps every screen VERTEX forward of the eye and behind the canopy plane', () => {
      // INDEPENDENT, and vertex-level on purpose. A centroid-only version of this check
      // passed while every quad poked 92 mm through the canopy plane: a quad tilted to
      // face the eye spans ~0.19 m in Z, so its centroid can sit comfortably inside
      // while its corners hang out through the front of the ship.
      const canopyZ = -declared(metrics, 'CANOPY_Y'); // Blender +Y forward -> glTF -Z
      for (const name of SCREEN_NAMES) {
        const box = GLB.nodeWorldBounds(gltf, bin, GLB.requireNode(gltf, name).index);
        expect(box, `${name} carries no geometry`).not.toBeNull();
        expect(
          box.max[2],
          `${name} has a vertex at z=${box.max[2].toFixed(4)}, at or behind the eye — screens live forward of the pilot`,
        ).toBeLessThan(0);
        // forward is -Z, so min[2] is the MOST forward vertex.
        expect(
          box.min[2] - canopyZ,
          `${name} pokes ${(canopyZ - box.min[2]).toFixed(4)} m through the canopy plane: its most-forward `
          + `vertex is at z=${box.min[2].toFixed(4)}, the plane is at z=${canopyZ.toFixed(4)}. Increase `
          + 'SCREEN_STANDOFF (or shrink the quad) until the whole quad clears it.',
        ).toBeGreaterThanOrEqual(-VERTEX_TOL);
      }
    });

    it('keeps every screen vertex inside the frame\'s inner face', () => {
      // INDEPENDENT. The other half of the same defect: the quads were also hanging
      // 87 mm outside the pillar they are mounted on, i.e. buried in / through the hull.
      const { interior, inward } = frameCavity();
      expect(
        inward.length,
        'no inward-facing frame walls were found — Cockpit_Frame is not a ring solid any more, so this '
        + 'containment check cannot mean anything. Re-derive it against the new frame topology.',
      ).toBeGreaterThanOrEqual(3);

      // Lateral-closure probe: prove the half-space set actually encloses something in
      // every direction before trusting it to reject anything. Without this, an empty or
      // one-sided plane set would make the assertion below unfailable.
      for (const dir of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) {
        const far = [interior[0] + dir[0] * 100, interior[1] + dir[1] * 100, interior[2]];
        expect(
          inward.some((p) => GLB.signedDistanceToPlane(p, far) < 0),
          `the frame's inner walls do not bound the cavity towards [${dir}] — the containment check is vacuous`,
        ).toBe(true);
      }

      for (const name of SCREEN_NAMES) {
        const verts = GLB.nodeWorldPositions(gltf, bin, GLB.requireNode(gltf, name).index);
        expect(verts.length, `${name} carries no vertices`).toBeGreaterThan(0);
        let worst = { distance: Infinity, vertex: null, normal: null };
        for (const v of verts) {
          for (const plane of inward) {
            const distance = GLB.signedDistanceToPlane(plane, v);
            if (distance < worst.distance) worst = { distance, vertex: v, normal: plane.normal };
          }
        }
        expect(
          worst.distance,
          `${name} vertex [${worst.vertex?.map((v) => v.toFixed(4))}] lies `
          + `${(-worst.distance).toFixed(4)} m OUTSIDE the frame's inner wall `
          + `(wall normal [${worst.normal?.map((v) => v.toFixed(3))}]) — the screen is inside/through the `
          + 'pillar it is mounted on, so it would be clipped by the hull from the seat and visible poking '
          + 'out of the ship from the orbit view.',
        ).toBeGreaterThanOrEqual(-VERTEX_TOL);
      }
    });

    it(`angles every screen at the pilot's eye, within ${MAX_SCREEN_ANGLE_DEG} degrees`, () => {
      // NEAR-TAUTOLOGY, read the green carefully. The generator builds each quad's basis
      // FROM the centre->eye vector, so the measured angle is ~0 by construction and the
      // 20-degree band cannot be approached by any change to the aperture or bevel
      // constants. What this can still catch: a winding flip (~180 degrees, hinted below),
      // an axis-conversion bug in the export, and a future generator that goes back to
      // hand-tuned Euler angles. It is NOT evidence that the angle was designed well.
      for (const name of SCREEN_NAMES) {
        const { centre, normal } = screen(name);
        const toEye = [EYE[0] - centre[0], EYE[1] - centre[1], EYE[2] - centre[2]];
        const angle = GLB.angleBetweenDegrees(normal, toEye);
        const hint = angle > 90
          ? ` The quad faces AWAY from the eye — its winding is inverted; reverse the face index order. `
            + `Unoriented misalignment is only ${(180 - angle).toFixed(2)} degrees.`
          : '';
        expect(
          angle,
          `${name}: normal [${normal.map((v) => v.toFixed(3))}] is ${angle.toFixed(2)} degrees off the `
          + `centre->eye vector (limit ${MAX_SCREEN_ANGLE_DEG}).${hint}`,
        ).toBeLessThanOrEqual(MAX_SCREEN_ANGLE_DEG);
      }
    });

    it('matches the screen centres and normals the sidecar declares', () => {
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
      }
    });

    it('agrees with the clearance the generator claims it achieved', () => {
      // CROSS-CHECK, not a measurement: these are the generator's OWN clearance numbers,
      // so this asserts the script knows it got it right. The two vertex-level checks
      // above are the independent evidence; this one exists so a regression names itself
      // in the generator's language ("SCREEN_STANDOFF is too small") rather than only in
      // the GLB's. Both are cheap; keeping both means a disagreement between them is
      // itself informative.
      const diag = metrics.diagnostics ?? {};
      for (const key of ['screenForwardOfCanopyPlane', 'screenOutsidePillarInnerFace']) {
        expect(typeof diag[key], `cockpit-metrics.json must declare diagnostics.${key}`).toBe('number');
        expect(
          diag[key],
          `the generator reports diagnostics.${key} = ${diag[key]} m of overshoot; it must author the `
          + 'screens clear of the frame, not merely report that they are not',
        ).toBeLessThanOrEqual(VERTEX_TOL);
      }
    });

    it('puts the ship nose below the median, forward of the canopy plane, and nowhere behind the eye', () => {
      const nose = GLB.requireNode(gltf, 'Hull_Nose');
      const box = GLB.nodeWorldBounds(gltf, bin, nose.index);
      expect(box, 'Hull_Nose carries no geometry').not.toBeNull();
      expect(box.min[1], 'Hull_Nose must reach below the eye plane (y < 0)').toBeLessThan(0);
      const canopyZ = -declared(metrics, 'CANOPY_Y');
      expect(
        box.min[2],
        `Hull_Nose must extend forward past the canopy plane (z < ${canopyZ}); measured min z ${box.min[2].toFixed(4)}`,
      ).toBeLessThan(canopyZ);
      // INDEPENDENT. Without this, a nose that ALSO ran BACKWARDS past the eye would pass
      // both checks above — exterior hull at z > 0 is geometry inside the pilot's head.
      expect(
        box.max[2],
        `Hull_Nose reaches back to z=${box.max[2].toFixed(4)}, at or behind the eye at the origin. `
        + 'The whole nose is exterior hull in front of the pilot; nothing may sit level with or behind them.',
      ).toBeLessThan(0);
    });

    it('states the nose extent as a fraction of the declared ~20 m hull reference', () => {
      expect(typeof metrics.hullReferenceLength, 'sidecar must declare hullReferenceLength').toBe('number');
      expect(typeof metrics.noseVisibleLength, 'sidecar must declare noseVisibleLength').toBe('number');
      expect(typeof metrics.noseFractionOfHull, 'sidecar must declare noseFractionOfHull').toBe('number');
      expect(metrics.hullReferenceLength).toBeGreaterThan(0);
      expect(metrics.noseVisibleLength).toBeGreaterThan(0);
      // TAUTOLOGY WITHIN THE SIDECAR: this is arithmetic on three numbers the same file
      // declared, so it only catches an internally inconsistent sidecar. The measured
      // cross-check below is the part that touches the GLB.
      expect(
        metrics.noseFractionOfHull,
        'noseFractionOfHull must equal noseVisibleLength / hullReferenceLength',
      ).toBeCloseTo(metrics.noseVisibleLength / metrics.hullReferenceLength, 9);
      expect(metrics.noseFractionOfHull, 'the visible nose must be a fraction of the whole hull').toBeLessThan(1);

      // INDEPENDENT. The declared length must correspond to something actually exported,
      // not a number invented in the sidecar. Two readings of "visible length" are
      // admissible and both are checked: the nose's own forward run, and its reach from
      // the eye.
      const box = GLB.nodeWorldBounds(gltf, bin, GLB.requireNode(gltf, 'Hull_Nose').index);
      const forwardSpan = box.max[2] - box.min[2];
      const reachFromEye = Math.abs(box.min[2]);
      const ok = [forwardSpan, reachFromEye].some((v) => Math.abs(v - metrics.noseVisibleLength) <= 1e-3);
      expect(
        ok,
        `declared noseVisibleLength=${metrics.noseVisibleLength} m matches neither measured extent of `
        + `Hull_Nose (forward span ${forwardSpan.toFixed(4)} m, reach from the eye ${reachFromEye.toFixed(4)} m)`,
      ).toBe(true);
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

    it('is Y-up: the canopy sits forward at negative z and the nose hangs below y=0', () => {
      // INDEPENDENT. Only true if export_yup ran. Without it, Blender's +Z up would leave
      // the frame stacked in +Z and the nose at negative Y-forward, and these flip.
      const frame = GLB.nodeWorldBounds(gltf, bin, GLB.requireNode(gltf, 'Cockpit_Frame').index);
      expect(frame, 'Cockpit_Frame carries no geometry').not.toBeNull();
      expect(frame.max[2], 'the whole canopy frame must sit forward of the eye (z < 0)').toBeLessThan(0);
      const canopyZ = -declared(metrics, 'CANOPY_Y');
      expect(
        frame.min[2],
        `the frame must reach the canopy plane at z=${canopyZ}; measured min z ${frame.min[2].toFixed(4)}`,
      ).toBeLessThanOrEqual(canopyZ + 1e-3);
      const nose = GLB.nodeWorldBounds(gltf, bin, GLB.requireNode(gltf, 'Hull_Nose').index);
      expect(nose.min[1], 'the nose must hang below the eye plane (y < 0)').toBeLessThan(0);
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
    for (const expected of [...SCREEN_NAMES, 'Cockpit_Frame', 'Hull_Nose']) {
      expect(named, `a freshly generated GLB is missing node "${expected}"`).toContain(expected);
    }
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

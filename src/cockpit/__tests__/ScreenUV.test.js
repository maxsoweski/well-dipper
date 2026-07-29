/**
 * ScreenUV — which corner of a screen quad carries uv (0,0). Lane F,
 * workstream `cockpit-screen-content-2026-07-28`, AC-UV-ORIENTATION.
 *
 * WHY THIS FILE EXISTS
 *
 * Every panel lane F draws — a nav ladder, a throttle bar, a target reticle —
 * is authored in UV space and lands on the glass wherever the mesh's TEXCOORD_0
 * says it lands. Get the corner wrong and nothing errors: the cockpit renders,
 * the frame rate is fine, and the readouts are simply upside down or mirrored.
 * That is a silent failure, so it needs a loud test.
 *
 * The obvious place to look the answer up is the sidecar,
 * public/assets/cockpit/cockpit-metrics.json, whose `uvNote` declares
 * "(0,0) at the pilot's LOWER-LEFT corner". The exported MESH says the opposite:
 * the vertices carrying v=0 are the ones highest off the deck, because glTF
 * texture space runs y-DOWN, so v=0 is the TOP edge.
 *
 * That disagreement is NOT a stale note that has since been fixed upstream —
 * measured on the assets in this worktree on 2026-07-28, it is live and unreconciled:
 *
 *   - scripts/cockpit-gen.py:1859-1860 declares SCREEN_FACE_UV in _rect()'s corner
 *     order and comments that (0,0) therefore lands at (-widthAxis, -heightAxis),
 *     i.e. the pilot's LOWER-LEFT. It still says that; nothing has been corrected.
 *   - The GLB it produced puts uv (0,0) at -0.225 along widthAxis and +0.150 along
 *     heightAxis on all four screens: LEFT, but TOP. The v axis comes out inverted
 *     relative to the generator's own stated intent.
 *   - tests/cockpit-geometry.test.js cannot notice, because it pins the sidecar's
 *     declared `uv` array against a literal and separately sorts the mesh's UVs. It
 *     never compares the declaration to the per-vertex mapping, so the two are free
 *     to disagree forever.
 *
 * Which of the two is authoritative is lane E's call to make, not this file's. What
 * this file does is refuse to depend on the answer: it binds to the mesh, because
 * the mesh is the thing the renderer actually samples. A description that disagrees
 * with the geometry it describes cannot be the seam panel code builds on.
 *
 * WHY LANE E's tests/cockpit-geometry.test.js DOES NOT ALREADY COVER THIS
 *
 * It .sort()s the four UV pairs before comparing them, which proves the face
 * carries the four corners of the unit square but throws away WHICH VERTEX carried
 * WHICH corner. A v-flip and a u-mirror both leave that sorted set identical, so
 * both pass it green. The whole content of this file is the pairing lane E discards:
 * entry i of TEXCOORD_0 belongs to vertex i of POSITION, same index, no reordering.
 *
 * HOW IT ASSERTS: ORDERINGS, NOT COORDINATES
 *
 * Screen positions are still being re-fitted — the panel face has already taken
 * five different sizes as the cabin was re-proportioned — so any baked y or x would
 * be a tripwire on lane E's next solve, not a check on orientation. What is stable
 * is the ORDER: v=0 vertices sit above v=1 vertices, and u=1 vertices sit to the
 * right of u=0 vertices. Move the screens anywhere in the cabin and those hold;
 * flip the map and they break. (Today's numbers, for orientation only and
 * deliberately not in any assertion: Screen_UL has v=0 at y=0.5777 against v=1 at
 * y=0.2889, and u=1 at x=-0.7595 against u=0 at x=-1.1212.)
 *
 * Axis convention, stated here rather than read from the sidecar: glTF / three.js,
 * +X right, +Y up, forward is -Z, pilot's eye at the origin. Everything
 * glb-parse.mjs returns is already in those axes with no conversion applied.
 *
 * Lane E's files are read, never written. Its describe.skipIf pattern is
 * deliberately NOT copied: lane E defends that with a separate gate test, and a
 * lane-F file that copied the skip without the gate would go green the day an
 * asset went missing. A missing asset must fail here, naming what is missing.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseGLB, readAccessor, listNodes, buildParentMap, nodeWorldMatrix, transformPoint,
} from '../../../tests/helpers/glb-parse.mjs';
import { SCREEN_NODE_RE } from '../PanelLayout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ASSET_DIR = join(REPO, 'public', 'assets', 'cockpit');

/**
 * Every .glb in the asset directory, by GLOB rather than by name.
 *
 * Naming a single file would mean a lane-E rename silently disarms this test: the
 * named file is gone, the glob is empty, nothing is checked, everything is green.
 * Globbing plus the non-vacuity assertion below closes that off — a rename still
 * finds the screens, and a deletion fails.
 */
const glbFiles = () => readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'));

/**
 * Float comparison guard. This is a numerical-noise floor, NOT a geometric
 * threshold: two vertices whose world Y differs by 1e-12 are the same height as
 * far as any exporter is concerned, and letting that read as "strictly greater"
 * would be accepting a flat-on-its-face quad as correctly oriented.
 */
const EPS = 1e-9;

/** How close a uv component has to be to 0 or 1 to count as that corner. */
const UV_EPS = 1e-6;

/**
 * The (uv, world position) pairs of every Screen_* node in one GLB.
 *
 * The pairing is the point: TEXCOORD_0 entry i and POSITION entry i describe the
 * SAME vertex, so they are read by the same index out of the same primitive and
 * never sorted, bucketed or re-ordered on the way here. The position is pushed
 * through the node's full world matrix, because "above" and "to the right" are
 * questions about the cockpit, not about the mesh's local frame.
 *
 * DUPLICATES: the screens are indexed geometry (4 vertices, 6 indices, two
 * triangles sharing a diagonal), so today no (position, uv) pair repeats — but a
 * de-indexed re-export would repeat two of them, and a subdivided face would repeat
 * more. Identical pairs are welded here, keyed on the rounded uv AND the rounded
 * world position together. Two vertices at the same place carrying DIFFERENT uvs
 * survive as two entries, which is correct: that is a genuine seam and the
 * orientation check should see both.
 */
function screenUVPairs(file) {
  const { json, bin } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  const parents = buildParentMap(json);
  const out = [];

  for (const { index, name, node } of listNodes(json)) {
    if (!SCREEN_NODE_RE.test(name || '')) continue;
    // A node NAMED like a screen but carrying no mesh is not "nothing to check" —
    // it is a screen this file cannot check, which is the same silent pass a
    // describe.skipIf would give us. Exporters produce this shape routinely (a
    // transform node parenting the real geometry), so it is a live path, and it
    // must be a readable failure rather than one fewer screen in the loop.
    if (node.mesh === undefined) {
      throw new Error(
        `${file} / ${name}: node matches ${SCREEN_NODE_RE} but carries no mesh, so its UV map ` +
        `cannot be read. If the model now parents the glass under a transform node, this ` +
        `traversal has to follow children — it must not quietly measure one screen fewer.`,
      );
    }

    const world = nodeWorldMatrix(json, index, parents);
    const pairs = [];
    const seen = new Set();

    for (const prim of json.meshes[node.mesh].primitives ?? []) {
      const posIndex = prim.attributes?.POSITION;
      const uvIndex = prim.attributes?.TEXCOORD_0;
      // Loud, not skipped: a screen face with no UV map cannot carry a panel at
      // all, and "no UVs so nothing to check" is exactly the vacuous pass this
      // whole file exists to prevent.
      if (posIndex === undefined) throw new Error(`${file} / ${name}: primitive has no POSITION attribute`);
      if (uvIndex === undefined) throw new Error(`${file} / ${name}: primitive has no TEXCOORD_0 attribute — the display face carries no UV map`);

      const pos = readAccessor(json, bin, posIndex);
      const uv = readAccessor(json, bin, uvIndex);
      if (uv.count !== pos.count) {
        throw new Error(
          `${file} / ${name}: TEXCOORD_0 has ${uv.count} entries but POSITION has ${pos.count} — ` +
          `they cannot be paired by index.`,
        );
      }

      for (let i = 0; i < pos.count; i++) {
        const p = transformPoint(world, [pos.array[i * 3], pos.array[i * 3 + 1], pos.array[i * 3 + 2]]);
        const t = [uv.array[i * 2], uv.array[i * 2 + 1]];
        const key = [...t, ...p].map((v) => Math.round(v / 1e-6)).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ uv: t, world: p });
      }
    }
    out.push({ file, node: name, pairs });
  }
  return out;
}

/** Is this uv component sitting on `target` (0 or 1)? */
const isCorner = (c, target) => Math.abs(c - target) <= UV_EPS;

/**
 * Throw unless a screen's UV map is oriented the way the renderer needs it.
 *
 * A pure function over (uv, world) pairs, on purpose: it is the same code path for
 * the real assets and for the two deliberately-corrupted copies below, so the
 * negative cases test the actual check rather than a re-implementation of it.
 *
 * (a) v=0 is the TOP edge. Every vertex carrying v=0 must sit strictly higher in
 *     world Y than every vertex carrying v=1. Pairwise-strictest on purpose: the
 *     screens are not rolled about their normals, so each edge is level, and a
 *     weaker mean-vs-mean comparison would accept a face that had been sheared.
 *
 * (b) u grows toward the pilot's RIGHT (+X). Compared WITHIN each v row, because
 *     the panels are tilted to face the pilot — the top and bottom edges of one
 *     screen sit at different depths, and comparing across rows would be measuring
 *     the tilt rather than the mapping.
 *
 * @param {{uv:number[], world:number[]}[]} pairs
 * @param {string} label who this is, for the failure message
 */
function assertScreenUVOrientation(pairs, label) {
  if (!pairs || pairs.length === 0) {
    throw new Error(`${label}: no (uv, position) pairs to check — nothing was measured`);
  }

  // The contract is a UNIT-SQUARE map, so every uv must be a corner of it. If a
  // future model tessellates the face this fails, and that is deliberate: an
  // interior vertex means "top edge" and "right edge" need re-deriving, and that
  // should be a decision somebody makes, not something this test quietly averages.
  for (const { uv } of pairs) {
    const onU = isCorner(uv[0], 0) || isCorner(uv[0], 1);
    const onV = isCorner(uv[1], 0) || isCorner(uv[1], 1);
    if (!onU || !onV) {
      throw new Error(
        `${label}: uv (${uv[0]}, ${uv[1]}) is not a corner of the unit square. ` +
        `The display face is contracted to be a unit-square UV quad.`,
      );
    }
  }

  const vTop = pairs.filter((p) => isCorner(p.uv[1], 0));
  const vBottom = pairs.filter((p) => isCorner(p.uv[1], 1));
  if (!vTop.length || !vBottom.length) {
    throw new Error(
      `${label}: the map does not span v — found ${vTop.length} vertices at v=0 and ` +
      `${vBottom.length} at v=1. Both edges must be present or there is no orientation to check.`,
    );
  }

  // (a) v=0 above v=1, in world Y.
  const lowestAtV0 = Math.min(...vTop.map((p) => p.world[1]));
  const highestAtV1 = Math.max(...vBottom.map((p) => p.world[1]));
  if (!(lowestAtV0 - highestAtV1 > EPS)) {
    throw new Error(
      `${label}: v=0 is not the TOP edge. Lowest v=0 vertex is at world y=${lowestAtV0.toFixed(6)}, ` +
      `highest v=1 vertex is at y=${highestAtV1.toFixed(6)}. glTF texture space is y-down, so v=0 ` +
      `must be the edge highest off the deck — a panel drawn on this face would come out upside down.`,
    );
  }

  // (b) u=1 to the right of u=0, in world X, compared within each v row.
  for (const [vLabel, row] of [['v=0', vTop], ['v=1', vBottom]]) {
    const left = row.filter((p) => isCorner(p.uv[0], 0));
    const right = row.filter((p) => isCorner(p.uv[0], 1));
    if (!left.length || !right.length) {
      throw new Error(
        `${label}: the ${vLabel} edge does not span u — ${left.length} vertices at u=0 and ` +
        `${right.length} at u=1. Both ends must be present or there is no orientation to check.`,
      );
    }
    const leftmostAtU1 = Math.min(...right.map((p) => p.world[0]));
    const rightmostAtU0 = Math.max(...left.map((p) => p.world[0]));
    if (!(leftmostAtU1 - rightmostAtU0 > EPS)) {
      throw new Error(
        `${label}: on the ${vLabel} edge, u does not grow toward the pilot's right. ` +
        `Leftmost u=1 vertex is at world x=${leftmostAtU1.toFixed(6)}, rightmost u=0 vertex is at ` +
        `x=${rightmostAtU0.toFixed(6)}. +X is right, so u=1 must be the greater — a panel drawn on ` +
        `this face would come out mirrored.`,
      );
    }
  }
}

/** Every screen in every GLB that has any, across the whole asset directory. */
function allScreens() {
  return glbFiles().flatMap((f) => screenUVPairs(f));
}

/**
 * A census of nodes NAMED like a screen, taken independently of the reader above.
 *
 * This exists to catch the partial-vacuity defect, which is nastier than the total
 * one: if some future filter inside screenUVPairs drops three of the four screens,
 * `screens.length > 0` is still satisfied and the whole suite stays green while
 * measuring a quarter of what it claims to. Counting by NAME ONLY — no mesh lookup,
 * no accessors, nothing the reader could also get wrong — gives an oracle the
 * reader has to match exactly.
 */
function screenNodeNames(file) {
  const { json } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  return listNodes(json)
    .filter(({ name }) => SCREEN_NODE_RE.test(name || ''))
    .map(({ name }) => `${file} / ${name}`);
}

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first: this file DISCUSSES lane E's skipIf in its header,
 * and the pattern is assembled from fragments, because a literal one would match
 * itself. Either would fail a file that is in fact clean. The check is about code,
 * not prose.
 *
 * `.only` is scanned alongside `.skip` because it is the same failure wearing a
 * friendlier name: one focused test silently disables the other six.
 *
 * WHY THIS SITS AT MODULE SCOPE AND THROWS, rather than living only inside an it().
 * Measured, not assumed: putting `it.only` on one test in this file made vitest
 * report "1 passed | 6 skipped" and exit GREEN — because the scan is one of the six
 * it skipped. A self-scan that only runs as a test cannot see a helper that stops it
 * running. Module scope executes during collection, before the runner can honour any
 * `.only`, so the throw below fires whatever the helpers say. The it() further down
 * is kept anyway, so the guarantee still shows up by name in the test report.
 */
const SELF_CODE = readFileSync(join(HERE, 'ScreenUV.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'ScreenUV.test.js disables one of its own tests (a skip or focus helper is present in its ' +
    'code). Lane F asserts against assets that can go missing, so a disabled test here reads ' +
    'as "the cockpit UVs are fine" when nothing was measured at all. Remove the helper.',
  );
}

describe('ScreenUV — the mesh decides which corner is (0,0) (AC-UV-ORIENTATION)', () => {
  it('finds screen faces to check at all, so a green run is never a vacuous one', () => {
    // cockpit-tub.glb ships zero Screen_* nodes, so "some GLB has none" is normal
    // and must not fail. "NO GLB has any" is the failure — it means the assets were
    // renamed out from under this file, or deleted, and every assertion below would
    // have iterated an empty list and passed without measuring anything.
    const files = glbFiles();
    expect(files.length).toBeGreaterThan(0);

    const screens = allScreens();
    expect(
      screens.length,
      `No Screen_* nodes in any of: ${files.join(', ')}. Nothing was measured.`,
    ).toBeGreaterThan(0);

    for (const s of screens) {
      expect(s.pairs.length, `${s.file} / ${s.node} carried no (uv, position) pairs`).toBeGreaterThan(0);
    }

    // And EVERY screen got measured, not just one. Without this, three of the four
    // faces can be dropped by any filter added to the traversal and the suite still
    // reports green — a green run that checked a quarter of the cockpit.
    const named = glbFiles().flatMap((f) => screenNodeNames(f)).sort();
    const measured = screens.map((s) => `${s.file} / ${s.node}`).sort();
    expect(
      measured,
      `Screen_* nodes exist that were never measured. Named: ${named.join(', ') || '(none)'}.`,
    ).toEqual(named);
  });

  it('pairs TEXCOORD_0 entry i with POSITION vertex i and finds the four unit-square corners', () => {
    // Lane E already checks that the four UV pairs ARE the unit square, but it
    // sorts them first. This is the un-sorted version: each corner is present
    // exactly once and is attached to a distinct vertex, which is what makes the
    // orientation questions below answerable at all.
    //
    // The guard is not decoration: this body is a bare for-of, so with no screens
    // to iterate it passes having asserted nothing. (Verified — renaming the glob
    // suffix leaves this test green while its neighbours go red.)
    const screens = allScreens();
    expect(screens.length).toBeGreaterThan(0);

    for (const { file, node, pairs } of screens) {
      const corners = pairs.map((p) => `${Math.round(p.uv[0])},${Math.round(p.uv[1])}`).sort();
      expect(corners, `${file} / ${node}`).toEqual(['0,0', '0,1', '1,0', '1,1']);

      const places = new Set(pairs.map((p) => p.world.map((v) => Math.round(v / 1e-6)).join(',')));
      expect(places.size, `${file} / ${node}: two UV corners land on the same vertex`).toBe(4);
    }
  });

  it('puts v=0 on the TOP edge and grows u toward the pilot\'s right, on every screen', () => {
    const screens = allScreens();
    expect(screens.length).toBeGreaterThan(0);

    for (const { file, node, pairs } of screens) {
      // Throws with the offending numbers in the message, rather than reporting a
      // bare `false`, because "which way is this screen mapped" is not something
      // anyone can reconstruct from a failed boolean.
      expect(() => assertScreenUVOrientation(pairs, `${file} / ${node}`)).not.toThrow();
    }
  });

  it('rejects a v-flipped map — the exact defect the sidecar\'s old uvNote described', () => {
    // v' = 1 - v is what "(0,0) at the pilot's LOWER-LEFT corner" would have meant.
    // It leaves the sorted UV set identical, which is why lane E's check cannot see
    // it, and it is the single most likely way this seam breaks: someone reads the
    // note, flips the map to match, and every panel renders upside down.
    const screens = allScreens();
    expect(screens.length).toBeGreaterThan(0);

    for (const { file, node, pairs } of screens) {
      const flipped = pairs.map((p) => ({ uv: [p.uv[0], 1 - p.uv[1]], world: p.world }));
      expect(
        () => assertScreenUVOrientation(flipped, `${file} / ${node} (v-flipped)`),
        `${file} / ${node}: a v-flipped map was accepted`,
      ).toThrow(/v=0 is not the TOP edge/);
    }
  });

  it('rejects a u-mirrored map, which the sorted-UV check also cannot see', () => {
    // u' = 1 - u likewise leaves the sorted set alone. A mirrored panel is subtler
    // than an upside-down one on screen — symmetric artwork looks fine — so this is
    // the one most likely to ship unnoticed.
    const screens = allScreens();
    expect(screens.length).toBeGreaterThan(0);

    for (const { file, node, pairs } of screens) {
      const mirrored = pairs.map((p) => ({ uv: [1 - p.uv[0], p.uv[1]], world: p.world }));
      expect(
        () => assertScreenUVOrientation(mirrored, `${file} / ${node} (u-mirrored)`),
        `${file} / ${node}: a u-mirrored map was accepted`,
      ).toThrow(/u does not grow toward the pilot's right/);
    }
  });

  it('refuses to measure nothing: empty input and a half-spanned map both throw', () => {
    // The guards that stop a mangled read from looking like a pass.
    expect(() => assertScreenUVOrientation([], 'empty')).toThrow(/nothing was measured/);

    const topEdgeOnly = [
      { uv: [0, 0], world: [-1, 0.5, -1.2] },
      { uv: [1, 0], world: [-0.7, 0.5, -1.3] },
    ];
    expect(() => assertScreenUVOrientation(topEdgeOnly, 'top edge only')).toThrow(/does not span v/);

    const interior = [
      { uv: [0, 0], world: [-1, 0.5, -1.2] },
      { uv: [0.5, 0.5], world: [-0.85, 0.4, -1.25] },
    ];
    expect(() => assertScreenUVOrientation(interior, 'interior vertex'))
      .toThrow(/not a corner of the unit square/);
  });

  it('contains no skip or focus helper, so a deleted asset can never make it green', () => {
    // The scan itself is at module scope (see the comment on SELF_DISABLES_TESTS
    // above) so that a `.only` cannot switch off the very check that would catch it.
    // This assertion restates the result so the guarantee is named in the report
    // rather than being an invisible import-time side effect.
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});

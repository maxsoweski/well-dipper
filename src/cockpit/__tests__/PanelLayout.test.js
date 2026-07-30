/**
 * PanelLayout — lane F (cockpit-screen-content-2026-07-28), AC-PANEL-BINDING.
 *
 * Which corner shows which screen is a KNOB, not a hard-wire. And lane F writes
 * down nothing about how big a screen is, what shape it is, or where it sits —
 * that is measured off whatever model is loaded, at load.
 *
 * That rule is not theoretical. Measured across the two models that exist:
 *
 *            this worktree's model     lane E's alpha
 *   size     0.450 x 0.300 m           0.240 x 0.200 m
 *   aspect   1.500  (3:2)              1.200  (6:5)
 *
 * The ASPECT changed, not just the scale, so a panel built for 3:2 comes out
 * STRETCHED on lane E's cockpit rather than merely small. The face has taken five
 * different values as the cabin was re-proportioned; cockpit-metrics.json still
 * describes the older one. Reading the sidecar is the same hard-coding one
 * indirection out.
 *
 * Lane F owns this file. Lane E's tests/cockpit-geometry.test.js is not touched,
 * and its describe.skipIf pattern is deliberately NOT copied: lane E defends that
 * with a separate gate test, and a lane-F file that copied the skip without the
 * gate would go green on a deleted asset.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseGLB, listNodes, requireNode, buildParentMap, nodeWorldMatrix,
  nodeWorldPositions, nodeWorldUvs, planarFrame, frameExtents, triangleListCentroid,
  nodeWorldTriangles,
} from '../../../tests/helpers/glb-parse.mjs';
import {
  DEFAULT_PANEL_ROLES, measureQuad, measureQuadBasis, resolvePanelRoles, SCREEN_NODE_RE,
} from '../PanelLayout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ASSET_DIR = join(REPO, 'public', 'assets', 'cockpit');

const glbFiles = () => readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'));

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first: this file DISCUSSES lane E's skipIf in its header,
 * and the pattern is assembled from fragments, because a literal one would match
 * itself. Either would fail a file that is in fact clean. The check is about code,
 * not prose.
 *
 * `.only` is scanned alongside `.skip` because it is the same failure wearing a
 * friendlier name: one focused test silently disables all the others.
 *
 * WHY THIS SITS AT MODULE SCOPE AND THROWS, rather than living only inside an it().
 * Measured on the sibling ScreenUV.test.js, not assumed: putting `it.only` on one
 * test made vitest report "1 passed | 6 skipped" and exit GREEN — because the scan
 * was one of the tests it skipped. A self-scan that only runs as a test cannot see a
 * helper that stops it running. Module scope executes during collection, before the
 * runner can honour any `.only`, so the throw below fires whatever the helpers say.
 */
const SELF_CODE = readFileSync(join(HERE, 'PanelLayout.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'PanelLayout.test.js disables one of its own tests (a skip or focus helper is present in ' +
    'its code). Lane F asserts against assets that can go missing, so a disabled test here ' +
    'reads as "the panels bind fine" when nothing was measured at all. Remove the helper.',
  );
}

/** Every Screen_* node in a GLB, with its own world-space vertex positions and uvs. */
function screensOf(file) {
  const { json, bin } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  const nodes = listNodes(json);
  const out = [];
  nodes.forEach((n, i) => {
    if (!SCREEN_NODE_RE.test(n.name || '')) return;
    out.push({
      name: n.name,
      index: i,
      points: nodeWorldPositions(json, bin, i),
      uvs: nodeWorldUvs(json, bin, i),
    });
  });
  return { json, bin, screens: out };
}

/**
 * A face's u and v extents, keyed off the UVs and measured a different way.
 *
 * A SECOND OPINION on the labelling, which `planarFrame` / `frameExtents` cannot
 * give: that pair fits an ARBITRARY in-plane axis and calls it u, so its du and dw
 * are the right two magnitudes with no idea which is which. This picks the four
 * corners out by uv quadrant and averages the two edges on each axis — the same
 * semantics the lab's own probe arrived at independently — so it can disagree with
 * `measureQuad` about which number is the width, which is the whole point.
 */
function uvKeyedExtents(points, uvs) {
  const at = (u, v) => {
    const i = points.findIndex((_, k) => (uvs[k][0] < 0.5) === u && (uvs[k][1] < 0.5) === v);
    if (i < 0) throw new Error(`uvKeyedExtents: no corner at uv quadrant u<0.5=${u} v<0.5=${v}`);
    return points[i];
  };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const tl = at(true, true), tr = at(false, true), bl = at(true, false), br = at(false, false);
  return { u: (d(tl, tr) + d(bl, br)) / 2, v: (d(tl, bl) + d(tr, br)) / 2 };
}

describe('PanelLayout — roles are config, geometry is derived (AC-PANEL-BINDING)', () => {
  it('finds the four screen faces and does not mistake their housings for them', () => {
    // The model carries ScreenBody_UL/UR/LL/LR too — the bezels the glass sits in.
    // A matcher of /^Screen/ would pick up eight nodes and bind roles to housings.
    const withScreens = glbFiles().filter((f) => screensOf(f).screens.length > 0);
    expect(withScreens.length).toBeGreaterThan(0);   // never pass vacuously

    for (const f of withScreens) {
      const names = screensOf(f).screens.map((s) => s.name).sort();
      expect(names).toEqual(['Screen_LL', 'Screen_LR', 'Screen_UL', 'Screen_UR']);
    }
    expect(SCREEN_NODE_RE.test('ScreenBody_UL')).toBe(false);
  });

  it('maps the four roles one-to-one onto the four screen nodes', () => {
    const roles = Object.keys(DEFAULT_PANEL_ROLES);
    const nodes = Object.values(DEFAULT_PANEL_ROLES);

    expect(roles.sort()).toEqual(['DRIVE', 'INFO', 'NAV', 'TARGET']);
    expect([...nodes].sort()).toEqual(['Screen_LL', 'Screen_LR', 'Screen_UL', 'Screen_UR']);
    expect(new Set(nodes).size).toBe(4);   // bijective — no two roles on one screen
  });

  it('swapping two entries in the config swaps which panel draws where', () => {
    const names = ['Screen_UL', 'Screen_UR', 'Screen_LL', 'Screen_LR'];
    const base = resolvePanelRoles(DEFAULT_PANEL_ROLES, names);

    const permuted = { ...DEFAULT_PANEL_ROLES,
      NAV: DEFAULT_PANEL_ROLES.DRIVE, DRIVE: DEFAULT_PANEL_ROLES.NAV };
    const after = resolvePanelRoles(permuted, names);

    const byRole = (list) => Object.fromEntries(list.map((p) => [p.role, p.node]));
    expect(byRole(after).NAV).toBe(byRole(base).DRIVE);
    expect(byRole(after).DRIVE).toBe(byRole(base).NAV);
    expect(byRole(after).INFO).toBe(byRole(base).INFO);
    expect(byRole(after).TARGET).toBe(byRole(base).TARGET);
  });

  it('fails loudly, naming the node, when a configured screen is not in the model', () => {
    // cockpit-tub.glb ships ZERO Screen_* nodes today. That must be a readable
    // failure at the seam, never a silent skip.
    expect(() => resolvePanelRoles(DEFAULT_PANEL_ROLES, ['Screen_UL', 'Screen_UR']))
      .toThrow(/Screen_LL/);
    expect(() => resolvePanelRoles(DEFAULT_PANEL_ROLES, [])).toThrow(/Screen_UL/);
  });

  it('measures a quad of known size from its vertices and uvs', () => {
    // A 0.4 x 0.2 rectangle in the z = -1 plane, facing +z. LANDSCAPE, and left
    // exactly as it was: it is half the proof that reading the axes off the uvs
    // changed no number for a face shaped like the ones the cockpit ships.
    const pts = [[-0.2, -0.1, -1], [0.2, -0.1, -1], [-0.2, 0.1, -1], [0.2, 0.1, -1]];
    // v = 0 is the top edge, so the y = +0.1 pair carries it.
    const uvs = [[0, 1], [1, 1], [0, 0], [1, 0]];

    const m = measureQuad(pts, uvs);

    expect(m.width).toBeCloseTo(0.4, 6);
    expect(m.height).toBeCloseTo(0.2, 6);
    expect(m.aspect).toBeCloseTo(2.0, 6);
    expect(m.centre.x).toBeCloseTo(0, 6);
    expect(m.centre.y).toBeCloseTo(0, 6);
    expect(m.centre.z).toBeCloseTo(-1, 6);
  });

  it('derives every real panel from that node\'s OWN vertices, whatever model is on disk', () => {
    const files = glbFiles().filter((f) => screensOf(f).screens.length > 0);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const { json, bin, screens } = screensOf(file);
      for (const s of screens) {
        const mine = measureQuad(s.points, s.uvs);

        // Independent measurement straight off the accessor, via the helper's own
        // oriented-rectangle primitive — a second opinion, not the same code twice.
        const tris = nodeWorldTriangles(json, bin, s.index);
        const frame = planarFrame(tris);
        const ext = frameExtents(frame, s.points);   // { u:{min,max}, w:{min,max}, n:{min,max} }
        const du = ext.u.max - ext.u.min;
        const dw = ext.w.max - ext.w.min;
        const centroid = triangleListCentroid(tris);

        // `planarFrame` fits an ARBITRARY in-plane axis and calls it u, so this pair
        // is a genuine second opinion on the two MAGNITUDES and no opinion at all on
        // which is which. It used to be compared with a Math.max / Math.min of its
        // own — the identical crossing the code was making, so it could never go red
        // on a crossed axis. It now checks the magnitudes as an unordered pair, and
        // the LABELLING is checked below against the uvs, which is the only place
        // that question has an answer.
        const magnitudes = [du, dw].sort((a, b) => a - b);
        const got = [mine.width, mine.height].sort((a, b) => a - b);
        expect(got[0]).toBeCloseTo(magnitudes[0], 4);
        expect(got[1]).toBeCloseTo(magnitudes[1], 4);

        // The labelling, keyed off TEXCOORD_0 and measured a different way — corner
        // by uv quadrant, edges averaged — rather than off a fitted frame.
        const uvExt = uvKeyedExtents(s.points, s.uvs);
        expect(mine.width, `${file}/${s.name}: width is not the u extent`)
          .toBeCloseTo(uvExt.u, 6);
        expect(mine.height, `${file}/${s.name}: height is not the v extent`)
          .toBeCloseTo(uvExt.v, 6);
        expect(mine.aspect).toBeCloseTo(uvExt.u / uvExt.v, 4);
        expect(mine.centre.x).toBeCloseTo(centroid[0], 4);
        expect(mine.centre.y).toBeCloseTo(centroid[1], 4);
        expect(mine.centre.z).toBeCloseTo(centroid[2], 4);

        // And it is a real panel, not a degenerate sliver.
        expect(mine.width).toBeGreaterThan(0.01);
        expect(mine.height).toBeGreaterThan(0.01);
      }
    }
  });

  it('holds Max\'s ruling that all four monitors are the same size', () => {
    // Lane E handoff, Max this session: "I want the monitors to be the same size
    // and dimensions." A future model that solves a layout problem by making one
    // pair bigger must fail here rather than ship asymmetric screens.
    const files = glbFiles().filter((f) => screensOf(f).screens.length > 0);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const sizes = screensOf(file).screens.map((s) => measureQuad(s.points, s.uvs));
      const first = sizes[0];
      for (const m of sizes.slice(1)) {
        expect(m.width).toBeCloseTo(first.width, 5);
        expect(m.height).toBeCloseTo(first.height, 5);
        expect(m.aspect).toBeCloseTo(first.aspect, 5);
      }
    }
  });

  it('writes down no panel dimension anywhere in lane F\'s source', () => {
    // Not directly, and not by reading them back out of cockpit-metrics.json —
    // which is the same hard-coding one indirection out, and is currently wrong
    // for BOTH models on disk.
    const srcDir = join(REPO, 'src', 'cockpit');
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);

    for (const f of files) {
      const src = readFileSync(join(srcDir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')      // strip block comments
        .replace(/^\s*\/\/.*$/gm, '');          // strip line comments
      expect(src).not.toMatch(/\b0\.45\b/);
      expect(src).not.toMatch(/\b0\.30\b/);
      expect(src).not.toMatch(/SCREEN_W|SCREEN_H/);
      expect(src).not.toMatch(/cockpit-metrics/);
      expect(src).not.toMatch(/screens\s*\[\s*\d+\s*\]\s*\.\s*(width|height)/);
    }
  });

  it('contains no skip or focus helper, so a deleted asset can never make it green', () => {
    // The real guard runs at module scope below — see the comment there for why an
    // in-test version cannot work. This restates the guarantee by name in the report.
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});

/**
 * measureQuadBasis — which way is up, tested WITHOUT going through a mover.
 *
 * This block exists because of a specific near-miss. The mover's own suite checked
 * the landed panel's orientation by calling this function — the same one the mover
 * solves with — so a consistent error in here cancelled itself out end to end.
 * Planting a v-flip, a u-mirror and a reversed normal left every one of those 31
 * tests green. An instrument cannot be its own control.
 *
 * So here the basis is checked against geometry whose answer is known by
 * construction: a quad is built FROM a chosen frame, and the function has to
 * recover that frame. Nothing downstream is involved, and nothing here calls
 * anything that also consumes the result.
 */
describe('measureQuadBasis — recovering a frame the fixture already knows', () => {
  /**
   * Build a quad's (position, uv) pairs from a frame chosen in advance.
   *
   * uv (0,0) is the pilot's TOP-LEFT on these faces, so the corner at
   * (-w/2 right, +h/2 up) is the one that carries it.
   */
  function quadFrom({ centre, right, up, w, h }) {
    const n = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
    const R = n(right);
    // Gram-Schmidt, so the fixture's own frame is exactly orthonormal and its
    // stated expectation is the truth rather than approximately the truth. Chosen
    // over hand-picking perpendicular vectors because `measureQuadBasis`
    // deliberately orthonormalises what it recovers — a fixture that is a degree
    // out of square would report that correct behaviour as an error, which is how
    // a good test gets "fixed" into a bad one.
    const d = up[0] * R[0] + up[1] * R[1] + up[2] * R[2];
    const U = n(up.map((c, k) => c - d * R[k]));
    const at = (su, sv) => [0, 1, 2].map((k) => centre[k] + R[k] * su * w / 2 + U[k] * sv * h / 2);
    return {
      points: [at(-1, 1), at(1, 1), at(-1, -1), at(1, -1)],
      uvs: [[0, 0], [1, 0], [0, 1], [1, 1]],
      expect: { right: R, up: U },
    };
  }

  const dot = (a, b) => a.x * b[0] + a.y * b[1] + a.z * b[2];
  const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  ];

  /** Frames chosen so no axis is a world axis — an axis-aligned fixture hides sign errors. */
  const FRAMES = [
    { label: 'facing the pilot, level', centre: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], w: 0.24, h: 0.2 },
    { label: 'yawed and pitched', centre: [-0.9, 0.55, -1.4], right: [0.8, 0.1, 0.6], up: [-0.05, 0.98, -0.12], w: 0.6, h: 0.2 },
    { label: 'rolled hard', centre: [0.7, -0.4, -1.1], right: [0.3, 0.9, 0.2], up: [-0.9, 0.32, 0.1], w: 0.3, h: 0.45 },
    { label: 'mounted upside down', centre: [0, 0.8, -1.2], right: [-1, 0, 0], up: [0, -1, 0], w: 0.25, h: 0.25 },
  ];

  for (const f of FRAMES) {
    it(`recovers right, up and normal — ${f.label}`, () => {
      const q = quadFrom(f);
      const b = measureQuadBasis(q.points, q.uvs);
      expect(dot(b.right, q.expect.right), 'right').toBeCloseTo(1, 9);
      expect(dot(b.up, q.expect.up), 'up').toBeCloseTo(1, 9);
      // right x up, so the normal comes out of the FRONT of the screen.
      expect(dot(b.normal, cross3(q.expect.right, q.expect.up)), 'normal').toBeCloseTo(1, 9);
    });
  }

  it('returns an orthonormal frame even when the fixture is slightly out of square', () => {
    // A real exported quad is planar to float precision, not exactly.
    const q = quadFrom(FRAMES[1]);
    q.points[3][1] += 1e-4;
    const b = measureQuadBasis(q.points, q.uvs);
    for (const v of [b.right, b.up, b.normal]) {
      expect(Math.hypot(v.x, v.y, v.z), 'not unit length').toBeCloseTo(1, 9);
    }
    expect(b.right.x * b.up.x + b.right.y * b.up.y + b.right.z * b.up.z, 'right and up not square')
      .toBeCloseTo(0, 9);
    expect(b.up.x * b.normal.x + b.up.y * b.normal.y + b.up.z * b.normal.z, 'up and normal not square')
      .toBeCloseTo(0, 9);
  });

  it('the mounting does not decide which edge is the top — the uvs do', () => {
    // The tempting shortcut is "the highest corner is the top". It is right for
    // every panel in the cockpit as it stands and it is a fact about this
    // mounting, not about panels. An inverted mount proves the difference: here
    // the uv-top edge is BELOW the uv-bottom edge in world Y, and the recovered
    // up must still point along the panel's own up, which is world -Y.
    const q = quadFrom(FRAMES[3]);
    const b = measureQuadBasis(q.points, q.uvs);
    expect(b.up.y, 'up followed gravity instead of the uvs').toBeCloseTo(-1, 9);
  });

  it('refuses geometry it cannot orient, rather than emitting NaNs', () => {
    const q = quadFrom(FRAMES[0]);
    expect(() => measureQuadBasis(q.points, null)).toThrow(/uv/);
    expect(() => measureQuadBasis(q.points, q.uvs.slice(0, 2))).toThrow(/uv/);
    // Every uv on one side of centre: the face has lost its unit-square mapping.
    expect(() => measureQuadBasis(q.points, [[0, 0], [0, 0], [0, 0], [0, 0]]))
      .toThrow(/unit square/);
    // A collapsed quad has no axes to recover.
    expect(() => measureQuadBasis([[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], q.uvs))
      .toThrow(/no length/);
  });
});

/**
 * measureQuad — WHICH extent is the width, and why it cannot be the longer one.
 *
 * ⭐ THIS BLOCK IS THE UNFINISHED HALF OF THE LESSON THE BLOCK ABOVE LEARNED.
 *
 * `measureQuadBasis` was corrected once already: it must not call whichever edge is
 * highest off the deck "the top", because that is a fact about this mounting and not
 * about panels. `measureQuad` went on making the same class of assumption one
 * function over — it called whichever edge was LONGER "the width", so its reported
 * aspect was always >= 1 and a portrait face had its two axes crossed before
 * anything downstream saw it. A crossed pair reaches `solveFillDistance` as
 * (height, width) and the panel lands at (u/v) of the right distance: for a 9:16
 * face at fill 0.85 that is 1.51 of the view, half a screen past the edge.
 *
 * The shortcut looked right for the same reason the other one did. Every face in the
 * cockpit as mounted today is 0.24 x 0.20 landscape, so the longer edge IS the u
 * edge and max/min returns the correct answer for all four. That is why the suite
 * was green over it, and it is why the bit-exactness test below matters as much as
 * the portrait one: the fix must change no number for the cockpit that ships.
 *
 * Nothing here goes through a mover or a host. The quads are built FROM a frame
 * chosen in advance, so the expected answer is known by construction rather than by
 * asking the code under test what it thinks.
 */
describe('measureQuad — the uvs say which extent is the width', () => {
  /**
   * A quad `w` across its u axis and `h` along its v axis, in a chosen frame.
   *
   * The uv list is a separate argument rather than baked in, because the sharpest
   * available test hands the SAME positions two different uv layouts: if the answer
   * changes, the labelling followed the uvs; if it does not, it followed the geometry.
   */
  function quadOf({ centre, right, up, w, h }, uvs = [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const n = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
    const R = n(right);
    const d = up[0] * R[0] + up[1] * R[1] + up[2] * R[2];
    const U = n(up.map((c, k) => c - d * R[k]));
    // Corner order TL, TR, BL, BR, matching the default uv list above.
    const at = (su, sv) => [0, 1, 2].map((k) => centre[k] + R[k] * su * w / 2 + U[k] * sv * h / 2);
    return { points: [at(-1, 1), at(1, 1), at(-1, -1), at(1, -1)], uvs, R, U };
  }

  /** The span of a point set along one unit axis. */
  const spanAlong = (points, a) => {
    const t = points.map((p) => p[0] * a.x + p[1] * a.y + p[2] * a.z);
    return Math.max(...t) - Math.min(...t);
  };

  /**
   * The measurement as it stood before the uvs were consulted, written out here so
   * "the shipped numbers did not move" can be an Object.is comparison rather than a
   * tolerance. Deliberately a copy of the old arithmetic, weld and all: if the fix
   * re-derives the extents by projecting onto the basis instead of relabelling the
   * distances it already computed, the last few ulps move and this goes red.
   */
  function legacyMeasure(points) {
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const pts = [];
    for (const p of points) if (!pts.some((q) => dist(p, q) < 1e-6)) pts.push(p);
    const others = pts.slice(1).map((p) => dist(pts[0], p)).sort((a, b) => a - b);
    return { width: Math.max(others[0], others[1]), height: Math.min(others[0], others[1]) };
  }

  const LEVEL = { centre: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0] };
  const ROLLED = { centre: [0.7, -0.4, -1.1], right: [0.3, 0.9, 0.2], up: [-0.9, 0.32, 0.1] };

  it('measures a PORTRAIT face as portrait — the taller axis is its height', () => {
    // 0.20 across, 0.24 tall: the v extent is the larger one. Today's max/min hands
    // back width 0.24 / height 0.20 and an aspect of 1.2 for a face that is 0.833.
    const q = quadOf({ ...LEVEL, w: 0.20, h: 0.24 });

    const m = measureQuad(q.points, q.uvs);

    expect(m.width, 'width is the u extent, not the longer edge').toBeCloseTo(0.20, 12);
    expect(m.height, 'height is the v extent, not the shorter edge').toBeCloseTo(0.24, 12);
    expect(m.aspect, 'aspect is u/v and is allowed to be less than 1').toBeCloseTo(0.20 / 0.24, 12);
    expect(m.aspect).toBeLessThan(1);
  });

  it('takes the uvs as the ONLY tiebreak when the two edges are a hair apart', () => {
    // u is the SHORTER axis by 1e-7. Small enough that no plausible geometric
    // heuristic could be expected to get it right, large enough that max/min gets it
    // measurably wrong — so this bites any implementation that still consults
    // magnitude to decide the LABEL, rather than only to report it.
    const q = quadOf({ ...ROLLED, w: 0.2000000, h: 0.2000001 });

    const m = measureQuad(q.points, q.uvs);

    expect(m.width).toBeCloseTo(0.2000000, 12);
    expect(m.height).toBeCloseTo(0.2000001, 12);
    expect(m.width, 'the shorter edge is still the width when the uvs say so')
      .toBeLessThan(m.height);
  });

  it('an exact square has no tie to break, and the width axis is still the u axis', () => {
    // The synthetic cockpit already ships one (Screen_LL, 0.18 x 0.18), so this is
    // not hypothetical geometry. An exactly square quad CANNOT discriminate an
    // implementation through width and height alone — both answers are the same
    // number — which is exactly why it is tested for a different property: that it
    // does not throw, and that the axis it calls `width` is the axis
    // `measureQuadBasis` calls `right`, under two different uv layouts on ONE set of
    // positions.
    const geometry = { ...ROLLED, w: 0.25, h: 0.25 };
    // Layout B rotates the mapping 90 degrees: u now runs along the frame's up.
    const rotated = [[1, 0], [1, 1], [0, 0], [0, 1]];

    for (const [label, uvs] of [['as authored', undefined], ['uvs rotated 90 degrees', rotated]]) {
      const q = quadOf(geometry, uvs);
      const m = measureQuad(q.points, q.uvs);
      const b = measureQuadBasis(q.points, q.uvs);

      expect(m.width, label).toBeCloseTo(0.25, 12);
      // Close, not bit-equal: the fixture's own two edges differ by one ulp once a
      // rolled frame has been through Gram-Schmidt. Demanding Object.is here would
      // be asserting something about float arithmetic, not about the labelling.
      expect(m.height, label).toBeCloseTo(m.width, 12);
      expect(m.aspect, label).toBeCloseTo(1, 12);
      expect(spanAlong(q.points, b.right), `${label}: width is not the basis right axis`)
        .toBeCloseTo(m.width, 12);
      expect(spanAlong(q.points, b.up), `${label}: height is not the basis up axis`)
        .toBeCloseTo(m.height, 12);
    }
  });

  it('cannot disagree with measureQuadBasis about the same quad', () => {
    // The standing version of the comment this whole fix is about. The two functions
    // are called four lines apart in PanelMover._rig and nothing there compares them,
    // so the one pairing that could have caught the crossing never asked. Now it does.
    const CASES = [
      { label: 'landscape, level', ...LEVEL, w: 0.24, h: 0.20 },
      { label: 'portrait, level', ...LEVEL, w: 0.20, h: 0.24 },
      { label: 'portrait, rolled hard', ...ROLLED, w: 0.30, h: 0.45 },
      { label: 'square, rolled hard', ...ROLLED, w: 0.25, h: 0.25 },
      { label: 'portrait, mounted upside down', centre: [0, 0.8, -1.2], right: [-1, 0, 0], up: [0, -1, 0], w: 0.18, h: 0.44 },
      { label: 'wide, yawed and pitched', centre: [-0.9, 0.55, -1.4], right: [0.8, 0.1, 0.6], up: [-0.05, 0.98, -0.12], w: 0.62, h: 0.21 },
    ];

    for (const c of CASES) {
      const q = quadOf(c);
      const m = measureQuad(q.points, q.uvs);
      const b = measureQuadBasis(q.points, q.uvs);
      expect(spanAlong(q.points, b.right), `${c.label}: width is not the span along right`)
        .toBeCloseTo(m.width, 12);
      expect(spanAlong(q.points, b.up), `${c.label}: height is not the span along up`)
        .toBeCloseTo(m.height, 12);
    }
  });

  it('leaves the shipped cockpit\'s numbers alone, to the last bit', () => {
    // ⭐ THE NO-OP, PROVED RATHER THAN ASSUMED. Every face in every GLB on disk is
    // landscape, so the u edge IS the longer one and the fix must be a pure
    // relabelling for all of them — Object.is, not toBeCloseTo, because a tolerance
    // would accept a re-derivation that quietly shifts the floats the game runs on.
    const files = glbFiles().filter((f) => screensOf(f).screens.length > 0);
    expect(files.length).toBeGreaterThan(0);

    let checked = 0;
    for (const file of files) {
      for (const s of screensOf(file).screens) {
        const now = measureQuad(s.points, s.uvs);
        const before = legacyMeasure(s.points);
        expect(Object.is(now.width, before.width),
          `${file}/${s.name}: width moved from ${before.width} to ${now.width}`).toBe(true);
        expect(Object.is(now.height, before.height),
          `${file}/${s.name}: height moved from ${before.height} to ${now.height}`).toBe(true);
        // The premise the assertion rests on: these faces really are landscape, so
        // agreement is the correct answer here and not a fix that failed to apply.
        expect(now.width, `${file}/${s.name} is not landscape`).toBeGreaterThan(now.height);
        checked += 1;
      }
    }
    expect(checked, 'no shipped face was measured').toBeGreaterThanOrEqual(4);

    // And the synthetic landscape case the file has always carried.
    const q = quadOf({ ...LEVEL, w: 0.4, h: 0.2 });
    const now = measureQuad(q.points, q.uvs);
    const before = legacyMeasure(q.points);
    expect(Object.is(now.width, before.width)).toBe(true);
    expect(Object.is(now.height, before.height)).toBe(true);
  });

  it('refuses a positions-only call rather than guessing which axis is which', () => {
    // The property that makes the rest of this block enforceable: after this, no
    // caller can receive a crossed answer without an exception first. A flag in the
    // return value would not do — the docstring has asserted "no assumption about
    // which way the quad is oriented" for the whole life of the function that was
    // making exactly that assumption, and 2236 tests went past it.
    const q = quadOf({ ...LEVEL, w: 0.24, h: 0.20 });
    expect(() => measureQuad(q.points)).toThrow(/uv/);
    expect(() => measureQuad(q.points, null)).toThrow(/uv/);
    expect(() => measureQuad(q.points, q.uvs.slice(0, 2))).toThrow(/uv/);
    // Every uv on one side of centre: the face has lost its unit-square mapping and
    // there is no axis to read off it.
    expect(() => measureQuad(q.points, [[0, 0], [0, 0], [0, 0], [0, 0]]))
      .toThrow(/unit square/);
  });
});

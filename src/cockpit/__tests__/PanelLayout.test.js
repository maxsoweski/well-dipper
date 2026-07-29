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
  nodeWorldPositions, planarFrame, frameExtents, triangleListCentroid,
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

/** Every Screen_* node in a GLB, with its own world-space vertex positions. */
function screensOf(file) {
  const { json, bin } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  const nodes = listNodes(json);
  const out = [];
  nodes.forEach((n, i) => {
    if (!SCREEN_NODE_RE.test(n.name || '')) return;
    out.push({ name: n.name, index: i, points: nodeWorldPositions(json, bin, i) });
  });
  return { json, bin, screens: out };
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

  it('measures a quad of known size from its vertices alone', () => {
    // A 0.4 x 0.2 rectangle in the z = -1 plane, facing +z.
    const pts = [[-0.2, -0.1, -1], [0.2, -0.1, -1], [-0.2, 0.1, -1], [0.2, 0.1, -1]];

    const m = measureQuad(pts);

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
        const mine = measureQuad(s.points);

        // Independent measurement straight off the accessor, via the helper's own
        // oriented-rectangle primitive — a second opinion, not the same code twice.
        const tris = nodeWorldTriangles(json, bin, s.index);
        const frame = planarFrame(tris);
        const ext = frameExtents(frame, s.points);   // { u:{min,max}, w:{min,max}, n:{min,max} }
        const du = ext.u.max - ext.u.min;
        const dw = ext.w.max - ext.w.min;
        const w = Math.max(du, dw);
        const h = Math.min(du, dw);
        const centroid = triangleListCentroid(tris);

        expect(mine.width).toBeCloseTo(w, 4);
        expect(mine.height).toBeCloseTo(h, 4);
        expect(mine.aspect).toBeCloseTo(w / h, 4);
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
      const sizes = screensOf(file).screens.map((s) => measureQuad(s.points));
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

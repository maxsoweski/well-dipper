/**
 * PanelLayout — lane F (cockpit-screen-content-2026-07-28), AC-PANEL-BINDING.
 *
 * Which corner shows which screen is a KNOB, not a hard-wire. And lane F writes
 * down nothing about how big a screen is, what shape it is, or where it sits —
 * that is measured off whatever model is loaded, at load.
 *
 * That rule is not theoretical. Measured 2026-07-28 across the two models that
 * exist right now:
 *
 *            this worktree's model     lane E's alpha        the docs claim
 *   size     0.5408 x 0.4500 m         0.3124 x 0.2400 m     0.45 x 0.30
 *   aspect   1.202                     1.302                 1.5  (3:2)
 *   centre   (+-0.916, +0.433, -1.238) (+-0.497, +0.186, -0.599)   --
 *
 * Three different answers, and the documented one matches NEITHER model. Reading
 * the numbers out of cockpit-metrics.json is the same hard-coding one indirection
 * out, and would have been wrong for both.
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
  DEFAULT_PANEL_ROLES, measureQuad, resolvePanelRoles, SCREEN_NODE_RE,
} from '../PanelLayout.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ASSET_DIR = join(REPO, 'public', 'assets', 'cockpit');

const glbFiles = () => readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'));

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

  it('contains no skip helper, so a deleted asset can never make it green', () => {
    // Comments stripped first: this file DISCUSSES lane E's skipIf in its header,
    // and the pattern is built from fragments, because a literal one would match
    // itself. Both would fail a file that is in fact clean. The check is about
    // code, not prose.
    const code = readFileSync(join(HERE, 'PanelLayout.test.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const skip = new RegExp(['describe', 'it', 'test'].map((k) => k + '\\.skip').join('|'));
    expect(skip.test(code)).toBe(false);
  });
});

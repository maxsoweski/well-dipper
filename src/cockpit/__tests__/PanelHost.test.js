/**
 * PanelHost — lane F (cockpit-screen-content-2026-07-28), AC-PANEL-HOST.
 *
 * The host is where lane F's pure functions meet an actual cockpit, so these
 * tests are about the four things that can only go wrong at that seam:
 *
 *   1. THE BUFFER'S SHAPE. Width must come from the face's MEASURED aspect and a
 *      target height, never from a second written-down number. The display face
 *      has been re-proportioned five times and is 6:5 today; a buffer built two
 *      numbers at a time draws it stretched, on every screen, with no error.
 *   2. WHICH MESHES GET WRITTEN TO. The four faces share one material in the
 *      model (measured: all four reference `Mat_Screen`), so the naive wiring
 *      leaves all four screens showing whichever canvas was assigned last. And
 *      the bezels — `ScreenBody_*`, carrying `Mat_Body` — must be untouched.
 *   3. HOW OFTEN IT REPAINTS. Ambient when nothing is urgent, every frame while
 *      an alert BLINKS, and an immediate repaint the frame a warp begins so the
 *      dossier that just became untrue leaves the glass. Driven entirely off the
 *      timestamps handed to update(), so it is a counting test rather than a
 *      timing one.
 *   4. THE TWO SHAPES OF MISSING SCREEN. A configured node the model does not
 *      have must THROW naming it; a model with no screens at all (cockpit-tub.glb
 *      ships exactly that) must bind zero panels in silence.
 *
 * Everything geometric is driven from the REAL GLBs as well as from synthetic
 * three.js trees. A fixture alone would only ever prove the host agrees with the
 * assumptions the fixture was written under; the assets are what ships.
 *
 * Lane E's files are read, never written, and its `describe.skipIf` pattern is
 * deliberately not copied — see the module-scope self-scan near the end of the
 * preamble for what replaces it and why that check cannot live inside an it().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import {
  parseGLB, listNodes, nodeWorldPositions, nodeWorldUvs, nodeWorldTriangles,
  planarFrame, frameExtents,
} from '../../../tests/helpers/glb-parse.mjs';
import { DEFAULT_PANEL_ROLES, SCREEN_NODE_RE, measureQuad } from '../PanelLayout.js';
import { buildCockpitSnapshot } from '../CockpitSnapshot.js';
import {
  DEFAULT_PANEL_BUFFER_HEIGHT_PX, DEFAULT_AMBIENT_REPAINT_MS,
  derivePanelBuffer, hasBlinkingAlert, PanelHost,
} from '../PanelHost.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const ASSET_DIR = join(REPO, 'public', 'assets', 'cockpit');

/** Every .glb by GLOB, not by name — a rename must not silently empty the suite. */
const glbFiles = () => readdirSync(ASSET_DIR).filter((f) => f.endsWith('.glb'));

/**
 * Is this file disabling any of its own tests?
 *
 * Comments are stripped first and the pattern is assembled from fragments, because
 * a literal one would match itself and fail a file that is in fact clean.
 *
 * WHY THIS SITS AT MODULE SCOPE AND THROWS rather than living only inside an it().
 * Measured on the sibling ScreenUV.test.js, not assumed: putting a focus helper on
 * one test made vitest report "1 passed | 6 skipped" and exit GREEN, because the
 * scan was one of the tests it skipped. A self-scan that only runs as a test cannot
 * see a helper that stops it running. Module scope executes during collection,
 * before the runner can honour any focus helper, so the throw below fires whatever
 * the helpers say.
 */
const SELF_CODE = readFileSync(join(HERE, 'PanelHost.test.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const DISABLED_RE = new RegExp(
  ['describe', 'it', 'test'].flatMap((k) => [k + '\\.skip', k + '\\.only']).join('|'),
);
const SELF_DISABLES_TESTS = DISABLED_RE.test(SELF_CODE);
if (SELF_DISABLES_TESTS) {
  throw new Error(
    'PanelHost.test.js disables one of its own tests (a skip or focus helper is present in ' +
    'its code). This file asserts against assets that can go missing and against a repaint ' +
    'tier whose whole content is a count, so a disabled test here reads as "the panels are ' +
    'live" when nothing was measured at all. Remove the helper.',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stand-ins for the platform
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A 2D context that records rather than rasterises.
 *
 * It counts the two calls these tests reason about — `clearRect` (which is how
 * the host blanks unclaimed glass) and `fillRect` (what a painter typically does
 * first) — and accepts the rest of the drawing surface silently so a realistic
 * painter can be handed in without this stub growing to match it.
 *
 * THE STYLE PROPERTIES ARE REAL SETTERS, NOT PLAIN FIELDS, and that is the whole
 * point of them being here. A colour does not reach the glass through a method
 * call — it reaches it through an ASSIGNMENT, `ctx.fillStyle = '#ff0000'`, which
 * a plain field accepts in total silence. A stub that only counts method calls
 * therefore cannot see the one thing the one-ink rule is about, and every test
 * written against it is decorative. Measured, not assumed: with these as plain
 * fields, a `panel.ctx.fillStyle = '#ff0000'` planted in PanelHost's paint path
 * left the suite fully green. Every assignment is pushed to `_assigned` so a test
 * can say "the host set nothing" and mean it.
 */
function recordingCtx(canvas) {
  const calls = { clearRect: 0, fillRect: 0, fillText: 0 };
  const assigned = [];
  const ctx = {
    canvas,
    _calls: calls,
    _assigned: assigned,
    clearRect() { calls.clearRect += 1; },
    fillRect() { calls.fillRect += 1; },
    fillText() { calls.fillText += 1; },
    measureText(text) { return { width: String(text).length * 8 }; },
    save() {}, restore() {}, translate() {}, scale() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {},
  };
  // Everything a real CanvasRenderingContext2D carries ink or ink-adjacent state
  // on. Listed out rather than trapped with a Proxy so the stub stays something a
  // reader can see the whole of.
  const styleDefaults = {
    fillStyle: '#000000', strokeStyle: '#000000', font: '', textAlign: 'left',
    textBaseline: 'top', globalAlpha: 1, lineWidth: 1, globalCompositeOperation: 'source-over',
    shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0, filter: 'none',
  };
  for (const [prop, initial] of Object.entries(styleDefaults)) {
    let value = initial;
    Object.defineProperty(ctx, prop, {
      enumerable: true,
      get: () => value,
      set: (next) => { assigned.push({ prop, value: next }); value = next; },
    });
  }
  return ctx;
}

/** The injected canvas factory. Reports exactly the size it was asked for. */
function stubCanvas(width, height) {
  const canvas = { width, height };
  const ctx = recordingCtx(canvas);
  canvas.getContext = (kind) => (kind === '2d' ? ctx : null);
  return canvas;
}
const makeCanvas = (w, h) => stubCanvas(w, h);

/**
 * A four-corner quad mesh, in float32 exactly as a GLTF loader would produce.
 *
 * The uv attribute is no longer optional decoration on a screen face: the host
 * measures the face's SHAPE off it, because the buffer's aspect is u/v and there is
 * nothing in a bare position list that says which extent is the width. Bezels are
 * never measured, so they may still be built without one.
 */
function quadMesh(name, corners, material, uvs = null) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/** A 2:1 LANDSCAPE face, offset so the four are in different places. Shape, not size. */
const CORNERS_2_1 = [[-0.2, -0.1, -1], [0.2, -0.1, -1], [-0.2, 0.1, -1], [0.2, 0.1, -1]];
/** A 1:2 PORTRAIT face — the shape every fixture in this file used to be unable to express. */
const CORNERS_1_2 = [[-0.1, -0.2, -1], [0.1, -0.2, -1], [-0.1, 0.2, -1], [0.1, 0.2, -1]];
/** Corner order above is BL, BR, TL, TR, and v = 0 is the TOP edge. */
const UVS_BL_BR_TL_TR = [[0, 1], [1, 1], [0, 0], [1, 0]];
const shift = (corners, dx, dy) => corners.map(([x, y, z]) => [x + dx, y + dy, z]);

/**
 * A synthetic cockpit: four identical display faces sharing ONE material, plus
 * four bezels sharing another. The shared material is the model's actual shape
 * (asserted against the GLB further down) and is the trap the host has to survive.
 */
function syntheticCockpit(
  names = ['Screen_UL', 'Screen_UR', 'Screen_LL', 'Screen_LR'],
  corners = CORNERS_2_1,
) {
  const root = new THREE.Group();
  const screenMaterial = new THREE.MeshStandardMaterial({ name: 'Mat_Screen' });
  const bodyMaterial = new THREE.MeshStandardMaterial({ name: 'Mat_Body' });
  const offsets = [[-0.3, 0.2], [0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]];
  names.forEach((name, i) => {
    const [dx, dy] = offsets[i % offsets.length];
    root.add(quadMesh(name, shift(corners, dx, dy), screenMaterial, UVS_BL_BR_TL_TR));
    root.add(quadMesh(name.replace('Screen_', 'ScreenBody_'), shift(corners, dx, dy), bodyMaterial));
  });
  return { root, screenMaterial, bodyMaterial };
}

// ─────────────────────────────────────────────────────────────────────────────
// The real assets
// ─────────────────────────────────────────────────────────────────────────────

/** Every node named like a screen or a bezel in one GLB, with its world geometry. */
function glbScreenNodes(file) {
  const { json, bin } = parseGLB(readFileSync(join(ASSET_DIR, file)));
  const nodes = [];
  for (const { index, name, node } of listNodes(json)) {
    if (!/^Screen/i.test(name || '')) continue;
    nodes.push({
      name,
      index,
      isFace: SCREEN_NODE_RE.test(name),
      materials: node.mesh !== undefined
        ? (json.meshes[node.mesh].primitives ?? []).map((p) => p.material)
        : [],
      points: nodeWorldPositions(json, bin, index),
      // Faces carry TEXCOORD_0 and are measured through it. Bezels are never
      // measured, and a model is free not to give them uvs at all.
      uvs: SCREEN_NODE_RE.test(name) ? nodeWorldUvs(json, bin, index) : null,
      triangles: node.mesh !== undefined ? nodeWorldTriangles(json, bin, index) : [],
    });
  }
  return { json, bin, nodes };
}

/**
 * A three.js stand-in for a loaded cockpit, built from a REAL GLB's world-space
 * vertices. The faces all share one material because the asset does; the bezels
 * share another. Both facts are asserted rather than assumed, below.
 */
function cockpitFromGlb(file) {
  const { nodes } = glbScreenNodes(file);
  const root = new THREE.Group();
  const screenMaterial = new THREE.MeshStandardMaterial({ name: 'Mat_Screen' });
  const bodyMaterial = new THREE.MeshStandardMaterial({ name: 'Mat_Body' });
  const bezels = [];
  for (const n of nodes) {
    const mesh = quadMesh(n.name, n.points, n.isFace ? screenMaterial : bodyMaterial, n.uvs);
    root.add(mesh);
    if (!n.isFace) bezels.push(mesh);
  }
  return { root, nodes, screenMaterial, bodyMaterial, bezels };
}

/**
 * A SECOND OPINION on a face's aspect, taken off the mesh a different way.
 *
 * ⭐ THIS USED TO BE `Math.max(du, dw) / Math.min(du, dw)` — the same crossing the
 * code under test was making, so it anchored the buffer-shape assertion below to a
 * value that was wrong in exactly the way the host was wrong, and could never go red
 * on a transposed face. `planarFrame` fits an ARBITRARY in-plane axis and calls it u,
 * so it has no access to the question at all: its du and dw are the right two
 * magnitudes with nothing to say about which is the width.
 *
 * The aspect a buffer needs is u/v — `PanelPointer` maps u to x and
 * `createPanelTexture` sets flipY = false — so it is keyed off TEXCOORD_0 here, by
 * picking the corners out by uv quadrant and averaging the two edges on each axis.
 * The fitted frame is still used, below, as an independent check on the MAGNITUDES.
 */
function independentAspect(node) {
  const at = (u, v) => {
    const i = node.points.findIndex((_, k) =>
      (node.uvs[k][0] < 0.5) === u && (node.uvs[k][1] < 0.5) === v);
    if (i < 0) throw new Error(`independentAspect: ${node.name} has no corner at u<0.5=${u} v<0.5=${v}`);
    return node.points[i];
  };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const tl = at(true, true), tr = at(false, true), bl = at(true, false), br = at(false, false);
  return ((d(tl, tr) + d(bl, br)) / 2) / ((d(tl, bl) + d(tr, br)) / 2);
}

/** The two extents as an unordered pair, off the fitted frame — magnitude only. */
function independentExtents(node) {
  const frame = planarFrame(node.triangles);
  const ext = frameExtents(frame, node.points);
  return [ext.u.max - ext.u.min, ext.w.max - ext.w.min].sort((a, b) => a - b);
}

/** The GLBs that actually carry display faces (the tub carries none — by design). */
const facedGlbs = () => glbFiles().filter((f) => glbScreenNodes(f).nodes.some((n) => n.isFace));
/** The GLBs that carry none. */
const facelessGlbs = () => glbFiles().filter((f) => !glbScreenNodes(f).nodes.some((n) => n.isFace));

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots and painters
// ─────────────────────────────────────────────────────────────────────────────

/** A real snapshot, from the real builder — never a hand-shaped lookalike. */
const snap = (sources = {}) => buildCockpitSnapshot(sources);

/** A painter that records every call it gets. */
function recordingPainter() {
  const calls = [];
  const fn = (panel, snapshot, nowMs) => { calls.push({ panel, snapshot, nowMs }); };
  fn.calls = calls;
  return fn;
}

/** Attach a recording painter to every configured role. */
function paintAll(host) {
  const painters = {};
  for (const role of Object.keys(DEFAULT_PANEL_ROLES)) {
    painters[role] = recordingPainter();
    host.setPainter(role, painters[role]);
  }
  return painters;
}

/** Run n frames `stepMs` apart and return how many panels were painted in total. */
function runFrames(host, snapshot, { frames, stepMs, start = 0 }) {
  const perFrame = [];
  for (let i = 0; i < frames; i++) {
    perFrame.push(host.update(snapshot, start + i * stepMs));
  }
  return perFrame;
}

let consoleSpies;
beforeEach(() => {
  consoleSpies = {
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  };
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelHost — the buffer is one knob and the rest is derived', () => {
  it('derives width from the MEASURED aspect, never the other way round', () => {
    // A 2:1 face at 512 must be 1024 wide; a 1:2 face at 512 must be 256. The
    // failure this catches is a divide instead of a multiply, which produces a
    // perfectly plausible buffer of exactly the wrong shape.
    expect(derivePanelBuffer({ aspect: 2 }, 512)).toEqual({ width: 1024, height: 512 });
    expect(derivePanelBuffer({ aspect: 0.5 }, 512)).toEqual({ width: 256, height: 512 });
    expect(derivePanelBuffer({ aspect: 1.2 }, 512)).toEqual({ width: 614, height: 512 });
  });

  it('scales width with the target height, so the height really is the only knob', () => {
    const small = derivePanelBuffer({ aspect: 1.2 }, 256);
    const large = derivePanelBuffer({ aspect: 1.2 }, 512);
    expect(large.height).toBe(2 * small.height);
    // Same shape at both resolutions, to within one pixel of rounding.
    expect(large.width / large.height).toBeCloseTo(small.width / small.height, 2);
    expect(large.width).not.toBe(small.width);   // not a constant hiding in there
  });

  it('defaults to a height justified by the 17-degree legibility budget', () => {
    // The value is a knob and may move; what must not happen is it drifting to
    // something that cannot be reasoned about. A panel is ~260 screen pixels tall
    // at 1080p/70deg, so the sane band is roughly native to ~4x supersampled.
    expect(DEFAULT_PANEL_BUFFER_HEIGHT_PX).toBeGreaterThanOrEqual(256);
    expect(DEFAULT_PANEL_BUFFER_HEIGHT_PX).toBeLessThanOrEqual(1024);
    expect(derivePanelBuffer({ aspect: 1.2 }).height).toBe(DEFAULT_PANEL_BUFFER_HEIGHT_PX);
  });

  it('returns integers — a fractional canvas dimension is silently floored by the DOM', () => {
    const b = derivePanelBuffer({ aspect: 1.2345678 }, 500);
    expect(Number.isInteger(b.width)).toBe(true);
    expect(Number.isInteger(b.height)).toBe(true);
  });

  it('refuses to invent a shape when the face was never measured', () => {
    for (const bad of [undefined, null, {}, { aspect: 0 }, { aspect: -1 }, { aspect: NaN }]) {
      expect(() => derivePanelBuffer(bad, 512), `aspect ${JSON.stringify(bad)}`)
        .toThrow(/measured aspect/);
    }
    for (const bad of [0, -1, NaN, Infinity, 'big']) {
      expect(() => derivePanelBuffer({ aspect: 1.2 }, bad), `height ${bad}`)
        .toThrow(/positive number of pixels/);
    }
  });
});

describe('PanelHost — binding roles to the nodes a loaded model actually has', () => {
  it('binds each role to its configured node and ignores the bezels', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });

    expect(host.panels.map((p) => p.role).sort()).toEqual(['DRIVE', 'INFO', 'NAV', 'TARGET']);
    expect(host.panel('NAV').nodeName).toBe(DEFAULT_PANEL_ROLES.NAV);
    expect(host.panel('DRIVE').nodeName).toBe(DEFAULT_PANEL_ROLES.DRIVE);
    expect(host.panel('INFO').nodeName).toBe(DEFAULT_PANEL_ROLES.INFO);
    expect(host.panel('TARGET').nodeName).toBe(DEFAULT_PANEL_ROLES.TARGET);
    // The housings are in the tree and must never be bound to a role.
    expect(host.panels.some((p) => /^ScreenBody/.test(p.nodeName))).toBe(false);
    expect(host.panel('NOPE')).toBe(null);
    host.dispose();
  });

  it('follows the role config, so swapping two entries swaps which glass draws where', () => {
    const { root } = syntheticCockpit();
    const roles = { ...DEFAULT_PANEL_ROLES, NAV: DEFAULT_PANEL_ROLES.DRIVE, DRIVE: DEFAULT_PANEL_ROLES.NAV };
    const host = PanelHost.fromRoot(root, { makeCanvas, roles });

    expect(host.panel('NAV').nodeName).toBe(DEFAULT_PANEL_ROLES.DRIVE);
    expect(host.panel('DRIVE').nodeName).toBe(DEFAULT_PANEL_ROLES.NAV);
    host.dispose();
  });

  it('measures in WORLD space, so a transform on the model reaches the buffer', () => {
    // A rigidly-placed face measures the same locally as it does in the world, so
    // forgetting to resolve the world matrices looks fine until something up the
    // chain carries a scale — and then every panel is the wrong shape with nothing
    // to say so. A NON-UNIFORM scale is used because it changes the ASPECT, which
    // is the number the buffer is derived from.
    const { root } = syntheticCockpit();
    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.set(2, 1, 1);            // the 2:1 faces become 4:1

    const host = PanelHost.fromRoot(holder, { makeCanvas });

    expect(host.panels.length).toBe(4);
    for (const panel of host.panels) {
      expect(panel.metrics.aspect, panel.role).toBeCloseTo(4, 3);
      expect(panel.canvas.width).toBe(Math.round(DEFAULT_PANEL_BUFFER_HEIGHT_PX * 4));
    }
    host.dispose();
  });

  it('throws NAMING the missing node when the model has some screens but not the configured ones', () => {
    const { root } = syntheticCockpit(['Screen_UL', 'Screen_UR']);
    expect(() => PanelHost.fromRoot(root, { makeCanvas })).toThrow(/Screen_LL/);
  });

  it('refuses a role table that points two roles at ONE piece of glass', () => {
    // The half-finished swap. Swapping two entries is the edit this table exists
    // to invite, and stopping halfway leaves both roles on one node — which
    // `resolvePanelRoles` cannot notice, because it only asks whether each named
    // node exists and a duplicated name exists twice over.
    //
    // Measured before the guard went in, so the failure being prevented is not
    // hypothetical: with `DRIVE: 'Screen_UL'` the host bound four panels, two of
    // them to the same mesh; the second clone replaced the first, so NAV's canvas
    // was displayed by nothing; Screen_UR bound to no role and stayed dark; and
    // dispose() left Screen_UL wearing NAV's clone — a material it had just
    // disposed — instead of the model's own Mat_Screen.
    const { root, screenMaterial } = syntheticCockpit();
    const roles = { ...DEFAULT_PANEL_ROLES, DRIVE: DEFAULT_PANEL_ROLES.NAV };

    expect(() => PanelHost.fromRoot(root, { makeCanvas, roles })).toThrow(/Screen_UL/);
    // And it threw BEFORE touching the model — a failed load must not leave the
    // cockpit half-wired.
    for (const child of root.children) {
      if (/^Screen_/.test(child.name)) expect(child.material, child.name).toBe(screenMaterial);
    }
    expect(screenMaterial.map).toBe(null);
  });

  it('reads a cockpit with HOUSINGS but no glass as a cockpit with no screens', () => {
    // The underscore in `/^Screen_/` is the whole of what separates the glass from
    // the bezel it sits in, and this is the case where that actually decides
    // something. A matcher that lost the underscore would find four ScreenBody_*
    // housings here, conclude "this cockpit has screens", and then THROW for the
    // missing Screen_UL — turning the legitimate no-screens cockpit into a crash.
    //
    // Worth having as its own case because the screenless asset on disk
    // (cockpit-tub.glb) carries no Screen-anything at all, so it cannot tell a
    // correct matcher from a sloppy one. Measured: widening the host's matcher to
    // /^Screen/i leaves every other test in this file green.
    const root = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ name: 'Mat_Body' });
    for (const name of ['ScreenBody_UL', 'ScreenBody_UR', 'ScreenBody_LL', 'ScreenBody_LR']) {
      root.add(quadMesh(name, CORNERS_2_1, bodyMaterial));
    }

    const host = PanelHost.fromRoot(root, { makeCanvas });

    expect(host.panels).toEqual([]);
    expect(host.update(snap({}), 0)).toBe(0);
    // And the housings are left exactly as they were found — same instance, no map.
    for (const child of root.children) {
      expect(child.material, child.name).toBe(bodyMaterial);
      expect(child.material.map).toBe(null);
    }
    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    host.dispose();
  });

  it('refuses a root that is not a loaded cockpit at all', () => {
    // Distinct from "a cockpit with no screens": binding zero panels to a missing
    // model would hide a load that never happened.
    expect(() => PanelHost.fromRoot(null, { makeCanvas })).toThrow(/loaded cockpit/);
    expect(() => PanelHost.fromRoot({}, { makeCanvas })).toThrow(/loaded cockpit/);
  });

  it('gives a PORTRAIT face a portrait canvas', () => {
    // ⭐ THE QUIETER HALF OF A DEFECT THE MOVER SHOWED LOUDLY. Nothing in this file
    // used to test a non-landscape buffer at all — every fixture was 2:1 and every
    // face in every GLB on disk is 0.24 x 0.20, so a measurement that reported the
    // LONGER extent as the width was right every time it was asked.
    //
    // The consequence here is not a panel in the wrong place, it is a panel drawn
    // wrong: `derivePanelBuffer`'s aspect is u/v by construction — `PanelPointer`
    // maps u to x and `createPanelTexture` sets flipY = false — so a transposed
    // measurement hands a 1:2 face a 2:1 canvas and the nav computer is squashed
    // onto the glass, at full brightness, with no error anywhere.
    const { root } = syntheticCockpit(undefined, CORNERS_1_2);
    const host = PanelHost.fromRoot(root, { makeCanvas });

    expect(host.panels.length).toBe(4);
    for (const panel of host.panels) {
      expect(panel.metrics.width, `${panel.role} width`).toBeCloseTo(0.2, 6);
      expect(panel.metrics.height, `${panel.role} height`).toBeCloseTo(0.4, 6);
      expect(panel.metrics.aspect, `${panel.role} aspect`).toBeCloseTo(0.5, 6);
      expect(panel.canvas.height).toBe(DEFAULT_PANEL_BUFFER_HEIGHT_PX);
      expect(panel.canvas.width)
        .toBe(Math.round(DEFAULT_PANEL_BUFFER_HEIGHT_PX * (0.2 / 0.4)));
      expect(panel.canvas.width, `${panel.role} got a landscape buffer`)
        .toBeLessThan(panel.canvas.height);
    }
    host.dispose();
  });

  it('refuses a screen face with no uvs, rather than guessing which extent is the width', () => {
    // The project's stance on an unmapped screen face is already settled and loud —
    // `PanelMover` throws, `ScreenUV.test.js` throws rather than skipping, and
    // AC-UV-ORIENTATION pins the map per vertex. The host now says the same thing
    // for the same reason: without uvs the buffer's shape would be a guess, and the
    // guess is invisible once it is baked into a texture.
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ name: 'Mat_Screen' });
    for (const name of ['Screen_UL', 'Screen_UR', 'Screen_LL', 'Screen_LR']) {
      root.add(quadMesh(name, CORNERS_2_1, mat));   // no uvs
    }
    expect(() => PanelHost.fromRoot(root, { makeCanvas })).toThrow(/uv attribute/);
  });
});

describe('PanelHost — measured against the real assets on disk', () => {
  it('measures every panel off the real GLB and derives one buffer shape for all four', () => {
    const files = facedGlbs();
    expect(files.length, `no .glb in ${ASSET_DIR} carries any display face`).toBeGreaterThan(0);

    for (const file of files) {
      const { root, nodes } = cockpitFromGlb(file);
      const faces = nodes.filter((n) => n.isFace);
      expect(faces.length, `${file}: no faces to measure`).toBeGreaterThan(0);

      const host = PanelHost.fromRoot(root, { makeCanvas });
      expect(host.panels.length, file).toBe(4);

      for (const panel of host.panels) {
        const node = faces.find((n) => n.name === panel.nodeName);
        const want = independentAspect(node);
        // The host's own measurement agrees with a measurement taken by a
        // different route off the same mesh — u/v, keyed off the uvs.
        expect(panel.metrics.aspect, `${file} / ${panel.nodeName}`).toBeCloseTo(want, 3);
        // And the two magnitudes agree with the fitted frame, as an unordered pair.
        const mags = independentExtents(node);
        const got = [panel.metrics.width, panel.metrics.height].sort((a, b) => a - b);
        expect(got[0], `${file} / ${panel.nodeName}`).toBeCloseTo(mags[0], 3);
        expect(got[1], `${file} / ${panel.nodeName}`).toBeCloseTo(mags[1], 3);
        // And the buffer is that aspect, at the target height.
        expect(panel.canvas.height).toBe(DEFAULT_PANEL_BUFFER_HEIGHT_PX);
        expect(panel.canvas.width).toBe(Math.round(DEFAULT_PANEL_BUFFER_HEIGHT_PX * want));
      }

      // Max's ruling: the four monitors are the same size. Identical faces must
      // therefore produce byte-identical buffers — a one-pixel difference between
      // two screens is a rounding bug that would show as mismatched type sizes.
      const sizes = new Set(host.panels.map((p) => `${p.canvas.width}x${p.canvas.height}`));
      expect(sizes.size, `${file}: four identical faces produced ${[...sizes].join(', ')}`).toBe(1);

      host.dispose();
    }
  });

  it('re-derives every width when the one knob moves', () => {
    const files = facedGlbs();
    expect(files.length).toBeGreaterThan(0);
    const file = files[0];
    const { nodes } = cockpitFromGlb(file);
    const want = independentAspect(nodes.find((n) => n.isFace));

    for (const heightPx of [256, 512]) {
      const { root } = cockpitFromGlb(file);
      const host = PanelHost.fromRoot(root, { makeCanvas, bufferHeightPx: heightPx });
      for (const panel of host.panels) {
        expect(panel.canvas.height).toBe(heightPx);
        expect(panel.canvas.width).toBe(Math.round(heightPx * want));
      }
      host.dispose();
    }
  });

  it('binds zero panels, throws nothing and says nothing on a cockpit with no screens', () => {
    // cockpit-tub.glb ships zero Screen_* nodes. This is a live path, not a
    // hypothetical, and it is NOT the missing-node failure above: a cockpit
    // without screens is a legitimate cockpit.
    const files = facelessGlbs();
    expect(files.length, 'no screenless .glb on disk — this path stopped being tested').toBeGreaterThan(0);

    for (const file of files) {
      const { root } = cockpitFromGlb(file);
      const host = PanelHost.fromRoot(root, { makeCanvas });

      expect(host.panels, file).toEqual([]);
      expect(host.panel('NAV')).toBe(null);
      // And it runs: updates are no-ops rather than throws.
      expect(host.update(snap({}), 0)).toBe(0);
      expect(host.update(snap({ massLockHint: true }), 100)).toBe(0);
      // Registering painters must still work — the game does it at start-up and
      // does not know whether this cockpit has glass in it.
      expect(() => host.setPainter('NAV', () => {})).not.toThrow();
      host.dispose();
    }

    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.log).not.toHaveBeenCalled();
  });

  it('confirms the premise these wiring tests rest on: the real faces SHARE one material', () => {
    // If this ever stops being true the shared-material defence below stops being
    // a test of anything, so the premise is measured rather than remembered.
    //
    // The non-empty guard is not decoration: without it this whole test is a loop
    // over an empty list, which passes having asserted nothing at all. That is the
    // exact shape of a test that goes green the day somebody renames the asset —
    // the premise would then be "remembered" again, silently.
    const files = facedGlbs();
    expect(files.length, `no .glb in ${ASSET_DIR} carries any display face`).toBeGreaterThan(0);

    for (const file of files) {
      const faces = glbScreenNodes(file).nodes.filter((n) => n.isFace);
      const materials = new Set(faces.flatMap((n) => n.materials));
      expect(materials.size, `${file}: display faces reference ${[...materials].join(', ')}`).toBe(1);
    }
  });
});

describe('PanelHost — wiring the buffer to the glass, and to nothing else', () => {
  it('gives each panel its OWN texture and its OWN material clone', () => {
    // THE TRAP: all four faces share Mat_Screen, so assigning maps to the shared
    // instance leaves every screen showing whichever canvas was written last.
    const { root, screenMaterial } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });

    const materials = new Set(host.panels.map((p) => p.mesh.material));
    const textures = new Set(host.panels.map((p) => p.texture));
    const canvases = new Set(host.panels.map((p) => p.canvas));
    expect(materials.size, 'four panels are sharing one material').toBe(4);
    expect(textures.size).toBe(4);
    expect(canvases.size).toBe(4);

    for (const panel of host.panels) {
      expect(panel.mesh.material).not.toBe(screenMaterial);   // the original is left alone
      expect(panel.mesh.material.map).toBe(panel.texture);
      expect(panel.texture.image).toBe(panel.canvas);
      expect(panel.ctx).toBe(panel.canvas.getContext('2d'));
    }
    // The material the model shipped with never gets a map hung on it.
    expect(screenMaterial.map).toBe(null);
    host.dispose();
  });

  it('builds the texture through the panel factory, so v=0 stays the TOP edge', () => {
    // flipY = false is half of the UV convention (PanelPointer owns the other
    // half). three's DEFAULT is true, so this is not a setting left alone — a
    // texture built without the factory renders every panel upside down, with no
    // error anywhere.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    for (const panel of host.panels) {
      expect(panel.texture.flipY, panel.role).toBe(false);
    }
    host.dispose();
  });

  it('marks the material as needing a recompile, or the map is never sampled', () => {
    // Assigning .map to a material that had none changes the shader. Without
    // needsUpdate three keeps the compiled program with no map sampler in it and
    // the glass renders black — no error, nothing to search for.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    for (const panel of host.panels) {
      expect(panel.mesh.material.version, panel.role).toBeGreaterThan(0);
    }
    host.dispose();
  });

  it('never touches the bezels — on the real model, not just on a fixture', () => {
    const files = facedGlbs();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const { root, bezels, bodyMaterial } = cockpitFromGlb(file);
      expect(bezels.length, `${file}: no ScreenBody_* housings in the model`).toBeGreaterThan(0);

      const host = PanelHost.fromRoot(root, { makeCanvas });
      host.update(snap({}), 0);

      for (const bezel of bezels) {
        // Same instance, not a clone; and nothing hung on it. `/^Screen_/` with
        // the underscore is the whole of what separates glass from housing.
        expect(bezel.material, `${file} / ${bezel.name}`).toBe(bodyMaterial);
        expect(bezel.material.map).toBe(null);
      }
      host.dispose();
    }
  });
});

describe('PanelHost — the repaint tier', () => {
  const FRAME_MS = 16;
  const FRAMES = 20;   // 320 ms of flying at ~60 Hz

  /**
   * Ambient paints expected over the run above, DERIVED from the live constant
   * rather than hardcoded. Max retuned the tier 80 -> 33 ms (12.5 -> 30 Hz) on
   * 2026-08-01 and three tests in this file broke on baked-in magic numbers; a
   * rate is a tuning knob, so the pins now follow it. At 33 ms over 20x16 ms
   * frames this is 7 (t = 0, 48, 96, 144, 192, 240, 288); at the old 80 it was
   * 4 (t = 0, 80, 160, 240) — the same simulation reproduces both.
   */
  const AMBIENT_PAINTS = (() => {
    let paints = 0, last = -Infinity;
    for (let f = 0; f < FRAMES; f++) {
      const t = f * FRAME_MS;
      if (f === 0 || t - last >= DEFAULT_AMBIENT_REPAINT_MS) { paints++; last = t; }
    }
    return paints;
  })();

  it('paints at the ambient rate when nothing is urgent', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    const perFrame = runFrames(host, snap({}), { frames: FRAMES, stepMs: FRAME_MS });

    expect(painters.NAV.calls.length).toBe(AMBIENT_PAINTS);
    expect(painters.DRIVE.calls.length).toBe(AMBIENT_PAINTS);
    // Four panels repainted together on a paint frame, none on the others — the
    // four screens must show ONE instant, not four staggered ones.
    expect(perFrame.filter((n) => n === 4).length).toBe(AMBIENT_PAINTS);
    expect(perFrame.filter((n) => n === 0).length).toBe(FRAMES - AMBIENT_PAINTS);
    // Max's ruling 2026-08-01: 30 Hz. Kept as an explicit pin so a silent retune
    // is a failing test rather than a quiet behavior change.
    expect(DEFAULT_AMBIENT_REPAINT_MS).toBe(33);
    host.dispose();
  });

  it('escalates to every frame while an alert is BLINKING', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    // Mass lock blinks fast. Sampling a 150 ms half-cycle every 80 ms aliases,
    // and an alarm whose blink stutters reads as a display fault.
    const perFrame = runFrames(host, snap({ massLockHint: true }), { frames: FRAMES, stepMs: FRAME_MS });

    expect(painters.NAV.calls.length).toBe(FRAMES);
    expect(perFrame.every((n) => n === 4)).toBe(true);
    host.dispose();
  });

  it('does NOT escalate for a STEADY cue — the whole approach would run at 60 Hz', () => {
    // SAFE TO DROP is BLINK.STEADY: a lit line that does not move. It is on
    // screen for most of every approach, so escalating on the mere presence of a
    // cue would mean the ambient tier almost never applies.
    expect(hasBlinkingAlert(snap({ drop: { state: 'in-window' } }))).toBe(false);
    expect(hasBlinkingAlert(snap({ drop: { state: 'too-fast' } }))).toBe(true);
    expect(hasBlinkingAlert(snap({ massLockHint: true }))).toBe(true);
    expect(hasBlinkingAlert(snap({}))).toBe(false);

    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    runFrames(host, snap({ drop: { state: 'in-window' } }), { frames: FRAMES, stepMs: FRAME_MS });
    expect(painters.NAV.calls.length).toBe(AMBIENT_PAINTS);
    host.dispose();
  });

  it('escalates rather than dying when the drop-state vocabulary has drifted', () => {
    // buildAlertCue throws on an unknown dropState by design. The tier only
    // decides HOW OFTEN, so "I cannot tell" must mean "repaint often", never
    // "take the render loop down with you".
    const drifted = snap({ drop: { state: 'in_window' } });
    expect(hasBlinkingAlert(drifted)).toBe(true);

    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    paintAll(host);
    expect(() => host.update(drifted, 0)).not.toThrow();
    host.dispose();
  });

  it('repaints immediately when a painter is set, rather than waiting for the tick', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    host.update(snap({}), 0);                    // first frame paints (blanks)

    const nav = recordingPainter();
    host.setPainter('NAV', nav);
    host.update(snap({}), 16);                   // well inside the ambient period

    expect(nav.calls.length).toBe(1);
    host.dispose();
  });
});

describe('PanelHost — which clock the panels run on', () => {
  it('advances the painter clock every frame even when the SIM clock repeats', () => {
    // snapshot.t is the sim clock: it REPEATS across frames above 60 Hz and stops
    // dead when the sim is paused. A blink phased on it stutters, then freezes
    // mid-cycle — an alarm that has stopped moving reads as no alarm.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    const frozenSim = snap({ simClockMs: 1000, renderDt: 1 / 120, massLockHint: true });
    for (let i = 0; i < 5; i++) host.update(frozenSim, i * 8);

    const stamps = painters.NAV.calls.map((c) => c.nowMs);
    expect(stamps).toEqual([0, 8, 16, 24, 32]);
    // Stated separately so the failure names the actual mistake.
    expect(stamps.some((s) => s === frozenSim.t)).toBe(false);
    host.dispose();
  });

  it('falls back to integrating renderDt when the caller hands over no timestamp', () => {
    // renderDt is in SECONDS in main.js ((_now - _lastRenderT) / 1000), hence the
    // x1000. With neither clock the panels would simply freeze.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    // The clock advances BEFORE the frame is painted — the delta has already
    // elapsed by the time update() is called — so the first stamp is 50, not 0.
    const frame = snap({ renderDt: 0.05 });      // 50 ms per frame
    host.update(frame);                          // clock 50; first frame always paints
    host.update(frame);                          // clock 100 — inside the ambient period
    host.update(frame);                          // clock 150 — due

    // Derived, not hardcoded: which of the 50/100/150 stamps are "due" depends
    // entirely on the ambient period. At 33 ms every frame is due ([50,100,150]);
    // at the old 80 ms the middle one fell inside the period ([50,150]).
    const stamps = [50, 100, 150];
    let last = -Infinity;
    const expected = stamps.filter((t, i) => {
      if (i === 0 || t - last >= DEFAULT_AMBIENT_REPAINT_MS) { last = t; return true; }
      return false;
    });
    expect(painters.NAV.calls.map((c) => c.nowMs)).toEqual(expected);
    host.dispose();
  });

  it('hands the painter its own panel and the frame it is painting', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);
    const frame = snap({ systemName: 'Test Alpha' });

    host.update(frame, 0);

    const call = painters.INFO.calls[0];
    expect(call.panel).toBe(host.panel('INFO'));
    expect(call.panel.ctx).toBe(host.panel('INFO').canvas.getContext('2d'));
    expect(call.snapshot).toBe(frame);
    host.dispose();
  });
});

describe('PanelHost — what the glass does during a warp', () => {
  it('forces a repaint on the frame the warp starts, ahead of the ambient tick', () => {
    // The snapshot blanks its `survey` block — the dossier the INFO panel draws
    // from — the moment a warp begins, because `system` still points at
    // BodyRenderers whose meshes have left the scene. Waiting for the
    // ambient tick would leave the dossier of the system just departed on the
    // glass for up to a tenth of a second.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    host.update(snap({}), 0);            // paints
    host.update(snap({}), 16);           // inside the period — no paint
    expect(painters.INFO.calls.length).toBe(1);

    const painted = host.update(snap({ warping: true }), 32);   // still inside it

    expect(painted).toBe(4);
    expect(painters.INFO.calls.length).toBe(2);
    expect(painters.INFO.calls[1].snapshot.regime.warping).toBe(true);
    host.dispose();
  });

  it('keeps painting THROUGH the warp instead of blanking or freezing the panels', () => {
    // Rejected alternatives, both defensible-sounding and both wrong here: going
    // dark throws away three panels' worth of true readings (speed, mode, warp
    // progress) at the moment the pilot wants them; freezing leaves crisp,
    // legible, stale numbers from the system just left.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);
    const warpFrame = snap({ warping: true, warpState: 'hyper', warpProgress: 0.5 });

    host.update(snap({}), 0);
    const perFrame = runFrames(host, warpFrame, { frames: 20, stepMs: 16, start: 16 });

    // Warp entry (frame 0 of this run) plus the ambient ticks that follow.
    expect(painters.DRIVE.calls.length).toBeGreaterThan(3);
    expect(perFrame.filter((n) => n === 4).length).toBeGreaterThan(3);
    // And the host is not clearing the glass itself — an unblanked panel with a
    // painter is the painter's canvas, start to finish.
    expect(host.panel('DRIVE').ctx._calls.clearRect).toBe(0);
    host.dispose();
  });

  it('forces the repaint on the way OUT of a warp too', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);

    host.update(snap({ warping: true }), 0);
    host.update(snap({ warping: true }), 16);
    expect(painters.NAV.calls.length).toBe(1);

    host.update(snap({ warping: false }), 32);
    expect(painters.NAV.calls.length).toBe(2);
    host.dispose();
  });
});

describe('PanelHost — panels with no painter, and painters that fail', () => {
  it('clears unclaimed glass exactly once instead of re-uploading it forever', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    host.setPainter('NAV', recordingPainter());

    const unclaimed = host.panel('INFO');
    const versionBefore = unclaimed.texture.version;
    runFrames(host, snap({ massLockHint: true }), { frames: 10, stepMs: 16 });   // escalated

    expect(unclaimed.ctx._calls.clearRect).toBe(1);
    // One texture upload, not ten. (three's Texture has no needsUpdate getter;
    // `version` is the counter that setter increments.)
    expect(unclaimed.texture.version - versionBefore).toBe(1);
    // The claimed panel did upload every frame.
    expect(host.panel('NAV').texture.version).toBeGreaterThan(unclaimed.texture.version);
    host.dispose();
  });

  it('does not invent a colour for unclaimed glass', () => {
    // clearRect, not fillRect: the ink and the black are a taste knob with
    // several settings, so a colour written down here is the same class of
    // mistake as a panel size written down here.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    host.update(snap({}), 0);
    expect(host.panel('INFO').ctx._calls.clearRect).toBe(1);
    expect(host.panel('INFO').ctx._calls.fillRect).toBe(0);
    host.dispose();
  });

  it('sets no ink of its own — not even one it never draws with', () => {
    // The host owns no palette (there is no colour in PanelHost.js and there must
    // not be one: the phosphor ink and its black are a taste knob the lab already
    // cycles). It draws nothing, so it must SET nothing either — a stray
    // `ctx.fillStyle` here is not harmless, it becomes the colour the next painter
    // draws with if that painter ever leans on the incoming default.
    //
    // This is an ASSIGNMENT test, which is why the stub's style properties are
    // accessors: a colour never arrives as a method call.
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    expect(host.panels.length).toBe(4);

    host.update(snap({}), 0);                    // all four unclaimed → cleared
    host.setPainter('NAV', recordingPainter());  // one claimed, three not
    runFrames(host, snap({ massLockHint: true }), { frames: 5, stepMs: 16, start: 16 });

    for (const panel of host.panels) {
      expect(panel.ctx._assigned, `${panel.role}: the host set context state itself`).toEqual([]);
    }
    host.dispose();
  });

  it('survives a painter that throws, keeps the other three drawing, and says so once', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);
    host.setPainter('NAV', () => { throw new Error('painter blew up'); });

    const perFrame = runFrames(host, snap({ massLockHint: true }), { frames: 3, stepMs: 16 });

    expect(perFrame).toEqual([3, 3, 3]);            // three of four, every frame
    expect(painters.DRIVE.calls.length).toBe(3);
    expect(painters.INFO.calls.length).toBe(3);
    // Once, not sixty times a second — a console nobody can read is no report.
    expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    expect(consoleSpies.error.mock.calls[0][0]).toMatch(/NAV painter threw/);
    host.dispose();
  });

  it('refuses a painter for a role this cockpit has no config entry for', () => {
    const { root } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    expect(() => host.setPainter('NVA', () => {})).toThrow(/NVA/);
    expect(() => host.setPainter('NAV', 'not a function')).toThrow(/must be a function/);
    host.dispose();
  });
});

describe('PanelHost — dispose', () => {
  it('releases every texture, puts the original material back, and stops painting', () => {
    const { root, screenMaterial } = syntheticCockpit();
    const host = PanelHost.fromRoot(root, { makeCanvas });
    const painters = paintAll(host);
    host.update(snap({}), 0);

    const panels = host.panels;
    const textureSpies = panels.map((p) => vi.spyOn(p.texture, 'dispose'));
    const cloneSpies = panels.map((p) => vi.spyOn(p.mesh.material, 'dispose'));

    host.dispose();

    for (const spy of textureSpies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of cloneSpies) expect(spy).toHaveBeenCalledTimes(1);
    // The model goes back the way it was found — a reloaded cockpit must not be
    // left wearing four clones that point at disposed textures.
    for (const panel of panels) {
      expect(panel.mesh.material, panel.role).toBe(screenMaterial);
    }
    expect(host.panels).toEqual([]);
    expect(host.panel('NAV')).toBe(null);
    expect(host.disposed).toBe(true);

    const before = painters.NAV.calls.length;
    expect(host.update(snap({ massLockHint: true }), 1000)).toBe(0);
    expect(painters.NAV.calls.length).toBe(before);
    host.dispose();                                   // idempotent: teardown runs twice
    expect(consoleSpies.error).not.toHaveBeenCalled();
  });
});

describe('PanelHost — this file cannot be switched off', () => {
  it('contains no skip or focus helper, so a deleted asset can never make it green', () => {
    // The real guard runs at module scope, during collection — see the comment
    // there for why an in-test version cannot catch a focus helper. This restates
    // the guarantee by name in the report.
    expect(SELF_DISABLES_TESTS).toBe(false);
  });
});

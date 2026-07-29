/**
 * PanelLayout — which screen shows what, and how big each one actually is.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-PANEL-BINDING.
 *
 * Two rules, both load-bearing:
 *
 * 1. ROLES ARE CONFIG. Which corner shows NAV vs DRIVE vs INFO vs TARGET is one
 *    table, so swapping two entries swaps which panel draws where. Corner
 *    assignment is a taste knob and must stay one.
 *
 * 2. GEOMETRY IS DERIVED, NEVER WRITTEN DOWN. Panel size, shape and position are
 *    measured off whatever model is loaded, at load. Measured 2026-07-28 across
 *    the two cockpit models that exist:
 *
 *                 this worktree's model        lane E's alpha (2026-07-28)
 *      size       0.450 x 0.300 m              0.240 x 0.200 m
 *      aspect     1.500  (3:2)                 1.200  (6:5)
 *
 *    The ASPECT changed, not just the scale — so a panel built for 3:2 does not
 *    merely come out small on lane E's cockpit, it comes out STRETCHED. The face
 *    has been 0.45x0.30, then 0.30x0.20, then 0.246x0.205, then 0.252x0.210, now
 *    0.240x0.200: five values, because the metres are the output of a fit solver
 *    that re-runs every time the cabin is re-proportioned. What is stable is that
 *    the surface is a unit-square UV quad. Read the shape off the mesh.
 *
 *    (cockpit-metrics.json currently agrees with the OLDER model and is stale for
 *    the newer one. Reading it is the same hard-coding one indirection out.)
 *
 * The measurement is a PURE function over vertex positions, fed from two sides:
 * the raw-GLB parser in tests, and three.js BufferGeometry at runtime. One place
 * the maths lives, so the thing the tests prove is the thing the game runs.
 */

/**
 * The four glass faces. NOT /^Screen/ — the model also carries
 * `ScreenBody_UL/UR/LL/LR`, the housings the glass sits in, and a looser matcher
 * binds roles to bezels. The underscore is what separates them.
 */
export const SCREEN_NODE_RE = /^Screen_/;

/**
 * Role → node name. THE knob: swap two values and the panels swap corners.
 * Spatial default, matching the Shift+1..4 hotkeys (1=UL, 2=UR, 3=LL, 4=LR).
 */
export const DEFAULT_PANEL_ROLES = Object.freeze({
  NAV:    'Screen_UL',
  DRIVE:  'Screen_UR',
  INFO:   'Screen_LL',
  TARGET: 'Screen_LR',
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));

/** Drop duplicate vertices — indexed geometry repeats corners. */
function weld(points, eps = 1e-6) {
  const out = [];
  for (const p of points) {
    if (!out.some((q) => dist(p, q) < eps)) out.push(p);
  }
  return out;
}

/** Newell's method — robust for any planar polygon, unlike a single cross product. */
function newellNormal(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / l, y: ny / l, z: nz / l };
}

/**
 * Measure a flat rectangular panel from its vertices alone.
 *
 * For a rectangle, the three distances from any corner to the others are two
 * edges and one diagonal — the diagonal is always the largest. That recovers
 * width and height exactly, with no basis-fitting and no assumption about which
 * way the quad is wound or oriented in the cockpit.
 *
 * @param {Array<[number,number,number]>} points world-space vertices
 * @returns {{width:number, height:number, aspect:number,
 *            centre:{x:number,y:number,z:number}, normal:{x:number,y:number,z:number}}}
 */
export function measureQuad(points) {
  const pts = weld(points || []);
  if (pts.length !== 4) {
    throw new Error(
      `measureQuad: expected a 4-corner quad, got ${pts.length} unique vertices. ` +
      `The screen faces are flat quads; a different shape needs a different measurement.`,
    );
  }

  const p0 = pts[0];
  const others = pts.slice(1)
    .map((p) => ({ p, d: dist(p0, p) }))
    .sort((a, b) => a.d - b.d);
  // others[2] is the diagonal; the first two are the edges.
  const width = Math.max(others[0].d, others[1].d);
  const height = Math.min(others[0].d, others[1].d);

  const centre = {
    x: pts.reduce((s, p) => s + p[0], 0) / 4,
    y: pts.reduce((s, p) => s + p[1], 0) / 4,
    z: pts.reduce((s, p) => s + p[2], 0) / 4,
  };

  return { width, height, aspect: width / height, centre, normal: newellNormal(pts) };
}

/**
 * Bind roles to the screen nodes actually present in the loaded model.
 *
 * Throws — naming the missing node — rather than returning a short list. A
 * cockpit whose model has lost a screen must fail readably at the seam; the
 * silent version is a blank panel nobody can explain. (`cockpit-tub.glb` ships
 * zero `Screen_*` nodes today, so this path is live, not hypothetical.)
 *
 * @param {Record<string,string>} roleConfig role → node name
 * @param {string[]} availableNodeNames node names present in the loaded model
 * @returns {Array<{role:string, node:string}>}
 */
export function resolvePanelRoles(roleConfig, availableNodeNames) {
  const have = new Set(availableNodeNames || []);
  const missing = Object.values(roleConfig).filter((n) => !have.has(n));
  if (missing.length) {
    throw new Error(
      `PanelLayout: the loaded cockpit has no ${missing.join(', ')} — ` +
      `configured for ${Object.entries(roleConfig).map(([r, n]) => `${r}→${n}`).join(', ')}. ` +
      `Screens present: ${[...have].filter((n) => SCREEN_NODE_RE.test(n)).join(', ') || '(none)'}.`,
    );
  }
  return Object.entries(roleConfig).map(([role, node]) => ({ role, node }));
}

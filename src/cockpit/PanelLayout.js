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
 * The panel's own axes — which way is up, which way is right, which way is out.
 *
 * `measureQuad` above answers "how big and where"; this answers "which way round",
 * and they are genuinely different questions. Nothing in size, place or plane
 * normal says which edge is the top, so a mover that only had `measureQuad` could
 * bring a screen perfectly centred to the pilot's eye and perfectly upside down.
 *
 * ── WHY THE UVs ARE THE SOURCE, AND NOT THE WORLD'S UP AXIS ─────────────────
 *
 * The obvious shortcut is to call whichever edge is highest off the deck "the
 * top". It happens to be right for all four panels in the cockpit as it stands
 * today, and it is not a fact about panels — it is a fact about this particular
 * mounting. It would silently invert an inverted-mount screen, an overhead panel,
 * or anything lane E hangs at a steeper angle later. The UVs, by contrast, ARE the
 * panel's own statement about its orientation: v = 0 is the top edge and u grows
 * to the pilot's right. That convention is already load-bearing in two other
 * places — `PanelPointer`'s uv-to-pixel mapping and `createPanelTexture`'s
 * flipY = false — and it is pinned per vertex against the mesh by AC-UV-ORIENTATION.
 * Reading orientation from the same place they do means all three agree or all
 * three fail together, rather than two of them agreeing and the third quietly not.
 *
 * ── THE NORMAL HERE IS BETTER THAN NEWELL'S, AND DELIBERATELY DIFFERENT ─────
 *
 * `measureQuad`'s normal comes from the winding order, so its SIGN depends on how
 * the exporter happened to wind the quad — fine for "what plane is this in",
 * useless for "which side faces the pilot". This one is `right x up`, so it is
 * pinned to the UV layout instead: it always points out of the front of the
 * screen, the face the picture is on. The two are the same axis and may be
 * opposite signs, and that is expected rather than a discrepancy to reconcile.
 *
 * @param {Array<[number,number,number]>} points world-space vertices
 * @param {Array<[number,number]>} uvs the uv of each point, in the SAME order
 * @returns {{right:{x,y,z}, up:{x,y,z}, normal:{x,y,z}}} an orthonormal frame
 */
export function measureQuadBasis(points, uvs) {
  const pts = points || [];
  const uv = uvs || [];
  if (pts.length < 3 || pts.length !== uv.length) {
    throw new Error(
      `measureQuadBasis: needs at least 3 vertices each paired with a uv, got ` +
      `${pts.length} positions and ${uv.length} uvs. The pairing is the whole ` +
      `input — a position list on its own cannot say which edge is the top, and ` +
      `guessing would flip screens on any mounting but today's.`,
    );
  }

  // The midpoint of the edge at each extreme of a uv axis. Averaging rather than
  // picking one vertex so a quad that is subdivided, or triangulated with repeated
  // corners, gives the same answer as a bare four-vertex one.
  const mid = (pick) => {
    let x = 0, y = 0, z = 0, n = 0;
    for (let i = 0; i < pts.length; i++) {
      if (!pick(uv[i])) continue;
      x += pts[i][0]; y += pts[i][1]; z += pts[i][2]; n += 1;
    }
    return n ? [x / n, y / n, z / n] : null;
  };

  const top = mid((t) => t[1] < 0.5);
  const bottom = mid((t) => t[1] > 0.5);
  const left = mid((t) => t[0] < 0.5);
  const right = mid((t) => t[0] > 0.5);
  if (!top || !bottom || !left || !right) {
    throw new Error(
      `measureQuadBasis: the uvs do not span the unit square — no vertex on one ` +
      `side of an axis. These faces carry TEXCOORD_0 over the full unit square; a ` +
      `quad whose uvs are all on one side of centre has lost them or been remapped, ` +
      `and its orientation cannot be recovered.`,
    );
  }

  // v = 0 is the TOP, so up runs from the bottom edge to the top edge.
  const rawUp = norm(sub(top, bottom), 'up');
  const rawRight = norm(sub(right, left), 'right');
  // right x up points out of the front face, in three's right-handed world.
  const normal = norm(cross(rawRight, rawUp), 'normal');
  // Re-derive up from the other two so the frame is exactly orthonormal even
  // when float noise or a slightly non-planar quad leaves the raw pair a hair off
  // square. An un-orthonormalised basis becomes a rotation matrix with a shear in
  // it, and the panel arrives at the eye very slightly skewed.
  const up = norm(cross(normal, rawRight), 'up');
  const rightOrtho = cross(up, normal);

  return { right: vec(rightOrtho), up: vec(up), normal: vec(normal) };
}

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const vec = (v) => ({ x: v[0], y: v[1], z: v[2] });

/** Normalise, refusing a zero-length axis by name rather than emitting NaNs. */
function norm(v, which) {
  const l = len(v);
  if (!(l > 1e-12)) {
    throw new Error(
      `measureQuadBasis: the ${which} axis has no length. The quad is degenerate ` +
      `or its uvs are collapsed; every direction derived from it would be NaN, and ` +
      `a NaN rotation puts the panel nowhere with nothing to say why.`,
    );
  }
  return [v[0] / l, v[1] / l, v[2] / l];
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

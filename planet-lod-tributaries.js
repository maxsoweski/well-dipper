// planet-lod-tributaries.js — Option B river-LOD: CPU tributary-growth TOPOLOGY (isolated spike).
//
// Context (decided, do not re-derive). Well Dipper planet-LOD lab needs view-dependent FINER river
// tributaries that bloom on approach. Option A (a per-pixel Dendry SDF amplifier) FAILED 3 GPU
// cycles — "distance to a locally-built tree" gives local TEXTURE, not global CONNECTIVITY toward
// the trunk. Option B (this module) GROWS real connected finer tributaries by LOCAL REFINED
// RE-ROUTING onto the existing trunk channels as OUTLETS. Convergence onto the trunk is a PROVEN
// PROPERTY of the routing, not a tuned cosmetic rule.
//
// This module is PURE ALGORITHM — plain arrays + Math only, NO three.js, NO GPU, NO DOM — so the
// topology can be proven headlessly with unit tests in isolation. The GPU bake/blend that turns
// this network into rendered ribbons/valleys is a SEPARATE later step and is NOT in this spike.
//
// It deliberately MIRRORS the machinery of planet-lod-rivers.js routeAndOrder (priority-flood →
// steepest receiver → Horton–Strahler) so the result is portable back into that pipeline. The role
// the GLOBAL ocean plays for the global router (the open boundary that flow drains to) is played
// LOCALLY here by the trunk OUTLETS: fine cells drain DOWN onto the trunk line.
//
// Data shapes (match planet-lod-rivers.js so this is portable):
//   baseMesh = { verts: Array<[x,y,z]> (unit sphere), adj: Array<number[]>, N: number }
//   routed   = { receiver, accum, strahler, isChannel, surf:(i)=>number, maxOrder }  (from routeAndOrder)
//   Trunk channels = base nodes with isChannel[i] === 1.

export const DEFAULT_TRIB_PARAMS = Object.freeze({
  gridRes: 56,        // lattice rows across the patch diameter
  fineAmp: 0.4,       // amplitude of the fine fbm relief added on top of the interpolated macro slope
  fineFreq: 9.0,      // spatial frequency of the fine fbm (in planar-coord units)
  channelOrderMin: 2, // fine Strahler >= this ⇒ a fine channel (mirrors rivers.js MIN_ORDER gate)
  fbmOctaves: 4,
  fbmGain: 0.5,
  fbmLacunarity: 2.0,
});

// ───────────────────────── vector helpers (plain [x,y,z] arrays) ─────────────────────────
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function vscale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vcross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
function vnorm(a) { const L = vlen(a) || 1e-30; return [a[0] / L, a[1] / L, a[2] / L]; }

// ───────────────────────── localFrame (pure orthonormal tangent basis) ─────────────────────────
// n = normalize(center); pick an axis not parallel to n; u = normalize(cross(axis, n));
// v = cross(n, u). {u, v, n} is right-handed and orthonormal. Pure function of `center`.
export function localFrame(center) {
  const n = vnorm(center);
  // pick the world axis least aligned with n so the cross product is well-conditioned
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  let axis;
  if (ax <= ay && ax <= az) axis = [1, 0, 0];
  else if (ay <= az) axis = [0, 1, 0];
  else axis = [0, 0, 1];
  const u = vnorm(vcross(axis, n));
  const v = vcross(n, u); // already unit (n ⟂ u, both unit)
  return { u, v, n };
}

// ───────────────────────── hash01 (deterministic value hash → [0,1)) ─────────────────────────
// Integer-mix hash of any number of integer coords plus a seed. Deterministic and order-free:
// the same ints+seed always give the same value, independent of when/where it is called.
export function hash01(...args) {
  const seed = args.length ? args[args.length - 1] : 0;
  const ints = args.slice(0, Math.max(0, args.length - 1));
  let h = (Math.floor(seed) | 0) >>> 0;
  h = (h ^ 0x9e3779b9) >>> 0;
  for (let k = 0; k < ints.length; k++) {
    let x = (Math.floor(ints[k]) | 0) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
    x = Math.imul(x ^ (x >>> 12), 0x297a2d39) >>> 0;
    h = (h ^ x) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// Trilinear value-noise on the integer lattice of point p (already scaled by frequency by the
// caller). Deterministic; smooth via a quintic fade.
function valueNoise3(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const c000 = hash01(xi, yi, zi, seed), c100 = hash01(xi + 1, yi, zi, seed);
  const c010 = hash01(xi, yi + 1, zi, seed), c110 = hash01(xi + 1, yi + 1, zi, seed);
  const c001 = hash01(xi, yi, zi + 1, seed), c101 = hash01(xi + 1, yi, zi + 1, seed);
  const c011 = hash01(xi, yi + 1, zi + 1, seed), c111 = hash01(xi + 1, yi + 1, zi + 1, seed);
  const lerp = (a, b, t) => a + (b - a) * t;
  const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
  const y0 = lerp(x00, x10, v), y1 = lerp(x01, x11, v);
  return lerp(y0, y1, w); // in [0,1)
}

// ───────────────────────── fbm (fractal value noise) ─────────────────────────
// Coordinates (x,y,z) are expected pre-scaled by the caller (we pass p*fineFreq). Returns a value
// roughly centred on 0 (we subtract 0.5 per octave) so it perturbs the macro slope both up & down.
export function fbm(x, y, z, seed, params = DEFAULT_TRIB_PARAMS) {
  const oct = params.fbmOctaves ?? 4, gain = params.fbmGain ?? 0.5, lac = params.fbmLacunarity ?? 2.0;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * (valueNoise3(x * freq, y * freq, z * freq, seed + o * 1013) - 0.5);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return norm > 0 ? sum / norm : 0;
}

// ───────────────────────── buildFineGrid (deterministic tri/hex lattice) ─────────────────────────
// A TRIANGULAR lattice of points in the tangent plane within planar radius R = tan(angularRadius).
// Even rows are offset by half a cell so each interior node has up to 6 neighbours (hexagonal
// connectivity). Nodes outside the radius are clipped. The full grid graph (positions + adjacency)
// is a PURE FUNCTION of (region, gridRes) — this is what guarantees determinism and eval-order
// invariance of everything downstream. Returns { fverts, fadj, planar }:
//   fverts[k] = [x,y,z] on the unit sphere   planar[k] = [su, sv]   fadj[k] = neighbour indices.
// Module-level lattice key so buildFineGrid (forward) and snapToLattice (inverse) agree byte-for-byte.
// rows/cols are small (|r|,|c| < 100000/2) so this is collision-free for our sizes.
export const latticeKey = (r, c) => r * 100000 + c;

export function buildFineGrid(region, gridRes) {
  const { center, angularRadius } = region;
  const { u, v, n } = localFrame(center);
  const R = Math.tan(angularRadius);
  const rows = Math.max(2, Math.floor(gridRes));
  const cell = (2 * R) / rows;                // spacing between lattice rows / columns
  const rowH = cell * Math.sqrt(3) / 2;       // triangular row height

  // Build a deterministic (row,col)->index map, scanning rows then cols in fixed order.
  const fverts = [], planar = [], rowColOf = [], indexAt = new Map();
  const key = latticeKey;
  const rHalf = Math.ceil(rows / 2) + 1;
  for (let r = -rHalf; r <= rHalf; r++) {
    const sv = r * rowH;
    const offset = (((r % 2) + 2) % 2) === 1 ? cell * 0.5 : 0; // offset odd rows by half a cell
    const cHalf = Math.ceil(rows / 2) + 1;
    for (let c = -cHalf; c <= cHalf; c++) {
      const su = c * cell + offset;
      if (su * su + sv * sv > R * R) continue;  // radius clip
      const idx = fverts.length;
      indexAt.set(key(r, c), idx);
      rowColOf.push([r, c]);
      planar.push([su, sv]);
      // fine vertex on the unit sphere: normalize(n + su*u + sv*v)
      const p = vnorm(vadd(n, vadd(vscale(u, su), vscale(v, sv))));
      fverts.push(p);
    }
  }
  // 6-neighbour hex adjacency. For a row offset by +half-cell (odd rows here), the two diagonal
  // neighbours in the adjacent rows are at columns c and c+1; for even rows they are c-1 and c.
  const fadj = fverts.map(() => []);
  for (let k = 0; k < fverts.length; k++) {
    const [r, c] = rowColOf[k];
    const odd = (((r % 2) + 2) % 2) === 1;
    const diagLo = odd ? c : c - 1, diagHi = odd ? c + 1 : c;
    const cand = [
      [r, c - 1], [r, c + 1],            // same row L/R
      [r - 1, diagLo], [r - 1, diagHi],  // row below
      [r + 1, diagLo], [r + 1, diagHi],  // row above
    ];
    for (const [nr, nc] of cand) {
      const ni = indexAt.get(key(nr, nc));
      if (ni !== undefined && ni !== k) fadj[k].push(ni);
    }
    fadj[k].sort((a, b) => a - b); // canonical neighbour order (eval-order invariance)
  }
  return { fverts, fadj, planar, gridRes: rows, R, cell, rowH, indexAt, rowColOf, frame: { u, v, n } };
}

// ───────────────────────── snapToLattice (closed-form O(1) lattice inverse) ─────────────────────────
// Snap an object-space unit dir to its nearest fine vert via the analytic triangular-lattice cell
// inverse (§3.2) — replaces the O(Nf) linear scan that made each grow O(Nf²) and blocked raising
// gridRes. Project dir into the patch frame to recover planar (su,sv) (the gnomonic-tangent inverse:
// su = dot(dir,u)/dot(dir,n)), round to the lattice (row,col) exactly inverting buildFineGrid's
// forward placement, then pick the max-dot candidate among the rounded cell + its row/column
// neighbours. For an in-lattice point this returns that exact vert (so inverse(forward(k)) == k for
// EVERY k, boundary cells included — k is always among its own candidates with dot 1). Radius-clipped
// cells are absent from indexAt, so the candidate ring naturally falls back to the nearest PRESENT
// vertex; a one-step ring widen covers the rare all-clipped near-rim query. O(1) per call.
export function snapToLattice(grid, dir) {
  const { frame, cell, rowH, indexAt, fverts } = grid;
  const { u, v, n } = frame;
  const cosd = dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2];
  if (cosd <= 0) return -1;                    // behind the cap — no valid gnomonic projection
  const su = (dir[0] * u[0] + dir[1] * u[1] + dir[2] * u[2]) / cosd;
  const sv = (dir[0] * v[0] + dir[1] * v[1] + dir[2] * v[2]) / cosd;
  const r0 = Math.round(sv / rowH);
  let best = -1, bestDot = -Infinity;
  const scan = (ring) => {
    for (let r = r0 - ring; r <= r0 + ring; r++) {
      const offset = ((((r % 2) + 2) % 2) === 1) ? cell * 0.5 : 0;
      const c0 = Math.round((su - offset) / cell);
      for (let c = c0 - ring; c <= c0 + ring; c++) {
        const idx = indexAt.get(latticeKey(r, c));
        if (idx === undefined) continue;
        const f = fverts[idx];
        const d = dir[0] * f[0] + dir[1] * f[1] + dir[2] * f[2];
        if (d > bestDot) { bestDot = d; best = idx; }
      }
    }
  };
  scan(1);                                     // 3×3 candidate ring — the nearest lattice vert is here
  if (best === -1) scan(2);                    // near-rim fallback: widen once (still fixed-radius, O(1))
  return best;
}

// ───────────────────────── priorityFloodFromOutlets ─────────────────────────
// Fill depressions on the fine grid using the SAME priority-flood as planet-lod-rivers.js, but the
// open boundary is the set of OUTLET verts (closed seeds) instead of the ocean. Each popped
// neighbour is raised to >= the current cell so every non-outlet cell has a downhill path to an
// outlet. Deterministic: the binary heap breaks elevation ties by ascending index.
export function priorityFloodFromOutlets(fadj, h, isOutlet) {
  const N = h.length;
  const filled = Float64Array.from(h);
  const closed = new Uint8Array(N);
  const heapE = [], heapI = [];
  function lt(ai, bi) { // strict ordering with index tie-break → fully deterministic heap
    if (heapE[ai] < heapE[bi]) return true;
    if (heapE[ai] > heapE[bi]) return false;
    return heapI[ai] < heapI[bi];
  }
  function push(e, i) {
    heapE.push(e); heapI.push(i); let c = heapE.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (!lt(c, p)) break;
      [heapE[p], heapE[c]] = [heapE[c], heapE[p]]; [heapI[p], heapI[c]] = [heapI[c], heapI[p]]; c = p; }
  }
  function pop() {
    const e = heapE[0], i = heapI[0]; const le = heapE.pop(), li = heapI.pop();
    if (heapE.length) { heapE[0] = le; heapI[0] = li; let c = 0; const n = heapE.length;
      for (;;) { let l = 2 * c + 1, r = 2 * c + 2, s = c;
        if (l < n && lt(l, s)) s = l; if (r < n && lt(r, s)) s = r; if (s === c) break;
        [heapE[s], heapE[c]] = [heapE[c], heapE[s]]; [heapI[s], heapI[c]] = [heapI[c], heapI[s]]; c = s; } }
    return [e, i];
  }
  for (let i = 0; i < N; i++) { if (isOutlet[i]) { closed[i] = 1; push(filled[i], i); } }
  while (heapE.length) {
    const [, c] = pop();
    const nbs = fadj[c];
    for (let q = 0; q < nbs.length; q++) {
      const nb = nbs[q];
      if (closed[nb]) continue;
      closed[nb] = 1;
      if (filled[nb] <= filled[c]) filled[nb] = filled[c] + 1e-6;
      push(filled[nb], nb);
    }
  }
  return filled;
}

// ───────────────────────── steepestReceiver ─────────────────────────
// For each non-outlet fine vert, receiver = neighbour of steepest downhill slope (drop/dist) on the
// FILLED surface. Outlet verts are self-receivers (sinks). Tie-break on slope is by ascending
// neighbour index, so the result is independent of adjacency-list order. dist uses the unit-sphere
// chord length between the two fine verts (the same metric rivers.js uses).
export function steepestReceiver(fverts, fadj, filled, isOutlet) {
  const N = filled.length;
  const receiver = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (isOutlet[i]) { receiver[i] = i; continue; }
    const si = filled[i];
    let best = -1, bestSlope = 0;
    const nbs = fadj[i];
    for (let q = 0; q < nbs.length; q++) {
      const nb = nbs[q];
      const drop = si - filled[nb];
      if (drop <= 0) continue;
      const d = vlen(vsub(fverts[nb], fverts[i]));
      const slope = drop / Math.max(1e-12, d);
      // strict '>' with index tie-break: among equal-slope candidates the lowest index wins
      if (slope > bestSlope || (slope === bestSlope && best !== -1 && nb < best)) {
        bestSlope = slope; best = nb;
      }
    }
    receiver[i] = best === -1 ? i : best; // a filled cell should always have a downhill neighbour
  }
  return receiver;
}

// ───────────────────────── strahlerOrder ─────────────────────────
// Horton–Strahler order on the fine receiver-tree. Processed in descending FILLED surface order
// (headwaters first → sinks last), mirroring rivers.js. A node with no upstream children is order 1;
// when its two highest-order children tie it increments, else it inherits the max child order.
// Outlet (sink) verts are skipped (left order 0) just like ocean nodes in the global router.
export function strahlerOrder(filled, receiver, isOutlet) {
  const N = filled.length;
  const order = Array.from({ length: N }, (_, i) => i)
    .sort((a, b) => (filled[b] - filled[a]) || (a - b)); // tie-break by index → deterministic
  const strahler = new Int32Array(N).fill(0);
  const childMaxOrd = new Int32Array(N).fill(0);
  const childMaxCnt = new Int32Array(N).fill(0);
  const hasChild = new Uint8Array(N);
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    if (isOutlet[i]) continue;
    const ord = !hasChild[i] ? 1 : (childMaxCnt[i] >= 2 ? childMaxOrd[i] + 1 : childMaxOrd[i]);
    strahler[i] = ord;
    const r = receiver[i];
    if (r !== i && !isOutlet[r]) {
      hasChild[r] = 1;
      if (ord > childMaxOrd[r]) { childMaxOrd[r] = ord; childMaxCnt[r] = 1; }
      else if (ord === childMaxOrd[r]) childMaxCnt[r]++;
    }
  }
  return strahler;
}

// ───────────────────────── flow accumulation (for tests / width) ─────────────────────────
function flowAccum(filled, receiver, isOutlet) {
  const N = filled.length;
  const order = Array.from({ length: N }, (_, i) => i)
    .sort((a, b) => (filled[b] - filled[a]) || (a - b));
  const accum = new Float32Array(N).fill(1);
  for (let k = 0; k < order.length; k++) {
    const i = order[k]; if (isOutlet[i]) continue;
    const r = receiver[i]; if (r !== i) accum[r] += accum[i];
  }
  return accum;
}

// ───────────── macro-height interpolation (nearest base vert, within the patch) ─────────────
// Trend the fine field with the TRUE macro slope toward the trunk: each fine vert takes the
// routed.surf of its nearest in-patch base node. Nearest (not barycentric) is sufficient here and
// keeps this dependency-free; the base mesh is far coarser than the fine grid so this is smooth at
// fine scale. Returns a function fineIdx → baseSurf and the nearest base index per fine vert.
function buildMacroInterp(baseMesh, surf, fverts) {
  const { verts, N } = baseMesh;
  const baseN = N != null ? N : verts.length;
  const nearestBase = new Int32Array(fverts.length).fill(-1);
  const baseH = new Float64Array(fverts.length);
  for (let k = 0; k < fverts.length; k++) {
    const p = fverts[k];
    let best = -1, bestDot = -Infinity;
    for (let i = 0; i < baseN; i++) {
      const d = vdot(p, verts[i]); // both unit ⇒ larger dot = closer
      if (d > bestDot) { bestDot = d; best = i; }
    }
    nearestBase[k] = best;
    baseH[k] = surf(best);
  }
  return { nearestBase, baseH };
}

// ═══════════════════════════════ growTributaries (the spike) ═══════════════════════════════
// Grow REAL connected finer tributaries inside `region` by refined local re-routing onto the
// existing trunk channels (the OUTLETS). Returns the fine network + outlet bookkeeping; see the
// per-field comments. `sampleHeight(p)` is accepted for parity/extension but the macro trend here
// is taken from routed.surf over the base mesh (the true routed surface) — sampleHeight, if given,
// is mixed in as an extra low-frequency macro term so the field still trends with real elevation
// when a caller supplies a richer height than the coarse base graph carries.
export function growTributaries({ baseMesh, routed, sampleHeight, height, seaLevel, region, seed = 0, params }) {
  const P = { ...DEFAULT_TRIB_PARAMS, ...(params || {}) };
  const gridRes = (region && region.gridRes != null) ? region.gridRes : P.gridRes;
  const { center, angularRadius } = region;

  // 1. deterministic fine lattice (pure function of region+gridRes)
  const grid = buildFineGrid({ center, angularRadius }, gridRes);
  const { fverts, fadj, planar, cell: fineCell } = grid;
  const Nf = fverts.length;
  const cellAngle = Math.atan(fineCell);   // ~angular size of one fine cell (for trunk densification)

  // 2. identify trunk OUTLETS: in-patch base channel nodes, snapped to nearest fine vert.
  const cosR = Math.cos(angularRadius);
  const { verts: bverts, N: bN0, isChannel, strahler: bStrahler } = baseMesh;
  const baseN = bN0 != null ? bN0 : bverts.length;
  const { strahler: rStrahler, isChannel: rIsChannel } = routed;
  const trunkStrahler = rStrahler || bStrahler;
  const trunkChannel = rIsChannel || isChannel;

  const { surf } = routed;
  const { receiver: bReceiver } = routed;
  const isOutlet = new Uint8Array(Nf);
  const outletBaseNode = new Int32Array(Nf).fill(-1);
  const outletSurf = new Float64Array(Nf);   // trunk/sea surf to pin h to, per fine outlet
  const isOceanFine = new Uint8Array(Nf);    // co-dependence Fix 2/3: fine vert is below sea level
  // helper: nearest fine vert to an arbitrary unit direction — O(1) closed-form lattice inverse
  // (§3.2; was an O(Nf) linear scan ⇒ O(Nf²) overall, the blocker on raising gridRes).
  const snapNearest = (dir) => snapToLattice(grid, dir);
  // claim a fine vert as an outlet for base node bn at elevation s; on collision keep the
  // higher-strahler trunk node (deterministic: index-stable, strahler-prioritised).
  const claimOutlet = (k, bn, s) => {
    if (k < 0) return;
    if (isOutlet[k]) {
      const cur = outletBaseNode[k];
      // SEA-vs-TRUNK collision (Fix 2): bn === -1 is a SEA outlet. A trunk outlet always wins a
      // collision (keep the trunk node) — both still act as sinks, and trunkStrahler[-1] is undefined,
      // so resolve the priority EXPLICITLY rather than via an undefined strahler comparison.
      if (bn === -1) return;                                                   // existing claim wins over a sea outlet
      if (cur === -1) { outletBaseNode[k] = bn; outletSurf[k] = s; return; }   // a trunk node overrides a sea claim
      const curS = trunkStrahler ? trunkStrahler[cur] : 0;
      const newS = trunkStrahler ? trunkStrahler[bn] : 0;
      if (newS > curS) { outletBaseNode[k] = bn; outletSurf[k] = s; }
    } else {
      isOutlet[k] = 1; outletBaseNode[k] = bn; outletSurf[k] = s;
    }
  };
  const inPatch = (i) => vdot(bverts[i], center) >= cosR;
  for (let i = 0; i < baseN; i++) {
    if (!trunkChannel || trunkChannel[i] !== 1) continue;
    if (!inPatch(i)) continue;
    // snap this trunk node to its nearest fine vert (the outlet POINT)
    claimOutlet(snapNearest(bverts[i]), i, surf(i));
    // DENSIFY the trunk into a continuous fine sink-LINE: walk the geodesic to its trunk receiver
    // (if that receiver is also an in-patch trunk node) and claim every fine vert along it. This is
    // what makes the trunk drain onto the WHOLE line, not collapse onto a few snapped points — the
    // spec's "connected sink-LINE of fine verts" / "drains onto the whole line, NOT one point".
    const r = bReceiver ? bReceiver[i] : i;
    if (r !== i && trunkChannel[r] === 1 && inPatch(r)) {
      const a = bverts[i], b = bverts[r];
      const sa = surf(i), sb = surf(r);
      const ang = Math.acos(Math.max(-1, Math.min(1, vdot(a, b))));
      const segSteps = Math.max(1, Math.ceil(ang / Math.max(1e-6, cellAngle)));
      for (let s = 1; s < segSteps; s++) {
        const t = s / segSteps;
        // geodesic slerp between a and b
        const so = Math.sin(ang) || 1e-9;
        const w0 = Math.sin((1 - t) * ang) / so, w1 = Math.sin(t * ang) / so;
        const mid = vnorm([a[0] * w0 + b[0] * w1, a[1] * w0 + b[1] * w1, a[2] * w0 + b[2] * w1]);
        // the densified line carries node i's identity (the upstream-higher node); pin elevation to
        // the linearly-interpolated trunk surf so the line stays a proper downhill sink.
        claimOutlet(snapNearest(mid), i, sa + (sb - sa) * t);
      }
    }
  }

  // 2b. SEA-OUTLET pass (co-dependence Fix 2): a fine vert below sea level is a COAST outlet, so fine
  // flow drains to whichever outlet (trunk OR sea) it reaches first — tributaries FEED the ocean
  // instead of ponding at the coast (North Star). seaLevel/height are orchestrator-supplied readers
  // (§4.3); guarded so pure-CPU callers (no GPU height) are a no-op. height[k] corresponds to
  // fverts[k] because buildFineGrid is a pure fn of (region, gridRes): the bake's height array and
  // this lattice share indices. Sea outlets pin to seaLevel (the shoreline level-set h == seaLevel),
  // claimed AFTER the trunk loop so a trunk outlet wins any collision (see claimOutlet).
  if (height && typeof seaLevel === 'number') {
    for (let k = 0; k < Nf; k++) {
      if (height[k] < seaLevel) {
        isOceanFine[k] = 1;
        claimOutlet(k, -1, seaLevel);
      }
    }
  }

  // 3. fine height field = REAL height at coeff 1.0 + fine fbm; outlets PIN to their trunk/sea surf.
  // Co-dependence Fix 1 (§4): route on the orchestrator-supplied GPU height at FULL strength so the
  // fine network bends around the real mountains (the base router's 9-octave surf is too coarse to
  // see sub-mesh relief). baseH is demoted to a tiny FLATS_EPS tie-breaker — NOT a fixed-fraction
  // blend — purely to give priority-flood a deterministic downhill direction on dead-flat GPU terrain.
  const FLATS_EPS = 1e-3;
  const { baseH } = buildMacroInterp(baseMesh, surf, fverts);
  const h = new Float64Array(Nf);
  for (let k = 0; k < Nf; k++) {
    const p = fverts[k];
    let macro;
    if (typeof sampleHeight === 'function') {
      macro = sampleHeight(p) + FLATS_EPS * baseH[k];   // coeff 1.0 on the real field; flats tie-breaker
    } else {
      macro = baseH[k];                                 // pure-CPU path: no richer field to honor
    }
    const fineN = fbm(p[0] * P.fineFreq, p[1] * P.fineFreq, p[2] * P.fineFreq, seed, P);
    h[k] = macro + P.fineAmp * fineN;
  }
  // OUTLET verts overwrite h with the trunk's TRUE (interpolated) elevation so fine cells drain
  // DOWN to the trunk's sink-LINE (not a bump). Densified line verts use the slerp-interpolated
  // trunk surf captured in outletSurf; snapped node verts use their own node's surf.
  for (let k = 0; k < Nf; k++) {
    if (isOutlet[k]) h[k] = outletSurf[k];
  }

  // 4. route the fine grid (outlets play the ocean's role)
  const filled = priorityFloodFromOutlets(fadj, h, isOutlet);
  const freceiver = steepestReceiver(fverts, fadj, filled, isOutlet);
  const fstrahler = strahlerOrder(filled, freceiver, isOutlet);
  const faccum = flowAccum(filled, freceiver, isOutlet);

  // 5. fine channels
  const isFineChannel = new Uint8Array(Nf);
  for (let k = 0; k < Nf; k++) if (fstrahler[k] >= P.channelOrderMin) isFineChannel[k] = 1;

  return {
    fverts, fadj, planar,
    freceiver, fstrahler, faccum,
    isOutlet, outletBaseNode, outletSurf, isFineChannel, isOceanFine,
    h, filled,
    region: { center, angularRadius, gridRes },
    seed, gridRes,
  };
}

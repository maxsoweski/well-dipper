// relief-e9-hydrology.js — E9 Hydrology, CPU BAKE-TIME REFERENCE (NOT per-frame). Pure: no three.js.
// The runtime target is a GPU FastFlow (Jain 2024) bake; this CPU priority-flood + exact accumulation
// reference exists to prove the host-editor mechanism (drainage cuts E6 relief), not bake speed.
// Priority-flood heap is the grid analogue of planet-lod-rivers.js:288-310 (Barnes 2014).

const NEI = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]; // 8-neighbour offsets

// Min-heap on (elevation, index). Returns depression-filled surface; boundary + sea cells are seeds.
export function priorityFloodFill(height, n, seaLevel) {
  const N = n * n;
  const filled = Float32Array.from(height);
  const closed = new Uint8Array(N);
  const he = [], hi = [];
  const push = (e, i) => { he.push(e); hi.push(i); let c = he.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (he[p] <= he[c]) break;
      [he[p], he[c]] = [he[c], he[p]]; [hi[p], hi[c]] = [hi[c], hi[p]]; c = p; } };
  const pop = () => { const e = he[0], i = hi[0]; const le = he.pop(), li = hi.pop();
    if (he.length) { he[0] = le; hi[0] = li; let c = 0; const m = he.length;
      for (;;) { let l = 2*c+1, r = 2*c+2, s = c;
        if (l < m && he[l] < he[s]) s = l; if (r < m && he[r] < he[s]) s = r; if (s === c) break;
        [he[s], he[c]] = [he[c], he[s]]; [hi[s], hi[c]] = [hi[c], hi[s]]; c = s; } }
    return i; };
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const i = iy * n + ix;
    const edge = ix === 0 || iy === 0 || ix === n - 1 || iy === n - 1;
    if (edge || filled[i] < seaLevel) { closed[i] = 1; push(filled[i], i); }
  }
  while (he.length) {
    const c = pop(); const cy = (c / n) | 0, cx = c - cy * n;
    for (const [dx, dy] of NEI) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const nb = ny * n + nx; if (closed[nb]) continue;
      closed[nb] = 1;
      if (filled[nb] <= filled[c]) filled[nb] = filled[c] + 1e-6;  // raise to spill point
      push(filled[nb], nb);
    }
  }
  return filled;
}

// D8 steepest descent on the filled surface (diagonal slopes /√2). receiver[i]=i means outlet/sea/edge.
export function d8Receivers(filled, n) {
  const N = n * n; const rec = new Int32Array(N).fill(-1);
  for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
    const i = iy * n + ix; let best = i, bestSlope = 0;
    for (const [dx, dy] of NEI) {
      const nx = ix + dx, ny = iy + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const nb = ny * n + nx; const dist = (dx && dy) ? Math.SQRT2 : 1;
      const slope = (filled[i] - filled[nb]) / dist;
      if (slope > bestSlope) { bestSlope = slope; best = nb; }
    }
    rec[i] = best; // i itself if no lower neighbour (outlet)
  }
  return rec;
}

// Exact accumulation over the single-flow-direction receiver tree, via Kahn topological sort
// (each node is poured into its receiver only after all its donors have been poured into it).
export function flowAccumulate(receiver, n, weight) {
  const N = n * n; const accum = new Float32Array(N);
  for (let i = 0; i < N; i++) accum[i] = weight ? weight[i] : 1;
  const indeg = new Int32Array(N);
  for (let i = 0; i < N; i++) if (receiver[i] !== i) indeg[receiver[i]]++;
  const queue = []; for (let i = 0; i < N; i++) if (indeg[i] === 0) queue.push(i);
  let h = 0;
  while (h < queue.length) {
    const i = queue[h++]; const r = receiver[i];
    if (r !== i) { accum[r] += accum[i]; if (--indeg[r] === 0) queue.push(r); }
  }
  return accum;
}

// ── append to relief-e9-hydrology.js ──
import { latDegOfRow } from './relief-substrate.js';

const clamp01b = (x) => Math.max(0, Math.min(1, x));

// Synthesized rainfall weight — no climate engine yet (E9 dossier: precip is under-supplied; stub it).
// latitude band (wet equator/temperate, dry mid) + orographic upslope (rain on windward height gradient).
export function synthPrecip(substrate, drivers) {
  const { n } = substrate; const w = new Float32Array(n * n);
  for (let iy = 0; iy < n; iy++) {
    const lat = latDegOfRow(substrate, iy) * Math.PI / 180;
    const band = 0.5 + 0.5 * Math.cos(lat * 2);                 // wet near equator & poles, dry mid
    for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix;
      const hx = substrate.height[Math.min(ix + 1, n - 1) + iy * n] - substrate.height[i];
      const oro = clamp01b(hx * 4);                              // upslope (windward +x) → more rain
      w[i] = 0.4 + band + 0.6 * oro;
    }
  }
  // normalise to mean ~1 so K stays calibrated
  let s = 0; for (const v of w) s += v; const k = (n * n) / (s || 1);
  for (let i = 0; i < w.length; i++) w[i] *= k;
  return w;
}

export function seaLevelForFraction(height, n, frac) {
  if (frac <= 0) return -Infinity; if (frac >= 1) return Infinity;
  const sorted = Float32Array.from(height).sort();
  return sorted[Math.floor(frac * (sorted.length - 1))];
}

export function runE9(substrate, drivers, epoch = { name: 'fluvial-carve' }, seed = 'e9') {
  const { n } = substrate; const N = n * n;
  // L4: liquid-stability gate — airless/frozen bodies carve ~nothing (no liquid → no fluvial network).
  const liquidStability = drivers.liquidStability ?? 1;
  if (liquidStability <= 1e-3) {
    return { incision: new Float32Array(N), seaLevel: -Infinity, passes: 0 };  // airless/frozen: no carve
  }
  const PASSES = 5;                       // bounded handful (E9 verify: not 1, not ~200)
  const m = 0.45, nExp = 1.0;
  const erodibility = 0.18 * clamp01b(0.3 + 0.7 * (drivers.surfaceHistory ?? 0))
                      * liquidStability * (drivers.rainFactor ?? 1);   // L4: gate carve strength
  const weight = synthPrecip(substrate, drivers);
  const maturity = clamp01b(0.4 + 0.6 * (drivers.age ?? 0.5));

  // sea level from a volatile/temperature-derived target ocean fraction (E9 base-level step).
  const targetFrac = clamp01b(0.5 * liquidStability);   // L4: ocean fraction from liquid stability (was 0.4)
  let seaLevel = seaLevelForFraction(substrate.height, n, targetFrac);

  const incision = new Float32Array(N);   // accumulates ≤0
  for (let p = 0; p < PASSES; p++) {
    const filled = priorityFloodFill(substrate.height, n, seaLevel);
    const rec = d8Receivers(filled, n);
    const accum = flowAccumulate(rec, n, weight);
    for (let i = 0; i < N; i++) substrate.flowAccum[i] = accum[i];
    // one bounded stream-power increment per cell, capped so a cell never cuts below its receiver.
    for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
      const i = iy * n + ix; const r = rec[i]; if (r === i) continue;
      if (substrate.height[i] < seaLevel) continue;                 // don't carve underwater
      const ry = (r / n) | 0, rx = r - ry * n;
      const dist = ((ix - rx) && (iy - ry)) ? Math.SQRT2 : 1;
      const slope = Math.max(0, (substrate.height[i] - substrate.height[r]) / dist);
      let dz = erodibility * Math.pow(accum[i], m) * Math.pow(slope, nExp) * maturity * 0.02;
      const drop = substrate.height[i] - substrate.height[r];
      dz = Math.min(dz, Math.max(0, drop * 0.5));                   // stability cap (no inversion)
      incision[i] -= dz;
      substrate.height[i] -= dz;
    }
  }
  // base-level / standing-liquid fill (lakes from residual depressions + the sea).
  const filledFinal = priorityFloodFill(substrate.height, n, seaLevel);
  for (let i = 0; i < N; i++) {
    const lake = filledFinal[i] - substrate.height[i] > 1e-4;
    const sea = substrate.height[i] < seaLevel;
    substrate.standing[i] = (lake || sea) ? 1 : 0;
    substrate.baseLevel[i] = sea ? seaLevel : (lake ? filledFinal[i] : substrate.height[i]);
    substrate.maturity[i] = Math.min(1, substrate.maturity[i] + maturity * 0.5);
  }
  return { incision, seaLevel, passes: PASSES };
}

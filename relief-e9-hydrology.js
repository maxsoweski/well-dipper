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

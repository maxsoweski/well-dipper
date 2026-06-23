// relief-slice.js — orchestrator + north-star verifier. Pure: no three.js.
// The 2-epoch host-editor loop: ONE shared substrate, E6 writes height in epoch 1, E9 subtracts in
// epoch 2. heightAfterBuild is the legibility witness (lets us prove "drainage post-dates the relief").
import { makeBaseStep } from './relief-base-step.js';
import { runE6 } from './relief-e6-tectonic.js';
import { runE9, d8Receivers, priorityFloodFill } from './relief-e9-hydrology.js';
import { cloneHeight } from './relief-substrate.js';

export function runReliefSlice(driverBundle, opts = {}) {
  const params = { n: 256, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'slice', epoch2: true, ...opts };
  const { drivers, crust, substrate } = makeBaseStep(driverBundle, params);
  // EPOCH 1 — tectonic build (E6 writes the host).
  runE6(substrate, crust, drivers, { name: 'tectonic-build' }, params.seed);
  const heightAfterBuild = cloneHeight(substrate);
  // EPOCH 2 — fluvial carve (E9 edits the host in place).
  let e9 = null;
  if (params.epoch2) e9 = runE9(substrate, drivers, { name: 'fluvial-carve' }, params.seed);
  const heightAfterCarve = cloneHeight(substrate);
  if (params.overprint) {
    runE6(substrate, crust, drivers,
          { name: 'despin-overprint', rotatePoleDeg: params.overprint.rotatePoleDeg ?? 30,
            blend: params.overprint.blend ?? 0.4 }, params.seed + ':op');
  }
  return { substrate, drivers, crust, heightAfterBuild, heightAfterCarve, e9, params };
}

export function verifyReliefSlice(result) {
  const { substrate, heightAfterBuild, e9, params } = result;
  const { n } = substrate; const N = n * n; const h = substrate.height;
  // 1. strictly subtractive
  let subtractive = true;
  for (let i = 0; i < N; i++) if (h[i] > heightAfterBuild[i] + 1e-6) { subtractive = false; break; }
  // 2. carve correlates with pre-carve relief
  const med = Float32Array.from(heightAfterBuild).sort()[N >> 1];
  let hiSum = 0, hiN = 0, loSum = 0, loN = 0;
  for (let i = 0; i < N; i++) { const cut = heightAfterBuild[i] - h[i];
    if (heightAfterBuild[i] > med) { hiSum += cut; hiN++; } else { loSum += cut; loN++; } }
  const carveCorrelatesRelief = (hiSum / Math.max(1, hiN)) > (loSum / Math.max(1, loN));
  // 3. no uphill flow on the final filled surface
  const seaLevel = e9 ? e9.seaLevel : -Infinity;
  const filled = priorityFloodFill(h, n, seaLevel);
  const rec = d8Receivers(filled, n);
  let uphill = 0; for (let i = 0; i < N; i++) if (rec[i] !== i && filled[rec[i]] > filled[i] + 1e-6) uphill++;
  const noUphill = uphill === 0;
  // 4. accumulation spread
  const accum = substrate.flowAccum; const maxA = Math.max(...accum);
  const meanA = accum.reduce((a, b) => a + b, 0) / N;
  const accumSpread = maxA > meanA * 5;
  // 5. depressions filled (every land cell has a downhill neighbour after fill, except outlets/edges)
  let depressionsFilled = true;
  for (let iy = 1; iy < n - 1 && depressionsFilled; iy++) for (let ix = 1; ix < n - 1; ix++) {
    const i = iy * n + ix; if (h[i] < seaLevel) continue;
    let hasLower = false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
      if (filled[(iy+dy)*n + (ix+dx)] < filled[i] - 1e-9) { hasLower = true; break; }
    if (!hasLower) { depressionsFilled = false; break; }
  }
  // 6. Hack's law: longest upstream flow-path length vs drainage area, regressed over channel cells.
  // REPORTED quality metric, not part of the gate: it is an emergent realism garnish (not in the
  // wf2-synthesis §9 north-star definition) AND it is resolution-dependent (coarse grids under-resolve
  // the network and bias h low — ~0.38 @ n=96 vs ~0.44 @ n=192), so it is only meaningful at adequate
  // resolution. The gate below is the five resolution-ROBUST signals that ARE the §9 proof.
  const hackExponent = estimateHackExponent(rec, accum, n);
  const hackPlausible = hackExponent > 0.4 && hackExponent < 0.8;   // informational; valid only at n≳160
  const pass = subtractive && carveCorrelatesRelief && noUphill && accumSpread && depressionsFilled;
  return { pass, signals: { subtractive, carveCorrelatesRelief, noUphill, accumSpread,
                            depressionsFilled, hackExponent, hackPlausible },
           detail: { uphill, maxA, meanA, hiCut: hiSum / Math.max(1, hiN), loCut: loSum / Math.max(1, loN) } };
}

// Hack's law L ~ A^h: for EVERY cell, the longest upstream flow-path length to its divide (L) scales
// with the drainage area at that cell (A). Regress log(L) vs log(A) over channel cells (A above a small
// threshold, to drop hillslope noise). h ≈ 0.5–0.6 for mature dendritic networks.
//   Bug history (fixed 2026-06-23): the prior version regressed distance-from-OUTLET vs area. Distance
//   from the outlet is INVERSELY related to drainage area, so it measured a distorted inverse slope
//   (~0.39, seed-fragile) instead of Hack's law. The correct length coordinate is distance-from-DIVIDE,
//   i.e. the longest upstream path, computed here by a Kahn longest-path pass over the receiver tree.
function estimateHackExponent(rec, accum, n) {
  const N = n * n;
  // indegree = number of upstream donors of each cell
  const indeg = new Int32Array(N);
  for (let i = 0; i < N; i++) if (rec[i] !== i) indeg[rec[i]]++;
  // longest upstream path length per cell: Kahn from divides (indeg 0) downstream to outlets.
  const upLen = new Float64Array(N).fill(1);          // a divide cell has L = 1
  const remaining = Int32Array.from(indeg);
  const q = []; for (let i = 0; i < N; i++) if (indeg[i] === 0) q.push(i);
  let head = 0;
  while (head < q.length) {
    const i = q[head++]; const r = rec[i];
    if (r !== i) {
      if (upLen[i] + 1 > upLen[r]) upLen[r] = upLen[i] + 1;   // longest, not sum
      if (--remaining[r] === 0) q.push(r);
    }
  }
  // log-log least squares of L vs A over channel cells (A >= 8 ≈ above the mean → the routed network).
  let sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0;
  for (let i = 0; i < N; i++) {
    if (accum[i] < 8) continue;
    const x = Math.log(accum[i]), y = Math.log(upLen[i]);
    sx += x; sy += y; sxx += x * x; sxy += x * y; k++;
  }
  if (k < 3) return 0.5;
  const slope = (k * sxy - sx * sy) / (k * sxx - sx * sx);   // d(logL)/d(logA) = h (expect positive)
  return Number.isFinite(slope) ? slope : 0.5;
}

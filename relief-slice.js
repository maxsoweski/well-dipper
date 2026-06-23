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
  return { substrate, drivers, crust, heightAfterBuild, e9, params };
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
  // 6. Hack's law: longest flow path length vs its drainage area, exponent via the trunk outlet.
  const hackExponent = estimateHackExponent(rec, accum, n);
  const pass = subtractive && carveCorrelatesRelief && noUphill && accumSpread &&
               depressionsFilled && hackExponent > 0.4 && hackExponent < 0.8;
  return { pass, signals: { subtractive, carveCorrelatesRelief, noUphill, accumSpread,
                            depressionsFilled, hackExponent },
           detail: { uphill, maxA, meanA, hiCut: hiSum / Math.max(1, hiN), loCut: loSum / Math.max(1, loN) } };
}

// Hack's law L ~ A^h: walk the longest upstream path from the highest-accumulation outlet, regress
// path length vs accumulated area in log-log over the trunk. Returns h (~0.5-0.6 for fluvial nets).
function estimateHackExponent(rec, accum, n) {
  const N = n * n;
  // find outlet (receiver==self) with max accum
  let outlet = 0, best = -1; for (let i = 0; i < N; i++) if (rec[i] === i && accum[i] > best) { best = accum[i]; outlet = i; }
  // donors map
  const donors = Array.from({ length: N }, () => []);
  for (let i = 0; i < N; i++) if (rec[i] !== i) donors[rec[i]].push(i);
  // walk upstream always to the highest-accum donor; record (length, area)
  const lens = [], areas = []; let cur = outlet, len = 0;
  const seen = new Uint8Array(N);
  while (cur != null && !seen[cur]) {
    seen[cur] = 1; len++; lens.push(len); areas.push(accum[cur]);
    let nxt = null, bA = -1; for (const d of donors[cur]) if (accum[d] > bA) { bA = accum[d]; nxt = d; }
    cur = nxt;
  }
  // log-log least squares of length vs area over points with area>1
  let sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0;
  for (let j = 0; j < lens.length; j++) { if (areas[j] <= 1) continue;
    const x = Math.log(areas[j]), y = Math.log(lens[j]); sx += x; sy += y; sxx += x * x; sxy += x * y; k++; }
  if (k < 3) return 0.5;
  const slope = (k * sxy - sx * sy) / (k * sxx - sx * sx);   // d(logL)/d(logA) = h
  return Number.isFinite(slope) ? Math.abs(slope) : 0.5;
}

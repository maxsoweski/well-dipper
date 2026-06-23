// relief-slice.js — orchestrator + north-star verifier. Pure: no three.js.
// The 2-epoch host-editor loop: ONE shared substrate, E6 writes height in epoch 1, E9 subtracts in
// epoch 2. heightAfterBuild is the legibility witness (lets us prove "drainage post-dates the relief").
//
// ── BUILD INTENT (per record-build-intent; this is the slice ENTRY — read here first) ──
// Function: makeBaseStep → E6 tectonic BUILD (epoch 1, writes height) → E9 hydrology CARVE (epoch 2,
//   subtracts from the SAME height) → optional E6 despin-overprint. verifyReliefSlice checks 5 north-star signals.
// Intent: prove the host-editor / shared-substrate mechanism end-to-end — one mutable DEM edited across epochs
//   so the result reads as a landscape WITH A HISTORY — in an ISOLATED lab (zero production edits).
// Deliberate NON-GOALS (by design — do NOT "fix" without scoping):
//   • Per-body-type structural divergence: presets modulate AMPLITUDE only, not formation shape — full why in
//     the BUILD INTENT block of relief-presets.js.
//   • Flat 2D latitude-band DEM, not sphere/cubemap (sphere mapping deferred).
//   • E9 is a CPU bake-time REFERENCE, not per-frame (GPU FastFlow bake deferred).
//   • D12 derived in this slice's own base step (production PlanetGenerator.js:565 hard-zero untouched).
//   • Hack's-law exponent is a REPORTED metric, not a pass gate (resolution-dependent garnish).
import { makeBaseStep } from './relief-base-step.js';
import { runE6 } from './relief-e6-tectonic.js';
import { runE9, d8Receivers, priorityFloodFill } from './relief-e9-hydrology.js';
import { cloneHeight } from './relief-substrate.js';
import { hypsometricDistance, perCellRMS, regimeHistogramDistance,
         directionalAnisotropy, carveFraction } from './relief-divergence.js';

export function runReliefSlice(driverBundle, opts = {}) {
  const params = { n: 256, lat0Deg: 0, lat1Deg: 80, domainKm: 4000, seed: 'slice',
                   epoch2: true, discriminate: true, ...opts };
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

// LOCKED thresholds (validate vs null=identical-bundle ~0 AND reseed runs=same-bundle-diff-seed before freezing).
const REGIME_DIVERGE = 0.2;   // regime-class TV: cross-regime ~0.7-1.0, same-regime/null ~0
const HYDRO_DIVERGE  = 0.3;   // |liquidStability| gap: europa(1.0) vs lava(0.0)=1.0; rocky(0.74) vs terr(1.0)=0.26 (same category, correctly not-different)
const CARVE_DIVERGE  = 0.05;  // |carveFraction| gap

// Decisive §5/§9 gate. PASS iff a pair diverges on >=1 ROBUST, RESEED-INVARIANT, PHYSICS-CARRIED axis:
// tectonic regime (L1) OR hydrology/liquid-stability (L4) OR fluvial carve (L4). All invariant to a Layer-3
// reseed -> a reshuffle of the same world cannot pass. directional anisotropy (L2, flips with regime sign ->
// redundant as a gate term) and held-seed hypsometric (reseed-invariant but EMPIRICALLY seed-fragile across
// regimes) are REPORTED to credit/corroborate, NOT gated.
export function divergenceReport(bundleA, bundleB, { n = 192, seed = 'gate' } = {}) {
  const held  = (b, s) => runReliefSlice(b, { n, seed: s, epoch2: false, discriminate: false });
  const carve = (b)    => runReliefSlice(b, { n, seed,     epoch2: true,  discriminate: true  });
  const a0 = held(bundleA, seed), b0 = held(bundleB, seed);
  const aR1 = held(bundleA, seed + 'A'), aR2 = held(bundleA, seed + 'B');   // reseed floor (same bundle)
  const cA = carve(bundleA), cB = carve(bundleB);
  // robust GATE axes
  const regimeDist = regimeHistogramDistance(a0.substrate.regime, b0.substrate.regime);
  const lsA = a0.drivers.liquidStability ?? 1, lsB = b0.drivers.liquidStability ?? 1;
  const hydroDist  = Math.abs(lsA - lsB);
  const carveA = carveFraction(cA.e9?.incision ?? new Float32Array(n * n));
  const carveB = carveFraction(cB.e9?.incision ?? new Float32Array(n * n));
  const carveDist = Math.abs(carveA - carveB);
  // REPORTED corroboration (not gated)
  const anisoA = directionalAnisotropy(a0.substrate.height, a0.substrate.grainAngle, n);
  const anisoB = directionalAnisotropy(b0.substrate.height, b0.substrate.grainAngle, n);
  const heldSeedHypso = hypsometricDistance(a0.substrate.height, b0.substrate.height);
  const reseedFloor   = hypsometricDistance(aR1.substrate.height, aR2.substrate.height);
  const perCell       = perCellRMS(a0.substrate.height, b0.substrate.height);
  const regimePass = regimeDist > REGIME_DIVERGE, hydroPass = hydroDist > HYDRO_DIVERGE, carvePass = carveDist > CARVE_DIVERGE;
  const pass = regimePass || hydroPass || carvePass;
  const reason = [regimePass && 'regime', hydroPass && 'hydrology', carvePass && 'carve'].filter(Boolean).join('+') || 'none';
  return { pass, reason, regimeDist, hydroDist, carveDist, carveA, carveB, lsA, lsB,
           anisoA, anisoB, heldSeedHypso, reseedFloor, perCellRMS: perCell };
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

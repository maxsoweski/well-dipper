// gate-3-interpenetration-validation.mjs
// ─────────────────────────────────────────────────────────────────────────────
// PRE-CODE GATE #3 (World-Engine history program, ROADMAP v2.1 §5.4 #2):
//   the INTERPENETRATION STATISTIC that separates a genuinely compound landform
//   ("a shield emerging FROM a corona at one center" — pierce and tent expressions
//   INTERPENETRATE) from the failure the pilot exists to avoid ("Io-patch TILED
//   beside Venus-patch" — two catalog landforms placed side by side), AND from the
//   salt-and-pepper mush trap (random per-node scatter, which a naive mixing index
//   scores as maximally mixed).
//
// This script is the arbiter for the DESIGN brief (gate-3-interpenetration-statistic-DESIGN.md).
// It is DETERMINISTIC (seeded `alea` only; no Math.random / Date.now), three-free
// (inline Fibonacci-sphere + k-NN adjacency — NOT buildIrregularSphere, which imports
// three; see the brief §"Sphere sampling" for why the fallback is used and why it is
// sufficient for a graph statistic), and does bounded O(N·deg) work (no convergence loop).
//
// Run from the repo root:  node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-3-interpenetration-validation.mjs
// ─────────────────────────────────────────────────────────────────────────────
import alea from 'alea';

// ── tiny vec3 helpers (three-free; same convention as the base/ writers) ─────────
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (lo, hi, v) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function randDir(rng) {                       // uniform point on the unit sphere (2 draws)
  const z = 2 * rng() - 1;
  const t = 2 * Math.PI * rng();
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
}
const angDist = (a, b) => Math.acos(clamp(-1, 1, dot(a, b)));   // geodesic radians

// ── Fibonacci sphere + symmetric k-NN adjacency (quasi-uniform; k=6 ≈ hexagonal) ──
// z-band bucketing keeps k-NN ~O(N·√N) so N=40962 is a few seconds, not O(N²).
export function buildFibSphere(N, k = 6) {
  const GA = Math.PI * (3 - Math.sqrt(5));   // golden angle
  const verts = new Array(N);
  for (let i = 0; i < N; i++) {
    const z = 1 - (2 * i + 1) / N;           // z in (-1,1), centre-of-cell
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const th = GA * i;
    verts[i] = [r * Math.cos(th), r * Math.sin(th), z];
  }
  // bucket by z-band
  const bands = Math.max(1, Math.round(Math.sqrt(N)));
  const bucket = Array.from({ length: bands }, () => []);
  const bandOf = (z) => clamp(0, bands - 1, Math.floor(((z + 1) / 2) * bands));
  for (let i = 0; i < N; i++) bucket[bandOf(verts[i][2])].push(i);
  // k nearest by angular distance, searching ±2 bands
  const nbrSet = Array.from({ length: N }, () => new Set());
  for (let i = 0; i < N; i++) {
    const b = bandOf(verts[i][2]);
    const best = [];   // [{j,d}] kept sorted ascending, length ≤ k
    for (let bb = Math.max(0, b - 2); bb <= Math.min(bands - 1, b + 2); bb++) {
      const cand = bucket[bb];
      for (let c = 0; c < cand.length; c++) {
        const j = cand[c];
        if (j === i) continue;
        const d = -dot(verts[i], verts[j]);   // ascending in angle ⇔ ascending in -dot
        if (best.length < k) {
          best.push({ j, d }); best.sort((p, q) => p.d - q.d);
        } else if (d < best[k - 1].d) {
          best[k - 1] = { j, d }; best.sort((p, q) => p.d - q.d);
        }
      }
    }
    for (const e of best) nbrSet[i].add(e.j);
  }
  // symmetrize (union) → undirected adjacency
  for (let i = 0; i < N; i++) for (const j of nbrSet[i]) nbrSet[j].add(i);
  const adj = nbrSet.map((s) => Int32Array.from(s));
  // canonical edge list (i<j) + mean edge angle
  let angSum = 0, eCount = 0;
  const edges = [];
  for (let i = 0; i < N; i++) for (const j of adj[i]) if (j > i) { edges.push([i, j]); angSum += angDist(verts[i], verts[j]); eCount++; }
  return { verts, adj, edges, meanEdgeAngle: angSum / eCount, nodeArea: (4 * Math.PI) / N };
}

// ── THE STATISTIC ────────────────────────────────────────────────────────────────
// cls[i] ∈ {0,1}: the pierce/tent FAMILY projection of primitiveId (in the pilot,
// cls[i] = familyOf(primitiveId[i]); 1 = PIERCE/magmatic, 0 = TENT/stagnant).
//
// The three cases separate on TWO resolution-invariant GEOMETRIC axes of the pierce
// (minority "figure") class's connected components:
//
//   C  = COMPACTNESS  = (effective-compact pierce area) / (total pierce area) ∈[0,1].
//        Per component q_k = clamp01( B_disc(s_k) / B_k ) where B_k = its boundary-node
//        count and B_disc(s_k) = the boundary-node count of an EQUAL-AREA geodesic disc
//        (=1 for a round disc, →0 for a fractal/percolated/speckled blob). Components
//        below SIZE_FLOOR (a random-coincidence speck, not a legible feature) score 0.
//        → rejects SCATTER (salt-and-pepper: nothing is a compact disc).
//   F  = FRAGMENTATION = 1 − Σ_k (e_k/E)²  (Herfindahl over effective-compact areas
//        e_k = a_k·q_k, E = Σ e_k). 0 = one blob, →1 = many equal dispersed discs.
//        → rejects TILING (Io-patch beside Venus-patch = one/few big segregated blobs).
//   Π  = C · F  — the PINNED interpenetration index. HIGH only when pierce is BOTH
//        broken into many dispersed regions (F, beats tiling) AND those regions are
//        compact discs (C, beats scatter). Only structured nesting scores high.
//
//   M  = the roadmap's named candidate (join-count nearest-neighbour mixing index) is
//        also computed and REPORTED — it is necessary-but-insufficient (resolution-
//        dependent, and cannot tell compound from scatter), which is WHY Π supersedes
//        it. See the brief §"Why not the raw mixing index alone".
//
// SIZE_FLOOR scales with N (a real feature's node-count ∝ N; a random speck does not),
// so the legibility cut is resolution-invariant.
const FLOOR_FRAC = 0.004;                                   // ≥0.4% of the sphere = a legible feature
const sizeFloor = (N) => Math.max(6, Math.round(FLOOR_FRAC * N));   // 6 @1500, 164 @40962

function computeStats(mesh, cls) {
  const { verts, adj, edges, meanEdgeAngle, nodeArea } = mesh;
  const N = verts.length;
  const FLOOR = sizeFloor(N);
  let nA = 0; for (let i = 0; i < N; i++) nA += cls[i];   // pierce count (class 1)
  const nB = N - nA;

  // M — heterotypic-edge fraction vs random-permutation expectation (reported diagnostic)
  let EAB = 0; for (const [i, j] of edges) if (cls[i] !== cls[j]) EAB++;
  const Etot = edges.length;
  const Eexp = Etot * (2 * nA * nB) / (N * (N - 1));
  const M = clamp01(Eexp > 0 ? EAB / Eexp : 0);

  // figure = minority class (ties → pierce=1)
  const minC = nA <= nB ? 1 : 0;
  const nMin = nA <= nB ? nA : nB;
  // union-find over the figure-class nodes
  const parent = new Int32Array(N).fill(-1);
  const find = (x) => { let r = x; while (parent[r] !== r) r = parent[r]; while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; } return r; };
  for (let i = 0; i < N; i++) if (cls[i] === minC) parent[i] = i;
  for (let i = 0; i < N; i++) if (cls[i] === minC) for (const j of adj[i]) if (cls[j] === minC && j > i) { const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; }
  // per-component: size + boundary-node count (figure node with ≥1 non-figure neighbour)
  const size = new Map(), bnd = new Map();
  for (let i = 0; i < N; i++) if (cls[i] === minC) {
    const r = find(i);
    size.set(r, (size.get(r) || 0) + 1);
    let isB = 0; for (const j of adj[i]) if (cls[j] !== minC) { isB = 1; break; }
    if (isB) bnd.set(r, (bnd.get(r) || 0) + 1);
  }
  // effective-compact area per component; C and F derive from it
  const eArr = [];
  let E = 0, compactArea = 0, nComp = 0, nLegible = 0;
  for (const [r, s] of size) {
    nComp++;
    const a_k = s * nodeArea;                              // steradians
    if (s < FLOOR) { continue; }                            // sub-legible speck → e=0
    nLegible++;
    const Ak = a_k;
    const rho = Math.acos(clamp(-1, 1, 1 - Ak / (2 * Math.PI)));   // equal-area disc radius
    const Bdisc = (2 * Math.PI * Math.sin(rho)) / meanEdgeAngle;   // its 1-ring boundary-node count
    const Bk = bnd.get(r) || 1;
    const qk = clamp01(Bdisc / Bk);                        // 1 = round disc, →0 = fractal/ragged
    const e_k = a_k * qk;                                  // effective-compact area
    eArr.push(e_k); E += e_k; compactArea += a_k * qk;
  }
  const totalPierceArea = nMin * nodeArea;
  const C = totalPierceArea > 0 ? compactArea / totalPierceArea : 0;   // fraction of pierce area that is compact
  let herf = 0; if (E > 0) for (const e of eArr) { const w = e / E; herf += w * w; }
  const F = E > 0 ? 1 - herf : 0;                          // fragmentation/dispersion
  const Pi = C * F;
  return { N, nA, pA: nA / N, M, C, F, Pi, nComp, nLegible };
}

// ── SYNTHETIC primitiveId FAMILY FIELDS (seeded) ─────────────────────────────────
// All return Uint8Array cls (1 = pierce, 0 = tent). Report the ACTUAL pierce fraction.

// (a) TILED: hemisphere split refined by Voronoi-patch segregation. Pierce provinces
//     cluster in the north cap (seed.z > zc) with irregular Voronoi walls → one long
//     seam, few heterotypic edges → LOW M.
export function genTiled(mesh, f, seed, nProv = 24) {
  const { verts } = mesh; const N = verts.length;
  const rng = alea('tiled:' + seed + ':' + f);
  const zc = 1 - 2 * f;                         // north-cap fraction ≈ f
  const seeds = []; for (let p = 0; p < nProv; p++) seeds.push(randDir(rng));
  const provPierce = seeds.map((s) => (s[2] > zc ? 1 : 0));
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0, bd = -Infinity;
    for (let p = 0; p < nProv; p++) { const d = dot(verts[i], seeds[p]); if (d > bd) { bd = d; best = p; } }
    cls[i] = provPierce[best];
  }
  return cls;
}

// (b) COMPOUND / INTERPENETRATING: K pierce DISCS dispersed over the sphere, each
//     fully enclosed by tent (background) — "shield discs nested inside corona annuli
//     at the SAME centers". Dispersed enclosure → many compact boundaries → MID M, HIGH C.
export function genCompound(mesh, f, seed, K = 14) {
  const { verts } = mesh; const N = verts.length;
  const rng = alea('compound:' + seed + ':' + f);
  const centers = []; for (let c = 0; c < K; c++) centers.push(randDir(rng));
  const rp = Math.acos(clamp(-1, 1, 1 - 2 * f / K));   // per-disc radius for target areal f
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    for (let c = 0; c < K; c++) { if (angDist(verts[i], centers[c]) < rp) { cls[i] = 1; break; } }
  }
  return cls;
}

// (b') COMPOUND-MIXED: half the pierce budget as dispersed enclosed discs (compound),
//      half as ONE clustered north cap (tiled). Tests that a PARTIALLY-compound world
//      still reads HIGH (the pilot won't be 100% compound).
export function genCompoundMixed(mesh, f, seed, K = 10) {
  const { verts } = mesh; const N = verts.length;
  const rng = alea('mixed:' + seed + ':' + f);
  const centers = []; for (let c = 0; c < K; c++) centers.push(randDir(rng));
  const rp = Math.acos(clamp(-1, 1, 1 - 2 * (f / 2) / K));   // half the budget in discs
  const zc = 1 - 2 * (f / 2);                                 // half the budget in a cap
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (verts[i][2] > zc) { cls[i] = 1; continue; }
    for (let c = 0; c < K; c++) { if (angDist(verts[i], centers[c]) < rp) { cls[i] = 1; break; } }
  }
  return cls;
}

// (c) SCATTER: seeded per-node random assignment (the salt-and-pepper mush trap).
export function genScatter(mesh, f, seed) {
  const { verts } = mesh; const N = verts.length;
  const rng = alea('scatter:' + seed + ':' + f);
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) cls[i] = rng() < f ? 1 : 0;
  return cls;
}

// calibration: ONE pierce disc of areal fraction f — a perfect compact figure; C≈q≈1.
export function genSingleDisc(mesh, f, seed) {
  const { verts } = mesh; const N = verts.length;
  const rng = alea('disc:' + seed + ':' + f);
  const ctr = randDir(rng);
  const rp = Math.acos(clamp(-1, 1, 1 - 2 * f));
  const cls = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (angDist(verts[i], ctr) < rp) cls[i] = 1;
  return cls;
}

// ── DRIVER ───────────────────────────────────────────────────────────────────────
const NS = [1500, 40962];
const FRACS = [0.10, 0.30, 0.50];
const SEEDS = [1, 2, 3, 7, 42];
const fmt = (x, w = 6, d = 3) => x.toFixed(d).padStart(w);

function meanOf(mesh, gen, f, label) {
  let M = 0, C = 0, F = 0, Pi = 0, pA = 0, nCompS = 0;
  for (const s of SEEDS) {
    const st = computeStats(mesh, gen(mesh, f, s));
    M += st.M; C += st.C; F += st.F; Pi += st.Pi; pA += st.pA; nCompS += st.nComp;
  }
  const n = SEEDS.length;
  return { label, f, M: M / n, C: C / n, F: F / n, Pi: Pi / n, pA: pA / n, nComp: nCompS / n };
}

console.log('# GATE-3 INTERPENETRATION STATISTIC — validation table');
console.log('# PINNED statistic:  Pi = C * F   (C = compactness / anti-scatter guard, F = fragmentation / anti-tiling)');
console.log('# M = roadmap-named join-count mixing index, REPORTED as diagnostic only (necessary-but-insufficient).');
console.log('# rows are mean over seeds', JSON.stringify(SEEDS), '\n');

for (const N of NS) {
  const t0 = Date.now();
  const mesh = buildFibSphere(N);
  const meshMs = Math.max(0, Date.now() - t0);
  console.log(`── N=${N}  (edges=${mesh.edges.length}, meanEdgeAngle=${mesh.meanEdgeAngle.toFixed(4)} rad, sizeFloor=${sizeFloor(N)}, mesh build ${meshMs} ms) ──`);
  const disc = computeStats(mesh, genSingleDisc(mesh, 0.10, 1));
  console.log(`   calibration  single round disc(f=0.10): C=${fmt(disc.C)}  F=${fmt(disc.F)}  Pi=${fmt(disc.Pi)}  M=${fmt(disc.M)}   (expect C≈1, F≈0 [one blob], Pi≈0)`);
  console.log('   world                     f(tgt)  f(act)     M       C       F      Pi     nComp');
  for (const f of FRACS) {
    const rows = [
      meanOf(mesh, genTiled, f, 'TILED (segregated)      '),
      meanOf(mesh, genCompound, f, 'COMPOUND (nested discs) '),
      meanOf(mesh, genCompoundMixed, f, 'COMPOUND-MIXED (½ disc) '),
      meanOf(mesh, genScatter, f, 'SCATTER (salt & pepper) '),
    ];
    for (const r of rows) {
      console.log(`   ${r.label}  ${fmt(f, 5, 2)}   ${fmt(r.pA, 5, 3)}  ${fmt(r.M)}  ${fmt(r.C)}  ${fmt(r.F)}  ${fmt(r.Pi)}   ${r.nComp.toFixed(0).padStart(5)}`);
    }
    console.log('');
  }
}

// ── COMPANION GUARD + AC RULE ─────────────────────────────────────────────────────
// PASS iff  Pi ≥ PI_STAR  AND  M ≤ M_MAX.
//   Pi = C·F rejects TILING (F→0) and, at fine meshes, SCATTER (C→0). At COARSE meshes
//   + intermediate pierce fraction, small random clumps are "accidentally compact" and
//   C leaks (up to ~0.5) — so the M gate is the companion guard: scatter is spatial
//   randomness, whose join-count mixing index is pinned at the permutation null (M≈1)
//   at EVERY resolution, while compound never exceeds M≈0.4. The two are orthogonal
//   (M = boundary density; Pi = component geometry) and jointly close every failure.
const PI_STAR = 0.15;     // pass floor on Pi (validated below for pierce-fraction ≤ ~0.4)
const M_MAX = 0.70;       // companion scatter gate: reject if the field is random-mixed
const REALISTIC_FRACS = [0.10, 0.30];   // shields are the MINORITY; f→0.5 is an extreme (reported separately)

console.log('── AC RULE:  PASS iff  Pi ≥', PI_STAR, ' AND  M ≤', M_MAX, ' ──');
const acc = {}; for (const w of ['TILED', 'COMPOUND', 'COMPOUND-MIXED', 'SCATTER']) acc[w] = { pi: [], m: [], pass: 0, tot: 0 };
const gens = { TILED: genTiled, COMPOUND: genCompound, 'COMPOUND-MIXED': genCompoundMixed, SCATTER: genScatter };
for (const N of NS) {
  const mesh = buildFibSphere(N);
  for (const f of REALISTIC_FRACS) for (const s of SEEDS) for (const w of Object.keys(gens)) {
    const st = computeStats(mesh, gens[w](mesh, f, s));
    acc[w].pi.push(st.Pi); acc[w].m.push(st.M); acc[w].tot++;
    if (st.Pi >= PI_STAR && st.M <= M_MAX) acc[w].pass++;
  }
}
const stat = (a) => ({ min: Math.min(...a), max: Math.max(...a), mean: a.reduce((x, y) => x + y, 0) / a.length });
console.log('   (over N∈{1500,40962}, f∈{0.10,0.30}, seeds×5 = 20 worlds each)\n');
console.log('   world            Pi[min  mean  max]     M[min  mean  max]   PASS-rate  verdict');
for (const w of Object.keys(gens)) {
  const p = stat(acc[w].pi), m = stat(acc[w].m);
  const want = (w === 'COMPOUND' || w === 'COMPOUND-MIXED');
  const rate = acc[w].pass / acc[w].tot;
  const ok = want ? (rate === 1) : (rate === 0);
  console.log(`   ${w.padEnd(15)}  ${fmt(p.min)} ${fmt(p.mean)} ${fmt(p.max)}   ${fmt(m.min)} ${fmt(m.mean)} ${fmt(m.max)}   ${(rate * 100).toFixed(0).padStart(4)}%     ${want ? 'want PASS' : 'want FAIL'} ${ok ? 'OK' : '*** MISS ***'}`);
}
// separation margins under the two-part rule
const compAll = [...acc.COMPOUND.pi, ...acc['COMPOUND-MIXED'].pi];
const scatterSlips = acc.SCATTER.pi.filter((pi, i) => pi >= PI_STAR && acc.SCATTER.m[i] <= M_MAX);   // scatter worlds that would wrongly PASS
console.log('\n   compound   Pi worst-case (min):', fmt(Math.min(...compAll)), ' → margin above PI_STAR =', fmt(Math.min(...compAll) - PI_STAR));
console.log('   tiled      Pi worst-case (max):', fmt(Math.max(...acc.TILED.pi)), ' (F→0 kills it regardless of the M gate)');
console.log('   scatter    M worst-case (min):', fmt(Math.min(...acc.SCATTER.m)), ' → margin below M_MAX =', fmt(Math.min(...acc.SCATTER.m) - M_MAX), '(scatter M sits ABOVE the gate → rejected)');
console.log('   scatter worlds that pass BOTH gates (must be 0):', scatterSlips.length);

// f→0.5 extreme, reported separately (margin compresses; AC world should use realistic minority fraction)
console.log('\n── f=0.50 EXTREME (pierce = half; margin compresses — AC compound world should stay minority) ──');
for (const N of NS) {
  const mesh = buildFibSphere(N);
  let cmin = Infinity, smaxM = -Infinity;
  for (const s of SEEDS) { cmin = Math.min(cmin, computeStats(mesh, genCompound(mesh, 0.5, s)).Pi); smaxM = Math.max(smaxM, computeStats(mesh, genScatter(mesh, 0.5, s)).M); }
  console.log(`   N=${N}: compound Pi(min)=${fmt(cmin)}  scatter M(max)=${fmt(smaxM)}`);
}

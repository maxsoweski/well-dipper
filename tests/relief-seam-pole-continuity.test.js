// relief-seam-pole-continuity.test.js — Phase E / AC4 (HEADLESS half: seam + pole + cross-seam drainage).
//
// WHAT THIS PROVES (BUILD-PLAN §E.1): the baked relief DATA field and the drainage routed on it are
// CONTINUOUS across every place a cube seam WOULD fall (the equirect antimeridian; the ±x/±y/±z cube-face
// boundaries) and at BOTH poles — no seam ridge, no pole pinch, drainage crosses seams/caps unbroken.
// This is the critics' FIRST gate (G9): a longitudinally-varying baked height on a sphere has never been
// exercised in this engine, and the split-trap #1 (noise-domain seam, BUILD-PLAN §3) would manifest as a
// height discontinuity exactly along the antimeridian if the writer sampled a lat/long UV instead of the
// 3D direction.
//
// WHY THIS MUST PASS BY CONSTRUCTION: carrier.height[i] is a PURE FUNCTION of verts[i] (Phase A's
// seam-free 3D simplex domain — see worldengine-base-sphere.test.js:63 SEAM CONTINUITY). A pure function
// of a continuous 3D direction has NO seam: there is no longitude wrap, no pole singularity in the domain.
// So the field is Lipschitz-continuous everywhere — its per-edge |Δh|/arc is bounded by one global
// constant. The audit therefore is: measure that GLOBAL Lipschitz constant, then prove the seam regions
// and the pole caps are NO ROUGHER than the field at large. A real seam (the split trap) would make the
// seam-region ratio blow up FAR past the global background; a pole pinch would spike the cap ratio. Both
// are caught.
//
// THRESHOLD PHILOSOPHY — DEFECT-INDEPENDENCE (adversarial-review FIX, B1/B2/B3, 2026-06-25).
// The earlier design self-calibrated the ceiling off `globalMaxRatio` (the MAX over EVERY edge) and off
// `HRANGE` of the SAME field. That is mathematically incapable of failing on a seam/pinch: the seam edge
// is a member of those same populations, so any seam spike raises the baseline in lockstep and the
// "region < baseline × 1.5" assertion is vacuously true. (Verified: injected antimeridian/pole steps at
// 0.05–1.0 PASSED every time under the old relative gate.) A defect cannot be allowed to widen its own
// pass band. The fix has THREE defect-independent teeth, none derived from the population being measured:
//
//   (T1) FROZEN absolute raw-|Δh| ceiling. The seam-free field's raw per-edge height step across the
//        held-out BACKGROUND (edges that are NOT antimeridian / cube-face / cap candidates) maxes at
//        CLEAN_BG_DELTA on the known-clean field. We freeze that as a hard constant (regenerated only
//        deliberately) and require every seam/cap region edge to stay within CLEAN_BG_DELTA × 1.5. A real
//        split-trap #1 seam (a height step localized to the antimeridian straddle edges) pushes the band's
//        raw |Δh| straight past this — and because the constant is FROZEN, the defect cannot inflate it.
//        (Verified: a thin-band antimeridian seam of ≥0.10 trips this; clean field sits at 0.035 ≪ 0.112.)
//   (T2) FROZEN relative Lipschitz ceiling. Same idea on the |Δh|/arc ratio: CLEAN_BG_RATIO (held-out
//        background) × 1.5, frozen. Catches seams whose step is spread over a slightly larger arc.
//   (T3) RECOMPUTED held-out background, as a secondary TIGHTENING gate. We recompute the background
//        Lipschitz ratio EXCLUDING the seam/cap candidate edges, and require the region to be within
//        margin of THAT held-out reference. For a LOCALIZED defect (e.g. a single-node pole pinch) the
//        held-out background is untouched, so this gate fails sharply (verified: pole pinch ≥0.10 fails).
//        It is the per-build self-check; the frozen T1/T2 are the floor that a broad defect cannot evade.
//
// All three are independent of the defect being measured (per review fix (a): "baseline from the rest,
// assert candidates ≤ baseline × margin", combined with frozen clean constants per (b)). Observed clean
// numbers: HRANGE≈0.334, held-out bgRatio≈1.10, held-out bgDelta≈0.074, antimeridian≈0.59/0.035,
// cube-face≈1.07/0.072, caps≈0.6/0.045 — every region sits AT OR BELOW the held-out background.
//
// FROZEN CLEAN-FIELD CONSTANTS — captured from the KNOWN-CLEAN baked field at MACRO_SEED=1234, TARGET_N=
// 3000, LLOYD_ITERS=2 (the build below). Regenerate DELIBERATELY only (print the [AC4 thresholds] line and
// copy the held-out numbers) if the generator's locked constants legitimately change — never auto-derive
// them from the field under test, or a defect re-widens its own pass band. A defect-injection probe
// (scratchpad, 2026-06-25) confirmed these fail thin-band antimeridian seams ≥0.10 and pole pinches ≥0.10
// while the clean field passes with comfortable margin.
const CLEAN_HRANGE   = 0.3340;  // hMax-hMin of the clean field (sanity reference only; NOT a ceiling)
const CLEAN_BG_RATIO = 1.1024;  // held-out background max |Δh|/arc (excludes seam/cap candidate edges)
const CLEAN_BG_DELTA = 0.0744;  // held-out background max raw |Δh| (excludes seam/cap candidate edges)
const CLEAN_ABS_H    = 0.2116;  // max |height| on the clean field (hMax=0.2116, hMin=-0.1224)
const REGION_MARGIN  = 1.5;     // discretization slack for the smaller region populations
//
// Modelled on worldengine-base-sphere.test.js:63-79 (the Lipschitz SEAM CONTINUITY pattern) for parts
// 1-2, and on relief-router-baked-drainage.test.js (the REAL routeAndOrder on the baked carrier) for
// part 3. The carrier build is byte-identical to that D.6(a) setup. Determinism: no Math.random / no
// Date.now; the writers seed off the integer macroSeed only.
import { describe, it, expect } from 'vitest';
import {
  buildIrregularSphere, routeAndOrder, computeOcean, computeAdjGradient,
  DEFAULT_PARAMS, DEFAULT_GRAIN_DRIVERS,
} from '../planet-lod-rivers.js';
import { solveSeaLevel } from '../planet-lod-sealevel.js';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { writeGrainSphere, writeHeightSphere } from '../src/worldengine/base/tectonic.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared build — IDENTICAL to relief-router-baked-drainage.test.js (D.6(a)), so part 3 routes on the
// exact same baked field the renderer/cube consume. TARGET_N=3000 keeps the writers + ConvexHull fast in
// CI while still giving a fine-enough mesh to resolve seam-region pairs and populated pole caps.
const PARAMS = { ...DEFAULT_PARAMS, TARGET_N: 3000, LLOYD_ITERS: 2 };
const MACRO_SEED = 1234;

function hydrateMesh(mesh) {
  const N = mesh.verts.length;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = mesh.verts[i][0];
    pos[i * 3 + 1] = mesh.verts[i][1];
    pos[i * 3 + 2] = mesh.verts[i][2];
  }
  mesh.pos = pos;
  mesh.N = N;
  return mesh;
}

function buildCarrier() {
  const mesh = hydrateMesh(buildIrregularSphere(PARAMS.TARGET_N, PARAMS.LLOYD_ITERS));
  const carrier = makeSphereField(mesh);
  // SAME call order + args as route() under bakedOn: grain BEFORE height; heightSeed off the integer
  // macroSeed only; crust is an inert {} (writeHeightSphere derives its own thickness blob internally).
  writeGrainSphere(carrier, DEFAULT_GRAIN_DRIVERS);
  writeHeightSphere(carrier, {}, DEFAULT_GRAIN_DRIVERS, { name: 'tectonic-build' }, 'e6:' + (MACRO_SEED | 0));
  return { mesh, carrier };
}

// arc (geodesic) distance between two unit directions, via chord → 2·asin(chord/2). Matches the
// Lipschitz pattern in worldengine-base-sphere.test.js:71-72.
function arcOf(di, dj) {
  const chord = Math.hypot(di[0] - dj[0], di[1] - dj[1], di[2] - dj[2]);
  return 2 * Math.asin(Math.min(1, chord / 2));
}

// dominant cube-face axis of a direction (0=±x, 1=±y, 2=±z). A cube-face seam falls exactly where the
// dominant axis (or its sign) flips between two adjacent nodes.
function domAxis(d) {
  const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
  if (ax >= ay && ax >= az) return 0;
  if (ay >= ax && ay >= az) return 1;
  return 2;
}

const { mesh, carrier } = buildCarrier();
const H = carrier.height;

// Height range (drives the scaled absolute ceiling).
let hMin = Infinity, hMax = -Infinity;
for (let i = 0; i < carrier.N; i++) { const v = H[i]; if (v < hMin) hMin = v; if (v > hMax) hMax = v; }
const HRANGE = hMax - hMin;

// Is this directed edge a SEAM/CAP CANDIDATE (the population whose continuity we are auditing)?
// The held-out background is everything that is NOT one of these, so a localized seam/pinch defect
// cannot contaminate the baseline it is measured against (review fix (a)).
function isCandidateEdge(di, dj) {
  const antimeridian = di[0] * dj[0] < 0 && di[2] < 0 && dj[2] < 0;       // straddles x=0 on z<0
  const cubeFace = domAxis(di) !== domAxis(dj);                          // dominant-axis flip
  const capN = di[1] >= 0.92 && dj[1] >= 0.92;                           // both in north cap
  const capS = di[1] <= -0.92 && dj[1] <= -0.92;                         // both in south cap
  return antimeridian || cubeFace || capN || capS;
}

// HELD-OUT BACKGROUND (T3): max Lipschitz ratio + max raw |Δh| over edges that are NOT seam/cap
// candidates. This is the reference population — measured fresh per build, but EXCLUDING the very edges
// the region tests inspect, so a defect on a seam/cap edge does not raise this baseline. Used as the
// secondary tightening gate (sharp on localized pinches); the FROZEN constants below are the floor a
// broad defect cannot evade.
let bgRatio = 0, bgDelta = 0;
for (let i = 0; i < carrier.N; i++) {
  const di = carrier.verts[i];
  for (const j of carrier.adj[i]) {
    const dj = carrier.verts[j];
    if (isCandidateEdge(di, dj)) continue;     // held out
    const arc = arcOf(di, dj);
    const d = Math.abs(H[i] - H[j]);
    if (d > bgDelta) bgDelta = d;
    if (arc > 1e-9) bgRatio = Math.max(bgRatio, d / arc);
  }
}

// FROZEN ceilings (T1/T2) — derived from the CLEAN-FIELD constants only, never from the field under test.
const REGION_RATIO_CEIL = CLEAN_BG_RATIO * REGION_MARGIN;  // ≈ 1.654  (frozen relative Lipschitz ceiling)
const ABS_DELTA_CEIL    = CLEAN_BG_DELTA * REGION_MARGIN;  // ≈ 0.112  (frozen raw-|Δh| ceiling)
// Recomputed held-out margin (T3) — region must also stay within this of the per-build background.
const HELDOUT_RATIO_CEIL = () => bgRatio * REGION_MARGIN;

// eslint-disable-next-line no-console
console.log(
  `[AC4 thresholds] HRANGE=${HRANGE.toFixed(4)} (clean≈${CLEAN_HRANGE}) heldOut bgRatio=${bgRatio.toFixed(4)} ` +
  `bgDelta=${bgDelta.toFixed(4)} | FROZEN REGION_RATIO_CEIL=${REGION_RATIO_CEIL.toFixed(4)} ` +
  `ABS_DELTA_CEIL=${ABS_DELTA_CEIL.toFixed(4)}`
);

describe('Phase E / AC4 (headless) — baked relief + drainage are seam-clean and pole-clean', () => {
  // ── precondition: the field is real, finite, bounded ───────────────────────────────────────────────
  it('the baked carrier.height field is finite + bounded (a sane field to audit)', () => {
    let nan = 0;
    for (let i = 0; i < carrier.N; i++) if (Number.isFinite(H[i]) === false) nan++;
    expect(nan).toBe(0);
    expect(HRANGE).toBeGreaterThan(0); // real relief, not a constant field
    expect(bgRatio).toBeGreaterThan(0);
    // Held-out background must be in family with the frozen clean reference (within REGION_MARGIN both
    // ways). If the generator's locked constants drifted, this trips here FIRST — telling us to
    // regenerate the frozen CLEAN_* constants deliberately, rather than silently widening the gates.
    expect(bgRatio).toBeLessThan(CLEAN_BG_RATIO * REGION_MARGIN);
    expect(bgDelta).toBeLessThan(CLEAN_BG_DELTA * REGION_MARGIN);
    expect(HRANGE).toBeLessThan(CLEAN_HRANGE * REGION_MARGIN);
  });

  // ── (1) SEAM continuity: antimeridian + cube-face boundaries ───────────────────────────────────────
  it('(1a) ANTIMERIDIAN seam (x≈0, z<0): straddling pairs are no rougher than the held-out background', () => {
    let pairs = 0, maxRatio = 0, maxDelta = 0;
    for (let i = 0; i < carrier.N; i++) {
      const di = carrier.verts[i];
      for (const j of carrier.adj[i]) {
        const dj = carrier.verts[j];
        // straddle the antimeridian: x sign flips while both nodes sit on the z<0 hemisphere.
        if (di[0] * dj[0] < 0 && di[2] < 0 && dj[2] < 0) {
          pairs++;
          const arc = arcOf(di, dj);
          const d = Math.abs(H[i] - H[j]);
          if (d > maxDelta) maxDelta = d;
          if (arc > 1e-9) maxRatio = Math.max(maxRatio, d / arc);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[AC4 1a antimeridian] pairs=${pairs} maxDelta=${maxDelta.toFixed(4)} maxRatio=${maxRatio.toFixed(4)}`);
    expect(pairs).toBeGreaterThan(50);              // the filter actually found the seam region
    // T1: frozen raw-|Δh| ceiling — a localized seam step trips this and the frozen constant can't widen.
    expect(maxDelta).toBeLessThan(ABS_DELTA_CEIL);
    // T2: frozen relative Lipschitz ceiling.
    expect(maxRatio).toBeLessThan(REGION_RATIO_CEIL);
    // T3: recomputed held-out background tightening gate.
    expect(maxRatio).toBeLessThan(HELDOUT_RATIO_CEIL());
  });

  it('(1b) CUBE-FACE boundaries (dominant-axis flips): straddling pairs are no rougher than held-out background', () => {
    let pairs = 0, maxRatio = 0, maxDelta = 0;
    for (let i = 0; i < carrier.N; i++) {
      const ai = domAxis(carrier.verts[i]);
      for (const j of carrier.adj[i]) {
        if (domAxis(carrier.verts[j]) - ai !== 0) {
          pairs++;
          const arc = arcOf(carrier.verts[i], carrier.verts[j]);
          const d = Math.abs(H[i] - H[j]);
          if (d > maxDelta) maxDelta = d;
          if (arc > 1e-9) maxRatio = Math.max(maxRatio, d / arc);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[AC4 1b cube-face] pairs=${pairs} maxDelta=${maxDelta.toFixed(4)} maxRatio=${maxRatio.toFixed(4)}`);
    expect(pairs).toBeGreaterThan(200);             // cube-face edges are everywhere; many pairs
    // T1/T2/T3 — same defect-independent battery as 1a (see threshold philosophy header).
    expect(maxDelta).toBeLessThan(ABS_DELTA_CEIL);
    expect(maxRatio).toBeLessThan(REGION_RATIO_CEIL);
    expect(maxRatio).toBeLessThan(HELDOUT_RATIO_CEIL());
  });

  // ── (2) POLE continuity: north + south caps ────────────────────────────────────────────────────────
  function capAudit(sign) {
    const nodes = [];
    let maxAbs = 0, nan = 0;
    for (let i = 0; i < carrier.N; i++) {
      const y = carrier.verts[i][1];
      if (sign > 0 ? y >= 0.92 : y <= -0.92) {
        nodes.push(i);
        if (Number.isFinite(H[i]) === false) nan++;
        maxAbs = Math.max(maxAbs, Math.abs(H[i]));
      }
    }
    const set = new Set(nodes);
    let intraMaxRatio = 0, intraMaxDelta = 0;
    for (const i of nodes) {
      for (const j of carrier.adj[i]) {
        if (set.has(j)) {
          const arc = arcOf(carrier.verts[i], carrier.verts[j]);
          const d = Math.abs(H[i] - H[j]);
          if (d > intraMaxDelta) intraMaxDelta = d;
          if (arc > 1e-9) intraMaxRatio = Math.max(intraMaxRatio, d / arc);
        }
      }
    }
    return { count: nodes.length, nan, maxAbs, intraMaxRatio, intraMaxDelta };
  }

  it('(2a) NORTH cap (y≥0.92): height finite, bounded, smooth (no spike/pinch)', () => {
    const r = capAudit(1);
    // eslint-disable-next-line no-console
    console.log(`[AC4 2a north cap] count=${r.count} nan=${r.nan} maxAbs=${r.maxAbs.toFixed(4)} intraMaxDelta=${r.intraMaxDelta.toFixed(4)} intraMaxRatio=${r.intraMaxRatio.toFixed(4)}`);
    expect(r.count).toBeGreaterThan(20);            // a real populated cap, not 1-2 nodes
    expect(r.nan).toBe(0);                           // finite
    // FROZEN absolute clamp (B3-i fix): the OLD bound max(|hMin|,|hMax|) was vacuous — a pinched cap node
    // sets BOTH the cap maxAbs AND the field hMax, so it could never violate. CLEAN_ABS_H is frozen, so a
    // pinch can't widen it. × margin for legitimate cap relief, but far below a real spike.
    expect(r.maxAbs).toBeLessThan(CLEAN_ABS_H * REGION_MARGIN);
    // T1/T2/T3 — no pinch: raw step + relative Lipschitz, against frozen + held-out references. A
    // localized pole pinch leaves the held-out background untouched, so T3 fails it sharply.
    expect(r.intraMaxDelta).toBeLessThan(ABS_DELTA_CEIL);
    expect(r.intraMaxRatio).toBeLessThan(REGION_RATIO_CEIL);
    expect(r.intraMaxRatio).toBeLessThan(HELDOUT_RATIO_CEIL());
  });

  it('(2b) SOUTH cap (y≤-0.92): height finite, bounded, smooth (no spike/pinch)', () => {
    const r = capAudit(-1);
    // eslint-disable-next-line no-console
    console.log(`[AC4 2b south cap] count=${r.count} nan=${r.nan} maxAbs=${r.maxAbs.toFixed(4)} intraMaxDelta=${r.intraMaxDelta.toFixed(4)} intraMaxRatio=${r.intraMaxRatio.toFixed(4)}`);
    expect(r.count).toBeGreaterThan(20);
    expect(r.nan).toBe(0);
    // FROZEN absolute clamp + T1/T2/T3 — same defect-independent battery as 2a (see 2a comments).
    expect(r.maxAbs).toBeLessThan(CLEAN_ABS_H * REGION_MARGIN);
    expect(r.intraMaxDelta).toBeLessThan(ABS_DELTA_CEIL);
    expect(r.intraMaxRatio).toBeLessThan(REGION_RATIO_CEIL);
    expect(r.intraMaxRatio).toBeLessThan(HELDOUT_RATIO_CEIL());
  });

  // ── (3) CROSS-SEAM DRAINAGE + RAW-FIELD SEAM GATE ────────────────────────────────────────────────────
  // HONEST SCOPE (B3-ii fix): the uphill/orphan==0 part below is a DRAINAGE-VALIDITY check, NOT a seam
  // gate. routeAndOrder runs a priority-flood (planet-lod-rivers.js:~463 priorityFlood) that FILLS pits and
  // routes on the filled surface surf(); a seam barrier on the RAW field gets pit-filled, so drainage
  // still routes validly and uphill/orphan stay 0 by construction on almost any field. So uphill/orphan==0
  // proves the router produces a valid graph on the baked field (an AC3-style property) — it does NOT, by
  // itself, prove the raw field is seam-free. The seam gate in part 3 is the SEPARATE raw-height-step
  // assertion at the end (assert no raw |Δh| across antimeridian straddle edges exceeds the frozen
  // clean held-out bound), which IS defect-independent and DOES fail a split-trap #1 seam.
  it('(3) drainage routes validly across poles + antimeridian (validity), AND raw field is seam-free there (gate)', () => {
    const grad = computeAdjGradient(carrier);
    const height = carrier.height; // the EXACT single source the router routes on (Phase-D re-point).
    const seaLevel = solveSeaLevel(height, PARAMS.TARGET_OCEAN_FRACTION);
    const oc = computeOcean(height, seaLevel, mesh.N);
    const routed = routeAndOrder({ mesh, height, grad, isOcean: oc.isOcean, params: PARAMS });

    // global sanity (mirrors D.6(a) — if these tripped, the field itself is broken, not the seams).
    expect(routed.landCount).toBeGreaterThan(0);
    expect(routed.uphill).toBe(0);
    expect(routed.orphan).toBe(0);

    // Per-node receiver graph for region attribution. receiver[i] = downstream node; ocean cells get
    // receiver[i] = i (self), land that drains gets a downhill neighbour, and a LAND node left as self
    // (receiver[i] === i && !isOcean) is the orphan / would-be-pit the seam/pole break would create.
    // CRITICAL: drainage descends the FILLED surface surf(), not the raw height — the priority-flood
    // fills pits, so a receiver can be raw-higher yet legally downhill on the filled surface. The router's
    // own uphill count (line ~512) uses surf(); we mirror that exactly so part-3 is the SAME legality test,
    // restricted to the seam/cap region. (routed.surf is the filled-surface accessor.)
    const recv = routed.receiver;
    const surf = routed.surf;
    expect(recv, 'routeAndOrder must expose a receiver array for per-region attribution').toBeTruthy();
    expect(typeof surf, 'routeAndOrder must expose a surf() accessor (filled surface) for the uphill test').toBe('function');

    const inRegion = (i) => {
      const d = carrier.verts[i];
      const cap = d[1] >= 0.92 || d[1] <= -0.92;
      // antimeridian band: near the x=0, z<0 great-half-circle.
      const antimeridian = Math.abs(d[0]) < 0.12 && d[2] < 0;
      return cap || antimeridian;
    };

    let regionNodes = 0, regionLand = 0, regionUphill = 0, regionOrphan = 0;
    const EPS = 1e-9; // same slack the router uses on surf() at line ~512
    for (let i = 0; i < mesh.N; i++) {
      if (!inRegion(i)) continue;
      regionNodes++;
      if (oc.isOcean[i]) continue;           // ocean cells are sinks by design, not drainage edges
      regionLand++;
      const r = recv[i];
      if (r === i) {                          // self → orphan land node (a pit the flood couldn't route out)
        regionOrphan++;
        continue;
      }
      // uphill check on the FILLED surface (matches the router's own definition).
      if (surf(r) > surf(i) + EPS) regionUphill++;
    }
    // eslint-disable-next-line no-console
    console.log(`[AC4 3 region drainage] regionNodes=${regionNodes} regionLand=${regionLand} regionUphill=${regionUphill} regionOrphan=${regionOrphan}`);
    expect(regionNodes).toBeGreaterThan(50);  // we actually sampled the cap + antimeridian region
    expect(regionLand).toBeGreaterThan(0);    // some of it is land (drainage exists there)
    // DRAINAGE-VALIDITY (NOT a seam gate — see HONEST SCOPE above): the filled-surface router produces a
    // valid graph in the region. Guaranteed by the priority-flood on almost any field; trips only if the
    // router/field is grossly broken.
    expect(regionUphill).toBe(0);             // no uphill receiver across a seam/pole on the filled surface
    expect(regionOrphan).toBe(0);             // no orphaned land node across a seam/pole

    // ── THE ACTUAL SEAM GATE (B3-ii) — defect-independent, on the RAW height across antimeridian edges ──
    // A split-trap #1 seam shows up as a raw-height STEP across the x=0,z<0 straddle edges. The priority-
    // flood would hide it (it fills the barrier and routes anyway), so we measure the RAW field directly
    // and assert no straddle-edge |Δh| exceeds the FROZEN clean held-out bound. This is the same teeth as
    // part 1a applied to the routed field, kept here so part 3 carries a real seam gate, not just validity.
    let seamPairs = 0, seamRawMax = 0;
    for (let i = 0; i < carrier.N; i++) {
      const di = carrier.verts[i];
      for (const j of carrier.adj[i]) {
        const dj = carrier.verts[j];
        if (di[0] * dj[0] < 0 && di[2] < 0 && dj[2] < 0) { // antimeridian straddle
          seamPairs++;
          seamRawMax = Math.max(seamRawMax, Math.abs(height[i] - height[j]));
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[AC4 3 raw seam gate] seamPairs=${seamPairs} seamRawMax=${seamRawMax.toFixed(4)} ABS_DELTA_CEIL=${ABS_DELTA_CEIL.toFixed(4)}`);
    expect(seamPairs).toBeGreaterThan(50);            // the straddle population exists on the routed field
    expect(seamRawMax).toBeLessThan(ABS_DELTA_CEIL);  // FROZEN bound — a seam step trips this, can't widen it
  });

  // ── determinism ────────────────────────────────────────────────────────────────────────────────────
  it('is deterministic — a re-built carrier yields an identical height field (same samples)', () => {
    const { carrier: again } = buildCarrier();
    expect(Array.from(again.height)).toEqual(Array.from(carrier.height));
  });
});

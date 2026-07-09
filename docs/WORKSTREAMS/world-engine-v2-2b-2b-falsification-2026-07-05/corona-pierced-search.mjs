// corona-pierced-search.mjs — V2-2b-2b SLICE 2 one-shot PIN search (BUILD-PLAN §3).
//
// Runs ONCE at build time to PIN the corona-pierced coordinate/seed; the result is hard-coded into
// tests/worldengine-corona-pierced.test.js and recorded in BUILD-NOTES.md. NOT a CI test (N=1500 × grid is
// slow — targeted single run only). Precedent: the 2b-2a calibration *.mjs in the program dir.
//
// Import set / pattern mirrors tests/worldengine-interpenetration.test.js:17-20.
import { makeSphereField } from '../../../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../../../planet-lod-rivers.js';
import { writeMixedInteriorSphere, MIXED_DEFAULTS } from '../../../src/worldengine/base/mixedInterior.js';
import { interpenetration, PI_STAR, M_MAX } from '../../../src/worldengine/base/interpenetration.js';

const TARGET_N = 1500, LLOYD = 2;
const ID_SHIELD = 1, ID_CALDERA = 2, ID_CORONA = 5;   // PIERCE family {1,2}; corona (TENT) 5

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const e1Of = (L, PHI, n) => ({ compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L, Φ: PHI, n });

// Build the carrier ONCE and reuse (the composer only .set()s height/faultDensity; verts/adj are immutable,
// interpenetration reads primitiveId + {verts,adj}, never height — reuse is byte-safe).
const mesh = buildIrregularSphere(TARGET_N, LLOYD);
const carrier = makeSphereField(mesh);

const buildDiag = (e1, seed) => writeMixedInteriorSphere(carrier, { e1, macroSeed: seed });   // no interpen (cheap)

// nestingCount — SHOULD-5 gate. For each ACTIVE-corona breach center, RECONSTRUCT its footprint arm's-length
// from the published centers + Psi_e + meanEdgeAngle: assert ≥1 shield-core node (id 1/2, ang < Psi_e) AND ≥1
// corona node (id 5) in the annulus (Psi_e ≤ ang ≤ active-support·Rc). Counts centers that nest legibly.
function nestingCount(pid, md) {
  const { centers, Psi_e, breach, coronaActive, meanEdgeAngle, n } = md;
  const Rc = MIXED_DEFAULTS.CORONA_RC_NODES * meanEdgeAngle;
  const verts = carrier.verts, N = carrier.N;
  let count = 0;
  for (let p = 0; p < n; p++) {
    if (!breach[p] || !coronaActive[p]) continue;
    // per-center footprint (cross-resolution nesting fix, mirrors STEP 7): breached centers use
    // max(Rc, BREACH_ANNULUS_SCALE·Psi_e[p]) — at N=1500 the node term dominates (identical to plain Rc)
    const RcP = Math.max(Rc, MIXED_DEFAULTS.BREACH_ANNULUS_SCALE * Psi_e[p]);
    const footprint = MIXED_DEFAULTS.CORONA_SUPPORT_ACTIVE * RcP;
    const ctr = centers[p];
    let hasCore = false, hasCorona = false;
    for (let i = 0; i < N; i++) {
      const ang = Math.acos(Math.max(-1, Math.min(1, dot(verts[i], ctr))));
      if (ang < Psi_e[p]) { if (pid[i] === ID_SHIELD || pid[i] === ID_CALDERA) hasCore = true; }
      else if (ang <= footprint) { if (pid[i] === ID_CORONA) hasCorona = true; }
      if (hasCore && hasCorona) break;
    }
    if (hasCore && hasCorona) count++;
  }
  return count;
}

// ── search grid (BUILD-PLAN §3) ────────────────────────────────────────────────────────────────────────────
const L_GRID = [0.58, 0.59, 0.60, 0.61, 0.62];        // [0.58,0.63) step 0.01 (L<L_STRONG 0.63; ≤0.62 clears slider cap 0.629)
const PHI_GRID = [0.50, 0.52, 0.54, 0.56, 0.58, 0.60, 0.62, 0.64, 0.66, 0.68];   // [0.50,0.68] step 0.02
const N_GRID = [7, 8, 9];
const SEEDS = Array.from({ length: 64 }, (_, i) => i + 1);   // 1..64

const t0 = Date.now();
const accepted = [];
let builds = 0, breach2 = 0;

for (const L of L_GRID) {
  for (const PHI of PHI_GRID) {
    for (const n of N_GRID) {
      const e1 = e1Of(L, PHI, n);
      let localAcc = 0;
      for (const seed of SEEDS) {
        builds++;
        const r = buildDiag(e1, seed);
        const md = r.mixedDiag;
        if (md.breachCount < 2) continue;                 // cheap gate — skip interpen on the majority
        breach2++;
        const ip = interpenetration(carrier, r.primitiveId);   // == injection; reads primitiveId + {verts,adj}
        if (!(ip.legibleByFamily.pierce >= 2 && ip.Pi > 0 && ip.M <= M_MAX)) continue;
        const nest = nestingCount(r.primitiveId, md);
        if (nest < 2) continue;
        localAcc++;
        accepted.push({
          L, Φ: PHI, n, seed,
          PHI_BREACH: MIXED_DEFAULTS.PHI_BREACH, BREACH_LO: MIXED_DEFAULTS.BREACH_LO,
          breachCount: md.breachCount,
          'legibleByFamily.pierce': ip.legibleByFamily.pierce,
          'legibleByFamily.tent': ip.legibleByFamily.tent,
          Π: ip.Pi, M: ip.M, nesting: nest, pierceCount: md.pierceCount,
        });
      }
      if (localAcc > 0) console.log(`  L=${L} Φ=${PHI} n=${n}: ${localAcc} accepted / 64 seeds`);
    }
  }
  console.log(`[progress] L=${L} done — ${accepted.length} accepted so far (${builds} builds, ${breach2} with breachCount≥2), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

console.log(`\n=== SEARCH COMPLETE: ${builds} builds, ${breach2} had breachCount≥2, ${accepted.length} fully accepted, ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);

// PIN-SELECTION (BUILD-PLAN §3): among accepted, require Π ≥ PI_STAR, pick the LARGEST Π margin.
const qualified = accepted.filter((a) => a.Π >= PI_STAR);
console.log(`accepted with Π ≥ PI_STAR (${PI_STAR}): ${qualified.length}`);
if (qualified.length === 0) {
  console.log('\n!!! NO CANDIDATE passes Π ≥ PI_STAR — apply BUILD-PLAN §8 fallbacks (lower BREACH_LO / widen Φ,n / Psi_e floor).');
  // dump the closest-by-Π near-misses (accepted-but-sub-PI_STAR, or breach2 diagnostics) to guide the fallback
  accepted.sort((a, b) => b.Π - a.Π);
  console.log('top accepted-by-Π (all gates but Π<PI_STAR):', JSON.stringify(accepted.slice(0, 10), null, 2));
  process.exit(0);
}
qualified.sort((a, b) => b.Π - a.Π);   // largest Π margin first (PI_STAR is a constant, so max Π == max margin)
const PIN = qualified[0];

// Re-confirm BOTH controls clean (structurally guaranteed: PHI ≤ 0.42 < PHI_BREACH ⇒ breach ≡ 0).
const ctrlCross = buildDiag(e1Of(0.60, 0.42, 6), 2).mixedDiag.breachCount;            // (L0.60,Φ0.42) seed 2
const ctrlTharsis = buildDiag(e1Of(0.551, 0.27, 6), PIN.seed).mixedDiag.breachCount;  // Tharsis, pinned seed

console.log('\n=== PIN (largest Π margin among Π ≥ PI_STAR) ===');
console.log(JSON.stringify(PIN, null, 2));
console.log('\n=== CONTROLS (must both be 0) ===');
console.log(JSON.stringify({
  crossCheck_L0p60_Phi0p42_seed2_breachCount: ctrlCross,
  tharsis_L0p551_Phi0p27_n6_pinnedSeed_breachCount: ctrlTharsis,
  controlsClean: ctrlCross === 0 && ctrlTharsis === 0,
}, null, 2));

console.log('\n=== top 8 qualified (for BUILD-NOTES search record) ===');
console.log(JSON.stringify(qualified.slice(0, 8), null, 2));

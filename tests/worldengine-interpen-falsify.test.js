// tests/worldengine-interpen-falsify.test.js — World Engine V2-2b-2b SLICE 3.
//
// AC-INTERPEN-FALSIFY — THE FALSIFICATION ASSERTION (§5.4 #2 / gate-3 Open-Q6; the claim 2b-2a fenced OUT).
// On the corona-pierced WORLD B (the pinned coordinate/seed, PINNED in SLICE 2 → BUILD-NOTES §SLICE 2) the
// already-built Π=C·F instrument fires: pierce (shield cores) and tent (corona annuli) INTERPENETRATE, they do
// not TILE. Three legs:
//
//   • WORLD B (the AC gate) — legibleByFamily.pierce ≥ 2 asserted FIRST (MF4: F=0 for a single legible
//     component ⇒ Π=0, so the ≥2-shield premise must precede the Π>0 claim), THEN the contract observable
//     VERBATIM: Π > 0 AND M ≤ M_MAX. A SEPARATE, clearly-labelled ADDITIONAL (NON-AC) observation asserts
//     Π ≥ PI_STAR — the gate-3 PASS-margin — guaranteed to hold because SLICE-2 §3 pin-SELECTED on the largest
//     Π ≥ PI_STAR margin. NOTE the AC bar is Π > 0, NOT Π > PI_STAR: PI_STAR = 0.15 (interpenetration.js:31),
//     so tightening the AC to Π > PI_STAR would be a scope change for Max, not a build-plan call.
//   • CROSS-CHECK — the (L0.60, Φ0.42) seed-2 compound (breach-free: Φ 0.42 < PHI_BREACH 0.45) reproduces its
//     2b-2a Π (measure-and-pin: 0.6621875839828004 at HEAD ecad42d; the scope-time "0.63" was the mis-attributed
//     Tharsis {0.551,0.27} value — see BUILD-PLAN §0 pt 3). breachCount === 0 ⇒ the field is byte-identical to
//     2b-2a ⇒ Π reproduces exactly.
//   • NULL control — a hand-tiled SEPARABLE carrier (a shield polar cap beside a plains rest-of-sphere: pierce
//     region HERE, tent region THERE) is TILED, not interpenetrated ⇒ Π < PI_STAR OR M > M_MAX (F→0 for a
//     single segregated blob). The instrument is IMPORTED single-source (never re-declared / copied) — MF2.
//
// The instrument is CONSUMED by injection (import + pass as `interpen`), never imported by a base/ writer — the
// tests/worldengine-interpenetration.test.js:17-20,59-62 idiom. interpenetration.js is UNCHANGED this increment.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { writeMixedInteriorSphere } from '../src/worldengine/base/mixedInterior.js';
// SINGLE-SOURCE the gate constants + the instrument — NEVER re-declare 0.15 / 0.70 (MF2 / instrument integrity).
import { interpenetration, PI_STAR, M_MAX } from '../src/worldengine/base/interpenetration.js';
import { PRIMITIVE_ID, familyOf } from '../src/worldengine/base/lidResponse.js';

const TARGET_N = 1500, LLOYD = 2;
let _mesh = null;
const meshOf = () => (_mesh || (_mesh = buildIrregularSphere(TARGET_N, LLOYD)));
const carrierOf = () => makeSphereField(meshOf());

// build via the composer with the instrument INJECTED (proves the composer stashes Pi/M/legibleByFamily in
// mixedDiag — MF2: it never imports interpenetration; the router/lab/test pass it in by injection).
const buildDiag = (e1, seed) => {
  const c = carrierOf();
  return writeMixedInteriorSphere(c, { e1, rawTidal: 0, macroSeed: seed, interpen: interpenetration }).mixedDiag;
};

// ── PINNED WORLD B — the corona-pierced coordinate/seed (corona-pierced-search.mjs → BUILD-NOTES §SLICE 2).
//    At N=1500: breachCount 3, pierceCount 5, legibleByFamily.pierce 8, Π 0.85352, M 0.35438. ────────────────
const WORLD_B = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.58, Φ: 0.50, n: 9 };
const WORLD_B_SEED = 22;
// ── CROSS-CHECK — the 2b-2a compound (breach-free); Π reproduces the 2b-2a value exactly. ────────────────────
const crossCheckE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.60, Φ: 0.42, n: 6 };
const CROSS_SEED = 2;

describe('V2-2b-2b AC-INTERPEN-FALSIFY — pierce and tent INTERPENETRATE on the corona-pierced world (not tile)', () => {
  // ── instrument integrity: imported single-source, constants never re-declared ───────────────────────────
  it('the Π instrument + gate constants are IMPORTED single-source (never re-declared / copied) — MF2', () => {
    expect(typeof interpenetration, 'interpenetration is the imported function').toBe('function');
    expect(PI_STAR, 'PI_STAR is the single-source gate-3 pass floor (interpenetration.js)').toBe(0.15);
    expect(M_MAX, 'M_MAX is the single-source companion scatter gate (interpenetration.js)').toBe(0.70);
  });

  // ══ WORLD B — THE AC GATE (contract observable, VERBATIM): Π > 0 ∧ M ≤ M_MAX ∧ ≥2 legible pierce ══════════
  it('WORLD B: legibleByFamily.pierce ≥ 2 (MF4, FIRST) → THE AC GATE Π > 0 ∧ M ≤ M_MAX', () => {
    const d = buildDiag(WORLD_B, WORLD_B_SEED);
    // MF4 PRECONDITION — assert FIRST: F = 0 for a single legible component, so the ≥2-legible-shield premise
    // MUST be established before claiming Π > 0.
    expect(d.legibleByFamily.pierce, `world B (L${WORLD_B.L} Φ${WORLD_B.Φ} n${WORLD_B.n} seed${WORLD_B_SEED}): ≥ 2 legible pierce components (MF4)`).toBeGreaterThanOrEqual(2);
    // ── THE AC GATE — the contract observable verbatim ("Π > 0, M≤0.70, ≥2 legible pierce"). NOT Π > PI_STAR:
    //    PI_STAR = 0.15, so Π > PI_STAR ≠ Π > 0; tightening the bar would be a scope change for Max. ──────────
    expect(d.Pi, `world B: Π=${d.Pi} > 0 (pierce and tent interpenetrate)`).toBeGreaterThan(0);
    expect(d.M, `world B: M=${d.M} ≤ M_MAX (${M_MAX}) — not the salt-and-pepper scatter mush`).toBeLessThanOrEqual(M_MAX);
  });

  // ── WORLD B — ADDITIONAL (NON-AC) observation: Π ≥ PI_STAR (the gate-3 PASS-margin). Guaranteed by SLICE-2
  //    §3 pin-selection (largest Π margin among Π ≥ PI_STAR). This is NOT the AC gate — it is a stricter margin
  //    the pinned world happens to clear, recorded so a later retune notices if it ever slips. ────────────────
  it('WORLD B — ADDITIONAL (non-AC) observation: Π ≥ PI_STAR (gate-3 PASS-margin; guaranteed by §3 pin-select)', () => {
    const d = buildDiag(WORLD_B, WORLD_B_SEED);
    expect(d.Pi, `world B: Π=${d.Pi} ≥ PI_STAR (${PI_STAR}) — ADDITIONAL margin, not the AC gate`).toBeGreaterThanOrEqual(PI_STAR);
  });

  // ══ CROSS-CHECK — (L0.60,Φ0.42) seed 2 reproduces its 2b-2a Π exactly (breach-free ⇒ byte-identical field) ══
  it('CROSS-CHECK (L0.60,Φ0.42) seed 2: breachCount === 0 AND Π reproduces the 2b-2a value ≈ 0.66', () => {
    const d = buildDiag(crossCheckE1, CROSS_SEED);
    // Φ 0.42 < PHI_BREACH 0.45 ⇒ breach ≡ 0 ⇒ the primitiveId field is byte-identical to 2b-2a ⇒ Π reproduces.
    expect(d.breachCount, 'cross-check (L0.60,Φ0.42) seed 2: breach ≡ 0 (Φ 0.42 < PHI_BREACH 0.45)').toBe(0);
    // measure-and-pin: 0.6621875839828004 at HEAD ecad42d (BUILD-PLAN §0 pt 3 / §9); toBeCloseTo(0.66, 2)
    // holds (|0.6622 − 0.66| = 0.0022 < 0.005). Do NOT hardcode a stale 0.63 (the mis-attributed Tharsis value).
    expect(d.Pi, `cross-check Π=${d.Pi} reproduces 2b-2a ≈ 0.66`).toBeCloseTo(0.66, 2);
  });

  // ══ NULL — a hand-tiled SEPARABLE carrier (shield polar cap vs plains) is TILED, not interpenetrated ══════
  it('NULL: hand-tiled separable carrier (shield minority polar cap vs plains) → Π < PI_STAR ∨ M > M_MAX (tile)', () => {
    const c = carrierOf();
    const N = c.N;
    const pid = new Int32Array(N);
    // zc puts the shield core in a MINORITY polar cap (z > zc ⇒ ~10% of the sphere, one segregated blob); the
    // rest is stagnant-basaltic-plain (TENT). Pierce HERE, tent THERE = the tiling failure mode the pilot avoids.
    const zc = 0.8;
    let nShield = 0;
    for (let i = 0; i < N; i++) {
      const isCap = c.verts[i][2] > zc;
      pid[i] = isCap ? PRIMITIVE_ID.shield : PRIMITIVE_ID['stagnant-basaltic-plain'];
      if (isCap) nShield++;
    }
    // sanity: the shield cap is a genuine, non-empty MINORITY region (a single tile, not scatter, not majority).
    expect(nShield, `shield cap non-empty (${nShield} nodes)`).toBeGreaterThan(0);
    expect(nShield, `shield cap is the MINORITY (${nShield} < ${N / 2})`).toBeLessThan(N / 2);
    // interpenetration called DIRECTLY on the hand-tiled field (familyOf injected — same instrument, imported).
    const st = interpenetration(c, pid, familyOf);
    // TILED ⇒ one big segregated blob ⇒ F → 0 ⇒ Π → 0 (OR, were it read as scatter, M > M_MAX). Either falsifies
    // the interpenetration claim — this is the NULL the WORLD-B assertion is measured against.
    const isTiled = st.Pi < PI_STAR || st.M > M_MAX;
    expect(isTiled, `null: Π=${st.Pi} M=${st.M} — TILED ⇒ Π < ${PI_STAR} ∨ M > ${M_MAX}`).toBe(true);
  });
});

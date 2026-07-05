// tests/worldengine-interpenetration.test.js — World Engine V2-2b-2a Slice B.
//
// AC-INTERPEN — the Π=C·F interpenetration instrument (gate-3 Open-Q6 → the pilot module). Two legs:
//
//   • LEG 1 (SYNTHETIC REPRODUCTION) — the ported interpenetration() must REPRODUCE the pre-code gate-3
//     arbiter's verdict on its own synthetic worlds: over the 80-world sweep (f∈{0.10,0.30} × N∈{1500,40962}
//     × 5 seeds × 4 classes) fed the generators' binary cls∈{0,1} directly (familyOf is the identity on
//     {0,1}: familyOf(1)=PIERCE, familyOf(0)=TENT — N1), COMPOUND + COMPOUND-MIXED PASS 100 %, TILED +
//     SCATTER PASS 0 %, under the pinned rule PASS ⇔ Π ≥ PI_STAR ∧ M ≤ M_MAX (gate-3-DESIGN §AC-rule sweep).
//
//   • LEG 2 (THARSIS-Π, MF4) — on the pinned COMPOUND coordinate (L 0.60, Φ 0.42) at an explicitly-verified
//     macroSeed, Π is FINITE ALWAYS, and Π > 0 only CONDITIONAL on legibleByFamily.pierce ≥ 2 (asserted
//     FIRST). F = 0 for a single legible component, so a legitimate 1-shield world SHOULD read Π = 0 — the
//     "Π > 0 on Tharsis" property is NOT a guaranteed single-seed fact (gate-3:58 / MF4). No falsification-
//     grade tiling claim here (scope fence — that is 2b-2b's job).
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { writeMixedInteriorSphere } from '../src/worldengine/base/mixedInterior.js';
import { interpenetration, PI_STAR, M_MAX, sizeFloor } from '../src/worldengine/base/interpenetration.js';
// The gate-3 synthetic generators + fib-sphere mesh (behavior-inert `export` added; importing runs the
// arbiter's own validation driver once — a ~2 s deterministic no-op for this suite's purposes).
import {
  buildFibSphere, genTiled, genCompound, genCompoundMixed, genScatter,
} from '../docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-3-interpenetration-validation.mjs';

// ═══ LEG 1 — reproduce gate-3's 100 % / 0 % over the 80-world synthetic sweep ══════════════════════════════
describe('V2-2b-2a AC-INTERPEN leg 1 — interpenetration() reproduces the gate-3 arbiter (COMPOUND 100 %, TILED/SCATTER 0 %)', () => {
  const NS = [1500, 40962];
  const FRACS = [0.10, 0.30];        // pierce is the MINORITY (gate-3 REALISTIC_FRACS; f→0.5 is the extreme)
  const SEEDS = [1, 2, 3, 7, 42];
  const gens = { TILED: genTiled, COMPOUND: genCompound, 'COMPOUND-MIXED': genCompoundMixed, SCATTER: genScatter };

  it('PASS ⇔ Π ≥ PI_STAR ∧ M ≤ M_MAX; COMPOUND/COMPOUND-MIXED 100 % PASS, TILED/SCATTER 0 % PASS (80 worlds)', () => {
    const acc = {}; for (const w of Object.keys(gens)) acc[w] = { pass: 0, tot: 0 };
    for (const N of NS) {
      const mesh = buildFibSphere(N);        // carries edges/meanEdgeAngle/nodeArea → interpenetration reuses them
      for (const f of FRACS) for (const s of SEEDS) for (const w of Object.keys(gens)) {
        const cls = gens[w](mesh, f, s);      // Uint8Array ∈ {0,1} — familyOf is the identity here (N1)
        const st = interpenetration(mesh, cls);
        expect(Number.isFinite(st.Pi), `${w} N=${N} f=${f} seed=${s}: Π finite`).toBe(true);
        expect(Number.isFinite(st.M), `${w} N=${N} f=${f} seed=${s}: M finite`).toBe(true);
        const pass = st.Pi >= PI_STAR && st.M <= M_MAX;
        acc[w].tot++; if (pass) acc[w].pass++;
      }
    }
    // want-PASS classes: every world passes; want-FAIL classes: no world passes.
    expect(acc.COMPOUND.pass, `COMPOUND ${acc.COMPOUND.pass}/${acc.COMPOUND.tot} PASS`).toBe(acc.COMPOUND.tot);
    expect(acc['COMPOUND-MIXED'].pass, `COMPOUND-MIXED ${acc['COMPOUND-MIXED'].pass}/${acc['COMPOUND-MIXED'].tot} PASS`).toBe(acc['COMPOUND-MIXED'].tot);
    expect(acc.TILED.pass, `TILED ${acc.TILED.pass}/${acc.TILED.tot} PASS (F→0 kills tiling)`).toBe(0);
    expect(acc.SCATTER.pass, `SCATTER ${acc.SCATTER.pass}/${acc.SCATTER.tot} PASS (M→1 kills scatter)`).toBe(0);
    // the sweep was the full 80 worlds (2 N × 2 f × 5 seeds × 4 classes = 20 per class).
    for (const w of Object.keys(gens)) expect(acc[w].tot, `${w}: 20 worlds`).toBe(20);
  }, 60000);
});

// ═══ LEG 2 — Tharsis-Π on the pinned compound coordinate; Π finite always, Π>0 conditional on ≥2 shields ════
describe('V2-2b-2a AC-INTERPEN leg 2 — Tharsis-Π (MF4): finite ALWAYS; > 0 CONDITIONAL on legibleByFamily.pierce ≥ 2', () => {
  const TARGET_N = 1500, LLOYD = 2;
  let _mesh = null;
  const meshOf = () => (_mesh || (_mesh = buildIrregularSphere(TARGET_N, LLOYD)));
  const carrierOf = () => makeSphereField(meshOf());
  // The pinned COMPOUND coordinate (GROUNDING §4 companion): reliably ~2 pierce (L slightly higher, Φ higher).
  const compoundE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.60, Φ: 0.42, n: 6 };
  const VERIFIED_SEED = 2;                 // explicitly verified below to yield legibleByFamily.pierce ≥ 2
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42];

  // build via the composer with the instrument INJECTED (proves the composer stashes Pi/M/legibleByFamily in
  // mixedDiag — MF2: it never imports interpenetration, the router/lab/test pass it in by injection).
  const buildDiag = (seed) => {
    const c = carrierOf();
    return writeMixedInteriorSphere(c, { e1: compoundE1, macroSeed: seed, interpen: interpenetration }).mixedDiag;
  };

  it('SIZE_FLOOR is the gate-3 resolution-invariant cut (6 @ N=1500)', () => {
    expect(sizeFloor(1500)).toBe(6);
    expect(sizeFloor(40962)).toBe(164);
  });

  it('the composer STASHES Pi / M / legibleByFamily in mixedDiag when the instrument is injected', () => {
    const d = buildDiag(VERIFIED_SEED);
    expect(typeof d.Pi, 'Pi stashed').toBe('number');
    expect(typeof d.M, 'M stashed').toBe('number');
    expect(d.legibleByFamily, 'legibleByFamily stashed').toBeTruthy();
    expect(typeof d.legibleByFamily.pierce, 'legibleByFamily.pierce').toBe('number');
    expect(typeof d.legibleByFamily.tent, 'legibleByFamily.tent').toBe('number');
  });

  it('Π is FINITE at EVERY seed (never NaN/Infinity — the instrument always returns a number)', () => {
    for (const s of SEEDS) {
      const d = buildDiag(s);
      expect(Number.isFinite(d.Pi), `seed ${s}: Π=${d.Pi} finite`).toBe(true);
      expect(d.Pi, `seed ${s}: Π ≥ 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it('the PINNED verified seed has legibleByFamily.pierce ≥ 2 (assert FIRST) → THEN Π > 0 (MF4)', () => {
    const d = buildDiag(VERIFIED_SEED);
    // MF4 order-of-assertion: the ≥2-legible-shield premise MUST be established before claiming Π > 0.
    expect(d.legibleByFamily.pierce, `verified seed ${VERIFIED_SEED}: ≥ 2 legible pierce components`).toBeGreaterThanOrEqual(2);
    expect(d.Pi, `verified seed ${VERIFIED_SEED}: Π > 0 given ≥ 2 legible shields`).toBeGreaterThan(0);
  });

  it('MF4 biconditional across seeds: Π > 0 ⇔ legibleByFamily.pierce ≥ 2 (a lone legible shield reads Π = 0)', () => {
    for (const s of SEEDS) {
      const d = buildDiag(s);
      if (d.legibleByFamily.pierce >= 2) {
        expect(d.Pi, `seed ${s}: ≥ 2 legible shields ⇒ Π > 0 (pierce=${d.legibleByFamily.pierce})`).toBeGreaterThan(0);
      } else {
        expect(d.Pi, `seed ${s}: < 2 legible shields ⇒ Π = 0 (pierce=${d.legibleByFamily.pierce})`).toBe(0);
      }
    }
  });
});

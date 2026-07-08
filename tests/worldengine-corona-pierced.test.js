// tests/worldengine-corona-pierced.test.js — World Engine V2-2b-2b SLICE 2.
//
// AC-CORONA-PIERCED — the corona-pierced COMPOUND landform (§5.4 #2). The composer grows a compound center
// type: a corona-type (TENT) center whose plume ALSO breaches a concentric SHIELD core (PIERCE) inside its
// corona annulus, at ONE center — while every node still resolves to exactly one primitiveId (AC-MIX-DISCRETE
// preserved; the compound is adjacent shield+corona NODES, never a blended id). Mechanism = the STEP-3b breach
// band (a Φ-gated, strength-driven sub-pierce band on the EXISTING draws — ZERO new alea; PHI_BREACH=0.45 gates
// which worlds are corona-pierce-capable, BREACH_LO=0.75 the band width).
//
// The pinned coordinate/seed was PINNED by the one-shot search (docs/…/corona-pierced-search.mjs, recorded in
// BUILD-NOTES.md §SLICE 2): among all candidates passing breachCount≥2 ∧ legibleByFamily.pierce≥2 ∧ Π>0 ∧
// M≤0.70 ∧ the SHOULD-5 nesting gate, the one with the largest Π margin over PI_STAR. Hard-coded here as
// constants (the tharsisE1 / compoundE1 precedent). All assertions RECONSTRUCT the shield-core→corona-annulus
// walk ARM'S-LENGTH from the PUBLISHED mixedDiag (centers / Psi_e / breach / coronaActive / meanEdgeAngle) +
// the RETURNED primitiveId + carrier.verts — pierceOwner/pierceR/coronaCover are private locals, never read.
import { describe, it, expect } from 'vitest';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { writeMixedInteriorSphere, MIXED_DEFAULTS } from '../src/worldengine/base/mixedInterior.js';

const TARGET_N = 1500, LLOYD = 2;
let _mesh = null;
const meshOf = () => (_mesh || (_mesh = buildIrregularSphere(TARGET_N, LLOYD)));
const carrierOf = () => makeSphereField(meshOf());
const build = (e1, seed) => {
  const c = carrierOf();
  const r = writeMixedInteriorSphere(c, { e1, rawTidal: 0, macroSeed: seed });
  return { c, r, md: r.mixedDiag };
};

// primitiveId enum (test-local copy — the composer emits these; the router owns the exported schema).
const ID_SHIELD = 1, ID_CALDERA = 2, ID_CORONA = 5, ID_TESSERA = 6, ID_RIFT = 7, ID_PLAIN = 8;
const ENUM_IDS = new Set([ID_SHIELD, ID_CALDERA, ID_CORONA, ID_TESSERA, ID_RIFT, ID_PLAIN]);
const isPierceId = (id) => id === ID_SHIELD || id === ID_CALDERA;

// ── PINNED corona-pierced coordinate/seed (corona-pierced-search.mjs → BUILD-NOTES §SLICE 2). At N=1500:
//    breachCount 3, pierceCount 5, legibleByFamily.pierce 8, Π 0.85352, M 0.35438; 2 active-corona breach
//    centers (p=1, p=7) nest a shield core in a pure corona annulus. ────────────────────────────────────────
const PIN = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.58, Φ: 0.50, n: 9 };
const PIN_SEED = 22;
// controls
const tharsisE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.551, Φ: 0.27, n: 6 };
const crossCheckE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.60, Φ: 0.42, n: 6 };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angOf = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v))));

// coronaFootprint — the active-corona support radius (rad), RECONSTRUCTED from the published meanEdgeAngle, so
// the annulus is defined exactly as STEP 7 paints it (Rc = CORONA_RC_NODES·meanEdgeAngle; active support 1.6).
const coronaFootprint = (md) => MIXED_DEFAULTS.CORONA_SUPPORT_ACTIVE * MIXED_DEFAULTS.CORONA_RC_NODES * md.meanEdgeAngle;

// nestOf — for a center p, sort the footprint nodes outward by angular distance and classify:
//   core   = nodes with ang < Psi_e[p]  (pierceR<1 disc)          → want ≥1 PIERCE id (shield/caldera)
//   annulus= nodes with Psi_e[p] ≤ ang ≤ footprint                → want ≥1 corona id
// Returns the walk + booleans; nests ⇔ a PIERCE core AND a corona ring, concentrically (shield radii < corona).
function nestOf(carrier, pid, md, p) {
  const ctr = md.centers[p], Psi = md.Psi_e[p], foot = coronaFootprint(md);
  const shieldAngs = [], coronaAngs = [], walk = [];
  for (let i = 0; i < carrier.N; i++) {
    const ang = angOf(carrier.verts[i], ctr);
    if (ang > foot) continue;
    walk.push({ ang, id: pid[i] });
    if (ang < Psi && isPierceId(pid[i])) shieldAngs.push(ang);
    if (ang >= Psi && pid[i] === ID_CORONA) coronaAngs.push(ang);
  }
  walk.sort((a, b) => a.ang - b.ang);
  const hasCore = shieldAngs.length > 0, hasCorona = coronaAngs.length > 0;
  return { walk, shieldAngs, coronaAngs, hasCore, hasCorona, nests: hasCore && hasCorona };
}

describe('V2-2b-2b AC-CORONA-PIERCED — corona-pierced compound center (shield core nested in a corona annulus)', () => {
  // ── (a-i) presence: ≥2 compound (breach) centers at the pin ────────────────────────────────────────────
  it('breachCount ≥ 2 at the pinned corona-pierced coordinate/seed', () => {
    const { md } = build(PIN, PIN_SEED);
    expect(md.breachCount, `pin (L${PIN.L} Φ${PIN.Φ} n${PIN.n} seed${PIN_SEED}): breachCount=${md.breachCount} ≥ 2`).toBeGreaterThanOrEqual(2);
  });

  // ── (a-ii) ≥2 active-corona breach centers nest a shield core inside a corona annulus (node-legible) ─────
  it('≥2 active-corona breach centers show a PIERCE core inside a corona annulus (reconstructed arm\'s-length)', () => {
    const { c, r, md } = build(PIN, PIN_SEED);
    let nesting = 0;
    for (let p = 0; p < md.n; p++) {
      if (!md.breach[p] || !md.coronaActive[p]) continue;   // active-corona breach centers only (SHOULD-5)
      if (nestOf(c, r.primitiveId, md, p).nests) nesting++;
    }
    expect(nesting, `active-corona breach centers with a node-legible shield-core→corona-annulus: ${nesting} ≥ 2`).toBeGreaterThanOrEqual(2);
  });

  // ── (a-iii) explicit outward node-walk: PIERCE (1/2) at small r → corona (5) in the annulus, concentric ──
  it('outward node-walk from a nesting breach center: shield/caldera at small r → corona (5) in the annulus', () => {
    const { c, r, md } = build(PIN, PIN_SEED);
    // first active-corona breach center that nests (arm's-length; no private center index assumed)
    let target = -1;
    for (let p = 0; p < md.n; p++) {
      if (md.breach[p] && md.coronaActive[p] && nestOf(c, r.primitiveId, md, p).nests) { target = p; break; }
    }
    expect(target, 'a nesting active-corona breach center exists').toBeGreaterThanOrEqual(0);
    const nn = nestOf(c, r.primitiveId, md, target);
    // the innermost footprint node is a shield/caldera (the pierced core sits at the center)
    expect(isPierceId(nn.walk[0].id), `center ${target}: innermost footprint node id=${nn.walk[0].id} is PIERCE (shield/caldera)`).toBe(true);
    // both families present, and concentric: the corona ring sits OUTSIDE the shield core, on average and at its inner edge
    expect(nn.hasCore, `center ${target}: PIERCE core present (r < Psi_e)`).toBe(true);
    expect(nn.hasCorona, `center ${target}: corona annulus present (Psi_e ≤ r ≤ footprint)`).toBe(true);
    const meanShield = nn.shieldAngs.reduce((s, v) => s + v, 0) / nn.shieldAngs.length;
    const meanCorona = nn.coronaAngs.reduce((s, v) => s + v, 0) / nn.coronaAngs.length;
    expect(meanShield, `center ${target}: mean shield radius ${meanShield.toFixed(3)} < mean corona radius ${meanCorona.toFixed(3)} (shield INSIDE corona)`).toBeLessThan(meanCorona);
    expect(Math.min(...nn.coronaAngs), `center ${target}: corona ring inner edge outside the shield core center`).toBeGreaterThan(Math.min(...nn.shieldAngs));
  });

  // ── (b) AC-MIX-DISCRETE preserved: every node maps to exactly one enum id (the compound is adjacent nodes) ─
  it('every node maps to exactly one PRIMITIVE_ID enum value (no blend id) — AC-MIX-DISCRETE preserved', () => {
    const { r } = build(PIN, PIN_SEED);
    expect(r.primitiveId, 'primitiveId is an Int32Array (one integer id per node)').toBeInstanceOf(Int32Array);
    expect(r.primitiveId.length, 'one id per node').toBe(TARGET_N > 0 ? r.primitiveId.length : 0);
    for (let i = 0; i < r.primitiveId.length; i++) {
      expect(ENUM_IDS.has(r.primitiveId[i]), `node ${i}: id ${r.primitiveId[i]} ∈ {1,2,5,6,7,8}`).toBe(true);
    }
  });

  // ── (c) Tharsis control: zero corona-pierced centers (Φ 0.27 < PHI_BREACH — a genuinely NEW landform) ────
  it('Tharsis control (L0.551 Φ0.27 n6) has zero corona-pierced centers — the landform is genuinely new', () => {
    for (const s of [1, 2, 3, 7, 42, PIN_SEED]) {
      const { md } = build(tharsisE1, s);
      expect(md.breachCount, `Tharsis seed ${s}: breachCount === 0 (Φ 0.27 < PHI_BREACH 0.45)`).toBe(0);
    }
  });

  // ── (d) byte-inertness leg: (L0.60 Φ0.42) seed 2 → breachCount === 0 (the cross-check Φ is below the gate) ─
  it('byte-inertness leg: (L0.60 Φ0.42) seed 2 → breachCount === 0 (Φ 0.42 < PHI_BREACH 0.45)', () => {
    const { md } = build(crossCheckE1, 2);
    expect(md.breachCount, 'cross-check (L0.60 Φ0.42) seed 2: breach ≡ 0 ⇒ field byte-identical to 2b-2a').toBe(0);
  });
});

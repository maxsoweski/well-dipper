// tests/worldengine-mixed-composer.test.js — World Engine V2-2b-2a Slice A.
//
// The mixed-interior COMPOSER's unit ACs (the program's first genuinely novel generative primitive):
//   • AC-0            — spine conformance: the composer reads NO preset/label input (grep denylist) and
//                        IMPORTS ONLY alea / simplex-noise / mathutil (never the router's family map, never
//                        the E1 source — no circular import, no e1Regime sweep failure).
//   • AC1             — determinism + first 'lid:' draws: zero Math.random/Date.now, the 'lid:centers:' /
//                        'lid:strength:' / 'lid:yield:' streams present, repeat builds byte-identical
//                        (height + primitiveId + centerId + diag arrays), carrier.regime untouched ∈{0,1,2}.
//   • AC-STRUCTURE    — center-organized, not latitude-banded: |corr(structureMask, squared-Gaussian center
//                        predictor)| >= 0.40 AND > the latitude signal; varExplainedByLatitude < byCenter.
//   • AC-ORDER-MIX    — anti-mush ordering + edifice-budget bound: mean(tessera)>mean(plains)>mean(rift) AND
//                        edifice>plain>basin(:=rift); max edifice contribution above the plains datum <
//                        MIN_FLOOR_GAP (magma edifices bounded); no shield/caldera node on a non-plains base.
//   • AC-MIX-DISCRETE — one primitive per node: every id in the enum; interior heights sit on a single
//                        kernel's datum (well-separated tessera/rift/plains bands, no blend); tessera↔plains
//                        boundaries are a discrete STEP, not a smeared ramp; the Tharsis histogram is a small
//                        discrete populated set.
//
// All headless. Mesh built ONCE (deterministic fibonacci+Lloyd, no Math.random) and wrapped in a fresh
// carrier per build (the writer mutates only height/faultDensity — fresh per makeSphereField).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeSphereField } from '../src/worldengine/base/sphereField.js';
import { buildIrregularSphere } from '../planet-lod-rivers.js';
import { writeMixedInteriorSphere, MIXED_DEFAULTS } from '../src/worldengine/base/mixedInterior.js';

const TARGET_N = 1500, LLOYD = 2;
let _mesh = null;
const meshOf = () => (_mesh || (_mesh = buildIrregularSphere(TARGET_N, LLOYD)));
const carrierOf = () => makeSphereField(meshOf());
const arr = (a) => Array.from(a);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const SEEDS = [1, 2, 3, 7, 42];

// The exact hand-set Tharsis E1 coordinate (BUILD-PLAN §C / GROUNDING §4): strong-ish L, low Φ, low n,
// tidally quiet → classifies 'mixed' via cut #5. + two more MIXED-interior sweep points (all n=6).
const tharsisE1 = { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.551, Φ: 0.27, n: 6 };
const SWEEP = [
  tharsisE1,
  { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.575, Φ: 0.24, n: 6 },   // colder-Tharsis
  { compositionClass: 'rocky', geodynamicRegime: 'dead-lid', m_hp: -0.45, L: 0.60, Φ: 0.42, n: 6 },     // compound
];

// primitiveId enum values (a test-local copy — the composer emits these; the router owns the exported enum).
const ID_SHIELD = 1, ID_CALDERA = 2, ID_CORONA = 5, ID_TESSERA = 6, ID_RIFT = 7, ID_PLAIN = 8;
const ENUM_IDS = [ID_SHIELD, ID_CALDERA, ID_CORONA, ID_TESSERA, ID_RIFT, ID_PLAIN];
const { BASE_TESSERA, BASE_PLAINS, BASE_RIFT, MIN_FLOOR_GAP } = MIXED_DEFAULTS;

const build = (e1, seed, tune = null) => {
  const c = carrierOf();
  const r = writeMixedInteriorSphere(c, { e1, rawTidal: 0, macroSeed: seed, tune });
  return { c, r };
};

// ── arm's-length stats helpers (rebuilt from the PUBLISHED diag only) ─────────────────────────────────────
const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };
function pearson(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const den = Math.sqrt(sxx * syy); return den < 1e-12 ? 0 : sxy / den;
}
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// SQUARED Gaussian center predictor (matches the composer's proximity exactly — Pearson is not invariant
// under the linear form). Rebuilt ONLY from the published centers + beltScale.
function centerPredictor(c, centers, BELT) {
  const N = c.N, verts = c.verts, pred = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0;
    for (let p = 0; p < centers.length; p++) {
      const a = Math.acos(Math.max(-1, Math.min(1, v3dot(verts[i], centers[p]))));
      const g = Math.exp(-(a / BELT) * (a / BELT));
      if (g > best) best = g;
    }
    pred[i] = best;
  }
  return pred;
}
// structure membership: the center-organized landforms (shield/caldera ∪ corona ∪ tessera) as a 0/1 field —
// the causal target of the center field (rift + plains are the between/background). Mirrors the stagnant
// sibling's tessera∪corona-cover mask, plus the pierce shields.
function structureMask(c, primitiveId) {
  const N = c.N, m = new Float64Array(N);
  for (let i = 0; i < N; i++) m[i] = (primitiveId[i] === ID_SHIELD || primitiveId[i] === ID_CALDERA
    || primitiveId[i] === ID_CORONA || primitiveId[i] === ID_TESSERA) ? 1 : 0;
  return m;
}
// sin^2(lat about +y): verts are unit dirs, so y = sin(lat) ⇒ sin^2(lat) = y^2.
function latY(c) {
  const N = c.N, l = new Float64Array(N);
  for (let i = 0; i < N; i++) { const y = Math.max(-1, Math.min(1, c.verts[i][1])); l[i] = y * y; }
  return l;
}
const meanOverIds = (h, primitiveId, ids) => {
  let s = 0, n = 0;
  for (let i = 0; i < h.length; i++) if (ids.includes(primitiveId[i])) { s += h[i]; n++; }
  return { mean: n ? s / n : null, count: n };
};
const isInterior = (adj, id, i) => { const nb = adj[i]; for (let k = 0; k < nb.length; k++) if (id[nb[k]] !== id[i]) return false; return true; };

// ═══ AC-0 — spine conformance (grep denylist + import allowlist) ═══════════════════════════════════════════
describe('V2-2b-2a AC-0 — the composer is preset/label-free + imports ONLY alea/simplex/mathutil', () => {
  const SRC = readSrc('../src/worldengine/base/mixedInterior.js');
  const CODE = stripComments(SRC);

  it('reads NO preset/label input (grep denylist, mirror V2-2a AC-0)', () => {
    expect(CODE, 'no .label read').not.toMatch(/\.label\b/);
    expect(CODE, 'no PRESET_ARCHETYPE read').not.toMatch(/PRESET_ARCHETYPE/);
    expect(CODE, 'no stagnantLidRegimeOf( call').not.toMatch(/stagnantLidRegimeOf/);
    expect(CODE, 'no isVolcanicPath( call').not.toMatch(/isVolcanicPath/);
    expect(CODE, 'no archetype string read').not.toMatch(/archetype/);
  });

  it('imports ONLY alea / simplex-noise / mathutil / stressFabric — NEVER the router family map, e1Regime, or computeE1 (MF2/SF1)', () => {
    const specifiers = [...CODE.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    // V2-4 SP-STRESS-FABRIC: the verbatim-private steeredNoise3 was extracted to the pure leaf module
    // ./stressFabric.js (itself three-free — imports nothing), so the allowlist gains one entry (3 → 4).
    // The three-free SPIRIT holds: no three.js, no router/family map, no E1 source, no circular import.
    expect(specifiers.length, 'exactly four imports (alea/simplex/mathutil/stressFabric)').toBe(4);
    const allowed = new Set(['alea', 'simplex-noise', './mathutil.js', './stressFabric.js']);
    for (const s of specifiers) expect(allowed.has(s), `import '${s}' is on the three-free allowlist`).toBe(true);
    // no circular / no E1-source imports (would break the e1-shadow-audit auto-sweep of base/*.js)
    expect(CODE, 'no familyOf import (circular via lidResponse.js)').not.toMatch(/familyOf/);
    expect(CODE, 'no computeE1 reference').not.toMatch(/computeE1/);
    expect(CODE, 'no e1Regime import').not.toMatch(/from\s+['"][^'"]*e1Regime/);
    expect(CODE, 'no lidResponse import').not.toMatch(/from\s+['"][^'"]*lidResponse/);
  });
});

// ═══ AC1 — determinism + first 'lid:' draws + carrier.regime untouched ═════════════════════════════════════
describe('V2-2b-2a AC1 — determinism + first \'lid:\' draws (zero RNG; byte-identical repeat builds)', () => {
  const CODE = stripComments(readSrc('../src/worldengine/base/mixedInterior.js'));

  it('composer has no Math.random / Date.now and DRAWS the reserved \'lid:\' streams', () => {
    expect(CODE, 'no Math.random').not.toMatch(/Math\.random\s*\(/);
    expect(CODE, 'no Date.now').not.toMatch(/Date\.now\s*\(/);
    expect(CODE, "draws lid:centers:").toMatch(/alea\(\s*['"]lid:centers:/);
    expect(CODE, "draws lid:strength:").toMatch(/alea\(\s*['"]lid:strength:/);
    expect(CODE, "draws lid:yield:").toMatch(/alea\(\s*['"]lid:yield:/);
  });

  it('same (E1, macroSeed) → byte-identical height + primitiveId + centerId + diag arrays, every seed', () => {
    for (const s of SEEDS) {
      const a = build(tharsisE1, s), b = build(tharsisE1, s);
      const tag = `seed ${s}`;
      expect(arr(a.c.height), `${tag}: carrier.height`).toEqual(arr(b.c.height));
      expect(arr(a.r.primitiveId), `${tag}: primitiveId`).toEqual(arr(b.r.primitiveId));
      expect(arr(a.r.centerId), `${tag}: centerId`).toEqual(arr(b.r.centerId));
      expect(arr(a.r.mixedDiag.strength), `${tag}: strength`).toEqual(arr(b.r.mixedDiag.strength));
      expect(arr(a.r.mixedDiag.yield), `${tag}: yield`).toEqual(arr(b.r.mixedDiag.yield));
      expect(arr(a.r.mixedDiag.pierce), `${tag}: pierce`).toEqual(arr(b.r.mixedDiag.pierce));
      expect(arr(a.r.mixedDiag.isAncient), `${tag}: isAncient`).toEqual(arr(b.r.mixedDiag.isAncient));
      expect(arr(a.r.mixedDiag.coronaActive), `${tag}: coronaActive`).toEqual(arr(b.r.mixedDiag.coronaActive));
      expect(a.r.mixedDiag.centers, `${tag}: centers`).toEqual(b.r.mixedDiag.centers);
      expect(a.r.mixedDiag.pierceCount, `${tag}: pierceCount`).toBe(b.r.mixedDiag.pierceCount);
    }
  });

  it('carrier.regime is left UNTOUCHED (all zero, ∈ {0,1,2}) — no 4th regime constant', () => {
    const { c } = build(tharsisE1, 7);
    for (let i = 0; i < c.regime.length; i++) expect(c.regime[i] === 0 || c.regime[i] === 1 || c.regime[i] === 2).toBe(true);
    let anyNonZero = false; for (let i = 0; i < c.regime.length; i++) if (c.regime[i] !== 0) anyNonZero = true;
    expect(anyNonZero, 'carrier.regime never written by the composer').toBe(false);
  });

  it('finite + bounded height, every seed (writes carrier.height = returned U)', () => {
    for (const s of SEEDS) {
      const { c, r } = build(tharsisE1, s);
      expect(arr(c.height), 'carrier.height === returned U').toEqual(arr(r.U));
      let maxAbs = 0, finite = true;
      for (let i = 0; i < c.N; i++) { const v = c.height[i]; if (!Number.isFinite(v)) finite = false; if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v); }
      expect(finite, `seed ${s}: all finite`).toBe(true);
      expect(maxAbs, `seed ${s}: |height| bounded`).toBeLessThan(4);
    }
  });
});

// ═══ AC-STRUCTURE — center-organized, not latitude-banded ══════════════════════════════════════════════════
describe('V2-2b-2a AC-STRUCTURE — center-organized (|corr(structureMask, center predictor)| ≥ 0.40 ≫ latitude)', () => {
  it('|corr| ≥ 0.40 AND > latitude AND varExplainedByLatitude < varExplainedByCenter, every sweep point + seed', () => {
    for (const e1 of SWEEP) {
      for (const s of SEEDS) {
        const { c, r } = build(e1, s);
        const pred = centerPredictor(c, r.mixedDiag.centers, r.mixedDiag.beltScale);
        const mask = structureMask(c, r.primitiveId);
        const lat = latY(c);
        const cCenter = Math.abs(pearson(mask, pred));
        const cLat = Math.abs(pearson(mask, lat));
        const tag = `L=${e1.L} Φ=${e1.Φ} seed=${s}`;
        expect(cCenter, `${tag}: |corr(mask,center)|=${cCenter.toFixed(3)} ≥ 0.40`).toBeGreaterThanOrEqual(0.40);
        expect(cCenter, `${tag}: center signal ≫ latitude (${cCenter.toFixed(3)} > ${cLat.toFixed(3)})`).toBeGreaterThan(cLat);
        expect(cLat * cLat, `${tag}: varExplainedByLatitude < byCenter`).toBeLessThan(cCenter * cCenter);
      }
    }
  });
});

// ═══ AC-ORDER-MIX — anti-mush ordering + NUMERIC edifice-budget bound ══════════════════════════════════════
describe('V2-2b-2a AC-ORDER-MIX — province ordering + edifice-budget bound (magma edifices INCLUDED)', () => {
  it('mean(tessera) > mean(plains) > mean(rift) AND edifice > plain > basin, every sweep point + seed', () => {
    for (const e1 of SWEEP) {
      for (const s of SEEDS) {
        const { c, r } = build(e1, s);
        const h = c.height, id = r.primitiveId;
        const tess = meanOverIds(h, id, [ID_TESSERA]);
        const plain = meanOverIds(h, id, [ID_PLAIN]);
        const rift = meanOverIds(h, id, [ID_RIFT]);
        const edi = meanOverIds(h, id, [ID_SHIELD, ID_CALDERA]);
        const tag = `L=${e1.L} Φ=${e1.Φ} seed=${s}`;
        // plains + rift are always populated; tessera/edifice may be empty → skip that pair only when so (SF2).
        expect(plain.count, `${tag}: plains populated`).toBeGreaterThan(0);
        expect(rift.count, `${tag}: rift populated`).toBeGreaterThan(0);
        expect(plain.mean, `${tag}: mean(plains) > mean(rift)`).toBeGreaterThan(rift.mean);
        if (tess.count > 0) expect(tess.mean, `${tag}: mean(tessera) > mean(plains)`).toBeGreaterThan(plain.mean);
        if (edi.count > 0) {
          expect(edi.mean, `${tag}: edifice > plain`).toBeGreaterThan(plain.mean);
          expect(plain.mean, `${tag}: plain > basin(:=rift)`).toBeGreaterThan(rift.mean);
        }
      }
    }
  });

  it('max edifice contribution above the plains datum < MIN_FLOOR_GAP; every shield/caldera node on the PLAINS base (SF3)', () => {
    let maxContrib = -Infinity, minShieldH = Infinity, maxShieldH = -Infinity, shieldNodes = 0;
    for (const e1 of SWEEP) {
      for (const s of SEEDS) {
        const { c, r } = build(e1, s);
        const h = c.height, id = r.primitiveId;
        for (let i = 0; i < c.N; i++) {
          if (id[i] === ID_SHIELD || id[i] === ID_CALDERA) {
            shieldNodes++;
            const contrib = h[i] - BASE_PLAINS;   // above the plains datum (edifices add ONLY on plains — SF3)
            if (contrib > maxContrib) maxContrib = contrib;
            if (h[i] < minShieldH) minShieldH = h[i];
            if (h[i] > maxShieldH) maxShieldH = h[i];
          }
        }
      }
    }
    expect(shieldNodes, 'the sweep produced shield/caldera nodes to bound').toBeGreaterThan(0);
    // the §2.4 D1-MF1 fix: the positive within-province stack (incl. magma edifices) stays below the gap.
    expect(maxContrib, `max edifice contribution ${maxContrib.toFixed(3)} < MIN_FLOOR_GAP ${MIN_FLOOR_GAP}`).toBeLessThan(MIN_FLOOR_GAP);
    // SF3: the base is PLAINS — every shield sits above the rift datum and below the tessera floor (never a
    // non-plains base). height ∈ [BASE_PLAINS - eps, BASE_PLAINS + MIN_FLOOR_GAP).
    expect(minShieldH, `min shield height ${minShieldH.toFixed(3)} ≥ plains datum (not on rift)`).toBeGreaterThanOrEqual(BASE_PLAINS - 0.05);
    expect(maxShieldH, `max shield height ${maxShieldH.toFixed(3)} < tessera floor (not on tessera)`).toBeLessThan(BASE_PLAINS + MIN_FLOOR_GAP);
  });
});

// ═══ AC-MIX-DISCRETE — one primitive per node; sharp boundaries; discrete histogram ════════════════════════
describe('V2-2b-2a AC-MIX-DISCRETE — every node one primitive; sharp province boundaries (measured ON primitiveId)', () => {
  it('every node maps to exactly one PRIMITIVE_ID enum value (no sentinel/blend id)', () => {
    for (const e1 of SWEEP) {
      for (const s of SEEDS) {
        const { r } = build(e1, s);
        for (let i = 0; i < r.primitiveId.length; i++) {
          expect(ENUM_IDS, `L=${e1.L} seed=${s} node ${i}: id ${r.primitiveId[i]} in the enum`).toContain(r.primitiveId[i]);
        }
      }
    }
  });

  it('interior heights sit on a SINGLE kernel datum (well-separated tessera/rift/plains bands, no blend)', () => {
    // With NO cross-province relax (MF3), an interior node's height is one kernel. The well-separated datum
    // bands prove it: a tessera↔plains BLEND would land near (0.70+0.10)/2 = 0.40 — but interior tessera sits
    // above 0.45 and interior rift below -0.20, so no node is a two-province average.
    for (const e1 of SWEEP) {
      for (const s of SEEDS) {
        const { c, r } = build(e1, s);
        const h = c.height, id = r.primitiveId, adj = c.adj;
        for (let i = 0; i < c.N; i++) {
          if (!isInterior(adj, id, i)) continue;
          const tag = `L=${e1.L} seed=${s} node ${i}`;
          if (id[i] === ID_TESSERA) expect(h[i], `${tag}: interior tessera on its datum`).toBeGreaterThan(0.45);
          else if (id[i] === ID_RIFT) expect(h[i], `${tag}: interior rift on its datum`).toBeLessThan(-0.20);
          else if (id[i] === ID_PLAIN) { expect(h[i]).toBeGreaterThan(-0.15); expect(h[i]).toBeLessThan(0.45); }
        }
      }
    }
  });

  it('tessera↔plains boundaries are a discrete STEP, not a smeared ramp (adjacency on primitiveId)', () => {
    let pairs = 0, minStep = Infinity;
    for (const e1 of SWEEP) {
      for (const s of SEEDS) {
        const { c, r } = build(e1, s);
        const h = c.height, id = r.primitiveId, adj = c.adj;
        for (let i = 0; i < c.N; i++) {
          if (id[i] !== ID_TESSERA) continue;
          for (const m of adj[i]) if (id[m] === ID_PLAIN) { pairs++; const d = Math.abs(h[i] - h[m]); if (d < minStep) minStep = d; }
        }
      }
    }
    expect(pairs, 'tessera↔plains adjacencies exist').toBeGreaterThan(0);
    expect(minStep, `min tessera-plains step ${minStep.toFixed(3)} is a discrete change (> 0.35), not a ramp`).toBeGreaterThan(0.35);
  });

  it('the Tharsis primitiveId histogram is a SMALL discrete populated set (plains-dominant + shield + rift)', () => {
    const { r } = build(tharsisE1, 1);
    const H = {};
    for (const v of r.primitiveId) H[v] = (H[v] || 0) + 1;
    const populated = Object.keys(H).map(Number);
    expect(populated.length, `populated ids ${populated.join(',')} — a small discrete set`).toBeLessThanOrEqual(6);
    expect(H[ID_PLAIN] / r.primitiveId.length, 'preserved plains dominate').toBeGreaterThan(0.5);
    expect(H[ID_SHIELD] || 0, 'pierce shields present (1-3 pierce at Tharsis)').toBeGreaterThan(0);
    expect(H[ID_RIFT] || 0, 'rift corridor present').toBeGreaterThan(0);
  });
});

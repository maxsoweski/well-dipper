// starfieldHonesty.test.js — BN5 of multistar-component-travel-2026-07-21 (AC8).
//
// Two sky fixes, plus the scope pins that keep them from leaking:
//
//   FIX 1 — findVisible self-skip scoping. The self-exclusion in
//   RealStarCatalog.findVisible was a blanket 0.1 pc distance skip
//   (`dist < 0.0001` kpc), but the ENTIRE authored component-separation
//   regime (ceiling ≈ 0.1 pc per intent.md) sits inside that radius —
//   Rigil↔Proxima is 0.0554 pc — so from inside Alpha Centauri the sky
//   rendered NO Proxima and from Proxima NO blazing A+B. The skip shrinks
//   to SELF_SKIP_EPSILON_KPC (1e-6 kpc ≈ 206 AU): safe because every
//   arrival/teleport path lands playerGalacticPos EXACTLY on catalog/
//   registry coords, so "self" is dist = 0.
//
//   FIX 2 — blazing tier. Size buckets used to cap at 12 below appMag −1
//   and the shader clamps color to white ≤ ~appMag 2.5, so a mag −6.9
//   sibling rendered pixel-identical to Sirius-from-Sol (−1.44). A new
//   top tier (BLAZING_SIZE + a wider-halo shader branch) fires ONLY below
//   BLAZING_MAG_THRESHOLD = −3 (working-Claude ruling 2, 2026-07-21) so
//   every star ≥ −3 renders byte-identical to before.
//
//   SCOPE PINS — three same-number-different-job literals must NOT move:
//   HashGridStarfield's 0.0001 near-origin skips (:193/:371 — shrinking
//   them would newly reveal procgen stars in every system's sky),
//   POSITION_MATCH_TOL (identity matching, must stay below
//   KnownSystems.MATCH_RADIUS), and KnownSystems.MATCH_RADIUS itself.
//
// BN4's audit doc (starfield-honesty-audit.md) cites these test names for
// its quantitative claims — keep names stable.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  RealStarCatalog,
  POSITION_MATCH_TOL,
  SELF_SKIP_EPSILON_KPC,
  BLAZING_MAG_THRESHOLD,
  BLAZING_SIZE,
} from '../RealStarCatalog.js';
import { MATCH_RADIUS } from '../KnownSystems.js';
import { HashGridStarfield } from '../HashGridStarfield.js';
import { StarfieldLayer } from '../../rendering/sky/StarfieldLayer.js';
import { realStarSeed } from '../realStarSeed.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = (name) => join(HERE, '../../../public/assets/data', name);
const HYG = JSON.parse(readFileSync(DATA('hyg-stars.json'), 'utf8'));
const SUPPLEMENT = JSON.parse(readFileSync(DATA('real-star-supplement.json'), 'utf8'));
const CONTENTS = JSON.parse(readFileSync(DATA('real-system-contents.json'), 'utf8'));

const SOL = { x: 8.0, y: 0.025, z: 0.0 };

const hygStar = (name) => HYG.find((s) => s.name === name);
const suppStar = (name) => SUPPLEMENT.stars.find((s) => s.name === name);

// Real vantages: exact catalog/registry coords, the way every arrival and
// teleport path sets playerGalacticPos (trace 3).
const RIGIL = hygStar('Rigil Kentaurus');      // A+B shared row (8.000948, 0.024984, −0.000924)
const PROXIMA = suppStar('Proxima Centauri');  // supplement row (8.000902, 0.024956, −0.000937)
const SIRIUS = hygStar('Sirius');

let catalog;
beforeAll(() => {
  catalog = new RealStarCatalog();
  catalog.ingestCatalogData(HYG, SUPPLEMENT, CONTENTS);
});

const skyFrom = (pos, threshold = 6.5) => catalog.findVisible(pos, threshold);
const inSky = (list, name) => list.find((r) => r.name === name);

// ── FIX 1: self-skip scoped to an epsilon — component siblings visible ──────
describe('AC8 fix 1 — findVisible self-skip scoping (component siblings appear)', () => {
  it('from Rigil (A+B), Proxima Centauri is in the sky at appMag ≈ 4.16, size 4', () => {
    const rec = inSky(skyFrom(RIGIL), 'Proxima Centauri');
    expect(rec, 'Proxima missing from the A+B sky (0.0554 pc was inside the old 0.1 pc skip)').toBeDefined();
    expect(rec.appMag).toBeCloseTo(4.157, 2);
    expect(rec.size).toBe(4);
    // Same 0.1 pc F1 bin as Rigil — both marker paths pin seed 1816942132.
    expect(rec.seed).toBe(realStarSeed(PROXIMA.x, PROXIMA.y, PROXIMA.z));
    expect(rec.seed).toBe(1816942132);
  });

  it('from Proxima, the A+B pair (Rigil row) blazes at appMag ≈ −6.90 in the NEW top tier', () => {
    const rec = inSky(skyFrom(PROXIMA), 'Rigil Kentaurus');
    expect(rec, 'A+B missing from the Proxima sky').toBeDefined();
    expect(rec.appMag).toBeCloseTo(-6.903, 2);
    expect(rec.size).toBe(BLAZING_SIZE);
  });

  it('self-exclusion still works: the vantage star is absent from its own sky (dist = 0)', () => {
    expect(inSky(skyFrom(RIGIL), 'Rigil Kentaurus')).toBeUndefined();
    expect(inSky(skyFrom(PROXIMA), 'Proxima Centauri')).toBeUndefined();
  });

  it('epsilon scale: inside 1e-6 kpc is "self", just outside is sky', () => {
    expect(SELF_SKIP_EPSILON_KPC).toBe(1e-6); // ≈ 0.001 pc ≈ 206 AU
    const cat = new RealStarCatalog();
    cat.ingestCatalogData([
      { x: SOL.x + 5e-7, y: SOL.y, z: SOL.z, absMag: 5.0, spect: 'G', lum: 1, name: 'EpsInside' },
      { x: SOL.x + 2e-6, y: SOL.y, z: SOL.z, absMag: 5.0, spect: 'G', lum: 1, name: 'EpsOutside' },
    ]);
    const sky = cat.findVisible(SOL);
    expect(inSky(sky, 'EpsInside'), 'star inside the epsilon must be skipped as self').toBeUndefined();
    expect(inSky(sky, 'EpsOutside'), 'star outside the epsilon must render').toBeDefined();
  });
});

// ── FIX 2: blazing tier — fires ONLY below appMag −3 (ruling 2) ─────────────
describe('AC8 fix 2 — blazing tier (appMag < −3 only)', () => {
  it('threshold is −3 and the blazing size sits strictly above every legacy bucket', () => {
    expect(BLAZING_MAG_THRESHOLD).toBe(-3);
    expect(BLAZING_SIZE).toBeGreaterThan(12); // 12 = legacy top bucket → shader keying unambiguous
  });

  it('appMag −2.9 keeps legacy size 12; appMag −3.1 gets the blazing tier', () => {
    const cat = new RealStarCatalog();
    // Both placed 0.001 kpc (1 pc) from Sol → appMag = absMag − 5.
    cat.ingestCatalogData([
      { x: SOL.x + 0.001, y: SOL.y, z: SOL.z, absMag: 2.1, spect: 'A', lum: 10, name: 'NotBlazing' },  // appMag −2.9
      { x: SOL.x - 0.001, y: SOL.y, z: SOL.z, absMag: 1.9, spect: 'A', lum: 10, name: 'YesBlazing' },  // appMag −3.1
    ]);
    const sky = cat.findVisible(SOL);
    expect(inSky(sky, 'NotBlazing').size).toBe(12);
    expect(inSky(sky, 'YesBlazing').size).toBe(BLAZING_SIZE);
  });

  it('anti-saturation: mag −6.9 (A+B from Proxima) is measurably distinct from mag −1.44 (Sirius from Sol)', () => {
    const blazing = inSky(skyFrom(PROXIMA), 'Rigil Kentaurus');
    const sirius = inSky(skyFrom(SOL), 'Sirius');
    expect(sirius.size).toBe(12);
    expect(blazing.size).toBeGreaterThan(sirius.size);
  });

  it('Sirius-from-Sol output is byte-identical to the pre-BN5 mapping (regression pin)', () => {
    // Mirror of the shipped formulas (RealStarCatalog.findVisible), evaluated
    // in the same order — identical doubles or this fails.
    const dx = SIRIUS.x - SOL.x, dy = SIRIUS.y - SOL.y, dz = SIRIUS.z - SOL.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const d_pc = dist * 1000;
    const appMag = SIRIUS.absMag + 5 * Math.log10(d_pc / 10); // −1.444…
    const brightness = Math.max(0.1, 1.5 - (appMag / 5.0));
    const A_COL = [0.95, 0.95, 1.0]; // SPECTRAL_COLOR.A
    expect(inSky(skyFrom(SOL), 'Sirius')).toEqual({
      worldX: SIRIUS.x,
      worldY: SIRIUS.y,
      worldZ: SIRIUS.z,
      skyX: (dx / dist) * 500,
      skyY: (dy / dist) * 500,
      skyZ: (dz / dist) * 500,
      type: 'A',
      appMag,
      absMag: SIRIUS.absMag,
      seed: realStarSeed(SIRIUS.x, SIRIUS.y, SIRIUS.z),
      name: 'Sirius',
      lum: SIRIUS.lum,
      color: [A_COL[0] * brightness, A_COL[1] * brightness, A_COL[2] * brightness],
      size: 12,
      isRealStar: true,
    });
  });

  it('physical honesty from Sol: Rigil at appMag ≈ −0.01 size 10; Proxima cut at the 6.5 threshold', () => {
    const sky = skyFrom(SOL);
    const rigil = inSky(sky, 'Rigil Kentaurus');
    expect(rigil.appMag).toBeCloseTo(-0.011, 2); // matches real α Cen mag
    expect(rigil.size).toBe(10);
    // Proxima's real appMag from Sol is 11.01 — correctly invisible naked-eye.
    expect(inSky(sky, 'Proxima Centauri')).toBeUndefined();
  });
});

// ── SCOPE PINS — same number, different jobs; BN5 must NOT move these ───────
describe('AC8 scope guards — what the self-skip fix must NOT change', () => {
  it('POSITION_MATCH_TOL stays 0.0001 kpc and below KnownSystems.MATCH_RADIUS', () => {
    expect(POSITION_MATCH_TOL).toBe(0.0001); // identity matching — NOT the self-skip
    expect(MATCH_RADIUS).toBe(0.0005);
    expect(POSITION_MATCH_TOL).toBeLessThan(MATCH_RADIUS); // ordering invariant (Sirius-swallow guard)
  });

  it('HashGridStarfield keeps its 0.1 pc near-origin skip (behavioral pin)', () => {
    // Procgen star positions are deterministic in world space (cell hash), so:
    // generate once, take an emitted star, then stand AT it and NEAR it (0.05 pc
    // — inside 0.0001 kpc but far outside RealStarCatalog's new 1e-6 epsilon).
    // The star must stay hidden BOTH times. If HashGridStarfield's skip were
    // "helpfully" shrunk along with RealStarCatalog's, the near-vantage case
    // would newly reveal it and this test goes red.
    const fakeMap = {
      findNearbyFeatures: () => [],
      potentialDerivedDensity: () => ({ totalDensity: 0.14, halo: 0, bulge: 0 }),
      spiralArmStrength: () => 0,
      nearestArmInfo: () => null,
      starTypeDensityMultiplier: () => 1,
    };
    const base = HashGridStarfield.generate(fakeMap, { x: 8, y: 0, z: 0 }, 500);
    expect(base.realStars.length).toBeGreaterThan(0);
    const s = base.realStars[0].starData;

    const sameWorldStar = (data) => data.realStars.find((e) =>
      e.starData.worldX === s.worldX &&
      e.starData.worldY === s.worldY &&
      e.starData.worldZ === s.worldZ);

    const atStar = HashGridStarfield.generate(fakeMap, { x: s.worldX, y: s.worldY, z: s.worldZ }, 500);
    expect(sameWorldStar(atStar), 'procgen self-skip at dist 0 must hold').toBeUndefined();

    const nearStar = HashGridStarfield.generate(
      fakeMap, { x: s.worldX + 5e-5, y: s.worldY, z: s.worldZ }, 500);
    expect(sameWorldStar(nearStar), 'procgen skip must stay 0.0001 kpc — NOT shrink to the catalog epsilon').toBeUndefined();
  });

  it('HashGridStarfield source still carries both `dist < 0.0001` skips (grep pin)', () => {
    const src = readFileSync(join(HERE, '../HashGridStarfield.js'), 'utf8');
    const hits = src.match(/dist < 0\.0001/g) ?? [];
    expect(hits).toHaveLength(2); // sync pack loop + search iterator
  });
});

// ── StarfieldLayer blazing halo — headless ceiling: shader-source pin ───────
// (GLSL output is judged live via DebugPanel teleport screenshots + Max's UAT;
// headless we pin that the branch exists, keys on BLAZING_SIZE, and that the
// legacy shape math for ordinary stars is untouched.)
describe('StarfieldLayer blazing halo (shader-source pin)', () => {
  const tinyLayer = () => new StarfieldLayer(
    {
      positions: new Float32Array(3),
      colors: new Float32Array(3),
      sizes: new Float32Array(1),
      count: 1,
    },
    500,
    { min: 0.15, max: 0.65 },
  );

  it('fragment shader gains a blazing branch keyed on the BLAZING_SIZE tier', () => {
    const mat = tinyLayer().mesh.material;
    expect(mat.fragmentShader).toContain(`vSize >= ${BLAZING_SIZE.toFixed(1)}`);
  });

  it('ordinary stars keep the exact pre-BN5 shape and size math', () => {
    const mat = tinyLayer().mesh.material;
    // Legacy fragment shape expression, byte-identical:
    expect(mat.fragmentShader).toContain('float shape = coreBright * 0.6 + glow * 0.4;');
    // Legacy vertex size rule, byte-identical (blazing rides it, ×2 like all >5):
    expect(mat.vertexShader).toContain('float baseSize = aSize > 5.0 ? aSize * 2.0 : aSize;');
  });

  it('vSize carries RAW aSize — the invariant the blazing key depends on', () => {
    // The fragment branch fires on vSize >= BLAZING_SIZE (20), which is only
    // a "blazing tier" test because the vertex shader forwards the RAW
    // attribute: `vSize = aSize;`. If a future edit forwarded the doubled
    // baseSize instead, ordinary size-12 stars (baseSize 24 ≥ 20) would
    // silently gain the halo while both pins above stayed green (BN5 verifier
    // finding, 2026-07-21). Same headless-ceiling rationale as the rest of
    // this describe: pin the source, judge the pixels live.
    const mat = tinyLayer().mesh.material;
    expect(mat.vertexShader).toContain('vSize = aSize;');
  });
});

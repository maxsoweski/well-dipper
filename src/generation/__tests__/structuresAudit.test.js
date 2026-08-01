import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { KNOWN_OBJECT_PROFILES } from '../../data/KnownObjectProfiles.js';

/**
 * AC6 structures audit — unit layer (real-universe-overlay-2026-07-12, design
 * D6). Reads the committed reference (structures-reference.json) and asserts the
 * shipped deep-sky objects sit at observed positions and sizes, within the
 * documented tolerances. This is the durable guard behind the audit report:
 * a future position/size regression trips here, not just in the report.
 *
 * Extends the KnownObjects.test.js idiom (imports the same profile catalog).
 * Reference + report authored by scripts/audit-structures.mjs.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WS = join(HERE, '../../../docs/WORKSTREAMS/real-universe-overlay-2026-07-12');
const REF = JSON.parse(readFileSync(join(WS, 'structures-reference.json'), 'utf8'));
const GLOBULARS = JSON.parse(
  readFileSync(join(HERE, '../../../public/assets/data/globular-clusters.json'), 'utf8'),
);

const DEG = Math.PI / 180;
const T = REF._meta.tolerances;

// Published (l,b,d) → game galactocentric position (Sun at 8.0, 0.025, 0). The
// same convention as scripts/process-harris-catalog.mjs and the audit script.
function galacticToGame(l, b, d) {
  const cb = Math.cos(b * DEG), sb = Math.sin(b * DEG);
  const cl = Math.cos(l * DEG), sl = Math.sin(l * DEG);
  return { x: 8.0 - d * cb * cl, y: 0.025 + d * sb, z: d * cb * sl };
}
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('AC6 structures audit — KnownObjectProfiles positions', () => {
  // The AC6 observable: the famous set within documented tolerance, everything
  // else corrected. We assert ALL 37 (stronger than the named famous set).
  it.each(Object.keys(REF.profiles))(
    '%s sits within position tolerance of its published l/b/d',
    (key) => {
      const p = KNOWN_OBJECT_PROFILES[key];
      const ref = REF.profiles[key];
      expect(p, `${key} missing from KnownObjectProfiles`).toBeDefined();
      const recomputed = galacticToGame(ref.l, ref.b, ref.d);
      const err = dist3(recomputed, p.galacticPos);
      const tol = Math.max(T.profilePosKpc, T.profilePosFracOfDistance * ref.d);
      expect(err, `${key} position off by ${err.toFixed(4)} kpc (tol ${tol.toFixed(3)})`)
        .toBeLessThanOrEqual(tol);
    },
  );

  it('the named famous set is present and within tolerance', () => {
    for (const key of ['M42', 'IC434', 'M78', 'NGC104', 'NGC5139', 'M13']) {
      const p = KNOWN_OBJECT_PROFILES[key];
      const ref = REF.profiles[key];
      const err = dist3(galacticToGame(ref.l, ref.b, ref.d), p.galacticPos);
      const tol = Math.max(T.profilePosKpc, T.profilePosFracOfDistance * ref.d);
      expect(err, `${key} out of tolerance`).toBeLessThanOrEqual(tol);
    }
  });

  it('every profile radius is within the factor-2 size tolerance of its reference', () => {
    for (const [key, ref] of Object.entries(REF.profiles)) {
      const storedPc = KNOWN_OBJECT_PROFILES[key].radius * 1000;
      const ratio = storedPc / ref.radiusPc;
      expect(ratio, `${key} size ×${ratio.toFixed(2)} of reference`)
        .toBeGreaterThanOrEqual(1 / T.profileSizeFactor);
      expect(ratio).toBeLessThanOrEqual(T.profileSizeFactor);
    }
  });
});

describe('AC6 structures audit — Harris globular radii + positions', () => {
  it(`ships ${REF.globulars.expectedCount} clusters, each with a per-cluster radius`, () => {
    expect(GLOBULARS).toHaveLength(REF.globulars.expectedCount);
    for (const g of GLOBULARS) {
      expect(typeof g.radiusKpc, `${g.id} missing radiusKpc`).toBe('number');
      expect(g.radiusKpc).toBeGreaterThan(0);
    }
  });

  it('radii are non-uniform (not the old flat 30 pc placeholder)', () => {
    const distinct = new Set(GLOBULARS.map((g) => g.radiusKpc)).size;
    // Was 1 distinct value (all 0.03). Real structural radii → nearly all distinct.
    expect(distinct).toBeGreaterThan(140);
  });

  it('real radii sit inside the physical plausibility band', () => {
    const { min, max } = REF.globulars.physicalRangePc;
    for (const g of GLOBULARS) {
      if (g.radiusMethod === 'placeholder') continue; // 30 pc default is intentional
      const pc = g.radiusKpc * 1000;
      expect(pc, `${g.id} radius ${pc.toFixed(1)} pc out of band`).toBeGreaterThanOrEqual(min);
      expect(pc).toBeLessThanOrEqual(max);
    }
  });

  it('spot-check clusters match hand-computed tidal radii', () => {
    const byId = new Map(GLOBULARS.map((g) => [g.id, g]));
    for (const [id, refPc] of Object.entries(REF.globulars.spotRadiiPc)) {
      const g = byId.get(id);
      expect(g, `${id} not found`).toBeDefined();
      expect(Math.abs(g.radiusKpc * 1000 - refPc), `${id} radius off`)
        .toBeLessThanOrEqual(REF.globulars.spotRadiiTolerancePc);
    }
  });

  it('radius ordering holds (Omega Cen > 47 Tuc > a Palomar dwarf)', () => {
    const byId = new Map(GLOBULARS.map((g) => [g.id, g]));
    const [a, b, c] = REF.globulars.orderingCheck.map((id) => byId.get(id));
    expect(a.radiusKpc).toBeGreaterThan(b.radiusKpc);
    expect(b.radiusKpc).toBeGreaterThan(c.radiusKpc);
  });

  it('every globular position is self-consistent between (l,b,rSun) and shipped xyz', () => {
    for (const g of GLOBULARS) {
      const recomputed = galacticToGame(g.l, g.b, g.rSun);
      const err = dist3(recomputed, { x: g.x, y: g.y, z: g.z });
      const tol = Math.max(T.globularPosKpc, T.globularPosFracOfDistance * g.rSun);
      expect(err, `${g.id} position off by ${err.toFixed(4)} kpc (tol ${tol.toFixed(3)})`)
        .toBeLessThanOrEqual(tol);
    }
  });
});

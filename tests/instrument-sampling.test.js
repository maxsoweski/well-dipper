// tests/instrument-sampling.test.js
// Non-visual analysis channel — AC-SAMPLE (the headless half).
//
// Sample geometry and unit conversion are the parts most likely to be silently wrong, because being
// wrong here does not throw — it just returns confidently mis-scaled numbers, which is precisely the
// failure the whole instrument exists to prevent. So the geometry is pinned without a GPU: directions
// round-trip through lat/lon, patch spacing matches its nominal km span on the sphere, and the two
// reporting frames convert into each other exactly.

import { describe, it, expect } from 'vitest';
import {
  R_EARTH_KM, heightUnitsToKm, kmToHeightUnits, physicalGrid, angularGrid,
  physicalPatchGrid, angularPatchGrid, dirFromLatLon, latLonFromDir,
  equirectDirections, patchDirections, angleBetween,
} from '../src/worldengine/instrument/sampling.js';
import { rowLatDeg, cellSpacingKm, totalAreaKm2 } from '../src/worldengine/instrument/descriptors.js';
import { reliefAmplitudeFromKm } from '../planet-lod-lab-core.js';

describe('unit conversion', () => {
  it('is the exact inverse of the lab core reliefAmplitudeFromKm', () => {
    for (const RE of [0.3, 1, 2.5, 8, 16]) {
      for (const km of [0.5, 2, 9, 22]) {
        expect(heightUnitsToKm(reliefAmplitudeFromKm(km, RE), RE)).toBeCloseTo(km, 9);
      }
    }
  });

  it('round-trips km -> height units -> km', () => {
    expect(heightUnitsToKm(kmToHeightUnits(8.848, 1), 1)).toBeCloseTo(8.848, 12);
  });

  it('reads Earth radius as 6371 km and scales elevation with the body', () => {
    expect(R_EARTH_KM).toBe(6371);
    // The SAME shader height means twice the km on a twice-as-large body — the physical frame in one line.
    expect(heightUnitsToKm(0.001, 2)).toBeCloseTo(2 * heightUnitsToKm(0.001, 1), 9);
  });
});

describe('reporting frames', () => {
  it('physical grid measures in km and scales with the body', () => {
    expect(physicalGrid(64, 32, 2).radiusKm).toBeCloseTo(2 * R_EARTH_KM, 9);
  });

  it('angular grid measures in degrees regardless of body size', () => {
    const g = angularGrid(64, 32);
    // A full equatorial ring is 360 degrees of arc in the angular frame, whatever the planet's radius.
    const circumference = 2 * Math.PI * g.radiusKm;
    expect(circumference).toBeCloseTo(360, 9);
  });

  it('converts a physical patch span into the same window in degrees', () => {
    const RE = 2;
    const phys = physicalPatchGrid(64, 64, 500, 500);
    const ang = angularPatchGrid(64, 64, 500, 500, RE);
    const expectedDeg = (500 / (RE * R_EARTH_KM)) * (180 / Math.PI);
    expect(ang.spanKmX).toBeCloseTo(expectedDeg, 9);
    expect(phys.spanKmX).toBe(500);
  });

  it('makes the frame difference explicit: the same angular form is more km on a bigger body', () => {
    // This is the distinction the display keying trades on. A form of fixed ANGULAR size is a bigger
    // physical form on a bigger planet — so "constant on screen" and "constant in km" cannot both hold.
    const oneDegreeKm = (RE) => (1 * Math.PI / 180) * RE * R_EARTH_KM;
    expect(oneDegreeKm(4)).toBeCloseTo(4 * oneDegreeKm(1), 6);
  });
});

describe('lat/lon and the lab sphere convention', () => {
  it('puts y on the polar axis, matching the shader asin(N.y)', () => {
    expect(dirFromLatLon(90, 0)[1]).toBeCloseTo(1, 12);
    expect(dirFromLatLon(-90, 0)[1]).toBeCloseTo(-1, 12);
    expect(dirFromLatLon(0, 0)).toEqual([expect.closeTo(1, 12), expect.closeTo(0, 12), expect.closeTo(0, 12)]);
  });

  it('round-trips lat/lon through a direction', () => {
    for (const [lat, lon] of [[0, 0], [45, 90], [-30, -120], [12.5, 179], [-67, 33]]) {
      const r = latLonFromDir(dirFromLatLon(lat, lon));
      expect(r.latDeg).toBeCloseTo(lat, 9);
      expect(r.lonDeg).toBeCloseTo(lon, 9);
    }
  });

  it('returns unit-length directions', () => {
    for (const d of equirectDirections(16, 8)) {
      expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 12);
    }
  });
});

describe('equirect sampling grid', () => {
  it('lays samples out row-major with row 0 north, matching the descriptor grid contract', () => {
    const W = 8, H = 4;
    const dirs = equirectDirections(W, H);
    expect(dirs.length).toBe(W * H);
    for (let j = 0; j < H; j++) {
      const lat = latLonFromDir(dirs[j * W]).latDeg;
      expect(lat).toBeCloseTo(rowLatDeg(j, H), 9);      // same row->latitude law the descriptors weight by
    }
    expect(latLonFromDir(dirs[0]).latDeg).toBeGreaterThan(latLonFromDir(dirs[(H - 1) * W]).latDeg);
  });

  it('starts longitude at -180 and steps by a full 360 across the row', () => {
    const W = 8, H = 4;
    const dirs = equirectDirections(W, H);
    expect(latLonFromDir(dirs[0]).lonDeg).toBeCloseTo(-180 + 360 / (2 * W), 9);
    expect(latLonFromDir(dirs[W - 1]).lonDeg).toBeCloseTo(180 - 360 / (2 * W), 9);
  });

  it('covers the sphere: the descriptor grid built from it integrates to 4 pi R^2', () => {
    const g = physicalGrid(64, 32, 1);
    expect(totalAreaKm2(g) / (4 * Math.PI * R_EARTH_KM * R_EARTH_KM)).toBeCloseTo(1, 2);
  });
});

describe('patch sampling grid', () => {
  const base = { latDeg: 20, lonDeg: -45, spanKmX: 400, spanKmY: 400, radiusEarth: 1, width: 32, height: 32 };

  it('centres on the requested lat/lon', () => {
    const dirs = patchDirections(base);
    // With an even sample count the exact centre falls between cells; the four central samples average to it.
    const mid = [15, 16].flatMap((j) => [15, 16].map((i) => dirs[j * base.width + i]));
    const avg = mid.reduce((a, d) => [a[0] + d[0] / 4, a[1] + d[1] / 4, a[2] + d[2] / 4], [0, 0, 0]);
    const l = Math.hypot(...avg);
    const c = latLonFromDir([avg[0] / l, avg[1] / l, avg[2] / l]);
    expect(c.latDeg).toBeCloseTo(base.latDeg, 3);
    expect(c.lonDeg).toBeCloseTo(base.lonDeg, 3);
  });

  it('spaces samples at the nominal km step along both axes', () => {
    const dirs = patchDirections(base);
    const R = base.radiusEarth * R_EARTH_KM;
    const nominalX = base.spanKmX / base.width, nominalY = base.spanKmY / base.height;
    const row = 16;
    const stepX = angleBetween(dirs[row * base.width + 10], dirs[row * base.width + 11]) * R;
    const stepY = angleBetween(dirs[10 * base.width + 16], dirs[11 * base.width + 16]) * R;
    expect(stepX / nominalX).toBeCloseTo(1, 2);
    expect(stepY / nominalY).toBeCloseTo(1, 2);
  });

  it('keeps the km scale honest to the corners (no gnomonic stretch)', () => {
    // A tangent-plane projection would inflate the corner step by ~1/cos^2. Assert the corner spacing
    // sits within 1% of the centre spacing, which is the claim that lets patch wavelengths be quoted
    // in km with no projection caveat.
    const dirs = patchDirections(base);
    const R = base.radiusEarth * R_EARTH_KM;
    const centre = angleBetween(dirs[16 * base.width + 15], dirs[16 * base.width + 16]) * R;
    const corner = angleBetween(dirs[0], dirs[1]) * R;
    expect(Math.abs(corner / centre - 1)).toBeLessThan(0.01);
  });

  it('spans the requested total width across the patch', () => {
    const dirs = patchDirections(base);
    const R = base.radiusEarth * R_EARTH_KM;
    const row = 16;
    const total = angleBetween(dirs[row * base.width], dirs[row * base.width + base.width - 1]) * R;
    expect(total / base.spanKmX).toBeCloseTo((base.width - 1) / base.width, 2);
  });

  it('holds the same km span on a bigger body by covering less angle', () => {
    const small = patchDirections({ ...base, radiusEarth: 1 });
    const big = patchDirections({ ...base, radiusEarth: 4 });
    const angSmall = angleBetween(small[16 * 32], small[16 * 32 + 31]);
    const angBig = angleBetween(big[16 * 32], big[16 * 32 + 31]);
    expect(angBig).toBeCloseTo(angSmall / 4, 4);          // 400 km is a quarter of the arc on a 4x body
  });

  it('survives a polar centre where the east direction degenerates', () => {
    const dirs = patchDirections({ ...base, latDeg: 90 });
    expect(dirs.length).toBe(base.width * base.height);
    for (const d of dirs) expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 9);
  });

  it('places row 0 to the north of the last row', () => {
    const dirs = patchDirections(base);
    expect(latLonFromDir(dirs[16]).latDeg).toBeGreaterThan(latLonFromDir(dirs[31 * 32 + 16]).latDeg);
  });
});

/**
 * starLight — the star's direction in the cockpit's own space.
 *
 * The headline property is the one this lane already paid for once, in the
 * opposite direction: `cockpitEyePose` exists because the ship's HEADING MUST
 * NOT appear in the cockpit camera. Here it MUST. A cabin whose lighting is
 * welded to the hull looks lit, throws nothing, and simply never changes as you
 * fly — which is indistinguishable from "the feature is not built yet" and is
 * exactly what a fixed key light already does today.
 *
 * So the tests are written as PAIRS wherever they can be: a thing that must move
 * and a thing that must not, measured through the same call. A single-sided
 * assertion here would pass against both the right answer and the frame bug.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { starDirInCockpit, starLightColor } from '../starLight.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const IDENT = new THREE.Quaternion();
/** A hull heading, radians about +Y. 0 = nose down −Z, the house convention. */
const heading = (rad) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rad);

/** Where the light lands in the cabin, for a star at `starPos`. */
function lightDir(starPos, shipPos, shipQ, eyeQ = IDENT) {
  return starDirInCockpit(new THREE.Vector3(), starPos, shipPos, shipQ, eyeQ);
}

/** Angle between two directions, degrees — the readable form of the assertion. */
const angleDeg = (a, b) => THREE.MathUtils.radToDeg(a.angleTo(b));

const AHEAD = V(0, 0, -1);

describe('starDirInCockpit', () => {
  it('puts a star dead ahead of the ship dead ahead in the cabin, at EVERY heading', () => {
    // The invariant. Fly any heading with the star straight off the nose and the
    // light must come through the canopy, not the port wall.
    for (const deg of [0, 37, 90, 119, 180, 271, 359]) {
      const q = heading(THREE.MathUtils.degToRad(deg));
      const nose = AHEAD.clone().applyQuaternion(q); // where the nose points
      const star = nose.clone().multiplyScalar(500);
      const got = lightDir(star, V(0, 0, 0), q);
      expect(angleDeg(got, AHEAD), `heading ${deg}° put the star ${angleDeg(got, AHEAD).toFixed(1)}° off the nose`)
        .toBeLessThan(1e-3);
    }
  });

  it('CONTROL: turning the ship AWAY from a fixed star DOES move the light', () => {
    // The pair to the test above, and the one that fails if the heading were
    // dropped "to make the cabin stable". Star fixed in the world; the hull
    // turns 90°; the light must swing 90° across the cabin.
    const star = V(0, 0, -500);
    const straight = lightDir(star, V(0, 0, 0), heading(0));
    const turned = lightDir(star, V(0, 0, 0), heading(Math.PI / 2));
    expect(angleDeg(straight, AHEAD)).toBeLessThan(1e-3);
    expect(angleDeg(turned, straight)).toBeCloseTo(90, 3);
  });

  it('a star off the port bow arrives off the port bow', () => {
    // Sign check. Getting this mirrored lights the wrong wall, and every
    // magnitude assertion above survives a mirror.
    const got = lightDir(V(-500, 0, 0), V(0, 0, 0), heading(0));
    expect(got.x).toBeCloseTo(-1, 6);
    expect(got.y).toBeCloseTo(0, 6);
    expect(got.z).toBeCloseTo(0, 6);
  });

  it('is UNAFFECTED by where the ship is, only by where the star is FROM it', () => {
    // Same relative geometry from two very different places in the system.
    const a = lightDir(V(0, 0, -500), V(0, 0, 0), heading(0));
    const b = lightDir(V(1000, 0, 500), V(1000, 0, 1000), heading(0));
    expect(angleDeg(a, b)).toBeLessThan(1e-3);
  });

  it('honours a seat that does not face −Z, via eyeQuat', () => {
    // Identity in today's GLB. Carried so a re-authored model that seats the
    // pilot sideways does not silently light the back of their head.
    const star = V(0, 0, -500);
    const seatTurned = heading(Math.PI / 2); // the eye faces +X in cabin space
    const got = lightDir(star, V(0, 0, 0), heading(0), seatTurned);
    expect(angleDeg(got, AHEAD)).toBeCloseTo(90, 3);
  });

  it('returns null — not a silent zero — when the ship is ON the star', () => {
    // three normalises a zero vector to (0,0,0) without complaint, and a
    // DirectionalLight whose position equals its target renders an unlit scene
    // with no error anywhere. That has to be the caller's decision, loudly.
    expect(lightDir(V(5, 5, 5), V(5, 5, 5), heading(0))).toBeNull();
  });

  it('writes in place and returns the same vector, so callers can preallocate', () => {
    const out = new THREE.Vector3(9, 9, 9);
    const got = starDirInCockpit(out, V(0, 0, -1), V(0, 0, 0), IDENT, IDENT);
    expect(got).toBe(out);
    expect(out.length()).toBeCloseTo(1, 9);
  });
});

describe('starLightColor', () => {
  it('passes a spectral triple through — an M dwarf is amber, an O star blue-white', () => {
    // The two ends of StarSystemGenerator's own table.
    expect(starLightColor({ color: [1.0, 0.80, 0.44] })).toEqual({ r: 1.0, g: 0.80, b: 0.44 });
    expect(starLightColor({ color: [0.61, 0.69, 1.0] })).toEqual({ r: 0.61, g: 0.69, b: 1.0 });
  });

  it('returns null for anything malformed rather than inventing a default', () => {
    // A default here would be a SECOND place the cabin's key colour is decided,
    // invisible from the rig that already has one on purpose.
    for (const bad of [null, undefined, {}, { color: null }, { color: [1, 2] }, { color: [1, NaN, 1] }]) {
      expect(starLightColor(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

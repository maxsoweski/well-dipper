/**
 * reticleOcclusion — the cabin as an occluder, and the frame change that makes
 * it possible.
 *
 * From Max in UAT 2026-08-01: *"the reticles on the hud that go around
 * worlds/stars in-game are still not being occluded by the monitors/monitor
 * arms, fuselage, or ribs as they should be."*
 *
 * ── WHAT IS ACTUALLY AT RISK HERE ───────────────────────────────────────────
 *
 * Not the raycast. three does that, and a mis-wired raycast fails loudly — every
 * reticle vanishes, or none of them do. The two things that fail QUIETLY are
 * both in this module:
 *
 *   1. THE FRAME CHANGE. World direction → world camera's local frame → cockpit
 *      camera's world frame. Get the conjugate backwards, or apply the two
 *      rotations in the wrong order, and the result is a perfectly well-formed
 *      unit vector pointing somewhere else. Reticles then disappear behind
 *      structure that is not in front of them, which reads as "flickery" rather
 *      than as "wrong", and no error is ever thrown.
 *   2. THE GLASS EXCLUSION. `Canopy_Glass` covers 97.4% of the sphere. Include
 *      it and every reticle in the game hides except through one forward
 *      pinhole — which looks like a rendering bug anywhere but here.
 *
 * The module imports no `three` (it reads x/y/z/w off whatever it is handed), so
 * all of this runs on plain objects with no WebGL context. The Vector3 stand-in
 * below implements only the four methods it calls.
 */

import { describe, it, expect } from 'vitest';
import { collectReticleOccluders, reticleDirInCockpit } from '../reticleOcclusion.js';

/** The three Vector3 methods this module uses, and nothing else. */
class V {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  divideScalar(s) { this.x /= s; this.y /= s; this.z /= s; return this; }
  // Copied from three's Vector3.applyQuaternion — the module is written against
  // that contract, so the stand-in has to honour it exactly.
  applyQuaternion(q) {
    const { x: vx, y: vy, z: vz } = this;
    const { x: qx, y: qy, z: qz, w: qw } = q;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
}

/** A quaternion for a yaw of `deg` about +Y — the axis a head turn uses. */
function yaw(deg) {
  const h = (deg * Math.PI) / 180 / 2;
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
}
/** …and about +X, for pitch. */
function pitch(deg) {
  const h = (deg * Math.PI) / 180 / 2;
  return { x: Math.sin(h), y: 0, z: 0, w: Math.cos(h) };
}

const cam = (q, pos = new V(0, 0, 0)) => ({ quaternion: q, position: pos });
const IDENT = { x: 0, y: 0, z: 0, w: 1 };

describe('reticleDirInCockpit — the frame change', () => {
  it('dead ahead stays dead ahead when both cameras face the same way', () => {
    // The degenerate case, and the one that would make a broken implementation
    // look fine in a screenshot: with no rotation anywhere, the answer is the
    // input. Every other test below is what distinguishes right from "right at
    // the origin".
    const out = new V();
    const d = reticleDirInCockpit(out, new V(0, 0, -10), cam(IDENT), cam(IDENT));
    expect(d).toBe(out);
    expect(d.x).toBeCloseTo(0, 12);
    expect(d.y).toBeCloseTo(0, 12);
    expect(d.z).toBeCloseTo(-1, 12);
  });

  it('⭐ A BODY OFF THE WORLD CAMERA\'S NOSE LANDS OFF THE COCKPIT CAMERA\'S NOSE, by the same angle', () => {
    // THE ASSERTION THE WHOLE MODULE IS FOR. The two cameras are in different
    // frames and always will be — the ship's heading reaches the world camera
    // and deliberately never reaches the cockpit's. What has to survive the trip
    // is the ANGLE OFF THE NOSE, because that is what decides the pixel.
    //
    // World camera yawed 30°, cockpit camera yawed -80°: nothing in common. A
    // body 20° to the left of where the world camera is looking must come out
    // 20° to the left of where the cockpit camera is looking.
    const world = cam(yaw(30));
    const cockpit = cam(yaw(-80));

    // A direction 20° left of the world camera's nose, in WORLD space.
    const worldDir = new V(0, 0, -1).applyQuaternion(yaw(30 + 20));
    const out = new V();
    reticleDirInCockpit(out, worldDir, world, cockpit);

    // …should be 20° left of the cockpit camera's nose, in COCKPIT space.
    const expected = new V(0, 0, -1).applyQuaternion(yaw(-80 + 20));
    expect(out.x).toBeCloseTo(expected.x, 10);
    expect(out.y).toBeCloseTo(expected.y, 10);
    expect(out.z).toBeCloseTo(expected.z, 10);
  });

  it('and the same for pitch, so the conjugate is not accidentally symmetric', () => {
    // Yaw alone can pass with a sign error that a symmetric setup hides. Pitch
    // on a different axis, with an asymmetric pair of angles, cannot.
    const world = cam(pitch(15));
    const cockpit = cam(pitch(-40));
    const worldDir = new V(0, 0, -1).applyQuaternion(pitch(15 - 25));
    const out = new V();
    reticleDirInCockpit(out, worldDir, world, cockpit);

    const expected = new V(0, 0, -1).applyQuaternion(pitch(-40 - 25));
    expect(out.x).toBeCloseTo(expected.x, 10);
    expect(out.y).toBeCloseTo(expected.y, 10);
    expect(out.z).toBeCloseTo(expected.z, 10);
  });

  it('THE CAMERA POSITION IS SUBTRACTED — a distant body is a DIRECTION, not a point', () => {
    // The world camera is not at the origin and the bodies are astronomically
    // far. Reading the target's absolute position as a direction would put every
    // reticle in the game at roughly the same place, which at these distances is
    // "wherever the system happens to be" rather than an obvious failure.
    const world = cam(IDENT, new V(100, 0, 0));
    const out = new V();
    reticleDirInCockpit(out, new V(100, 0, -50), world, cam(IDENT));
    expect(out.x, 'the eye position was not subtracted').toBeCloseTo(0, 12);
    expect(out.z).toBeCloseTo(-1, 12);
  });

  it('refuses a body behind the eye instead of reporting the bulkhead', () => {
    // There is no reticle to occlude behind the pilot, and a behind-the-camera
    // ray hits Bulkhead_Aft every time — so a missing guard here reads as "that
    // body is occluded" for something that was never on screen. The caller
    // treats null as not-occluded.
    const out = new V();
    expect(reticleDirInCockpit(out, new V(0, 0, +10), cam(IDENT), cam(IDENT))).toBeNull();
    // Exactly at the eye, too — no direction exists.
    expect(reticleDirInCockpit(out, new V(0, 0, 0), cam(IDENT), cam(IDENT))).toBeNull();
  });

  it('returns a UNIT direction, since the raycaster is handed it raw', () => {
    // three's Raycaster.set does not normalise. A non-unit direction changes
    // reported intersection DISTANCES, and while this caller only asks whether
    // the list is empty, the next one might not.
    const out = new V();
    reticleDirInCockpit(out, new V(3000, -4000, -12000), cam(yaw(17)), cam(pitch(-9)));
    expect(out.length()).toBeCloseTo(1, 12);
  });

  it('answers null rather than throwing on a frame with no cockpit', () => {
    const out = new V();
    expect(reticleDirInCockpit(out, null, cam(IDENT), cam(IDENT))).toBeNull();
    expect(reticleDirInCockpit(out, new V(0, 0, -1), null, cam(IDENT))).toBeNull();
    expect(reticleDirInCockpit(out, new V(0, 0, -1), cam(IDENT), null)).toBeNull();
    expect(reticleDirInCockpit(null, new V(0, 0, -1), cam(IDENT), cam(IDENT))).toBeNull();
  });
});

// ── The occluder census ─────────────────────────────────────────────────────

/** A minimal scene-graph node with three's traverse contract. */
function node(name, { isMesh = false, material = null, children = [] } = {}) {
  const n = { name, isMesh, material, children };
  n.traverse = (fn) => { fn(n); for (const c of n.children) c.traverse(fn); };
  return n;
}

/** The real cabin's shape: opaque structure, four screens, four arms, glass. */
function fakeCockpit() {
  const glassMat = { name: 'Mat_Glass' };
  const canopy = node('Canopy_Glass', { isMesh: true, material: glassMat });
  return {
    glassMat,
    canopy,
    model: node('Cockpit', {
      children: [
        node('Hull_Tub', { isMesh: true, material: { name: 'Mat_Hull' } }),
        node('Bulkhead_Aft', { isMesh: true, material: { name: 'Mat_Hull' } }),
        node('Rib_Shoulder_L', { isMesh: true, material: { name: 'Mat_Frame' } }),
        node('Screen_UL', { isMesh: true, material: { name: 'Mat_Screen' } }),
        node('Arm_UL_BoomA', { isMesh: true, material: { name: 'Mat_Arm' } }),
        node('Eye_Point'),                       // not a mesh — an empty
        canopy,
      ],
    }),
  };
}

describe('collectReticleOccluders — everything opaque, and only the glass out', () => {
  it('⭐ EXCLUDES THE CANOPY AND KEEPS EVERY PIECE OF STRUCTURE', () => {
    // The canopy is a VAULT covering 97.4% of the sphere. Including it hides
    // every reticle in the game except through one forward aperture —
    // CockpitRig's header records finding exactly that by raycasting a grid.
    const { model, canopy, glassMat } = fakeCockpit();
    const got = collectReticleOccluders(model, { glassNodes: [canopy], glassMats: new Set([glassMat]) })
      .map((m) => m.name);

    expect(got).not.toContain('Canopy_Glass');
    // Named individually rather than by count: Max listed the monitors, the
    // monitor ARMS, the fuselage and the ribs, and a count passes while any one
    // of them is silently missing.
    expect(got, 'the fuselage').toContain('Hull_Tub');
    expect(got, 'a rib').toContain('Rib_Shoulder_L');
    expect(got, 'a monitor').toContain('Screen_UL');
    expect(got, 'a monitor arm').toContain('Arm_UL_BoomA');
    expect(got, 'the aft bulkhead').toContain('Bulkhead_Aft');
    expect(got, 'an empty is not geometry').not.toContain('Eye_Point');
  });

  it('the NAME census alone is enough — the glass treatment can be switched off', () => {
    // `glassMats` is only populated when the rig has a glass treatment applied.
    // With it off the set is EMPTY, and an empty exclusion does not degrade
    // gracefully: it puts the 97%-of-the-sphere canopy straight back in.
    const { model, canopy } = fakeCockpit();
    const got = collectReticleOccluders(model, { glassNodes: [canopy] }).map((m) => m.name);
    expect(got, 'the canopy came back when the glass treatment was off').not.toContain('Canopy_Glass');
    expect(got).toContain('Hull_Tub');
  });

  it('the MATERIAL census alone is enough — a see-through mesh may be named anything', () => {
    // The mirror case: `/glass|canopy/i` is a naming convention, and a pane
    // called something else would be included by name and must still be caught.
    const { model, glassMat } = fakeCockpit();
    const got = collectReticleOccluders(model, { glassMats: new Set([glassMat]) }).map((m) => m.name);
    expect(got).not.toContain('Canopy_Glass');
  });

  it('excludes a whole glass SUBTREE, not just the node named', () => {
    // A glass node is a GROUP in the general case and the panes are its
    // children, so testing the node itself would exclude the parent and keep
    // every pane under it — the worst outcome, since it looks like it worked.
    const pane = node('Pane_03', { isMesh: true, material: { name: 'X' } });
    const group = node('Canopy', { children: [pane] });
    const model = node('Cockpit', { children: [group, node('Rail_L', { isMesh: true })] });
    const got = collectReticleOccluders(model, { glassNodes: [group] }).map((m) => m.name);
    expect(got, 'a pane under the glass group survived').not.toContain('Pane_03');
    expect(got).toEqual(['Rail_L']);
  });

  it('handles a multi-material mesh, where only one slot is glass', () => {
    const glassMat = { name: 'Mat_Glass' };
    const mixed = node('Canopy_Composite', { isMesh: true, material: [{ name: 'Mat_Frame' }, glassMat] });
    const model = node('Cockpit', { children: [mixed] });
    expect(collectReticleOccluders(model, { glassMats: new Set([glassMat]) })).toEqual([]);
  });

  it('answers an empty list rather than throwing when the GLB never loaded', () => {
    // The load-failure path. `_cockpitBlocksReticle` early-outs on an empty
    // list, so this is what makes a failed GLB mean "nothing occludes" instead
    // of a crash in the reticle loop — the same lesson as this morning's
    // retirement gates.
    expect(collectReticleOccluders(null)).toEqual([]);
    expect(collectReticleOccluders(undefined, {})).toEqual([]);
    expect(collectReticleOccluders({})).toEqual([]);
  });
});

/**
 * cabinMask — the one part of the silhouette mask that can be wrong QUIETLY.
 *
 * The rendering half fails loudly: no cut at all, or a screen wiped blank. What
 * fails silently is WHICH MESHES the mask draws, because both ways of getting it
 * wrong look plausible on screen —
 *
 *   too few  → reticles draw straight through the fuselage, which reads as "the
 *              feature isn't on yet";
 *   too many → the canopy leaks in, covers 97.4% of the sphere
 *              (`cockpit-metrics.json` → `enclosure.sphereFraction`) and erases
 *              essentially every reticle, which reads as "a cockpit with
 *              nothing to point at".
 *
 * The design answer is that `cabinMask` HAS NO RULE OF ITS OWN: it is handed the
 * array `collectReticleOccluders` already built (the game passes
 * `_cockpitOccluders`, the same array the raycast oracle casts against) and
 * tags exactly that. These tests pin that property, which is stronger than
 * testing the tagging: a module that cannot decide cannot decide wrongly.
 *
 * No `three` and no WebGL here — `assignMaskLayer` touches nothing but
 * `Object3D.layers`, so a stand-in with `enable` is the whole contract.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assignMaskLayer, CABIN_MASK_LAYER } from '../cabinMask.js';
import { collectReticleOccluders } from '../reticleOcclusion.js';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Comments stripped — a guard in this lane once went green on its own prose. */
const strip = (p) => readFileSync(resolve(HERE, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

/** three's `Layers`, in the two methods that matter here. */
class Layers {
  constructor() { this.mask = 1; }          // layer 0, three's default
  enable(ch) { this.mask |= (1 << ch) >>> 0; }
  test(other) { return (this.mask & other.mask) !== 0; }
}

function mesh(name, material = null) {
  const m = { name, isMesh: true, material, layers: new Layers(), children: [] };
  m.traverse = (fn) => { fn(m); for (const c of m.children) c.traverse(fn); };
  return m;
}

function group(name, children) {
  const g = { name, isMesh: false, material: null, layers: new Layers(), children };
  g.traverse = (fn) => { fn(g); for (const c of g.children) c.traverse(fn); };
  return g;
}

describe('assignMaskLayer — the census decides, the mask obeys', () => {
  it('⭐ THE TAGGED SET IS EXACTLY collectReticleOccluders\' OUTPUT, glass and all', () => {
    // THE ASSERTION THIS FILE EXISTS FOR. The mask is fed the census's result
    // and nothing else, so "which bits are see-through" is answered in one
    // place. If this ever needs changing because the mask grew its own opinion,
    // that is the regression — not the failing line.
    const glassMat = { name: 'Mat_Glass' };
    const canopy = mesh('Canopy_Glass', glassMat);
    const hull = mesh('Hull_Tub', { name: 'Mat_Hull' });
    const rib = mesh('Rib_Shoulder_L', { name: 'Mat_Frame' });
    const arm = mesh('Arm_UL_BoomA', { name: 'Mat_Arm' });
    const eye = group('Eye_Point', []);
    const model = group('Cockpit', [hull, rib, arm, eye, canopy]);

    const occluders = collectReticleOccluders(model, {
      glassNodes: [canopy],
      glassMats: new Set([glassMat]),
    });
    const tagged = assignMaskLayer(occluders, CABIN_MASK_LAYER);

    expect(tagged).toBe(occluders.length);
    const bit = new Layers();
    bit.mask = (1 << CABIN_MASK_LAYER) >>> 0;
    for (const m of [hull, rib, arm]) {
      expect(m.layers.test(bit), `${m.name} is not on the mask layer`).toBe(true);
    }
    expect(canopy.layers.test(bit), 'THE CANOPY LEAKED INTO THE ERASE MASK').toBe(false);
    expect(eye.layers.test(bit), 'an empty is not geometry').toBe(false);
  });

  it('has no glass rule of its own — it tags whatever list it is given', () => {
    // Stated as a property rather than a comment: hand it a mesh the census
    // would have EXCLUDED and it tags that too. A function with an opinion
    // would refuse, and that opinion is the thing that could drift away from
    // the raycast oracle's.
    const canopy = mesh('Canopy_Glass', { name: 'Mat_Glass' });
    expect(assignMaskLayer([canopy])).toBe(1);
    const bit = new Layers();
    bit.mask = (1 << CABIN_MASK_LAYER) >>> 0;
    expect(canopy.layers.test(bit)).toBe(true);
  });

  it('ENABLES the bit, never SETS it — the cabin must still render itself', () => {
    // `layers.set` would take these meshes off layer 0, and layer 0 is what the
    // cockpit pass draws. The pilot's cabin would disappear and only its
    // silhouette-in-the-erase-mask would remain: reticles cut by a cockpit that
    // is no longer there.
    const hull = mesh('Hull_Tub', null);
    assignMaskLayer([hull]);
    const layer0 = new Layers();
    expect(hull.layers.test(layer0), 'the mesh was taken off the default layer').toBe(true);
  });

  it('is idempotent, so a rig that reloads its model needs no special case', () => {
    const hull = mesh('Hull_Tub', null);
    assignMaskLayer([hull]);
    const once = hull.layers.mask;
    assignMaskLayer([hull]);
    expect(hull.layers.mask).toBe(once);
  });

  it('answers 0 rather than throwing when the GLB never loaded', () => {
    // The degrade path — `collectReticleOccluders` returns [] for a failed load,
    // and this is what makes that mean "nothing to tag" instead of a crash
    // during boot.
    expect(assignMaskLayer([])).toBe(0);
    expect(assignMaskLayer(null)).toBe(0);
    expect(assignMaskLayer(undefined)).toBe(0);
    // A node with no `layers` at all (a plain fixture, a stripped export) is
    // skipped rather than fatal.
    expect(assignMaskLayer([{ name: 'no_layers' }])).toBe(0);
  });

  it('the mask layer is not layer 0 — a camera restricted to it must exclude the world', () => {
    // The mask camera does `layers.set(CABIN_MASK_LAYER)`. If that were 0 the
    // camera would render EVERYTHING in the cockpit scene, canopy included, and
    // the erase would blank the whole view. Pinned as a number so a careless
    // edit to the constant is a red test rather than a black screen.
    expect(CABIN_MASK_LAYER).toBeGreaterThan(0);
    expect(CABIN_MASK_LAYER).toBeLessThan(32);
  });
});

describe('the bridge to the 2D overlay costs no readback', () => {
  const MASK = strip('../cabinMask.js');
  const RETICLE = strip('../../ui/TargetingReticle.js');

  it('⭐ NO GPU SYNC ON THE PER-FRAME PATH', () => {
    // AC-NO-READBACK-NO-FRAME-COST, as a static scan. The whole reason this is
    // a second WebGL canvas rather than `RetroRenderer`'s `cockpitTarget` is
    // that `drawImage` from a WebGL-backed canvas is a compositor-side copy —
    // the pixels never enter JS. One `readPixels` on the frame path would undo
    // the entire design and cost a stall beside a ~235 Hz world, and it would
    // do so invisibly: the picture would be identical.
    expect(MASK, 'a readback crept onto the render path')
      .not.toMatch(/readRenderTargetPixels|getImageData|toDataURL|toBlob/);
    expect(RETICLE).not.toMatch(/readPixels|readRenderTargetPixels|getImageData|toDataURL/);

    // `readPixels` exists exactly once, in the console-only coverage accessor.
    const uses = [...MASK.matchAll(/readPixels/g)].length;
    expect(uses, 'readPixels is used somewhere other than coverage()').toBe(1);
    const cov = MASK.slice(MASK.indexOf('coverage()'), MASK.indexOf('stats()'));
    expect(cov, 'the one readPixels is not inside coverage()').toMatch(/readPixels/);
  });

  it('the composite op is always put back — this canvas is drawn on forever', () => {
    // `destination-out` left in force would make the NEXT frame's brackets
    // erase instead of paint, and the overlay would silently never show
    // anything again. The restore is in a `finally` for the same reason the
    // `overrideMaterial` restore is.
    const i = RETICLE.indexOf('_applyCabinMask()');
    expect(i, '_applyCabinMask is gone — this scan is stale').toBeGreaterThan(-1);
    const body = RETICLE.slice(RETICLE.lastIndexOf('_applyCabinMask() {'));
    expect(body).toMatch(/globalCompositeOperation = 'destination-out'/);
    expect(body).toMatch(/finally \{[\s\S]*globalCompositeOperation = 'source-over'/);
    expect(body, 'a softened edge would be invisible as a regression')
      .toMatch(/imageSmoothingEnabled = false/);
  });

  it('the override material is restored in a `finally`', () => {
    // The worst outcome this module can produce is the pilot\'s cabin left flat
    // white, and a throw inside `renderer.render` is the only route to it.
    expect(MASK).toMatch(/finally \{[\s\S]*scene\.overrideMaterial = prevOverride;/);
  });

  it('⭐⭐ the override material is DOUBLE-SIDED, or the fuselage stops occluding', () => {
    // `cockpit-gen.py` sets `doubleSided` PER MATERIAL: Mat_Frame, Mat_Hull,
    // Mat_Screen and Mat_Glass are double-sided; Mat_Body and Mat_Arm are not.
    // One override material has one `side`, so it must be the union. FrontSide
    // would silently drop the hull tub and the arches — OPEN SHELLS the pilot
    // sits INSIDE and therefore sees the back of — and the largest occluders in
    // the cabin would contribute nothing to the cut.
    expect(MASK).toMatch(/side: THREE\.DoubleSide/);
  });
});

describe('the camera mirror does not mutate the cockpit camera', () => {
  const MASK = strip('../cabinMask.js');

  it('copies into its OWN camera and re-applies the layer after', () => {
    // `Object3D.copy` copies `layers` too, so a `copy` without the reset would
    // put the mask's single-layer mask onto... its own camera, harmlessly — but
    // copying INTO `_cockpitCamera` instead would restrict the camera the cabin
    // is drawn with to the mask layer, and the pilot's cockpit would vanish
    // except for its occluders. Pinned as direction-of-copy.
    expect(MASK).toMatch(/cam\.copy\(this\._srcCamera, false\);/);
    expect(MASK).toMatch(/cam\.layers\.set\(this\.layer\);/);
    expect(MASK, 'the mask wrote back into the live cockpit camera')
      .not.toMatch(/this\._srcCamera\.(copy|position|quaternion|layers)\s*[.=]/);
  });

  it('the mask buffer tracks the OVERLAY\'s backing store, not the CSS size', () => {
    // `TargetingReticle._resize` sizes its canvas `innerWidth * dpr`, rounded.
    // The same formula here is what makes the erase a 1:1 blit with no
    // resampling — a half-pixel scale would feather every cut edge, which reads
    // as "the mask is blurry" rather than as a size mismatch.
    expect(MASK).toMatch(/Math\.round\(\(typeof window !== 'undefined' \? window\.innerWidth : 1\) \* dpr\)/);
    expect(MASK, 'setSize would re-apply a pixel ratio on top of the dpr already in w/h')
      .toMatch(/setSize\(w, h, false\)/);
  });
});

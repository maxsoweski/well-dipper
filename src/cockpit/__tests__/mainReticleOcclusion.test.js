/**
 * The GAME's wiring for cockpit reticle occlusion, and the FOV bug underneath it.
 *
 * Max, in UAT 2026-08-01: *"the reticles on the hud that go around worlds/stars
 * in-game are still not being occluded by the monitors/monitor arms, fuselage,
 * or ribs as they should be."*
 *
 * A source scan, same standing reason as `mainHudSlot.test.js` and
 * `mainNavWiring.test.js`: `src/main.js` builds a WebGL renderer, a GLTF loader
 * and a galaxy at module scope and is not importable here. The MATH is tested
 * properly, on plain objects, in `reticleOcclusion.test.js`; this file guards
 * the four places the game can hold that math wrong.
 *
 * Comments are stripped before matching — a guard in this lane once went red on
 * its own prose, and an earlier one went GREEN on a comment quoting the code it
 * was hunting.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(resolve(HERE, '../../main.js'), 'utf8');
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** A named function's body, by brace-free slice to the next top-level close. */
const fnBody = (name) => {
  const i = SRC.indexOf(`function ${name}(`);
  expect(i, `${name} is gone — this scan is stale`).toBeGreaterThan(-1);
  return SRC.slice(i, SRC.indexOf('\n}', i));
};

describe('the cabin occludes reticles', () => {
  it('CONTROL: the module is imported and the wiring exists', () => {
    expect(SRC).toMatch(/import \{ collectReticleOccluders, reticleDirInCockpit \} from '\.\/cockpit\/reticleOcclusion\.js'/);
    expect(SRC).toMatch(/function _cockpitBlocksReticle\(target\)/);
  });

  it('⭐⭐ THE CENTRE-RAY GATE NO LONGER SUPPRESSES DRAWING (the blink is retired)', () => {
    // REVERSED 2026-08-01, reticles-on-the-glass. `5cd1118` put
    // `_cockpitBlocksReticle` at the top of `_isReticleOccluded`: one ray
    // through the target's CENTRE, and a hit hid the WHOLE reticle. A ~7 px
    // `Arch_Bow` rib blanked the entire bracket-plus-label for ~100 ms and
    // brought it back whole — behaving exactly like something drawn on the
    // player's eye, which is the tell Max objected to.
    //
    // The silhouette mask cuts the overlay's PIXELS at the rib's own edge
    // instead, and subsumes this gate: a reticle wholly behind a monitor body
    // is erased in full. Re-adding the call here would restore the blink on top
    // of a working mask, and the symptom (an occasional whole-reticle flicker
    // in a game that otherwise cuts correctly) is the kind nobody traces back.
    expect(fnBody('_isReticleOccluded'), 'the centre-ray blink came back')
      .not.toMatch(/_cockpitBlocksReticle\(/);
  });

  it('CONTROL: the non-cockpit occlusion it shares a function with is untouched', () => {
    // The retirement is surgical — body-occludes-body is a different question
    // the mask cannot answer, and deleting it along with the cabin branch would
    // put reticles back on top of planets. Pinned because "remove the cockpit
    // branch" and "remove the branch" are one careless keystroke apart.
    const body = fnBody('_isReticleOccluded');
    expect(body, 'the ray/sphere loop over _occluders went with it')
      .toMatch(/for \(let i = 0; i < _occluders\.length; i\+\+\)/);
    expect(body).toMatch(/if \(perpSq < occ\.radius \* occ\.radius\) return true;/);

    const readers = [...SRC.matchAll(/_isReticleOccluded\(/g)].length;
    expect(readers, 'expected the definition plus the ghost, hover and selected gates')
      .toBeGreaterThanOrEqual(4);
  });

  it('…and the retired test survives WIRED, as the instrument', () => {
    // `_cockpitBlocksReticle` is kept because it is the only thing that can say
    // "the old gate would have hidden this reticle" on a frame where the
    // reticle is drawn and merely cut — which is how AC-THE-CENTRE-RAY-BLINK-
    // IS-GONE is actually measured. Unreferenced, it would be dead code the
    // next cleanup deletes, taking the oracle with it.
    expect(SRC, 'the retired gate is now dead code')
      .toMatch(/window\._cockpitOcclusion\.wouldBlink = \(\) =>/);
    const wired = [...SRC.matchAll(/_cockpitBlocksReticle\(/g)].length;
    expect(wired, 'expected the definition plus at least one instrument call site')
      .toBeGreaterThanOrEqual(2);
  });

  it('⭐ IT GATES ON THE COCKPIT BEING DRAWN, not merely on the list existing', () => {
    // Without this, ORRERY — which renders NO cockpit at all — would still hide
    // reticles behind a cabin that is not on screen, because the occluder list
    // is built once at load and outlives the regime. Precisely the defect class
    // `_cockpitReplaces` was written for earlier the same day.
    const body = fnBody('_cockpitBlocksReticle');
    expect(body, 'no gate on the cockpit actually being rendered').toMatch(/_cockpitShouldRender\(\)/);
    expect(body, 'no early-out on an empty occluder list — a failed GLB').toMatch(/!_cockpitOccluders\.length/);
  });

  it('a null direction means NOT occluded, never occluded', () => {
    // `reticleDirInCockpit` returns null for a body behind the eye. Treating a
    // null as a hit would hide reticles the pilot has flown past — invisible,
    // because there is nothing on screen there to notice missing.
    expect(fnBody('_cockpitBlocksReticle')).toMatch(/if \(!dir\) return false;/);
  });

  it('the occluder list is built from the RIG\'S OWN glass census', () => {
    // Re-deriving "which bits are see-through" here would let the canopy
    // TREATMENT and the occlusion SET disagree, and that disagreement is not
    // survivable in one direction: the canopy covers 97.4% of the sphere, so
    // including it hides every reticle in the game bar a forward pinhole.
    const then = SRC.indexOf('_cockpitReady = true;');
    expect(then, 'the load handler moved — this scan is stale').toBeGreaterThan(-1);
    const handler = SRC.slice(then, then + 1400);
    expect(handler, 'the occluders are never collected').toMatch(/collectReticleOccluders\(rig\.model, rig\)/);
    expect(handler, 'the list is appended to rather than rebuilt — it doubles on a reload')
      .toMatch(/_cockpitOccluders\.length = 0;/);
  });

  it('the cast reuses its scratch — this runs per reticle per frame', () => {
    // `intersectObjects` sorts by distance and cannot stop early; we only ever
    // ask whether anything was hit. And a `new Vector3()` per reticle per frame
    // is per-frame garbage in the one function whose justification is cheapness.
    const body = fnBody('_cockpitBlocksReticle');
    expect(body, 'the sorting, non-early-out helper came back')
      .not.toMatch(/intersectObjects\(/);
    expect(body).toMatch(/intersectObject\(_cockpitOccluders\[i\], false, _cockpitHits\)/);
    expect(body, 'no early return on the first hit').toMatch(/if \(_cockpitHits\.length\) return true;/);
    expect(body, 'allocating a direction per call').not.toMatch(/new THREE\.Vector3\(\)/);
  });
});

describe('the cabin CUTS reticles — the mask wiring', () => {
  it('CONTROL: the mask is imported and installed on the reticle', () => {
    expect(SRC).toMatch(/import \{ CabinMask, assignMaskLayer \} from '\.\/cockpit\/cabinMask\.js'/);
    expect(SRC).toMatch(/const _cabinMask = new CabinMask\(\)/);
    expect(SRC, 'the reticle has no mask source, so nothing is ever cut')
      .toMatch(/targetingReticle\.setMaskSource\(/);
  });

  it('⭐ THE MASK IS TAGGED FROM `_cockpitOccluders`, not from a second census', () => {
    // The mask ERASES with its occluder set, so a set of its own that drifted
    // toward including `Canopy_Glass` — 97.4% of the sphere — would wipe every
    // reticle in the game. Passing the array the raycast oracle already casts
    // against makes the two physically incapable of disagreeing.
    const then = SRC.indexOf('_cockpitReady = true;');
    expect(then, 'the load handler moved — this scan is stale').toBeGreaterThan(-1);
    const handler = SRC.slice(then, then + 1800);
    expect(handler, 'the mask layer is never assigned — the mask renders nothing')
      .toMatch(/assignMaskLayer\(_cockpitOccluders\)/);
    expect(handler, 'the mask re-derived its own occluder set')
      .not.toMatch(/assignMaskLayer\(collectReticleOccluders\(/);
  });

  it('⭐⭐ THE COCKPIT CAMERA IS PINNED BEFORE THE MASK RENDERS', () => {
    // THE FRAME-ORDER FIX. `_poseCockpitCamera` is called from
    // `_cockpitRig.update()` (via `pinCamera`), which runs ~100 lines AFTER
    // `targetingReticle.update()` in `renderFrame`. Rendering the mask from the
    // camera as found builds THIS frame's cut from LAST frame's head pose, so
    // during free-look the cut trails the cabin by one frame — a moving fringe
    // of reticle along the leading edge of every rib. It reads as "the mask is
    // inaccurate", not as "the mask is late", which is why it is pinned in
    // source rather than left to the comment.
    const i = SRC.indexOf('targetingReticle.setMaskSource(');
    expect(i).toBeGreaterThan(-1);
    const cb = SRC.slice(i, SRC.indexOf('});', i));
    const pin = cb.indexOf('_poseCockpitCamera()');
    const draw = cb.indexOf('_cabinMask.render(_cockpitRig.scene');
    expect(pin, 'the mask renders from an unpinned camera').toBeGreaterThan(-1);
    expect(draw, 'the mask never renders the cabin').toBeGreaterThan(-1);
    expect(pin, 'the pose is written AFTER the mask is drawn — one frame stale')
      .toBeLessThan(draw);
  });

  it('degrades to null when there is no cabin, rather than to a stale silhouette', () => {
    // AC-DEGRADES-WHEN-THERE-IS-NO-CABIN. A failed GLB, ORRERY, or any frame
    // before the rig resolves must produce whole uncut reticles — and must also
    // FORGET the previous scene, or the coverage accessor would keep reporting
    // a cabin that is no longer being drawn. That is the same "a control
    // against an absent subject is not a control" failure this lane has hit
    // three times.
    const i = SRC.indexOf('targetingReticle.setMaskSource(');
    const cb = SRC.slice(i, SRC.indexOf('});', i));
    expect(cb, 'no gate on the cockpit actually being drawn').toMatch(/_cockpitShouldRender\(\)/);
    expect(cb, 'no early-out on an empty occluder list — a failed GLB').toMatch(/!_cockpitOccluders\.length/);
    expect(cb, 'the stand-down path does not clear the mask').toMatch(/_cabinMask\.render\(null, null\)/);
  });

  it('the kill switch and the coverage accessor are both reachable', () => {
    // Neither is a convenience. An EMPTY occluder set renders as "a game that
    // does no occlusion" and a LEAKED canopy renders as "a cockpit with nothing
    // to point at" — so the coverage number is the only thing that tells a
    // working mask from either failure, and the A/B for frame cost has to be
    // togglable on one page in one session.
    expect(SRC).toMatch(/window\._cabinMask = \(on\) =>/);
    expect(SRC).toMatch(/window\._cabinMaskCoverage = \(\) => _cabinMask\.coverage\(\)/);
  });
});

describe('the FOV setting reaches BOTH cameras', () => {
  // ⭐ FOUND WHILE WIRING THE ABOVE, and it is older than that work. The cockpit
  // is a SECOND camera drawing a SECOND pass that composites into one image, so
  // the two must agree about field of view or nothing lines up. The resize
  // handler already carries a comment about exactly this for `aspect`; `fov`
  // was the same oversight one field over, and nothing updated it.
  //
  // It matters more now than it did: occlusion is computed in the cockpit
  // camera's frame and relies on the passes agreeing about where a direction
  // lands. With the FOVs apart it would be right at the default 70 and quietly
  // wrong at every other setting — the worst possible shape for a bug, since
  // 70 is what anyone testing it would be on.

  it('the live slider writes the cockpit camera as well as the world camera', () => {
    const i = SRC.indexOf("case 'fov':");
    expect(i, "the fov case is gone — this scan is stale").toBeGreaterThan(-1);
    const arm = SRC.slice(i, SRC.indexOf('break;', i));
    expect(arm).toMatch(/camera\.fov = value;/);
    expect(arm, 'the cabin still renders at EYE_FOV while the world moves')
      .toMatch(/_cockpitCamera\.fov = value;/);
    expect(arm, 'a changed fov with no projection rebuild does nothing at all')
      .toMatch(/_cockpitCamera\.updateProjectionMatrix\(\);/);
  });

  it('and BOOT honours a saved setting, not just a change made this session', () => {
    // The half a `case 'fov':` fix alone would miss: a player whose saved FOV is
    // not 70 boots with the cabin at 70 and the world at theirs, and it stays
    // that way until they happen to touch the slider.
    expect(SRC, 'the cockpit camera is still constructed from the constant')
      .toMatch(/new THREE\.PerspectiveCamera\(settings\.get\('fov'\) \?\? EYE_FOV,/);
  });

  it('CONTROL: aspect was ALREADY right, and stays right', () => {
    // Pinned so a later edit to the resize handler cannot quietly undo the half
    // that was already correct while the fov half draws the attention.
    expect(SRC).toMatch(/_cockpitCamera\.aspect = window\.innerWidth \/ window\.innerHeight;/);
  });
});

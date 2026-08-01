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

  it('the ONE reticle-occlusion question asks the cabin too', () => {
    // Three call sites read `_isReticleOccluded` — the ghost filter, the hover
    // gate and the selected gate. Hooking the cabin into the predicate rather
    // than at each of them is the same one-decision-point rule `_applyHudSlot`
    // exists for, and the failure it prevents is the familiar one: the site that
    // gets forgotten is the one nobody looks at.
    expect(fnBody('_isReticleOccluded'), 'the cabin is not consulted at all')
      .toMatch(/if \(_cockpitBlocksReticle\(target\)\) return true;/);

    const readers = [...SRC.matchAll(/_isReticleOccluded\(/g)].length;
    expect(readers, 'expected the definition plus the ghost, hover and selected gates')
      .toBeGreaterThanOrEqual(4);
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

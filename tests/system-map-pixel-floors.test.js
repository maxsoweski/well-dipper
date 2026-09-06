// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE MINIMAP'S PIXEL FLOORS.
//
// WHY THIS FILE EXISTS. Every size in `SystemMap` was a FRACTION OF EXTENT — 6% of the map for a
// star, 4-14% for a planet, 8% for the camera pointer. That is resolution-independent in world
// units and therefore resolution-DEPENDENT in pixels, and the map's buffer stopped being a constant
// on 2026-09-06: it is now derived from the Resolution setting, so it moves from 73 texels at 144p
// to 363 at 720p on the same window. On the old fixed 320 a 4% planet was 15 texels; on the 121 the
// 240p setting produces it is 5.8, and the smallest bodies fall under 3.
//
// Max, 2026-09-06: *"we simply need to redesign anything that does not read properly at this new
// resolution."* The floors are that redesign for this surface.
//
// ⚠ THIS IS A UNIT TEST BECAUSE THE LIVE PATH IS NOT REACHABLE FROM A LAB SPAWN, and saying so is
// better than dressing an arithmetic check up as a live one. The map is built during real system
// entry (`main.js:7983`) and bound with `setHud`; `_lab.spawnProceduralSystem` skips both, so
// `_hudScene` stays null and there is nothing on screen to read back. What IS checkable here is the
// whole of the mechanism — the floors are pure arithmetic over `extent` and the buffer size.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll } from 'vitest';

// ⚠ A MINIMAL CANVAS STUB RATHER THAN jsdom. `_makeSprite` and `_buildCameraIndicator` author
// their textures through `document.createElement('canvas')`, and this suite runs in node. jsdom
// would not help on its own — its canvas has no 2D context without the native `canvas` package —
// and none of that is what is under test here. The floors are arithmetic over `extent` and the
// buffer size; the drawing calls only have to not throw.
// ⛔ Installed only if absent, so this never shadows a real DOM if the suite is moved.
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        fillStyle: '', beginPath: noop, arc: noop, fill: noop, fillRect: noop, clearRect: noop,
      }),
    }),
  };
}
import { SystemMap } from '../src/ui/SystemMap.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';

/** A real generated system, not a hand-built fixture — the shape the constructor actually consumes. */
function buildMap(seed = 20250907) {
  const systemData = StarSystemGenerator.generate(seed);   // static, not an instance method
  const systemState = { planets: systemData.planets.map((p) => ({ ...p, orbitAngle: 0 })) };
  return new SystemMap(systemData, systemState);
}

/** Diameter of a sprite, in buffer texels, for a map drawn into `bufferPx` texels. */
const texelsOf = (sprite, map, bufferPx) => (sprite.scale.x * bufferPx) / (2 * map.extent * 1.2);

describe('SystemMap pixel floors', () => {
  let map;
  beforeAll(() => { map = buildMap(); });

  it('builds from a real generated system (the probe is not vacuous)', () => {
    // ⭐ TRAP 18. If the generator's shape drifts and the constructor starts throwing, or a system
    // comes back with no planets, every assertion below would pass over an empty set.
    expect(map.extent).toBeGreaterThan(0);
    expect(map._planetSprites.length).toBeGreaterThan(0);
    expect(map._starSprites.length).toBeGreaterThan(0);
    expect(map._camPointer).toBeTruthy();
  });

  it('has an ISOTROPIC camera, which the rotating pointer depends on', () => {
    // ⭐ NOT COSMETIC. three scales a sprite in view space, ROTATES it, and only then projects
    // (sprite.glsl.js), so under the old 1.2 x 1.6 anisotropic frustum a rotating sprite is SHEARED
    // — it changes shape as it turns. The camera pointer became a sprite in the same change, so this
    // is a precondition for it, not a tidy-up.
    expect(map.camera.right - map.camera.left).toBeCloseTo(map.camera.top - map.camera.bottom, 9);
  });

  it('holds every body at a legible minimum on a small buffer', () => {
    // 121 texels is what 240p produces on a 2023-wide window — the case that motivated this.
    map.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, 121);
    for (const s of map._starSprites) expect(texelsOf(s, map, 121)).toBeGreaterThanOrEqual(7 - 1e-6);
    for (const s of map._planetSprites) expect(texelsOf(s, map, 121)).toBeGreaterThanOrEqual(4 - 1e-6);
  });

  it('KEEPS the proportional law where the buffer is big enough — floors, not replacements', () => {
    // ⭐ THE POINT OF A FLOOR RATHER THAN A FIXED SIZE. The 4-14% law is the map's only size signal:
    // it is what makes a gas giant read as bigger than a rocky world. At a large buffer the floors
    // must be INERT, or the redesign has silently flattened every planet to one size.
    map.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, 1024);
    const sizes = map._planetSprites.map((s) => s.scale.x);
    const biggest = Math.max(...sizes), smallest = Math.min(...sizes);
    expect(biggest).toBeGreaterThan(smallest);
    // And the biggest is its raw proportional size, untouched by any floor.
    const maxMapRadius = Math.max(...map.planetMapData.map((p) => p.mapRadius));
    const expected = map.extent * (0.04 + 1.0 * 0.10);
    expect(biggest).toBeCloseTo(expected, 9);
    expect(maxMapRadius).toBeGreaterThan(0);
  });

  it('is idempotent — recomputing for the same buffer cannot ratchet sizes up', () => {
    // The floors derive from `extent` and `planetMapData`, never from the sprites' current scale.
    // If that ever regressed to reading the live scale, sizes would grow on every resize.
    map.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, 121);
    const first = map._planetSprites.map((s) => s.scale.x);
    map._applyPixelFloors();
    map._applyPixelFloors();
    expect(map._planetSprites.map((s) => s.scale.x)).toEqual(first);
  });

  it('gives the camera pointer an ABSOLUTE 9 texels, so its authored glyph is never resampled', () => {
    for (const buf of [73, 121, 242, 363]) {
      map.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, buf);
      expect(texelsOf(map._camPointer, map, buf)).toBeCloseTo(9, 6);
    }
  });

  it('never divides by a zero buffer — an Infinity scale is a white screen, not a missing feature', () => {
    const fresh = buildMap();
    expect(fresh._pxToWorld(9)).toBe(0);              // before any update() carries the buffer in
    fresh.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, 0);
    for (const s of fresh._planetSprites) expect(Number.isFinite(s.scale.x)).toBe(true);
  });

  it('tracks the Resolution setting, because the buffer moves without a window resize', () => {
    // Changing Resolution reallocates the HUD target with no window event at all, so a size cached
    // at construction would strand the map at whatever the setting was when the system loaded.
    map.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, 73);
    const small = map._planetSprites[0].scale.x;
    map.update({ position: { x: 0, y: 0, z: 0 } }, 0, -1, 0.016, 363);
    expect(map._planetSprites[0].scale.x).not.toBeCloseTo(small, 9);
  });
});

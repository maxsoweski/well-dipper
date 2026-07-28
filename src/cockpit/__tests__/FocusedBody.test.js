/**
 * resolveFocusedBody — lane F (cockpit-screen-content-2026-07-28).
 *
 * SURVEY's feed. "Which body is focused" is not one number: main.js tracks it as
 * the triple (focusIndex, focusMoonIndex, focusStarIndex), and the star case uses
 * a sentinel — `focusIndex = -2` in focusStar(), guarded elsewhere as
 * `focusIndex === -2 && focusStarIndex >= 0`. Getting that domain wrong is how
 * SURVEY ends up reading a planet's dossier while the camera is on a star.
 *
 * Naming follows _makeTarget in src/main.js exactly, including its fallbacks, so
 * the panel and the reticle can never disagree about what a body is called.
 *
 * This resolver returns LIVE references (data, physics) on purpose — it is the
 * INPUT to buildCockpitSnapshot, which is what copies them. Nothing else may call
 * it and hand the result to a panel.
 */
import { describe, it, expect } from 'vitest';
import { resolveFocusedBody } from '../CockpitSnapshot.js';

const physicsOf = (tag) => ({
  composition: { surfaceType: tag },
  atmosphere: { retained: true },
  tidalState: { locked: false },
  surfaceHistory: { erosionLevel: 0.1 },
});

function makeSystem({ named = true, star2 = false } = {}) {
  const sys = {
    type: 'star-system',
    star: { mesh: {}, data: { type: 'G', radius: 5 } },
    planets: [
      {
        orbitRadius: 30,
        planet: { mesh: {}, data: { type: 'terrestrial', radius: 0.04, T_eq: 288 }, physics: physicsOf('silicate') },
        moons: [
          { mesh: {}, data: { type: 'rock', radius: 0.01 }, physics: physicsOf('regolith') },
          { mesh: {}, data: { type: 'ice', radius: 0.008 }, physics: physicsOf('ice') },
        ],
      },
      { orbitRadius: 80, planet: { mesh: {}, data: { type: 'gas-giant', radius: 0.4, T_eq: 110 }, physics: physicsOf('h2') }, moons: [] },
    ],
  };
  if (star2) sys.star2 = { mesh: {}, data: { type: 'M', radius: 2 } };
  if (named) {
    sys.names = {
      star: 'Aletheia',
      star2: 'Aletheia B',
      planets: [{ name: 'Aletheia I', moons: ['Kell', 'Vurn'] }, { name: 'Aletheia II', moons: [] }],
    };
  }
  return sys;
}

/** The shape main.js holds: focusIndex -1 = overview, -2 = star, 0+ = planet. */
const focus = (focusIndex, focusMoonIndex = -1, focusStarIndex = -1) =>
  ({ focusIndex, focusMoonIndex, focusStarIndex });

describe('resolveFocusedBody — SURVEY\'s feed (AC-PANEL-CONTENT)', () => {
  it('resolves a focused planet to its name, data and physics', () => {
    const sys = makeSystem();

    const body = resolveFocusedBody(sys, focus(0));

    expect(body.kind).toBe('planet');
    expect(body.name).toBe('Aletheia I');
    expect(body.data).toBe(sys.planets[0].planet.data);
    expect(body.physics).toBe(sys.planets[0].planet.physics);
  });

  it('resolves a focused moon to the moon, not to its parent planet', () => {
    const sys = makeSystem();

    const body = resolveFocusedBody(sys, focus(0, 1));

    expect(body.kind).toBe('moon');
    expect(body.name).toBe('Vurn');
    expect(body.data).toBe(sys.planets[0].moons[1].data);
    expect(body.data.T_eq).toBeUndefined();   // moons carry no T_eq
  });

  it('resolves the star sentinel focusIndex === -2 to the star, not to planets[-2]', () => {
    const sys = makeSystem();

    const body = resolveFocusedBody(sys, focus(-2, -1, 0));

    expect(body.kind).toBe('star');
    expect(body.name).toBe('Aletheia');
    expect(body.data).toBe(sys.star.data);
  });

  it('resolves the second star of a binary', () => {
    const sys = makeSystem({ star2: true });

    const body = resolveFocusedBody(sys, focus(-2, -1, 1));

    expect(body.name).toBe('Aletheia B');
    expect(body.data).toBe(sys.star2.data);
  });

  it('returns nothing focused for the system overview', () => {
    expect(resolveFocusedBody(makeSystem(), focus(-1))).toBeNull();
  });

  it('returns nothing when the star sentinel is set but no star index is tracked', () => {
    // main.js guards this exact pair: `focusIndex === -2 && focusStarIndex >= 0`.
    expect(resolveFocusedBody(makeSystem(), focus(-2, -1, -1))).toBeNull();
  });

  it('returns nothing rather than throwing when the system is gone', () => {
    // _hideCurrentSystem() runs at every warp; a snapshot taken mid-teardown
    // must not take the frame down with it.
    expect(resolveFocusedBody(null, focus(0))).toBeNull();
    expect(resolveFocusedBody(undefined, focus(0))).toBeNull();
    expect(resolveFocusedBody(makeSystem(), focus(99))).toBeNull();
    expect(resolveFocusedBody(makeSystem(), focus(0, 99))).toBeNull();
  });

  it('falls back to _makeTarget\'s own names when the system is unnamed', () => {
    const sys = makeSystem({ named: false, star2: true });

    expect(resolveFocusedBody(sys, focus(-2, -1, 0)).name).toBe('Star');
    expect(resolveFocusedBody(sys, focus(1)).name).toBe('Planet 2');
    expect(resolveFocusedBody(sys, focus(0, 0)).name).toBe('Moon 1');
  });

  it('reports a deep-sky location as nothing focused', () => {
    // findClosestBody early-returns for `system.type !== 'star-system'`; those
    // systems have no star/planets to read a dossier from.
    const deepSky = { type: 'nebula', planets: [] };

    expect(resolveFocusedBody(deepSky, focus(0))).toBeNull();
  });
});

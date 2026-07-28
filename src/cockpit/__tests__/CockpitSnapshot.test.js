/**
 * CockpitSnapshot — lane F (cockpit-screen-content-2026-07-28).
 *
 * AC-SNAPSHOT: "The screens read the game through ONE read-only feed, taken once
 * a frame... Poke the snapshot anywhere, at any depth, and the ship doesn't move."
 *
 * The property under test is NOT "is it Object.freeze'd" — the contract calls that
 * an implementation choice. The property is that the snapshot contains NO LEAKED
 * LIVE REFERENCE: nothing reachable from the snapshot may be an object the sim,
 * a renderer or the generator still owns and reads.
 *
 * That hazard is real and specific here:
 *   - BodyRenderer's constructor does `this.physics = physicsData` and
 *     `this._composition = physicsData?.composition || null` — so `body.physics`
 *     and every field of getPhysicsSummary() are live references into the object
 *     PhysicsEngine produced.
 *   - scModel.position is a live THREE.Vector3 the sim integrates every tick.
 *   - `system.planets[i]` entries are live and torn down by _hideCurrentSystem().
 *
 * Lane F owns this file. It does not touch lane E's tests/cockpit-geometry.test.js.
 */
import { describe, it, expect } from 'vitest';
import { buildCockpitSnapshot, CockpitSnapshotProvider } from '../CockpitSnapshot.js';

/**
 * Collect the identity of every object and array reachable from `value`.
 * Used to prove snapshot ∩ sources === ∅ — the mechanical form of "no leaked
 * live reference", checked at every depth rather than at the top level only.
 */
function reachableObjects(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return seen;
  if (seen.has(value)) return seen;
  seen.add(value);
  for (const key of Object.keys(value)) reachableObjects(value[key], seen);
  return seen;
}

/** A sources bag whose every nested object is a distinct live object we can watch. */
function makeLiveSources(overrides = {}) {
  const composition = { surfaceType: 'silicate', ironFraction: 0.31 };
  const atmosphere = { retained: true, composition: 'co2-n2', surfacePressureBar: 1.4 };
  const tidalState = { locked: true, lockType: 'synchronous' };
  const surfaceHistory = { bombardmentIntensity: 0.42, erosionLevel: 0.17 };
  const physics = { composition, atmosphere, tidalState, surfaceHistory };

  const scModel = {
    speed: 3.25,
    throttle: 0.6,
    driveOn: true,
    position: { x: 1, y: 2, z: 3 },      // stands in for the live THREE.Vector3
    speedCap: () => 12.5,
    turnRateCap: () => 0.8,
  };

  return {
    simClockMs: 4242,
    helm: true,
    flightMode: 'ASSIST',
    tour: false,
    warping: false,

    scModel,
    sublightCap: 0.5,
    commandedSpeed: 7.5,

    selectedTarget: { kind: 'planet', name: 'Kepler II', mesh: { position: { x: 9, y: 8, z: 7 } }, radius: 0.04 },
    targetDistance: 12.5,
    aimOnTarget: true,
    drop: { state: 'in-window', d: 0.3, captureSphere: 0.4, dropMaxSpeed: 0.16 },
    massLockHint: false,

    focusedBody: { kind: 'planet', name: 'Kepler II', data: { type: 'terrestrial', T_eq: 288, radius: 0.04 }, physics },

    navLevel: 'prism',
    galacticPos: { x: -120.5, y: 3.25, z: 88.0 },
    systemName: 'Kepler',

    // `warpTarget` is a module-level CONST mutated in place, exposed as
    // window._warpTarget, and simStep gates flight on `!warpTarget.turning` —
    // so a leaked reference here really does move the ship.
    warpTarget: { name: 'Vega', destType: 'star-system', turning: false, blinkOn: true,
      direction: { x: 0, y: 0, z: -1 }, featureData: { owner: 'galacticMap' } },
    warpState: 'idle',
    warpProgress: 0,
    pilotPhase: 'IDLE',

    ...overrides,
  };
}

/** Write to every field of every object reachable from `value`, at every depth. */
function pokeEverywhere(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Object.keys(value)) {
    const child = value[key];
    pokeEverywhere(child, seen);
    try { value[key] = '__POKED__'; } catch { /* a frozen snapshot is fine too */ }
  }
  if (Array.isArray(value)) { try { value.push('__POKED__'); } catch { /* fine */ } }
}

describe('buildCockpitSnapshot — read-only feed (AC-SNAPSHOT)', () => {
  it('shares no object identity with any live source object, at any depth', () => {
    const sources = makeLiveSources();

    const snapshot = buildCockpitSnapshot(sources);

    const live = reachableObjects(sources);
    const shared = [...reachableObjects(snapshot)].filter((o) => live.has(o));
    expect(shared).toEqual([]);
  });

  it('leaves every live source untouched when the snapshot is poked at every depth', () => {
    const sources = makeLiveSources();
    const before = JSON.stringify(sources, (k, v) => (typeof v === 'function' ? '[fn]' : v));

    pokeEverywhere(buildCockpitSnapshot(sources));

    const after = JSON.stringify(sources, (k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(after).toBe(before);
  });

  it('carries the live flight, target, survey and nav values through', () => {
    const sources = makeLiveSources();

    const s = buildCockpitSnapshot(sources);

    expect(s.regime).toEqual({ helm: true, flightMode: 'ASSIST', tour: false, warping: false, pilotPhase: 'IDLE' });
    expect(s.drive).toEqual({
      speed: 3.25, commandedSpeed: 7.5, throttle: 0.6, driveOn: true,
      sublightCap: 0.5, speedCap: 12.5, turnRateCap: 0.8,
    });
    expect(s.target).toEqual({
      kind: 'planet', name: 'Kepler II', distance: 12.5, aimOnTarget: true,
      dropState: 'in-window', dropMaxSpeed: 0.16, captureSphere: 0.4, massLockHint: false,
    });
    expect(s.survey).toEqual({
      kind: 'planet', name: 'Kepler II', type: 'terrestrial', tEq: 288,
      composition: { surfaceType: 'silicate', ironFraction: 0.31 },
      atmosphere: { retained: true, composition: 'co2-n2', surfacePressureBar: 1.4 },
      tidalState: { locked: true, lockType: 'synchronous' },
      surfaceHistory: { bombardmentIntensity: 0.42, erosionLevel: 0.17 },
    });
    expect(s.nav).toEqual({
      level: 'prism', galacticPos: { x: -120.5, y: 3.25, z: 88.0 }, systemName: 'Kepler',
    });
    expect(s.t).toBe(4242);
  });

  it('carries render-cadence dt alongside the sim clock, because t repeats above 60 Hz', () => {
    // `t` is simClockMs(), which advances only in simUpdate. On a 240 Hz display
    // three RAFs in four run zero sim ticks, so a panel integrating dt from `t`
    // alone would stall. renderDt is already computed at the top of renderFrame.
    const s = buildCockpitSnapshot(makeLiveSources({ simClockMs: 1000, renderDt: 1 / 240 }));

    expect(s.t).toBe(1000);
    expect(s.renderDt).toBeCloseTo(1 / 240, 8);
    expect(buildCockpitSnapshot({}).renderDt).toBe(0);
  });

  it('drops a class instance rather than copying it, so no renderer object can ride along', () => {
    class LiveThing { constructor() { this.mesh = { geometry: {} }; } }
    const sources = makeLiveSources({
      focusedBody: { kind: 'planet', name: 'X', data: {}, physics: { composition: new LiveThing() } },
    });

    const s = buildCockpitSnapshot(sources);

    expect(s.survey.composition).toBeNull();
  });

  it('reads T_eq as blank — not stale, not 0 — for a moon, a star and no focus', () => {
    const withPlanet = buildCockpitSnapshot(makeLiveSources());
    expect(withPlanet.survey.tEq).toBe(288);

    // PlanetGenerator writes T_eq onto planet data only; moons and stars carry none.
    const moon = buildCockpitSnapshot(makeLiveSources({
      focusedBody: { kind: 'moon', name: 'Kepler II b', data: { type: 'rock' }, physics: null },
    }));
    const star = buildCockpitSnapshot(makeLiveSources({
      focusedBody: { kind: 'star', name: 'Kepler', data: { type: 'G' }, physics: null },
    }));
    const none = buildCockpitSnapshot(makeLiveSources({ focusedBody: null }));

    expect(moon.survey.tEq).toBeNull();
    expect(star.survey.tEq).toBeNull();
    expect(none.survey.tEq).toBeNull();
    expect(none.survey.name).toBeNull();
  });

  it('reads SURVEY blank during a warp, because the system is already torn down', () => {
    // `system` is NEVER nulled — grep finds one assignment, the declaration.
    // _hideCurrentSystem() runs at the FOLD→ENTER and ENTER→HYPER transitions,
    // potentially many frames before spawnSystem() reassigns `system`. In that
    // window `system` still points at BodyRenderers whose meshes are out of the
    // scene and whose GPU resources spawnSystem is about to dispose. A dossier
    // read then describes a system that no longer exists.
    const warping = buildCockpitSnapshot(makeLiveSources({ warping: true }));

    expect(warping.survey).toEqual({
      kind: null, name: null, type: null, tEq: null,
      composition: null, atmosphere: null, tidalState: null, surfaceHistory: null,
    });
    // The rest of the frame still reports — the ship is still flying.
    expect(warping.drive.speed).toBe(3.25);
    expect(warping.regime.warping).toBe(true);
  });

  it('carries the warp leg as primitives and never the live warpTarget', () => {
    const sources = makeLiveSources({
      warpState: 'hyper', warpProgress: 0.42, warping: true, pilotPhase: 'CRUISE',
      warpTarget: { name: 'Vega', destType: 'star-system', turning: true, blinkOn: false,
        direction: { x: 0, y: 0, z: -1 }, featureData: { owner: 'galacticMap' } },
    });

    const s = buildCockpitSnapshot(sources);

    expect(s.warp).toEqual({
      active: true, state: 'hyper', progress: 0.42,
      targetName: 'Vega', destType: 'star-system', turning: true,
    });
    expect(s.regime.pilotPhase).toBe('CRUISE');
    // The whole point: simStep reads `!warpTarget.turning`, so nothing reachable
    // from the snapshot may BE warpTarget or anything it owns.
    const live = reachableObjects(sources.warpTarget);
    expect([...reachableObjects(s)].filter((o) => live.has(o))).toEqual([]);
  });
});

describe('CockpitSnapshotProvider — one feed, taken once a frame (AC-SNAPSHOT)', () => {
  it('hands out a usable snapshot before the first frame has been taken', () => {
    const provider = new CockpitSnapshotProvider(() => makeLiveSources());

    const s = provider.get();

    expect(s).toBeTruthy();
    expect(s.drive.speed).toBe(0);
    expect(s.target.dropState).toBe('none');
  });

  it('reads the live sources exactly once per update, however many panels then read it', () => {
    let reads = 0;
    const provider = new CockpitSnapshotProvider(() => { reads++; return makeLiveSources(); });

    provider.update();
    provider.get(); provider.get(); provider.get(); provider.get();

    expect(reads).toBe(1);
  });

  it('passes the frame\'s own locals through to the source reader', () => {
    // _scDrop, _scTargetPos and _aimOnTarget are `const` locals computed inside
    // renderFrame for scHud.update. The provider must be handed those exact
    // values rather than recompute _scDropState() — recomputing re-runs
    // _resolveSelectedBody() plus a distanceTo and can diverge from the 2D HUD.
    let seen = null;
    const provider = new CockpitSnapshotProvider((frame) => {
      seen = frame;
      return makeLiveSources({ drop: frame.drop, aimOnTarget: frame.aimOnTarget });
    });

    const s = provider.update({ drop: { state: 'too-fast', dropMaxSpeed: 0.2, captureSphere: 0.5 }, aimOnTarget: false });

    expect(seen).toEqual({ drop: { state: 'too-fast', dropMaxSpeed: 0.2, captureSphere: 0.5 }, aimOnTarget: false });
    expect(s.target.dropState).toBe('too-fast');
    expect(s.target.aimOnTarget).toBe(false);
  });

  it('hands all four panels the same object between updates, so one frame is coherent', () => {
    const provider = new CockpitSnapshotProvider(() => makeLiveSources());
    provider.update();

    expect(provider.get()).toBe(provider.get());
  });

  it('shows a real state change on the next update and not before', () => {
    let speed = 3.25;
    const provider = new CockpitSnapshotProvider(() => makeLiveSources({
      scModel: { speed, throttle: 0.6, driveOn: true, position: { x: 0, y: 0, z: 0 },
        speedCap: () => 12.5, turnRateCap: () => 0.8 },
    }));

    provider.update();
    const before = provider.get();
    speed = 9.75;

    expect(provider.get().drive.speed).toBe(3.25);   // not before
    provider.update();
    expect(provider.get().drive.speed).toBe(9.75);   // and after
    expect(before.drive.speed).toBe(3.25);           // the old frame is not retro-edited
  });
});

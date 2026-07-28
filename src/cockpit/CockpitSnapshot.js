/**
 * CockpitSnapshot — the ONE read-only feed the four cockpit panels read.
 *
 * Lane F, workstream `cockpit-screen-content-2026-07-28`, AC-SNAPSHOT.
 *
 * Why this module exists: every screen feed (`system`, `focusIndex`,
 * `_selectedTarget`, `playerGalacticPos`, `scModel.speed/throttle`, `warpTarget`,
 * `_navComputer`) is a module-level `let` in a ~11k-line `src/main.js` with no
 * exports and no store. Rather than let four panels each reach in — and each grow
 * its own way to get it wrong — main.js hands this builder the live values once a
 * frame and the panels read only what comes back.
 *
 * The contract the panels get: PLAIN DATA, NO LIVE REFERENCES. Poke the snapshot
 * anywhere, at any depth, and the ship does not move. That is not decoration —
 * the leak hazard is concrete:
 *   - `BodyRenderer`'s constructor does `this.physics = physicsData` and
 *     `this._composition = physicsData?.composition || null`, so `body.physics`
 *     and every field `getPhysicsSummary()` returns are live references into the
 *     object `PhysicsEngine` produced and the renderer still reads.
 *   - `scModel.position` is a `THREE.Vector3` the sim integrates every tick.
 *   - `system.planets[i]` entries are torn down by `_hideCurrentSystem()` at every
 *     warp, so holding one across a warp holds a corpse.
 *
 * Deliberately NOT Object.freeze: the contract names freezing an implementation
 * choice, not the property, and deep-freezing a fresh object graph at 60 Hz buys
 * nothing once the graph is already a copy.
 */

/** Plain-object test: rejects class instances (Vector3, Mesh, BodyRenderer, …). */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-copy plain data. Arrays and plain objects are rebuilt; primitives pass
 * through; anything else (a class instance, a function, a DOM node) is dropped to
 * `null` rather than copied, because a class instance in a snapshot is exactly the
 * live reference this module exists to prevent. `depth` is a cycle backstop — the
 * feeds are shallow, so hitting it means something unexpected got handed in.
 */
function plainCopy(value, depth = 0) {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' ? null : value;
  }
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.map((v) => plainCopy(v, depth + 1));
  if (!isPlainObject(value)) return null;
  const out = {};
  for (const key of Object.keys(value)) out[key] = plainCopy(value[key], depth + 1);
  return out;
}

/** Copy a Vector3-like into plain numbers. Returns null for a missing source. */
function plainVec3(v) {
  if (!v || typeof v !== 'object') return null;
  return { x: v.x ?? 0, y: v.y ?? 0, z: v.z ?? 0 };
}

/**
 * Resolve main.js's focus triple to the body SURVEY should show.
 *
 * "Which body is focused" is not one number. main.js tracks it as
 * (focusIndex, focusMoonIndex, focusStarIndex), where `focusIndex` carries a
 * sentinel: -1 = system overview, **-2 = a star** (set by `focusStar()`, and
 * guarded elsewhere as `focusIndex === -2 && focusStarIndex >= 0`), 0+ = a planet.
 * Treating -2 as an array index is how SURVEY would end up reading nothing while
 * the camera sits on a star.
 *
 * Names follow `_makeTarget` in src/main.js exactly, fallbacks included, so the
 * panel and the targeting reticle can never disagree about what a body is called.
 *
 * NOTE: the returned `data` and `physics` are LIVE references. This function is
 * the INPUT to buildCockpitSnapshot, which is what copies them. Nothing else may
 * call it and hand the result to a panel.
 *
 * @param {object|null} system the live `system` (replaced wholesale each warp)
 * @param {{focusIndex:number, focusMoonIndex:number, focusStarIndex:number}} focus
 * @returns {{kind:string, name:string, data:object, physics:object|null}|null}
 */
export function resolveFocusedBody(system, focus = {}) {
  if (!system) return null;
  // Deep sky has no star/planets to read a dossier from — the same early return
  // `findClosestBody()` makes.
  if (system.type && system.type !== 'star-system') return null;

  const { focusIndex = -1, focusMoonIndex = -1, focusStarIndex = -1 } = focus;

  if (focusIndex === -2) {
    if (focusStarIndex < 0) return null;
    const starObj = focusStarIndex === 1 && system.star2 ? system.star2 : system.star;
    if (!starObj?.data) return null;
    const name = focusStarIndex === 1 ? system.names?.star2 : system.names?.star;
    return { kind: 'star', name: name || 'Star', data: starObj.data, physics: starObj.physics ?? null };
  }

  if (focusIndex < 0) return null;

  const entry = system.planets?.[focusIndex];
  if (!entry) return null;

  if (focusMoonIndex >= 0) {
    const moon = entry.moons?.[focusMoonIndex];
    if (!moon?.data) return null;
    return {
      kind: 'moon',
      name: system.names?.planets?.[focusIndex]?.moons?.[focusMoonIndex] || `Moon ${focusMoonIndex + 1}`,
      data: moon.data,
      physics: moon.physics ?? null,
    };
  }

  if (!entry.planet?.data) return null;
  return {
    kind: 'planet',
    name: system.names?.planets?.[focusIndex]?.name || `Planet ${focusIndex + 1}`,
    data: entry.planet.data,
    physics: entry.planet.physics ?? null,
  };
}

/**
 * Build one frame's snapshot from live game state.
 *
 * Every argument is read, never retained. The returned object is composed
 * entirely of primitives, plain objects and arrays of those.
 *
 * @param {object} sources live values, gathered by main.js at the call site
 * @returns {object} the frame's read-only snapshot
 */
export function buildCockpitSnapshot(sources = {}) {
  const {
    simClockMs = 0,
    renderDt = 0,
    helm = false,
    flightMode = null,
    tour = false,
    warping = false,

    scModel = null,
    sublightCap = 0,
    commandedSpeed = 0,

    selectedTarget = null,
    targetDistance = null,
    aimOnTarget = false,
    drop = null,
    massLockHint = false,

    focusedBody = null,

    navLevel = null,
    galacticPos = null,
    systemName = null,

    warpTarget = null,
    warpState = 'idle',
    warpProgress = 0,
    pilotPhase = null,
  } = sources;

  // `system` is NEVER nulled — there is exactly one assignment in main.js, the
  // declaration. `_hideCurrentSystem()` runs at the FOLD→ENTER and ENTER→HYPER
  // transitions, potentially many frames before `spawnSystem()` reassigns it, so
  // across a warp `system` still points at BodyRenderers whose meshes are out of
  // the scene and whose GPU resources are about to be disposed. Reading a
  // dossier then describes a system that no longer exists, so SURVEY goes blank
  // for the duration. The rest of the frame still reports — the ship is flying.
  const body = warping ? null : focusedBody;
  const physics = body?.physics ?? null;
  const bodyData = body?.data ?? null;

  return {
    // `t` is the SIM clock — replay-deterministic, and it repeats across RAFs on
    // a display above 60 Hz, which is exactly the "no sim tick happened" signal a
    // panel wants before re-rasterising an expensive CRT texture. `renderDt` is
    // the render-cadence delta for anything that must animate every frame.
    t: simClockMs,
    renderDt,

    regime: {
      helm: !!helm,
      flightMode: flightMode ?? null,
      tour: !!tour,
      warping: !!warping,
      pilotPhase: pilotPhase ?? null,
    },

    // `warpTarget` is a module-level CONST mutated in place and exposed as
    // window._warpTarget, and simStep gates flight on `!warpTarget.turning` —
    // so this block is named-field copying, never a pass-through. Its
    // `.direction` (a THREE.Vector3), `.featureData` and `.galaxyData`
    // (GalacticMap-owned) are deliberately not carried at all: no panel in the
    // charter shows them, and each is a live reference.
    warp: {
      active: !!warping,
      state: warpState ?? 'idle',
      progress: warpProgress ?? 0,
      targetName: warpTarget?.name ?? null,
      destType: warpTarget?.destType ?? null,
      turning: !!warpTarget?.turning,
    },

    drive: {
      speed: scModel?.speed ?? 0,
      commandedSpeed: commandedSpeed ?? 0,
      throttle: scModel?.throttle ?? 0,
      driveOn: scModel?.driveOn ?? false,
      sublightCap: sublightCap ?? 0,
      speedCap: typeof scModel?.speedCap === 'function' ? scModel.speedCap() : null,
      turnRateCap: typeof scModel?.turnRateCap === 'function' ? scModel.turnRateCap() : null,
    },

    target: {
      kind: selectedTarget?.kind ?? null,
      name: selectedTarget?.name ?? null,
      distance: targetDistance ?? null,
      aimOnTarget: !!aimOnTarget,
      dropState: drop?.state ?? 'none',
      dropMaxSpeed: drop?.dropMaxSpeed ?? null,
      captureSphere: drop?.captureSphere ?? null,
      massLockHint: !!massLockHint,
    },

    // T_eq is written onto PLANET data only — moons and stars carry none, so this
    // reads null for them rather than a stale or zeroed number.
    survey: {
      kind: body?.kind ?? null,
      name: body?.name ?? null,
      type: bodyData?.type ?? null,
      tEq: typeof bodyData?.T_eq === 'number' ? bodyData.T_eq : null,
      composition: plainCopy(physics?.composition ?? null),
      atmosphere: plainCopy(physics?.atmosphere ?? null),
      tidalState: plainCopy(physics?.tidalState ?? null),
      surfaceHistory: plainCopy(physics?.surfaceHistory ?? null),
    },

    nav: {
      level: navLevel ?? null,
      galacticPos: plainVec3(galacticPos),
      systemName: systemName ?? null,
    },
  };
}

/**
 * Holds the current frame's snapshot. main.js constructs one, calls `update()`
 * once per frame, and every panel reads `get()` — so all four panels see ONE
 * coherent frame rather than four independently-sampled ones.
 *
 * `readSources` is a zero-argument function main.js supplies. It has to be a
 * function, not a bag of references: the feeds it reads (`system`, `focusIndex`,
 * `_selectedTarget`, `playerGalacticPos`, …) are module-level `let`s that get
 * REASSIGNED — `system` is replaced wholesale at every `spawnSystem` — so a
 * captured reference would go stale at the first warp.
 */
export class CockpitSnapshotProvider {
  /** @param {() => object} readSources gathers the live values for one frame */
  constructor(readSources) {
    this._readSources = readSources;
    // A valid empty frame, so a panel constructed before the first update()
    // renders "no data" rather than throwing.
    this._snapshot = buildCockpitSnapshot({});
  }

  /**
   * Take this frame's snapshot. Call once per frame, from main.js only.
   *
   * `frame` carries the values that exist ONLY as `renderFrame` locals — the
   * `_scDrop` / `_scTargetPos` / `_aimOnTarget` consts computed for
   * `scHud.update`. They are passed in rather than recomputed because
   * recomputing `_scDropState()` re-runs `_resolveSelectedBody()` and a
   * `distanceTo`, and could diverge from what the 2D HUD shows in the same frame.
   *
   * @param {object} [frame] this frame's locals, handed to the source reader
   */
  update(frame = {}) {
    this._snapshot = buildCockpitSnapshot(this._readSources(frame) ?? {});
    return this._snapshot;
  }

  /** The current frame's snapshot. Panels call this; it never reads live state. */
  get() {
    return this._snapshot;
  }
}

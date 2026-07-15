/**
 * arrivalResolution — the ONE shared arrival-resolution core (FIX-2 of
 * real-star-identity-unification-2026-07-15).
 *
 * WHAT: given an arrival star's canonical seed, position, catalog type, and
 * display name, produce the systemData that arrival delivers — routing the
 * KnownSystems override, applying the real-universe overlay, generating, and
 * attaching the merged display names. ONE core, thin sync/async wrappers (the
 * only sync/async difference is StarSystemGenerator.generate vs generateAsync;
 * KnownSystems.generate() is synchronous on both paths).
 *
 * WHY: the arrival generation stack used to be inlined in main.js onPrepareSystem
 * while NavComputer._renderSystem previewed via a raw, overlay-less
 * StarSystemGenerator.generate — so the nav SYSTEM view previewed a DIFFERENT
 * system than warping delivered (Guniibuu: preview 6 planets, arrival a K+K
 * binary + 4). Both call sites now consume this module, so the preview generates
 * EXACTLY what arrival delivers.
 *
 * SEED: the star's seed is taken AS GIVEN (canonical per FIX-1 realStarSeed.js) —
 * this module never re-derives it. The caller passes the seed the star already
 * carries.
 *
 * OWNERSHIP: this module owns the RESOLUTION STACK only (context + type override
 * + KnownSystems routing + overlay + generate + merged names). Engine globals a
 * known-system arrival realigns — playerGalacticPos, currentGalaxyStar — stay in
 * main.js's thin call site (it uses the returned `knownWarp` to realign). Arrival
 * transport fields (_destType, _warpTargetName) also stay at the call site.
 *
 * DELIBERATE NON-GOALS: no seed derivation (FIX-1 owns it); no sky prep
 * (skyRenderer.prepareForPositionAsync stays in main.js — it is not part of the
 * resolution stack); no StarSystemGenerator or overlay edits (this is a caller).
 */

import { StarSystemGenerator } from './StarSystemGenerator.js';
import { KnownSystems } from './KnownSystems.js';

/**
 * SYNC prepare phase — no generation. Derives the galaxy context, sets the
 * catalog star-type override, routes the KnownSystems override, and bolts on the
 * real-universe overlay fields for a non-known arrival. Mirrors main.js
 * onPrepareSystem's star-system block (context + starTypeOverride +
 * findByAlias/findAt + applyToContext) so both wrappers share one source.
 *
 * @param {object} p
 * @param {object} p.galacticMap  — GalacticMap instance (context derivation)
 * @param {object|null} p.overlay — RealSystemOverlay (null = skip overlay)
 * @param {{x,y,z}} p.pos         — arrival position (kpc)
 * @param {string|null} p.starType — catalog spectral type override (falsy = none)
 * @param {string} p.displayName  — arrival star display name (join key)
 * @param {boolean} p.hasNavStar  — nav-picked (findByAlias) vs sky (findAt); a
 *   browsed nav preview is nav-picked, so it passes true, matching arrival's
 *   nav-pick routing.
 * @returns {{ galaxyContext, knownWarp }}
 */
export function prepareArrival({ galacticMap, overlay, pos, starType, displayName, hasNavStar }) {
  const galaxyContext = galacticMap.deriveGalaxyContext(pos);
  // Hash grid / catalog already determined this star's type — pass it through so
  // StarSystemGenerator uses it instead of re-rolling from weights.
  if (starType) galaxyContext.starTypeOverride = starType;
  const knownWarp = hasNavStar
    ? KnownSystems.findByAlias(displayName, pos)
    : KnownSystems.findAt(pos);
  // Non-known real arrival: bolt the overlay ctx fields (companionSpec /
  // knownPlanets / farCompanions) onto the context. applyToContext is a no-op
  // (with a warn) when the overlay is not yet ready.
  if (!knownWarp && overlay) overlay.applyToContext(galaxyContext, displayName, pos);
  return { galaxyContext, knownWarp };
}

/**
 * SYNC finalize phase — attaches the merged display names (design D7) that the
 * generated system needs. Known-system branch: the entry's own authored names.
 * Overlay branch: the merged names + the host's full spectral class (only when
 * the join supplied structure or known planets — a bare procgen arrival keeps its
 * procgen names untouched). Mutates + returns systemData.
 *
 * @param {object} systemData — the generated system
 * @param {object} p — { overlay, displayName, pos, knownWarp }
 * @returns {object} systemData
 */
export function finalizeArrival(systemData, { overlay, displayName, pos, knownWarp }) {
  if (knownWarp) {
    // Read knownWarp.names AFTER generate() — declarative entries populate it on
    // generate() (KnownSystems adapter). _warpTargetName stays a call-site concern.
    systemData._knownSystemNames = knownWarp.names;
    return systemData;
  }
  const merge = overlay && overlay.ready ? overlay.resolve(displayName, pos) : null;
  if (merge && (merge.companionSpec || merge.knownPlanets)) {
    systemData._knownSystemNames =
      overlay.deriveMergedNames(displayName, systemData, merge.tableEntry ?? null);
    if (merge.host?.spectFull && !systemData.star.spectFull) {
      systemData.star.spectFull = merge.host.spectFull;
    }
  }
  return systemData;
}

/**
 * SYNC arrival resolution — one call. Used by NavComputer._renderSystem preview
 * (synchronous render path). Same output as the async wrapper: generate() and
 * generateAsync() share StarSystemGenerator._generateIterator, so preview (sync)
 * is byte-identical to arrival (async).
 *
 * @param {object} params — see prepareArrival + { seed } (canonical, FIX-1)
 * @returns {{ systemData, knownWarp, galaxyContext }}
 */
export function resolveArrivalSystem(params) {
  const { galaxyContext, knownWarp } = prepareArrival(params);
  const systemData = knownWarp
    ? knownWarp.generate()
    : StarSystemGenerator.generate(String(params.seed), galaxyContext);
  finalizeArrival(systemData, { ...params, knownWarp });
  return { systemData, knownWarp, galaxyContext };
}

/**
 * ASYNC arrival resolution — one call. Used by main.js onPrepareSystem (the warp
 * FOLD-phase pre-generation uses generateAsync to avoid main-thread stalls).
 *
 * @param {object} params — see prepareArrival + { seed } (canonical, FIX-1)
 * @returns {Promise<{ systemData, knownWarp, galaxyContext }>}
 */
export async function resolveArrivalSystemAsync(params) {
  const { galaxyContext, knownWarp } = prepareArrival(params);
  const systemData = knownWarp
    ? knownWarp.generate()
    : await StarSystemGenerator.generateAsync(String(params.seed), galaxyContext);
  finalizeArrival(systemData, { ...params, knownWarp });
  return { systemData, knownWarp, galaxyContext };
}

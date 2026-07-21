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
 * COMPONENT-ADDRESSABLE ARRIVAL (AC1 of multistar-component-travel-2026-07-21,
 * superseding the D2 primary-only clause — NAMING_AND_REAL_OBJECTS.md §6
 * amendment): when `displayName` names a promoted far component (a
 * `componentSystems` entry — 'Proxima Centauri', 'HD 156026', 'Zet-2 Ret') and
 * component resolution is ON, this module returns that COMPONENT's systemData
 * (the exact payload the NavComputer drill-in previews — preview ≡ arrival by
 * construction), decorated with `_knownSystemNames` {system: parent system,
 * star: component} so spawnSystem titles the arrival by the ONE system. The
 * component address rides the NAME channel (action.star.name → warpTarget.name
 * → displayName) — the only nav→arrival channel surviving main.js's whitelist
 * copies — so main.js needs zero edits.
 *
 * The `resolveComponents` parameter is EXPLICIT on both wrappers and is never
 * keyed on displayName alone:
 *   • resolveArrivalSystemAsync — the ARRIVAL entry point (main.js
 *     onPrepareSystem; lane B's ORRERY instant-cut post-merge) — defaults ON.
 *   • resolveArrivalSystem — the PREVIEW entry point (NavComputer
 *     ._renderSystem browses a member marker and must keep the PARENT payload
 *     for the drill-in flow) — defaults OFF.
 *
 * ══ PINNED IMPLICIT main.js CONTRACT ═══════════════════════════════════════
 * The component path returns a knownWarp WRAPPER — `{...entry, position:
 * componentCatalogPos}` — that steers main.js's known-warp realignment
 * (playerGalacticPos, currentGalaxyStar, sky prep) to the component. This
 * works lane-C-only BECAUSE main.js consumes ONLY `knownWarp.position`,
 * `.seed`, and `.name`. Any main.js change reading another knownWarp field
 * would break component arrival silently — the contract is pinned by the
 * "knownWarp consumers read ONLY position/seed/name" test in
 * __tests__/arrivalResolution.test.js. Extend BOTH together or not at all.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DELIBERATE NON-GOALS: no seed derivation (FIX-1 owns it); no sky prep
 * (skyRenderer.prepareForPositionAsync stays in main.js — it is not part of the
 * resolution stack); no StarSystemGenerator or overlay edits (this is a caller).
 */

import { StarSystemGenerator } from './StarSystemGenerator.js';
import { KnownSystems } from './KnownSystems.js';
import { STELLAR_COMPANIONS } from './data/stellarCompanions.js';
import { deriveAuthoredNames } from './KnownSystemAuthoring.js';

/**
 * Index of the component whose name matches `markerName`, or -1. The name key
 * is componentSystems[i].name (=== farCompanions[i].name by the 1:1 emission
 * invariant). -1 for procgen stars, close members (Rigil/Toliman), and any
 * system without componentSystems — callers treat -1 as "no component".
 *
 * CANONICAL home of this derivation (moved from src/ui/componentIdentity.js in
 * multistar-component-travel-2026-07-21 so the arrival resolver never imports
 * UI code; componentIdentity re-exports it for NavComputer — ONE
 * implementation either way).
 *
 * @param {object|null|undefined} systemData parent system payload
 * @param {string|null|undefined} markerName
 * @returns {number}
 */
export function findComponentIndexByName(systemData, markerName) {
  const comps = systemData?.componentSystems;
  if (!Array.isArray(comps) || !markerName) return -1;
  return comps.findIndex((c) => c && c.name === markerName);
}

/**
 * Member-name → owning STELLAR_COMPANIONS entry name bridge. RealSystemOverlay
 * .resolve joins the curated table by ENTRY name only, and every authored far
 * member except Proxima was dedup-absorbed at catalog regen (no own catalog
 * row, no own KnownSystems alias) — so a component-addressed arrival at
 * 'HD 156026' must generate the 'Guniibuu' PARENT before the component can be
 * extracted from it. Returns null for close members, entry names, and anything
 * else that is not a farCompanions member — the bridge never fires for them.
 *
 * @param {string|null|undefined} name
 * @returns {string|null}
 */
export function componentEntryNameForMember(name) {
  if (!name) return null;
  for (const e of STELLAR_COMPANIONS) {
    if (Array.isArray(e.farCompanions) && e.farCompanions.some((fc) => fc && fc.name === name)) {
      return e.name;
    }
  }
  return null;
}

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

// ── Component-arrival internals (AC1, multistar-component-travel-2026-07-21) ──

/**
 * Effective generation params for a (possibly component-addressed) resolve.
 * When component resolution is ON and displayName is a far MEMBER name, the
 * PARENT entry name becomes the generation join key ('HD 156026' → 'Guniibuu')
 * so KnownSystems/overlay routing and the merged parent names all derive from
 * the entry exactly as the parent preview does. Every other input passes
 * through untouched — the unflagged path is byte-identical to before.
 */
function _effectiveParams(params, resolveComponents) {
  if (!resolveComponents) return params;
  const entryName = componentEntryNameForMember(params.displayName);
  return entryName ? { ...params, displayName: entryName } : params;
}

/** The component's own catalog position (kpc), for the knownWarp wrapper.
 *  Read off the overlay's catalog-name index — the same hyg ∪ supplement rows
 *  RealStarCatalog ingested (Proxima's supplement row is the one authored
 *  component with its own record). Null when unknown → the wrapper degrades to
 *  the registry position, i.e. today's primary realignment. Reads the PUBLIC
 *  catalogStarsByName accessor (pinned in RealSystemOverlay's own suite), so
 *  an overlay-internal index rename fails loudly there instead of silently
 *  degrading this wrapper. */
function _componentCatalogPosition(overlay, componentName) {
  const rec = overlay?.catalogStarsByName?.(componentName)?.[0];
  return rec && Number.isFinite(rec.x) && Number.isFinite(rec.y) && Number.isFinite(rec.z)
    ? { x: rec.x, y: rec.y, z: rec.z }
    : null;
}

/**
 * If `requestedName` addresses a component of the finalized parent payload,
 * return the component result: componentSystems[k].systemData (the EXACT
 * drill-in preview payload — preview ≡ arrival) decorated with
 * `_knownSystemNames` {system: parent system name, star: component name,
 * planets: real designations for injected knowns / component-lettered fill},
 * plus the knownWarp wrapper (see the pinned implicit contract above). Null
 * when no component matches — caller falls through to the parent result.
 */
function _componentResult(parentData, { overlay, requestedName, knownWarp, galaxyContext }) {
  const k = findComponentIndexByName(parentData, requestedName);
  if (k < 0) return null;
  const comp = parentData.componentSystems[k];
  const compData = comp.systemData;
  // The component is the HOST of its own scene: knowns keep their real archive
  // names, fill letters off the COMPONENT name — then the system title is the
  // PARENT's (one system identity, clause 1 of the §6 grammar).
  const names = deriveAuthoredNames(
    { name: comp.name }, { components: [{ name: comp.name }] }, compData,
  );
  names.system = parentData._knownSystemNames?.system ?? names.system;
  compData._knownSystemNames = names;
  // knownWarp WRAPPER: a COPY of the entry with position swapped to the
  // component's own catalog coords — main.js's realignment (which reads only
  // position/seed/name) then lands playerGalacticPos + sky prep at the
  // component while seed/name keep the ONE system identity. Overlay-path
  // components have no knownWarp (nothing realigns — unchanged behavior).
  const knownWarpOut = knownWarp
    ? { ...knownWarp, position: _componentCatalogPosition(overlay, comp.name) ?? knownWarp.position }
    : knownWarp;
  return { systemData: compData, knownWarp: knownWarpOut, galaxyContext };
}

/**
 * SYNC arrival resolution — one call. Used by NavComputer._renderSystem preview
 * (synchronous render path). Same output as the async wrapper: generate() and
 * generateAsync() share StarSystemGenerator._generateIterator, so preview (sync)
 * is byte-identical to arrival (async).
 *
 * `resolveComponents` defaults OFF here: a browsed member marker must preview
 * the PARENT system (the drill-in flow's _systemData) — pass true explicitly
 * for component-arrival semantics.
 *
 * @param {object} params — see prepareArrival + { seed } (canonical, FIX-1)
 *   + { resolveComponents=false }
 * @returns {{ systemData, knownWarp, galaxyContext }}
 */
export function resolveArrivalSystem(params) {
  const resolveComponents = params.resolveComponents === true;
  const p = _effectiveParams(params, resolveComponents);
  const { galaxyContext, knownWarp } = prepareArrival(p);
  const systemData = knownWarp
    ? knownWarp.generate()
    : StarSystemGenerator.generate(String(p.seed), galaxyContext);
  finalizeArrival(systemData, { ...p, knownWarp });
  if (resolveComponents) {
    const comp = _componentResult(systemData, {
      overlay: p.overlay, requestedName: params.displayName, knownWarp, galaxyContext,
    });
    if (comp) return comp;
  }
  return { systemData, knownWarp, galaxyContext };
}

/**
 * ASYNC arrival resolution — one call. Used by main.js onPrepareSystem (the warp
 * FOLD-phase pre-generation uses generateAsync to avoid main-thread stalls).
 *
 * `resolveComponents` defaults ON here: this IS the arrival entry point, and
 * main.js consumes it verbatim (it cannot pass the flag) — the component
 * address arrives through displayName (the name channel). Pass false
 * explicitly for parent (preview) semantics.
 *
 * @param {object} params — see prepareArrival + { seed } (canonical, FIX-1)
 *   + { resolveComponents=true }
 * @returns {Promise<{ systemData, knownWarp, galaxyContext }>}
 */
export async function resolveArrivalSystemAsync(params) {
  const resolveComponents = params.resolveComponents !== false;
  const p = _effectiveParams(params, resolveComponents);
  const { galaxyContext, knownWarp } = prepareArrival(p);
  const systemData = knownWarp
    ? knownWarp.generate()
    : await StarSystemGenerator.generateAsync(String(p.seed), galaxyContext);
  finalizeArrival(systemData, { ...p, knownWarp });
  if (resolveComponents) {
    const comp = _componentResult(systemData, {
      overlay: p.overlay, requestedName: params.displayName, knownWarp, galaxyContext,
    });
    if (comp) return comp;
  }
  return { systemData, knownWarp, galaxyContext };
}

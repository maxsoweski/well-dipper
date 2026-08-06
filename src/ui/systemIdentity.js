// system-identity grammar (AC3) — pure derivations for the SYSTEM view.
//
// A real multi-star system must read as ONE system on every path. Given the
// resolved `systemData` (which, for a known system, carries `_knownSystemNames`
// {system, star, star2, planets} and any `farCompanions` from the arrival/
// preview resolver) and the name of the clicked prism MARKER, these helpers
// derive:
//   • the view title  — the SYSTEM name, not the clicked component
//   • the annotation  — which component you arrived through ("via <name>")
//   • star-hover names — the real component names, never "<marker> A/B"
//
// Procgen systems never gain `_knownSystemNames` (StarSystemGenerator fact 2),
// so every helper falls back to the exact pre-AC3 marker-derived string — the
// SYSTEM view of a procgen system renders byte-identically.

/**
 * The SYSTEM-view title. For a known multi-star (or single) system this is the
 * authored SYSTEM name (e.g. 'Alpha Centauri' from either the Rigil Kentaurus
 * marker or Proxima's marker); for a procgen system it is the clicked marker's
 * own name, exactly as before AC3.
 *
 * @param {object|null|undefined} systemData resolved system payload
 * @param {string|null|undefined} markerName clicked prism marker's name
 * @returns {string}
 */
export function deriveSystemTitle(systemData, markerName) {
  return systemData?._knownSystemNames?.system || markerName || 'Unknown';
}

/**
 * The component annotation drawn as a secondary line under the title, or null
 * when none applies (the title alone is not overloaded with it).
 *   • clicked marker is one of the far companions  → 'via <name> — far companion'
 *   • marker name differs from the system name      → 'via <name>'
 *   • marker name IS the system name (known single) → null
 *   • procgen system (no _knownSystemNames)         → null
 *
 * @param {object|null|undefined} systemData
 * @param {string|null|undefined} markerName
 * @returns {string|null}
 */
export function deriveSystemAnnotation(systemData, markerName) {
  const system = systemData?._knownSystemNames?.system;
  if (!system || !markerName) return null;
  const farNames = (systemData.farCompanions || []).map((f) => f && f.name);
  if (farNames.includes(markerName)) return `via ${markerName} — far companion`;
  if (system !== markerName) return `via ${markerName}`;
  return null;
}

/**
 * Real component name for a star-hover callout. `index` 0 = primary,
 * 1 = companion. Uses the authored `_knownSystemNames.star` / `.star2` when
 * present (so browsing Alpha Centauri via Proxima's marker still hovers
 * 'Rigil Kentaurus' / 'Toliman', never 'Proxima Centauri A/B'); otherwise the
 * historical '<marker> A' / '<marker> B' fallback ('<marker>' bare for a
 * procgen single).
 *
 * @param {object|null|undefined} systemData
 * @param {string} markerName
 * @param {number} index 0 primary, 1 companion
 * @param {boolean} isBinary whether the rendered system is a close binary
 * @returns {string}
 */
export function deriveStarHoverName(systemData, markerName, index, isBinary) {
  const known = systemData?._knownSystemNames;
  if (index === 1) {
    return (known && known.star2) || `${markerName} B`;
  }
  return (known && known.star) || `${markerName}${isBinary ? ' A' : ''}`;
}

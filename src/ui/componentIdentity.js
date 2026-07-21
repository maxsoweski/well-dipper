// component-identity (AC5) — pure derivations for the component drill-in view.
//
// A far companion promoted to a component sub-system (systemData
// .componentSystems, multistar-components-2026-07-19) gets its own SYSTEM-scale
// sub-view inside the parent's SYSTEM view. These helpers derive everything the
// view says from the parent payload + the component index — view-model only, no
// NavComputer state, no canvas (the systemIdentity.js pattern) — so the four
// system-identity grammar clauses (docs/NAMING_AND_REAL_OBJECTS.md) are
// unit-testable bare:
//   1. title names the SYSTEM ('Alpha Centauri', never 'Proxima Centauri')
//   2. structure is payload-sourced (the component's REAL generated planets)
//   3. the viewed component is marked ('via Proxima Centauri — far companion')
//   4. co-membership is cued ('part of Alpha Centauri')

import { deriveSystemTitle, deriveSystemAnnotation } from './systemIdentity.js';

// findComponentIndexByName moved to src/generation/arrivalResolution.js
// (multistar-component-travel-2026-07-21): component-addressable arrival makes
// the arrival resolver a consumer too, and generation code must not import UI
// modules — so the canonical implementation lives with the resolver and this
// module re-exports it (ONE implementation; NavComputer's import is unchanged).
export { findComponentIndexByName } from '../generation/arrivalResolution.js';

/**
 * View-model for the component drill-in. Falls back safely on out-of-range
 * indices / procgen systems: title degrades exactly as deriveSystemTitle does,
 * systemData degrades to null (caller renders nothing rather than throwing).
 *
 * @param {object|null|undefined} parentSystemData
 * @param {number} idx component index (into componentSystems)
 * @param {string|null|undefined} markerName the marker the view was entered from
 * @returns {{ title, breadcrumb, annotation, componentName, systemData }}
 */
export function deriveComponentView(parentSystemData, idx, markerName) {
  const comp = parentSystemData?.componentSystems?.[idx] ?? null;
  const componentName = comp?.name ?? null;
  const title = deriveSystemTitle(parentSystemData, markerName);
  return {
    title,                                                       // clause 1
    breadcrumb: `part of ${title}`,                              // clause 4
    annotation: deriveSystemAnnotation(parentSystemData, componentName ?? markerName), // clause 3
    componentName,
    systemData: comp?.systemData ?? null,                        // clause 2
  };
}

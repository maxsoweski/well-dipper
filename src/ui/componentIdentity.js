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

/**
 * Index of the component whose name matches `markerName`, or -1. The name key
 * is componentSystems[i].name (=== farCompanions[i].name by the 1:1 emission
 * invariant). -1 for procgen stars, close members (Rigil/Toliman), and any
 * system without componentSystems — callers treat -1 as "no drill".
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

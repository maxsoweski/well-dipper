/**
 * Known-system far-companion contents — GENERATED, do NOT hand-edit.
 *
 * Pre-resolved real planet lists for the far companions that data-driven
 * KnownSystems authoring references (AC5 / real-universe-overlay-2026-07-12,
 * design D5). Keyed by the far companion's DISPLAY name (as it appears in
 * src/generation/data/stellarCompanions.js farCompanions[].name); each value
 * carries the resolved archive `hostname` and that host's planets (archive
 * fields: letter, name, periodDays, smaAU, massEarth, radiusEarth, eccen).
 *
 * Derived from public/assets/data/{real-system-contents,real-star-supplement}.json
 * via the supplement's display→hostname bridge. Re-generate with
 *   node scripts/gen-known-system-contents.mjs
 * whenever those JSONs are re-ingested. A vitest drift guard re-derives this
 * extraction and deep-equals the module (KnownSystemAuthoring.test.js).
 */
export const KNOWN_SYSTEM_CONTENTS = {
  "Proxima Centauri": {
    "hostname": "Proxima Cen",
    "planets": [
      {
        "letter": "b",
        "name": "Proxima Cen b",
        "periodDays": 11.18465,
        "smaAU": 0.04848,
        "massEarth": 1.055,
        "radiusEarth": 1.02,
        "eccen": 0
      },
      {
        "letter": "d",
        "name": "Proxima Cen d",
        "periodDays": 5.12338,
        "smaAU": 0.02881,
        "massEarth": 0.26,
        "radiusEarth": 0.692,
        "eccen": 0
      }
    ]
  }
};

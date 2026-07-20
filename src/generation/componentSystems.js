/**
 * componentSystems — pure helpers for the multi-star component substrate
 * (multistar-components-2026-07-19, Increment A of the multistar feasibility
 * recommendation; build-plan DECISIONs a/b).
 *
 * WHAT: the seed derivation, generation-context builder, and payload-shape
 * validator behind `systemData.componentSystems` — the authored-only array that
 * promotes far companions (Proxima, HD 156026, Zet-2 Ret) from inert
 * farCompanions records to full spawnable component sub-systems.
 *
 * INTENT: ONE canonical system seed per system; each component's procgen fill
 * draws a deterministic child stream keyed by component index. The emission
 * site (StarSystemGenerator's far-companions block) recurses into
 * _generateIterator with the context built here; buildComponentContext is the
 * recursion guard — it destructure-OMITS the parent's multi-star fields, so the
 * recursive call can never re-enter the emission block.
 *
 * DELIBERATE NON-GOALS: zero coupling to the real-star position-hash seed
 * module — a position-keyed component seed would bin Proxima to Rigil's same
 * 0.1 pc F1 cell and collide with the system seed (report §3.3); the S1 static
 * check pins this file to zero references, comments included. No
 * StarSystemGenerator import (it imports us; the caller passes the normalized
 * type in); no scene/travel concerns (Increment B).
 */

import { SeededRandom } from './SeededRandom.js';

/**
 * Deterministic component seed: a fresh SeededRandom rooted on the ONE
 * canonical system seed → .child keyed by component index. The fresh root
 * draws NOTHING from the parent generator's live rng (byte-safe by
 * construction, independent of emission-block placement). The readable prefix
 * makes the derivation auditable; the suffix's entropy is genuinely drawn from
 * the child stream, not bare string concat.
 *
 * @param {string|number} canonicalSeed — the seed generate() received
 * @param {number} idx — component index into farCompanions/componentSystems
 * @returns {string}
 */
export function componentSeed(canonicalSeed, idx) {
  const child = new SeededRandom(String(canonicalSeed)).child(`component-${idx}`);
  return `${canonicalSeed}:component-${idx}:${child.int(0, 0xffffffff).toString(36)}`;
}

/**
 * Build the generation context for a component sub-system. Destructure-OMITS
 * the parent's multi-star fields (an executable strip — a plain {...spread}
 * would carry farCompanions into the recursive generate and stack-overflow):
 *   - farCompanions removed → recursion guard (+ rep-cap §3 per-component collapse)
 *   - companionSpec replaced → no fabricated close binary inherited; the
 *     kind:'single' pin rides the existing forceBinary=false path, and
 *     components[0] lets stellarPrefix stamp star.spectFull with the full
 *     display class ('M5.5Ve' honesty)
 *   - knownPlanets replaced → the component gets ITS OWN pins, never the parent's
 * Everything else (metallicity, age, starWeights, binaryModifier, position —
 * the same 0.1 pc cell's galaxy physics) carries through unchanged.
 *
 * @param {object} parentCtx — the parent system's galaxyContext
 * @param {object} fc — the farCompanions entry { name, class, separationAU, planets? }
 * @param {string} normalizedType — caller-computed normalizeSpectralClass(fc.class) || 'M'
 * @returns {object} component galaxyContext
 */
export function buildComponentContext(parentCtx, fc, normalizedType) {
  const { farCompanions, companionSpec, knownPlanets, ...rest } = parentCtx;
  return {
    ...rest,
    starTypeOverride: normalizedType,
    companionSpec: {
      kind: 'single',
      source: 'component',
      components: [{ name: fc.name, class: fc.class }],
    },
    knownPlanets: Array.isArray(fc.planets) ? fc.planets : [],
    // farCompanions intentionally absent — the recursion guard.
  };
}

/**
 * Validate one componentSystems entry against the pinned payload shape
 * (build-plan § Payload shape). Pure and side-effect-free, mirroring
 * validateStellarCompanions' { ok, errors } contract so tests and the S2
 * census can call it uniformly.
 *
 * @param {object} entry — a systemData.componentSystems[i] candidate
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateComponentPayload(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, errors: ['entry is not an object'] };
  }
  for (const key of ['name', 'class', 'seed']) {
    if (typeof entry[key] !== 'string' || !entry[key]) {
      errors.push(`'${key}' must be a non-empty string`);
    }
  }
  // type is the normalized single-letter class normalizeSpectralClass emits.
  if (typeof entry.type !== 'string' || !/^[OBAFGKMD]$/.test(entry.type)) {
    errors.push("'type' must be a single normalized class letter (OBAFGKMD)");
  }
  if (!(typeof entry.separationAU === 'number' && Number.isFinite(entry.separationAU) && entry.separationAU > 0)) {
    errors.push("'separationAU' must be a positive finite number");
  }
  const sd = entry.systemData;
  if (!sd || typeof sd !== 'object' || Array.isArray(sd)) {
    errors.push("'systemData' must be a full generated system payload object");
  } else {
    // The drill-in and Increment B consume these; a payload without them is
    // not a spawnable component.
    if (!sd.star || typeof sd.star !== 'object') errors.push("'systemData'.star must be an object");
    if (!Array.isArray(sd.planets)) errors.push("'systemData'.planets must be an array");
  }
  return { ok: errors.length === 0, errors };
}

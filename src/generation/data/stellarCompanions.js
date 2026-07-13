/**
 * Curated stellar-companion table — THE single multiplicity source of truth.
 *
 * WHAT: A small, hand-authored table of famous multiple star systems (and a
 * few pinned famous singles) that the real-universe overlay consumes to decide
 * a real system's stellar structure. Increment 1 / AC7 of the
 * real-universe-overlay-2026-07-12 workstream.
 *
 * INTENT: Downstream this is read by (a) the overlay merge for Sirius & Procyon
 * (AC3/AC4) and (b) the AC5 data-driven registry authoring for Alpha Centauri's
 * A+B binary. Multiplicity lives HERE and ONLY here — it is never duplicated in
 * a registry generate() function or in the exoplanet ingest output.
 *
 * DELIBERATE NON-GOALS: No bulk double-star catalog (WDS) ingest — that source
 * is full of noisy optical (line-of-sight) pairs. This table is curated famous
 * systems only. It carries NO positions (those come from hyg-stars.json ∪ the
 * dim-host supplement) and NO planets (those come from the exoplanet ingest);
 * it carries only stellar structure: which stars are physically bound, their
 * spectral classes, and representative separations.
 *
 * SCHEMA (kind discriminator is REQUIRED on every entry):
 *   { name, kind: 'multiple',
 *     components: [ {name, class}, {name, class, separationAU} ],  // primary first, ≤2 close stars
 *     farCompanions?: [ {name, class, separationAU} ] }            // wide members (optional)
 *   { name, kind: 'single' }                                       // singleness marker only
 *
 * RULES:
 *   - 'multiple': `components` is ordered primary-first, at most 2 close stars
 *     (AC10's 2-close-star cap). The COMPANION (components[1]) carries
 *     `separationAU`; the primary (components[0]) does not. Wide members
 *     (e.g. Proxima) go in `farCompanions`, each carrying its own separationAU.
 *   - 'single': the `kind` IS the singleness marker. A single entry MUST NOT
 *     carry any companion field (`components`, `separationAU`, `farCompanions`).
 *   - White-dwarf companions use a spectral class whose LEADING LETTER is 'D'
 *     (AC10's degenerate class), e.g. 'DA2', 'DQZ'.
 *   - Anchor resolvability: every entry's anchor — the primary component
 *     (multiples) or the star itself (singles) — is a real catalog star and its
 *     name resolves in hyg-stars.json ∪ real-star-supplement.json, as does every
 *     farCompanion. Close white-dwarf companions (Sirius B, Procyon B) are NEW
 *     content the overlay adds and are deliberately NOT in any catalog.
 *
 * SOURCES: Every spectral class and separation below was web-verified during the
 * build (2026-07-12); each value cites its source inline. Astronomy facts are
 * NOT written from memory. Class letter 'D' used for white dwarfs per AC10.
 *
 * Hand-authored source data — edit facts here only with a fresh citation.
 */

export const STELLAR_COMPANIONS = [
  // Sirius (α Canis Majoris) — brightest star in the night sky; A-type primary
  // with a white-dwarf companion. Anchor "Sirius" resolves in hyg-stars.json.
  {
    name: 'Sirius',
    kind: 'multiple',
    components: [
      // Sirius A: A1V main-sequence star. (SIMBAD / Wikipedia "Sirius"; the MK
      // type is A0mA1 Va, standardly quoted A1V.)
      { name: 'Sirius', class: 'A1V' },
      // Sirius B: DA2 white dwarf. separationAU = semi-major axis of the
      // relative orbit ≈ 7.50" → ≈ 19.8 AU (period 50.1 yr; range 8.2–31.5 AU).
      // Source: Bond et al. 2017, ApJ 840, 70; solstation.com / chview.nova.org.
      { name: 'Sirius B', class: 'DA2', separationAU: 19.8 },
    ],
  },

  // Procyon (α Canis Minoris) — F-type subgiant/dwarf with a white-dwarf
  // companion. Anchor "Procyon" resolves in hyg-stars.json.
  {
    name: 'Procyon',
    kind: 'multiple',
    components: [
      // Procyon A: F5IV-V. (SIMBAD / Wikipedia "Procyon".)
      { name: 'Procyon', class: 'F5IV-V' },
      // Procyon B: DQZ white dwarf (carbon + metal-rich atmosphere).
      // separationAU = average separation ≈ 15.0 AU (period 40.84 yr, e≈0.4).
      // Source: Bond et al. 2015 (HST astrometry, ApJ 813, 106); Wikipedia
      // "Procyon"; "Analysis of DQZ White Dwarf Evolution through Procyon"
      // (arXiv:2605.14012) for the DQZ class.
      { name: 'Procyon B', class: 'DQZ', separationAU: 15.0 },
    ],
  },

  // Alpha Centauri — the nearest star system. Close A+B binary plus the wide,
  // gravitationally-bound Proxima. Anchor "Rigil Kentaurus" (Alpha Cen A) and
  // "Toliman" (Alpha Cen B) both resolve in hyg-stars.json (HYG catalog names);
  // "Proxima Centauri" resolves in the dim-host supplement (below the HYG cut).
  {
    name: 'Alpha Centauri',
    kind: 'multiple',
    components: [
      // Alpha Cen A (Rigil Kentaurus): G2V. (SIMBAD / Wikipedia "Alpha Centauri".)
      { name: 'Rigil Kentaurus', class: 'G2V' },
      // Alpha Cen B (Toliman): K1V. separationAU = semi-major axis of the A–B
      // orbit ≈ 17.57" → ≈ 23.5 AU (period 79.76 yr; range 11.2–35.6 AU).
      // Source: Wikipedia "Alpha Centauri"; Kervella et al. 2016 (A&A 594, A107).
      { name: 'Toliman', class: 'K1V', separationAU: 23.5 },
    ],
    farCompanions: [
      // Proxima Centauri: M5.5Ve red dwarf, ~13,000 AU (~0.21 ly) from the A–B
      // pair, gravitationally bound. Source: Kervella, Thévenin & Lovis 2017
      // (A&A 598, L7); Wikipedia "Alpha Centauri".
      { name: 'Proxima Centauri', class: 'M5.5Ve', separationAU: 13000 },
    ],
  },

  // --- Pinned famous singles (singleness marker only; NO companion fields) ---
  // Each singleness claim web-verified 2026-07-12 — NOT pinned from memory.
  // (Fomalhaut is deliberately NOT pinned here: it is a wide multiple.)

  // Vega (α Lyrae): A0Va single star — no known stellar companion (only a debris
  // disk and unconfirmed planet candidates). Source: Wikipedia "Vega".
  {
    name: 'Vega',
    kind: 'single',
  },

  // Altair (α Aquilae): A7Vn single star. Its WDS visual companions
  // (WDS 19508+0852 B–G) are all much more distant and "not physically
  // associated" (optical/line-of-sight only). Source: Wikipedia "Altair".
  {
    name: 'Altair',
    kind: 'single',
  },
];

/**
 * Validate the companion table against the schema/discriminator rules above.
 * Pure and side-effect-free (does not throw) so tests and build scripts can call
 * it. Returns { ok, errors } where errors is a list of human-readable problems.
 * This module is otherwise data-only; this helper just centralises the rules.
 *
 * @param {Array} entries - defaults to STELLAR_COMPANIONS
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateStellarCompanions(entries = STELLAR_COMPANIONS) {
  const errors = [];
  const push = (i, msg) => errors.push(`entry[${i}] (${entries[i]?.name ?? '?'}): ${msg}`);

  entries.forEach((e, i) => {
    if (!e || typeof e !== 'object') { push(i, 'not an object'); return; }
    if (typeof e.name !== 'string' || !e.name) push(i, 'missing name');
    if (e.kind !== 'multiple' && e.kind !== 'single') {
      push(i, `invalid kind ${JSON.stringify(e.kind)} (expected 'multiple' | 'single')`);
      return;
    }

    if (e.kind === 'single') {
      // Singleness marker only — must carry no companion fields.
      for (const f of ['components', 'separationAU', 'farCompanions']) {
        if (f in e) push(i, `single entry must not carry companion field '${f}'`);
      }
      return;
    }

    // kind === 'multiple'
    if (!Array.isArray(e.components)) { push(i, 'multiple entry needs components[]'); return; }
    if (e.components.length < 1 || e.components.length > 2) {
      push(i, `components must have 1–2 close stars (has ${e.components.length}); AC10 caps at 2`);
    }
    e.components.forEach((c, ci) => {
      if (!c || typeof c.name !== 'string' || !c.name) push(i, `components[${ci}] missing name`);
      if (!c || typeof c.class !== 'string' || !c.class) push(i, `components[${ci}] missing class`);
      if (ci === 0 && c && 'separationAU' in c) push(i, 'primary (components[0]) must not carry separationAU');
      if (ci > 0 && c && !(typeof c.separationAU === 'number' && c.separationAU > 0)) {
        push(i, `companion components[${ci}] needs a positive separationAU`);
      }
    });
    // A multiple must actually be multiple: a 2nd close star OR a far companion.
    const hasClose2 = e.components.length === 2;
    const hasFar = Array.isArray(e.farCompanions) && e.farCompanions.length > 0;
    if (!hasClose2 && !hasFar) push(i, 'multiple entry has no companion (need 2nd component or farCompanion)');

    if ('farCompanions' in e) {
      if (!Array.isArray(e.farCompanions)) push(i, 'farCompanions must be an array');
      else e.farCompanions.forEach((f, fi) => {
        if (!f || typeof f.name !== 'string' || !f.name) push(i, `farCompanions[${fi}] missing name`);
        if (!f || typeof f.class !== 'string' || !f.class) push(i, `farCompanions[${fi}] missing class`);
        if (!f || !(typeof f.separationAU === 'number' && f.separationAU > 0)) {
          push(i, `farCompanions[${fi}] needs a positive separationAU`);
        }
      });
    }
  });

  return { ok: errors.length === 0, errors };
}

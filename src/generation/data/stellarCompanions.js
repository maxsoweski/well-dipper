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

  // 36 Ophiuchi (Guniibuu) — a real, gravitationally-bound K-dwarf TRIPLE at
  // ~5.9 pc. Represented within the AC10 2-close-star cap: the bright A+B pair
  // as the rendered close binary, the wide K5 tertiary (C) as a far companion
  // (Proxima precedent — §2/§3 of representation-cap.md). Anchor "Guniibuu"
  // (36 Oph A) resolves in hyg-stars.json; the secondary rows HD 155886 (B) +
  // HD 156026 (C) collapse to Guniibuu aliases at catalog regen
  // (process-hyg-catalog.mjs dedup) so the trio is ONE searchable destination.
  {
    name: 'Guniibuu',
    kind: 'multiple',
    components: [
      // 36 Oph A: K1V orange dwarf; IAU name Guniibuu. (A and B are near-identical
      // ~K1 dwarfs.) Source: Wikipedia "36 Ophiuchi".
      { name: 'Guniibuu', class: 'K1V' },
      // 36 Oph B (HD 155886): K1V. separationAU = the A–B mean separation
      // ≈ 82.3 AU (period 471 yr, highly eccentric e≈0.92 → 7 AU periastron,
      // 157 AU apastron). Source: Wikipedia "36 Ophiuchi".
      { name: 'HD 155886', class: 'K1V', separationAU: 82.3 },
    ],
    farCompanions: [
      // 36 Oph C (HD 156026): K5V, orbiting the A–B inner binary at a minimum
      // ≈ 4,400 AU (period >180,000 yr) — bound but far beyond the close-pair
      // slot, so it rides the far-companion mechanism. Source: Wikipedia
      // "36 Ophiuchi".
      { name: 'HD 156026', class: 'K5V', separationAU: 4400 },
    ],
  },

  // 61 Cygni — the high-proper-motion "Flying Star" K-dwarf binary at ~3.5 pc
  // (first star with a measured stellar parallax, Bessel 1838). Anchor
  // "HD 201091" (61 Cyg A) resolves in hyg-stars.json; the "HD 201092" (61 Cyg B)
  // row collapses to an HD 201091 alias at catalog regen so the pair is ONE
  // marker / ONE destination.
  {
    name: 'HD 201091',
    kind: 'multiple',
    components: [
      // 61 Cyg A (HD 201091): K5V. Source: Wikipedia "61 Cygni"; Kervella et al.
      // CHARA/FLUOR radii of "the nearby K5V and K7V stars 61 Cygni A & B".
      { name: 'HD 201091', class: 'K5V' },
      // 61 Cyg B (HD 201092): K7V. separationAU = the A–B orbital semi-major axis
      // ≈ 86 AU (period ~659 yr, e≈0.48 → 44 AU periastron, 124 AU apastron).
      // Source: Wikipedia "61 Cygni".
      { name: 'HD 201092', class: 'K7V', separationAU: 86 },
    ],
  },

  // Zeta Reticuli — a WIDE common-proper-motion pair of two old, Sun-like G
  // dwarfs at ~12 pc, members of the ζ Herculis moving group. There is no close
  // orbit: the secondary is the far-companion mechanism (Proxima precedent), not
  // a rendered close binary, so the primary renders SINGLE. Anchor "Zet-1 Ret"
  // (ζ¹) resolves in hyg-stars.json; the "Zet-2 Ret" (ζ²) row collapses to a
  // Zet-1 Ret alias at catalog regen.
  {
    name: 'Zet-1 Ret',
    kind: 'multiple',
    components: [
      // ζ¹ Reticuli (HD 20766): G2.5V yellow dwarf (catalog spect 'G'). Source:
      // Wikipedia "Zeta Reticuli".
      { name: 'Zet-1 Ret', class: 'G2.5V' },
    ],
    farCompanions: [
      // ζ² Reticuli (HD 20807): G1V yellow dwarf. separationAU = the projected
      // physical separation ≥ ~3,750 AU (mean orbital distance ~9,000 AU, period
      // ≳ 1 Myr) — far beyond any close-pair slot. Source: Wikipedia
      // "Zeta Reticuli".
      { name: 'Zet-2 Ret', class: 'G1V', separationAU: 3750 },
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
 * Far-row promotability predicate (multistar-components-2026-07-19 / AC1).
 * A far companion's class must have a leading letter the component promotion
 * can normalize to a star type, or StarSystemGenerator's emission would fall
 * back to 'M' silently — the table validator rejects it at authoring time
 * instead. LOCAL mirror of StarSystemGenerator.normalizeSpectralClass's
 * acceptance (OBAFGKMD directly; W/C/S/L/T/Y map into that set) so this data
 * module stays dependency-free; the mirror is pinned against the real
 * normalizer by stellarCompanions.promotability.test.js's agreement battery.
 */
function _promotableLead(str) {
  const s = str.trim();
  if (!s) return false;
  const lead = s[0].toUpperCase();
  return 'OBAFGKMD'.includes(lead) || 'WCSLTY'.includes(lead);
}

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
        // Promotability (multistar-components AC1): the class must normalize
        // to a component star type — no silent 'M' fallback at emission.
        if (f && typeof f.class === 'string' && !_promotableLead(f.class)) {
          push(i, `farCompanions[${fi}] class ${JSON.stringify(f.class)} is not promotable to a component star type (no normalizable leading letter)`);
        }
      });
    }
  });

  return { ok: errors.length === 0, errors };
}

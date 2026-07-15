/**
 * RealSystemOverlay — the bulk real-universe overlay merge (AC3/AC4 of
 * real-universe-overlay-2026-07-12, Increment 3, design D1/D2/D5/D7).
 *
 * WHAT: given the DISPLAY NAME of a real catalog star the player is arriving at,
 * this module joins that star to the ingested real data and produces the overlay
 * generation-context fields StarSystemGenerator already consumes (the AC10 /
 * Increment-2 shapes): `companionSpec` (curated multiplicity), `knownPlanets`
 * (archive-shaped planet list), and `farCompanions` (wide members with their
 * archive planets). It also derives the index-aligned display-names object a
 * merged system needs so nav/system UI shows real designations (design D7).
 *
 * INTENT: every arrival at a real catalog star (that is NOT a hand-authored
 * KnownSystems entry) should spawn its REAL contents — its curated companion
 * structure where the table covers it, its known planets from the exoplanet
 * archive, procgen deterministically filling the remainder (Elite as the guide).
 * The star's TYPE stays catalog-sourced (main.js sets ctx.starTypeOverride from
 * the catalog spect — this module never touches it, design D6). This module is
 * the DATA side of the merge: it computes ctx fields and name fragments; the two
 * surgical main.js call sites (warp else / teleport else, design D1) do the
 * wiring, and StarSystemGenerator's D3 known-planet immunity makes the injected
 * planets survive the post-injection passes.
 *
 * JOIN (design D2 — NAME FIRST): the join key is the arrival star's catalog
 * DISPLAY name. Contents host lookup goes through the supplement display-name →
 * archive-hostname bridge ('Proxima Centauri' → 'Proxima Cen'; 'Kepler-90' →
 * 'KOI-351'); HYG stars whose display name already equals the archive hostname
 * join directly. The companion table joins by its entry `name` (display form).
 * Position is a DISAMBIGUATOR ONLY — never a veto on a unique-name join (archive
 * sy_dist disagrees with HYG distance by up to ~141 pc on distant giants, so a
 * position veto would silently drop most bright hosts). Position breaks ties
 * ONLY when the arrival name is duplicated in the catalog AND that name resolves
 * to a contents host; today's data has zero such overlaps and a test pins that.
 *
 * READINESS (design D5): contents + supplement ride RealStarCatalog.load()'s one
 * Promise.all, so any arrival that resolved a real catalog star implies this
 * index is ready — no separate race, no await inside generate. If the overlay is
 * queried before it is ready it MUST console.warn (never silently procgen — an
 * AC3 miss must be observable), and apply no overlay fields.
 *
 * DELIBERATE NON-GOALS: no new KnownSystems registry entries (findAt at Sirius
 * stays null — the overlay path, not authoring); no NavComputer/search work
 * (Increment 4); this module does NOT set ctx.starTypeOverride (main.js owns it,
 * design D6) and does NOT modify StarSystemGenerator (the D3 immunity guards live
 * there, wired by the companion builder). Far-companion synthesis is table-only
 * (structure honesty is scoped to the curated table, design D4).
 */

import { STELLAR_COMPANIONS } from './data/stellarCompanions.js';
import { deriveAuthoredNames } from './KnownSystemAuthoring.js';

// Local identity tolerance for the D2 same-name position disambiguator, mirroring
// RealStarCatalog.POSITION_MATCH_TOL (0.1 pc). Defined locally — NOT imported —
// so this module never forms an import cycle with RealStarCatalog (which imports
// this one to build its overlay). The disambiguator only fires on catalog-side
// duplicated names that are also join targets (an empty set on today's data), so
// this constant is exercised by unit tests, not by any production arrival.
const DISAMBIG_TOL_KPC = 0.0001; // kpc (0.1 pc)

const _dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class RealSystemOverlay {
  /**
   * @param {object|null} data — optional { contentsHosts, supplementStars,
   *   catalogStars } to populate immediately (browser: from fetch; tests: from
   *   fs). Omit to construct an EMPTY, not-ready overlay (RealStarCatalog builds
   *   it in its constructor and calls setData() once load() resolves).
   */
  constructor(data = null) {
    this._contentsIndex = new Map();  // archive hostname -> host record
    this._bridge = new Map();         // supplement display name -> archive hostname
    this._catalogByName = new Map();  // catalog display name -> [catalog star records]
    this._ambiguousNames = new Set(); // join names that collide with a duplicated catalog name (D2 gate)
    this._ready = false;
    if (data) this.setData(data);
  }

  /** True once the contents/supplement/catalog indexes are populated (design D5). */
  get ready() { return this._ready; }

  /** The set of join names for which position disambiguation applies (design D2).
   *  Empty on today's data — pinned by test; exposed so the pin can assert it. */
  get ambiguousJoinNames() { return this._ambiguousNames; }

  /**
   * Populate the join indexes. ONE code path for the index/join logic regardless
   * of data source (design D5 latitude): the browser fetches the JSON and the
   * tests read the same files off disk, both landing here.
   *
   * @param {object} p
   * @param {Array} p.contentsHosts   — real-system-contents.json `hosts`
   * @param {Array} p.supplementStars — real-star-supplement.json `stars`
   * @param {Array|null} p.catalogStars — hyg ∪ supplement (for the D2 dup gate);
   *   optional. When omitted, the join is pure-name (no dup disambiguation).
   */
  setData({ contentsHosts = [], supplementStars = [], catalogStars = null } = {}) {
    this._contentsIndex.clear();
    this._bridge.clear();
    this._catalogByName.clear();
    this._ambiguousNames.clear();

    for (const h of contentsHosts) {
      if (h && typeof h.name === 'string') this._contentsIndex.set(h.name, h);
    }
    // Supplement carries display `name` + archive `hostname` (the bridge). HYG
    // stars are not in the supplement, so their display name falls through to
    // itself (name === hostname for the 116 HYG hosts that also host planets).
    for (const s of supplementStars) {
      if (s && typeof s.name === 'string' && typeof s.hostname === 'string') {
        this._bridge.set(s.name, s.hostname);
      }
    }
    // D2 disambiguator gate: a name is "ambiguous" ONLY if it is duplicated in the
    // catalog AND resolves to a contents host (otherwise a name collision can
    // never mis-attach planets). On today's data this set is empty (pinned).
    if (Array.isArray(catalogStars)) {
      for (const s of catalogStars) {
        if (!s || typeof s.name !== 'string') continue;
        const arr = this._catalogByName.get(s.name);
        if (arr) arr.push(s); else this._catalogByName.set(s.name, [s]);
      }
      for (const [name, stars] of this._catalogByName) {
        if (stars.length <= 1) continue;
        const hostname = this._bridge.get(name) ?? name;
        if (this._contentsIndex.has(hostname)) this._ambiguousNames.add(name);
      }
    }
    this._ready = true;
  }

  /**
   * Resolve a real catalog star's DISPLAY name (+ optional arrival position) to
   * the overlay fields it supplies. Pure — returns a fresh object each call, only
   * with the keys the data actually supplies (omit, never null: mirrors the AC8
   * discipline at the ctx level). Keys:
   *   - companionSpec — the curated STELLAR_COMPANIONS entry (when the table
   *     covers this star by its entry name); drives forced binary / pinned
   *     single. When the table does NOT cover it, a synthesized single may be
   *     supplied instead: { kind:'single', source:'archive-snum' } for a
   *     snum==1 host, or { kind:'single', source:'pin-by-default' } for an
   *     un-tabled, un-hosted real star (FIX-3 pin-by-default).
   *   - knownPlanets  — archive-shaped planet list (when a contents host joins).
   *   - farCompanions — wide members with their archive planets (only when the
   *     table entry supplies them).
   *   - tableEntry / host — the resolved sources (for name derivation / tests).
   *
   * @param {string} starName — the arrival star's catalog display name
   * @param {{x,y,z}|null} pos — arrival position (D2 disambiguator only)
   * @returns {{ companionSpec?, knownPlanets?, farCompanions?, tableEntry?, host? }}
   */
  resolve(starName, pos = null) {
    const result = {};
    if (!starName) return result;

    // ── Companion structure (curated table, joined by entry name — design D2) ──
    const tableEntry = STELLAR_COMPANIONS.find((e) => e.name === starName) || null;
    if (tableEntry) {
      result.tableEntry = tableEntry;
      // Hand the whole table entry as the companionSpec (StarSystemGenerator reads
      // kind + components for the close pair; a 'single' entry suppresses the roll).
      result.companionSpec = tableEntry;
      // Far companions carry their archive planets. Emitted ONLY when the table
      // supplies them (design D2 / D4 — structure honesty is table-scoped).
      const fars = (tableEntry.farCompanions ?? []).map((fc) => {
        const out = { name: fc.name, class: fc.class, separationAU: fc.separationAU };
        const planets = this._planetsForName(fc.name);
        if (planets) out.planets = planets;
        return out;
      });
      if (fars.length > 0) result.farCompanions = fars;
    }

    // ── Known planets (exoplanet archive, name-first host join — design D2) ──
    const host = this._resolveHost(starName, pos);
    if (host) {
      result.host = host;
      result.knownPlanets = this._toKnownPlanets(host.planets);
      // ── snum==1 single-pin (design D7; ADOPTED 2026-07-13) ──────────────
      // A non-table host whose archive record says the system has exactly one
      // star suppresses the procgen companion roll: synthesize a 'single'
      // companionSpec that rides the existing applyToContext → forceBinary=false
      // path (no StarSystemGenerator edit). One-directional (only fires for
      // snum===1, can only SUPPRESS fabrication, never add structure) and
      // table-wins by construction — the `!tableEntry` guard means the pin only
      // fires where the curated table did NOT already set companionSpec above.
      if (!tableEntry && host.snum === 1) {
        result.companionSpec = { kind: 'single', source: 'archive-snum' };
      }
    }

    // ── Pin-by-default single (FIX-3; Max ruling 2026-07-15) ──────────────
    // A REAL catalog star the curated table does NOT cover and the exoplanet
    // archive does NOT host arrives SINGLE — it never rolls a fabricated
    // stellar companion. resolve() is only ever invoked for a resolved
    // real-catalog arrival (the main.js warp + teleport real-star branches),
    // so "no tableEntry and no host" here is exactly an un-tabled, un-hosted
    // REAL star; procgen (non-real) stars never reach this module and keep
    // their live binary roll. One-directional (rides the same forceBinary=false
    // path as the archive-snum pin — only suppresses fabrication, never adds
    // structure; no StarSystemGenerator edit) and data-wins by construction:
    // the table (above) and the archive snum (BOTH directions — snum==1 pins,
    // snum>=2 kept its roll) already decided wherever they cover, so this
    // default only fills the no-data remainder. Precedence: table > snum > pin.
    if (!tableEntry && !host) {
      result.companionSpec = { kind: 'single', source: 'pin-by-default' };
    }

    return result;
  }

  /**
   * Apply the overlay fields for `starName` onto a galaxy context, in place.
   * Only sets a key when the overlay supplies it (omit-not-null at the ctx level,
   * so a zero-data arrival leaves ctx byte-identical to pure procgen). Never
   * touches ctx.starTypeOverride (main.js owns star type, design D6).
   *
   * Design D5: if the overlay is not ready this console.warns and applies nothing
   * — an AC3 miss must be observable, never a silent procgen fallthrough.
   *
   * @param {object} ctx — the galaxy context (mutated + returned)
   * @param {string} starName — arrival star display name
   * @param {{x,y,z}|null} pos — arrival position (D2 disambiguator only)
   * @returns {object} ctx
   */
  applyToContext(ctx, starName, pos = null) {
    if (!ctx) return ctx;
    if (!this._ready) {
      console.warn(
        `[RealSystemOverlay] applyToContext("${starName}") before catalog load — ` +
        'overlay contents skipped (arrival falls through to procgen).',
      );
      return ctx;
    }
    const overlay = this.resolve(starName, pos);
    if (overlay.companionSpec) ctx.companionSpec = overlay.companionSpec;
    if (overlay.knownPlanets) ctx.knownPlanets = overlay.knownPlanets;
    if (overlay.farCompanions) ctx.farCompanions = overlay.farCompanions;
    return ctx;
  }

  /**
   * Derive the index-aligned display-names object for a MERGED system (design D7,
   * data side). Same { system, star, star2, planets:[{name, moons}] } shape
   * spawnSystem consumes and the AC5 authoring path produces — reusing
   * deriveAuthoredNames keeps ONE naming convention across authored and merged
   * systems. Fragments: system/star = the arrival's catalog display name; star2 =
   * the table's secondary component name when a table binary is present; known
   * planets = their archive designations (read off the injected wrappers); procgen
   * fill keeps the `<system> <letter>` convention. Builder-B wires the result onto
   * `_knownSystemNames` at the two call sites.
   *
   * @param {string} starName — arrival star display name (the system/primary name)
   * @param {object} systemData — the generated (merged) systemData
   * @param {object|null} [tableEntry] — the resolved table entry (defaults to a
   *   fresh lookup by starName; pass resolve().tableEntry to avoid re-resolving)
   * @returns {{ system, star, star2, planets }}
   */
  deriveMergedNames(starName, systemData, tableEntry = undefined) {
    const entry = tableEntry !== undefined
      ? tableEntry
      : (STELLAR_COMPANIONS.find((e) => e.name === starName) || null);
    // deriveAuthoredNames reads companion.components?.[k]?.name defensively, so a
    // null table entry (a non-table contents host like TRAPPIST-1) yields
    // star=arrival name, star2=null, and procgen-lettered planet names.
    return deriveAuthoredNames({ name: starName }, entry || {}, systemData);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Resolve a display name to its contents host via the bridge, honoring the D2
   *  same-name position disambiguator. Returns the host record or null. */
  _resolveHost(starName, pos) {
    const hostname = this._bridge.get(starName) ?? starName;
    const host = this._contentsIndex.get(hostname);
    if (!host) return null;
    // Unique-name join: attach unconditionally (NO position veto — design D2).
    if (!this._ambiguousNames.has(starName)) return host;
    // Duplicated catalog name (empty set on today's data): the contents belong to
    // the same-named catalog star nearest the host's ingested position; attach
    // only when THIS arrival is that star.
    return this._isDisambiguatedOwner(starName, host, pos) ? host : null;
  }

  /** D2 tiebreak: is `pos` the same-named catalog star nearest to `host`? */
  _isDisambiguatedOwner(name, host, pos) {
    if (!pos) return true; // no arrival position → fall back to name join
    const sameNamed = this._catalogByName.get(name) || [];
    if (sameNamed.length <= 1) return true;
    let owner = null;
    let best = Infinity;
    for (const s of sameNamed) {
      const d = _dist(s, host);
      if (d < best) { best = d; owner = s; }
    }
    return owner ? _dist(owner, pos) < DISAMBIG_TOL_KPC : true;
  }

  /** Archive planets for a display name, via the bridge → contents host, or null. */
  _planetsForName(displayName) {
    const hostname = this._bridge.get(displayName) ?? displayName;
    const host = this._contentsIndex.get(hostname);
    return host ? this._toKnownPlanets(host.planets) : null;
  }

  /** Normalize a contents host's planets to the canonical archive-shaped
   *  knownPlanets list StarSystemGenerator consumes (letter/name always present;
   *  numerics nullable). Fresh objects — no shared mutable state across calls. */
  _toKnownPlanets(planets) {
    return (planets ?? []).map((p) => ({
      letter: p.letter,
      name: p.name,
      periodDays: p.periodDays ?? null,
      smaAU: p.smaAU ?? null,
      massEarth: p.massEarth ?? null,
      radiusEarth: p.radiusEarth ?? null,
      eccen: p.eccen ?? null,
    }));
  }
}

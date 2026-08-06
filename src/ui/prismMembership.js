// prismMembership — pure co-membership resolution for the prism view (AC2).
//
// A real multi-star system whose members render as SEPARATE prism markers (α Cen
// A+B at Rigil's position + Proxima at its own catalog position) must visibly say
// "we are ONE system." The presentation carries that statement — positions never
// move (interview ruling 1) — via a membership label suffix ('Proxima Centauri ·
// Alpha Centauri') plus a hover/selection tether between the markers.
//
// This module owns only the RESOLUTION: given a marker `star`, its cached arrival
// multiplicity `mult` (the _glyphMult result — {farNames,...}) and the set of
// names that render as their OWN marker (_localStarNames), it answers
//   { isFarMember, systemName, memberMarkerNames }
// oracle/alias-backed (mult.farNames tells a marker whether it is a wide member or
// a primary; findByAlias resolves the system name + primary component). It is pure
// (no canvas, no NavComputer state) so it is unit-tested headless, same split as
// labelPlacement.js / farCompanionChips.js. NavComputer projects the marker names
// to screen points and draws the tether; this module never draws.
//
// DELIBERATE NON-GOALS: no drawing, no screen geometry, no marker movement, no
// obligations on procgen systems or known singles (mult.farNames empty → no cue).

const NONE = Object.freeze({ isFarMember: false, systemName: null, memberMarkerNames: [] });

/**
 * Resolve a prism marker's co-membership in a known multi-star system.
 *
 * Two entry roles mirror _glyphDotCount's split:
 *   • FAR marker — the marker's own name is in `mult.farNames` (the oracle routed
 *     it into a larger system via an alias, e.g. Proxima → Alpha Centauri). The
 *     system name and its PRIMARY component come from `findByAlias`; the primary
 *     is a co-member marker when it renders separately (present in localStarNames).
 *   • PRIMARY/close marker — `mult.farNames` lists the system's wide members; the
 *     ones present in localStarNames render as their OWN markers → they are the
 *     co-members (36 Oph's deduped tertiary has no marker → no co-member → no cue).
 *
 * Procgen stars, known singles, and any marker whose system renders as ONE marker
 * answer NONE (isFarMember:false, systemName:null, memberMarkerNames:[]).
 *
 * @param {{name?:string, wx?:number, wy?:number, wz?:number}|null|undefined} star
 * @param {{farNames?:string[]}|null|undefined} mult  the _glyphMult result
 * @param {object} [opts]
 * @param {Set<string>|null} [opts.localStarNames]  names that render as own markers
 * @param {(name:string, pos:{x,y,z}|null)=>({name?:string,_companion?:object}|null)|null} [opts.findByAlias]
 * @returns {{isFarMember:boolean, systemName:string|null, memberMarkerNames:string[]}}
 */
export function resolveMembership(star, mult, opts = {}) {
  if (!star || !star.name || !mult) return NONE;
  const farNames = mult.farNames;
  if (!Array.isArray(farNames) || farNames.length === 0) return NONE;

  const localStarNames = opts.localStarNames || null;
  const findByAlias = opts.findByAlias || null;
  const inMarkerSet = (name) => !localStarNames || localStarNames.has(name);
  const pos = (star.wx != null) ? { x: star.wx, y: star.wy, z: star.wz } : null;

  // FAR marker: this marker's own name is a wide member of a larger system.
  if (farNames.includes(star.name)) {
    const entry = findByAlias ? findByAlias(star.name, pos) : null;
    if (!entry) return NONE; // can't name the system → no cue, no suffix
    const systemName = entry.name || null;
    const primaryName = entry._companion?.components?.[0]?.name || null;
    const memberMarkerNames = [];
    if (primaryName && primaryName !== star.name && inMarkerSet(primaryName)) {
      memberMarkerNames.push(primaryName);
    }
    return { isFarMember: true, systemName, memberMarkerNames };
  }

  // PRIMARY/close marker: wide members that render as their own markers are the
  // co-members. Members drawn INTO this marker (no separate row) contribute none.
  const memberMarkerNames = [];
  for (const fn of farNames) {
    if (fn && fn !== star.name && inMarkerSet(fn)) memberMarkerNames.push(fn);
  }
  if (memberMarkerNames.length === 0) return NONE; // renders as one marker → no cue

  let systemName = star.name;
  if (findByAlias) {
    const entry = findByAlias(star.name, pos);
    if (entry && entry.name) systemName = entry.name;
  }
  return { isFarMember: false, systemName, memberMarkerNames };
}

/**
 * Compose a marker's prism label, appending the membership suffix for a FAR
 * member so the deferred label pass measures/declutters the full string (the
 * measureText cache keys by the string, not the star). Primary/close markers and
 * everything answering NONE keep their bare name.
 *
 * @param {string} baseName  the marker's own display name
 * @param {{isFarMember?:boolean, systemName?:string|null}|null|undefined} membership
 * @returns {string}
 */
export function membershipLabel(baseName, membership) {
  if (membership && membership.isFarMember && membership.systemName) {
    return `${baseName} · ${membership.systemName}`;
  }
  return baseName;
}

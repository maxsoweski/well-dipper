// src/util/lab-subject.js
// ─────────────────────────────────────────────────────────────────────────────
// THE INSTRUMENT-E SUBJECT CONTRACT. One pure function, no imports, no renderer.
//
//     assertLabSubject(subject) -> the same object, or THROWS
//
// ⛔⛔ WHY THIS IS A MODULE AND NOT SIX LINES INSIDE `_lab.resolveBody`. It is the guard on a FALSE
// PASS, and a guard nothing can test is the thing this lane has shipped twice already ("two controls
// shipped dead in this lane and only hostile review caught them"). `src/main.js` is the application
// entry — importing it builds a scene and touches WebGL — so an assertion written inside it can only
// ever be pinned by scanning its source text, which proves the CHARACTERS are present and nothing
// about what they do. Extracted, the refusal is exercised directly by
// tests/lab-subject-contract.test.js, and the mutation that deletes it reds a behavioural assertion
// rather than a grep.
//
// ⭐ THE LINE THE REFUSAL IS DRAWN ON. `_lab` answers `{ok:false, reason}` everywhere, so a throw is
// a new shape in that object and it is reserved for one question:
//   · THROW    — "I do not know what you asked for." No body could be meant, so RETURNING a body is
//                always wrong, and returning `{ok:false}` invites a caller that does not check it to
//                carry on and photograph planet 0 anyway.
//   · ok:false — "I understood you and this system has no such body." Stays in the resolver, still
//                reports `availableNames`, and is the right answer for a well-formed typo.
//
// ⚠ AN EMPTY `{}` IS DELIBERATELY LEGAL. Five call sites pass it as a default (`frameBody`,
// `forceGate`, `releaseGate`, `restoreGameMaterial`, the fps hook), so refusing it would be a
// behaviour change nobody asked for. The resolver REPORTS it instead, as `resolvedBy: 'default'`
// rather than `'index'` — see `SUBJECT_IS_ADDRESSED` below.
// ─────────────────────────────────────────────────────────────────────────────

/** The kinds the SIM tree actually carries. A subject naming anything else is a caller bug. */
export const LAB_SUBJECT_KINDS = Object.freeze(['planet', 'moon', 'star']);

/** The keys that make a subject ADDRESSED rather than defaulted. `name` is handled on its own path. */
export const LAB_SUBJECT_INDEX_KEYS = Object.freeze(['kind', 'p', 'm', 's']);

/**
 * True iff the caller actually addressed a body, by name or by index.
 *
 * ⭐ IT EXISTS SO A CAPTION CANNOT SPELL "AIMED AT" AND "LANDED ON" THE SAME WAY. An index subject is
 * a discovery convenience the caller chose; an empty one is a default the caller did not choose, and
 * Instrument E's whole job is telling Max which body a shot was aimed at.
 */
export function labSubjectIsAddressed(subject) {
  if (typeof subject !== 'object' || subject === null) return false;
  if (typeof subject.name === 'string' && subject.name !== '') return true;
  return LAB_SUBJECT_INDEX_KEYS.some((k) => k in subject);
}

/**
 * Refuse a subject that names no body at all.
 *
 * ⛔ THE DEFECT THIS CLOSES, MEASURED 2026-08-21 AND NOT HYPOTHETICAL: `resolveBody` read
 * `subject.name` off a STRING, got `undefined`, fell into the index branch and defaulted to
 * `kind:'planet', p:0`. All seven `body.moon.*` names in `lab-procedural-88` resolved to
 * `body.planet.e7eae7` and every one returned `ok:true`. B7's gate replays Instrument E against
 * recorded body NAMES, never indices, so this would shoot the wrong body and report success.
 *
 * @param {object} subject  `{name}` or `{kind,p,m}` or `{kind:'star',s}` — or `{}` for the default.
 * @returns {object} the same subject, so call sites can wrap in place.
 * @throws {TypeError} when the subject names no body.
 */
export function assertLabSubject(subject) {
  if (typeof subject !== 'object' || subject === null || Array.isArray(subject)) {
    const got = Array.isArray(subject) ? 'array' : typeof subject;
    const asName = typeof subject === 'string' ? ` Pass { name: ${JSON.stringify(subject)} } if you meant the name.` : '';
    throw new TypeError(
      `_lab.resolveBody: subject must be an object, got ${got} (${JSON.stringify(subject) ?? String(subject)}).`
      + ` It takes {name} or {kind,p,m}.${asName}`
      + ' ⛔ This used to fall through to planet 0 and return ok:true, which is how a replay'
      + ' photographs the wrong body and reports success.',
    );
  }
  // ⛔ `'name' in subject` RATHER THAN A TRUTHINESS TEST, and that is the whole bug one level down:
  // the resolver branched on `if (subject.name)`, so `{name: ''}` and `{name: null}` skipped the name
  // path in silence and resolved by index instead. A caller who supplied the key meant the name.
  if ('name' in subject && (typeof subject.name !== 'string' || subject.name === '')) {
    throw new TypeError(
      `_lab.resolveBody: subject.name must be a non-empty string, got ${JSON.stringify(subject.name)}.`
      + ' A falsy `name` used to skip the name branch silently and resolve by index instead.',
    );
  }
  if ('kind' in subject && !LAB_SUBJECT_KINDS.includes(subject.kind)) {
    throw new TypeError(
      `_lab.resolveBody: unknown kind ${JSON.stringify(subject.kind)}; expected one of `
      + `${LAB_SUBJECT_KINDS.map((k) => `'${k}'`).join(', ')}.`
      + ' An unrecognised kind matched no row and reported `no <kind> at p=…`, which reads as "this'
      + ' system lacks that body" rather than "that is not a kind".',
    );
  }
  return subject;
}

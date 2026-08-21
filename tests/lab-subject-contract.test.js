// tests/lab-subject-contract.test.js
// ─────────────────────────────────────────────────────────────────────────────
// INSTRUMENT E's SUBJECT CONTRACT — the guard on a FALSE PASS.
//
// ⛔ WHAT THIS SUITE IS FOR, AND WHY IT IS BEHAVIOURAL RATHER THAN A SOURCE SCAN. The defect it
// covers is not "resolveBody crashes"; it is "resolveBody returns `ok:true` for a body the caller
// never asked for". Measured 2026-08-21: all seven `body.moon.*` names in `lab-procedural-88`
// resolved to `body.planet.e7eae7`, because `subject.name` read off a STRING is `undefined` and the
// index branch defaults to `kind:'planet', p:0`. B7's gate replays Instrument E against recorded
// body NAMES, so that would photograph the wrong body and report success.
//
// ⭐ THE GUARD LIVES IN ITS OWN MODULE SO THIS FILE CAN CALL IT. `src/main.js` is the app entry —
// importing it builds a scene and touches WebGL — so an inline assertion there could only be pinned
// by scanning source text, which proves the characters exist and nothing about what they do. This
// lane has shipped two dead controls already; a grep would have been a third.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  assertLabSubject, labSubjectIsAddressed, LAB_SUBJECT_KINDS, LAB_SUBJECT_INDEX_KEYS,
} from '../src/util/lab-subject.js';
import { subjectLighting, LIGHTING } from '../src/camera/agentFraming.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('A — the refusals: "I do not know what you asked for"', () => {
  it('⛔⛔ THE MEASURED DEFECT: a bare NAME STRING is refused, not silently read as planet 0', () => {
    expect(() => assertLabSubject('body.moon.e7eae7')).toThrow(TypeError);
    // …and the message hands the caller the exact repair, because the call site is what B7 records.
    expect(() => assertLabSubject('body.moon.e7eae7'))
      .toThrow(/Pass \{ name: "body\.moon\.e7eae7" \} if you meant the name/);
  });

  it('every non-object subject is refused, and the message names what arrived', () => {
    for (const bad of [42, 0, true, false, null, undefined, ['body.planet.a'], () => {}]) {
      // `undefined` is the one exception and it is deliberate: it is what a defaulted parameter
      // supplies, so the resolver's own `subject = {}` default is what handles it.
      if (bad === undefined) { expect(() => assertLabSubject(bad)).toThrow(TypeError); continue; }
      expect(() => assertLabSubject(bad), String(bad)).toThrow(TypeError);
    }
  });

  it('⭐ a FALSY `name` KEY is refused rather than falling through to the index branch', () => {
    // This is the same bug one level down. The resolver branched on `if (subject.name)`, so
    // `{name: ''}` and `{name: null}` skipped the name path in SILENCE and resolved by index — a
    // caller who supplied the key meant the name, and got planet 0.
    for (const bad of ['', null, undefined, 0, 42, {}]) {
      expect(() => assertLabSubject({ name: bad }), JSON.stringify(bad)).toThrow(/name must be a non-empty string/);
    }
  });

  it('an unrecognised `kind` is refused rather than reported as a missing body', () => {
    // `no planetoid at p=0` reads as "this system lacks that body". It is not: it is not a kind.
    for (const bad of ['planetoid', 'Planet', 'asteroid', '', null, 7]) {
      expect(() => assertLabSubject({ kind: bad }), String(bad)).toThrow(/unknown kind/);
    }
    expect(LAB_SUBJECT_KINDS).toEqual(['planet', 'moon', 'star']);
  });
});

describe('B — what stays legal, so the refusal cannot quietly widen', () => {
  it('⚠ the EMPTY subject is legal and still means the default body', () => {
    // Five call sites pass `{}` deliberately — frameBody, forceGate, releaseGate,
    // restoreGameMaterial and the fps hook. Refusing it would be a behaviour change nobody asked
    // for; the resolver REPORTS it instead. ⛔ If this ever starts throwing, those five break and
    // the breakage looks like "the lab stopped working", not like a contract change.
    expect(() => assertLabSubject({})).not.toThrow();
    expect(assertLabSubject({})).toEqual({});
  });

  it('every well-formed subject shape the resolver documents is accepted', () => {
    const good = [
      { name: 'body.planet.e7eae7' },
      { kind: 'planet', p: 0 },
      { kind: 'moon', p: 2, m: 1 },
      { kind: 'star', s: 1 },
      { kind: 'moon', p: 0, m: null },
      { name: 'body.moon.abc', kind: 'planet', p: 3 },   // name wins downstream; both are well-formed
    ];
    for (const s of good) expect(() => assertLabSubject(s), JSON.stringify(s)).not.toThrow();
  });

  it('it returns the SAME object, so a call site can wrap in place', () => {
    const s = { kind: 'moon', p: 1, m: 0 };
    expect(assertLabSubject(s)).toBe(s);
  });
});

describe('C — addressed vs defaulted, which is what a caption must not confuse', () => {
  it('⭐ a subject that names or indexes a body is ADDRESSED; an empty one is not', () => {
    expect(labSubjectIsAddressed({ name: 'body.planet.x' })).toBe(true);
    for (const k of LAB_SUBJECT_INDEX_KEYS) expect(labSubjectIsAddressed({ [k]: 0 }), k).toBe(true);
    expect(labSubjectIsAddressed({})).toBe(false);
    // ⛔ AND A FALSY-BUT-PRESENT INDEX STILL COUNTS AS ADDRESSED. `{p: 0}` is planet 0 BY REQUEST,
    // and `{}` is planet 0 by default; a truthiness test would spell those the same and that is the
    // whole distinction this function exists to keep.
    expect(labSubjectIsAddressed({ p: 0 })).toBe(true);
    expect(labSubjectIsAddressed({ m: 0 })).toBe(true);
  });

  it('a non-object is never addressed — it reports false rather than throwing', () => {
    // ⚠ IT DOES NOT THROW, DELIBERATELY: this is a REPORTER and `assertLabSubject` is the refusal.
    // A reporter that throws cannot be used to build the caption that explains the throw.
    for (const bad of ['body.planet.a', 42, null, undefined]) {
      expect(labSubjectIsAddressed(bad), String(bad)).toBe(false);
    }
  });
});

describe('D — the wiring, because an extracted guard that nobody calls is a dead control', () => {
  it('⛔ src/main.js CALLS the guard, and no longer carries its own copy', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/import \{ assertLabSubject, labSubjectIsAddressed \} from '\.\/util\/lab-subject\.js'/);
    expect(main).toMatch(/^\s*assertLabSubject\(subject\);$/m);
    expect(main).toMatch(/resolvedBy = labSubjectIsAddressed\(subject\) \? 'index' : 'default'/);
    // …and the resolver must not have kept a second, drifting copy of the checks.
    expect(main).not.toMatch(/subject\.name must be a non-empty string/);
  });

  it('⛔ the guard module imports NOTHING — it must stay callable from a headless test', () => {
    expect(read('src/util/lab-subject.js')).not.toMatch(/^\s*import\s/m);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// INSTRUMENT FIX 2 — the freeze-pose false negative.
//
// ⛔ THE DEFECT, MEASURED TWICE ON 2026-08-21: `freezeFrame()` pins orbit phase to 0 and teleports
// the body, so the frozen pose can put the subject's NIGHT SIDE to camera. A gas giant framed while
// frozen rendered a fully black disc that read exactly like a broken shader; `thawFrame()` and a
// re-frame showed a correctly lit, banded planet. The existing rule ("freeze FIRST, then frameBody")
// guarantees the frame is not MOVING and says nothing about whether the subject is LIT.
// ═════════════════════════════════════════════════════════════════════════════
describe('E — subject lighting: the sign convention, which is the whole fix', () => {
  const BODY = { x: 0, y: 0, z: 0 };
  // `lightDir` is the SUBSTELLAR direction: from the body TOWARD its star. The star is at +X here.
  const TOWARD_STAR = { x: 1, y: 0, z: 0 };

  it('⭐ camera BETWEEN star and body = full disc; camera BEHIND the body = black disc', () => {
    // ⛔ THIS IS THE ASSERTION THAT WOULD CATCH A FLIPPED SIGN, and a flipped sign is the one way to
    // ship this fix inverted — it would refuse every LIT shot and pass every black one, which is
    // strictly worse than not having it.
    const front = subjectLighting({ x: 10, y: 0, z: 0 }, BODY, TOWARD_STAR);
    expect(front.litFraction).toBe(1);
    expect(front.subSolarAngleDeg).toBe(0);
    expect(front.unlit).toBe(false);
    expect(front.note).toBe(null);

    const behind = subjectLighting({ x: -10, y: 0, z: 0 }, BODY, TOWARD_STAR);
    expect(behind.litFraction).toBe(0);
    expect(behind.subSolarAngleDeg).toBe(180);
    expect(behind.unlit).toBe(true);
    expect(behind.note).toMatch(/SUBJECT IS UNLIT/);
    // …and the note has to name the frozen pose, because that is the cause a reader must consider
    // before concluding the shader is broken.
    expect(behind.note).toMatch(/freezeFrame\(\) pins orbit phase to 0/);
  });

  it('half phase is exactly half, and the angle is the standard one', () => {
    const side = subjectLighting({ x: 0, y: 0, z: 10 }, BODY, TOWARD_STAR);
    expect(side.litFraction).toBeCloseTo(0.5, 9);
    expect(side.subSolarAngleDeg).toBeCloseTo(90, 6);
    expect(side.unlit).toBe(false);
    expect(side.mostlyNight).toBe(false);
  });

  it('the two thresholds are readability bounds and they bracket the right side of half phase', () => {
    // ⚠ Declared as readability bounds rather than physics — illumination is continuous and there is
    // no physical edge, so the gate asserts the ORDERING and the direction, not a magic number.
    expect(LIGHTING.UNLIT).toBeLessThan(LIGHTING.MOSTLY_NIGHT);
    expect(LIGHTING.MOSTLY_NIGHT).toBeLessThan(0.5);
    // a thin crescent warns but is not refused; effectively nothing lit is refused.
    const crescent = subjectLighting({ x: -0.85, y: 0, z: Math.sqrt(1 - 0.85 ** 2) }, BODY, TOWARD_STAR);
    expect(crescent.mostlyNight).toBe(true);
    expect(crescent.unlit).toBe(false);
    expect(crescent.note).toMatch(/MOSTLY NIGHT SIDE/);
  });

  it('⛔ an UNKNOWN light is reported as unknown and refuses NOTHING — never guessed', () => {
    // A plain moon carries no holder. Refusing a shot because we could not find a light would make
    // the instrument unusable on exactly the bodies Step 10 exists to put on screen.
    for (const bad of [null, undefined]) {
      const r = subjectLighting({ x: 1, y: 0, z: 0 }, BODY, bad);
      expect(r.unlit).toBe(false);
      expect(r.litFraction).toBe(null);
      expect(r.note).toMatch(/lighting UNKNOWN/);
    }
  });

  it('⛔ a ZERO-LENGTH vector cannot sail past the refusal as "lit"', () => {
    // Camera exactly at the body, or an unset light, normalises to NaN — and NaN compares FALSE
    // against every threshold, so `unlit` would be false and a black frame would pass.
    expect(subjectLighting(BODY, BODY, TOWARD_STAR).litFraction).toBe(null);
    expect(subjectLighting({ x: 1, y: 0, z: 0 }, BODY, { x: 0, y: 0, z: 0 }).litFraction).toBe(null);
    expect(subjectLighting(BODY, BODY, TOWARD_STAR).unlit).toBe(false);
  });

  it('⛔ frameBody REFUSES an unlit subject, and the refusal is overridable', () => {
    const main = read('src/main.js');
    expect(main).toMatch(/if \(lighting\.unlit && opts\.allowUnlit !== true\)/);
    expect(main).toMatch(/const lighting = subjectLighting\(camera\.position, worldPos, r\.holder\?\._lightDir \|\| null\)/);
    // …and it reports on the SUCCESS path too, so the `mostlyNight` band is visible without a refusal.
    expect(main).toMatch(/^\s*lighting,$/m);
    // ⚠ THE REMEDY MUST NAME THE FREEZE, because that is the cause that fired twice.
    expect(main).toMatch(/the scene IS frozen — thawFrame\(\)/);
  });
});

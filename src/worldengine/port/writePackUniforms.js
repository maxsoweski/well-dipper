// src/worldengine/port/writePackUniforms.js
// The DRIVER PACK CONTRACT (PLAN §4 "Step 5", 5a) and its single shared uniform writer.
//
//   pack(condition, ctx) -> { drivers, attributes }
//   ctx = { macroSeed, displayRadiusEarth, animRate, gates, relevance }
//   writePackUniforms(uniforms, drivers, ctx) -> void
//
// Packs emit **sizeKm-shaped** drivers. This module is the ONE place that turns a size in km
// into a shader frequency, so the km→frequency law cannot fork per pack.
//
// ⭐ WHY `displayRadiusEarth` IS A REQUIRED PARAMETER AND NOT AN OPTIONAL ONE WITH A DEFAULT
// -------------------------------------------------------------------------------------------
// 18 lab uniforms resolve as `featureFrequencyFromKm(_dispR, state.<x>SizeKm, C_X)` where the
// lab's `_dispR` is a DISPLAY pseudo-radius equal to R^0.5 — the lab uses it because it also
// scales the mesh by the same factor, so a fixed-km form holds its on-screen size as the disc
// grows. The game does NOT scale meshes that way: geometry is built at the real radius, and a
// grep for either display-scale helper across src/ returned ZERO hits before this lane. So for
// the SAME body the correct first argument differs — R for the game vs R^0.5 for the lab, i.e.
// 4x vs 2x on a 4 R⊕ world.
//
// ⚠ This file lives under src/worldengine/**, which tests/vis-scale-fence.test.js fences against
// the display-scale TOKENS themselves. That fence and this contract agree: the display law is the
// front-end's, so this module receives a resolved NUMBER and never names, imports or computes the
// lab's law. The prose above is written token-free for the same reason.
//
// A contract with a default would certify the lab's value as the game's on every body except
// exactly 1.0 R⊕, and the wrong value is finite, plausible and in-band: nothing downstream can
// see it. There is already a worked precedent for refusing a lab-resolved value on purpose —
// src/worldengine/port/craterUniforms.js carries an explicit "⛔ NOT the lab's value" on
// `craterComplexD`. This contract makes that refusal EXPRESSIBLE instead of hand-written.
//
// Therefore: `ctx.displayRadiusEarth` is validated UNCONDITIONALLY, on every call, even when no
// driver in the batch is km-shaped. The asymmetry is deliberate — a missing display policy fails
// SILENTLY and plausibly, so it is checked eagerly; the other context fields are checked at the
// point a driver actually references them, and they THROW rather than propagating NaN, because a
// NaN uniform is not loud either (it renders as nothing, or as noise, on one body class).
//
// ⛔ three-free. It writes `.value` on plain objects and calls `.set(...)` duck-typed on vector
// uniforms; it never imports or names THREE. tests/pack-contract.test.js walks the module graph
// and fails on any bare specifier in the closure.

import { featureFrequencyFromKm } from '../base/featureScale.js';

// ── The GAME's display policy ────────────────────────────────────────────────
// The game builds geometry at the real radius and applies no radius-keyed mesh scale, so its
// display radius IS its physical radius. This is the identity function, and it is named rather
// than inlined for one reason: a policy that is written as "just pass R" at each call site is a
// policy that can be forgotten at one call site. The lab's policy is NOT defined here — it lives
// with the lab, in planet-lod-lab-core.js, which is the point of 5a.
export function gameDisplayRadiusEarth(radiusEarth) {
  return radiusEarth;
}

// ── Driver shapes ────────────────────────────────────────────────────────────
// A driver is either a plain finite number (written through untouched) or a marker object built
// by one of the two factories below. A plain number can never be mistaken for a marker and a
// marker can never be mistaken for a number, so "did the pack mean km or did it mean a value?"
// is not a question the writer has to guess at.
const DRIVER_TAG = '__packDriver';

function makeDriver(fields, opts) {
  const d = {
    [DRIVER_TAG]: true,
    value: undefined,
    featureSizeKm: undefined,
    cFeature: undefined,
    animRate: false,
    relevance: null,
    gate: null,
    ...fields,
  };
  if (opts && typeof opts === 'object') {
    if (opts.animRate !== undefined) d.animRate = !!opts.animRate;
    if (opts.relevance !== undefined) d.relevance = opts.relevance;
    if (opts.gate !== undefined) d.gate = opts.gate;
  }
  return d;
}

// sizeKm(featureSizeKm, cFeature) — a driver expressed as a real-world feature SIZE.
// The writer resolves it against the front-end's display policy. This is the shape 5a means by
// "packs emit sizeKm-shaped drivers": the pack states the physical size, never the frequency.
export function sizeKm(featureSizeKm, cFeature, opts) {
  return makeDriver({ featureSizeKm, cFeature }, opts);
}

// scalar(value) — a driver that is already in uniform units, but needs writer-side context
// (an enable gate, the animation rate, or a per-feature relevance hard-gate) applied to it.
// A driver with no context at all should just be a plain number.
export function scalar(value, opts) {
  return makeDriver({ value }, opts);
}

export function isPackDriver(d) {
  return !!d && typeof d === 'object' && d[DRIVER_TAG] === true;
}

// ── Context validation ───────────────────────────────────────────────────────
export class PackContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PackContractError';
  }
}

// The display policy check. Unconditional — see the header.
export function assertDisplayPolicy(ctx) {
  const r = ctx == null ? undefined : ctx.displayRadiusEarth;
  if (typeof r !== 'number' || !Number.isFinite(r) || r <= 0) {
    throw new PackContractError(
      'pack ctx.displayRadiusEarth is REQUIRED and must be a finite radius > 0 (got ' +
      String(r) + '). The front-end supplies its display policy: the game passes ' +
      'gameDisplayRadiusEarth(R) === R, the lab passes its display pseudo-radius R^0.5. ' +
      'There is deliberately no default — a default would silently render every km-keyed ' +
      'feature at the other front-end\'s spatial frequency on every body except 1.0 R⊕.',
    );
  }
  return r;
}

// `macroSeed` is the PACK's precondition, not the writer's, so it is exported for packs to call
// rather than folded into the writer. PLAN 5d: the numeric fnv1aString form, never the hex form —
// `'da81e221' | 0 === 0`, and a zero seed gives every gas giant identical band phases while every
// distinctness gate on driver ALGEBRA still passes, because the algebra carries no seeded term.
// ⭐ THE TEST IS `(macroSeed | 0) === 0`, NOT `macroSeed === 0`, and the difference is the whole
// point of the guard. It used to read `macroSeed === 0`, which does not check the failure its own
// error string describes: every consumer coerces with `| 0` (`giant-drivers.js` alea key,
// `climate-e5.js`, `band-flow.js`), so what matters is whether the seed survives that coercion, not
// whether the seed is literally zero. MEASURED on the old predicate — all three PASSED the guard and
// all three collapse to 0 downstream:
//     assertMacroSeed(4294967296)   // 2^32   -> `| 0` === 0
//     assertMacroSeed(8589934592)   // 2^33   -> `| 0` === 0
//     assertMacroSeed(-4294967296)  // -2^32  -> `| 0` === 0
// i.e. the exact defect 5d exists to make impossible walked straight through the gate that exists to
// stop it, and would have given every gas giant identical band phases with no algebraic gate moving.
// Found by code review 2026-08-10; a 16-agent sweep on the same file the same day missed it, because
// it asked "can the lab REACH a zero seed" and never asked whether the guard was correct.
export function assertMacroSeed(macroSeed) {
  if (!Number.isInteger(macroSeed) || (macroSeed | 0) === 0) {
    throw new PackContractError(
      'pack ctx.macroSeed must be a non-zero integer that SURVIVES `| 0` (got ' + String(macroSeed) +
      ', which coerces to ' + String(macroSeed | 0) + '). A hex fnv1aString collapses to 0 under ' +
      '`| 0`, and so does any multiple of 2^32, which makes every seeded field constant across the ' +
      'whole population without moving any algebraic gate.',
    );
  }
  return macroSeed;
}

// ── Driver resolution ────────────────────────────────────────────────────────
// Order is GATE → animRate → relevance, which reproduces the lab's own idiom:
//   uPolarStrength = enabled ? strength * relevance.polarVortex : 0.0
// The gate short-circuits to exactly +0, not to a scaled-down value, so a gated-off feature is
// byte-identical to the pre-feature output rather than merely small.
export function resolveDriver(name, d, ctx) {
  if (typeof d === 'number') {
    if (!Number.isFinite(d)) {
      throw new PackContractError(`driver '${name}' is a non-finite number (${d}).`);
    }
    return d;
  }
  if (Array.isArray(d)) { if (isVectorRows(d)) return assertVectorRows(name, d);   // ⭐ 2026-09-03 THE ONE SHAPE ADDED FOR THE STORM SLICE — an array of equal-length numeric ROWS for an array-valued vector uniform (`uStormPosSize: vec4[8]`); see the helpers at EOF (workstream wire-storm-slice-lab-into-game, AC-1). A flat numeric array falls through unchanged.
    for (let i = 0; i < d.length; i++) {
      if (typeof d[i] !== 'number' || !Number.isFinite(d[i])) {
        throw new PackContractError(`driver '${name}' component ${i} is not a finite number.`);
      }
    }
    return d;
  }
  if (!isPackDriver(d)) {
    throw new PackContractError(
      `driver '${name}' is neither a finite number, an array of finite numbers, nor a driver ` +
      'built by sizeKm()/scalar(). Packs may not emit ad-hoc objects — the writer would have ' +
      'to guess whether a bare {value} meant km or uniform units.',
    );
  }

  if (d.gate !== null && d.gate !== undefined) {
    const gates = ctx.gates;
    if (gates == null || !(d.gate in gates)) {
      throw new PackContractError(
        `driver '${name}' is gated on '${d.gate}' but ctx.gates has no such key. An absent gate ` +
        'is not an off gate and is not an on gate — it is an unanswered rendering decision.',
      );
    }
    if (!gates[d.gate]) return 0;
  }

  let v;
  if (d.featureSizeKm !== undefined) {
    if (typeof d.featureSizeKm !== 'number' || !Number.isFinite(d.featureSizeKm) || d.featureSizeKm <= 0) {
      throw new PackContractError(`driver '${name}' has a non-positive/non-finite featureSizeKm.`);
    }
    if (typeof d.cFeature !== 'number' || !Number.isFinite(d.cFeature)) {
      throw new PackContractError(`driver '${name}' has a non-finite cFeature.`);
    }
    // ⭐ THE POLICY SEAM. This one line is the whole reason the contract carries a display
    // policy: the same pack, the same body, two front-ends, two correct answers.
    //
    // ⚠ RESOLVE THROUGH `assertDisplayPolicy`, NEVER READ `ctx.displayRadiusEarth` RAW HERE.
    // The eager check in writePackUniforms (see the header's "validated UNCONDITIONALLY")
    // is a check on the value the writer READ AT ENTRY; it is not a check on the value this
    // line consumes, and the two are not the same value. Both gaps were MEASURED 2026-08-10:
    //   1. `resolveDriver` is EXPORTED and called directly — by giantDeck.js's lab mirror and by
    //      four test files — so the eager check is not on that path at all. Reading raw here,
    //      all five bad shapes passed silently and produced a finite, plausible, in-band number
    //      or a quiet NaN: missing -> NaN, '4' -> 254.84 (the string coerces through `*`, so a
    //      stringly-typed radius reads as CORRECT), 0 -> 0, -4 -> -254.84, null -> 0 (null
    //      coerces to 0). Only `missing` was even non-finite, and a NaN uniform is not loud.
    //   2. Even on the guarded route the eager check is defeatable: a ctx whose
    //      `displayRadiusEarth` is a getter returning 4 on the first read and undefined after
    //      SATISFIED assertDisplayPolicy and then wrote NaN into the uniform with no throw.
    // Validating at the POINT OF USE closes both, because `assertDisplayPolicy` reads once and
    // returns the value it validated — so what is checked is exactly what is consumed.
    //
    // This does NOT move the gate: the gate short-circuit above returns +0 before reaching here,
    // so a gated-off km driver still resolves without a display policy, and a driver that is not
    // km-shaped still never needs one. That is the header's declared asymmetry, kept.
    const dispR = assertDisplayPolicy(ctx);
    v = featureFrequencyFromKm(dispR, d.featureSizeKm, d.cFeature);
  } else {
    if (typeof d.value !== 'number' || !Number.isFinite(d.value)) {
      throw new PackContractError(`driver '${name}' has a non-finite scalar value.`);
    }
    v = d.value;
  }

  if (d.animRate) {
    const a = ctx.animRate;
    if (typeof a !== 'number' || !Number.isFinite(a)) {
      throw new PackContractError(
        `driver '${name}' is animRate-scaled but ctx.animRate is not a finite number (got ` +
        `${String(a)}). Throwing rather than propagating NaN: a NaN drift rate is invisible on ` +
        'a still frame and looks like a frozen feature on a moving one.',
      );
    }
    v *= a;
  }

  if (d.relevance !== null && d.relevance !== undefined) {
    const rel = ctx.relevance;
    const f = rel == null ? undefined : rel[d.relevance];
    if (typeof f !== 'number' || !Number.isFinite(f)) {
      throw new PackContractError(
        `driver '${name}' keys per-feature relevance on '${d.relevance}' but ctx.relevance has ` +
        'no finite value for it.',
      );
    }
    v *= f;
  }

  return v;
}

// ── The writer ───────────────────────────────────────────────────────────────
// `uniforms` is a THREE-style { uName: { value } } map. A driver naming a uniform that does not
// exist THROWS: PLAN §4 Step 6 notes that a missed name is otherwise only visible in a screenshot
// pair, and a screenshot is not where a typo should be caught.
export function writePackUniforms(uniforms, drivers, ctx) {
  assertDisplayPolicy(ctx);
  if (uniforms == null || typeof uniforms !== 'object') {
    throw new PackContractError('writePackUniforms: uniforms map is missing.');
  }
  if (drivers == null || typeof drivers !== 'object') {
    throw new PackContractError('writePackUniforms: drivers map is missing.');
  }

  for (const name of Object.keys(drivers)) {
    const slot = uniforms[name];
    if (slot == null || typeof slot !== 'object' || !('value' in slot)) {
      throw new PackContractError(
        `writePackUniforms: no uniform named '${name}'. A pack may not name a uniform the ` +
        'material does not carry — silently skipping it is how a driver family goes missing ' +
        'with nothing complaining.',
      );
    }
    const v = resolveDriver(name, drivers[name], ctx);
    if (Array.isArray(v)) {
      const target = slot.value; if (isVectorRows(v)) { writeVectorRows(name, target, v); continue; }   // ⭐ 2026-09-03 slot-wise for the storm carriage — NEVER through the element-wise branch two lines down, which would REPLACE the material's Vector4 slots with plain arrays (renders as nothing, throws nowhere; measured at scoping). Helpers at EOF.
      if (target && typeof target.set === 'function') target.set(...v);
      else if (Array.isArray(target)) for (let i = 0; i < v.length; i++) target[i] = v[i];
      else {
        throw new PackContractError(
          `writePackUniforms: driver '${name}' resolved to an array but uniform '${name}' is ` +
          'not a settable vector or array.',
        );
      }
    } else {
      slot.value = v;
    }
  }
}

// Shape check for a pack's RETURN value. PLAN 5a fixes it at { drivers, attributes }; a pack that
// returns bare drivers would work today and break the moment a pack needs a per-vertex attribute.
export function assertPackResult(result, packName = 'pack') {
  if (result == null || typeof result !== 'object') {
    throw new PackContractError(`${packName} must return { drivers, attributes }.`);
  }
  if (result.drivers == null || typeof result.drivers !== 'object') {
    throw new PackContractError(`${packName} returned no drivers map.`);
  }
  if (result.attributes == null || typeof result.attributes !== 'object') {
    throw new PackContractError(
      `${packName} returned no attributes map. Return an empty object, not undefined — ` +
      '"this pack has no attributes" and "this pack forgot" must not look the same.',
    );
  }
  return result;
}

// ── The storm carriage's shape, appended at EOF so nothing above shifts (§10) ──────────────────
// ⭐ ADDED 2026-09-03 (workstream wire-storm-slice-lab-into-game, AC-1). The storm slice is three `vec4[8]`,
// one `vec3[8]` and an `int`; before this the writer admitted flat numeric arrays only, and its
// element-wise branch would have overwritten the material's Vector4 slots with numbers. This is NOT a
// general nested-value contract: exactly one shape — an array of equal-length numeric rows — written
// slot-wise through each target element's `.set(...)`. The pack emits EXACTLY `count` rows, so the
// writer touches only those slots and the material's zero defaults stand behind the count (which is
// what the lab's frame loop leaves behind too). Every pre-existing driver is byte-inert under this
// change: tests/driver-pack-stormdeck.test.js re-resolves all of them against a fixture captured at
// 520f2c0 (156 corpus bodies + 18 presets) and asserts stormDeck is the only pack emitting rows.
export function isVectorRows(d) {
  return Array.isArray(d) && d.length > 0 && Array.isArray(d[0]);
}
export function assertVectorRows(name, d) {
  const width = d[0].length;
  for (let i = 0; i < d.length; i++) {
    if (!Array.isArray(d[i]) || d[i].length !== width) {
      throw new PackContractError(`driver '${name}' row ${i} is ragged (expected ${width} components).`);
    }
    for (let j = 0; j < width; j++) {
      if (typeof d[i][j] !== 'number' || !Number.isFinite(d[i][j])) {
        throw new PackContractError(`driver '${name}' row ${i} component ${j} is not a finite number.`);
      }
    }
  }
  return d;
}
export function writeVectorRows(name, target, rows) {
  if (!Array.isArray(target)) {
    throw new PackContractError(
      `writePackUniforms: driver '${name}' resolved to an array of vectors but uniform '${name}' is not ` +
      'an array of settable vectors.',
    );
  }
  for (let i = 0; i < rows.length; i++) {
    const el = target[i];
    if (!el || typeof el.set !== 'function') {
      throw new PackContractError(
        `writePackUniforms: driver '${name}' row ${i} has no settable slot to land in (uniform '${name}' ` +
        `carries ${target.length} slots).`,
      );
    }
    el.set(...rows[i]);
  }
}

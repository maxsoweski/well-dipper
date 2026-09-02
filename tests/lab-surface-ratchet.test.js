// tests/lab-surface-ratchet.test.js
//
// THE SHRINK-ONLY RATCHET — PLAN §4 "Step 5", part 5f.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IT IS FOR, in one sentence
// ─────────────────────────────────────────────────────────────────────────────
// Nothing else in this plan stops a NEW lab feature being authored inside `applyDrivers()` +
// `frame()` the old way. Every authoring affordance in the lab pulls toward that path — the
// 470-line `state` literal at world-engine-lab.html:891 `const state = {`, 186 `.listen()` bindings,
// `_driverTouched` — so "migrating a feature costs one pack module" is true only for those
// someone CHOOSES to author as a pack. This makes the un-packed path fail the build rather than
// relying on vigilance, which is §11.2's conversion rule applied to an authoring habit.
//
// ⭐ IT IS HALF A DELIVERABLE ON ITS OWN. A ratchet that blocks the wrong path without offering
// the right one gets deleted the first time it fires. The right path is written down, with a
// worked example, at docs/FEATURES/pack-authoring-path.md — and the failure messages below point
// at it by name, because a red build with no route out is a red build someone deletes.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS MEASURED, exactly
// ─────────────────────────────────────────────────────────────────────────────
//   set 1  every `state.<field>` ASSIGNED anywhere inside `function applyDrivers(){`, INCLUDING the
//          ones assigned in bulk by `Object.assign(state, …)` — see THE BULK ARM below
//   set 2  every `<bag>.uniforms.<name>` MENTIONED anywhere inside `function frame(){`
//   set 3  every `<bag>.uniforms.<name>` MENTIONED anywhere inside `function applyDrivers(){`
//   set 4  every FUNCTION NAME CALLED from inside either region, keyed `<region>::<name>`
//
// Two different verbs, on purpose. `applyDrivers` is a writer, so an assignment is the event
// worth catching. `frame()` both reads and writes uniforms — `uniforms.uCraterBakeRestore.value =
// grainCarveUI.reliefBakeStrength - uniforms.uReliefBakeStrength.value;` does both on one line —
// and a new feature that only READS a uniform in `frame()` has still been authored down the
// un-packed path, so mention is the event there.
//
// ⭐⭐ SET 4 IS THE HELPER HOP, AND WITHOUT IT ONE FUNCTION DEFEATS THIS WHOLE FILE. Measured
// 2026-08-10, executed rather than argued. Put
// `function applyBypassFeature(){ state.__bypassField = 1.0; }` on the line ABOVE
// `function applyDrivers(){`, and call it as applyDrivers' first statement. The write is now
// OUTSIDE both watched regions, so set 1 sees nothing; it touches no uniform, so sets 2 and 3 see
// nothing. The suite stayed 25/25 GREEN. A brand-new, un-packed feature, wired into the driver path
// on the first line of the function this file is named after, and invisible.
// ⚠ The 25/25 is executed here and re-executed on every run as CONTROL M. The wider claim that the
// rest of the repo missed it too came from the sweep that filed this and is NOT reproduced by this
// file — do not repeat it as if it were measured here.
//
// Sets 1-3 watch what the two regions WRITE. Nothing watched what they REACH. Set 4 pins the callee
// NAMES, which moves the gate onto the indirection itself: the helper may write whatever it likes,
// but `applyDrivers` cannot start calling it without this file's pinned list moving. `applyStormState`
// and `rebakeE5Bands` are already called from `applyDrivers` and so cost nothing to pin. CONTROL M is
// the executed proof, and it asserts the invisibility to sets 1-3 in its own body so the claim above
// stays a measurement rather than a memory.
//
// ⚠ SET 4 HAS A HIGHER LEGITIMATE-ADDITION RATE THAN THE OTHER THREE, AND THAT IS THE DESIGN. Lifting
// a block of `applyDrivers` into a helper and calling it is a REFACTOR to its author and a bypass to
// this gate, and the two are the same bytes — no lexical rule separates them, and neither does a
// non-lexical one. So the extraction reds, with the route out named. That is the intended cost rather
// than a false positive: the surface really did leave the watched region, and the pinned line is
// where somebody says so out loud. CONTROL N is the matching proof that a callee LEAVING stays green,
// so this is still a ratchet and not a freeze.
//
// ⭐⭐ THE BULK ARM, AND WHY THE OBVIOUS VERSION OF IT IS WORSE THAN NOTHING. Set 1 was a lexical
// scan for `state.<field> =`, and Step 5 put world-engine-lab.html:2326
// `Object.assign(state, giantDeckLabState(_deck));` inside the very function it watches. That one
// line writes NINE fields, and the scan could see none of them. Worse, Step 5c deleted the eight
// direct `state.band*/state.jet* =` lines the bulk write replaced, so the ratchet observed a
// SHRINK — which it is designed to call GREEN — while eight authoring sites moved out of its view
// and a ninth field, `bandRough`, arrived having never been gated at all. The measured cost of the
// blind spot was 9 fields, one of them new. Numbers and provenance: the RE-BASELINE block in
// tests/fixtures/lab-surface-baseline.mjs.
//
// The obvious fix — "resolve the object literal's keys" — would be the same blindness wearing a
// fix. There IS no object literal: the second argument is a CALL, the callee lives in another file
// (src/worldengine/drivers/giantDeck.js `export function giantDeckLabState(`), and its body builds
// `out` in a loop over a binding table rather than returning a literal. A literal-only resolver
// finds zero keys, adds zero fields, and reports GREEN — indistinguishable from a file that really
// does write nothing in bulk. So the arm is three-tiered and the third tier is the load-bearing
// one: object literal → resolvable helper call (followed through the import, into the table it
// loops over) → THROW. CONTROLS G through L are its executed proofs; CONTROL I is the throw.
//
// ⭐ SET 3 IS NOT IN 5f's TEXT AND IS HERE ON MEASURED EVIDENCE. 5f names two regions. Against the
// file, those two leave a live hole: `applyDrivers` writes EIGHT uniforms directly and SEVEN of
// them — uChasmaAxis, uLiquidMask, uLiquidSpecies, uLiquidStability, uScarpAxis, uTesseraAxis,
// uVoroCells — are never mentioned in `frame()` at all. A ninth feature written the way those
// seven are already written would appear in NEITHER named set, so the two-set ratchet is dead on
// that whole class. Under §11.9 this is the blocking kind of bypass rather than the excusable
// kind: not adversarial, but the file's own idiom, eight times over, inside the very function
// being watched. Closed here rather than carried.
//
// All functions are located BY NAME every run and their extents found by brace matching. No line
// number is pinned: Step 5c deletes a block out of `applyDrivers` and every line below it moves.
//
// ⛔ KNOWN LIMITS — measured, and written into the gate rather than only into a ledger (§11.9)
//   1. `applyStormState()` and `rebakeE5Bands()` are the lab's THIRD and FOURTH driver functions
//      and they are NOT watched. Measured at 4e864bc: applyStormState writes 23 `state.*` fields
//      and touches 0 uniforms; rebakeE5Bands writes 4 and touches 6 — uBandM, uBandPhaseJet,
//      uBandSEq, uBandAMid, uBandS2, uBandDeflectScale — and all 6 are absent from `frame()`.
//      All 27 state fields are disjoint from set 1. So the un-watched surface is 27 state fields
//      and 6 uniforms, stated as a number rather than as "some".
//      NAMED, NOT CLOSED, and the reason is scope rather than cost: 5f's declared subject is
//      `applyDrivers` + `frame()`; set 3 was added because that bypass sits INSIDE a declared
//      subject function. These two are different functions, they are the storm/band producers
//      Step 5c explicitly fences out of pack #1, and 5c rewrites `rebakeE5Bands` — so pinning
//      them here buys a fixture that another lane immediately shrinks. Step 11's standing fence
//      is where this should close.
//      ⚠ The residual is bounded but NOT zero. The storm family's uniforms are assembled in
//      `frame()`, so a new storm uniform still trips set 2; the six E5 band uniforms are the
//      genuinely uncovered class, and a seventh added beside them trips nothing.
//      ⚠ SET 4 CHANGED THE EDGE OF THIS LIMIT WITHOUT CLOSING IT, and the distinction is the whole
//      point of the number above. Both functions are CALLED from `applyDrivers`, so both names are
//      pinned in set 4 as of 2026-08-10: the call cannot silently disappear, be renamed, or be joined
//      by a THIRD driver function without this file reddening. Their BODIES are still unwatched, and
//      27 state fields + 6 uniforms is exactly what that costs. Pinning the door is not watching the
//      room.
//   2. The scan is lexical. A uniform reached through a computed name — `uniforms['u' + k]` — is
//      invisible to it. `grep -cE "uniforms\s*\["` over world-engine-lab.html returns 0, so this is
//      not an idiom of this file, and under §11.9 that makes it a recorded limit and not a
//      blocker. It becomes a blocker the first time the count is non-zero.
//      ⚠ THE `Object.assign(state, …)` HALF IS CLOSED — that is the bulk arm above, and it THROWS
//      on anything it cannot resolve. It had to be: that shape IS an idiom of this file, once,
//      today, inside the watched function, and a limit whose count is non-zero is a defect.
//      ⛔ BUT THE `state` HALF IS *NOT* CLOSED, AND THIS BLOCK CLAIMED IT WAS UNTIL 2026-08-09.
//      Three shapes write a NEW top-level `state` field inside `applyDrivers` and are invisible to
//      every arm here — verified by execution, each one injected for real and the suite stayed
//      25/25 GREEN with no throw. RE-RUN 2026-08-10 against set 4, because a fourth set is exactly
//      the kind of change that quietly makes a limit stale: all three still pass, now 31/31. Set 4
//      does not touch them and could not — each one is an in-region WRITE with no call in it (`(c)`
//      reaches `Object.entries(`, which is a method call and outside set 4 by KNOWN LIMIT 4). The
//      shapes:
//        (a) computed index — `state['newField'] = 1`, or a template/variable key;
//        (b) destructuring — `({ x: state.newField } = src)` and the array form;
//        (c) a pack-shaped loop mirror written DIRECTLY here rather than in a helper:
//            `for (const [u, f] of Object.entries(TABLE)) state[f] = …` — the resolver knows this
//            shape, but only when it is reached through an `Object.assign` hop.
//      ⚠ (a) is the one to watch, and it is NOT the harmless case the `uniforms` sentence above
//      describes. Measured 2026-08-09: `grep -cE "state\s*\["` over world-engine-lab.html returns
//      **15**, against **0** for `uniforms\s*\[`. Inside `applyDrivers` the count is 0 TODAY, which
//      is the only reason this is a recorded limit rather than a blocker — but the idiom is live
//      fifteen times over in the same file and one copy-paste from crossing the boundary. It
//      becomes a blocker the day that count is non-zero, and nothing here will announce that day.
//   3. The helper resolver follows ONE hop. A helper that itself delegated to a second helper, or
//      whose binding table were imported from a third file, hits an explicit guard and THROWS
//      (`could not locate …`). That is deliberate: the cost of a missing hop is a red build with a
//      named cause, and the cost of guessing is a silent zero. Measured today: one hop is enough
//      for the file's only bulk write. CONTROL L is the executed proof that the loudness is real.
//   4. Set 4 counts BARE calls — `helper(…)` — and NOT method calls, `obj.helper(…)`. Measured
//      2026-08-10: every dotted call inside the two regions is a builtin. In `applyDrivers`:
//      Math.{acos,atan2,cos,imul,log10,max,min,pow,round,sin}, Object.assign, Array#{slice,includes}.
//      In `frame()`: the same Math family plus THREE's vector/quaternion/colour methods
//      (applyAxisAngle, applyQuaternion, copy, divideScalar, invert, lookAt, normalize, set, setRGB,
//      setScalar, worldToLocal) and renderer.{render,setRenderTarget}. Not ONE bespoke driver helper
//      is reached as a method today, so keying on the receiver would pin `_v3.copy` and `_q.invert` —
//      names that move whenever a local is renamed — in order to catch a shape this file does not
//      use. Under §11.9 that makes it a recorded limit rather than a blocker. It becomes a blocker
//      the day a driver helper is invoked as `<something>.method(…)` from either region, and nothing
//      here will announce that day.
//      Also NOT counted: a function DECLARED inside a region but never called — the call is the
//      event, and an uncalled declaration is dead code. Measured, that exclusion removes exactly two
//      names, `applyDrivers` and `frame` matching their own header lines, and nothing else. `new
//      Foo(…)` IS counted; measured zero occurrences in both regions today, so it costs nothing and
//      catches a bespoke class arriving.
//
// ─────────────────────────────────────────────────────────────────────────────
// RULE VARIANTS — the ±1 in the PLAN, chased down rather than pinned
// ─────────────────────────────────────────────────────────────────────────────
// PLAN §4 5f records the measurement as unstable between passes: "146/147 state fields, 327/328
// uniforms", and instructs that the harness's own number be pinned, never the document's. Both
// halves were re-measured here, twice, over five sources.
//
//   frame uniforms — the ±1 REPRODUCES AND IS A SCAN ARTIFACT. Scanning the raw text yields 328
//   names; stripping comments first yields 327. The extra is `js`, from the substring
//   "uniforms.js" inside world-engine-lab.html:4937 `// uDispDomainScale here. It keeps its 1.0 initializer` — the quoted comment goes on to name planet-lod-uniforms.js line 17 as the initializer site, spelled in prose here ON PURPOSE: a line-anchored ref NESTED inside another ref's span parses as its own citation with a garbage tail, which is how this line reached exit 2 the moment Step 6 added this file to CITE_SOURCES.
//   — a phantom uniform named after a filename. `stripNonCode` removes it. There was never a
//   real disagreement here, only a scanner reading a comment.
//
//   ⚠ BOTH FIGURES BELOW PREDATE THE BULK ARM and are kept because the reasoning is still the
//   reasoning. The state number they chase, 147, was the BLIND surface plus the eight fields Step 5c
//   had not yet moved; the true surface is 148 and the harness's own blind reading today is 139.
//   Nothing in the analysis below is invalidated — the ±1 was a scan artifact either way — but do
//   not read 147 as the current pin. The pin is the LIST, and it always was.
//
//   state fields — 147 IS STABLE and 146 did not reproduce. Six rules were tried against the same
//   region: full (tail + compound ops) 147 · no-tail 147 · assignment-only, no compound ops 147 ·
//   `state.X =` bare 147 · statement-start-only 127 · any mention, reads included 150. None
//   returns 146, and applyDrivers contains no compound assignment or increment at all, so the
//   rules that would differ on one cannot. The number 146 is therefore recorded as unexplained.
//   It does not matter, and that is the design: MEMBERSHIP is pinned and the count is printed
//   only as a consequence of the list.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY MEMBERSHIP AND NOT COUNTS — the fresh scar from Step 4
// ─────────────────────────────────────────────────────────────────────────────
// Step 4's re-bless pinned population COUNTS, and a count-preserving permutation then passed
// every instrument byte-identically. A rename inside `applyDrivers` — `surfaceGravity` →
// `gravityAtSurface` — is exactly that shape: 147 before, 147 after, and a brand-new authoring
// site. The sets below make it an ADDITION, which reds. CONTROL D is the executed control for
// that specific failure, it asserts the count DID NOT move as part of its own body, and it runs
// on every pass rather than having been run once by hand.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠ THE FAILURE MODE OF A SHRINK-ONLY RATCHET, and what is done about it
// ─────────────────────────────────────────────────────────────────────────────
// The empty set is a subset of every set. A harness that silently stops measuring — a renamed
// function, an over-blanking stripper, a regex that stops matching — reports GREEN while gating
// nothing, forever. `describe('harness liveness')` is not ceremony: it is the only thing standing
// between this file and a permanently vacuous pass, and it is checked with sentinels and floors
// rather than with a total, because a total is what a permutation preserves.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  MEASURED_AT,
  APPLY_DRIVERS_STATE_FIELDS,
  FRAME_UNIFORMS,
  APPLY_DRIVERS_UNIFORMS,
  STATE_SENTINELS,
  UNIFORM_SENTINELS,
  APPLY_DRIVERS_UNIFORM_SENTINELS,
  MIN_STATE_FIELDS,
  MIN_FRAME_UNIFORMS,
  MIN_APPLY_DRIVERS_UNIFORMS,
  MIN_BULK_STATE_FIELDS,
} from './fixtures/lab-surface-baseline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The subject. Overridable ONLY so the controls below can run the REAL code path over a MUTATED
// COPY without writing to world-engine-lab.html — that file is edited concurrently by other lanes
// and a test that mutates it in place would clobber live work. This is a convenience, not a
// boundary; anyone who wants to defeat the ratchet can delete the file.
const LAB_SRC = process.env.WD_LAB_SURFACE_SRC || join(ROOT, 'world-engine-lab.html');

const AUTHORING_DOC = 'docs/FEATURES/pack-authoring-path.md';

// ─────────────────────────────────────────────────────────────────────────────
// The harness. Exported: the controls below re-enter through exactly these functions, so a
// control that passes is evidence about the shipped path and not about a parallel copy of it.
// ─────────────────────────────────────────────────────────────────────────────

// Replace every comment and string/template literal with spaces, preserving byte offsets and
// therefore every line number. Scanning starts at the first `<script` so prose apostrophes in the
// HTML head (`don't`) cannot open a runaway string that eats into the script.
//
// This is a lexer, not a parser, and it has one known limit, written here rather than in a
// ledger: a REGEX LITERAL containing an unbalanced quote would be mis-lexed. Measured rather than
// assumed — within the two scanned regions, stripping changes the state set by 0 members and the
// uniform set by exactly the one comment phantom named in the header. Over-blanking inside the
// subject is therefore zero, not "believed small".
//
// ⭐ `blankStrings` IS NOT A CONVENIENCE FLAG. The lab side MUST have strings blanked (CONTROL F is
// the standing proof: the 328th "uniform" was the substring `uniforms.js` inside a comment). The
// HELPER side must NOT, because the field names the Object.assign arm is resolving ARE string
// literals — `LAB_STATE_BINDING`'s values, `uBandStrength: 'bandStrength'`. Blanking strings in a
// helper would make that table resolve to nine EMPTY names, which is the silent-zero failure this
// arm exists to prevent, reintroduced by the lexer instead of by the regex.
export function stripNonCode(src, blankStrings = true) {
  const out = src.split('');
  const scriptAt = src.indexOf('<script');
  const start = scriptAt < 0 ? 0 : scriptAt;
  for (let k = 0; k < start; k++) if (out[k] !== '\n') out[k] = ' ';
  let i = start;
  const n = src.length;
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { let j = src.indexOf('\n', i); if (j < 0) j = n; blank(i, j); i = j; continue; }
    if (c === '/' && c2 === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; blank(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      if (blankStrings) blank(i, j);
      i = j; continue;
    }
    i++;
  }
  return out.join('');
}

// A JS source with COMMENTS removed and STRING LITERALS KEPT. `<script` is absent from a .js file,
// so the HTML-preamble arm above is inert here. Used for helper modules and for reading the lab's
// own `import … from './path.js'` specifiers, which the string-blanking variant erases.
export function stripComments(src) {
  return stripNonCode(src, false);
}

// Locate a top-level function by its header line and brace-match its body. THROWS when the
// function cannot be found — a rename must be a loud red, never a quiet empty measurement.
export function extentOf(codeLines, headerRe, label) {
  const s = codeLines.findIndex((l) => headerRe.test(l));
  if (s < 0) {
    throw new Error(
      `lab-surface-ratchet: could not locate \`${label}\` in ${LAB_SRC}. If it was renamed or ` +
      `moved, update the locator here — do NOT let the ratchet measure an empty set, which is ` +
      `a subset of everything and passes silently.`,
    );
  }
  let depth = 0, started = false;
  for (let i = s; i < codeLines.length; i++) {
    for (const ch of codeLines[i]) {
      if (ch === '{') { depth++; started = true; }
      else if (ch === '}') { depth--; if (started && depth === 0) return [s + 1, i + 1]; }
    }
  }
  throw new Error(`lab-surface-ratchet: unterminated body for \`${label}\``);
}

// `state.<field>` on the left of any assignment, including a property/index tail
// (`state.featureRelevant[key] = …` counts as authoring `featureRelevant`) and compound
// operators. Negative lookahead on `=` excludes `==`, `===` and `=>`.
const STATE_WRITE =
  /\bstate\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)((?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*|\s*\[[^\]\n]*\])*)\s*(?:\+\+|--|(?:\+|-|\*|\/|%|\*\*|\|\||&&|\?\?|&|\||\^|<<|>>|>>>)?=(?!=|>))/g;

// Any `<bag>.uniforms.<name>`. The leading group captures the bag expression so
// `ringCloud.material.uniforms.uTime` and the planet's bare `uniforms.uTime` stay distinct.
const UNIFORM_TOUCH = /([A-Za-z0-9_$.[\]]*?)\buniforms\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;

// A CALL to a bare function name. The leading `[^.\w$]` is what keeps method calls out — `Math.max(`
// has a `.` before the name (KNOWN LIMIT 4) — and it also stops `foo(` matching inside `barfoo(`.
// The `function `/`new ` prefix is CAPTURED rather than excluded so the two can be told apart: a
// declaration is skipped, a construction is kept.
export const CALLEE = /(?:^|[^.\w$])(function\s+|new\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

// Reserved words that are followed by `(` and are not calls. Without this the set fills up with
// `if`, `for` and `catch` — harmless to the ratchet's logic, but every one of them is a name a
// legitimate edit can add or remove, which is a gate that reds on control flow. `function` and `new`
// are handled by CALLEE's own prefix group instead, because their FOLLOWING name is the interesting
// part. `return (` / `typeof (` are here for the parenthesised-expression form.
const NOT_A_CALLEE = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'new', 'delete', 'void', 'in', 'of',
  'do', 'else', 'function', 'await', 'yield', 'case', 'throw', 'instanceof', 'with', 'super',
  'import', 'export', 'const', 'let', 'var', 'class', 'try', 'finally', 'break', 'continue',
  'this', 'null', 'true', 'false', 'undefined',
]);

// One CALLEE match -> the called name, or null when the match is not a call.
export const calleeName = (m) =>
  (m[1] && m[1][0] === 'f') || NOT_A_CALLEE.has(m[2]) ? null : m[2];

// ─────────────────────────────────────────────────────────────────────────────
// THE `Object.assign(state, X)` ARM — the blind spot Step 5 opened, closed
// ─────────────────────────────────────────────────────────────────────────────
// ⛔ WHY THE OBVIOUS FIX IS THE WRONG ONE. `STATE_WRITE` measures the SET of `state.<field>` names
// assigned by lexical scan. world-engine-lab.html:2326 `Object.assign(state, giantDeckLabState(_deck));`
// writes NINE fields that the scan cannot see, and — because Step 5c simultaneously deleted the nine
// direct `state.band*/state.jet* =` lines it replaced — the ratchet read that as a SHRINK and stayed
// green while nine authoring sites moved out of its view and one BRAND NEW field, `bandRough`,
// arrived. That is not a hypothetical bypass: it is what the file already did.
//
// The obvious fix — "resolve object-literal keys at the call site" — is the same blindness wearing a
// fix. The second argument is a CALL, the callee is defined in ANOTHER FILE, and its body builds
// `out` in a loop over a binding table, so there is no object literal at the call site OR at the
// return. A literal-only resolver finds nothing, adds zero fields, and reports GREEN. The three arms
// below are therefore ordered literal → resolvable call → THROW, and the third is the load-bearing
// one: an unmeasurable bulk write must fail the build, because "measured zero" and "there were zero"
// are indistinguishable in a shrink-only ratchet.
//
// ⚠ WHAT IS MEASURED IS THE AUTHORABLE SET, NOT THE RUNTIME ONE. `giantDeckLabState` skips a binding
// whose uniform the pack did not emit (`if (!(uName in deck.drivers)) continue;`), so a solid preset
// mirrors fewer than nine fields at runtime. The ratchet pins all nine anyway: adding a ROW to
// `LAB_STATE_BINDING` is a new authoring site whether or not today's presets exercise it, and a gate
// that only fires on fields some preset happens to populate is a gate with a preset-shaped hole.
//
// ⛔ KNOWN LIMIT, stated rather than hidden: this resolver follows ONE hop. A helper that itself
// delegated to a second helper would hit the `Object.assign(<returned>, …)` guard in
// `helperReturnFields` and THROW. Loud, not silent — which is the whole contract of this arm.

const bulkMiss = (what) =>
  new Error(
    `lab-surface-ratchet: could not locate ${what}.\n\n` +
    `An \`Object.assign(state, …)\` inside applyDrivers() writes state fields in bulk, and this ` +
    `harness cannot name them. It THROWS rather than measuring zero: the empty set is a subset of ` +
    `every set, so a bulk write this scan cannot read would make the ratchet report GREEN while ` +
    `gating nothing. Either teach the resolver this shape, or read ${AUTHORING_DOC} and author the ` +
    `feature as a driver pack whose lab mirror goes through a resolvable binding table. Silence is ` +
    `not one of the options.`,
  );

// Index of the delimiter closing the one opened at `open`. Quote-aware, because helper sources are
// scanned with their strings INTACT.
export function spanFrom(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length) { if (text[j] === '\\') { j += 2; continue; } if (text[j] === c) break; j++; }
      i = j; continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// Split on top-level commas only. `text` is the INSIDE of a bracket pair.
export function splitTopLevel(text) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < text.length) { if (text[j] === '\\') { j += 2; continue; } if (text[j] === c) break; j++; }
      i = j; continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  if (text.slice(start).trim()) out.push(text.slice(start));
  return out;
}

// `{ a: 'x', b, 'c': 2 }` -> [{key:'a', value:"'x'"}, {key:'b', value:'b'}, {key:'c', value:'2'}].
// Spreads and computed keys THROW — both are exactly the "the keys are somewhere else" shape.
export function objectLiteralEntries(lit, whatFor) {
  const o = lit.indexOf('{');
  const inner = lit.slice(o + 1, spanFrom(lit, o));
  return splitTopLevel(inner).map((raw) => {
    const e = raw.trim();
    if (e.startsWith('...')) throw bulkMiss(`the keys behind a spread element in ${whatFor} (\`${e.slice(0, 40)}\`)`);
    if (e.startsWith('[')) throw bulkMiss(`the name behind a COMPUTED key in ${whatFor} (\`${e.slice(0, 40)}\`)`);
    let key, rest;
    const q = /^(['"])((?:[^'"\\]|\\.)*)\1/.exec(e);
    if (q) { key = q[2]; rest = e.slice(q[0].length); }
    else {
      const id = /^([A-Za-z_$][A-Za-z0-9_$]*|[0-9]+)/.exec(e);
      if (!id) throw bulkMiss(`a key in ${whatFor} (\`${e.slice(0, 40)}\`)`);
      key = id[1]; rest = e.slice(id[0].length);
    }
    const colon = rest.indexOf(':');
    return { key, value: colon < 0 ? key : rest.slice(colon + 1).trim() };
  }).filter(Boolean);
}

const stringLiteral = (v) => {
  const m = /^(['"])((?:[^'"\\]|\\.)*)\1$/.exec(v.trim());
  return m ? m[2] : null;
};

// A `const NAME = { … }` / `const NAME = Object.freeze({ … })` table, in the helper's own source.
function tableEntries(helperCode, name, where) {
  const m = new RegExp(`(?:const|let|var)\\s+${name}\\s*=`).exec(helperCode);
  if (!m) throw bulkMiss(`the definition of the binding table \`${name}\` in ${where} (imported tables are not followed)`);
  const brace = helperCode.indexOf('{', m.index + m[0].length);
  const between = helperCode.slice(m.index + m[0].length, brace);
  if (!/^\s*(?:Object\s*\.\s*freeze\s*\(\s*)?$/.test(between)) {
    throw bulkMiss(`an object literal for \`${name}\` in ${where} (found \`${between.trim().slice(0, 40)}\` instead)`);
  }
  return objectLiteralEntries(helperCode.slice(brace, spanFrom(helperCode, brace) + 1), `\`${name}\` in ${where}`);
}

// The set of field names a helper's returned object can carry. Handles `return { … }` and the
// build-a-local-in-a-loop shape `const out = {}; … out[f] = …; return out;`.
export function helperReturnFields(helperCode, fnName, where) {
  const sig = new RegExp(`(?:export\\s+)?function\\s+${fnName}\\s*\\(`).exec(helperCode);
  if (!sig) throw bulkMiss(`\`function ${fnName}\` in ${where}`);
  const paren = helperCode.indexOf('(', sig.index);
  const bodyOpen = helperCode.indexOf('{', spanFrom(helperCode, paren) + 1);
  const body = helperCode.slice(bodyOpen, spanFrom(helperCode, bodyOpen) + 1);

  // (a) a literal return.
  const retLit = /return\s*\{/.exec(body);
  if (retLit) {
    const b = body.indexOf('{', retLit.index);
    return objectLiteralEntries(body.slice(b, spanFrom(body, b) + 1), `the return of \`${fnName}\` in ${where}`).map((e) => e.key);
  }

  // (b) return a local that was built up.
  const retVar = /return\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;/.exec(body);
  if (!retVar) throw bulkMiss(`the returned value of \`${fnName}\` in ${where}`);
  const V = retVar[1];

  if (new RegExp(`Object\\s*\\.\\s*assign\\s*\\(\\s*${V}\\s*,`).test(body)) {
    throw bulkMiss(`the fields a nested \`Object.assign(${V}, …)\` adds inside \`${fnName}\` in ${where} (this resolver follows one hop only)`);
  }

  const fields = new Set();
  const writes = new RegExp(`\\b${V}\\s*(?:\\.\\s*([A-Za-z_$][A-Za-z0-9_$]*)|\\[([^\\]]*)\\])\\s*=(?!=|>)`, 'g');
  for (const w of body.matchAll(writes)) {
    if (w[1]) { fields.add(w[1]); continue; }
    const expr = w[2].trim();
    const lit = stringLiteral(expr);
    if (lit !== null) { fields.add(lit); continue; }
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expr)) {
      throw bulkMiss(`the name written by \`${V}[${expr.slice(0, 40)}]\` inside \`${fnName}\` in ${where}`);
    }
    // The loop-binding case. `for (const [uName, stateField] of Object.entries(TABLE))` — the field
    // set is the KEYS of TABLE if `expr` is the first binding, the VALUES if it is the second.
    let resolved = false;
    const entriesLoop = new RegExp(
      `for\\s*\\(\\s*(?:const|let|var)\\s*\\[\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*,\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\]\\s+of\\s+Object\\s*\\.\\s*entries\\s*\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\)`, 'g');
    for (const lp of body.matchAll(entriesLoop)) {
      const pos = expr === lp[1] ? 'key' : expr === lp[2] ? 'value' : null;
      if (!pos) continue;
      for (const e of tableEntries(helperCode, lp[3], where)) {
        if (pos === 'key') { fields.add(e.key); continue; }
        const s = stringLiteral(e.value);
        if (s === null) throw bulkMiss(`a literal field name for \`${lp[3]}.${e.key}\` in ${where} (its value is \`${e.value.slice(0, 40)}\`)`);
        fields.add(s);
      }
      resolved = true;
      break;
    }
    if (resolved) continue;
    const keysLoop = new RegExp(
      `for\\s*\\(\\s*(?:const|let|var)\\s+${expr}\\s+of\\s+Object\\s*\\.\\s*keys\\s*\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\)`);
    const km = keysLoop.exec(body);
    if (km) { for (const e of tableEntries(helperCode, km[1], where)) fields.add(e.key); continue; }
    throw bulkMiss(`what \`${expr}\` ranges over inside \`${fnName}\` in ${where}`);
  }

  if (!fields.size) throw bulkMiss(`any field written to \`${V}\` inside \`${fnName}\` in ${where} — a helper that adds nothing is the silent-zero this arm refuses`);
  return [...fields];
}

// Follow `name` back through the lab's own import statements to the file that defines it.
function loadHelper(labCodeWithStrings, name, readHelper) {
  for (const m of labCodeWithStrings.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const hit = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const p = s.split(/\s+as\s+/); return { exported: p[0].trim(), local: (p[1] || p[0]).trim() }; })
      .find((b) => b.local === name);
    if (!hit) continue;
    if (!m[2].startsWith('.')) throw bulkMiss(`a relative module for \`${name}\` (it is imported from "${m[2]}", which is not a path this harness can read)`);
    const abs = join(dirname(LAB_SRC), m[2]);
    return { code: stripComments(readHelper(abs)), where: m[2], exported: hit.exported };
  }
  throw bulkMiss(`the import of \`${name}\` (no \`import { … } from '…'\` in the lab binds that name)`);
}

// One `Object.assign(target, …src)` source expression -> the field names it contributes.
export function bulkAssignFields(expr, labCodeWithStrings, readHelper) {
  const e = expr.trim();
  // 1. an object literal, right there.
  if (e.startsWith('{') && spanFrom(e, 0) === e.length - 1) {
    return objectLiteralEntries(e, 'an inline `Object.assign(state, {…})`').map((x) => x.key);
  }
  // 2. a call to a resolvable helper — follow it into its defining file.
  const call = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/.exec(e);
  if (call && spanFrom(e, e.indexOf('(', call[1].length - 1)) === e.length - 1) {
    const h = loadHelper(labCodeWithStrings, call[1], readHelper);
    return helperReturnFields(h.code, h.exported, h.where);
  }
  // 3. anything else. THROW — see the block comment above.
  throw bulkMiss(`the fields written by \`Object.assign(state, ${e.slice(0, 60)})\``);
}

// Every `Object.assign(<target>, …)` in a region. Targets that are not part of the measured surface
// (a local accumulator, say) are ignored; `state` is resolved; a `uniforms` bag is refused, because
// the identical blindness applies there and set 2/3 would report a silent zero.
//
// ⚠ `Object.assign(state.someField, …)` is deliberately IGNORED rather than refused, and the reason
// is semantic rather than convenient: assigning INTO an existing field cannot create a new
// `state.<field>` name, so it adds nothing to set 1. `state.featureRelevant` is the live example.
function bulkStateFieldsIn(regionCode, labCodeWithStrings, readHelper) {
  const found = new Set();
  for (const m of regionCode.matchAll(/\bObject\s*\.\s*assign\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = spanFrom(regionCode, open);
    if (close < 0) throw bulkMiss('the end of an `Object.assign(` call — its parentheses do not balance');
    const args = splitTopLevel(regionCode.slice(open + 1, close));
    const target = (args[0] || '').trim();
    if (/\buniforms\b/.test(target)) {
      throw bulkMiss(`the uniforms written by \`Object.assign(${target}, …)\` — a bulk write into a uniform bag is invisible to sets 2 and 3 for exactly the reason a bulk write into \`state\` is invisible to set 1`);
    }
    if (target !== 'state') continue;
    for (const a of args.slice(1)) for (const f of bulkAssignFields(a, labCodeWithStrings, readHelper)) found.add(f);
  }
  return found;
}

const defaultReadHelper = (abs) => readFileSync(abs, 'utf8');

export function measureLabSurface(src, opts = {}) {
  // The helper reader is overridable for the SAME reason LAB_SRC is: CONTROL G mutates
  // giantDeck.js's binding table and must see the ratchet red WITHOUT writing to a file another
  // lane owns. Convenience, not a boundary.
  const readHelper = opts.readHelper || defaultReadHelper;
  const code = stripNonCode(src);
  const codeWithStrings = stripComments(src);
  const L = code.split('\n');
  const applyDriversExtent = extentOf(L, /^\s*function\s+applyDrivers\s*\(\s*\)\s*\{/, 'function applyDrivers(){');
  const frameExtent = extentOf(L, /^\s*function\s+frame\s*\(\s*\)\s*\{/, 'function frame(){');
  const st = new Set();
  const un = new Set();
  const adUn = new Set();
  const cal = new Set();
  const key = (m) => {
    const bag = m[1].replace(/\.$/, '');
    return (bag === '' ? '' : bag + '.') + 'uniforms::' + m[2];
  };
  for (let i = applyDriversExtent[0] - 1; i < applyDriversExtent[1]; i++) {
    for (const m of L[i].matchAll(STATE_WRITE)) st.add(m[1]);
    for (const m of L[i].matchAll(UNIFORM_TOUCH)) adUn.add(key(m));
    for (const m of L[i].matchAll(CALLEE)) { const c = calleeName(m); if (c) cal.add('applyDrivers::' + c); }
  }
  for (let i = frameExtent[0] - 1; i < frameExtent[1]; i++) {
    for (const m of L[i].matchAll(UNIFORM_TOUCH)) un.add(key(m));
    for (const m of L[i].matchAll(CALLEE)) { const c = calleeName(m); if (c) cal.add('frame::' + c); }
  }
  // The bulk arm runs over the region TEXT, not line by line: an `Object.assign(` call may wrap,
  // and a line-at-a-time scan of a multi-line call is its own silent zero.
  // ⚠ Sliced from the STRING-PRESERVING view, on the same line numbers — both strippers blank in
  // place and keep every newline. An inline `Object.assign(state, { 'seaLevel': 0 })` has its key
  // inside a string literal, and slicing the blanked view would resolve it to the empty name.
  const bulk = bulkStateFieldsIn(
    codeWithStrings.split('\n').slice(applyDriversExtent[0] - 1, applyDriversExtent[1]).join('\n'),
    codeWithStrings, readHelper,
  );
  const lexical = new Set(st);
  for (const f of bulk) st.add(f);
  return {
    applyDriversExtent,
    frameExtent,
    stateFields: [...st].sort(),
    frameUniforms: [...un].sort(),
    applyDriversUniforms: [...adUn].sort(),
    // Set 4 — the helper hop. Region-qualified for the same reason set 2's entries are bag-qualified:
    // a helper that `frame()` starts calling is a new authoring site even when `applyDrivers` has
    // called it for months, and a name-only set would merge the two and miss it.
    callees: [...cal].sort(),
    // Reported separately so liveness can prove the arm CONTRIBUTED. If this silently drops to
    // empty, set 1 shrinks and a shrink-only ratchet calls that GREEN — which is the failure.
    bulkStateFields: [...bulk].sort(),
    // What the LEXICAL scan alone found. Kept so liveness can assert the arm contributed something
    // the lexical scan could NOT have — a rot-proof way of saying "the helper hop really ran"
    // without naming a field that a legitimate refactor may delete. See the liveness test.
    lexicalStateFields: [...lexical].sort(),
  };
}

// The ratchet itself: growth blocks, shrink is reported and allowed.
export function ratchetDiff(baseline, measured) {
  const base = new Set(baseline);
  const now = new Set(measured);
  return {
    added: [...now].filter((x) => !base.has(x)).sort(),
    removed: [...base].filter((x) => !now.has(x)).sort(),
  };
}

const growthMessage = (what, added, opts = {}) =>
  `${what} GREW by ${added.length}: ${added.join(', ')}\n\n` +
  (opts.why ||
    `A new ${what} means a feature was authored inside applyDrivers()/frame() — the path this ` +
    `ratchet exists to close. `) +
  `Read ${AUTHORING_DOC} and author it as a driver pack instead. If the addition is genuinely ` +
  `correct, add the entry to ${opts.where || 'tests/fixtures/lab-surface-baseline.mjs'} IN THE SAME ` +
  `COMMIT, with a one-line reason. Silence is not one of the options.`;

const read = () => readFileSync(LAB_SRC, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// SET 4's BASELINE — pinned HERE, and the other three are not
// ─────────────────────────────────────────────────────────────────────────────
// ⚠ Sets 1-3 live in tests/fixtures/lab-surface-baseline.mjs. This one does not, and the honest
// reason is mechanical rather than principled: set 4 landed while that fixture was owned by another
// concurrent lane, and a pinned list is worthless if two lanes re-bless it at once. It belongs beside
// the other three. MOVE IT THERE — with `CALLEES_MEASURED_AT` and both floors — in the next commit
// that re-blesses the fixture for its own reasons, and delete this paragraph with it.
//
// The entry shape is `<region>::<name>`, where region is `applyDrivers` or `frame`.
const CALLEES_MEASURED_AT = { commit: 'c9d7ffb', date: '2026-08-10', count: 28 };

const APPLY_DRIVERS_AND_FRAME_CALLEES = [
  'applyDrivers::_clamp01',
  'applyDrivers::_ss',
  'applyDrivers::applyArchetypeFilter',
  'applyDrivers::applyStormState',        // ⭐ driver function #3 — see KNOWN LIMIT 1
  'applyDrivers::atmosphereOpticsOf', 'applyDrivers::terminatorOpticsOf',   // ⛔ APPENDED ON THIS LINE, NOT INSERTED — this file is line-cited (one-pipeline-fence.test.js:233). ⭐ terminatorOpticsOf REGISTERED 2026-08-22, per this fence's own instruction ('add the entry ... with a one-line reason. Silence is not one of the options.'). REASON: it is the OPPOSITE of the hazard set 4 guards. Set 4 exists to catch a feature authored INTO the lab through a helper instead of a pack; this call REMOVES a law from the lab — the binary termStrength copy — and routes it to the shared module the game already uses. It sits beside atmosphereOpticsOf, which is here for the same reason.
  'applyDrivers::deriveConditionVector',
  'applyDrivers::deriveUniforms',
  'applyDrivers::drawPresetConditions',
  'applyDrivers::drawPresetRadius',
  'applyDrivers::drawPresetRotation',
  'applyDrivers::giantDeckLabState', 'applyDrivers::solidFeaturesPack', 'applyDrivers::solidFeaturesLabState', 'applyDrivers::visScaleOf', 'applyDrivers::limbDeckPack', 'applyDrivers::limbDeckLabState', 'applyDrivers::solidOpticsPack', 'applyDrivers::solidOpticsLabState', 'applyDrivers::compositionClass', 'applyDrivers::selectPacks', 'applyDrivers::fluvialDeckPack', 'applyDrivers::fluvialDeckLabState', 'applyDrivers::fluvialDeckDirectDrivers',   // ⭐ AND THREE MORE JOINED THE STATEMENTS ON 2026-09-02 — DRIVER PACK #9 `fluvialDeck`, the lab's F11/F12/F13/F14/F20 block (world-engine-lab.html:2123-2167) moved out to src/worldengine/drivers/fluvialDeck.js and read back at :2136. REGISTERED per this fence's own instruction, and they are the OPPOSITE of the hazard set 4 guards, exactly as the ten above: set 4 exists to catch a feature authored INTO the lab through a helper, and these three REMOVE twelve inline assignment lines from applyDrivers and route them to a module the game imports. ⚠ `fluvialDeckDirectDrivers` IS THE FIRST DIRECT-DRIVER CALL IN THIS REGION and it costs set 3 a name: the lab's `uniforms.uLiquidMask.value = _seaCoverage` at :2148 is gone and the replacement writes through `uniforms[k].value`, which KNOWN LIMIT 2's lexical scan cannot see. That is a SHRINK of the watched direct-uniform set (green by design — only growth reds) and the first `uniforms[` inside applyDrivers, which KNOWN LIMIT 2(a) named as the day this becomes a blocker for `state[`. It is `uniforms[`, not `state[`, and the pack's own suite pins the name by contract instead. ⛔ APPENDED ON THIS LINE, NOT INSERTED — line-cited file. 2026-08-25: the limb/terminator/aurora wire. limbDeck (gas) and solidOptics (non-gas) are exact complements over uLimbExponent/uLimbColor, so both packs plus both mirrors arrive together or the field has two owners on half the population; compositionClass is the branch that picks between them. ⭐ AND 'applyDrivers::selectPacks' JOINED THE STATEMENTS ON 2026-08-26 — the lab now asks the SHARED applicability law whether limbDeck applies, instead of hand-writing compositionClass(...) === 'gas'. Measured behaviour-neutral: six presets read identical limb/aurora/band/jet/tempEq before and after, with the control verified to lack the call. ⛔ AND MY FIRST ATTEMPT AT THIS APPEND LANDED AT COLUMN 665, PAST THE // AT COLUMN 309 — inside this very comment, dead, while the line above says APPENDED ON THIS LINE. It means append to the STATEMENTS, before the first //; the ratchet caught it, which is the ratchet working.
  // the pack hop the Object.assign arm resolves. ⛔ THE THREE APPENDED ON THIS LINE, NOT INSERTED — this file is line-cited (one-pipeline-fence.test.js:13 pins :233). ⭐ REGISTERED 2026-08-22, per this fence's own instruction, and they are the OPPOSITE of the hazard set 4 guards, exactly as atmosphereOpticsOf/terminatorOpticsOf above: set 4 exists to catch a feature authored INTO the lab through a helper instead of a pack, and these three REMOVE fourteen inline laws from the lab and route them to src/worldengine/drivers/solidFeatures.js, which the game already imports (workstream AC5). `visScaleOf` rides along because applyDrivers now passes the LAB's display policy to a pack — the same call rebakeE5Bands already makes at world-engine-lab.html:1748 for pack #1, one region further in. ⚠ DRIVER PACK #8 `giantSurface` DELIBERATELY ADDS NOTHING HERE, and the absence is the record of a bug this fence did not catch: its call was first written into applyDrivers, which registered three callees here and threw `_gs is not defined` on page load, because applyDrivers ENDS at world-engine-lab.html:2760 and seven of that pack's outputs are authored in ensureNetworkRouted. Moved to that function, the seam is outside both watched regions and costs all four sets nothing. ⛔ SET 4 IS BLIND TO A THIRD REGION — it watches applyDrivers and frame only, so a feature authored into ensureNetworkRouted is invisible to it. Stated as a known limit rather than widened here: widening the watched set is its own measured change, not a side effect of wiring a pack.
  'applyDrivers::rebakeE5Bands',          // ⭐ driver function #4 — see KNOWN LIMIT 1
  'applyDrivers::relevantFeatureSet',
  'applyDrivers::resetDriverOverrides',
  'applyDrivers::riverRerouteDebounced',
  'applyDrivers::syncDisplays',
  'frame::_stormDeckZ',
  'frame::animationRateFactor',
  'frame::autoOctaves',
  'frame::bakeReliefCrossover',
  'frame::featureFrequencyFromKm',
  'frame::holdApparentDistance',
  'frame::lodHysteresis',
  'frame::lodRampOf',
  'frame::minCameraDistance',
  'frame::reliefEnvelope',
  'frame::requestAnimationFrame',
  'frame::visScaleOf',
];

// Floors, per region, for the same reason the other three sets have them: the empty set is a subset
// of every set, so a regex that stops matching reports GREEN forever. PER REGION rather than in
// total, because a total of 28 is satisfied by one region going dark while the other grows.
//
// ⛔ NO NAMED SENTINELS HERE, and that is the bulk arm's lesson applied rather than a preference.
// The obvious picks — `applyStormState`, `rebakeE5Bands` — are exactly the calls PLAN Step 5c is
// expected to rewrite, and a sentinel the next step legitimately removes is a gate that gets relaxed
// the first time it fires. See the BULK_STATE_SENTINELS note in the fixture for the measured version
// of this mistake. The floors and the both-regions-represented check below name nothing.
const MIN_CALLEES_APPLY_DRIVERS = 8;   // measured 16
const MIN_CALLEES_FRAME = 6;           // measured 12

// ─────────────────────────────────────────────────────────────────────────────
describe('harness liveness — the ratchet is measuring something', () => {
  // WHY THIS BLOCK EXISTS: every assertion in the next describe() passes trivially against an
  // empty measurement. These four are the only ones that can tell "nothing was added" apart from
  // "nothing was looked at".
  const m = measureLabSurface(read());

  it('locates both functions and they are non-trivial regions', () => {
    expect(m.applyDriversExtent[1]).toBeGreaterThan(m.applyDriversExtent[0] + 200);
    expect(m.frameExtent[1]).toBeGreaterThan(m.frameExtent[0] + 200);
  });

  it('finds at least the floor number of entries in each set', () => {
    expect(m.stateFields.length).toBeGreaterThanOrEqual(MIN_STATE_FIELDS);
    expect(m.frameUniforms.length).toBeGreaterThanOrEqual(MIN_FRAME_UNIFORMS);
    expect(m.applyDriversUniforms.length).toBeGreaterThanOrEqual(MIN_APPLY_DRIVERS_UNIFORMS);
  });

  it('finds every Step-5-safe sentinel', () => {
    // Chosen because Step 5c does NOT delete them. Band/jet names are deliberately excluded —
    // a sentinel the next step legitimately removes is a gate that gets relaxed on first fire.
    for (const s of STATE_SENTINELS) expect(m.stateFields).toContain(s);
    for (const u of UNIFORM_SENTINELS) expect(m.frameUniforms).toContain(u);
    for (const u of APPLY_DRIVERS_UNIFORM_SENTINELS) expect(m.applyDriversUniforms).toContain(u);
  });

  it('the Object.assign arm CONTRIBUTED — it did not resolve to the empty set', () => {
    // ⭐ THE ARM'S OWN LIVENESS, and it needs its own assertion for a reason the other floors do not
    // cover. If the resolver quietly stops finding fields, set 1 SHRINKS — and a shrink-only ratchet
    // reports a shrink as GREEN. So the arm can die whole, take nine fields with it, and every
    // assertion in the ratchet block below stays passing. This is the only thing that notices.
    expect(m.bulkStateFields.length).toBeGreaterThanOrEqual(MIN_BULK_STATE_FIELDS);
    // …and every field it found is genuinely in set 1, i.e. the merge really happened.
    for (const f of m.bulkStateFields) expect(m.stateFields).toContain(f);
    // ⛔ NOT A NAMED SENTINEL, AND THAT IS A MEASURED DECISION RATHER THAN A PREFERENCE. The first
    // draft of this test named `bandRough` and `jetFestoon`. Deleting one row from
    // `LAB_STATE_BINDING` — a legal shrink; `giantDeckDirectDrivers` is DEFINED as that table's
    // complement, so a row that leaves becomes a direct uniform write — then turned this file RED,
    // which is the freeze behaviour CONTROL C exists to forbid and the exact way a gate gets
    // deleted the first time it fires wrongly. The structural form below says the same thing
    // without naming anything: the arm found at least one field the LEXICAL scan could not have,
    // so the helper hop really executed. It survives any row leaving and still catches a dead arm.
    const lexical = new Set(m.lexicalStateFields);
    expect(m.bulkStateFields.filter((f) => !lexical.has(f)).length).toBeGreaterThan(0);
  });

  it('set 3 is not a duplicate of set 2 — the hole it closes is real and still open', () => {
    // If this ever drops to zero, every uniform written in applyDrivers is also mentioned in
    // frame() and set 3 has become redundant. That is a fine outcome — but it should be noticed
    // and the set retired deliberately, not left standing as ceremony.
    const inFrame = new Set(m.frameUniforms.map((k) => k.split('::')[1]));
    const onlyInApplyDrivers = m.applyDriversUniforms
      .map((k) => k.split('::')[1])
      .filter((n) => !inFrame.has(n));
    expect(onlyInApplyDrivers.length).toBeGreaterThan(0);
  });

  it('set 4 is alive in BOTH regions, and the declaration filter has not eaten it', () => {
    const ad = m.callees.filter((c) => c.startsWith('applyDrivers::'));
    const fr = m.callees.filter((c) => c.startsWith('frame::'));
    expect(ad.length).toBeGreaterThanOrEqual(MIN_CALLEES_APPLY_DRIVERS);
    expect(fr.length).toBeGreaterThanOrEqual(MIN_CALLEES_FRAME);
    // No third prefix: if the key ever drifts, the two filters stop summing to the whole and this
    // catches it before the ratchet starts diffing entries against a differently-shaped baseline.
    expect(ad.length + fr.length).toBe(m.callees.length);
    // The declaration filter is the one piece of set 4 that can fail SILENTLY-ish: if it inverts, the
    // set grows by two and the ratchet reds loudly; if it over-matches, calls start disappearing and
    // the set SHRINKS, which a shrink-only ratchet calls GREEN. Both header names must be absent —
    // each function's own `function X(){` line sits inside its own measured region.
    expect(m.callees).not.toContain('applyDrivers::applyDrivers');
    expect(m.callees).not.toContain('frame::frame');
  });

  it('is deterministic — two passes over the same bytes agree exactly', () => {
    const a = measureLabSurface(read());
    const b = measureLabSurface(read());
    expect(a.stateFields).toEqual(b.stateFields);
    expect(a.frameUniforms).toEqual(b.frameUniforms);
    expect(a.callees).toEqual(b.callees);
  });

  it('the qualified-bag arm is alive — uTime is counted twice, in two different bags', () => {
    // If this ever collapses to one entry the keying has silently degraded to name-only, and a
    // second material's uniforms stop being distinguishable from the planet's.
    const uTimes = m.frameUniforms.filter((k) => k.endsWith('::uTime'));
    expect(uTimes.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the ratchet — no set may grow', () => {
  const m = measureLabSurface(read());

  it('applyDrivers writes no state field that is not in the baseline', () => {
    const { added, removed } = ratchetDiff(APPLY_DRIVERS_STATE_FIELDS, m.stateFields);
    if (removed.length) {
      // Informational, never a failure. Step 5c is EXPECTED to shrink this set.
      console.log(`[ratchet] applyDrivers shed ${removed.length} state field(s) since ${MEASURED_AT.commit}: ${removed.join(', ')}`);
    }
    expect(added, growthMessage('applyDrivers state field', added)).toEqual([]);
  });

  it('frame touches no uniform that is not in the baseline', () => {
    const { added, removed } = ratchetDiff(FRAME_UNIFORMS, m.frameUniforms);
    if (removed.length) {
      console.log(`[ratchet] frame() shed ${removed.length} uniform(s) since ${MEASURED_AT.commit}: ${removed.join(', ')}`);
    }
    expect(added, growthMessage('frame() uniform', added)).toEqual([]);
  });

  it('applyDrivers touches no uniform that is not in the baseline', () => {
    const { added, removed } = ratchetDiff(APPLY_DRIVERS_UNIFORMS, m.applyDriversUniforms);
    if (removed.length) {
      console.log(`[ratchet] applyDrivers shed ${removed.length} direct uniform write(s) since ${MEASURED_AT.commit}: ${removed.join(', ')}`);
    }
    expect(added, growthMessage('applyDrivers direct uniform', added)).toEqual([]);
  });

  it('neither region calls a function that is not in the baseline', () => {
    const { added, removed } = ratchetDiff(APPLY_DRIVERS_AND_FRAME_CALLEES, m.callees);
    if (removed.length) {
      console.log(`[ratchet] applyDrivers/frame shed ${removed.length} callee(s) since ${CALLEES_MEASURED_AT.commit}: ${removed.join(', ')}`);
    }
    expect(added, growthMessage('applyDrivers()/frame() callee', added, {
      why:
        'A new callee means a feature was reached FROM applyDrivers()/frame() — the same un-packed ' +
        'authoring path as a direct write, one indirection further out, and invisible to the other ' +
        'three sets because the helper body sits outside both watched regions. ',
      where: 'APPLY_DRIVERS_AND_FRAME_CALLEES in tests/lab-surface-ratchet.test.js',
    })).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTED CONTROLS — §11.3.1 and §11.3.3. These run on every pass, against synthetic mutations
// of the REAL file's text put through the REAL harness. A gate that has only ever been seen to
// pass is not a gate; these are the states in which it fails, committed.
// ─────────────────────────────────────────────────────────────────────────────
describe('controls — the states in which this ratchet fails', () => {
  const src = read();
  const m = measureLabSurface(src);

  // Splice a line in immediately after the `function applyDrivers(){` header. Line-based so the
  // brace matcher sees a well-formed body either way.
  const injectIntoApplyDrivers = (line) => {
    const L = src.split('\n');
    L.splice(m.applyDriversExtent[0], 0, line);
    return L.join('\n');
  };
  const injectIntoFrame = (line) => {
    const L = src.split('\n');
    L.splice(m.frameExtent[0], 0, line);
    return L.join('\n');
  };

  // The helper-hop shape, spliced in two places at once: the definition on the line ABOVE the
  // `function applyDrivers(){` header — outside every watched region — and the call as the first
  // statement inside. This is the mutation that stayed 25/25 GREEN before set 4 existed.
  const injectHelperHop = (defLine, callLine) => {
    const L = src.split('\n');
    L.splice(m.applyDriversExtent[0], 0, callLine);       // first statement inside the body
    L.splice(m.applyDriversExtent[0] - 1, 0, defLine);    // …and the definition just above the header
    return L.join('\n');
  };

  // ⭐ CONTROLS A, B, C and D diff the mutant against the CURRENT measurement, not against the
  // committed fixture. That makes each one a self-contained proof about the DETECTOR — "injecting
  // X is seen as X" — which stays true and stays meaningful after Step 5c has legitimately shrunk
  // the fixture out from under them. The fixture-versus-reality comparison lives in exactly one
  // place, the ratchet block above, and A′ is its restore half.

  it('CONTROL A — a fake state field REDS', () => {
    const mutated = measureLabSurface(injectIntoApplyDrivers('      state.__ratchetCanary = 1.0;'));
    const { added } = ratchetDiff(m.stateFields, mutated.stateFields);
    expect(added).toEqual(['__ratchetCanary']);
    expect(mutated.stateFields.length).toBe(m.stateFields.length + 1);
  });

  it('CONTROL A′ — removing that fake field returns to GREEN', () => {
    // The same harness over the unmutated bytes. This is the "restore" half: the red in CONTROL A
    // is attributable to the injected line and to nothing else about the run.
    const { added } = ratchetDiff(APPLY_DRIVERS_STATE_FIELDS, measureLabSurface(src).stateFields);
    expect(added).toEqual([]);
  });

  it('CONTROL B — a fake uniform in frame() REDS, in whichever bag it is written', () => {
    const bare = measureLabSurface(injectIntoFrame('      uniforms.uRatchetCanary.value = 1.0;'));
    expect(ratchetDiff(m.frameUniforms, bare.frameUniforms).added).toEqual(['uniforms::uRatchetCanary']);
    // The qualified arm: a feature routed through some other material is still a feature authored
    // in frame(), and a name-only set keyed on `uTime` would have missed the shape entirely.
    const qualified = measureLabSurface(injectIntoFrame('      someOther.material.uniforms.uTime.value = 1.0;'));
    expect(ratchetDiff(m.frameUniforms, qualified.frameUniforms).added)
      .toEqual(['someOther.material.uniforms::uTime']);
  });

  it('CONTROL C — REMOVAL stays GREEN: this is a ratchet, not a freeze', () => {
    // A shrink-only ratchet that reds on shrink is a freeze, and it will be deleted the first time
    // it fires wrongly — which is Step 5c, whose whole job is deleting the gas block out of
    // applyDrivers. So the shrink is exercised at source level, through the real extractor.
    //
    // Subject: `surfaceGravity` and `habitability`, each written on its own line and exactly once.
    // ⚠ NOT the band fields — 5c deletes those, after which a control keyed on them would find
    // nothing to remove and fail for the wrong reason. A control must not rot into a red.
    const L = src.split('\n');
    const kept = L.filter((line, idx) => {
      const inAD = idx + 1 >= m.applyDriversExtent[0] && idx + 1 <= m.applyDriversExtent[1];
      return !(inAD && /^\s*state\.(surfaceGravity|habitability)\s*=/.test(line));
    });
    expect(kept.length).toBe(L.length - 2);   // the two lines really were found and dropped
    const shrunk = measureLabSurface(kept.join('\n'));
    const { added, removed } = ratchetDiff(m.stateFields, shrunk.stateFields);
    expect(removed).toEqual(['habitability', 'surfaceGravity']);   // the shrink really happened
    expect(added).toEqual([]);                                     // and it is GREEN
  });

  it('CONTROL D — a COUNT-PRESERVING PERMUTATION REDS (the Step 4 scar)', () => {
    // Step 4's re-bless pinned counts, and a count-preserving permutation passed every instrument
    // byte-identically. Rename one field: the count is unchanged, so any count-based gate is green
    // and a new authoring site has landed. Membership catches it as an addition.
    // Renaming a Step-5-safe field, for the same no-rot reason as CONTROL C.
    const L = src.split('\n');
    let hits = 0;
    const renamed = L.map((line, idx) => {
      const inAD = idx + 1 >= m.applyDriversExtent[0] && idx + 1 <= m.applyDriversExtent[1];
      if (!inAD || !/state\.surfaceGravity\s*=/.test(line)) return line;
      hits++;
      return line.replace(/state\.surfaceGravity(\s*=)/, 'state.gravityAtSurface$1');
    });
    expect(hits).toBe(1);   // the permutation really was applied
    const perm = measureLabSurface(renamed.join('\n'));
    expect(perm.stateFields.length).toBe(m.stateFields.length);   // ⛔ a count gate sees NOTHING
    const { added, removed } = ratchetDiff(m.stateFields, perm.stateFields);
    expect(added).toEqual(['gravityAtSurface']);                   // ✓ membership sees it
    expect(removed).toEqual(['surfaceGravity']);
  });

  it('CONTROL B2 — a fake uniform in applyDrivers REDS on set 3', () => {
    // The seven-feature hole, proven closed. Before set 3 existed this mutation was INVISIBLE to
    // the whole ratchet: it adds no state field and it is not in frame().
    const mutated = measureLabSurface(injectIntoApplyDrivers('      uniforms.uRatchetCanaryAD.value = 1.0;'));
    expect(ratchetDiff(m.applyDriversUniforms, mutated.applyDriversUniforms).added)
      .toEqual(['uniforms::uRatchetCanaryAD']);
    // …and it really is invisible to the other two sets, which is the point.
    expect(ratchetDiff(m.stateFields, mutated.stateFields).added).toEqual([]);
    expect(ratchetDiff(m.frameUniforms, mutated.frameUniforms).added).toEqual([]);
  });

  // ── Set 4's own controls — the helper hop ──────────────────────────────────────────────────────

  it('CONTROL M — a HELPER HOP out of applyDrivers REDS, and it reds on set 4 ALONE', () => {
    // ⭐ THE DEFECT, REPRODUCED AND CLOSED IN ONE BODY. Before set 4 this exact mutation left the
    // suite 25/25 GREEN: one new function, defined one line above the header, called on the first
    // line of the body, writing a brand-new `state` field that no set could see.
    const mutated = measureLabSurface(injectHelperHop(
      '    function applyBypassFeature(){ state.__bypassField = 1.0; }',
      '      applyBypassFeature();',
    ));
    // First the half that is still true: sets 1-3 see NOTHING. If any of these three ever starts
    // catching it, this control's premise has changed and the reasoning above needs re-reading —
    // it does not become a pass-by-accident.
    expect(ratchetDiff(m.stateFields, mutated.stateFields).added).toEqual([]);
    expect(ratchetDiff(m.frameUniforms, mutated.frameUniforms).added).toEqual([]);
    expect(ratchetDiff(m.applyDriversUniforms, mutated.applyDriversUniforms).added).toEqual([]);
    // …and the field really did land outside every watched region, which is what makes those three
    // greens evidence rather than an artifact of a mutation that did nothing.
    expect(mutated.stateFields).not.toContain('__bypassField');
    // Then the half set 4 adds — against the CURRENT measurement and against the COMMITTED list,
    // which is the shape a real commit would take.
    expect(ratchetDiff(m.callees, mutated.callees).added).toEqual(['applyDrivers::applyBypassFeature']);
    expect(ratchetDiff(APPLY_DRIVERS_AND_FRAME_CALLEES, mutated.callees).added)
      .toEqual(['applyDrivers::applyBypassFeature']);
  });

  it("CONTROL M′ — the unmutated source is GREEN on set 4, so CONTROL M's red is the hop", () => {
    // The restore half. Same harness, same committed list, unmutated bytes.
    expect(ratchetDiff(APPLY_DRIVERS_AND_FRAME_CALLEES, measureLabSurface(src).callees).added).toEqual([]);
  });

  // ⭐ LOCATED, NOT NAMED — CONTROL C's and CONTROL G's argument, applied a third time. A control
  // keyed on `syncDisplays()` turns red the day Step 5 stops calling it, failing for the wrong
  // reason. This finds the first callee in `applyDrivers` that occurs EXACTLY ONCE in the region and
  // whose one occurrence is a whole statement on its own line, so deleting that line is brace-safe.
  // Asserted found, so a restructured body is a loud failure of the CONTROL rather than a no-op.
  const soloStatementCall = (() => {
    const CL = stripNonCode(src).split('\n');   // stripped: a call inside a comment is not a call
    const seen = new Map();
    for (let i = m.applyDriversExtent[0] - 1; i < m.applyDriversExtent[1]; i++) {
      for (const mm of CL[i].matchAll(CALLEE)) {
        const c = calleeName(mm);
        if (!c) continue;
        if (!seen.has(c)) seen.set(c, []);
        seen.get(c).push(i);
      }
    }
    for (const [name, idxs] of seen) {
      if (idxs.length !== 1) continue;
      if (!new RegExp(`^\\s*${name}\\s*\\([^;]*\\)\\s*;\\s*$`).test(CL[idxs[0]])) continue;
      return { name, idx: idxs[0] };
    }
    return null;
  })();

  it('CONTROL N — a callee LEAVING stays GREEN: this is a ratchet, not a freeze', () => {
    // Set 4 reds on a helper EXTRACTION, which is a shape a legitimate refactor also takes (see the
    // header). That makes this control load-bearing rather than symmetrical decoration: if the set
    // also red when a call went away, the first legitimate inlining would delete this file.
    expect(soloStatementCall, 'no single-occurrence standalone `helper(…);` statement found in applyDrivers — relocate this control, do not delete it').not.toBeNull();
    const L = src.split('\n');
    const kept = L.filter((_, i) => i !== soloStatementCall.idx);
    expect(kept.length).toBe(L.length - 1);   // the line really was found and dropped
    const shrunk = measureLabSurface(kept.join('\n'));
    const { added, removed } = ratchetDiff(m.callees, shrunk.callees);
    expect(removed).toEqual([`applyDrivers::${soloStatementCall.name}`]);   // the shrink really happened
    expect(added).toEqual([]);                                             // and it is GREEN
  });

  it('CONTROL O — a COUNT-PRESERVING callee RENAME REDS (the Step 4 scar, on set 4)', () => {
    // CONTROL D's argument applied to the fourth set. Renaming the helper holds the count at 28 —
    // any count-based gate is green — while the call now reaches somewhere new.
    const L = src.split('\n');
    const line = L[soloStatementCall.idx];
    const renamed = line.replace(
      new RegExp(`\\b${soloStatementCall.name}\\s*\\(`),
      `__renamed_${soloStatementCall.name}(`,
    );
    expect(renamed).not.toBe(line);   // the permutation really was applied
    L[soloStatementCall.idx] = renamed;
    const perm = measureLabSurface(L.join('\n'));
    expect(perm.callees.length).toBe(m.callees.length);   // ⛔ a count gate sees NOTHING
    const { added, removed } = ratchetDiff(m.callees, perm.callees);
    expect(added).toEqual([`applyDrivers::__renamed_${soloStatementCall.name}`]);   // ✓ membership sees it
    expect(removed).toEqual([`applyDrivers::${soloStatementCall.name}`]);
  });

  it('CONTROL E — a dead harness cannot pass: an empty measurement fails liveness', () => {
    // The failure this whole file is most exposed to. Growth-only assertions are all GREEN here.
    const empty = { stateFields: [], frameUniforms: [], applyDriversUniforms: [], callees: [] };
    expect(ratchetDiff(APPLY_DRIVERS_STATE_FIELDS, empty.stateFields).added).toEqual([]);
    expect(ratchetDiff(FRAME_UNIFORMS, empty.frameUniforms).added).toEqual([]);
    expect(ratchetDiff(APPLY_DRIVERS_UNIFORMS, empty.applyDriversUniforms).added).toEqual([]);
    expect(ratchetDiff(APPLY_DRIVERS_AND_FRAME_CALLEES, empty.callees).added).toEqual([]);
    // …and the liveness floor is what refuses it.
    expect(empty.stateFields.length).toBeLessThan(MIN_STATE_FIELDS);
    expect(empty.frameUniforms.length).toBeLessThan(MIN_FRAME_UNIFORMS);
    expect(empty.applyDriversUniforms.length).toBeLessThan(MIN_APPLY_DRIVERS_UNIFORMS);
    expect(empty.callees.filter((c) => c.startsWith('applyDrivers::')).length).toBeLessThan(MIN_CALLEES_APPLY_DRIVERS);
    expect(empty.callees.filter((c) => c.startsWith('frame::')).length).toBeLessThan(MIN_CALLEES_FRAME);
    // A renamed function must throw rather than measure nothing.
    expect(() => measureLabSurface(src.replace('function applyDrivers(){', 'function applyDriversV2(){')))
      .toThrow(/could not locate/);
  });

  // ── The Object.assign arm's own controls ───────────────────────────────────────────────────────
  // Each mutates a COPY — of the lab, or of giantDeck.js through the `readHelper` override — and
  // puts it through the REAL harness. giantDeck.js is edited concurrently by other lanes and it is
  // the pack module the GAME imports; a test that wrote to it to prove a point would be a test that
  // can corrupt shipping code when it is interrupted.

  const GIANT_DECK = join(ROOT, 'src/worldengine/drivers/giantDeck.js');
  const deckSrc = readFileSync(GIANT_DECK, 'utf8');
  const withDeck = (mutate) => ({ readHelper: (abs) => (abs === GIANT_DECK ? mutate(deckSrc) : readFileSync(abs, 'utf8')) });

  // ⭐ THE CONTROLS BELOW LOCATE A TABLE ROW, THEY DO NOT NAME ONE. Naming one is how a control
  // rots: `LAB_STATE_BINDING` is expected to lose rows as Step 5 lands (a row that leaves becomes a
  // direct uniform write through `giantDeckDirectDrivers`, the table's complement), and a control
  // keyed on `uBandRough` turns into a red the day that row goes — failing for the wrong reason,
  // which is CONTROL C's argument applied to the second file. `firstRow` is asserted found, so a
  // restructured table is a loud failure of the CONTROL rather than a control that quietly no-ops.
  const tableAt = deckSrc.indexOf('export const LAB_STATE_BINDING');
  const firstRow = /^([ \t]*)(u[A-Za-z0-9_$]*)\s*:\s*'([A-Za-z0-9_$]+)',[ \t]*\r?\n/m.exec(deckSrc.slice(tableAt));

  it('CONTROL G — a NEW ROW in LAB_STATE_BINDING REDS, through two files', () => {
    // ⭐ THE POINT OF THE WHOLE ARM. Growth down the PACK path — the path this ratchet actively
    // recommends — was previously invisible: a tenth binding adds a tenth `state` field and the
    // lexical scan of applyDrivers sees nothing change, because nothing in applyDrivers changed.
    expect(tableAt, 'LAB_STATE_BINDING not found in giantDeck.js').toBeGreaterThan(-1);
    expect(firstRow, 'no `uX: \'y\',` row found in LAB_STATE_BINDING').not.toBeNull();
    const mutated = measureLabSurface(src, withDeck((d) =>
      d.replace(firstRow[0], `${firstRow[1]}uRatchetCanaryU: 'ratchetCanaryPacked',\n${firstRow[0]}`),
    ));
    expect(ratchetDiff(m.stateFields, mutated.stateFields).added).toEqual(['ratchetCanaryPacked']);
    expect(mutated.bulkStateFields).toContain('ratchetCanaryPacked');
    // It reds against the COMMITTED fixture too, which is the shape a real commit would take.
    expect(ratchetDiff(APPLY_DRIVERS_STATE_FIELDS, mutated.stateFields).added).toEqual(['ratchetCanaryPacked']);
  });

  it("CONTROL G′ — the unmutated deck is GREEN, so CONTROL G's red is the row and nothing else", () => {
    expect(ratchetDiff(APPLY_DRIVERS_STATE_FIELDS, measureLabSurface(src).stateFields).added).toEqual([]);
  });

  it('CONTROL H — REMOVING a row from LAB_STATE_BINDING stays GREEN: still a ratchet', () => {
    // A row can legitimately leave the table — `giantDeckDirectDrivers` is defined as its
    // complement, so dropping a row hands that driver to `writePackUniforms` instead. If the arm
    // red on that, the first legitimate refactor deletes this file.
    const mutated = measureLabSurface(src, withDeck((d) => d.replace(firstRow[0], '')));
    const { added, removed } = ratchetDiff(m.stateFields, mutated.stateFields);
    expect(removed).toEqual([firstRow[3]]);   // the shrink really happened, through the helper hop
    expect(added).toEqual([]);                // and it is GREEN
    // …and the arm is still alive afterwards, which is what stops "stays green on a shrink" from
    // being satisfied by an arm that has simply stopped working.
    expect(mutated.bulkStateFields.length).toBe(m.bulkStateFields.length - 1);
  });

  it('CONTROL I — an UNRESOLVABLE Object.assign source THROWS, it does not measure zero', () => {
    // ⛔ THE DEFECT BEING FIXED, in its purest form. Every one of these adds fields to `state` that
    // no lexical scan can name. Measuring zero would be GREEN — indistinguishable from "nothing was
    // added" — so each must be a loud red instead, under the same /could not locate/ treatment
    // CONTROL E uses for a renamed function.
    const cases = [
      'Object.assign(state, someUnresolvableExpr);',                 // a bare identifier
      'Object.assign(state, buildLabState(_deck));',                 // a call to nothing imported
      'Object.assign(state, { ...spreadIn });',                      // a literal whose keys are elsewhere
      'Object.assign(state, { [computedKey]: 1 });',                 // a computed key
      'Object.assign(state, cond ? a : b);',                         // an expression, not a call
      'Object.assign(state, giantDeckLabState(_deck), extraBag);',   // a resolvable source AND a bad one
    ];
    for (const line of cases) {
      expect(() => measureLabSurface(injectIntoApplyDrivers('      ' + line)), line)
        .toThrow(/could not locate/);
    }
    // …and the throw is not a blanket allergy to `Object.assign`: arm 1 resolves a plain literal,
    // and a bulk write into a LOCAL is correctly ignored rather than refused.
    const lit = measureLabSurface(injectIntoApplyDrivers('      Object.assign(state, { __bulkCanary: 1, "__bulkCanary2": 2 });'));
    expect(ratchetDiff(m.stateFields, lit.stateFields).added).toEqual(['__bulkCanary', '__bulkCanary2']);
    const local = measureLabSurface(injectIntoApplyDrivers('      Object.assign(_someLocalBag, whateverThisIs);'));
    expect(ratchetDiff(m.stateFields, local.stateFields).added).toEqual([]);
  });

  it('CONTROL J — a bulk write into a UNIFORM bag also THROWS', () => {
    // The same blindness, one set over. `Object.assign(uniforms, packUniforms(_deck))` would add
    // uniforms to sets 2/3 that the `<bag>.uniforms.<name>` regex cannot see, and a silent zero
    // there reads as GREEN for exactly the same reason.
    expect(() => measureLabSurface(injectIntoApplyDrivers('      Object.assign(uniforms, packUniforms(_deck));')))
      .toThrow(/could not locate/);
  });

  it('CONTROL K — the resolver reads the TABLE, not a hard-coded list of nine names', () => {
    // A resolver that had been "fixed" by pasting today's nine field names into the harness would
    // pass CONTROL G′ and every ratchet assertion, and would be dead the day the table changed.
    // Rename a row's VALUE: the count is unchanged — a count-based arm sees nothing — and the arm
    // must report the rename as one addition and one removal, which is only possible if it read the
    // table. This is CONTROL D's argument applied to the second file.
    const renamed = firstRow[0].replace(`'${firstRow[3]}'`, `'__renamed_${firstRow[3]}'`);
    const mutated = measureLabSurface(src, withDeck((d) => d.replace(firstRow[0], renamed)));
    expect(mutated.bulkStateFields.length).toBe(m.bulkStateFields.length);   // ⛔ a count arm sees NOTHING
    const { added, removed } = ratchetDiff(m.stateFields, mutated.stateFields);
    expect(added).toEqual([`__renamed_${firstRow[3]}`]);
    expect(removed).toEqual([firstRow[3]]);
  });

  it('CONTROL L — the helper hop fails LOUD when the helper stops being resolvable', () => {
    // The arm's own dead-harness case: if `giantDeckLabState` is renamed, or its binding table is,
    // the resolver must throw rather than contribute zero fields and let set 1 quietly shrink.
    expect(() => measureLabSurface(src, withDeck((d) => d.replace('export function giantDeckLabState(', 'export function giantDeckLabStateV2('))))
      .toThrow(/could not locate/);
    expect(() => measureLabSurface(src, withDeck((d) => d.replace('export const LAB_STATE_BINDING =', 'export const LAB_STATE_BINDING_V2 ='))))
      .toThrow(/could not locate/);
    // Strings must survive the helper's stripper — blanking them would resolve the table's nine
    // values to nine empty names, which is a silent zero produced by the lexer instead of the regex.
    expect(stripComments("const T = { a: 'b' }; // x").includes("'b'")).toBe(true);
    expect(stripNonCode("const T = { a: 'b' };").includes("'b'")).toBe(false);
  });

  it('CONTROL F — the comment phantom is really removed, and really was a phantom', () => {
    // Reproduces the PLAN's 328 and shows what the 328th was. If `stripNonCode` ever stops
    // stripping, this flips and the ±1 comes back.
    const rawNames = new Set();
    const L = src.split('\n');
    for (let i = m.frameExtent[0] - 1; i < m.frameExtent[1]; i++) {
      for (const mm of L[i].matchAll(new RegExp(UNIFORM_TOUCH.source, 'g'))) rawNames.add(mm[2]);
    }
    const strippedNames = new Set(m.frameUniforms.map((k) => k.split('::')[1]));
    expect(rawNames.has('js')).toBe(true);            // the phantom, from "src/worldengine/shaders/uniforms.js"
    expect(strippedNames.has('js')).toBe(false);      // gone once comments are stripped
    expect(rawNames.size - strippedNames.size).toBe(1);
  });
});

// tests/radius-live-feed.test.js — the BEHAVIOURAL pins for the radius rewire.
// Workstream: world-engine-radius-live-feed-2026-07-25. Covers AC-REGIME, AC-CRATERBOOT, and the
// headless half of AC-BANDS (the live A/B on the giant is Max's UAT + the browser lane).
//
// METHOD — SOURCE EXECUTION, NOT RE-IMPLEMENTATION. The rewired consumers live INLINE in
// world-engine-lab.html (inside applyDrivers / rebakeE5Bands / applyStormState), so there is nothing to
// import. This suite therefore CUTS each expression out of the live source at run time and executes it.
// That matters: a re-implementation would pass forever while the lab drifted underneath it.
//
// ══ THE EXTRACTION CONTRACT — RESTATED 2026-08-08 (PLAN §4 Step 3). THE OLD ONE WAS FALSE. ════════
// It read: "Every extraction throws loudly if its pattern stops matching, so 'the source changed
// shape' surfaces as a hard failure rather than as a silently-vacuous green." Two ways that was
// wrong. Both were measured against a scratch mirror of the repo, not reasoned:
//   1. NOT EVERY EXTRACTION THREW. `SRC_E5_RADIUS_LINES` was a bare Array.prototype.filter with no
//      no-match branch, so it returned []. With both `radius: … / 11.2` lines deleted, the loop in
//      "all four rewired sites match the captured pre-rewire values, exactly" ran ZERO iterations and
//      that test PASSED. The file went red only by ACCIDENT — a TypeError "Cannot read properties of
//      undefined (reading 'replace')" thrown at module scope by the `.replace()` two describes below,
//      which names the wrong site and kills collection before one assertion runs.
//   2. "THE PATTERN STOPS MATCHING" WAS NOT THE FAILURE MODE THAT MATTERED. The lab's habit when a
//      law moves is to quote the retired statement verbatim in a `//` or `/* */` comment — 7
//      instances, e.g. world-engine-lab.html:6299 `//   _lab.setCarveEpoch(false); const off = _lab.sampleRoutedHeight(channelDirs);`.
//      Every extraction here read RAW text and took the FIRST match, and with lazy quantifiers first
//      means topmost, so a comment ABOVE the live site shadows it. Measured: move the bandCount law
//      out to `state.bandCount = _pack.bandCount;` and quote the old statement on a bare `//` line
//      above it — this file stayed **44/44 GREEN**, compiling and measuring DEAD COMMENT TEXT. Same
//      shape, same result, for the cloud-regime block and for the two E5 driver lines. PLAN §4 Steps
//      4 and 5 both declare they will move lab code out; the hole was pre-armed and waiting.
//
// THE CONTRACT NOW, stated so it can be checked rather than trusted:
//   · THE SCAN SET IS A CORPUS, NOT ONE FILE — world-engine-lab.html, planet-lod-shaders.glsl.js, and
//     every .js under src/worldengine. An extraction therefore FOLLOWS its law when a step moves it
//     out of the lab, instead of forcing the check to be deleted that day. ⚠ The corpus SIZE is
//     deliberately not written down here and is asserted nowhere: it read 43 files and then 44 inside
//     one session on 2026-08-08 while another agent was editing the tree, so a number in this prose
//     would be born rotting. The corpus is defined by the walk; per-carrier liveness is proven by the
//     control "THE CORPUS IS REALLY SCANNED BEYOND THE LAB", which names a hit outside the lab
//     instead of counting files (helpers/source-scan.mjs states the same limit for `jsFilesUnder`).
//   · MATCHING IS COMMENT-BLIND **AND LITERAL-BLIND**; THE COMPILED TEXT IS NEITHER. Every pattern
//     runs against `stripCommentsPreservingOffsets(src, { blankLiteralText: true })` — comments
//     blanked, and the INTERIOR of every quoted string, template literal and regex literal blanked
//     with its delimiters kept. The captured body is then SLICED out of the default pass (literals
//     preserved) at the same offsets, because the extracted text has to still compile. Both passes
//     are byte-length- and newline-identical, so the splice is exact and every line number this
//     file reports is the real one. ⭐ This is the change that closes the shadow class. Nothing
//     else in this list does. ⚠ COMMENT-STRIPPING ALONE WAS NOT ENOUGH AND THE FILE CLAIMED IT WAS
//     — see KNOWN LIMIT 1 for what that cost and how it was measured.
//   · EVERY SITE MATCHES EXACTLY ONCE ACROSS THE CORPUS, and the failure names every location it did
//     find, file:line. Zero ⇒ the law was moved, deleted, commented out, or parked inside a string
//     or template literal — all four are now the same loud answer. Two or more ⇒ the law is
//     duplicated and the harness cannot know which copy is live — which is the state a half-finished
//     move leaves behind, and the state first-match-wins used to paper over.
//   · EVERY EXTRACTION IS NON-EMPTY, the two block sites included. ⚠ Worth having, and NOT the fix
//     for the shadow class — do not read it as one. All three shadow mutants above matched a LONG
//     non-empty string and the non-empty clause passed every one of them. Overstating this line
//     would be this codebase's signature failure with the sign flipped.
//   · THE `radius: … / 11.2` SITE IS A COUNTED LIST, not a single match: the lab's two inline driver
//     lines (band bake + storm bake) plus the one single-source helper they will collapse onto. Its
//     count is asserted at module scope as a named EXTRACTION FAILED, alongside the other
//     extractions — see E5_SITES below for the partition and the measurement behind it.
//   · EVERY COMPILED BODY RUNS UNDER `'use strict'` — see compileExpr for what that buys.
//
// ── ⚠ KNOWN LIMITS OF THIS CONTRACT ──────────────────────────────────────────────────────────────
// Written HERE, in the gate's own source, where the next author meets them — PLAN §11.9: "a limit
// that is not written into the gate itself has been forgotten, not accepted." Each is stated with the
// construct it excuses, and each is a thing an author could do that this file would NOT catch.
//   1. ⛔ THIS LIMIT USED TO STATE ITS CONSEQUENCE BACKWARDS, AND THE REVERSAL IS KEPT ON THE RECORD
//      BECAUSE IT IS WHAT MADE THE HOLE LOOK SAFE. It read: strings and templates are preserved, so
//      "a retired law parked in a template shadows nothing (it would appear as a SECOND match and
//      red loudly)". That is true of ONE case and false of the other, and the sentence never
//      distinguished them:
//        · DUPLICATION — the law is copied into a literal and the live site SURVIVES ⇒ 2 matches ⇒
//          EXTRACTION FAILED. Loud. This is the case the old sentence described.
//        · A MOVE — the law is copied into a literal and the live site is REMOVED, which is item 1
//          of what PLAN §4 Steps 4 and 5 declare they will do ⇒ the parked copy is the ONE match ⇒
//          the harness compiles and measures DEAD TEXT at full green. Silent.
//      Measured on a scratch mirror 2026-08-08, before the fix below existed: cloud-regime block,
//      giant-dynamo/aurora chain, BOTH E5 `radius: … / 11.2` drivers, the craterboot canonical read
//      and the boot `radiusSeed:` pin — each moved out of applyDrivers and parked verbatim, five in
//      a `/* glsl */ ` template and three in an ordinary quoted string. Eight mutants, eight runs of
//      **50 passed (50)**, identical to baseline. Text parked in a literal needs no comment markers
//      at all; it is simply string content. A limit stated with the wrong consequence is worse than
//      an absent one, because it tells the next author the hazard is self-reporting.
//      ⭐ CLOSED, not documented: matching now runs on the literal-BLIND pass and only the SPLICE
//      reads the literal-preserving one, via the `blankLiteralText` option on
//      tests/helpers/source-scan.mjs:230 `export function stripCommentsPreservingOffsets(src, opts = {}) {`.
//      Measured over all 44 corpus files: the pass this file used to match against leaves 985 lines
//      carrying a live `//` (900 of them in planet-lod-shaders.glsl.js, the venue this limit named
//      as plausible, and 21 in the lab's own shader templates); the pass it matches against now
//      leaves ZERO. All eight mutants are red, six of them as a named EXTRACTION FAILED.
//      ⚠ WHAT IS STILL LIMITED, and only this: a law that MOVES INTO a literal is now unmatchable
//      rather than mis-matched, so it reports as ZERO matches, not as "it is over there in a
//      template". That is the fail-CLOSED direction and it is loud; the failure text names the
//      possibility, but it cannot name the venue, so the next author still has to go and look.
//      ⛔ THIS PARAGRAPH USED TO END "There is no remaining direction in which a law parked in a
//      literal produces a green." ROUND 2 OF PLAN §11.4 EXECUTED A COUNTER-EXAMPLE, and the shape of
//      it is the reason the sentence is now written with its limit attached. The scanner tracked a
//      template's `${…}` re-entry with a SINGLE INTEGER brace depth, so a NESTED template inside an
//      interpolation whose TEXT carried an unbalanced `}` decremented the OUTER template's count: the
//      outer template was declared closed at the inner backtick, backtick parity inverted for the
//      rest of the file, and a later real template's contents were scanned as LIVE CODE. Round 2
//      measured all three suites at **171 passed (171)** with the band law moved out of applyDrivers
//      and parked there — round 1's D1, arriving through a different lexing path.
//      ⭐ CLOSED BY CODE, NOT BY QUALIFICATION, because a limit a correct algorithm can remove should
//      not be carried as prose. The integer is gone; `${…}` is lexed by three mutually-recursive span
//      scanners that skip nested templates and strings whole —
//      tests/helpers/source-scan.mjs:171 `function interpolationEnd(src, i) {`. Measured 2026-08-09:
//      over 20,000 valid-JS snippets carrying nested templates the old lexer let a top-level comment
//      survive as template text in 6,147 of them and the new one in ZERO, and over all 44 corpus
//      files the two are BYTE-IDENTICAL on both passes, so nothing in the tree moved.
//      ⚠ WHAT IS LEFT, stated as a limit rather than as an absolute: an unbalanced `}` or backtick
//      inside a COMMENT or a REGEX LITERAL that is itself inside an interpolation still miscounts,
//      one container further in. Corpus reach measured the same day: 149 interpolation spans across
//      the 44 files, of which 0 carry `//` or `/*`, 0 carry any `/` at all, and 0 carry a backtick.
//      Interpolations are also blanked with the text around them —
//      tests/helpers/source-scan.mjs:211 `interpolations are blanked along with the surrounding text`
//      — which is deliberate and in the same direction: live code written inside a `${…}`
//      interpolation is invisible to this scanner too, and loudly.
//   2. THE CORPUS STOPS AT src/worldengine PLUS THE TWO LAB FILES. A law moved to, say,
//      planet-lod-lab-core.js or anywhere under src/ outside worldengine reads as ZERO matches. That
//      is LOUD, not silent — the failure says "moved, deleted or commented out" and names the site —
//      but the fix is to widen CORPUS, and nothing here will suggest that; the next author has to.
//   3. THE PROSE PINS READ RAW SOURCE AND ARE SATISFIABLE BY THE COMMENT ALONE. That is correct for
//      what they pin (see the note at each) and it is exactly the shadow shape everywhere else, so it
//      is named rather than assumed harmless: deleting the craterboot site while keeping its comment
//      is caught by the STRIPPED code pin beside them, not by the prose pins themselves.
//   4. A LAW REWRITTEN IN PLACE INTO A SHAPE THE PATTERN DOES NOT MATCH reads as zero matches, not as
//      a wrong measurement. Loud. Recorded because it is the one failure people expect to be silent.
//   5. ⛔ "OUTSIDE EVERY COMMENT AND LITERAL" IS NOT "LIVE", AND LIMIT 1 ENUMERATES COFFINS RATHER
//      THAN DEFINING LIFE. Two containers are neither comment nor literal and are not executed
//      either, so a law parked in one is the single surviving match and the harness compiles it.
//      Both were EXECUTED 2026-08-09 against a proven scratch mirror, with the live
//      `const _rotH = state.rotationHours ?? _fp.rotationHours ?? 24;` replaced by `let _rotH = 24;`
//      so the law was genuinely dead:
//        · RAW HTML MARKUP — the retired statement parked in a `<pre hidden>` before `<body>`. The
//          corpus's principal file IS an .html file and the stripper emits markup verbatim, as it
//          must. All three suites: **175 passed (175)**. Fully silent.
//        · A NEVER-CALLED FUNCTION — the statement wrapped in `function _legacyRotH(state, _fp)`.
//          **175 passed (175)**. Also silent. Reachability needs a control-flow pass, which is the
//          same refusal the fence's own KNOWN LIMIT #1 records.
//      ⚠ WHY IT IS NAMED AND NOT CLOSED: measured the same day, `grep -nE '<(pre|textarea|template|noscript|xmp)\b' world-engine-lab.html`
//      returns NOTHING, and the lab's entire HTML surface is six lines before one `<script type="module">`.
//      An author would have to invent the container, where quoting a retired law in a comment or a
//      template is a habit the lab documents 7 instances of. Adversarial, not idiomatic — PLAN §11.9's
//      test — so it is written here, where it bites, instead of being carried as a fix that is not one.
//      The cheap real closure, if it is ever wanted: for `.html` corpus members blank everything
//      outside `<script …>…</script>` on the matching pass, offset-preserving, same fail-closed
//      direction as `blankLiteralText`.
//
// EVERY CHECK CARRIES A PLANTED DEFECT. For each site, the FROZEN form is reconstructed from the LIVE
// source by one textual substitution (state.planetRadiusEarth → _fp.radiusEarth, or the condition-vector
// read → _fp) and pushed through the identical harness. The frozen form must FAIL the response criterion
// the live form passes. Break ⇒ FAIL, restore ⇒ PASS, executed on every run — so these instruments are
// proven, not asserted. (feedback_measurement-channels-need-planted-defects; the 14-agent review that
// found 7 measurement defects in this codebase, every one of which returned a plausible number.)
//
// WHY THERE IS NO FITTED EXPONENT HERE. The Rhines law's radius dependence is an exact algebraic
// identity (m = RHINES_K·√(a·Ω/U) with U radius-independent — proven below), so the right instrument is
// an equality to float tolerance, not a regression. Fitting a power law over a handful of driver values
// would give dof = N−2 and a t=12.71 multiplier at dof=1 — a wide interval standing in for an exact
// result. Exactness beats statistics when exactness is available.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DRIVER_PRESETS, drawPresetRadius, LAB_UNLOCKED_RANGES, NAMED_BODY } from '../driver-presets.js';
import { deriveConditionVector } from '../src/worldengine/base/conditionVector.js';
import { compositionClass } from '../src/worldengine/base/e1Regime.js';
import { deriveUniforms, radiusFromT, RADIUS_SLIDER_MIN, RADIUS_SLIDER_MAX } from '../src/worldengine/base/labCore.js';
import { PHYS, E5_REGIME, rhinesWavenumber, amplitudeLaw, resolveParams,
         bakeClimateE5Attributes } from '../src/worldengine/base/climate-e5.js';
import { drawGiantConditions, deriveGiantDrivers } from '../src/worldengine/base/giant-drivers.js';
import { craterRelevanceOf, MESH_FLOOR_RAD, D_SFD_MIN_KM, C_ATMO_KM, P_ATMO_EXP,
         G_REF, K_GS, P_SURF_MAX } from '../src/worldengine/base/bombardment.js';
import { KM_PER_EARTH_RADIUS } from '../src/worldengine/base/baseStep.js';
import { stripCommentsPreservingOffsets, jsFilesUnder, lineOf } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── the corpus ───────────────────────────────────────────────────────────────────────────────────
// planet-lod-shaders.glsl.js was in the list for FORWARD CLOSURE, not because it carries anything
// today. ⚠ MEASURED 2026-08-08, so nobody later reads its presence as evidence of something: it
// contributes ZERO matches to every pattern in this file and defines `applyDrivers` ZERO times (the
// one definition is world-engine-lab.html:1933 `function applyDrivers(){`). It was here because Step 5's
// driver packs are the kind
// of thing that lands next to the shader source, and a corpus that has to be widened in the same
// commit that moves the code is a corpus that will be widened one commit late.
// ⭐ STEP 7 CLOSED IT THE OTHER WAY AND REMOVED THE ENTRY. The file IS the thing that landed next
// to the driver packs: it is now src/worldengine/shaders/planetShaders.glsl.js, which the walker
// already returns. Naming it again would put one file in CORPUS TWICE, and every scan below iterates
// CORPUS — so a future hit in it would be counted twice and a `toHaveLength(1)` would read 2, which
// looks like a scanner bug rather than a duplicated corpus entry. The forward-closure claim is now
// held by the walker, and the coverage assertion below names the new path.
const CORPUS = ['world-engine-lab.html', ...jsFilesUnder(ROOT, 'src/worldengine')];
const RAW = new Map(CORPUS.map((rel) => [rel, readFileSync(join(ROOT, rel), 'utf8')]));
// ⭐ TWO PASSES PER FILE, and the split is the whole of the Step-3-round-2 repair. Both passes come
// out of the same stripper, are byte-LENGTH-identical to the input, and put their newlines at the
// same offsets — so an offset found in one indexes the other character for character, and `lineOf`
// on either yields the line number in the file on disk.
//   · `match` — comments blanked AND the INTERIOR of every quoted string, template literal and regex
//     literal blanked (delimiters kept). EVERY pattern in this file runs against this text. Text
//     parked in a literal is therefore not matchable at all.
//   · `code`  — comments blanked, literals PRESERVED. Every captured body is SLICED out of this at
//     the offsets `match` reported, so what reaches `new Function` still has its real string
//     literals (the cloud-regime block's `'co2'` branch does not survive the other pass).
// MEASURED 2026-08-08 over all 44 corpus files: the default pass leaves 985 lines carrying a live
// `//` — 900 of them in planet-lod-shaders.glsl.js, 21 in the lab's own `/* glsl */ ` templates. The
// `blankLiteralText` pass leaves ZERO. That gap was the hole; see KNOWN LIMIT 1 for what it cost.
const SRC = CORPUS.map((rel) => ({
  rel,
  match: stripCommentsPreservingOffsets(RAW.get(rel), { blankLiteralText: true }),
  code: stripCommentsPreservingOffsets(RAW.get(rel)),
}));
// The lab's RAW text. Used ONLY by the prose pins at the bottom of this file, whose subject IS a
// comment — see the note there. Nothing that gets compiled may read this.
const LAB_RAW = RAW.get('world-engine-lab.html');

const PRESETS = Object.keys(DRIVER_PRESETS);
const TIER = 1.0;

// ── the slider's own travel: uniform in t ⇒ log-spaced in R (planet-lod-lab-core.js radiusFromT) ──
const N_SWEEP = 401;                                   // ~1.0% multiplicative step across the 53× span
const SWEEP = Array.from({ length: N_SWEEP }, (_, i) => radiusFromT(i / (N_SWEEP - 1)));

// ── extraction ───────────────────────────────────────────────────────────────────────────────────
// Every match of `re` anywhere in the COMMENT-BLIND, LITERAL-BLIND corpus, in corpus order, each
// tagged with the file and the true 1-based line it sits on.
//
// ⭐ MATCH ON ONE PASS, SLICE FROM THE OTHER. The regex is forced to carry `d` (hasIndices) so the
// capture group reports OFFSETS, not just text; the offsets are then applied to the same file's
// literal-PRESERVING pass. Without `d` there is no way to splice, and taking `m[1]` directly would
// hand `new Function` a body whose string literals had been blanked to whitespace — which compiles,
// and is a silent pass of exactly the kind this file exists to refuse.
function scanText(re, entries) {
  const withG = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const g = new RegExp(re.source, withG.includes('d') ? withG : `${withG}d`);
  const hits = [];
  for (const { rel, match, code } of entries) {
    g.lastIndex = 0;
    let m;
    while ((m = g.exec(match))) {
      const [from, to] = m.indices[1] ?? m.indices[0];
      hits.push({ rel, line: lineOf(match, m.index), body: code.slice(from, to) });
      if (m[0] === '') g.lastIndex++;                 // a zero-width match would otherwise spin forever
    }
  }
  return hits;
}
const scanCorpus = (re) => scanText(re, SRC);
const where = (hits) => (hits.length ? hits.map((h) => `${h.rel}:${h.line}`).join(', ') : '(nowhere in the corpus)');
// Where each site was found this run, keyed by label. Not asserted — a site is ALLOWED to move, that
// is the point of the corpus — but it is reported in downstream failure messages so "the harness is
// measuring the wrong copy" is answerable without re-deriving it.
const SITE_HOME = new Map();

function extract(re, label, entries = SRC) {
  const hits = scanText(re, entries);
  if (hits.length !== 1) {
    throw new Error(`EXTRACTION FAILED (${label}): expected EXACTLY ONE live match of ${re} across the `
      + `${entries.length}-file corpus; found ${hits.length} at ${where(hits)}.\n`
      + `  ZERO means the law was moved out of the corpus, deleted, commented out, or parked inside a\n`
      + `  string or template — comments AND literal interiors are blanked before matching, so a quoted\n`
      + `  copy is invisible here BY DESIGN. Check the literals too before concluding it is gone.\n`
      + `  TWO OR MORE means the law is duplicated and this harness cannot know which copy is live.\n`
      + `  ⚠ AND ONE MATCH IS NOT PROOF OF LIFE. Surviving both blanking passes means the text is\n`
      + `  outside every comment and literal. It does NOT mean the text runs: measured 2026-08-09,\n`
      + `  parking a retired law in raw HTML markup (a <pre hidden> before <body>, which is neither\n`
      + `  comment nor literal) or inside a never-called function each left all three suites at\n`
      + `  175 passed (175) with the live law deleted. Reachability needs a control-flow pass this\n`
      + `  harness does not have — see KNOWN LIMIT 5.\n`
      + `  This suite measures NOTHING until the pattern is repaired — do not delete the check.`);
  }
  const body = hits[0].body.trim();
  if (body === '') {
    throw new Error(`EXTRACTION FAILED (${label}): matched at ${where(hits)} but captured an EMPTY string. `
      + `An empty body compiles and returns undefined, which is a silent pass.`);
  }
  SITE_HOME.set(label, `${hits[0].rel}:${hits[0].line}`);
  return body;
}
// Compile an expression into a function of a scope bag. The bag names are exactly the lab's local
// identifiers at each site, so the extracted text runs unmodified.
//
// ⭐ WHY `'use strict'` (added 2026-08-08, PLAN §4 Step 3). `new Function` bodies are SLOPPY-mode
// regardless of the strictness of the module that built them. In sloppy mode an extracted block that
// assigns to an identifier declared OUTSIDE the extracted span does not throw — it creates a property
// on globalThis and carries on. The harness then reports numbers from a scope that is not the site's
// scope, while staying green: the desynchronisation is invisible in exactly the way this whole file
// exists to prevent. Strict mode turns that into a loud ReferenceError. The control that proves the
// change is not decorative is the `it` titled "sloppy mode would have swallowed…" below — it is a
// planted defect, run on every CI run, not a claim.
// ⚠ AND WHAT IT DOES **NOT** BUY, so the control is not misread as evidence that a real site depends
// on it: measured 2026-08-08 on a scratch mirror, deleting `'use strict';\n` from BOTH helpers here
// moves exactly ONE outcome — its own control — and nothing else: `1 failed | 51 passed (52)`. No
// currently-extracted body assigns to an identifier declared outside its own span. This clause is
// FORWARD closure, for the blocks Steps 4 and 5 will cut out of the middle of applyDrivers.
function compileExpr(src, label) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('env', `'use strict';\nconst { state, _fp, _gas, _rotH, _gcond, _scond, u } = env; return (${src});`);
  } catch (e) { throw new Error(`COMPILE FAILED (${label}): ${e.message}\n  src: ${src}`); }
}
function compileBlock(src, label) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('env', `'use strict';\nconst { state, _fp, _gas, _rotH, _gcond, _scond, u } = env;\n${src}`);
  } catch (e) { throw new Error(`COMPILE FAILED (${label}): ${e.message}\n  src: ${src}`); }
}

// The lab's own gas gate and spin read, extracted rather than re-typed (so a change to either shows up
// here instead of quietly desynchronising the harness from the site under test).
const SRC_GAS  = extract(/const\s+_gas\s*=\s*(.+?);/, '_gas gate');
const SRC_ROTH = extract(/const\s+_rotH\s*=\s*(.+?);/, '_rotH');
const fGas  = compileExpr(SRC_GAS, '_gas');
const fRotH = compileExpr(SRC_ROTH, '_rotH');

function envFor(presetName, R) {
  const _fp = DRIVER_PRESETS[presetName];
  const derived = deriveUniforms(_fp, TIER);
  const cond = deriveConditionVector(_fp, derived, R);      // the single source: drawn radius + coherent g
  const base = { state: { planetRadiusEarth: R }, _fp, _gcond: cond, _scond: cond, u: derived };
  return { ...base, _gas: fGas(base), _rotH: fRotH(base) };
}
const canonicalR = (p) => DRIVER_PRESETS[p].radiusEarth ?? 1;
// The radius the LAB ITSELF produces — world-engine-lab.html:1955
// `state.planetRadiusEarth = drawPresetRadius(driverUI.preset, state.radiusSeed, { labUnlock: true })`,
// byte-for-byte the same call, including the { labUnlock: true } flag. This is what the lab boots
// with; `canonicalR` is what it boots with only for the 6 NAMED_BODY presets. Everything below that
// says "at the radius the lab draws" uses this. (CITATION REPAIRED 2026-08-08, PLAN §10: this and its
// twin below both cited `:3010`, which is a river-overlay debounce — an off-by-1055 that read as
// freshly verified. Both are now `line + symbol`, so the integer is the convenience and the symbol is
// the ref.)
const drawnR = (p, seed) => drawPresetRadius(p, seed, { labUnlock: true });
// The lab's shipped default draw seed, READ OUT OF THE SOURCE rather than typed here. Typing it was
// this suite's own first defect: with a hard-coded 1, changing `radiusSeed:` in the lab silently
// changed the boot appearance while every check below stayed green — the exact failure mode the whole
// "AT THE RADIUS THE LAB ACTUALLY DRAWS" block exists to close. Proven by planted defect (radiusSeed
// 1 → 2 passed 84/84 with the literal; it fails with this extraction).
// ⚠ PATTERN NARROWED 2026-08-08, and the loss is named rather than absorbed. It used to require the
// trailing `// AC5 seeded-radius draw seed` comment, which made it specific — and which a
// comment-BLIND scan cannot see at all: on stripped source that pattern matches ZERO times. The
// specificity is now carried by corpus-wide uniqueness instead (measured: exactly one match of
// `radiusSeed:\s*(\d+)\s*,` corpus-wide), which is a weaker anchor against a second `radiusSeed:`
// key appearing somewhere and a stronger one against the comment being reworded.
// ⚠ THE FILE COUNT THAT USED TO SIT IN THAT PARENTHESIS ("in all 43 files") IS GONE, 2026-08-08
// round 2. The corpus is 44 files, not 43 — and the header twelve screens up already says a count
// written into this prose "would be born rotting", then this line wrote one anyway. The uniqueness
// is the property; it is enforced by the executed `extract()` below, which needs no integer.
const BOOT_SEED = Number(extract(/radiusSeed:\s*(\d+)\s*,/, 'boot radiusSeed'));

// ── the rewired sites, extracted ONCE from the live source and shared by every describe below ─────
// (Hoisted 2026-07-25, lens round: the drawn-radius suite and the byte-oracle suite must measure the
//  SAME text the response suites do, so there is exactly one extraction per site in this file.)
//
// ── THE E5 `radius:` SITE IS A COUNTED LIST, and the count is 3, not 2 ───────────────────────────
// This was `LAB.split('\n').filter(…)` — Array.prototype.filter, no no-match branch, silently []. See
// the header for what that cost. It is now counted at MODULE SCOPE, as a named EXTRACTION FAILED,
// alongside every other extraction, so a vanished driver line names the E5 site instead of surfacing
// two describes later as a TypeError about `.replace`.
//
// MEASURED 2026-08-08, and it is why the number here is 3 where PLAN §4 Step 3 says 2: widening the
// scan to src/worldengine turns up a THIRD Jupiter-normalised radius driver —
// src/worldengine/base/giant-drivers.js:277 `radius: (planetRadiusEarth ?? 1) / 11.2,`, the body of
// `giantDriverScalars`, the already-single-sourced helper whose docstring says it exists so
// "rebakeE5Bands and applyStormState (the two lab call sites) can never diverge again". The lab does
// not call it yet; the two inline copies below are what it will replace.
// THE PARTITION, and why it is by TEXT and not by path: the helper is excluded by its own distinctive
// expression, not by which file it lives in, so (a) relocating the helper does not silently widen the
// exclusion, and (b) a NEW `/ 11.2` driver appearing ANYWHERE IN THE CORPUS lands in the executed
// set and is measured rather than waved through. Both halves of the partition are asserted, so the
// exclusion cannot quietly grow to cover a site it was never meant to.
// ⚠ "ANYWHERE IN THE CORPUS" IS NARROWER THAN THE "anywhere" THIS SENTENCE USED TO SAY, and the
// difference is the direction that is silent. A driver LEAVING the corpus is loud (zero matches —
// KNOWN LIMIT 2). A driver ARRIVING outside it is NOT. Measured 2026-08-08 on a scratch mirror, one
// variable changed between the two arms: a new `radius: (rEarth ?? 1) / 11.2` written into
// src/generation left this file at **52 passed (52)**; the SAME file written into
// src/worldengine/base failed with "expected EXACTLY TWO … found 3", naming it. The corpus boundary
// is the guarantee's real edge, and widening CORPUS is the fix if a driver ever lands past it.
// ⚠ NAMED LIMIT: the helper is excluded because it CANNOT go through this harness's planted-defect
// machinery — the frozen counterfactual is built by rewriting `_gcond.radiusEarth` → `_fp.radiusEarth`
// (`frozenFns` below — a self-reference by SYMBOL, not by line, because this file is edited on every
// step and an integer written into it is born rotting), and the helper takes its radius as a
// PARAMETER, so there is no preset field to
// freeze onto and the "frozen" copy would be textually identical to the live one. Executing it would
// turn the planted-defect control at "the frozen form is flat across the whole slider" RED for a
// reason that is about the harness, not the lab. The day the lab collapses onto the helper, this site
// goes to zero and reds — correctly: the law will then live in one place and this block must be
// re-pointed at it rather than deleted.
const E5_RADIUS_RE = /^[ \t]*radius:\s*(.*?\/\s*11\.2)\s*,/m;
const E5_HELPER_EXPR = '(planetRadiusEarth ?? 1) / 11.2';
const E5_ALL = scanCorpus(E5_RADIUS_RE);
const E5_HELPER = E5_ALL.filter((h) => h.body.includes(E5_HELPER_EXPR));
const E5_SITES  = E5_ALL.filter((h) => !h.body.includes(E5_HELPER_EXPR));
if (E5_HELPER.length !== 1) {
  throw new Error(`EXTRACTION FAILED (E5 single-source helper): expected EXACTLY ONE corpus match whose `
    + `expression is \`${E5_HELPER_EXPR}\` (giantDriverScalars); found ${E5_HELPER.length} at ${where(E5_HELPER)}. `
    + `All ${E5_ALL.length} Jupiter-normalised radius drivers in the corpus: ${where(E5_ALL)}. `
    + `Until this resolves, the executed-set partition below is unverified — do not delete the check.`);
}
if (E5_SITES.length !== 2) {
  throw new Error(`EXTRACTION FAILED (E5 radius driver lines): expected EXACTLY TWO live `
    + `\`radius: … / 11.2\` drivers (rebakeE5Bands band bake + applyStormState storm bake) across the `
    + `${CORPUS.length}-file corpus; found ${E5_SITES.length} at ${where(E5_SITES)}.\n`
    + `  Corpus total including the excluded single-source helper: ${E5_ALL.length} at ${where(E5_ALL)}.\n`
    + `  Comments AND literal interiors are blanked before matching, so a driver quoted in a comment,\n`
    + `  a string or a shader template is invisible here BY DESIGN — zero means the drivers were moved,\n`
    + `  deleted, commented out or parked in a literal, not that they are fine.`);
}
for (const h of E5_SITES) {
  if (h.body.trim() === '') {
    throw new Error(`EXTRACTION FAILED (E5 radius driver lines): empty expression at ${h.rel}:${h.line}.`);
  }
}
const SRC_E5_RADIUS_LINES = E5_SITES.map((h) => `${h.rel}:${h.line}`);
const SRC_E5_RADIUS = E5_SITES.map((h) => h.body.trim());
const SRC_BANDCOUNT = extract(/state\.bandCount\s*=\s*(.+?);\s*$/m, 'state.bandCount');
// `[\s\S]+?`, not `[\s\S]*?` (tightened 2026-08-08). With the star, a source reading
// `let _cloudRegime = 0;;` matches with an EMPTY-after-trim tail and yields a 22-character, perfectly
// NON-EMPTY extraction that compiles and returns the constant 0 — a live-looking gate that has lost
// every threshold in it. The `+` forbids the empty tail; the assertion below forbids the tail that is
// present but carries no decision.
const SRC_CLOUDBLOCK = extract(/(let _cloudRegime = 0;[\s\S]+?;)\s*\n\s*state\.cloudRegime = _cloudRegime;/, 'cloud-regime block');
// The gate is the ASSIGNMENTS, not the declaration. Measured: the live block carries 4 `_cloudRegime =`
// in total — the initialiser plus 3 branches (regimes 3, 2 and 4). Requiring ≥1 beyond the initialiser
// is what makes "the block is non-empty" mean "the block still decides something".
{
  const assignments = (SRC_CLOUDBLOCK.match(/_cloudRegime\s*=/g) || []).length;
  if (assignments < 2) {
    throw new Error(`EXTRACTION FAILED (cloud-regime block): extracted ${SRC_CLOUDBLOCK.length} characters `
      + `from ${SITE_HOME.get('cloud-regime block')} but found ${assignments} \`_cloudRegime =\` — the `
      + `initialiser and NO branch. A block with no branch left compiles, returns 0, and is a silent pass.\n`
      + `  src: ${SRC_CLOUDBLOCK}`);
  }
}
const SRC_GIANTDYNAMO = extract(/const\s+_giantDynamo\s*=\s*(.+?);/, '_giantDynamo');
// The whole aurora consequence chain, not just the gate: the gate feeds `_mag`, `_mag` feeds
// state.auroraIntensity through a STRICT `>` guard, and the ring geometry rides `_mag` too. Extracted
// as one block so the on→off behaviour below is the lab's, not a re-implementation of it.
const SRC_AURORA = extract(/(const\s+_giantDynamo\s*=[\s\S]*?state\.auroraRingWidth\s*=\s*[^;]+;)/, 'aurora block');

const fBandCount   = compileExpr(SRC_BANDCOUNT, 'bandCount LIVE');
const fCloudRegime = compileBlock(`${SRC_CLOUDBLOCK}\nreturn _cloudRegime;`, 'cloudRegime LIVE');
const fGiantDynamo = compileExpr(SRC_GIANTDYNAMO, 'giantDynamo LIVE');
const fAurora      = compileBlock(`${SRC_AURORA}\nreturn { giantDynamo: _giantDynamo, mag: _mag, `
  + `auroraIntensity: state.auroraIntensity, ringLat: state.auroraRingLat, ringWidth: state.auroraRingWidth };`,
  'aurora block LIVE');

// ── the flip detector (shared instrument) ────────────────────────────────────────────────────────
// f: (R) => value. Localises each change of value by 64-step GEOMETRIC bisection on f itself, so a
// reported crossing radius is a real bracket (width ≤ span·2^-64 in log space), never an interpolation.
function sweepFlips(f, samples = SWEEP) {
  const values = samples.map(f);
  const flips = [];
  for (let i = 1; i < values.length; i++) {
    if (!Object.is(values[i], values[i - 1])) {
      let lo = samples[i - 1], hi = samples[i];
      const vLo = values[i - 1];
      for (let k = 0; k < 64; k++) {
        const mid = Math.sqrt(lo * hi);
        if (Object.is(f(mid), vLo)) lo = mid; else hi = mid;
      }
      flips.push({ r: hi, from: values[i - 1], to: values[i] });
    }
  }
  return { values, flips, distinct: new Set(values).size };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// AC-BYTE at canonical radius — REWRITTEN 2026-07-25 (lens round). THE OLD VERSION WAS TAUTOLOGICAL.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// What this file used to do at four sites: build the "frozen" oracle by substituting one symbol for
// another IN THE LIVE SOURCE (`state.planetRadiusEarth` → the frozen preset field), then evaluate both
// at a radius where those two symbols hold the SAME number. Substituting a symbol for an equal-valued
// symbol is an algebraic identity for ANY expression, so `live(env) === frozen(env)` could not fail —
// including on a build where the radius feed was completely dead. Measured, replicating that exact
// construction on deliberately broken sources (scratch harness, this workstream):
//     PASS  the real source                        PASS  BROKEN: band ladder doubled
//     PASS  BROKEN: rotation divisor tripled       PASS  BROKEN: +99 (clamps to 16 everywhere)
//     PASS  BROKEN: radius multiplied by ZERO — feed fully dead, hard-coded 5
// The last case is the exact defect class this workstream exists to prevent. Four tests, zero
// information, presented as AC-BYTE evidence.
//
// THE REPLACEMENT: an oracle that cannot inherit the defects of the thing it checks. The values below
// were captured by executing the PRE-REWIRE expressions out of `git show HEAD:world-engine-lab.html`
// (commit 710f8a2, the parent of this working tree) at each preset's canonical radius, and are pinned
// here as LITERALS. A substitution-derived oracle inherits every defect of the live source; a literal
// captured from the prior build does not. Verified falsifiable: each of the five broken variants above
// breaks at least one row of this table.
const PRE_REWIRE_AT_CANONICAL = {
  //                                 bandCount, cloudRegime, giantDynamo, E5 radius driver (R_c/11.2)
  'Rocky (Earthlike)':             [3, 0, false, 0.08928571428571429],
  'Lava (hot airless)':            [3, 0, false, 0.08035714285714286],
  'Ocean (temperate)':             [3, 0, false, 0.09821428571428573],
  'Titan (methane seas)':          [3, 0, false, 0.03571428571428572],
  'Frozen (airless)':              [3, 0, false, 0.044642857142857144],
  'Europa (icy moon)':             [3, 0, false, 0.044642857142857144],
  'Gas giant (Jovian)':            [14, 0, true, 1],
  'Gas giant (Saturnian)':         [11, 0, true, 0.8392857142857144],
  'Ice giant (Neptunian)':         [3, 0, true, 0.34821428571428575],
  'Venus (sulfuric shroud)':       [3, 3, false, 0.08482142857142858],
  'Sub-Neptune (hazy)':            [3, 2, false, 0.2410714285714286],
  'Eyeball (locked temperate)':    [3, 4, false, 0.08928571428571429],
  'Hot Jupiter (locked giant)':    [3, 0, true, 1.1607142857142858],
  'Mars (arid rocky)':             [3, 0, false, 0.04732142857142858],
  'Moon/Mercury (impact-airless)': [3, 0, false, 0.03392857142857143],
  'Magma (K2-141b)':               [3, 0, false, 0.13392857142857142],
  'Carbon (high C/O)':             [3, 0, false, 0.09821428571428573],
  'Crystal (faceted)':             [3, 0, false, 0.07142857142857144],
};

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// THE EXTRACTION HARNESS ITSELF — controls, before any of it is used as evidence (PLAN §11.3.3)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// ADDED 2026-08-08 with Step 3. Every clause of the contract in this file's header is a claim about
// what this harness would CATCH, and each of the three mutants that motivated Step 3 had already been
// green through the old harness. So each clause gets a planted defect here, executed on every run,
// against the SAME functions the real extractions go through — not a re-implementation of them.
describe('extraction harness — controls (each clause of the contract, shown failing)', () => {
  // A one-file corpus built the same two-pass way the real one is, so these controls exercise the
  // shipped scan path rather than a simplified stand-in of it.
  const synth = (rel, text) => [{
    rel,
    match: stripCommentsPreservingOffsets(text, { blankLiteralText: true }),
    code: stripCommentsPreservingOffsets(text),
  }];
  // The PRE-FIX corpus: comments blanked, literals preserved, matched and sliced from the same text.
  // This is what this file did until 2026-08-08 round 2, and it is kept here only as the arm that
  // MOVED in the two controls below — never as a scan path anything real goes through.
  const commentsOnly = (rel, text) => {
    const t = stripCommentsPreservingOffsets(text);
    return [{ rel, match: t, code: t }];
  };

  it('COMMENT-BLINDNESS: the shadow that was 44/44 green is caught, and the live site is what compiles', () => {
    // The exact mutant, in miniature: the retired law quoted on a bare `//` line ABOVE a live pack
    // read. Lazy quantifiers mean first-match-wins is topmost-wins, so RAW text hands back the DEAD
    // COMMENT and the harness measures a law the lab no longer runs.
    const SHADOWED = [
      '      // moved to the driver pack (Step 4); the retired law was:',
      '      // state.bandCount = Math.min(16, Math.max(3, Math.round(12 * (state.planetRadiusEarth ?? 1) / _rotH)));',
      '      state.bandCount = _pack.bandCount;',
    ].join('\n');
    const RE = /state\.bandCount\s*=\s*(.+?);\s*$/m;
    // CONTROL THAT MOVED: raw text still resolves to the comment. This is the defect, reproduced.
    expect(SHADOWED.match(RE)[1]).toContain('Math.round(12 *');
    // …and the harness's own scan path, which strips first, resolves to the LIVE statement instead.
    expect(extract(RE, 'shadow control', synth('shadow.html', SHADOWED))).toBe('_pack.bandCount');
  });

  it('LITERAL-BLINDNESS: a law MOVED OUT and parked in a template is caught, not measured', () => {
    // ⭐ THE ROUND-2 BLOCKER, IN MINIATURE. Stripping comments closes the shadow only for comments
    // OUTSIDE a literal. Text parked inside a template needs no comment markers at all — it is
    // simply string content — so it survived the pre-fix pass intact and, once the live site MOVED,
    // it was the ONLY match. Measured on a scratch mirror before this control existed: the whole
    // cloud-regime block cut out of applyDrivers and pasted verbatim into the ring fragment
    // shader's `/* glsl */ ` template left this suite at **50 passed (50)**, compiling and
    // measuring the dead copy. Same result for the giant-dynamo/aurora chain, for BOTH E5
    // `radius: … / 11.2` drivers (Step 5's declared move), for the craterboot pin and for the boot
    // `radiusSeed:` pin — eight mutants, eight silent greens.
    const MOVED_AND_PARKED = [
      'const RING_FRAG = /* glsl */ `',
      '  void main() {',
      '    state.bandCount = Math.min(16, Math.max(3, Math.round(12 * (state.planetRadiusEarth ?? 1) / _rotH)));',
      '  }',
      '`;',
      'state.cloudRegime = _pack.cloudRegime;',       // the bandCount law is GONE from live code
    ].join('\n');
    const RE = /state\.bandCount\s*=\s*(.+?);\s*$/m;
    // CONTROL THAT MOVED — the only variable is which pass the regex runs against. Comment-stripping
    // alone leaves the template verbatim, so the parked copy resolves and extraction "succeeds".
    expect(extract(RE, 'pre-fix control', commentsOnly('p.html', MOVED_AND_PARKED)))
      .toContain('Math.round(12 *');
    // …and the shipped two-pass path cannot see into the literal at all, so it reports the truth:
    // the law left, and this suite measures nothing until someone re-points it.
    let msg = '';
    try { extract(RE, 'template-park control', synth('p.html', MOVED_AND_PARKED)); } catch (e) { msg = e.message; }
    expect(msg).toContain('EXTRACTION FAILED (template-park control)');
    expect(msg).toContain('(nowhere in the corpus)');
    // The same shape in an ORDINARY QUOTED STRING, because a template is not the only venue — the
    // craterboot and `_gas` pins were reproduced green this way on the mirror, no backticks needed.
    const IN_A_STRING = 'const NOTE = "const _gas = (_fp.atmosphere?.composition === \'h2-he\');";\n'
      + 'const { isGas: _gas } = _pack;\n';
    const GAS_RE = /const\s+_gas\s*=\s*(.+?);/;
    expect(extract(GAS_RE, 'pre-fix string control', commentsOnly('p.html', IN_A_STRING)))
      .toContain("composition === 'h2-he'");
    let smsg = '';
    try { extract(GAS_RE, 'string-park control', synth('p.html', IN_A_STRING)); } catch (e) { smsg = e.message; }
    expect(smsg).toContain('EXTRACTION FAILED (string-park control)');
  });

  it('THE SPLICE RETURNS REAL LITERALS: matching is literal-blind, the compiled body is not', () => {
    // The other half of the two-pass contract, and the reason it is a SPLICE rather than a swap.
    // The cloud-regime block's first branch is `_fp.atmosphere?.composition === 'co2'`. Take the
    // captured text from the matching pass and that literal arrives as three spaces between quotes:
    // it compiles, it runs, and every CO2 preset silently stops reaching regime 3. So the offsets
    // come from the blanked pass and the TEXT comes from the preserving one.
    expect(SRC_CLOUDBLOCK).toContain("'co2'");
    // CONTROL THAT MOVED: the same span, taken from the pass the regex actually ran against.
    expect(stripCommentsPreservingOffsets(SRC_CLOUDBLOCK, { blankLiteralText: true })).not.toContain("'co2'");
    // …and the spliced body is what the AC-BYTE oracle above measures: Venus is regime 3 only if the
    // literal survived the splice. This is the executed end of the same fact.
    expect(fCloudRegime(envFor('Venus (sulfuric shroud)', canonicalR('Venus (sulfuric shroud)')))).toBe(3);
    // Both passes must stay offset-compatible or the splice silently slides. Asserted on the real
    // lab, not on a synthetic string, because that is the text the splice is applied to.
    const a = stripCommentsPreservingOffsets(LAB_RAW);
    const b = stripCommentsPreservingOffsets(LAB_RAW, { blankLiteralText: true });
    expect(b.length).toBe(a.length);
    expect(b.length).toBe(LAB_RAW.length);
    const nl = (s) => { const out = []; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) out.push(i); return out; };
    expect(nl(b)).toEqual(nl(a));
  });

  it('EXACTLY ONCE: a duplicated law throws, and the failure names BOTH locations', () => {
    // The state a half-finished move leaves behind — a copy in the lab and a copy in the module it is
    // moving to. First-match-wins picked one silently; there is no basis on which it could pick right.
    const DUPED = [...synth('a.html', 'state.bandCount = 1;'), ...synth('b.js', '\nstate.bandCount = 2;')];
    let msg = '';
    try { extract(/state\.bandCount\s*=\s*(.+?);\s*$/m, 'dupe control', DUPED); } catch (e) { msg = e.message; }
    expect(msg).toContain('EXTRACTION FAILED (dupe control)');
    expect(msg).toContain('found 2');
    expect(msg).toContain('a.html:1');
    expect(msg).toContain('b.js:2');
  });

  it('ZERO MATCHES: a law that left the corpus throws, naming the site rather than a stray TypeError', () => {
    let msg = '';
    try { extract(/state\.bandCount\s*=\s*(.+?);\s*$/m, 'gone control', synth('a.html', 'nothing here')); }
    catch (e) { msg = e.message; }
    expect(msg).toContain('EXTRACTION FAILED (gone control)');
    expect(msg).toContain('(nowhere in the corpus)');
  });

  it('NON-EMPTY: an empty capture throws — ⚠ and this is NOT what closes the shadow class', () => {
    // The clause is real: `[\s\S]*?` against `let _x = 0;;` captures nothing, compiles, and returns
    // undefined, which is a silent pass. It is worth having.
    let msg = '';
    try { extract(/marker:(\s*);/, 'empty control', synth('a.html', 'marker: ;')); } catch (e) { msg = e.message; }
    expect(msg).toContain('captured an EMPTY string');
    // ⛔ AND THE HONEST HALF, measured rather than assumed: every one of the three shadow mutants
    // matched a LONG non-empty string, so the non-empty clause passed all three. Here is that fact as
    // a check rather than a sentence — the shadowed comment above is 101 characters and sails through.
    const shadowBody = '// state.bandCount = Math.min(16, Math.max(3, Math.round(12 * (state.planetRadiusEarth ?? 1) / _rotH)));'
      .replace('// ', '').replace(/;$/, '');
    expect(shadowBody.length).toBeGreaterThan(80);
    expect(shadowBody.trim()).not.toBe('');          // the non-empty clause: satisfied by the defect
  });

  it("'use strict': a block assigning outside its own span throws instead of writing globalThis", () => {
    // WHY THIS MATTERS HERE. Extracted blocks are cut out of the MIDDLE of applyDrivers, so an
    // identifier declared above the cut is in scope at the site and NOT in scope in the harness. In
    // sloppy mode — which is what `new Function` gives you regardless of this module's strictness —
    // that assignment silently creates a globalThis property. The harness then answers from a scope
    // that is not the site's, and every number it reports is true about something else.
    const BODY = '_notDeclaredAnywhere = 42; return _notDeclaredAnywhere;';
    // CONTROL THAT MOVED: sloppy mode swallows it whole and returns a plausible number.
    // eslint-disable-next-line no-new-func
    const sloppy = new Function('env', BODY);
    expect(sloppy({})).toBe(42);
    expect(globalThis._notDeclaredAnywhere).toBe(42);        // …by leaking onto the global object
    delete globalThis._notDeclaredAnywhere;
    // …and the harness's own compileBlock, which is strict, refuses.
    expect(() => compileBlock(BODY, 'strict control')({})).toThrow(ReferenceError);
    expect(globalThis._notDeclaredAnywhere).toBeUndefined();
  });

  it('THE CORPUS IS REALLY SCANNED BEYOND THE LAB — proven by a live non-lab hit, not by a file count', () => {
    // A file-count threshold would prove only that the walker ran (helpers/source-scan.mjs names that
    // limit for `jsFilesUnder` explicitly). The per-carrier fact is better: the E5 partition's
    // excluded member is found in src/worldengine, which the pre-Step-3 scan set could not see at all.
    expect(CORPUS).toContain('world-engine-lab.html');
    expect(CORPUS).toContain('src/worldengine/shaders/planetShaders.glsl.js');
    expect(E5_HELPER[0].rel.startsWith('src/worldengine/')).toBe(true);
    // Every site's home is recorded; none of them is asserted, because a site is ALLOWED to move —
    // that is the whole reason the scan set is a corpus. What is asserted is that each was found once.
    expect(SITE_HOME.size).toBeGreaterThanOrEqual(7);
  });
});

describe('AC-BYTE — at canonical radius the rewired sites return the PRE-REWIRE values (literal oracle)', () => {
  it('the oracle table covers every preset (no silent shrinkage)', () => {
    expect(Object.keys(PRE_REWIRE_AT_CANONICAL).sort()).toEqual([...PRESETS].sort());
  });

  it('all four rewired sites match the captured pre-rewire values, exactly', () => {
    // CRITERION: exact equality (`toBe`) on every cell. AC-BYTE demands bit-inertness at canonical
    // radius, so no tolerance is admissible — and unlike the substitution version this CAN fail: a
    // changed ladder, a moved threshold or a dead feed all move at least one cell.
    for (const p of PRESETS) {
      const [band, regime, dynamo, e5r] = PRE_REWIRE_AT_CANONICAL[p];
      const env = envFor(p, canonicalR(p));
      expect(fBandCount(env), `${p} bandCount`).toBe(band);
      expect(fCloudRegime(env), `${p} cloudRegime`).toBe(regime);
      expect(fGiantDynamo(env), `${p} giantDynamo`).toBe(dynamo);
      for (const e of SRC_E5_RADIUS) expect(compileExpr(e, 'E5 radius')(env), `${p} E5 radius`).toBe(e5r);
    }
  });

  it('PLANTED DEFECT: this oracle FAILS on a broken build (the old one did not)', () => {
    // The control the substitution version could never have. Break the ladder five different ways —
    // including "the radius feed is fully dead" — and the literal table must reject each one.
    const BROKEN = [
      ['rotation divisor tripled', SRC_BANDCOUNT.replace('/ _rotH', '/ (3*_rotH)')],
      ['band ladder doubled', SRC_BANDCOUNT.replace('12 *', '24 *')],
      ['radius zeroed (feed dead, hard-coded 5)',
       'Math.min(16, Math.max(3, Math.round(5 + 0*(state.planetRadiusEarth ?? 1))))'],
      ['+99 (clamps to 16 everywhere)', SRC_BANDCOUNT.replace('Math.round(', 'Math.round(99 + ')],
    ];
    for (const [label, src] of BROKEN) {
      const broken = compileExpr(src, label);
      const mismatch = PRESETS.some((p) => broken(envFor(p, canonicalR(p))) !== PRE_REWIRE_AT_CANONICAL[p][0]);
      expect(mismatch, `oracle did NOT reject the broken build: ${label}`).toBe(true);
    }
    // …and the real source passes (restore ⇒ PASS).
    expect(PRESETS.every((p) => fBandCount(envFor(p, canonicalR(p))) === PRE_REWIRE_AT_CANONICAL[p][0])).toBe(true);
  });

  it('SCOPE OF THIS PIN, stated so it is not over-read', () => {
    // Canonical radius is NOT what the lab boots with for most presets — see "AT THE RADIUS THE LAB
    // ACTUALLY DRAWS" below, which is the suite that covers the operative case. This block proves only
    // that the SUBSTITUTION itself introduced no arithmetic change where the two radii coincide.
    const canonicalAtBoot = PRESETS.filter((p) => Object.is(canonicalR(p), drawnR(p, BOOT_SEED)));
    expect(canonicalAtBoot.length).toBe(6);                        // the NAMED_BODY locks, minus Moon/Mercury
    expect(canonicalAtBoot.every((p) => NAMED_BODY.has(p))).toBe(true);
  });
});

describe('flip detector — controls (the instrument itself, before it is used as evidence)', () => {
  // NEG: a constant must produce no flip (guards against a detector that fires on float noise).
  it('NEG — a constant function reports no flip', () => {
    expect(sweepFlips(() => 7).flips).toEqual([]);
    expect(sweepFlips(() => false).flips).toEqual([]);
  });
  // POS: a known step must be found AND localised to the step radius. CRITERION 1e-9 relative — the
  // bisection converges to ~2^-64 of the bracket, so 1e-9 is ~9 orders of magnitude of headroom and any
  // failure means a real mis-localisation, not tolerance shopping.
  it('POS — a known step at R=4 is found and localised to 1e-9 relative', () => {
    const s = sweepFlips((R) => R >= 4);
    expect(s.flips.length).toBe(1);
    expect(Math.abs(s.flips[0].r - 4) / 4).toBeLessThan(1e-9);
  });
  it('POS — a known step at R=6 (the cloud-regime constant) is found and localised', () => {
    const s = sweepFlips((R) => (R < 6 ? 2 : 0));
    expect(s.flips.length).toBe(1);
    expect(Math.abs(s.flips[0].r - 6) / 6).toBeLessThan(1e-9);
  });
  it('the sweep really spans the slider (not a degenerate grid)', () => {
    expect(SWEEP[0]).toBeCloseTo(RADIUS_SLIDER_MIN, 12);
    expect(SWEEP[SWEEP.length - 1]).toBeCloseTo(RADIUS_SLIDER_MAX, 12);
    expect(SWEEP.length).toBeGreaterThanOrEqual(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// SITE 1+2 — the E5 Rhines band driver and the storm/vortex driver (rebakeE5Bands / applyStormState)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('E5 giant drivers — the `radius` driver now carries the DRAWN radius', () => {
  const driverLines = SRC_E5_RADIUS_LINES;
  it('finds exactly the two Jupiter-normalised radius drivers (band bake + storm bake)', () => {
    // Both must exist and both must be rewired; if a third appears, it needs its own pin.
    // ⚠ THIS IS NO LONGER THE GATE, and saying so is the point. The count is now enforced at MODULE
    // SCOPE (see E5_SITES) as a named EXTRACTION FAILED, because a count checked only here runs AFTER
    // module-scope code that indexes SRC_E5_RADIUS[0] — which is how a missing driver used to surface
    // as "Cannot read properties of undefined (reading 'replace')" and kill collection before any
    // assertion ran. What survives here is the human-readable statement of the same fact, and the
    // report of WHERE the two sites currently live, so a failure elsewhere is diagnosable.
    expect(driverLines.length, `E5 radius drivers found at: ${driverLines.join(', ')}`).toBe(2);
    // …and the excluded single-source helper is exactly one site, in the corpus, not assumed absent.
    expect(E5_HELPER.map((h) => `${h.rel}:${h.line}`)).toHaveLength(1);
    expect(E5_ALL).toHaveLength(3);
  });
  const exprs = SRC_E5_RADIUS;
  const fns = exprs.map((e, i) => compileExpr(e, `E5 radius driver #${i}`));
  // PLANTED DEFECT: the pre-rewire form, reconstructed from the live source by one substitution.
  const frozenFns = exprs.map((e, i) =>
    compileExpr(e.replace(/_[gs]cond\.radiusEarth/, '_fp.radiusEarth'), `E5 radius driver #${i} (FROZEN)`));

  it('LIVE: the driver equals drawnRadius / 11.2 exactly, at every radius', () => {
    // CRITERION: exact float equality (toBe), not a tolerance. The expression is a single division of
    // the drawn radius by a literal, so any deviation means it is reading a different number entirely.
    for (const f of fns) for (const R of [0.3, 1, 2.7, 3.9, 11.2, 16]) {
      expect(f(envFor('Gas giant (Jovian)', R))).toBe(R / 11.2);
    }
  });
  // (The old "BYTE-INERT AT CANONICAL" test lived here. DELETED 2026-07-25, lens round: it compared
  //  the live expression against a copy of itself with one symbol swapped for an equal-valued symbol,
  //  which is an identity for any expression and passed even on a fully dead feed. The real canonical
  //  pin is now the literal PRE_REWIRE_AT_CANONICAL oracle above, which is falsifiable.)
  it('PLANTED DEFECT: the frozen form is flat across the whole slider (⇒ the LIVE check would catch it)', () => {
    for (const f of frozenFns) {
      const s = sweepFlips((R) => f(envFor('Gas giant (Jovian)', R)));
      expect(s.distinct).toBe(1);                       // no response at all — the defect
    }
    for (const f of fns) {
      const s = sweepFlips((R) => f(envFor('Gas giant (Jovian)', R)));
      expect(s.distinct).toBe(N_SWEEP);                 // strictly one value per radius — restored
    }
  });
});

describe('E5 downstream — the drawn radius is the ONLY radius channel into the band count', () => {
  it('the per-seed giant driver triple is EXACTLY radius-independent (so uPeak is too)', () => {
    // This is what makes N ∝ √R an identity rather than an approximation. drawGiantConditions
    // back-solves gravity so M = surfaceGravity·R² = M0·massFactor — src/worldengine/base/giant-drivers.js:231
    // `(radius cancels)` — and deriveGiantDrivers reads only M, age, T_eq and the Z proxy.
    // (CITATION REPAIRED 2026-08-08, PLAN §10. It said `:235`, which is a BLANK LINE — four past the
    // claim. An off-by-four onto a blank line survives every check the citation fence runs today,
    // because a ref with no backticked symbol is counted as UNCHECKED rather than resolved; it is now
    // `line + symbol`, so the integer is the convenience and the symbol is the ref.)
    // CRITERION: bit-exact equality of all three drivers across the slider. If this ever fails, the
    // Rhines exponent below stops being exact and the check must become a fit with honest dof.
    const P = 'Gas giant (Jovian)';
    for (const regime of Object.values(E5_REGIME)) {
      const ref = deriveGiantDrivers(drawGiantConditions(regime, envFor(P, 1)._gcond, 1234));
      for (const R of [0.3, 1, 4, 11.2, 16]) {
        const got = deriveGiantDrivers(drawGiantConditions(regime, envFor(P, R)._gcond, 1234));
        expect(got.internalHeat).toBe(ref.internalHeat);
        expect(got.shellDepthFrac).toBe(ref.shellDepthFrac);
        expect(got.dissipation).toBe(ref.dissipation);
      }
    }
  });

  it('LAW 1 pin: rhinesWavenumber is exactly max(M_MIN, round(RHINES_K·√(a·Ω/U)))', () => {
    for (const a of [0.05, 0.25, 1, 1.43]) for (const om of [0.6, 0.93, 1]) for (const U of [1.2, 2.5]) {
      const analytic = PHYS.RHINES_K * Math.sqrt((a * om) / U);
      expect(rhinesWavenumber(om, a, U)).toBe(Math.max(PHYS.M_MIN, Math.round(analytic)));
    }
  });

  it('LAW 1 exponent: the analytic wavenumber is ∝ √radius to float precision (no fit needed)', () => {
    // CRITERION: n(4a)/n(a) === 2 to 1e-12 relative. Reason: U is radius-independent (pinned above),
    // so the ratio is √4 = 2 algebraically; 1e-12 is ~4 orders above float64 round-off on these
    // magnitudes, so a failure means the law changed, not that the tolerance was too tight.
    const U = amplitudeLaw(1.67, 1.0, 0.8), om = 1.0;
    const n = (a) => PHYS.RHINES_K * Math.sqrt((a * om) / U);
    for (const a of [0.02, 0.1, 0.5, 1.0]) {
      expect(Math.abs(n(4 * a) / n(a) - 2)).toBeLessThan(1e-12);
      expect(Math.abs(n(9 * a) / n(a) - 3)).toBeLessThan(1e-12);
    }
  });

  // ── the end-to-end harness: drawn radius → the EXTRACTED lab driver expression → resolveParams →
  //    jetProfile zero crossings (climate-e5 sampleDiagnostics) → bandCount / jetCount. Positions do
  //    not enter the diagnostics (they are sampled analytically in latitude), so a 1-vertex buffer is
  //    sufficient and keeps the sweep cheap. macroSeed is FIXED — climate-e5 has a determinism
  //    hard-rule (no Math.random / Date.now), so every number below is reproducible.
  const P_JOV = 'Gas giant (Jovian)';
  const SEED = 7;
  const radiusExpr = SRC_E5_RADIUS[0];
  const fRadiusLive = compileExpr(radiusExpr, 'E5 band-bake radius driver');
  const fRadiusFrozen = compileExpr(radiusExpr.replace(/_[gs]cond\.radiusEarth/, '_fp.radiusEarth'), 'FROZEN');
  const POS1 = new Float32Array([0, 0, 1]);
  const writerAt = (fRadius) => (R) => {
    const env = envFor(P_JOV, R);
    const gd = deriveGiantDrivers(drawGiantConditions(E5_REGIME.GAS_GIANT, env._gcond, SEED));
    const drivers = { ...gd, rotationRate: 9.9 / (DRIVER_PRESETS[P_JOV].rotationHours ?? 24), radius: fRadius(env) };
    const bake = bakeClimateE5Attributes(POS1, 1, 1, { regime: E5_REGIME.GAS_GIANT, drivers, macroSeed: SEED });
    return { m: resolveParams(E5_REGIME.GAS_GIANT, drivers, SEED).m, band: bake.bandCount, jet: bake.jetCount };
  };
  const COARSE = SWEEP.filter((_, i) => i % 4 === 0);

  it('END TO END: the real E5 writer answers the slider — recorded values, Jovian @ seed 7', () => {
    // Max's headline read, measured headless. These are EXACT integers because the writer is
    // deterministic; if one of them moves, the E5 law itself was retuned (RHINES_K / the amplitude
    // law / the archetype bundle), which should surface here rather than pass silently.
    const at = writerAt(fRadiusLive);
    const lo = at(RADIUS_SLIDER_MIN), hi = at(RADIUS_SLIDER_MAX);
    expect({ m: lo.m, band: lo.band, jet: lo.jet }).toEqual({ m: 2, band: 2, jet: 4 });     // 0.3 R⊕
    expect({ m: hi.m, band: hi.band, jet: hi.jet }).toEqual({ m: 15, band: 13, jet: 16 });  // 16 R⊕
    // CRITERION for "the feed is alive": the Rhines wavenumber grows ≥ 5× across the slider. The
    // prediction is √(16/0.3) = 7.3× and the measurement is 15/2 = 7.5× (the small excess is the
    // M_MIN=2 floor lifting the low end). 5× is a floor with real headroom that a dead feed — which
    // returns a ratio of exactly 1.0 — cannot approach.
    expect(hi.m / lo.m).toBeGreaterThanOrEqual(5);
  });

  it('END TO END: the Rhines wavenumber and jet count are monotone non-decreasing in radius', () => {
    // CRITERION: zero decreases across 101 log-spaced radii. Reason: m = max(M_MIN, round(K√(aΩ/U)))
    // with U radius-independent, so m is monotone by construction; jetCount inherits it. Measured
    // over 5 regimes × 4 seeds × 400 steps while calibrating this check: 0 violations, everywhere.
    const seq = COARSE.map(writerAt(fRadiusLive));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].m).toBeGreaterThanOrEqual(seq[i - 1].m);
      expect(seq[i].jet).toBeGreaterThanOrEqual(seq[i - 1].jet);
    }
  });

  it('SELF-CORRECTION (recorded, not retuned): visible bandCount wobbles by at most 1', () => {
    // The first draft of this suite asserted bandCount was monotone non-decreasing. IT IS NOT, and
    // the threshold was wrong rather than the code: bandCount counts ZERO CROSSINGS of the composed
    // profile (equatorial Gaussian + Ward envelope + alternating mid-jets), and when m increments the
    // outermost lobe can lose its crossing before the pole. Characterised before setting the bound —
    // 5 regimes × 4 seeds × 400 steps: 0–2 drops per sweep, drop size ALWAYS exactly 1, while m and
    // jetCount never decreased once. So the honest invariant is a bounded wobble, not monotonicity.
    // CONSEQUENCE FOR UAT, stated so it is not read as a bug: there is one spot on a Jovian (near the
    // m=7→8 change, R ≈ 3.8 → 4.1 R⊕) where dragging radius UP shows ONE FEWER visible band before
    // resuming its climb. That is the profile's parity, not a broken feed.
    const seq = COARSE.map(writerAt(fRadiusLive));
    let drops = 0, maxDrop = 0;
    for (let i = 1; i < seq.length; i++) {
      const d = seq[i].band - seq[i - 1].band;
      if (d < 0) { drops++; maxDrop = Math.max(maxDrop, -d); }
      expect(seq[i].band, `bandCount fell by ${-d} at R=${COARSE[i].toFixed(3)}`)
        .toBeGreaterThanOrEqual(seq[i - 1].band - 1);
    }
    expect(maxDrop).toBeLessThanOrEqual(1);
    expect(drops).toBeLessThanOrEqual(3);               // measured 1–2; 3 is a loose but real ceiling
    expect(seq[seq.length - 1].band).toBeGreaterThan(seq[0].band + 5);   // and it still climbs hard
  });

  it('PLANTED DEFECT: freezing the radius driver makes the whole writer go flat', () => {
    // Break ⇒ every response check above collapses. This is what proves they are measuring the feed.
    const seq = COARSE.map(writerAt(fRadiusFrozen));
    expect(new Set(seq.map((s) => s.m)).size).toBe(1);
    expect(new Set(seq.map((s) => s.band)).size).toBe(1);
    expect(new Set(seq.map((s) => s.jet)).size).toBe(1);
    // Restore ⇒ they pass (the live sweep spans many values).
    const liveSeq = COARSE.map(writerAt(fRadiusLive));
    expect(new Set(liveSeq.map((s) => s.m)).size).toBeGreaterThanOrEqual(10);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// SITE 3 — state.bandCount, the F25 jet/shear/festoon stripe ladder (uBandCount's feed)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-BANDS (headless half) — state.bandCount answers the drawn radius', () => {
  const live = fBandCount;
  const frozen = compileExpr(SRC_BANDCOUNT.replace('state.planetRadiusEarth', '_fp.radiusEarth'), 'bandCount FROZEN');
  // (Canonical byte-inertness for this site is pinned by the literal PRE_REWIRE_AT_CANONICAL oracle
  //  above. The substitution-derived version that used to sit here was tautological — see the note there.)

  it('LIVE: the Jovian ladder tracks 12·R/rotationHours, clamped 3..16', () => {
    // Pinned values, computed by hand from the source law (rotationHours 9.9):
    //   R=11.2 → 12·11.2/9.9 = 13.576 → 14 ; R=5.6 → 6.788 → 7 ; R=0.3 → 0.364 → clamp 3 ;
    //   R=16 → 19.39 → clamp 16. CRITERION: exact integers — the quantity IS an integer.
    const at = (R) => live(envFor('Gas giant (Jovian)', R));
    expect(at(11.2)).toBe(14);
    expect(at(5.6)).toBe(7);
    expect(at(RADIUS_SLIDER_MIN)).toBe(3);
    expect(at(RADIUS_SLIDER_MAX)).toBe(16);
  });

  it('LIVE: monotone non-decreasing and spans ≥ 8 distinct counts across the slider', () => {
    // CRITERION: ≥ 8 distinct values. Reason: the unclamped law spans 0.36→19.4 over the slider, and
    // the 3..16 clamp admits 14 integers; 8 is a conservative floor that no rounding pattern can meet
    // by accident while still being far above "it moved by one".
    const s = sweepFlips((R) => live(envFor('Gas giant (Jovian)', R)));
    expect(s.distinct).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < s.values.length; i++) expect(s.values[i]).toBeGreaterThanOrEqual(s.values[i - 1]);
  });

  it('PLANTED DEFECT: the frozen form is flat on every gas preset (⇒ the checks above are not vacuous)', () => {
    for (const p of ['Gas giant (Jovian)', 'Gas giant (Saturnian)', 'Ice giant (Neptunian)',
                     'Sub-Neptune (hazy)', 'Hot Jupiter (locked giant)']) {
      expect(sweepFlips((R) => frozen(envFor(p, R))).distinct).toBe(1);
    }
    // …and the live form responds on the two presets with real leverage (evidence/G1: Neptunian,
    // Sub-Neptune and Hot Jupiter sit at the clamp floor of 3 over their whole drawn range on the
    // FROZEN feed, so only Jovian/Saturnian are legitimate A/B subjects — recorded, not assumed).
    for (const p of ['Gas giant (Jovian)', 'Gas giant (Saturnian)']) {
      expect(sweepFlips((R) => live(envFor(p, R))).distinct).toBeGreaterThanOrEqual(8);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// SITE 4 — the cloud-regime threshold gate (AC-REGIME, half 1)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('AC-REGIME — cloud regime flips at the source threshold and nowhere else', () => {
  const BLOCK = SRC_CLOUDBLOCK;
  const live = fCloudRegime;
  const frozen = compileBlock(`${BLOCK.replace(/state\.planetRadiusEarth/g, '_fp.radiusEarth')}\nreturn _cloudRegime;`, 'cloudRegime FROZEN');
  // The threshold read OUT OF THE SOURCE, so the assertion below cannot drift from the code.
  const THR = Number(extract(/_gas\s*&&\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*<\s*([\d.]+)/, 'cloud radius threshold'));

  it('the source threshold is 6 R⊕ (pin: the card\'s sub-neptune / gas-giant scale boundary)', () => {
    expect(THR).toBe(6);
  });

  // (Canonical byte-inertness: PRE_REWIRE_AT_CANONICAL. The tautological version is gone — see above.)

  it('flips EXACTLY ONCE across the slider, at the source threshold, on Sub-Neptune (hazy)', () => {
    // Sub-Neptune (2.7 R⊕, 8.2 M⊕) is the only preset the gate can flip on — the others are excluded
    // by the gas gate or by the mass co-driver. CRITERION: exactly one flip, 2 → 0, at R = THR within
    // 1e-9 relative (the detector's own localisation control is proven above at the same tolerance).
    const s = sweepFlips((R) => live(envFor('Sub-Neptune (hazy)', R)));
    expect(s.flips.length).toBe(1);
    expect(s.flips[0].from).toBe(2);
    expect(s.flips[0].to).toBe(0);
    expect(Math.abs(s.flips[0].r - THR) / THR).toBeLessThan(1e-9);
  });

  it('and NOWHERE ELSE: every other preset holds one regime across the entire slider', () => {
    const flipping = PRESETS.filter((p) => sweepFlips((R) => live(envFor(p, R))).flips.length > 0);
    expect(flipping).toEqual(['Sub-Neptune (hazy)']);
  });

  it('AS SHIPPED: with the frozen mass, Jovian and Neptunian never reach regime 2 at any radius', () => {
    // Jovian is 317.8 M⊕ and Neptunian 17.1 M⊕, so the `< 10` term excludes both at every radius.
    // NOTE what this does and does NOT establish — it pins the behaviour of the code as shipped. It is
    // NOT evidence for the claim "freezing the mass changes no outcome"; that claim is a comparison
    // against the COHERENT mass, and it is tested (and refuted) directly below.
    for (const p of ['Gas giant (Jovian)', 'Ice giant (Neptunian)']) {
      expect(sweepFlips((R) => live(envFor(p, R))).values.every((v) => v !== 2)).toBe(true);
    }
  });

  it('CORRECTED CLAIM: the frozen mass DOES change the verdict, and it does so BELOW 6 R⊕', () => {
    // ADDED 2026-07-25 (lens round). The site comment and BUILD-NOTES used to assert that freezing the
    // massEarth co-driver "does not change any outcome today" because "the radius term already excludes
    // everything above 6 R⊕". BOTH halves were wrong, and no test covered the proposition — the test
    // above only checks the as-shipped frozen code, which is true no matter how wrong the claim is.
    // Measured here against the note's OWN coherent form M(R) = M_c·(R/R_c)³, over the slider's travel.
    // CRITERION: for every gas preset there is a non-empty band of radii where the two disagree, and
    // its whole extent lies strictly BELOW the 6 R⊕ radius term — the opposite of what was claimed.
    // Bands are asserted to 3 decimals against the recorded measurement (4001 log-spaced radii), so a
    // change to any preset's canonical (R_c, M_c) surfaces here rather than silently invalidating prose.
    const EXPECTED = {                      // [lo, hi] radii where frozen and coherent disagree
      'Gas giant (Jovian)':         [0.300, 3.534],
      'Gas giant (Saturnian)':      [0.300, 4.433],
      'Ice giant (Neptunian)':      [0.300, 3.261],
      'Sub-Neptune (hazy)':         [2.885, 5.998],
      'Hot Jupiter (locked giant)': [0.300, 3.800],
    };
    const DENSE = Array.from({ length: 4001 }, (_, i) => radiusFromT(i / 4000));
    for (const [p, [eLo, eHi]] of Object.entries(EXPECTED)) {
      const fp = DRIVER_PRESETS[p], Rc = fp.radiusEarth ?? 1, Mc = fp.massEarth ?? 1;
      const diff = DENSE.filter((R) => {
        const frozenV  = R < 6 && Mc < 10;
        const coherent = R < 6 && Mc * Math.pow(R / Rc, 3) < 10;
        return frozenV !== coherent;
      });
      expect(diff.length, `${p}: no disagreement band — the refuted claim would be true`).toBeGreaterThan(0);
      expect(diff[0], `${p} band lo`).toBeCloseTo(eLo, 3);
      expect(diff[diff.length - 1], `${p} band hi`).toBeCloseTo(eHi, 3);
      expect(diff[diff.length - 1], `${p}: the divergence is NOT above 6 R⊕`).toBeLessThan(6);
    }
    // …and both ice-giant-class presets can REACH their band by an ordinary reroll, not just by
    // dragging the slider: their archetype draw range is [2.5, 4.0].
    for (const p of ['Ice giant (Neptunian)', 'Sub-Neptune (hazy)']) {
      const reached = Array.from({ length: 400 }, (_, s) => drawnR(p, s))
        .some((R) => R >= EXPECTED[p][0] && R <= EXPECTED[p][1]);
      expect(reached, `${p}: the disagreement band is unreachable by draw`).toBe(true);
    }
  });

  it('PLANTED DEFECT: the frozen form never flips (⇒ the flip check is not vacuous)', () => {
    for (const p of PRESETS) expect(sweepFlips((R) => frozen(envFor(p, R))).flips).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// SITE 5 — the giant-dynamo / aurora threshold gate (AC-REGIME, half 2)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// DISPOSITION AMENDED 2026-07-25 (working-Claude, post-lens). This gate reads the CANONICAL radius
// and is ALLOWLISTED — it is a COMPOSITION CLASSIFIER, not a physics input. The derivation is in the
// lab source at the site and in the fence's allowlist entry; the short form is that the ratified frame
// holds composition FIXED while radius varies, so the drawn radius is by construction the one quantity
// carrying no composition information, and (measured below) the two presets this gate exists to
// separate draw BIT-IDENTICAL radii at every seed. The counterfactual drawn-radius form is kept alive
// here as the instrument's positive control AND as the evidence for why it was not shipped.
describe('AC-REGIME — the giant dynamo gate classifies composition, so the slider must NOT move it', () => {
  const shipped = fGiantDynamo;
  // What R1 deliberately did NOT ship. Constructed from the SHIPPED text so it cannot drift apart.
  const counterfactual = compileExpr(SRC_GIANTDYNAMO.replace('_fp.radiusEarth', 'state.planetRadiusEarth'),
    'giantDynamo COUNTERFACTUAL (drawn radius)');
  const THR = Number(extract(/_giantDynamo\s*=\s*_gas\s*&&\s*\(_fp\.radiusEarth\s*\?\?\s*1\)\s*>=\s*([\d.]+)/, 'dynamo radius threshold'));
  const GAS = PRESETS.filter((p) => DRIVER_PRESETS[p].atmosphere?.composition === 'h2-he');

  it('the source cutoff is 3.5 R⊕ (includes the ice giant, excludes Sub-Neptune canonically)', () => {
    expect(THR).toBe(3.5);
    expect(GAS.length).toBe(5);
  });

  it('THE CLASSIFIER PROPERTY: the shipped gate is INVARIANT under the whole slider, every preset', () => {
    // CRITERION: exact — zero flips across the full reachable sweep, for all 18 presets. Not "few
    // flips" or "stable near canonical": a composition verdict that moved with the size slider would
    // mean the lab thinks you can change what a world is MADE OF by dragging how big it is.
    for (const p of PRESETS) {
      expect(sweepFlips((R) => shipped(envFor(p, R))).flips, `${p} dynamo verdict moved with the slider`).toEqual([]);
    }
  });

  it('THE REASON, MEASURED: drawn radius provably cannot separate Neptunian from Sub-Neptune', () => {
    // This is the load-bearing fact behind the disposition, and it is structural rather than
    // statistical. PRESET_ARCHETYPE maps both presets to 'sub-neptune' (deliberate, V2-3
    // AC-TAXONOMY-NEPTUNE) and drawPresetRadius keys its PRNG on 'draw:radius:'+seed with NO preset
    // name — so the two draw the SAME radius at every seed, and any size-keyed discriminator must
    // return the same verdict for two different compositions.
    // CRITERION: bit-identical draws on all 2001 seeds (Object.is, not a tolerance), AND identical
    // counterfactual verdicts on all 2001, AND the shipped form separating them at every seed.
    let sameDraw = 0, sameCounterfactual = 0, shippedSeparates = 0;
    for (let s = 0; s <= 2000; s++) {
      const rN = drawnR('Ice giant (Neptunian)', s), rS = drawnR('Sub-Neptune (hazy)', s);
      if (Object.is(rN, rS)) sameDraw++;
      if (counterfactual(envFor('Ice giant (Neptunian)', rN)) === counterfactual(envFor('Sub-Neptune (hazy)', rS))) sameCounterfactual++;
      if (shipped(envFor('Ice giant (Neptunian)', rN)) !== shipped(envFor('Sub-Neptune (hazy)', rS))) shippedSeparates++;
    }
    expect(sameDraw, 'the two presets must draw bit-identical radii').toBe(2001);
    expect(sameCounterfactual, 'a drawn-radius gate cannot tell them apart at ANY seed').toBe(2001);
    expect(shippedSeparates, 'the shipped canonical gate must separate them at EVERY seed').toBe(2001);
  });

  it('no non-gas preset ever lights the giant dynamo, at any radius', () => {
    for (const p of PRESETS.filter((x) => !GAS.includes(x))) {
      expect(sweepFlips((R) => shipped(envFor(p, R))).values.every((v) => v === false)).toBe(true);
    }
  });

  it('POSITIVE CONTROL: the counterfactual form DOES flip once at the cutoff (⇒ the sweep is not blind)', () => {
    // Without this, "the shipped gate never flips" would be indistinguishable from a sweep that cannot
    // detect flips at all — the exact vacuity this program keeps getting burned by. The counterfactual
    // is the same expression with one identifier swapped, so a flip it finds is a flip the instrument
    // could have found in the shipped form had one existed.
    for (const p of GAS) {
      const s = sweepFlips((R) => counterfactual(envFor(p, R)));
      expect(s.flips.length, `${p} counterfactual did not flip exactly once`).toBe(1);
      expect(s.flips[0].from).toBe(false);
      expect(s.flips[0].to).toBe(true);
      expect(Math.abs(s.flips[0].r - THR) / THR).toBeLessThan(1e-9);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// AT THE RADIUS THE LAB ACTUALLY DRAWS — ADDED 2026-07-25 (lens round). THE MISSING SURFACE.
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Every check above evaluates either at canonical radius or over the slider's [0.3, 16] sweep. The lab
// boots at NEITHER for most presets: world-engine-lab.html:1955
// `state.planetRadiusEarth = drawPresetRadius(driverUI.preset, state.radiusSeed, { labUnlock: true })`
// sets it
// on the first applyDrivers() call (state._lastPreset is undefined at boot, so the branch is taken) with
// the shipped default radiusSeed = 1. That is the OPERATIVE radius, and nothing tested it — which is
// the single structural reason a suite could be green while the Ice Giant lost its aurora on boot.
// This block pins the boot-time delta per preset, so the change is recorded rather than discovered.
describe('AT THE RADIUS THE LAB ACTUALLY DRAWS — the boot-time delta, pinned', () => {
  it('the boot seed is the one in source (the tables below are keyed to it)', () => {
    // CRITERION: exact. Every pinned value in this describe is a function of this seed, so if the lab
    // changes its default draw seed the tables must be re-captured — this is the tripwire that says so.
    expect(BOOT_SEED).toBe(1);
    // A CODE pin, so it reads the COMMENT-BLIND, LITERAL-BLIND pass and demands exactly one match:
    // `radiusSeed: 1,` written in a comment — or quoted in a help-panel template — is not a default
    // the lab boots with. (Both venues measured red 2026-08-08; the template venue was green before
    // the two-pass repair.)
    expect(scanCorpus(/radiusSeed:\s*1\s*,/).map((h) => `${h.rel}:${h.line}`)).toHaveLength(1);
  });

  it('the lab does NOT boot at canonical radius for 12 of 18 presets', () => {
    // CRITERION: exact preset-set equality. Only the NAMED_BODY locks stay canonical — and Moon/Mercury
    // is NOT among them at boot, because the lab's draw site passes { labUnlock: true } and
    // LAB_UNLOCKED_RANGES gives it its own [0.27, 0.38] band.
    const nonCanonical = PRESETS.filter((p) => !Object.is(canonicalR(p), drawnR(p, BOOT_SEED)));
    expect(nonCanonical.length).toBe(12);
    expect(nonCanonical).toContain('Moon/Mercury (impact-airless)');
    expect(Object.keys(LAB_UNLOCKED_RANGES)).toEqual(['Moon/Mercury (impact-airless)']);
    expect(LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)']).toEqual([0.27, 0.38]);
  });

  it('BOOT DELTA TABLE: exactly which presets change, and to what (the UAT disclosure)', () => {
    // CRITERION: exact equality on every cell, against values captured from the pre-rewire build
    // (PRE_REWIRE_AT_CANONICAL) on one side and the live expressions at the DRAWN radius on the other.
    // Three presets change a discrete rewired site at the shipped default seed; the other fifteen do
    // not. If that set ever changes, this fails and the UAT brief has to be re-written — which is the
    // point: a boot-appearance change must never land undocumented again.
    const EXPECT_DRAWN = {   //  [bandCount, cloudRegime, giantDynamo] at drawPresetRadius(p, 1)
      'Gas giant (Jovian)':      [8, 0, true],       // was [14, 0, true]  — R 11.2 → 6.2156
      'Gas giant (Saturnian)':   [7, 0, true],       // was [11, 0, true]  — R  9.4 → 6.2156
      // 'Ice giant (Neptunian)' is NO LONGER in this table. It was, when the dynamo gate read the
      // drawn radius: [3, 0, false] — aurora extinguished at the shipped default seed. The gate now
      // reads canonical (composition classifier — see AC-REGIME above), so the Neptunian boots
      // exactly as it did pre-rewire and the only boot-appearance changes are the two band counts.
    };
    const changed = [];
    for (const p of PRESETS) {
      const env = envFor(p, drawnR(p, BOOT_SEED));
      const now = [fBandCount(env), fCloudRegime(env), fGiantDynamo(env)];
      const before = PRE_REWIRE_AT_CANONICAL[p].slice(0, 3);
      if (EXPECT_DRAWN[p]) expect(now, `${p} at the drawn radius`).toEqual(EXPECT_DRAWN[p]);
      if (now.some((v, i) => v !== before[i])) changed.push(p);
    }
    expect(changed).toEqual(['Gas giant (Jovian)', 'Gas giant (Saturnian)']);
  });

  it('THE AURORA IS PRESERVED at the default seed — the regression this workstream nearly shipped', () => {
    // HISTORY, kept deliberately because the near-miss is the reason the disposition exists. When the
    // dynamo gate read the drawn radius, the Neptunian aurora did not dim at boot — it EXTINGUISHED,
    // discontinuously: this preset's derived magneticField is exactly 0.05 and the intensity guard is a
    // STRICT `>`, so losing the 0.6 dynamo boost dropped the value straight to 0. uAuroraIntensity is
    // written from state.auroraIntensity, so it reached pixels the moment the Aurora checkbox was on.
    // Three independent adversarial lenses caught it; none of the 68 tests that existed at that moment
    // did, because not one of them evaluated at the radius the lab actually boots with.
    // CRITERION: exact values, and IDENTICAL between canonical and drawn — the aurora must not move at
    // boot at all. The lab's own block is executed here (extracted, not re-implemented).
    const P = 'Ice giant (Neptunian)';
    const before = fAurora(envFor(P, canonicalR(P)));
    const after  = fAurora(envFor(P, drawnR(P, BOOT_SEED)));
    const INTACT = { giantDynamo: true, mag: 0.6, auroraIntensity: 0.6, ringLat: 0.82, ringWidth: 0.102 };
    expect(before).toEqual(INTACT);
    expect(after).toEqual(INTACT);
    expect(envFor(P, 1).u.magneticField).toBe(0.05);      // the strict-`>` guard's exact tie value

    // POSITIVE CONTROL — prove this test would have CAUGHT the regression rather than sitting green
    // through it. Rebuild the counterfactual gate and run the same aurora chain through it.
    const cfAurora = compileBlock(
      `${SRC_AURORA.replace('_fp.radiusEarth', 'state.planetRadiusEarth')}\nreturn { giantDynamo: _giantDynamo, `
      + `mag: _mag, auroraIntensity: state.auroraIntensity, ringLat: state.auroraRingLat, ringWidth: state.auroraRingWidth };`,
      'aurora block COUNTERFACTUAL');
    expect(cfAurora(envFor(P, drawnR(P, BOOT_SEED)))).toEqual({
      giantDynamo: false, mag: 0.05, auroraIntensity: 0.0, ringLat: 0.71, ringWidth: 0.146 });
  });

  it('SEED SWEEP: the shipped gate never disagrees with itself; the counterfactual would have, a lot', () => {
    // The boot seed was never special — it is one draw from a distribution that straddles the 3.5
    // cutoff, so the regression was a coin-flip across 2001 seeds rather than one unlucky default.
    // Both halves are asserted: the shipped form is seed-invariant by construction (it never reads the
    // draw), and the counterfactual's disagreement rate is pinned as the recorded magnitude of what
    // was avoided. Keeping the second number live means the justification cannot quietly rot.
    // CRITERION: exact counts over seeds 0..2000, per preset — zero for every shipped preset, and the
    // measured rates for the counterfactual. Neptunian + Sub-Neptune sum to exactly 2001 because they
    // share the draw; the three big giants are 0 either way (draw bands wholly above the cutoff).
    const counterfactual = compileExpr(SRC_GIANTDYNAMO.replace('_fp.radiusEarth', 'state.planetRadiusEarth'),
      'giantDynamo COUNTERFACTUAL (drawn radius)');
    const CF_RATE = {
      'Ice giant (Neptunian)':      1351,   // 67.5% of seeds — canonical says ON, the draw would say OFF
      'Sub-Neptune (hazy)':          650,   // 32.5% — canonical says OFF, the draw would say ON
      'Gas giant (Jovian)':            0,   // draw band [6.0, 14.0] is wholly above 3.5
      'Gas giant (Saturnian)':         0,
      'Hot Jupiter (locked giant)':    0,   // NAMED_BODY lock at 13.0
    };
    for (const [p, expected] of Object.entries(CF_RATE)) {
      const canon = fGiantDynamo(envFor(p, canonicalR(p)));
      let shippedN = 0, cfN = 0;
      for (let s = 0; s <= 2000; s++) {
        const R = drawnR(p, s);
        if (fGiantDynamo(envFor(p, R)) !== canon) shippedN++;
        if (counterfactual(envFor(p, R)) !== canon) cfN++;
      }
      expect(shippedN, `${p}: the SHIPPED gate must be seed-invariant`).toBe(0);
      expect(cfN, `${p}: counterfactual disagreement rate (the avoided regression)`).toBe(expected);
    }
  });

  it('THE 3.5 CUTOFF CAN NO LONGER DISCRIMINATE the two presets it was chosen to separate', () => {
    // The constant's recorded design purpose was "include the ice giant (canonical 3.9), exclude
    // Sub-Neptune (canonical 2.7)". PRESET_ARCHETYPE maps BOTH to 'sub-neptune' → the same
    // RADIUS_RANGES_EARTH band [2.5, 4.0] → the same alea key ('draw:radius:'+seed, which does not
    // include the preset name) → a BIT-IDENTICAL drawn radius. So post-rewire the gate returns the same
    // verdict for both at every seed, and the separation survives only at canonical radius.
    // CRITERION: the counterfactual is identical on all 2001 seeds (exact) — that collapse is WHY the
    // gate was left on canonical — while the shipped canonical form separates them on all 2001.
    const A = 'Ice giant (Neptunian)', B = 'Sub-Neptune (hazy)';
    const counterfactual = compileExpr(SRC_GIANTDYNAMO.replace('_fp.radiusEarth', 'state.planetRadiusEarth'),
      'giantDynamo COUNTERFACTUAL (drawn radius)');
    let sameR = 0, cfSameVerdict = 0;
    for (let s = 0; s <= 2000; s++) {
      const rA = drawnR(A, s), rB = drawnR(B, s);
      if (Object.is(rA, rB)) sameR++;
      if (counterfactual(envFor(A, rA)) === counterfactual(envFor(B, rB))) cfSameVerdict++;
    }
    expect(sameR).toBe(2001);
    expect(cfSameVerdict, 'a drawn-radius gate collapses the two presets together').toBe(2001);
    // …whereas the SHIPPED gate separates them, which is the discrimination the cutoff exists for.
    expect(fGiantDynamo(envFor(A, canonicalR(A)))).toBe(true);
    expect(fGiantDynamo(envFor(B, canonicalR(B)))).toBe(false);
    expect(fGiantDynamo(envFor(A, drawnR(A, BOOT_SEED)))).toBe(true);
    expect(fGiantDynamo(envFor(B, drawnR(B, BOOT_SEED)))).toBe(false);
    // The lab must SAY so at the site: an unexplained canonical read above a rewired block is how the
    // next agent "helpfully" re-points it at the drawn radius and re-introduces the regression.
    // ⚠ THESE TWO READ **RAW** SOURCE, DELIBERATELY, and it is not an oversight in a file whose whole
    // point is that comments are stripped. Their subject IS the comment: both strings live in `//`
    // prose (world-engine-lab.html:2561 `// Radius cutoff 3.5 — HISTORICAL INTENT, AND IT IS NO LONGER A DISCRIMINATION THE RADIUS CAN`
    // and :2574 `//   CLASSIFIER reads canonical; a PHYSICS INPUT reads drawn. The three genuine physics inputs`).
    // Scanning stripped text for them would delete their subject and red on day one. The rule this
    // file follows: a pin on the CODE reads the comment-blind, literal-blind pass and must match
    // exactly once; a pin on the REASONING reads raw, because prose is the thing being pinned.
    expect(LAB_RAW).toContain('NO LONGER A DISCRIMINATION THE RADIUS CAN');
    expect(LAB_RAW).toContain('CLASSIFIER reads canonical; a PHYSICS INPUT reads drawn');
  });

  it('E5 BOOT DELTA: the visible band count on the two big giants drops at boot', () => {
    // The other half of the disclosure — the E5 writer, run end-to-end at the lab's own defaults
    // (radiusSeed 1, macroSeed 1). CRITERION: exact integers; climate-e5 is deterministic.
    const REG = { 'Gas giant (Jovian)': E5_REGIME.GAS_GIANT, 'Gas giant (Saturnian)': E5_REGIME.SATURNIAN,
                  'Ice giant (Neptunian)': E5_REGIME.NEPTUNIAN };
    const POS = new Float32Array([0, 0, 1]);
    const run = (p, Rfeed, Rcond) => {
      const env = envFor(p, Rcond);
      const gd = deriveGiantDrivers(drawGiantConditions(REG[p], env._gcond, 1));
      const drivers = { ...gd, rotationRate: 9.9 / (DRIVER_PRESETS[p].rotationHours ?? 24), radius: Rfeed / 11.2 };
      return { m: resolveParams(REG[p], drivers, 1).m,
               band: bakeClimateE5Attributes(POS, 1, 1, { regime: REG[p], drivers, macroSeed: 1 }).bandCount };
    };
    const EXPECT = {   // preset: [m before, m after, e5BandCount before, e5BandCount after]
      'Gas giant (Jovian)':    [13, 10, 11, 8],
      'Gas giant (Saturnian)': [10,  8, 10, 8],
      'Ice giant (Neptunian)': [ 3,  2,  3, 2],
    };
    for (const [p, [mB, mA, bB, bA]] of Object.entries(EXPECT)) {
      const Rd = drawnR(p, BOOT_SEED);
      // "before" = the frozen feed the pre-rewire build sent (canonical), with the condition vector
      // already live — it was live before the rewire too, so only the `radius` driver moved.
      expect(run(p, canonicalR(p), Rd), `${p} before`).toEqual({ m: mB, band: bB });
      expect(run(p, Rd, Rd), `${p} after`).toEqual({ m: mA, band: bA });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// SITE 6 — the crater-boot enable set: the one site DELIBERATELY left canonical (AC-CRATERBOOT)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠ THE TITLE BELOW DELIBERATELY CARRIES NO LINE NUMBER. It read "the :5206 canonical read" until
// 2026-08-08; line 5206 is a comment about dust-veil attenuation and the read is at
// world-engine-lab.html:4323 `craterRelevanceOf(deriveConditionVector(`. A line number inside a
// describe title is worse than one in a comment: it is a TEST ID, so the citation fence cannot see
// it, re-pointing it churns the baseline record, and it rots on every edit above it. Name the site.
describe('AC-CRATERBOOT — the craterRelevanceOf canonical read is justified by measurement, re-measured here', () => {
  // This is the live guard that replaces a dated document. The G2 sweep found NO preset flips; the
  // result is NOT unconditional (it depends on K_GS, MESH_FLOOR_RAD, D_SFD_MIN_KM, G_REF, the 1e-6
  // gravity clamp and the reachable radius floor), and a planted K_GS 0.17 → 15 alone flips nine
  // presets and makes the canonical read WRONG on four of them. So the sweep runs on every CI run.
  //
  // DOMAIN CORRECTED 2026-07-25 (lens round). The sweep and the bound both used RADIUS_SLIDER_MIN = 0.3
  // as the floor, but state.planetRadiusEarth is NOT floored there: the lab's own draw site passes
  // { labUnlock: true }, and LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)'] = [0.27, 0.38], of
  // which 27.1% of seeds land below 0.3. The exemption's question is "could feeding the DRAWN radius
  // change this answer?", so the domain must be the radii the draw can produce — [0.27, 16], not
  // [0.3, 16]. The conclusion is unchanged (0.27 > 0.133); the stated headroom was 2.26x and is 2.03x.
  const REACHABLE_MIN = Math.min(RADIUS_SLIDER_MIN, ...Object.values(LAB_UNLOCKED_RANGES).map((r) => r[0]));
  const N_REACH = 501;
  const REACH_SWEEP = Array.from({ length: N_REACH },
    (_, i) => REACHABLE_MIN * Math.pow(RADIUS_SLIDER_MAX / REACHABLE_MIN, i / (N_REACH - 1)));
  const relevanceAt = (p, R) => {
    const fp = DRIVER_PRESETS[p];
    return craterRelevanceOf(deriveConditionVector(fp, deriveUniforms(fp, TIER), R));
  };

  it('the swept domain really is the REACHABLE one, not just the slider', () => {
    // CRITERION: the floor equals the lab-unlock band's low end, and it is strictly below the slider
    // floor — otherwise this suite would be re-proving the old, too-narrow domain.
    expect(REACHABLE_MIN).toBe(0.27);
    expect(REACHABLE_MIN).toBeLessThan(RADIUS_SLIDER_MIN);
    const below = Array.from({ length: 20000 }, (_, s) => drawnR('Moon/Mercury (impact-airless)', s))
      .filter((R) => R < RADIUS_SLIDER_MIN).length;
    expect(below).toBe(5422);                            // 27.1% of seeds — measured, not asserted
  });

  it('craterRelevanceOf never flips over the REACHABLE range [0.27, 16], for any of the 18 presets', () => {
    // CRITERION: zero flips, exact. A single flip would mean the canonical read returns the wrong
    // boot-enable for some drawn radius, and the site would have to be rewired.
    const flipping = PRESETS.filter((p) => sweepFlips((R) => relevanceAt(p, R), REACH_SWEEP).flips.length > 0);
    expect(flipping).toEqual([]);
    expect(PRESETS.length).toBe(18);                     // sanity: the table really covers every preset
  });

  it('the gravity channel IS exercised — this is not a sweep over a dead input', () => {
    // The predicate reaches radius through the condition vector's surfaceGravity
    // (body-condition-vector.js) and craterSchedule's sizeMul = (G_REF/g)^K_GS. If g were constant
    // the null result above would be vacuous. This is a LIVENESS guard, not a physics pin — it
    // asserts the channel moves, and the law itself is pinned in worldengine-v2-6-gcohere.test.js
    // and in the instrument's LAW_REGISTRY.
    //
    // RE-PINNED 2026-07-28 (gravity-selfcompression). The span was previously R_max/R_min = 53.3×
    // on every preset, because g was ∝ R¹ everywhere. Now rocky bodies carry the self-compression
    // shape, so the expected span is f(R_max)/f(R_min) — 862.8× on rocky, still 53.3× on the gated
    // classes. CRITERION unchanged in spirit: g must span its predicted range to 1e-9 relative.
    for (const p of PRESETS) {
      const fp = DRIVER_PRESETS[p], d = deriveUniforms(fp, TIER);
      const gLo = deriveConditionVector(fp, d, RADIUS_SLIDER_MIN).surfaceGravity;
      const gHi = deriveConditionVector(fp, d, RADIUS_SLIDER_MAX).surfaceGravity;
      const cls = compositionClass(deriveConditionVector(fp, d, fp.radiusEarth ?? 1.0));
      // LITERAL exponents, not production's gravityRadiusShape — computing the expected span from
      // the same helper under test makes this tautological in the exponent (proved by the
      // verify-workstream mutation pass; see tests/worldengine-v2-6-gcohere.test.js shapeLiteral).
      const shapeLiteral = (r) => (r <= 1 ? Math.pow(r, 4 / 3) : Math.pow(r, 1.70));
      const span = cls === 'rocky'
        ? shapeLiteral(RADIUS_SLIDER_MAX) / shapeLiteral(RADIUS_SLIDER_MIN)
        : RADIUS_SLIDER_MAX / RADIUS_SLIDER_MIN;
      expect(Math.abs(gHi / gLo - span) / span, `${p} [${cls}]`).toBeLessThan(1e-9);
      expect(span, `${p} span is a real spread`).toBeGreaterThan(10);
    }
  });

  it('DOMAIN-WIDE BOUND: no admissible condition can flip above 0.133 R⊕ — 2.03× below the reachable floor', () => {
    // Re-derived here from the imported constants, so a change to any of them breaks THIS test rather
    // than silently invalidating the site comment. craterSchedule floors gravity at 1e-6 and
    // isImpactSurface caps pressure at P_SURF_MAX, so both levers on the largest admissible crater
    // size L have ceilings, and the relevance boundary D_FLOOR_KM(R) = L has a maximum radius.
    const P_MAX_IMPACT = P_SURF_MAX - 0.1;
    const D_LO_MAX = Math.max(D_SFD_MIN_KM, C_ATMO_KM * Math.pow(P_MAX_IMPACT, P_ATMO_EXP));
    const L_MAX = D_LO_MAX * Math.pow(G_REF / 1e-6, K_GS);
    const R_FLIP_MAX = L_MAX / (MESH_FLOOR_RAD * KM_PER_EARTH_RADIUS);
    expect(R_FLIP_MAX).toBeLessThan(REACHABLE_MIN);              // the TRUE floor (0.27), not the slider's 0.3
    expect(REACHABLE_MIN / R_FLIP_MAX).toBeGreaterThan(2);       // real headroom, not a hairline pass
    expect(REACHABLE_MIN / R_FLIP_MAX).toBeCloseTo(2.03, 2);     // corrected: 2.03x, not the 2.26x once stated
    expect(R_FLIP_MAX).toBeCloseTo(0.133016, 5);                 // the value G2 measured and recorded

    // POSITIVE CONTROL THROUGH THE REAL PREDICATE: fed the most flip-prone condition its own input
    // domain admits, craterRelevanceOf DOES flip — at exactly the bound above. This is what proves the
    // null result on the presets is a property of the presets, not a broken call.
    const extremal = (R) => craterRelevanceOf({
      radiusEarth: R,
      surfaceGravity: 1e-12,                   // under the 1e-6 clamp ⇒ size multiplier at its ceiling
      T_eq: 235,                               // < CRATER_T_MAX ⇒ isImpactSurface still fires
      age: 4.5,
      atmosphere: { pressure: P_MAX_IMPACT },  // just under P_SURF_MAX ⇒ D_LO at its ceiling
      rawTidalIoRatio: 1e6,                    // t_exp → ~0 ⇒ nStamp rounds to 0
      composition: { density: 4.5, volatileFraction: 0.02 },
    });
    const ext = Array.from({ length: 1601 }, (_, i) => 1e-3 * Math.pow(RADIUS_SLIDER_MAX / 1e-3, i / 1600));
    const s = sweepFlips(extremal, ext);
    expect(s.flips.length).toBe(1);
    expect(Math.abs(s.flips[0].r - R_FLIP_MAX) / R_FLIP_MAX).toBeLessThan(1e-6);
    // …and the SAME extremal condition does not flip anywhere the DRAWN radius can go — the reachable
    // domain [0.27, 16], which is strictly wider than the slider's [0.3, 16].
    expect(sweepFlips(extremal, REACH_SWEEP).flips).toEqual([]);
    expect(sweepFlips(extremal, SWEEP).flips).toEqual([]);
  });

  it('the site still reads the canonical preset radius (disposition pin)', () => {
    // If someone "helpfully" rewires it later, this fails and points them at the evidence.
    //
    // ⭐ THESE THREE ARE THIS DESCRIBE'S **ONLY** COUPLING TO THE LAB. Everything above runs on
    // imported modules — craterRelevanceOf, deriveConditionVector, deriveUniforms, the bombardment
    // constants — so the sweeps would be word-for-word as green with the lab site deleted as with it
    // present. Whatever these pins fail to notice, nothing else here notices either.
    //
    // WHICH IS WHY THE FIRST ONE MOVED TO STRIPPED SOURCE, AND WHY IT COUNTS (2026-08-08). Measured
    // on a scratch mirror: replace the live call at world-engine-lab.html:4323
    // `if (_fp && craterRelevanceOf(deriveConditionVector(_fp, deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth)) > 0) set.add('craters');`
    // with a pack read while quoting the old call in a comment, and all three of these stayed GREEN —
    // 44/44 — because `LAB` was raw text and the comment satisfied every one of them. The canonical
    // read the whole AC-CRATERBOOT exemption rests on could be gone with the suite reporting it
    // present. Now: comment-BLIND and literal-BLIND, and EXACTLY ONE match, so a quoted copy is
    // invisible and a duplicated call is loud.
    // ⚠ AND THE COMMENT WAS NOT THE ONLY VENUE — this pin was still green on 2026-08-08 with the
    // same call parked in a `/* glsl */ ` template AND with it parked in an ordinary quoted string,
    // both after the live call was replaced by a pack read. Both are red now (`1 failed | 51 passed`
    // each, this test being the one). Comment-stripping alone would not have caught either.
    const live = scanCorpus(/craterRelevanceOf\(deriveConditionVector\(_fp,\s*deriveUniforms\(_fp,\s*driverUI\.qualityTier\),\s*_fp\.radiusEarth\)\)/);
    expect(live.map((h) => `${h.rel}:${h.line}`), 'the canonical craterboot read, in LIVE code').toHaveLength(1);
    // The other two are PROSE pins and stay on RAW source for the same reason as the pair in
    // AC-REGIME above: their subject is the comment. world-engine-lab.html:4274
    // `// RADIUS-CANONICAL-BY-PROOF — this is the ONE site the radius-live-feed R1 rewire deliberately did`
    // and :4276 `// Evidence: docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/evidence/G2-craterboot-sweep.md`.
    // They assert the exemption is still ARGUED at the site; the stripped pin above asserts it is
    // still TRUE there. Neither substitutes for the other.
    expect(LAB_RAW).toContain('RADIUS-CANONICAL-BY-PROOF');
    expect(LAB_RAW).toContain('evidence/G2-craterboot-sweep.md');
  });
});

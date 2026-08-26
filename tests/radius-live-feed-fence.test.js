// tests/radius-live-feed-fence.test.js — AC-NOFROZEN.
// Workstream: world-engine-radius-live-feed-2026-07-25. Widened for PLAN §4 Step 3 on 2026-08-08, and
// repaired the same day by PLAN §11.4's adversarial round 1, which proved the widened fence still had
// two silent greens: an exemption forgave a whole SOURCE LINE rather than its own span, and "live"
// meant "not in a comment" while a template literal held dead text just as well. Both are closed
// below, each with the plant that was measured GREEN before and RED after.
//
// THE DEFECT THIS FENCE EXISTS TO PREVENT. Six sites in world-engine-lab.html derived a LIVE quantity
// (Rhines band drivers, the F25 jet stripe ladder, the storm-vortex drivers, the cloud-regime gate,
// the giant-dynamo gate) from `_fp = DRIVER_PRESETS[driverUI.preset]` — a FROZEN preset object the
// radius slider never mutates. The slider writes `state.planetRadiusEarth`. So dragging radius moved
// the disc and moved nothing else. That is Max's "I can tell that's not happening across the board".
// Five of the six now read the drawn radius. This fence keeps the frozen feed from silently returning.
//
// THE INVARIANT: no expression in the CORPUS may read `radiusEarth` off a frozen preset object — in
// any of the four spellings the tree actually writes: `_fp`, a bare `fp`, a bare `preset`, or a
// `DRIVER_PRESETS[...]` subscript — EXCEPT the explicit ALLOWLIST below, which exempts a named BYTE
// SPAN and nothing else on its line. An allowlist entry is only legitimate if the site's
// canonical-radius behaviour was PROVEN by measurement rather than assumed (contract AC-NOFROZEN
// observable), and if the artifact carrying that proof demonstrably mentions the site.
//
// COMMENT-INCLUSIVE BY DESIGN, following the house pattern of tests/vis-scale-fence.test.js. The DENY
// scan does NOT strip comments: commented-out code is one uncomment away from being live, and a fence
// that ignores comments cannot see that coming. The cost is that PROSE about the defect trips the
// fence, so the lab's own rewire comments say "the frozen preset constant" in words rather than
// quoting the expression. That is the same trade vis-scale-fence.test.js already imposes on
// src/worldengine/**.
//
// ⚠⚠ TWO OPPOSITE TREATMENTS OF COMMENTS LIVE IN THIS FILE, EACH FOR A STATED REASON. Do not
// "harmonise" them — harmonising breaks whichever one you move.
//   · The DENY scan is comment-INCLUSIVE (above). A commented-out frozen read is one uncomment from
//     being live, so it must still be reported.
//   · The allowlist LIVENESS check and the AC-0 source pins are comment-BLIND — they run against
//     `stripCommentsPreservingOffsets` output. An EXEMPTION may only certify LIVE code: an
//     allowlisted site that is moved out of the tree but left quoted in a comment would otherwise stay
//     "covered" forever, and the exemption silently becomes a certified comment. Symmetrically, a
//     source pin satisfied by a comment is the same defect one level up — it would let the extracted
//     block be deleted as long as somebody quoted it on the way out. That is precisely the hole
//     tests/helpers/source-scan.mjs was built to close (see its header: six mutants, all green).
//
// ⭐ AND THE COMMENT-BLIND SIDE IS NOW LITERAL-BLIND TOO (2026-08-08, adversarial round 1). A comment
// is not the only way to park dead text: a template literal and a quoted string hold it just as well,
// and the default stripper PRESERVES literal interiors by design (it feeds `new Function`). MEASURED
// on the tree as it stood before this fix, both directions silently green:
//   · the adapter's allowlisted line moved out and its text parked in a backtick template ⇒ the
//     liveness test `certifies LIVE code` reported `1 passed | 51 skipped (52)`. The exemption
//     certified a template.
//   · `state.auroraRingWidth = Math.max(0.07, 0.15 - _mag * 0.08);` (world-engine-lab.html:2589)
//     DELETED and re-quoted inside a single-quoted string ⇒ whole file `52 passed (52)`. The AC-0 pin
//     that exists to catch that deletion was satisfied by the quote.
// So the liveness check and every comment-stripped pin run against `LIT_STRIPPED` /
// `LAB_CODE` — the `{ blankLiteralText: true }` pass, which keeps each literal's DELIMITERS and blanks
// its INTERIOR. That pass is byte-length- and newline-identical to the default one, so line numbers
// and offsets agree character for character across all three views.
//
// PASS/FAIL CRITERION FOR THE WHOLE FILE: exact set equality on the offender list (`toEqual([])`), not
// a count or a threshold. A radius feed is either live or frozen; there is no tolerance band.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCommentsPreservingOffsets, jsFilesUnder, lineOf } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB_REL = 'world-engine-lab.html';
const ADAPTER_REL = 'src/worldengine/port/conditionFromBody.js';

// ── the corpus ───────────────────────────────────────────────────────────────────────────────────
// WIDENED 2026-08-08 for PLAN §4 Step 3, whose stated reason is that this fence "matches
// `_fp…radiusEarth` patterns IN ONE FILE; move a law out and the scan passes VACUOUSLY over an emptied
// region while the extracted module sits unguarded." Steps 4 and 5 both delete lab code into
// src/worldengine/**, so the destination tree has to be inside the scan BEFORE either lands.
//
// MEASURED 2026-08-08, and enumerated rather than gestured at — the widened hit set is not unbounded,
// it is exactly TWO pre-existing hits and both are disposed of below:
//   · 42 .js files under src/worldengine, ZERO non-.js files in that tree (so `jsFilesUnder`'s
//     extension filter drops nothing here), plus world-engine-lab.html and planet-lod-shaders.glsl.js
//     ⇒ a 44-file corpus. ⭐ RE-MEASURED 2026-08-12 AFTER STEP 7: 53 .js under src/worldengine (the
//     five moved modules plus the packs landed since) + the lab ⇒ a 54-file corpus, and the shader
//     module is now INSIDE the walked tree rather than concatenated (see CORPUS_REL).
//   · planet-lod-shaders.glsl.js: 0 DENY hits. So are src/worldengine/shaders/craterRelief.glsl.js
//     and heightNoise.glsl.js, the only other `.glsl.js` files in the corpus. They are scanned anyway
//     because a `.glsl.js` file is a JS module that can hold JS, and excluding it would be an
//     unmeasured carve-out.
//   · HIT 1 — the adapter, ADAPTER_REL `const condition = deriveConditionVector(fp, null, fp.radiusEarth);`
//     — LIVE CODE that PLAN.md:216 `**A decision recorded here, not deferred.**` rules CORRECT
//     ("do not invent a second game radius"). ⇒ ALLOWLIST entry 'adapter-oneGameRadius' below.
//     ⚠ THE SPAN ABOVE IS DELIBERATELY ON ONE LINE. It was wrapped across two, which gives each line
//     an ODD backtick count — and the citation fence then voids its in-span/out-of-span verdict and
//     files the ref under TICK-PARITY, where it can never fail the build. Measured: adding this file
//     to CITE_SOURCES surfaced exactly that on three refs here. Same defect class as the wrapped
//     driver-presets ref repaired below; a citation the scanner cannot read is not a citation.
//   · HIT 2 — src/worldengine/base/giant-drivers.js:62, a PROSE comment. ⇒ REWORDED, not allowlisted.
//     Measured before rewording: `fp` had NO binding anywhere in that file — 3 occurrences, all inside
//     comments (:62, :63, :212) — so there was no read to exempt. An allowlist entry demands a
//     measured proof; a comment has none, and the file's own :63 and :212 already say
//     "the drawn-vs-fp radius ambiguity" without tripping the pattern. Rewording is the remedy this
//     header has always documented, and it is the one that was applied.
//
// The walker is the shared house idiom: source-scan.mjs:305 `export function jsFilesUnder(root, rel) {`,
// promoted there from vis-scale-fence.test.js:74 `function jsFilesUnder(rel) {` — the fence that
// already walks this exact tree for the same reason. (Both refs kept on one line each, per the
// tick-parity note above.)
// ⭐ STEP 7 REMOVED THE THIRD ELEMENT, AND REMOVING IT IS WHAT KEEPS THE CORPUS HONEST. The lab
// shader module moved to src/worldengine/shaders/planetShaders.glsl.js, which the walker ALREADY
// returns — so naming it again would put one file in CORPUS_REL TWICE, and `scanCorpus` iterates
// this array, so every future DENY hit in it would be reported (and counted) twice. Today that is
// invisible, because the file measures 0 hits; the day it carries one, a `toHaveLength(1)` on the
// other side of the fence reads 2 and the failure looks like a scanner bug. The coverage claim it
// used to carry is unchanged and is asserted directly at :510 and by the walker's own membership.
const CORPUS_REL = [...jsFilesUnder(ROOT, 'src/worldengine'), LAB_REL];
const SRC = new Map(CORPUS_REL.map((rel) => [rel, readFileSync(join(ROOT, rel), 'utf8')]));
const LAB = SRC.get(LAB_REL);

// Comment-BLIND view of the corpus — never for the DENY scan. Offset-preserving, so `lineOf` reports
// the same line number on any view
// (tests/helpers/source-scan.mjs:230 `export function stripCommentsPreservingOffsets(src, opts = {}) {`).
const STRIPPED = new Map(CORPUS_REL.map((rel) => [rel, stripCommentsPreservingOffsets(SRC.get(rel))]));

// Comment-blind AND literal-blind: the view the liveness check and the AC-0 pins actually assert on.
// Quoted delimiters survive, their interiors do not, so text that only exists inside a string or a
// `/* glsl */` template can satisfy nothing here. See the third bullet of the header block.
const strippedCode = (src) => stripCommentsPreservingOffsets(src, { blankLiteralText: true });
const LIT_STRIPPED = new Map(CORPUS_REL.map((rel) => [rel, strippedCode(SRC.get(rel))]));
const LAB_LIVE = STRIPPED.get(LAB_REL);
const LAB_CODE = LIT_STRIPPED.get(LAB_REL);

// ── the deny pattern ─────────────────────────────────────────────────────────────────────────────
// Matches a `radiusEarth` member read on a FROZEN preset source, in any of the spellings the lab
// uses or could use:
//     _fp.radiusEarth   _fp?.radiusEarth   fp.radiusEarth   DRIVER_PRESETS[driverUI.preset].radiusEarth
// `\s*` around the dot spans newlines, so a line-broken member chain cannot slip past a line scan.
// It deliberately does NOT match the LIVE sources, which is what makes the fence meaningful rather
// than a blanket ban on the word: `state.planetRadiusEarth`, `_gcond.radiusEarth` /
// `_scond.radiusEarth` (the condition vector, which carries the drawn radius), `o.radiusEarth`
// (probe options), or `radiusEarth: 1` (an object-literal key). Those are all asserted below.
//
// THIRD SPELLING ADDED 2026-07-25 (lens round). The fence originally knew only `_fp` and a
// `DRIVER_PRESETS[…]` subscript — but the lab ALREADY has a third frozen-preset binding in scope on
// the radius path: the bare parameter `fp` of `buildBodyDrivers(u, fp)` and `resetDriverOverrides(u,
// fp)`, off which `fp.T_eq` and `fp.age` are already read. buildBodyDrivers is where the condition
// vector for the whole body-driver bundle is derived, i.e. the SAME class of site as the two the
// rewire just fixed, so a re-freeze written through that alias would have been invisible. `\bfp\b`
// cannot match inside `_fp` (no word boundary after `_`), so the two alternatives do not overlap.
//
// FOURTH SPELLING ADDED 2026-08-08 (adversarial round 1). `preset` — and unlike the three above it is
// not a hypothesis, it is LIVE CODE: driver-presets.js:325 `const canonical = preset.radiusEarth ?? 1.0;`
// inside `drawPresetRadius`, the very function the giantDynamo entry below cites as its proof. The
// binding form is idiomatic in both files that own preset access; one of three such bindings is
// world-engine-lab.html:879 `const preset = DRIVER_PRESETS[presetName] || {};` (kept on ONE line — see
// the tick-parity note in the corpus block: a citation the scanner cannot read is not a citation).
// MEASURED BEFORE ADDING: a `const _bandR = Math.round(12 * (preset.radiusEarth ?? 1) / 24);` planted
// directly under lab:879 left the fence at `52 passed (52)` — a real frozen read, invisible.
// COST MEASURED, not assumed: `\bpreset\b\s*\??\.\s*radiusEarth` has ZERO hits across the whole
// 44-file corpus, so this alternation costs nothing today and closes the alias the codebase already
// writes. `\bpreset\b` cannot match inside `presetName`, and `DRIVER_PRESETS[driverUI.preset]` has a
// `]` where `.radiusEarth` would have to be, so neither trips it.
//
// ⚠ NO TRAILING `\b`, AND THAT IS A DECISION, NOT AN OVERSIGHT. `_fp.radiusEarthCanonical` therefore
// MATCHES. Step 1 landed `radiusEarthCanonical` as a vector field, so this WILL bite one day — and it
// should: a canonical read off a FROZEN PRESET is still a frozen read, and it needs the same measured
// ruling as any other. The alternative (append `\b`) buys a quieter build by making the fence blind to
// a spelling of exactly the thing it bans. Measured: `radiusEarthCanonical` has 0 occurrences across
// the 44-file corpus today, so the choice costs nothing now and is pinned in MUST_MATCH below.
const DENY_SRC = String.raw`(?:\b_fp\b|\bfp\b|\bpreset\b|DRIVER_PRESETS\s*\[[^\]]*\])\s*\??\.\s*radiusEarth`;
// NON-global on purpose: `.test()` on a /g regex advances and RETAINS `lastIndex`, and
// String.prototype.matchAll seeds its internal matcher FROM the source regex's lastIndex — so a
// single module-level /g regex shared between `.test()` and `matchAll` silently starts later scans
// mid-file. That bug was live here (measured: the staleness test below left lastIndex = 122, so
// every subsequent scan began at byte 122 and could not see an offender in the first 122 bytes).
// The scanner therefore builds a FRESH global matcher per call; nothing carries state between them.
const DENY = new RegExp(DENY_SRC);
const denyScanner = () => new RegExp(DENY_SRC, 'g');

// ── the declared carriers ────────────────────────────────────────────────────────────────────────
// ⭐ THE HEADLINE OF THE STEP-3 WIDENING. Non-vacuity is asserted PER FILE, against this named list —
// NOT as one count over the whole corpus.
//
// MEASURED, and it is the reason this list exists rather than a corpus-wide `all.length >= 1`:
// keeping the old assertion shape (`all.length >= 1` && `allowedHits.length === all.length`) over a
// CONCATENATED widened corpus stays GREEN with the LAB'S OWN DENY HITS AT ZERO, sustained entirely by
// the src/worldengine hit. And the mutant that produces that state is not a hypothetical — it is
// PLAN §4 Step 4's declared first move, `giantRegimeOf(condition)` replacing the preset-name lookup
// that feeds the `_giantDynamo` gate, plus the companion move that carries the crater boot out with
// it. The naive widening therefore REINTRODUCES exactly the fail-open Step 3 exists to close, one
// level up: the scan would pass vacuously over an emptied FILE instead of an emptied REGION.
//
// ⛔ WHO IS NOT ON THIS LIST, AND WHY — a carrier list is a claim about what is intact, so a wrong
// entry reds the build for a false reason:
//   · src/worldengine/base/giant-drivers.js — deliberately NOT a carrier. Its one hit was PROSE and
//     was reworded to zero hits (see the corpus block above). Requiring ≥1 here would demand the
//     defect be kept.
//   · planet-lod-shaders.glsl.js — deliberately NOT a carrier. Measured 0 hits; requiring ≥1 reds a
//     clean build. (Now src/worldengine/shaders/planetShaders.glsl.js — still 0, still not a carrier.)
//   · the other 40 src/worldengine files — measured 0 hits each.
// ⭐ STEP 7 ADDED THE THIRD ENTRY. src/worldengine/base/conditionVector.js arrived in the corpus with
// exactly one DENY hit, :105 `const _R_c = fp.radiusEarth ?? 1.0` — allowlisted below as the
// canonical preset radius. An allowlisted site is still a CARRIER: the non-vacuity claim is that the
// scan can SEE the site, and the exemption is applied after it is seen. It is listed for the same
// reason the adapter is, and it is the strongest carrier in the corpus, because `_R_c` is the D14
// gravity denominator and cannot be deleted without deleting the law.
const REQUIRED_CARRIERS = [LAB_REL, ADAPTER_REL, 'src/worldengine/base/conditionVector.js'];

// ── the allowlist ────────────────────────────────────────────────────────────────────────────────
// One entry per deliberately-canonical site. `file` is the corpus file the site must live in. `why`
// must state the PROOF, `evidence` must point at the artifact that carries it, and `anchor` must be a
// string that artifact actually contains — an entry with no measured proof is not admissible, and
// neither is one whose proof is a file that never mentions it.
//
// ⭐ `match` IS THE EXEMPTED SPAN — one field, one meaning, CHANGED 2026-08-08. It used to be "a
// distinctive substring of the offending SOURCE LINE" (a line-identifying anchor, deliberately not a
// line number, because line numbers rot). It is now the exact BYTE RANGE the exemption covers: a DENY
// hit is forgiven only if its match starts INSIDE `[k, k + match.length)`, k being where `match` sits
// on the line. Nothing else on that line rides along.
// ⛔ THE CONSEQUENCE THAT COST A FIELD REWRITE: `match` must therefore CONTAIN the frozen read it
// exempts. The craterboot entry's was `craterRelevanceOf(deriveConditionVector(` — a PREFIX that stops
// 60 characters short of the `_fp.radiusEarth` it certifies. Under a span test that entry exempts
// nothing and the fence reds on clean source (measured: the crater-boot line reported as an offender
// on an unmodified tree). Extending it to the whole call is what makes the span reading coherent.
// The narrowing is real and it is intended: re-spelling the read INSIDE an exempted span — say
// `_fp.radiusEarth` → `DRIVER_PRESETS[preset].radiusEarth` — voids the exemption and demands it be
// re-stated, because the span no longer occurs. That is one line of allowlist maintenance in exchange
// for an exemption that cannot drift under its own proof.
//
// ⭐ `file` IS REQUIRED AND THE MATCHER IS KEYED ON IT (file, substring), NOT ON THE SUBSTRING ALONE.
// The pre-Step-3 matcher was `allowlist.some((a) => text.includes(a.match))` — FILE-BLIND. MEASURED
// 2026-08-08: a real frozen read planted into src/worldengine/base/e1Regime.js wearing the crater-boot
// call shape produced 1 raw DENY hit and 0 offenders — a LAB-proven exemption silently forgiving a
// NEVER-MEASURED src/worldengine read. That is not an exotic bypass: Steps 4 and 5 MOVE lab code into
// that tree carrying these call shapes with them, so under a file-blind matcher the exemption travels
// to a new home with no new proof, written by an author following the file's own idioms — PLAN §11.1's
// D clause, second half, which BLOCKS.
const ALLOWLIST = [
  {
    id: 'craterboot-worldDefaultEnableSet',
    file: LAB_REL,
    // The WHOLE call, not the `craterRelevanceOf(deriveConditionVector(` prefix it used to be — the
    // span has to contain the `_fp.radiusEarth` it certifies. See the ⭐ note on `match` above.
    match: 'craterRelevanceOf(deriveConditionVector(_fp, deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth))',
    // PROVEN, not assumed. craterRelevanceOf was swept over the FULL slider range for all 18 presets
    // (18 × 401 log-spaced radii, the slider's own radiusFromT travel): zero flips, and no continuous
    // margin closer than 18× to any decision boundary. Stronger than the preset table — the predicate's
    // own clamps (craterSchedule floors gravity at 1e-6; isImpactSurface caps pressure at P_SURF_MAX)
    // bound the flip radius over its ENTIRE admissible input domain at R_flip_max = 0.133 R⊕, which is
    // 2.26× BELOW the slider floor of 0.3. On [0.3, 16] the predicate reduces to
    // `isImpactSurface(c) && t_exp > 0`, both radius-blind. Feeding the drawn radius here could not
    // change the answer; doing it would be churn against measured evidence.
    // The bound is re-derived and the sweep re-run on every CI run by
    // tests/radius-live-feed.test.js → "AC-CRATERBOOT", so this allowlist entry cannot go stale silently.
    // FLOOR CORRECTED 2026-07-25 (lens round): the margin used to be quoted against RADIUS_SLIDER_MIN
    // = 0.3, but state.planetRadiusEarth is not floored there — the lab's draw site passes
    // { labUnlock: true } and LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)'] = [0.27, 0.38],
    // 27.1% of whose seeds land below 0.3. True reachable floor 0.27 ⇒ headroom 2.03x, not 2.26x.
    why: 'craterRelevanceOf is measured constant in R across the whole REACHABLE radius range [0.27, 16] '
       + 'for every preset; its own clamps bound any possible flip at 0.133 RE, 2.03x below the true '
       + 'reachable floor of 0.27 RE (the Moon/Mercury lab-unlock draw band, not the 0.3 slider floor).',
    evidence: 'docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/evidence/G2-craterboot-sweep.md',
    // The sweep note quotes the call shape itself, so the site's own `match` is the anchor.
    anchor: 'craterRelevanceOf(deriveConditionVector(',
  },
  {
    id: 'giantDynamo-compositionClassifier',
    file: LAB_REL,
    match: '_giantDynamo = _gas && (_fp.radiusEarth',
    // PROVEN, not assumed — and proven STRUCTURALLY, which is stronger than a sweep.
    // This gate decides which INTERIOR COMPOSITION a world has (metallic-/ionic-envelope dynamo vs
    // regime-2 featureless). The ratified V2-6 frame is that the slider draws a bigger body of the
    // SAME composition — so the drawn radius is, by construction, the one quantity carrying no
    // composition information. Keying a composition classifier on it is a category error.
    // The measurement that makes it observable: 'Ice giant (Neptunian)' and 'Sub-Neptune (hazy)'
    // share the PRESET_ARCHETYPE key 'sub-neptune' (deliberate, V2-3 AC-TAXONOMY-NEPTUNE), and
    // drawPresetRadius keys its PRNG on 'draw:radius:'+seed with NO preset name
    // (driver-presets.js:331 `alea('draw:radius:' + (seed >>> 0))`, and again at :337; the function
    // itself is driver-presets.js:323 `export function drawPresetRadius(presetName, seed, { labUnlock = false } = {}) {`)
    // — so at every seed the two presets receive a BIT-IDENTICAL drawn radius. A size-keyed
    // discriminator therefore returns the SAME verdict for two DIFFERENT compositions, at every
    // seed, necessarily. Feeding the drawn radius here does not make the gate more responsive; it
    // makes it non-functional, and (because the next line's guard is a strict '>' against a
    // magneticField of exactly 0.05) it ZEROES the ice giant's aurora on 67.5% of seeds including
    // the shipped default.
    // ⚠ THAT REF WAS REPAIRED 2026-08-08 AND THE REPAIR IS THE POINT (PLAN §11.1 class N, blocking in
    // a file the step edits). It read `driver-presets.js` / `:271` SPLIT ACROSS TWO SOURCE LINES, and
    // the citation tool's bare-`:NNN` continuation rule is same-line only, so the scanner never saw
    // it — an invisible ref. Its content was wrong as well: :271 is a comment about
    // CONDITION_DRAW_EXCLUDED, and :248 is prose about the same PRNG. The claim lives at :331.
    // Both halves were verified with `sed -n` before this line was written.
    // Re-checked every CI run by tests/radius-live-feed.test.js -> "AT THE RADIUS THE LAB ACTUALLY
    // DRAWS", which asserts both the identical-draw collapse and the preserved aurora, so this
    // entry cannot go stale silently.
    why: 'the giant-dynamo gate is a COMPOSITION CLASSIFIER, not a physics response. Neptunian and '
       + 'Sub-Neptune deliberately share a draw range and PRNG key, so their drawn radii are '
       + 'bit-identical at every seed — a size-keyed discriminator provably cannot separate them. '
       + 'Classifiers read canonical; physics inputs read drawn.',
    evidence: 'docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/BUILD-NOTES.md',
    // BUILD-NOTES.md does not quote the gate's source line, so the anchor is the §10 heading that
    // carries the ruling — its "§10 — DISPOSITION CORRECTION" heading. Cited without a line number on
    // purpose: `BUILD-NOTES.md` is not a unique basename in this repo, so the line+symbol form lands
    // in UNRESOLVED and verifies nothing. The anchor string below is the check that does not rot.
    anchor: 'the giant-dynamo gate reads CANONICAL',
  },
  {
    id: 'adapter-oneGameRadius',
    file: ADAPTER_REL,
    match: 'const condition = deriveConditionVector(fp, null, fp.radiusEarth);',
    // ⭐ NOT A NEW RATIONALE. This entry exists because the Step-3 widening pulled a pre-existing,
    // already-adjudicated site into the scan, and the adjudication is quoted, not re-derived.
    // PLAN.md:216 "Ruling: do not invent a second game radius" — the paragraph beginning "A decision
    // recorded here, not deferred", recorded under Step 2: the third argument is byte-identical to
    // `_R_c`, so `gravityRadiusRatio` returns exactly 1.0 on every game body and the gravity
    // self-compression law (`GRAV_R_EXP_SUB/SUPER`) never fires. That is CORRECT, NOT BROKEN. The lab
    // has two radii because its GUI has a radius SLIDER separate from the preset; the game has ONE
    // radius per body. The law expresses "what if this body were a size other than its canonical one,"
    // which is not a question the game asks.
    // ⚠ The site is cited SYMBOL-ONLY, with no line number, per PLAN §10: conditionFromBody.js is
    // one of the two regions that convention names explicitly, because every step of this plan adds
    // lines to it and an integer written there is born with a half-life of one step. The `match`
    // string above IS the ref.
    // ⛔ WHAT THIS ENTRY DOES NOT LICENSE, stated because an exemption is read by whoever wants one:
    // it certifies THAT ONE SPAN — the byte range of the `match` string above — IN THAT ONE FILE.
    // ⚠ THAT SENTENCE USED TO SAY "THAT ONE LINE", AND THE BROAD READING WAS THE TRUE ONE. The skip
    // was keyed on the whole source line until 2026-08-08, so a second frozen read appended to this
    // line rode along free: measured, ` const _giantR = fp.radiusEarth;` appended here left the fence
    // at `52 passed (52)`. The scanner's column test is what makes the narrow reading true; the prose
    // was corrected to follow the mechanism rather than the other way round.
    // It is keyed on `file`, so it cannot travel with a moved call shape; and it is checked for
    // LIVENESS below against comment- AND literal-blanked source, so it cannot survive the line being
    // demoted to a comment or re-quoted inside a template. If Step 4 or 5 feeds `giantRegimeOf` a
    // condition derived at `_fp.radiusEarth`, that is a DIFFERENT site and needs its own ruling — see
    // KNOWN LIMITS #3, whose promise the span fix is what finally made true.
    why: 'the game has exactly one radius per body, so this third argument is byte-identical to the '
       + 'canonical radius and gravityRadiusRatio is exactly 1.0 — the self-compression law it would '
       + 'feed can never fire. PLAN Step 2 ruled this correct and ruled against inventing a second '
       + 'game radius; a "fix" here would fabricate the second radius that ruling forbids.',
    evidence: 'docs/FEATURES/one-pipeline-two-frontends-PLAN.md',
    // The PLAN quotes this exact line in the Step-2 ruling, so the site's own `match` is the anchor.
    anchor: 'const condition = deriveConditionVector(fp, null, fp.radiusEarth);',
  },
  {
    id: 'conditionVector-canonicalDenominator',
    file: 'src/worldengine/base/conditionVector.js',
    match: 'const _R_c   = fp.radiusEarth ?? 1.0;',
    // ⭐ NOT A NEW RATIONALE EITHER, AND IT IS THE SAME ONE AS THE ADAPTER'S, SEEN FROM THE OTHER END.
    // Step 7 moved this file from the repo root into src/worldengine/base/, which is the whole of why
    // it is newly visible: ledger C17 recorded that the lab's support modules sat OUTSIDE the corpus
    // by accident of where files happen to live, and named Step 7 as the step that either brings them
    // in or says out loud why not. It brings them in.
    //
    // WHY THE HIT IS NOT A DEFECT, and the distinction is two lines apart in the source:
    //   :105  `_R_c` = the CANONICAL preset radius — the DENOMINATOR of the D14 gravity mass-radius
    //         ratio. It answers "what size is this body nominally," which no draw can change.
    //   :106  `_R`   = `radiusEarth ?? _R_c` — the DRAWN radius, the third argument, the live feed.
    // `gravityRadiusRatio` is R/R_c. Feeding the DRAWN radius into the denominator makes the ratio
    // identically 1.0 and the self-compression law (`GRAV_R_EXP_SUB/SUPER`) can then never fire —
    // i.e. "fixing" this hit DELETES the law it looks like it protects. That is the same shape as the
    // adapter entry above (where the ratio is 1.0 legitimately, because the game has one radius per
    // body); here the two radii are genuinely distinct and the frozen read is the correct one.
    // ⚠ Verified before this entry was written: :105/:106 read exactly as quoted at c479e29, and
    // tests/radius-live-feed-fence.test.js:294 already carries the same `_R_c`/`_R` distinction for
    // the adapter — this entry is that note applied at the definition site.
    // ⛔ WHAT IT DOES NOT LICENSE: the byte range of the `match` string, in THAT file, and nothing
    // else on the line — the column test above, not the line. A second frozen read appended here is
    // an offender.
    why: 'the two radii on these two lines are DIFFERENT quantities: _R_c is the canonical preset '
       + 'radius (the D14 gravity denominator, a fact about the body) and _R is the drawn radius (the '
       + 'live feed). Rewiring _R_c to the drawn radius forces gravityRadiusRatio to exactly 1.0, '
       + 'which permanently disables the self-compression law — the "fix" would delete the physics.',
    evidence: 'docs/FEATURES/one-pipeline-two-frontends-CARRIED.md',
    anchor: '_R_c is the canonical preset radius, not the drawn one',
  },
];

// ── KNOWN LIMITS ─────────────────────────────────────────────────────────────────────────────────
// ⭐ Written HERE, in the gate's own source, and not only in the carried ledger. PLAN §11.9: "A limit
// that is not written into the gate itself has been forgotten, not accepted." Each entry names the
// construct it excuses and the measurement that sized it.
//
// #1 — THE PATTERN CAN ONLY SEE FOUR SPELLINGS, AND HERE IS THE LINE BETWEEN CLOSED AND ACCEPTED.
//      `DENY_SRC` recognises `_fp`, a bare `fp`, a bare `preset`, and a `DRIVER_PRESETS[...]`
//      subscript. `preset` was CLOSED 2026-08-08 rather than filed here, because the round-1
//      measurement showed the alias is live code in the tree (driver-presets.js:325) and the closing
//      cost zero corpus hits — §11.9's point is that a limit is accepted only when closing it is
//      genuinely out of proportion, and this one was one alternation.
//      STILL INVISIBLE, AND ENUMERATED WITH THE ARM THAT MEASURED IT — a five-arm matrix, one
//      `src/worldengine/base/step4Probe.js` per arm, `npx vitest run tests/radius-live-feed-fence.test.js`:
//        A  `const p = DRIVER_PRESETS[n] || {}; p.radiusEarth`  74 passed (74)   INVISIBLE
//        B  `const { radiusEarth } = _fpArg`                    74 passed (74)   INVISIBLE
//        C  `presetOf(n).radiusEarth`                           74 passed (74)   INVISIBLE
//        D  a parameter literally named `preset`      21 failed | 53 passed (74) CAUGHT (the new one)
//        E  `_fp.radiusEarth`, the control            21 failed | 53 passed (74) CAUGHT
//        clean tree                                            74 passed (74)
//      A, B and C all rename the binding, so closing them needs a binding-aware pass — the taint
//      analysis PLAN's ledger row C7 already ruled out of proportion for a gate of this kind. This is
//      a spelling fence, not a dataflow analysis, and it must never be described as one.
//
// #2 — D-CLAUSE VERDICT FOR STEP 4, WITH ITS EVIDENCE — NOT BLOCKING, AND HERE IS WHY.
//      PLAN §11.1's D clause (as amended by §11.9) asks whether the NEXT step's declared first move
//      can be written past this gate BY AN AUTHOR FOLLOWING THE FILE'S OWN IDIOMS. Step 4 item 1 is
//      `giantRegimeOf(condition)` as a sibling of `compositionClass` in src/worldengine/base/e1Regime.js.
//      MEASURED BOTH WAYS, on disk, against this file as it now stands:
//        · IDIOMATIC form — a single parameter `cv`, reading `cv.<field> ?? default`, which is the
//          shape of ALL FOUR of that file's existing condition readers (`compositionClass`,
//          `lidStrength`, `convectiveVigor`, `inSeededBand`): does NOT trip this fence. 52 passed (52).
//        · ANTI-IDIOMATIC form — the same function, byte-for-byte, with its parameter renamed `fp`:
//          TRIPS it. 9 failed | 43 passed (52). The rename is the entire difference.
//      `fp` occurs in e1Regime.js exactly once today, at :89, inside a comment and on a different
//      field (`fp.massEarth`), so the idiomatic-author path does not run through it.
//      VERDICT: the bypass exists and it is ADVERSARIAL, not accidental. Under §11.9 that is a named
//      limit, not a blocker. ⛔ Promote to blocking the day any src/worldengine module starts naming a
//      condition parameter after the preset it came from.
//
// #3 — STEP 4 MUST BUDGET FOR THIS FENCE BITING, and that is the gate working, not a defect.
//      If Step 4 feeds `giantRegimeOf` a condition derived at `_fp.radiusEarth` — the idiomatic
//      "classifier reads canonical" call site, which is exactly what the giantDynamo allowlist entry
//      above argues FOR — this fence goes RED and the file-keyed allowlist means the lab's existing
//      exemption will NOT cover it. Step 4 then needs either its own allowlist entry carrying its own
//      measured proof, or a deliberate ruling. Measured so the cost is known in advance rather than
//      discovered in a red build: a `giantRegimeForPreset(_fp)` that calls
//      `giantRegimeOf(deriveConditionVector(_fp, null, _fp.radiusEarth))` in e1Regime.js reds this
//      file with 9 failures — the same count as the anti-idiomatic plant in #2, and unlike #2 this one
//      IS idiomatic, so it is a budgeted cost rather than a limit.
//      ⚠ THAT PROMISE WAS FALSE UNTIL 2026-08-08 IN THE ONE PLACE STEP 4 IS MOST LIKELY TO WRITE IT.
//      Written on world-engine-lab.html:4297 — a line that ALREADY IS a
//      `deriveConditionVector(_fp, deriveUniforms(_fp, tier), _fp.radiusEarth)` call, i.e. the nearest
//      existing example of the shape Step 4 wants to copy — the line-keyed skip forgave it: measured,
//      the DENY/allowlist test reported `1 passed | 51 skipped (52)` under that exact plant. Only one
//      unrelated AC-0 pin went red, and by an accident of concatenation, not by the fence working. The
//      scanner's column test is what makes this paragraph true; the standing plant below holds it true.
//
// #4 — ✅ CLOSED IN THE SAME COMMIT, and kept here because the limit it names is the general one.
//      This file WAS outside `CITE_SOURCES`, so every ref in it was hand-verified once and nothing
//      re-verified it. It and tests/radius-live-feed.test.js are now both in the list (§11.3.4 wants
//      every file a step edited), which moved `refs CHECKED` 160 → 171. (The step's tip reads 177; the
//      extra 6 came from the PLAN/CARRIED repairs in the two follow-up commits, not from the widening.
//      The 176 first written here was measured on a later tree than the commit it was attributed to —
//      the exact "measured elsewhere, recorded here" shape §11.3.4 exists to catch, found by round 1.)
//      ⚠ THE REMAINING LIMIT, WHICH IS THE ONE WORTH KNOWING: being IN `CITE_SOURCES` is not the same
//      as being GATED. A ref with no backticked symbol lands in UNCHECKED (hundreds of them — run the
//      tool for the count; an integer here would be born rotting, and the one that was here rotted by
//      7 within the same step) and fails nothing, and a symbol span WRAPPED ACROSS TWO SOURCE LINES
//      lands in TICK-PARITY, which also fails nothing — three refs in this file's own freshly-written
//      prose did exactly that and had to be un-wrapped. Prose wraps; citations must not. Ledger C12.

// ── the scanner ──────────────────────────────────────────────────────────────────────────────────
// Returns [{ file, line, text }] for every DENY hit NOT covered by the allowlist. Exported shape is
// deliberately data (not a boolean) so the negative controls below can assert on exactly what it
// caught, rather than on "it failed somehow". `file` is both reported AND used for allowlist keying.
//
// ⭐ THE SKIP IS KEYED ON THE MATCHED SPAN'S COLUMN, NOT ON THE LINE. FIXED 2026-08-08 after the
// adversarial round proved the line-keyed form silently forgave a co-located read. The old predicate
// was `allowlist.some((a) => a.file === file && text.includes(a.match))` — `text` is the whole SOURCE
// LINE, so a SECOND frozen read appended to an allowlisted line was exempt for free. MEASURED, five
// paired arms whose ONLY difference is line placement (payload byte-identical in each pair):
//   · `state.bandCount = Math.round(12 * (_fp.radiusEarth ?? 1) / _rotH);` appended to
//     world-engine-lab.html:4297 (the crater-boot line) ⇒ 52 passed (52) — FORGIVEN.
//     The same text on its OWN line one below ⇒ 1 failed | 51 passed (52).
//   · the same statement appended as a TRAILING `//` COMMENT ⇒ 52 passed (52) — and a commented-out
//     frozen read is precisely what the comment-INCLUSIVE DENY scan exists to report, so the line-keyed
//     skip voided that protection on every allowlisted line.
//   · ` const _giantR = fp.radiusEarth;` appended to src/worldengine/port/conditionFromPlanet.js:652
//     and ` const _bad = ...(_fp.radiusEarth ?? 1)...` appended to world-engine-lab.html:2585 ⇒ both
//     52 passed (52). ALL THREE allowlisted lines in the corpus exhibited it.
//   · `const _bad = _fp\n          .radiusEarth;` appended to :4297 — the match STARTS on the
//     allowlisted line ⇒ 52 passed (52), defeating the line-broken-chain capability claimed above.
// ⛔ AND IT WAS NOT AN ADVERSARIAL SHAPE. Parking a retired statement in a `//` comment beside its
// replacement is this codebase's own documented habit (tests/helpers/source-scan.mjs header), so under
// §11.9 the accidental path ran straight through it. The column test below closes the CLASS: an
// exemption covers the byte range of its own `match` and nothing else on the line.
function scanFrozenRadiusReads(src, allowlist = ALLOWLIST, file = LAB_REL) {
  const lines = src.split('\n');
  const offenders = [];
  for (const m of src.matchAll(denyScanner())) {   // fresh matcher ⇒ always starts at offset 0
    const line = lineOf(src, m.index);
    const text = lines[line - 1];
    const col = m.index - (src.lastIndexOf('\n', m.index - 1) + 1);   // column of the MATCH, 0-based
    const covered = allowlist.some((a) => {
      if (a.file !== file) return false;
      const k = text.indexOf(a.match);
      return k >= 0 && col >= k && col < k + a.match.length;          // inside the exempted SPAN
    });
    if (covered) continue;
    offenders.push({ file, line, text: text.trim() });
  }
  return offenders;
}

// Scan every corpus file. `overrides` maps a corpus-relative path to replacement TEXT, so a planted
// defect is constructed in memory and NEVER written to disk — the working tree stays clean on every
// run, including a run that fails.
function scanCorpus(overrides = new Map(), allowlist = ALLOWLIST) {
  const offenders = [];
  for (const rel of CORPUS_REL) {
    offenders.push(...scanFrozenRadiusReads(overrides.get(rel) ?? SRC.get(rel), allowlist, rel));
  }
  return offenders;
}

const rawHitsIn = (rel, text = SRC.get(rel)) => [...text.matchAll(denyScanner())];

describe('AC-NOFROZEN — no live quantity reads radius off a frozen preset', () => {
  it('the whole corpus has no un-allowlisted frozen radius read', () => {
    // CRITERION: exact empty set over all 44 files. Any hit is a site the radius slider cannot reach.
    expect(scanCorpus()).toEqual([]);
  });

  it('the scan is not vacuous — EVERY DECLARED CARRIER still holds a real frozen read', () => {
    // Guards the failure mode where the DENY regex silently stops matching (a rename, an encoding
    // change) — and, since the widening, the strictly worse one where it stops matching IN ONE FILE
    // while another file's hits keep the count above zero. See the REQUIRED_CARRIERS block for the
    // measured mutant that makes the corpus-wide form fail open.
    //
    // ⭐ THE FLOOR FIRST, BECAUSE THIS TEST CAN GO VACUOUS ITSELF. Measured 2026-08-08:
    // `const REQUIRED_CARRIERS = [];` left the whole file at `52 passed (52)` — this loop runs zero
    // assertions and reports green. And the instruction that empties it is this test's OWN failure
    // message, while PLAN §4 Steps 4 and 5 both declare they move lab code out. So the message now
    // demands a replacement carrier, and the floor makes an unreplaced one impossible to ship quietly.
    expect(REQUIRED_CARRIERS.length,
      'REQUIRED_CARRIERS is empty — this test would assert nothing and report green. A carrier that '
      + 'legitimately moved must be REPLACED by its new home, not simply removed.').toBeGreaterThanOrEqual(1);
    for (const rel of REQUIRED_CARRIERS) {
      const raw = rawHitsIn(rel);
      expect(raw.length, `carrier '${rel}' holds no DENY hit — the scan has gone vacuous THERE, `
        + 'even if other files keep the corpus-wide count non-zero. If the site legitimately moved, '
        + 'move this carrier out of REQUIRED_CARRIERS in the same commit, NAME ITS NEW HOME as a '
        + 'carrier in that same commit, and say where it went.')
        .toBeGreaterThanOrEqual(1);
    }
    // ⛔ THIS ASSERTION WAS VACUOUS UNTIL 2026-08-09 AND ITS COMMENT SAID THE OPPOSITE. It read
    // `expect(carrying.size).toBeGreaterThanOrEqual(REQUIRED_CARRIERS.length)` under a comment
    // claiming it "stops the list being trimmed". It cannot fire on a trim, and the reason is
    // arithmetic, not oversight: the loop three lines above already asserts every member of
    // REQUIRED_CARRIERS carries ≥1 raw hit, so `carrying` is a SUPERSET of the list by construction
    // and the count comparison holds automatically. Only a DUPLICATED entry could ever red it.
    // MEASURED: `const REQUIRED_CARRIERS = [LAB_REL];` — the adapter trimmed straight out — left this
    // file at **74 passed (74)**, fully green, with the guard silent. Meanwhile the sibling loop's own
    // failure message tells the author to "move this carrier out of REQUIRED_CARRIERS", which is
    // precisely the edit this guard existed to stop.
    // ⭐ IT IS THE FOURTH INSTANCE IN ONE STEP OF ONE CLASS — an assertion whose control is derived
    // from its own subject (ledger C10; `lineOf` comparing raw-vs-stripped; `jsFilesUnder` sorting its
    // own output and comparing it to itself; this). That recurrence is why `npm run test:mutation`
    // now exists: the class is closed by a machine, not by the next reviewer noticing.
    // SET EQUALITY, not a count floor. A carrier may now leave this list ONLY when the corpus genuinely
    // stops carrying it, and a site that legitimately moves forces its new home to be named here.
    const carrying = new Set(scanCorpus(new Map(), []).map((o) => o.file));
    expect([...carrying].sort(),
      'the set of DENY-carrying files is not the set REQUIRED_CARRIERS names — if a site moved, name '
      + 'its new home here in the same commit; do not trim the list to match a shrinking corpus')
      .toEqual([...new Set(REQUIRED_CARRIERS)].sort());
  });

  it('the walker ran and found a tree (a THRESHOLD, and only that)', () => {
    // ⚠ STATED SO IT IS NOT MISTAKEN FOR A CORPUS CHECK. Measured 2026-08-08 the corpus is 44 files
    // (42 .js under src/worldengine + the lab + the shader module), so `> 20` survives LOSING HALF THE
    // TREE. It proves the walker ran and returned something; it proves nothing about the corpus being
    // intact. The per-carrier assertion above is the check that has that property. The same warning is
    // written into tests/helpers/source-scan.mjs:305 `export function jsFilesUnder(root, rel) {`,
    // which points back here by name.
    expect(CORPUS_REL.length).toBeGreaterThan(20);
    expect(CORPUS_REL).toContain(LAB_REL);
    expect(CORPUS_REL).toContain(ADAPTER_REL);
  });

  it('every allowlist entry still matches a real line IN ITS OWN DECLARED FILE (no stale entries)', () => {
    // A stale allowlist entry is worse than none: it looks like a justified exemption while its site
    // no longer exists, and it would silently forgive a DIFFERENT future line that happens to contain
    // the same substring. CRITERION: each entry matches at least one line OF THE FILE IT DECLARES,
    // and that line is a DENY hit.
    for (const a of ALLOWLIST) {
      expect(a.file, `allowlist entry '${a.id}' declares no file`).toBeTruthy();
      expect(CORPUS_REL, `allowlist entry '${a.id}' declares file '${a.file}', which is not in the corpus`)
        .toContain(a.file);
      const hits = SRC.get(a.file).split('\n').filter((l) => l.includes(a.match));
      expect(hits.length, `allowlist entry '${a.id}' matches no line in ${a.file}`).toBeGreaterThanOrEqual(1);
      const denies = hits.filter((l) => DENY.test(l));   // DENY is non-global ⇒ no lastIndex state
      expect(denies.length, `allowlist entry '${a.id}' covers no frozen read — delete it`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every allowlist entry certifies LIVE code, not a comment (liveness)', () => {
    // ⭐ THE EXEMPTION-ROT CHECK. An allowlisted site that is MOVED OUT but left quoted in a comment
    // stays "covered" under the staleness test above — which is comment-inclusive like the DENY scan —
    // and the exemption silently becomes a certified comment: a permanent hole with a proof attached
    // to text that no longer runs. CRITERION: `match` must still occur in COMMENT-STRIPPED source of
    // its declared file.
    // ⚠ THIS IS THE OPPOSITE TREATMENT OF COMMENTS FROM THE DENY SCAN, ON PURPOSE. See the file header:
    // a commented-out frozen read must still be REPORTED (one uncomment from live), and a commented-out
    // exemption must NOT be HONOURED (an exemption may only certify live code). Both directions are
    // deliberate; harmonising them breaks one.
    // ⭐ AND IT ASSERTS ON THE LITERAL-BLANKED VIEW, NOT THE DEFAULT ONE. A comment is not the only
    // container for dead text. MEASURED 2026-08-08: the adapter's live line replaced by
    // `const condition = deriveConditionVector(fp, null, R_c);` plus the retired statement parked in a
    // backtick template left THIS TEST at `1 passed | 51 skipped (52)` — the exemption certified a
    // template literal. `{ blankLiteralText: true }` keeps the delimiters and blanks the interior, so
    // a `match` that survives it is outside every string, template and regex.
    // ⛔ WHAT "LIVE" MEANS HERE, STATED SO IT IS NOT OVERREAD: outside a comment AND outside a literal.
    // NOT "reachable" — a match inside `if (false) { … }` or a never-called function still counts.
    // Reachability needs a control-flow pass, which is the same C7 refusal KNOWN LIMIT #1 records.
    for (const a of ALLOWLIST) {
      // §11.3.3: the message must name the CAUSE it can actually distinguish. Round 1 caught this
      // asserting "only inside a comment" for a line that had vanished from the file entirely.
      const inRaw = SRC.get(a.file).includes(a.match);
      const inComments = STRIPPED.get(a.file).includes(a.match);
      const why = !inRaw ? 'it no longer occurs in that file at all'
        : !inComments ? 'it matches only inside a comment'
        : 'it matches only inside a string or template literal';
      expect(LIT_STRIPPED.get(a.file).includes(a.match),
        `allowlist entry '${a.id}' no longer matches LIVE code in ${a.file} — ${why}. Either the site `
        + 'moved (delete the entry and re-prove it at its new home) or it was retired (delete the '
        + 'entry). An exemption may not certify text that does not run.').toBe(true);
    }
  });

  it('INSTRUMENT CONTROL: the scanner has no cross-call regex state (the lastIndex bug, planted)', () => {
    // PLANTED DEFECT for the instrument itself. Before the 2026-07-25 fix, DENY was a single
    // module-level /g regex shared between `.test()` and `String.matchAll`. `.test()` leaves
    // lastIndex non-zero on a hit, and matchAll seeds its internal matcher FROM that lastIndex, so
    // every scan after the staleness test above began at byte offset 122 instead of 0.
    // CRITERION: an offender planted at the very START of the source must still be found AFTER the
    // exact `.test()` sequence that used to poison the state. With the old shared-/g scanner this
    // assertion fails (measured: first hit reported at 406062 instead of 4); with the fix it passes.
    for (const a of ALLOWLIST) for (const l of SRC.get(a.file).split('\n').filter((x) => x.includes(a.match))) DENY.test(l);
    const planted = '\n// _fp.radiusEarth — planted at the top of the file\n' + LAB;
    const offenders = scanFrozenRadiusReads(planted);
    expect(offenders.length).toBe(1);
    expect(offenders[0].line).toBe(2);                 // found at the TOP, not skipped past
  });

  it('every allowlist entry carries a stated proof and an evidence artifact THAT EXISTS', () => {
    // AC-NOFROZEN's observable: "the allowlist is non-empty only for sites whose canonical-radius
    // behaviour was PROVEN rather than assumed". This is the machine-checkable half of that.
    //
    // ⭐ TWO DEFECTS FIXED IN ONE EDIT, 2026-08-08, and they had to be fixed together.
    // (1) The pattern was /^docs\/WORKSTREAMS\/.+\.md$/, which REJECTS the adapter entry's only real
    //     evidence — the PLAN under docs/FEATURES/ — and there is no one-pipeline workstream directory
    //     to move it to (measured: 67 directories under docs/WORKSTREAMS/, none matching
    //     *one-pipeline*). So the shape rule as written forced either a fabricated path or no entry.
    // (2) The check validated path SHAPE ONLY and never opened the file: `existsSync` appeared ZERO
    //     times in this file, so any well-shaped string passed.
    // WHY THE EXISTENCE CHECK CANNOT BE DEFERRED TO A LATER PASS: widening the shape alone admits 106
    // more files (measured — 278 .md under docs/WORKSTREAMS, 106 under docs/FEATURES, 384 in the
    // union: +38%). The shape check LOSES discrimination by exactly the amount the widening gains
    // coverage, so shipping the widening without the existence check would trade a rule that rejects
    // the truth for a rule that accepts almost anything.
    // ⭐ A THIRD DEFECT, FOUND BY ROUND 1 AND CLOSED HERE: `existsSync` restored EXISTENCE, not
    // RELEVANCE — and the widening admits 384 files. MEASURED 2026-08-08: rewriting all three
    // `evidence:` values to docs/FEATURES/planet-lod-CHARTER.md (a real 9198-byte file whose
    // `grep -ci "radiusEarth\|craterRelevance\|giantDynamo\|one game radius"` is 0) left the file at
    // `52 passed (52)`. So the artifact must now PROVE IT IS ABOUT THE SITE by containing the entry's
    // `anchor`. Per §11.2 that closes the class, not the instance: any future entry pointed at a
    // plausible-but-unrelated document reds here rather than passing on its path shape.
    for (const a of ALLOWLIST) {
      expect(a.why, `allowlist entry '${a.id}' has no stated reason`).toBeTruthy();
      expect(a.why.length).toBeGreaterThan(40);              // a sentence, not a shrug
      expect(a.evidence, `allowlist entry '${a.id}' evidence path is malformed`)
        .toMatch(/^docs\/(WORKSTREAMS|FEATURES)\/.+\.md$/);
      expect(existsSync(join(ROOT, a.evidence)),
        `allowlist entry '${a.id}' points at '${a.evidence}', which does not exist`).toBe(true);
      expect(a.anchor, `allowlist entry '${a.id}' declares no evidence anchor`).toBeTruthy();
      expect(a.anchor.length, `allowlist entry '${a.id}' anchor is too short to discriminate`)
        .toBeGreaterThan(20);
      expect(readFileSync(join(ROOT, a.evidence), 'utf8').includes(a.anchor),
        `allowlist entry '${a.id}' points at '${a.evidence}', which never mentions '${a.anchor}' — `
        + 'the artifact exists but is not evidence FOR THIS SITE. Cite the document that carries the '
        + 'measurement, and anchor on a string it actually contains.').toBe(true);
    }
  });
});

describe('AC-NOFROZEN — MANDATORY NEGATIVE CHECK: the fence catches a re-frozen site', () => {
  // A fence that passes on a broken build is worse than no fence. These are PLANTED DEFECTS run on
  // every invocation: each takes the REAL current source, re-freezes one rewired site by string
  // substitution IN MEMORY, and asserts the scanner reports it. Break ⇒ FAIL, restore ⇒ PASS,
  // in-process. Nothing is ever written to disk.
  const PLANTED = [
    {
      id: 'bandCount (F25 jet stripe ladder)',
      live: 'Math.round(12 * (state.planetRadiusEarth ?? 1) / _rotH)',
      frozen: 'Math.round(12 * (_fp.radiusEarth ?? 1) / _rotH)',
    },
    {
      id: 'cloud regime gate (< 6 RE)',
      live: '_gas && (state.planetRadiusEarth ?? 1) < 6',
      frozen: '_gas && (_fp.radiusEarth ?? 1) < 6',
    },
    // NOTE: the giant-dynamo gate is deliberately ABSENT from this planted-defect list. It is an
    // allowlisted COMPOSITION CLASSIFIER that correctly reads the canonical radius (see the ALLOWLIST
    // entry 'giantDynamo-compositionClassifier' for the derivation and the identical-draw proof), so
    // "re-freezing" it is not a defect — it is the specified behaviour. Its inverse defect (someone
    // re-pointing it at the drawn radius, which provably destroys the Neptunian/Sub-Neptune
    // discrimination) is caught instead by the AC-0 source pin below and by the aurora assertions in
    // tests/radius-live-feed.test.js -> "AT THE RADIUS THE LAB ACTUALLY DRAWS".
    {
      id: 'E5 Rhines band driver',
      live: 'radius: (_gcond.radiusEarth ?? 1) / 11.2',
      frozen: 'radius: (_fp.radiusEarth ?? 1) / 11.2',
    },
    {
      id: 'storm-vortex driver',
      live: 'radius: (_scond.radiusEarth ?? 1) / 11.2',
      frozen: 'radius: (_fp.radiusEarth ?? 1) / 11.2',
    },
    {
      // ADDED 2026-07-25 (lens round): the bare-`fp` alias. buildBodyDrivers(u, fp) derives the
      // body-driver condition vector — the same class of site as the two the rewire fixed — and it
      // already reads fp.T_eq / fp.age, so a re-freeze here is a live drift path, not a hypothetical.
      id: 'buildBodyDrivers condition vector via the bare `fp` alias',
      live: 'const _cond = deriveConditionVector(fp, u, state.planetRadiusEarth);',
      frozen: 'const _cond = deriveConditionVector(fp, u, fp.radiusEarth);',
    },
    {
      id: 'crater boot via a DRIVER_PRESETS subscript (the other frozen spelling)',
      live: 'deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth))',
      frozen: 'deriveUniforms(_fp, driverUI.qualityTier), DRIVER_PRESETS[preset].radiusEarth))',
      // ⚠ THIS CASE CHANGED VERDICT ON 2026-08-08, and the new verdict is the correct one. It used to
      // be marked `stillAllowlisted` because the exemption keyed on the `craterRelevanceOf(` prefix,
      // so re-spelling the read further along the same line kept its blessing. Now that `match` IS the
      // exempted byte span, re-spelling the read means the span no longer occurs — so the site loses
      // its exemption and is REPORTED. An exemption whose proof is a sweep of `_fp.radiusEarth` should
      // not silently transfer to a `DRIVER_PRESETS[preset].radiusEarth` written in its place; the
      // author re-states the entry, which is the whole point of an allowlist.
      // It still proves what it was originally added to prove — that DENY covers the subscript
      // spelling at all — via the un-allowlisted scan asserted for every case below.
    },
  ];

  for (const d of PLANTED) {
    it(`re-freezing ${d.id} is caught (planted defect ⇒ fence FAILS)`, () => {
      expect(LAB.includes(d.live), `live form not found — source drifted: ${d.live}`).toBe(true);
      const broken = LAB.replace(d.live, d.frozen);
      expect(broken).not.toBe(LAB);                                   // the plant actually landed
      const offenders = scanFrozenRadiusReads(broken);
      expect(offenders.length, `fence did not catch the re-frozen ${d.id}`).toBeGreaterThanOrEqual(1);
      // The DENY pattern itself must have done the catching, not some downstream pin: assert the plant
      // is a raw hit with the allowlist removed entirely. (This is what the retired `stillAllowlisted`
      // branch used to be the only assertion for; it now runs for every case.)
      expect(scanFrozenRadiusReads(broken, [])).not.toEqual([]);
      // …and the UNMODIFIED corpus is still clean, i.e. restore ⇒ PASS.
      expect(scanCorpus()).toEqual([]);
    });
  }
});

describe('AC-NOFROZEN — THE THIRD GATE CLAUSE: a violation planted in src/worldengine/** is caught there too', () => {
  // PLAN §4 Step 3's gate, third sentence (PLAN.md:230 "Plant a deliberate violation in a
  // `src/worldengine/**` file → the fence must catch it there too"). Standing, in-process, every run —
  // not a one-off performed once during the step and then trusted. Same discipline as the lab plants
  // above: take the REAL current source, substitute in memory, assert, and assert the unmodified
  // corpus is still clean. NOTHING IS WRITTEN TO DISK.
  const WE_PLANT_REL = 'src/worldengine/base/e1Regime.js';

  it('a frozen `_fp.radiusEarth` read planted in src/worldengine/** is REPORTED, with its file', () => {
    // The plant re-freezes a genuinely live radius read inside `convectiveVigor` — the same defect
    // shape the lab had, transplanted into the tree Steps 4 and 5 move lab code INTO.
    const live = 'const age = cv.age ?? 4.5, mass = massEarthOf(cv), d = cv.radiusEarth ?? 1.0;';
    const frozen = 'const age = cv.age ?? 4.5, mass = massEarthOf(cv), d = _fp.radiusEarth ?? 1.0;';
    const src = SRC.get(WE_PLANT_REL);
    expect(src, `${WE_PLANT_REL} is not in the corpus`).toBeTruthy();
    expect(src.includes(live), `live form not found — source drifted: ${live}`).toBe(true);
    const offenders = scanCorpus(new Map([[WE_PLANT_REL, src.replace(live, frozen)]]));
    expect(offenders.length).toBe(1);
    expect(offenders[0].file).toBe(WE_PLANT_REL);   // reported AT its file, not swallowed by the lab's
    expect(scanCorpus()).toEqual([]);               // restore ⇒ PASS
  });

  it("a LAB-proven exemption does NOT travel: the crater-boot call shape planted in src/worldengine/** is REPORTED", () => {
    // ⭐ THE FILE-KEYED-ALLOWLIST CONTROL. Steps 4 and 5 move lab code into src/worldengine carrying
    // these call shapes with them. Under the pre-Step-3 file-blind matcher this plant produced 1 raw
    // DENY hit and 0 offenders — the crater-boot exemption, whose proof is an 18×401 sweep of the
    // LAB'S slider, silently forgiving a src/worldengine read nobody ever measured.
    // ⚠ STATED EXACTLY, because the naive fence was not wholly green and it would be easy to overclaim:
    // the DENY/allowlist test itself PASSED under that plant (measured, run isolated: 1 passed | 40
    // skipped). What went red was one unrelated AC-0 pin — "the crater-boot site is the ONLY
    // deriveConditionVector call still fed a canonical radius" — and only because the naive widening
    // glues all 44 files into ONE string, so a src/worldengine match counted toward a claim about the
    // lab. That is an accident of concatenation, not the fence working: it names no file, and it fires
    // only for a plant that happens to spell `deriveConditionVector`. The exemption machinery forgave
    // the read, which is what this test now stops.
    // ⚠ THE PLANT IS THE ALLOWLISTED SPAN VERBATIM, 2026-08-08. It used to spell `tier` where the lab
    // writes `driverUI.qualityTier`, so once `match` became the exempted BYTE SPAN the plant would have
    // failed to match the entry for TWO reasons and the test would have passed without exercising the
    // `file` key at all — the property it exists to hold. Building it from `ALLOWLIST[…].match` means
    // the ONLY thing standing between this plant and an exemption is the file check.
    const craterMatch = ALLOWLIST.find((x) => x.id === 'craterboot-worldDefaultEnableSet').match;
    const live = 'export function convectiveVigor(cv) {';
    const frozen = 'export function convectiveVigor(cv) {\n  const _boot = ' + craterMatch + ';';
    const src = SRC.get(WE_PLANT_REL);
    expect(src.includes(live), `live form not found — source drifted: ${live}`).toBe(true);
    const mutated = src.replace(live, frozen);
    // The plant IS a real DENY hit — establish that before claiming the fence caught it, otherwise a
    // pattern that stopped matching would read as a pass.
    expect(rawHitsIn(WE_PLANT_REL, mutated).length).toBe(1);
    const offenders = scanCorpus(new Map([[WE_PLANT_REL, mutated]]));
    expect(offenders.length,
      'the crater-boot exemption forgave a src/worldengine read — the allowlist is matching on the '
      + 'substring alone and has lost its `file` key').toBe(1);
    expect(offenders[0].file).toBe(WE_PLANT_REL);
    expect(scanCorpus()).toEqual([]);               // restore ⇒ PASS
  });

  it('an allowlisted site demoted to a COMMENT stops being covered (exemption liveness, planted)', () => {
    // ⭐ THE LIVENESS CONTROL. Comment out the adapter's allowlisted line — the shape of "the law moved
    // and somebody left the old statement quoted above it", which is this codebase's own habit
    // (tests/helpers/source-scan.mjs header, e.g. world-engine-lab.html:6250-6161). Under the staleness
    // test alone the entry still "matches a real line" and the exemption survives forever.
    // ⚠ IT ASSERTS THE PREDICATE, NOT A TALLY, AND THAT IS A REPAIR. Round 1 showed this control going
    // red for the WRONG REASON on an unrelated mutant: with the live line already gone, `src.replace`
    // landed its `// ` inside a string literal, where it is not a comment at all, and the assertion
    // failed on a state it was not testing. Building the mutant from the LINE the match sits on, and
    // asserting the same predicate the liveness test uses, removes the coincidence.
    const a = ALLOWLIST.find((x) => x.id === 'adapter-oneGameRadius');
    const src = SRC.get(a.file);
    const line = src.split('\n').find((l) => l.includes(a.match));
    expect(line, 'the adapter site is gone — this control has no subject').toBeTruthy();
    const commented = src.replace(line, `// ${line}`);
    expect(commented).not.toBe(src);
    // Comment-inclusive staleness: still "covered". This is the state that used to be undetectable.
    expect(commented.split('\n').some((l) => l.includes(a.match))).toBe(true);
    // Comment-blind liveness: NOT covered. This is the assertion that catches it.
    expect(strippedCode(commented).includes(a.match)).toBe(false);
    // And the real file is live, i.e. restore ⇒ PASS.
    expect(LIT_STRIPPED.get(a.file).includes(a.match)).toBe(true);
  });

  it('an allowlisted site RE-QUOTED INSIDE A LITERAL stops being covered (exemption liveness, planted)', () => {
    // ⭐ THE SECOND COFFIN. A comment is not the only container for retired code; a template literal
    // and a quoted string hold it just as well, and the DEFAULT stripper preserves literal interiors by
    // design (its output is handed to `new Function` and must still compile).
    // MEASURED BEFORE THE FIX, both arms: the adapter's live line replaced by a `R_c` third argument
    // with the retired statement parked in a backtick template ⇒ the liveness test reported
    // `1 passed | 51 skipped (52)`; the same with a single-quoted string ⇒ likewise. The exemption
    // certified dead text in both. Asserted here on BOTH literal kinds, because they are lexed by
    // different branches of the state machine and closing one does not close the other.
    const a = ALLOWLIST.find((x) => x.id === 'adapter-oneGameRadius');
    const src = SRC.get(a.file);
    const line = src.split('\n').find((l) => l.includes(a.match));
    for (const [kind, parked] of [
      ['template literal', '  const _RETIRED = `' + a.match + '`;'],
      ['quoted string', "  const _RETIRED = '" + a.match + "';"],
    ]) {
      const moved = src.replace(line, '  const condition = deriveConditionVector(fp, null, R_c);\n' + parked);
      expect(moved, `${kind} mutant did not land`).not.toBe(src);
      // The DEFAULT (literal-preserving) view still finds it — this is exactly the silent green.
      expect(stripCommentsPreservingOffsets(moved).includes(a.match),
        `${kind}: the comment-blind view cannot see the difference — that is why it is not the gate`).toBe(true);
      // The literal-blanked view does not. This is the assertion that catches it.
      expect(strippedCode(moved).includes(a.match),
        `${kind}: an exemption may not certify text parked inside a literal`).toBe(false);
    }
    expect(LIT_STRIPPED.get(a.file).includes(a.match)).toBe(true);   // restore ⇒ PASS
  });

});

describe('AC-NOFROZEN — THE FOURTH GATE CLAUSE: an exemption covers ONE SPAN, not a whole line', () => {
  // ⭐ THE ROUND-1 BLOCKER, HELD OPEN AS A STANDING CONTROL. Every arm below was GREEN before the
  // scanner's column test landed — the fence forgave a real frozen read because it happened to share a
  // source line with an allowlisted one. See the scanner's own header for the five paired measurements.
  // These run against the REAL current source, in memory, on every invocation.
  const SITES = [
    { rel: LAB_REL,     line: "if (_fp && craterRelevanceOf(deriveConditionVector(_fp, deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth)) > 0) set.add('craters');" },
    { rel: LAB_REL,     line: 'const _giantDynamo = _gas && (_fp.radiusEarth ?? 1) >= 3.5;' },
    { rel: ADAPTER_REL, line: 'const condition = deriveConditionVector(fp, null, fp.radiusEarth);' },
  ];
  // Each payload is a REAL frozen read that no allowlist entry covers. `stillReads` is asserted so a
  // payload that stopped being a DENY hit cannot pass as "the fence caught nothing to catch".
  const PAYLOADS = [
    ['a second LIVE frozen read', ' state.bandCount = Math.round(12 * (_fp.radiusEarth ?? 1) / _rotH);'],
    ['a COMMENTED-OUT frozen read', ' // was: state.bandCount = Math.round(12 * (_fp.radiusEarth ?? 1) / _rotH);'],
    ['a LINE-BROKEN member chain starting on the allowlisted line', ' const _bad = _fp\n          .radiusEarth;'],
    ['PLAN §4 Step 4\'s own declared first move', ' const _gr = giantRegimeOf(deriveConditionVector(_fp, deriveUniforms(_fp, driverUI.qualityTier), _fp.radiusEarth));'],
  ];

  for (const site of SITES) {
    for (const [label, payload] of PAYLOADS) {
      it(`${label}, appended to the allowlisted line in ${site.rel}, is REPORTED`, () => {
        const src = SRC.get(site.rel);
        const full = src.split('\n').find((l) => l.includes(site.line));
        expect(full, `allowlisted line not found — source drifted: ${site.line}`).toBeTruthy();
        const broken = src.replace(full, full + payload);
        expect(broken).not.toBe(src);
        // The payload must itself be a DENY hit, or this test proves nothing about the skip logic.
        expect(rawHitsIn(site.rel, broken).length,
          'the payload is not a DENY hit — this control has no subject')
          .toBeGreaterThan(rawHitsIn(site.rel).length);
        const offenders = scanFrozenRadiusReads(broken, ALLOWLIST, site.rel);
        expect(offenders.length,
          'a frozen read sharing a line with an allowlisted one was FORGIVEN — the skip has gone back '
          + 'to keying on the source LINE instead of the matched SPAN').toBeGreaterThanOrEqual(1);
        expect(offenders[0].file).toBe(site.rel);
        expect(scanCorpus()).toEqual([]);            // restore ⇒ PASS
      });
    }
  }

  it('the allowlisted read ITSELF is still exempt — the span fix did not just ban the line', () => {
    // §11.3.3's other half: a control that only ever goes one way proves nothing. If the column test
    // were wrong in the opposite direction every allowlisted site would red, and the whole-corpus
    // assertion would be doing the work. Assert the exemption still holds, per site.
    for (const site of SITES) {
      const src = SRC.get(site.rel);
      expect(rawHitsIn(site.rel).length, `${site.rel} carries no DENY hit`).toBeGreaterThanOrEqual(1);
      expect(scanFrozenRadiusReads(src, ALLOWLIST, site.rel), `${site.rel} is no longer exempt`).toEqual([]);
    }
  });
});

describe('AC-NOFROZEN — DENY-pattern precision (it must not ban the live sources)', () => {
  // A deny pattern that also matched the correct code would force the fence to be disabled. These
  // pin the exact boundary: what counts as frozen, and what must never be mistaken for it.
  const MUST_MATCH = [
    '_fp.radiusEarth',
    '_fp?.radiusEarth',
    '(_fp.radiusEarth ?? 1)',
    'DRIVER_PRESETS[driverUI.preset].radiusEarth',
    'DRIVER_PRESETS[preset].radiusEarth',
    "DRIVER_PRESETS['Gas giant (Jovian)'].radiusEarth",
    'DRIVER_PRESETS[p]\n        .radiusEarth',     // line-broken member chain
    'fp.radiusEarth',                              // the bare alias (buildBodyDrivers / resetDriverOverrides)
    'fp?.radiusEarth',
    'deriveConditionVector(fp, u, fp.radiusEarth)',
    'bundle.fp.radiusEarth',                       // the alias reached through a property chain
    'preset.radiusEarth',                          // the FOURTH alias — live at driver-presets.js:325
    'const canonical = preset.radiusEarth ?? 1.0;',
    '_fp.radiusEarthCanonical',                    // ⭐ the deliberate over-match: a canonical read off
    'fp.radiusEarthCanonical',                     //   a FROZEN preset is still a frozen read. See the
                                                   //   no-trailing-`\b` note on DENY_SRC. Fail-closed:
                                                   //   this can red for a legitimate Step-4/5 move, and
                                                   //   that move then argues its case like any other.
  ];
  const MUST_NOT_MATCH = [
    'preset.massEarth',                            // the fourth alias on a DIFFERENT field
    'presetName.radiusEarth',                      // `preset` inside a longer identifier — no boundary
    'DRIVER_PRESETS[driverUI.preset]',             // the subscript with no member read after it
    'state.planetRadiusEarth',
    '(state.planetRadiusEarth ?? 1)',
    '_gcond.radiusEarth',
    '_scond.radiusEarth',
    '_bodyDrivers.condition.radiusEarth',
    'o.radiusEarth != null ? +o.radiusEarth : state.planetRadiusEarth',
    'sample.radiusEarth',
    'moons: [{ orbitRadiusEarth: 9.0, radiusEarth: 1 }]',   // object-literal key, not a read
    'radiusEarth: state.planetRadiusEarth,',
    '_fp.massEarth',                                        // a different frozen field — out of scope
    'gfp.radiusEarth',                                      // `fp` inside a longer identifier — no word boundary
    'fp.T_eq',                                              // the alias on a DIFFERENT field — out of scope
    'cv.radiusEarth ?? 1.0',                                // e1Regime's own idiom — the condition vector
  ];

  for (const s of MUST_MATCH) {
    it(`matches frozen form: ${JSON.stringify(s)}`, () => {
      expect(DENY.test(s)).toBe(true);                      // DENY is non-global ⇒ no lastIndex to reset
    });
  }
  for (const s of MUST_NOT_MATCH) {
    it(`does NOT match live/irrelevant form: ${JSON.stringify(s)}`, () => {
      expect(DENY.test(s)).toBe(false);
    });
  }
});

describe('AC-0 — the rewired sites are NAMED consumers of the live driver (source pins)', () => {
  // Spine conformance (Rule 15): each rewired consumer must be visibly wired to the driver it now
  // reads. These are the positive half of the fence — the negative half only proves the OLD feed is
  // gone, not that the NEW one is present.
  //
  // ⚠ ALL PINS RUN AGAINST `LAB_CODE`, THE COMMENT- AND LITERAL-STRIPPED LAB — never against raw
  // source. A pin satisfied by a comment would let the block it pins be deleted as long as somebody
  // quoted it on the way out, which is the exact mutant tests/helpers/source-scan.mjs was built for.
  // ⭐ AND `LAB_LIVE` WAS NOT ENOUGH, MEASURED 2026-08-08 (adversarial round 1): the default stripper
  // preserves literal INTERIORS by design, so deleting the aurora tail outright — the whole statement
  // `state.auroraRingWidth = Math.max(0.07, 0.15 - _mag * 0.08);` — and re-quoting it as a
  // single-quoted string with a "moved to giantDeck.js" note beside it
  // left the whole file at `52 passed (52)`. A single quote is as good a coffin as a comment. The pins
  // therefore assert on the `{ blankLiteralText: true }` pass, which blanks literal interiors while
  // keeping the delimiters and every byte offset. The one deliberate raw-source exception is marked at
  // its own site below and explains itself.
  //
  // ⭐ EVERY POSITIVE PIN READS `PIN_VIEW`, AND THAT INDIRECTION IS A GATE, NOT A STYLE CHOICE. If the
  // loops below named `LAB_CODE` directly, repointing them at the weaker `LAB_LIVE` would be a
  // two-character edit that no test could see — the pins would still pass on clean source, and the
  // literal-parking hole would silently reopen. Routing them through one binding lets the standing
  // control at the end of this block assert what that binding IS.
  const PIN_VIEW = LAB_CODE;
  const PINS = [
    // site, expected live expression, the driver it now names
    ['E5 Rhines band bake (rebakeE5Bands)', /radius:\s*\(_gcond\.radiusEarth\s*\?\?\s*1\)\s*\/\s*11\.2/],
    ['storm/vortex bake (applyStormState)', /radius:\s*\(_scond\.radiusEarth\s*\?\?\s*1\)\s*\/\s*11\.2/],
    ['F25 jet stripe ladder (state.bandCount)', /state\.bandCount\s*=\s*Math\.min\(16,\s*Math\.max\(3,\s*Math\.round\(12\s*\*\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*\/\s*_rotH\)\)\)/],
    ['cloud regime gate', /_gas\s*&&\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*<\s*6/],
  ];
  for (const [name, re] of PINS) {
    it(`${name} reads the drawn radius`, () => expect(PIN_VIEW).toMatch(re));
  }

  // ── THE FOUR BLIND BLOCKS ──────────────────────────────────────────────────────────────────────
  // ⭐ ADDED 2026-08-08. PLAN §4 Step 3's own gate says "Temporarily delete one extracted block →
  // BOTH files must FAIL." MEASURED, and it was FALSE TODAY for 4 of the 8 blocks the two suites
  // extract: deleting `const _gas`, `const _rotH`, the aurora tail, or the `radiusSeed:` line reds the
  // extraction suite and left THIS FENCE at 41/41 GREEN — so "both files must FAIL" was half true and
  // read as fully true.
  // ⛔ AND THE WIDENING CLOSES NONE OF THEM. The widening changes which FILES the DENY scan reads; it
  // does not change WHAT it looks for, and none of these four blocks contains a frozen read. Anyone
  // who assumed the widening covered the gate's first clause would have shipped it still half true.
  // These pins are what make it true for all 8.
  //
  // ⚠ THE `_gas` PIN IS THE ONE PIN WHOSE SUBJECT CONTAINS A STRING LITERAL, so it is the one pin that
  // cannot be asserted whole on the literal-blanked view — `'h2-he'` comes back as `'     '`, five
  // blanks between surviving quotes. Splitting it is not a weakening: the STRUCTURE (that this is a
  // live `const _gas = (_fp.atmosphere?.composition === '…')` statement, not text inside a template)
  // is asserted on the blanked view, and the VALUE `'h2-he'` is asserted on the comment-stripped view
  // in the same test. Neither half alone is the property; both together are.
  // ⛔ WHAT THESE PINS DO NOT SAY, WRITTEN WHERE THEY SAY IT (PLAN §11.9). "Matches on `PIN_VIEW`"
  // means the text is outside every comment and every literal. It does NOT mean the text RUNS. Round
  // 2 of §11.4 executed both remaining containers, with the live `const _rotH` line replaced by
  // `let _rotH = 24;` so the law was genuinely dead: the statement parked in RAW HTML MARKUP (a
  // `<pre hidden>` before `<body>` — neither comment nor literal, and the corpus's principal file is
  // an .html file) and the statement wrapped in a NEVER-CALLED FUNCTION each left all three suites at
  // **175 passed (175)**. The `_rotH` pin below, added so "both files must FAIL" would hold, was
  // satisfied by markup. Named rather than closed because both are adversarial: measured 2026-08-09,
  // `grep -nE '<(pre|textarea|template|noscript|xmp)\b' world-engine-lab.html` returns nothing and the
  // lab's HTML surface is six lines before one `<script type="module">`, whereas re-quoting a law in a
  // comment or a template is a habit with 7 instances. Reachability needs the control-flow pass
  // KNOWN LIMIT #1 refuses; markup could be closed by blanking outside `<script>` on `.html` members.
  const BLIND_BLOCK_PINS = [
    ['`const _gas` (composition gate, feeds cloud regime + giant dynamo)',
      /const\s+_gas\s*=\s*\(_fp\.atmosphere\?\.composition\s*===\s*'[^']*'\)/,
      /const\s+_gas\s*=\s*\(_fp\.atmosphere\?\.composition\s*===\s*'h2-he'\)/],
    ['`const _rotH` (rotation hours, the bandCount divisor)',
      /const\s+_rotH\s*=\s*state\.rotationHours\s*\?\?\s*_fp\.rotationHours\s*\?\?\s*24/],
    ['the aurora tail (`state.auroraRingWidth =`, the last statement of the extracted aurora block)',
      /state\.auroraRingWidth\s*=\s*Math\.max\(/],
    ['the boot `radiusSeed:` draw seed', /radiusSeed:\s*1\s*,/],
  ];
  for (const [name, re, valueRe] of BLIND_BLOCK_PINS) {
    it(`${name} is present in LIVE lab source`, () => {
      expect(PIN_VIEW).toMatch(re);                       // it is CODE — not a comment, not a literal
      if (valueRe) expect(LAB_LIVE).toMatch(valueRe);     // …and the literal it carries is unchanged
    });
  }

  it('a pinned block RE-QUOTED INSIDE A LITERAL stops satisfying its pin (pin liveness, planted)', () => {
    // ⭐ THE CONTROL FOR THE VIEW ITSELF, and it is the mutant round 1 actually walked through:
    // `state.auroraRingWidth = Math.max(0.07, 0.15 - _mag * 0.08);` (world-engine-lab.html:2589) DELETED
    // outright and re-quoted as `const _movedNote = '…';  // moved to giantDeck.js`. MEASURED before
    // the fix: `52 passed (52)`. The pin whose entire job is to catch that deletion was satisfied by a
    // pair of quote marks — the same hole the comment rule closed, wearing a different container.
    // The regex is TAKEN FROM `BLIND_BLOCK_PINS` rather than re-typed, so a pin that is reworded
    // cannot leave this control testing a string nothing pins any more.
    const entry = BLIND_BLOCK_PINS.find(([n]) => n.includes('aurora tail'));
    expect(entry, 'the aurora-tail pin is gone — this control has no subject').toBeTruthy();
    const auroraRe = entry[1];
    const tail = 'state.auroraRingWidth = Math.max(0.07, 0.15 - _mag * 0.08);';
    expect(LAB.includes(tail), `live form not found — source drifted: ${tail}`).toBe(true);
    const moved = LAB.replace(tail, `const _movedNote = '${tail}';  // moved to giantDeck.js`);
    // The comment-only view cannot tell the difference — that is precisely why it is not the pin view.
    expect(stripCommentsPreservingOffsets(moved)).toMatch(auroraRe);
    expect(strippedCode(moved)).not.toMatch(auroraRe);
    // ⛔ AND THE WIRING, which is the half a mutant cannot reach: the pins must actually READ that
    // stricter view. `PIN_VIEW` is the single binding all the loops above go through, so repointing
    // them at `LAB_LIVE` reds here instead of passing quietly.
    expect(PIN_VIEW, 'the AC-0 pins are no longer reading the literal-blanked view')
      .toBe(strippedCode(LAB));
    expect(PIN_VIEW).toMatch(auroraRe);                   // restore ⇒ PASS
  });

  it('the `// AC5` comment on the radiusSeed line is present in RAW source (DOCUMENTATION, not an extractor dependency)', () => {
    // ⚠ THE ONE DELIBERATE RAW-SOURCE PIN IN THIS BLOCK, and it is pinning a COMMENT on purpose.
    // ⭐ ITS RATIONALE WAS REWRITTEN 2026-08-08 BECAUSE THE ORIGINAL WAS FALSIFIED BY THE COMMIT THAT
    // WROTE IT. This pin used to justify itself with "the anchor it keys on IS the trailing comment"
    // and "Deleting just the comment would silently break that extraction". Both were untrue the
    // moment they were written: the SAME commit narrowed the extraction to
    // tests/radius-live-feed.test.js `const BOOT_SEED = Number(extract(/radiusSeed:\s*(\d+)\s*,/, 'boot radiusSeed'));`
    // — cited SYMBOL-ONLY, per PLAN §10, because that file is being edited alongside this one and a
    // line number written here is born with a half-life of one commit (it rotted 234 → 300 inside this
    // very session) —
    // comment-BLIND, because the sibling suite moved to comment-stripped source and the old pattern
    // matched ZERO times there. VERIFIED BY MUTANT: deleting ONLY the trailing comment from
    // world-engine-lab.html left tests/radius-live-feed.test.js at `50 passed (50)`. The extraction was
    // not broken. A gate whose stated subject does not exist is §11.1's D clause — the subject sits
    // outside the watched set — so the prose had to move to what the pin actually holds.
    //
    // WHAT IT ACTUALLY HOLDS, AND WHY IT IS STILL WORTH HOLDING: the extraction's specificity now
    // rests on corpus-wide uniqueness (`radiusSeed:\s*(\d+)\s*,` matches exactly once across all 44
    // corpus files), so nothing mechanical depends on the comment any more. That makes THIS PIN THE
    // ONLY THING protecting it, and what it protects is documentary: `// AC5 seeded-radius draw seed`
    // is the one place in the tree that says what the integer `1` on that line MEANS and that rerolling
    // redraws the archetype-range radius. Delete it and the next reader sees a bare `radiusSeed: 1,`.
    // ⛔ The claim that this "can only ever be the SECOND of two, never the only one" is also retired.
    // It is the only pin on the comment. The VALUE half of the line is separately pinned against
    // PIN_VIEW above (`radiusSeed:\s*1\s*,`), so moving the whole line into a comment still reds the
    // fence — but that is a different subject, and it does not make this pin a second of two.
    expect(LAB).toMatch(/radiusSeed:\s*\d+\s*,\s*\/\/\s*AC5 seeded-radius draw seed/);
  });

  // The INVERSE pin. The giant-dynamo gate must keep reading the CANONICAL radius: it classifies
  // interior composition, and Neptunian/Sub-Neptune draw bit-identical radii at every seed, so a
  // drawn-radius discriminator cannot separate them (ALLOWLIST 'giantDynamo-compositionClassifier').
  // This asserts BOTH directions so the site cannot drift either way unnoticed.
  // ⚠ THE POSITIVE AND THE NEGATIVE READ DIFFERENT VIEWS, AND THE ASYMMETRY IS THE POINT. A POSITIVE
  // pin wants the STRICTEST view (PIN_VIEW — a match there cannot be a comment or a literal). A
  // NEGATIVE pin wants the most PERMISSIVE one it can honestly use (LAB_LIVE — literals preserved), so
  // that a drifted form hiding in a literal still trips it. Swapping them silently weakens both.
  it('giant dynamo gate reads the CANONICAL radius (composition classifier, not a physics input)', () => {
    expect(PIN_VIEW).toMatch(/_giantDynamo\s*=\s*_gas\s*&&\s*\(_fp\.radiusEarth\s*\?\?\s*1\)\s*>=\s*3\.5/);
    expect(LAB_LIVE).not.toMatch(/_giantDynamo\s*=\s*_gas\s*&&\s*\(state\.planetRadiusEarth/);
  });

  it('the two condition vectors the E5/storm sites read are derived from the DRAWN radius', () => {
    // The chain that makes _gcond/_scond legitimate live sources: both are built by the single-source
    // deriveConditionVector fed state.planetRadiusEarth. If that ever became _fp.radiusEarth the sites
    // above would look live while being frozen — so pin the derivation, not just the read.
    const derives = [...PIN_VIEW.matchAll(/deriveConditionVector\(\s*_fp\s*,\s*_[a-z]+\s*,\s*([^)]+)\)/g)].map((m) => m[1].trim());
    expect(derives.length).toBeGreaterThanOrEqual(2);
    for (const arg of derives) expect(arg).toBe('state.planetRadiusEarth');
  });

  it('the crater-boot site is the ONLY deriveConditionVector call still fed a canonical radius', () => {
    // Belt and braces on the allowlist: exactly one canonical-fed derivation, and it is the one the
    // G2 sweep proved cannot change its answer.
    // ⚠ THIS IS NOT A SUBSTITUTE FOR THE FENCE, AND IT ONCE READ AS ONE. Round 1 measured a Step-4-shaped
    // `giantRegimeOf(deriveConditionVector(_fp, deriveUniforms(_fp, tier), _fp.radiusEarth))` planted on
    // the crater-boot line: the DENY/allowlist test passed and ONLY this pin went red. It names no file,
    // it fires only for a plant that happens to spell `deriveConditionVector`, and its red was an
    // accident of counting matches across a concatenated corpus. The scanner's column test is the gate;
    // this stays as the belt.
    const canonicalFed = [...PIN_VIEW.matchAll(/deriveConditionVector\([^)]*\)[^)]*\)/g)]
      .map((m) => m[0]).filter((s) => /_fp\.radiusEarth/.test(s));
    expect(canonicalFed.length).toBe(1);
    expect(canonicalFed[0]).toContain('driverUI.qualityTier');
  });
});

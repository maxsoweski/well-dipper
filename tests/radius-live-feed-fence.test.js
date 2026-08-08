// tests/radius-live-feed-fence.test.js — AC-NOFROZEN.
// Workstream: world-engine-radius-live-feed-2026-07-25. Widened for PLAN §4 Step 3 on 2026-08-08.
//
// THE DEFECT THIS FENCE EXISTS TO PREVENT. Six sites in planet-lod-lab.html derived a LIVE quantity
// (Rhines band drivers, the F25 jet stripe ladder, the storm-vortex drivers, the cloud-regime gate,
// the giant-dynamo gate) from `_fp = DRIVER_PRESETS[driverUI.preset]` — a FROZEN preset object the
// radius slider never mutates. The slider writes `state.planetRadiusEarth`. So dragging radius moved
// the disc and moved nothing else. That is Max's "I can tell that's not happening across the board".
// Five of the six now read the drawn radius. This fence keeps the frozen feed from silently returning.
//
// THE INVARIANT: no expression in the CORPUS may read `radiusEarth` off a frozen preset object (`_fp`
// or a `DRIVER_PRESETS[...]` subscript), EXCEPT the explicit ALLOWLIST below — and an allowlist entry
// is only legitimate if the site's canonical-radius behaviour was PROVEN by measurement rather than
// assumed (contract AC-NOFROZEN observable).
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
// PASS/FAIL CRITERION FOR THE WHOLE FILE: exact set equality on the offender list (`toEqual([])`), not
// a count or a threshold. A radius feed is either live or frozen; there is no tolerance band.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripCommentsPreservingOffsets, jsFilesUnder, lineOf } from './helpers/source-scan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LAB_REL = 'planet-lod-lab.html';
const ADAPTER_REL = 'src/worldengine/port/conditionFromPlanet.js';

// ── the corpus ───────────────────────────────────────────────────────────────────────────────────
// WIDENED 2026-08-08 for PLAN §4 Step 3, whose stated reason is that this fence "matches
// `_fp…radiusEarth` patterns IN ONE FILE; move a law out and the scan passes VACUOUSLY over an emptied
// region while the extracted module sits unguarded." Steps 4 and 5 both delete lab code into
// src/worldengine/**, so the destination tree has to be inside the scan BEFORE either lands.
//
// MEASURED 2026-08-08, and enumerated rather than gestured at — the widened hit set is not unbounded,
// it is exactly TWO pre-existing hits and both are disposed of below:
//   · 42 .js files under src/worldengine, ZERO non-.js files in that tree (so `jsFilesUnder`'s
//     extension filter drops nothing here), plus planet-lod-lab.html and planet-lod-shaders.glsl.js
//     ⇒ a 44-file corpus.
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
// The walker is the shared house idiom: source-scan.mjs:158 `export function jsFilesUnder(root, rel) {`,
// promoted there from vis-scale-fence.test.js:36 `function jsFilesUnder(rel) {` — the fence that
// already walks this exact tree for the same reason. (Both refs kept on one line each, per the
// tick-parity note above.)
const CORPUS_REL = [...jsFilesUnder(ROOT, 'src/worldengine'), LAB_REL, 'planet-lod-shaders.glsl.js'];
const SRC = new Map(CORPUS_REL.map((rel) => [rel, readFileSync(join(ROOT, rel), 'utf8')]));
const LAB = SRC.get(LAB_REL);

// Comment-BLIND view of the corpus, for the liveness check and the AC-0 pins only — never for the
// DENY scan. Offset-preserving, so `lineOf` reports the same line number on either view
// (tests/helpers/source-scan.mjs:80 `export function stripCommentsPreservingOffsets(src) {`).
const STRIPPED = new Map(CORPUS_REL.map((rel) => [rel, stripCommentsPreservingOffsets(SRC.get(rel))]));
const LAB_LIVE = STRIPPED.get(LAB_REL);

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
const DENY_SRC = String.raw`(?:\b_fp\b|\bfp\b|DRIVER_PRESETS\s*\[[^\]]*\])\s*\??\.\s*radiusEarth`;
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
//     clean build.
//   · the other 40 src/worldengine files — measured 0 hits each.
const REQUIRED_CARRIERS = [LAB_REL, ADAPTER_REL];

// ── the allowlist ────────────────────────────────────────────────────────────────────────────────
// One entry per deliberately-canonical site. `match` is a distinctive substring of the offending
// SOURCE LINE (not a line number — line numbers rot). `file` is the corpus file that line must live
// in. `why` must state the PROOF, and `evidence` must point at the artifact that carries it. An entry
// with no measured proof is not admissible.
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
    match: 'craterRelevanceOf(deriveConditionVector(',
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
    // ⚠ The site is cited SYMBOL-ONLY, with no line number, per PLAN §10: conditionFromPlanet.js is
    // one of the two regions that convention names explicitly, because every step of this plan adds
    // lines to it and an integer written there is born with a half-life of one step. The `match`
    // string above IS the ref.
    // ⛔ WHAT THIS ENTRY DOES NOT LICENSE, stated because an exemption is read by whoever wants one:
    // it certifies THAT ONE LINE IN THAT ONE FILE. It is keyed on `file`, so it cannot travel with a
    // moved call shape; and it is checked for LIVENESS below, so it cannot survive the line being
    // demoted to a comment. If Step 4 or 5 feeds `giantRegimeOf` a condition derived at
    // `_fp.radiusEarth`, that is a DIFFERENT site and needs its own ruling — see KNOWN LIMITS #3.
    why: 'the game has exactly one radius per body, so this third argument is byte-identical to the '
       + 'canonical radius and gravityRadiusRatio is exactly 1.0 — the self-compression law it would '
       + 'feed can never fire. PLAN Step 2 ruled this correct and ruled against inventing a second '
       + 'game radius; a "fix" here would fabricate the second radius that ruling forbids.',
    evidence: 'docs/FEATURES/one-pipeline-two-frontends-PLAN.md',
  },
];

// ── KNOWN LIMITS ─────────────────────────────────────────────────────────────────────────────────
// ⭐ Written HERE, in the gate's own source, and not only in the carried ledger. PLAN §11.9: "A limit
// that is not written into the gate itself has been forgotten, not accepted." Each entry names the
// construct it excuses and the measurement that sized it.
//
// #1 — THE PATTERN CAN ONLY SEE THREE SPELLINGS. `DENY_SRC` recognises `_fp`, a bare `fp`, and a
//      `DRIVER_PRESETS[...]` subscript. A frozen read reached through ANY OTHER ALIAS is invisible:
//      `const p = DRIVER_PRESETS[name]; p.radiusEarth`, a destructured `const { radiusEarth } = _fp`,
//      a preset passed as a differently-named parameter. This is a spelling fence, not a dataflow
//      analysis, and it must never be described as one. It is accepted rather than fixed because the
//      alternative is the taint analysis PLAN's ledger row C7 already ruled out of proportion for a
//      gate of this kind.
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
//
// #4 — ✅ CLOSED IN THE SAME COMMIT, and kept here because the limit it names is the general one.
//      This file WAS outside `CITE_SOURCES`, so every ref in it was hand-verified once and nothing
//      re-verified it. It and tests/radius-live-feed.test.js are now both in the list (§11.3.4 wants
//      every file a step edited), which moved `refs CHECKED` 160 → 176.
//      ⚠ THE REMAINING LIMIT, WHICH IS THE ONE WORTH KNOWING: being IN `CITE_SOURCES` is not the same
//      as being GATED. A ref with no backticked symbol lands in UNCHECKED (333 of them today) and
//      fails nothing, and a symbol span WRAPPED ACROSS TWO SOURCE LINES lands in TICK-PARITY, which
//      also fails nothing — three refs in this file's own freshly-written prose did exactly that and
//      had to be un-wrapped. Prose wraps; citations must not. Ledger row C12.

// ── the scanner ──────────────────────────────────────────────────────────────────────────────────
// Returns [{ file, line, text }] for every DENY hit NOT covered by the allowlist. Exported shape is
// deliberately data (not a boolean) so the negative controls below can assert on exactly what it
// caught, rather than on "it failed somehow". `file` is both reported AND used for allowlist keying.
function scanFrozenRadiusReads(src, allowlist = ALLOWLIST, file = LAB_REL) {
  const lines = src.split('\n');
  const offenders = [];
  for (const m of src.matchAll(denyScanner())) {   // fresh matcher ⇒ always starts at offset 0
    const line = lineOf(src, m.index);
    const text = lines[line - 1];
    if (allowlist.some((a) => a.file === file && text.includes(a.match))) continue;
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
    for (const rel of REQUIRED_CARRIERS) {
      const raw = rawHitsIn(rel);
      expect(raw.length, `carrier '${rel}' holds no DENY hit — the scan has gone vacuous THERE, `
        + 'even if other files keep the corpus-wide count non-zero. If the site legitimately moved, '
        + 'move this carrier out of REQUIRED_CARRIERS in the same commit and say where it went.')
        .toBeGreaterThanOrEqual(1);
    }
  });

  it('the walker ran and found a tree (a THRESHOLD, and only that)', () => {
    // ⚠ STATED SO IT IS NOT MISTAKEN FOR A CORPUS CHECK. Measured 2026-08-08 the corpus is 44 files
    // (42 .js under src/worldengine + the lab + the shader module), so `> 20` survives LOSING HALF THE
    // TREE. It proves the walker ran and returned something; it proves nothing about the corpus being
    // intact. The per-carrier assertion above is the check that has that property. The same warning is
    // written into tests/helpers/source-scan.mjs:158 `export function jsFilesUnder(root, rel) {`,
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
    for (const a of ALLOWLIST) {
      expect(STRIPPED.get(a.file).includes(a.match),
        `allowlist entry '${a.id}' no longer matches LIVE code in ${a.file} — it matches only inside a `
        + 'comment. Either the site moved (delete the entry and re-prove it at its new home) or it was '
        + 'commented out (delete the entry). An exemption may not certify a comment.').toBe(true);
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
    for (const a of ALLOWLIST) {
      expect(a.why, `allowlist entry '${a.id}' has no stated reason`).toBeTruthy();
      expect(a.why.length).toBeGreaterThan(40);              // a sentence, not a shrug
      expect(a.evidence, `allowlist entry '${a.id}' evidence path is malformed`)
        .toMatch(/^docs\/(WORKSTREAMS|FEATURES)\/.+\.md$/);
      expect(existsSync(join(ROOT, a.evidence)),
        `allowlist entry '${a.id}' points at '${a.evidence}', which does not exist`).toBe(true);
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
      // NB: this one is planted ON the allowlisted line, so it also proves the allowlist is keyed on
      // the SITE (the craterRelevanceOf call shape), not on "any line mentioning a preset radius".
      stillAllowlisted: true,
    },
  ];

  for (const d of PLANTED) {
    it(`re-freezing ${d.id} is caught (planted defect ⇒ fence FAILS)`, () => {
      expect(LAB.includes(d.live), `live form not found — source drifted: ${d.live}`).toBe(true);
      const broken = LAB.replace(d.live, d.frozen);
      expect(broken).not.toBe(LAB);                                   // the plant actually landed
      const offenders = scanFrozenRadiusReads(broken);
      if (d.stillAllowlisted) {
        // The crater-boot line stays exempt even in the other spelling — correct, and the reason the
        // allowlist matches on the call shape. The point of this case is that the DENY pattern itself
        // covers `DRIVER_PRESETS[...].radiusEarth`, proven by the un-allowlisted scan below.
        expect(scanFrozenRadiusReads(broken, [])).not.toEqual([]);
      } else {
        expect(offenders.length, `fence did not catch the re-frozen ${d.id}`).toBeGreaterThanOrEqual(1);
      }
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
    const live = 'export function convectiveVigor(cv) {';
    const frozen = 'export function convectiveVigor(cv) {\n'
      + '  const _boot = craterRelevanceOf(deriveConditionVector(_fp, deriveUniforms(_fp, tier), _fp.radiusEarth));';
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
    // (tests/helpers/source-scan.mjs header: 7 instances in the lab, 6 mutants, all green). Under the
    // staleness test alone the entry still "matches a real line" and the exemption survives forever.
    const a = ALLOWLIST.find((x) => x.id === 'adapter-oneGameRadius');
    const src = SRC.get(a.file);
    const commented = src.replace(a.match, `// ${a.match}`);
    expect(commented).not.toBe(src);
    // Comment-inclusive staleness: still "covered". This is the state that used to be undetectable.
    expect(commented.split('\n').some((l) => l.includes(a.match))).toBe(true);
    // Comment-blind liveness: NOT covered. This is the assertion that catches it.
    expect(stripCommentsPreservingOffsets(commented).includes(a.match)).toBe(false);
    // And the real file is live, i.e. restore ⇒ PASS.
    expect(STRIPPED.get(a.file).includes(a.match)).toBe(true);
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
  ];
  const MUST_NOT_MATCH = [
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
  // ⚠ ALL PINS RUN AGAINST `LAB_LIVE`, THE COMMENT-STRIPPED LAB — never against raw source. A pin
  // satisfied by a comment would let the block it pins be deleted as long as somebody quoted it on the
  // way out, which is the exact mutant tests/helpers/source-scan.mjs was built for. The one deliberate
  // exception is marked at its own site below and explains itself.
  const PINS = [
    // site, expected live expression, the driver it now names
    ['E5 Rhines band bake (rebakeE5Bands)', /radius:\s*\(_gcond\.radiusEarth\s*\?\?\s*1\)\s*\/\s*11\.2/],
    ['storm/vortex bake (applyStormState)', /radius:\s*\(_scond\.radiusEarth\s*\?\?\s*1\)\s*\/\s*11\.2/],
    ['F25 jet stripe ladder (state.bandCount)', /state\.bandCount\s*=\s*Math\.min\(16,\s*Math\.max\(3,\s*Math\.round\(12\s*\*\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*\/\s*_rotH\)\)\)/],
    ['cloud regime gate', /_gas\s*&&\s*\(state\.planetRadiusEarth\s*\?\?\s*1\)\s*<\s*6/],
  ];
  for (const [name, re] of PINS) {
    it(`${name} reads the drawn radius`, () => expect(LAB_LIVE).toMatch(re));
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
  const BLIND_BLOCK_PINS = [
    ['`const _gas` (composition gate, feeds cloud regime + giant dynamo)',
      /const\s+_gas\s*=\s*\(_fp\.atmosphere\?\.composition\s*===\s*'h2-he'\)/],
    ['`const _rotH` (rotation hours, the bandCount divisor)',
      /const\s+_rotH\s*=\s*state\.rotationHours\s*\?\?\s*_fp\.rotationHours\s*\?\?\s*24/],
    ['the aurora tail (`state.auroraRingWidth =`, the last statement of the extracted aurora block)',
      /state\.auroraRingWidth\s*=\s*Math\.max\(/],
    ['the boot `radiusSeed:` draw seed', /radiusSeed:\s*1\s*,/],
  ];
  for (const [name, re] of BLIND_BLOCK_PINS) {
    it(`${name} is present in LIVE lab source`, () => expect(LAB_LIVE).toMatch(re));
  }

  it('the extractor\'s `// AC5` anchor on the radiusSeed line is present in RAW source', () => {
    // ⚠ THE ONE DELIBERATE RAW-SOURCE PIN IN THIS BLOCK, and it is pinning a COMMENT on purpose.
    // tests/radius-live-feed.test.js extracts the boot seed with
    // /radiusSeed:\s*(\d+)\s*,\s*\/\/\s*AC5 seeded-radius draw seed/ — the anchor it keys on IS the
    // trailing comment, so a comment-stripped pin cannot see it (measured: 1 occurrence raw, 0
    // stripped). Deleting just the comment would silently break that extraction.
    // ⛔ This does NOT reopen the hole the liveness rule closes. The value-bearing half of the same
    // line is pinned against LIVE source immediately above, so moving the whole line into a comment
    // still reds the fence — this pin can only ever be the SECOND of two, never the only one.
    expect(LAB).toMatch(/radiusSeed:\s*\d+\s*,\s*\/\/\s*AC5 seeded-radius draw seed/);
  });

  // The INVERSE pin. The giant-dynamo gate must keep reading the CANONICAL radius: it classifies
  // interior composition, and Neptunian/Sub-Neptune draw bit-identical radii at every seed, so a
  // drawn-radius discriminator cannot separate them (ALLOWLIST 'giantDynamo-compositionClassifier').
  // This asserts BOTH directions so the site cannot drift either way unnoticed.
  it('giant dynamo gate reads the CANONICAL radius (composition classifier, not a physics input)', () => {
    expect(LAB_LIVE).toMatch(/_giantDynamo\s*=\s*_gas\s*&&\s*\(_fp\.radiusEarth\s*\?\?\s*1\)\s*>=\s*3\.5/);
    expect(LAB_LIVE).not.toMatch(/_giantDynamo\s*=\s*_gas\s*&&\s*\(state\.planetRadiusEarth/);
  });

  it('the two condition vectors the E5/storm sites read are derived from the DRAWN radius', () => {
    // The chain that makes _gcond/_scond legitimate live sources: both are built by the single-source
    // deriveConditionVector fed state.planetRadiusEarth. If that ever became _fp.radiusEarth the sites
    // above would look live while being frozen — so pin the derivation, not just the read.
    const derives = [...LAB_LIVE.matchAll(/deriveConditionVector\(\s*_fp\s*,\s*_[a-z]+\s*,\s*([^)]+)\)/g)].map((m) => m[1].trim());
    expect(derives.length).toBeGreaterThanOrEqual(2);
    for (const arg of derives) expect(arg).toBe('state.planetRadiusEarth');
  });

  it('the crater-boot site is the ONLY deriveConditionVector call still fed a canonical radius', () => {
    // Belt and braces on the allowlist: exactly one canonical-fed derivation, and it is the one the
    // G2 sweep proved cannot change its answer.
    const canonicalFed = [...LAB_LIVE.matchAll(/deriveConditionVector\([^)]*\)[^)]*\)/g)]
      .map((m) => m[0]).filter((s) => /_fp\.radiusEarth/.test(s));
    expect(canonicalFed.length).toBe(1);
    expect(canonicalFed[0]).toContain('driverUI.qualityTier');
  });
});

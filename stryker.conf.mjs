// stryker.conf.mjs — MUTATION TESTING, INSTALLED 2026-08-08 TO CLOSE A CLASS BY MACHINE.
//
// ═══ WHY THIS EXISTS ═════════════════════════════════════════════════════════════════════════════
// PLAN §11.4 round 2 on Step 3 found FOUR instances of ONE defect in a single step, all the same
// shape: AN ASSERTION WHOSE CONTROL IS DERIVED FROM ITS OWN SUBJECT, so no mutant can kill it.
//   1. the ledger's C10 rows — null-result assertions whose controls share the subject's extraction
//   2. `lineOf` — its only assertion compared lineOf-on-raw to lineOf-on-stripped, so both arms carry
//      any mutation and `i < index` -> `i <= index` was invisible
//   3. `jsFilesUnder` — `expect(files).toEqual([...files].sort())` sorts the subject's own output and
//      compares it to itself
//   4. `REQUIRED_CARRIERS` — a `toBeGreaterThanOrEqual(REQUIRED_CARRIERS.length)` under a comment
//      claiming it stopped the list being trimmed. Trimming the list left the file 74/74 GREEN.
// §11.2 says that when a round finds a CLASS you land the machine check that closes the class, not
// the point fix; §11.3.2 already named the trigger — "a hand-authored mutant per branch UNTIL IT IS
// WORTH INSTALLING" coverage tooling. Four instances in one step is that evidence, and Max ruled:
// apply the fixes AND install mutation testing.
//
// A dead assertion is invisible to `npm test` BY CONSTRUCTION — it is green either way; that is what
// makes it dead. It is visible to a mutation runner, because a mutation runner asks the one question
// the suite cannot ask itself: IF I BREAK THIS, DOES ANYTHING GO RED? Everything below is the
// smallest configuration that makes "no" a machine-reported result instead of a review finding.
//
// ═══ HOW TO RUN IT ═══════════════════════════════════════════════════════════════════════════════
//   npm run test:mutation:helper       # target (a), CLASSIC — mutate the helper module
//   npm run test:mutation:assertions   # target (b), DEAD-ASSERTION DETECTION — mutate the tests
//   npm run test:mutation              # both, in that order
//
// ⛔ IT IS DELIBERATELY NOT WIRED INTO `npm run check:instruments`. That script runs on every step
// and must stay in the seconds; target (a) MEASURED 13m29s, target (b) 52s. The intended cadence is
// PER-STEP AND SCOPED: after a step edits one of the files named in `MUTATE` below, run the scope that covers it,
// read the survivors, and close the ones that are real. It is a review instrument you point at a
// diff, not a gate you leave running.
//
// ═══ WHAT IS IN SCOPE, AND WHAT IS DELIBERATELY NOT ══════════════════════════════════════════════
// IN: exactly four files — the shared helper and the three suites that consume it (see `MUTATE`).
// NOT: everything else. `npm run test:baseline` reports the collected suite as FILES 308 / TESTS
// 4842, and Stryker re-runs the covering tests once per mutant; an unscoped run is not
// slow-but-useful, it is useless. For the size of that gap: the four in-scope files alone produce
// 393 + 2265 mutants. The scoping is done on the TEST side, in tools/vitest.mutation.config.mjs —
// read its header, it carries the reason the vitest timeout there is 60s and not 5s.
// ⭐ NEITHER NEW FILE IS COLLECTED AS A TEST, and that is checked rather than assumed: Instrument A
// still reports FILES 308 after both landed.
// NOT: `src/worldengine/**`. The three suites read that tree AS TEXT and do not execute most of it,
// so mutating it would report survivors that mean "the fence does not scan for this", which is a
// scope question for the fence, not a dead assertion. Different instrument, different step.

// Paths in `mutate` and `ignorePatterns` are resolved by Stryker relative to the config file, so
// this file needs no ROOT of its own. tools/vitest.mutation.config.mjs DOES derive one — see the
// sandbox note further down for why that difference matters.
const SCOPE = process.env.WD_MUTATION_SCOPE ?? 'assertions';

const MUTATE = {
  // (a) CLASSIC. A pure module in, a pure module mutated. A survivor here means that branch of
  // `stripCommentsPreservingOffsets` / `jsFilesUnder` / `lineOf` has no assertion that kills it —
  // which is instances 2 and 3 of the class, closed mechanically instead of by eye.
  helper: ['tests/helpers/source-scan.mjs'],

  // (b) ⭐ DEAD-ASSERTION DETECTION. THE TEST FILES ARE THE MUTATION SUBJECT AND ALSO THE SUITE.
  // This is not what Stryker's docs describe — they say "these should be your production code files,
  // and definitely not your test files" — and it is the technique that actually matches the class.
  // If flipping an assertion's operator, emptying its expected table, or widening its comparison
  // leaves the suite GREEN, that assertion cannot fail. Instance 4 is exactly this shape.
  // ⭐ IT WORKS, AND THAT WAS MEASURED BEFORE IT WAS CLAIMED: `npx stryker run --dryRunOnly` with
  // this scope instrumented 3 test files with 2211 mutants and the initial run reported
  // "Ran 171 tests in 2 seconds" — vitest loads and passes its own instrumented test files.
  assertions: [
    'tests/source-scan-helper.test.js',
    'tests/radius-live-feed.test.js',
    'tests/radius-live-feed-fence.test.js',
  ],
};

// ⭐ EXCLUDED FOR SCOPE (b) ONLY, AND THE THREE NAMES WERE CHOSEN FROM A MEASUREMENT, NOT A HUNCH.
// The first (b) run was deliberately made with EVERY mutator enabled, to find out what the technique
// actually reports rather than to guess. It produced 2226 mutants and 1185 survivors (45.37%), and
// the survivors broke down as:
//     StringLiteral 471 · Regex 288 · BlockStatement 168 · ArrayDeclaration 70 ·
//     ConditionalExpression 53 · EqualityOperator 42 · ArrowFunction 30 · MethodExpression 24 ·
//     ArithmeticOperator 15 · ObjectLiteral 9 · BooleanLiteral 7 · LogicalOperator 4 · other 4
// The top three are 927 of 1185 — 78% — and they are STRUCTURAL ARTEFACTS OF MUTATING A TEST FILE,
// not findings:
//   · BlockStatement empties a function body. Applied to an `it(...)` body it deletes the test, and
//     a test that asserts nothing passes. MEASURED by hand in a proven mirror: emptying the
//     REQUIRED_CARRIERS set-equality body left tests/radius-live-feed-fence.test.js at
//     74 passed (74) — THE COUNT DID NOT EVEN MOVE, because the `it()` still registers. So this
//     mutator survives once per test by construction and carries no information.
//   · StringLiteral blanks a string. In these files most strings are `it(...)` titles and the
//     assertion-message second argument to `expect(...)` — both non-load-bearing on purpose.
//   · Regex nibbles a quantifier, typically `\s*` -> `\s`. The DENY patterns are matched against
//     real source that happens to have exactly one space there, so the nibble is invisible. That is
//     a question about how tightly the patterns are written, which is the fence's own scope.
// Removing the three took the run from 1185 survivors to 260 and the score from 45.37% to 68.02%.
// ⚠ THE COST IS NAMED, NOT HIDDEN: a genuinely dead assertion whose only witness is a string or a
// regex is now invisible to this instrument. Re-run with `mutator.excludedMutations: []` when the
// step under review is one that edits the DENY patterns themselves.
const NOISE_MUTATORS = ['StringLiteral', 'Regex', 'BlockStatement'];

export default {
  packageManager: 'npm',
  testRunner: 'vitest',

  // Points the runner at the scoped config rather than the repo's vite.config.js, which has no
  // `test` key at all — under it vitest falls back to its default discovery and collects all 308
  // files, which is tests/ plus the plugin trees under .claude/.
  vitest: { configFile: 'tools/vitest.mutation.config.mjs' },

  mutate: MUTATE[SCOPE] ?? MUTATE.assertions,
  mutator: { excludedMutations: SCOPE === 'helper' ? [] : NOISE_MUTATORS },

  // perTest is what makes (b) affordable: a mutant inside one `it(...)` body reruns only the tests
  // that covered it. MEASURED for (b): "Ran 2.86 tests per mutant on average" out of 175.
  coverageAnalysis: 'perTest',

  // ⛔ ignoreStatic STAYS FALSE, and Stryker itself will argue with you about it — it warns
  // "Detected 847 static mutants (38% of total) that are estimated to take 98% of the time".
  // Static means the mutant sits outside any test body, at module scope. In these files that is
  // where the CORPUS lists, the expected-value tables and the allowlist live — and instance 4,
  // `REQUIRED_CARRIERS`, is a module-scope array. Turning this on to buy back time would blind the
  // instrument to the exact defect it was installed for.
  ignoreStatic: false,

  // ⛔ NO FILE REPORTERS ON PURPOSE. `reports/` is not in .gitignore, and a mutation run is a review
  // instrument, not an artefact the repo carries. Survivors go to stdout; pipe them somewhere
  // outside the tree if you want to keep them:
  //   npm run --silent test:mutation:assertions > /tmp/mutants.log 2>&1
  // Add 'html' to `reporters` ad hoc for a browsable report; it will write into reports/ — delete it.
  reporters: ['clear-text', 'progress'],
  clearTextReporter: { allowColor: false, logTests: false, maxTestsToLog: 0 },

  // ⛔ PINNED TO 4, LOWERED FROM 12 ON 2026-08-09 BECAUSE OF WHAT 12 ACTUALLY DID TO THE MACHINE.
  // Mutation testing is embarrassingly parallel and Stryker's default takes nearly every core. At 12
  // on a 16-core box the measured load average was 12.2 with 13 node workers each at 88-102% CPU, and
  // the first person to notice was MAX, via his laptop fan — not via any number this tool printed.
  // A dev tool whose resource appetite is discovered through hardware noise is mis-configured, however
  // fast it is. 4 leaves the machine usable while it runs, which is the property that matters for a
  // thing you invoke by hand and then wait on.
  // THE COST, MEASURED SO IT IS A TRADE AND NOT A REGRESSION: the (a) helper scope ran 13m29s at
  // concurrency 12; it is ~3x that at 4. The (b) assertion scope ran 49s at 12, so it stays under
  // ~3 minutes and is the one you will actually run per-step. If you are on an idle machine and want
  // the (a) scope back at full speed, override for that run only:
  //     npx stryker run --concurrency 12          (do NOT commit the change)
  concurrency: 4,

  // ⚠ THESE TWO ARE THE INFINITE-LOOP BUDGET, AND THE LOOPS ARE REAL — 63 of 393 mutants in the (a)
  // run ended as `Timeout`. `stripCommentsPreservingOffsets` is a per-character state machine whose
  // arms all end `i = j`, so a mutant that stops `j` LEAVING `i` spins forever. It is a failure to
  // ADVANCE, not a step backwards — VERIFIED by hand, and the distinction cost a wrong guess:
  //   · `j = j === -1 ? src.length : j + 2` -> `j - 2` (the block-comment terminator, which CAN put
  //     j behind i) does NOT hang. It fails cleanly: 1 failed | 48 passed.
  //   · the line-comment scan `while (j < src.length && src[j] !== '\n')` -> `=== '\n'` DOES hang.
  //     j never leaves i, `blank(0)` writes nothing, `i = j` is a no-op, and the outer loop spins.
  //     Under a 25s wall clock with vitest's testTimeout at 5s it exited 124 having printed NOTHING
  //     past the RUN banner — the spin is SYNCHRONOUS, so vitest's timer never gets a turn.
  // Only a process kill ends that, which is what these two buy. Stryker's per-mutant budget is
  // `timeoutMS + timeoutFactor * netTime` and it kills the RUNNER PROCESS, which is why such a
  // mutant lands as `Timeout` (counted as killed) instead of wedging the run with no output.
  // MEASURED for (a): netTime 21401ms, so the budget is ~52s, and those 63 timeouts each spend it —
  // most of why (a) takes 13m29s while (b), with 2265 mutants and no such loops, takes 52s.
  // ⚠ A TIMEOUT IS COUNTED AS A KILL, so tightening these two INFLATES the score. They are set
  // loose deliberately: the score erring low is the safe direction for an instrument whose whole job
  // is to stop a green being believed.
  timeoutMS: 10000,
  timeoutFactor: 2,

  disableTypeChecks: false,
  cleanTempDir: true,

  // ⚠ THE SANDBOX IS A REAL COPY, AND THAT IS THE WHOLE BALLGAME. All three suites derive their ROOT
  // from `import.meta.url` and then read planet-lod-lab.html and src/worldengine/** off disk. Node
  // resolves symlinks BEFORE computing import.meta.url, so a mirror that SYMLINKS tests/ reads the
  // REAL repo and every mutant returns the original's number. Stryker copies source files (it
  // symlinks only node_modules), so its sandbox is sound by construction — VERIFIED, not assumed:
  //   node -e "console.log(require('fs').realpathSync('.stryker-tmp/sandbox-XXXX/tests/radius-live-feed.test.js'))"
  // printed a path inside the sandbox for tests/, tests/helpers/source-scan.mjs, planet-lod-lab.html
  // and tools/vitest.mutation.config.mjs. Re-run that check if you ever change `ignorePatterns`.
  //
  // ⚠ THE LIST BELOW EXISTS ONLY BECAUSE THIS REPO IS 6.1G AND STRYKER COPIES IT PER RUN. Most
  // entries are directories of captured output, not source: screenshots/ 1.7G, recordings/ 477M,
  // docs/ 258M, data/ 49M, research/ 27M, dist/ 26M, public/ 22M, plus 256 root PNGs at 50M.
  //
  // ⭐ `.claude` IS THE ONE THAT IS NOT OBVIOUS AND IT WAS THE BIGGEST. STRYKER DOES NOT READ
  // .gitignore, so being ignored by git buys nothing here. MEASURED: a sandbox built without this
  // entry was 203M, of which .claude/ ALONE WAS 179M — 88% of the copy, rebuilt every run, and it
  // carries ~1280 of the repo's ~1440 *.test.js files (tests/ itself holds 162). Adding it took a
  // sandbox from 203M to 18M; VERIFIED after the change, .claude/ survives only as an empty
  // directory skeleton holding 0 files, which is Stryker filtering files and not dirs. That tree is
  // also why tools/vitest.mutation.config.mjs excludes '**/.claude/**' on the test side.
  //
  // docs/ is excluded WITH TWO NEGATIONS because the fence's allowlist asserts its `evidence:` files
  // exist and contain their `anchor:` — drop those negations and the allowlist-evidence test reds
  // for a reason that has nothing to do with any mutant. VERIFIED by listing the sandbox: all four
  // evidence targets present, and docs/ lands at 1.6M instead of 258M.
  //
  // ⚠ `*.jpg` DOES NOT MATCH `.jpeg` — the root gallery uses the four-letter form, so both spellings
  // are listed. node_modules is symlinked by Stryker, not copied, and needs no entry.
  ignorePatterns: [
    '.claude',
    'screenshots',
    'recordings',
    'qa-results',
    'scratchpad',
    'research',
    'data',
    'dist',
    'public',
    'docs/**',
    '!docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/**',
    '!docs/FEATURES/*.md',
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.mp4',
    '*.webm',
  ],

  // ⛔ NO BREAK THRESHOLD, AND THE ABSENCE IS THE CONSIDERED ANSWER — not an omission.
  // A `break` number would be a gate, and a gate needs a number somebody can defend. The two scores
  // this config has ever produced are 82.95% for (a) (393 mutants, 67 survivors) and 68.02% for (b)
  // (2265 mutants, 260 survivors). Neither is a target anyone
  // chose; both are just where the code happened to land on the day, against a tree two lanes were
  // editing at the time. Freezing either as a pass mark would install exactly the defect this whole
  // plan exists to remove: A GATE POINTED AT NOTHING, which reports green because its number was
  // drawn around whatever was already there.
  // What WOULD justify one: a run whose survivors have all been read and either closed or written
  // down as accepted, on a tree that is not moving. At that point the defensible gate is not a
  // percentage at all — it is ZERO SURVIVORS OUTSIDE A NAMED ALLOWLIST, the same shape the fence
  // itself uses. Until then this reports and does not judge.
  // `high`/`low` are set to 100 so the summary table never colours a survivor-carrying run green.
  thresholds: { high: 100, low: 100, break: null },
};

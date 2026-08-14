// docs/FEATURES/step8-recon-workflow-2026-08-12.mjs
//
// THE RECON WORKFLOW THAT PRODUCED STEP 8'S BUILD PLAN — recovered verbatim 2026-08-13.
//
// Run 2026-08-12 at f679046 on a clean tree as run `wf_fd4380a4-5b1`: 5 read-only recon lanes +
// 3 adversarial refutation lanes + 1 synthesiser told to weigh rather than average. Its output is
// docs/FEATURES/step8-build-plan-2026-08-12.md; the 9 lane returns are recovered verbatim in
// docs/FEATURES/step8-recon-lane-output-2026-08-12.md.
//
// ⭐ WHY THIS FILE IS IN THE TREE AND NOT LEFT IN THE SESSION DIRECTORY. The instructions ARE the
// method. The line below reading `A claim in the PLAN is a CLAIM, not a fact` — symbol-only per
// PLAN §10, because this header shifted it off the :22 it occupied in the original — is what surfaced
// the two breaks that mattered (8b is a universe change, not a value change; and the byte-identity
// gate inverts). A lane told to "review Step 8" returns a review. A lane told that the plan's own
// numbers are claims to be re-measured returns the 19-row verdict table. The difference between
// those two workflows is a handful of sentences, and they are worth more than the findings.
//
// ⛔ NOT RUNNABLE AS-IS from the repo. It is a Claude Code Workflow script: `agent()`, `parallel()`,
// `pipeline()`, `phase()` and `log()` are harness globals, not imports. Kept for its prompts.
//
// ⚠ The original session's handoff document was written to /tmp and lost to a tmp sweep before the
// next session read it. That is why this file, the lane output and the process notes now live in
// the tree. THE RULE: an artifact that only exists in /tmp does not exist.

export const meta = {
  name: 'step8-moon-condition-recon',
  description: 'Step 8 recon: verify every load-bearing claim in the plan, refute the leading design, synthesise a build plan',
  phases: [
    { title: 'Recon', detail: 'five read-only lanes over MoonGenerator, the adapter rename, Instrument B, the numbers, provenance' },
    { title: 'Refute', detail: 'three lanes whose explicit job is to break the leading design' },
    { title: 'Synthesise', detail: 'weigh, do not average — one build plan with commit shape and gates' },
  ],
}

const REPO = '/home/ax/projects/well-dipper'

const PREAMBLE = `You are working in the git repo at ${REPO} (branch feature/world-engine-production-L1, HEAD is clean).
This is Well Dipper, a browser space game. You are doing READ-ONLY recon for PLAN §4 Step 8 of
docs/FEATURES/one-pipeline-two-frontends-PLAN.md ("Moons get a real condition record, derived and
never drawn"). READ that Step 8 section first — it is the spec.

⛔ HOUSE RULES THAT DECIDE WHETHER YOUR OUTPUT IS USABLE:
- MEASURE, DO NOT ASSERT. Every number you report must come from a command you actually ran or a
  file range you actually read. Quote the file:line. If you could not measure it, say UNMEASURED.
  This codebase's signature failure is a measurement that is entirely true and entirely misleading.
- A claim in the PLAN is a CLAIM, not a fact. Several of its recorded numbers have already failed to
  reproduce (see §2's tidal figures, which are kept in the file explicitly as "the claim being
  corrected"). Your job includes checking the ones you touch.
- DO NOT EDIT ANY FILE. Read, grep, and run node/vitest read-only. Do not create files outside
  /tmp. Do not run 'npm run dev' or start any server.
- You may run: git, grep, node -e, npx vitest run <file>, npm run test:baseline, and read anything.
- Return RAW DATA, not prose reassurance. Your final text IS the return value.`

phase('Recon')

const LANES = [
  {
    key: 'drawstream',
    label: 'recon:MoonGenerator-draw-stream',
    prompt: `${PREAMBLE}

LANE 1 — THE RNG DRAW STREAM IN src/generation/MoonGenerator.js.

Step 8a says the plain path (:165-204) has FIFTEEN draws and SEVEN of them come after startAngle
(:157), and that splicing anything after :157 re-rolls noiseScale on every plain moon in the
universe. That is the load-bearing hazard of the whole step. VERIFY IT, DO NOT TRUST IT.

Produce:
1. The COMPLETE ordered list of every value consumed from the passed-in \`rng\` inside
   MoonGenerator.generate's plain path, with file:line and the variable it lands in. Count them.
   Is it 15? If not, what is the real number and where does the plan's count go wrong?
2. Which of them are CONDITIONAL (drawn only on some branch)? The plan names
   \`const retrograde = type === 'captured' && rng.chance(0.4)\` at :155 as the live conditional and
   claims 64 of 262 moons are 'captured' (24.4%). Re-measure that fraction over a real generated
   population and report your seed/method.
3. The exact line number of the LAST draw, and therefore the earliest safe APPEND point for new
   derivations that must not disturb the stream.
4. What is in scope at that append point? Enumerate the bindings Step 8a's new derivations would
   need — massEarth (radius^3 x parent-derived density), age (the system's), T_eq (from the PARENT's
   real orbit radius), composition, surfaceHistory, tidalState — and for EACH say whether the value
   is already in scope there, and at which file:line it is bound. Name any that are NOT reachable.
5. The dedicated-namespace pattern the plan points at (:257-263, documented :244-251): quote it and
   say exactly how a new derivation that genuinely needs randomness would use it without touching
   the shared stream.
6. Is there an existing test that pins the draw stream or draw COUNT per moon type? Name it, or say
   none exists.`,
  },
  {
    key: 'rename',
    label: 'recon:conditionFromPlanet-rename',
    prompt: `${PREAMBLE}

LANE 2 — THE conditionFromPlanet -> conditionFromBody RENAME.

Step 8a calls it "a rename, not a redesign: \`type\` appears in that file only in comments at
:9,:10,:11,:83". VERIFY, then map the true blast radius.

Produce:
1. Every occurrence of the identifier \`conditionFromPlanet\` repo-wide (exclude node_modules, .git,
   dist, scratchpad): file:line, and classify each as IMPORT SPECIFIER / CALL SITE / TEST NAME /
   COMMENT-OR-PROSE / CITATION-IN-MARKDOWN. Give totals per class.
2. The file src/worldengine/port/conditionFromPlanet.js itself: does \`type\` really appear only in
   comments at :9,:10,:11,:83? Report every occurrence of \`type\` (word-boundary) with its line and
   whether it is code or comment. If the claim is wrong, that changes the step from rename to
   redesign — say so loudly.
3. ⛔ THE CITATION HAZARD, and this is the part most likely to bite. Read PLAN §10 (the citation
   convention) and tools/port-uniform-delta.mjs's CITE_FILES / CITE_SOURCES blocks. conditionFromPlanet.js
   is one of TWO regions §10 names explicitly as cited SYMBOL-ONLY with no line numbers. Report:
   how many citations point INTO this file, how many carry line numbers, and exactly what a rename
   of the FILE (not just the function) would break in \`npm run port-uniform-delta:citations\`.
   Run that command now and report its current output so there is a before-number.
4. Does anything key on the STRING 'conditionFromPlanet' (a test asserting source text, a fence, a
   provenance tag, a serialized record)? Grep for it in quotes/backticks specifically.
5. RECOMMEND: rename the file too, or rename only the exported function and keep the filename?
   Give the cost of each in files-touched and in citations-to-repair, with numbers.`,
  },
  {
    key: 'instrumentB',
    label: 'recon:instrument-B-widening',
    prompt: `${PREAMBLE}

LANE 3 — INSTRUMENT B (tests/body-identity-fence.test.js) AND WHAT "HASH THE ENTIRE MOON RECORD" COSTS.

Step 8a's gate: "Instrument B must hash the ENTIRE returned moon record — all keys, sorted, full
precision — not four named fields. Same cost, covers all fifteen draws. Must be byte-identical."

Produce:
1. How Instrument B works today: what it hashes, for which bodies, at what precision, and where the
   blessed hashes live (tests/baseline/body-identity.json). Quote the hashing function with file:line.
2. WHICH four named fields does it hash for moons today? Name them with file:line.
3. What EXACTLY would change to hash the whole record? Write the diff in words. Name every hazard:
   key ordering, undefined vs missing keys, nested objects, floats and precision, NaN, functions or
   class instances on the record, cyclic references. Does the moon record contain any non-JSON value?
   Check by generating one and inspecting it.
4. ⛔ THE VACUITY QUESTION. If the widened hash is recorded AFTER 8a's changes land, it proves
   nothing about 8a. State the correct ordering of operations so the gate can actually fail, and
   name the commit each half belongs in.
5. Run \`npm run test:body-identity\` now and report the current output verbatim, as the before-number.
6. Is there any body-identity coverage for PLANET-CLASS moons specifically (the ~3.5% Step 8b
   touches)? 8b's gate allows Instrument B to diff ONLY on those, enumerated. Can the current fence
   even express that? If not, what does it need?`,
  },
  {
    key: 'numbers',
    label: 'recon:verify-the-load-bearing-numbers',
    prompt: `${PREAMBLE}

LANE 4 — RE-MEASURE EVERY NUMBER STEP 8 IS SOLD ON. This lane exists because the plan's own §2
carries two figures that DO NOT REPRODUCE and are kept only as "the claim being corrected".

Verify each of these, independently, and report REPRODUCES / DOES NOT REPRODUCE with your method,
your population definition, your seed, and your measured value:

a. "surfaceGravity over the whole moon population lies in [0, 3] g" is the TARGET. Today the same
   bodies fabricate 10.4 / 14.1 / 56.3 g, and an 11 km Phobos-class body derives 346,021 g.
   -> Measure the CURRENT distribution of derived surfaceGravity across a fully specified moon
      population (state exactly how you generated it and how many bodies). Report min, median, max,
      the count above 3 g, and the worst offender with its radius. Find the 346,021 g body or say
      you could not reproduce it.
b. "Sol's Moon derives 13.42 g today, target 0.165 +/- 0.01 g." -> measure today's value.
c. "MoonGenerator.js:278 generates every planet-class moon at PlanetGenerator.generate(rng, 1.0, ...)"
   and "T_eq 254.588 at 1.0 AU vs 43.033 at 30 AU (5.9x)". -> verify the call site and re-derive both
   temperatures.
d. "This affects the ~3.5% of moons that already reach Planet.js today." -> measure the real fraction
   and say what "reach Planet.js" means operationally (which code path decides it).
e. "8b is draw-stream NEUTRAL: over 400 forced-type seeds, 0/400 altered the post-generate draw
   stream and 0/400 altered radiusEarth, because retained never flips." -> this is the claim that
   makes 8b safe. Try hard to BREAK it. Report your seed count and any counterexample.
f. "atmoPhysics.retained is true 323/323 over 323 generated planets, so PlanetGenerator.js:526's &&
   short-circuits zero times today." -> re-measure over a LARGER population and report the fraction.
   A dormant-but-armed conditional that fires even once changes the hazard analysis.

For any figure that does not reproduce, say what the correct number is and whether the DIRECTION of
the plan's argument survives.`,
  },
  {
    key: 'provenance',
    label: 'recon:provenance-and-moon-population',
    prompt: `${PREAMBLE}

LANE 5 — _provenance, THE MOON POPULATION HARNESS, AND THE REMAINING GATES.

Step 8a's gates include: "_provenance reports zero 'defaulted' entries for
massEarth/age/T_eq/surfaceHistory on >=500 sampled moons" and "Zero moons produce a truthy
atmosphere with undefined pressure".

Produce:
1. What is \`_provenance\`? Where is it produced, what are its possible values ('defaulted' and what
   else), and which fence guards it? Quote file:line. Read tests/port-condition-contract.test.js's
   KNOWN LIMITS block, which the plan says records constructible bypasses.
2. Is there an EXISTING harness that samples >=500 moons? Name it (a test, a tool, a fixture
   generator) with file:line, or say none exists and describe the cheapest correct way to build one
   from what is already in the repo. Do NOT write it — describe it.
3. Measure TODAY's baseline for both gates: how many of a 500+ moon sample currently report
   'defaulted' for each of massEarth / age / T_eq / surfaceHistory, and how many moons today produce
   a truthy atmosphere with undefined pressure. These are the before-numbers the step is scored
   against.
4. Ledger C2/C3 in docs/FEATURES/one-pipeline-two-frontends-CARRIED.md are both marked "clears at
   Step 8". Read them and state precisely what Step 8 must do to clear each, and whether the plan's
   Step 8 text actually does it. If it does not, that is a finding.
5. §11.7 says the route-agreement gate becomes LIVE at Step 8 (moons give conditionFromBody a second
   generator path, so value divergence between routes becomes constructible again). Read
   tests/port-route-agreement.test.js and say exactly what has to change there for that to be true,
   and what happens if nobody touches it.`,
  },
]

const RECON = await parallel(LANES.map((l) => () =>
  agent(l.prompt, { label: l.label, phase: 'Recon', model: 'opus', effort: 'high' })
    .then((text) => ({ key: l.key, text }))))

const good = RECON.filter(Boolean)
log(`recon: ${good.length}/${LANES.length} lanes returned`)

const DOSSIER = good.map((r) => `\n===== LANE ${r.key.toUpperCase()} =====\n${r.text}`).join('\n')

phase('Refute')

const REFUTERS = [
  {
    label: 'refute:append-never-splice',
    prompt: `${PREAMBLE}

YOUR JOB IS TO REFUTE, NOT TO CONFIRM. Default to "the claim is wrong" and make the recon prove
otherwise. Below is what five recon lanes reported for Step 8.

TARGET: the "append, never splice" doctrine and the draw-stream safety argument. Specifically try to
show that a correctly-written Step 8a implementation STILL disturbs the RNG stream, or that the
proposed byte-identity gate CANNOT SEE a disturbance that happens.
Attack angles (use any, add your own):
- Does the moon record's own consumers re-enter the rng after generate returns?
- Do the new derivations need a value that is only obtainable by calling something that draws?
- Is the "append after the last draw" point actually after ALL draws on EVERY branch, including
  non-plain paths and early returns?
- Can a change to _pickType / the type table / zone mapping be made accidentally by an author
  following the file's own idioms (PLAN §11.9's amended D clause)?
- Would a whole-record hash actually catch a re-roll of noiseScale, or is noiseScale absent from the
  hashed record?
Report each attack as REFUTED (the claim survives, here is the evidence) or CONFIRMED BREAK (here is
the construction and the file:line). Measure where you can.
${DOSSIER}`,
  },
  {
    label: 'refute:8b-value-not-universe',
    prompt: `${PREAMBLE}

YOUR JOB IS TO REFUTE, NOT TO CONFIRM. Default to "the claim is wrong".

TARGET: Step 8b's central safety claim — that fixing MoonGenerator.js:278's hardcoded 1.0 AU is a
VALUE change and not a UNIVERSE change (draw-stream neutral, radiusEarth unchanged, because
\`retained\` never flips). If that is wrong, 8b regenerates the galaxy and is a completely different
commit.
Attack angles:
- Find ANY seed or orbit radius where the real distance flips a conditional in PlanetGenerator that
  the 1.0 AU value did not. Search hard at extremes (very close in, very far out, hot stars, cold).
- Does T_eq feed anything that BRANCHES rather than scales? Trace it.
- Does composition or iceness feed a conditional draw?
- Is 'retained' the ONLY conditional in that path, or just the only one recon looked at? Enumerate
  every conditional in the post-generate assignment block.
- Does the golden-trajectory harness or any committed fixture pin values that would move?
Report REFUTED or CONFIRMED BREAK per angle, with seeds and numbers.
${DOSSIER}`,
  },
  {
    label: 'refute:gate-deadness',
    prompt: `${PREAMBLE}

YOUR JOB IS TO REFUTE, NOT TO CONFIRM. Default to "this gate is dead".

TARGET: every gate Step 8 declares. Read PLAN §11.1's class D ("a dead gate: a gate the step NAMES
cannot fail on its own declared subject — vacuous, self-referential, subject outside its watched
set, or the next declared step's own move can be written past it BY AN AUTHOR FOLLOWING THE FILE'S
OWN IDIOMS") and §11.9's amendment, then apply it to each of Step 8's gates in turn:
  - the widened Instrument B byte-identity hash
  - the per-type draw-count assertion
  - the _provenance zero-'defaulted' assertion
  - the surfaceGravity in [0,3] g population assertion
  - the Sol's-Moon 0.165 g regression fixture
  - the "zero moons with truthy atmosphere and undefined pressure" assertion
  - 8b's committed delta table
For EACH: can it pass while the thing it protects is broken? Name the construction. Then name the
mutation that would prove it bites, drawn from STEP 9's declared first move where possible (§11.3.1
requires at least one mutant from the next step's first move). Be concrete: file, line, edit.
Also: is any of these gates measured against a control that could not move? That is this codebase's
signature failure and it has occurred at least three times.
${DOSSIER}`,
  },
]

const REFUTATIONS = (await parallel(REFUTERS.map((r) => () =>
  agent(r.prompt, { label: r.label, phase: 'Refute', model: 'opus', effort: 'high' })))).filter(Boolean)

log(`refute: ${REFUTATIONS.length}/${REFUTERS.length} lanes returned`)

phase('Synthesise')

const plan = await agent(`${PREAMBLE}

You are the SYNTHESISER. You have five recon lanes and three adversarial refutation lanes below.

⛔ WEIGH, DO NOT AVERAGE. A lane reporting "0 errors, exactly the ideal" has, in this repo's history,
turned out to be reporting a metric that was a tautology of its own model. If a lane's happy result
rests on a measurement it defined itself, say so and discount it. If two lanes disagree, decide
which one measured and say why — do not split the difference.

Write a BUILD PLAN for Step 8 that a fresh implementer can execute. It must contain:

1. VERDICT ON THE PLAN'S OWN CLAIMS — a table: claim / REPRODUCES / corrected value / does the
   plan's argument survive. Every number Step 8 is sold on.
2. CONFIRMED BREAKS — anything the refuters actually broke, with the construction. If they broke
   nothing, say so plainly and say which attacks were run, so "nothing found" is a fact about
   coverage rather than about effort.
3. THE COMMIT SHAPE — an ordered list of commits, each with: what it changes, why it is its own
   commit, and the gate that must be green before the next one starts. Say explicitly where the
   widened Instrument B hash is RECORDED versus where it is CHECKED, because recording it after the
   change makes it vacuous.
4. THE RENAME DECISION — file+function, or function only. With the citation cost in numbers.
5. THE GATE LIST, REWRITTEN — for each of Step 8's declared gates, either keep it, repair it (say
   how), or replace it (say with what), based on the deadness lane. Each gate needs a named mutant
   that makes it fail.
6. THE ORDER OF OPERATIONS FOR 8a's BYTE-IDENTITY — spelled out step by step, so the gate can fail.
7. OPEN QUESTIONS FOR MAX — only decisions that are genuinely his (taste, scope, anything that
   changes what MVP means). Technical calls are yours; make them and say what you chose. Max's
   standing criterion, in his words: "What I care about is being able to use the systems that we
   created for world engine in the main well-dipper game. I want to make this as optimized and
   well-architected as possible." He does NOT want to be asked things an agent can decide.
8. WHAT IS STILL UNMEASURED — an explicit list. Do not let a gap hide inside a confident plan.

Be concrete: file:line throughout. Numbers, not adjectives.
${DOSSIER}

${REFUTATIONS.map((t, i) => `\n===== REFUTATION LANE ${i + 1} =====\n${t}`).join('\n')}`,
  { label: 'synthesise:step8-build-plan', phase: 'Synthesise', model: 'opus', effort: 'high' })

return { lanes: good.length, refutations: REFUTATIONS.length, plan }

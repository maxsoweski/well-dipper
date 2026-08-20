# Handoff 2026-08-20 — ▶ **NEXT = B2. The plan is written, the rulings are made, execute it.**

**HEAD:** `4da71d1` · **Branch:** `feature/world-engine-production-L1` · tree **CLEAN** · **fully pushed**
**Repo:** `~/projects/well-dipper`

> ⭐ ~700 untracked PNGs and `scratchpad/` are normal. ⛔ **NEVER `git add -A`.**
> ⛔ Do NOT invoke `library-context` — the SessionStart hook nags about an unrelated project.

---

## 0. THE ONE THING TO DO

**Execute [`comprehensive-wiring-plan-2026-08-20.md`](comprehensive-wiring-plan-2026-08-20.md) from
B2 onward, via workflows.** Max: *"continue the implementation plan via workflows in a new session.
Make sure we stay on track with the plan."*

B0 and B1 shipped this session. **The plan is the execution order — do not re-derive it, do not
re-scope it, do not write another plan.** Its §1.1 carries the rulings, §2 the blocks in order, §6.1
every remaining stop.

---

## 1. ⭐⭐ THE THING MAX SAID LAST, AND IT OUTRANKS EVERY TECHNIQUE BELOW

> *"I honestly cannot tell the difference... you are throwing too much detail at me at once."*

**He is right and it was a real cost.** This session repeatedly handed him dense measurement dumps
plus a four-item open-items block at the end of every message. He is the UAT gate for a program whose
gates are all visual — overloading him degrades the one instrument no agent can replace.

**Rules for the next session, non-negotiable:**
- **One question at a time.** Not four. If two things need him, ask the blocking one and hold the other.
- **No measurement dumps in user-facing text.** Numbers belong in commits and docs. He needs the
  decision, the options, and what each causes.
- When he says he cannot tell a difference, **that is data** — take the conservative branch and move
  on. Do not re-explain the measurement.
- ⛔ Do not open a response with praise or affirmation (`feedback_zero-affirmations`).

---

## 2. RULINGS — SETTLED THIS SESSION. ⛔ DO NOT RE-LITIGATE.

**Eleven of the fourteen** in the plan's §1.1 were adopted by Max ("go ahead with your
recommendations"): D-1, D-2, D-3, D-4, D-5, D-8, D-10, D-11, D-12, D-13, D-14-promote-half. They are
recorded in §1.1 as decisions, not open questions. Read them there.

**Ruled this session, on top of those:**

| | ruling |
|---|---|
| **D-6** | ⭐ **F4 canyons → B5**, not B3. Max looked at the B0 shots: *"I honestly cannot tell the difference."* Conservative branch taken; the quality strand gets it behind a spike. |
| **D-7** | ⭐⭐ **THE WS3 HOLD IS LIFTED** (`5b1099b`). Max: *"lift per your rec."* Recorded in `docs/NOW.md` as **satisfied, not retracted**. **WS3 may start. ⛔ SHIPPING WS4 IS NOT IMPLIED** — AC2/AC3/AC4 are still `INSUFFICIENT` and increment 2 is unbuilt. |
| **increment 1 UAT** | ⭐ **PASSED** (`cda0b5b`), Max verbatim *"I just did the UAT and it seems passable"* — recorded qualified, not upgraded. Closes an AC5 that read `deferred-to-max` since 2026-06-25. |

**STILL MAX'S, and only two remain:**
1. **D-9 — QB-6 pigment: green or dark?** `BIO_PIGMENT = [0.10, 0.16, 0.06]`
   (`surfaceMaterial.js:155`) darkens the disc; his complaint asked for green. ⭐ **No shot exists —
   offer to take one so it is a look, not an abstract call.** ⛔ Its coverage half (0 on 97.9% of 1156
   non-gas bodies, max 0.011535) is a SEPARATE unit and must not ride on the pigment answer.
2. **D-14's retirement half** — `PLAN.md:715` reserves retiring a CARRIED row to Max. Promotions were
   made; the retirement candidates are parked with evidence.

---

## 3. ⭐ NEW WORK MAX ASKED FOR — not yet in the plan

> *"as we add detail to the game we'll want to be able to add additional levels/make this less
> posterized. Can we work that in?"*

**Make the posterize level raisable.** In the lab it is already a uniform (`uLevels`,
`src/worldengine/shaders/uniforms.js:32`, value 6.0). In the game it is **hard-coded as the literal
`6.0` at four sites** — `src/objects/Planet.js:560`, `:944`, `:1279`, `:1881`, each
`posterize(finalColor, 6.0, gl_FragCoord.xy, 0.4)`. The work is: replace the four literals with a
uniform, put it behind a setting. Small and self-contained. **Add it to the plan as its own block —
it was promised and is not yet written down anywhere but here.**

**Why it matters** (measured this session, one identical 361×361 box): uLevels 6 → **34 distinct
colours**; uLevels 64 → **804** (23.6×). Removing the retro pixel grid instead moves 34 → 50 (1.5×).
**The quantum, not the pixelation, is what compresses colour.** Relief is not capped the same way.
⭐ This is why the plan's ordering favours relief over colour — if the ceiling lifts, that changes.

---

## 4. ⛔ WHAT IS TRUE ABOUT THIS CODEBASE THAT COSTS A SESSION TO REDISCOVER

- ⭐⭐ **`deriveUniforms(` HAS ZERO CALL SITES IN `src/`.** 39 occurrences: 36 in `tests/`, one in
  `planet-lod-lab.html`, and the single `src/` hit is a COMMENT. **The game does not run the lab's
  derivation layer — it runs the four packs.** `ROCKY_SURFACE_UNIFORMS` (`rockySurface.js:515`) is
  **21 names**. No pack writes `uLavaActivity`, `uCryoActivity`, `uOutflowDensity`, `uDustDepth`.
  ⛔ **So "wiring a feature" means AUTHORING A PACK DRIVER, not fixing an input.** A healthy law in
  `labCore` reaches no pixel. Every "unblocks N features" figure is a forward price.
- ⭐ **`giantDeck` is missing the noise-offset writer.** All 103 swapped gas bodies draw their base
  height field from the SAME three offsets (`uniforms.js:158` answers literally `(0,0,0)`), read with
  no composition gate before the pixel (`heightNoise.glsl.js:101`). **This is "they all look
  identical" on the gas half**, invisible to every algebraic gate. Ledger **P-13**, `blocking`,
  denominator 103 of 266. A small, high-value fix nobody has scheduled.
- ⭐ **`encodeValue` compares a `THREE.Vector3` against a `THREE.Color` and they never match**, however
  identical the floats. Four of ten "every-body divergences" are that container split. Both readings
  are deliberately kept — it is the SUBJECT-SET instrument. See ledger §0 / P-12.
- ⛔ **Instrument C cannot currently evaluate anything.** `port-uniform-delta:check` exits 2,
  POPULATION MISMATCH — the generated bodies moved. **PRE-EXISTING** (moon window `34b502d`), verified
  by re-running with edits stashed. B1's stated byte-identity gate is **UNEVALUATABLE, not passed**.
  ⚠ A shipped comment claimed it passed; corrected at `conditionFromBody.js:763`.
- ⛔ **Instrument A stays red** — B1 added `tests/root0-seam-laws.test.js`, which moves A's
  collected-file set, and that run was forbidden to re-record. Someone must re-record with a named reason.
- ⚠ **`ringConic.frontarc f8` is a load-dependent timeout flake** producing a phantom 33rd failure.

---

## 5. GATES — the numbers to beat, verified BY HAND at `4da71d1`

| gate | value | how |
|---|---|---|
| failing set | **32**, md5 `2be0e6a9de7be79b5d8c23e0958d2b1c` | ⭐⭐ **MEMBERSHIP diff, `comm` BOTH ways. NEVER a count.** |
| citations | **600 CHECKED**, exit 0 | a DROP means refs stopped being READ; repair BY SYMBOL, never by offset |
| line counts | PLAN.md 869 · CHARTER 134 · ledger 400 · labCore 1264 · conditionFromBody 898 · port-uniform-delta 2082 | ⭐ **~30 refs address PLAN.md BY LINE. EXPAND a line, NEVER insert one.** |

The 32 are **RED BY DESIGN** (moon-formation window `34b502d`, owned by B7). ⛔ Not defects. Do not fix,
do not re-bless. Baseline set lives in the session scratchpad; regenerate it at HEAD if absent.

⛔ **NEVER re-record a baseline** without a named reason Max has seen.
⛔ **"deferred" is not a legal ledger ruling** — §2 defines exactly three. A deferral lives in EVIDENCE.

---

## 6. STATE + GOTCHAS

- ⛔⛔ **SOL CANNOT VALIDATE PROCGEN.** Use `_lab.spawnProceduralSystem(seed)`. Standard corpus
  `lab-procedural-0…199` = **1517 bodies** (852 planets + 632 plain moons + 33 planet-class; 1160
  non-gas / 357 gas). ⭐ **Every number carries its corpus** — the same population reads 632 or 770
  depending on which.
- ⛔ A dev server is **already running** on `:5173` serving this tree (up since Aug 14).
  **NEVER start one.** ⛔ **RELOAD (ignoreCache) before every browser measurement** — HMR-duplicated
  module state has faked a reproducible defect here.
- ⛔ `_lab.resolveBody` ignores `planetIndex`/`starIndex` — working keys are `p` and `m`.
  `_lab.frameBody(subject, opts)` — **radii goes in the SECOND arg**.
- ⛔ Chrome pages are **visible windows on Max's desktop**. Reuse the existing page, close what you
  open, and leave `localStorage['wd.labGasBodies']` **removed** so the next reader gets the default.
- ⛔ `LAB_GAS_BODIES_DEFAULT = false` (`Planet.js:2153`) — nothing reaches a player until **B7**.
- ⛔ `npm run check:conic-gl` needs the sandbox DISABLED; it FATALs otherwise and looks like a real failure.
- ⛔ Push with the sandbox **disabled** and verify with `git ls-remote` — this repo lies with
  "Everything up-to-date" above ~10 MB in-sandbox. **Confirm before pushing; Max says when.**
- The B0 shots (31 files, read `CAPTIONS.txt` first) are in the session scratchpad — **ephemeral**.
  Copy anything durable into `screenshots/` before it evaporates.

---

## 7. WHAT SHIPPED TODAY — read the commit messages, they carry the evidence

| commit | |
|---|---|
| `aa8bd1a` | **Step 10b/c** — plain moons through the pipeline; **Instrument D closed live** (449 frames, 0 exceptions) |
| `e6c1ea4` | **R-07 NOT closed** + three measured blockers; R-07 ledger evidence corrected; the r-rows decision packet |
| `0809950` | R-06 ledger evidence corrected — the ocean worlds are **dry**, and wiring cannot fix that |
| `cda59df` | **the comprehensive wiring plan** — 14 rulings, 9 blocks, 7 stops |
| `1777781` | the 48-feature inventory by queue |
| `cda0b5b` · `5b1099b` | increment-1 UAT passed · **the WS3 hold lifted** |
| `4da71d1` | **B0 + B1** — map repaired, ledger re-measured, law seam fixed |

---

## 8. SUGGESTED SKILLS

- **Workflow tool** — the lane's method and Max asked for it by name. ⛔ **Pin `model: 'opus'` on every
  agent** (omission inherits Fable at 2× cost). Brief each with the ACTUAL HEAD and what already
  shipped. The shape that works: *recon in parallel → build sequentially → hostile review lenses in
  parallel → confirm-or-kill each finding → repair only survivors*, with a `proceed` flag so a failed
  stage halts the chain. ⭐ **Serialize any browser stage to ONE agent** — parallel agents fight over
  Chrome. ⭐ Escape backticks inside template literals or the script will not parse.
- **`superpowers:verification-before-completion`** — every agent report this session was re-run by
  hand before commit, and doing so caught a false "Instrument C passed" claim in shipped source.
- **`superpowers:test-driven-development`** — prove a gate by reverting the fix and confirming the
  *specific* assertion reds. Two gates shipped dead this session and hostile review caught both.
- **`superpowers:systematic-debugging`** — for anything that looks like a rendering defect.
- ⛔ **`dev-collab-scope` is NOT needed** — the work is already scoped in the greenlit plan.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, **never `/tmp`**. `NOW.md` still points at
  a dead `/tmp/handoff-…-2026-06-25.md`; that is why.

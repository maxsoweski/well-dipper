# Handoff 2026-08-25 (evening) — ▶ THE MERGE GATE IS MET. NEXT IS MAX'S, NOT CODE'S.

**HEAD** `57e5fed` · **Branch** `feature/world-engine-production-L1` · **tracked tree clean**
**Repo** `~/projects/well-dipper` (lane A's branch, **NOT** master) · lab at **6559 lines**
⛔ **~700 untracked PNGs are normal. NEVER `git add -A`.**

> This SUPERSEDES `handoff-2026-08-25-crater-wire-next.md`. That document's ▶ NEXT (the crater wire)
> and its §4 (emission-e) are both **done and committed**. Read this one.

---

## 0. ✅ PUSHED AND MERGED 2026-08-25 — this section is CLOSED, kept for the record

Max authorised both. `origin/feature/world-engine-production-L1` and `origin/master` are both at
**`7d3eeb6`**. ⛔ But read §0b — the deploy the master push triggered FAILED. The command was:

```bash
git push origin feature/world-engine-production-L1     # sandbox OFF; verify with git ls-remote
```

Pushing this BRANCH is safe. ⛔ **Pushing `master` AUTO-DEPLOYS** to `welldipper.maxsoweski.com` —
`.github/workflows/deploy.yml` is `on: push branches [master]`, no staging step between merge and live.

## 0b. ⛔⛔ THE MERGE SHIPPED. THE DEPLOY DID NOT — AND THE CAUSE IS NOT IN THIS REPO.

`master` is at **`7d3eeb6`** on GitHub (clean fast-forward, 790 commits, pushed 2026-08-25). The
Pages deploy that push triggered **FAILED at `actions/checkout@v4`, before `npm ci` or `npm run build`
ever ran** (run `32908280295`).

```
repository 'https://github.com/maxsoweski/motion-test-kit.git/' not found
clone of '...' into submodule path 'vendor/motion-test-kit' failed
```

⭐ **THE LIVE SITE IS FINE.** `welldipper.maxsoweski.com` returns HTTP 200 and still serves the
2026-08-01 build — GitHub Pages keeps the last successful artifact when a run fails. Nothing is
broken; the site simply did not update.

**MECHANISM, certain:** `vendor/motion-test-kit` is a git submodule pointing at
`maxsoweski/motion-test-kit`, and that repo is **PRIVATE**. `actions/checkout` authenticates with the
default `GITHUB_TOKEN`, which is scoped to well-dipper alone and cannot read a second private repo —
GitHub answers 404, hence "not found" rather than "permission denied". **No repo secrets are
configured** (`gh secret list` is empty), so there is no credential in place to fix it with.

**TIMELINE, which rules this repo out as the cause:** `.gitmodules` and the workflow's
`submodules: recursive` were BOTH already present at `6c4f49e`, the master that deployed successfully
on 2026-08-01. The kit repo's `updatedAt` is **2026-08-13**. So the breakage arrived between 8/1 and
today, on the OTHER repo, and stayed invisible because master was stale for 24 days and nothing
deployed. ⛔ **Today's push did not break the deploy; it is what FOUND it broken.**

⚠ **THE SUBMODULE CANNOT SIMPLY BE DROPPED FROM CHECKOUT.** It is not test-only tooling — the
PRODUCTION bundle imports it three times: `src/main.js:100-101` (accumulator, three-loop-binding),
`src/objects/Planet.js:6` and `src/util/scene-naming.js:20` (`fnv1a`). Removing it from checkout
turns a failed deploy into a failed build.

**THREE FIXES, all needing Max:**
1. **Make `maxsoweski/motion-test-kit` public again** — one click, restores exactly the state that
   deployed on 2026-08-01, zero changes to this repo. Only viable if the kit need not stay private.
2. **Add a deploy key or PAT as a repo secret** and pass it to `actions/checkout` — keeps the kit
   private. He mints the credential; the workflow edit is one line.
3. **Vendor the kit in directly** (de-submodule; it is 592K at `175a998`). ⭐ The only option that
   removes the failure MODE rather than the instance — a deploy that silently depends on a second
   repo's visibility flag broke without anyone touching well-dipper. Costs the shared-tooling link,
   which matters only if the kit is used by other projects.

## 1. WHAT CLOSED TODAY, AND WHY IT MATTERS

Max, this morning: *"I want Welldipper and the World Engine to be wired together, so they share the
same rendering pipeline/tech"* — and separately, *"I don't wanna be, like, a month ahead of live with
a bunch of changes and not be considering when we're going to merge."*

⭐⭐ **HIS MERGE GATE IS `ledger <= 2` WITH HONEST `clears` TEXT. THE LEDGER IS NOW AT 2, SLACK 0.**
`master` is 24 days stale; this branch is **790 ahead, 0 behind** — a clean fast-forward. Nothing in
the code is now blocking the merge. **The remaining decision is his.**

Three commits:

| commit | what |
|---|---|
| `e9c2ad7` | the crater wire — `rockySurface` + `craterDeck` called at `:2880`, ten inline lines neutralised. **Ledger 6 → 3** |
| `777ea5a` | `EMISSION_PHYS` imported; three constants stop being lab literals. **Ledger 3 → 2 — the gate** |
| `57e5fed` | the crater SHAPE fix Max approved — d/D is size-invariant again |

## 2. THE TWO ROWS THAT REMAIN, both carried past the merge BY DESIGN

- `drivers/index.js` — the lab applies packs through `applyDriverPacks` rather than calling each. A
  composition question, not a divergence.
- `shaders/craterRelief.glsl.js` — a DECLARED divergence. Clears when Max rules the three departures
  permanent (→ `GAME_ONLY_BY_DESIGN`) or the lab adopts the merged combiner. **That ruling is his.**

⚠ **The row's `clears` text cites `tests/crater-relief-transcription.test.js`, WHICH DOES NOT EXIST.**
The real fence is the transcription block inside `tests/crater-uniform-law.test.js`. Fix the text
before anyone acts on it — this is the second row today whose stated blocker turned out to be fiction.

## 3. ▶ WHAT IS ACTUALLY NEXT — THREE A/B KEYS, AND THEY ARE MAX'S GATE

`feedback_showcase-by-parking-the-live-game`: **a bare key flipped while moving, never screenshots.**

1. **terrain frequency** — `uNoiseScale`. ⭐ The lab has **never set it**; it sits at the factory 4.0.
   ⚠ **AND THE CRATER WIRE DID NOT CHANGE THAT** — a natural misreading now that `macroWavelength.js`
   has left the ledger. `uNoiseScale` is **exclusion 5** in `ROCKY_SURFACE_LAB_BINDING`
   (`rockySurface.js:441`) because the lab holds no state field for it. What closed is the IMPORT;
   the WRITE is still open, and adopting it moves all 13 non-gas presets, three by 40–110×.
2. **crater size** — `CRATER_VIS_FLOOR_RAD`, KeyJ, **9.6e-4 (shipped) vs 3.823e-3**. ⭐ **Its
   blocker is gone** — `57e5fed` fixed the spike shape, so he now judges size on correct craters.
3. **ejecta appearance** — the `strength + amp + lump` family, ~113×. ⛔ Closes together or not at
   all: binding one factor of the shader's product moves the lab FURTHER from the game.

## 4. WHAT THE NEW INSTRUMENT IS FOR

`tools/crater-wire-seam-probe.mjs` — 104 solid body-seeds × 15 mirrored names, 40 gas × 6, mirror vs
the lab's inline lines at **both** the state and the uniform layer. Re-run it before touching either
pack. ⭐ Its gas-half control is NOT a perturbed condition and must not be turned back into one:
`craterUniformsFrom` returns a frozen `CRATERS_OFF` across that whole domain, so a law-based control
there is structurally dead and prints a vacuous zero.

## 5. TRAPS THAT COST REAL TIME TODAY — all four are new instances of known ones

1. ⛔⛔ **A BACKTICK IN A GLSL TEMPLATE LITERAL, HIT AGAIN.** Writing symbol names in `backticks`
   inside `craterRelief.glsl.js` terminated the string. Caught in seconds only because the module was
   import-checked immediately. **The GLSL comment convention in this repo is NO backticks.**
2. ⛔ **`tests/vis-scale-fence.test.js` bans the display-scale token from every file under
   `src/worldengine/**` INCLUDING COMMENTS.** Naming it in a shader comment reds five assertions.
3. ⛔⛔ **THREE SABOTAGE PROBES, TWO OF THEM VACUOUS.** Nulling `state.craterOffset` across a preset
   change reports nothing (`updateSeedUniforms` repopulates it to `[0,0,0]` first). Calling
   `_lab.riversReroute()` reports nothing either (`:2986` early-returns unless the ribbon overlay is
   enabled). **Enable the overlay, leave the preset alone.** ⭐ And the strongest arm was positive,
   not negative: `state.craterAmp` now has exactly one writer, so poisoning it and watching a route
   restore it cannot be explained by anything else.
4. ⚠ **EDITING A SHADER SHIFTS LINE-ANCHORED CITATIONS, INCLUDING THE ONES YOU JUST WROTE.** Three
   round-trips of `port-uniform-delta:citations` today. Repair by LOCATING each symbol, never by
   bumping the integer.
5. ⚠ **A STALE WORKFLOW WORKTREE IS IN THE TEST PATH.** `.claude/worktrees/wf_440dc97c-63b-4` sits at
   the old `47170f9` and doubles a bare `npx vitest run` to 680 files. `npm run test:baseline` and
   `test:body-identity` already exclude it; nothing else does. It is safe to delete but was left alone.

## 6. WHAT THE SPEC GOT WRONG, so the next reader does not inherit it

The crater-wire spec called `ejectaRampart`'s divergence "inert, since `uEjectaStrength` 0 early-outs
the pass." **Measured: all 27 disagreeing rows have `uEjectaStrength` between 0.12 and 0.495.** The
conclusion held — it renders on zero rows — but via `craterRelief.glsl.js:164`'s `uCraterDensity <= 0`
early-out instead. ⭐ **Right answer, checkable-and-false mechanism.** Check the mechanism, not just
the verdict.

## 7. ⛔ THE INSTRUMENT-A BASELINE IS STALE AND WILL MISLEAD

`scripts/test-baseline.mjs` compares against **31 failed / 6 files**, recorded from a DIRTY tree.
Reality is **36 failed / 8 files, 15 non-collecting** — the two deliberate generation changes (the
binary-companion channel `34b502d` and the ocean-world change), which clear with **ONE** re-bless.
**That 36/8 is the expected reading; anything else is drift.** Today's three commits were each
verified against it and added nothing.

⛔ Before the re-bless: run the four known flaky tests (`GalacticFeatures`,
`worldengine-inc3b-composite-budget`, `ringConic.frontarc`, +1) **in isolation**, or a random failure
gets frozen in as permanently expected. And `test:body-identity:rebless` is **INCOMPLETE** — it
rewrites only the JSON; three failing values are hardcoded literals in the test source at `:687`,
`:288-293`, `:777-780`.

## 8. WORKING WITH MAX

⭐⭐ **Read `feedback_director-level-recaps.md` IN FULL before any end-of-turn summary** — from the
file, not `MEMORY.md`'s gloss. **Run the CUT TEST**: delete everything above the asks; do they still
stand alone? He is the director, does not read code, cannot reconstruct context mid-decision.

⛔ He noticed oscillation: *"you keep going back and forth on this."* Once he reaffirms a decision it
is made — build it, and fix what is in the way rather than re-asking.

⚠ **Do not ask subagents to write for Max.** They produce something that looks finished and gets
forwarded with its jargon intact. Ask them for facts; the translation is yours.

## Suggested skills

- **`superpowers:verification-before-completion`** — the whole method today was that a green gate is
  not evidence until a sabotage probe proves the thing is live.
- **`superpowers:systematic-debugging`** — traps 1 and 3 above are both debugging failures wearing a
  green suite.

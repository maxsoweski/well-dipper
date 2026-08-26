# Planet feature refinement campaign — design

**Date:** 2026-06-09 · **Project:** `~/projects/well-dipper` · **Branch:** `master`
**Type:** Campaign methodology spec (the *how we work*, not a single feature).
**v2 (2026-06-09, approved):** execution model changed to an end-to-end
autonomous `/goal` chain — §13 supersedes §3 Stream B and amends §4/§6; §§5,
7–11 stand. Max's gate moves to a batched final review lap.
**Lab surface:** `world-engine-lab.html` (`window._lab`). Scope = lab only; wiring
into the production game (`src/objects/Planet.js`) is a separate later effort with
no parity goal.

**Serves:** SCREENSAVER-MVP visual polish — `HEART_OF_DESIRE.md` defines MVP
success as *"visual polish at the level Max would be proud to share,"* and
planets/moons are the **hero objects** on screen (especially the screensaver
MVP). Also serves the meta-purpose: the refinement *apparatus* built here is a
reusable Claude-Code-driven dev capability (see §9 Reusability).

---

## 1. Problem

We finished **F11 (fluvial rivers)** with full F11-ceremony, and it surfaced a
bigger realization: the **whole** planet/moon feature set needs the same
deliberate attention. A mix of stuff working well and stuff that isn't, built
ad-hoc over many sessions. We want to go back over **every** feature and refine
each one against real-world + art reference, in sequence, so lessons from one
propagate to the next.

The catalogue already exists (`docs/FEATURES/planet-visual-features.md`,
L0→L1→L2). What's missing is a **method**: a repeatable per-feature loop and the
research inputs that make each loop convergent instead of a taste-argument.

## 2. What's already built (the real starting state)

Per `planet-lod-campaign-tracker.md`, a lot is already in the lab:

- **Relief F1–F10** (mountains, craters, ejecta, canyons, scarps, plateaus,
  tessera, edifices, lava, chaos, ridged-icy) — ✅
- **Cryo/volatile F17, F18, F22, F23** (glacial, sublimation, polar caps, frost
  mask) — ✅
- **F11 fluvial** — ✅ (pending Max UAT)
- ▶️ parked on **F12 (deltas)**; F13–F53 still ⬜/🟡.

So this is substantially a **re-examination of already-built features**, not a
build-from-scratch. The existing tracker was a *completion* campaign ("build the
unbuilt features, F12 onward"). This campaign **supersedes and absorbs it**: one
unified loop over the whole set, built and unbuilt.

## 3. The campaign — two streams

### Stream A — Research (parallel, front-loaded)
A multi-agent **Workflow** fans out **one agent per in-scope L2 feature**, each
returning a structured **research dossier** (the top half of that feature's
card — §5 sections 1–6). Runs in the background; non-sequential; front-loads the
hardest part for every feature at once.

### Stream B — UAT refinement (sequential, with Max) — SUPERSEDED by §13 (v2)
We walk features **in build-sequence / dependency order**, foundation first.
Each feature's UAT is human-paced and slow. Because Stream A's agents run fast
and in parallel, **all dossiers are ready long before Stream B reaches even
feature 2** — by the time we work feature N, its dossier is waiting.

The two streams compose on timing: launch A (after the schema is locked), then
begin B; A completes in the background.

## 4. Order and depth

Two different questions, answered by two different mechanisms:

- **Order = dependency / build-sequence.** Features physically share machinery —
  the per-fragment `xxxCombiner(vPos,h,grad)` adders, the `canyonHeight`
  accumulator, the posterize/4×4-Bayer envelope, analytic lighting. Fix relief's
  lighting and fluvial inherits the fix. So lessons **propagate down the chain**;
  walking in dependency order maximizes that.
- **Depth = triage rating, folded into each feature's UAT opening.** No separate
  triage lap. Each feature's UAT *opens* with a quick rate-vs-reference:
  - 🟢 reads right already → quick-confirm, no change (a 2-minute "yep").
  - 🟡 close but off → **light loop** (§6).
  - 🔴 wrong → light loop if fixable, else flag for **heavy loop** rebuild.
  - ⬜ unbuilt → **heavy loop** (greenfield build).

**Foundation first.** Before any feature, UAT the substrate everything inherits —
base FBM continents, the lighting model, the posterize/dither envelope, the LOD
ramp (`F50`, `F53`, and the Stage-A foundation). Feature tweaks cannot compensate
for a wrong substrate, so it gets its own UAT pass at the front.

## 5. The feature card — the unit of work

**One file per feature**, `docs/FEATURES/cards/F##-<slug>.md`. The workflow fills
the top (research, §§1–6); UAT fills the bottom (§7). The dossier and the verdict
log are the same artifact, not two.

```
# Feature Card — F## <name>
Domain: <relief/fluvial/…> · Lab status: ✅/🟡/⬜ · Build-seq pos: N
Derives from: P##/D## (from planet-visual-features.md)

## 1. Description (WHAT)
   From planet-visual-features.md: the feature, its variants, real-body examples.

## 2. Current shader approach (HOW, as-built)
   How it's implemented in world-engine-lab.html TODAY — file:line to the combiner,
   its drivers, its GUI folder. "Unbuilt (aspirational)" if not yet present.

## 3. Reference images (real + art)
   REAL urls only (feedback_no-invented-urls). Real-world (NASA/USGS/ESA/etc.) +
   art/stylized references. One-line "what to notice" caption each.

## 4. Math / modeling notes (HOW, from the field)
   How academia / games / sims model this mathematically or in shaders — the path
   to a shader implementation. Extends RESEARCH_high-lod-planet-shaders-2026-06-05.

## 5. Isolation recipe (:9223)
   Exact steps to solo this feature in the lab: window._lab.solo('<key>'), camera
   distance, which *Enabled flags to toggle, archetype filter.

## 6. What to judge (UAT checklist)
   The specific things to look at and compare to reference. Framed as
   "does it read as X in the 6-level posterized envelope?" — form/behavior bullets,
   not pixel-match.

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log
   - Rating: 🟢/🟡/🔴 (date)
   - Max's feedback: …
   - Tweaks applied: … (commit refs)
   - Re-verify: …
   - Status: open / VERIFIED_PENDING_MAX <sha> / shipped
```

### Artifact layout
- New dir **`docs/FEATURES/cards/`** — one focused card per feature.
- The existing **`planet-lod-campaign-tracker.md`** is repurposed as the
  **refinement index**: status table (rating + loop + ▶️ current) + links to each
  card. Keeps the tracker scannable instead of a 40-feature megadoc.

## 6. Two ceremony tiers

- **Light loop** (built features, 🟢/🟡, or fixable 🔴): reference-compare on
  `:9223` → Max feedback → tweak shader → re-verify (`window.__wd.*` / pixel
  readback, not eyeballing) → commit. **No spec/plan ceremony** — the research
  already lives in the card.
- **Heavy loop** (unbuilt ⬜, or 🔴-rebuilds): the full F11-style ceremony
  (brainstorm → spec → plan → subagent implement → code-review → verify), because
  those are greenfield.

The triage rating routes each feature to a loop. This is the deliberate departure
from the tracker's standing "FULL CEREMONY per feature" choice — appropriate
because most features already exist and need refining, not building.

## 7. The research workflow

- **One agent per in-scope L2 feature** (§8 list, ~40+). Concurrency auto-caps
  ~10–16; all complete. **Cost:** in-harness Workflow agents spend **regular
  tokens, not** the metered Agent-SDK credit (`feedback_flag-headless-cost`) — so
  no 6/15 metering trap. It is still a real token spend at this scale (~40+ agents
  each doing web research); flagged so Max opts in with eyes open.
- Each agent returns a **schema-validated dossier object** (fields = card §§1–6:
  `description`, `currentShaderApproach`, `references[]` `{url, kind:
  real|art, caption}`, `mathModelingNotes`, `isolationRecipe`, `whatToJudge[]`).
  The **main loop writes the card files** from the returned objects — keeps format
  consistent and avoids 40 agents doing file I/O.
- Agent tools: WebSearch/WebFetch (real reference URLs — **no-invented-urls**
  enforced in the prompt: cite only URLs actually fetched), Read/Grep (inspect the
  lab + inventory). Each agent is handed its feature's inventory row + a pointer to
  grep `world-engine-lab.html` for the combiner.
- **Launch timing:** after this design is approved AND the dossier schema is
  locked — never half-blind, or the dossiers come back inconsistent.

## 8. In-scope feature list (one dossier each)

| Domain | Features |
|---|---|
| Relief | F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 |
| Gradational | F11 F12 F13 F14 F15 F16 F17 F18 F19 F20 F21 |
| Volatile-surface | F22 F23 |
| Bands | F24 F25 F26 |
| Storms | F27 F28 F29 F30 |
| Clouds | F31 (family a–f, one dossier) |
| Thermal | F32 F33 |
| Optical | F34 F35 F36 F37 |
| Dust | F40 |
| Exotic-natural | F41 F42 F43 F44 F45 |
| Overlay | F46 F47 F48 F49 |
| Crosscutting | F51 (rings) |

**Not dossiered** (handled elsewhere): F50 posterize/dither + F52 eclipse/shadows
+ F53 LOD2 → **foundation UAT** (§4); F38 airglow + F39 cloud-optics → `[subtle]`,
get an explicit **keep / stylize / drop** call when their domain comes up, not a
deep dossier.

## 9. Reusability — beyond planets/moons

The apparatus (card schema + research-workflow + reference-compare UAT loop) is
built to **generalize**. Planets/moons are the **first (hero) application**. The
same machinery is then pointed at, and **generates the to-do backlog for**:

- **Galactic-disc rendering fidelity**
- **Nebula / deep-sky-object rendering**

(Starfield is already in good shape — **out of scope**.) These follow-on campaigns
reuse §5–§7 wholesale, swapping only the feature list. This is why we invest in the
method, not just the planet fixes.

## 10. Risks & discipline

- **Scope:** multi-week campaign, not a session. Don't conflate.
- **The bar:** reference guides **form and behavior**, NOT pixel-match. Target =
  "reads as X in the game's stylized 6-level posterized art style," not
  photorealism. A dithered planet won't 1:1 a NASA photo and shouldn't try.
- **Anti-infinite-polish:** batch re-touches; **3-cycle cap** per uncertain
  mechanism (research→implement→test ×3, then change technique, don't death-spiral).
- **Shared working tree:** a parallel **warp** workstream has uncommitted WIP in
  this tree. **Never `git add -A`** — stage explicit paths only. New card files
  under `docs/FEATURES/cards/` are safe to add explicitly. A doc-commit Stop hook
  blocks stopping with uncommitted `docs/FEATURES/**` — commit cards when created.
- **Testing:** chrome-devtools MCP on `:9223` GPU Chrome (per
  `well-dipper-testing-reference.md`), NOT Playwright. Liveness via
  `list_pages`, not Bash curl (sandbox → 000).

## 11. Out of scope (this spec)

- Production-game wiring (`src/objects/Planet.js`) — separate later effort.
- The galactic-disc and nebula/DSO campaigns themselves (only the apparatus is
  shared; their feature lists are authored when those campaigns start).
- Phase-2 data-management / representation design from the inventory doc.

## 12. Open items for the implementation plan

- Exact agent prompt + structured-output schema for the dossier.
- Card-file naming + the tracker→index rewrite.
- Foundation-UAT checklist contents (what specifically to judge on the substrate).
- Whether Max wants to trim the §8 list (e.g., skip `[current]`-and-likely-fine
  features) to cut workflow cost — default is **all in-scope get a dossier**, since
  the dossier is exactly what lets us confirm a `[current]` feature is actually fine.
- **(v2)** Exact `/goal` condition wording + turn bound per phase (§13.2).
- **(v2)** The integration checklist (INTEGRATION.md pairs, from the catalogue's
  shared-machinery notes) and the profile checklist (PROFILES.md, from Appendix
  A presets × Appendix B coverage matrix).
- **(v2)** `.gitignore` entry for `docs/FEATURES/cards/shots/`.

---

## 13. v2 amendment — end-to-end autonomous execution via `/goal`

**Approved by Max 2026-06-09.** Replaces Stream B (§3) with an autonomous goal
chain; adds two phases (integration, profiles) the v1 spec lacked; moves Max's
UAT to a single batched review lap at the end. Stream A, the card schema (§5),
the two ceremony tiers (§6, adapted per §13.4), dependency order and
foundation-first (§4), and all §10 discipline rules carry over.

### 13.0 The mechanism — what `/goal` is

Claude Code ≥ 2.1.139: `/goal <condition>` keeps Claude working turn after turn
— no per-turn user input — until a separate small evaluator model (Haiku)
confirms from the **transcript alone** that the condition holds. Session-scoped,
one goal at a time, typed by Max. Implications baked into this design:
conditions must be **transcript-provable** (state check commands whose output
lands in the conversation), every condition is **turn-bounded** ("…or stop
after N turns and summarize what's parked"), and a multi-week campaign runs as
a **sequence of bounded goals**, not one mega-goal. Main-turn tokens are
regular session spend (Max-20x pool, NOT the metered Agent-SDK credit); a
phase may stall on the rolling usage limit mid-run — that's a pause, not a
failure; it resumes when the window refreshes.

### 13.1 What changes vs. v1

- Stream A (research Workflow → ~48 dossier cards) **unchanged**, still runs
  first — the dossiers are the reference standard the autonomous judging uses.
- Stream B's sequential Max-paced reference-compare → **Claude makes the
  🟢/🟡/🔴 verdicts** (§13.3), logging verdict + screenshot gallery per card.
- **Two new phases:** cross-feature integration (§13.5) and per-archetype
  profile validation (§13.6).
- **Max's gate = one batched review lap** at the end (§13.7) — taste keeps the
  final word, batched instead of sequential.

### 13.2 The phase chain

Each phase = one `/goal` Max types, with a transcript-provable, turn-bounded
condition (exact wording locked in the implementation plan). Fresh session +
handoff doc at each seam (`handoff-at-seam`).

| # | Phase | Goal condition (sketch) | Bound |
|---|---|---|---|
| 1 | Research fan-out | *(not a goal — one Workflow call)* ~48 cards committed | — |
| 2 | Foundation | Substrate card has §7 verdicts + shots for FBM continents, lighting, posterize/Bayer envelope, LOD ramp; committed | 15 turns |
| 3 | Refine built | All 15 built-feature cards (F1–F11, F17/18/22/23) show §7 verdict + gallery; fixes committed; vitest green | 35 turns |
| 4a | Build: fluvial + aeolian | F12–F16, F19–F21 verdicted; lab renders each soloed | 45 turns |
| 4b | Build: atmosphere | Bands/storms/clouds/thermal (F24–F33) verdicted | 45 turns |
| 4c | Build: optical + exotic + overlay + rings | F34–F37, F40–F49, F51 verdicted; F38/F39 marked `parked-for-Max` | 45 turns |
| 5 | Integration | INTEGRATION.md checklist all pass or parked | 25 turns |
| 6 | Profiles | Every Appendix-A archetype renders its Appendix-B feature set, verified per type | 25 turns |
| 7 | Max's review lap | *(not a goal)* Max walks the galleries, overrules anything | — |

"End to end" honestly means: ~6 `/goal` launches from Max instead of ~40
feature-by-feature sittings. Claude cannot chain sessions itself.

### 13.3 Autonomous reference-compare judging

Per feature: load card → solo on `:9223` per the isolation recipe → screenshot
at 2–3 prescribed distances → **visual compare** of form/behavior against the
card's reference images (Claude views both) → check shader math against the
card's modeling notes → objective checks via `window.__wd.*` / pixel readback.
The bar stays §10's: *"reads as X in the 6-level posterized envelope"* — form
and behavior, never pixel-match. 🟢 → log, move on; 🟡 → light-loop tweak;
🔴 → fix, or after the 3-cycle cap mark `parked` and continue. Screenshots go
to `docs/FEATURES/cards/shots/F##-*.png` — **gitignored** (≈150 PNGs would
bloat the repo) but persistent on disk for Max's review lap (Windows-openable);
cards link them by relative path.

### 13.4 Heavy loop, adapted (no Max in the loop)

The F11 ceremony's brainstorm step needs Max, so for unbuilt features it
collapses into the card: the dossier (§§1–6) **is** the spec; Claude adds a
short **§6.5 build plan** to the card, then subagent-implement → code-review
subagent → verify → commit. Code-review stays — the only adversarial check
left with Max out of the loop. Forks mid-build follow
`decision-needed-threshold`: technical → decide and log; taste → take the
conservative option, mark the card `taste-call`, surface in Max's lap.

### 13.5 Integration phase

One card, `docs/FEATURES/cards/INTEGRATION.md`: the dependent pairs from the
catalogue's shared machinery — rivers vs. canyon accumulator, frost over
relief, clouds over bands, rings vs. eclipse shadows, etc. Each pair gets a
solo-pair render check + verdict. The pair list is authored **during the
implementation plan** from the catalogue's dependency notes, so the phase
starts from a concrete checklist.

### 13.6 Profile phase

One card, `docs/FEATURES/cards/PROFILES.md`: for each Appendix-A archetype,
render in the lab and check against the Appendix-B coverage matrix — right
features present, wrong ones absent, `deriveUniforms()` drivers sane. Fixes go
to the archetype registry / driver wiring; the `planet-archetypes` vitest is
the regression net.

### 13.7 Max's batched review lap

Not a goal. A single review doc (ordered links to every card + gallery) lets
Max walk the results, overrule verdicts, and decide the parked/taste-call
items (incl. F38/F39 keep/stylize/drop). Anything overruled re-enters a light
loop. UAT honesty is preserved: no card is *shipped* until this lap — verdicts
before it are `VERIFIED_PENDING_MAX`.

### 13.8 Guardrails (additions to §10)

- Explicit-path staging only (lab file, `docs/FEATURES/**`,
  `planet-archetypes.js`); warp WIP untouched; never `git add -A`.
- Lab-file backtick parity stays EVEN.
- **Commit at every feature seam** so a usage-limit stall never strands work.
- `active-workstream.json` flips to this campaign at execution start.

# Handoff 2026-08-21 (late) — ▶ **NEXT = MAX'S TERRAIN-SCALE RULING, then B6**

**HEAD:** `08c2521` · **Branch:** `feature/world-engine-production-L1` · **PUSHED** (remote 0/0, verified by `git ls-remote`)
**Repo:** `~/projects/well-dipper` — tree tracked-clean

> ⭐ ~700 untracked PNGs, `screenshots/`, `scratchpad/`, `qa-results/` are normal. ⛔ **NEVER `git add -A`.**
> ⛔ This doc lives in `docs/FEATURES/`, **not `/tmp`** — the `handoff` skill says /tmp and this project
> overrides it, because `NOW.md` pointed at a dead `/tmp/handoff-…` for weeks. That is the whole reason.

---

## 0. FIRST, BEFORE ANY BROWSER WORK

⚠ **THE CHROME DEV WINDOW WAS BUGGY AND MUST BE RELAUNCHED.** Max flagged it at the end of the last
session. Relaunch it before any chrome-devtools work; do not trust a page inherited from the old one.
The app is served at **`http://localhost:5173/well-dipper/`**. Launch recipe: `memory/chrome-devtools-9223-launch.md`.

⛔⛔ **MAX DOES NOT USE THE BROWSER CONSOLE. EVER.** Do not write "run `localStorage.setItem(...)`" or
any other snippet for him to paste — he has said so three times and it is now a standing rule
(`memory/feedback_max-does-not-run-console-commands.md`). Drive the browser YOURSELF via
`mcp__chrome-devtools__evaluate_script`. If Chrome is not attachable, ask him to OPEN the page — that
is a UI action he does take.

⭐ **HIS `wd.labGasBodies` KEY IS CLEARED** (removed, not set to `'0'`) and verified `null`. ⛔ Do not
"restore" it by setting `'0'`: B7 flipped the shipped default to `true`, and a localStorage `'0'`
OUTRANKS the default and would silently pin him to the legacy look. **Removing the key is what follows
the default.**

⭐ **Hard-reload before ANY measurement** (`reload-before-browser-measurement`). Verify the served build
first: `PACKS.map(p=>p.name)` must list **eight** packs, ending in `giantSurface`.

---

## 1. THE ONE THING TO DO

**Get Max's ruling on rocky terrain feature scale.** It is the only part of B7 that nobody ruled.

B7 moved exactly two uniforms, both of which land on **rocky terrain relief** (not gas bands):

| uniform | game before | lab now | why |
|---|---|---|---|
| `uNoiseScale` | `d.noiseScale`, the generator's raw draw | derived physical wavelength | ⭐ Max's own B2-leg-3 ruling. Settled. |
| `uDispDomainScale` | `RELIEF_DOMAIN_SCALE` = `1.0/0.3` = **3.333** | **1.0** | ⚠ **NEVER RULED.** No producer on either side — a bare constant that differs between the two materials. |

`3.333 → 1.0` shrinks the relief noise domain, so terrain features render **~3.3× larger**. The lab has
always used 1.0, so the game now matches the lab — which is this program's whole purpose — but that
number has never been put in front of him.

**How to run it:** park him in the LIVE game on a swapped rocky body and let him look
(`feedback_showcase-by-parking-the-live-game`). ⛔ **Your eyes are not the gate here** — black-vs-not-black
is the only judgment an agent may make (`feedback_my-eyes-are-not-the-visual-gate`). A known-good subject:
seed `lab-procedural-6`, body `PVX J3DK6GAO+RBJGI5M c` (`rocky`, swapped, packs
`rockySurface/solidOptics/solidFeatures`) at ~2.2 radii.

⭐ **The lever is one line if it reads wrong:** `src/objects/Planet.js:1381` `RELIEF_DOMAIN_SCALE`, or write
`uDispDomainScale` from a pack. Independent of everything else B7 did.

**Then B6** — see §4.

---

## 2. ⭐ MAX'S RULINGS, 2026-08-21 (late session)

| | ruling |
|---|---|
| **the container split** | ✅ **Option B** — change `encodeValue` to compare components rather than partition the rows, so B7 unblocks. Done. |
| **B7's deletion half** | ✅ **STRUCK** — flip the flag, delete nothing. See §3; the reason is measured, not stylistic. |
| **B7's Instrument-E gate** | ✅ **Dropped the paired-replay requirement** + recorded Step 6's subject as a NAME. Nothing is deleted, so there is no fallback whose removal could change a frame. |
| **subagents** | ✅ Approved, "as economical as you can while being effective". |
| **token economy** | ⚠ Standing until **Tuesday 2026-08-25**. Ultracode OFF. |

---

## 3. ⛔⛔ THE FINDING THAT RESHAPED B7 — DO NOT RE-LITIGATE IT

The plan (`one-pipeline-two-frontends-PLAN.md:490`) instructed: *"Delete the game's parallel
implementations — `GAS_BODY` and `Moon.js`'s shader."* **That is struck, and the evidence is LIVE, not
inferred.** Measured in the running game with the flag ON: **Sol renders 39 bodies and ZERO are swapped**;
all 39 report `isWorldEngine: false`.

Admission is `flag.enabled && provenance.isWorldEngine && packs.length > 0` (`Planet.js:2194`, docblock
says "never Sol"). Sol carries 2 `gas-giant` + 2 `sub-neptune`; `GAS_TYPES` (`Planet.js:1422`) routes all
four to `PLANET_SHADER_VARIANTS.gas` — i.e. to `GAS_BODY`. Deleting it ships **Jupiter, Saturn, Uranus and
Neptune with no fragment shader**. `Moon.js`'s legacy shader is load-bearing for Sol's 18 ice + 7 captured
moons the same way.

⭐ **So the legacy path is PERMANENT, not transitional. It is SOL'S RENDERER.** The word "fallback" is what
made it look deletable. This is recorded at `Planet.js:2145-2147` and in `54b9b3d`.

---

## 4. B6 — THE NEXT BUILD NODE, AND WHY IT

`comprehensive-wiring-plan-2026-08-20.md:700`. **M-sized · no UAT · FULLY PARALLEL · zero unmet deps ·
NOT on B7's path** (the plan says so explicitly so nobody falsely orders it against B7).

It is Step 11's *"cheaper next time"* fence: a **deliberately-broken control fixture committed for each
registration**, failing BY NAME with the offending path in the message. The plan's own words: *"A pass with
no failing control is worthless."* Five registrations plus the Step-5 shrink-only ratchet as a sixth.
Registration 4 carries the only visual control: delete `giantDeck`'s entry and the same generated gas giant
loses its bands.

⭐ **WHY THIS ONE NEXT, AND IT IS EVIDENCE-BASED:** dead controls have shipped in this lane repeatedly, and
**twice more in the last session alone** — a composite-key assertion in the new `giantSurface` suite that a
mutant walked straight past, and a subagent reporting "all 4 sites done" while the fence had not moved.
B6 is the node that makes that class of failure loud.

---

## 5. GATES — every number measured at `08c2521`, none inherited

| gate | value | how |
|---|---|---|
| Instrument A | **OK, ZERO DRIFT** · 340 files, 5675 tests, 31 failing, 15 non-collecting | ⭐⭐ MEMBERSHIP diff. **NEVER a count.** |
| Instrument C | **exit 0, ZERO delta** | ⚠ Re-blessed at the flip with `--allow-deltas --force`; the 2 movers are named in `54b9b3d` |
| Citations | **805 resolve, exit 0** | ⭐ CHECKED must **RISE**; a drop means refs stopped being READ |
| `Planet.js` | **2304 lines** | ⭐ keep it there |
| Instrument B | **RED — and red at HEAD too**, verified in the HEAD baseline's `failingFiles` | moon-formation window, another lane. ⛔ Deliberately NOT re-recorded. |
| Parity ledger | **ZERO `blocking` rows**, both channels | count `| blocking |` yourself |

---

## 6. ⛔ WHAT COSTS A SESSION TO REDISCOVER (new this session — the older list is in `handoff-2026-08-21-gas-half-next.md` §5, still valid)

- ⭐⭐ **A CITED LINE'S TEXT CHANGING IS NOT A RENUMBERING JOB.** When `Planet.js:2153` flipped, 22 places
  quoted it and the PROSE around each asserted "the flag defaults OFF". Fixing the quote alone leaves the
  claim standing, now wrong and freshly stamped as verified. Three treatments were needed — historical
  quote / bespoke rewrite / dated supersede marker — chosen per site. See `08c2521`.
- ⭐⭐ **A CITATION'S QUOTED SYMBOL MUST BE A TOKEN, NOT A WHOLE LINE.** Quoting the full new line
  *including its trailing `//` comment* silently drops it out of the CHECKED column — CHECKED fell
  805 → 791 with **no file losing a citation**. Shortening to the bare token restored all 14.
- ⛔ **A `localStorage` FLAG VALUE OUTRANKS A CHANGED DEFAULT.** Setting `wd.labGasBodies='0'` to "restore
  the shipped default" pins against it the moment the default flips. **Remove the key.**
- ⚠ **`tests/gas-body-lab-material.test.js:193` GENERATES ONE TEST PER REGISTERED PACK**, so any new pack
  moves that file's test count by one. Expected drift, not a regression.
- ⛔ **`_lab.resolveBody` NOW THROWS** on a subject it cannot parse (a bare string, a falsy `name`, an
  unknown `kind`). Any old replay recipe that passed a bare string will fail loudly rather than falsely
  pass. That is the intent — see `src/util/lab-subject.js`.
- ⚠ **`frameBody` REFUSES an unlit subject.** Pass `{ allowUnlit: true }` for a deliberate night-side shot.
- ⚠ **The pre-commit doc-rot hook prints `grep: subpattern name expected`** on the ⭐/⛔ glyphs. Harmless;
  commits land.

---

## 7. SUGGESTED SKILLS

- **`superpowers:verification-before-completion`** — ⭐ the highest-value one here, again. Two subagent
  reports were wrong this session and both were caught by re-measuring rather than re-reading.
- **`superpowers:test-driven-development`** — ⛔ **for B6 this is the whole node**, not a supporting
  practice: B6 IS "prove the gate bites by breaking it on purpose".
- **`superpowers:systematic-debugging`** — if the terrain-scale ruling turns into a defect hunt.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, never `/tmp`.
- ⛔ **Workflows / ultracode: NO** unless Max reopens it. Token economy stands until Tuesday.
  Single model-pinned subagents are approved and worked well for scouting; ⚠ **pin the model explicitly**
  (`feedback_subagent-model`) — omission inherits Fable at 2× Opus cost.

---

## 8. PARKED, NOT FORGOTTEN

- **B5** — the quality strand (L–XL). ⭐ **TWO Max looks**, wants its own fresh session.
- **B8** — the gated tail. A holding pen with named gates, most outside this plan. ⛔ Not a queue.
- **Star-driven pigment workstream** — `docs/WORKSTREAMS/world-engine-star-driven-pigment-2026-08-21/`,
  unblocked but still needs Max's greenlight on the contract; the four palette families are his to author.
- **The 31 red-by-design tests** belong to the moon-formation window (`34b502d`), another lane.

---

## 9. OPEN FOR MAX

1. **Terrain feature scale after B7** — §1. The only unruled part of the flip. One-line revert if wrong.
2. **B6 greenlight** — recommended next build node (§4); nothing blocks it.
3. **Chrome dev window needs relaunching** — §0. He flagged it as buggy.

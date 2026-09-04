# Handoff — ▶ NEXT ARC: **the VOLATILE DELIVERY fix** (a generation workstream), then **(3) the lighting engine / F52**

> ⚠ **IN-REPO ON PURPOSE** (`/tmp` does not survive a WSL restart). Supersedes
> `handoff-2026-09-04-solidrelief-deck-then-mountains-then-lighting.md`; its trap list still holds and
> is extended below.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master) · **HEAD = origin =
> `a7bfe5d`, verified by `git ls-remote`; working tree clean, nothing owed.** All four instruments
> green (`npm run check:instruments` exit 0). ⛔ ~700 untracked PNGs are normal, NEVER `git add -A`.
> ⚠ ALWAYS `npx vitest run --dir tests`.

## 0. THE RULING (Max, 2026-09-04)

Asked whether the galaxy should contain Earth-like worlds at all, having been shown that it currently
contains **none**:

> **"yes; I want this to be a simulation of the milky way galaxy with a wide variety of
> physically-plausible worlds"**

⭐ **This WIDENED THE CHARTER'S INTENT FRAME** and is recorded there (`docs/FEATURES/planet-lod-CHARTER.md`
§ INTENT FRAME, `a7bfe5d`): the 2026-07-19 frame with emphasis moved from *fidelity per feature* to
**variety across the drawn population**, plus one new operational test — **a generation law is wrong if
it makes a whole class of physically-real world unreachable**, even when every body it produces is
individually defensible.

He also chose to scope this **in a fresh session**, which is why you are reading this.

## 1. READ FIRST, in this order

1. `docs/WORKSTREAMS/f1-mountains-generation-2026-09-04/REPORT.md` — **the whole finding**, including
   the ADDENDUM at EOF, which is the part that matters. Do not re-derive it; the three scripts beside
   it (`diagnose.mjs`, `tv-sweep.mjs`, `scale-seam.mjs`) re-run in seconds.
2. `docs/FEATURES/planet-lod-CHARTER.md` § INTENT FRAME — the governing frame, now with his ruling.
3. `docs/NOW.md` top banner.
4. `~/.claude/projects/-home-ax/memory/well-dipper-world-engine-program.md` — last two entries.

## 2. THE WORK — the volatile delivery fix

**The defect, in one sentence.** `src/generation/PhysicsEngine.js` `deriveComposition` makes
`volatileFraction` a pure function of `frostRatio = orbitAU / frostLineAU`, and `T_eq` is a function of
**the same variable inverted**, so *temperate ⇒ inside the frost line ⇒ dry* holds **by construction**.

**Measured, 1,183 solid bodies over 200 seeds — do not re-measure, re-run the script:**
- **temperate ∩ wet = 0.** Not rare: zero, with margin on both sides. Wettest temperate body
  V = 0.0595 (the plate band wants 0.12); warmest wet body T = 186 K (the band wants 250 K).
- Through the engine's OWN gate (`labCore.js:693` `smoothstep(0.05, 0.2, V)`, *"bone-dry floor at
  0.05"*): of 135 temperate bodies, **78.5 % at or under the bone-dry floor, 21.5 % essentially dry,
  ZERO wet**. Meanwhile **26.7 % of all solid bodies DO read wet — every one of them frozen.**
- The engine anchors Earth at **0.15** in three independent places: `passiveMargins.js:54`
  (`MARGIN_VF0`, *"anchored to 1.0 at Earth's volatile fraction"*), `labCore.js:693`, and the
  `Rocky (Earthlike)` preset. The generator's temperate ceiling is 2.5× below it.

⛔ **THIS IS NOT AN F1 PROBLEM.** The same field feeds the fluvial stack, karst, dunes, dust, coastal
margins **and** the plate gate. Every warm world in the game is a desert to all of them.

**The fix's shape, already derived — do not re-derive, scope it.** `deriveComposition` does TWO jobs
with ONE field:
- **(1) accreted bulk ice fraction** — genuinely frost-line driven; the existing law models this
  correctly and should keep doing so;
- **(2) surface volatile inventory** — inside the frost line a terrestrial planet accretes essentially
  dry and then **receives** its water, delivered late from scattered outer-system material (Earth's is
  ~0.02 % of its mass), a process largely **decoupled** from the body's own frost ratio.

The law has only (1), which is why the implication cannot be broken. **Adding the delivery term is the
job**, and it is what makes the population various rather than bimodal: temperate worlds draw a
*distribution* — mostly low, occasionally Earth-like — off real mechanisms (giant-planet architecture
doing the scattering, mass governing retention, temperature governing loss).

**The second, independent block, for whoever scopes the plate path itself.** `if (locked) return
shell('eyeball-despun')` sits **ABOVE** both roads to `plate()` and eats **74 %** of all bodies (every
moon, ~39 % of planets) before the band is consulted. The corpus's one `regime === 'mobile'` body is
locked and leaves there. Locking moons is physically right — the point is that the gate, not the band,
closes the door for three quarters of the population, and fixing (2) alone will not open it.

## 3. HOW TO SCOPE IT

`dev-collab-scope` — it is multi-AC and multi-system. Non-negotiables, from the charter and from what
this session paid for:

- ⛔ **Capture the parent population BEFORE any src edit.** Composition changes on EVERY body, so the
  only admissible "what moved" is a fixture taken first. `scripts/capture-solidrelief-pack-baseline.mjs`
  is the shape; `tests/fixtures/solidrelief-pack-drivers-baseline.json` is the precedent.
- ⛔ **Acceptance targets the DRAWN POPULATION, never a preset** (charter: *"No defaults. Presets are
  dev fixtures."*). The population read is the deliverable Max checks first — see
  `docs/WORKSTREAMS/solid-relief-deck/POPULATION.md` for the shape that worked.
- ⚠ **The blast radius is the point, not a risk to minimise.** This deliberately moves the fluvial,
  karst, dune, dust, margin and plate populations. Measure each before/after and put the table in
  front of him; do not try to keep them still.
- ⚠ **Say which way the reconciliation goes and why.** The engine says Earth = 0.15 in three places;
  the generator says ≤ 0.06. Earth's real bulk water is ~0.02 % of its mass, so the field is not
  literally bulk water on either side. That is a derivation to make in the contract, not a question
  for Max — his ruling already fixed the target (physically-plausible variety).

## 4. WHAT SHIPPED THIS SESSION, so it is not re-litigated

**The `solidRelief` deck — driver pack #11, 23 names, ten F-rows.** Max UAT: *"They work … So they're
wired up"*. Records: PLAN § THE SOLID RELIEF DECK, WIRED (EOF); `docs/WORKSTREAMS/solid-relief-deck/`
(contract `shipped`, intent, POPULATION.md, DEVIATIONS.md, FOLLOWUP-not-fully-developed.md).
Commits `1428533` (build), `938a98b` (Instrument A), `4b7e6dc` (A/B key `[`), `8b76e86` (ship).

⭐ **His UAT opened a second follow-up worth reading before the lighting engine:** the eleven are
*painted over* the generative model. Measured in `FOLLOWUP-not-fully-developed.md` — all eleven DO read
the province cube, three read the accumulated surface, but eight read neither height nor gradient and
none reads the generative geometry the bake draws. Three separable jobs there; **(c), "let the
generative writers PLACE the landforms", is the same question as the plate path.**

⛔ **Three coverage-audit rows were corrected by measurement** and the PLAN carries the corrections:
F46 bio is NOT dead (gate open on 68/124; held out because its AMOUNT is a slider with no law);
F1's runtime gate is live on 103/124 (the block is in the BAKE's plate closure); F43 IS dead 0/124 but
by the facet predicate, not `retained === false`.

## 5. ⛔ TRAPS (the nine carried forward, plus what this session added)

1–9 as listed in `handoff-2026-09-04-…md` §5 — all still hold. Especially #1 (a stale worktree under
`.claude/worktrees/` is still there), #2 (write `file.js:NNN`, and `grep -q "Exit 0"`), #4 (live-pair
artifacts must live IN-REPO), #8 (the F-spine's status column is not evidence).

10. ⭐ **NEW — `cd` inside a Bash call MOVES THE SESSION'S CWD, including from a backgrounded command.**
    Two vitest runs and a `git` invocation silently executed in a parent worktree this session. Pass
    `--root /home/ax/projects/well-dipper` to vitest and absolute paths to scripts, or check `pwd`.
11. ⭐ **NEW — AN IMPORT APPENDED PAST A TRAILING `//` LANDS INSIDE THE COMMENT AND IS DEAD.** Known
    and written down in two files, and it still happened once here (`driver-pack-solidoptics.test.js`).
    On a shared import row, insert BEFORE the comment. Headless gates stay green; the symbol is simply
    undefined at use.
12. ⭐⭐ **NEW — A SCREENSHOT PAIR OF A ROTATING BODY MEASURES THE ROTATION.** The first solidRelief A/B
    pair read **60.5 % of pixels changed**, which is not a credible relief delta and was discarded.
    `_lab.freezeFrame()` FIRST, always. A number that large should be disbelieved before it is reported.
13. ⭐ **NEW — the seeded relief axes cannot be read off a condition vector** (`condition.seed` is
    `undefined` on every body), so a naive forward gives ONE orientation for the whole galaxy. The
    front-end answers them: `labCore.reliefAxesFor(seed)` + `chasmaRiftsFor`, spread on `labPackCtx`.
14. ⚠ **NEW — there are NO unbound letter keys left in the game.** Measured over A–Z. `[` went to the
    relief A/B; free today are Digit0, Digit2–9 and most punctuation.

## 6. WORKING WITH MAX

- ⭐⭐ **THE RECAP IS A STATUS REPORT AGAINST THE ROADMAP, IN HIS LANGUAGE.** He stopped this session
  once to say so — *"someone lost the rule that says every turn you must explain in plain terms where
  we are and put your questions/decision points for me into the same terms with context."* Read
  `feedback_director-level-recaps.md` and `feedback_asks-in-his-language-not-the-contract-s.md` IN
  FULL, not from the gloss. No uniform names, no AC ids, no file paths in the asks.
- **He checks premises, and he was right to.** *"Is all world engine rendering in the game"* found the
  coverage gap; *"they don't actually communicate with that process"* found the paint-over seam; and
  the mountain question turned out to be a galaxy-wide generation defect. Expect the next premise
  check to land too.
- **He rules fast and in few words when the ask is concrete** — "2 yes", "yes mountains next",
  "1 next session". Keep asks to one line each with a recommendation stated.
- **Pushing is confirmed each time.** He said yes twice this session; do not treat that as standing.

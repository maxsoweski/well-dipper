# Handoff 2026-08-21 (evening) — ▶ **NEXT = THE GAS-HALF BLOCK, then two instrument fixes**

**HEAD:** `0604d13` · **Branch:** `feature/world-engine-production-L1` · **PUSHED** (remote 0/0)
**Repo:** `~/projects/well-dipper` — tree tracked-clean

> ⭐ ~700 untracked PNGs, `screenshots/`, `scratchpad/`, `qa-results/` are normal. ⛔ **NEVER `git add -A`.**
> ⛔ In `docs/FEATURES/`, **not `/tmp`** — the `handoff` skill says /tmp and this project overrides it,
> because `NOW.md` pointed at a dead `/tmp/handoff-…-2026-06-25.md` for weeks. That is the whole reason.

> ⚠⚠ **MAX'S BROWSER HAS `wd.labGasBodies = '1'` IN localStorage.** His game is NOT at its shipped
> default. To restore: `localStorage.setItem('wd.labGasBodies','0'); location.reload();`
> ⛔ Any screenshot or measurement taken without checking this flag describes a build no player has.

---

## 0. THE ONE THING TO DO

**Build the gas-half block.** Max ruled it 2026-08-21 (option B, over "flip now with the loss declared"):
give `giantDeck` the three uniform families `rockySurface` already writes for solids, closing the
**three remaining `blocking` ledger rows — P-11's gas half, P-12, P-13.**

⛔ **They are not three problems. They are one.** `rockySurface`'s predicate is `!== 'gas'`, so
**343 of 852** bodies receive no limb/terminator optics, no palette endmembers, no noise offsets.
`giantDeck` is the pack that must write them. Verified live at `0604d13`: on the gas giant
*Meameinath*, `uTermStrength` reads **0** and `uBioGroundCover` reads **0**.

⭐ **AND THE GAP REACHES MOONS, WHICH THE ROW TEXT DOES NOT SAY.** *Daiben*, moon 2 of 6 around
Meameinath, is a **planet-class moon** (5.13 M⊕ / 1.99 R⊕, density ~0.65 Earth) that
`compositionClass()` correctly routes down the **gas** path: measured `packsApplied`
`['giantDeck','limbDeck','polarDeck','craterDeck']` against its plain-moon sibling Zira's
`['rockySurface','solidOptics','solidFeatures']`. It is **not a bug** — the solid families it lacks
are solid-surface features it should not have. It IS a live instance of the gas half sitting inside
the moon population, and it sat among the six bodies D-2 asked Max to judge.

**Then two instrument-integrity fixes** (Max: "ok", 2026-08-21) — §4.

---

## 1. WHERE THE PLAN STANDS

Plan: [`comprehensive-wiring-plan-2026-08-20.md`](comprehensive-wiring-plan-2026-08-20.md).
Critical path to a player was **B0 → B2 → B3 → B4 → B7**. B0/B1/B2/B2P/B3/B4 are done.

**Eight ledger rows closed today:** P-05, P-11 (non-gas half), P-14's crater half, R-07 (B3) ·
P-01, P-02, P-03, S-01 (B4). Three `blocking` rows remain and all three are the gas half.

⛔ **B7 IS NOT NEXT, AND THE PLAN'S OWN PRECONDITION LIST IS WHY.** It predicted B0 would close
P-12/P-13. **It did not** — they are still `blocking` at HEAD, measured. Do not take the plan's
precondition table as current; count `| blocking |` in the ledger yourself.

---

## 2. ⭐ MAX'S RULINGS, 2026-08-21 (evening)

| | ruling |
|---|---|
| **D-2 moons** | ✅ **PASSED** — *"They do look different yes."* ⚠ **RECORDED NARROWLY: he viewed THREE of the six** (Meameinath I, Kos, Zira) in `lab-procedural-88`. He did **not** view Daiben, Meameinath IV or Meameinath VI. Daiben is the gas-class one and would differ for a different reason. |
| **D-1 gating** | ✅ **Option B** — close the gas half BEFORE flipping. Rejected flipping with the three rows declared accepted-loss, on the argument that B7 *deletes* the fallback, converting a recoverable loss into a permanent one on the most prominent third of the population. |
| **instrument fixes** | ✅ **Approved** ("ok") — the two in §4. Nothing wider. |
| **token economy** | ⚠ Standing until **Tuesday 2026-08-25** (weekly reset). Ultracode is **OFF**. Inline work; single model-pinned agents only when genuinely needed. See `feedback_token-economy-mode.md`. |

---

## 3. GATES — every number measured at `0604d13`, none inherited

| gate | value | how |
|---|---|---|
| Instrument A | **31** failing, md5 `982b5bdf5812e9d5f72c59270bd5f781` | ⭐⭐ MEMBERSHIP diff, `comm` BOTH ways. **NEVER a count.** |
| Instrument C | **exit 0, ZERO delta**, 55 uniforms × 633 bodies | ⚠ 15 of the 55 are constant/near-constant — green is strong evidence for 40, weak for 15 |
| Instrument D | **28/28** | |
| Citations | **785** resolve, exit 0 | ⭐ CHECKED must **RISE**; a drop means refs stopped being READ |
| `Planet.js` | **2304** lines | ⭐ keep it there — see §5 |

⛔ **BOTH BASELINES WERE RE-RECORDED TODAY** (`b505869`, `3166084`) and the commit messages enumerate
everything blessed. Before today, Instrument C's capture was **100+ commits stale** and no gate in
this lane was readable. **Do not re-record either without naming every ID and uniform that moves.**

---

## 4. THE TWO INSTRUMENT FIXES MAX APPROVED

1. ⛔ **`_lab.resolveBody(<string>)` SILENTLY RETURNS PLANET 0.** All seven `body.moon.*` names in
   `lab-procedural-88` resolved to `body.planet.e7eae7`. It takes a **subject object**
   (`{kind:'moon', p, m}`); a string falls through to a default instead of erroring. **B7's gate
   specifies Instrument E replays against recorded body NAMES, never indices** — so this would
   silently shoot the wrong subject and report success. Make the unparseable case throw.
2. ⛔ **THE FREEZE-POSE FALSE NEGATIVE, WHICH FIRED TWICE TODAY.** `freezeFrame()` pins orbit to 0
   and teleports the body; framing the gas giant while frozen rendered a **fully black disc** that
   read exactly like a broken shader. `thawFrame()` + re-frame showed a correctly lit, banded gas
   giant. The existing rule is "freeze FIRST, then `frameBody`" and it is **not sufficient** — the
   frozen pose itself can put the subject's night side to camera. Make `shotState`/`frameBody`
   report the sub-solar angle, or refuse a shot whose subject is unlit.

---

## 5. ⛔ WHAT IS TRUE ABOUT THIS CODEBASE THAT COSTS A SESSION TO REDISCOVER

- ⭐⭐ **`src/objects/Planet.js` MUST STAY 2304 LINES.** It carries the densest citation refs in the
  tree. B3 and B4 both edited the *same uniform literal in the same function*, ~47 lines apart, and
  **it auto-merged** — because both lanes made **same-line edits with trailing comments**, never
  inserting or deleting. That single discipline turned a predicted merge crisis into a non-event.
- ⭐⭐ **A GREEN CITATION FENCE CAN MEAN NOTHING IS BEING READ.** Five B3 modules were tracked but
  absent from `CITE_SOURCES`, so 27 refs a commit described as "moved into craterDeck.js" had
  **left the scanned set**. CHECKED fell 708 → 700 across five commits that each printed exit 0.
  ⛔ **Watch CHECKED, not the exit code.** Registering them exposed 21 broken refs.
- ⛔ **`CITE_SOURCES` entries are APPENDED TO AN EXISTING LINE, never inserted below** — the array is
  itself cited and a new line moves every entry under it. `tools/port-uniform-delta.mjs` is 2082 lines.
- ⭐ **`npx vitest run` needs BOTH excludes** — `'**/.claude/**'` AND `'**/scratchpad/**'`.
- ⛔ **A TRACKED FILE IMPORTING AN UNTRACKED ONE IS INVISIBLE TO EVERY GATE.** The citation fence
  resolves against the WORKING TREE, not the index.
- ⭐ **The scene renders at 1/3 resolution** (`RetroRenderer.js:811`, pixelScale 3) — `gl_FragCoord`
  is in RENDER pixels; every screen-pixel estimate is out by 3×.
- ⛔ **Never judge any of this on Sol** — 18 NASA textures, different renderer, excluded in code.
- ⭐ **The dev server at `localhost:5173` serves `~/projects/well-dipper`.** Verify the served build
  before measuring: `(await import('/well-dipper/src/worldengine/drivers/index.js')).PACKS.map(p=>p.name)`
  should list **seven** packs. **Hard-reload first** — an HMR-mutated module graph is not evidence.

---

## 6. ⭐ THE PROCESS FINDING, AND IT REPEATED FROM YESTERDAY

**The code converged fast. The CLAIMS did not — again.** Yesterday's handoff (mine) carried two
false statements into today: that `starMassEarth` was "reachable, 15 times over" when it is **0/167**
on generated bodies, and that Instrument C read "every row 0/514" when **12 of 55 had moved**. Both
were *name counts reported as value counts* — the failure this ledger names as the codebase's
signature, the same shape as its own "CARRIED: 28" that means 8 at most.

**The claims auditor with no write authority caught five more today**, including one nobody else
would have: a test asserting 228/456 against a real 420/663, failing **inside the blessed 32** where
Instrument A reported it as expected. Max made that stage **standing for this lane**
(`feedback_claims-auditor-standing-stage.md`). ⭐ **Keep it. Give it no write authority.**

⛔ **What does NOT work: another repair round.** When a figure has been wrong twice, **WITHDRAW it**
and say why. Done twice today; both times it ended the loop.

---

## 7. SUGGESTED SKILLS

- **`superpowers:verification-before-completion`** — ⭐ the highest-value one here. Every agent report
  today was re-run by hand before commit, and doing so caught a gate reported PASS whose script
  exited 1, plus a black-disc "defect" that was a pose artifact.
- **`superpowers:systematic-debugging`** — for the two §4 instrument fixes; both are "the instrument
  lies" bugs, not feature bugs.
- **`superpowers:test-driven-development`** — prove a gate bites by reverting the fix and confirming
  the *specific* assertion reds. Two controls shipped dead in this lane and only hostile review caught them.
- **`dev-collab-scope`** — ⛔ **NOT** for the gas-half block (already scoped by the ledger rows). It
  IS already used for the parked pigment workstream (§8).
- ⛔ **Workflows / multi-agent fan-out: NO** unless Max reopens it. Ultracode is off and token
  economy stands until Tuesday. The gas-half block is one pack against three uniform families — inline.
- **`handoff`** at the next seam — ⛔ into `docs/FEATURES/`, never `/tmp`.

---

## 8. PARKED, NOT FORGOTTEN

- **Star-driven pigment workstream** — `docs/WORKSTREAMS/world-engine-star-driven-pigment-2026-08-21/`,
  8 ACs, schema-valid, status `scoping`. ⛔ **Blocked on B3 landing** (palette ownership) — B3 has now
  landed, so it is unblocked, but **it still needs Max's greenlight on the contract** and he must
  author the four palette families himself. ⭐ Its intent.md records the `starMassEarth` correction.
- **B7** — after the gas-half block. Its gate is D-1 + D-2 (D-2 ✅ passed) + the eight rows.
- **The 31 red-by-design tests** belong to the moon-formation window (`34b502d`), another lane.
  ⛔ Instrument B is deliberately NOT re-recorded.

---

## 9. OPEN FOR MAX

1. **Nothing blocks the gas-half block.** Both his rulings are in.
2. **His browser flag is still ON** — see the banner at the top.
3. **Pigment contract awaits his greenlight**, and the four palette families are his to author —
   scoped as a live A/B flipped while flying, not a swatch sheet.

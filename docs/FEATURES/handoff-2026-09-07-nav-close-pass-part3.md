# Handoff — ▶ **AC-2's REMAINING RECTANGLES ARE THE PICKUP. Max's eight items are ALL closed; AC-12 (his walk) is his.**

> ⚠ **IN-REPO ON PURPOSE** — the handoff skill says "temporary directory"; this project's standing convention
> overrides it: **`/tmp` does not survive a WSL restart** and this file has to outlive one.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master). **Head `1e45175`.**
> `89acf6f` is on the remote (ls-remote verified); **`1e45175` is LOCAL** unless Max said push after this was
> written — check `git ls-remote origin refs/heads/feature/world-engine-production-L1` before assuming.
> ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS, AND THE BASELINE THEY MUST REPRODUCE

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper   # 20 failed / 8 files (EXPECTED — same eight as always)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper   # 551 passed / 28 files  (was 527 at session start)
node scripts/extract-nav-designs.mjs --check                            # green
wc -l src/ui/NavComputer.js src/main.js                                 # 4711 / 15161, BOTH FROZEN
```

The eight expected `tests/` failures, by file: `agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`,
`lab-shader-perframe-seam`, `moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
`relief-octave-lod-ramp`. Anything else is yours.

⚠ `vitest --dir src/ui` takes ~4 min. A Bash call at the default 2-min timeout dies at exit 143 — pass
`timeout: 600000`. A `run_in_background` run wrote nothing for 15 min; run it foreground.

---

## 1. WHERE THIS STANDS — read these, don't re-derive them

| artifact | what it holds |
|---|---|
| `docs/NOW.md` top four entries | this session, in order, with Max's rulings verbatim |
| `docs/WORKSTREAMS/nav-screens-close-pass/contract.json` | **18 ACs, each `progress` note carrying the live measurement.** The source of truth |
| `…/intent.md` · `…/INTERFACE.md` · `…/MEASUREMENTS.md` | scope, the three-owner seam, the pre-change numbers |
| `…/review.html` | the flip A/Bs Max rules on, served off `:5175` |
| `git log a7e920a..HEAD` | seven commits; every message says what was measured and which mutants went red |

**Closed this session** (all live-measured with a control, all mutation-proved):
- **AC-16** orrery tracks moving planets · **AC-2** first rectangle, `S.orbitRings` · **AC-9** first indicator, the
  prism y-gauge (a RESTORATION of the legacy camera-height readout) · **AC-1** both halves, and **approved by Max**
  (*"new one looks good"*) · **AC-18** (new ruling, *"disable the system screen when not in a system"*), built
  for the designs and then **widened to today's nav and the cockpit panel** (*"3 yes"*).

---

## 2. ▶ THE PICKUP — AC-2's remaining rectangles, in the order I'd take them

`S.labelHits` and `S.orbitRings` are the two worked examples. **The pattern, every time:** publish at the draw
site in `nav-240p-lab.html` → `node scripts/extract-nav-designs.mjs` → consume in `navViewModes/` → a test
that DRIVES the input → mutate the fix and watch it go red → live on `:5175` with a control.

1. **`S.pagerRect`** (design 1, every level with a rail) — the `- = PAGE` line, `d1Rail` (lab ~1407-1410). Left
   half pages back, right half forward. The driver has `page(dir)`. Consume in `remapClick` like the ladder caps
   (`return null` = eaten).
2. **`S.listHeaderRects`** (design 2, PRISM list) — click a column header to sort by it. Driver has `cycleSort`;
   needs a `sortTo(id)`.
3. **`S.locatorRect`** (design 2 topbar `HERE · SECTOR`, lab ~1552) — "centre on the player" is the obvious action.
4. **`S.minimapRect` / `S.companionRect`** — no downstream identity today; log rather than invent.

**AC-9's remaining three:** the prism's zoom/index indicators; SYSTEM's ladder scroll indicator (AC-7's drag
already scrolls the axis — check whether a separate indicator is even drawn before building one); the counter.

**Then:** AC-5's GALAXY half (needs the SECTOR's own rect out of the paint — `pickSector` now answers for every
drawn-cell texel, which helps), AC-6's inbound half, design 2's GALAXY crop of 20 of 775 sectors.

---

## 3. ⛔ THE TRAPS — the ten from part 2 still hold; these are the new ones

11. ⭐ **`verify-workstream` in `light` mode audits ONE AC — the FIRST in the contract — by design** (`slice(0,1)`,
    no AC filter). Pointed at AC-2/AC-9 it audited AC-1. Full mode over 18 ACs is ~70 agents. Its skeptic was
    still worth it — it found AC-1's tautological "0 dead cells". (Also in memory.)
12. ⭐ **THE ORRERY SPLASH BOOT SPAWNS NO SYSTEM.** Click ORRERY, let the intro run: `window._systemData` stays
    undefined and `_lab.systemInfo()` reports 0 planets. That is now a DESIGNED state (AC-18). **`_lab.enterSol()`
    is the walk into a real system** — `_debugEnterKnownSystem` → `spawnSystem` → the same `_applyNavArrival` a
    warp uses, and Max's own D-hold route. `_lab.spawnProceduralSystem(seed)` spawns but leaves
    `currentGalaxyStar` null, so the nav never binds to it — fine for planet work, useless for nav work.
13. ⭐ **THE HEADLESS HARNESS'S DEFAULT IS THE NO-SYSTEM STATE** (`_currentSystemData` null). Any test that
    expects SYSTEM to be reachable must set `nav._currentSystemData = { planets: [] }` first — three inherited
    ring tests now say so. `trappySystem` assigns `_levelIndex = 4` directly and is unaffected.
14. ⛔ **DISPATCH A KEY ONCE.** A synthetic `keydown` fired on both `window` and `document` toggled N open and
    shut and the overlay read `display:none` with a 0×0 canvas. Use `press_key`.
15. ⛔ **A LEGACY-PATH CLICK NEEDS ITS MOUSEDOWN.** `_handleClick` alone reads the click as a drag from the last
    `_dragStart` and returns (`dx²+dy² > 25`). Use `clickAt()`.
16. ⭐ **THE NAV CANVAS CAN BE PIXEL-READ FOR A SPECIFIC TEXEL** (`getImageData`, always with a control frame) —
    that is how the y-gauge mark, the drawn cell set and the dimmed SYSTEM tab were confirmed. A hash of the
    whole canvas still cannot.
17. **Inks:** GALAXY rule `29,58,74` (INK.RULE) · INK.DIM `47,107,122` · INK.YOU `255,176,58` · INK.KEY
    `216,251,255`. Client → canvas: `clientX = rect.left + (texelX + 0.5) * rect.width / canvas.width`. Wait
    2 rAF after a `mousemove` — hover resolves at the tail of `render()`.
18. **`celestialTimeMultiplier` via `_lab.setSetting`** makes planets visibly move (200000 ≈ 1 rad in 6 s on
    Sol's innermost). Restore to 1.0.
19. ⭐ **A GATE THE MUTANT CANNOT KILL IS A GATE TO DELETE, AND THE COMMENT MUST SAY WHAT IS TRUE.** Twice this
    session (the y-gauge release, AC-1's "only inside a drawn cell") a survived mutant meant my claim was
    false as written, not that the test was weak. Once it was dead code (removed); once the real guarded path
    was narrower (pinned by its own test).

---

## 4. WORKING WITH MAX — re-confirmed this session

- ⭐⭐ **HE ANSWERS TERSELY, IN ORDER, BY NUMBER** — *"1 push 2 park; 3 disable…"*, *"1 yes 2 yes… 3 yes"*.
  **Number the asks.** One line each, recommendation stated.
- ⭐ **HE RULES ON PICTURES AND HE WIDENS SCOPE**: asked whether the no-system preview was right, he ruled it OFF
  ("disable"), then widened it to every surface when offered. Offer the wider option; don't pre-narrow.
- ⛔ **EVERY PUSH NEEDS HIS WORD**, including the one after the one he just approved.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** Drive everything yourself; his walk is keys and clicks only.
- ⭐ **SAY WHAT YOU GOT WRONG**, plainly, and move on.

---

## 5. FOR MAX (carried; none of these is mine to close)

0. **Push `1e45175`** if not already pushed — check ls-remote.
1. **AC-12 — his walk of both menus.** New things to try: click an orbit *line* in the orrery; drag the thin
   strip on the prism's right edge; boot ORRERY from the splash, let the intro finish, and see that SYSTEM is
   dim and Tab skips it.

---

## 6. SUGGESTED SKILLS

- **`superpowers:test-driven-development`** — every slice here is "publish → consume → a test that drives the
  input → mutate"; write the red test first.
- **`superpowers:systematic-debugging`** — if a live measurement disagrees with a headless one (it did twice).
- **`dev-collab-scope`** — only if AC-2's remaining rectangles are re-scoped as a unit; the contract can also
  just carry them.
- **`verify-workstream`** — in `full` mode, or by hand (see trap 11).
- **`handoff`** — at the next seam.

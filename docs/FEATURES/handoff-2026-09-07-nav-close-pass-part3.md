# Handoff — ▶ **AC-2's REMAINING RECTANGLES ARE THE PICKUP. AC-1's PICTURE AND THE ORRERY-BOOT QUESTION ARE MAX'S.**

> ⚠ **IN-REPO ON PURPOSE** — `/tmp` does not survive a WSL restart. **Branch** `feature/world-engine-production-L1`
> (lane A, **NOT** master). **`89acf6f` IS PUSHED** (ls-remote verified). The commit after it — AC-18 widened to
> today's nav + the cockpit panel, and AC-1 closed by Max — is **LOCAL** until Max says push again. ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS, AND THE BASELINE THEY MUST REPRODUCE

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper   # 20 failed / 8 files (EXPECTED, same eight as before)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper   # 543 passed / 28 files  (was 527)
node scripts/extract-nav-designs.mjs --check                            # green
wc -l src/ui/NavComputer.js src/main.js                                 # 4711 / 15161, BOTH FROZEN
```

⚠ `vitest --dir src/ui` takes ~4 min; a Bash call with the default 2-min timeout gets killed at 143. Pass
`timeout: 600000`. A `run_in_background` run wrote nothing for 15 min — run it foreground.

---

## 1. WHAT THIS SESSION CLOSED (all in `contract.json`'s `progress` notes, with the numbers)

| AC | what | commit |
|---|---|---|
| **AC-16** | orrery tracks moving planets — live, with the game's own time lever and a runtime mutation control | `fb0c1f8` |
| **AC-2** (1 of 8) | design 2's orbit ellipses answer a click — `S.orbitRings`, `pickOrbitRing`, tested LAST | `3ea1902` |
| **AC-9** (1 of 4) | design 1's prism y-gauge is a grabbable handle for `_localCenter.y` — a RESTORATION of the legacy camera-height readout | `b4a2626` |
| **AC-1** (2nd half) | the click sweep was actually run; rim-cell corners (28/208 dead) now resolve via `pickSector`'s centre fallback | `906b7e4` |
| **AC-18** (new ruling) | *"disable the system screen when not in a system"* — SYSTEM tab dimmed + eaten, Tab skips it, a prism star click selects without drilling; **every surface** (designs, today's nav, cockpit panel) | `89acf6f` + the commit after |

**Ten mutants across the three builds; eight red on first run.** The two that survived each corrected a
claim of mine, not a test: the y-gauge's mouseup release (guards only the level-3→level-4→Tab path, now
pinned) and AC-1's "only inside a drawn cell" gate (provably redundant, removed).

---

## 2. ▶ THE PICKUP — AC-2's remaining rectangles, in the order I'd take them

`S.labelHits` and `S.orbitRings` are the two worked examples. The pattern, every time: **publish at the draw
site in `nav-240p-lab.html` → `node scripts/extract-nav-designs.mjs` → consume in `navViewModes/` → a test
that DRIVES the input → mutate → live.**

1. **`S.pagerRect`** (design 1, every level with a rail) — the `- = PAGE` line at `d1Rail` (lab ~1407-1410).
   Left half pages back, right half forward. The driver already has `page(dir)`. Consume in `remapClick`,
   the way the ladder caps are (`return null` = eaten).
2. **`S.listHeaderRects`** (design 2, PRISM list) — click a column header to sort by it. Driver has
   `cycleSort`; needs a `sortTo(id)`.
3. **`S.locatorRect`** (design 2 topbar `HERE · SECTOR`, lab ~1552) — action undecided; "centre on the
   player" is the obvious one. Cheap.
4. **`S.minimapRect`** / **`S.companionRect`** — no downstream identity today; log rather than invent.

**AC-9's remaining three:** the prism's zoom/index indicators, SYSTEM's ladder scroll indicator (AC-7's drag
already covers the axis — check whether a separate indicator is even drawn), the counter.

Then AC-5's GALAXY half (needs the SECTOR's own rect published out of the paint — `pickSector` now
returns a sector for every drawn-cell texel, which helps), AC-6's inbound half, design 2's GALAXY crop.

---

## 3. ⛔ THE TRAPS — the old ten still hold; these are new

11. ⭐ **`verify-workstream` in `light` mode audits ONE AC — the FIRST in the contract — by design**
    (`slice(0, 1)`). It does not take an AC filter. Pointed at AC-2/AC-9 it audited AC-1. Full mode over
    17 ACs is ~60 agents. Its skeptic was still worth it.
12. ⭐ **THE ORRERY SPLASH BOOT SPAWNS NO SYSTEM.** Click ORRERY, let the intro run: 36 s later
    `window._systemData` is undefined. **`_lab.enterSol()` is the walk** — `_debugEnterKnownSystem` →
    `spawnSystem` → the same `_applyNavArrival` a warp uses — and it is Max's own D-hold route.
    `_lab.spawnProceduralSystem(seed)` spawns but leaves `currentGalaxyStar` null, so the nav never binds
    to it (`openToCurrentSystem` early-returns). Fine for planet work, useless for nav work.
13. ⛔ **DISPATCH A KEY ONCE.** Firing a synthetic `keydown` on both `window` and `document` toggled N open
    and shut again and the overlay read `display:none` with a 0×0 canvas. Use `press_key`.
14. ⭐ **THE NAV CANVAS CAN BE PIXEL-READ FOR A SPECIFIC TEXEL** (`getImageData` with a control frame) —
    that is how the y-gauge mark and the drawn cell set were confirmed. A hash of the whole canvas still
    cannot.
15. **The GALAXY rule colour is `29,58,74`; INK.YOU is `255,176,58`; INK.KEY is `216,251,255`.**
16. **Client → canvas:** `clientX = rect.left + (texelX + 0.5) * rect.width / canvas.width`. Wait 2 rAF after
    a `mousemove` — hover resolves at the tail of `render()`.
17. **`celestialTimeMultiplier` via `_lab.setSetting`** is the honest way to make planets visibly move
    (200000 ≈ 1 rad in 6 s on Sol's innermost). Restore to 1.0.

---

## 4. FOR MAX (carried; not mine to close)

0. **Push the AC-18 commit** — he approved the earlier push; this one came after it.
1. **AC-1's picture** — *"remove the negative/non-selectable space and redraw the cells from there"* — built,
   measured, clicked; still awaits his eyes. `review.html` flip.
2. ~~The ORRERY boot with no system~~ — RULED, BUILT and WIDENED to every surface (AC-18). Nothing open.
3. **AC-12** — his walk of both menus. Two new things to try: click an orbit *line*; drag the thin strip on
   the prism's right edge.

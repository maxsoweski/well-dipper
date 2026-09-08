# Handoff — ▶ **MAX: *"There are some defects we'll have to work through but this is good for now."* THE DEFECTS ARE UNNAMED — ASK HIM WHICH, FIRST.**

> ⭐⭐ **HIS CLOSING WORD, 2026-09-08 (verbatim):** *"There are some defects we'll have to work through but this is good for now; let's handoff to a fresh session to continue."* He did NOT name the defects and did not answer asks 2-5. So the first message of the next session is ONE question: which defects did he see, on which screen, in which design? Do not guess them from §2 item 4 or from the critic's list — those are mine; his are the ones that count. Then work through them one at a time, each with a live measurement and a control, and take his rulings on asks 2-5 as they come.

> ⚠ **IN-REPO ON PURPOSE** — `/tmp` does not survive a WSL restart and this file has to outlive one.
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master). Last code commit **`876b540`**, on the
> remote (ls-remote verified); the docs commit after it carries this file — check `git log -1` and
> `git ls-remote origin refs/heads/feature/world-engine-production-L1` before assuming anything is unpushed.
> ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS, AND THE BASELINE THEY MUST REPRODUCE

```
npx vitest run --dir tests       --root /home/ax/projects/well-dipper --exclude '**/.claude/**'   # 20 failed / 8 files (EXPECTED — the same eight)
npx vitest run --dir src/cockpit --root /home/ax/projects/well-dipper --exclude '**/.claude/**'   # 698 passed
npx vitest run --dir src/ui      --root /home/ax/projects/well-dipper --exclude '**/.claude/**'   # 630 passed / 29 files  (was 551 at the start of part 3)
node scripts/extract-nav-designs.mjs --check                                                      # green
wc -l src/ui/NavComputer.js src/main.js                                                           # 4711 / 15161, BOTH FROZEN
```

⛔ **`--exclude '**/.claude/**'` IS NOT OPTIONAL** (trap 20). `src/ui` takes ~4 min — pass `timeout: 600000`;
run `navPicking.test.js` in its own invocation.

---

## 1. WHERE THIS STANDS — read these, don't re-derive them

| artifact | what it holds |
|---|---|
| `docs/NOW.md` top entry | this session against the roadmap, with the numbered asks |
| `docs/WORKSTREAMS/nav-screens-close-pass/contract.json` | **18 ACs; every `progress` note carries the live measurement.** AC-5/6/9/11 `VERIFIED_PENDING_MAX`, AC-13/14/1 `VERIFIED_BY_MAX`, AC-18 `VERIFIED_PENDING_MAX`, AC-2 open on the picture questions, AC-12 is his |
| `…/INTERFACE.md` §8 + **§8f** | the seam the three owners built to, and the corrections after the adversarial pass — **§8f overrides §8 where they differ** |
| `git log a7e920a..HEAD` | every message says what was measured and which mutants went red |
| `~/.claude/projects/-home-ax/memory/well-dipper-workflow-verify-traps.md` | the harness traps from this session (vitest filter, worktrees, process restart) |

**Closed this session, all live-measured with a control and mutation-proved:** AC-2's pager, list headers,
locator (levels 0-3) and companion strip; AC-5's GALAXY half (and the discovery that GALAXY was drawn from a
fixed disc); AC-6's inbound half (tab paths into PRISM/SYSTEM ease; a real tab cancels); AC-9's counter
scrubber (and the `+8` axis artifact behind every ladder's phantom overflow); AC-11 held with one recorded
exception; AC-13/14 closed from the record.

---

## 2. ▶ THE PICKUP — his defects first (unnamed; ask), then in order

0. **ASK WHICH DEFECTS.** He saw some on his own walk; nothing in this repo records them yet. Get screen + design + what he expected, then reproduce each live on `:5175` before touching code.

1. **AC-12 — his walk.** ORRERY → hold D into Sol → `N` → `V`. New things to try, in his words: drag the GALAXY
   band (design 2) and click `HERE · SECTOR`; click a galaxy cell and watch it light and zoom; Tab into PRISM
   and SYSTEM (and double-Tab fast); `L` in design 2 and click NAME / PLANE / SYSTEM; page the rail by clicking
   the `- = PAGE` row's halves; at SYSTEM drag the ladder and (on a system denser than Sol) the `N-M OF K`.
2. **His four picture rulings** (NOW.md asks 2-5). Each is a lab edit + re-extract if he says yes: a visible
   "readout" marking for the minimap / companion strip / `N` header; the locator at SYSTEM; a prism zoom
   gauge; a GALAXY letterbox for design 2.
3. **AC-2's still-inert elements, if he wants them**: design 1's rail detail block, both hint rows, design 2's
   status line, the rail's density bars, the HZ band. Every one is a readout; the honest options are an action
   or a visible marking, and both are pictures.
4. **Narrow-buffer debt (not at his window):** design 1's SYSTEM status row collides below ~300 texels wide
   and fires the guard ~240×/s (`status ident/sector vs TGT`). Same pattern as the hint row's `fit()`.

---

## 3. ⛔ THE TRAPS — parts 2 and 3 still hold (1-19); these are new

20. ⭐⭐ **`npx vitest run <file> --root …` MATCHES THE FILTER AS A SUBSTRING**, so every stale copy of the suite
    under `.claude/worktrees/wf_*/` runs too. Three auditors reported non-reproducible failure counts (3, 5, 15,
    26) that vanished in isolated trees; forks workers died. Always `--exclude '**/.claude/**'`.
21. ⭐ **A KILLED WORKFLOW LEAVES ITS WORKTREES**, and `git worktree remove --force` fails with "Device or
    resource busy" INSIDE the sandbox — run it with the sandbox off.
22. ⭐ **A CLAUDE CODE PROCESS RESTART DROPS EVERY BACKGROUND TASK'S COMPLETION RECORD.** The transcripts survive:
    resume an Agent with `SendMessage` to its id (it finished the whole walk afterwards), a Workflow with
    `resumeFromRunId` (check `journal.jsonl` for `result` lines first — it may have cached nothing).
23. ⭐⭐ **A TEST THAT TAKES ITS PROBE POINT FROM THE FIELD UNDER TEST PINS NOTHING ABOUT WHERE THE FIELD IS.**
    Every band shipped in the first build passed with its rect translated 60 texels, shrunk, or moved off its
    glyphs. Ask each band for ONE absolute, paint-derived coordinate (`r.x + r.w === W - 4`, ink inside / none
    beside, `caps.x1 - 4`).
24. ⭐⭐ **A FIELD WALKING IS NOT A PICTURE MOVING.** `S.view.size` walked 44 → 0.5 on a GALAXY drill for a day
    while the design drew a fixed disc. When an AC says "animates", read the PAINT's input at that level.
25. ⭐ **THE PLATE RULE IS FOR PLATES.** Only `plated()` knocks out a BG rect; a widget drawn with bare `rect()`
    calls over an earlier starfield leaves the stars visible, and eating a press there is a lost pick, not a
    fixed mis-selection.
26. **THE NAV BUFFER AT MAX'S WINDOW IS 417×240**, not 427 — every rectangle is ~10 texels narrower than the
    INTERFACE's worked numbers. Read them off `S`, never off the doc.
27. **SOL'S LADDER FITS** (15 stops end at 222 against a 226 window). Anything that needs an overflowing ladder
    — the counter, the caps, `,`/`.` — needs a denser system or a narrower viewport (227 wide → `ladderMax` 21).
28. **DESIGN 1 PUBLISHES NO `S.tabRects`** (its tab row is five equal `tabW` cells from the left edge; use
    `geo(w,h)`); design 2 does. `tabPoint` in the driver already knows this.
29. **THE FIRST PRISM ENTRY'S FRAMES ARE ~450 ms** (the synchronous star load), so a sim-clock ease that lasts
    350 ms visibly spans ~2 s once; measure eases on a warm prism.
30. ⭐ **`enterSol()` PUTS THE NAV AT SYSTEM (level 4), design as persisted in localStorage** — the ORRERY splash
    boot leaves no system at all (trap 12). Tab from 4 wraps to 0.

---

## 4. WORKING WITH MAX — re-confirmed

- ⭐⭐ **HE ANSWERS TERSELY, IN ORDER, BY NUMBER.** Number the asks; one line each; recommendation stated.
- ⭐ **HE RULES ON PICTURES AND HE WIDENS SCOPE.** Offer the wider option; don't pre-narrow.
- ⭐ **"push as needed" WAS HIS STANDING WORD THIS SESSION** — do not assume it carries into the next one.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** His walk is keys and clicks only.
- ⭐ **SAY WHAT YOU GOT WRONG**, plainly, and move on (this session: Sol's cap, the pager's search-open claim,
  the minimap eat, the strip-band cancel, and a GALAXY that never moved).

---

## 5. FOR MAX (carried; none of these is mine to close)

0. Nothing unpushed if `git ls-remote` shows the docs commit; otherwise push it.
1. **AC-12 — his walk** (§2 item 1).
2. **The four picture rulings** (NOW.md asks 2-5).

---

## 6. SUGGESTED SKILLS

- **`superpowers:test-driven-development`** — every slice is publish → consume → a test that DRIVES the input →
  mutate; the red test first.
- **`superpowers:systematic-debugging`** — if a live reading disagrees with a headless one (it did, twice again).
- **`dev-collab-scope`** — if the picture rulings open a new unit (a zoom gauge, readout markings).
- **`handoff`** — at the next seam.

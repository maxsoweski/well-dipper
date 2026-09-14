# Handoff — ▶ **THE NAV WALK SHEET IS BUILT AND PUBLISHED; MAX HAS NOT FILLED IT IN YET. READ ITS RESULTS FIRST, THEN WORK HIS DEFECTS.**

> ⭐⭐ **HIS LAST WORDS THIS SESSION (2026-09-14):** *"let's /handoff here and I'll continue in a fresh session."* Nothing else was
> decided. The session before that (2026-09-08) opened with *"create a visual guide to the menu system (it can be simple but
> must explain all functions of each screen), so I can test it"* — that guide is the walk sheet below. He did NOT name the
> defects the part-4 handoff asked for; the sheet is how he names them.

> ⚠ **IN-REPO ON PURPOSE** — `/tmp` does not survive a WSL restart. **Branch** `feature/world-engine-production-L1` (lane A,
> **NOT** master). **Two commits are LOCAL and UNPUSHED:** `d3db23f` (the sheet) and `0dbde0b` (NOW + handoff pointer), on top
> of `9327476` which IS on the remote (ls-remote verified 2026-09-14). This handoff's commit makes three. He has not said push.
> ⛔ Hundreds of untracked stray PNGs are normal — **never `git add -A`**.

---

## 0. THE INVOCATIONS — unchanged; no `src/` was touched since `876b540`

See `docs/FEATURES/handoff-2026-09-08-nav-close-pass-part4.md` §0 for the five commands and their expected counts
(`tests/` 20 failed / 8 files, `src/cockpit` 698, `src/ui` 630 / 29 files, `--check` green, `NavComputer.js` 4711 /
`main.js` 15161). They were not re-run this session because nothing under `src/` changed — say so if asked, do not claim green.

---

## 1. WHERE THIS STANDS — read these, don't re-derive them

| artifact | what it holds |
|---|---|
| **The walk sheet** — https://claude.ai/code/artifact/1dd706c5-3d98-490a-b508-1ad689c332de | 70 checklist rows over GALAXY/SECTOR/REGION/PRISM/SYSTEM/search/between-screens, in all three looks, with ✓ ✗ + notes. In-repo source of truth: `docs/FEATURES/nav-menu-guide.html` (served at `/well-dipper/docs/FEATURES/nav-menu-guide.html` on `:5175`). Screenshots are inlined data URIs captured live in Sol. |
| **Its results** — artifact db doc `walk/results` | `{ <rowId>: { v: 'pass'|'fail'|null, note, at }, __general: { text } }`. **Empty as of 2026-09-14** (`read_db` returned "No document"). Read: `Artifact action:"read_db" db_op:"get" collection:"walk" doc_id:"results"`. |
| `docs/NOW.md` top entry (2026-09-08 later) | the session against the roadmap + what was measured while building |
| `docs/FEATURES/handoff-2026-09-08-nav-close-pass-part4.md` | the pickup order (§2), traps 1-30, working-with-Max notes — **all still hold**; its banner carries a pointer to the sheet |
| `docs/WORKSTREAMS/nav-screens-close-pass/contract.json` + `INTERFACE.md` §8/§8f | the 18 ACs and the seam; unchanged |
| `~/.claude/projects/-home-ax/memory/well-dipper-nav-walk-sheet.md` | the memory note: row-id scheme, how to republish, what was measured |

**What the sheet's status tags mean** (so his ticks can be read correctly): MAX SIGNED OFF = he approved it on an earlier walk;
YOUR EYES = built + measured, waiting for him; INERT = drawn but deliberately does nothing; KNOWN GAP = documented shortfall,
not fixed; LEGACY = only in the old nav. A ✗ on an INERT or KNOWN GAP row is him overruling a decision, not a new bug.

---

## 2. ▶ THE PICKUP — in order

0. **`read_db walk/results` FIRST.** If it has rows: every `v:'fail'` row (by id, with its note) plus `__general.text` IS the
   defect list. Reproduce each live on `:5175` before touching code (route in §3, trap 37). If it is still empty: ask him,
   in one line, whether he walked the sheet — do not build anything on a guess.
1. **The defects, one at a time**, each with a live measurement and a control (mutant red), per part 4 §2 item 0.
2. **Asks 2-5** (the picture rulings) — printed on the sheet under "Rulings still open" with recommendations
   (pass / park / close / no). Take them as they come; a yes on any of them is a lab edit + `node scripts/extract-nav-designs.mjs`.
3. **Push** — three local commits; he has not said push. Ask once, as an approval, no command.
4. Then part 4 §2 items 3-4 (AC-2's still-inert elements if he wants them; the narrow-buffer debt).

**If he wants the sheet changed:** edit `docs/FEATURES/nav-menu-guide.html` directly (the scratch `guide.src.html` +
`build-guide.mjs` + `shots/` lived in the session scratchpad and are gone). New screenshots come from the LIVE game
(`nc._canvas.toDataURL('image/png')` is the native 417×240 buffer), never from `nav-240p-lab.html`. Republish with the
Artifact tool passing `url:` = the link above so it keeps its URL and its `db` capability (`capabilities: {db: {}}` — a
non-empty declaration must restate it; omitting `capabilities` carries it forward).

---

## 3. ⛔ THE TRAPS — part 4's 1-30 still hold; these are new (31-38)

31. ⭐⭐ **"IS THE NAV OPEN" IS `#nav-computer-overlay`'s `display` (flex/none), NOT the canvas's parent.** `nc._canvas.parentElement`
    stays `display:block` while the overlay is closed. I read the wrong element for twenty minutes and briefly believed Esc did
    nothing; it closes the nav (`main.js` Escape branch → `toggleNavComputer()`), and with the drawn search open it closes only
    the search. Both measured with REAL keys.
32. ⭐ **SYNTHETIC `KeyboardEvent`s REACH `NavComputer._onKeyDown` (window listener) BUT NOT `main.js`'s `N` HANDLER.** Tab, V, L,
    `/`, letters all work synthetically while the nav is open; `N` (open/close) does not. Use `press_key` for `N` and `Esc`.
    Under a synthetic Escape the drawn search did not close either — treat synthetic Escape as unreliable.
33. **TAB IS NOT BOUND IN LEGACY MODE** (`viewMode === null`). The tab strip is the only level control there; a synthetic
    or real Tab at legacy SYSTEM leaves the level at 4. Legacy tab centres: five equal columns, `y = H - 18` on the DOM canvas.
34. **THE DRAWN SEARCH SWALLOWS EVERY KEY** while open — V, Tab, N included (`search.js` `key()` returns true for all).
    A script that types then presses V will find `"solvvvv"` in the query. Close it (real Esc, or a miss-click) first.
35. ⭐ **`nc._canvas.toDataURL()` IS THE RIGHT CAPTURE.** Under a design it is the 417×240 buffer (14-55 KB PNG). Under legacy
    the canvas is resized to the viewport (2021×1162 here) — downscale before embedding (half-size JPEG q78 ≈ 10-40 KB).
36. **BIG `evaluate_script` PAYLOADS GO TO `filePath`**, never inline — one pass of 16 PNGs is ~700 KB of base64 and would
    have filled the context. Split with a node one-liner afterwards.
37. **THE ROUTE THAT WORKS:** reload `:5175` → wait for `window._lab.enterSol` → `_autoNav?.stop()` → `await _lab.enterSol()`
    (lands at SYSTEM, `well-dipper-nav-view-mode` from localStorage, `'rail'` on his machine) → real `N`. `enterSol` returned
    `{ok:true, name:'Sol'}`, 13 planets. Stop `_autoNav` again after the spawn.
38. **`docs/GAME_BIBLE.md` AND `docs/FEATURE_AUDIT.md` DO NOT EXIST IN THIS REPO** (the CLAUDE.md rule names them);
    `docs/FEATURES.md` and `docs/FEATURES/nav-computer.md` are the nearest, and `nav-computer.md` is STALE ("default level
    PRISM", 3201 lines) — background only, never a source for a functional claim.

---

## 4. WORKING WITH MAX — re-confirmed, plus one new

- ⭐⭐ **HE REFRAMES THE PICKUP.** Asked "which defects?", he asked for a guide to test with instead. Take the reframe; it
  was the better instrument. Expect the same again: build what lets him rule, not what the handoff scripted.
- ⭐⭐ **HE ANSWERS TERSELY, IN ORDER, BY NUMBER.** Number the asks; one line each; recommendation stated.
- ⭐ **HE RULES ON PICTURES AND HE WIDENS SCOPE.** Offer the wider option; don't pre-narrow.
- ⛔ **HE DOES NOT USE THE BROWSER CONSOLE.** His walk is keys and clicks only — the sheet is written that way.
- ⭐ **SAY WHAT YOU GOT WRONG**, plainly, and move on (this session: the wrong "open" element, §3 trap 31).
- **"push as needed" does NOT carry over** between sessions; three commits are waiting on his word.

---

## 5. FOR MAX (carried; none of these is mine to close)

1. **Walk the menus with the sheet** beside the game and tick the rows; ✗ + a note is how a defect gets named.
2. **Rulings 2-5** on the sheet ("Rulings still open") — answer by number, or in the notes box at the bottom.
3. **Push the three commits?** Recommend yes.

---

## 6. SUGGESTED SKILLS

- **`superpowers:systematic-debugging`** — for every ✗ row: reproduce live, root-cause, then fix; the sheet's "what should
  happen" column is the expected behaviour.
- **`superpowers:test-driven-development`** — each fix = a test that DRIVES the input (real key / real click path) goes red first,
  then the fix, then a mutant.
- **`dev-collab-scope`** — if a picture ruling (zoom gauge, readout markings, letterbox) opens a new unit.
- **`artifact-capabilities`** — before republishing the sheet, so the `db` declaration and `url:` update flow are right.
- **`handoff`** — at the next seam.

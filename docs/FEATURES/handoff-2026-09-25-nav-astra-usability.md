# Handoff — nav menus: Astra usability review + fixes (2026-09-25)

Lane A, branch `feature/world-engine-production-L1` (`~/projects/well-dipper`, NOT master). **Pushed through
`fc7774f`** (ls-remote verified). Serves the 35% SCREENSAVER MVP milestone, SCREENSAVER tier: the nav is the
pilot's instrument for choosing where the ship goes.

This note only covers what 2026-09-25 added. The standing context is the previous handoff —
**`docs/FEATURES/handoff-2026-09-20-nav-restorations.md`** (§0 invocations, §4 traps 49-63, §5 working with
Max, §6 the asks) — read it first; nothing there is repeated here.

## 1. What happened (in order)

1. Max: *"have Astra begin by reviewing/testing the menu systems and giving feedback. Then parse that feedback
   and decide what to implement … whether the visual menu systems are easy to navigate/use based on what you
   can see onscreen. Implement any obvious fixes."*
2. 21 full-window live captures (Sol; design 1 every level + hover/select/moons/search; design 2 every level +
   hover/moons/L; legacy galaxy + system) → Astra review job. **The record:**
   `.astra/jobs/20260925-083724-nav-menu-usability-review/` (`brief.md`, `report.md` = the full review and its
   ranked top 10). Captures were in the session scratchpad (gone); re-capture if needed.
3. Astra's verdict: **design 1 is the usability baseline** (lists, named actions); design 2 wins only on the
   system's spatial layout. Its #1 ("header/commit text clipped") was **false at full resolution** — the text
   is flush to the buffer edge, not cut. Everything else checked out against the pixels.
4. Built, each verified live before/after in Sol, all committed + pushed:

| Commit | What the pilot sees now |
|---|---|
| `c628756` | Where-am-I label says SOL (was `UNKNOWN` in design 1 / `—` in design 2 outside PRISM — star rows only exist once PRISM loads them → `D.hereName`). No `WARP TO SOL · 0.0 LY` from inside Sol: row reads `SELECT A STAR TO WARP`, chip unarmed, Enter refuses (`D.targetIsHere` + `commit()` guard). Design 2's legend readable over the SECTOR/REGION density field (sky-ink knockout per run). `R/F UP/DOWN`. Search empty state adds `STARS, SYSTEMS, DEEP SKY`. |
| `551e0af` | Quick Tabs no longer dropped — a Tab during a 2D drill `_anim` is banked (`pendingTabs` in `navViewModes/index.js`) and spent when the ease lands; four quick Tabs from GALAXY reach SYSTEM (was two levels). Self-target gone: `TGT —`, `TARGET —`, no orange diamond over the YOU dot. |
| `fc7774f` | **Finding 24 fixed:** Sol's real planet + moon names in both designs (`buildBodies` prefers `sys._knownSystemNames`, generator stays the procgen fallback) — all 41 rows real. Belt rows named ASTEROID/KUIPER BELT like the map. |

Health at `fc7774f`: `src/ui` **1198/1198** at `--testTimeout=60000` (the 125 s
`navDefects2026.driver` mult test can die under whole-suite contention; green alone). New tests are
sabotage-checked: rapid-Tab (`navKeys.test.js`), known names (`navDefects2026.driver.test.js`, last describe),
`SELECT A STAR TO WARP` vocabulary probe (`navAffordances.test.js`).

## 2. Not done — Astra's findings left for Max (judgment calls or bigger)

- Hover callouts cover neighbouring labels (d1 ladder, d2 orrery); moon labels collide in dense groups.
- Design 2: SECTOR/REGION cells have no IDs; no list at SYSTEM (L there shows nothing); the texture outside the map square.
- Search cannot find planets (scope is stars/systems/deep-sky — expanding it is a product call).
- Design 2's `ENTER` legend has no verb — deliberate per the comment at `designs.js` ~2717 (the chip names the act); Astra flagged it anyway.
- Hover vs selected vs target not labelled as distinct states (Astra's cross-cutting #1, medium effort).
- Column headings/units on the rails; prism height lines unexplained.

## 3. FOR MAX (carried; recommendation stated; he answers by number)

The 2026-09-20 handoff's §6 list, updated:
1. **Artifact republish** — unchanged (recommend "force").
2. **Findings 25-28** — 24 is DONE (`fc7774f`). 25 (design 2 stems through its hint rows) is **probably fixed**
   by `c628756`'s legend knockout — unverified at the widest prism zoom; check live before building anything.
   26-28 unchanged. Recommend go.
3. **Push** — DONE (through `fc7774f`).
4-7. Unchanged (Esc in the sub-view; the two 09-18 decisions; the review leftovers; follow-ons + AC-11 UAT walk).
8. **NEW — which of §2's items to build.** My rec: the hover/selected labelling and design 2's list at SYSTEM are
   the two with real navigation cost; the rest can park.

## 4. Traps learned today

- **Astra review mode works** even though the astra SKILL.md says review types "arrive later":
  `astra_job.py new --type review --project <repo> --brief <md> --ref <png>… --effort high`, sandbox OFF,
  `run_in_background`. Read-only sandbox; the answer is `report.md`. ~5 min for 21 images.
- In the headless harness a Tab out of GALAXY lands instantly (no `_anim`); live it runs a 400 ms ease. A test of
  anything ease-dependent must start the ease itself (`nav._startDrillAnim(...)`) — see the rapid-Tab test.
- `D.here` is null at every level but PRISM (no `_localStars`) — use `D.hereName` for anything printed.
- Vitest `console.log` is swallowed in this repo's config; debug by throwing the values.

## 5. Suggested skills

- **`wd-browser-up`** — bring-up + key-dispatch traps (keys on `document`, `press_key n` for the nav).
- **`astra`** — for another review round (§4 has the review invocation the skill doesn't document yet).
- **`superpowers:systematic-debugging`** — if finding 25 is not fixed by the knockout.
- **`dev-collab-scope`** — if §2's hover/selected labelling grows into a multi-system unit.
- **`handoff`** at the next seam.

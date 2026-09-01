# Handoff 2026-09-01 — ▶ MOBILE PASS SHIPPED & LIVE · WORLD-ENGINE PROVINCE LANE PAUSED, UNBLOCKED

> ⚠ **IN-REPO ON PURPOSE, against the handoff skill's instruction to use the OS temp dir.**
> `/tmp` does not survive a WSL restart — it cost a session on 2026-08-25. Read this copy.

⛔⛔ **TWO REPOS AND THEY HAVE DIVERGED. Read `docs/FEATURES/mobile-fixes-live-on-master-2026-08-28.md`
(this branch) BEFORE resolving any merge conflict in `src/main.js`, `index.html` or `src/style.css`.**

| | |
|---|---|
| **`~/projects/well-dipper-trunk`** | branch `master` @ `f4bd0c9` — **deploys to welldipper.maxsoweski.com**. All mobile work lives here. Clean, pushed. |
| **`~/projects/well-dipper`** (this one) | `feature/world-engine-production-L1` @ `ccdb6b0` — lane A, world engine. Clean, pushed. Has the deep link and the PLANNING DOCS; has NONE of the mobile code. |

---

## 0. WHAT IS LIVE NOW (all verified on the real public URL, not just tests)

Read the commits for detail — each carries its own full record. Do not re-derive.

| what | commit (trunk) | how it was verified |
|---|---|---|
| `?system=<seed>` deep link | `909085d` | loaded `welldipper.maxsoweski.com/?system=rocky-0`, seed + planet count correct, console clean |
| Speed dial reachable (5 buttons, none clipped) | `f1ac868` | emulated iPhone landscape — all five on screen; Settings was at 400px, off screen, now 244px |
| iOS fullscreen guards + safe-area insets | `93c442c` | production bundle carries the guards; CSS bundle carries `safe-area-inset` |
| Star-map touch (drag / pinch / tappable results) | `b833538` | source-fenced; **feel is [NEEDS-MAX]** |
| WebGL context-loss recovery | `eac337d` | forced a real `WEBGL_lose_context` cycle live; overlay → restore → scene drawing again. **Max confirmed app-switching works on his iPhone** |
| Mode-aware dock, no dead slot, no duplicate | `ffe2838` + `7d805b8` | live: picking HELM relabels the centre slot instantly |
| **HELM cockpit look (touch + gyro)** | `f4bd0c9` | live: **0.00° camera drift with no drag vs 92.82° with one** |

**Against Max's own framing of mobile HELM — "fine navigation entirely autopilot, the player is there to
look around the cockpit and choose which planet/moon or system to go to next at most" — every part now
works.** That framing is the design north star for mobile; it is recorded in
`docs/FEATURES/helm-on-mobile-2026-08-31.md` (trunk) with the full control table.

---

## 1. ▶ OPEN FOR MAX (carry these forward until answered)

| item | state |
|---|---|
| **Nav-computer keyboard on iOS** | The search field now takes focus on open. ⚠ It may raise the keyboard over the map. If it does, focus on FIRST TAP instead — **do not delete the affordance**, it is the only way to choose a destination rather than let `autoSelectWarpTarget` pick. Asked 3×, unanswered. |
| **Two small mobile items, offered and not taken** | (a) the dock is live and tappable over the splash and title screens where there is nothing to step through; (b) nothing tells you the nav computer's search is how you pick a system. Neither blocks. |
| **Deselect on touch** | No touch equivalent for Escape. Long-press vs a button is a FEEL call; parked twice, Max has not ruled. ⛔ Do not re-raise a third time — it is not blocking. |
| **World-engine province lane** | Measured, unblocked, NOT built. See §2. |

---

## 2. THE WORLD-ENGINE LANE (this branch) — paused mid-flight, nothing broken

`writeBodyRelief` moved to `src/worldengine/dispatch/bodyRelief.js` (`df6818c`), which **removed the
prerequisite** the plan thought was a 108 KB file move. The province measurements are the appendix
**§ THE PROVINCE CUBE, MEASURED** at the END of `docs/FEATURES/one-pipeline-two-frontends-PLAN.md`.

⛔ **Read that appendix before scoping `uCratonColor`.** Headlines: cost is not the objection (class
fractions flat from a 2500-node mesh, 60× cheaper than the lab's 40k); value is REAL BUT QUALIFIED
(97 of 124 solid bodies get a body-derived palette, 27 get a seed-decorative one — on the despun path
province is byte-identical across a rocky, a gas giant and an icy moon at the same seed).

**Still missing to bake it:** the sphere mesh builder (three-coupled, GPU-free) and
`createProvinceCube`/`bakeProvinceCube` (GPU-coupled → `src/rendering/bake/` under carried C25).
⚠ The C25 split is "needs a renderer" vs "does not", NOT "rivers.js vs tectonic.js".

⭐ Max's steer: pick this up **when he is back at a desk** — judging a ground palette is a visual call
that wants his eyes on a big screen, and he has been travelling.

---

## 3. ⛔ TRAPS THAT COST TIME THIS SESSION — every one of them bit twice or more

1. ⛔⛔ **`stripCommentsPreservingOffsets` PRESERVES OFFSETS.** A stripped comment becomes whitespace of
   the SAME LENGTH, so a scan window sized to the CODE lands inside blanked comment and matches nothing
   **while reading the right file at the right place**. Hit **five times**. Size windows to the comments.
2. ⛔⛔ **`blankLiteralText: true` blanks string INTERIORS.** Event names, module paths and
   `typeof x === 'function'` are all string literals and are INVISIBLE in that view. Keep two views:
   blanked for structure, strings-intact for anything containing a literal. Hit **five times**.
3. ⛔ **A bare `addEventListener('touchend')` regex matched the SPLASH SCREEN's listener 9,600 lines
   from the intended one.** There are 19 such sites in `main.js`. Anchor on the element.
4. ⛔⛔ **SABOTAGE EVERY NEW FENCE.** Three of my own tests would have certified a defect. One compared
   a release position against the tap-slop constant `400` instead of the first `return`, so the code
   could be moved to a genuinely broken position and stay green. **A fence that has not been sabotaged
   is a fence you are guessing about.**
5. ⛔ **A sequential global string-replace chained on itself** rewriting citations (11422→11443, then
   that same 11443→11464 for a different one). A rename map whose value is also a key must be applied
   POSITIONALLY in one pass.
6. ⛔ **`readPixels` on the default framebuffer returns black** whether or not the scene draws
   (`preserveDrawingBuffer` is false). A screenshot is the honest instrument.
7. ⛔ **A harness that copies code for a live test can truncate it.** One copy anchored its end on a
   WORD that also appears in the comment above the code — three probes were spent diagnosing a handler
   that had never been copied. Anchor on the construct, never on prose.
8. ⚠ **One `test:baseline` run showed spurious extra failures** (15 files vs the standing 8) in suites
   the change did not touch, under concurrent-build load. Two clean runs agreed with the standing set.
   Re-run before believing a surprise.

---

## 4. ⭐⭐ THE METHOD LESSON, because it produced a wrong answer that reached Max

**I told Max "a phone has no cockpit" and built a three-option recommendation on it.** It came from a
code comment (*"mobile can never be Flight"*) and an audit line repeating the same comment. Neither says
anything about what RENDERS — `_cockpitShouldRender()` has no mobile check at all — and a prior
workstream had already recorded driving mobile HELM *"with the cockpit rendering"*. **One emulated-phone
screenshot refuted the document.** Full correction in `docs/FEATURES/helm-on-mobile-2026-08-31.md` (trunk).

⇒ **For anything about what a PLAYER SEES, the screenshot comes before the analysis.** And a comment
about a camera mode is not a statement about what renders.

---

## 5. WORKING WITH MAX (delta on the previous handoff; that one's §5 still holds)

- ⭐ **He answers narrow, concrete phone questions and ignores broad ones.** "Tap the gear and count the
  buttons" came back as *"6 total including the gear"* — which located his viewport ceiling between 352
  and 400 px and **overturned the audit's own recommendation**. The deselect feel question, asked twice
  in the abstract, got nothing. Ask for a count or a yes/no, not a preference.
- ⭐ **He pushes back on framing, and he is usually right.** "Helm seems not to make sense on mobile"
  was correct; my "correction" of his premise was not.
- ⭐ **Push cadence:** he approves `master` pushes readily and they AUTO-DEPLOY. Always verify the deploy
  (`gh run list`) then the live URL. Lane A pushes are routine and do not deploy.
- ⭐ Workflows: he said *"use workflows where helpful"*. The shape that worked all session is
  **sonnet finders → opus refuters → opus synthesis**, read-only. The adversarial review of `ffe2838`
  found a real regression (12 findings, 5 refuted, 7 survived). ⛔ Pin `model` on every `agent()` call.
- ⛔ Read `feedback_director-level-recaps` IN FULL before any end-of-turn summary.

---

## Suggested skills

- **`superpowers:verification-before-completion`** — ⭐ the single highest-value one. Every wrong claim
  this session was one I had not run.
- **`superpowers:systematic-debugging`** — if picking up the province lane or any live defect.
- **`dev-collab-scope`** — only if Max opens a NEW multi-system feature. The mobile pass and the deep
  link are shipped; do not re-scope them.
- ⛔ **NOT `brainstorming`** for the province cube — its shape is already measured in the PLAN appendix.

## Not in scope

Touch flying / a virtual stick / lifting the `TOY_BOX` camera lock — **withdrawn as work nobody asked
for.** Under Max's "fine navigation is entirely autopilot" framing the stick, throttle and roll axes all
drop out, and nothing in the shipped look fix needed the camera lock touched.

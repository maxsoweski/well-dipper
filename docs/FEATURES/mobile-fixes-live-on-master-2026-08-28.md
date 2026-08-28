# ⛔ THE MOBILE FIXES ARE LIVE ON `master` AND ARE **NOT** ON THIS BRANCH

**Written 2026-08-28 for whoever merges `feature/world-engine-production-L1` into `master`.**
Read this BEFORE resolving a conflict in `src/main.js`, `index.html` or `src/style.css`.

## The failure this note exists to prevent

Five mobile fixes were built directly on `master` (in `~/projects/well-dipper-trunk`) because Max was
travelling and needed them on his phone — `master` is what deploys to
**welldipper.maxsoweski.com**, and this branch does not. They are **shipped and in front of users now.**

This branch is OLDER on every one of those files. So a merge that resolves a conflict by "taking the
branch's side" **silently un-ships live fixes**, and nothing will red — the tests that guard them live
on `master` too, so they would come along with the reverted code and pass against it.

## What is where, measured 2026-08-28

| change | this branch | `master` |
|---|---|---|
| `?system=<seed>` deep link | ✅ `801ace9` | ✅ `909085d` — **transplanted, so this WILL conflict** (same content, unrelated commits) |
| Speed-dial reordered so SETTINGS is reachable | ❌ still `autonav gyro minimap orbits fullscreen settings` | ✅ `settings orbits minimap gyro autonav fullscreen` |
| Fullscreen API guards + self-hiding controls (`src/util/fullscreen.js`) | ❌ absent | ✅ `93c442c` |
| `viewport-fit=cover` + `env(safe-area-inset-*)` | ❌ absent | ✅ `93c442c` |
| Star-map touch: drag / pinch / tappable results | ❌ absent | ✅ `b833538` |
| `webglcontextlost` / `restored` recovery | ❌ absent | ✅ `eac337d` |

⚠ **The deep link is the trap.** Both branches have it, as two separate commits with identical content,
so git sees a conflict rather than a fast-forward. Resolving it either way keeps the feature — but the
same resolution habit applied to the four rows below it throws away shipped work.

## The rule

**On any conflict in these three files, `master` wins for the mobile hunks.** They are verified live
(a forced `WEBGL_lose_context` cycle, a real production bundle, and a load of the public URL), and this
branch has never run them.

## The real fix, and it is debt, not a decision

This divergence is **debt**, not an arrangement to keep. The right end state is that both branches carry
the mobile work. Nobody has done that yet because this lane is mid-flight on the world engine and the
port touches `src/main.js`, which is line-cited across the plan docs. **Port it here at the next natural
seam** — it is five self-contained commits and `git cherry-pick` is the whole job.

⛔ Do **not** resolve this by declaring the branches permanently different. That is exactly the move
`feedback_converge-dont-declare-divergence` names: a lab/game — or here, branch/branch — divergence is
debt until someone proves otherwise, and "it is already reasoned about in a doc" is not that proof.

## Context

- The pass plan that generated this work: `docs/FEATURES/mobile-pass-plan-2026-08-28.md` (on THIS branch —
  the plan and the code ended up on opposite branches, which is itself part of the mess this records).
- What only Max's phone can settle is listed in that plan's `[NEEDS-MAX]` section.

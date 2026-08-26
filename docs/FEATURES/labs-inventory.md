# Labs inventory — what each harness is, and which are retired

Repo-root `*-lab.html` pages accumulated one per investigation. This file is the single index:
what each one was for, whether it is still live, and — for retired ones — **where its findings
landed**, so deleting the page does not delete the provenance.

> **Why an index and not one merged lab.** The pages are not one family. They belong to three
> distinct programs (below) plus a set of finished one-shots. Merging a finished one-shot into the
> live lab adds surface to maintain and buys nothing; merging the two *architectures* is a design
> decision, not a cleanup. So: retire the finished ones, index everything, and leave the
> architecture question explicit rather than settling it by tidying.

---

## The three programs

### 1. GPU shader combiner chain — `world-engine-lab.html` (LIVE, 201 commits, 7593 lines)
The world-engine lab. ~28 relief stages composed per fragment in GLSL, plus the driver/preset
system. **This is what the game port consumes** (`src/worldengine/**`, port slices 1–3).
Supporting: `planet-lod-lab-core.js` (CPU oracles/mirrors), `planet-lod-height.glsl.js`,
`planet-lod-uniforms.js`, `planet-lod-rivers.js`.

✅ **The atmo fork is CLOSED (merged 2026-07-30, `c854c09`).** For most of July this same lab ran two
ways — `:5175` on the port lane and `:5178` on `feature/world-engine-atmo-3b` — and the standing rule
was "don't restructure this file." That rule is retired: atmo went dormant on 07-21 and its 5 lab
commits are merged back. **There is one lab again.**

Of the 8 worktrees, only atmo-3b ever carried unique lab work. The rest hold older untouched copies
and pick the current lab up on their next rebase — they were never forks needing consolidation, and
their apparent "divergence" is staleness, not conflicting work. Check before assuming otherwise:

    for br in <branches>; do b=$(git merge-base <main-lane> $br)
      git log --oneline $b..$br -- world-engine-lab.html | wc -l; done

⚠ **Two contradictory fences now guard the same two driver-assembly lines** (`rebakeE5Bands` and
`applyStormState`), a scar from the fork: atmo's `worldengine-atmo-deck-spiral-rhines` test pins the
`giantDriverScalars(state.planetRadiusEarth` call, and L1's `radius-live-feed-fence` pins the
`radius: (_gcond.radiusEarth ?? 1) / 11.2` read. Both are satisfied deliberately — the spread supplies
the bundle, the explicit key overrides it with the provably identical value. Do not "tidy" the
redundancy away without reconciling the two contracts on purpose; deleting either line silently drops
a lane's regression guard.

### 2. CPU tectonic/hydrology substrate — `world-engine-relief-lab.html` (DORMANT since 2026-06-23)
A genuinely different approach: geological *history* rather than appearance. One mutable height
field walked through epochs — base step → E6 tectonic build → E9 fluvial carve. Pure compute in
`relief-*.js` (713 lines across 7 modules), covered by `tests/world-engine-relief-slice.test.js`;
the page only visualises.

**Status: parked, NOT retired.** It is not redundant with program 1 — program 1 makes surfaces
*look* right, this makes them *have a history*. A plausible future synthesis is that this generates
the macro relief and province partition which the combiner chain then dresses. Keeping it costs one
dormant page and a passing test. **Whether it is revived, folded in, or retired is a design call —
do not settle it as part of a tidy-up.**

### 3. Fluvial investigation — 5 pages + 2 galleries (DORMANT, work UNFINISHED)
`rivers-lab.html`, `rivers-terrain-lab.html` (+ `.main.js`), `rivers-viewdependent-lab.html`,
`fluvial-drainage-lab.html`, `carve-packing-lab.html`, `rivers-spike-gallery.html`,
`rivers-terrain-gallery.html`.

**Status: KEEP — these are the harness for work that has not happened yet.** Rivers/deltas/outflow
are the last and hardest port tier (they need per-planet baked cube textures + CPU routing, where
the game binds zero textures today), and there is a standing undiagnosed defect: rivers and deltas
move ~0 pixels on Earthlike while the drivers derive full fluvial activity. Retiring these pages
before that is resolved would delete the only instruments for diagnosing it.

⚠ **`rivers-terrain-lab.main.js` has a live test dependency** — `tests/ws4-router-zero-drift.test.js`
source-scans it with `readFileSync`. It cannot be moved or deleted without rehoming that gate.

---

## Retired 2026-07-30 — findings already in production

Deleted from the tree; recoverable from git history. Each was a single-purpose page whose result
shipped into production code, which is why the page had nothing left to do. The provenance comments
in the production files are left intact on purpose — they still record where the work came from.

| retired page | what it was for | where the finding landed |
|---|---|---|
| `accretion-disk-lab.html` | rim glow shader for the warp tunnel | `src/rendering/objects/StarRenderer.js` |
| `autopilot-lab.html` | empirical easing-curve selection | `src/auto/AutopilotMotion.js` (cubic-out, commit `3ced806`) |
| `portal-traversal-lab.html` | warp traversal state machine + gate geometry | `src/effects/WarpPortal.js`, `src/core/ScaleConstants.js` |
| `planet-titletoggle-lab.html` | 46-line title-toggle spike | superseded by the title screen in `index.html` |
| `rings-lod-lab.html` | near-tier ring particle-cloud LOD | `world-engine-lab.html` F51 rings-v2 + `ring-particle-cloud.js` |

None had any test dependency (verified) and every inbound reference was either archived planning
docs or a provenance comment — no imports, so nothing breaks.

---

## Rule going forward

A new `*-lab.html` is the right move for an isolated investigation — that discipline is why these
exist and it works. The cost is that finished ones linger. **When an investigation's finding lands
in production, retire its page in the same commit and add a row above.** That keeps the index true
without anyone having to run an audit later.

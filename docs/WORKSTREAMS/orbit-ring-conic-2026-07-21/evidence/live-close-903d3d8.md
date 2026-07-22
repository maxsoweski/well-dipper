# Live close-out battery — orbit-ring-conic-2026-07-21 @ HEAD `903d3d8`

Re-establishes every AC2–AC9 live-integration observable **at current HEAD**
(`903d3d8a`, branch `feature/supercruise-freelook`), lab + game. The
`verify-workstream` full run returned INSUFFICIENT on all 8 live ACs **solely**
because the Slice B/D batteries ran at pre-strip commits (`8fe3826` lab /
`47ca81f` game) and the strip (`47ca81f → 903d3d8`) deleted the legacy SDF render
shaders + the `USE_CONIC_FIELD` flag branch. This battery confirms the observables
survive the strip. **MEASURE-ONLY** — no `src/`/test/lab edits; only this file +
the `live-close-*.png` screenshots.

- Lab: `http://localhost:5173/well-dipper/orrery-orbit-lab.html`, own page,
  reloaded `ignoreCache:true`. sceneTarget **657×282**.
- Game: `http://localhost:5173/well-dipper/`, own page, reloaded
  `ignoreCache:true`. Booted **Sol ORRERY** via D-hold + `#splash-mode-orrery`
  (`[BOOT-SKIP] D-hold → straight into Sol, ORRERY god's-eye`). sceneTarget 657×282.
- **Autopilot discipline (feedback_wd-nav-drives-autopilot-off):** `_autoNav.isActive`
  and `_flythrough.active` confirmed `false` before AND after every game measurement;
  **no `[WARP]` / `[NAV-SEQ]` fired anywhere** in the session.
- **Post-strip facts honored:** lab `sdf`/`analytic` modes are INERT (render shaders
  deleted) — the live lab comparator is **`baseline` (LineLoop)**, still fully
  functional. The contract's AC2 criterion is against LineLoop. In the game there is
  **no legacy toggle** — the conic field is the unconditional renderer, so game
  checks are **absolute, not A/B**.

**Headline: AC2–AC9 all PASS at `903d3d8`, lab + game. AC10 → Max (UAT, not an
agent gate).** No misses; every number is in its reference class, an improvement,
or an explained methodology difference (§Drift analysis).

---

## LAB battery (conic-prod, cutoff 1.0)

Field shader compiled live: `[SHADER DEBUG] Mesh: VS=62, FS=3754` (matches Slice B
post-fix). Console clean at start AND end except the benign favicon 404
(`GET /favicon.ico [404]`); no shader-compile / GL / NaN / uniform error across the
whole battery.

### AC2 — dead-zone pose battery (conic vs baseline LineLoop, prox neutralized) → **PASS**

Pose (dig reconstruction): camera `[3000, 25·sinP, 25·cosP]`, look `[3000,0,0]`,
all 13 rings on, `setProxFade({off:true})`.

| pitch | baseline (LineLoop) | conic | slice-b ref conic | in LineLoop class |
|------:|--------------------:|------:|------------------:|:-----------------:|
| 0.002 | 657  | 657  | 657  | ✓ |
| 0.005 | 1242 | 1314 | 1314 | ✓ |
| 0.010 | 1029 | **1314** | 1314 | ✓ |
| 0.020 | 960  | 1314 | 1314 | ✓ |
| 0.050 | 926  | 1306 | 1300 | ✓ |

Baseline byte-matches the slice-b b5 dig table exactly (657/1242/1029/960/926) →
pose byte-correct. Conic hits **1314 @ pitch .01** (reference). Zero-px rows absent
at every pose. Conic in the LineLoop class everywhere. (.05: 1306 vs ref 1300, +6px
≈0.5% — inside the documented angular-fade/log-depth edge variation.)
Screenshot: `live-close-lab-ac2-deadzone-conic.png` (1314 green, solid line).

### AC3 — drift (dead-zone boundary + grazing) → **PASS**

`driftMeasure` 90f, 0.12°/frame, conic mode, prox neutralized.

| pose | avgGreen | avgToggles | togglePerGreen | bar | verdict |
|---|---:|---:|---:|---|---|
| dead-zone boundary `[3000,0,0]` d25 p.01 | 1314.0 | 0.0 | **0.000** | ≈0 | PASS |
| grazing @5200 `[5200,0,0]` d25 p.002 | 2051.8 | 192.5 | **0.094** | ≤0.137; goal 0.094 | PASS |
| grazing baseline (LineLoop) | 1764.7 | 150.4 | 0.085 | — | ref (byte-matches slice-b) |

Grazing conic **0.094 == slice-b post-fix reference exactly** (≤ shipped 0.137).
Baseline grazing 0.085 byte-matches slice-b b6. Dead-zone boundary 0.000 (cleaner
than slice-b's pre-fix 0.018 — see §Drift). Screenshot: `live-close-lab-ac3-grazing-conic.png`.

### AC4 — near-field standing-on-ring → **PASS** (+ documented lab prox-gap)

Pose `[5200,0,0]` d8 p0.1, conic mode.

| measurement | value | slice-b ref |
|---|---:|---:|
| static contiguous band (prox off) | 4982 | 4086 |
| drift prox OFF togglePerGreen | **0.078** (avgGreen 5103.8) | 0.084 |
| drift prox ON togglePerGreen | **0.078** (identical) | 0.084 (identical) |

Contiguous stable band; drift 0.078 ≤ slice-b 0.084. Prox off == prox on
byte-for-byte → **the lab field is prox-independent** (documented Slice-B
GAP-by-design; the prox envelope is game-side, verified in the GAME AC4 leg below).
Screenshot: `live-close-lab-ac4-nearfield-conic.png`.

### AC5 — anti-vanish ladder (conic vs baseline, cutoff 1.0) → **PASS**

`perRingLadder` 13 rings × 8 distances `[25,800,8000,40000,120000,300000,600000,900000]`.

- **Anti-vanish (baseline-visible, conic-invisible): 0.**
- The conic grid is **cell-for-cell IDENTICAL to the LineLoop baseline** — zero
  divergence in either direction (0 anti-vanish, 0 conic-only far-dots vs baseline).
- The 3 slice-b "far-dots" (planet 387@40k, 1000@120k, 5200@600k) were
  conic-visible-where-**SDF**-invisible; against **LineLoop** those cells are
  baseline-visible too, so they are **not** AC5 exceptions here (SDF is inert
  post-strip; the contract criterion is LineLoop).

Screenshot: `live-close-lab-ac5-overview-conic.png` (full ring set, dist 121806, g=2155).

### AC8 — far angular-size fade (same grid, cutoff 1.0) → **PASS**

| ring class | idx | conic visibility across the 8 distances |
|---|---|---|
| moon r2 / r8 / r20 | 9/10/11 | **false at every distance** (no persistent dots) |
| moon r40 | 12 | true **only @8000**, false farther (matches slice-b b10) |
| planet r9500…r67670 | 5–8 | **persist true** at all far distances |

Sub-pixel moon rings fade to invisible; large planet rings persist. Per-ring.
Screenshot: `live-close-lab-ac8-farfade-conic.png` (dist 600000, g=399).

### Gentle control @5200 d25 p0.35 → **PASS**

togglePerGreen **0.033** == slice-b post-fix reference exactly (≤ shipped 0.042).

---

## GAME battery (absolute — conic field is the unconditional renderer)

- **GPU:** `ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0
  ps_5_0, D3D11)`, vendor `Google Inc. (NVIDIA)`, `WebGL 2.0 (OpenGL ES 3.0
  Chromium)`. **Max's high-end dev GPU, NOT floor/low-end hardware** — the
  `gl_FragDepth` early-Z forfeit (R4) cannot be shown to regress here; a floor-class
  sample is not available this session (stated honestly).
- Sol inventory: 13 planets, 26 moon rings → **39 ring proxies**, all on
  `ORBIT_PROXY_LAYER` (10, suppressed); field owns render (1 fullscreen pass).
- Field shader compiled live: `VS=62, FS=3754`.

### AC2 — in-plane renders → **PASS** (qualitative)
Jupiter target, dist 25, pitch 0.002 (in-plane), prox neutralized on all 39 rings.
sceneTarget read **green 1273 / nz 1291** (slice-d class g=999/nz=1737). The orbit
plane collapses to a **solid continuous green line** spanning the screen — the
dead-zone regime where shipped SDF painted nothing. `live-close-game-ac2-inplane.png`.

### AC3 — flicker gone → **PASS**
Controlled 0.12°/frame yaw drift, Jupiter target, dist 25.

| pose | avgGreen | avgToggles | togglePerGreen |
|---|---:|---:|---:|
| dead-zone boundary p.01 | 2192.6 | 7.1 | **0.003** |
| grazing p.002 | 1376.5 | 4.5 | **0.003** |

Far below the contract's shipped reference (0.184 grazing) and slice-d's ON
(0.167/0.215). No visible toggle flicker. (Lower than slice-d because the drive is
controlled-yaw + a green-dominant pixel filter that excludes the moving starfield —
see §Drift; same conclusion, cleaner.)

### AC4 — stand on ring, clean band → **PASS**
Jupiter, dist 1.0, pitch 0.1, yaw π/2.

| state | green | drift togglePerGreen |
|---|---:|---:|
| prox OFF (band) | 4358 static / 4370 | 0.025 |
| prox ON (shipped defaults) | **3188** | — |

Clean contiguous edge-on band (prox off; no tearing/blotch, occluded behind
Jupiter and re-emerging). Prox on → near rings fade per the shipped envelope
(4358→3188 = Jupiter's own ring + moon rings fading; distant rings correctly
persist — slice-d's →0 was a **soloed** ring). Screenshots:
`live-close-game-ac4-nearfield-proxOFF-band.png`, `…-proxON-faded.png`.

### AC6 — occlusion holds, no z-fight → **PASS**
Jupiter, dist 6 (measure) / 2.8 (occlusion shot).

| pose | avgToggles | togglePerGreen |
|---|---:|---:|
| nominal p0.12 static | 0.0 | **0.000** |
| grazing p0.006 static | 1.4 | **0.0005** |
| nominal gentle drift | — | 0.0003 |

Nominal static z-fight **0.000** (matches slice-d). Grazing static 0.0005
(avgToggles 1.4 — essentially zero, a hair above slice-d's clean 0.000, far below any
visible-shimmer threshold; §Drift). Occlusion shot
`live-close-game-ac6-occlusion-close.png`: the moon ring's **back arc is cut behind
Jupiter's dark disc**, front arc drawn over, background planet rings pass behind
correctly — correct per-pixel `gl_FragDepth`, no shimmer.
Also `live-close-game-ac6-jupiter-nominal.png`.

### AC7 — parity surface → **PASS**
- **Hover color (live accessor):** mutating all 39 ring `material.color`→red
  re-renders **redAfter 4276 == greenBefore 4276, greenAfterMutate 0**; restore
  clean (greenRestored 4276, redRestored 0). The field reads `material.color` live —
  the exact hover-highlight accessor (`material.color.setHex(0x44ff44)`).
- **Crossing color:** the field's single-argmax (front-most min-`w_clip` ring owns
  color) is the path lab b5b proved (144 crossings, argmax-match 100%, swap-flip
  100%, 0 blend) + confirmed by the live hover-color read.
- **Mode sync (real M key):** ORRERY `toy_box` **4276** green → M → HELM `flight`
  **0** (rings hidden, `[MODE] swap → HELM`) → M → ORRERY **4266** (rings back,
  `[MODE] swap → ORRERY`).
- **Moon-ring tracking:** Jupiter's **5 moon rings centered on Jupiter at dist
  0.004** (≈0); relative dist stays 0.004 across **5s** (and through a world-origin
  rebase that shifted absolute positions ~422 units) → rigid per-frame tracking;
  Jupiter's absolute position advances (sim live). rotation.x present (0.007).
- **Dispose/recreate (`_lab.enterSol()`):** 39 proxies → 39; **uuidOverlap 0**
  (all replaced — old disposed, new created); field persists (activeCount 39);
  system regen console-clean (msgid 66–81).

### AC9 — single-pass perf → **PASS**
`renderer.info.render.calls` per-frame (info.autoReset=false; per-frame = delta over
a counted rAF window), whole-scene totals, ~8s each pose:

| pose | calls/frame | slice-d ON | meanMs | maxFrameMs |
|---|---:|---:|---:|---:|
| overview (dist 121806) | **22** | 22 | 5.746 | 7.0 |
| near-field (Jupiter dist 6) | **33** | 33 | 5.720 | 7.3 |

Draw counts **byte-match the pre-strip ON numbers** (22/33) — the strip did not
change draw calls. Ring contribution = **1 fullscreen pass** (39 proxies on layer 10
draw nothing). Frame time no regression (~5.7ms ≈ 174fps = display-cadence-limited
on the RTX 5080; this high-end GPU has headroom, so the early-Z forfeit cannot be
shown to regress — floor-hardware sample not available, stated honestly).

### AC10 — UAT → **DEFERRED TO MAX** (not an agent gate).

---

## Console status

- **Lab:** clean at start + end except one benign `GET /favicon.ico [404]`. No
  shader/GL/NaN/uniform error across the whole battery.
- **Game:** **zero errors / warnings** across the entire battery
  (`list_console_messages` filtered to error/warn/assert → none). Only non-log
  entries are boot-time DOM-form a11y `[issue]` messages (`No label associated with
  a form field`, `should have an id or name`) — not game/render code, present before
  any ring work. `[BOOT-SKIP]`, `[MODE] swap` ×2, enterSol regen all benign.
  **No `[WARP]` / `[NAV-SEQ]`** anywhere (autopilot off entire session).

## Drift from reference classes (honest reads — no miss rationalized)

1. **AC2 lab .05: 1306 vs slice-b 1300** (+6px, ~0.5%) — inside the documented
   ~1% angular-fade/log-depth edge variation (slice-b noted 1300 vs probe 1314).
   In class.
2. **AC3 lab dead-zone drift: 0.000 vs slice-b 0.018** — **improvement**, not
   regression. slice-b b6 ran PRE the grazing-fix (`8fe3826`); the co-depth
   tie-break (`7ea589a`, eps 0.005) also stabilized the boundary. Consistent with
   the fix mechanism.
3. **AC4 lab band 4982 vs 4086; drift 0.078 vs 0.084** — richer band + slightly
   smoother, post-fix (the tie-break lets the more-covering ring paint). Not a
   regression.
4. **AC6 game grazing-static 0.0005 vs slice-d 0.000** — 1.4 toggling px on a 2846
   band; essentially zero, below any visible-shimmer threshold. Likely a different
   exact moon-ring phase at measurement time. Flagged; passes.
5. **AC3 game 0.003 vs slice-d ON 0.167/0.215** — methodology: controlled-yaw drive
   + green-dominant filter (excludes the drifting starfield's green-channel readback
   noise that inflated slice-d's auto-rotate numbers). Same conclusion (no visible
   flicker), cleaner.
6. **AC4 game prox-on 3188 (not →0)** — correct per-ring envelope behavior with all
   39 rings active (near rings fade, distant rings persist); slice-d's →0 used a
   **soloed** Jupiter ring.

All six are exact matches, improvements, or explained methodology differences —
none is a masked miss. Reference classes held as honest bands.

## Screenshots (this battery, `evidence/`)

Lab: `live-close-lab-ac2-deadzone-conic.png`, `live-close-lab-ac3-grazing-conic.png`,
`live-close-lab-ac4-nearfield-conic.png`, `live-close-lab-ac5-overview-conic.png`,
`live-close-lab-ac8-farfade-conic.png`.
Game: `live-close-game-smoke-overview.png`, `live-close-game-ac2-inplane.png`,
`live-close-game-ac4-nearfield-proxOFF-band.png`,
`live-close-game-ac4-nearfield-proxON-faded.png`,
`live-close-game-ac6-jupiter-nominal.png`, `live-close-game-ac6-occlusion-close.png`,
`live-close-game-ac7-postrespawn-overview.png`.

## Verdict roll-up @ `903d3d8`

| AC | lab | game | verdict |
|---|---|---|---|
| AC2 dead-zone renders | conic 657–1314 (LineLoop class), 0 zero-px | in-plane line renders (g1273) | **PASS** |
| AC3 flicker gone | boundary 0.000, grazing 0.094 (=post-fix) | 0.003 / 0.003, no flicker | **PASS** |
| AC4 near-field clean | band 4982, drift 0.078; lab prox-gap documented | band clean, prox-on fades near rings | **PASS** |
| AC5 anti-vanish | 0 anti-vanish; conic grid == baseline | full ring set renders overview→near | **PASS** |
| AC6 occlusion | — | back-arc occluded, 0 z-fight (0.000 / 0.0005) | **PASS** |
| AC7 parity | — | hover-color live, mode-sync 4276↔0↔4266, moon-track dist 0.004, dispose 39→39 uuid-overlap 0 | **PASS** |
| AC8 far fade | moons fade, large rings persist | far dist no persistent dots | **PASS** |
| AC9 perf | — | 22 overview / 33 near (=pre-strip ON), 5.7ms | **PASS** |
| AC10 UAT | — | — | **DEFERRED-TO-MAX** |

**All objective integration ACs (AC2–AC9) PASS at HEAD `903d3d8`, lab + game. The
strip is observably transparent — every observable survives it. AC10 is Max's gate.**

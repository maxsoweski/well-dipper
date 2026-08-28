# Mobile pass plan — every control, judged for a phone browser (iOS Safari especially)

**Produced 2026-08-28** by a read-only 9-agent workflow (4 sonnet surveyors over four control
surfaces → 4 opus refuters → 1 opus synthesis) against `feature/world-engine-production-L1` @ `3a92b19`.
Nothing was edited, built, or served.

**Max's ask, verbatim:** *"we never updated it to make it work well on mobile, we need to do passes
over all the controls and think through how to make them work well in a phone browser, esp safari"*

⛔⛔ **NO iPHONE WAS IN THE LOOP, AND THE LABELS ARE THE WHOLE POINT.** Every claim below is marked
`[CODE]` (read off this repo, with file:line), `[PLATFORM]` (an asserted WebKit behaviour, from
knowledge, NOT observation) or `[NEEDS-MAX]` (only his actual phone settles it). A `[PLATFORM]` guess
wearing a `[CODE]` label is the failure mode this whole audit was structured to prevent — §4 is the
short list of things to check on the device, each a look rather than a test.

⭐ **THE SINGLE BIGGEST ERROR THE SURVEYS MADE, kept here because it is a lesson about method, not
about mobile: two of four surveyors reported that touch drag-orbit and pinch-zoom DO NOT EXIST.
They do — `src/camera/ShipCameraSystem.js:1554-1606`, on the same canvas.** The surveyor grepped only
`src/main.js` and reported a scoped result as repo-wide. That false absence was ranked as the surface's
largest gap and produced an open question asking Max to confirm the design intent of a feature that
already ships. **Then one refuter made the identical mistake** — asserting both canvas touch handlers
are `{passive:true}` when three of the five are `{passive:false}` and call `preventDefault()` — inside
the very sentence accusing a surveyor of a platform-claim-in-code-clothing. Treat any absence claim
resting on an unshown grep as unverified, including one in this document.

# Well Dipper — Mobile Pass Plan

**Written 2026-08-28 against `feature/world-engine-production-L1` @ `3a92b19`. Read-only audit; nothing in the repo was changed.**

Max's ask: *"we never updated it to make it work well on mobile, we need to do passes over all the controls and think through how to make them work well in a phone browser, esp safari."*

**Honesty rule used throughout.** No iPhone was in the loop. Every claim is labelled:
- **[CODE]** — read directly off this repo, with file:line.
- **[PLATFORM]** — an asserted WebKit/iOS behaviour, from knowledge, not observation.
- **[NEEDS-MAX]** — only his actual phone settles it.

---

## 1. What actually happens when you open this on an iPhone today

It comes up, and in ORRERY it is genuinely playable: the mode chooser works, you can drag one finger to orbit the camera and pinch to zoom (this is real and live — `src/camera/ShipCameraSystem.js:1554-1606` — two of the four surveys claimed it did not exist), a tap selects a body, a double-tap warps, and the five dock buttons at the bottom do what they say. What was never done is the phone-specific half of the job. The blinking FULLSCREEN button that greets you on the title screen calls a bare `document.documentElement.requestFullscreen()` with no guard (`src/main.js:7343`, `:7347`) which I assert throws on iPhone rather than silently doing nothing [PLATFORM]. The gear opens a speed dial whose six buttons stack straight up to 400 CSS pixels above the bottom edge (`src/style.css:158-170` + `:87-88`), which is taller than a landscape iPhone's visible viewport — so SETTINGS, the last button, is probably drawn off-screen in the one orientation the game tries to force you into. The nav computer opens from the dock but its star map has zero touch listeners (`src/ui/NavComputer.js:292-298`), so you can't pan or zoom it. There is no `viewport-fit=cover` and no `env(safe-area-inset-*)` anywhere in the stylesheet, so the 44px dock buttons sit hard against `bottom: 0` where the home indicator lives. Two panels still size themselves with `100vh` even though the same file already knows to use `100dvh` (`src/style.css:15` vs `:1157`, `:1194`). And there is no `webglcontextlost` handler anywhere in `src/`, so if Safari drops the GL context on an app-switch the canvas goes black permanently. Short version: the touch *camera* was built and works; the touch *chrome* around it was not finished, and nothing was ever guarded for WebKit specifically.

---

## 2. The control ledger

Every control, one row each. Verdicts: **WORKS** · **DEGRADED** (reachable, worse than desktop) · **UNREACHABLE** (no touch path) · **DEAD** (asserted broken on iOS) · **OFF-SCREEN** (rendered but likely outside the viewport) · **DEV-ONLY** (out of scope for a player pass).

### Boot & mode

| control | what it does | mode | how you reach it on a phone today | verdict | evidence |
|---|---|---|---|---|---|
| ORRERY / HELM chooser | The cold-open. Picks your station. | pre-mode | Tap either button. Wired to **both** `click` and `touchend` with `preventDefault` (`src/main.js:5529-5537`). | **WORKS** | [CODE] |
| Tap black background | Dismisses the chooser, defaults to ORRERY | pre-mode | Tap anywhere off the buttons. | **WORKS** | [CODE] |
| Title-screen FULLSCREEN button | Blinking mobile-only button, bottom-right of the title screen (`src/style.css:369-388`, shown only under `pointer: coarse`) | pre-mode | Tap it. Handler calls bare `document.documentElement.requestFullscreen()` (`src/main.js:7343`, `:7347`) — no `webkit` fallback, no optional chaining. | **DEAD** — I assert iPhone Safari has no element Fullscreen API, so this is `undefined()`, a synchronous TypeError, *before* `.catch()` can see it. | [CODE] for the unguarded call · [PLATFORM] for the absence · [NEEDS-MAX] |
| Tap to dismiss title | Skips to the game | pre-mode | Tap the canvas (`src/main.js:14788`). | **WORKS** | [CODE] |
| Landscape orientation lock | `screen.orientation.lock('landscape-primary')` on first touch | both | Automatic, fires once. Double-guarded (try/catch + `.catch(()=>{})`, `src/main.js:14852-14859`), so it fails silently. Latched by `_orientationLocked` **before** the attempt (`:14853-14854`) — one shot per page load, no retry, no `orientationchange` listener. | **DEAD** — I assert Safari does not implement `lock()` in a normal tab. Consequence: portrait is a reachable state the layout was not built for. | [CODE] for the one-shot latch · [PLATFORM] for the API · [NEEDS-MAX] |
| Mobile-HELM boot | Picking HELM boots a hands-off autopilot tour | HELM | Tap HELM at the chooser. Note: mobile is hard-locked to TOY_BOX camera (`src/camera/ShipCameraSystem.js:446`, `:512`), so this is an **exterior** tour with no cockpit — the comment at `src/main.js:14796` claiming "FLIGHT (cockpit) camera, same as desktop HELM" is corrected four lines later at `:14802-14806`. | **WORKS** (as designed) | [CODE] |
| Mode swap HELM→ORRERY | The **only** exit from mobile-HELM (`src/main.js:13311-13314`) | HELM only | Tap `#mode-swap-btn`, top-right. Wired **`click` only** (`src/main.js:13378`) — every other mobile-reachable button in the file gets an explicit `touchend`. Also ~31px tall (`font-size:12px` + `padding:7px 16px`, `src/style.css:775-781`). | **DEGRADED** — I expect the synthesized click to land, but it's the one control where failure strands the player, and the hit box is under 44pt. | [CODE] for click-only + size · [PLATFORM] for click synthesis · [NEEDS-MAX] |
| Mode swap ORRERY→HELM | Deliberately refused on mobile | — | Nothing. `if (_isMobile && !swap.exitFlight) return;` (`src/main.js:13323`). | **BY DESIGN** | [CODE] |

### The bottom dock (5 buttons, always visible)

All five are wired via one `touchend` listener on `.mobile-dock` (`src/main.js:15040`). All are 44×44 (`src/style.css:58-60`), inside a 56px band pinned to `bottom: 0` (`:43-44`) with **no safe-area padding**.

| control | what it does | mode | how you reach it on a phone today | verdict | evidence |
|---|---|---|---|---|---|
| ◀ prev | ORRERY: steps the *selection* back. HELM tour: steps the leg back. | both | Tap. Regime-gated via `bodyCycleAction` (`src/main.js:14947-14972`). | **WORKS** | [CODE] |
| ▶ next | Mirror of prev | both | Tap (`src/main.js:14973-14996`). | **WORKS** | [CODE] |
| ▶ autonav-toggle | Arms/stops the tour in HELM. **Inert in ORRERY** by Max's own ruling. | both | Tap. In ORRERY the entire branch is one `console.log` (`src/main.js:14921-14922`) — no class change, no flash, nothing a player can see. ORRERY is the phone default, so this is the *default* experience of this button. | **DEGRADED** — reads as a broken button. | [CODE] |
| ◎ warp | Auto-selects a target and jumps (instant-cut in ORRERY, cinematic in HELM tour) | both | Tap (`src/main.js:14890-14903`). | **WORKS** | [CODE] |
| ✦ nav | Opens the nav computer DOM overlay | both | Tap (`src/main.js:14912`). Opens fine; see the nav-computer rows for what happens next. | **WORKS** (opening only) | [CODE] |
| dock buttons vs. home indicator | — | both | Buttons occupy 6–50px above the viewport bottom. No `viewport-fit=cover` in `index.html:5`, zero `env(safe-area-inset-*)` in `src/style.css` (grepped, 0 hits). | **DEGRADED** — I assert the landscape home-indicator strip (~21px) overlaps the lower third of every dock button. | [CODE] for the absence · [PLATFORM] for the inset · [NEEDS-MAX] |

### The FAB speed dial (6 buttons)

Geometry, straight off the stylesheet [CODE]: `.mobile-speed-dial` is `position: fixed; bottom: 64px` with no height (`src/style.css:121-127`), so it's a zero-size anchor. Its children are `position: absolute; height: 40px` at `bottom: 56/104/152/200/248/296` (`:158-170`). Absolute **top edges above the viewport bottom** are therefore **160 / 208 / 256 / 304 / 352 / 400 px**.

| control | what it does | mode | how you reach it on a phone today | verdict | evidence |
|---|---|---|---|---|---|
| ⚙ FAB | Opens/closes the dial | both | Tap (`src/main.js:14868-14872`). 48×48. | **WORKS** | [CODE] |
| tap-outside to close dial | Dismisses the dial | both | Tap elsewhere (`src/main.js:14875-14879`). Neither `preventDefault` nor `stopPropagation` — the same tap reaches the canvas `touchend` at `:14818` and can also fire `trySelect`. | **DEGRADED** — dismissing the menu probably also selects whatever was behind it. | [CODE] · [NEEDS-MAX] to confirm it's noticeable |
| ▷ autonav (dial twin) | Same as the dock's autonav-toggle | both | Tap. Same silent `console.log` inert branch in ORRERY (`src/main.js:15002-15003`). Top edge 160px. | **DEGRADED** | [CODE] |
| ⭕ gyro | Device-orientation free-look | both (no regime gate exists — `src/main.js:15016-15024` has none, unlike its autonav siblings) | Tap. Top edge 208px. Permission flow is correct: feature-detects `DeviceOrientationEvent.requestPermission` and calls it before the first `await`, inside a touchend (`src/camera/ShipCameraSystem.js:1229-1237`). **But** denial is silent — the caller is `.then(ok => { if (ok) ... })` with no else (`src/main.js:15021-15023`). A refused prompt looks identical to a dead button. | **DEGRADED** | [CODE] for the silent-denial path · [PLATFORM] for the iOS prompt and the site-level Motion & Orientation setting · [NEEDS-MAX] |
| ▣ minimap | Toggles the minimap into the HUD slot | both | Tap. Top edge 256px. Off by default on mobile (`src/main.js:384`). Turning it **on** in landscape places it via the desktop branch `hudRect(0.73, 0.02, 0.255, 0.255)` (`src/rendering/RetroRenderer.js:865-868`) — 2% up from the bottom edge, i.e. directly over the 56px dock and the FAB. The portrait branch explicitly relocates it "to avoid mobile menu overlap"; landscape gets no such treatment. | **DEGRADED** | [CODE] |
| ◎ orbits | Toggles orbit lines | both | Tap (`src/main.js:14997-14999`). Top edge 304px. | **WORKS** | [CODE] |
| ⛶ fullscreen | `toggleFullscreen()` | both | Tap. Top edge **352px**. Hidden in *portrait* by `src/style.css:825-830` — the orientation with room to spare — and left visible in landscape, which may not fit. The call itself is the one correctly-guarded site (`src/main.js:10737`), so under the iPhone-has-no-Fullscreen assertion it degrades to a **visible button that does nothing and never lights up** (`onFsChange` at `:15045-15048` never fires). | **DEAD** (if the assertion holds) **and possibly OFF-SCREEN** | [CODE] for the guard + the portrait-only hide · [PLATFORM] · [NEEDS-MAX] |
| ☰ settings | Opens the settings overlay | both | Tap. Top edge **400px**. This is the last button in the stack. | **OFF-SCREEN (likely)** — I assert a landscape iPhone's visible viewport is roughly 320–360 CSS px tall with Safari's bar showing, which puts this button entirely outside it. `src/main.js:15033` is the **only** mobile caller of `toggleSettings()`; the others are keyboard. If it's off-screen, settings is unreachable on a phone. | [CODE] for the 400px geometry · [PLATFORM] for viewport height · [NEEDS-MAX] — highest-value single check |

### Canvas gestures

| control | what it does | mode | how you reach it on a phone today | verdict | evidence |
|---|---|---|---|---|---|
| one-finger drag → orbit camera | Rotates yaw/pitch with an 85° clamp — the same maths as the mouse path | both | Drag. `canvas.addEventListener('touchmove', …, {passive:false})` at `src/camera/ShipCameraSystem.js:1573`, registered from `_setupListeners()` which the constructor calls unconditionally (`:424`), on the same canvas main.js binds (`src/main.js:207-209`). | **WORKS** | [CODE] |
| two-finger pinch → zoom | `this.distance *= scale`, clamped to min/max | both | Pinch. `src/camera/ShipCameraSystem.js:1586-1599`, seeded at `:1565-1570`. | **WORKS** | [CODE] |
| gyro vs. drag conflict | — | both | The drag branch is gated `… && !this.gyroEnabled` (`src/camera/ShipCameraSystem.js:1575`). **Turning gyro on silently removes one-finger look.** Pinch still works. | **DEGRADED** | [CODE] |
| tap → select | Selects the body/orbit under the finger | both | Single tap. `src/main.js:14818-14849`. Two costs: a 20px movement slop (`:14828`, which is what keeps drag-orbit from also selecting — correct), and a deliberate **350ms `setTimeout`** on every single tap to disambiguate the double-tap (`:14846-14852`). | **WORKS**, with 350ms of built-in latency | [CODE] · whether it *feels* laggy is [NEEDS-MAX] |
| tap → select an orbit line | Selects a body by tapping its orbit path | both | Tap. `trySelect` uses a **6 CSS-pixel** hit radius (`src/main.js:14141`); the desktop hover-preview that shows you where the band is uses a wider **8px** (`:14510`) and has no touch equivalent. So touch gets the tighter target *and* no preview. | **DEGRADED** | [CODE] |
| double-tap → warp | Enters a new system | both | Two taps within 350ms (`src/main.js:14828-14846`). | **WORKS** | [CODE] |
| tap empty space → deselect | Desktop's Escape does this | both | No explicit touch trigger; only the implicit "tap hit nothing" outcome of `trySelect`. | **DEGRADED** | [CODE] · [NEEDS-MAX] |

### The nav computer (reachable from the dock, in both modes)

| control | what it does | mode | how you reach it on a phone today | verdict | evidence |
|---|---|---|---|---|---|
| open / close | — | both | Dock button opens; close `×` and backdrop both have `touchend` handlers (`src/main.js:6125`, `:6131`). On coarse pointers the `×` is moved *inside* the panel (`src/style.css:1206-1211`) rather than floating above it. | **WORKS** | [CODE] |
| drag to pan the star map | — | both | **Nothing.** The canvas's complete listener set is `mousemove / mousedown / mouseup / mouseleave / click / wheel / contextmenu` (`src/ui/NavComputer.js:292-298`). Zero touch or pointer listeners in the whole 4,446-line file. | **UNREACHABLE** | [CODE] |
| wheel to zoom the star map | — | both | Nothing — same reason. | **UNREACHABLE** | [CODE] |
| tap to select on the map | — | both | The `click` listener at `src/ui/NavComputer.js:296` is the only candidate. | **PROBABLY WORKS** — depends entirely on WebKit synthesizing a click from the tap. | [PLATFORM] · [NEEDS-MAX] |
| search field | A real `<input type="text">` with a results list, shown automatically whenever the DOM nav computer opens (`src/ui/NavComputer.js:434-438`, built at `:506-554`) | both | Tap the field, type on the iOS keyboard. Its own `keydown` `stopPropagation` (`:561`) already stops game keybinds firing while typing. **This is the best mobile affordance in the app and nothing points at it.** | **WORKS** (probably) | [CODE] |
| tap a search result | Selects/warps to it | both | Result rows are wired **`mousedown` only**, with `preventDefault` (`src/ui/NavComputer.js:649`). | **PROBABLY WORKS** — iOS synthesizes mousedown before click on a tap. | [PLATFORM] · [NEEDS-MAX] |
| WASD / R-F local-view pan | A second, private keyboard listener that pans the local grid view (`src/ui/NavComputer.js:414-415`, `:1190-1197`) | both | Nothing. | **UNREACHABLE** | [CODE] |
| panel height | — | both | `.nav-computer-panel { height: calc(100vh - 40px) }` (`src/style.css:1194`), while the same file uses `100dvh` for html/body at `:15`. | **DEGRADED** — I assert iOS resolves `100vh` against the *large* viewport, so the panel is taller than what's visible, and `body { overflow: hidden }` (`:8`) means you can't scroll to the rest. | [CODE] for the unit mismatch · [PLATFORM] · [NEEDS-MAX] |

### Desktop-only controls (no touch equivalent)

| control | what it does | mode | how you reach it on a phone today | verdict | evidence |
|---|---|---|---|---|---|
| W/A/S/D + Shift | **One four-key control**: free-fly the ORRERY camera through space (`src/main.js:12602-12608`). In HELM the same W/S becomes supercruise throttle (`:12580-12586`). | ORRERY free-fly / HELM throttle | Nothing. Touch orbits and zooms around a focus; it never *translates*. | **UNREACHABLE** | [CODE] |
| Q/E roll | Ship roll in manual HELM | HELM | Nothing, and the state is unreachable anyway. | **UNREACHABLE** | [CODE] |
| R (drive engage/dropout) | The core "take the helm" action | HELM | Nothing — handler's first line is `if (_isMobile) return;` (`src/main.js:13790`). | **BY DESIGN** | [CODE] |
| F (hands-on / free-look) | The single door into manual flight, free-look, throttle, roll, the mouse joystick, LMB-drag-look and middle-mouse peek | HELM | Nothing — `if (_isMobile) return;` (`src/main.js:13842`). Plus the camera is hard-locked to TOY_BOX regardless (`src/camera/ShipCameraSystem.js:446`). | **BY DESIGN** — this one decision is what makes the whole manual-flight cluster dead. | [CODE] |
| Mouse virtual joystick | Cursor offset from canvas centre steers pitch/yaw | HELM hands-on | Nothing. Gate is `_scManual && !scHead.held && !freeLook.latched` (`src/main.js:14433`); arming a tour latches free-look (`:9394`), which closes it. | **BY DESIGN** | [CODE] |
| Middle-mouse hold-to-peek | Momentary look, recentre on release | HELM | Nothing. Gyro is a persistent look *mode*, not a momentary peek. | **UNREACHABLE** | [CODE] |
| Minimap drag-to-rotate | Rotates the minimap view | both | Nothing. Every `_minimapDragging` write is in a mouse handler (`src/main.js:14540, 14572, 14684-14688, 14731-14735`). Not iOS-specific — there is simply no touch writer on any platform. The `requestPointerLock?.()` at `:14576` is in this branch and is moot for touch. | **UNREACHABLE** | [CODE] |
| Minimap tap-to-select | Selects a body from the minimap | both | Works — `trySelect` runs the minimap hit-test first regardless of input source (`src/main.js:14029-14034`), and the canvas `touchend` calls it. | **WORKS** | [CODE] |
| 1–9 direct jump | Jump straight to body N | both | Nothing. Prev/next only: 6 taps to reach body 7 vs. one keypress. The nav computer's search field is the ready-made fix. | **DEGRADED** | [CODE] |
| H (HUD master toggle) | Hides brackets/body-info/minimap for a clean view | both | Nothing (`src/main.js:13613-13618`). Plausibly player-facing. | **UNREACHABLE** | [CODE] |
| Escape | The dismiss cascade | both | Covered piecemeal — every overlay has its own `touchend` close button and backdrop-tap. The uncovered leaf is target deselection. | **DEGRADED** | [CODE] |
| K (keybinds overlay) | Reference card | both | Nothing — only `src/main.js:13428` opens it. Low value regardless: its content (`index.html:64-87`) is 24 rows of WASD / MIDDLE CLICK / SCROLL, pure desktop vocabulary. | **UNREACHABLE** — and shouldn't be fixed by adding a trigger | [CODE] |
| Cockpit-glass nav map (wheel zoom) | On-glass NAV panel in HELM | HELM | Unreachable in principle: mobile never enters FLIGHT camera, and `CockpitPointerRouter` is mouse-only (`src/cockpit/CockpitRig.js:1025-1032`). | **N/A on mobile** | [CODE] |
| Space → burn to selected body | Commits an ASSIST burn. **Live on desktop HELM** — `burnWorkflowAvailable` returns true for helm (`src/flight/flightModes.js:470-472`); only the *button* was retired (`:496-502`). | HELM | Nothing. | **UNREACHABLE** (a real desktop capability with no touch path) | [CODE] |
| G, T, X, \`, ArrowDown, Alt, Shift+W/N/L/B, F9 | Object gallery, sound test, Pretext Lab, debug HUD, inspector, ship scanner, lab/QA shortcuts | both | Nothing. | **DEV-ONLY** — out of scope. Alt/ship-scanner is the one worth asking about. | [CODE] |

### Cross-cutting

| item | what it does | mode | state today | verdict | evidence |
|---|---|---|---|---|---|
| WebGL context loss | — | both | No handler exists. Grep for `webglcontextlost` / `contextrestored` / `loseContext` across `src/` and `index.html` returns **zero** (positive control: 125 `addEventListener` calls in `src/`, so the search reaches). Meanwhile `resize()` disposes and rebuilds four render targets, two at full resolution (`src/rendering/RetroRenderer.js:816-848`). | **DEGRADED** — I assert iOS Safari drops WebGL contexts under memory pressure and on backgrounding; with no `preventDefault()` on the loss event the canvas goes permanently black and only a reload recovers. | [CODE] for the absence · [PLATFORM] · [NEEDS-MAX] |
| Cockpit render target on mobile | — | both | `cockpitTarget` is a full `width × height` target with its own depth buffer, built unconditionally every resize (`src/rendering/RetroRenderer.js:843-847`) — even though mobile can never enter the cockpit. | **DEGRADED** — wasted full-res allocation on the tightest GPU budget | [CODE] |
| DPR / resolution | — | both | `setPixelRatio(1)` + `pixelScale = 3` (`src/rendering/RetroRenderer.js:31`, `:58`) means a DPR-3 iPhone does the same scene-pass fragment work as a DPR-1 monitor. Genuinely good. Offsetting it: `logarithmicDepthBuffer: true` (`:49`) forces fragment depth writes. | **WORKS on paper** — a frame time is [NEEDS-MAX] | [CODE] for the config · [PLATFORM] for the tile-GPU cost |
| Boot weight | — | both | ~3.5MB of catalog JSON fetched at module scope (`src/main.js:300-318`), plus the bundle. Not blocking first paint (module scripts are deferred, and the fetch is fire-and-forget with the comment "Load in background"). Over the wire, gzipped, the real first load is closer to **~2.3MB**. | **DEGRADED** on cellular, not a boot blocker | [CODE] |
| `touch-action: none` on `<body>` | — | both | `src/style.css:10` is the only `touch-action` in the file. Three overlays scroll (`.settings-panel` `:463-471`, `.soundtest-panel` `:573-581`, `.debug-panel` `:1003-1011`) with no override of their own. | **UNKNOWN** — per spec the walk stops at the nearest scroll container, which would mean these still scroll. Do not assume it's broken. | [CODE] for the CSS · [PLATFORM]/[NEEDS-MAX] for whether it actually blocks |
| Two mobile detections | — | both | JS uses `'ontouchstart' in window` (`src/main.js:378`, and again inline at `:209`, and again at `src/rendering/RetroRenderer.js:859`); CSS gates on `@media (pointer: coarse)` (`src/style.css:37, 369, 825, 832, 1206`). `document.body.classList.add('is-mobile')` at `:383` is written and **never read** (grep: one hit, the write). | **DEGRADED** — a plain iPhone agrees on both signals, so this is not an iPhone bug; the risk case is an iPad with a trackpad (coarse false, ontouchstart true → dock hidden, camera still locked). | [CODE] · the iPad case is [PLATFORM]/[NEEDS-MAX] |

---

## 3. The passes

Ordered so each one clears ground for the next.

### Pass 1 — Stop the dead taps *(small; ~half a day)*

Make every control that calls a WebKit-missing API either work or not be there.

- Route the two bare `requestFullscreen()` call sites through the guarded pattern that already exists in this file — `src/main.js:7343` and `:7347` (title button) match `:10737`. The settings-checkbox site (`:6272-6275`) is *not* a drop-in: it's a stateful setting with explicit enter/exit, and its state check reads only `document.fullscreenElement`, never `document.webkitFullscreenElement`. It needs its own small fix.
- Then go one step further than guarding: feature-detect `document.fullscreenEnabled` and **hide** the title button, the speed-dial button and the settings row when it's false. A blinking mobile-only button that does nothing is worse than an absent one.
- Give gyro a failure path. `enableGyro()` returns `false` on denial (`src/camera/ShipCameraSystem.js:1233-1236`) and the caller has no `else` (`src/main.js:15021-15023`). Add a one-line hint. A short liveness timer (no `deviceorientation` event within ~1s → same hint) also covers the Safari site-setting case that permission-granted can't detect.
- Decide what a failed orientation lock means. It's latched to one attempt per page load *before* the try (`src/main.js:14853-14854`), so if it rejects nothing ever retries. Either retry on `orientationchange` or accept portrait as real and handle it in Pass 2.

**Fixes:** three or four visibly-dead controls. **Unblocks:** an accurate speed-dial button count for Pass 2. **Judged by:** Max's phone — a screenshot can't show a TypeError.

### Pass 2 — Make the chrome fit an actual phone screen *(medium; ~1–2 days)*

This is the reachability pass, and the settings button is the reason it's second and not fifth.

- **Re-lay-out the speed dial.** A single 400px vertical stack does not fit a landscape iPhone. Two columns, a grid sheet, or a scrollable tray — anything that keeps all six (or five, post-Pass-1) inside ~300px of vertical room. Removing the fullscreen button alone only buys 48px and leaves settings at 352px, still marginal.
- **Add `viewport-fit=cover`** to `index.html:5` and `env(safe-area-inset-*)` padding to the dock, FAB and dial. The CSS half is inert without the meta half, so both go together.
- **`100vh` → `100dvh`** on `.nav-computer-panel` (`src/style.css:1194`) and `.pretext-lab-panel` (`:1157`), keeping a plain `100vh` first line as the fallback — the exact two-line pattern already at `:15`.
- **Fix the landscape HUD slot.** `src/rendering/RetroRenderer.js:857-868` relocates the minimap in portrait "to avoid mobile menu overlap" and leaves landscape on the desktop rect, 2% up from the bottom, on top of the dock and FAB. Landscape needs the same treatment.
- **Add a landscape touch block to the stylesheet.** There is currently no `orientation: landscape` rule and — worth stating plainly — **no width/height breakpoint anywhere** in 1,223 lines. All five media queries are `pointer: coarse`. Every phone layout claim rides on desktop pixel values happening to fit.
- **Portrait fallback.** Since the orientation lock probably never engages, portrait is real. Not a full portrait layout — a "rotate your phone" prompt gated on `(orientation: portrait) and (pointer: coarse)` is the cheap correct answer, and the existing portrait CSS (`src/style.css:832-851`) stays as the safety net.

**Fixes:** controls that exist but can't be touched. **Unblocks:** any honest usability judgement at all — "reachable in the DOM" is not "reachable on screen." **Judged by:** screenshots at a 844×390 and 390×844 viewport. I can take these myself; they are not a Max task.

### Pass 3 — Controls with no touch equivalent *(medium; ~1–2 days)*

- **Nav computer star map.** Add `touchstart`/`touchmove`/`touchend` for drag-to-pan and a two-finger pinch for zoom, mirroring what `ShipCameraSystem` already does for the main canvas — that file is the working reference. `src/ui/NavComputer.js:292-298` is where the listeners go.
- **Surface the search field.** It already exists, already shows on open, and is the single best thing a phone can do that a desktop can't. It is also the answer to the missing 1–9 direct-jump. It needs (a) to be visible/obvious on a phone, and (b) its result rows re-wired from `mousedown`-only (`:649`) to a touch path, since today they lean on synthesized mouse events.
- **Autonav's silent refusal.** Both inert branches (`src/main.js:14921-14922`, `:15002-15003`) get a visible "refused" pulse instead of a `console.log` a phone player can never read. Deliberately *not* painting the button active is correct and stays.
- **Add the HUD master toggle to the dial** if there's a free slot after Pass 2 — it's one boolean with an existing apply function (`src/main.js:13613-13618`), and it's the one non-dev keyboard-only control that reads as player-facing.
- **Minimap drag-to-rotate:** log it, don't build it. It's a nice-to-have behind a control that's off by default on mobile.

**Fixes:** the nav computer, which is currently the most broken interactive surface on the phone. **Judged by:** screenshot for the map panning; Max's hands for whether the search flow feels right.

### Pass 4 — Hit targets and gesture feel *(small; ~half a day)*

- `#mode-swap-btn` to 44pt minimum and give it a `touchend` alongside its `click` (`src/main.js:13378`, `src/style.css:775-781`). It's the only exit from mobile-HELM; it should not be the one button relying on synthesized events at ~31px tall.
- Speed-dial buttons 40 → 44px (`src/style.css:129-131`) to match the dock's 44 (`:58-60`).
- Widen the orbit-line tap radius from 6px (`src/main.js:14141`) on coarse pointers, or show a brief highlight on `touchstart` so the band is visible before you commit.
- Stop the outside-tap dial-dismiss from also selecting through to the canvas. The lever is `stopPropagation` on the canvas side or a suppression flag — **not** `preventDefault` on the document listener (`:14875`), which wouldn't cancel other listeners and would likely be ignored on a passive document handler anyway.
- Decide on the 350ms single-tap latency (`src/main.js:14846-14852`). It buys the double-tap warp. Whether it's worth it is a feel judgement.
- Surface the gyro↔drag conflict (`src/camera/ShipCameraSystem.js:1575`) — turning gyro on silently kills one-finger look. At minimum, say so on the button.

**Judged by:** Max's hands, entirely. Nothing here shows up in a screenshot.

### Pass 5 — Survive the phone *(medium; ~1 day)*

- **`webglcontextlost` / `webglcontextrestored` handlers.** `preventDefault()` on loss is required before the browser will even attempt restoration. At absolute minimum, a "tap to reload" overlay instead of a silent black screen. This is the highest-severity item in the whole audit because when it fires, every control in the ledger stops at once.
- **Skip `cockpitTarget` on mobile** (`src/rendering/RetroRenderer.js:843-847`) — a full-resolution RGBA+depth allocation, every resize, for a camera mode mobile can never enter.
- **Then measure before optimising anything else.** `logarithmicDepthBuffer` and the `backdrop-filter: blur()` on every dock and dial button (`src/style.css:69-70, 101-102, 139-140`) are both plausible mobile costs and both currently unmeasured. Don't touch either without a frame time.
- Boot weight (~2.3MB gzipped) is a cellular problem, not a boot blocker — and deferring the catalogs is *not* the small change it looks like: `src/main.js:306-324` wires the loaded catalogs into the starfield generator, `KnownSystems.associate()`, the debug panel and every nav computer instance, and they're consumed on the boot warp seconds later. Park it.

**Judged by:** Max's phone for the context-loss behaviour (app-switch, lock, come back); a trace for the rest.

---

## ✅ CLOSED BY MAX ON HIS iPHONE — 2026-08-28

> **"I checked and the game works between app switches"** — Max, 2026-08-28

That closes the pass's **highest-severity** item ([NEEDS-MAX] #10 below): before the
`webglcontextlost`/`webglcontextrestored` work (`eac337d`, live on master), backgrounding the tab and
returning could leave a permanently black canvas with every control dead at once.

⚠ **AND HERE IS THE HONEST LIMIT OF WHAT THAT SENTENCE PROVES.** "It works" is consistent with TWO
different worlds and does not distinguish them:
  (a) iOS dropped the GL context and the new handler recovered it — the fix firing, as designed; or
  (b) iOS retained the context on his device and hardware, so the handler never ran at all.
The symptom the item existed to remove is gone either way, which is what Max actually needed. But this
is **not** evidence that the recovery path executes on iOS, and it must not be cited as such later.
The synthetic half IS proven — a forced `WEBGL_lose_context` cycle in a real browser against the live
production bundle showed the overlay appear, the context restore, the loop resume and the scene draw
again — so the mechanism works; what is unconfirmed is only whether iOS ever invokes it on his phone.
⛔ Do not "close" (b) by asking Max to read a console — he does not use it (`feedback_max-does-not-run-console-commands`).
The distinguishing observation is visible without one: if the overlay flashes up and vanishes on return,
the handler fired.

Also closed the same day: **[NEEDS-MAX] #1**, the speed-dial count. Max reported "6 total including the
gear", which located his viewport ceiling between 352 and 400 CSS px and identified SETTINGS as the
clipped button — see the reorder in `f1ac868` and the derivation in
`tests/mobile-speed-dial-reachability.test.js`.

---

## 4. [NEEDS-MAX] — things only his actual phone can settle

Each of these is a look, not a test. Open the game on the iPhone and:

1. **Tap the gear, then count the buttons.** How many of the six appear? Can you see and tap SETTINGS (the ☰ at the top of the stack)? *This is the single most valuable one — a whole pass depends on the answer.*
2. **On the title screen, tap the blinking FULLSCREEN button.** Does anything happen at all, or is it a dead tap?
3. **Once in the game, tap the gear then the ⛶ fullscreen icon** (if it's on screen). Same question — anything, or nothing?
4. **Tap the ⭕ gyro icon.** Does iOS show a "allow motion access?" prompt? If you allow it, does tilting the phone actually move the view?
5. **Hold the phone in portrait for a few seconds.** Does the game force itself back to landscape, or does it just stay in portrait? (If it stays, the whole layout is running in an orientation nobody designed for.)
6. **Look at the bottom row of buttons.** Do they sit under the home-indicator bar? Does swiping to hit the bottom one ever trigger the iOS home gesture instead?
7. **Tap ✦ to open the nav computer, then try to drag the star map.** Does it move? Then try the search box at the top-left — does the keyboard come up, and does tapping a result actually go there?
8. **In ORRERY, tap the ▶ play button in the bottom dock.** Does anything visible happen? (Expected: nothing at all — that's the bug.)
9. **Pick HELM at the start screen, then find the green ORRERY/HELM button in the top-right and tap it.** Does it get you out? Is it big enough to hit first time?
10. **Play for a minute, switch to another app, come back.** Is the game still drawing, or is the screen black?
11. **Tap a planet's orbit line** (the thin ring, not the planet). Does it select? How many tries?
12. **Open the gear → settings panel** (if you can reach it) and try scrolling it. Does it scroll to the bottom?

Optional, only if he has an iPad with a keyboard or trackpad attached: **does the bottom button row appear at all?** There's a code path where the iPad hides the phone controls but still refuses keyboard flight, leaving neither.

---

## 5. What this plan deliberately does not do

- **It does not build touch flying.** No virtual joystick, no throttle slider, no roll control. Mobile HELM is a hands-off tour by an explicit prior decision recorded in the code (`src/main.js:13307-13314`, `:13842`, and the TOY_BOX hard-lock at `src/camera/ShipCameraSystem.js:446`). Roughly eight ledger rows are "unreachable" solely because of that one decision. Reversing it is a feature, not a mobile pass — and it should be scoped on its own if Max wants it.
- **It does not add touch triggers for the developer tools** — object gallery, sound test, Pretext Lab, debug HUD, scene inspector, the `Shift+` lab shortcuts, F9. They're listed in the ledger for completeness and then dropped.
- **It does not add a touch trigger for the keybinds overlay.** Its content is 24 rows of desktop vocabulary. If phone players need help, that's different copy, not a new button.
- **It does not revive the BURN button.** `burnButtonRegimeVisible` is constant-false in both regimes on every platform (`src/flight/flightModes.js:496-502`) — retired functionality, not a mobile gap. (The *Space→burn action* is still live on desktop HELM, which is a real gap with no touch path; it's in the ledger and it's not being fixed here.)
- **It does not unify the three-going-on-four mobile detections.** They agree on a plain iPhone, which is the brief. It gets a note and a backlog row, not a pass.
- **It does not build a full portrait layout.** Portrait gets a rotate prompt and the existing safety-net CSS. If Max wants portrait as a first-class orientation, that's a separate scope.
- **It does not target iPad.** iPadOS Safari behaves differently on at least Fullscreen and pointer type. Out of scope unless he asks.
- **It does not optimise performance on speculation.** Pass 5 fixes the two things that are defects on their face (no context-loss recovery, a wasted full-res target) and explicitly defers everything else until there's a measured frame time.

---

## Note on the four surveys behind this

The refuters were right far more often than the surveyors, and I re-verified the disputed load-bearing facts myself rather than taking either at their word. Two corrections worth carrying forward:

- **The biggest single error in the surveys** was the claim that touch drag-orbit and pinch-zoom don't exist. They do, in `src/camera/ShipCameraSystem.js:1554-1606`, on the same canvas — the surveyor grepped only `src/main.js` and reported the result as repo-wide. That false absence was ranked as the surface's largest gap and generated an open question asking Max to confirm the design intent of a feature that already ships. Treat any absence claim resting on an unshown grep as unverified.

- **One refuter manufactured its own version of the same error.** The iOS refuter asserted that "BOTH canvas touch handlers are registered `{ passive: true }` (`src/main.js:14786` … and `:14818`), so neither can call `preventDefault()`." That is wrong: the canvas carries **five** touch listeners, and the three in `ShipCameraSystem` (`:1554`, `:1573`, `:1601`) are all `{ passive: false }` and all call `e.preventDefault()`. So the app *does* suppress synthesized mouse events from canvas taps — which is fine, because main.js handles canvas taps directly. The refuter made exactly the scoped-grep mistake it correctly caught elsewhere, while writing the sentence accusing someone else of a platform-claim-in-code-clothing.
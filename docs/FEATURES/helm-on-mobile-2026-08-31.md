# Does HELM make sense on a phone? — every control it needs, and what touch can carry

**2026-08-31.** Max: *"Helm seems not to make sense on mobile because it's not easy to freelook.
Think through all needed controls on helm."*

---

## 1. First, a correction to the premise — and it makes the case stronger, not weaker

**Free-look is not a capability you need in order to fly. It is the hands-OFF state.**
`src/main.js`, the `KeyF` handler: `const handsOn = _scManual && !freeLook.latched;` — F toggles the
latch, and *latched ON* means the autopilot may fly while you look around. Latched OFF means you have
the stick. They are two ends of one switch, and the ship's own comment calls E "the REGIME-entry + drive
axis" with F "the orthogonal free-look axis".

So "free-look is hard on touch" is not the thing standing between a phone and a helm. Touch already has
two look mechanisms and both work: one-finger drag (`src/camera/ShipCameraSystem.js:1554-1606`) and the
gyro toggle. **The real blocker is one line and it is absolute.**

## 2. The real blocker

```
setCameraMode(mode) {
  // Mobile is hard-locked to Toy Box
  if (this.isMobile) mode = CameraMode.TOY_BOX;
```
`src/camera/ShipCameraSystem.js:446` — and the doc comment four lines above says it outright:
*"Mobile is the only absolute constraint (mobile can never be Flight)."* `_loadPersistedMode()` refuses
to restore FLIGHT on mobile too (`:512`).

**A phone has no cockpit.** TOY_BOX is an exterior orbit camera looking AT the ship. So even with a
perfect virtual stick, mobile HELM would be flying a model you are watching from outside — not
piloting from inside it. The thing HELM is *for* is the thing a phone cannot render.

## 3. What mobile HELM therefore is today

Not a helm. It is a **guided fly-along**: pick HELM at the chooser and `_armHelmBootTour` starts a
hands-off autopilot tour, exterior camera, with prev/next to step legs and a button to stop it. Every
manual-flight key returns early on mobile (`if (_isMobile) return` on the F, R and drive handlers).

⭐ **That is a perfectly good thing to have on a phone.** The problem is the label: the chooser promises
"take the ship — pilot & free-look", and then the phone hands you a tour. Max's instinct that it "doesn't
make sense" is a response to a promise the mode cannot keep.

## 4. Every control HELM needs, and what touch could carry

| # | control | desktop | what it is for | touch mapping | verdict |
|---|---|---|---|---|---|
| 1 | **Pitch / yaw** | mouse position as a virtual joystick (`main.js`, gated on hands-on) | steering, continuously, while looking where you go | left-thumb virtual stick | **feasible**, standard |
| 2 | **Throttle** | W / S held | speed, continuously | right-side vertical slider, or up/down on a second stick | **feasible** |
| 3 | **Roll** | Q / E held (`main.js:12678` → `scModel.turnInput.roll`) | orienting the ship about its nose | ⚠ needs a THIRD simultaneous axis — two-finger twist, tilt, or a pair of buttons | **awkward**; the first real cost |
| 4 | **Drive engage / dropout** | E (tap) | enter/leave supercruise | button | feasible |
| 5 | **Hands-on ↔ hands-off** | F | give the ship back to the autopilot and look around | button (it is a latch, not an axis) | feasible |
| 6 | **Autopilot tour** | Z | the system flies you a route | button — **already exists** on the dock in HELM | done |
| 7 | **Commit burn to selection** | Space | the actual "go there" | button | feasible |
| 8 | **Target selection** | Tab, 1–9 | choose what to burn to | ◀ ▶ — **already exists** | done |
| 9 | **Look around** | mouse while hands-off; middle-mouse peek | see where you are | drag + gyro — **already exist and work** | done |
| 10 | **Back to ORRERY** | M | leave | the swap button — **already exists** | done |

**Score: four of ten already work on touch. Three more are ordinary buttons. Two are real axis work
(stick, throttle). One — roll — has no comfortable touch home.**

⛔ **And the table is misleading on its own, because it costs nothing to fix rows 1–5 and still leaves
you outside the ship.** Every row above is reachable; none of them addresses §2. Building the whole
table gets you a stick that flies an exterior camera.

## 5. Three options

### (a) Drop HELM on phones — ORRERY only
Hide the HELM chooser button under `pointer: coarse`. **Cost:** loses the fly-along, which is genuinely
nice. **Gain:** removes the one-way mode trap entirely, and removes a promise the platform cannot keep.
**Size: XS.**

### (b) ⭐ Rename it to what it is, and finish it as that — RECOMMENDED
Call it a tour / fly-along on touch, not a helm. Keep exactly the controls it has (start/stop, leg
stepping, drag + gyro look), fix the chooser copy so it promises watching rather than piloting, and put
the two controls a spectator actually wants — look and time — under the thumb.
**Cost:** labels, copy, maybe one control. **Gain:** the mode stops disappointing, because it stops
claiming. **Size: S.** ⚠ This is the option that treats Max's reaction as information about the LABEL
rather than about the feature.

### (c) Build real touch flight
Rows 1–5 above **plus** lifting the TOY_BOX lock so there is a cockpit to fly from. The lock is
described in its own source as the only absolute constraint, so lifting it is an investigation before it
is a build — every mobile assumption downstream of "mobile is never FLIGHT" would need auditing.
**Size: L at least, and the roll axis has no good answer.** Not recommended now; recorded so the option
is costed rather than vaguely dismissed.

## 6. What only Max can decide

**Is mobile HELM meant to be piloting, or watching?** Everything above follows from that one answer, and
it is a question about what the game IS on a phone, not about what is technically reachable.
- "Watching" → (b), and it is cheap.
- "Piloting" → (c), and the cockpit lock is the first thing to investigate, not the stick.

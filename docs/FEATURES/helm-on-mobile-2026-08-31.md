# HELM on a phone — the cockpit is already there, and you cannot look around it

**2026-08-31.** Max: *"Helm seems not to make sense on mobile because it's not easy to freelook"* and
then, sharpening it: *"the fine navigation will be entirely autopilot and the player is there to look
around the cockpit and choose which planet/moon or system to go to next at most."*

⛔⛔ **THIS FILE REPLACES ITS OWN FIRST VERSION, WHICH WAS WRONG ON ITS CENTRAL CLAIM.** That draft said
"a phone has no cockpit" and built a whole three-option recommendation on it. It was written from a code
comment — *"Mobile is the only absolute constraint (mobile can never be Flight)"*
(`src/camera/ShipCameraSystem.js:446`) — and from an audit line repeating it. **Neither was checked
against a running game.** Driving the live site emulated as a landscape iPhone shows a full cockpit:
canopy frame, a nav screen and a body-info panel down the left, speed (`8.20 Mm/s`) and a target panel
down the right, `SAFE TO DROP`, the body named on the glass, and the green HELM badge. The screenshot is
the record. **A comment about a camera mode is not a statement about what renders.**

---

## 1. What is actually true

**`_cockpitShouldRender()` has no mobile check at all** — `src/main.js`:
```
return _scManual && _cockpitReady && !!_cockpitRig && !_cockpitRig.loadError;
```
The cockpit is gated on being in HELM, not on the camera mode. The TOY_BOX lock governs how the ORBIT
camera is driven; it does not decide whether the cockpit draws. A prior workstream already recorded
driving mobile HELM *"with the cockpit rendering and the camera at the helm"*
(`docs/WORKSTREAMS/cockpit-into-helm-2026-07-30/contract.json`) — the evidence was on disk the whole
time and the first draft did not look for it.

## 2. So Max's description is already ~80% of what ships

He describes: autopilot flies, the player looks around the cockpit and picks the next destination.
Measured against mobile HELM today:

| what he describes | state |
|---|---|
| Autopilot does the flying | ✅ that is exactly what mobile HELM is — a hands-off tour |
| A cockpit to sit in | ✅ renders, with all four glass panels |
| Choose the next planet / moon | ✅ ◀ ▶ on the dock step the selection |
| Choose the next system | ✅ nav computer search arms a warp; ◎ warp commits |
| **Look around the cockpit** | ⛔ **does not work** |

## 3. The one thing missing, measured

Dragging one finger in mobile HELM **does not move the view.** Measured live, twice:

| | before drag | after a ~540 px drag |
|---|---|---|
| `controller.yaw` | 3.401 | **4.373** |
| `controller.smoothedYaw` (the value actually applied) | 3.399 | **3.399** |
| camera quaternion | — | unchanged |
| `controller.bypassed` | `true` | `true` |

The touch handler writes yaw/pitch into the orbit controller, and in HELM that controller is
**bypassed** — the camera is driven by the flight system through `scHead` (`HeadMount`,
`src/flight/HeadMount.js:39`), whose `applyTo(camera, position, orientation)` is the real pose path.
`src/main.js:832` records that on desktop the head is driven "by the canvas mousemove handler while
`_scManual && !scHead.held`". **On mobile nothing drives it.** The drag is recorded and discarded.

⭐ **So Max's original instinct was right and my "correction" of it was wrong.** I replied that free-look
is merely the hands-OFF state and therefore not a blocker. That is true on desktop, where hands-off is
one half of a toggle. On mobile hands-off is *permanent* — so looking around is not half the mode, it is
**the whole interaction**, and it is the one thing that does not work.

## 4. What to build

**Route touch look to the head, not to the bypassed orbit controller.** In HELM, one-finger drag should
write `scHead.yaw/pitch` (clamped as the desktop path clamps them) instead of `cameraController`. The
gyro toggle should feed the same place — ⚠ untested, but it drives the same `ShipCameraSystem` look path
the drag does, so it is likely to be inert for the same reason. **Size: S.** It is one input re-route,
not a new subsystem, and it is the difference between a cockpit you sit in and a cockpit you are
strapped into facing forward.

**Then the rest of his description is already satisfied**, and the honest follow-ups are small:
- the dock is live and tappable over the splash and title screens, where there is nothing to step
  through — it should not be;
- ◀ ▶ step one body at a time, so the seventh body is six taps (the missing 1–9 direct jump);
- nothing announces that the nav computer's search is how you choose a *system*.

## 5. What NOT to build, and why the earlier draft was wrong to cost it

The first draft's option (c) was "build a virtual stick, throttle and roll, and lift the camera lock —
L at least". **Under Max's framing none of that is wanted:** if fine navigation is entirely autopilot,
the stick, the throttle and the roll axis all drop out — including roll, which was the one control with
no comfortable touch home. The hard part of that estimate was work nobody asked for.

⛔ And do NOT lift the TOY_BOX lock as part of this. Nothing in §4 needs it: the cockpit already renders
and `scHead` already drives the camera in HELM. Touching "the only absolute constraint" to fix a look
input would be changing a load-bearing invariant to solve a problem it is not causing.

## 6. Method note, kept because it cost a wrong answer

The first draft reasoned from two comments that agreed with each other and never opened the game. Both
described a camera-mode constraint; neither said anything about what renders, and I read one as the
other. ⭐ **One emulated-phone screenshot refuted a document.** For anything about what a player SEES,
the screenshot comes before the analysis, not after it.

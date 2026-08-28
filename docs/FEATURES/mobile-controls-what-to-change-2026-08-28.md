# What the mobile buttons should be — the actions vs. the eleven slots

**2026-08-28.** Max: *"look at the major actions available to players and the virtual buttons on the
mobile app and see what we should change."*

The earlier audit (`mobile-pass-plan-2026-08-28.md`, on the lane branch) asked **what is broken**. This
asks a different question: **is the game spending its eleven touch slots on the eleven things a player
actually does?** Everything below is read off the tree, with file:line.

---

## 1. What a player can actually do

| action | how it happens | on a phone |
|---|---|---|
| Look around | orbit / pinch the camera | ✅ works (`ShipCameraSystem.js:1554-1606`) |
| Select a body | tap it, or ◀ ▶, or the minimap | ✅ works |
| **Jump to a chosen body (1–9)** | number keys | ❌ **no touch path at all** |
| Step to the next/prev body | ◀ ▶ | ✅ works — but N taps to reach body N |
| Go to *some* other system | dock ◎ WARP → `autoSelectWarpTarget()` (`main.js:15069`) | ✅ works — **the game chooses** |
| **Go to a *named* system** | nav computer search → arms a warp straight there (`NavComputer.js:716-745`) | ⚠ works, and **nothing points at it** |
| Take the helm / fly manually | F, R, WASD, Q/E, mouse joystick | ⛔ deliberately off on mobile (`main.js:13790`, `:13842`) |
| Arm / stop the autopilot tour | dock ▶ or dial ▷ | ⚠ HELM only — **inert in ORRERY** |
| Swap ORRERY ↔ HELM | top-right button | ⚠ one-way by design; see §3.6 |
| Orbit lines on/off | dial ◎ | ✅ works |
| Minimap on/off | dial ▣ | ⚠ lands on top of the dock in landscape |
| Gyro look | dial ⭕ | ⚠ silently kills one-finger drag |
| Hide the HUD | H | ❌ no touch path |
| Deselect | Escape | ❌ no touch path — only "tap nothing and hope" |
| Settings | dial ☰ | ✅ (as of `f1ac868`; was off-screen) |
| Fullscreen | dial ⛶ | ⛔ impossible on iPhone; hidden as of `93c442c` |

## 2. What the eleven slots are spent on

**Dock (5, always visible, most reachable):** `prev` · **`autonav-toggle`** · `next` · `warp` · `nav`
**Dial (6, behind the gear):** `settings` · `orbits` · `minimap` · `gyro` · `autonav` · `fullscreen`

---

## 3. The mismatches

### 3.1 ⭐⭐ The best slot on the screen holds a button that does nothing in the default mode — and it is a duplicate

`autonav-toggle` sits at **dock position 2 of 5** (`index.html:295`), *between* ◀ and ▶ — the most
thumb-reachable spot, and it splits the natural pair. In ORRERY its entire branch is one `console.log`
(`main.js:14921-14922`) by Max's own ruling that the modes must not mix. **ORRERY is the phone default.**
So the prime slot is a no-op for the default player, with no visible feedback that the tap registered.

And the same action is in the dial as `autonav` (`index.html:326`) — **the only duplicated action in the
whole control set**, spending 2 of 11 slots on one function that is meaningful in only one mode.

### 3.2 ⭐ The one affordance that makes travel intentional is invisible

The nav computer's search takes a name and **arms a warp straight to that system**
(`NavComputer.js:716-745`). That is the difference between *"take me somewhere"* and *"take me there"* —
and the dock's WARP button is the former: `autoSelectWarpTarget()` picks for you.

The field is never focused when the panel opens — **grep for `focus()` in NavComputer.js returns
nothing**. Nothing on the dock hints it exists. The single most capable mobile control in the game is
one nobody would find.

### 3.3 Two of five dock slots do one-at-a-time stepping

◀ ▶ step the selection. Reaching the seventh body is six taps. Desktop has 1–9 for direct jump; touch
has no equivalent, and search does **not** cover this — it indexes **stars**, not bodies within a
system (`_selectSearchResult` builds a star and commits a warp). ⚠ Do not let §3.2 be read as closing
this gap; they are different problems.

### 3.4 A dial slot is now empty

`fullscreen` can never work on iPhone and now hides itself (`93c442c`), so on a phone the dial has five
buttons and a hole in the top (clipped) slot.

### 3.5 There is no deselect

Desktop Escape clears the selection. Touch clears it only as the accidental outcome of tapping and
hitting nothing.

### 3.6 The control that can strand you is the smallest and the least robust

`#mode-swap-btn` is the **only** way out of mobile HELM (`main.js:13311-13314`). It is ~31 px tall —
below the 44 pt floor every dock button meets — and it is the **only** mobile-reachable button in
`main.js` wired to `click` alone rather than `touchend` (`:13378`).

---

## 4. What to change, in order

### ⭐ A. Drop the duplicate autonav from the dock, and make the freed slot mode-aware
Put ◀ ▶ next to each other where they belong. Then let the freed centre slot carry **what the current
mode actually uses**: `orbits` in ORRERY (promoted out of the dial — it is the main ORRERY view
control), `autonav` in HELM (where it is the main HELM control). One slot, always useful, never a no-op.
This is the structural fix: *the dock should carry what this mode does*, not a fixed row with a dead
button in it. **Size: S.** Judgeable from a screenshot per mode.

### ⭐ B. Focus the search field when the nav computer opens
One line. It turns the dock's existing ✦ NAV button into "go where you want" instead of "open a map",
and it costs no slot. Pair it with a placeholder that says so. **Size: XS.** ⚠ Check it does not summon
the iOS keyboard over the map every time the panel opens — if it does, focus on first tap instead.

### C. Give the freed dial slot to the HUD toggle
`H` is player-facing (a clean view for looking at a planet), is one boolean with an existing apply
function (`main.js:13613-13618`), and has no touch path. **Size: XS.**

### D. Make the swap button a real control
44 pt minimum and add a `touchend` beside its `click`. It is the one button whose failure strands the
player. **Size: XS.**

### E. Add a deselect
Cheapest honest form: a long-press on empty space, or fold it into the HUD toggle's slot as a
tap-to-clear when nothing is selected. **Size: S.** ⚠ Needs a decision, not just code — see §5.

### F. Direct body selection (the 1–9 gap)
The real fix is a body list in the nav computer, which does not exist. **Size: M**, and it is the only
item here that is a build rather than a rearrangement. Logged, not recommended for this pass.

---

## 5. For Max — the two that are taste, not engineering

1. **Should the dock change between ORRERY and HELM?** (§4A) It removes the dead button, and it means
   the row is not the same row in both modes. That is a design call about whether the controls should
   feel *stable* or *relevant*; both are defensible and it is his game.
2. **How should deselect work on touch?** (§4E) Long-press, a dedicated button, or leave it as
   tap-empty-space. No evidence favours one; it is a feel question.

## What this deliberately does not propose

- **Touch flying.** Manual HELM is off on mobile by an explicit prior decision; reversing it is a
  feature, not a controls pass.
- **Re-laying out the dial geometry.** It fits five and the ordering is already fixed (`f1ac868`).
- **Anything about the minimap-over-dock overlap in landscape** — that is a layout bug already logged
  in the pass plan, not a question about which buttons exist.

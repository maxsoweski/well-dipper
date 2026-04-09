# Phase 2: Session Restore — SCOPE / ARCHITECT

**Status:** SCOPE draft, awaiting Max's review.
**Author:** Claude (overnight, 2026-04-09 — drafted while Max slept).
**Why this exists:** Max said Phase 2 was "still on deck" at the end of the
2026-04-08 session. Per CLAUDE.md, multi-system features need a SCOPE doc
before architecture and code. This is that doc — review it first, push back
on the parts that don't match what you actually want, then we implement.

---

## 1. The desire (what done feels like)

You reload the page after closing the tab, and you're back in the system you
were in, looking at the body you were focused on, in the camera mode you were
using. No splash. No title. No autopilot tour starting from scratch. The game
remembers where you left off.

This matters because the screensaver loop is designed to run forever, but
you also use the game for actual exploration. When you've found something
interesting and you want to come back to it tomorrow, the game should
respect that.

---

## 2. Acceptance criteria (proposed — confirm or edit)

A reload restores you to a saved scene if **all** of these are true:

- [ ] A save exists in `localStorage` from this browser
- [ ] The save is less than `MAX_AGE_DAYS` old (proposed: **7 days** — strikes a balance between "I'll come back tomorrow" and "stale saves from a forgotten session")
- [ ] The save schema version matches the current code version (mismatch → ignore the save, do a fresh boot)
- [ ] The saved system kind is one of `procedural`, `known`, or `navigable-deepsky` — non-restorable scenes (title backdrop, external galaxy easter egg) skip restoration

When restoration happens:

- [ ] **Splash screen is skipped** (no click-to-dismiss needed)
- [ ] **Title screen is skipped** (no music intro, no auto-warp)
- [ ] System spawns immediately at the saved galactic position
- [ ] Camera lands focused on the saved body (planet/moon/star or system overview)
- [ ] Camera mode (Toy Box / Flight) matches the saved value (already persisted separately by `ShipCameraSystem` — we just need not to clobber it)
- [ ] Autopilot is OFF on restore (the player chose to reload — they want manual control, not a tour)
- [ ] HUD shows the correct body info, nav computer knows the current system

When restoration is skipped or fails, boot proceeds normally (splash → title → first warp). Failure must never block the normal boot path.

---

## 3. What gets persisted

Saved as a JSON blob in `localStorage` under key `wellDipper.session.v1`.

```jsonc
{
  "version": 1,
  "savedAt": 1712534400000,        // ms epoch — used for staleness check
  "system": {
    "kind": "procedural" | "known" | "navigable-deepsky",
    "galacticPos": { "x": 8.34, "y": 0.02, "z": 0.0 },  // kpc

    // For "known" systems (e.g. Sol):
    "knownName": "Sol",

    // For "procedural" / "navigable-deepsky" systems:
    "systemData": { /* full StarSystemGenerator output, plain JSON */ },
    "seedCounter": 47               // so subsequent procedural systems don't collide with this one
  },
  "focus": {
    "kind": "overview" | "star" | "planet" | "moon",
    "starIndex": 0,                 // when kind === "star"
    "planetIndex": 2,                // when kind === "planet" or "moon"
    "moonIndex": 1                   // when kind === "moon"
  }
}
```

**Why save full `systemData` for procedural systems** (instead of regenerating
from a seed): the current `StarSystemGenerator` keys off `seedCounter`, not off
the hash grid star, so two different visits to the same hash grid star produce
different systems. Until that's fixed (separate cleanup item — see
`well-dipper-pending-items.md`), the only way to reproduce a specific procedural
system across sessions is to save the full data.

Storage cost: a typical star system is ~5–20 KB JSON. Well under any localStorage
quota.

**What is NOT persisted (and why):**

| State | Why not |
|---|---|
| Camera mode (Toy Box/Flight) | Already persisted by `ShipCameraSystem` |
| Settings (volume, etc.) | Already persisted by `Settings.js` |
| Camera yaw/pitch/distance offsets | Recreated on focus; subjective polish, can add later |
| Autopilot active state | Forced off on restore — player intent on reload is manual |
| Warp / nav-computer drill-down state | Transient — never restore mid-warp |
| Title screen, splash, intro music | Skipped entirely on successful restore |
| Screensaver tour history | Tour is fundamentally fresh; no value in resuming mid-tour |

---

## 4. Save triggers (when does the blob get written?)

Save on **stable scene transitions**, not every frame:

1. **After `spawnSystem()` completes successfully** (either via warp or known-system entry). This is the canonical "you're now in a new place" moment.
2. **After any `focusPlanet/Star/Moon` call** (and the `-1` overview case). This captures focus changes mid-system.
3. **On `visibilitychange === 'hidden'`** (tab backgrounded or page unloading). Last-chance save.

Do NOT save during:
- Warp turn / fold / tunnel / unfold (transient)
- Active autopilot tour (transient — but the next focus event will save anyway)
- Title screen / splash
- Deep sky non-navigable scenes (nothing to focus on)

---

## 5. Restore flow (boot path)

In `main.js`, very early (before splash setup):

```
1. SessionState.tryLoad()
   - Read localStorage, parse, version-check, age-check.
   - Returns null on any failure → proceed with normal boot.
2. If load returned a state:
     a. Set playerGalacticPos = state.system.galacticPos
     b. Push that into skyRenderer / glow layer / debug panel
     c. Initialize currentGalaxyStar from the saved system
     d. seedCounter = max(seedCounter, state.system.seedCounter || 0)
     e. spawnSystem({ systemData: state.system.systemData })
     f. After spawn: applyFocus(state.focus)  — instant snap, no flythrough
     g. Hide splash and title screens
     h. Mark `_restoredSession = true` so the title-music intro never starts
3. Else: proceed with normal splash → title → autoWarp.
```

The `applyFocus()` helper is new — it sets `focusIndex / focusMoonIndex /
focusStarIndex`, calls `cameraController.viewSystem()` or the equivalent
camera positioning call **without invoking `flythrough.beginTravelFrom`**.
Restore should be instant; the cinematic burn animation is only for in-game
selection.

---

## 6. New module shape

**`src/auto/SessionState.js`** — single small module, ~150 lines.

Exports:
```js
const STORAGE_KEY = 'wellDipper.session.v1';
const SCHEMA_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const SessionState = {
  save(snapshot),         // serialize + write to localStorage
  tryLoad(),              // returns null on any failure
  clear(),                // wipe — used by debug command + reset
  isStale(savedAt),
  validate(parsed),
};
```

`main.js` calls:
- `SessionState.save({ system, focus })` after `spawnSystem` and after each
  focus change.
- `SessionState.tryLoad()` once at boot.
- `SessionState.clear()` from a `Shift+R` debug binding (so we can test
  without DevTools).

Total touch surface in `main.js`: ~30 lines added in `spawnSystem`,
focus functions, and the boot section.

---

## 7. Edge cases I'm worried about

| Case | Plan |
|---|---|
| Save exists but `systemData` is corrupted | `tryLoad()` returns null, normal boot |
| Save schema version is older than current | Ignore the save, normal boot. Don't try to migrate — keep it simple. Bump `SCHEMA_VERSION` whenever the save shape changes |
| Mobile device with restored Flight mode | `ShipCameraSystem` already forces Toy Box on mobile, so that's already handled — restore just sets the system + focus |
| Restored body no longer exists in regenerated system | Should not happen since we save full `systemData`, but defensive: fall back to `focusPlanet(-1)` overview |
| Player was in a navigable nebula (deep sky stars) | Same plan as procedural — save full `systemData`, restore via `spawnSystem({systemData})`. The deep sky path branches inside `spawnSystem` already |
| Player was in a non-navigable deep sky scene (e.g. a distant galaxy view) | Don't save these — there's no body to focus on, and the next warp regenerates anyway |
| Player was on title screen | Don't save title state — there's nothing to restore |
| Two browser tabs both writing to the same `localStorage` | Last writer wins — acceptable, this is single-player |
| Save was created in a different code version (game updates) | Version check catches this — schema bump on every breaking change |

---

## 8. What I'm NOT doing in Phase 2 (deferred)

- **Camera yaw/pitch/distance restore** — restore lands you on the body looking at it from a default angle. If you want to return to your *exact* viewing angle, that's Phase 2.5.
- **Autopilot tour resumption** — restoring mid-tour is more complex than it's worth. Reload kills the tour; you can re-engage autopilot manually.
- **Warp-in-progress restore** — never. Warps are transient.
- **Multi-slot saves** — single save slot only. Manual save/load slots are a future feature, not screensaver-loop concern.
- **Cloud sync** — local only. Cross-device sync is a different project.

---

## 9. Open questions for Max

These are the decision points where I want your input before I write code:

1. **`MAX_AGE_DAYS` = 7?** Or shorter (1 day) if you want stale saves to feel "fresh" only? Or longer (30 days)?
2. **Schema migration on version mismatch — silent ignore or surface a message?** Proposed: silent ignore (log to console, normal boot). A "your save was reset because the game updated" toast might be nicer UX but adds complexity.
3. **Restore on the very first boot of a fresh install?** With no save, the answer is obviously "no, normal boot." But if a save exists from a previous install of the same domain, do we restore? Proposed: yes — same browser = same player.
4. **Autopilot off on restore — confirmed?** Or should autopilot resume if it was active? Proposed: off, because reload feels like an act of intentional control.
5. **Title music on restore — totally skipped, or play once and then stop?** Proposed: skipped entirely. You're already where you want to be, the title music would feel like it's trying to drag you out.
6. **Debug shortcuts** — propose `Shift+R` to clear the saved session and reload to a fresh boot. OK?
7. **Persistence of camera offsets (yaw/pitch/distance)** — leaving this for Phase 2.5. OK to defer, or do you want it bundled with Phase 2?

---

## 10. Implementation order (once approved)

If you greenlight this scope, here's the build order:

1. **`SessionState.js`** — module skeleton with `save`, `tryLoad`, `clear`, `validate`. Pure data layer, no game refs. Tested in isolation.
2. **`applyFocus()` helper in main.js** — instant focus path that mirrors `focusPlanet/Star/Moon` but skips `flythrough.beginTravelFrom`. Reused by restore and any future "snap to" needs.
3. **Save hooks** — wire `SessionState.save()` into `spawnSystem` end + each focus function + `visibilitychange` listener.
4. **Restore hook** — `SessionState.tryLoad()` at boot, before splash setup. Branch the splash/title init when a save loads.
5. **Debug clear binding** — `Shift+R` to wipe save and reload.
6. **Manual test plan** — visit a system, focus a moon, reload, verify you're back. Try with Sol, with a procedural system, with a navigable nebula. Try a stale save (manually edit `savedAt`), an invalid save, an empty save.
7. **Update `SYSTEM_CONTRACTS.md`** — new §9 "Session Persistence" describing what gets saved and the restore boot path.

Estimated touch: 1 new file (~150 lines), ~50 lines added across `main.js`, contracts doc update. No system-wide refactor.

---

**End of SCOPE doc. Greenlight, edit, or push back — your call.**

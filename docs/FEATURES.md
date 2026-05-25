# Features — Well Dipper

**Authority:** Max. Working-Claude proposes status updates; Max confirms.
Commit history is supporting evidence only, not authority.

**Cross-cutting status notes** (apply to many rows; not repeated per row):

- **All visual rendering is currently placeholder quality.** Universal
  polish pass needed before F&F MVP ship. Per intake 2026-05-18:
  *"these should be considered placeholders and still are not quite what
  I would want to be there for friends and family testing."*
- **All SFX are placeholders** made from clipping/pitch-shifting the
  title theme (21 files in `public/assets/sfx/`; per `SoundEngine.js`
  header: *"Each sound is an MP3 file extracted from the game's music
  tracks"*).
- **Music tracks: only 3 of 7 wired tracks exist on disk.**
  Present: `title.mp3`, `intro.mp3`, `explore.mp3`. **Wired in
  `MusicManager.js:110` but ABSENT from `public/assets/music/`:**
  `hyperspace.mp3`, `deepsky.mp3`, `warp-charge.mp3`, `arrival.mp3`.
  Christian (Max's brother) tracks status unknown.

**Status schema** (see [`PROTOCOLS/glossary.md`](PROTOCOLS/glossary.md)):
- `shipped-confirmed` — Max UAT pass; in production
- `shipped-code` — code in main; not Max-confirmed (or stale UAT)
- `verified-pending-max` — Tester PASS; awaiting Max UAT
- `in-flight` — active workstream
- `scoped` — PM brief exists, not started
- `proposed` — surfaced, unscoped
- `parked` — explicitly deferred
- `dead` — used to exist, removed

**Tier schema** (see [`PROTOCOLS/glossary.md`](PROTOCOLS/glossary.md)):
- `F&F-MVP` — must ship before Friends & Family release
- `ENRICHED` — Layer 2; ship after F&F MVP
- `GAME` — Layer 3; long-horizon
- `Infrastructure` — process / engineering infra; non-feature-shaped but
  feature-tracking-worthy
- `unsure` — disposition needed

---

## Warp

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Warp (full lifecycle: opening / tunnel / landing-strip / exit / second-half) | F&F-MVP | in-flight (5 broken pieces; landing-strip-multiplies VERIFIED_PENDING_MAX @ `e31ee65`) | — | [FEATURES/warp.md](FEATURES/warp.md) |
| Warp visual polish (CRT/scanline character, color, motion feel, particle quality across opening/tunnel/exit) | F&F-MVP | proposed | Warp full lifecycle | — |
| Warp-as-place (psychedelic encounters, anomalies, late-game warp becomes destination) | GAME | proposed | — | — |

## Autopilot

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Autopilot tour (auto-warp + flythrough camera; 15 sub-workstreams) | F&F-MVP | in-flight (still buggy; phases CRUISE/APPROACH/STATION-A in code) | — | [FEATURES/autopilot.md](FEATURES/autopilot.md) |

## Ship-scale

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Cockpit (visual frame + reactive HUD readouts + status lights pulsing w/ engine state) | F&F-MVP | proposed | — | — |
| Ship Scanner (Alt-toggle, cyan reticles, burn-to-ship 45°, ship-lock orbit) | ENRICHED | shipped-code (30aa1cf) | — | — |
| Ship NPC spawning (NPC ships in systems; stochastic ~0-12 per system) | ENRICHED | shipped-code — **will be disabled for F&F ship; preserve code for ENRICHED reactivation** | — | — |
| Ship-to-ship gameplay (interaction beyond visual presence) | GAME | proposed | Player ship manual flight | — |

## Reticles

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Targeting reticle — in-system bodies (planets, moons; brackets + labels + off-screen arrows) | F&F-MVP | shipped-code (ghosting fix 30aa1cf 2026-05-09; "pretty good" per Max) | — | — |
| Star reticles rework (sky-side selection behavior + info readout: system preview, distance, type) | F&F-MVP | proposed | — | — |
| Ship reticle (cyan brackets for ships) | ENRICHED | shipped-code (effectively dormant in F&F — depends on Ship NPC spawning, which is disabled for F&F) | — | — |

## Planet generation + rendering

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Planet generation pipeline (18 types — all wired end-to-end via BodyRenderer → Planet shader category dispatch; exotic visuals weak) | F&F-MVP | in-flight | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Higher-LOD planet rendering (**broken**: `lodLevel` uniform set but GLSL never reads it; procedural planets get zero LOD2; Moon LOD2 partial — rocky/captured only) | F&F-MVP | in-flight | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Exotic planet rendering (hex/crystal/machine flat-shaded — TODO at `Planet.js:857`; includes: expand thin palettes — hot-jupiter 4→15, exotic types 4→20) | F&F-MVP | in-flight | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Civilized planet rendering (city-lights lacks night-side emissive city glow; ecumenopolis flat grid w/o emissive; machine grid w/o dark-side emissive) | F&F-MVP | in-flight | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Visual polish — all planet types (placeholder → visually striking and interesting) | F&F-MVP | proposed | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Gas giant storms — wire generator `storms.spots` + `polarStorm` to shader (FEATURE_AUDIT §2.1; data on `planetData.storms` never reaches uniforms) | F&F-MVP | proposed | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Surface history → rocky/moon shaders (paired w/ crater density from bombardment; FEATURE_AUDIT §2.2 + §2.3) | F&F-MVP | proposed | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Moon generation + rendering (LOD2 partial — rocky/captured only; ice/volcanic/terrestrial moons get no LOD2) | F&F-MVP | shipped-code | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Rings — multi-band per physics (instantiate existing `RingRenderer` dead code; FEATURE_AUDIT §2.4 confirmed) | F&F-MVP | proposed | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |
| Asteroid belts (multi-zone composition, Kirkwood gaps) | F&F-MVP | shipped-code | — | [FEATURES/planet-rendering.md](FEATURES/planet-rendering.md) |

## Sky / galactic rendering

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Background starfield (procedural; density varies per galactic position) | F&F-MVP | shipped-confirmed ("strongest thing in the app, minus nebulae" — Max) | — | — |
| Galactic rendering polish (combined: glow + GMC angular artifacts; bar artificial; color gradient should warm toward center) | F&F-MVP | in-flight | — | [FEATURES/galactic-rendering.md](FEATURES/galactic-rendering.md) |

## Nebulae

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Nebula rendering (visual quality — messy, repeated shapes; 6 procedural shape modes finite) | F&F-MVP | in-flight | — | [FEATURES/nebulae.md](FEATURES/nebulae.md) |
| Nebula in-game presence (15% ambient tint exists when inside; immersive geometry-wrap unbuilt — `SkyFeatureLayer.js:95` "Future: immersive mode wraps the feature around you") | F&F-MVP | proposed | — | [FEATURES/nebulae.md](FEATURES/nebulae.md) |
| Nebula-as-warp-target (select from starfield → warp outside → dominates view) | F&F-MVP | proposed | Nebula in-game presence | [FEATURES/nebulae.md](FEATURES/nebulae.md) |
| Reflection nebulae (new object class; one `FEATURE_TYPES` dict entry; FEATURE_AUDIT §2.10 + §3.1) | F&F-MVP | proposed | — | [FEATURES/nebulae.md](FEATURES/nebulae.md) |

## Nav computer (5 zoom levels)

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Nav computer — Level 1 GALAXY (full spiral + sector overlay) | F&F-MVP | shipped-confirmed | — | [FEATURES/nav-computer.md](FEATURES/nav-computer.md) |
| Nav computer — Level 2 SECTOR (subdivided into districts) | F&F-MVP | proposed (mid-zoom unsolved design problem — no working multi-resolution model) | — | [FEATURES/nav-computer.md](FEATURES/nav-computer.md) |
| Nav computer — Level 3 REGION (districts → density-adaptive blocks) | F&F-MVP | proposed (mid-zoom — same problem) | — | [FEATURES/nav-computer.md](FEATURES/nav-computer.md) |
| Nav computer — Level 4 PRISM (blocks → density-adaptive neighborhoods; renamed from COLUMN 2026-05-25) | F&F-MVP | in-flight (PRISM view buggy: minimap, lag, transition) | — | [FEATURES/nav-computer.md](FEATURES/nav-computer.md) |
| Nav computer — Level 5 SYSTEM (3D star map; PRISM is the actual default-open level per code) | F&F-MVP | shipped-code | — | [FEATURES/nav-computer.md](FEATURES/nav-computer.md) |

## Deep-sky

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| **Deep-sky cleanup — remove dice-roll arrival path** (kill `main.js:2918-2922` deepSkyChance roll + `DestinationPicker.WEIGHTS` deep-sky entries; preserve title/gallery/Easter-egg uses) | F&F-MVP | proposed (**ASAP**) | — | — |
| Deep-sky rendering — title screen + debug gallery + external-galaxy click | F&F-MVP | shipped-code (after cleanup ships) | Deep-sky cleanup | — |
| Easter egg — "you've gone too far" / turn-back message on external-galaxy arrival (TODO at `main.js:3039`; `_isExternalGalaxy` flag set but never read) | F&F-MVP | proposed | — | — |

## Audio

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Title theme music (first 3-second riff needs rework — grating after a while) | F&F-MVP | in-flight | — | — |
| Music — non-title tracks (`explore.mp3` present; `hyperspace.mp3`, `deepsky.mp3`, `warp-charge.mp3`, `arrival.mp3` wired-but-absent on disk; Christian's tracks status unknown) | F&F-MVP | proposed | Christian delivering tracks | — |
| SFX — all (currently placeholders from title-theme clipping/pitch-shift; 21 files including 5 warp-related: charge/enter/exit/lockOn/target) | F&F-MVP | in-flight | — | — |

## UI / HUD

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Title screen — functional shell (splash → logo cards → title) | F&F-MVP | shipped-code | — | — |
| Title screen visual polish (additional polish beyond functional state) | F&F-MVP | proposed | — | — |
| Opening credits (new feature — ABSENT in code; only `.intro-credit` CSS class for studio attribution exists) | F&F-MVP | proposed | — | — |
| Body info HUD | F&F-MVP | shipped-code | — | — |
| Settings menu | F&F-MVP | shipped-code | — | — |
| Minimap (G key toggle; two files: `GravityWellMap.js` + `SystemMap.js`) | F&F-MVP | shipped-code | — | — |

## F&F additions (mini-versions of GAME mechanics)

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Visited-systems log (save systems visited; warp back to them from log; minimum-viable Discovery Log) | F&F-MVP | proposed | — | — |
| BPM-synced universe (each system has unique BPM; music tempo + planet animations + camera movements + SFX sync; per Bible §2 [BOTH]) | F&F-MVP | proposed | — | — |

## GAME tier (Layer 3 long-horizon)

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Player ship manual flight (all-range + on-rails) | GAME | proposed | — | — |
| Combat (Star Fox / Panzer Dragoon modes, velocity-tied) | GAME | proposed | Player ship manual flight | — |
| Combat Input System — Rule of Three (Ranged/Melee/Defend, hold-and-release, pick-any-two never all three; per Bible §9) | GAME | proposed | Combat | — |
| Newtonian combat physics (equal-and-opposite reaction forces; prevents stun-locking; enables combos through physics) | GAME | proposed | Combat | — |
| Mode transitions tied to velocity (all-range at low speed near POI / on-rails at relativistic transit / on-foot ground mode) | GAME | proposed | Combat | — |
| Scanner as universal interaction verb (4 layers: galactic survey → star-wave → direct → codex; includes scanning→identification→communication flow) | GAME | proposed | — | — |
| Rotor fuel + gravity-well minigame (energy harvest from gravity well; net positive yield per dip; skill-based sweet spot) | GAME | proposed | Player ship manual flight | — |
| Ship Upgrade System (rotor modules / autopilot assist / shields / scanners / weapons / engines / hull / cargo per Bible §9) | GAME | proposed | Rotor fuel | — |
| Propulsion tiers (Stock Fusion 0.3c → Catalyzed Mk I 0.5c → Mk II 0.7c → ...; engine progression w/ velocity caps + time-debt rates; per research/RESEARCH_transit-propulsion.md) | GAME | proposed | Ship Upgrade System | — |
| Relativistic transit / time-debt (ship time diverges from universe time at high-c; reinforces isolation; per Bible §"Time Debt" + memory/well-dipper-relativistic-transit-design.md) | GAME | proposed | Fixed-timestep ✓; Propulsion tiers | — |
| On-foot combat (Doom-style FPS; same Rule-of-Three input system as ship combat) | GAME | proposed | Ship interior walk-around | — |
| Ship interior — walk around as playable space (maintenance, repair, upgrades; per Bible §1) | GAME | proposed | Player ship manual flight | — |
| Space anomaly cataloging (collection/discovery TBD per Bible §15; distinct from full Discovery Log) | GAME | proposed | — | — |
| In-system environmental hazards (radiation, fungal blooms, debris fields, nebula interference; affect rotor minigame + shields) | GAME | proposed | Rotor fuel | — |
| Synesthetic audio system (audio driven by system properties: star type, age, civilization, hostility, hazards; per Bible §2 Future Direction) | GAME | proposed | BPM-synced universe | — |
| Scan data trading economy (stored scan data sold at civilized systems; income source per Bible §9) | GAME | proposed | Scanner | — |
| Discovery log / codex (full version — rich detail, photos, notes; expansion of F&F visited-systems log) | GAME | proposed | Visited-systems log (F&F) | — |
| NPC comms / factions / narrative framework (text-based retro terminal; AI-generated dialect variety; per Bible §9 + §15) | GAME | proposed | NPCs in systems (ENRICHED) | — |

## Infrastructure

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Inspection layer (`__wd.*` debug API; 28 runners exposed) | Infrastructure | shipped-code (Phase A; Phases B-G tracked in JOURNEY structural debt) | — | — |
| Lab mode (`?lab=1` URL flag + Shift+1..7 scenarios; 7 scenarios including warp-from-Sol/far, mid-CRUISE, mid-HYPER, manual-flight, STATION-A hold, reticle/runway repro) | Infrastructure | shipped-code | — | — |
| Motion-test-kit (vendored at `vendor/motion-test-kit/`; predicates, recorders, scene-inventory adapter, fnv1a hash, accumulator) | Infrastructure | shipped-code | — | — |
| World-origin rebasing (float32 precision preservation at ship scale; rebases camera + scene every ~100 scene units / 0.1 AU; crosses procgen → rendering → gameplay pipelines) | Infrastructure | shipped-code | — | — |
| Fixed-timestep simulation (Glenn Fiedler accumulator; foundation for replay determinism AND future relativistic time-debt mechanic) | Infrastructure | shipped-code | — | — |

---

## Per-row notes (substantial detail not fitting the table)

### Warp (full lifecycle)
Five distinct broken pieces from intake 2026-05-18:
1. Opening — FOLD phase (`WarpEffect.js:145-182` + `main.js:5862-5870`)
2. Tunnel-follows-camera — `WarpPortal.js:115-128` group never re-anchored mid-warp
3. Landing-strip-multiplies — `WarpPortal._createLandingStrip` + re-open path at `main.js:1619` w/o teardown of old strip (fix at `e31ee65` pending Max UAT)
4. Exit — EXIT phase `WarpEffect.js:284-323` + `_landingStrip.visible` gated by `OUTSIDE_B` mode
5. Second-half-not-rendering — dual-portal path relies entirely on WarpPortal mesh visibility post-INSIDE crossing

### Nav computer — Levels 2 + 3 (mid-zoom)
Per intake: *"as you zoom closer and closer to the column view, you actually start to resolve more detail of the galaxy. We have not figured out a way to make that work in the nav screen... We don't have a working model for that."* Levels 2-3 currently show zoomed-in versions of the same Level 1 image. Unsolved design problem, not a bug.

### Deep-sky dice-roll mechanic (legacy state vs cleanup)
**Code currently has dice-roll arrival alive at 15% default** (per `main.js:2918-2922` + `DestinationPicker.WEIGHTS`). Intake 2026-05-18 articulated the should-be: kill the dice-roll, keep title/gallery/Easter-egg uses only. **No workstream exists yet** to do this cleanup. Captured as the "Deep-sky cleanup" F&F-MVP row above; ASAP priority.

9 deep-sky usage sites mapped during 2026-05-19 code sweep:
1. `main.js:2871` — external-galaxy click warp (KEEP — Easter egg)
2. `main.js:2904` — `feature:<type>` warp routed to star inside (KEEP for nebula warps)
3. `main.js:2944-2974` — DestinationPicker-rolled Category A/B (REMOVE)
4. `main.js:3036-3040` — DestinationPicker-rolled spiral/elliptical galaxy (REMOVE — explicit TODO already in code: "show 'you've gone too far' message on arrival")
5. `main.js:3404-3415` — title screen procedural background (KEEP)
6. `main.js:2807-2826` — debug gallery GALLERY_TYPES (KEEP)
7. `main.js:4061-4144` `spawnDeepSky()` — common path (audit which callers survive cleanup)
8. `main.js:4156` `spawnNavigableDeepSky()` — navigable variant (audit similarly)
9. `main.js:4943` — gallery internal switch (KEEP)

### Ship NPC spawning — disable for F&F
ShipSpawner currently spawns ships stochastically (~0-12 per system) per intake-correcting code sweep. Scene-level DirectionalLight + AmbientLight provide proper Lambertian shading (shipped 2026-05-10 commit `aa9ad23`; prior emissive-only workaround removed in same commit). Feature is NPC-ships-in-systems = ENRICHED tier. **Action item before F&F ship:** disable spawn (likely gate behind URL param or settings flag, or remove ShipSpawner instantiation from `main.js`); preserve code for ENRICHED reactivation later.

### World-origin rebasing — pipeline crossing
Per intake conversation 2026-05-19: this is suspected to be where gameplay-layer issues will accumulate. It's necessary infrastructure for any ship-scale work that requires float32 precision (which is most of Layer 3). It crosses:
- **Procgen** — positions get rebased when scene-graph updates
- **Rendering** — shader uniforms with world coords need rebase-awareness
- **Gameplay (future)** — any cached position state in Layer-3 ship code needs to subscribe to `onRebase`

Implementation: `src/core/WorldOrigin.js` (180 lines) + `main.js:495-549` cache-shift + `:6343-6396` per-frame rebase + `:7660` interpolation coherence.

Authoritative architecture picture (Max's "procgen > rendering > gameplay" napkin framing) is NOT enshrined in v5 docs; the actual picture will be derived from code in Phase 6 (SYSTEMS.md authoring + `doc-graph.js` regeneration).

### Fixed-timestep simulation — dual purpose
Current use: **replay determinism** for golden-trajectory testing (Dana's research; `src/core/SimClock.js` advances by `simStepMs` per tick regardless of host speed; replaces `performance.now()` for sim-side timestamps). Future use: **foundation for relativistic time-debt mechanic** (separate ship-time vs universe-time clocks; ship clock can diverge during high-c transit). Necessary but not sufficient for time-debt; sufficient for current testing needs.

### Audit items resolved by 2026-05-19 code sweep
- Autopilot deep-sky targeting: **RESOLVED** — autopilot warps are hardcoded `target: 'star'` (`AutopilotNavSequence._initiateWarp:428-453`); never targets non-stellar destinations. No dead-code in autopilot path.
- 18 planet types wiring: **RESOLVED** — all 18 types are wired end-to-end via BodyRenderer → shader category dispatch. Confusion was the JSDoc split (11 "primary" + 7 "exotics"); runtime treats all 18 identically. What's weak is exotic *visual quality*, not wiring.

---

**Source:** Phase 5 of v5 doc-system migration. Authored 2026-05-19 by
working-Claude (initial draft, code sweep, intake reconciliation) +
Max (authoritative per-row status, tier, and feature selection across
~20 area-walk-throughs). Captures the inventory state as of session
end 2026-05-19. Future updates per Rule 3 (Tester PASS-on-Shipped
triggers FEATURES.md update) — see [`PROTOCOLS/doc-updates-on-ship.md`](PROTOCOLS/doc-updates-on-ship.md).

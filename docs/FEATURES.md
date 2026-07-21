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
| Autopilot tour (auto-warp; flies the supercruise model via SupercruisePilot ALIGN/CRUISE/HOLD + ShipControls; legacy FlythroughCamera motion retired 2026-06) | F&F-MVP | in-flight | — | [FEATURES/autopilot.md](FEATURES/autopilot.md) |
| Supercruise flight system (one model, two drivers: manual W/S throttle + mouse virtual-joystick + hold-to-look freelook + screen-space HUD; autopilot flies the same controls; F=ON/OFF toggle, Settings flight-type Manual/Align/Assist; `ShipControls` single-door surface) | F&F-MVP | **shipped to master** @ `09db316` (2026-06-28) — full supercruise/free-look/arrival-modes arc (149 commits) merged & deployed; UAT-passed (Max live ride 2026-06-27). Incl. **sublight propulsion + hard collision barrier + mass-based forced-drop/mass-lock** (Piece B-c). Post-ship UAT fixes @ `f455f39` (pending push): HELM hands-on click now selects the **reticle** body (planets/moons selectable, not just background stars); **direction-aware** forced-drop/mass-lock (engage when pointed away from a star). Legacy AutopilotMotion/NavigationSubsystem/FlythroughCamera motion retired (files kept) | — | [WORKSTREAMS/supercruise-freelook-2026-06-10](WORKSTREAMS/supercruise-freelook-2026-06-10/) |

## Ship-scale

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Cockpit (visual frame + reactive HUD readouts + status lights pulsing w/ engine state) | F&F-MVP | proposed | — | — |
| Ship Scanner (Alt-toggle, cyan reticles, burn-to-ship 45°, ship-lock orbit) | ENRICHED | shipped-code (30aa1cf) — **dormant in F&F** (depends on NPC spawning, disabled 2026-06-26); `NavigationSubsystem`/`FlythroughCamera` retired, files kept | — | — |
| Ship NPC spawning (NPC ships in systems; stochastic ~0-12 per system) | ENRICHED | **DISABLED for F&F** (`SHIPS_ENABLED=false`, `main.js` spawn switch, supercruise-control-harness 2026-06-26) — code KEPT, dormant for ENRICHED reactivation | — | — |
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
| System naming + real-object identity (position-derived injective procgen names; shipped named-systems catalog 12k settled + 36k greek; HYG real names win on every arrival path incl. real spectral type; KnownSystems catalog-derived alias identity + 3 pc belt; Horsehead IC434/M78 dedup fix; Sol restored to catalog) | F&F-MVP | shipped-confirmed @ `a1d2d4c` (Max UAT 2026-07-11, 3 rounds; in master + deployed via lane B's `847ab19` pre-deploy merge 2026-07-11) | — | [WORKSTREAMS/naming-census-uniqueness-2026-07-07](WORKSTREAMS/naming-census-uniqueness-2026-07-07/), [NAMING_AND_REAL_OBJECTS.md](NAMING_AND_REAL_OBJECTS.md) |
| Real-universe overlay (real known systems/stars/planets: names AND contents override procgen — bulk exoplanet-archive ingest 4,457 hosts / 6,030 planets + curated companion table; Sirius = real A1V+DA2 binary @19.8 AU; TRAPPIST-1 = M single w/ 7 known planets b–h; authored Alpha Centauri = G2V+K1V @23.5 AU + Proxima far companion (b, d); snum==1 single-pin; player nav search (N); neighborhood fidelity ±2% vs committed reference; Harris globular radii) | ENRICHED | **UAT-passed on branch** `feature/system-details` (Max AC9 re-run 2026-07-21 on build `6bc5177`; code @ `3e58fac` + successor-workstream fixes) — pending master merge | — | [WORKSTREAMS/real-universe-overlay-2026-07-12](WORKSTREAMS/real-universe-overlay-2026-07-12/) |
| Real-star identity unification (one canonical F1 seed per real star — search ≡ prism-click ≡ teleport arrive at the SAME system; shared arrival-resolution module makes nav preview ≡ arrival; pin-by-default: un-tabled real stars never roll fabricated companions; census companion table 36 Oph/61 Cyg/ζ Ret; N-dot multiplicity glyphs + label declutter) | ENRICHED | **UAT-passed on branch** `feature/system-details` (Max AC11 2026-07-21 on build `6bc5177`; code @ `f6b3eff`) — pending master merge | — | [WORKSTREAMS/real-star-identity-unification-2026-07-15](WORKSTREAMS/real-star-identity-unification-2026-07-15/) |
| System-identity grammar (a multi-star system reads as ONE system: prism multi-dot markers + co-membership tether + "· Alpha Centauri" label suffix; SYSTEM view titled by the system w/ "via <component>" annotation; far-companion edge chips render Proxima + b/d; normative grammar rule = NAMING_AND_REAL_OBJECTS.md §6) | ENRICHED | **UAT-passed on branch** `feature/system-details` (Max AC8 2026-07-21 on build `6bc5177`; code @ `5583651`) — pending master merge | — | [WORKSTREAMS/system-identity-grammar-2026-07-17](WORKSTREAMS/system-identity-grammar-2026-07-17/) |
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
| Nav computer — multi-star component drill-in (far-companion chip click OR the member's own PRISM marker opens a SYSTEM-scale component sub-view — Proxima w/ real generated b+d orbits, breadcrumb "part of Alpha Centauri"; VIEW ONLY — §6 one-destination invariant stands, no warp to components; `componentSystems` data substrate ready for Increment B component travel) | ENRICHED | **UAT-passed on branch** `feature/system-details` @ `6bc5177` (Max AC10, 2026-07-21) — pending master merge; Increment B (component travel) queued for joint lane B+C scoping | — | [WORKSTREAMS/multistar-components-2026-07-19](WORKSTREAMS/multistar-components-2026-07-19/) |

## Deep-sky

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| **Deep-sky cleanup — remove dice-roll arrival path** (killed deepSkyChance roll + `DestinationPicker.WEIGHTS` deep-sky entries + `spawnNavigableDeepSky` + deepsky audio track + autopilot deep-sky tour stops; preserved title/gallery/Easter-egg uses) | F&F-MVP | shipped (`deep-sky-cleanup-2026-05-29`) | — | [WORKSTREAMS/deep-sky-cleanup-2026-05-29.md](WORKSTREAMS/deep-sky-cleanup-2026-05-29.md) |
| Deep-sky rendering — title screen + debug gallery + external-galaxy click | F&F-MVP | shipped-code | — | — |
| Easter egg — "you've gone too far" / turn-back message on external-galaxy arrival (TODO at `main.js:3039`; `_isExternalGalaxy` flag set but never read) | F&F-MVP | proposed | — | — |

## Audio

| Feature | Tier | Status | Blocked by | Deep dive |
|---|---|---|---|---|
| Title theme music (first 3-second riff needs rework — grating after a while) | F&F-MVP | in-flight | — | — |
| Music — non-title tracks (`explore.mp3` present; `hyperspace.mp3`, `deepsky.mp3`, `warp-charge.mp3`, `arrival.mp3` wired-but-absent on disk; Christian's tracks status unknown) | F&F-MVP | proposed | Christian delivering tracks | — |
| SFX — all (currently placeholders from title-theme clipping/pitch-shift; 21 files including 5 warp-related: charge/enter/exit/lockOn/target) | F&F-MVP | in-flight | — | — |
| System music themes — 12 categories: 1 baseline "average/normal" system + 11 variations on it. Define the 12 system categories, then classify a system algorithmically during gameplay and play its matching theme at the right time. **Open:** the 12-category taxonomy is undefined; the in-gameplay classifier is undesigned. Future — not now. | ENRICHED | proposed | 12-category taxonomy undefined | — |
| Nav-menu BGM filter — apply a filter effect (e.g. low-pass / muffle) to whatever BGM is playing while the navigation-system menu is open; restore on close. Future — not now. | ENRICHED | proposed | — | — |

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
Per intake: *"as you zoom closer and closer to the column [PRISM] view, you actually start to resolve more detail of the galaxy. We have not figured out a way to make that work in the nav screen... We don't have a working model for that."* Levels 2-3 currently show zoomed-in versions of the same Level 1 image. Unsolved design problem, not a bug. (Editorial note: Level 4 renamed COLUMN → PRISM on 2026-05-25; the quoted "column" preserves Max's original word.)

### Deep-sky dice-roll mechanic (SHIPPED CLEAN — `deep-sky-cleanup-2026-05-29`)
**The dice-roll arrival is GONE.** Shipped 2026-05-30: removed the `deepSkyChance` roll
+ `DestinationPicker.WEIGHTS` deep-sky entries + the dead Category-A/B + rolled-galaxy
branches + `spawnNavigableDeepSky()` + the `'deepsky'` audio track + autopilot deep-sky
tour stops. `onPrepareSystem` now hard-defaults `destType='star-system'`; deep-sky is
reachable only via the two explicit KEEP gates (external-galaxy click, feature warp).
All 5 ACs verified live (chrome-devtools GPU). Brief +
[WORKSTREAMS/deep-sky-cleanup-2026-05-29.md](WORKSTREAMS/deep-sky-cleanup-2026-05-29.md).

The 3 KEEP paths still render: title-screen procedural background, debug gallery
(`GALLERY_TYPES`, all types), and the deliberate external-galaxy click warp
(`_isExternalGalaxy=true`). `spawnDeepSky()` survives as the external-galaxy spawn target.
The turn-back "you've gone too far" message remains deliberately unbuilt (AC5 / row above).

Follow-up (non-blocking): ~12 dead `system._navigable` reader sites in `main.js` (setter
deleted in this cleanup; harmless reads of `undefined`).

### Ship NPC spawning — disable for F&F
ShipSpawner currently spawns ships stochastically (~0-12 per system) per intake-correcting code sweep. Scene-level DirectionalLight + AmbientLight provide proper Lambertian shading (shipped 2026-05-10 commit `aa9ad23`; prior emissive-only workaround removed in same commit). Feature is NPC-ships-in-systems = ENRICHED tier. **DONE 2026-06-26** (supercruise-control-harness): spawn disabled at the single switch — `const SHIPS_ENABLED = false` gates the `shipSpawner.spawnForSystem(…)` call in `main.js`. With spawn off, `focusShip` / the `_shipScannerMode` hit-test / the `flythrough.active` simStep branch are unreachable by construction (all gated on `shipSpawner.ships`), so `NavigationSubsystem` + `FlythroughCamera` are marked retired (files KEPT, nav wiring intact). ShipSpawner code + NPC ship features preserved for ENRICHED reactivation — flip `SHIPS_ENABLED` to restore. Player-ship sharing (`shipHullToScene('player')`, `ScaleConstants.js`) untouched.

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

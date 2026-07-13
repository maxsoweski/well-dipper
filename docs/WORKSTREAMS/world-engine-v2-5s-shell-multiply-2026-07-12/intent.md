# world-engine-v2-5s-shell-multiply — intent

## Why we care (proposed phrasing — Max confirms/rephrases at greenlight)

> Two icy worlds with the same regime shouldn't just be seed re-rolls of each other. A small
> low-gravity moon and a big high-gravity ice world should *read* different — that's the whole
> condition-first promise applied to the icy family.

V2-5s is the ROADMAP §3.1 row "thread the D-vector into `shellRelief` so low-g vs high-g icy
worlds differ within-regime" — the explicitly-scheduled MULTIPLY pass that closes the
D2-MF5 north-star gap for the icy sibling. It is the fourth instance of the shipped MULTIPLY
template (#2 plates, #4-M magmatism, V2-2b-1 stagnantLid): a pure `shellDriversToTune`
builder + REF constants + dispatch threading + a lab A/B. The writer's `tune` seam already
exists and its `void drivers` comment reserves exactly this increment. Research-gate-free —
the shipped stress mechanism stays frozen; only population/threshold/amplitude knobs move.

**Orientation:** serves the JOURNEY world-engine objective (distinct history-coherent worlds
per minute — within-regime icy variety); PLAYER_EXPERIENCE-wise lab-only per charter
(seeded icy archetype worlds inherit the response for free at V2-10 game-port).

## Success criteria (Max's language, to confirm at greenlight)

- A driver-varied icy world — low-g vs high-g at the same seed — reads as a genuinely
  different icy world, not a re-rolled Titan/Europa. (The one UAT gate; honesty flag below.)
- The three shipped icy worlds (Titan, Europa, Eyeball) don't change at all — byte-provable.
- Dragging the existing gravity/tidal sliders on an icy preset now visibly does something
  (today they're plate-only), and the response goes the physically right direction:
  lower gravity → bolder ridges/relief; more tidal flexing → denser crack networks;
  warmer/wetter → finer convection cells (+ more chaos terrain on Europa-class).
- Everything is provably driver-driven, not archetype-driven — same discipline as every
  MULTIPLY before it.

**Honesty flag (the V2-2b-1 framing, applied to ice):** the shipped presets stay
byte-identical at their own driver values — Max judges that *the response space exists* on
driver-varied worlds, NOT that "Titan changed." Within-WORLD sameness stays out of scope
(routed to V2-7/V2-8/V2-7d by the AC11 UAT record).

## DOES / UNLOCKS (Rule 15 card)

**DOES:** adds `shellDriversToTune(drivers, regime)` + frozen per-regime `SHELL_REFS`
(read-surface-matched to Titan/Europa/Eyeball's live bundles — one shipped preset per regime,
which is what makes per-regime nulling exact); threads it at both dispatch call sites
(derived + bridge) with `shellDiag.appliedTune`; response axes: gravity → `RIDGE_AMP`/
`CHAOS_AMP`/`CHAOS_BASE` via the house `(g/g_REF)^-0.5`, log-ratio tidal → `CREST_THRESH`/
`TENSILE_THRESH`, thermal vigor (T_eq + volatiles) → `CELL_MIN`, warm-shell chaos →
`CHAOS_THRESH` (A4 — Max may strike); lab `fShellDrivers` folder + `shellProbe().appliedTune`
+ the existing gravity/tidal sliders going live on icy presets (stale `:2682` comment updated).

**UNLOCKS:** within-regime icy variety per seed-free driver differences (the free lever for
seeded icy archetype worlds at V2-10); closes the last *scheduled* MULTIPLY gap besides
bombardment's (V2-5); the shell response vocabulary V2-8 sculpting will key on.

## Deliberate non-goals (fences)

- NO stress-mechanism changes — `DESPIN_REF`/`DIUR_REF`/`DIUR_PEAK`, `SHOULDER_HT`/
  `TROUGH_DEPTH`, `REGIME_WEIGHTS`, `SHELL_BASE`/`RELAX_PASSES` never returned by the tune
  (key-set asserted). Between-regime character stays owned by `REGIME_WEIGHTS`.
- NO age axis — honors Max's 2026-06-28 plates descope call ("age IS history — epoch model").
- shellThickness axis DEFERRED behind `K_SHELL = 0` (the V2-2b-1 `K_G` precedent) — the
  physically purest signal but its Eyeball REF slot is an ugly derived literal; opt-in later.
- NO touching V2-7d's new module or its files (verified zero overlap; if lidDisruption ever
  absorbs shellRelief STEP-2 post-V2-7, the `CELL_MIN` tune key migrates with it — forward
  note, not scope).
- The builder NEVER reads `condition.radiusEarth` (drawn radius — seed-varying; the new
  shell-specific seed-stability rule, grep-enforced in AC-0).

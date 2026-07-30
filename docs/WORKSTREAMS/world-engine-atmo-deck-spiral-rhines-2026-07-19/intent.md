# world-engine-atmo-deck-spiral-rhines-2026-07-19 — intent

## Why we care

Max's atmo-expression UAT verdict (2026-07-19, verbatim in that contract's statusNote): "the
red spot storms still seem pasted on top. We'll need to figure out the ordering/height of
different types of weather phenomena and how they blend. Also: … I still am not seeing the
kind of 'ink diffusing in water' rolling storm effects that are observable on jupiter." The
driver-wiring audit traced both to mechanisms: the storm is the only phenomenon composited
with no height semantics (one alpha-over rule for two phenomena at opposite ends of the real
vertical column — GRS towering top deck vs ice-giant holes into the deep deck), and nothing
in the field ever actually winds around a storm (`stormSwirl` is a bounded solid-body twist;
`dAdvect`'s fold is explicitly not a roll-up). Third finding: the one law that genuinely
consumes radius (Rhines band count) is fed the preset constant instead of the drawn radius at
both call sites, and rotation is never drawn at all — so bands don't vary with the drawn
world. This increment ships the deckZ compositor, the dSpiral roll-up, and the radius/rotation
wires as one contract-sized unit.

**Outcome line of sight:** World Engine → hero-renderer giants whose weather reads as being IN
the flow, with band architecture that varies across the drawn population (charter §INTENT
FRAME: physics-derived populations, no defaults).

## Success criteria (Max's words, 2026-07-19)

- Storms stop reading "pasted on top": ordering/height/blending of weather phenomena becomes a
  real vertical-column architecture (deckZ), not a paint order.
- "Ink diffusing in water" rolling storms are present: band material genuinely winds around
  aged storms (dSpiral displacement, wind-up ∝ age — the deferred non-goal now called due).
- "I do like the whispiness possible with these new variables" — `dAdvect` is LIKED and stays
  untouched; extend, never rework (taste fence).
- No defaults: band count spans the drawn population (small slow ice giant ≈3 bands vs large
  fast gas giant ≈15–16); rotation is drawn per archetype, hot-Jupiter derived tidally locked.

## Driver enumeration (per feedback_wire-relevant-drivers-before-uat)

| Driver | Status this increment |
|---|---|
| radiusEarth | WIRED — `state.planetRadiusEarth` into `resolveParams` at both call sites (rebakeE5Bands + storm-placement re-derive); Rhines law already correct, the wire was broken |
| rotationHours | WIRED — `drawPresetRotation` per archetype (gas ~8–14 h, ice/sub-Neptune ~12–20 h); hot-Jupiter NOT drawn — derived tidally locked from `orbitRadius`; NAMED_BODY locked; new alea stream |
| age | WIRED — dSpiral wind-up ∝ ageScalar (time enters only as total wound state, fully static); mode-0 tower prominence ∝ ageScalar (shares the chromophore driver) |
| T_eq | DEFERRED — haze/ink thermal drive is Increment 7 (named owner); deckZ-weighted haze mute lands here as the structural prerequisite |
| surfaceGravity | DEFERRED — enters storm sizing via Rossby L_D in Increment 6 (STORM_PHYS derive-not-freeze, declared owner) |
| rawTidalIoRatio | IRRELEVANT — no first-order role in giant band/storm compositing |
| ρ/composition | IRRELEVANT this increment — amplitudeLaw's R-invariant mass back-solve is deliberate + defensible (flat giant mass–radius relation); radius correctly enters ONLY through Rhines `a` |
| atmosphere.pressure | WIRED (structurally) — the deckZ table IS the pressure-column made render-real (0.0 deep floor / 0.35 belts / 0.7 zones / 0.9 tower / 1.0 haze); no new P scalar reads needed this increment |
| Deliberately unwired (surface to Max pre-UAT) | Limb/scale-height cue (Inc 7); storm radii from L_D (Inc 6); ink/contrast thermal drivers (Inc 7) |

## DOES / UNLOCKS (Rule 15 card)

**DOES:** gives every atmo phenomenon a deck height (deckZ) and derives compositing from it
(same-deck deflects via existing machinery, different-deck occludes/reveals); makes mode-1
spots holes you look into (deep-deck palette + rim wisps) and mode-0 storms towers that earn
height (emboss rim, cold annulus, age-tied prominence); adds dSpiral static log-spiral
displacement so bands wind around aged storms with KH billow scalloping; wires drawn radius
into Rhines at both call sites, draws rotation per archetype (hot-Jupiter tidally locked,
derived), and retires the vestigial second band count (`uBandCount` → derived `uBandM`).

**UNLOCKS:** Increment 6 (storm sizes from L_D — needs the deck architecture), Increment 7
(limb cue + ink drivers — extends deckZ-weighted haze), brown-dwarf/lava/terrestrial
atmo increments (inherit an honest vertical column), and population-level band variety
(the audit's ×2+ visible spread per roll).

## Fences (this increment's hard walls)

- `GOLDEN_BANDFIELD_HASH` + `GOLDEN_STORM_MASK_HASH` unchanged; aStorm mask contract + phase
  bank byte-identical; existing `stormE:{place,age,phase,polar}` draw order untouched — new
  alea streams appended only (#4 lightning / #5 brown-dwarf / #8 Mars-oscillator consumers
  unaffected).
- `dAdvect` untouched (LIKED — taste fence).
- Static discipline: no `uTime` anywhere in F24–F31; all new per-storm scalars alea-only.
- Atmo lane owns F24–F31 GLSL + `climateE5:*`/`stormE:*` writers; ground lane (concurrent
  Increment 1 in the L1 tree) owns relief/dispatch — never both trees mid-edit on one section.

## Provenance

Scoped from `~/briefings/driver-wiring-audit-2026-07-19.md` §3 Increment 2 (+ §2 matrix
footnotes 15–19, 21; §5 atmosphere appendix) under the standing greenlight recorded
2026-07-19. Rhines call-site fact session-verified (handoff §Session-verified physics facts).
Limb-thickness cue deferred to Increment 7 to keep this contract-sized (audit's call).

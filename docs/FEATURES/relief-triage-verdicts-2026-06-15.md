# Surface-relief triage — science-grounded verdicts (2026-06-15)

Resolves the manifest-vs-model tension for the Tier-2 render-audit's surface-relief
false-renders by grounding each (feature × archetype) pair in **actual planetary
science** (7 research subagents, WebSearch over observed-mission + peer-reviewed data).
Source list of false-renders: `lab-render-audit.md` (solid 🔴F, Δ>0.0005).

**Two buckets emerged** (this is the key finding — it's NOT all driver bugs):
- **MANIFEST-TOO-NARROW** — the feature *is* real on that body; the manifest's `rendersOn`
  wrongly excludes it → **broaden `rendersOn`** (and Appendix A / the ⊆-union test as needed).
- **FEATURE-BUGGY** — the feature does *not* belong (wrong mechanism/material, or no solid
  surface); the driver derives nonzero anyway → **tighten the driver gate** (force-enable honesty).

## Verdict table

| Feature | Archetype | Δ | Science verdict | Bucket | Action |
|---|---|---|---|---|---|
| `lava` | Europa | 0.0055 | NO — no silicate surface; only *cryo*volcanism (separate feature) | feature-buggy | tighten: silicate-crust gate |
| `frost` | Europa | 0.0054 | **OBSERVED** — surface IS water-ice + hydrates | manifest-narrow | broaden: +Europa |
| `mountains` | Titan | 0.0027 | NO — Titan mountains are *water-ice* fold-ridges, not silicate | feature-buggy | tighten: silicate-crust gate |
| `weatherBands` | Titan | 0.0022 | NO — opaque haze homogenizes disk; banding is a haze-layer feature, not zonal bands | feature-buggy | tighten: gate off thick-haze worlds |
| `mountains` | Frozen | 0.0019 | NO — relief is impact crater-rim / basin-ring, not orogeny | feature-buggy | tighten: silicate-crust gate |
| `mountains` | Europa | 0.0018 | NO — relief is ice double-ridges/chaos, not silicate | feature-buggy | tighten: silicate-crust gate |
| `mountains` | Crystal | 0.0017 | N/A — no scientific basis; exotic crust owned elsewhere | feature-buggy | tighten: exotic gate |
| `glacial` | Europa | 0.0015 | **THEORIZED** — viscous ice flow / lobate flows, relaxation | manifest-narrow | broaden: +Europa |
| `sublimation` | Europa | 0.0012 | **THEORIZED** — equatorial penitentes (Hobley 2018) | manifest-narrow | broaden: +Europa (predicted) |
| `edifices` | Europa | 0.0010 | NO silicate — only *cryo*volcanic domes (separate) | feature-buggy | tighten: silicate-crust gate |
| `mountains` | Lava | 0.0009 | **OBSERVED** — Io has 17 km *silicate* thrust mountains | manifest-narrow | broaden: +Lava |
| `craters` | Mars | 0.0008 | **OBSERVED (prominent)** — highlands saturated, 300k+ | manifest-narrow | broaden: +Mars (declared only Frozen — badly wrong) |
| `lava` | Venus | 0.0008 | **OBSERVED** — basaltic plains, active (Sif Mons) | manifest-narrow | broaden: +Venus |
| `dust` | SubN/GasS/GasJ/HotJ/IceN | 0.0005–0.0008 | N/A — no solid surface; their "dust" is suspended haze (separate) | feature-buggy | tighten: gate off no-surface giants |
| `mountains` | Carbon | 0.0007 | NO — carbide/diamond constructs, silicate-poor | feature-buggy | tighten: exotic/silicate gate |
| `massWasting` | Crystal | 0.0007 | **OBSERVED-analog (universal)** — needs only slopes+gravity | manifest-narrow | broaden: +Crystal (+Carbon; ~all solid) |
| `tessera` | Europa | 0.0005 | NO — Venus-specific landform; Europa deforms as ridges/chaos | feature-buggy | tighten: silicate-crust gate |

Faint traces (⚠️F, Δ 0.0001–0.0005) deferred: craters+Rocky/Eye (faint-legit), canyons/scarps/plateaus+Europa,
edifices+Venus(faint, but Venus is broaden-anyway), tessera+Lava, sublimation/glacial+Eye/Ocean.

**ACCEPTED — faint `craters` on Ocean / Europa (Δ ~0.0001–0.0005, ⚠️ faint-trace tier).** Verdict:
ACCEPT — minor cratering is science-legit on all solid surfaces; the trace is below the 🔴 0.0005
solid-false-render threshold and reads as a real faint signal, not a bug. Decision: Max's call,
2026-06-15 (recorded in the Thread B design spec, committed `e339b9f`). Action: **no code** — documented
and closed; this trace is expected to PERSIST in the render-audit (do not treat its continued presence
as a regression). Promotes the deferred faint-traces line above for craters specifically.

## Implementation buckets

**A. Manifest-too-narrow → broaden `rendersOn`** (planet-feature-associations.js;
check Appendix A + the rendersOn⊆archetype-union test; some are taste-scoped):
- `frost`, `glacial`, `sublimation` → +Europa (Europa is icier than Titan/Frozen — clear miss)
- `mountains` → +Lava (Io silicate mountains)
- `lava`, `edifices` → +Venus (Venus is volcanically active — clear miss)
- `craters` → +Mars (prominent), +Rocky/+Eyeball (faint) — declared-only-Frozen is badly wrong
- `massWasting` → +Crystal (+Carbon; research says universal on ALL solid-surface worlds — taste: blanket-add?)

**B. Feature-buggy → tighten driver** (core.js derivations + per-frame writers; force-enable honesty):
- **Silicate-relief family on icy worlds** (shared cause): `mountains`/`lava`/`edifices`/`tessera`
  leak onto Europa/Titan/Frozen because the derivations don't gate on a SILICATE (non-icy) crust.
  Root cause confirmed for mountains: `core.js:639 mountainAmp = clamp01(mix(0.25,0.6,1-erosion))`
  keys ONLY on erosion — the sole relief driver missing the activity/crust gate its siblings
  (chasma/plateau/tessera/volcanism) all have. Fix: a shared `silicateCrust` factor (low
  volatileFraction). KEEP Lava (silicate — Io mountains) — do NOT use a hot/molten knockdown.
- **`dust` on gas/ice giants**: no solid surface → driver should zero `dust` where there's no surface.
- **`weatherBands` on Titan**: opaque-haze worlds → gate off (its banding is the haze feature).
- **Exotic worlds** (Carbon/Crystal) mountains: small residual; exotic archetypes own their relief
  (carbon F42 / facets F43). Needs an exotic discriminator or accept as low-Δ residual.

## Research sources
Per-feature citations captured in the dispatching session transcript (Europa cluster, mountains,
gas-giant dust, Venus volcanism, craters, Titan weather-bands, mass-wasting). Key papers:
Hobley+2018 (Europa penitentes), Io thrust mountains (Science 1998), Magellan Venus volcanism,
Mithrim Montes (Titan ice ranges), mass-wasting universality (CNR IRPI catalog).

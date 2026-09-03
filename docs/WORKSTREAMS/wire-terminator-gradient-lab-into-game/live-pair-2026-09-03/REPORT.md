# F35 terminator wire — AC-3 (live A/B) + AC-4 (the lab)

Repo `/home/ax/projects/well-dipper`, branch `feature/world-engine-production-L1`, HEAD
`eb58ac9cff75181bb1730776a085645a667eb299` (the F35 merge). Real navigation before every job — the
served tree changed. Lane A's server on `:5175`, Chrome `:9223`, the pre-existing page; no page opened
or closed. No repo file edited, staged or committed. Artifacts in this directory.

Instrument (`src/rendering/labTermAB.js`, key `.`): its arms are inverted relative to its two siblings —
the terminator SHIPS OFF (Max 2026-07-16), so `on()` writes each body's own pack-resolved law value and
`off()` restores the shipped 0. `record()` returns `{lawValue, shipped, uniformValue, state, hasAir,
pack, termWidth, termBypass, packsApplied}`.

## AC-3 — live terminator A/B on rocky-2

**Setup.** `wd.labGasBodies` read back null before removal; removed anyway. Real navigation to
`?system=rocky-2`; `_lab.isInSystem()` true; `stopAutopilot()` awaited; 6 s; `freezeFrame()` →
`{frozen: true, admissible: true, clocksPinned 12, ratesZeroed 31, bodiesPinned {planets 6, moons 2,
rings 1}}`. `_systemData.seed` = `rocky-2`.

**Registry:** `_labTerm.size()` = **8** = 6 planets + 2 moons = every body mounted. Stable at 8
throughout. All 8 records non-null.

### Pre-flight (at rest, before any grab)

| role | subject | body | type / radius | atmosphere | pack | lawValue | shipped | uniformValue | termWidth | flag |
|---|---|---|---|---|---|---|---|---|---|---|
| air | `{planet, p:1}` | `body.planet.22418e` | rocky, 0.7193 R⊕ | **0.5127 bar n2-o2** | solidOptics | **0.15** | 0 | 0 | 0.09389 | `{enabled: true, source: 'default'}` |
| airless moon | `{moon, p:1, m:0}` "Houm" | `body.moon.053b5c` | ice, 0.02695 R⊕ | **null** | solidOptics | **0** | 0 | 0 | 0.06 | same |
| gas | `{planet, p:2}` "Paurosgara" | `body.planet.484409` | gas-giant, 12.566 R⊕ | 1000 bar h2-he | giantSurface | **0.15** | 0 | 0 | 0.30 | same |

`isLabPlanetMaterial: true` and `pipeline.labGasBodies: true / flagSource 'default'` on every framing.
⚠ The brief called p1 "0.345-bar-class air"; measured **0.5127 bar** (still n2-o2, still solidOptics).
The moon passed pre-flight, so the `{moon, p:0, m:0}` fallback was not needed.

### Framing — the crescent

| body | radii | litFraction | rotation needed | disc cx,cy,r | ≥24 px | fps |
|---|---|---|---|---|---|---|
| p1 (air) | 3 | **0.503513** (phaseDot 0.007) | **none** — the frozen pose already lands in band | 674.5, 422, 213.08 | yes | 241 |
| moon | 3 | **0.5** (from 0.9736) | 1 try, `setCameraPose` at the same distance | 674.5, 422, 213.08 | yes | 226 |
| gas p2 | 3 | **0.5** (from 1.0) | 1 try, same | 674.5, 422, 213.08 | yes | 209 |

Rotation method: camera placed at `bodyPos + dist·û` with `û·L̂ = want` (litFraction = (1+dot)/2,
agentFraming.js:228), controller yaw/pitch written to the `sin(yaw)cos(pitch)` convention
(CameraController.js:123-125); `posDelta 0 / quatDelta 0`; litFraction re-read LAST through a fresh
`frameBody`. The airless moon was deliberately put at a crescent too — a 0 at lit 0.97 would be a 0
with almost no terminator arc on screen, i.e. unreadable as a control.

### Pixels — `scripts/shot-diff.mjs`, threshold 2/255, `--a off --b on`, no `--region`

Every JSON: `declaredRegion: "disc"`, `reproduction.commit: eb58ac9cff75181bb1730776a085645a667eb299`
(non-null), `waivers: []`, `throttled: false`.

| pair | in-disc px | % of disc | max abs Δ | floor (OFF/OFF) | litPctA | full-frame % | verdict |
|---|---|---|---|---|---|---|---|
| **p1 OFF vs ON** | **33 435** | **23.4431 %** | **42/255** | **0 px / 0.0000 %** | **40.65** | 2.9381 | SIGNAL ABOVE FLOOR |
| moon OFF vs ON | **0** | 0.0000 % | 0 | 0 px | 43.49 | 0.0000 | AT OR BELOW FLOOR |
| gas OFF vs ON | **97 073** | **68.0631 %** | 42/255 | 0 px | 39.97 | 8.5391 | SIGNAL ABOVE FLOOR |
| p1 restore vs OFF | **0** | 0 | 0 | 0 px | 40.65 | 0 | exact |
| gas restore vs OFF | **0** | 0 | 0 | 0 px | 39.97 | 0 | exact |

p1 rim-annulus 11.1541 % / disc-interior 28.1608 % — the band is spread over the disc, not a rim leak.

**Against AC-3's bar on p1, every clause met:**
- ≥ 0.5 % of disc pixels: **23.4431 %** — 47× the bar, and ~880× the scoping pair's 0.0266 % at lit 0.98.
- max abs ≥ 8/255: **42**.
- floor 0: **0 px, maxAbs 0**.
- `litPctA` in [30, 70]: **40.65**.
- outside the silhouette (below): **13 px, max 0.40 px past the edge**.

### Outside-silhouette counter (`f3-live/outside.mjs`, threshold 2/255, ROI from the sidecar)

| pair | moved | inside disc | outside | max past edge | outside as % of circumference (2πr = 1338.8 px) |
|---|---|---|---|---|---|
| p1 | 33 452 | 33 439 (23.44 %) | **13** | **0.40 px** | **0.97 %** |
| moon | 0 | 0 | **0** | 0 | 0 % |
| gas | 97 223 | 97 093 (68.06 %) | **130** | **1.48 px** | 9.71 % |

p1 clears both bounds — the brief's (≤ 5 % of circumference, within 1.5 px) and AC-3's own
(≤ 20 px within 1.5 px). The gas body's 130 px is above the 5 %-of-circumference guide but every one of
them is inside the 1.5 px distance band; it is the antialiasing edge of a disc whose whole face moved
68 %, and AC-3 asks only "> 0" of the gas control. RECORDED, not waived.

### The three controls

- **Airless moon:** 0 px at a crescent, and `record()` **non-null** with `lawValue 0`, `shipped 0`,
  `hasAir false`, `pack 'solidOptics'`, registry size 8 — the 0 is admissible, not a blind spot.
- **Gas body:** moved at its own derived law value (`uniformValue === lawValue === 0.15`, pack
  `giantSurface`), 68.06 % of the disc.
- **Restore:** `off()` put `uniformValue` back to `shipped` (0) on every body — `all()` reports 8/8
  shipped — and both restore diffs are 0 px.
- Registry census under ON: 6 air-bearing bodies at 0.15, 2 airless moons at 0 — the instrument writes
  the law per body, never a literal.

**Console (game):** 0 errors; 1 warning, the known `GL_INVALID_VALUE: glGetProgramiv` ×24.

## AC-4 — the lab in Chrome

`http://localhost:5175/well-dipper/world-engine-lab.html`.

**(a) 0 script errors.** First load: one `[error] Failed to load resource … 404` — **it was my own probe**
(`GET http://localhost:5175/src/worldengine/drivers/solidOptics.js` [404], reqid 9805), not the page;
the correct path is `/well-dipper/src/...` [200]. Nothing else in the network log 404s (no favicon miss).
That load also warned `[lodlab] scenario restore failed — defaults kept TypeError: Cannot set property
crater of #<Object> which has only a getter` — the getter-only readout at world-engine-lab.html:3294
(`fScaleReadout.add({ get crater(){…} }, 'crater').name('crater footprint')`), whose name **is** in the
saved blob. It is a **one-shot cross-build effect**, not an F35 defect: the blob had been written by the
pre-F35 build; `git diff b6c3669 eb58ac9 -- world-engine-lab.html` touches only 4 hunks (the import line,
`terminatorEnabled`, `limbBypass`/`termBypass`, the :2505 deletion) and neither :3294 nor the
save/restore path. **On reload it restored cleanly: 0 errors, 0 warnings**, and 0 errors again after the
whole run. Worth a backlog row all the same — a saved scenario that includes a disabled getter-only
readout can abort a whole restore.

**(b) THE LIVE PROBE** — `await import('/well-dipper/src/worldengine/drivers/solidOptics.js')` →
`TERMINATOR_ENABLED: false`.

| point | `state.terminatorEnabled` | `TERMINATOR_ENABLED` | equal |
|---|---|---|---|
| at boot | false | false | **true** |
| after `setPreset('Venus (sulfuric shroud)')` (applyWorldDefaults ran) | false | false | **true** |
| after `setPreset('Rocky (Earthlike)')` | false | false | **true** |

**(c) The ✓ enabled checkbox on an air preset (Rocky).** Handle: the F35 folder is the `.lil-gui` whose
`:scope > .lil-title` starts `Terminator gradient (F35)`; **the checkbox is in the folder TITLE**
(`:scope > .lil-title input[type=checkbox]`), its children are `strength (driven)`, `width (driven)`,
`band color (driven)`, `term bypass quantizer`, `🔆 solo`.

| click | checkbox | `state.terminatorEnabled` | `uTermStrength` |
|---|---|---|---|
| initial | false | false | **0** |
| ON | true | true | **0.15** |
| OFF | false | false | **0** |

0.15 = `TERM_STRENGTH` × columnFraction (1 on Rocky) — read from the module, not assumed.

**(d) The width slider after the :2505 deletion,** against `termWidthFor(pressure)` imported live:

| preset | preset atmosphere | GUI `width (driven)` | `uTermWidth` | `termWidthFor(p)` | match |
|---|---|---|---|---|---|
| Rocky (Earthlike) | 1 bar | 0.12 | 0.12 | 0.12 | **exact** |
| Venus (sulfuric shroud) | 92 bar | 0.29674090446109996 | same | 0.29674090446109996 | **exact** |
| Gas giant (Jovian) | 1000 bar | 0.30 | **0.30** | 0.30 | **exact** |
| Gas giant (Saturnian) | — | 0.30 | 0.30 | (0.30 ceiling) | — |
| Moon/Mercury (airless) | null | 0.06 | 0.06 | n/a (strength 0) | — |

⚠ **A read-too-early trap worth recording.** One frame after `setPreset('Gas giant (Jovian)')` the width
still read the previous body's value (0.06 arriving from Moon/Mercury, 0.12 from Rocky). The :2505
deletion removed the *synchronous* write, so on GAS the width now arrives only when the debounced
`giantSurfaceLabState` runs inside `ensureNetworkRouted`: measured 0.06 at t≈0, **0.30 by t = 1.5 s**,
0.30 at t = 5.5 s, and 0.30 arriving from an airless preset too (so it is a genuine write, not a carry).
Invisible in the shipped state (strength 0), but any future measurement of a gas width must settle first.

**(e) The two bypass checkboxes** (`term bypass quantizer` in the F35 folder; `limb bypass quantizer` in
`Limb glow (F34)`): `uTermBypass` **0 → 1 → 0**, `uLimbBypass` **0 → 1 → 0**, `state.termBypass` /
`state.limbBypass` mirroring each write.

**(f) Airless preset (Moon/Mercury), checkbox ON:** `terminatorEnabled true` but `state.termStrength 0`
and `uTermStrength` **0** — the airless gate holds independently of the enable. Off again: 0.

**(g) Restored, byte-identical to the boot state:** preset `Rocky (Earthlike)`, `terminatorEnabled false`,
checkbox false, `termStrength 0.15`, `termWidth 0.12`, `termBypass false`, `limbBypass false`,
`radiusSeed 1`, `planetRadiusEarth 0.8188630066346377`, uniforms `uTermStrength 0 / uTermWidth 0.12 /
uTermBypass 0 / uLimbBypass 0`. Lab console at the end: 0 errors, 0 warnings.

## State the page was left in

`http://localhost:5175/well-dipper/?system=rocky-2`, seed `rocky-2`, **thawed**, terminator **OFF —
the shipped state** (`_labTerm.isOn === false`, all 8 bodies `uniformValue === shipped === 0`),
registry size 8, the temporary `__f35` rotation helper deleted.

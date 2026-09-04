# The seven-surface inventory — rendering scale & aesthetic consistency

> Max, 2026-09-05: *"we need to make sure the rendering scale (resolution, etc) is aesthetic
> appropriate for all the planets/moons/stars, the starfield, the giant galactic objects, the menus,
> and the cockpit. I have the sense they are not all consistent with our chosen aesthetic."*
>
> **This document is evidence, not a fix.** Nothing has been changed. Every number below was either
> read out of source at a named line or measured in the running game on 2026-09-06.
> Branch `feature/world-engine-production-L1` at `92df203`.

---

## 0. The instrument, and the fact that it was vacuous the first time

The handoff demanded a *discriminating* check per surface: change the setting, confirm the surface
moves. My first attempt could not have detected anything.

**Film grain runs at `uGrainStrength: 0.045` and varies every frame.** Two screenshots taken at the
*same* setting differed by mean 7.909 per pixel. The posterize change I was trying to measure
produced mean 6.263. **The noise floor was larger than the signal** — the probe would have reported
"no change" for a surface that was in fact changing.

`_lab.freezeFrame()` is the fix already in the codebase (grain → 0, 25 clocks pinned, 72 rates
zeroed). With it:

| | changed pixels | bbox |
|---|---|---|
| **Control** — 31 vs 31 | **0** (0.00 %) | none |
| **Signal** — 31 vs 2 | **254,089** (10.40 %) | x795–1366, y279–850 |

The control reproduces bit-identically, so a zero means "did not move" rather than "instrument
dead". The signal's bounding box is a 571 × 571 square centred on the planet disc — **the starfield
and the nebula filling the rest of that frame did not move a single pixel.** Every claim below rests
on this instrument.

⚠ The render loop was verified live during the frozen measurement (964 frames advanced in 1 s), so
"identical" means "redrawn identically", not "not redrawn".

---

## 1. RENDERING SCALE — measured live, window 2162 × 1440

`RetroRenderer.render()` is four passes into four targets. The scale is not one number.

| Surface | Pass | Target | Resolution | vs native |
|---|---|---|---|---|
| Planets, moons, rings, belts, in-system stars | 2 | `sceneTarget` | **721 × 480** | **1 / 3** |
| Starfield, galaxy glow, giant galactic objects | 1 | `bgTarget` | **2162 × 1440** | **1 / 1** |
| Cockpit | 3.5 | `cockpitTarget` | **2162 × 1440** | **1 / 1** |
| Minimap / system map | 3 | `hudTarget` | **320 × 320** | fixed — *does not scale with the window* |
| Menus | — | none (DOM) | native | **1 / 1**, vector text |

Each of these is deliberate and each has its reasoning written down at the site:
`RetroRenderer.js:7` (*"starfield renders at FULL resolution — tiny crisp star points"*) and
`RetroRenderer.js:253` (the cockpit is full-res *"because the panels carry text the pilot has to
read at 17 degrees"*).

⭐ **So the resolution split is not an accident — but nobody has ever judged the five tiers side by
side against one aesthetic.** Two of the seven surfaces are drawn at 9× the pixel density of the
planets, and one (the HUD) is at a *fixed* 320 px that silently gets relatively coarser as the
window grows.

---

## 2. COLOUR QUANTISATION — there are three live systems, not one

Measured in Sol, live, as a census over every material in the scene graph:

```
SCENE:  207 materials  (none)                 ← no quantisation at all
         35 materials  uPosterizeLevels = 31  ← the settings-wired path
         16 materials  posterizeLevels  = 8   ← the Sol textured path
SKY:      2 materials  (none)
         14 materials  uPixelScale = 3        ← no colour quantisation at all
COCKPIT: its own two-colour phosphor law
HUD / COMPOSITE / MENUS: no posterize uniform of any kind
```

### 2a. The settings-wired path — obeys `posterizeLevels: 31`

`POSTERIZE_QUANTUM` (vec2, the six game programs) and `POSTERIZE_LEVELS` (scalar, the lab material)
are *shared objects*, so one setter call moves every live material. Verified by **object identity**
in the running game, not by value: live materials hold the identical object the module exports.

**Discriminating check: passed.** Driving the setter 31 → 2 → 31 moved all 35, and the A/B image
shows the disc collapsing to ~3 tones while the sky behind it stays pixel-identical.

### 2b. The Sol textured path — **cannot be reached by the setting at all**

`TexturedBodyShader.js:24` and `MaterialBodyShader.js:26` each take `posterizeLevels = 8.0` as a
**build-time argument** and wrap it in a *private* `{ value }` (`:43`, `:66`). `BodyRenderer.js:375`
feeds it `profile.posterizeLevels ?? 8.0` from `KnownBodyProfiles.js`, whose 17 entries are all
`8.0`. Two more sites hard-code `8.0` in `main.js` (`:9038` the material-channel debug mesh, `:13615`
the TextureBaker swap).

**Discriminating check: failed, and this is the headline.** With Luna framed at 3 body radii I drove
the shared setter 31 → 2 → 31 and read Luna's uniform at each step:

```
shared setter:  31  →   2  →  31
luna's value:    8  →   8  →   8     ← never moved
census:         16 materials at 8 throughout, 35 materials tracking
```

**So in Sol, right now, two quantisers run in the same frame: 16 bodies at 9 values per channel
(≈3.17 bits) and 35 at 32 values per channel (5 bits).** That is the inconsistency Max sensed,
measured.

### 2c. The cockpit — a separate law, and deliberately so

`PhosphorDither.js` is an 8 × 8 Bayer matrix implementing **one ink on black**, with no colour
literal in the file. It is lane F's `cockpit-screen-content-2026-07-28` design position, and its
header says the right setting *"is the thing being judged"* — i.e. it is explicitly Max's eye-gate,
not a constant to be unified. **This one is deliberate and current. I would leave it alone.**

### 2d. Dead code — `DitherPass.js`

Posterizes to `colorLevels: 12.0` and documents itself as *"15-bit color (32 levels per channel)"*,
which its own default contradicts. **It has zero importers anywhere in the repo, tests included.**
It draws nothing. Worth deleting so it stops appearing in exactly this kind of survey.

---

## 3. Was the 8.0 deliberate or inherited? — **both, in sequence**

The handoff was right to forbid guessing. The answer is on the record, with dates:

- **2026-03-28, `167598f`** — `posterizeLevels: 8.0` lands with the Sol textured bodies. Its comment
  at `KnownBodyProfiles.js:30` reads *"fewer levels = more retro, more levels = more detail
  visible"*. **The global default was `6.0` at the time.** So 8 was chosen as *slightly more detail
  than the game*, which is a coherent choice for NASA photographic source material. **Deliberate.**
- **2026-08-21, `564e0db`** — Max's RGB555 ruling moves the global 6 → 31. The textured path is not
  touched.

⭐ **The relationship inverted.** 8.0 was 1.33× the game's levels; it is now 0.26× them. What was
authored to mean *"a little crisper than the procedural bodies"* now means *"four times coarser than
everything around it"* — without anyone deciding that.

⛔ **This does not make "set them all to 31" the answer,** and I am not recommending it. A
photograph quantised to 5 bits is a different judgement from procedural terrain quantised to 5 bits;
the original comment's logic (*photos want more levels*) would argue for something **above** 31, not
equal to it. That is a taste call on Sol specifically and it is Max's.

---

## 4. `pixelScale` — one setting, ten copies

`Settings.js:12` `pixelScale: 3` is user-facing. `RetroRenderer.js:811` is the only consumer that
reads it. **Nine other places restate the 3 as a literal:**

| Site | Form |
|---|---|
| `sky/SkyFeatureLayer.js:448` | `uPixelScale: { value: 3.0 }` — comment: *"match RetroRenderer.pixelScale"* (14 materials live) |
| `sky/ProceduralGlowLayer.js:884` | `floor(gl_FragCoord.xy / 3.0)` |
| `sky/StarfieldLayer.js:284` | `floor(gl_FragCoord.xy / 3.0)` |
| `sky/WarpTunnelStarfieldLayer.js:299` | `floor(gl_FragCoord.xy / 3.0)` |
| `objects/StarRenderer.js:430`, `:577` | `floor(gl_FragCoord.xy / 3.0)` ×2 |
| `objects/StarFlare.js:111` | `floor(gl_FragCoord.xy / 3.0)` |
| `objects/PlanetBillboard.js:69` | `floor(gl_FragCoord.xy / 3.0)` |
| `ui/TargetingReticle.js:62, :65` | `GHOST_THICK = 3`, `PX = 3` — *"matches retro pixelScale"* |

⚠ **Stated as a static reading plus the live `uPixelScale = 3` census — I have not moved
`pixelScale` and photographed the result.** The prediction is that the scene target resizes and
these ten keep drawing a 3-pixel grid, so the sky's chunk size and the world's chunk size come
apart. That is a 10-minute check whenever it matters; I did not spend it because nothing here
proposes changing `pixelScale`.

⚠ `main.js:199` records a *precedent defect for this exact knob*: `pixelScale` was not read on boot,
only on change — the setting existed and the game ignored it.

---

## 5. False leads — checked and dropped

`uPlateauLevels` (value 4) and `uPldLevels` (value 6) each appear as **21 separate private uniform
objects** in the live scene. They have the exact signature of unwired display settings and I nearly
filed them as such.

They are not. `uniforms.js:216` — *mesa terrace count*. `uniforms.js:281` — *annular strata band
count*. **Both are terrain landform counts, not colour quanta.** Correctly unwired; no defect.
(Handoff trap 26 — read the unit before the number — fired here and was caught.)

---

## 6. What is not yet measured

- **The cockpit live.** It was inactive (ORRERY) during the census, so §2c rests on source alone.
  A HELM-mode pass would confirm the phosphor law is the only quantiser on that surface.
- **The menus** were read as DOM/CSS (`style.css`, `DotGothic16`/`Pixelify Sans`, `image-rendering:
  pixelated` on the canvas only). They are outside all three quantisers by construction — which is
  a *finding*, not a gap, but nobody has judged whether crisp vector menu text belongs in front of a
  1/3-resolution world.
- **`pixelScale` moved off 3** — see §4.

---

## 7. The shape of what was found

Max's sense was right, and it is sharper than "some numbers differ":

1. **Five different rendering scales** ship in the same frame (1/1, 1/3, fixed 320, and DOM-native),
   each individually justified, never judged together.
2. **Three live colour-quantisation systems**, one of which (Sol's 16 bodies) is **structurally
   unreachable** by the setting that is supposed to govern the look — not mistuned, *unwired*.
3. **One superseded decision** — the 8.0 was correct against a default that no longer exists.
4. **Ten hardcoded copies** of a user-adjustable `pixelScale`.
5. **One dead quantiser** still in the tree.

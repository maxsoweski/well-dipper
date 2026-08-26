# World Engine — ATMOSPHERE (Track A): recommended dependency-steered build plan

**One north star, two threads.** Everything reads one shared field stack rooted at the approved **#3a**. After #3a the work splits into a **giant/emission thread** (incs 2–6) and a **relief-coupled thread** (incs 7–9); they share only #3a's master fields, so they can run in parallel — the linear order below breaks ties by *variety-per-effort* (archetypes moved to "reads as itself" per unit build). All LAB-ONLY in `src/worldengine/base/`; determinism inherited from `plates.js` (`alea` off `macroSeed`, disjoint namespaces, no `Math.random`/`Date.now`, byte-identity + `climate-e5` vitest harness per writer; all "temporal" effects use the place-once seeded phase, never raw `t`).

## (a) Ordered increment table

| # | Name | Ships | Archetypes lit | Depends-on | Size |
|---|------|-------|----------------|-----------|------|
| 1 | **#3a** Giant reflectance bands/jets → RENDER *(APPROVED opener)* | Signed `u(lat)` **count**(Rhines)+**sign**(D/a)+**AMPLITUDE**(`U=f(energy/dissip, D/a)`, fixes Neptune paradox); Ward `W(φ,ε)` **>54° inversion**; filaments + mushball NH₃; sub-Neptune haze-mute; place-once phase selector. Lab shader consumes `bandField` (not inline `sin(lat·k)`). | Jovian, Saturnian, Neptunian, Uranus, sub-Neptune *(hot-Jupiter bands only)* | `climate-e5` (built) + lab shader seam | **L** |
| 2 | **Blackbody EMISSION v1** (register stand-up) | `E=Planck(T)→RGB` additive over reflectance, ~1100 K nightside floor; substellar hotspot + eastward jet offset. Cheapest register entry — a *correctness* fix (a hot giant otherwise renders **cold**). | **hot-Jupiter (completed)** | #3a (T-field) | **S** |
| 3 | **#3b Vortices / storms / polar** | Full `dU/dφ` shear + PV staircase → vortex placement (argmax anticyclonic shear, deterministic tie-break: lowest-lat→lowest-node); chromophore aging (white→red); ice-giant CH₄ companion clouds; **storm/convection MASK** + phase infra. | *(giants → iconic: GRS, hexagon, dark spot; no new archetype)* | #3a | **M/L** |
| 4 | **EMISSION v2**: aurora + lightning + airglow | Off-axis tilted+offset dipole oval + moon-footprint emitters; Poisson lightning on the #3b storm mask; universal airglow limb ring. New **magnetic-dipole driver**. | ice-giant off-axis oval (identity tell), magnetized rocky; cross-archetype depth | #2 compositor, #3b storm mask, magnetic driver | **M** |
| 5 | **Brown-dwarf / directly-imaged** | S≈0 self-luminous config; `τ_cloud(lat)×f_cloud(T_eff)` sigmoid through the ~1200–1400 K L/T cloud-clearing; seeded holes drift on the jet. | **brown-dwarf** *(missing #1)* | #3a bands, #2 self-luminous, #3b patchy drift | **M** |
| 6 | **Lava / magma rock-vapour** | Substellar `p_vap(θ_s)=P_sat(T)` (Clausius-Clapeyron); dayside atmosphere-**presence mask**; supersonic day→night wind; terminator **rock-rain ring** (θ_s≈90°); Na/SiO emission color. | **lava/magma** *(missing #2)* | #2 dayside glow, #3a eyeball θ_s | **S/M** |
| 7 | **Terrestrial climate substrate → E9** | `P(φ)` bands + prevailing wind (Hadley) + one-way **orographic/rain-shadow relief READ** `P_oro≈C_w(U·∇h)`; feeds `precipWeight`/`baseLevel`, retires `synthPrecip`. Titan methane variant (haze + CH₄ drainage). | tectonic-terrestrial, ocean, eyeball, Titan | #3a + built `plates.js`/`shellRelief` + E9 seams | **L** |
| 8 | **Mars-class thin dusty CO₂** | Dust-τ **relaxation-oscillator** global storm at perihelion; frost caps `φ_cap(season)`→global `p_s` swing; thermal-tide sub-solar bulge; condensation wind `=∇(sublimation)`; dust-devil field. Lands shared `season(t;ε,e)` input. | **Mars-class** *(missing #3; closes the flagged Mars gap)* | #3a, #3b oscillator, #7 relief READ | **L** |
| 9 | **Pluto/Triton sublimation** | ~20-strata blue-haze comb (gravity-wave spacing); glacier condensation wind `=∇(N₂ sublimation)`; global `p_s` **on/off** seasonal collapse. | **Pluto/Triton** *(missing #4; NOT Titan)* | #3a haze overlay, #8 `p_s`+season, built `shellRelief` N₂-ice | **M** |

## (b) Dependency DAG (producers → consumers)

```
BUILT: climate-e5(headless) · plates.js · shellRelief(volatile-cold) · D13 magnetic · macroSeed/alea · E9 seams
                                        │
                                        ▼
                 ┌──────────── #3a bands/jets ────────────┐   sole root — publishes u(lat), T, phase, haze overlay
                 │            │              │             │
   GIANT/EMISSION▼    KEYSTONE▼              │    RELIEF-COUPLED▼
            #2 blackbody   #3b vortices      │          #7 terrestrial → E9
            emission v1    /storms/polar     │          (+ plates/shellRelief ∇h READ)
              │  │  │      (storm mask)      │                 │
              │  │  │          │             │                 ▼
              │  │  └─► #5 brown-dwarf ◄─────┘        #8 Mars ──► #9 Pluto/Triton
              │  │       (#3a bands + #2 glow          (oscillator   (reuses #8 p_s +
              │  │        + #3b patchy drift)           from #3b)     shellRelief N₂-ice)
              │  └─► #6 lava (#2 glow + #3a θ_s)
              │
              ▼ + #3b storm mask + magnetic driver
            #4 emission v2 (aurora + lightning + airglow)

Critical paths (longest first): #3a→#2→#4 · #3a→#3b→#5 · #3a→#2→#6 · #3a→#7→#8→#9
Parallelizable after #3a: {#2, #3b, #7} are mutually independent.
```

## (c) Ordering rationale

- **#3a first (fixed):** the single largest jump — one **L** lights 5 archetypes and stands up the `u(lat)`/`T`/phase/haze substrate every later increment reads. Its amplitude law is a *correctness* dependency, not a feature (jet-speed-dependent fields downstream all read `U`), so it's in-scope, not deferred.
- **Blackbody at #2 (before #3b):** grafted from the register-splitting proposal because it's the highest variety-per-effort move in the plan — an **S** increment that *completes* hot-Jupiter and fixes an outright bug (reflectance-only renders a hot giant as cold), while standing up the emission compositor that #4/#5/#6 all recycle.
- **#3b at #3 (keystone):** biggest visible payoff for the core giants (GRS turns "bands" into "a planet") *and* it produces the storm mask + phase infra that unblock lightning (#4), brown-dwarf patchiness (#5), and Mars dust (#8). Placed after the zero-new-dependency S-win, before its own consumers.
- **Emission-thread archetypes (#5, #6) next:** they recycle the just-built register almost entirely (brown-dwarf ≈ #3a bands + #2 glow; lava ≈ #2 glow + #3a θ_s + one presence-mask/ring), so they're cheap and keep the substrate fresh — substrate-first discipline.
- **Relief thread last (#7→#8→#9):** these need a surface READ, not just #3a. #7 is the gate (biggest install base, feeds built E9); Mars needs #7's relief machinery + #3b's oscillator; Pluto reuses Mars's `p_s`/season switch. Mars is heaviest and correctly last-but-one; Pluto is a mostly-recycle leaf.

**Watch-items to pin at `dev-collab-scope` time:** (1) `uStorm[8]` carriage is unverified (`grep`=0 in `src/`) — #3b may need new render uniforms. (2) Mars has a *hidden relief* dependency — it needs a dedicated stagnant-lid-rocky relief writer no increment here owns; #8 ships only the **atmosphere** half or it regresses to the plate/despun fallback. (3) #7 (terrestrial, **L**) gates Mars and rocky-branch lightning — don't let Mars look S-sized.

## (d) The "recyclable substrate first" through-line

Every increment is the *same field stack read with different per-body scalars*, so the plan front-loads producers and makes each later increment a recycle of fields already standing:

- **#3a is the load-bearing substrate** — its `u(lat)` count/sign/amplitude master + Ward `T(φ,ε)` + place-once phase selector + haze overlay are read by *all eight* downstream increments. Build it once, correctly (amplitude included), and the error surface for everything after shrinks.
- **#2 stands up the emission register once**; that compositor is reused by aurora + lightning (#4), lava glow (#6), and the brown-dwarf self-luminous path (#5) — four consumers off one S-sized producer.
- **#3b's storm mask + relaxation-oscillator + phase infra** are reused by lightning (#4), brown-dwarf cloud-clearing (#5), and Mars global dust storms (#8).
- **The terrestrial relief-READ (#7)** — orographic `U·∇h` off the already-shipped `plates.js`/`shellRelief` writers — is the reusable surface-coupling reused by Mars frost/condensation wind (#8) and Pluto glacier wind (#9).
- **No consumer precedes its producer:** blackbody before its glow-dependents, storm mask before lightning, terrestrial READ before Mars/Pluto, magnetic driver landed with the aurora that first needs it. Front-loaded variety falls out of building the recyclable substrate first, not from chasing individual archetypes.

## (e) VERIFIED — seed→driver connectivity audit (2026-07-01)

Max asked: *are all the atmosphere drivers connected to the seed so they re-roll per new body?* Verified by a 9-agent workflow (`wf_403bccac-b52`) + working-Claude spot-check. **Answer: no — the 6 physics-reading drivers split 3/3, and none reach the writer yet.**

**Seed-connected at the L0 source** (real per-body seed variation; path to writer = *planned at #9 port*):
- **`rotationRate` → D8 `rotation`** — seed rng spin (`PlanetGenerator.js:659/687-695`, `0` if tidally locked). D8's own label reads "→ zonal banding, jets." Feeds LAW1 (band count). *#9 needs a spin normalization.*
- **`obliquityDeg` → D3 `axialTilt`** — seed rng tilt in **radians** (`PlanetGenerator.js:654/683-685`). Feeds LAW4 (Ward hot-poles). *#9 needs rad→deg + abs.*
- **`energyInput`/T_eq → D1 `tempEq`** — per-body from orbit+luminosity (`PhysicsEngine.equilibriumTemperature`, `PlanetGenerator.js:363-365`). *Caveat:* the dimensionless `energyInput` **bundle** field is currently **inert** (read by no LAW in `resolveParams` — LAW3 deliberately omits insolation, the wind paradox). **#2 reads D1 `tempEq` directly**, not this field.

**NOT seed-connected — no D-slot exists** (frozen per-regime archetype constants only, `climate-e5.js:62-66`):
- **`shellDepthFrac`** (LAW2 equatorial-jet **SIGN** `tanh(6·(D−0.40))` + LAW3 shell-concentration) — Jovian 0.80, Neptunian 0.15.
- **`internalHeat`** (LAW3 amplitude numerator) — Jovian 1.67, Neptunian 2.60. *D12 `tidalHeating` is a **different** quantity (tidal-flexing heat, not gas-giant convective flux) and is wired to no atmosphere code — not a substitute.*
- **`dissipation`** (LAW3 amplitude denominator; Neptunian 0.15 = the fast-wind paradox) — no D-slot; the L0 audit notes its physical basis (e² flexing) isn't even the same concept as any existing driver (`world-engine-L0-audit.md:61`).

**Today's reality:** `climate-e5.js` has **zero game-side callers** (only `world-engine-lab.html` + tests import it — confirmed). The lab feeds **3/8** drivers (rotationRate, radius, conditionally obliquityDeg) from **fixed presets + manual UI sliders**, never from seed. So per-body variety today = **macroSeed jitter only** (band phase, ±10% mid-jet amplitude, ±2° obliquity); `uPeak`/`m`/`eqSign` are **byte-identical across seeds within a regime.**

**The gap (un-owned; #9 render-port does NOT cover it):** #9's job is to wire *existing* L0 fields into the writer — it can carry D8/D3/D1, but has **nothing to read** for shellDepthFrac/internalHeat/dissipation. If #9 ships as-is, **every Jovian is identical on jet-sign + wind vigor** — exactly the "banding gated on discrete type, not on drivers" over-supply the L0 audit already flagged (`world-engine-L0-audit.md:188`). This undercuts the "distinct worlds/minute" north star *for giants specifically*.

**Proposed resolution — PENDING MAX DECISION:** a per-body **seed→driver DERIVATION** of shellDepthFrac/internalHeat/dissipation from real D-slots (mass/gravity D14, age D16, composition/metallicity, eccentricity) — the atmosphere analog of the GROUND track's **#2 / #4-MULTIPLY** driver-response passes, plus an added "derive scalars not in D1–D16" step (the Option-A "thin Tier-1 base step derives missing structured fields" pattern, `world-engine-architecture-spine.md:148`). **Alternative:** explicit decision that these 3 stay archetype-constants and giant per-body variety is intentionally limited to macroSeed jitter + the 3 D-backed drivers. **This is distinct from and additional to the #9 render port; it does NOT block #2** (which reads seed-varied D1 T_eq).

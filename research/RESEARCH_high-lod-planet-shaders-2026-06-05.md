# Well Dipper LOD2 Close-Up Planet Detail — Research Synthesis

**Date:** 2026-06-05 · **Scope:** procedural per-fragment surface detail for a `< ~20×` body-radius close-up mode, surviving the 4×4 Bayer + 6-level posterize at the end of the pipeline.

> Produced by a 5-dimension deep-research workflow (topology, weather/atmosphere,
> fluid/flow, detail-synthesis-under-posterization, LOD architecture). All source
> URLs verified by the research agents. Code line-number claims spot-verified
> against live `Planet.js` / `Moon.js`.

---

## 1. Executive Summary

- **One foundation unlocks almost everything: analytic-derivative noise.** Swapping the current finite-difference normal (three `computeHeight` calls per fragment — confirmed at Planet.js 223–225, Moon.js 242–244) for IQ's `noised()` that returns `vec4(value, gradient)` gives exact normals in **one** eval at ~⅓ the cost, AND hands you the running gradient that erosion-FBM, frequency-clamping, and clean LOD2 normals all depend on. Every dimension's research independently converged on this as the highest-leverage single change.

- **The retro envelope is a filter that rewards lighting and punishes hue.** The Bayer threshold is added to **luminance** before `floor()`. Detail that moves the lit value (normal perturbation, specular, height bands) survives as dither texture; detail that lives only in subtle albedo gradients gets crushed. This single fact is the design spine of the whole feature: **route detail through normals/specular, not color.**

- **"More detail, not more resolution" maps cleanly to a continuous octave-count ramp.** Convert the hardcoded 4-octave `computeHeight` into a variable-octave FBM loop, drive octave count by `mix(4.0, 9.0, lodRamp)`, and fade the trailing octave by its fractional weight so it ramps in pop-free. This is posterization-safe because the octaves feed normals.

- **One CPU-side scalar (`lodRamp`, 0..1) should control the entire transition.** Compute it per body as `smoothstep(20.0, 6.0, dist/radius)` with enter/exit **hysteresis** on the discrete "which body is LOD2" flag. Octave count, perturb strength, effect amplitude, and the expensive branch all lerp off this one knob, so the whole approach ramps coherently and nothing pops.

- **The uniform branch bet is sound — with a caveat.** `if(lodRamp > 0.001){...}` is coherent across all fragments (zero warp divergence), so far bodies genuinely skip the heavy block. BUT the compiler still emits both paths, inflating register pressure for *every* body using that shader. The clean fix is a `#define LOD2` shader **variant** bound only to the closest body.

- **Per-type variety comes from swapping the FBM *combiner*, not the noise core.** Reuse one `noised()` core; dispatch by the existing planet-type integer uniform: ridged-multifractal for rocky/ice crestlines, billow for gas/cloud lobes, domain-warped FBM for lava/ocean/gas swirl, slope-damped FBM for terrestrial erosion. This is what produces Elite/NMS-style per-type distinctiveness.

- **Two techniques are genuinely off-limits under the constraints, and the research is honest about it:** true Gray-Scott reaction-diffusion and Stam stable-fluids both require ping-pong accumulation buffers → not deterministic-from-position → re-approach shows different state. Use them only as pre-baked LUTs or skip them. Don't let the "real fluid sim" hype pull you in.

- **THE design decision Max owns (Section 2):** how strictly to hold the retro envelope up close. Stay strict (everything as relief/lighting, maximally cohesive but capped richness), relax it at LOD2 (richer color/clouds, but the retro identity softens exactly when the player is paying most attention), or hybrid (strict relief + a few bypass channels for emissive lava glow / ocean glint). This is taste, not engineering — laid out below, not decided.

---

## 2. The Posterization Tension, Resolved Into Options

The core conflict: the retro look comes from hard 6-level quantization, but "feels like approaching a real world" wants richness. The closer the camera gets, the more the posterizer is the thing the player stares at. Three coherent stances:

### Option A — Stay Strict (all detail as relief + lighting)

Every LOD2 addition is expressed through the normal, specular, or height-band — never through new albedo gradients. The 6-level Bayer posterize runs unchanged over the whole composite.

- **Visual consequence:** Maximum aesthetic cohesion — the close-up looks like the same game, just *more* of it. Detail reads as richer shading and sharper relief, not new colors. Gas-giant bands, crater rims, ocean glint, lava cracks all still survive because they're high-contrast luminance. Risk: worlds can feel monochromatic up close; subtle atmospheric color (blue sky, red sunset) is hard to express through 6 luminance levels alone.
- **Implementation consequence:** Simplest pipeline. No second pass, no bypass channels. Everything funnels through the existing `posterize(finalColor, 6.0, ...)`. The discipline is purely "don't add color noise." Lowest risk, lowest new surface area.
- **Best if:** the retro identity is sacred and you'd rather under-deliver richness than dilute the look.

### Option B — Relax the Envelope at LOD2 (richer color/clouds up close)

At LOD2, raise the quantization level count (e.g. 6 → 12–16) or switch to per-type palette-LUTs, and allow genuine albedo detail (cloud color, biome tints, atmospheric scattering color).

- **Visual consequence:** The richest "real world" feel — true blue skies, red terminators, colored cloud layers, biome variety. But the retro identity **softens exactly at the moment of closest inspection**, which can read as "the art style broke" rather than "I got close." The transition from a posterized mid-distance view to a near-smooth close-up can itself feel like a rendering bug if not deliberately art-directed.
- **Implementation consequence:** Most complex. The `lodRamp` must also drive the quantization level count (`mix(6.0, 14.0, lodRamp)`) and the dither itself needs upgrading (plain Bayer at 14 levels shows grid structure — needs the IGN/triangular-PDF upgrade). Palette-LUTs touch all 18+5 types as an art pass.
- **Best if:** the retro look is a *stylistic flavor* rather than the core identity, and "real world feel" wins ties.

### Option C — Hybrid (strict relief + targeted bypass channels) — *the research's implicit default*

Hold the 6-level posterize for the surface, but give **emissive and specular highlights their own channel** that bypasses (or uses a higher level count than) the quantizer. Everything structural stays relief-driven; only the few effects that *need* to be crisp glows get to skip the clamp.

- **Visual consequence:** The retro surface identity is fully preserved, but lava cracks pulse with crisp glow, ocean sun-glint stays a sharp star, and atmosphere limb-glow reads cleanly — the three things that look *wrong* when banded. Reads as "retro world with real fire/water/air" rather than either pole. This is the sweet spot the lava and ocean research explicitly recommend ("add the emissive AFTER posterization so the glow doesn't get banded").
- **Implementation consequence:** Moderate. Requires splitting the final composite into `posterize(surface) + emissiveGlow + specGlint` where the latter two either skip `posterize` or run at higher levels. One structural change to the end of the fragment shader, applied once, benefits lava/ocean/atmosphere across all types.
- **Best if:** you want maximal retro cohesion *and* the few high-energy effects (fire, glint, glow) to look right. **This is the lowest-regret default** — but it's still Max's call, because it does mean the close-up is not a *pure* 6-level image.

**Recommendation framing (not a decision):** A and C are both fully compatible with the retro identity; B is the only one that materially changes the look. If unsure, build A first (it's a strict subset of C), then add C's bypass channels only where banding actually looks wrong in an isolated harness. Defer B unless playtesting says the close-up feels too flat.

---

## 3. Per-Dimension Deep Dive

### 3.1 Surface Topology & Terrain Relief

| Technique | GLSL approach (condensed) | Posterize | Cost | Body types | Source |
|---|---|---|---|---|---|
| **Analytic-derivative gradient-noise FBM** | `noised()→vec3(val, dH/dx, dH/dy)`; per octave `a+=amp*n.x; deriv+=amp*n.yz; amp*=0.5; x=M*x*2.0`; build normal from accumulated `deriv` projected to tangent plane. Quintic fade shares value/deriv subexpressions. | survives | low | rocky, ice, lava, terrestrial, ocean | [gradientnoise](https://iquilezles.org/articles/gradientnoise/), [fbm](https://iquilezles.org/articles/fbm/), [morenoise](https://iquilezles.org/articles/morenoise/) |
| **Slope-damped FBM (free erosion)** | `a += b*n.x/(1.0+dot(d,d)); d += n.yz; b*=0.5; p*=2.0`. Steep areas stop accumulating high-freq → smooth ridge faces, detailed flats. ~15 octaves, fully deterministic. | survives | low | rocky, terrestrial, ice | [morenoise](https://iquilezles.org/articles/morenoise/) |
| **Ridged multifractal (Musgrave)** | `signal=offset-abs(noise(p)); signal*=signal*weight; result+=signal*specWeight[i]; weight=clamp(signal*gain,0,1); p*=lacunarity`. `H=1, offset=1, gain=2, lac≈2`. abs() inverts valleys→ridges. | survives | med | rocky, terrestrial, ice, lava | [musgrave.c](https://engineering.purdue.edu/~ebertd/texture/1stEdition/musgrave/musgrave.c), [isaratech](https://docs.isaratech.com/ue4-plugins/noise-library/generators/ridged-multi) |
| **Domain warping** | `q=fbm(p+o1,o2); r=fbm(p+4q+o3,o4); h=fbm(p+4r)`. 3D object-space warp vectors to avoid UV seams. The "authored continents" effect. | survives | med | lava, ocean, gas, ice, terrestrial, exotic | [warp](https://iquilezles.org/articles/warp/) |
| **Impact craters (Voronoi F1 + analytic profile)** | Jittered Voronoi centers; per nearest, `r=dist/craterRadius`; profile = parabolic cavity `(r²-1)` + rim `smoothstep` peak at r≈1 + ejecta `~1/r²`. Real morphology: depth≈D/5, rim≈5%. Blend additively, `exp(-k·r)` weighted. Large craters add central peak + `cos(2π·r·n)` terraces. | survives | med | rocky, ice, exotic | [LPI PDF](https://www.lpi.usra.edu/exploration/education/hsResearch/moon_101/ImpactCratering.pdf), [Britannica](https://www.britannica.com/science/meteorite-crater/The-impact-cratering-process), [davidar](https://davidar.io/post/sim-glsl), [bookofshaders/12](https://thebookofshaders.com/12/) |
| **Voronoi border distance (F2−F1)** | IQ two-pass: pass 1 nearest center, pass 2 over 5×5 `d=dot(0.5*(mr+r), normalize(r-mr))` min → perpendicular edge distance. `ridge=1-smoothstep(0,w,d)` for fault scarps / crater-rim crests; invert for graben. | survives | med | rocky, ice, terrestrial, lava, exotic | [voronoilines](https://iquilezles.org/articles/voronoilines/) |
| **Height-based stratification / HeteroTerrain** | `increment *= current_value` before each octave → highlands rougher, basins smooth. Terracing: `floor(h*N)/N` + softened riser (a *height* posterize, survives the color posterize fine) → mesas/strata. | survives | low | rocky, terrestrial, ice, exotic | [musgrave.c](https://engineering.purdue.edu/~ebertd/texture/1stEdition/musgrave/musgrave.c) |
| **Triplanar detail projection** | Sample noise 3× along object axes, blend `w=pow(abs(normal),4..8)` normalized. Avoids pole pinching for fine micro-relief at LOD2. Whiteout-blend the three gradients for normals. | needs-adaptation | med | rocky, ice, lava, terrestrial, exotic | [ronja](https://www.ronja-tutorials.com/post/010-triplanar-mapping/), [bgolus](https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a) |
| **Stream-power erosion (analytic carve or bake)** | Live: `elevation -= k*pow(flowProxy,0.8)*pow(slope,2)` using analytic `|deriv|` slope + cheap flow proxy — no iteration. True hydraulic needs ping-pong → bake once into a per-body LUT at LOD2 entry. | survives | high | terrestrial, rocky | [davidar](https://davidar.io/post/sim-glsl), [proceduralpixels](https://www.proceduralpixels.com/blog/terrain-hack-fastest-erosion-algorithm-ever) |

**Lead recommendations:** analytic-derivative FBM as the base (exact normals free) → add slope-damped FBM (one-line erosion, biggest realism-per-instruction) → craters via F1 placement + physically-grounded profile → per-type combiner dispatch.

### 3.2 Weather, Atmosphere & Clouds

| Technique | GLSL approach (condensed) | Posterize | Cost | Body types | Source |
|---|---|---|---|---|---|
| **Latitude-banded FBM (gas-giant base)** | Compress `p.y *= 2.5` before FBM → horizontal streaks; `latitude=p.y` indexes a small palette ramp; per-band longitudinal scroll `p.x += time*bandSpeed(lat)` with alternating sign = counter-rotating jets. | survives | low | gas-giant, ice-giant | [Paleologue](https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97), [Whigham](http://johnwhigham.blogspot.com/2011/11/gas-giants.html) |
| **Recursive domain warp** | `q=fbm(p+o); r=fbm(p+4q+o); return fbm(p+4r)`; sample bands at `latitude + warpStrength*warp` (≈2.0). Animate via `q += 0.1*time` on innermost only. Highest-leverage "bands → fluid" trick. | survives | med | gas-giant, ice-giant, terrestrial, exotic | [warp](https://iquilezles.org/articles/warp/), [Paleologue](https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97) |
| **Storm-mask + rotational swirl (GRS)** | Placement: `smoothstep(0.6,0.8,n)` sparse mask. Swirl: per center, `ang=rotStrength*smoothstep(radius,0,d); p=c+rot2D(ang)*(p-c)`. Whigham packs 100–200 storms as cones in a 128² cubemap. Centers from integer-cell hash → deterministic. | survives | med | gas-giant, ice-giant | [Whigham](http://johnwhigham.blogspot.com/2011/11/gas-giants.html), [stroemer.cc *(cert expired — fetch via archive)*](https://stroemer.cc/procedural-generation-gas-giants/) |
| **Curl-noise advected clouds** | `v=(dPsi/dy,-dPsi/dx)` finite-diff of FBM potential; advect `cloudUV = uv - v*time*scale` (backward, deterministic). Divergence-free → clouds curl without pooling. **Use BOUNDED/periodic time** for re-approach stability. | needs-adaptation | med | terrestrial, ocean, gas-giant | [Bridson](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf), [warp](https://iquilezles.org/articles/warp/) |
| **Clouds-as-relief (the key adaptation)** | Add `cloudDensity` to the heightfield before the normal calc so cloud tops self-shade and pick up diffuse/specular. The *lighting* value gets dithered, not the cloud hue → survives. Faint cloud color → flattened. | survives | low | terrestrial, ocean, gas, ice, lava | [Heckel](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/), [Codrops](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/) |
| **Cloud-shell mesh vs in-shader** | Shell: 2nd sphere `radius*1.01–1.03`, `depthWrite:false`, independent rotation → true parallax + cloud drift. In-shader: cheaper, one draw, free cloud shadows. **Rec:** in-shader at LOD1, ramp to thin shell only at LOD2 when parallax is visible. | needs-adaptation | med | terrestrial, ocean, ice | [riptutorial](https://riptutorial.com/three-js/example/28900/creating-a-model-earth), [Hung](https://franky-arkon-digital.medium.com/make-your-own-earth-in-three-js-8b875e281b1e) |
| **Analytic fresnel atmosphere** | `fres = pow(1-max(dot(N,V),0), 2..4)`; `atmoColor = mix(twilight, day, dot(N,sun))`; gate by sun-facing so night limb stays dark. O(1), the cheap default. | survives | low | terrestrial, ocean, ice, gas | [inspirnathan](https://inspirnathan.com/posts/58-shadertoy-tutorial-part-12/), [lettier](https://lettier.github.io/3d-game-shaders-for-beginners/rim-lighting.html), [Zylann](https://github.com/Zylann/godot_atmosphere_shader/blob/master/README.md) |
| **Raymarched scattering (Lague) — LOD2 only** | Ray-sphere the atmo shell; march ~10 view × ~10 sun samples, `density*exp(-h/H)`, Rayleigh (λ⁻⁴) + Mie phase. Bake optical depth to a small LUT for cheap variant. Desktop-only; fresnel is the mobile fallback. | needs-adaptation | high | terrestrial, ocean, ice | [Lague](https://sebastian.itch.io/atmosphere-experiment), [URP-Atmosphere](https://github.com/sinnwrig/URP-Atmosphere) |
| **Terminator cloud shadowing** | Sample `cloudDensity` a 2nd time offset along sun dir (scaled by `1/max(dot(N,sun),eps)`); subtract from ground diffuse. Modulates lighting → survives as darker buckets. | survives | low | terrestrial, ocean, ice | [three.js-journey](https://threejs-journey.com/lessons/earth-shaders), [Heckel](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/) |

**Lead recommendations:** banded FBM + recursive warp + storm-mask is the gas-giant LOD2 stack; clouds-as-relief is the universal posterization adaptation; fresnel atmosphere default with Lague reserved for the single desktop LOD2 body.

### 3.3 Fluid & Flow Simulation

| Technique | GLSL approach (condensed) | Posterize | Cost | Body types | Source |
|---|---|---|---|---|---|
| **Flow-map two-phase advection (universal primitive)** | `phase0=fract(t*rate); phase1=fract(t*rate+0.5)`; `n0=noise(p+flow*phase0); n1=noise(p+flow*phase1)`; `w=2*abs(phase0-0.5); mix(n0,n1,w)`. Detail flows without accumulation buffers, deterministic. Flow dir: lava=`-grad(height)`, gas=curl, ocean=wind+Gerstner. | needs-adaptation | med | lava, gas, ocean, exotic | [IceFall](https://mtnphil.wordpress.com/2012/08/25/water-flow-shader/), [GraphicsRunner](http://graphicsrunner.blogspot.com/2010/08/water-using-flow-maps.html) |
| **Worley F2−F1 cracks + emissive pulse (lava)** | `crackMask = 1-smoothstep(0,w, F2-F1)`; `emiss = crackMask*(0.5+0.5*sin(t*rate + fbm(p)*TAU))*lavaColor`. Add emissive **after** the 6-level posterize. Best posterization survival of any fluid effect (emissive + high contrast). | survives | med | lava, exotic, volcanic rocky | [Gustavson](https://itn-web.it.liu.se/~stegu76/GLSL-cellular/GLSL-cellular-notes.pdf), [glsl-worley](https://github.com/Erkaman/glsl-worley), [LYGIA](https://lygia.xyz/generative/worley) |
| **Animated-fbm lava churn (nimitz-style)** | Rotate+translate each octave by time: `p*=mat2(cos,sin,-sin,cos); p+=t*dir; sum+=amp*noise(p*freq)`. Black-body emissive ramp + normal perturbation. Roiling molten-lake look (no crust). | survives | med | lava, exotic, active rocky | [redblobgames](https://www.redblobgames.com/x/2107-webgl-noise/webgl-noise/webdemo/cellular.html), [Godot lava](https://godotshaders.com/shader/lava-shader/) |
| **Gerstner waves + analytic normals (ocean)** | Sum 3–6 waves; `P=Q*A*D*cos(...) , A*sin(...)`; analytic normal from GPU-Gems partials; `crestFactor=1-Q*WA*sin(...)` drives foam. Runs in fragment shader (no vertex displacement at planet scale). Keep `Q*sum≤1`. | survives | low | ocean, terrestrial seas, exotic seas | [GPU Gems Ch.1](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), [gameidea](https://gameidea.org/2023/12/01/3d-ocean-shader-using-gerstner-waves/), [80.lv](https://80.lv/articles/tutorial-ocean-shader-with-gerstner-waves) |
| **Sun-glint specular + crest foam** | Glint: `pow(max(dot(N,H),0), 200)` on Gerstner normal, modulated by slope-noise → shimmering specks. Foam: `smoothstep(foamThresh,1,crestFactor)` + fbm breakup. Foam before posterize (top band), glint after/bypass (crisp highlight). | survives | low | ocean, seas, ice melt | [Svensson](https://medium.com/dotcrossdot/water-ocean-shader-9173e0977f98), [GPU Gems Ch.1](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models) |
| **Curl-noise flow field** | `vel=(dPsi/dy,-dPsi/dx)` central-diff of fbm potential; advect detail `noise(p - vel*scale)`. 2–3 octaves for multi-scale eddies. ~9 noise taps for 2 octaves + detail. | needs-adaptation | med | gas, exotic, ocean, terrestrial | [Dziewanowski](https://emildziewanowski.com/curl-noise/), [Bridson](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf), [bitangent noise](https://atyuwen.github.io/posts/bitangent-noise/) |
| **Gray-Scott RD (exotic) — bake only** | True RD needs ping-pong → **breaks determinism**. Workaround (1): pre-bake one RD pattern per seed into a tiny tileable LUT (authentic, deterministic). Workaround (2): thresholded warped-noise contours (fake-Turing, fully procedural, approximate). | survives | high | exotic, ice, rare biomes | [Webb](https://jasonwebb.github.io/reaction-diffusion-playground/), [Ghassaei](https://github.com/amandaghassaei/ReactionDiffusionShader), [lejeunerenard](https://github.com/lejeunerenard/reaction-diffusion) |
| **Stam stable-fluids — AVOID for surface** | Real-time WebGL ports exist but need multi-FBO ping-pong (~20–40 Jacobi passes) → not deterministic, screen-space state. Reserve only for a transient cinematic VFX where re-approach consistency doesn't matter. | needs-adaptation | high | gas/lava cinematic only | [Stam](https://pages.cs.wisc.edu/~chaol/data/cs777/stam-stable_fluids.pdf), [fluids-2d](https://github.com/mharrys/fluids-2d), [FluidsGL](https://github.com/rogerlucena/FluidsGL) |

**Lead recommendations:** lava = Worley cracks + emissive bypass; ocean = Gerstner + glint; gas = warped FBM + curl advection via two-phase flow-map; the two-phase blend is the universal "flow without buffers" primitive. Avoid RD/stable-fluids except as bakes.

### 3.4 Detail Synthesis That Survives Posterization

This dimension is the *discipline layer* that the others depend on:

- **Analytic-derivative value noise replaces finite-diff normals** — the foundational swap (Planet.js 217–241, Moon.js 242–244). One eval returns value + gradient. `survives`, `low`. [morenoise](https://iquilezles.org/articles/morenoise/)
- **Derivative-modulated (erosion) FBM** — `a += b*n.x/(1+dot(d,d))`. `survives`, `low`. [morenoise](https://iquilezles.org/articles/morenoise/)
- **Ridged & billow octave variants** — `1-abs(n)` (squared) for crests, `abs(n)` for puffy lobes; dispatch by type uniform. For derivative-correct ridged, flip gradient sign with the fold. `survives`, `low`. [GLSLPlanet](https://github.com/fluffyfreak/GLSLPlanet/blob/master/shaders/noise_lib.glsl), [bookofshaders/13](https://thebookofshaders.com/13/), [Decarpentier](https://www.decarpentier.nl/scape-procedural-basics)
- **Frequency clamping via fwidth + distance octave count** — `oct_w = 1 - smoothstep(0.4,0.8, fwidth(pos)*noiseScale*f)`. Fades sub-pixel octaves to their mean → kills the shimmer that posterize would otherwise amplify into flickering dither blocks. *This one mechanism delivers both anti-aliasing AND the pop-free ramp.* `survives`, `low`. [filtering](https://iquilezles.org/articles/filtering/), [fbmsdf](https://iquilezles.org/articles/fbmsdf/), [gamedev.net](https://www.gamedev.net/forums/topic/673199-desperate-antialiasingfiltering-of-procedural-texture/)
- **Lighting-routed detail** — perturb `N -= strength*(g - dot(g,N)*N)` *before* the diffuse term; reserve albedo changes for large low-frequency masks only. The core survival strategy. `survives`, `low`. [Heckel](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/), [morenoise](https://iquilezles.org/articles/morenoise/)
- **Triangular-PDF / IGN dither upgrade** — replace plain Bayer (visible 4×4 grid) with `ign(p)=fract(52.9829189*fract(0.06711056*p.x+0.00583715*p.y))` offset, or triangular `(bayer(p)-0.5)+(bayer(p+offset)-0.5)`. Texture-free, recovers ~1 bit near steps. `needs-adaptation`, `low`. [Wronski](https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/), [Shadertoy wl3XWs](https://www.shadertoy.com/view/wl3XWs)
- **Tiny per-type palette-LUT** — `idx=floor(t*N)/N` indexing `const vec3 palette[N]` per type (no texture); dither `t` before the index step. Turns the constraint into an art-direction lever. *This is an Option-B-ish move.* `survives`, `low`. [Heckel](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/), [Ditherpunk](https://surma.dev/things/ditherpunk/)

### 3.5 LOD Architecture & Smooth Transition

- **Continuous octave-count ramp** — variable FBM loop, `const int MAX_OCT` bound + runtime `break`, fractional weight on the trailing octave, `octaves = mix(4.0, 9.0, lodRamp)`. The core "real world" lever, posterization-safe. `survives`, `low`. [bookofshaders/13](https://thebookofshaders.com/13/), [fbm](https://iquilezles.org/articles/fbm/)
- **Distance-driven `lodRamp` + hysteresis** — CPU-side per body: `lodRamp = smoothstep(20.0, 6.0, dist/radius)`; hysteresis (enter 18 / exit 22 radii) on the discrete which-body-is-LOD2 flag to stop flicker. One scalar drives everything. `survives`, `low`. [DigitalRune](https://digitalrune.github.io/DigitalRune-Documentation/html/b320aebd-46a0-45d8-8edb-0c717152a56b.htm), [Unity LOD](https://docs.unity3d.com/6000.2/Documentation/Manual/lod/lod-transitions-lod-group.html)
- **Uniform-coherent branch (the `if(lodLevel>=2)` question, answered)** — coherent across fragments → far bodies genuinely skip the block, but the compiler emits both paths (register/occupancy tax on *every* body). **Fix: compile a `#define LOD2` variant, bind only to the closest body.** Never branch the heavy path on per-fragment data (up to ~32× divergence). `survives`, `low`. [Stefek](https://www.peterstefek.me/shader-branch.html), [gamedev.net](https://www.gamedev.net/forums/topic/649458-shader-branching-costs-for-constant-conditions/)
- **fwidth octave budgeting** — (same as 3.4) continuous weight, no divergence. [fbm](https://iquilezles.org/articles/fbm/), [numb3r23](http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/), [shadergif](https://shadergif.com/guides/anti-aliasing-basics/)
- **Discrete cross-fade for structurally-new systems** — for lava flow / weather / ocean that can't ramp octave-by-octave: compute both `farCol` and `nearCol`, `mix(farCol, nearCol, lodRamp)`; animated-layer amplitude `*= lodRamp`. `needs-adaptation`, `med`. [Unity LOD](https://docs.unity3d.com/6000.2/Documentation/Manual/lod/lod-transitions-lod-group.html), [DigitalRune](https://digitalrune.github.io/DigitalRune-Documentation/html/b320aebd-46a0-45d8-8edb-0c717152a56b.htm)
- **Body-local noise space (precision)** — the shader already samples noise on object-local `pos` (not world), sidestepping float32 mantissa loss up close. **Keep detail object-local; never pass `vWorldPos` into `computeHeight`.** This is separate from the ship-scale rebasing problem (PLAN_world-origin-rebasing.md) and unaffected by it. `survives`, `low`. [GPU Gems 3 Ch.1](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu), [davidar](https://davidar.io/post/sim-glsl)

---

## 4. Mapped to Well Dipper's Body Types

Each stack assumes the shared `noised()` core + `lodRamp` + fwidth clamp + lighting-routed detail as the universal base. The column lists the *type-specific combiner additions* at LOD2.

| Type | LOD2 detail stack (on top of analytic-FBM base) |
|---|---|
| **rocky** | Ridged-multifractal mountains + slope-damped erosion + impact craters (F1 placement, analytic bowl/rim/ejecta, complex craters for large D) + Voronoi-border fault scarps. Pure relief → all survives. |
| **ice** | Ridged FBM crestlines + craters + Voronoi-border contraction polygons (cracks via inverted border) + HeteroTerrain banding (snow/rock strata). Optional fresnel atmosphere (thin). |
| **lava** | Domain-warped FBM base + **Worley F2−F1 crust cracks with emissive pulse (bypass posterize)** OR nimitz animated-fbm churn for molten lakes; flow-map two-phase advection downhill (`-grad(height)`). Black-body palette ramp. Emissive is the headline. |
| **ocean** | Gerstner sum-of-3–6 waves (analytic normals, fragment shader) + tight high-exponent **sun-glint specular (bypass/raise levels)** + crest-factor foam + optional curl-noise surface-current hints. Fresnel atmosphere + cloud-shell at LOD2. |
| **terrestrial** | Slope-damped FBM continents + optional baked stream-power erosion (river networks) + clouds-as-relief (in-shader → shell at LOD2) + terminator cloud shadow + fresnel atmosphere (Lague raymarch on desktop LOD2). The richest type. |
| **gas-giant** | Latitude-banded FBM (vertical-stretch) + recursive domain warp + storm-mask/rotational swirl (GRS, hash-placed) + differential-rotation drift. All high-contrast luminance → survives cleanly. No surface relief; detail is band/swirl + palette. |
| **exotic** | Domain-warped FBM stratification + pre-baked Gray-Scott RD LUT *or* thresholded warped-noise fake-Turing + curl-noise swirl + craters/Voronoi as the seed dictates. The "looks grown, not carved" category — the one place a baked LUT earns its keep. |
| **civilized** (Sol-baked / `MaterialBodyShader`) | **Open question (4.2 below).** Baked NASA textures already carry detail and can't gain procedural octaves the same way. Either: no procedural LOD2 (textures suffice), or a thin procedural relief/cloud *overlay* blended by `lodRamp` over the baked albedo. Likely lowest priority. |

Moon types (5) reuse the rocky/ice stacks; the current Moon.js LOD2 already covers `moonType 0/1` (rocky/captured) — the gap is ice/icy and the others getting the same treatment.

---

## 5. Recommended Build Sequence

**Known gap (verified in code):** Planet.js declares `lodLevel` (line 1077) but the fragment shader never reads it — the `perturbNormalFromNoise`/`posterize` calls are LOD-agnostic. Moon.js *does* branch `lodLevel >= 2` (355, 441, 459) but only for `moonType == 0 || moonType == 1`. So Planet has zero LOD2; Moon has partial LOD2.

### Phase 0 — Foundation (do first, unblocks everything) · *low risk*
1. **Build an isolated `planet-lod-lab.html`** harness — a single sphere with the planet fragment shader, a distance slider driving `lodRamp`, and a type dropdown. **Per MEMORY.md's isolated-test-harness rule, this is mandatory before touching production Planet.js.** If a mechanism doesn't work here, the production integration can't save it.
2. **Swap finite-diff normals → analytic-derivative `noised()`** in the lab. This is the single highest-leverage change and the prerequisite for erosion, frequency-clamping, and clean LOD2 normals. Verify the normal looks identical to the old finite-diff version at LOD1 (regression check) before adding anything.

### Phase 1 — Wire the ramp (the actual missing plumbing) · *low risk, quick win*
3. **Add the CPU-side `lodRamp` uniform** (`smoothstep(20.0, 6.0, dist/radius)`) + hysteresis on the which-body flag, in the Planet.js update loop. This is the genuine gap-fill — `lodLevel` exists but is dead.
4. **Variable-octave FBM loop** driven by `mix(4.0, 9.0, lodRamp)` with fractional trailing-octave weight. **Quick win:** this alone makes getting close *feel* like more detail, posterization-safe, no new visual systems.
5. **fwidth octave clamp** — add immediately alongside step 4; without it the new octaves shimmer under Bayer. These two ship together.

### Phase 2 — Per-type relief combiners · *low-med risk*
6. Dispatch ridged-multifractal / slope-damped / billow by the type uniform (rocky/ice/terrestrial). Pure relief, all `survives`. Validate each type in the lab.
7. **Craters** (rocky/ice) — F1 placement + analytic profile. Med risk: the 3D-vs-tangent-space Voronoi decision (open question 6.3). Prototype both in the lab, measure cost on the 5080.

### Phase 3 — Fluid & weather systems (the structurally-new ones) · *med-high risk, harness-gated*
8. **Lava** (Worley cracks + emissive) — this is where the **emissive-bypass channel** (Option C) gets built. Research-risky because it touches the end-of-pipeline composite. Harness first.
9. **Ocean** (Gerstner + glint) — needs the sphere-tangent-frame decision (open question 6.2). Harness first.
10. **Gas-giant** (banded FBM + warp + storm-mask) — mostly self-contained, but storm placement determinism needs verifying on re-approach in the lab.
11. **Atmosphere** — fresnel default everywhere cheap; Lague raymarch desktop-only, harness first (high cost, the optional richest payoff).

### Phase 4 — Exotic & civilized · *defer*
12. Exotic RD-LUT bake pipeline (only if "grown surface" look is wanted). Civilized/Sol LOD2 overlay (lowest priority — baked textures already carry detail).

**Harness-mandatory before production:** every Phase 3 item (lava emissive, ocean glint, gas storms, Lague atmosphere) and the Phase 0 noise swap. **3-cycle cap** (per MEMORY.md) on any mechanism that fails research→implement→test 3× — switch technique rather than death-spiral. The likeliest cap-hit candidates: sphere-tangent-space flow advection (poles), and Lague raymarch perf/banding.

---

## 6. Open Questions for Max (need taste/direction)

1. **The Section-2 envelope decision (A / B / C).** Everything downstream keys off this. My read: build A, add C's emissive/glint bypass only where banding looks wrong in the harness, defer B. But the "how sacred is the retro look up close" call is yours.
2. **Sphere flow-frame.** Curl-noise and Gerstner are derived in a 2D plane; on a sphere you need a consistent tangent frame or 3D-domain noise to advect along, or the poles pinch. Triplanar, lat-long UV, or per-fragment tangent basis? This is the single biggest technical-risk fork for lava/ocean/gas flow — flag it for a dedicated harness spike.
3. **Crater Voronoi: 3D object-space (27 cells, seamless) vs tangent-space 2D (9 cells, cheaper, needs a seamless tangent frame).** Given one-body-at-LOD2 on the 5080 the 27-cell version is probably fine, but the mobile fallback may need the 9-cell path. Want both prototyped, or commit to 3D and accept a reduced-octave mobile tier?
4. **Animation vs. reproducibility — RESOLVED BY MAX (2026-06-05).** The determinism
   constraint binds the **static/structural layer only** (continents, craters, canyons,
   mountains, coastlines — things that wouldn't change over hours/days/years): these MUST
   be a pure deterministic function of position + seed. The **weather layer** (clouds,
   storms, gas-giant flow, lava churn, ocean waves) does **NOT** need to be reproducible
   across visits — Max doesn't care if it looks different on return. This re-opens
   accumulation-buffer sims (stable-fluids, Gray-Scott RD) **for the weather layer only** —
   never for the surface. Caveat to weigh per-effect: FBO-accumulation sims cold-start on
   arrival (boot from blank, ~seconds to develop = "weather loading" feel), whereas
   global-clock-advected position-deterministic noise is always already-running (no cold
   start) at the cost of cross-visit reproducibility Max has said he doesn't need. So the
   time-animated-noise path may still win for weather on UX grounds, not correctness —
   evaluate both in the harness. (Note: the research agents were given universal determinism
   as a hard constraint, so §3.3's RD/stable-fluids dismissal should be re-read through this
   split.)
5. **Posterizer level count target.** Very low N (the current 6) can erase crater rim/ejecta micro-relief unless it's pushed into normals not albedo. Confirm 6 stays, or does LOD2 raise it (Option B territory)? This tunes every profile amplitude.
6. **Single mega-shader + uniform branch vs. two compiled variants.** The variant removes the register/occupancy tax on far bodies but adds a material swap when a body becomes "closest." Needs a real 5080 profile against the 18+5 type matrix to decide — I can't answer this without running it.
7. **LOD2 scope boundary.** Surface relief only, or also clouds/atmosphere/aurora? The current code still uses plain `snoise` for clouds/aurora (Planet.js ~382–385); converting *everything* to `noised()` is more work. Where's the line?
8. **Civilized/Sol bodies.** Procedural LOD2 overlay over baked NASA textures, or leave them texture-only? Likely defer, but confirm.

---

## 7. Sources (deduplicated, all verified in findings)

**Inigo Quilez:** [gradient noise + derivatives](https://iquilezles.org/articles/gradientnoise/) · [fBm](https://iquilezles.org/articles/fbm/) · [value noise derivatives / morenoise](https://iquilezles.org/articles/morenoise/) · [domain warping](https://iquilezles.org/articles/warp/) · [voronoi edge/border distance](https://iquilezles.org/articles/voronoilines/) · [filtering / band-limiting](https://iquilezles.org/articles/filtering/) · [fbm on SDFs](https://iquilezles.org/articles/fbmsdf/)

**Terrain & noise:** [Musgrave reference C](https://engineering.purdue.edu/~ebertd/texture/1stEdition/musgrave/musgrave.c) · [Isaratech ridged-multi](https://docs.isaratech.com/ue4-plugins/noise-library/generators/ridged-multi) · [GLSLPlanet noise_lib](https://github.com/fluffyfreak/GLSLPlanet/blob/master/shaders/noise_lib.glsl) · [Decarpentier Scape basics](https://www.decarpentier.nl/scape-procedural-basics) · [Book of Shaders: FBM](https://thebookofshaders.com/13/) · [Book of Shaders: cellular](https://thebookofshaders.com/12/)

**Craters & erosion:** [LPI impact cratering PDF](https://www.lpi.usra.edu/exploration/education/hsResearch/moon_101/ImpactCratering.pdf) · [Britannica crater process](https://www.britannica.com/science/meteorite-crater/The-impact-cratering-process) · [davidar.io — sim GLSL](https://davidar.io/post/sim-glsl) · [proceduralpixels erosion](https://www.proceduralpixels.com/blog/terrain-hack-fastest-erosion-algorithm-ever)

**Triplanar:** [Ronja triplanar](https://www.ronja-tutorials.com/post/010-triplanar-mapping/) · [Ben Golus triplanar normals](https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a)

**Gas giants & atmosphere:** [Paleologue procedural gas giants](https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97) · [John Whigham gas giants](http://johnwhigham.blogspot.com/2011/11/gas-giants.html) · [stroemer.cc *(cert expired)*](https://stroemer.cc/procedural-generation-gas-giants/) · [inspirnathan fresnel](https://inspirnathan.com/posts/58-shadertoy-tutorial-part-12/) · [lettier rim lighting](https://lettier.github.io/3d-game-shaders-for-beginners/rim-lighting.html) · [Zylann atmosphere shader](https://github.com/Zylann/godot_atmosphere_shader/blob/master/README.md) · [Lague atmosphere experiment](https://sebastian.itch.io/atmosphere-experiment) · [sinnwrig URP-Atmosphere](https://github.com/sinnwrig/URP-Atmosphere) · [three.js-journey earth shaders](https://threejs-journey.com/lessons/earth-shaders)

**Clouds (three.js):** [riptutorial model earth](https://riptutorial.com/three-js/example/28900/creating-a-model-earth) · [Franky Hung earth](https://franky-arkon-digital.medium.com/make-your-own-earth-in-three-js-8b875e281b1e)

**Fluid & flow:** [Bridson curl-noise SIGGRAPH 2007](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph2007-curlnoise.pdf) · [Dziewanowski curl noise](https://emildziewanowski.com/curl-noise/) · [atyuwen bitangent noise](https://atyuwen.github.io/posts/bitangent-noise/) · [IceFall flow-map water](https://mtnphil.wordpress.com/2012/08/25/water-flow-shader/) · [GraphicsRunner flow maps](http://graphicsrunner.blogspot.com/2010/08/water-using-flow-maps.html) · [Gustavson cellular notes](https://itn-web.it.liu.se/~stegu76/GLSL-cellular/GLSL-cellular-notes.pdf) · [Erkaman glsl-worley](https://github.com/Erkaman/glsl-worley) · [LYGIA worley](https://lygia.xyz/generative/worley) · [redblobgames cellular](https://www.redblobgames.com/x/2107-webgl-noise/webgl-noise/webdemo/cellular.html) · [Godot lava shader](https://godotshaders.com/shader/lava-shader/) · [Domain-warped FBM Shadertoy wttXz8](https://www.shadertoy.com/view/wttXz8)

**Ocean:** [GPU Gems Ch.1 water](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models) · [gameidea Gerstner](https://gameidea.org/2023/12/01/3d-ocean-shader-using-gerstner-waves/) · [80.lv Gerstner](https://80.lv/articles/tutorial-ocean-shader-with-gerstner-waves) · [Svensson water/ocean](https://medium.com/dotcrossdot/water-ocean-shader-9173e0977f98)

**Reaction-diffusion & stable fluids:** [Webb RD playground](https://jasonwebb.github.io/reaction-diffusion-playground/) · [Ghassaei RD shader](https://github.com/amandaghassaei/ReactionDiffusionShader) · [lejeunerenard RD](https://github.com/lejeunerenard/reaction-diffusion) · [Stam stable fluids paper](https://pages.cs.wisc.edu/~chaol/data/cs777/stam-stable_fluids.pdf) · [mharrys fluids-2d](https://github.com/mharrys/fluids-2d) · [rogerlucena FluidsGL](https://github.com/rogerlucena/FluidsGL)

**Dithering & posterization:** [Maxime Heckel dithering/retro shading](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/) · [Codrops dithering shader](https://tympanus.net/codrops/2025/06/04/building-a-real-time-dithering-shader/) · [Bart Wronski 2D quantization dithering](https://bartwronski.com/2016/10/30/dithering-part-three-real-world-2d-quantization-dithering/) · [Shadertoy blue-noise vs Bayer wl3XWs](https://www.shadertoy.com/view/wl3XWs) · [Surma Ditherpunk](https://surma.dev/things/ditherpunk/)

**LOD & precision:** [Peter Stefek shader branching](https://www.peterstefek.me/shader-branch.html) · [GameDev.net shader branching costs](https://www.gamedev.net/forums/topic/649458-shader-branching-costs-for-constant-conditions/) · [DigitalRune LOD](https://digitalrune.github.io/DigitalRune-Documentation/html/b320aebd-46a0-45d8-8edb-0c717152a56b.htm) · [Unity LOD transitions](https://docs.unity3d.com/6000.2/Documentation/Manual/lod/lod-transitions-lod-group.html) · [numb3r23 fwidth AA](http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/) · [shadergif AA basics](https://shadergif.com/guides/anti-aliasing-basics/) · [GPU Gems 3 Ch.1 procedural terrain](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu) · [GameDev.net procedural AA](https://www.gamedev.net/forums/topic/673199-desperate-antialiasingfiltering-of-procedural-texture/)

---

**Two integrity flags:** (1) the stroemer.cc gas-giant storm-mask page has an expired TLS cert and was captured only via search snippet — retrieve via archive.org for exact octave/clamp values before implementing. (2) Code line-number claims in the findings were spot-verified against the live Planet.js/Moon.js (lodLevel gap, posterize at 6 levels, finite-diff normals) and hold.

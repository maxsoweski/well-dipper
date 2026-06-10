# Feature Card — F30 Lightning / electrical storms
Domain: Storms · Lab status: ⬜ · Build-seq phase: 4b

## 1. Description (WHAT)

Lightning / electrical storms — flash clusters in convective regions, plus an optional [subtle] sprites variant (transient luminous events above storm tops). Derives from P17 vortex/storm formation (L1b, inventory line 163): shear + convection spin up anticyclones, polar vortices, storm trains, convective plumes — and lightning is the transient electrical signature of those convective plumes. Physical chain: D8 rotation rate (PlanetGenerator.js:659-665) + D5 atmosphere density (computeAtmosphere:140) + zonal shear + interior heat + condensables drive moist convection; charge separation in the updrafts discharges as flashes, so flashes co-locate with storms (F27 great-spot, F28 oval trains, F29 polar vortex) and convective cloud decks. Variability: transient (sub-second flashes inside days-scale storms) inside quasi-permanent (decades) vortices. Real-body examples from the F30 row (line 271): Jupiter (Juno found lightning clustered near the poles, plus high-altitude "shallow lightning"), Saturn (Cassini imaged ~300 km flashes on the night side), Earth (ISS night-side cloud-illumination flashes). WD types: gas, sub-neptune, terrestrial, ocean; the gas-giant archetype build list (line 366) names F30 in its band/storm world set. Status in inventory: [aspirational].

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No F30/lightning hit anywhere in planet-archetypes.js or planet-lod-lab.html (grep confirms zero matches), and the FEATURES registry (planet-archetypes.js:6-22) currently covers only solid-surface domains (craters through rivers) — no Storms-domain entries exist yet, and no gas-giant archetype/preset exists in the lab. Nearest existing machinery it should plug into: the ★ EMISSIVE bypass channel after the posterize(surface) split (planet-lod-lab.html:1572-1597), where lavaCrackEmissive (:1129) and the aurora night-side ring (:1589-1595, nightMask = smoothstep(0.1,-0.1,diff), uTime-animated noised() rays) already demonstrate exactly the pattern lightning needs — Lambert-independent transient glow that skips the quantizer; the Stage-8 cloud FBM (:1560-1564, fbmd drifting on uTime) supplies the convective mask to weight flash probability; uTime (:170, driven at :2687) is the animation clock. Production-side, deterministic gas-giant storms.spots are already generated at src/generation/PlanetGenerator.js:587-649 (unwired, per the F28 row) — the natural flash-cluster anchor points once Storms-domain features land in the lab.

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA12576
  — Cassini's Saturn lightning movie — each flash is a ~300 km sub-second diffuse glow lighting a night-side cloud from within, a soft blob, never a visible bolt at planetary distance.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA25020
  — Juno view of a vortex near Jupiter's north pole with the glow of a lightning bolt — note the flash sits INSIDE the swirl of a convective storm, tying F30 spatially to F27-F29 storm features.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA22474
  — Juno lightning-distribution concept — Jupiter's flashes cluster near the poles (opposite of Earth's equatorial ITCZ clustering), so the convective-mask placement should differ per archetype.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA23983
  — Juno 'shallow lightning' illustration — high-altitude flashes detected on Jupiter's dark side; reinforces that lightning is fundamentally a night-side/terminator read.
- [real] https://earthobservatory.nasa.gov/images/150456/light-show-near-the-limb
  — ISS night-side Earth: a lightning flash illuminating a large cloud mass from inside — the brightest point in frame is an area glow on cloud tops, the exact form target at orbit scale.
- [real] https://www.nasa.gov/image-article/a-midsummer-red-sprite-seen-from-space/
  — Red sprite above a thunderstorm photographed from the ISS — the [subtle] sprites variant: a tiny, brief red filamentary tick well ABOVE the flash, best read near the limb.
- [art] https://www.artstation.com/artwork/PmLGDo
  — Brandon Garman's stylized storm-cloud VFX (Unity) — the flash is staged as an interior illumination pulse of the cloud volume, not a drawn bolt; the read survives heavy stylization.
- [art] https://frostwindz.itch.io/pixel-art-skill-animations-lightning
  — Pixel-art lightning VFX — few-frame attack/decay timing with hard-edged brightness pops; good timing reference for how a flash should feel inside a quantized palette.

## 4. Math / modeling notes (HOW, from the field)

Academia models bolt GEOMETRY with the dielectric breakdown model (DBM/Lichtenberg fractal growth — Reed & Wyvill's structured-random fractal bolts; Kim & Lin's adaptive-mesh DBM for animation), and games approximate it with midpoint-displacement/L-system jitter on a segment plus bloom, or sprite/particle flashes (Minions Art shader breakdown, Defold lightning tutorial, distance-field flash textures). But the real references (Cassini PIA12576, ISS night photography) show that at the lab's viewing distances (dist/radius 1.1-30) lightning never reads as a bolt — it reads as a sub-second diffuse glow blob illuminating cloud tops from within. So the right model is a spatio-temporal point process, not fractal geometry: hash a sparse cell grid on the sphere (the existing hash/noised() core from the research doc), weight each cell's firing probability by a convective mask (Stage-8 cloud FBM density × proximity to storms.spots / the F27 vortex / an ITCZ latitude band per archetype — polar-weighted for gas per PIA22474, equatorial for terrestrial), and gate each cell by a hashed time window of uTime with a sharp-attack/exponential-decay envelope. Critically this stays deterministic-from-position+time — the research doc's hard constraint (no ping-pong accumulation buffers; re-approach must show the same state for a given seed+t). In the retro envelope, lightning is a near-perfect posterization-survivor by the doc's own criterion ("emissive + high contrast"): it belongs in the ★ emissive-bypass channel exactly like lavaCrackEmissive and aurora, so the pop stays crisp instead of banding. Most promising shader-side approach: a lightningFlash(pos, uTime) term added after the posterize(surface) split — per hashed cell, fire when fract(uTime·rate + hash(cell)) < flashDuration, intensity = Gaussian spatial falloff × convectiveMask × (1 + nightMask boost), summed into the ★ emissive channel; optional sprites variant = a second, dimmer red term offset above the cloud layer, limb-gated, at ~1/20 the firing rate.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. Register in planet-archetypes.js FEATURES as `lightning: { label: 'Lightning (F30)', enableKey: 'lightningEnabled', archetypes: [...] }` — membership should include the future gas-giant archetype plus 'tectonic-terrestrial' (terrestrial/ocean WD types); until a gas preset exists, test on Rocky (Earthlike) or Ocean (temperate). Steps on the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md — launch with --remote-debugging-port=9223): (1) open planet-lod-lab.html; (2) `window._lab.setPreset('Rocky (Earthlike)')` (or the gas preset once built — that's the headline archetype); (3) `window._lab.solo('lightning')` (auto-built 🔆 solo button comes free from the FEATURES registry, planet-lod-lab.html:2561-2563); (4) rotate the night side toward camera (adjust `window._lab.state.yaw`) since flashes live in the ★ emissive channel and read strongest in darkness — same verification posture as aurora; (5) judge at `window._lab.state.distance = 8` (global: do flash clusters sit in convective regions?) then `= 2.5` (LOD2: individual flash blobs, timing envelope); (6) sample several seconds of wall-clock uTime — this is a temporal feature, a single screenshot can't verify it; capture 3-4 frames a second apart and confirm flashes appear/decay between them.

## 6. What to judge (UAT checklist)

- [ ] Does each flash read as a brief area glow lighting a cloud region from within — a soft blob, never a drawn bolt shape — in the 6-level posterized envelope?
- [ ] Do flashes cluster in convective regions (near storm spots / vortex heads / the wet latitude band), rather than scattering uniformly over the sphere?
- [ ] Does the temporal envelope read as lightning — sharp sub-second attack, fast decay, asynchronous Poisson-like timing across clusters with no metronome rhythm?
- [ ] Does it read night-side-first: crisp emissive pops in darkness/twilight (via the ★ bypass channel, like aurora) that wash out and yield to the surface on the lit side?
- [ ] Is the spatial scale right — flashes small relative to their parent storm (Saturn's are ~300 km on a 120,000 km planet), reading as points-to-blobs, never hemisphere-wide strobes?
- [ ] Does the bypass-channel glow stay crisp over the posterized cloud deck instead of banding — i.e., does it behave as the canonical Option-C emissive survivor?
- [ ] Is the pattern deterministic on re-approach — same seed + same uTime gives the same flash field (no stateful-buffer drift)?
- [ ] If the [subtle] sprites variant is enabled: does it read as a barely-there red tick ABOVE a flash near the limb — noticed only when looked for, never competing with the flashes themselves?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open

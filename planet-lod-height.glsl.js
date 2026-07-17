// planet-lod-height.glsl.js — SINGLE SOURCE of the planet height-field GLSL.
// AC1 (rivers-dendritic-drainage): extracted verbatim from planet-lod-lab.html
// (the function library L194-L3071, ending right before `void main()`).
// Consumed by BOTH the lab planet shader and the river router so there is one h(pos).
// Each consumer supplies its own main(): the lab does lighting; the router omits the
// F11 fluvialCombiner call, sets fwBase=0, and outputs vec4(h, grad). Edit HERE, not copies.
export const HEIGHT_GLSL = /* glsl */ `
      precision highp float;
      varying vec3 vPos;
      varying vec3 vObjN;
      varying float vSubstellarAngle;   // canonical shared varying (index §1) — see vertex shader

      uniform float uNoiseScale;
      uniform float uOctaves;       // effective octave count
      uniform float uLodRamp;       // 0 (far) .. 1 (closest) — one scalar drives all complexity
      uniform float uLevels;        // posterize levels
      uniform float uPerturb;       // relief strength
      uniform int   uNormalMode;    // 0 = analytic, 1 = finite-diff (production)
      uniform int   uFwClamp;       // 1 = fwidth octave clamp on
      uniform int   uDitherMode;    // 0 = Bayer, 1 = IGN
      uniform float uEmissive;      // emissive glow strength
      uniform float uSpecStrength;  // F36 sunglint strength (driven: liquid master gate, species + Cox-Munk dim folded at the per-frame writer)
      uniform float uLimbStrength;  // limb/atmosphere rim glow
      uniform int   uEmissiveBypass;
      uniform int   uSpecBypass;
      uniform int   uLimbBypass;
      // ── F34 limb glow (card F34 — driver-true rim) ──
      uniform vec3  uLimbColor;     // F34 rim tint (driven: per-preset atmosphere hue; pre-F34 the rim reused uBaseColor)
      uniform float uLimbExponent;  // F34 fresnel width (driven: ~3.5 thin clear blue line, ~1.8 thick-haze halo; always > 0)
      // ── F35 terminator color gradient (card F35 — the F34 rim's twilight half) ──
      uniform vec3  uTermColor;     // F35 band tint (driven: per-preset hue map — warm n2-o2, broad orange Venus, cooler cold-haze)
      uniform float uTermStrength;  // F35 band strength (driven: ~0.5 retained atmosphere, 0 airless — the master gate)
      uniform float uTermWidth;     // F35 gaussian half-width in mu (driven: D5 pressure log ramp 0.06..0.30; floored in-shader)
      uniform int   uTermBypass;    // 1 = band skips the quantizer (smooth twilight)
      // ── F36 sunglint (card F36 — liquid-only mirror glint) ──
      uniform vec3  uGlintTint;     // F36 species tint (driven: water cold-white / methane warm tholin)
      uniform float uGlintExp;      // F36 Blinn-Phong exponent (driven: species base 200 water / 120 methane, x Cox-Munk roughness broadening at the writer; floored in-shader)
      uniform float uCloudCoverage;   // 0..1 weather-layer density (Task 7)
      // ── F37 aurorae (card F37 — driver-true night-side magnetic ovals) ──
      uniform float uAuroraIntensity; // 0..1 ring strength (driven: core field x atmosphere, hard-gated field > 0.05; Venus regime-3 override 0)
      uniform vec3  uAuroraColor;     // F37 emission color (driven: D4 composition map — n2-o2 green / h2-he blue-purple / co2 pink / methane teal)
      uniform float uAuroraRingLat;   // F37 oval magnetic latitude (driven: 0.7 + field x 0.2 — stronger dynamo hugs the pole)
      uniform float uAuroraRingWidth; // F37 oval gaussian half-width (driven: 0.15 - field x 0.08, floored CPU-side AND in-shader)
      uniform vec3  uMagAxis;         // F37 magnetic dipole axis, unit (driven: spin axis tilted ~11 deg, azimuth hashed from macroSeed)
      // ── F38 airglow (card F38 — thin uniform night-limb photochemical shell) ──
      uniform float uAirglowIntensity; // 0..1 band strength (driven: ATMOSPHERE density gate, 0 airless — aurora's non-magnetic sibling, no field gate)
      uniform vec3  uAirglowColor;     // F38 emission color (airglow-green OI 557.7 nm — uniform, NO composition lookup unlike aurora)
      // ── F39 cloud optics (card F39 — antisolar backscatter glory on the LIT cloud deck) ──
      uniform float uCloudOpticsIntensity; // 0..1 glory strength (driven: cloudsEnabled × cloudCoverage presence; 0 cloudless ⇒ cloudOpticsC vec3(0) exactly)
      uniform float uGloryRadius;          // F39 stylized-large angular radius of the ring stack (rad); rings quantized against this, zero beyond. Inflated far past the sub-degree real glory so the bands read at planet distance.
      // F46 bioluminescent mats
      uniform float uBioCoverage;
      uniform vec3  uBioColor;
      uniform float uBioScale;
      uniform float uBioIntensity;
      // F47 machine / structured surface (Stage-7 EXOTIC overlay, dual-channel)
      uniform float uMachCoverage;      // maturity/coverage driver: lowers FBM threshold (scattered→full grid); 0 = bare base, gates the whole combiner + composite + glow
      uniform float uMachDistrictScale; // low-freq district grid frequency
      uniform float uMachBlockScale;    // high-freq block grid frequency (scale-hierarchy 2nd tier)
      uniform float uMachSeamWidth;     // grid-line / panel-seam half-width (border-distance threshold)
      uniform float uMachBevel;         // bevel amount fed onto grad (normal-channel driver)
      uniform vec3  uMachMetalColor;    // near-flat dark-metal plate albedo
      uniform vec3  uMachGlowColor;     // circuit-trace / window emissive color
      uniform float uMachGlowIntensity; // trace+window glow brightness (emissive-bypass)
      uniform float uMachWindowDensity; // per-cell-hash fraction of lit cells
      uniform float uCityMaturity;       // F48 master gate — P28 build-out (0 specks → 1 coastal bands); 0 ⇒ cityC vec3(0) exactly
      uniform float uCityIntensity;      // F48 warm glow brightness (emissive-bypass)
      uniform float uCityScale;          // F48 settlement noise frequency (cluster density)
      uniform float uCityCoastBoost;     // F48 coast-hugging brightness multiplier
      uniform vec3  uCityColor;          // F48 warm sodium-amber night-city color
      uniform float uEcuCoverage;        // F49 master gate — P28 SATURATION (0 ⇒ bare Stage-6 base; HIGH default planet-covering)
      uniform vec3  uEcuConcreteColor;   // F49 flat concrete/steel day-albedo target (crossfaded pre-posterize)
      uniform vec3  uEcuGlowColor;       // F49 warm-sodium whole-surface night glow color
      uniform float uEcuGlowIntensity;   // F49 night-glow brightness (emissive-bypass)
      uniform float uEcuDistrictScale;   // F49 low-freq district/coverage frequency
      uniform float uEcuBlockScale;      // F49 high-freq block/canyon frequency (lodRamp-ramped)
      uniform float uEcuCanyonDepth;     // F49 street-canyon relief depth banked onto grad
      uniform float uEcuSeamWidth;       // F49 Voronoi-border canyon half-width (F2−F1 threshold)
      uniform float uEcuWarpAmt;         // F49 domain-warp amount (bends the block network organic)
      uniform float uTime;            // animation clock (clouds drift, aurora rays)
      uniform vec3  uLightDir;      // object-space light dir
      uniform vec3  uBaseColor;
      uniform vec3  uMacroOffset;   // macro seed -> noise-domain offset (octaves 0..2)
      uniform vec3  uDetailOffset;  // detail seed -> noise-domain offset (octaves 3+)
      // ── voronoi3d spike debug (index §5 risk #1 seam gate) ──
      uniform int   uDebugMode;     // 0 off, 1 F1, 2 F2-F1 border, 3 cell-id color, 4 voronoi relief
      uniform float uVoroScale;     // cell density (vPos * scale)
      uniform int   uVoroCells;     // 27 (desktop) | 9 (mobile) — shared cellular knob (qualityTier)

      // ── F2 craters (Stage-C step 3, Relief) — first voronoi3d consumer ──
      uniform float uCraterDensity;    // 0..1 fraction of cells that host a crater (surface age)
      uniform float uCraterComplexD;   // simple→complex transition diameter (g⁻¹, icy-switched)
      uniform float uCraterRelaxation; // 0..1 icy/warm palimpsest flattening
      uniform float uTerraceCount;     // inner-wall terrace ring count
      uniform float uCraterScale;      // crater cell density (vPos * scale)
      uniform float uCraterAmp;        // overall crater relief amplitude
      uniform vec3  uCraterOffset;     // 🎲 domain offset — default (0,0,0) = unchanged

      // ── F3 ejecta & rays (Stage-C step 3, Relief) — wraps the SAME F2 craters ──
      uniform float uEjectaStrength;   // 0..1 apron gate (driven; tracks craterDensity); ≤0 early-outs
      uniform float uEjectaRampart;    // 0=dry skirt ↔ 1=fluidized rampart ridge (driven, D2)
      uniform float uEjectaAmp;        // overall apron relief amplitude (lab-tunable)
      uniform float uEjectaLump;       // 0..1 FBM lumpiness of the apron (lab-tunable)
      uniform float uRayBrightness;    // 0..1 bright-ray albedo gate (driven; airless × young); ≤0 → no rays
      uniform float uRayCount;         // number of radial ray streaks (lab-tunable)
      uniform float uRaySharp;         // ray streak sharpness / pow exponent (lab-tunable)

      // ── F1 mountains / ranges (Stage-C step 3, Relief) — ridged base relief ──
      uniform float uMountainAmp;      // 0..1 ridged-relief amplitude (erosion-softened, driven)
      uniform float uRidgeOffset;      // ~1.0 fold offset (signal = offset − |n|) — lab knob
      uniform float uRidgeGain;        // ~2.0 multifractal weight gain — lab knob
      uniform float uOrogenyStrength;  // 0..1 isotropic ridged ↔ anisotropic fold-belt (driven)
      uniform vec2  uOrogenyAxis;      // per-planet strike direction (unit, from seed/angle)
      uniform float uMountainScale;    // mountain domain frequency (vPos * scale) — lab knob
      uniform vec3  uMountainDomainOffset; // 🎲 domain offset — default (0,0,0) = unchanged

      // ── F4 canyons / rifts (Stage-C step 3, Relief) — tectonic graben → canyonHeight ──
      uniform float uChasmaDepth;      // 0..~0.28 rift relief amplitude (driven; ≤0 early-outs)
      uniform int   uChasmaCount;      // 1..3 number of rifts (driven from seed)
      uniform vec3  uChasmaAxis[3];    // rift great-circle plane normals (unit; driven from seed)
      uniform float uChasmaWidth;      // trench half-width in unit-sphere units — lab knob
      uniform float uChasmaFloor;      // flat-floor fraction of half-width (0..1) — lab knob

      // ── F5 scarps / fault systems (Stage-C step 3, Relief) — warped soft-step cliffs ──
      uniform float uScarpStrength;    // 0..~0.12 fault-scarp relief amplitude (driven; ≤0 early-outs)
      uniform float uScarpStyle;       // 0=thrust(up)↔1=normal(down) cliff polarity (driven)
      uniform vec3  uScarpAxis;        // scarp-front orientation axis (unit; driven from seed)
      uniform float uScarpWidth;       // cliff-face softness (smoothstep half-width, field units) — lab knob
      uniform float uScarpFreq;        // fault-train spatial frequency (parallel scarp count) — lab knob
      uniform float uScarpWarp;        // sinuosity: warp amount of the scarp fronts — lab knob
      uniform float uScarpWarpFreq;    // warp-noise domain frequency — lab knob
      uniform vec3  uScarpDomainOffset; // 🎲 domain offset — default (0,0,0) = unchanged

      // ── WS4 E6 tectonic grain (shared strike field) — the ONE orientation source the grained
      // combiners read instead of each hashing an independent axis. uTectonicGrainStrength is the
      // gate: 0 ⇒ every grained combiner runs its pre-WS4 normalize(uXxxAxis) instruction VERBATIM
      // (BRANCH-guarded, never a mix-to-0 — so a null/unbaked cube is never sampled at the fallback;
      // see D6: a mix() would still execute the textureCube fetch and a null samplerCube can yield NaN).
      // The cube (T7/T8) stores the smooth WORLD-space strike in RG (.b grainMag, .a regime/province).
      // sampleGrainStrike unpacks RG → a unit strike vec3 in the planet's tangent space at dir; the
      // in-shader province rotation that turns the latitude-banded base strike into 2D landforms is
      // composed in each combiner against the REAL gProvince (T13), NOT here.
      uniform float       uTectonicGrainStrength;  // 0 = grain OFF (byte-identical fallback gate)
      uniform samplerCube uTectonicGrainCube;      // baked strike-only cube (RG = world strike.xy)
      // ── AC2 baked relief (WS world-engine) — parallel HEIGHT channel to the grain cube above.
      // Same byte-identical contract: at strength 0 the renderer NEVER fetches uReliefBakeCube
      // (the height source stays the verbatim pre-AC2 fbmd line — see the if/else in lab main()).
      uniform float       uReliefBakeStrength;      // 0 = baked relief OFF (byte-identical fallback gate)
      uniform samplerCube uReliefBakeCube;          // baked low-freq height cube (R=height, GBA=gradient)
      vec4 sampleBakedRelief(vec3 dir){ return textureCube(uReliefBakeCube, normalize(dir)); } // .x=height, .yzw=grad
      vec3 sampleGrainStrike(vec3 dir){
        vec3 d = normalize(dir);
        vec2 g = textureCube(uTectonicGrainCube, d).rg;          // packed world strike (xy dominant)
        // The cube packs two dominant world components; recover the third on the unit sphere so the
        // strike stays a real direction even where the third component is non-trivial. Fall back to
        // the dir-tangent if the packed vector is degenerate (unbaked/black cube → length 0).
        float z2 = max(0.0, 1.0 - dot(g, g));
        vec3 strike = vec3(g, sqrt(z2));
        float len = length(strike);
        if (len < 1e-4) {
          // degenerate (black/unbaked cube): pick any tangent so a stray sample is still a unit dir.
          vec3 ref = abs(d.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          return normalize(cross(d, ref));
        }
        return strike / len;
      }

      // ── F6 plateaus / highlands (Stage-C step 3, Relief) — HeteroTerrain + mesa terrace ──
      uniform float uPlateauStrength;  // 0..~0.2 flat-topped highland amplitude (driven; ≤0 early-outs)
      uniform float uPlateauScale;     // HeteroTerrain domain frequency — lab knob
      uniform float uPlateauOffset;    // HeteroTerrain ground-level offset (stratification bias) — lab knob
      uniform float uPlateauLevels;    // mesa terrace count — lab knob
      uniform float uPlateauSoftness;  // terrace riser softness (0..1) — lab knob
      uniform vec3  uPlateauDomainOffset; // 🎲 domain offset — default (0,0,0) = unchanged

      // ── F6 tessera (Stage-C step 3, Relief) — crosscutting ridge-and-groove lattice ──
      uniform float uTesseraStrength;  // 0..~0.15 lattice amplitude (high-stress gate; ≤0 early-outs)
      uniform vec3  uTesseraAxis[2];   // 2 lattice orientations (unit; driven from seed)
      uniform float uTesseraFreq;      // groove-train spatial frequency (lattice density) — lab knob
      uniform float uTesseraWarp;      // groove-line sinuosity (warp amount) — lab knob
      uniform float uTesseraWarpFreq;  // warp-noise domain frequency — lab knob
      uniform vec3  uTesseraDomainOffset; // 🎲 domain offset — default (0,0,0) = unchanged

      // ── F7 volcanic edifices (Stage-C step 3, Relief) — shield/strato cones + caldera ──
      uniform float uVolcanismStrength; // 0..1 edifice density gate (driven; ≤0 early-outs)
      uniform float uEdificeMaxHeight;  // edifice height scale ∝ 1/g (driven, 0.2..2.0)
      uniform float uShieldStratoMix;   // 0=effusive shield ↔ 1=explosive strato (driven, viscosity)
      uniform float uEdificeScale;      // edifice cell density (vPos * scale) — lab knob (sparser than craters)
      uniform float uEdificeAmp;        // overall edifice relief amplitude — lab knob
      uniform float uEdificeCaldera;    // summit caldera radius fraction (0..1) — lab knob
      uniform vec3  uEdificeOffset;     // 🎲 domain offset — default (0,0,0) = unchanged
      // ── F8 lava plains & flows (Stage-C step 3, Relief) ──
      uniform float uLavaCoverage;      // 0..1 flood-basalt resurfacing fraction (driven; ≤0 early-outs) — SMOOTHS relief
      uniform float uLavaActivity;      // 0..1 emissive-crack glow intensity (driven, D12 tidal; ≤0 ⇒ cracks dark)
      uniform vec3  uLavaAxis;          // wrinkle-ridge strike direction (driven, seed-derived unit vec3)
      uniform float uLavaScale;         // flow-region noise scale — lab knob
      uniform vec3  uLavaOffset;        // 🎲 domain offset — default (0,0,0) = unchanged
      uniform float uWrinkleAmp;        // wrinkle-ridge relief amplitude on the plain — lab knob
      uniform float uWrinkleFreq;       // wrinkle-ridge spatial frequency — lab knob
      uniform float uWrinkleWarp;       // wrinkle-ridge sinuosity (domain warp) — lab knob
      uniform float uCrackScale;        // emissive-crack Voronoi cell density — lab knob
      uniform float uCrackWidth;        // emissive-crack mask width (F2−F1 threshold) — lab knob
      uniform float uLavaGlowRate;      // emissive-crack pulse rate (× uTime) — lab knob
      // ── Shared seam (registry §1): uCryoActivity — owner Cryo (D2/D12→P7); read by Relief F9/F10.
      //    RESERVED at 0.0 until Cryo lands; under option A a lab knob drives it so F9/F10 are exercisable. ──
      uniform float uCryoActivity;      // 0..1 icy-shell disruption — the F9/F10 master gate (≤0 ⇒ both early-out)
      // ── Stage-D provinces (LIVE 2026-06-10, workstream stage-d-provinces-2026-06-10) ──
      //    uProvinceWeight is now the GLOBAL INFLUENCE DIAL over the spatial weight fields:
      //    0 ⇒ legacy uniform look (regression escape hatch), 1 ⇒ full provinces (default).
      //    Every combiner multiplies by provinceWeight(FEATURE_ID) — see the accessor block
      //    above mountainCombiner. Still a multiplier, NOT a gate (registry §1 semantics). ──
      uniform float uProvinceWeight;    // 0..1 province influence dial (1 = full spatial weighting)
      // ── F9 chaos / disrupted terrain (Stage-C step 3, Relief) ──
      uniform float uChaosCellScale;    // raft size (voronoi3d frequency; driven)
      uniform float uChaosRaftJitter;   // raft height/tilt displacement (driven, ∝ 1/g)
      uniform float uChaosMatrixRough;  // refrozen inter-raft matrix roughness (driven)
      uniform float uChaosMaskScale;    // low-freq chaos-region mask scale — lab knob
      uniform vec3  uChaosOffset;       // 🎲 domain offset — default (0,0,0) = unchanged
      // ── F10 ridged / grooved icy terrain (Stage-C step 3, Relief) ──
      uniform float uDoubleRidgeFreq;   // double-ridge line frequency (driven)
      uniform float uCryoRidgeOffset;   // double-ridge flank position → doubleRidgeProfile (driven; ≠ F1 uRidgeOffset)
      uniform float uCryoRidgeWidth;    // double-ridge crest sharpness → doubleRidgeProfile (driven)
      uniform float uGroovedBandFreq;   // fine grooved-band ridge frequency (driven, Ganymede)
      uniform float uCryoRidgeAmp;      // overall icy-ridge relief amplitude — lab knob
      uniform float uCryoRidgeWarp;     // ridge-line sinuosity (domain warp) — lab knob
      uniform vec3  uCryoRidgeAxis0;    // double-ridge line direction (driven, seed-derived unit vec3)
      uniform vec3  uCryoRidgeAxis1;    // grooved-band direction (driven, seed-derived unit vec3)
      uniform vec3  uCryoRidgeOffsetV;  // 🎲 domain offset — default (0,0,0) = unchanged
      // ── Cryo step 2: frost-coverage mask (F23/F22) — coverage test, NOT relief (albedo overlay) ──
      uniform float uFrostMaxCoverage;  // 0..1 frost BUDGET (driven, D2 volatileFraction); ≤0 ⇒ early-out
      uniform float uFrostCondensationT;// per-species freeze point K (driven); 0=bone-dry no-frost; localT<this ⇒ frost
      uniform float uFrostLatitudeBias; // 0..1 axial-tilt low-latitude spread (driven, D3)
      uniform vec3  uFrostAlbedo;       // frost tint (driven by species; luminance load-bearing, colour stylized)
      uniform float uPlanetTempEq;      // T_eq (driven) — the localT baseline
      uniform int   uFrostLocked;       // 1 ⇒ tidally-locked eyeball cap (antistellar via vSubstellarAngle)
      uniform float uFrostLatChill;     // equator→pole temperature falloff fraction — lab knob
      uniform float uFrostLapseRate;    // altitude snowline weight (frost climbs mountains) — lab knob
      uniform float uFrostEdgeSoftness; // sharp↔diffuse snowline (× T_eq = band width in K) — lab knob
      uniform float uFrostNoiseAmp;     // fractal boundary breakup amplitude (× T_eq, K) — lab knob
      uniform float uFrostNoiseScale;   // boundary-breakup noise frequency — lab knob
      uniform vec3  uFrostOffset;       // 🎲 domain offset — default (0,0,0) = unchanged
      // ── Cryo step 3: F22 polar-layered-deposit strata (cap banding — ALBEDO, not relief) ──
      uniform float uPldStrength;       // 0..~0.35 dark-band luminance dip (driven; cap budget × surface-age); ≤0 ⇒ no banding
      uniform float uPldLevels;         // number of annular strata bands (driven constant; lab-tunable)
      uniform float uPldSoftness;       // riser softness between layers (sharp↔soft band edge) — lab knob

      // ── Cryo step 4: F18 sublimation landscapes — RELIEF, morphology SWITCHED on volatileSpecies ──
      uniform float uSubStrength;       // 0..1 sublimation-relief gate (driven; ≤0 ⇒ early-out)
      uniform int   uVolatileSpecies;   // 0=none 1=H₂O 2=CO₂ 3=CH₄ 4=N₂ — the morphology switch (driven)
      uniform float uSubAmp;            // sublimation relief amplitude (relief units) — lab knob
      uniform float uSubPitScale;       // swiss-cheese / hollow pit voronoi3d frequency — lab knob
      uniform float uSubPolyScale;      // N₂ convection-polygon cell frequency — lab knob
      uniform float uSubFloorFrac;      // flat-floor fraction of the pit radius (radial graben) — lab knob
      uniform float uSubPitDensity;     // fraction of cells hosting a pit — lab knob
      uniform float uBladeFreq;         // CH₄ penitente blade frequency (anisotropic, sun-aligned) — lab knob
      uniform float uBladeSharp;        // CH₄ penitente blade sharpness (pow exponent) — lab knob
      uniform float uSubColdGate;       // cold-cap confinement edge softness (× T_eq = K band on localT<condensationT) — lab knob
      uniform vec3  uSubOffset;         // 🎲 domain offset — default (0,0,0) = unchanged

      // ── Cryo step 5: F17 glacial relief — slope-damped ice mantle + flow-aligned lineations ──
      uniform float uGlacialStrength;   // 0..1 glacial-relief gate (driven; budget, ≤0 ⇒ early-out)
      uniform float uGlacialFlowVigor;  // 0..1 flow-lineation amplitude scale ∝ 1/g (driven)
      uniform float uGlacialAmp;        // ice-mantle height amplitude (relief units) — lab knob
      uniform float uGlacialScale;      // ice-mantle slope-damped FBM frequency — lab knob
      uniform float uGlacialSlopeDamp;  // slope-damping strength (higher ⇒ smoother on steeps) — lab knob
      uniform float uGlacialBasinThresh;// surface-slope above which ice flows off (low-slope basin gate) — lab knob
      uniform float uLineationAmp;      // moraine/esker lineation amplitude — lab knob
      uniform float uLineationFreq;     // lineation ridge spacing (flow-aligned) — lab knob
      uniform float uLineationWarp;     // lineation directional-field warp — lab knob
      uniform float uLineationWarpFreq; // lineation warp frequency — lab knob
      uniform float uGlacialColdGate;   // cold-cap confinement edge softness (× T_eq, like uSubColdGate) — lab knob
      uniform vec3  uGlacialOffset;     // 🎲 domain offset — default (0,0,0) = unchanged

      // ── F11 fluvial drainage (Stage-4, Fluvial domain) ──
      uniform float uFluvialActivity;  // 0=relict/degraded … 1=sharp/active
      uniform float uFluvialDensity;   // network strength + master gate; ≤0 → early-out
      uniform float uFluvialDepth;     // channel carve depth (relief units)
      uniform float uFluvialMeander;   // domain-warp amount (sinuosity)
      uniform float uFluvialWidth;     // channel band half-width (shape knob)
      uniform float uFluvialFreq;      // trunk-network frequency (shape knob)
      uniform float uFluvialWarpAmt;   // warp displacement scale (shape knob)
      uniform float uFluvialWarpFreq;  // warp-noise frequency (shape knob)
      uniform float uFluvialTribLac;   // tributary lacunarity (shape knob)
      uniform float uFluvialTribGate;  // tributary apron half-width vs trunk (shape knob)
      uniform float uFluvialLowBias;   // 0=channels everywhere … 1=low-ground only
      uniform float uFluvialHiGround;  // height above which channels fade (with LowBias)
      uniform vec3  uFluvialOffset;    // 🎲 domain offset — default (0,0,0) = unchanged
      uniform int   uLiquidSpecies;    // 0=water 1=methane/ethane (first GLSL consumer = F11 floor-tint)
      // ── F14 lakes & seas (Fluvial step 4a — fluvial doc / card F14) ──
      uniform float uSeaLevel;         // standing-liquid level-set threshold on accumulated h; <= -1 ⇒ no liquid (early-out)
      // ── F12 deltas & alluvial fans (Fluvial step 4a — card F12) ──
      uniform float uDeltaDensity;     // 0..1 deposition gate (driven: fluvialDensity × activity); <= 0 ⇒ early-out
      uniform float uDeltaAmp;         // apron height amplitude — lab knob
      uniform float uDeltaApronH;      // apron band height above base level — lab knob
      // ── F20 coastlines (Gradational step 4a — card F20) ──
      uniform float uCoastStrength;    // 0..1 master gate (driven: 1 when a sea exists); <= 0 ⇒ early-out
      uniform float uBeachWidth;       // beach band width in shore-distance units — lab knob
      uniform float uCoastCliffSlope;  // |grad| above which the shore reads as cliff — lab knob
      uniform float uTerraceStep;      // strandline spacing in shore-distance units — lab knob
      uniform float uStrandStrength;   // 0..1 paleo-strandline visibility (driven: erosion history)
      // ── F13 outflow / megaflood channels (Fluvial step 4a — card F13) ──
      uniform float uOutflowDensity;   // 0..1 master gate (driven: fluvial history, erosion-thresholded); <= 0 ⇒ early-out
      uniform float uOutflowActivity;  // 0=relict (degraded banks, shallower) … 1=sharp/active (driven)
      uniform float uOutflowWidth;     // trunk band half-width in field units (≈10× F11 spatial width w/ lower freq) — lab knob
      uniform float uOutflowDepth;     // scour carve depth (relief units) — lab knob
      uniform float uOutflowFreq;      // trunk frequency (continental single trunk: well below F11's) — lab knob
      uniform float uOutflowWarpAmt;   // warp displacement (kept low — floods run straight) — lab knob
      uniform float uOutflowIslands;   // streamlined-island strength inside the scour floor — lab knob
      uniform float uOutflowGrooveFreq;// longitudinal-groove frequency (across-flow coordinate) — lab knob
      uniform float uOutflowGrooves;   // groove amplitude as fraction of carve depth (≤ 0.15) — lab knob
      uniform vec3  uOutflowOffset;    // 🎲 domain offset — own seed, decorrelated from uFluvialOffset
      // ── F21 karst / dissolution (Fluvial step 4a — card F21) ──
      uniform float uKarstDensity;     // 0..1 master gate (driven: F11 solvent gate, erosion-weighted); <= 0 ⇒ early-out
      uniform float uKarstMaturity;    // 0=shallow grooves … 1=full maze (driven ∝ surfaceHistory.erosion)
      uniform float uKarstDolineFreq;  // doline Worley-cell frequency — lab knob
      uniform float uKarstDolineR;     // pit radius in F1 units (well under cell size ⇒ discrete pits) — lab knob
      uniform float uKarstDolineDepth; // doline carve depth (relief units) — lab knob
      uniform float uKarstMazeFreq;    // labyrinth slot frequency (own freq, NOT F1's) — lab knob
      uniform float uKarstMazeDepth;   // labyrinth slot carve depth — lab knob
      uniform float uKarstPlateauLvl;  // plateau mask threshold on accumulated h — lab knob
      uniform vec3  uKarstOffset;      // 🎲 domain offset — own seed, decorrelated from fluvial/outflow
      // ── F15 dunes & wind forms (Aeolian step 4a — card F15) ──
      uniform float uDuneDensity;      // 0..1 master gate (driven: D6/D5 wind gate × dryness); <= 0 ⇒ early-out
      uniform float uDuneAmp;          // ridge amplitude (relief units; dunes ADD — a deposit, not a carve) — lab knob
      uniform float uDuneFreq;         // ridge frequency on latitude (across-wind coordinate; wavelength = 1/freq in pos.y) — lab knob
      uniform float uDuneWarp;         // phase-warp amplitude (ridge threading/divergence, Shangri-La read) — lab knob
      uniform float uDuneBelt;         // equatorial-belt confinement 0..1 (Titan hydrocarbon belts) — lab knob
      uniform vec3  uDuneOffset;       // 🎲 domain offset — own warp seed, decorrelated from fluvial/outflow/karst
      // ── F16 dust mantles (Aeolian step 4a — card F16) ──
      uniform float uDustDepth;        // 0..1 master continuum (driven: press ramp × dryness × erosion); <= 0 ⇒ early-out; ONE scalar runs all three channels (relief smoothing / ochre lift / butterscotch veil)
      uniform float uDustRegionFreq;   // settling-region noise frequency (mantle patch scale) — lab knob
      uniform float uDustFlatK;        // settling slope-damp k in 1/(1+k·|grad|²) — dust survives flats, strips from steeps — lab knob
      uniform float uDustTint;         // butterscotch veil strength (Stage-8 whole-disk warm muting) — lab knob
      uniform vec3  uDustOffset;       // 🎲 domain offset — own region seed, decorrelated from lava/dunes
      // ── F19 mass-wasting deposits (Gradational step 4a — card F19) ──
      uniform float uMassWastDensity;  // 0..1 master gate (driven: 1.0 on every solid world, airless INCLUDED — Iapetus talus); <= 0 ⇒ early-out
      uniform float uRepose;           // angle-of-repose threshold in accumulated-|grad| units (driven ∝ g^-0.4 — low-g walls stand steeper, card §6 item 8)
      uniform float uTalusAmp;         // talus-apron fill amplitude — lab knob
      uniform float uLdaFat;           // 0..1 lobate-debris-apron fattening (driven: ground ice = volatile budget × cold); v1 = fatter collar, NOT separate geometry
      uniform float uLobeAmp;          // landslide-tongue amplitude — lab knob
      uniform float uLobeFreq;         // landslide voronoi seed frequency (tongue spacing) — lab knob
      uniform vec3  uMassWastOffset;   // 🎲 domain offset — own lobe seed, decorrelated from craters/karst
      // ── F24 zonal belts & zones (Bands step 4b — card F24) — ALBEDO ONLY, no relief ──
      uniform float uBandStrength;     // 0..1 master gate (driven: 1 on h2-he gas worlds, 0 on every solid preset); <= 0 ⇒ no-op
      uniform float uBandCount;        // visible stripe count pole-to-pole (driven, Rhines-flavored: D8 spin × disc size)
      uniform float uBandContrast;     // zone↔belt luminance separation (driven: T_eq convective-vigor ramp; cold CH4-haze giants go bland)
      uniform float uBandWarp;         // recursive-domain-warp displacement in stripe units (driven: festooning tracks the same ramp)
      uniform vec3  uBandTint;         // deck base color (driven: atmosphere.color — tan / pale-gold / blue)
      uniform float uBandStretch;      // vertical domain compression (~2.5) so the warp FBM streaks along latitude — lab knob
      uniform float uBandLatPow;       // latitude remap exponent (>1 ⇒ wide equatorial bands, narrow polar) — lab knob
      uniform vec3  uBandOffset;       // 🎲 domain offset — own warp seed, decorrelated from the terrain features
      // atmo-expression slice J: per-seed GLOBAL band-edge roughness draw (drawBandRoughness on the
      // bandFlow:rough stream; GUI 0..2, touched-flag override). CANDIDATE default 1.0 (band-flow.js
      // ROUGH_MEAN). Declared HERE in HEIGHT_GLSL (not the lab wrapper) so the shared HEIGHT_FRAG river-
      // router material — which compiles zonalBandCol's whole body without calling it — links (golden-lens).
      uniform float uBandRough;        // per-band edge-jaggedness global scale (slice J; consumed in zonalBandCol)
      // atmo-expression slice K: the 6 render-side band-PROXY uniforms + 2 ink dials (BUILD-PLAN §5). The
      // proxy reconstructs the baked band value aBand analytically render-side (the writer's normDenom =
      // uPeak·(aEq+aMid·envMax) makes uPeak CANCEL, leaving bandProxy(lat) = clamp01(0.5 + uBandDeflectScale·
      // (uBandSEq·AEQ·g + uBandAMid·mid))), so the storm swirl + ink advection can DEFLECT the primary band
      // (dBand = bandProxy(latRaw+dLat) − bandProxy(latRaw)) instead of pasting a decal — aBand +
      // GOLDEN_BANDFIELD_HASH are never touched (read-only reconstruction). Exported per-seed from bake.params
      // in rebakeE5Bands (single-sourced via band-flow.js bandProxyUniforms). Declared HERE in HEIGHT_GLSL
      // (NOT the lab wrapper / JS value file) so the shared HEIGHT_FRAG river-router material — which compiles
      // zonalBandCol's whole body without calling it — links instead of failing "undeclared identifier"
      // (golden-lens must-fix #1; the ws4-grain-scarp-wire precedent).
      uniform float uBandM;            // P.m — Rhines wavenumber (bandProxy)
      uniform float uBandPhaseJet;     // P.phaseJet — per-seed band phase (bandProxy)
      uniform float uBandSEq;          // P.sEq — signed equatorial-jet sign (bandProxy)
      uniform float uBandAMid;         // P.aMid — mid-latitude jet amplitude (bandProxy)
      uniform float uBandS2;           // P.s2 — Ward pole-emphasis coefficient (bandProxy env)
      uniform float uBandDeflectScale; // 0.5·contrast/(aEq+aMid·envMax) — the one combined proxy scalar
      uniform float uAtmoInk;          // THE boldness dial (scales dWake + dAdvect); GUI 0..2, CANDIDATE default 1.0 (bold)
      uniform float uInkStretch;       // ink anisotropy (zonal-plane domain compression); GUI 1..6, CANDIDATE default 3.5
      // ── F25 jets & shear turbulence (Bands step 4b — card F25) — ALBEDO/LUMINANCE ONLY ──
      // Regression contract: every jets term sits behind uJetStrength > 0.0, so at 0 the
      // render is byte-identical F24 output (uTime enters the band family ONLY through F25).
      uniform float uJetStrength;      // 0..1 master gate (driven: 1 on h2-he gas worlds, 0 on every solid preset); <= 0 ⇒ no-op
      uniform float uJetSpeed;         // counter-rotating drift amplitude, rad per flow-map phase (driven: D8 spin, ∝ 1/rotationHours)
      uniform float uJetShearTurb;     // boundary-turbulence displacement amplitude in stripe units (driven: T_eq vigor ramp)
      uniform float uJetFestoon;       // one-sided equatorial-flank hook amplitude in stripe units (driven: same ramp)
      uniform float uJetTurbFreq;      // shear-turbulence fbm frequency multiplier vs the band-warp domain — lab knob
      uniform float uJetEqWidth;       // equatorial superrotation Gaussian half-width in trueLat units — lab knob
      uniform vec3  uJetOffset;        // 🎲 domain offset — own turbulence seed, decorrelated from the band warp
      // ── F26 latitude weather bands (Bands step 4b — card F26) — CLOUD LAYER ONLY ──
      // Regression contract: the whole family sits behind uWeatherStrength > 0.0, so at
      // 0 the Stage-8 threshold input is the raw cw.x — cloud layer byte-identical.
      uniform float uWeatherStrength;  // 0..1 master gate (driven: not-gas AND retained, x rain-composition factor; 0 on gas/airless)
      uniform float uWeatherCells;     // circulation cell count (driven: D8 spin, 72/rotationHours clamped 1..6; Earth 24 h = 3)
      uniform float uWeatherItczShift; // ITCZ center shift off the equator in |lat| units (driven: D3 tilt via frostLatitudeBias)
      uniform float uWeatherLocked;    // 1 = eyeball coordinate: bands reorganize around the substellar point (driven: locked AND retained)
      uniform float uWeatherWarp;      // front-shredding latitude-warp amplitude — lab knob
      uniform float uWeatherDry;       // subtropical-trough drying subtracted inside the cloud threshold — lab knob
      uniform vec3  uWeatherOffset;    // 🎲 domain offset — own warp seed, decorrelated from F24's uBandOffset
      // ── F27 great-spot anticyclone (Bands step 4b — card F27) — ALBEDO ONLY ──
      // The registry-reserved storm carriage (REGISTRY-canonical-uniforms.md storm row),
      // lab-sized: flat arrays cap 8 (the shadowMoonPos pattern). F27 drives index 0;
      // F28 extends the count at smaller radii — build the machinery once, drive by data.
      // Regression contract: EVERY storm term sits behind i < uStormCount, so count 0
      // (greatSpotEnabled off, or any terrestrial preset) renders byte-identical F25
      // output. Static in v1 — no uTime in any storm term (interior rotation deferred).
      uniform vec4  uStormPosSize[8];  // xyz = unit-sphere storm center, w = angular radius (rad)
      uniform vec4  uStormParams[8];   // x = rotStrength (rad), y = E-W aspect, z = mode (0 warm / 1 dark), w = companion strength
      uniform vec3  uStormColor[8];    // core color (driven: bandTint warmed for GRS-class / bruised for GDS-class)
      uniform int   uStormCount;       // live storm count (driven: gas gate x enable; 0 = whole family no-ops)
      // ── F29 polar vortex (Bands step 4b — card F29) — ALBEDO/LUMINANCE ONLY, analytic ──
      // One combiner in the pole tangent frame, NO carriage slots: the lattice's ring-
      // cyclone centers derive in-shader from angle rounding (zero arrays). Variant by
      // uPolarMode (float 0 cap / 1 polygon / 2 lattice, step()-selected — no int
      // branching). Regression contract: the call site AND every term key on
      // uPolarStrength, so strength 0 (enable off, or any solid preset) renders
      // byte-identical F28 output. Static in v1 — no uTime in any polar term: the
      // structures are quasi-permanent over years (PIA24967), so a seed-deterministic
      // static read is physically honest.
      uniform float uPolarStrength;  // 0..1 master gate (driven: 1 on h2-he gas presets, 0 on every solid world)
      uniform float uPolarMode;      // variant: 0 single cap / 1 polygon jet / 2 cyclone lattice (driven: T_eq vigor ramp)
      uniform float uPolarSides;     // polygon wavenumber N (driven: 5..8 hash, re-draw biased toward Saturn's 6)
      uniform float uPolarR0;        // jet / lattice-ring angular radius rad (driven: 0.18 + 0.08 x hash)
      uniform float uPolarAmp;       // polygon meander amplitude — rJet = r0 x (1 + amp cos(N theta)) — lab knob
      uniform float uPolarPole;      // active pole sign: +1 north / -1 south (driven: hash)
      uniform float uPolarRing;      // lattice ring cyclone count M (driven: 5..8 hash)
      uniform float uPolarPhase;     // single-cap S-lobe orientation rad (driven: hash)
      uniform float uPolarW;         // polygon collar half-width rad — lab knob
      uniform vec3  uPolarTint;      // cap tint (driven: bandTint shifted cool — the teal-blue core lean)
      // ── F30 lightning (Storms — card F30) — ★ EMISSIVE-CHANNEL ONLY, transient ──
      // A spatio-temporal point process: sparse hashed cell grid, per-cell flash
      // window on uTime with sharp-attack/exp-decay envelope, Gaussian glow blob
      // around the jittered cell center — NEVER a drawn bolt (card §4: at lab
      // viewing distances lightning reads as a sub-second diffuse glow lighting
      // cloud tops from within, per Cassini PIA12576 / ISS night photography).
      // Deterministic from (position, uTime) — no buffers, no state (the research
      // doc hard constraint). Regression contract: the call site keys on
      // uLightningStrength alone, so strength 0 (enable off, or any airless
      // preset) renders byte-identical F29-committed output. uTime is allowed:
      // lightning is a transient feature joining aurora/clouds as a time
      // consumer; the F24 static band field is untouched (emissive channel only).
      uniform float uLightningStrength; // 0..1 master gate (driven: 1 on gas, rain-composition factor on solid retained-atmosphere worlds)
      uniform float uLightPolar;        // latitude regime: 0 ITCZ equatorial / 1 Juno polar clustering (driven: gas gate — PIA22474)
      uniform float uLightRate;         // base flash rate, cycles/s before per-cell jitter — lab knob
      uniform float uLightDur;          // flash window as a fraction of the cell cycle — lab knob
      uniform float uLightCellFreq;     // flash cell grid frequency (cells per unit pos) — lab knob
      uniform float uLightBlobR;        // flash blob angular radius rad — lab knob
      // ── F31 clouds family (Clouds — card F31) — regime-dispatched Stage-8 combiner ──
      // One driver (atmosphere) routed through regimes over the SINGLE Stage-8 fbmd
      // cloud field (card §4): 0 weather deck (terrestrial patchy + gas low-coverage;
      // regime 1 is reserved — gas band TOPS are the F24-F29 stack itself, no new
      // code) · 2 sub-neptune haze mute (pre-posterize contrast kill toward one haze
      // tone — the reserved Stage-8 muting slot) · 3 venus blanket (opaque deck,
      // zero ground leak, one [subtle] Y/V chevron drifting with superrotation) ·
      // 4 eyeball substellar pupil cap + terminator ring (STATIC vs uTime — reads
      // the pre-plumbed vSubstellarAngle, moves only with the light direction).
      // Deterministic: every term a pure function of (position, uTime, uniforms).
      // Master gate = uCloudCoverage (Task 7, declared above): the per-frame writer
      // forces it 0 when cloudsEnabled is off, so deck + every regime term vanish.
      uniform int   uCloudRegime;       // 0 weather / 2 haze mute / 3 venus blanket / 4 eyeball (driven; int like uDebugMode)
      uniform float uCloudRelief;       // clouds-as-relief self-shade strength — lab knob (tilts the CLOUD term's own diffuse with the fbmd gradient; NEVER writes the terrain heightfield — F19 contract)
      uniform float uHazeMute;          // regime-2 pre-posterize mute amount (driven: 0.85 on sub-neptune haze, else 0)
      uniform vec3  uHazeColor;         // haze / blanket tone (driven: preset atmosphere color)
      uniform float uChevronStrength;   // regime-3 Y/V chevron darkening — lab knob (~0.17 = one 6-level posterize bucket)
      uniform float uPupilR;            // regime-4 substellar cap half-angle rad — lab knob
      // ── F40 dust storms (Aeolian — card F40) — the Stage-8 UPPER slot the header
      // reserves: an airborne dust veil that FLATTENS the surface pre-posterize
      // (tau = activity^2 x domain-warped patch mask), a self-shading front via the
      // F31a clouds-as-relief slot on the dust field's OWN gradient, and low-activity
      // dust devil track curlicues on the surface albedo. One driven scalar walks the
      // whole P23 axis (local cloud ... planet-encircling); the per-frame writer
      // forces it 0 when dustStormEnabled is off, so veil + front + tracks all vanish.
      uniform float uDustActivity;      // 0..1 storm activity (driven: retained AND pressure <= 0.5 bar AND dry AND not gas -> 0.55 Mars-like carrier; else 0)
      uniform vec3  uDustColor;         // F40 lofted-dust tint (driven: preset atmosphere butterscotch; lit by the front's own diffuse, not painted on the ground)
      // ── F32/F33 thermal day/night (cards F32 dayside hotspot + F33 nightside glow) ──
      // ONE energy-balance temperature curve, two consumers (the emissiveBlackbody
      // header contract): F32 owns the dayside lobe — uDayTempK plus the superrotation
      // east shift baked into uThermalDir (the CPU rotates uLightDir about the spin
      // axis; vSubstellarAngle stays light-true for its other consumers). F33 owns the
      // nightside floor (uNightTempK, the Keating ~1100 K universal), the silicate
      // occlusion mask and the warm limb rim. The per-frame writer splits ownership:
      // F32 off ⇒ uDayTempK written as the night floor (lobe collapses onto it);
      // F33 off ⇒ uNightTempK written 0 + uThermalOcclusion written 0. Strength 0
      // (every non-hot-jupiter preset) skips the whole emissive term.
      uniform float uThermalStrength;   // master gate + brightness scale (driven: 1 on hot-jupiter, else 0)
      uniform vec3  uThermalDir;        // uLightDir rotated east about the spin axis by the hotspot offset (CPU per-frame)
      uniform float uDayTempK;          // dayside peak temperature K (driven: T_eq x 1.15; writer-collapsed when F32 off)
      uniform float uNightTempK;        // nightside floor temperature K (driven: 1100 on hot-jupiter; writer-zeroed when F33 off)
      uniform float uRedistribution;    // day-to-night falloff exponent — lab knob 1..6 (3 = legacy pow(starFacing,3) heritage)
      uniform float uThermalOcclusion;  // F33 silicate-cloud occlusion strength — lab knob (writer-zeroed when F33 off)
      // ── F41 hemispheric magma ocean (Exotic — card F41) — the Stage-7 exotic
      // consumer of the shared machinery: the sea is a smoothstep mask around a
      // driven liquidus iso-angle of the SHARED vSubstellarAngle varying (the
      // uFrostLocked antistellar-cap field, hot side), surface temperature follows
      // the K2-141b GCM irradiation law T(theta) = T_ss x cos^(1/4)(theta), hue =
      // the shared emissiveBlackbody ramp (the ONE-curve F32/F33/F41 header
      // contract), and ALL glow rides the star-emissive-bypass channel (added
      // AFTER the posterize). The per-frame writer forces the angle 0 when
      // magmaEnabled is off, so sea + shoreline + crust + rock-frost all vanish:
      // byte-identical pre-F41 output — the F41 regression contract.
      uniform float uMagmaSeaAngle;     // liquidus iso-angle rad (driven: acos((1300/T_ss)^4) on locked solid worlds whose T_ss = T_eq x 1.4 clears the 1300 K liquidus, else 0 — the master gate)
      uniform float uMagmaTemp;         // substellar surface temp T_ss K (driven: T_eq x 1.4 on locked worlds; unlocked worlds derive 0 — heat spins away, never a hemispheric sea)
      uniform float uMagmaChurnSpeed;   // crust-plate churn phase rate (x uTime) — lab knob (BOUNDED two-phase advection, the F25/F40 fract crossfade)
      // ── F42 carbon-world crust (Exotic — card F42) — surface MINERALOGY, not new
      // landforms (card section 4: above disk C/O ~0.8 the condensation sequence
      // swaps silicates for graphite/SiC/diamond): a global near-black graphite
      // albedo mask (Stage 6, ONE low-frequency octave — no high-freq albedo noise
      // fighting the dither), tar-flat basin fills in the F8 uLavaCoverage combiner
      // mold (the sanctioned height-domain pattern), and sparse crest diamond
      // glints + a broad soft tar sheen riding the star-emissive-bypass family
      // (added AFTER the posterize — crisp specks, never banded). The per-frame
      // writer derives uCarbonStrength from the driven C/O ratio and forces it 0
      // when carbonEnabled is off; EVERY F42 term keys on it, so one gate kills
      // the family: byte-identical pre-F42 output — the F42 regression contract.
      uniform float uCarbonStrength;    // master gate 0..1 (driven: clamp((C/O - 0.8) x 2.5) — 1.2 on the carbon preset -> 1; every preset without composition.carbonToOxygen derives ratio 0 -> 0)
      uniform float uTarCoverage;       // 0..1 tar-flat coverage fraction — lab knob (the F8 region-extent semantics; <= 0 early-outs the combiner)
      uniform float uGlintDensity;      // 0..1 diamond-glint sparse-cell density — lab knob (per-cell hash threshold)
      // ── F43 crystalline facet field (Exotic — card F43) — slow-crystallization
      // endmember (card section 4: near-equilibrium crystal growth tiles an undisturbed
      // airless crust into FLAT planar faces meeting at SHARP ridge crests): the F9
      // chaos-raft mechanism (per-cell hashed flat height + per-cell CONSTANT tilt fed
      // EXACTLY into the relief gradient, so adjacent facets catch light differently) at
      // CRYSTAL amplitude, with an IQ F2−F1 border-distance smoothstep ridge crest at the
      // cell seams, all gated by a low-freq fbm coverage mask (scattered crystals →
      // continuous field, the F7 edifice gating); a finer second voronoi octave fades in
      // at LOD2 (the lodRamp octave-budget, pop-free); and a per-facet specular SPARK
      // (the facet's own tilted normal vs the half-vector, pow ~80, sparse per-cell hash
      // gate) riding the post-posterize emissive bypass family — crisp sparks that sweep
      // across facets as the view rotates, never banded. The per-frame writer derives
      // uFacetStrength from real surface-history fields (airless + pristine) and forces it
      // 0 when facetsEnabled is off; EVERY F43 term keys on it, so one gate kills the
      // family: byte-identical pre-F43 output — the F43 regression contract. (fc is TAKEN
      // in the shader — gl_FragCoord; all F43 GLSL locals use the 'fct' prefix.)
      uniform float uFacetStrength;     // master gate 0..1 (driven: 1 on the airless+pristine crystal class — airless && erosion < 0.05 && resurfacingRate < 0.05 && bombardmentIntensity < 0.2; every other preset derives 0)
      uniform float uFacetCoverage;     // 0..1 facet coverage fraction — lab knob (scattered crystals → continuous field; the F7 region-extent semantics, FULL-range walkable)
      uniform float uFacetScale;        // facet cell density (voronoi3d frequency) — lab knob
      uniform float uFacetAmp;          // facet relief amplitude (per-cell height + tilt scale) — lab knob
      // ── F44 hex-tessellated crust (Exotic — card F44) — P15 crustal tessellation
      // (cooling-contraction / convection branch): a uniform-lithology crust tiles into
      // ~hexagonal cells (3 fractures @ 120°). Mechanism = the voronoi3d keystone with a
      // REGULARITY jitter knob (zero-jitter Voronoi degenerates to a hex lattice), trough
      // BORDERS carved from the F2−F1 distance (the F18 N₂-polygon convention) into
      // height+gradient, and per-cell hashed flat/domed interiors (the F9 chaos-raft +
      // Sputnik dome). ALL relief (height + gradient), never albedo, so it survives the
      // 6-level Bayer posterize. uHexStrength is a pure ENABLE gate (no preset, no driver
      // derivation — the writer sets it 1 when hexTessEnabled, else 0); EVERY F44 term keys
      // on it, so one gate kills the family: byte-identical pre-F44 output. (fc is TAKEN —
      // gl_FragCoord; all F44 GLSL locals use the 'hx' prefix.)
      uniform float uHexStrength;       // master gate 0..1 (pure enable: 1 when hexTessEnabled, else 0; the writer is sole owner)
      uniform float uHexRegularity;     // 0..1 jitter knob: 0 = random Voronoi blobs, 1 = zero-jitter regular hex lattice
      uniform float uHexScale;          // hex cell density (voronoi3d frequency) — lab knob
      uniform float uHexBorderDepth;    // trough carve depth (−) — lab knob
      uniform float uHexBorderWidth;    // smoothstep width of the F2−F1 border band — lab knob
      uniform float uHexDome;           // per-cell domed-center amount (Sputnik convex shading; 0=flat plateau, 1=fully domed) — lab knob
      // ── F45 shattered / fractured crust (Exotic — card F45) — P15 crustal tessellation
      // (catastrophic-disruption / shatter-then-reaccrete endmember; Miranda / Europa Conamara
      // analog): a uniform crust shattered into CHAOTIC, mismatched, tilted blocks. Mechanism =
      // a GLOBALIZED two-octave generalization of the F9 chaosCombiner — voronoi3d MEGA-BLOCKS
      // with per-cell hashed flat raft height + per-cell CONSTANT tilt fed DIRECTLY into grad
      // (the F9 cosmetic-gradient trick — each block lands in its own posterize band), an
      // F2−F1 border crevasse carved DOWN with graben walls (reuse grabenProfile), and a finer
      // second-octave SUB-FRACTURE voronoi lattice gated INSIDE blocks (the two-scale read that
      // sells 'violently reassembled' over F44's uniform paving). ALL relief (height + gradient),
      // never albedo, so it survives the 6-level Bayer posterize. uShatStrength is a pure ENABLE
      // gate (no preset, no driver derivation — the writer sets it 1 when shatterEnabled, else 0);
      // EVERY F45 term keys on it, so one gate kills the family: byte-identical pre-F45 output.
      // (fc=gl_FragCoord, sh~shadow are TAKEN — all F45 GLSL locals/uniforms use the 'shat'/'uShat' prefix.)
      uniform float uShatStrength;      // master gate 0..1 (pure enable: 1 when shatterEnabled, else 0; the writer is sole owner)
      uniform float uShatScale;         // mega-block density (voronoi3d frequency) — lab knob
      uniform float uShatBlockJitter;   // per-block flat-height + CONSTANT-tilt displacement (the chaos uChaosRaftJitter analog — THE grad driver) — lab knob
      uniform float uShatBorderDepth;   // F2−F1 crevasse carve-down depth (grabenProfile amplitude) — lab knob
      uniform float uShatBorderWidth;   // smoothstep width of the F2−F1 border band feeding grabenProfile — lab knob
      uniform float uShatMaskScale;     // low-freq region-mask frequency (the uChaosMaskScale pattern) — lab knob
      uniform float uShatMaskCover;     // region coverage 0..1 = the INTENSITY axis (local fracture zone → globally shattered) — lab knob
      uniform float uShatSubFreq;       // second-octave sub-fracture lattice frequency (multiplier on uShatScale) — lab knob
      uniform float uShatSubAmt;        // sub-fracture relief amount (0=single-scale blocks, >0=subdivided) — lab knob

      // ── snoise — VERBATIM from Planet.js (used by the finite-diff regression path) ──
      vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
      vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
      vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
      float snoise(vec3 v){
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      // ── bayerDither + posterize — VERBATIM from Planet.js ──
      float bayerDither(vec2 coord){
        vec2 p = mod(floor(coord), 4.0);
        float t = 0.0;
        if (p.y < 0.5)      { t = (p.x<0.5)?0.0 :(p.x<1.5)?8.0 :(p.x<2.5)?2.0 :10.0; }
        else if (p.y < 1.5) { t = (p.x<0.5)?12.0:(p.x<1.5)?4.0 :(p.x<2.5)?14.0:6.0; }
        else if (p.y < 2.5) { t = (p.x<0.5)?3.0 :(p.x<1.5)?11.0:(p.x<2.5)?1.0 :9.0; }
        else                { t = (p.x<0.5)?15.0:(p.x<1.5)?7.0 :(p.x<2.5)?13.0:5.0; }
        return t / 16.0;
      }
      // Interleaved Gradient Noise (Jimenez 2014) — finer, less grid-patterned than
      // Bayer; needed when posterize levels are pushed high (spec §2.C dither toggle).
      float ignDither(vec2 coord){
        return fract(52.9829189 * fract(dot(coord, vec2(0.06711056, 0.00583715))));
      }
      float ditherVal(vec2 coord, int mode){
        return (mode == 1) ? ignDither(coord) : bayerDither(coord);
      }
      vec3 posterize(vec3 color, float levels, vec2 fragCoord, float edgeWidth, int mode){
        float dither = ditherVal(fragCoord, mode) - 0.5;
        vec3 dithered = color + dither * edgeWidth / levels;
        return floor(dithered * levels + 0.5) / levels;
      }

      // ── computeHeight + perturbNormalFromNoise — VERBATIM (the path we replace) ──
      float computeHeight(vec3 pos){
        float h  = snoise(pos * uNoiseScale * 0.3 + uMacroOffset)  * 0.5;
        h += snoise(pos * uNoiseScale       + uMacroOffset)  * 0.35;
        h += snoise(pos * uNoiseScale * 2.0 + uDetailOffset) * 0.2;
        h += snoise(pos * uNoiseScale * 4.0 + uDetailOffset) * 0.1;
        return h;
      }
      vec3 perturbFiniteDiff(vec3 N, vec3 pos, float strength){
        vec3 up = abs(N.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
        vec3 T = normalize(cross(up, N));
        vec3 B = cross(N, T);
        float eps = 0.01;
        float h0 = computeHeight(pos);
        float hT = computeHeight(pos + T*eps);
        float hB = computeHeight(pos + B*eps);
        float dT = (hT - h0)/eps;
        float dB = (hB - h0)/eps;
        float scale = strength * 0.025;
        vec3 perturbed = normalize(N - T*dT*scale - B*dB*scale);
        float dev = dot(perturbed, N);
        if (dev < 0.5) perturbed = normalize(mix(perturbed, N, 0.5));
        return perturbed;
      }

      // ── NEW: IQ analytic-derivative gradient noise — value in .x, gradient in .yzw ──
      // https://iquilezles.org/articles/gradientnoise/
      vec3 hash3(vec3 p){
        p = vec3( dot(p, vec3(127.1, 311.7,  74.7)),
                  dot(p, vec3(269.5, 183.3, 246.1)),
                  dot(p, vec3(113.5, 271.9, 124.6)) );
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      vec4 noised(vec3 x){
        vec3 p = floor(x);
        vec3 w = fract(x);
        vec3 u  = w*w*w*(w*(w*6.0-15.0)+10.0);      // quintic fade
        vec3 du = 30.0*w*w*(w*(w-2.0)+1.0);
        vec3 ga = hash3(p+vec3(0.0,0.0,0.0));
        vec3 gb = hash3(p+vec3(1.0,0.0,0.0));
        vec3 gc = hash3(p+vec3(0.0,1.0,0.0));
        vec3 gd = hash3(p+vec3(1.0,1.0,0.0));
        vec3 ge = hash3(p+vec3(0.0,0.0,1.0));
        vec3 gf = hash3(p+vec3(1.0,0.0,1.0));
        vec3 gg = hash3(p+vec3(0.0,1.0,1.0));
        vec3 gh = hash3(p+vec3(1.0,1.0,1.0));
        float va = dot(ga, w-vec3(0.0,0.0,0.0));
        float vb = dot(gb, w-vec3(1.0,0.0,0.0));
        float vc = dot(gc, w-vec3(0.0,1.0,0.0));
        float vd = dot(gd, w-vec3(1.0,1.0,0.0));
        float ve = dot(ge, w-vec3(0.0,0.0,1.0));
        float vf = dot(gf, w-vec3(1.0,0.0,1.0));
        float vg = dot(gg, w-vec3(0.0,1.0,1.0));
        float vh = dot(gh, w-vec3(1.0,1.0,1.0));
        float v = va
          + u.x*(vb-va) + u.y*(vc-va) + u.z*(ve-va)
          + u.x*u.y*(va-vb-vc+vd) + u.y*u.z*(va-vc-ve+vg) + u.z*u.x*(va-vb-ve+vf)
          + u.x*u.y*u.z*(-va+vb+vc-vd+ve-vf-vg+vh);
        vec3 d = ga
          + u.x*(gb-ga) + u.y*(gc-ga) + u.z*(ge-ga)
          + u.x*u.y*(ga-gb-gc+gd) + u.y*u.z*(ga-gc-ge+gg) + u.z*u.x*(ga-gb-ge+gf)
          + u.x*u.y*u.z*(-ga+gb+gc-gd+ge-gf-gg+gh)
          + du * ( vec3(vb-va, vc-va, ve-va)
                 + u.yzx*vec3(va-vb-vc+vd, va-vc-ve+vg, va-vb-ve+vf)
                 + u.zxy*vec3(va-vb-ve+vf, va-vb-vc+vd, va-vc-ve+vg)
                 + u.yzx*u.zxy*(-va+vb+vc-vd+ve-vf-vg+vh) );
        return vec4(v, d);
      }

      // ── voronoi3d — KEYSTONE shared primitive (integration-index §1) ──
      // 3D-domain cellular noise sampled on vPos: inherently seam-free on the
      // sphere (no UV seam, no pole pinch) — the reason to pay for 27 cells.
      // Transcribed from the CPU oracle in planet-lod-lab-core.js (same hash).
      // hash33 returns [0,1)^3 cell-jitter — DISTINCT from the signed hash3 above.
      vec3 hash33(vec3 p){
        p = vec3( dot(p, vec3(127.1, 311.7,  74.7)),
                  dot(p, vec3(269.5, 183.3, 246.1)),
                  dot(p, vec3(113.5, 271.9, 124.6)) );
        return fract(sin(p) * 43758.5453123);
      }
      // returns vec2(F1, F2); cellId + grad(=∂F1/∂p, the relief-normal term) via out.
      // cells: 27 = full 3×3×3 (seam-free desktop) ; <27 = center-slab 9 (lossy mobile).
      vec2 voronoi3d(vec3 p, int cells, out vec3 cellId, out vec3 grad){
        vec3 ip = floor(p);
        vec3 fp = fract(p);
        float f1 = 1e9, f2 = 1e9;
        vec3 nCell = ip, nR = vec3(0.0);
        for (int gz=-1; gz<=1; gz++){
          if (cells < 27 && gz != 0) continue;     // 9-cell: center slab only
          for (int gy=-1; gy<=1; gy++){
            for (int gx=-1; gx<=1; gx++){
              vec3 g = vec3(float(gx), float(gy), float(gz));
              vec3 c = g + hash33(ip + g);          // jittered center, rel to ip cell
              vec3 r = c - fp;                       // fragment -> center
              float d = length(r);
              if (d < f1){ f2 = f1; f1 = d; nCell = ip + g; nR = r; }
              else if (d < f2){ f2 = d; }
            }
          }
        }
        cellId = nCell;
        grad = (f1 > 1e-6) ? (-nR / f1) : vec3(0.0); // = normalize(p - center)
        return vec2(f1, f2);
      }

      // ── emissiveBlackbody — shared incandescence color ramp (integration-index §1) ──
      // ONE curve, two consumers: BANDS thermal (F32/F33) + EXOTIC magma (F41).
      // Returns CHROMATICITY only (peak channel ≈1); caller scales brightness
      // (uThermalStrength × starFacing). Transcribed from the CPU mirror in
      // planet-lod-lab-core.js — same stops, same chained-mix smoothstep weights
      // (a stylized Planckian-locus ramp anchored to real blackbody sRGB, not a
      // spectral integration). Emissive-bypass term, so it's added AFTER posterize.
      vec3 emissiveBlackbody(float tempK){
        vec3 c = vec3(1.0, 0.18, 0.05);                                         // 800K deep dull red (floor)
        c = mix(c, vec3(1.0, 0.42, 0.10), smoothstep( 800.0, 1500.0, tempK));   // -> orange
        c = mix(c, vec3(1.0, 0.66, 0.32), smoothstep(1500.0, 2500.0, tempK));   // -> amber/yellow
        c = mix(c, vec3(1.0, 0.85, 0.70), smoothstep(2500.0, 4000.0, tempK));   // -> warm white
        c = mix(c, vec3(1.0, 0.98, 0.96), smoothstep(4000.0, 6500.0, tempK));   // -> white (ceiling)
        return c;
      }

      // ── NEW: variable-octave analytic FBM. Returns vec4(height, gradient.xyz). ──
      // octaves = mix(4,9,lodRamp); fractional trailing-octave weight = pop-free ramp;
      // fwidth clamp fades sub-pixel octaves to their mean (kills dither shimmer).
      vec4 fbmd(vec3 pos, float octaves, float fwBase){
        float freq = uNoiseScale * 0.3;     // matches computeHeight's largest feature scale
        float amp  = 0.5;
        float h = 0.0;
        vec3 grad = vec3(0.0);
        for (int i = 0; i < 12; i++){
          if (float(i) >= octaves) break;
          float w = clamp(octaves - float(i), 0.0, 1.0);    // trailing-octave fade
          if (uFwClamp == 1){
            float screenF = fwBase * freq;                  // per-octave screen-space freq
            w *= 1.0 - smoothstep(0.4, 0.8, screenF);
          }
          // macro seed drives the big-feature octaves (0..2), detail seed the rest.
          // A constant offset leaves the analytic gradient untouched (chain rule).
          vec3 off = (i < 3) ? uMacroOffset : uDetailOffset;
          vec4 n = noised(pos * freq + off);
          h    += amp * w * n.x;
          grad += amp * w * freq * n.yzw;                   // chain rule for d/dpos
          amp  *= 0.5;
          freq *= 2.0;
        }
        return vec4(h, grad);
      }

      // ── Stage-D provinces (index §8 — LIVE 2026-06-10) — the shared large-scale partition ──
      // Declared BEFORE every combiner (fluvial is the earliest consumer in source order).
      // THREE decorrelated low-frequency FBM threshold fields (the codebase's region idiom:
      // F8 flow region / F9 chaos region / F22 snowline), computed ONCE per fragment into
      // gProvince by initProvinces(), then mapped per-feature by provinceWeight(FEATURE_ID).
      // The {field, polarity, floor} affinity rows MIRROR planet-archetypes.js PROVINCES
      // (vitest drift-guards parse this if-chain — edit BOTH places). Constraints honored:
      // SOFT weight fields (smoothstep blends — blend-not-branch, §8 load-bearing) and
      // feature-POOR provinces (floor keeps a feature faintly present outside its region;
      // floor 1.0 = neutral, for climate-driven features geology must not gate). The fields
      // are very low freq, so every multiply treats the weight locally-constant in the
      // gradient (the fluvialCombiner-lowGround / Musgrave-weight chain-rule convention).
      const int PROV_MOUNTAINS   = 0;   // F3 ejecta + rays share PROV_CRATERS (they wrap F2)
      const int PROV_CRATERS     = 1;
      const int PROV_CANYONS     = 2;
      const int PROV_SCARPS      = 3;
      const int PROV_PLATEAUS    = 4;
      const int PROV_TESSERA     = 5;
      const int PROV_EDIFICES    = 6;
      const int PROV_LAVA        = 7;
      const int PROV_CHAOS       = 8;
      const int PROV_CRYORIDGE   = 9;
      const int PROV_RIVERS      = 10;
      const int PROV_SUBLIMATION = 11;
      const int PROV_GLACIAL     = 12;
      const int PROV_FROST       = 13;
      const int PROV_LAKES       = 14;  // F14 — neutral (hydrology, not geology), like FROST
      const int PROV_DELTAS      = 15;  // F12 — river products, same lowlands affinity as RIVERS
      const int PROV_COAST       = 16;  // F20 — neutral (margins live wherever the sea is), like LAKES/FROST
      const int PROV_OUTFLOW     = 17;  // F13 — flood products, same young-lowlands affinity as RIVERS
      const int PROV_KARST       = 18;  // F21 — soluble-lithology provinces (CHAOS-row pattern: y-field, decorrelated from the fluvial z-field)
      const int PROV_DUNES       = 19;  // F15 — old stable plains (CRATER-row polarity: sand seas live among crater fields, not young orogens)
      const int PROV_DUST        = 20;  // F16 — fallout is near-global: dunes' old-plains polarity but a HIGH floor (mantles thin over young terrain, never vanish)
      const int PROV_MASSW       = 21;  // F19 — deposits live where steeps live: the MOUNTAIN-field polarity (talus needs walls to fail)
      const int PROV_BANDS       = 22;  // F24 — neutral (atmosphere, not geology): the FROST-row pattern — a gas deck must not be gated by rock provinces
      const int PROV_JETS        = 23;  // F25 — neutral: the shear dynamics ride the same unprovinced gas deck as PROV_BANDS
      const int PROV_WEATHER     = 24;  // F26 — neutral (climate, not geology): the FROST-row pattern — latitude circulation must not be gated by rock provinces
      const int PROV_GREATSPOT   = 25;  // F27 — neutral: the vortex rides the same unprovinced gas deck as PROV_BANDS/PROV_JETS
      const int PROV_STORMTRAIN  = 26;  // F28 — neutral: the train rides the same unprovinced gas deck as PROV_GREATSPOT
      const int PROV_POLAR       = 27;  // F29 — neutral: the pole structure rides the same unprovinced gas deck as the storm family
      const int PROV_LIGHTNING   = 28;  // F30 — neutral (weather, not geology): flashes follow the convective cloud deck (FROST-row pattern)
      const int PROV_CLOUDS      = 29;  // F31 — neutral (atmosphere, not geology): the deck/haze/blanket rides ABOVE the rock provinces (FROST-row pattern)
      const int PROV_DAYTHERM    = 30;  // F32 — neutral (irradiation, not geology): the dayside lobe follows the star, not the rock provinces (FROST-row pattern)
      const int PROV_NIGHTTHERM  = 31;  // F33 — neutral (atmospheric emission, not geology): the night floor + silicate deck ride ABOVE the rock provinces (FROST-row pattern)
      const int PROV_LIMB        = 32;  // F34 — neutral (global optics, not geology): the rim hugs the whole silhouette regardless of provinces (FROST-row pattern, like clouds F31)
      const int PROV_TERM        = 33;  // F35 — neutral (global optics, not geology): the twilight band follows the light, not the rock provinces (FROST-row pattern, like limb F34)
      const int PROV_GLINT       = 34;  // F36 — neutral (view/illumination geometry, not geology): the mirror point follows sun + camera over the already lakes-gated sea (FROST-row pattern, like limb/terminator)
      const int PROV_AURORA      = 35;  // F37 — neutral (magnetospheric optics, not geology): the oval follows the dipole axis + the night side, never the rock provinces (FROST-row pattern, like limb/terminator/glint)
      const int PROV_DUSTSTORM   = 36;  // F40 — neutral (weather, not geology): the airborne veil/tracks ride the wind, not the rock provinces (FROST-row pattern, like clouds F31; Hellas-style low-elevation nucleation is a logged v1 scope cut)
      const int PROV_MAGMA       = 37;  // F41 — neutral (irradiation, not geology): the sea follows the substellar point (the light direction), never the rock provinces (FROST-row pattern, like daysideThermal F32)
      const int PROV_CARBON      = 38;  // F42 — neutral (mineralogy, not geology): the graphite/tar/diamond materials ARE the whole crust (composition-driven, planet-global), never gated by rock provinces (FROST-row pattern, like magma F41)
      const int PROV_FACETS      = 39;  // F43 — neutral (crystallization, not geology): the facet field grows over the WHOLE undisturbed crust (surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like carbon F42)
      const int PROV_HEXTESS     = 40;  // F44 — neutral (crustal tessellation, not geology): the hex field tiles the WHOLE uniform-lithology crust (surface-history/cooling-driven, planet-global), never gated by rock provinces (FROST-row pattern, like facets F43)
      const int PROV_SHATTER     = 41;  // F45 — neutral (crustal disruption, not geology): the shatter tiles the WHOLE crust (catastrophic-stress/surface-history-driven, planet-global), never gated by rock provinces (FROST-row pattern, like hexTess F44)
      const int PROV_BIOMATS     = 42;  // F46 — neutral (biosphere coverage, not geology): the mat spreads over habitable terrain (life-/coverage-driven, planet-global), never gated by rock provinces (FROST-row pattern, like aurora F37)
      const int PROV_MACHINE     = 43;  // F47 — neutral (engineered overlay, not geology): a built crust covers terrain regardless of rock provinces (FROST-row pattern, like bioMats F46)
      const int PROV_CITYLIGHTS  = 44;  // F48 — neutral (civilization coverage, not geology; FROST-row, like bioMats F46 / machine F47)
      const int PROV_ECUMENOPOLIS = 45; // F49 — neutral (engineered saturation overlay, not geology; FROST-row, like cityLights F48 / machine F47)
      const int PROV_AIRGLOW     = 46;  // F38 — neutral (atmospheric optics, not geology): the OI-557.7 night-limb shell encases the WHOLE planet uniformly, never the rock provinces (FROST-row pattern, like aurora F37 / limb F34)
      const int PROV_CLOUDOPTICS = 47;  // F39 — neutral (antisolar backscatter glory, not geology): the colored rings follow sun + camera over the LIT cloud deck, never the rock provinces (FROST-row pattern, like airglow F38 / aurora F37)
      vec3 gProvince = vec3(0.5);   // base fields (tectonic, volcanic, ancient) — set per fragment
      void initProvinces(vec3 pos){
        // two octaves per field (spike-validated recipe); uMacroOffset ties provinces to the
        // planet seed so every world partitions differently
        vec4 a1 = noised(pos * 0.75 + uMacroOffset + vec3(17.3, -9.1, 4.7));
        vec4 a2 = noised(pos * 1.5  + uMacroOffset + vec3(-3.2, 8.8, -12.6));
        vec4 b1 = noised(pos * 0.85 + uMacroOffset + vec3(-23.7, 5.3, 19.1));
        vec4 b2 = noised(pos * 1.7  + uMacroOffset + vec3(9.4, -15.8, 2.2));
        vec4 c1 = noised(pos * 0.65 + uMacroOffset + vec3(4.8, 27.5, -11.3));
        vec4 c2 = noised(pos * 1.3  + uMacroOffset + vec3(-19.2, -6.7, 13.9));
        gProvince = vec3(
          smoothstep(0.35, 0.65, 0.5 + 0.5 * (a1.x + 0.35 * a2.x) / 1.35),
          smoothstep(0.35, 0.65, 0.5 + 0.5 * (b1.x + 0.35 * b2.x) / 1.35),
          smoothstep(0.35, 0.65, 0.5 + 0.5 * (c1.x + 0.35 * c2.x) / 1.35));
      }
      float provinceWeight(int fid){
        float f; float fl;   // field sample (polarity applied) + floor — mirrors PROVINCES data
        if      (fid == PROV_MOUNTAINS)  { f = gProvince.x;       fl = 0.15; }
        else if (fid == PROV_CRATERS)    { f = 1.0 - gProvince.x; fl = 0.25; }
        else if (fid == PROV_CANYONS)    { f = gProvince.x;       fl = 0.20; }
        else if (fid == PROV_SCARPS)     { f = gProvince.z;       fl = 0.30; }
        else if (fid == PROV_PLATEAUS)   { f = gProvince.z;       fl = 0.20; }
        else if (fid == PROV_TESSERA)    { f = gProvince.x;       fl = 0.20; }
        else if (fid == PROV_EDIFICES)   { f = gProvince.y;       fl = 0.15; }
        else if (fid == PROV_LAVA)       { f = gProvince.y;       fl = 0.10; }
        else if (fid == PROV_CHAOS)      { f = gProvince.y;       fl = 0.25; }
        else if (fid == PROV_CRYORIDGE)  { f = 1.0 - gProvince.y; fl = 0.30; }
        else if (fid == PROV_RIVERS)     { f = 1.0 - gProvince.z; fl = 0.30; }
        else if (fid == PROV_SUBLIMATION){ f = gProvince.z;       fl = 0.40; }
        else if (fid == PROV_GLACIAL)    { f = 1.0 - gProvince.z; fl = 0.40; }
        else if (fid == PROV_FROST)      { f = gProvince.z;       fl = 1.00; }
        else if (fid == PROV_LAKES)      { f = gProvince.z;       fl = 1.00; }
        else if (fid == PROV_DELTAS)     { f = 1.0 - gProvince.z; fl = 0.30; }
        else if (fid == PROV_COAST)      { f = gProvince.z;       fl = 1.00; }
        else if (fid == PROV_OUTFLOW)    { f = 1.0 - gProvince.z; fl = 0.30; }
        else if (fid == PROV_KARST)      { f = gProvince.y; fl = 0.25; }
        else if (fid == PROV_DUNES)      { f = 1.0 - gProvince.x; fl = 0.30; }
        else if (fid == PROV_DUST)       { f = 1.0 - gProvince.x; fl = 0.50; }
        else if (fid == PROV_MASSW)      { f = gProvince.x; fl = 0.30; }
        else if (fid == PROV_BANDS)      { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_JETS)       { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_WEATHER)    { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_GREATSPOT)  { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_STORMTRAIN) { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_POLAR)      { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_LIGHTNING)  { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_CLOUDS)     { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_DAYTHERM)   { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_NIGHTTHERM) { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_LIMB)       { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_TERM)       { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_GLINT)      { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_AURORA)     { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_DUSTSTORM)  { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_MAGMA)      { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_CARBON)     { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_FACETS)     { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_HEXTESS)    { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_SHATTER)    { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_BIOMATS)    { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_MACHINE)    { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_CITYLIGHTS) { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_ECUMENOPOLIS) { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_AIRGLOW)    { f = gProvince.z; fl = 1.00; }
        else if (fid == PROV_CLOUDOPTICS){ f = gProvince.z; fl = 1.00; }
        else                             { f = 1.0;               fl = 1.00; }
        return mix(1.0, fl + (1.0 - fl) * f, uProvinceWeight);
      }

      // ── WS4 T13 (D4 move-1): in-shader province rotation of the grain strike ──
      // The baked grain cube stores a smooth WORLD-space strike that is a pure function of |lat|
      // (latitude bands — D3/D4: it carries ZERO within-body longitudinal structure). To turn those
      // zonal bands into 2D LANDFORMS that "play out across the surface" (Max's bar), each grained
      // combiner rotates its sampled strike by an angle keyed to the REAL gProvince at this fragment
      // — the SAME macroSeed-driven province field the renderer already uses for amplitude. This is
      // the ONLY within-body anti-banding source (move-2 / rotatePoleDeg is inter-body only, and the
      // smooth director adds none). It READS gProvince, never replaces it (Max decision #6: augment).
      //
      // The rotation is about the local surface normal so the strike stays TANGENT to the sphere on a
      // unit-sphere fragment, n = normalize(pos)). gProvince.x (tectonic where-mask) drives the angle;
      // centring on 0.5 keeps the mean rotation ~0 so province-neutral fragments are near-unchanged.
      // GRAIN_PROVINCE_ROT is the (small) angular gain — bounded so the shared strike still reads as
      // shared, just province-warped into 2D rather than zonal stripes.
      const float GRAIN_PROVINCE_ROT = 1.20;   // radians of strike rotation across the province range
      vec3 grainProvinceRotate(vec3 strike, vec3 pos){
        vec3 n = normalize(pos);
        // Rodrigues rotation of the strike about the surface normal n by the province-keyed angle.
        float ang = GRAIN_PROVINCE_ROT * (gProvince.x - 0.5)
                  + 0.6 * GRAIN_PROVINCE_ROT * (gProvince.z - 0.5);  // a second mask adds 2D variety
        float c = cos(ang), s = sin(ang);
        vec3 t = normalize(strike - dot(strike, n) * n);            // tangent part of the strike
        if (length(strike - dot(strike, n) * n) < 1e-4) t = strike; // already ~aligned: leave as-is
        vec3 b = cross(n, t);                                       // the other in-tangent-plane basis
        return normalize(c * t + s * b);
      }
      // vec2 (xz-plane) sibling for the orogeny axis special case (D7): fbmdRidged reads uOrogenyAxis
      // as a vec2 in the xz-plane. The cube strike is projected to xz upstream; here we rotate that 2D
      // axis in-plane by the SAME province-keyed angle so mountains co-orient with the vec3 features.
      vec2 grainProvinceRotate2(vec2 ax2, vec3 pos){
        float ang = GRAIN_PROVINCE_ROT * (gProvince.x - 0.5)
                  + 0.6 * GRAIN_PROVINCE_ROT * (gProvince.z - 0.5);
        float c = cos(ang), s = sin(ang);
        return normalize(vec2(c * ax2.x - s * ax2.y, s * ax2.x + c * ax2.y));
      }

      // ── F1 mountains: ridged-multifractal base relief (relief doc §F1) ──
      // Musgrave ridged multifractal with the Decarpentier-correct gradient. Each
      // octave's noise is FOLDED (signal = uRidgeOffset − |n.x|), SHARPENED (signal²)
      // → crisp connected crestlines; the NEXT octave is gated by clamp(signal²·gain,
      // 0,1) so ridges only grow where the previous octave was already high (connected
      // ranges, not isotropic spikes). The gradient applies the −sign(n.x) fold
      // correction AND the chain rule through the square — transcribed from the
      // vitest-pinned ridgedFold() oracle (relief doc §5.4 silent-bug gate).
      //
      // Anisotropic fold belts (orogeny): the sampling domain is stretched ACROSS a
      // per-planet strike axis (uOrogenyAxis) by mix(1,3,uOrogenyStrength) so ridges
      // elongate into parallel "Himalaya" belts rather than a radial massif. The
      // stretch is a constant SYMMETRIC linear map S on the xz-plane, so the gradient
      // transforms back by the SAME S (Sᵀ=S) — applied to grad.xz to keep stretched
      // ridge faces lit correctly.
      vec4 fbmdRidged(vec3 pos, float octaves, float fwBase){
        // WS4 T13 — orogeny vec2 special case (D7). The grain cube stores a vec3 world strike; project
        // it onto the xz-plane (uOrogenyAxis lives there) and rotate by the in-fragment province, so
        // mountain belts share the grain and acquire 2D structure. BRANCH-guarded (D6): at strength==0
        // the verbatim normalize(uOrogenyAxis) runs — no cube fetch, no mix — bytewise the pre-WS4 axis.
        vec2 ax = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate2(normalize(mix(uOrogenyAxis, normalize(sampleGrainStrike(pos).xz), uTectonicGrainStrength)), pos)
          : normalize(uOrogenyAxis);
        vec2 pe = vec2(-ax.y, ax.x);                              // across-strike axis
        float stretch = mix(1.0, 3.0, clamp(uOrogenyStrength, 0.0, 1.0));
        // S·xz : keep the along-strike component, scale the across-strike component
        vec2 xz0 = pos.xz;
        vec2 xzS = dot(xz0, ax) * ax + (dot(xz0, pe) * stretch) * pe;
        vec3 q = vec3(xzS.x, pos.y, xzS.y);

        float freq = uNoiseScale * 0.3;
        float amp = 0.5;
        float weight = 1.0;                                       // Musgrave: octave 0 unweighted
        float h = 0.0;
        vec3 grad = vec3(0.0);
        for (int i = 0; i < 12; i++){
          if (float(i) >= octaves) break;
          // Same anti-shimmer discipline as fbmd(): trailing-octave fade + fwidth
          // clamp. The abs() fold's sign flips alias VIOLENTLY at high freq (relief
          // doc §5.3 risk #3) — fading sub-pixel octaves to their mean is mandatory,
          // not optional, for ridged terrain. fwBase is the SCALED input's footprint.
          float fade = clamp(octaves - float(i), 0.0, 1.0);
          if (uFwClamp == 1) fade *= 1.0 - smoothstep(0.4, 0.8, fwBase * freq);
          vec4 n = noised(q * freq + uMacroOffset + uMountainDomainOffset); // share macro seed (+🎲 offset)
          float signal = uRidgeOffset - abs(n.x);                 // fold
          float sq = signal * signal;                             // sharpen
          h    += amp * weight * fade * sq;
          // d(sq)/dpos = 2·signal·(−sign(n.x))·(freq·n.yzw); weight = locally-const gain
          grad += amp * weight * fade * (2.0 * signal * -sign(n.x)) * freq * n.yzw;
          weight = clamp(sq * uRidgeGain, 0.0, 1.0);              // gate the next octave
          amp  *= 0.5;
          freq *= 2.0;
        }
        // transform grad from stretched space back to real pos (S symmetric on xz)
        vec2 gxz = grad.xz;
        vec2 gReal = dot(gxz, ax) * ax + (dot(gxz, pe) * stretch) * pe;
        return vec4(h, gReal.x, grad.y, gReal.y);
      }

      // ── F11 drainage primitive (ported from fluvial-drainage-lab.html, proven on :9223) ──
      // Pure, no side effects. Returns vec4(channelStrength in [0,1], d(channel)/dpos).
      // Channels = near-zero band of a domain-warped FBM field (trunks); a finer tributary
      // octave is gated to a WIDE APRON approaching the trunk and UNIONed via max(), so
      // feeders connect INTO trunks (dendritic) instead of forming overlaid loops. The
      // gradient follows the union winner (analytic, fbmdRidged fold/chain-rule discipline)
      // so perturbAnalytic lights the channel walls — junctions included.
      vec4 drainageField(vec3 pos){
        vec4 wn = noised(pos * uFluvialWarpFreq + uFluvialOffset);
        vec3 q  = pos + uFluvialMeander * uFluvialWarpAmt * wn.yzw;     // warp by noise grad (curl-free)
        vec4 f       = noised(q * uFluvialFreq + uFluvialOffset);
        float field  = f.x;
        vec3  dfield = f.yzw * uFluvialFreq;
        float af    = abs(field);
        float chan  = 1.0 - smoothstep(0.0, uFluvialWidth, af);        // trunk channel
        float dstep = (af < uFluvialWidth) ? (6.0*(af/uFluvialWidth)*(1.0-af/uFluvialWidth))/uFluvialWidth : 0.0;
        vec3  dchan = -dstep * sign(field) * dfield;
        // tributaries: finer channels allowed ONLY in a wide apron approaching the trunk
        float apron = 1.0 - smoothstep(uFluvialWidth, uFluvialTribGate, af);  // 1 near trunk, 0 far
        float w2    = uFluvialWidth * 0.6;
        vec4 f2     = noised(q * uFluvialFreq * uFluvialTribLac + uFluvialOffset);
        float af2   = abs(f2.x);
        float chan2 = (1.0 - smoothstep(0.0, w2, af2)) * apron;
        float dstep2 = (af2 < w2) ? (6.0*(af2/w2)*(1.0-af2/w2))/w2 : 0.0;
        vec3  dchan2 = -dstep2 * sign(f2.x) * (f2.yzw * uFluvialFreq * uFluvialTribLac) * apron;
        float c  = max(chan, chan2);                                    // union: branching tree
        vec3  dc = (chan >= chan2) ? dchan : dchan2;                    // grad follows the winner
        return vec4(c, dc);
      }

      // ── F11 fluvialCombiner (Stage-4) — carves the drainage network into the shared
      // canyonHeight accumulator, biased toward low ground, bending grad so perturbAnalytic
      // lights the walls. uFluvialDensity≤0 ⇒ early-out (Stage-A base untouched, regression-safe).
      // Writes fluvialWet for the Stage-6 species floor-tint. Sharing canyonHeight lets a future
      // F14 lake pass pool liquid in these channels for free.
      void fluvialCombiner(vec3 pos, inout float h, inout float canyonHeight, inout vec3 grad, inout float fluvialWet){
        if (uFluvialDensity <= 0.0) return;
        // low-ground preference — mix between "channels everywhere" (flat worlds keep their
        // network) and "low ground only" (rivers stay out of peaks), per uFluvialLowBias.
        float lowGround = mix(1.0, smoothstep(uFluvialHiGround, 0.0, h), uFluvialLowBias);
        vec4 d = drainageField(pos);
        float chan = d.x;
        vec3  dchan = d.yzw;
        float depth = uFluvialDepth * mix(0.35, 1.0, uFluvialActivity);  // relict = shallower
        float pw = provinceWeight(PROV_RIVERS);                          // §8: networks favor young lowlands
        float s = chan * lowGround * uFluvialDensity * pw;
        float carve = -s * depth;                                        // carve DOWN
        canyonHeight += carve;
        h            += carve;
        // d(carve)/dpos ≈ -depth·uFluvialDensity·lowGround·dchan  (d(lowGround)/dh second-order,
        // dropped — same chain-rule shortcut as scarp/glacial combiners).
        grad += -depth * uFluvialDensity * pw * lowGround * dchan;
        fluvialWet = max(fluvialWet, s);
      }

      // ── F13 outflowField — the megaflood trunk: structurally drainageField() minus the
      // tributary octave (catastrophic floods scour ONE channel, not a dendritic tree).
      // Own seed (uOutflowOffset + a constant decorrelation vector, province-style) so the
      // trunk is NOT an F11 channel; warp noise at half the trunk freq and low uOutflowWarpAmt
      // (floods run straight). Relict (low uOutflowActivity) WIDENS the wall smoothstep —
      // degraded banks — per card §6.5.2. Returns vec4(chan, dchan) like drainageField;
      // the RAW field gradient (flow-direction source for islands/grooves) via out, since
      // dchan vanishes at the channel centerline exactly where islands live. Same gradient
      // shortcut as drainageField: the warp's dq/dpos term is dropped (q ≈ pos chain rule).
      vec4 outflowField(vec3 pos, out vec3 dfieldOut){
        vec3 off = uOutflowOffset + vec3(31.7, -12.9, 8.3);   // decorrelate from uFluvialOffset at default (0,0,0)
        vec4 wn = noised(pos * (uOutflowFreq * 0.5) + off);
        vec3 q  = pos + uOutflowWarpAmt * wn.yzw;             // broad gentle bends, warp by noise grad
        vec4 f  = noised(q * uOutflowFreq + off);
        float field  = f.x;
        vec3  dfield = f.yzw * uOutflowFreq;
        dfieldOut    = dfield;
        float w  = uOutflowWidth * mix(1.5, 1.0, uOutflowActivity);   // relict ⇒ wider, degraded banks
        float af = abs(field);
        float chan  = 1.0 - smoothstep(0.0, w, af);                   // trunk band
        float dstep = (af < w) ? (6.0*(af/w)*(1.0-af/w))/w : 0.0;
        vec3  dchan = -dstep * sign(field) * dfield;
        return vec4(chan, dchan);
      }

      // ── F13 outflowCombiner (Stage-4) — carves the megaflood scour into the shared
      // canyonHeight accumulator (F14 lakes can pool in the scour; F12/F14 downstream see
      // the carved h). Runs immediately AFTER fluvialCombiner: same accumulator, distinct
      // geomorphic event. Three terms, all relief-only (card §4: lighting-routed, NO albedo
      // writes — the posterize-survival route): (1) FLAT-FLOORED scour — plateau
      // smoothstep(0, 0.35, chan) saturates mid-band so the carve bottoms out flat and the
      // walls live at the band edge (distinct silhouette from F4's V); (2) streamlined
      // islands — voronoi3d-F1 bumps in a domain compressed 3.5:1 along the flow tangent
      // t = normalize(cross(dfield, pos)) so noses/tails align downstream, restoring height
      // toward the pre-carve rim (capped: islandH ≤ −carve); (3) longitudinal grooves —
      // faint ridges constant along t (1D noise on the across-flow coordinate), ≤15% of
      // carve depth via the uOutflowGrooves slider cap. Every term carries an analytic
      // gradient into grad (t and the flow direction held locally constant — the documented
      // cosmetic-grad convention, cf. fluvial lowGround). uOutflowDensity <= 0 ⇒ early-out;
      // chan <= 0 ⇒ exact-zero contribution, return early (deltaCombiner branch precedent).
      // AC5 (rivers-fluvial-coupling): the megaflood outflow is now PLACED on the REAL
      // Strahler trunk. 'order' is the baked B channel of the carve cube (normalized stream
      // order, ~0 off-channel, peaks on the high-order trunks). realTrunk gates/places the
      // scour at the real high-order reach instead of outflowField's decorrelated noise band.
      // outflowField is STILL called — but only for dfield, to orient the cosmetic islands/
      // grooves morphology so the scour reads as a distinct landform. The scour PROFILE
      // (flat floor + islands + grooves) is unchanged; only PLACEMENT becomes causal.
      // 'order'/realTrunk are treated as locally-CONSTANT in the gradient (the AC4 'mouth'
      // convention) — so every old placement-gradient (dplateau/dsP/dchan) term is ZERO and
      // removed; only the intrinsic island (dbump) + groove (dgn) gradient terms survive.
      void outflowCombiner(vec3 pos, inout float h, inout float canyonHeight, inout vec3 grad, float order){
        // high-order reaches only: B peaks at trunks. Below ~0.45 = headwaters/off-channel,
        // full scour by ~0.8. (Placement envelope — replaces outflowField's chan band.)
        float realTrunk = smoothstep(0.45, 0.8, order);
        if (uOutflowDensity <= 0.0 || realTrunk <= 0.0) return;
        vec3 dfield;
        outflowField(pos, dfield);                             // ONLY for dfield (flow frame); chan no longer gates
        // same low-ground mix as F11 (shared knobs — floods empty into the same lowlands)
        float lowGround = mix(1.0, smoothstep(uFluvialHiGround, 0.0, h), uFluvialLowBias);
        float pw = provinceWeight(PROV_OUTFLOW);               // §8: flood products favor young lowlands
        float depth = uOutflowDepth * mix(0.45, 1.0, uOutflowActivity);   // relict = shallower
        float gateK = lowGround * uOutflowDensity * pw;
        float s = realTrunk * gateK;                           // placement envelope = real trunk (was plateau)
        float carve = -s * depth;                              // scour DOWN
        canyonHeight += carve;
        h            += carve;
        // NB: no placement-gradient term — realTrunk/order held locally constant (AC4 'mouth' convention)
        // flow frame — across-flow direction (raw field gradient) + downstream tangent
        vec3 fdir = dfield / max(length(dfield), 1e-5);
        vec3 tv   = cross(fdir, pos);
        vec3 t    = tv / max(length(tv), 1e-5);
        // (2) streamlined islands — voronoi3d F1 in a domain compressed along t (3.5:1
        // stretch in world space): teardrop obstacles, tails agreeing with the trunk flow.
        if (uOutflowIslands > 0.0 && s > 0.001){
          float islScale = uOutflowFreq * 8.0;
          vec3 ip = pos * islScale + uOutflowOffset;
          vec3 q  = ip - (1.0 - 1.0/3.5) * dot(ip, t) * t;     // compress along-flow ⇒ 3.5:1 stretched cells
          vec3 cellId, vgrad;
          vec2 ff = voronoi3d(q, uVoroCells, cellId, vgrad);
          float tb = min(ff.x / 0.45, 1.0);
          float bump = 1.0 - tb*tb*(3.0 - 2.0*tb);             // 1 at cell center → 0 at r = 0.45
          float dsB = (ff.x < 0.45) ? (6.0*tb*(1.0-tb))/0.45 : 0.0;
          // dF1/dpos = Jᵀ·vgrad with J = islScale·(I − 0.714·t⊗t) (t held const; symmetric ⇒ Jᵀ=J)
          vec3 dF1 = islScale * (vgrad - (1.0 - 1.0/3.5) * dot(vgrad, t) * t);
          vec3 dbump = -dsB * dF1;
          // islands restore height toward the pre-carve rim; bump·uOutflowIslands ≤ 1 ⇒ never above it
          float islandH = uOutflowIslands * bump * s * depth;
          canyonHeight += islandH;
          h            += islandH;
          grad += uOutflowIslands * depth * s * dbump;         // intrinsic island grad only (placement held const ⇒ dplateau term gone)
        }
        // (3) longitudinal grooves — 1D noise on the across-flow coordinate ⇒ ridges
        // aligned with t; amplitude ≤ 15% of carve depth (slider cap), floor-mask gated via s.
        if (uOutflowGrooves > 0.0 && s > 0.001){
          float xc = dot(pos, fdir);
          vec4 gn = noised(vec3(xc * uOutflowGrooveFreq, 4.7, -9.3) + uOutflowOffset);
          float groove = uOutflowGrooves * depth * gn.x * s;
          canyonHeight += groove;
          h            += groove;
          vec3 dgn = gn.y * uOutflowGrooveFreq * fdir;          // 1D chain rule (fdir held const)
          grad += uOutflowGrooves * depth * s * dgn;            // intrinsic groove grad only (placement held const ⇒ dplateau term gone)
        }
      }

      // ── F21 karstRidged — small dedicated 2-octave ridged slot sampler (card §6.5.3).
      // The labyrinth valley network is the CRESTLINE SET of a folded noise — fbmdRidged's
      // fold (signal = so − |n.x|) with the −sign(n.x) chain-rule correction — used
      // NEGATIVELY: where a ridged field would raise crests, dissolution carves slots.
      // Own seed (uKarstOffset + constant decorrelation) and own uKarstMazeFreq:
      // deliberately NOT coupled to the F1 mountain uniforms (uRidgeOffset/uRidgeGain).
      // Maturity WIDENS the fold acceptance so (so up ⇒ more of the field inside a slot)
      // dissection density rises monotonically: shallow grooves → connected maze.
      // Returns vec4(slot in [0,~1], dslot/dpos). so ≥ 0.35 always ⇒ the /so is safe.
      vec4 karstRidged(vec3 pos){
        vec3 off = uKarstOffset + vec3(-14.1, 23.9, -7.7);   // decorrelate from fluvial/outflow at default (0,0,0)
        float so = mix(0.35, 0.9, uKarstMaturity);           // fold width: maturity ⇒ wider dissection
        float slot = 0.0;
        vec3 dslot = vec3(0.0);
        float freq = uKarstMazeFreq;
        float amp  = 0.65;
        for (int i = 0; i < 2; i++){
          vec4 n = noised(pos * freq + off);
          float sig = max(so - abs(n.x), 0.0) / so;          // fold, normalized to [0,1]
          slot += amp * sig * sig;                           // sharpen: slot walls steepen, floors flatten
          // d(sig²)/dpos = 2·sig·(−sign(n.x)/so)·(freq·n.yzw) — zero outside the fold (sig clamped)
          if (sig > 0.0) dslot += amp * (2.0 * sig / so) * -sign(n.x) * freq * n.yzw;
          freq *= 2.3;
          amp  *= 0.5;
        }
        return vec4(slot, dslot);
      }

      // ── F21 karstCombiner (Stage-4) — dissolution terrain: a solvent chemically eats
      // soluble crust (card §4: rate ∝ undersaturation × lithology kinetics — one shader,
      // species-switched constants). Sibling of fluvialCombiner/outflowCombiner, called
      // right after F13 and BEFORE the F12 delta + F14 sea cut — so pit/slot floors carved
      // below uSeaLevel inherit the species fill/tint and become COLLAPSE LAKES with zero
      // karst-side code (card §6.5.5). Two unioned (summed — they occupy different ground)
      // terms, both PURE RELIEF (no albedo/fluvialWet writes — posterize-survival route):
      // (1) DOLINES — rimless Worley pits (voronoi3d F1 smoothstep bowls; NO raised rim —
      //     the §6-item-1 discriminator vs F2 craters) gated to LOW ground (F11's shared
      //     lowGround mix — dolines pull drainage inward on flats) × a gentle-slope gate
      //     on |grad| (no pits on mountain walls);
      // (2) LABYRINTH — a dissected plateau: smoothstep plateau mask on accumulated h ×
      //     karstRidged slot carve, leaving flat-topped polygonal remnants between
      //     through-going valley slots (Titan T-120 'plateau minus slots', §6 item 2).
      // uKarstMaturity deepens both terms and widens dissection monotonically (§6 item 3).
      // Gates (lowGround/gentle/province) are locally-constant in the gradient (the
      // documented cosmetic-grad convention); the plateau mask's d(pm)/dpos rides the
      // INCOMING grad (the plateau edge is a real height feature — remnant rims light).
      // uKarstDensity <= 0 ⇒ early-out: Stage-A base byte-identical, regression-safe.
      void karstCombiner(vec3 pos, inout float h, inout float canyonHeight, inout vec3 grad){
        if (uKarstDensity <= 0.0) return;
        float hIn = h;
        vec3  gradIn = grad;                                   // gates/masks read entry state
        float pw = provinceWeight(PROV_KARST);                 // §8: soluble-lithology provinces
        // (1) dolines — rimless pits on low/flat ground
        float lowGround = mix(1.0, smoothstep(uFluvialHiGround, 0.0, hIn), uFluvialLowBias);
        float gentle = 1.0 - smoothstep(0.5, 1.2, length(gradIn));   // flats only (cf. F20 cliff slope)
        float gateD = lowGround * gentle * uKarstDensity * pw;
        if (gateD > 0.001){
          vec3 cellId; vec3 vgrad;
          vec2 ff = voronoi3d(pos * uKarstDolineFreq + uKarstOffset + vec3(7.9, -18.3, 12.1),
                              uVoroCells, cellId, vgrad);
          float tp = min(ff.x / max(uKarstDolineR, 1e-4), 1.0);
          float pit = 1.0 - tp*tp*(3.0 - 2.0*tp);              // 1 at cell center → 0 at r = R; NO rim
          if (pit > 0.0){
            float dsP = (ff.x < uKarstDolineR) ? (6.0*tp*(1.0-tp))/uKarstDolineR : 0.0;
            vec3 dF1 = uKarstDolineFreq * vgrad;               // chain rule through the domain scale
            float dDepth = uKarstDolineDepth * mix(0.4, 1.0, uKarstMaturity);
            float carve = -gateD * pit * dDepth;               // carve DOWN (closed, inward-draining)
            canyonHeight += carve;
            h            += carve;
            grad += gateD * dDepth * dsP * dF1;                // d(carve)/dpos = −gateD·dDepth·d(pit)
          }
        }
        // (2) labyrinth — plateau mask × slot carve (uses ENTRY h: the pre-karst surface)
        float tpm = clamp((hIn - uKarstPlateauLvl) / 0.08, 0.0, 1.0);
        float pm  = tpm*tpm*(3.0 - 2.0*tpm);                   // smoothstep(lvl, lvl+0.08, hIn)
        if (pm > 0.001){
          vec4 r = karstRidged(pos);
          float mDepth = uKarstMazeDepth * mix(0.25, 1.0, uKarstMaturity);
          float gateM = uKarstDensity * pw;                    // NO lowGround — the plateau IS high ground
          float carve = -gateM * pm * r.x * mDepth;
          canyonHeight += carve;
          h            += carve;
          float dsPm = (tpm > 0.0 && tpm < 1.0) ? (6.0*tpm*(1.0-tpm))/0.08 : 0.0;
          grad += -gateM * mDepth * (pm * r.yzw + r.x * dsPm * gradIn);
        }
      }

      // ── F15 duneCombiner (Stage-5 aeolian) — linear ergs v1: wind saltates loose grains
      // into migrating ridges (card §4 Bagnold: flux needs air over a transport threshold —
      // that D6/D5 gate lives in the DRIVEN uDuneDensity, airless ⇒ 0). Closed-form stand-in
      // for the Werner/Paris transport sims (determinism constraint, card §4): a zonal (D8)
      // wind ⇒ linear dunes run E-W, so the across-wind coordinate is latitude pos.y (the
      // §3.2 banding trick re-aimed) and the ridge field is an ASYMMETRIC SAWTOOTH on
      // t = fract(phase): long stoss ramp over t∈[0,0.72] × steep slip face over t∈[0.72,1]
      // (product of smoothsteps — both ends sit at ridge=0 with zero slope, so the fract
      // wrap has no lighting seam; the 0.72 split is the angle-of-repose asymmetry read).
      // Phase warp = ONE low-freq noised() on its own uDuneOffset seed — ridges thread and
      // diverge around obstacles (Titan Shangri-La). The phase derivative is EXACT
      // (d(fract)=1 a.e., warp chain-ruled); the wind frame is locally constant (documented
      // cosmetic-grad convention). Dunes are a DEPOSIT: h += positive relief, and
      // canyonHeight is NOT written — that accumulator records incision (F4/F11/F13/F21
      // carves) and nothing downstream of the chain reads it today, so a deposit entry
      // would be both semantically wrong and inert. Sand-supply mask on ENTRY state:
      // F11's lowGround mix (sand pools in basins — deposits flow AROUND mountains) ×
      // gentle-slope gate on entry |grad| (karst's 0.5→1.2 — sand doesn't hang on cliffs)
      // × equatorial belt mix(1, 1−ss(0.25,0.6,|lat|), uDuneBelt) × uDuneDensity ×
      // provinceWeight(PROV_DUNES). No absolute-h floor anywhere ⇒ low-relief worlds
      // (Titan) pass the masks (the F21 plateauLvl lesson). sand=0 ⇒ base untouched
      // (§6 item 7); uDuneDensity <= 0 ⇒ early-out: Stage-A base byte-identical. v1 scope
      // cuts (card §6.5.8): linear ergs ONLY — barchans/star/yardangs/streaks deferred.
      void duneCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uDuneDensity <= 0.0) return;
        float hIn = h;
        vec3  gradIn = grad;                                   // mask reads entry state
        float lowGround = mix(1.0, smoothstep(uFluvialHiGround, 0.0, hIn), uFluvialLowBias);
        float gentle = 1.0 - smoothstep(0.5, 1.2, length(gradIn));   // flats only (cf. F21)
        float belt = mix(1.0, 1.0 - smoothstep(0.25, 0.6, abs(pos.y)), uDuneBelt);
        float sand = lowGround * gentle * belt * uDuneDensity * provinceWeight(PROV_DUNES);
        if (sand <= 0.001) return;
        // wind frame + phase — across-wind coordinate is latitude; warp threads the ridges
        vec4 w = noised(pos * 1.7 + uDuneOffset + vec3(11.3, -6.1, 19.7));
        float ph = pos.y * uDuneFreq + uDuneWarp * w.x;
        vec3 dph = uDuneFreq * vec3(0.0, 1.0, 0.0) + uDuneWarp * 1.7 * w.yzw;
        float t  = fract(ph);
        // asymmetric sawtooth: stoss smoothstep(0,0.72,t) × slip 1−smoothstep(0.72,1,t)
        float tu = min(t / 0.72, 1.0);
        float td = clamp((t - 0.72) / 0.28, 0.0, 1.0);
        float up    = tu*tu*(3.0 - 2.0*tu);
        float down  = 1.0 - td*td*(3.0 - 2.0*td);
        float ridge = up * down;
        // exact piecewise d(ridge)/dt — regions exclusive: stoss has down≡1, slip has up≡1
        float dridge = (t < 0.72) ? (6.0*tu*(1.0-tu)) / 0.72
                                  : -(6.0*td*(1.0-td)) / 0.28;
        h    += uDuneAmp * ridge * sand;
        grad += uDuneAmp * sand * dridge * dph;                // sand locally constant
      }

      // ── F16 dustCombiner (Stage-5 aeolian) — settled-fallout mantle: near-uniform
      // atmospheric fallout drapes topography and a deep mantle erases high-frequency
      // relief first (card §4 diffusive read). ATTENUATION, not carve — the lavaCombiner
      // precedent h *= (1-x); grad *= (1-x) so depth 0 returns the accumulated relief
      // EXACTLY (card §6 item 7). Less grad ⇒ fewer dither transitions ⇒ a visibly
      // smoother posterized surface ("route detail through normals" in reverse).
      // Settling weight (card §6.5.2) = depth × region × flatness × province:
      //   region   — ONE low-freq noised() on its own uDustOffset seed, smoothstep
      //              SYMMETRIC about the noise median 0.5 (0.35→0.65): ~half the sphere
      //              carries mantle at depth 1 (the 40-60% coverage pre-check) and the
      //              0.3-wide margin keeps the edge gradational — no posterize-amplified
      //              contour (card §6 item 6).
      //   flatness — the research doc's slope damp 1/(1+k·dot(grad,grad)) on ENTRY grad,
      //              repurposed as a settling weight: dust survives flats/lows, strips
      //              from steep windswept faces (card §6 item 3). Denominator ≥ 1 —
      //              divide guarded by construction. No absolute-h gate (the F21 trap).
      //   province — PROV_DUST: dunes' old-plains polarity, floor 0.50 (fallout is
      //              near-global; mantles thin over young terrain, never vanish).
      // atten clamps at 0.85 so full loess never erases the sphere itself. Exports
      // dustCover (= atten) for the Stage-6 ochre lift; the Stage-8 veil reads
      // uDustDepth directly (airborne haze is whole-disk, not region-masked). Called
      // after duneCombiner (dust settles over the ergs), before lavaCombiner (fresh
      // basalt punches through any mantle — lava's own attenuation runs last).
      // OUT-param discipline: dustCover written FIRST, before the early-out, so the
      // caller's variable is always defined. v1 scope cuts (card §6.5.8): the Mars
      // 30-60° latitude-gate, dust devils/storm veil (F40), species-keyed colors.
      void dustCombiner(vec3 pos, inout float h, inout vec3 grad, out float dustCover){
        dustCover = 0.0;                                       // ALWAYS written (early-out below)
        if (uDustDepth <= 0.0) return;
        vec4 rn = noised(pos * uDustRegionFreq + uDustOffset + vec3(7.7, -3.9, 13.1));
        float region = smoothstep(0.35, 0.65, 0.5 + 0.5 * rn.x);
        float flatness = 1.0 / (1.0 + uDustFlatK * dot(grad, grad));   // entry grad
        float atten = min(uDustDepth * region * flatness * provinceWeight(PROV_DUST), 0.85);
        h    *= (1.0 - atten);
        grad *= (1.0 - atten);
        dustCover = atten;
      }

      // ── F19 massWastCombiner (Stage-5 gradational) — slope material fails under gravity
      // and runs out as talus aprons + landslide tongues (card §4: Roering creep regime +
      // discrete-failure regime, both faked closed-form — no cellular thermal-erosion sim,
      // the determinism constraint). Called AFTER every steep-relief host (mountains/craters/
      // canyons/karst/scarps/edifices/glacial...) and BEFORE duneCombiner — dunes/dust then
      // mantle OVER the deposits; lava still suppresses last per its contract.
      // FOOT-OF-STEEPS GATE (the load-bearing fork, logged in card §7): the card's F17-style
      // low-freq REGIONAL slope probe is host-BLIND — a decorrelated noise field cannot see
      // whether scarps/craters are enabled, so pure-solo would still sprout deposits — and
      // the raw entry |grad| is dominated by base-FBM octave noise (measured CPU-side
      // 2026-06-10: tangential |grad| median 0.89, p99 2.19 at 6 octaves — any threshold on
      // it is either planet-wide wash or misses walls; the same reason F17 refuses the
      // accumulated grad for flow direction). The EXACT host signal is free instead: the
      // call site already holds the base-FBM gradient (hd.yzw), so hostGrad = gradIn -
      // gradBase is precisely the accumulated HOST-relief gradient — identically vec3(0.0)
      // when hosts are off, so pure-solo produces zero deposits NATURALLY (card §6 item 3,
      // no special-casing). Tangential projection of hostGrad (the F17 gT idiom) gives
      // sHost, the wall slope, in units of R = uRepose (driven ∝ g^-0.4: low-g ⇒ higher
      // repose ⇒ steeper standing walls + shorter aprons, §6 item 8):
      //   steepNearby = smoothstep(0.6R, 1.1R, sHost)          — rises through the wall foot
      //   clingable   = 1 - smoothstep(1.8R, 3.0R, sHost)      — sheer faces shed, stay rough
      //   localOK     = 1 - smoothstep(1.2R, 2.4R, |gradIn|)   — the card's entry-grad window,
      //                 edges widened (entry grad carries the FBM floor; the card's 0.7R→R
      //                 edges would zero the zone — same measurement as above)
      // zone = product × density × province: the deposit band drapes the LOWER WALL + foot
      // (slope near repose — a talus surface IS a repose-angle surface) and §6 item 6's
      // "bury the lower wall's texture" comes from the F16-convention grad attenuation.
      // TALUS (creep regime): additive fill h += amp·zone (zone held locally-constant —
      // documented cosmetic-grad convention; its true derivative needs second derivatives
      // of the accumulated h) + grad *= (1 - 0.6·zone) smoothing — SMOOTHNESS is the read:
      // calm dither bands against busy wall texture (§6 items 1, 7). uLdaFat scales amp by
      // (1 + fat): the icy lobate-debris-apron variant is a FATTER convex collar, not
      // separate geometry (v1 simplification, card §6.5.3). LOBES (failure regime):
      // voronoi3d tongues on the steep mask, domain COMPRESSED along the downhill unit
      // dn = -hostT/sHost so cells stretch 2.5:1 downslope (F13's streamlined-island
      // Jacobian-transpose machinery, axis = dn instead of the flow tangent; dn comes from
      // the HOST gradient, not gradIn — the F17 incoherent-direction lesson). A per-cell
      // hash keeps ~60% of wall cells (failures are EPISODIC events — one quake, one slide,
      // card §1; the crater per-cell-hash precedent) and a narrow second smoothstep ring on
      // the downhill end only (downEnd via dot(vgrad, dn)) raises the terminal edge —
      // kept because it is cheap: pure ALU reuse of ff.x, no extra noise/voronoi samples.
      // sHost <= 1e-4 skips the lobe block entirely (guarded normalize). uMassWastDensity
      // <= 0 OR steepNearby ~ 0 ⇒ exact-zero contribution: Stage-A base byte-identical.
      // v1 scope cuts (card §6.5.8): sturzstrom long-runout scaling, slump terraces, flow
      // diversion around obstacles, separate LDA geometry, repose-envelope height clamp.
      void massWastCombiner(vec3 pos, vec3 gradBase, inout float h, inout vec3 grad){
        if (uMassWastDensity <= 0.0) return;
        vec3  gradIn = grad;                                   // gates read entry state
        vec3  hostGrad = gradIn - gradBase;                    // EXACT accumulated host-relief gradient
        vec3  nrm = normalize(pos);
        vec3  hostT = hostGrad - nrm * dot(hostGrad, nrm);     // tangential component (F17 gT idiom)
        float sHost = length(hostT);
        float steepNearby = smoothstep(uRepose * 0.6, uRepose * 1.1, sHost);
        if (steepNearby <= 0.001) return;                      // flats + pure-solo: exact-zero, base byte-identical
        float clingable = 1.0 - smoothstep(uRepose * 1.8, uRepose * 3.0, sHost);
        float localOK   = 1.0 - smoothstep(uRepose * 1.2, uRepose * 2.4, length(gradIn));
        float pw   = provinceWeight(PROV_MASSW);               // §8: deposits live where steeps live
        float zone = steepNearby * clingable * localOK * uMassWastDensity * pw;
        float fat  = 1.0 + uLdaFat;                            // icy LDA variant = fatter collar (v1)
        // (1) talus apron — additive fill + F16-convention grad smoothing on the deposit
        h    += uTalusAmp * fat * zone;
        grad *= 1.0 - 0.6 * zone;                              // zone <= 1 ⇒ multiplier >= 0.4, never flips
        // (2) landslide tongues — downhill-stretched voronoi cells seeded on the steep mask
        if (sHost > 1e-4){
          vec3 dn = -hostT / sHost;                            // downhill unit, tangent plane (divide guarded)
          vec3 lp = pos * uLobeFreq + uMassWastOffset + vec3(-21.3, 9.7, 5.1);   // own seed, decorrelated
          vec3 q  = lp - (1.0 - 1.0/2.5) * dot(lp, dn) * dn;   // compress along dn ⇒ 2.5:1 stretched cells
          vec3 cellId; vec3 vgrad;
          vec2 ff = voronoi3d(q, uVoroCells, cellId, vgrad);
          float keep = step(hash33(cellId + vec3(5.7, -2.3, 8.9)).x, 0.6);   // episodic: ~60% of wall cells fail
          float lAmp = uLobeAmp * fat * steepNearby * localOK * keep * uMassWastDensity * pw;
          if (lAmp > 0.0001){
            float tb = min(ff.x / 0.55, 1.0);
            float bump = 1.0 - tb*tb*(3.0 - 2.0*tb);           // 1 at the seed → 0 at the skirt edge
            float dsB = (ff.x < 0.55) ? (6.0*tb*(1.0-tb))/0.55 : 0.0;
            // dF1/dpos = J^T·vgrad with J = uLobeFreq·(I - 0.6·dn⊗dn) (dn held const; symmetric ⇒ J^T = J)
            vec3 dF1 = uLobeFreq * (vgrad - (1.0 - 1.0/2.5) * dot(vgrad, dn) * dn);
            h    += lAmp * bump;
            grad += lAmp * -dsB * dF1;                         // gates + dn held locally constant
            // terminal-edge ring — narrow smoothstep band just inside the skirt, downhill end only
            float downEnd = smoothstep(0.0, 0.7, dot(vgrad, dn));   // vgrad = unit seed→fragment direction
            float t1 = clamp((tb - 0.62) / 0.23, 0.0, 1.0);
            float t2 = clamp((tb - 0.85) / 0.15, 0.0, 1.0);
            float ring  = (t1*t1*(3.0 - 2.0*t1)) * (1.0 - t2*t2*(3.0 - 2.0*t2));
            float dring = (6.0*t1*(1.0-t1))/0.23 * (1.0 - t2*t2*(3.0 - 2.0*t2))
                        - (t1*t1*(3.0 - 2.0*t1)) * (6.0*t2*(1.0-t2))/0.15;
            float rAmp = lAmp * 0.4 * downEnd;                 // downEnd held const (cosmetic-grad convention)
            h    += rAmp * ring;
            grad += rAmp * dring * (1.0/0.55) * dF1;           // chain rule through tb = ff.x/0.55
          }
        }
      }

      // ── F12 deltas & alluvial fans (Stage-4 Fluvial, card §6.5) — the DEPOSITIONAL mirror
      // of F11's erosional carve. Sediment drops where flow decelerates (Exner: deposition at
      // base level): gate = the baked carve-cube mouth field (G, the real routed river mouths,
      // sized by accum — AC4, 2026-06-19; replaces the retired F11 fluvialWet noise gate) × a
      // base-level proximity band. uDeltaDensity demotes to an intensity-only climate multiplier.
      // The apron ADDS height
      // (positive material standing above the basin/sea floor); its lit edge is the nearBase
      // falloff, chain-ruled exactly through h (mouth held locally-constant — the
      // documented cosmetic-grad convention, cf. fluvial lowGround). Writes back into
      // fluvialWet so the Stage-6 species floor-tint brightens the lobe (card §4's
      // one-band-brighter sediment read). baseLvl: sea worlds deposit at the shoreline
      // (uSeaLevel); dry/relict worlds (uSeaLevel = -1) deposit into low basins below
      // h ≈ -0.05 — the Mars relict-fan case. Called LATE in the chain (after lavaCombiner,
      // before the F14 cut) so the proximity test sees the final accumulated height.
      // uDeltaDensity <= 0 ⇒ early-out (Stage-A base + F11 untouched, regression-safe).
      void deltaCombiner(vec3 pos, inout float h, inout vec3 grad, inout float fluvialWet, float mouth){
        if (uDeltaDensity <= 0.0) return;
        if (mouth <= 0.0) return;                                 // AC4: no real river mouth here ⇒ no delta (dummy cube .g=0 ⇒ dormant)
        float baseLvl = (uSeaLevel > -1.0) ? uSeaLevel : -0.05;   // shoreline on sea worlds; low basins on dry/relict
        float dh = h - baseLvl;
        if (dh <= 0.0 || dh >= uDeltaApronH) return;            // subaerial apron band only
        float t = dh / uDeltaApronH;
        float nearBase = 1.0 - t*t*(3.0 - 2.0*t);               // 1 at base level → 0 at band top
        float dnear = -(6.0*t*(1.0-t)) / uDeltaApronH;          // d(nearBase)/dh (exact)
        // Deposit bounded to the band scale: |dnear| peaks at 1.5/uDeltaApronH, so capping k
        // at 0.6·uDeltaApronH bounds |k·dnear| ≤ 0.9 — the gradient multiplier (1 + k·dnear)
        // stays positive for EVERY knob combination (review 2026-06-10: uncapped, amp 0.2 at
        // apronH 0.02 reached |k·dnear| = 15 → flipped, 14×-amplified lighting in the band).
        // AC4: 'mouth' (baked carve-cube .g, locally-CONSTANT in the gradient like fluvialWet was)
        // is the SPATIAL gate — deltas form WHERE real river mouths are; uDeltaDensity is the
        // climate INTENSITY multiplier only (no longer a location/presence gate). Finite-diff
        // parity preserved: mouth contributes no pos-varying term to the analytic gradient.
        float k = min(uDeltaAmp * uDeltaDensity * mouth * provinceWeight(PROV_DELTAS),
                      0.6 * uDeltaApronH);
        float apron = k * nearBase;
        h += apron;
        // d(apron)/dpos = k · d(nearBase)/dh · grad(h) — counteracts the underlying slope
        // (fans flatten against the front); the k cap above guarantees no flip.
        grad += k * dnear * grad;
        fluvialWet = max(fluvialWet, apron * 12.0);             // sediment-tint hook (Stage 6)
      }

      // F1 mountains combiner — ridged base relief layered onto the FBM continents.
      // uMountainAmp<=0 ⇒ early-out (Stage-A base untouched, regression-safe), exactly
      // like craterCombiner. uMountainScale is the outer domain frequency: its chain-
      // rule factor multiplies the returned gradient (cf. craterCombiner · uCraterScale).
      void mountainCombiner(vec3 pos, float fwBase, inout float h, inout vec3 grad){
        if (uMountainAmp <= 0.0) return;
        // input is pos·uMountainScale, so its screen footprint is fwBase·uMountainScale
        float pw = provinceWeight(PROV_MOUNTAINS);   // §8: ranges cluster in tectonic provinces
        vec4 m = fbmdRidged(pos * uMountainScale, uOctaves, fwBase * uMountainScale);
        h    += uMountainAmp * m.x * pw;
        grad += uMountainAmp * m.yzw * uMountainScale * pw;
      }

      vec3 perturbAnalytic(vec3 N, vec3 grad, float strength){
        vec3 gTan = grad - dot(grad, N) * N;                // tangent-plane gradient
        vec3 perturbed = normalize(N - gTan * strength * 0.6);
        float dev = dot(perturbed, N);
        if (dev < 0.5) perturbed = normalize(mix(perturbed, N, 0.5));
        return perturbed;
      }

      // ── F25 jets & shear turbulence (Stage-6 albedo, Bands step 4b — card F25) — the
      // DYNAMICS on top of the F24 deck: an analytic zonal jet profile u(lat), a
      // counter-rotating drift of the warp-noise sampling domain (two-phase flow map,
      // research doc §3.2-3.3: two bounded phases offset 0.5, triangle crossfade — flow
      // without accumulation, deterministic on bounded time), shear-gated boundary
      // turbulence, and one-sided equatorial festoons. ALBEDO/LUMINANCE ONLY — no
      // h/grad writes. Regression contract: every term sits behind uJetStrength > 0.0;
      // at 0 the band path is byte-identical F24 (its zoom-cycle determinism intact) —
      // uTime enters the band family through these functions ONLY.
      vec3 jetRotY(vec3 v, float a){
        // differential rotation about the spin axis (y): latitude is y-invariant, so
        // band identity never moves — only the longitudinal sampling domain slides.
        float c = cos(a), s = sin(a);
        return vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z);
      }
      float jetU(float trueLat, float latC){
        // analytic zonal wind (card §4): sin on the SAME pre-warp stripe ladder F24
        // uses, so jets alternate sign each stripe and peak exactly at zone-belt
        // boundaries (fract(bandCoord) 0.25/0.75), plus a wide equatorial
        // superrotation Gaussian, ~1.6x amplitude — the widest, fastest band
        // (card §6 item 3; the hot-Jupiter hotspot mechanism rides this in F32).
        float jet = sin(6.2831853 * 0.25 * latC * uBandCount);
        float eq  = 1.6 * exp(-(trueLat * trueLat) / (uJetEqWidth * uJetEqWidth));
        return jet + eq;
      }
      float jetShearGate(float trueLat, float latC){
        // shear-magnitude proxy, maxima AT stripe boundaries (card §6 item 1): the
        // squared jet alternation (sin^2 = 1 at fract 0.25/0.75, 0 at band centers
        // — the quarter-shifted cos^2 of the card, placed so the gate peaks where
        // the jets and the zone-belt luminance transition live), plus the equatorial
        // Gaussian FLANK term (normalized |d/dlat| of the superrotation bump, peak 1
        // at lat = width/sqrt(2)). min() caps the gate so the displacement budget
        // (uJetShearTurb in stripe units) is exact.
        float s = sin(6.2831853 * 0.25 * latC * uBandCount);
        float aL = abs(trueLat) / uJetEqWidth;
        float eqFlank = 1.4142136 * aL * exp(0.5 - aL * aL);
        return min(1.0, s * s + 0.6 * eqFlank);
      }
      float bandWarpField(vec3 pos){
        // F24's recursive q/r warp, extracted VERBATIM so the F25 drift can sample it
        // at rotated domains. Jets off ⇒ one un-rotated call — identical arithmetic
        // to the original inline form, output unchanged.
        vec3 p = vec3(pos.x, pos.y * uBandStretch, pos.z) + uBandOffset;
        float q = fbmd(p, 4.0, 0.0).x;
        return fbmd(p + vec3(4.0 * q) + vec3(11.3, -7.1, 3.9), 4.0, 0.0).x;
      }
      float jetsDisp(float trueLat, float latC, vec3 pos){
        // shear-gated boundary turbulence + festoons, returned in stripe (bandCoord)
        // units. Two-phase flow map (research doc §3.3): phases offset 0.5, each
        // rotation bounded to +-|u|*uJetSpeed/2 around its rest pose (|u| peaks ~2.6
        // at the equatorial flank), triangle crossfade
        // w hides each phase wrap — nothing accumulates. The 0.04 rate ⇒ a 25 s
        // phase cycle: full drift period tens of seconds (slow Jovian churn).
        float u   = jetU(trueLat, latC);
        float ph0 = fract(uTime * 0.04);
        float ph1 = fract(uTime * 0.04 + 0.5);
        float w   = abs(2.0 * ph0 - 1.0);
        vec3 p0 = jetRotY(pos, u * uJetSpeed * (ph0 - 0.5));
        vec3 p1 = jetRotY(pos, u * uJetSpeed * (ph1 - 0.5));
        // higher-frequency fbm than the band warp (uJetTurbFreq x), same vertical
        // stretch so eddies streak along latitude; own 🎲 seed via uJetOffset.
        vec3 t0 = vec3(p0.x, p0.y * uBandStretch, p0.z) * uJetTurbFreq + uJetOffset;
        vec3 t1 = vec3(p1.x, p1.y * uBandStretch, p1.z) * uJetTurbFreq + uJetOffset;
        float tn = mix(fbmd(t0, 3.0, 0.0).x, fbmd(t1, 3.0, 0.0).x, w);
        // turbulence concentrates AT boundaries — generalizes the legacy
        // (1.0 - abs(bands)) gate in Planet.js. Budget (F24's marble lesson): peak
        // displacement = uJetShearTurb·1.0·~0.9 ≈ 0.27 stripe <= 0.3.
        float disp = uJetShearTurb * jetShearGate(trueLat, latC) * tn;
        // festoons v1 (card §6.5 step 5): one-sided single-sign hooks on the NORTH
        // flank of the equatorial stripe only (b = pre-warp band coordinate; window
        // straddles the b = 0.25 boundary, zero for b < 0 ⇒ one hemisphere).
        // max(0, tn) keeps every hook the same sign — consistent trailing direction
        // is the festoon signature (card §6 item 2). Peak ≈ 0.45·0.9 ≈ 0.40 <= 0.5.
        float b = 0.25 * latC * uBandCount;
        float flank = smoothstep(0.08, 0.20, b) * (1.0 - smoothstep(0.30, 0.42, b));
        disp += uJetFestoon * flank * max(0.0, tn);
        return disp;
      }

      // ── F26 latitude weather bands (Stage-8 clouds, Bands step 4b — card F26) — the
      // TERRESTRIAL sibling of F24: an analytic three-lobe latitude bias (transcribed
      // from production Planet.js:588-610) added INSIDE the existing Stage-8 cloud-FBM
      // threshold, so wet belts push the FBM over coverage and dry troughs sink below
      // it. CLOUD LAYER ONLY — the bands are weather OVER a visible ground, never the
      // surface itself (card §1 — the F24 distinction), and no h/grad writes.
      // Regression contract: every term sits behind uWeatherStrength > 0.0; at 0 the
      // threshold input is the raw cw.x — the cloud layer stays byte-identical.
      float weatherWarpField(vec3 pos){
        // recursive q/r warp on the F24 bandWarpField PATTERN but a fully independent
        // instance: own 🎲 seed (uWeatherOffset), own decorrelation constant, and NO
        // coupling to uBandOffset/uBandStretch — terrestrial fronts must not re-shape
        // when a gas deck knob moves. Fixed 4 octaves, fwBase 0 ⇒ no LOD fade.
        vec3 p = pos * 1.6 + uWeatherOffset + vec3(-19.7, 5.3, 23.1);
        float q = fbmd(p, 4.0, 0.0).x;
        return fbmd(p + vec3(4.0 * q) + vec3(11.3, -7.1, 3.9), 4.0, 0.0).x;
      }
      float weatherLatBias(float lat){
        // three lobes per the production reference: ITCZ Gaussian (center rides
        // uWeatherItczShift — the D3 axial-tilt monsoon migration, static in v1),
        // storm-track Gaussian whose center+width PAIR scales with uWeatherCells
        // (D8 spin: 3 cells = the Earth 0.55/0.15 curve; fast rotators pull tighter
        // tracks equator-ward, slow rotators push the track off the disc entirely —
        // the one-cell Titan/Venus collapse), and a fixed polar smoothstep. The
        // subtropical clear trough at lat ~0.27 is implicit between the lobes.
        // sigma 0.11 (production used 0.08): widened for read-through at gallery
        // distance on a ~500 px posterized disc (live tune 2026-06-10 — at 0.08 the
        // warped band fell between rows and the ITCZ read as absent).
        // weight 0.85 (production used 0.6): against the trough-drying term the 0.6
        // ITCZ delta ran a third of the storm tracks — 0.85 brings the equatorial
        // band to rough parity (card §6 item 1, the headline read).
        float itcz = exp(-(lat - uWeatherItczShift) * (lat - uWeatherItczShift) / (2.0 * 0.11 * 0.11)) * 0.85;
        float cs = 3.0 / max(uWeatherCells, 1.0);
        float stC = 0.55 * cs;
        float stW = 0.15 * cs;
        float stormTrack = exp(-(lat - stC) * (lat - stC) / (2.0 * stW * stW)) * 0.8;
        float polar = smoothstep(0.65, 0.85, lat) * 0.4;
        return itcz + stormTrack + polar;
      }

      // ── F27 great-spot anticyclone (Stage-6 albedo, Bands step 4b — card F27) — the
      // kinematic vortex signature (research doc storm-mask + rotational swirl row): a
      // hash-placed deterministic center, a rotational domain warp of the DIRECTION the
      // whole band computation reads (so the stripes themselves deflect and wrap around
      // the oval — collar/moat for free, card §6 item 3), and core/collar/companion
      // color terms layered onto the finished band color. ALBEDO ONLY — no h/grad
      // writes. ES 1.00-safe loops: constant bound 8, break on the uniform count.
      // Per-storm tangent frame: east = normalize(cross(up, c)) (storm centers are
      // clamped |y| <= 0.7, so the frame never degenerates), north = cross(c, east).
      // Elliptical distance d = |(dot(n,east)/aspect, dot(n,north))| — chord-projection
      // components approximate great-circle angle to ~1.5% at the R <= 0.30 rad radii
      // involved (card §4: stretch the metric east-west by the local zonal direction).
      // The step(0,dot(n,c)) facing guard kills the antipodal ghost the projected
      // metric would otherwise mirror (d is ~0 at BOTH c and -c); the smoothstep
      // falloff is already 0 far before the hemisphere edge, so the cut is invisible.
      vec3 stormSwirl(vec3 n){
        // rotate n around each storm center by ang = rotStrength x smoothstep(R,0,d)
        // (Rodrigues, axis = c): a solid-body-like core twist decaying C1-smoothly to
        // zero at the rim — the §4 kinematic recipe in 3D-rotation form (no 2D frame).
        for (int i = 0; i < 8; i++){
          if (i >= uStormCount) break;
          vec3 c  = uStormPosSize[i].xyz;
          float R = uStormPosSize[i].w;
          vec3 east  = normalize(cross(vec3(0.0, 1.0, 0.0), c));
          vec3 north = cross(c, east);
          float d = length(vec2(dot(n, east) / uStormParams[i].y, dot(n, north)));
          float ang = uStormParams[i].x * smoothstep(R, 0.0, d) * step(0.0, dot(n, c));
          float ca = cos(ang), sa = sin(ang);
          n = n * ca + cross(c, n) * sa + c * (dot(c, n) * (1.0 - ca));
        }
        return n;
      }
      vec3 stormColTerms(vec3 n, vec3 col){
        // color terms ON TOP of the finished band color (card §6.5 step 3): a soft
        // elliptical core mixing toward uStormColor (warm deepened tint mode 0 / dark
        // bruise mode 1), a pale collar LUMINANCE lift ring at 0.6R-1.0R (rim/interior
        // contrast survives posterization as two distinct levels, card §6 item 4), and
        // for the dark GDS variant a small bright companion-cloud Gaussian offset
        // ~1.3R east + 0.5R poleward (the Voyager 2 read, card §6 item 7). n is the
        // direction zonalBandCol received — the storm-swirled one, so the mask edge
        // wobbles with the same twist the bands carry (interior spiral hint at close
        // range, card §6 item 5, from the swirl alone — static v1).
        for (int i = 0; i < 8; i++){
          if (i >= uStormCount) break;
          vec3 c  = uStormPosSize[i].xyz;
          float R = uStormPosSize[i].w;
          vec3 east  = normalize(cross(vec3(0.0, 1.0, 0.0), c));
          vec3 north = cross(c, east);
          float de = dot(n, east), dn = dot(n, north);
          // facing guard as a +100 far-side distance pedestal: branchless antipode kill
          float d = length(vec2(de / uStormParams[i].y, dn)) + (1.0 - step(0.0, dot(n, c))) * 100.0;
          // V-β.4 haze veil (taxonomy §1.2): desaturate the storm tint toward its luminance + soften the
          // collar contrast by uHazeMute (Saturn / sub-Neptune / Uranus). uHazeMute 0 on every non-haze
          // preset ⇒ EXACT identity (byte-identical off-gate). No new uniform.
          vec3 stormCol = mix(uStormColor[i], vec3(dot(uStormColor[i], vec3(0.299, 0.587, 0.114))), uHazeMute);
          float hazeAmp = 1.0 - uHazeMute;
          // core <= 0.6R soft: a coherent closed oval, not a smeared noise blob
          float core = 1.0 - smoothstep(0.40 * R, 0.62 * R, d);
          col = mix(col, stormCol, core * 0.85);
          // pale collar 0.6R-1.0R: multiplicative luminance lift (hue-preserving)
          float collar = smoothstep(0.55 * R, 0.72 * R, d) * (1.0 - smoothstep(0.88 * R, 1.05 * R, d));
          col = min(col * (1.0 + 0.22 * collar * hazeAmp), vec3(1.0));
          // ── V-α.3 storm INTERIOR STRUCTURE — spiral arms + concentric shear rings so a
          // placed vortex reads as a churning cell, NOT a flat oval (taxonomy 2.3 / Max's
          // "must stop reading as a simple oval"). STATIC (F1): the regularity is broken by a
          // FRESH bandWarpField(n) sample — time-invariant, no animated warp. Winds with the swirl
          // sign so the arms trail the rotation; confined to the near-side interior (rr<1).
          float rr = d / max(R, 1.0e-4);                       // 0 core … 1 rim (elliptical metric; far side rr>>1 via the +100 pedestal)
          if (rr < 1.0){
            float thv    = atan(dn, de);                       // azimuth in the storm tangent frame
            float spiral = sin(3.0 * thv + 6.0 * rr * sign(uStormParams[i].x));   // logarithmic-ish arms, wound by swirl sign
            float annuli = cos(9.0 * rr);                      // concentric shear rings
            float detail = mix(spiral, annuli, 0.4) * bandWarpField(n * 5.0 + vec3(3.1, -6.4, 2.7));
            float interior = (1.0 - smoothstep(0.5, 1.0, rr)) * step(0.0, dot(n, c));
            col = clamp(col * (1.0 + 0.12 * interior * detail), vec3(0.0), vec3(1.0));
          }
          // bright companion (dark spots — uStormParams.w SIGN-PACKED, V-α.5): magnitude = the
          // CH₄ cloud brightness, SIGN = placement. comp<0 ⇒ DS2 bright-CORED variant (companion
          // centered ON the cleared core, taxonomy 4.4); comp>0 ⇒ the GDS OFFSET companion ~1.3R
          // east + 0.5R poleward (the Voyager-2 read). abs(comp) drives amplitude (F2) so a
          // negative (centered) flag still BRIGHTENS — sign relocates the offset, never darkens.
          float comp = uStormParams[i].w;
          if (comp != 0.0){
            float py = (c.y < 0.0) ? -1.0 : 1.0;   // poleward = away from the equator
            vec2 off = (comp < 0.0) ? vec2(0.0) : vec2(1.3 * R, py * 0.5 * R);   // centered (DS2) vs offset (GDS)
            vec2 q = vec2(de - off.x, dn - off.y) / (0.35 * R);
            float g = exp(-dot(q, q)) * step(0.0, dot(n, c));
            col = min(col + vec3(0.30, 0.32, 0.34) * (abs(comp) * g), vec3(1.0));
          }
          // ── V-α.2 GRS turbulent WAKE — an upstream (west) turbulence cone on the PRIMARY warm
          // anticyclone (slot 0): the planet's single most turbulent patch, torn-tissue filaments
          // WEST of the core where the deflected westward jet piles into an eastward one (taxonomy
          // 2.4, Q5 ratified: a bespoke wake term over swirl-only). STATIC bandWarpField; time-invariant.
          if (i == 0 && uStormParams[0].z < 0.5){
            float west  = -de;                                 // >0 upstream (west of the core)
            float axial = west / (2.6 * R);                    // 0 at core … 1 at the cone tip
            float halfW = R * (0.35 + 0.55 * clamp(axial, 0.0, 1.0));   // cone widens downstream
            float latW  = abs(dn) / max(halfW, 1.0e-4);
            float cone  = smoothstep(0.05, 0.25, west / R)
                        * (1.0 - smoothstep(0.7, 1.15, axial))
                        * (1.0 - smoothstep(0.6, 1.0, latW))
                        * step(0.0, dot(n, c));
            float torn  = bandWarpField(n * 6.5 + vec3(-4.7, 1.3, 9.2));
            col = clamp(col * (1.0 + 0.16 * cone * torn), vec3(0.0), vec3(1.0));
          }
        }
        return col;
      }

      // ── F29 polarVortexCol (Bands step 4b — card F29) — the permanent pole-locked
      // structure painted on the finished deck color. One combiner in the pole
      // tangent frame: pr = angular distance from the ACTIVE pole (uPolarPole picks
      // north/south — acos of the signed y keeps the frame seam- and pinch-free,
      // the frostCoverage coordinate pattern), theta = longitude. Three variants
      // selected by uPolarMode through step() products (floats — no int branching);
      // every term's strength multiplies uPolarStrength x provinceWeight(PROV_POLAR)
      // (neutral, floor 1.0 — registry fan-out convention) x the radial gate g, so
      // strength 0 returns col untouched (the F29 regression contract) and the
      // whole structure dies smoothly by pr 0.48 rad regardless of variant.
      // ALBEDO/LUMINANCE ONLY — no h/grad writes; static — no uTime (PIA24967:
      // the Juno lattice held its ring positions for five years).
      vec3 polarVortexCol(vec3 n, vec3 col){
        float theta = atan(n.z, n.x);
        float pr = acos(clamp(uPolarPole * n.y, -1.0, 1.0));   // angular distance from the ACTIVE pole (rad)
        // overall gate: the combiner is a polar-cap regime — fade out well inside
        // the band ladder's hood so the handoff is a smooth co-fade, no edge.
        float g = 1.0 - smoothstep(0.38, 0.48, pr);
        // ── V-β.1 BOTH POLES IN ONE PASS (§11 flag-2, taxonomy 3.1/3.2): the OPPOSITE pole
        // (−uPolarPole) shows a fixed mode-0 cap + eyewall from the SAME uniforms, so Saturn reads its
        // N-hexagon on the active pole and a bare eye-walled polar cyclone on the other, with NO new
        // uniform. Full per-pole independent param tuning stays deferred (derive-not-freeze). STATIC —
        // reads no animation clock and no animated warp locals (the Juno-lattice place-once contract).
        float prO = acos(clamp(-uPolarPole * n.y, -1.0, 1.0));   // angular distance from the OPPOSITE pole (rad)
        float gO = 1.0 - smoothstep(0.38, 0.48, prO);
        if (g <= 0.0 && gO <= 0.0) return col;   // neither pole in range — cheap early-out
        // ── ACTIVE pole: the driven uPolarMode structure (cap / hexagon / lattice) ──
        if (g > 0.0){
        float s = uPolarStrength * provinceWeight(PROV_POLAR) * g;
        // variant selectors — uPolarMode is exactly 0.0 / 1.0 / 2.0 (driven)
        float isPoly = step(0.5, uPolarMode) * (1.0 - step(1.5, uPolarMode));
        float isLatt = step(1.5, uPolarMode);
        float isCap  = 1.0 - step(0.5, uPolarMode);
        // ── mode 1: polygonal jet (Saturn hexagon — wavenumber-N Rossby meander).
        // The polygon IS a jet streamline: rJet(theta) = r0 x (1 + amp cos(N theta))
        // traced as a dark collar band (flat segments + rounded corners from the
        // cosine, card §6 item 1), with the enclosed cap tinted toward uPolarTint —
        // the Cassini gold-haze-outside / teal-core two-tone (card §6 item 2).
        float pj = s * isPoly;
        float rJet = uPolarR0 * (1.0 + uPolarAmp * cos(uPolarSides * theta));
        float collar = 1.0 - smoothstep(0.0, uPolarW, abs(pr - rJet));
        col *= 1.0 - 0.35 * collar * pj;
        float capPoly = smoothstep(rJet, rJet * 0.8, pr);   // 1 inside the jet contour, 0 outside
        col = mix(col, uPolarTint, 0.45 * capPoly * pj);
        // ── mode 2: cyclone-cluster lattice (Juno Jupiter poles — vortex crystal).
        // Central cyclone at the pole + a ring of M at pr = r0; the nearest ring
        // center comes from rounding theta to the M-fold grid (analytic — by
        // construction theta - thetaC already wraps into +-pi/M, and the centers
        // match up across the +-pi seam since they sit at integer multiples of the
        // segment angle). dc uses the small-angle tangent-plane metric with the
        // sin(r0) azimuthal scale. Each cyclone = a soft luminance dimple + a
        // bright eye dot (discrete swirl blobs, card §6 item 4); cap tint subtler
        // than the polygon's.
        float lt = s * isLatt;
        float segA = 6.2831853 / uPolarRing;
        float thetaC = floor(theta / segA + 0.5) * segA;
        float dc = length(vec2(pr - uPolarR0, (theta - thetaC) * sin(uPolarR0)));
        float dimple = max(1.0 - smoothstep(0.03, 0.08, pr),          // central cyclone disc
                           1.0 - smoothstep(0.02, 0.06, dc));         // nearest ring-cyclone disc
        float eye    = max(1.0 - smoothstep(0.0, 0.018, pr),          // central eye
                           1.0 - smoothstep(0.0, 0.015, dc));         // ring eye
        float capLatt = 1.0 - smoothstep(uPolarR0 * 1.3, uPolarR0 * 1.8, pr);
        col = mix(col, uPolarTint, 0.25 * capLatt * lt);
        col *= 1.0 - 0.30 * dimple * lt;
        // mix-form so zero weight is a TRUE identity (review fix 2026-06-10: a bare
        // min(col+..., 1.0) clamped the >1 deck even when the term was 0, stepping
        // luminance at the gate circle on bright zones).
        col = mix(col, min(col + vec3(0.25), vec3(1.0)), eye * lt);
        // ── mode 0: single cap (Venus-style lobed swirl core — card §6 item 8).
        // A soft cap tint + an S-lobe pair: two Gaussians at pr 0.07 on opposite
        // sides of the pole (phase from the driven hash), one brightening and one
        // darkening — the irregular twin-lobed read, clearly NOT a polygon.
        float sc = s * isCap;
        float capMask = 1.0 - smoothstep(0.12, 0.30, pr);
        col = mix(col, uPolarTint, 0.35 * capMask * sc);
        vec2 pp = pr * vec2(cos(theta), sin(theta));               // tangent-plane position
        vec2 lb = 0.07 * vec2(cos(uPolarPhase), sin(uPolarPhase)); // lobe center (radius ~0.05 each)
        vec2 q1 = (pp - lb) / 0.05;
        vec2 q2 = (pp + lb) / 0.05;
        col = mix(col, min(col + vec3(0.25), vec3(1.0)), exp(-dot(q1, q1)) * sc);   // bright lobe (mix-form, same review fix)
        col *= 1.0 - 0.25 * exp(-dot(q2, q2)) * sc;                        // dark lobe
        }
        // ── OPPOSITE pole (V-β.1): a fixed mode-0 cap + a bright eyewall collar ring + a calm eye —
        // the Saturn S-polar hurricane read (taxonomy 3.2), same uniforms, static (place-once, no clock).
        if (gO > 0.0){
          float sO = uPolarStrength * provinceWeight(PROV_POLAR) * gO;
          float capO = 1.0 - smoothstep(0.12, 0.30, prO);                  // soft polar cap
          col = mix(col, uPolarTint, 0.30 * capO * sO);
          float eyewall = 1.0 - smoothstep(0.0, 0.03, abs(prO - 0.10));    // bright towering wall at ~0.10 rad
          col = mix(col, min(col + vec3(0.20), vec3(1.0)), 0.5 * eyewall * sO);
          float eyeO = 1.0 - smoothstep(0.0, 0.02, prO);                   // calm clear eye
          col = mix(col, min(col + vec3(0.18), vec3(1.0)), eyeO * sO);
        }
        return col;
      }

      // ── atmo-expression slice K: bandProxy + anisotropic ink advection (BUILD-PLAN §0.2/§3.1) ──
      // bandProxy — the 6-uniform ANALYTIC reconstruction of the baked band value aBand. Because the writer's
      // normDenom = uPeak·(aEq + aMid·envMax), uPeak CANCELS, leaving a closed form the render can evaluate at
      // ANY (displaced) latitude. Used ONLY to form the deflection delta dBand = bandProxy(latRaw+dLat) −
      // bandProxy(latRaw); the baked aBand + GOLDEN_BANDFIELD_HASH are NEVER written (read-only). PHYS consts
      // (AEQ/PHI_EQ/WARD_GAIN/ENV_BASE) inline from climate-e5 PHYS. Faithful transcription of band-flow.js
      // bandProxy (the numeric truth lives in that mirror; parity < 1e-3 — calibration-candidates.md).
      float bandProxy(float lat){
        const float AEQ = 0.6, PHI_EQ = 0.35, WARD_GAIN = 0.8, ENV_BASE = 1.0;   // climate-e5 PHYS
        float s     = sin(lat);
        float p2    = 0.5 * (3.0 * s * s - 1.0);                    // Legendre P2(sinLat)
        float ratio = lat / PHI_EQ;
        float g     = exp(-ratio * ratio);                          // equatorial Gaussian
        float env   = ENV_BASE + WARD_GAIN * uBandS2 * p2;          // Ward pole-emphasis envelope
        float mid   = sin(uBandM * lat + uBandPhaseJet) * (1.0 - g) * env;
        return clamp(0.5 + uBandDeflectScale * (uBandSEq * AEQ * g + uBandAMid * mid), 0.0, 1.0);
      }
      // dAdvect — the ANISOTROPIC "ink in water" meridional displacement (slice K, finding 3). Long
      // correlation ALONG the zonal flow, short ACROSS it, + a shear-interface FOLD (breaking-wave / festoon
      // read — NOT a literal vortex roll-up; BUILD-PLAN §3.1 mechanism boundary). ANISOTROPY MECHANISM: the
      // zonal (x,z / longitude) plane is COMPRESSED by 1/uInkStretch while y (meridional) is kept, so warp
      // features elongate east-west along the jets. (This is the band-flow.js REALIZATION — BUILD-PLAN §3.1's
      // literal e=dot(Nraw,eF) is ≡0 for a unit point on its own tangent frame and collapses to isotropic /
      // AC-ADVECT ratio ~1.0; recorded as an adjudicable deviation in calibration-candidates.md. The GLSL
      // transcribes the MIRROR — that is the whole point of §2.3 "numeric truth lives in the mirror.") Per-seed
      // tendril variety enters via uBandOffset baked inside bandWarpField (the GLSL analog of the mirror's
      // seedOffsetOf). STATIC — every sample is bandWarpField of an Nraw-derived domain, no uTime / no
      // animated ph0/ph1/r0/r1/jetRotY path (F1). MASK-gated by clamp(wStorm) ⇒ exactly 0 off-gate (non-gas),
      // the V-α.1 filament precedent. Constants are Phase-A CANDIDATES (band-flow.js BAND_FLOW /
      // calibration-candidates.md) — frozen at the live A/B read-gate (§6.0 Phase B).
      float dAdvect(vec3 Nraw, float wShear, float wBand, float wStorm){
        const float INK_FREQ = 2.2, INK_AMP = 0.12, FOLD_K = 0.5, FOLD_FREQ = 9.0;   // INK_AMP frozen ×2 at the 2026-07-17 Phase-B read-gate (mirror parity: band-flow.js BAND_FLOW)
        float lat = asin(clamp(Nraw.y, -1.0, 1.0));
        // anisotropic domain: compress the zonal (longitude / x,z) plane by 1/uInkStretch, keep y (meridional)
        vec3 s    = vec3(Nraw.x / uInkStretch, Nraw.y, Nraw.z / uInkStretch);
        vec3 dom1 = s * INK_FREQ + vec3(2.7, -1.9, 5.3);                                // INK_OFF (decorrelation; per-seed via uBandOffset in bandWarpField)
        float s1  = bandWarpField(dom1);
        float s2f = 0.5 * bandWarpField(s * (2.0 * INK_FREQ) + vec3(-8.1, 4.4, -2.6));  // INK_OFF2 — 2nd octave, half amplitude
        // shear-interface FOLD: meridional sinusoid, belt/zone phase flip (step(0.5,wBand)), shear-gated,
        // irregularized by a decorrelated warp sample (dom1.zxy + FOLD_OFF). NOT a literal vortex roll-up.
        float foldWarp  = bandWarpField(dom1.zxy + vec3(1.7, -3.3, 6.1));               // FOLD_OFF
        float foldPhase = FOLD_FREQ * lat + 3.14159265 * step(0.5, wBand);
        float fold = FOLD_K * clamp(wShear, 0.0, 1.0) * sin(foldPhase) * foldWarp;
        float ink  = s1 + s2f + fold;
        return uAtmoInk * INK_AMP * ink * clamp(wStorm, 0.0, 1.0);
      }
      // dWake — the storm-anchored INTERACTION displacement (slice I, finding 2; BUILD-PLAN §2.1). Two
      // meridional contributors, both fed into the SAME dLat as dAdvect ⇒ they DEFLECT the primary baked
      // band (via bandProxy) instead of pasting a decal — the root fix for "one on top of the other":
      //   (a) a near-storm ROTATIONAL BOW that wraps the primary bands around each oval (dies by ~1.6R), and
      //   (b) a DOWNSTREAM wake cone + von-Kármán meander carrying the deflection PAST the rim into the band
      //       field (reach well past today's 2.6R GRS cone — finding 2's "wake into the band field beyond
      //       the rim"), so the storm belongs to the band field rather than sitting on top of it.
      // Per-storm loop in the SAME east/north tangent frame stormSwirl/stormColTerms build; COUNT-gated
      // behind i < uStormCount ⇒ EXACTLY 0 whenever there are no storms (non-gas AND gas-storms-off) — the
      // same lever stormColTerms uses, so dWake==0 ⇔ uStormCount==0 (off-gate identity). Downstream direction
      // is DERIVED from sign(bandProxy(latC) − 0.5) = the LOCAL zonal-flow sign at the storm latitude (east in
      // zones, west in belts) — NOT hard-coded west (fluid-lens must-fix #5; reuses slice-K's bandProxy, so I
      // lands after K). Scaled by uAtmoInk (Max's UAT tame-down dial). STATIC — every sample is a pure function
      // of Nraw + the storm uniforms + the proxy uniforms, no uTime (F1). Faithful transcription of
      // band-flow.js stormBandDrag; the WAKE_* GLSL literals match BAND_FLOW.WAKE_* EXACTLY (the K
      // constant-parity pattern). Phase-A CANDIDATES (band-flow.js BAND_FLOW / calibration-candidates.md) —
      // NOT yet frozen; they freeze at slice I's own live A/B read-gate (§6.0 Phase B; wake floors §2.1).
      float dWake(vec3 Nraw){
        const float WAKE_LEN = 4.5, WAKE_WID = 1.2, WAKE_BOW = 0.34, WAKE_AMP = 0.22, WAKE_K = 7.0;   // mirror parity: band-flow.js BAND_FLOW.WAKE_*
        float sum = 0.0;
        for (int i = 0; i < 8; i++){
          if (i >= uStormCount) break;                                 // COUNT-gate ⇒ 0 when no storms (same lever stormColTerms uses)
          vec3 c  = uStormPosSize[i].xyz;
          float R = max(uStormPosSize[i].w, 1.0e-4);
          vec3 east  = normalize(cross(vec3(0.0, 1.0, 0.0), c));       // SAME tangent frame stormSwirl/stormColTerms build
          vec3 north = cross(c, east);
          float de = dot(Nraw, east), dn = dot(Nraw, north);
          float facing = step(0.0, dot(Nraw, c));                      // near-side only (antipode kill, stormColTerms idiom)
          float rot    = uStormParams[i].x;                            // sign = circulation direction
          // downstream sign DERIVED from the local zonal flow at the storm latitude (NOT hard-coded west)
          float latC = asin(clamp(c.y, -1.0, 1.0));
          float flow = sign(bandProxy(latC) - 0.5);                    // +east in zones (bandProxy>0.5), −east in belts
          float ds   = flow * de;                                      // >0 downstream, <0 upstream (per-storm, per-band correct)
          // (a) near-storm rotational BOW: push bands meridionally, sign following the swirl ⇒ bands wrap the oval
          float rr  = length(vec2(de / uStormParams[i].y, dn)) / R;    // elliptical metric (E-W aspect on the east axis)
          float bow = sign(dn) * (1.0 - smoothstep(0.0, 1.6, rr));     // dies by ~1.6R (wider than the rim)
          // (b) DOWNSTREAM wake cone + von-Kármán meander (downstream = flow-sign·east)
          float along = ds / (WAKE_LEN * R);                           // 0 at core … 1 at the cone tip, downstream
          float latW  = dn / (WAKE_WID * R);
          float cone  = smoothstep(0.05, 0.30, ds / R)                 // starts just downstream of the core
                      * (1.0 - smoothstep(0.75, 1.15, along))          // long downstream reach past the rim
                      * exp(-latW * latW);                             // lateral Gaussian
          float wave  = sin(WAKE_K * along) * (1.0 - smoothstep(0.6, 1.1, along));   // von-Kármán meander in the tail
          sum += uAtmoInk * sign(rot) * facing * (WAKE_BOW * R * bow + WAKE_AMP * R * cone * wave);
        }
        return sum;
      }
      // ── F24 zonalBandCol (Stage-6 albedo, Bands step 4b — card F24) — the gas-giant
      // visible deck: alternating bright ZONES (anticyclonic upwelling, fresh high
      // condensate) and dark BELTS (cyclonic subsidence, deeper warm cloud showing
      // through). ALBEDO ONLY — no h/grad writes; the Bands family is the one family
      // exempt from the displacement pipeline (card §4). All structure routes through
      // LUMINANCE so the 6-level Bayer posterize carries the banding as quantize
      // steps, not as hue shifts the envelope crushes (card §6 item 4).
      // Stability contract: the band field reads geometric latitude + seed-fixed FBM
      // ONLY — no uLodRamp/fwidth in the band coordinate (same bands at distance 30
      // and 1.5, card §6 item 6); uTime enters ONLY through the F25 jets terms below,
      // every one behind uJetStrength > 0.0 (jets off ⇒ byte-identical F24 statics).
      // Poles: latitude-only keying means bands can never converge or
      // pinch; an explicit darkened polar hood caps them instead (card §6 item 5).
      vec3 zonalBandCol(vec3 N, vec3 Nraw, vec3 pos, float wBand, float wShear, float wMush, float wStorm){
        // true latitude from the geometric normal, normalized to -1..1
        float trueLat = asin(clamp(N.y, -1.0, 1.0)) * 0.63661977;   // × 2/π
        // uBandLatPow > 1 widens the equatorial bands and narrows the polar ones
        // (the Cassini-map spacing read) without moving the equator or the poles.
        float latC = sign(trueLat) * pow(abs(trueLat), uBandLatPow);
        // recursive domain warp (research doc q/r recipe — THE bands→fluid trick),
        // now via bandWarpField() (vertically-compressed domain, fixed 4 octaves,
        // fwBase 0 ⇒ no LOD fade): r rides on q, so band edges scallop and festoon
        // instead of reading as ruler-straight sin() boundaries. F25 drift: with jets
        // ON the warp SAMPLING DOMAIN counter-rotates per latitude — angle
        // u(lat)·uJetSpeed·(phase-0.5), two bounded phases, triangle crossfade — so
        // adjacent bands visibly slide opposite ways (card §6 item 4) while latitude
        // (y-invariant under jetRotY) keeps band identity fixed. Jets OFF takes the
        // single un-rotated call: byte-identical to the F24 inline form.
        float r;
        if (uJetStrength > 0.0){
          float u   = jetU(trueLat, latC);
          float ph0 = fract(uTime * 0.04);
          float ph1 = fract(uTime * 0.04 + 0.5);
          float w   = abs(2.0 * ph0 - 1.0);
          float r0  = bandWarpField(jetRotY(pos, u * uJetSpeed * (ph0 - 0.5)));
          float r1  = bandWarpField(jetRotY(pos, u * uJetSpeed * (ph1 - 0.5)));
          r = mix(r0, r1, w);
        } else {
          r = bandWarpField(pos);
        }
        // ── E5 #3a (AC10): the band VALUE is the writer's per-vertex bandNorm (wBand) — NOT an inline
        // latitude ladder. wBand already encodes the driver-organized jet COUNT (Rhines), the SIGNED
        // equatorial jet (ice-giant retrograde reads as an equatorial belt, wBand<0.5), per-seed band
        // phase, and the Ward pole-emphasis (>54° inversion). The old 0.25·latC·uBandCount stripe
        // ladder is removed — bands are now caused by climate-e5, exercisable by a headless test.
        // r festoons the edges (jets-on: the rotated warp domain slides adjacent bands opposite ways);
        // the writer's shear wShear gates the jet turbulence so the filaments ride the REAL shear.
        float bandVal = wBand + uBandWarp * 0.16 * r;
        // ── Atmo-expression slice K: DEFLECT the primary baked band (BUILD-PLAN §1; band-flow advectDisplacement) ──
        // The root fix for "one on top of the other": instead of pasting a storm decal, DISPLACE the latitude at
        // which the primary band field is read, then RE-DERIVE the band value analytically via bandProxy (which
        // reconstructs wBand to float tolerance — §0.2). dLat is the meridional "ink in water" advection (slice K);
        // slice I ADDS dWake(Nraw) — the storm/band interaction — to the SAME dLat (count-gated ⇒ 0 with no
        // storms). dBand = bandProxy(latRaw+dLat) − bandProxy(latRaw) is
        // ADDITIVE and == 0 EXACTLY wherever dLat == 0 (identical proxy inputs) — so on a non-gas deck (wStorm=0
        // ⇒ dAdvect=0) the term vanishes and the render is byte-identical (off-gate). STATIC: dLat is a pure
        // function of Nraw + baked fields + per-seed uniforms — no uTime (F1). bandProxy READS the proxy uniforms
        // and ADDS to the LOCAL bandVal; it never writes aBand ⇒ GOLDEN_BANDFIELD_HASH frozen by construction.
        float latRaw = asin(clamp(Nraw.y, -1.0, 1.0));                 // raw (un-swirled) latitude, radians
        float dLat   = dAdvect(Nraw, wShear, wBand, wStorm) + dWake(Nraw);   // slice K ink + slice I storm/band interaction; dWake count-gated ⇒ 0 when uStormCount==0
        bandVal     += bandProxy(latRaw + dLat) - bandProxy(latRaw);   // deflect the PRIMARY band (non-linear re-sample)
        if (uJetStrength > 0.0) bandVal += uJetStrength * jetsDisp(trueLat, latC, pos) * (0.25 + 0.75 * wShear) * 0.35;
        // ── V-α.1 "ink in water" band-boundary FILAMENTATION (increment 3b, taxonomy 2.1/2.2) ──
        // Fine turbulent detail woven INTO the band boundary — Kelvin-Helmholtz billows / von-Kármán
        // streets strung along the shear interface (the literal dye-drawn-along-a-shear-line read).
        // Localized by the REAL fields: wShear (|du/dφ|, peaks at band edges, ≈0 at band centers)
        // × wStorm (the baked convection MASK, ≈0 on an empty deck), so the filaments live ONLY where
        // BOTH are high and the whole term VANISHES when the mask is empty (off-gate byte-identity).
        // STATIC (F1 MUST-FIX): the detail is a FRESH bandWarpField() sample at a decorrelated higher
        // frequency — it reads NEITHER the animation clock NOR the jets-on animated warp (never the
        // animated-phase path), so "static place-once" (designDecision-2) holds with no animation to leak.
        // FFR sign-of-shear asymmetry (taxonomy 2.2, Q8 ratified): the CYCLONIC side (belts, the low
        // half of the writer's signed band field wBand<0.5) churns to full chaos while the
        // ANTICYCLONIC zone side stays cleaner — the character split the FFR read needs.
        // F1 STATIC: cyclonic keys on wBand (the baked signed band field, param from aBand) — NOT the
        // composite band value, which carries the jets-on animated warp and animated jetsDisp; keying
        // on the baked wBand keeps the whole filament amplitude place-once static (designDecision-2).
        float shearMask = wShear * clamp(wStorm, 0.0, 1.0);
        float fila = bandWarpField(pos * 3.7 + vec3(8.3, -2.9, 5.1));   // fresh STATIC fine warp (time-invariant; not the animated path)
        float cyclonic = clamp((0.5 - wBand) * 2.0, 0.0, 1.0);         // 1 deep belt (cyclonic) … 0 zone (anticyclonic); wBand=static baked field
        float ffr = 0.55 + 0.45 * cyclonic;                            // belts filament harder than zones (FFR asymmetry)
        bandVal += uBandWarp * 0.14 * shearMask * ffr * fila * (1.0 - uHazeMute);   // ink-in-water distortion, shear×mask gated; V-β.4 haze veil mutes amplitude (taxonomy §1.2; uHazeMute 0 ⇒ identity)
        // ── Atmo-expression slice J: per-band EDGE JAGGEDNESS (BUILD-PLAN §4.1; band-flow.js bandRoughness) ──
        // A high-frequency edge-roughness term on bandVal that reads as jagged band edges. Two contributors:
        //   • per-band BASE (cyclonic) — whole BELTS rougher than whole ZONES (the contract's ask). cyclonic
        //     (reused from the filament above = clamp((0.5-wBand)*2)) is the belt/zone DISCRIMINATOR: 1 on a
        //     cyclonic belt, 0 on an anticyclonic zone. wShear ALONE cannot key this — it is a BOUNDARY field
        //     ≈0 at every band CENTER (belt AND zone centers both sit at jetProfile extrema), so it can't tell
        //     a belt from a zone; the SIGN cyclonic can (fluid-lens must-fix).
        //   • EDGE BOOST (wShear) — extra roughness at high-shear boundaries.
        // × uBandRough (the per-seed global draw). ROUGH_FREQ 7.0 sits well above the 3.7 filament / 2.2
        // advection ⇒ a DISTINCT high-freq "jagged edge", not a flowing tendril. jag is a FRESH STATIC
        // bandWarpField sample (no uTime — F1). MASK-gated by clamp(wStorm) ⇒ exactly 0 off-gate (non-gas),
        // the same filament precedent. Constants are Phase-A CANDIDATES (band-flow.js BAND_FLOW /
        // calibration-candidates.md) — frozen at the live A/B read-gate (§6.0 Phase B).
        float rough = (0.7 * cyclonic + 0.5 * clamp(wShear, 0.0, 1.0)) * uBandRough;   // ROUGH_BELT 0.7 / ROUGH_EDGE 0.5 (candidates) × per-seed global
        float jag   = bandWarpField(pos * 7.0 + vec3(-5.9, 2.2, 8.8));                 // ROUGH_FREQ 7.0 / ROUGH_OFF (candidates) — fresh STATIC high-freq warp
        bandVal += 0.15 * rough * jag * clamp(wStorm, 0.0, 1.0);                       // ROUGH_AMP 0.15 (frozen ×1.5 at the Phase-B read-gate; mirror parity: band-flow.js); MASK-gated ⇒ 0 off-gate (filament precedent)
        // alternating zone/belt LUMINANCE — a smoothstep across the writer band value; the soft risers
        // still land on posterize-step transitions so the Bayer dither textures the festooned boundary.
        float zone = smoothstep(0.34, 0.66, clamp(bandVal, 0.0, 1.0));
        // 2-tone palette derived from the deck tint (v1 scope cut: no multi-band hue
        // ramp): zones LIGHTEN the tint (fresh condensate), belts DARKEN + WARM it
        // (deeper warmer cloud). uBandContrast collapses both toward the plain tint —
        // the ice-giant near-bland blue disc falls out of the cold-T_eq ramp alone.
        vec3 zoneCol = min(uBandTint * 1.30 + vec3(0.08), vec3(1.0));
        vec3 beltCol = uBandTint * vec3(0.62, 0.52, 0.42);
        vec3 col = mix(mix(uBandTint, beltCol, uBandContrast),
                       mix(uBandTint, zoneCol, uBandContrast), zone);
        // faint in-band luminance grain from the warp field itself (hue-neutral,
        // contrast-scaled) — the close-deck sheared-flow texture inside one band.
        col *= 1.0 + 0.10 * uBandContrast * r;
        // E5 #3a depth layer: faint NH₃ "mushball" compositional tint, banded in latitude by wMush (a
        // DISTINCT channel from the jet field — warmer where NH₃ is depleted). Small, contrast-scaled.
        col *= 1.0 + vec3(0.05, 0.01, -0.06) * ((wMush - 0.5) * 2.0) * uBandContrast;
        // F27 storm color terms ride on the finished band color (core / collar /
        // companion) — N here is already the storm-swirled direction from the call
        // site, so mask and deflected stripes share one geometry. Count 0 skips the
        // call: byte-identical F25 output (the F27 regression contract).
        // provinceWeight(PROV_GREATSPOT) is NEUTRAL (floor 1.0) — the registry fan-out
        // convention's multiply, kept as the mix weight (identically 1.0 today).
        // F28 train slots 1+ ride this SAME weight: PROV_STORMTRAIN's row exists only
        // for the data mirror (vitest drift guard) — both rows are neutral, so the
        // shared read is identically 1.0 either way.
        if (uStormCount > 0) col = mix(col, stormColTerms(N, col), provinceWeight(PROV_GREATSPOT));
        // polar hood: a darkened cap keyed on latitude only (Jupiter/Neptune hoods);
        // bands fade INTO it rather than pinching at a convergence point.
        float hood = smoothstep(0.72, 0.95, abs(trueLat));
        col *= 1.0 - 0.30 * hood;
        // F29 polar vortex — painted AFTER the hood (composition choice, card §6.5
        // step deviation noted): the hood is the far-distance polar read and stays
        // the unchanged base wherever the vortex gate fades (0.38-0.48 rad), while
        // the vortex regime takes over ON TOP of it poleward — collar/eyes/tint
        // hold their designed contrasts instead of being rescaled x0.7 by the hood
        // multiply. Strength 0 (enable off, or any solid preset) skips the call:
        // byte-identical F28 output — the F29 regression contract.
        if (uPolarStrength > 0.0) col = polarVortexCol(N, col);
        return col;
      }

      // ── F2 craters (Stage-C step 3, Relief) — transcribed from craterProfile()
      // in planet-lod-lab-core.js (same constants, vitest-pinned analytic dhdr).
      // r = dist(fragment,center)/craterRadius. Returns vec2(height, dh/dr).
      vec2 craterProfile(float r, float morphology, float relaxation, float terraceCount){
        float h = 0.0, dhdr = 0.0;
        if (r < 1.0){
          h    += 0.2 * (r*r - 1.0);                        // parabolic cavity (depth/diam ≈0.2)
          dhdr += 0.2 * 2.0 * r;
          float u = clamp(r/0.4, 0.0, 1.0);                 // central peak: s = 1 − smoothstep(0,0.4,r)
          float s = 1.0 - (u*u*(3.0-2.0*u));
          float dsdr = -(6.0*u*(1.0-u)) * (1.0/0.4);        // d/dr; auto-0 once clamped (u=1)
          h    += morphology * 0.14 * s;
          dhdr += morphology * 0.14 * dsdr;
          float tw = 0.02 * morphology;                     // terraces: cos rings on the inner wall
          float w  = 6.28318530718 * terraceCount;
          h    += tw * cos(w*r);
          dhdr += tw * (-w) * sin(w*r);
        }
        float rs = (r - 1.0)/0.18;                          // rim: gaussian peak at r≈1
        float rg = exp(-(rs*rs));
        h    += 0.05 * rg;
        dhdr += 0.05 * rg * (-2.0*(r-1.0)/(0.18*0.18));
        float k = 1.0 - relaxation;                         // relaxation → palimpsest
        return vec2(h*k, dhdr*k);
      }

      // The crater combiner — first consumer of the voronoi3d keystone (index §1).
      // Per cell: a hash gates whether it hosts a crater (uCraterDensity fraction)
      // and hashes its radius; morphology = smoothstep on the g⁻¹ transition diameter
      // (NO type branch). Accumulates the crater height delta + its chain-rule gradient.
      // uCraterDensity≤0 ⇒ early-out, so the Stage-A base render is untouched.
      void craterCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uCraterDensity <= 0.0) return;
        vec3 cellId, voroGrad;
        vec2 ff = voronoi3d(pos * uCraterScale + uCraterOffset, uVoroCells, cellId, voroGrad);
        vec3 ch = hash33(cellId);                                   // per-cell hash: host gate + radius
        float host = step(1.0 - uCraterDensity, ch.x);             // uCraterDensity fraction of cells crater
        float craterRadius = mix(0.18, 0.55, ch.y);                // hashed size (cell units)
        float diameter = 2.0 * craterRadius;
        float morphology = smoothstep(uCraterComplexD*0.6, uCraterComplexD, diameter);
        float r = ff.x / craterRadius;
        vec2 prof = craterProfile(r, morphology, uCraterRelaxation, uTerraceCount);
        float pw = provinceWeight(PROV_CRATERS);     // §8: craters keep to old terrain (anti-tectonic)
        float amp = uCraterAmp * host * pw;
        h    += amp * prof.x;
        // d(h)/d(vPos) = dh/dr · (1/craterRadius) · d(f1)/d(vPos);  d(f1)/d(vPos) = voroGrad·uCraterScale
        grad += amp * prof.y * (1.0/craterRadius) * voroGrad * uCraterScale;
      }

      // ── F3 ejecta apron (Stage-C step 3, Relief) — transcribed from ejectaProfile()
      // in planet-lod-lab-core.js (same constants, vitest-pinned analytic dhdr §5.4).
      // r = dist/craterRadius. Apron lives in 1<r<rOuter; F2 owns r≤1. rampart blends
      // the dry 1/r² skirt (0) ↔ the fluidized lobate terminal ridge (1). vec2(h, dh/dr).
      vec2 ejectaProfile(float r, float rampart, float rOuter){
        if (r <= 1.0 || r >= rOuter) return vec2(0.0);
        float invO2 = 1.0/(rOuter*rOuter);
        float norm  = 1.0/(1.0 - invO2);                  // skirt(1)=1, skirt(rOuter)=0
        float skirt  = (1.0/(r*r) - invO2) * norm;
        float dskirt = (-2.0/(r*r*r)) * norm;
        float rs = (r - 2.0)/0.3;                          // rampart ridge at r=2.0, w=0.3
        float ridge  = exp(-(rs*rs));
        float dridge = ridge * (-2.0*(r-2.0)/(0.3*0.3));
        return vec2(skirt*(1.0-rampart) + ridge*rampart,
                    dskirt*(1.0-rampart) + dridge*rampart);
      }

      // F3 ejecta combiner — WRAPS the same F2 voronoi3d craters (no new placement):
      // identical scale/offset/host-gate/hashed-radius, so the apron rings exactly the
      // F2 craters. The radial apron is modulated by an FBM lumpiness × a discontinuous-
      // patch mask (relief doc §F3.a — continuous near the rim, breaking into patches
      // outward) so it reads as broken ejecta, not a smooth donut. The radial slope is
      // chain-ruled exactly (the §5.4-tested term); the FBM-lump gradient uses noised()'s
      // analytic grad; the soft patch mask's r-derivative is treated locally-constant
      // (the Musgrave convention this codebase already uses for octave weights).
      // uEjectaStrength≤0 ⇒ early-out (Stage-A base + F1/F2/F4/F5/F6 untouched).
      void ejectaCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uEjectaStrength <= 0.0) return;
        vec3 cellId, voroGrad;
        vec2 ff = voronoi3d(pos * uCraterScale + uCraterOffset, uVoroCells, cellId, voroGrad);
        vec3 ch = hash33(cellId);                                   // SAME per-cell hash as F2
        float host = step(1.0 - uCraterDensity, ch.x);             // SAME host gate
        float craterRadius = mix(0.18, 0.55, ch.y);                // SAME hashed radius
        float r = ff.x / craterRadius;
        vec2 prof = ejectaProfile(r, uEjectaRampart, 2.5);
        vec4 ln = noised(pos * (uCraterScale * 2.7) + uCraterOffset);  // .x value, .yzw grad
        float fbm = 0.5 + 0.5 * ln.x;                              // 0..1
        float patchMask = mix(1.0, smoothstep(0.35, 0.85, fbm), smoothstep(1.2, 2.2, r)); // patchy outward
        float lump = mix(1.0, fbm, uEjectaLump);
        float m = host * lump * patchMask;
        // §8: ejecta wraps F2's craters — SAME affinity (PROV_CRATERS) so aprons never
        // ring province-suppressed craters.
        float pw = provinceWeight(PROV_CRATERS);
        float amp = uEjectaStrength * uEjectaAmp * pw;
        h += amp * m * prof.x;
        // d(amp·m·prof.x)/dpos = amp·[ m·prof.y·dr/dpos + prof.x·dm/dpos ]
        vec3 drdp = (1.0/craterRadius) * voroGrad * uCraterScale;  // dr/dpos (chain-ruled, exact)
        vec3 dfbm = 0.5 * ln.yzw * (uCraterScale * 2.7);           // d(fbm)/dpos from noised()
        vec3 dmdp = host * patchMask * uEjectaLump * dfbm;         // lump term (patchMask r-deriv held constant)
        grad += amp * (m * prof.y * drdp + prof.x * dmdp);
      }

      // F3 bright rays — the ALBEDO exception (relief doc §F3.a): high-albedo streaks
      // radiating from YOUNG AIRLESS craters. NOT relief (no height/grad) — returns a
      // luminance brightening added to the surface BEFORE posterize (research: enough
      // amplitude to cross a band or it gets crushed). Reuses the SAME F2 voronoi centers.
      // Azimuth from a stable per-crater basis (e1,e2) — constant-azimuth = a ray line.
      // uRayBrightness≤0 (driven airless×young gate) ⇒ 0. LIMITATION: rays truncate at
      // Voronoi cell boundaries (a ray system physically overruns its cell) — carry-forward.
      float rayField(vec3 pos){
        if (uRayBrightness <= 0.0) return 0.0;
        vec3 cellId, voroGrad;
        vec2 ff = voronoi3d(pos * uCraterScale + uCraterOffset, uVoroCells, cellId, voroGrad);
        vec3 ch = hash33(cellId);
        float host = step(1.0 - uCraterDensity, ch.x);
        float craterRadius = mix(0.18, 0.55, ch.y);
        float r = ff.x / craterRadius;
        vec3 dir = voroGrad;                                        // normalize(fragment - center): outward
        vec3 e1 = normalize(hash33(cellId + 3.1) * 2.0 - 1.0);     // stable per-crater basis
        vec3 ref = abs(e1.z) < 0.9 ? vec3(0.0,0.0,1.0) : vec3(1.0,0.0,0.0);
        vec3 e2 = normalize(cross(e1, ref));
        float az = atan(dot(dir, e2), dot(dir, e1));
        float streaks = pow(max(0.5 + 0.5*sin(az*uRayCount + ch.z*6.2831853), 0.0), uRaySharp);
        float radial = smoothstep(1.0, 1.3, r) * (1.0 - smoothstep(2.0, 6.0, r));  // start past rim, fade out
        return uRayBrightness * host * streaks * radial * 0.35 * provinceWeight(PROV_CRATERS);   // §8: rays follow their craters
      }

      // ── F4 graben profile (Stage-C step 3, Relief) — transcribed from grabenProfile()
      // in planet-lod-lab-core.js (same flat-floor trench, vitest-pinned analytic slope).
      // d = perpendicular distance to the rift line. Returns vec2(depth ≤ 0, d(depth)/dd).
      vec2 grabenProfile(float d, float halfWidth, float floorFrac){
        float floorHalf = floorFrac * halfWidth;
        float span = halfWidth - floorHalf;
        float depth = smoothstep(floorHalf, halfWidth, d) - 1.0;   // -1 floor → 0 outside
        float dddd = 0.0;
        if (span > 1e-6 && d > floorHalf && d < halfWidth){
          float t = (d - floorHalf) / span;
          dddd = (6.0 * t * (1.0 - t)) / span;                     // d/dd of smoothstep
        }
        return vec2(depth, dddd);
      }

      // F4 canyon combiner — tectonic graben that WRITES the shared canyonHeight
      // accumulator (registry §1; Fluvial incised gorges + Cryo chasma ADD IN later).
      // Each rift is a great circle ⊥ a seeded plane normal: a surface point's signed
      // distance to the plane is s = dot(pos, n) (pos on the unit sphere), so the
      // perpendicular distance to the rift line is |s|, with a CONSTANT gradient
      // ds/dpos = n. The graben profile carves a flat-floored trench; its wall slope
      // chain-rules into the shading gradient as gp.y·sign(s)·n so the V-walls light
      // correctly. uChasmaDepth≤0 ⇒ early-out (Stage-A base + F1/F2 untouched).
      void canyonCombiner(vec3 pos, inout float h, inout float canyonHeight, inout vec3 grad){
        if (uChasmaDepth <= 0.0) return;
        float pw = provinceWeight(PROV_CANYONS);                   // §8: rifts die out leaving their province
        for (int i = 0; i < 3; i++){
          if (i >= uChasmaCount) break;
          // WS4 T13 — branch-guarded shared grain (D6). strength==0 ⇒ verbatim normalize(uChasmaAxis[i]).
          vec3 n = uTectonicGrainStrength > 0.0
            ? grainProvinceRotate(normalize(mix(uChasmaAxis[i], sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
            : normalize(uChasmaAxis[i]);
          float s = dot(pos, n);                                   // signed dist to rift plane
          float d = abs(s);
          vec2 gp = grabenProfile(d, uChasmaWidth, uChasmaFloor);  // (depth ≤ 0, d depth/dd)
          float dep = uChasmaDepth * gp.x * pw;                    // ≤ 0 — carved DOWN
          canyonHeight += dep;                                     // ★ the shared accumulator
          h            += dep;
          // d(dep)/dpos = uChasmaDepth · gp.y · dd/ds · ds/dpos,  dd/ds = sign(s), ds/dpos = n
          grad += uChasmaDepth * pw * gp.y * sign(s) * n;
        }
      }

      // ── F5 scarp profile (Stage-C step 3, Relief) — transcribed from scarpProfile()
      // in planet-lod-lab-core.js (same smoothstep step, vitest-pinned analytic slope).
      // field = the smooth scalar whose iso-contour the cliff follows. Returns
      // vec2(height ∈ [0,1], d(height)/dfield) — flat blocks, soft cliff face between.
      vec2 scarpProfile(float field, float level, float width){
        float e0 = level - width, e1 = level + width;
        float height = smoothstep(e0, e1, field);
        float dhdf = 0.0;
        float span = e1 - e0;
        if (span > 1e-6 && field > e0 && field < e1){
          float t = (field - e0) / span;
          dhdf = (6.0 * t * (1.0 - t)) / span;                  // d/dfield of smoothstep
        }
        return vec2(height, dhdf);
      }

      // F5 scarp combiner — warped fault-scarp province (lobate contraction scarps /
      // horst-and-graben). The scarp fronts are iso-contours of a directional field
      // dot(pos, axis) made sinuous by a noise warp; a periodic soft-step train along
      // that field raises/drops alternating fault blocks (each block edge is a one-sided
      // cliff that lights as a hard lit/shadow edge under the posterizer). The field's
      // gradient is EXACT (axis + warp·noiseGrad — no domain-warp Jacobian), so the cliff
      // faces light correctly. uScarpStyle flips polarity (thrust up ↔ normal down).
      // uScarpStrength≤0 ⇒ early-out (Stage-A base + F1/F2/F4 untouched).
      void scarpCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uScarpStrength <= 0.0) return;
        // WS4 grain wiring (the PATTERN T13 repeats). BRANCH, not mix-to-0 (D6): at strength==0 the
        // ELSE runs normalize(uScarpAxis) verbatim — no cube fetch, no mix, no precision drift — so
        // the grain-OFF planet is BYTEWISE the pre-WS4 shader even with uTectonicGrainCube still null.
        vec3 ax = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate(normalize(mix(uScarpAxis, sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
          : normalize(uScarpAxis);
        vec4 wn = noised(pos * uScarpWarpFreq + uMacroOffset + uScarpDomainOffset); // analytic value+grad (+🎲 offset)
        float field  = dot(pos, ax) + uScarpWarp * wn.x;          // directional + warp
        vec3  dfield = ax + uScarpWarp * uScarpWarpFreq * wn.yzw;  // EXACT field gradient
        float phase = field * uScarpFreq;
        float s = sin(phase);                                     // periodic fault train
        vec2 sp = scarpProfile(s, 0.0, uScarpWidth);              // smoothed block step
        float styleSign = mix(1.0, -1.0, clamp(uScarpStyle, 0.0, 1.0));  // thrust up / normal down
        float amp = uScarpStrength * styleSign * provinceWeight(PROV_SCARPS);   // §8
        h += amp * (sp.x - 0.5);                                  // center on datum (±0.5 blocks)
        // d(sp.x)/dpos = dh/ds · cos(phase) · uScarpFreq · dfield
        grad += amp * sp.y * cos(phase) * uScarpFreq * dfield;
      }

      // ── F6 HeteroTerrain (Stage-C step 3, Relief — relief doc §F6.a) ──
      // Musgrave height-stratified fBm: each octave's contribution is weighted by the
      // RUNNING height (clamp(value,0,1)) so high areas grow rough and low areas stay
      // smooth → broad flat-floored basins + rough-margined highlands (the plateau base).
      // The weight is treated locally-constant per octave (Musgrave/Decarpentier, same as
      // fbmdRidged's weight, so the gradient is the standard fbmd chain rule scaled by
      // the weight. Carries fbmd's trailing-octave + fwidth fade (anti-shimmer, §5.3).
      vec4 fbmdHetero(vec3 pos, float octaves, float fwBase, float offset){
        float freq = uNoiseScale * 0.3;
        float amp  = 0.5;
        vec4 n0 = noised(pos * freq + uMacroOffset + uPlateauDomainOffset);
        float value = offset + amp * n0.x;                        // octave-0 ground level
        vec3  grad  = amp * freq * n0.yzw;
        float weight = value;                                     // height-stratification gain
        amp *= 0.5; freq *= 2.0;
        for (int i = 1; i < 12; i++){
          if (float(i) >= octaves) break;
          float w = clamp(octaves - float(i), 0.0, 1.0);
          if (uFwClamp == 1) w *= 1.0 - smoothstep(0.4, 0.8, fwBase * freq);
          vec3 off = (i < 3) ? uMacroOffset : uDetailOffset;
          vec4 n = noised(pos * freq + off + uPlateauDomainOffset);
          float cw = clamp(weight, 0.0, 1.0);                     // locally-const stratification weight
          value += amp * w * cw * n.x;
          grad  += amp * w * cw * freq * n.yzw;
          weight = value;
          amp *= 0.5; freq *= 2.0;
        }
        return vec4(value, grad);
      }

      // ── F17 slope-damped FBM (Cryo step 5, glacial ice mantle — cryo-doc §2 F17) ──
      // The "erosion FBM" a += b·n.x/(1+k·dot(d,d)) (relief research §3.1): each octave's
      // amplitude is DAMPED by the gradient accumulated so far, so detail dies on steep slopes
      // and survives in flats — ice fills basins smooth, exposed rock stays detailed (exactly
      // the glaciated look). Like fbmdHetero the per-octave weight is locally-constant (the
      // running gradient is held fixed for the octave), so the gradient is the standard fbmd
      // chain rule scaled by that weight — NO new finite-diff oracle (it reweights the §5.4-pinned
      // noised() octaves). Carries fbmd's trailing-octave + fwidth anti-shimmer fade.
      vec4 fbmdDamped(vec3 pos, float octaves, float fwBase, float damp){
        float freq = uNoiseScale * 0.3;
        float amp  = 0.5;
        float h = 0.0;
        vec3 grad = vec3(0.0);
        for (int i = 0; i < 12; i++){
          if (float(i) >= octaves) break;
          float w = clamp(octaves - float(i), 0.0, 1.0);          // trailing-octave fade
          if (uFwClamp == 1) w *= 1.0 - smoothstep(0.4, 0.8, fwBase * freq);
          float dampW = 1.0 / (1.0 + damp * dot(grad, grad));      // slope-damping (locally-const this octave)
          vec3 off = (i < 3) ? uMacroOffset : uDetailOffset;
          vec4 n = noised(pos * freq + off + uGlacialOffset);
          h    += amp * w * dampW * n.x;
          grad += amp * w * dampW * freq * n.yzw;                  // chain rule, weight held constant
          amp  *= 0.5;
          freq *= 2.0;
        }
        return vec4(h, grad);
      }

      // ── F6 mesa terrace (Stage-C step 3, Relief) — transcribed from terraceProfile()
      // in planet-lod-lab-core.js (same soft-riser smoothstep, vitest-pinned slope).
      // Returns vec2(terraced value, dv/dh) — flat treads, soft risers between.
      vec2 terraceProfile(float h, float levels, float softness){
        float scaled = h * levels;
        float idx = floor(scaled);
        float frac = scaled - idx;
        float e0 = 1.0 - softness;
        float riser = smoothstep(e0, 1.0, frac);
        float value = (idx + riser) / levels;
        float dvdh = 0.0;
        float span = 1.0 - e0;
        if (span > 1e-6 && frac > e0 && frac < 1.0){
          float t = (frac - e0) / span;
          dvdh = (6.0 * t * (1.0 - t)) / span;
        }
        return vec2(value, dvdh);
      }

      // F6 plateau combiner — flat-topped highlands. The HeteroTerrain height is run
      // through the mesa terrace, so broad highs become stacked flat treads with steep
      // risers (the plateau/mesa read). Chain rule: d(terrace)/dpos = dv/dh · dheight/dpos,
      // and dheight/dpos = ph.grad · uPlateauScale. uPlateauStrength≤0 ⇒ early-out
      // (Stage-A base + F1/F2/F4/F5 untouched). The −0.5 removes a DC bias (shading is
      // normal-only, so the constant is cosmetic; the gradient is what lights).
      void plateauCombiner(vec3 pos, float fwBase, inout float h, inout vec3 grad){
        if (uPlateauStrength <= 0.0) return;
        // Cap octaves so the terraced field stays BROAD — terracing a full multi-octave
        // height chops fine detail into band-crossing noise instead of broad flat mesas.
        // Plateaus are large features; they don't gain fine roughness at high LOD.
        float plOct = min(uOctaves, 3.0);
        vec4 ph = fbmdHetero(pos * uPlateauScale, plOct, fwBase * uPlateauScale, uPlateauOffset);
        vec2 tp = terraceProfile(ph.x, uPlateauLevels, uPlateauSoftness);
        float pw = provinceWeight(PROV_PLATEAUS);                  // §8: mesas mark ancient highlands
        h    += uPlateauStrength * (tp.x - 0.5) * pw;
        grad += uPlateauStrength * pw * tp.y * ph.yzw * uPlateauScale;
      }

      // ── F6 ridgeWave — tessera ridge fold (Stage-C step 3) — transcribed from
      // ridgeWave() in planet-lod-lab-core.js (same minus-abs-sin fold, vitest-pinned
      // analytic derivative). value = 1 - |sin(phase)|; dvdphase = -sign(sin)*cos(phase).
      // The -sign() correction across the |.| fold is the relief doc 5.4 silent-bug class
      // (drop it and the groove walls light backward yet it compiles fine).
      vec2 ridgeWave(float phase){
        float s = sin(phase);
        float value = 1.0 - abs(s);
        float dvdphase = -sign(s) * cos(phase);
        return vec2(value, dvdphase);
      }

      // F18 bladeProfile — CH₄ penitente / bladed terrain: the ridgeWave (1−|sin|) SHARPENED by a power
      // so the rounded ridge narrows into a thin tall blade. Transcribed from the CPU bladeProfile()
      // (finite-diff-pinned §5.4). The pow chain-rules through the already-pinned ridgeWave; the
      // −sign(sin) correction lives inside ridgeWave and is INHERITED. value=pow(rw,sharp); at the
      // groove (rw=0) pow(0,sharp−1)=0 for sharp>1 → a smooth floor. rw.x∈[0,1] so pow is well-defined.
      vec2 bladeProfile(float phase, float sharpness){
        vec2 rw = ridgeWave(phase);
        float value = pow(rw.x, sharpness);
        float dvdphase = sharpness * pow(rw.x, sharpness - 1.0) * rw.y;
        return vec2(value, dvdphase);
      }

      // F6 tessera combiner — Venus-style crosscutting ridge-and-groove lattice. TWO
      // warped-iso-contour ridge fields (reusing the F5 scarp warp: dot(pos,axis) made
      // sinuous by a noised() warp, EXACT field gradient axis + warp*warpFreq*noiseGrad)
      // are each carved as a 1-|sin| ridge and MULTIPLIED: the product drops to 0 wherever
      // EITHER field is in a groove, so grooves from BOTH orientations show -> the
      // crosscutting lattice over a high crust. The two warps use different seeds
      // (macro/detail offsets) so the groove sets decorrelate. Gradient = product rule
      // across the two ridges. uTesseraStrength<=0 ⇒ early-out (Stage-A + F1/F2/F4/F5/plateau
      // untouched). NB single-octave sin-trains (like F5), so no fwidth fade; keep
      // uTesseraFreq modest to avoid the product shimmering.
      void tesseraCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uTesseraStrength <= 0.0) return;
        // axis 0 — warped with the macro seed. WS4 T13 — branch-guarded shared grain (D6).
        vec3 ax0 = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate(normalize(mix(uTesseraAxis[0], sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
          : normalize(uTesseraAxis[0]);
        vec4 wn0 = noised(pos * uTesseraWarpFreq + uMacroOffset + uTesseraDomainOffset);
        float field0  = dot(pos, ax0) + uTesseraWarp * wn0.x;
        vec3  dfield0 = ax0 + uTesseraWarp * uTesseraWarpFreq * wn0.yzw;
        float phase0  = field0 * uTesseraFreq;
        vec2  rw0 = ridgeWave(phase0);                            // ridge value + d/dphase
        vec3  dr0 = rw0.y * uTesseraFreq * dfield0;               // d(ridge0)/dpos
        // axis 1 — warped with the detail seed (decorrelated groove set). WS4 T13 — branch-guarded grain.
        vec3 ax1 = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate(normalize(mix(uTesseraAxis[1], sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
          : normalize(uTesseraAxis[1]);
        vec4 wn1 = noised(pos * uTesseraWarpFreq + uDetailOffset + uTesseraDomainOffset);
        float field1  = dot(pos, ax1) + uTesseraWarp * wn1.x;
        vec3  dfield1 = ax1 + uTesseraWarp * uTesseraWarpFreq * wn1.yzw;
        float phase1  = field1 * uTesseraFreq;
        vec2  rw1 = ridgeWave(phase1);
        vec3  dr1 = rw1.y * uTesseraFreq * dfield1;
        // product (union of grooves) + product-rule gradient
        float prod = rw0.x * rw1.x;
        vec3  dprod = rw1.x * dr0 + rw0.x * dr1;
        float pw = provinceWeight(PROV_TESSERA);                  // §8: deformed-crust province
        h    += uTesseraStrength * (prod - 0.5) * pw;             // -0.5 DC cosmetic (normal-only shading)
        grad += uTesseraStrength * pw * dprod;
      }

      // ── F7 edifice profile (Stage-C step 3, Relief) — transcribed from edificeProfile()
      // in planet-lod-lab-core.js (same constants, vitest-pinned analytic dhdr §5.4).
      // r = dist/edificeRadius. Cone body pow(1-r, p), p = mix(1.5,4,shieldStratoMix)
      // (shield broad ↔ strato steep), with a summit caldera bowl (F2 cavity shape)
      // subtracted at r<calderaR. Zero for r>=1. Returns vec2(height, dh/dr).
      vec2 edificeProfile(float r, float shieldStratoMix, float calderaR){
        if (r >= 1.0) return vec2(0.0);
        float p = mix(1.5, 4.0, clamp(shieldStratoMix, 0.0, 1.0));
        float omr = 1.0 - r;
        float h = pow(omr, p);
        float dhdr = -p * pow(omr, p - 1.0);                      // d(pow(1-r,p))/dr
        if (r < calderaR){                                        // summit caldera bowl
          float s = r / calderaR;
          h    += 0.5 * (s*s - 1.0);                              // -depth at center -> 0 at rim
          dhdr += 0.5 * 2.0 * r / (calderaR*calderaR);
        }
        return vec2(h, dhdr);
      }

      // F7 edifice combiner — volcanic shield/strato cones at hashed Voronoi centers
      // (a NEW placement, sparser than craters via uEdificeScale -> fewer, bigger cones).
      // Each hosting cell gets a radial cone + summit caldera; uVolcanismStrength gates
      // the host fraction (a low-activity world shows a few scattered volcanoes), and
      // uEdificeMaxHeight scales the height (low-g worlds -> giant shields, the Olympus
      // Mons driver). The radial slope chain-rules exactly via voroGrad*uEdificeScale
      // (same as craterCombiner). uVolcanismStrength<=0 ⇒ early-out (Stage-A base +
      // F1/F2/F3/F4/F5/F6 untouched, regression-safe).
      void edificeCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uVolcanismStrength <= 0.0) return;
        vec3 cellId, voroGrad;
        vec2 ff = voronoi3d(pos * uEdificeScale + uEdificeOffset, uVoroCells, cellId, voroGrad);
        vec3 ch = hash33(cellId);                                 // per-cell hash: host gate + radius
        float host = step(1.0 - uVolcanismStrength, ch.x);        // volcanism fraction of cells host an edifice
        float edificeRadius = mix(0.3, 0.7, ch.y);                // hashed size (cell units; bigger than craters)
        float r = ff.x / edificeRadius;
        vec2 prof = edificeProfile(r, uShieldStratoMix, uEdificeCaldera);
        float amp = uEdificeAmp * uEdificeMaxHeight * host * provinceWeight(PROV_EDIFICES);   // §8: volcanic province
        h    += amp * prof.x;
        // d(h)/d(vPos) = dh/dr · (1/edificeRadius) · d(f1)/d(vPos); d(f1)/d(vPos)=voroGrad·uEdificeScale
        grad += amp * prof.y * (1.0/edificeRadius) * voroGrad * uEdificeScale;
      }

      // ── F8 lava plains (Stage-C step 3, Relief — relief doc §F8.a flood-basalt) ──
      // Flood basalt FILLS and FLATTENS older terrain: inside flow regions the accumulated
      // relief (mountains/craters/edifices/…) is suppressed toward a smooth plain, and a
      // gentle wrinkle-ridge texture (linear compression ridges, deferred from F5 to F8) is
      // laid on top. The flow-region mask is a low-freq noised() threshold whose EXTENT grows
      // with uLavaCoverage (Io-grade resurfacing → whole-world plains). F8 runs LAST in the
      // combiner chain, so suppression is a simple attenuation of the accumulated grad (this is
      // normal-perturbation, not a re-differentiated height — the mask's own gradient is
      // cosmetic, not chain-ruled). Wrinkle ridges reuse F6's ridgeWave + F5's warped-field
      // pattern (both §5.4-pinned), so no new finite-diff oracle. uLavaCoverage≤0 ⇒ early-out.
      void lavaCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uLavaCoverage <= 0.0) return;
        const float WRINKLE_WARP_FREQ = 2.0;
        // flow-region mask — low-freq FBM, thresholded; extent ∝ coverage (1 ⇒ whole world)
        vec4 rn = noised(pos * uLavaScale + uLavaOffset);
        float fbm01 = 0.5 + 0.5 * rn.x;
        float region = smoothstep(1.0 - uLavaCoverage, 1.0 - uLavaCoverage + 0.25, fbm01);
        region *= provinceWeight(PROV_LAVA);                        // §8: flood basalt pools in the volcanic province
        // SMOOTH: lava floods + flattens older relief inside the region
        h    *= (1.0 - region);
        grad *= (1.0 - region);
        // wrinkle ridges — linear compression ridges on the fresh plain (only where flooded).
        // WS4 T13 — branch-guarded shared grain (D6). strength==0 ⇒ verbatim normalize(uLavaAxis).
        vec3 ax = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate(normalize(mix(uLavaAxis, sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
          : normalize(uLavaAxis);
        vec4 wn = noised(pos * WRINKLE_WARP_FREQ + uLavaOffset + uMacroOffset);
        float field  = dot(pos, ax) + uWrinkleWarp * wn.x;          // sinuous directional field
        vec3  dfield = ax + uWrinkleWarp * WRINKLE_WARP_FREQ * wn.yzw;  // EXACT field gradient
        float phase  = field * uWrinkleFreq;
        vec2  rw = ridgeWave(phase);                                // 1−|sin| ridge + d/dphase
        float amp = uWrinkleAmp * region;
        h    += amp * (rw.x - 0.5);                                 // −0.5 DC cosmetic (normal-only shading)
        grad += amp * rw.y * uWrinkleFreq * dfield;
      }

      // ── F8 emissive lava cracks (Stage-C step 3, Relief — relief doc §F8.a, THE HEADLINE) ──
      // Worley F2−F1 crack mask over the fresh basalt, pulsing via uTime, routed through the
      // ★ emissive-bypass channel so the glow stays crisp over the posterized rock (the single
      // best posterization-survivor in the domain — emissive + high contrast, §F8.c). Confined
      // to the same flow regions as the plains (cracks live in the lava, not the highlands).
      // uLavaActivity (D12 tidal) is the cold-vs-glowing gate: 0 ⇒ dark (old solidified plains).
      // NOT relief — no height/grad, like rayField(). Molten color from the shared
      // emissiveBlackbody ramp at ~1400 K (fresh-basalt incandescence). uTime drives the pulse.
      vec3 lavaCrackEmissive(vec3 pos){
        if (uLavaActivity <= 0.0 || uLavaCoverage <= 0.0) return vec3(0.0);
        // Domain-warp the crack field so borders meander like flow channels/levees instead of
        // a uniform polygonal lattice (Max UAT 2026-06-10: flows must read liquid, not
        // cell-based). Three decorrelated noised() evals build the warp vector; emissive-only,
        // so no gradient bookkeeping is needed.
        const float CRACK_WARP_FREQ = 1.6;
        const float CRACK_WARP_AMP  = 0.38;
        vec4 w1 = noised(pos * CRACK_WARP_FREQ + uLavaOffset + vec3(11.73, 4.21, 7.97));
        vec4 w2 = noised(pos * CRACK_WARP_FREQ + uLavaOffset + vec3(-7.31, 9.02, -3.55));
        vec4 w3 = noised(pos * CRACK_WARP_FREQ + uLavaOffset + vec3(2.62, -12.34, 5.18));
        vec3 wpos = pos + CRACK_WARP_AMP * vec3(w1.x, w2.x, w3.x);
        vec3 cId, cGrad;
        vec2 cff = voronoi3d(wpos * uCrackScale + uLavaOffset, uVoroCells, cId, cGrad);
        float crackMask = 1.0 - smoothstep(0.0, uCrackWidth, cff.y - cff.x);   // bright on warped channels
        // restrict to flooded regions (same mask basis as lavaCombiner)
        vec4 rn = noised(pos * uLavaScale + uLavaOffset);
        float fbm01 = 0.5 + 0.5 * rn.x;
        float region = smoothstep(1.0 - uLavaCoverage, 1.0 - uLavaCoverage + 0.25, fbm01);
        // Cluster the channel glow into active volcanic provinces — Io from space reads as
        // scattered glowing centers, never a globe-tiling net. Extent scales with activity.
        // SUBSUMED by Stage-D 2026-06-10: the F08-fix1 ad-hoc pn-noise mask is replaced by the
        // SHARED volcanic field (gProvince.y) carrying fix1's activity-scaled threshold —
        // stacking two independent masks intersects to near-nothing (spike A/B shot 06).
        // uProvinceWeight=0 falls back to a constant mid field (uniform, pre-fix1 behavior).
        float provField = mix(0.7, gProvince.y, uProvinceWeight);
        float province = smoothstep(0.62 - 0.22 * uLavaActivity, 0.78, provField);
        // Flow-front glow — incandescent lobate margins where flows advance; the region-edge
        // band peaks at the mask's 0.5 contour, giving the liquid-sheet read at the boundary.
        float front = region * (1.0 - region) * 4.0;
        // animated glow — pulse phase varies spatially via the region FBM so cracks shimmer async
        float glow = 0.5 + 0.5 * sin(uTime * uLavaGlowRate + fbm01 * 6.2831853);
        vec3 molten = emissiveBlackbody(1400.0);
        float mask = crackMask * province * region + front * 0.9;
        return mask * glow * uLavaActivity * molten;
      }

      // ── F42 tar flats — carbon-world hydrocarbon basin fills (Exotic, card section
      // 6.5 step 5): the F8 uLavaCoverage region-mask resurfacing pattern — the
      // sanctioned height-domain combiner — mirrored exactly (early-out gate, ONE
      // low-freq noised() octave -> fbm01 -> smoothstep region whose EXTENT grows
      // with coverage, multiplicative h/grad suppression), with TWO carbon-specific
      // differences: (a) a HEIGHT gate pools the tar in low basins only (card
      // section 4 height-based stratification — reduced-carbon liquids fill lows,
      // never paint crests), and (b) NO wrinkle ridges (tar is a smooth fill — the
      // flat-dither-vs-textured-relief contrast IS the read, the Titan dark-flats
      // template). The region mask is exported (out cbTar) for the Stage-6 dark
      // fill tone + the post-posterize tar sheen (ONE mask basis, no recompute
      // drift). Runs in the LAST multiplicative slot beside lavaCombiner (below
      // the F19 additive-contract line — multiplicative passes only live there).
      // uCarbonStrength or uTarCoverage <= 0 early-outs: h/grad untouched,
      // byte-identical pre-F42 output — the F42 regression contract.
      void carbTarCombiner(vec3 pos, inout float h, inout vec3 grad, inout float cbTar){
        if (uCarbonStrength <= 0.0 || uTarCoverage <= 0.0) return;
        // flow-region mask — the F8 basis verbatim: low-freq FBM, thresholded;
        // extent grows with coverage (1 -> whole-world tar seas). Own seed offset
        // (decorrelated from F8's uLavaOffset) keyed to the planet's macro identity.
        vec4 cbRn = noised(pos * 1.4 + uMacroOffset + vec3(23.7, -8.1, 14.9));
        float cbFbm = 0.5 + 0.5 * cbRn.x;
        // Verify fix cycle 2: range remap (was a flat 1.8 gain, cycle 1) — the
        // raw F8 mapping left the knob's bottom half DEAD (0.35 default was
        // pixel-identical to 0) and the flat gain saturated above ~0.45. The
        // basin gate caps extent (tar can only fill lows), so the effective
        // window is onset ~0.54 .. all-basins ~0.85; map the whole 0..1 knob
        // onto it: default 0.35 -> 0.633 (visible), 1.0 -> 0.88 (every basin).
        float cbCovEff = 0.5 + 0.38 * uTarCoverage;
        float cbRegion = smoothstep(1.0 - cbCovEff, 1.0 - cbCovEff + 0.25, cbFbm);
        // height gate — tar pools LOW: full strength below the datum, gone on rises
        // (reads the INCOMING accumulated h, before its own flattening)
        cbRegion *= 1.0 - smoothstep(-0.02, 0.06, h);
        cbRegion *= uCarbonStrength * provinceWeight(PROV_CARBON);
        // SMOOTH: tar floods + flattens older relief inside the region (F8 verbatim —
        // the fill relaxes the basin toward the datum, shorelines stay crisp via the
        // smoothstep edges)
        h    *= (1.0 - cbRegion);
        grad *= (1.0 - cbRegion);
        cbTar = cbRegion;
      }

      // doubleRidgeProfile — F10 Europa double-ridge cross-line profile (transcribed from the
      // planet-lod-lab-core.js oracle; constants DR_TROUGH_AMP=0.6, DR_TROUGH_W=0.5). Two
      // gaussian ridge crests at a=±offset flanking a gaussian trough at the line center a=0;
      // dh/dt folds through a=|t| via sign(t) (the §5.4 silent-bug correction, pinned in tests).
      vec2 doubleRidgeProfile(float t, float offset, float width){
        float a = abs(t);
        float troughW = offset * 0.5;
        float ridge  = exp(-(a - offset) * (a - offset) / (width * width));
        float trough = exp(-(a / troughW) * (a / troughW));
        float hh = ridge - 0.6 * trough;
        float dridge_da  = ridge  * (-2.0 * (a - offset) / (width * width));
        float dtrough_da = trough * (-2.0 * a / (troughW * troughW));
        float dh_da = dridge_da - 0.6 * dtrough_da;
        return vec2(hh, dh_da * sign(t));
      }

      // ── F9 chaos / disrupted terrain (Stage-C step 3, Relief — relief doc §F9.a) ──
      // Ice-shell chaos (Europa Conamara): inside disrupted regions the shell breaks into
      // RAFTS — a voronoi3d cell field where each cell gets a flat per-cell hashed height
      // AND a per-cell constant TILT (a hashed gradient that gives each raft a distinct
      // NORMAL, so adjacent plates catch light differently — the "jigsaw of moved plates"
      // look, not just bumpy). Between rafts (near cell borders) sits a lower, high-freq
      // refrozen MATRIX. COVERAGE = the SHARED uCryoActivity (Cryo-owned) × a low-freq region
      // mask. The relief NORMAL comes from the exact per-cell tilt + the matrix noised() grad
      // (pinned); the region/interior masks are cosmetic-gradient like F8's flow mask.
      // uCryoActivity<=0 ⇒ early-out (cheap tier: per-cell rotation matrix + subsidence
      // basins + antipodal placement are DEFERRED to the rich tier, relief doc §F9.d).
      void chaosCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uCryoActivity <= 0.0) return;
        vec4 mn = noised(pos * uChaosMaskScale + uChaosOffset);
        float region = smoothstep(1.0 - uCryoActivity, 1.0 - uCryoActivity + 0.3, 0.5 + 0.5 * mn.x);
        region *= provinceWeight(PROV_CHAOS);                    // §8: chaos clusters over internal heat
        if (region <= 0.0) return;
        vec3 cId, vGrad;
        vec2 ff = voronoi3d(pos * uChaosCellScale + uChaosOffset, uVoroCells, cId, vGrad);
        vec3 rh = hash33(cId);                                   // per-cell randoms (height + tilt)
        float interior = smoothstep(0.0, 0.10, ff.y - ff.x);     // 1 inside the raft, 0 on borders (matrix)
        float raftH = (rh.x - 0.5) * 2.0 * uChaosRaftJitter;     // flat per-cell height (cosmetic grad)
        vec3  tilt  = (rh - 0.5) * 2.0 * uChaosRaftJitter;       // per-cell CONSTANT tilt gradient (exact)
        vec4  rn = noised(pos * uChaosCellScale * 2.7 + uChaosOffset);   // refrozen matrix roughness (pinned grad)
        float matrixDepth = -0.4 * uChaosRaftJitter;
        h    += region * (interior * raftH + (1.0 - interior) * (matrixDepth + uChaosMatrixRough * rn.x));
        grad += region * (interior * tilt  + (1.0 - interior) * uChaosMatrixRough * rn.yzw);
      }

      // ── F43 crystalline facet field (Stage-C step 3, Relief — card F43 section 6.5 step 4) ──
      // The F9 chaos-raft mechanism at CRYSTAL amplitude: a voronoi3d cell field where each
      // grown cell becomes a FLAT planar facet — per-cell hashed base height + a per-cell
      // CONSTANT hashed tilt fed EXACTLY into grad (the exact-gradient trick, so each facet
      // is a true tilted plane that catches light distinctly, NOT a smooth bump) — plus an
      // IQ F2−F1 border-distance smoothstep RIDGE CREST raised at the cell seams (the sharp
      // crystal edges where faces meet). WHICH cells grow is gated by a low-freq fbm COVERAGE
      // mask (the F7 edifice gating): at low uFacetCoverage only scattered cells cross the
      // threshold (discrete protruding crystals), ramping to wall-to-wall at high coverage
      // (continuous faceted field) — the card's scattered→continuous variant axis, with the
      // FULL knob range made walkable (the F42 tar lesson: map 0..1 onto the live window, no
      // dead sliver). A finer SECOND voronoi octave (uFacetScale × 2.4) fades in by uLodRamp
      // (the octave-budget mechanism) so big facets gain sub-facets pop-free as the camera
      // closes (card step 5). ADDITIVE on grad (the F9 contract) so it lives ABOVE the F19
      // line beside chaosCombiner. Exports fctMask (coverage×grown presence) for the post-
      // posterize per-facet spark. uFacetStrength<=0 OR uFacetCoverage<=0 ⇒ early-out:
      // h/grad/fctMask untouched, byte-identical pre-F43 output — the F43 regression contract.
      void facetCombiner(vec3 pos, inout float h, inout vec3 grad, inout float fctMask){
        if (uFacetStrength <= 0.0 || uFacetCoverage <= 0.0) return;
        float amp = uFacetAmp * uFacetStrength * provinceWeight(PROV_FACETS);
        if (amp <= 0.0) return;
        // ── primary facet octave ──
        vec3 fctId, fctGrad;
        vec2 fctFF = voronoi3d(pos * uFacetScale + uMacroOffset + vec3(41.3, -27.6, 9.4),
                               uVoroCells, fctId, fctGrad);
        // coverage gate — low-freq fbm threshold picks WHICH cells grow crystals (F7 pattern).
        // Per-cell hash decides growth so a whole facet grows or doesn't (hard cell membership,
        // not a soft spatial fade that would smear the scattered read). FULL-range walkable map
        // (F42 tar lesson): coverage 0 → threshold 0.98 (a few cells), 1 → -0.05 (every cell).
        vec4 fctRn = noised(pos * (uFacetScale * 0.22) + uMacroOffset + vec3(-6.1, 13.8, 22.5));
        float fctHash = hash33(fctId + vec3(7.0)).z;                 // per-cell growth lottery
        float fctTh = mix(0.98, -0.05, uFacetCoverage);             // coverage lowers the bar
        float fctGrow = smoothstep(fctTh, fctTh + 0.18, 0.5 + 0.5 * fctRn.x + 0.30 * (fctHash - 0.5));
        if (fctGrow <= 0.0) return;
        fctGrow *= amp;
        vec3 fctRh = hash33(fctId);                                  // per-cell randoms (height + tilt)
        float fctBase = (fctRh.x - 0.5) * 0.7;                       // flat per-cell facet height
        vec3  fctTilt = (fctRh - 0.5) * 2.0;                         // per-cell CONSTANT tilt (exact grad, F9)
        // IQ F2−F1 border crest — a sharp raised ridge along the cell seams (crystal edges).
        // smoothstep(0.07,0,F2-F1): 1 at the seam (F2≈F1), 0 in the cell interior.
        float fctEdge = 1.0 - smoothstep(0.0, 0.07, fctFF.y - fctFF.x);
        float fctCrest = fctEdge * 0.45;                            // crest height contribution
        // border-crest gradient: ride the voronoi grad (∂F1/∂p) at the seam (cheap, points
        // up the crest face — the dominant slope at the edge).
        h    += fctGrow * (fctBase + fctCrest);
        grad += fctGrow * (fctTilt + fctEdge * 0.9 * fctGrad);
        // ── LOD2 sub-faceting octave — finer facets faded in by lodRamp (pop-free, card step 5) ──
        float fctLod = smoothstep(0.45, 1.0, uLodRamp);
        if (fctLod > 0.0){
          vec3 fctId2, fctGrad2;
          vec2 fctFF2 = voronoi3d(pos * (uFacetScale * 2.4) + uDetailOffset + vec3(15.7, 3.2, -19.1),
                                  uVoroCells, fctId2, fctGrad2);
          vec3 fctRh2 = hash33(fctId2 + vec3(53.0));
          float fctBase2 = (fctRh2.x - 0.5) * 0.7;
          vec3  fctTilt2 = (fctRh2 - 0.5) * 2.0;
          float fctEdge2 = 1.0 - smoothstep(0.0, 0.07, fctFF2.y - fctFF2.x);
          float fctSub = fctGrow * fctLod * 0.45;                   // sub-facets ride the SAME grown cells
          h    += fctSub * (fctBase2 + fctEdge2 * 0.45);
          grad += fctSub * (fctTilt2 + fctEdge2 * 0.9 * fctGrad2);
        }
        fctMask = fctGrow / max(amp, 1e-4);                          // 0..1 grown-facet presence (amp-normalized)
      }

      // ── F44 voronoi3dReg — voronoi3d with a REGULARITY jitter knob (card F44 §4) ──
      // A verbatim copy of the voronoi3d keystone (:737) with ONE change: each cell's
      // jitter is blended toward its REGULAR lattice node by reg, and that node is
      // PARITY-STAGGERED into a BCC arrangement (odd index-sum cells get a +half-cell
      // shift). reg=0 ⇒ full hash33 jitter (random Voronoi blobs, identical to voronoi3d
      // up to the offset); reg=1 ⇒ ZERO jitter on a BCC lattice — whose Voronoi cells are
      // truncated octahedra that read as HEXAGONS in surface cross-section (§4: zero-jitter
      // cubic gives squares, BCC gives hexes). The 0→1 sweep walks random-Voronoi → hex.
      // Returns the same vec2(F1,F2) + cellId + grad=normalize(p−center) contract as voronoi3d.
      vec2 voronoi3dReg(vec3 p, int cells, float reg, out vec3 cellId, out vec3 grad){
        vec3 ip = floor(p);
        vec3 fp = fract(p);
        float f1 = 1e9, f2 = 1e9;
        vec3 nCell = ip, nR = vec3(0.0);
        for (int gz=-1; gz<=1; gz++){
          if (cells < 27 && gz != 0) continue;     // 9-cell: center slab only
          for (int gy=-1; gy<=1; gy++){
            for (int gx=-1; gx<=1; gx++){
              vec3 g = vec3(float(gx), float(gy), float(gz));
              // TWO-SUBLATTICE BCC scan: each cell contributes TWO feature points — a CORNER
              // node (lattice offset 0) and a BODY-CENTER node (lattice offset 0.5). Each blends
              // from its OWN hashed jitter toward its node by reg, and BOTH compete in the
              // running F1/F2. reg=1 ⇒ the union {g} ∪ {g+0.5} over the integer grid is a true
              // BCC point set → truncated-octahedron Voronoi cells (hexagonal cross-sections).
              // reg=0 ⇒ both candidates are independent full-hash33-jitter points (random
              // Voronoi — the 0→1 continuum stays intact). Distinct hashes/ids keep them apart.
              vec3 gi = ip + g;                                       // this cell's integer node
              // — sublattice A: corner node —
              vec3 jitA = hash33(gi);
              vec3 cA   = g + mix(jitA, vec3(0.0), reg);              // jitter (reg0) → corner g (reg1)
              vec3 rA   = cA - fp;
              float dA  = length(rA);
              if (dA < f1){ f2 = f1; f1 = dA; nCell = gi; nR = rA; }
              else if (dA < f2){ f2 = dA; }
              // — sublattice B: body-center node (distinct hash seed → independent at reg0) —
              vec3 jitB = hash33(gi + vec3(0.5));
              vec3 cB   = g + mix(jitB, vec3(0.5), reg);              // jitter (reg0) → center g+0.5 (reg1)
              vec3 rB   = cB - fp;
              float dB  = length(rB);
              if (dB < f1){ f2 = f1; f1 = dB; nCell = gi + vec3(0.5); nR = rB; }
              else if (dB < f2){ f2 = dB; }
            }
          }
        }
        cellId = nCell;
        grad = (f1 > 1e-6) ? (-nR / f1) : vec3(0.0); // = normalize(p - center)
        return vec2(f1, f2);
      }

      // ── F44 hex-tessellated crust (Stage-C step 3, Relief — card F44 §6.5 step 2) ──
      // P15 crustal tessellation: a uniform-lithology crust tiled into ~hex cells. Uses the
      // voronoi3dReg variant (above) so uHexRegularity walks random-Voronoi → regular hex.
      // (1) trough BORDERS: the F2−F1 distance carved as a negative-height groove into
      //     height+gradient (the F18 N₂-polygon convention :2543) — borders carry the signal.
      // (2) per-cell hashed flat PLATEAU (F9 chaos-raft :2360) + analytic DOME from F1 (the
      //     Sputnik raised-center convex shading) — interiors stay quiet, dome's analytic
      //     gradient rides voronoi3d's grad=normalize(p−center) so no per-cell flicker.
      // ALL relief (height + gradient), ADDITIVE on grad (the F9/F19 contract), so it lives
      // above the F19 mass-wasting line. uHexStrength<=0 ⇒ early-out: byte-identical pre-F44.
      void hexCrust(vec3 pos, inout float h, inout vec3 grad){
        if (uHexStrength <= 0.0) return;
        float amp = uHexStrength * provinceWeight(PROV_HEXTESS);
        if (amp <= 0.0) return;
        vec3 hxId, hxGrad;
        vec3 hxQ = pos * uHexScale + uMacroOffset + vec3(19.4, -8.7, 33.1);
        // regularity jitter knob — 0=random Voronoi, 1=regular hex lattice (see voronoi3dReg).
        vec2 hxFF = voronoi3dReg(hxQ, uVoroCells, uHexRegularity, hxId, hxGrad);
        // ── borders: F2−F1 trough carved into height+gradient (F18 convention) ──
        // hxGrad = normalize(p−center) = ∂F1/∂p; the F2−F1 band's slope rides it (cell-edge
        // direction). DEPTH (not width) drives the gradient: the trough's analytic slope is
        // the carve depth × the band's spatial rate, matched to facetCombiner's 0.9 seam scale
        // (was uHexBorderWidth×0.9 ≈ 0.07 — ~12× too weak to shade; now uHexBorderDepth×0.9).
        float hxEdge = 1.0 - smoothstep(0.0, uHexBorderWidth, hxFF.y - hxFF.x);  // 1 at seam, 0 inside
        h    += amp * uHexBorderDepth * (-hxEdge);                       // carve trough (negative)
        grad += amp * uHexBorderDepth * 0.9 * hxEdge * hxGrad;           // trough slope ∝ DEPTH (facetCombiner 0.9 scale)
        // ── per-cell hashed flat/domed interior (F9 chaos-raft + Sputnik dome) ──
        vec3  hxRh = hash33(hxId);
        float hxInterior = smoothstep(0.0, uHexBorderWidth * 1.5, hxFF.y - hxFF.x);  // 1 inside, 0 at seam
        vec3  hxTilt = (hxRh - 0.5) * 2.0;                              // per-cell CONSTANT tilt (exact grad, F9 raft)
        float hxFlat = (hxRh.x - 0.5) * 0.4;                            // per-cell flat plateau height
        float hxDome = uHexDome * (1.0 - hxFF.x) * (1.0 - hxFF.x);      // convex toward cell center (F1→0 at center)
        h    += amp * hxInterior * (hxFlat + hxDome);
        // plateau tilt (F9 raft, ∝0.9) + dome's analytic gradient ∂/∂p[(1−F1)²]=−2(1−F1)∂F1/∂p.
        // hxDome already folds uHexDome, so the dome slope is 2(1−F1)·hxDome·(−hxGrad) — depth-faithful.
        grad += amp * hxInterior * (0.9 * hxTilt - 2.0 * (1.0 - hxFF.x) * hxDome * hxGrad);
      }

      // ── F45 shattered / fractured crust (Stage-C step 3, Relief — card F45 §6.5 step 5) ──
      // P15 catastrophic-disruption endmember: a uniform crust shattered into chaotic, mismatched,
      // tilted blocks (Miranda / Europa Conamara analog). A GLOBALIZED two-octave generalization of
      // chaosCombiner (:2372): the same voronoi3d mega-cells with per-cell hashed flat raft height +
      // per-cell CONSTANT tilt written DIRECTLY into grad (the F9 cosmetic-gradient — exact flat-plate
      // normals so each block lands in its own posterize band, UAT item 1), but PROMOTED from a masked
      // LOCAL patch (chaos gates on uCryoActivity) to a GLOBAL field whose region mask defaults to
      // cover≈1 (uShatMaskCover sweeps the intensity axis — local fracture zone → globally shattered,
      // UAT item 5). Adds (1) an F2−F1 border CREVASSE carved DOWN with graben walls (reuse
      // grabenProfile :1950) so inter-block fractures read as shadowed cliffs (UAT item 2), and (2) a
      // finer second-octave SUB-FRACTURE voronoi lattice GATED inside blocks (the two-scale read that
      // sells 'violently reassembled' over F44's uniform paving, UAT item 3). ALL relief (height +
      // gradient), ADDITIVE on grad (the F9/F19 contract), so it lives ABOVE the F19 mass-wasting line
      // beside chaosCombiner/hexCrust. uShatStrength<=0 ⇒ early-out: byte-identical pre-F45 output.
      // ── MAGNITUDE-MATCH (the F44 fix-cycle): per-block tilt pushes grad at the SAME magnitude as
      // chaosCombiner's raft tilt (region*interior*tilt, FULL uShatBlockJitter amplitude, no extra
      // scale, :2387); the border-crevasse grad uses ×uShatBorderDepth×0.9 (DEPTH drives the slope —
      // F44 v1 used ×width≈0.07, ~12× too weak → invisible). ──
      void shatterCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uShatStrength <= 0.0) return;                       // ≤0 EARLY-OUT (byte-identical pre-F45)
        // ── low-freq region mask: the uChaosMaskScale pattern, but GLOBAL (cover→1) ──
        vec4 shatMn = noised(pos * uShatMaskScale + uMacroOffset);
        float shatRegion = smoothstep(1.0 - uShatMaskCover, 1.0 - uShatMaskCover + 0.3, 0.5 + 0.5 * shatMn.x);
        shatRegion *= provinceWeight(PROV_SHATTER);
        float shatAmp = uShatStrength * shatRegion;
        if (shatAmp <= 0.0) return;
        // ── OCTAVE 1: voronoi3d MEGA-BLOCKS — per-cell flat height + per-cell CONSTANT tilt ──
        vec3 shatId, shatGrad;
        vec3 shatQ = pos * uShatScale + uMacroOffset + vec3(7.3, 24.1, -15.6);   // decorrelate seed
        vec2 shatFF = voronoi3d(shatQ, uVoroCells, shatId, shatGrad);
        vec3  shatRh   = hash33(shatId);                                          // per-block randoms (height + tilt)
        float shatInterior = smoothstep(0.0, uShatBorderWidth * 1.5, shatFF.y - shatFF.x);   // 1 inside block, 0 at seam
        float shatBlockH = (shatRh.x - 0.5) * 2.0 * uShatBlockJitter;            // per-block flat raft height
        vec3  shatTilt   = (shatRh - 0.5) * 2.0 * uShatBlockJitter;              // per-block CONSTANT tilt — THE grad driver (chaos contract, FULL jitter amplitude, no extra scale)
        h    += shatAmp * shatInterior * shatBlockH;
        grad += shatAmp * shatInterior * shatTilt;                              // ★ MAGNITUDE-MATCH chaosCombiner :2387 (region*interior*tilt)
        // ── BORDER CREVASSE: F2−F1 distance carved DOWN with graben walls (reuse grabenProfile) ──
        float shatBd = shatFF.y - shatFF.x;                                     // 0 at seam → grows inward
        vec2  shatGp = grabenProfile(shatBd, uShatBorderWidth, 0.2);            // depth∈[−1,0], .y = wall slope (flat-floor trench)
        h    += shatAmp * uShatBorderDepth * shatGp.x;                          // carve DOWN (shatGp.x ≤ 0)
        grad += shatAmp * uShatBorderDepth * 0.9 * shatGp.y * shatGrad;         // ★ DEPTH×0.9 drives slope (F44 lesson; shatGrad=∂F1/∂p=cell-edge dir)
        // ── OCTAVE 2: finer SUB-FRACTURE lattice within blocks (sells 'reassembled', not 'paved') ──
        vec3 shatSubId, shatSubGrad;
        vec2 shatSubFF = voronoi3d(shatQ * uShatSubFreq + vec3(41.2, -3.8, 9.5), uVoroCells, shatSubId, shatSubGrad);
        float shatSubEdge = 1.0 - smoothstep(0.0, uShatBorderWidth * 0.6, shatSubFF.y - shatSubFF.x);   // 1 at sub-seam
        h    += shatAmp * shatInterior * uShatSubAmt * (-shatSubEdge) * 0.5;    // shallow sub-grooves inside blocks
        grad += shatAmp * shatInterior * uShatSubAmt * 0.9 * shatSubEdge * shatSubGrad;   // ★ sub-seam slope into grad (0.9 scale)
        // (Sub-octave GATED by shatInterior so sub-fractures live INSIDE blocks, not across the
        //  mega-borders — preserves the two-scale read. A 2nd voronoi octave is the cheaper faithful
        //  default and matches the SPH/Voronoi fragmentation physics in §4.)
      }

      // ── F47 machine / structured surface helpers (Stage-7 EXOTIC overlay) ──
      // Inline triplanar surface-aligned 2D rectilinear grid (NOT a 3D lattice sliced by the
      // sphere — that gives curved-slice production artifacts). Three cardinal-plane fract() grids
      // blended by pow(abs(N),6.0) weights. Returns 2D border distance; cellHash via out-param.
      float machGrid1(vec2 uv, float scale, out float cellHash){
        vec2 g = fract(uv * scale);
        vec2 b = min(g, 1.0 - g);                 // distance to nearest grid line (per axis)
        float d = min(b.x, b.y);                  // 2D border distance
        vec2 cell = floor(uv * scale);
        cellHash = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
        return d;
      }
      // blend the 3 axis-plane grids by triplanar weights → .x = blended border distance, cellHash = blended cell id
      vec3 machGridSDF(vec3 p, float scale, out float cellHash){
        vec3 an = pow(abs(normalize(p)), vec3(6.0));
        an /= max(an.x + an.y + an.z, 1e-4);
        float hX, hY, hZ;
        float dX = machGrid1(p.yz, scale, hX);
        float dY = machGrid1(p.zx, scale, hY);
        float dZ = machGrid1(p.xy, scale, hZ);
        cellHash = hX*an.x + hY*an.y + hZ*an.z;   // dominant-plane cell id (blended)
        return vec3(dX*an.x + dY*an.y + dZ*an.z, cellHash, 0.0);
      }
      // coverage: low-freq FBM thresholded by maturity (scattered patches → full grid).
      // uMacroOffset ties the pattern to the seed (every combiner convention); NO time in the spatial mask.
      float machCoverageMask(vec3 p){
        float f = 0.5 + 0.5 * fbmd(p * uMachDistrictScale * 0.5 + uMacroOffset, 3.0, 0.0).x;
        float t = mix(0.75, 0.05, uMachCoverage);   // high maturity lowers threshold (patches merge)
        return smoothstep(t, t + 0.15, f);
      }
      // Normal channel: panel-edge bevels banked onto grad (lit by perturbAnalytic — edges catch sun).
      // uMachCoverage<=0 ⇒ early-out (no grad write — byte-identical pre-F47 grad; the F46 gate pattern).
      void machineRelief(vec3 pos, inout float h, inout vec3 grad){
        if (uMachCoverage <= 0.0) return;                       // ≤0 EARLY-OUT (byte-identical pre-F47)
        float cov = machCoverageMask(pos) * provinceWeight(PROV_MACHINE);
        if (cov <= 0.0) return;
        vec3 N = normalize(pos);
        float machCellH;
        vec3 machGd = machGridSDF(pos, uMachBlockScale, machCellH);
        float machEdge = 1.0 - smoothstep(0.0, uMachSeamWidth, machGd.x);   // 1 at seam, 0 inside plate
        // directional kick along a seam-tangent so the seam catches light (tune at live-verify)
        vec3 machTangent = normalize(cross(N, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
        grad += uMachBevel * machEdge * machTangent * cov;
      }

      // ── F49 coverage (machCoverageMask clone; saturates harder than F47) ──
      // Low-freq FBM thresholded by uEcuCoverage; HIGH coverage ⇒ near-zero threshold ⇒ planet-covering.
      // uMacroOffset ties the pattern to the seed (every combiner convention); NO time in the spatial mask.
      float ecuCoverageMask(vec3 p){
        float f = 0.5 + 0.5 * fbmd(p * uEcuDistrictScale * 0.5 + uMacroOffset, 3.0, 0.0).x;
        float t = mix(0.55, 0.02, uEcuCoverage);   // LOWER ceiling than F47's 0.05: F49 saturates to full coverage
        return smoothstep(t, t + 0.12, f);
      }
      // ── F49 day-side district relief: object-space Voronoi-border (F2−F1) street canyons banked
      // onto grad (lit by perturbAnalytic — canyon walls catch sun). Seam-free Voronoi (NOT a triplanar
      // fract grid) kills the cube-axis lattice + pole pinching (UAT item 4). uEcuCoverage<=0 ⇒ early-out
      // (no grad write — byte-identical pre-F49 grad; the F47/F46 gate pattern).
      void ecuRelief(vec3 pos, inout float h, inout vec3 grad){
        if (uEcuCoverage <= 0.0) return;                  // ≤0 EARLY-OUT (byte-identical pre-F49)
        float cov = ecuCoverageMask(pos) * provinceWeight(PROV_ECUMENOPOLIS);
        if (cov <= 0.0) return;
        float fwB  = max(max(fwidth(pos.x), fwidth(pos.y)), fwidth(pos.z));
        float bFreq = uEcuBlockScale * mix(1.0, 2.2, uLodRamp);          // blocks resolve finer as camera closes
        // domain warp → organic block network (bioMats/F45 warp idiom)
        vec4 ecuW1 = noised(pos * (uEcuBlockScale*0.4) + uMacroOffset + vec3(7.3,-2.1,5.9));
        vec3 ecuWp = pos + uEcuWarpAmt * vec3(ecuW1.x, ecuW1.y, ecuW1.z);
        vec3 ecuCellId, ecuVGrad;
        vec2 ecuR = voronoi3d(ecuWp * bFreq, 27, ecuCellId, ecuVGrad);   // ecuR.x=F1, ecuR.y=F2
        float ecuBorder = 1.0 - smoothstep(0.0, uEcuSeamWidth, ecuR.y - ecuR.x); // 1 in street canyon, 0 inside block
        if (uFwClamp == 1) ecuBorder *= 1.0 - smoothstep(0.4, 0.8, fwB * bFreq);  // kill sub-pixel moiré vs Bayer
        grad += -uEcuCanyonDepth * ecuBorder * ecuVGrad * cov;          // carve canyons DOWN; perturbAnalytic lights walls
      }

      // ── F10 ridged / grooved icy terrain (Stage-C step 3, Relief — relief doc §F10.a) ──
      // The signature icy-moon look, gated by the SHARED uCryoActivity. TWO mechanisms:
      // (1) DOUBLE RIDGES (Europa) — warped directional lines (like F6 tessera / F8 wrinkles)
      //     carrying the doubleRidgeProfile [ridge | trough | ridge] cross-section. t=sin(phase)
      //     is the signed cross-line coordinate; the profile's dh/dt chain-rules through
      //     dt/dphase=cos(phase) and dphase/dpos=freq·dfield (EXACT field grad, no warp Jacobian).
      // (2) GROOVED BANDS (Ganymede) — fine parallel ridgeWave (1−|sin|) ridges along a second
      //     axis, confined to low-freq band envelopes. Bands' fine ridges reuse F6's pinned
      //     ridgeWave; the band envelope is cosmetic-gradient. uCryoActivity<=0 ⇒ early-out
      //     (cheap tier: lenticulae + refrozen-crack web DEFERRED, relief doc §F10.d).
      void cryoRidgeCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uCryoActivity <= 0.0) return;
        float amp = uCryoRidgeAmp * uCryoActivity * provinceWeight(PROV_CRYORIDGE);   // §8: ridged plains complement chaos
        // (1) double ridges — warped line field carrying the double-ridge profile.
        // WS4 T13 — branch-guarded shared grain (D6). strength==0 ⇒ verbatim normalize(uCryoRidgeAxis0).
        vec3 ax0 = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate(normalize(mix(uCryoRidgeAxis0, sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
          : normalize(uCryoRidgeAxis0);
        vec4 wn = noised(pos * 2.0 + uCryoRidgeOffsetV);
        float field  = dot(pos, ax0) + uCryoRidgeWarp * wn.x;
        vec3  dfield = ax0 + uCryoRidgeWarp * 2.0 * wn.yzw;
        float phase  = field * uDoubleRidgeFreq;
        float t  = sin(phase);
        vec2  dr = doubleRidgeProfile(t, uCryoRidgeOffset, uCryoRidgeWidth);
        h    += amp * dr.x;
        grad += amp * dr.y * cos(phase) * uDoubleRidgeFreq * dfield;   // dh/dt · dt/dphase · dphase/dpos
        // (2) grooved bands — fine ridgeWave ridges in low-freq band envelopes (second axis).
        // WS4 T13 — branch-guarded shared grain (D6). strength==0 ⇒ verbatim normalize(uCryoRidgeAxis1).
        vec3 ax1 = uTectonicGrainStrength > 0.0
          ? grainProvinceRotate(normalize(mix(uCryoRidgeAxis1, sampleGrainStrike(pos), uTectonicGrainStrength)), pos)
          : normalize(uCryoRidgeAxis1);
        vec4 bn = noised(pos * 1.3 + uCryoRidgeOffsetV + uMacroOffset);
        float bfield  = dot(pos, ax1) + uCryoRidgeWarp * bn.x;
        vec3  bdfield = ax1 + uCryoRidgeWarp * 1.3 * bn.yzw;
        float bandEnv = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(bfield * 2.0));   // where bands exist (cosmetic)
        vec2  rw = ridgeWave(bfield * uGroovedBandFreq);
        float bandAmp = amp * 0.5 * bandEnv;
        h    += bandAmp * (rw.x - 0.5);                              // −0.5 DC cosmetic (normal-only shading)
        grad += bandAmp * rw.y * uGroovedBandFreq * bdfield;
      }

      // ── F18 sublimation landscapes (Cryo step 4, cryo-doc §2 F18) — RELIEF, species-SWITCHED ──
      // The MORPHOLOGY is switched on uVolatileSpecies (the ONE allowed semantic-uniform branch —
      // UNIFORM control flow, not a planetType branch): CO₂→swiss-cheese pits, N₂→convection polygons,
      // CH₄→penitente blades, H₂O→mild hollows. Pits/polygons route the SHARED voronoi3d keystone;
      // blades use the §5.4-pinned bladeProfile — NO forked primitives (cryo-doc §5 risk #2). Relief is
      // CONFINED to the cold cap in-shader (coldFactor, the same gate frostCoverage uses) so a warm
      // world's equator stays bare. Province-aware per integration-index §8: the contribution is scaled
      // by uProvinceWeight (the no-op 1.0 multiplier until Stage-D wires the spatial field — the
      // FEATURE_ID-keyed provinceWeight() accessor rides with the Stage-D scoped job). uSubStrength≤0 OR
      // species 0 ⇒ early-out (Stage-A base + all prior relief untouched — regression-safe).
      void sublimationCombiner(vec3 pos, inout float h, inout vec3 grad){
        if (uSubStrength <= 0.0 || uVolatileSpecies == 0) return;
        // cold-cap confinement: coldFactor 0 at the hot point (equator / substellar) → 1 at the cold
        // point (pole / antistellar eyeball). Same field as frostCoverage so F18 sits inside the frost.
        float coldFactor;
        if (uFrostLocked == 1){
          coldFactor = clamp(vSubstellarAngle / 3.14159265, 0.0, 1.0);
        } else {
          float sinLat = normalize(pos).y;
          coldFactor = mix(sinLat * sinLat, 1.0, uFrostLatitudeBias * 0.6);
        }
        // confine to where the volatile is actually SOLID — mirror frostCoverage's localT<condensationT
        // test (reusing the frost uniforms) so a UNIFORMLY cold world (Pluto/Frozen) etches broadly
        // while a warm-poled world etches only its cold cap. Cosmetic-gradient mask (slowly varying,
        // not chain-ruled). h is the accumulated relief this frame → free altitude lapse (frost climbs).
        float localT  = uPlanetTempEq * (1.0 - uFrostLatChill * coldFactor) - h * uFrostLapseRate * uPlanetTempEq;
        float coldnes = uFrostCondensationT - localT;                 // >0 ⇒ volatile is solid here
        float band    = uSubColdGate * uPlanetTempEq;                 // confinement edge softness (K)
        float capMask = smoothstep(-band, band, coldnes);
        if (capMask <= 0.0) return;
        float amp = uSubAmp * uSubStrength * capMask * provinceWeight(PROV_SUBLIMATION);   // §8 (spatial field LIVE 2026-06-10)

        if (uVolatileSpecies == 3){
          // CH₄ penitentes — strongly anisotropic SHARP blades, aligned to the sun azimuth (penitentes
          // lean toward noon). Blade axis = sun direction projected into the local tangent plane.
          vec3 n = normalize(pos);
          vec3 sunT = uLightDir - n * dot(uLightDir, n);
          float sl = length(sunT);
          vec3 bladeAxis = sl > 1e-4 ? sunT / sl : normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
          vec4 wn = noised(pos * 1.7 + uSubOffset);
          float field  = dot(pos, bladeAxis) + 0.15 * wn.x;            // mild warp (blades not perfectly straight)
          vec3  dfield = bladeAxis + 0.15 * 1.7 * wn.yzw;
          float phase = field * uBladeFreq;
          vec2 bp = bladeProfile(phase, uBladeSharp);
          h    += amp * (bp.x - 0.5);                                  // −0.5 DC (normal-only), blades stand up
          grad += amp * bp.y * uBladeFreq * dfield;                    // dh/dphase · dphase/dpos (EXACT field grad)
          return;
        }

        // CO₂ swiss-cheese (2), N₂ pits (4), H₂O hollows (1) — CARVE flat-floored radial pits via the
        // §5.4-pinned grabenProfile (radial: d = normalized pit radius, halfWidth=1 → −1 floor → 0 rim).
        float pitScale = (uVolatileSpecies == 4) ? uSubPolyScale * 1.7 : uSubPitScale;  // N₂ pits = a finer octave over the polygons
        vec3 pCell, pGrad;
        vec2 pf = voronoi3d(pos * pitScale + uSubOffset, uVoroCells, pCell, pGrad);
        vec3 phh = hash33(pCell);
        float host = step(1.0 - uSubPitDensity, phh.x);                // fraction of cells hosting a pit
        float pitR = mix(0.35, 0.75, phh.y);                          // hashed pit radius (cell units)
        float r = pf.x / pitR;
        vec2 gp = grabenProfile(r, 1.0, uSubFloorFrac);               // depth ∈ [−1,0], gp.y = wall slope
        // CO₂ scarps actively RETREAT → deeper on the sun-facing hemisphere (slowly-varying factor held
        // locally-constant, the ejecta-patch-mask convention — its tiny gradient is cosmetic).
        float asym = (uVolatileSpecies == 2)
          ? 1.0 + 0.4 * clamp(dot(normalize(pos), normalize(uLightDir)), -1.0, 1.0)
          : 1.0;
        float pitAmp = amp * host * asym;
        h    += pitAmp * gp.x;                                        // gp.x ≤ 0 → carves down
        grad += pitAmp * gp.y * (1.0 / pitR) * pGrad * pitScale;      // dh/dr · dr/dpos (chain-ruled, EXACT)

        // N₂ convection polygons — RAISED cell interiors with trough borders (Sputnik Planitia). The
        // border relief uses the chaos-convention cosmetic gradient (voronoi3d returns ∂f1 only, not
        // ∂(f2−f1)); the pit field above carries the exact chain-ruled relief. (Center→edge pit-size
        // grading is the rich-tier refinement, deferred — cryo-doc §2 N₂.)
        if (uVolatileSpecies == 4){
          vec3 cCell, cGrad;
          vec2 cf = voronoi3d(pos * uSubPolyScale + uSubOffset, uVoroCells, cCell, cGrad);
          float interior = smoothstep(0.0, 0.12, cf.y - cf.x);        // 1 inside the cell → 0 at the trough border
          h += amp * 0.6 * (interior - 0.5);                          // raised centers, trough borders (cosmetic grad)
        }
      }

      // ── F17 glacial relief (Cryo step 5, cryo-doc §2 F17) — ice mantle + flow lineations ──
      // The last cryo feature. TWO pieces (Max scoped v1 to mantle + lineations; U-valley/fjord
      // flow-LINE carving DEFERRED to a rich tier, like F4's Voronoi-web / F18's araneiforms):
      // (1) ICE MANTLE — a slope-damped FBM (fbmdDamped) ponded in LOW-slope basins (ice fills
      //     flats smooth, flows off steeps), confined to the cold cap by the SAME localT<condensationT
      //     gate F18/frost use (reuses the frost uniforms) — so a warm world glaciates only its cold
      //     poles, a uniformly-cold Pluto broadly. The mantle ADDS gentle ice-surface relief.
      // (2) FLOW LINEATIONS (moraine/esker) — flow-ALIGNED ridges: a warped directional field whose
      //     base axis is the LOCAL across-flow direction (⊥ to downhill = −tangential grad), carried
      //     by the §5.4-pinned ridgeWave (1−|sin|). The flow axis is held locally-constant (the
      //     cryo-doc flow-proxy: no iteration, the cost-saver), so the gradient is EXACT for the field
      //     given a fixed axis — the F8-wrinkle / F10-groove pattern, axis swapped global→local-flow.
      // Both reuse pinned primitives → NO new finite-diff oracle. Province-aware (§8): ×uProvinceWeight.
      // Wired before lavaCombiner so lava still suppresses LAST. uGlacialStrength≤0 ⇒ early-out.
      void glacialCombiner(vec3 pos, float fwBase, inout float h, inout vec3 grad){
        if (uGlacialStrength <= 0.0) return;
        // cold-cap confinement — identical field to frostCoverage/sublimationCombiner (reuse frost uniforms)
        float coldFactor;
        if (uFrostLocked == 1){
          coldFactor = clamp(vSubstellarAngle / 3.14159265, 0.0, 1.0);
        } else {
          float sinLat = normalize(pos).y;
          coldFactor = mix(sinLat * sinLat, 1.0, uFrostLatitudeBias * 0.6);
        }
        float localT  = uPlanetTempEq * (1.0 - uFrostLatChill * coldFactor) - h * uFrostLapseRate * uPlanetTempEq;
        float coldnes = uFrostCondensationT - localT;                 // >0 ⇒ ice is solid here
        float band    = uGlacialColdGate * uPlanetTempEq;
        float capMask = smoothstep(-band, band, coldnes);
        if (capMask <= 0.0) return;

        // Flow proxy — glacial ice flows down the REGIONAL slope, not every fine bump, so the flow
        // direction comes from a LOW-frequency field (cryo-doc §2 F17 "cheap flow proxy", no iteration),
        // NOT the accumulated grad (whose every fbm octave contributes equally to |grad| → a noisy,
        // incoherent direction → blotchy lineations). The regional slope also drives the basin mask.
        const float FLOW_SCALE = 0.7;
        vec3  nrm = normalize(pos);
        vec4  flow = noised(pos * FLOW_SCALE + uGlacialOffset);
        vec3  fG  = flow.yzw * FLOW_SCALE;                            // regional height gradient (object space)
        vec3  gT  = fG - nrm * dot(fG, nrm);                          // tangential component
        float slope = length(gT);
        float base = uGlacialStrength * capMask * provinceWeight(PROV_GLACIAL);   // §8 (spatial field LIVE 2026-06-10)

        // (1) ice mantle — slope-damped FBM, ponded where the REGIONAL surface is LOW-slope (basins).
        // The basin mask is slowly-varying (held locally-constant, the chaos/ejecta cosmetic-grad convention).
        float basinMask = 1.0 - smoothstep(uGlacialBasinThresh, uGlacialBasinThresh * 2.5, slope);
        vec4  ice = fbmdDamped(pos * uGlacialScale, uOctaves, fwBase * uGlacialScale, uGlacialSlopeDamp);
        float mAmp = uGlacialAmp * base * basinMask;
        h    += mAmp * ice.x;
        grad += mAmp * ice.yzw * uGlacialScale;

        // (2) flow lineations (moraine/esker) — flow-aligned ridgeWave ridges. Across-flow axis ⊥
        // regional downhill in the tangent plane; if the surface is flat (no flow), skip (lineations are
        // a FLOW signature). Amplitude scales with flow vigor (∝ 1/g) — low-g sheets carry bolder lineations.
        if (slope > 1e-4){
          vec3 flowDir   = -gT / slope;                              // regional downhill unit vector (tangent)
          vec3 acrossAx  = normalize(cross(nrm, flowDir));           // ⊥ flow in tangent plane (held const)
          vec4 wn = noised(pos * uLineationWarpFreq + uGlacialOffset + uMacroOffset);
          float field  = dot(pos, acrossAx) + uLineationWarp * wn.x; // ridges run ALONG flow (field varies across)
          vec3  dfield = acrossAx + uLineationWarp * uLineationWarpFreq * wn.yzw;  // EXACT grad (axis held const)
          float phase  = field * uLineationFreq;
          vec2  rw = ridgeWave(phase);
          float lAmp = uLineationAmp * base * uGlacialFlowVigor;
          h    += lAmp * (rw.x - 0.5);                               // −0.5 DC cosmetic (normal-only shading)
          grad += lAmp * rw.y * uLineationFreq * dfield;
        }
      }

      // ── Cryo frost-coverage mask (Stage-C Cryo step 2, F23/F22 — cryo-doc §2) ─────────────
      // THE keystone of the cryo domain: a per-fragment COVERAGE scalar ∈ [0,1] answering "is it
      // cold enough HERE for this volatile to be solid?" — a coverage test, NOT relief (no height
      // delta, no gradient; logic unit-tested, mask verified visually). localT is a substellar/
      // latitude-driven temperature minus an altitude lapse; frost deposits where localT <
      // condensationT, softened to a fractal snowline. Consumed at the albedo stage (mix toward the
      // bright uFrostAlbedo) so the LUMINANCE lift survives posterize as a bright cap — the colour
      // TINT is the stylize/drop part (cryo-doc §2.a). uFrostMaxCoverage≤0 OR condensationT≤0 ⇒
      // early-out (bone-dry / hot worlds unchanged — regression-safe).
      float frostCoverage(vec3 p, float heightField, out float bandCoord){
        bandCoord = 0.0;                                                   // pole-distance coordinate for F22 PLD strata
        if (uFrostMaxCoverage <= 0.0 || uFrostCondensationT <= 0.0) return 0.0;
        // coldFactor ∈ [0,1]: 0 at the hot point (equator / substellar), 1 at the cold point
        // (pole / antistellar). Tidally-locked worlds freeze on the antistellar hemisphere (the
        // "eyeball" cap) via the SHARED vSubstellarAngle varying; others by geographic latitude.
        float coldFactor;
        if (uFrostLocked == 1){
          coldFactor = clamp(vSubstellarAngle / 3.14159265, 0.0, 1.0);     // 0 substellar(hot) → 1 antistellar(cold)
        } else {
          float sinLat = normalize(p).y;                                   // smooth geographic latitude (not the bumpy normal)
          float latCold = sinLat * sinLat;                                 // 0 equator → 1 pole
          // axial-tilt bias lifts the equatorial floor so high-obliquity worlds frost low latitudes
          coldFactor = mix(latCold, 1.0, uFrostLatitudeBias * 0.6);
        }
        // F22 PLD band coordinate: coldFactor ramps SMOOTHLY pole-ward across the whole cap (the
        // coverage itself saturates to the budget just past the snowline, so it can't carry rings).
        bandCoord = coldFactor;
        // localT: equilibrium temp cooled toward the cold point, minus an altitude lapse (frost
        // climbs mountains — heightField is the accumulated relief, already computed this frame).
        float localT = uPlanetTempEq * (1.0 - uFrostLatChill * coldFactor)
                     - heightField * uFrostLapseRate * uPlanetTempEq;
        float coldness = uFrostCondensationT - localT;                     // >0 ⇒ volatile freezes here
        // fractal boundary breakup (kills the drawn-on latitude-circle tell), in Kelvin units
        float breakup = noised(p * uFrostNoiseScale + uFrostOffset).x * uFrostNoiseAmp * uPlanetTempEq;
        float band = uFrostEdgeSoftness * uPlanetTempEq;                   // soft snowline width in K
        float raw = smoothstep(-band, band, coldness + breakup);
        // §8 convention-complete: frost carries a NEUTRAL affinity (floor 1.0 ⇒ weight ≡ 1) —
        // F22/F23 are climate (latitude/temperature), geology must not gate them. The multiply
        // stays so a future taste pass can dial it via the data without touching this code.
        return raw * uFrostMaxCoverage * provinceWeight(PROV_FROST);
      }

      // ── pldBands — F22 polar-layered-deposit strata (cryo-doc §2 F22) ──
      // The perennial cap reads as STACKED bright/dark annular bands: preserved depositional layers
      // exposed in the cap. ALBEDO banding, NOT relief (no height/grad — logic unit-tested, verified
      // visually, like the step-2 frost mask). The caller passes a POLE-DISTANCE coordinate in [0,1]
      // (coldFactor: 0 at the snowline edge → 1 at the pole / antistellar cold point) which ramps
      // smoothly across the whole cap, so iso-value contours ARE the concentric rings. (The coverage
      // itself can't carry rings — it saturates to the budget just past the snowline.) Slice into
      // uPldLevels layers; adjacent layers alternate
      // bright/dark by PARITY, crossfaded across the soft riser. Returns a luminance factor in
      // [1−uPldStrength, 1] (even rings bright, odd rings dimmed). Transcribed from the CPU pldBands().
      // uPldStrength≤0 OR uPldLevels<1 ⇒ 1.0 (no banding); coverage 0 ⇒ idx 0, parity 0 ⇒ 1.0.
      float pldBands(float coverage){
        if (uPldStrength <= 0.0 || uPldLevels < 1.0) return 1.0;
        float phase = max(coverage, 0.0) * uPldLevels;
        float idx = floor(phase);
        float frac = phase - idx;
        float e0 = 1.0 - uPldSoftness;
        float riser = smoothstep(e0, 1.0, frac);
        float parity = mix(mod(idx, 2.0), mod(idx + 1.0, 2.0), riser);
        return 1.0 - uPldStrength * parity;
      }

      // ── F30 lightningEmissive (Storms — card F30 §6.5 step 2) — the transient
      // electrical signature of convective storms, summed into the ★ emissive
      // bypass channel (the lavaCrackEmissive/aurora pattern, card §4: emissive +
      // high contrast = the canonical posterization survivor). One hashed cell per
      // fragment: the per-cell phase ph rides uTime with RATE JITTER (0.7+0.6 h.x)
      // plus a hash offset, so neighboring cells never sync — asynchronous
      // Poisson-like timing, no metronome (card §6 item 3). Envelope = sharp
      // attack at ph 0, exp decay across the uLightDur window (sub-second flash).
      // Spatial form = a Gaussian glow blob around the jittered cell-center
      // direction — a soft area glow lighting the cloud deck from within, never a
      // drawn bolt (card §4 / §6 item 1). Weighted by: the SAME Stage-8 cloud FBM
      // expression (flashes co-locate with the convective deck, card §6 item 2),
      // an archetype latitude regime (ITCZ equatorial vs Juno polar via
      // uLightPolar — PIA22474), and a night boost (reads night-first like aurora
      // but does not vanish by day, card §6 item 4). Deterministic from
      // (pos, uTime) — same seed + same t = same flash field (card §6 item 7).
      vec3 lightningEmissive(vec3 pos, vec3 n, float diff, float cwx){
        vec3 cell = floor(pos * uLightCellFreq);
        vec3 h = hash33(cell);                              // 3 decorrelated per-cell hashes
        // per-cell flash phase: rate jitter decorrelates timing across cells
        float ph = fract(uTime * uLightRate * (0.7 + 0.6 * h.x) + h.y);
        // envelope: sharp attack, fast exp decay, dark outside the window (branchless)
        float e = step(ph, uLightDur) * exp(-5.0 * ph / uLightDur);
        // jittered cell-center direction -> angular-distance Gaussian glow blob
        vec3 cc = normalize((cell + 0.5 + 0.4 * (h - 0.5)) / uLightCellFreq);
        float dc = acos(clamp(dot(n, cc), -1.0, 1.0));
        float blob = exp(-(dc * dc) / (uLightBlobR * uLightBlobR));
        // window the blob to zero at its own cell faces: the fragment evaluates
        // only its cell, so an unwindowed Gaussian truncates into a hard square
        // edge at the lattice boundary.
        vec3 q = abs(fract(pos * uLightCellFreq) - 0.5);
        blob *= smoothstep(0.5, 0.3, max(q.x, max(q.y, q.z)));
        // convective mask: the Stage-8 cloud FBM, passed in from main() (cw.x)
        float cm = smoothstep(0.05, 0.45, cwx);
        // latitude regime: equatorial ITCZ Gaussian vs polar clustering, by uLightPolar
        float lw = mix(exp(-pow(abs(n.y) / 0.45, 2.0)),
                       smoothstep(0.5, 0.85, abs(n.y)), uLightPolar);
        // night boost: flashes read night-first (aurora nightMask) but persist by day
        float nb = 0.35 + 0.65 * smoothstep(0.1, -0.1, diff);
        // provinceWeight(PROV_LIGHTNING) is NEUTRAL (floor 1.0 — weather, not geology);
        // the multiply stays for the registry fan-out convention.
        return vec3(0.9, 0.95, 1.0) * 4.0 * uLightningStrength * provinceWeight(PROV_LIGHTNING)
               * e * blob * cm * lw * nb;
      }

`;

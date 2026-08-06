import { HEIGHT_GLSL } from './planet-lod-height.glsl.js';

/**
 * The lab's planet shaders, lifted verbatim out of planet-lod-lab.html so the GAME can import the
 * SAME SOURCE the lab renders. Nothing here was retyped: the two template bodies are the exact
 * lines that used to sit at planet-lod-lab.html:208-228 and :232-1502, and the lab now imports them
 * back. Resolved output is byte-identical before and after the move, which is this program's
 * standing gate for an extraction (precedent: heightNoise.glsl.js, 265 920 bytes unchanged;
 * albedoTransfer.js, max delta exactly 0).
 *
 * ⛔ WHY THIS FILE EXISTS AT ALL. The binding constraint on the lab->game port is that the LAB KEEPS
 * BEING DEVELOPED (Max, 2026-08-01). A copy of the shader in the game would be a snapshot that goes
 * stale the first time anyone edits the lab. Because the lab imports this module rather than owning
 * the text, a future shader change lands in the game with no port step at all.
 *
 * ⚠ The fragment shader has exactly ONE interpolation, ${HEIGHT_GLSL}, and it is preserved here
 * rather than resolved, so this module composes the same way the HTML did.
 *
 * ⚠ Fences in tests/ search the lab's SOURCE TEXT for GLSL tokens (vis-scale-fence,
 * instrument-tap-fence, worldengine-atmo-deck-spiral-rhines, worldengine-base-band-flow,
 * radius-live-feed-fence). They now read planet-lod-lab.html AND this file as one corpus, because
 * together they are the lab's source. Keep the /* glsl *\/ markers below intact — one of those
 * fences counts them.
 */
export const LAB_VERTEX_SHADER = /* glsl */ `
      // ── Logarithmic depth (LAYER 2 item 4, 2026-08-05) ──
      // The GAME's renderer runs \`logarithmicDepthBuffer: true\` with near = 1e-9
      // (src/rendering/RetroRenderer.js:49). Without these chunks every fragment of this shader
      // writes z ~= 1.0, so the disc still DRAWS (LessEqualDepth passes) but sorts against rings,
      // moons and the ship by traversal order rather than by depth. In-repo precedent that this is
      // a real and recurring bug: tests/warp-portal-logdepth.test.js exists because the project
      // already shipped it once, and the shader this material replaces —
      // src/objects/Planet.js SURFACE_VERTEX:1432 — carries exactly these two chunks.
      // ⛔ THE LAB IS UNAFFECTED. planet-lod-lab.html:194 builds its renderer without the flag, so
      //    USE_LOGDEPTHBUF is undefined and both chunks compile to nothing.
      // ⚠ \`<common>\` is required, not decorative: logdepthbuf_vertex calls isPerspectiveMatrix(),
      //    which three defines there. Planet.js includes it for the same reason.
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vPos;            // object-space position (noise domain — precision-safe)
      varying vec3 vObjN;           // object-space geometric normal
      // ── Canonical shared varying (integration-index §1) — vSubstellarAngle ──
      // Angle (rad) from the substellar point: 0 at the sub-star point, π at the
      // antistellar point. Computed ONCE here so Bands (thermal), Clouds (F31f
      // pupil/ring), Cryo (nightside cap), Optical (limb/terminator) all read the
      // SAME value instead of each recomputing acos(dot(...)). Object-space light.
      varying float vSubstellarAngle;
      uniform vec3 uLightDir;       // object-space substellar direction (same uniform the frag reads)
      // ── Object-space radius normalisation (LAYER 2 item 1, 2026-08-05) ──
      // The lab's body is a UNIT SPHERE (planet-lod-lab.html:202 \`const R = 1.0\`), and every noise
      // domain downstream is written against that ±1.0 extent: voronoi3d(vPos * uVoroScale),
      // fbmd(vPos, …), and 23 *Combiner(vPos, …) calls. The GAME builds IcosahedronGeometry at the
      // body's SCENE radius (radiusEarth × 0.0426), so an Earth-sized body spans ±0.0426 — the whole
      // disc samples 1/23rd of ONE voronoi cell. The collapse runs 78.2× at 0.3 R⊕ down to 1.47× at
      // 16 R⊕, i.e. it is also 53× INCONSISTENT within a single system, from identical uniforms.
      // Dividing here restores the lab's domain for a mesh of any radius.
      //
      // ⛔ DEFAULT 1.0, SO THE LAB IS UNTOUCHED — identity, byte-for-byte. That is the whole reason
      //    this is a uniform divide and not a geometry change: the alternative once written into the
      //    plan (IcosahedronGeometry(1,5) + scale.setScalar) would ALSO change every non-lab planet,
      //    because tryLabShader swaps only the MATERIAL and the game's own shader reads absolute
      //    object-space position against its own radius uniform (src/objects/Planet.js:436, :1682).
      // ⛔ gl_Position BELOW MUST KEEP THE RAW \`position\`. vPos is the noise DOMAIN; the silhouette
      //    is real geometry. Safe by construction today — this vertex shader does not displace — and
      //    tests/lab-shader-body-radius.test.js pins it so that stays true.
      uniform float uBodyRadius;
      // ── #3a E5 gas-giant band/jet writer fields, baked per render vertex (climate-e5.js) ──
      attribute float aBand;   varying float vBand;    // bandNorm — the writer's driver-organized band value
      attribute float aShear;  varying float vShear;   // |du/dφ| normalized — gates the jet filament turbulence
      attribute float aMush;   varying float vMush;    // NH₃ mushball compositional banding (depth layer)
      attribute float aStorm;  varying float vStorm;   // #3b storm/convection MASK — the ONE new baked attribute (consumed by V-α filamentation; passthrough-only in Slice P)
      void main() {
        vPos = position / uBodyRadius;
        vObjN = normalize(position);
        vBand = aBand; vShear = aShear; vMush = aMush; vStorm = aStorm;
        vSubstellarAngle = acos(clamp(dot(normalize(position), normalize(uLightDir)), -1.0, 1.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
`;

export const LAB_FRAGMENT_SHADER = /* glsl */ `
      ${HEIGHT_GLSL}
      // ── Logarithmic depth, fragment side (LAYER 2 item 4) — see the note in LAB_VERTEX_SHADER.
      // ⚠ NO \`<common>\` here, deliberately: logdepthbuf_pars_fragment needs nothing from it, and
      //    HEIGHT_GLSL above is 363 KB of the lab's own function library — pulling three's helpers
      //    in alongside it invites a redefinition error for zero benefit. src/objects/Planet.js
      //    FRAG_HEADER:24 makes the same choice.
      #include <logdepthbuf_pars_fragment>
      // ── #3a E5 band/jet writer fields (fragment side). Declared here — HEIGHT_GLSL owns the
      // vPos/vObjN varying set, and zonalBandCol takes these as PARAMS so the shared GLSL (also used
      // by the river router, which never calls zonalBandCol) is unaffected.
      varying float vBand;
      varying float vShear;
      varying float vMush;
      varying float vStorm;   // #3b storm/convection MASK (V-α.1 filamentation gate) — passed into zonalBandCol as a PARAM (HEIGHT_GLSL stays varying-agnostic, comment above)
      // ── AC4 river carve — samplerCube of valley depth (rendered from the REAL routed network,
      // planet-lod-rivers.js). Sampled by surface direction; bends the normal into a V-channel +
      // darkens the floor. uRiverCarveStrength == 0 ⇒ untouched (regression-safe). This is the
      // F11 replacement done right: the carve follows the dendritic network, not a noise mask.
      uniform samplerCube uRiverCarveMap;
      uniform float uRiverCarveStrength;   // master gate + normal bend amount
      uniform float uRiverCarveFloor;      // valley-floor albedo darkening amount
      uniform float uRiverCarveDepth;      // Option B: h-units the floor drops (→ F14 flood)
      uniform float uRiverCarveRough;      // fbm roughness on depth + walls (breaks the clean V)
      uniform float uRiverCarveGateHi;     // relief gate (UAT item3): carve fades out above this elevation-over-sea (peaks); large ⇒ old unconditional behavior
      // ── Option B river-LOD STEP 2: camera-localised tributary patch (2D ortho FloatType RTT) ──
      // A small angular cap (default ~8° half-angle) carrying FINE valley depth at ~1km/texel (~9×
      // finer than the ~9km/texel global carve cube). Unioned (MAX) into every sampleCarve tap under
      // an angular falloff so the finite-diff gradient bends the fine valley WALLS, not just the floor.
      // At uRiverCarvePatchStrength==0 patchDepth() returns 0 ⇒ max(global,0)==global ⇒ byte-identical.
      uniform sampler2D uRiverCarvePatchMap;
      uniform vec3  uRiverCarvePatchN;        // == patch centre (object space) = patch-cap normal
      uniform vec3  uRiverCarvePatchU;        // local-frame tangent (UV +x / su axis)
      uniform vec3  uRiverCarvePatchV;        // local-frame tangent (UV +y / sv axis)
      uniform float uRiverCarvePatchAngular;  // cap half-angle (radians)
      uniform float uRiverCarvePatchStrength; // 0 ⇒ patch off (regression-safe); GUI-owned
      // ── AC-SAMPLER instrument tap. 0 = render (every branch below is dead); 1 = composite body;
      // 2 = solid surface (post-carve, pre-liquid); 3 = post-liquid. Uniform-gated early return, so
      // the taken path at 0 is unchanged token for token. The instrument compiles THIS string.
      uniform int uFieldTap;
      // GNOMONIC-TANGENT inverse projection — byte-aligned with projectToPatch() in
      // planet-lod-tributary-patch.js. Returns the patch valley depth at object-space dir D (0 outside
      // the cap / when strength is off), already faded by the angular smoothstep falloff.
      float patchDepth(vec3 D){
        if (uRiverCarvePatchStrength <= 0.0) return 0.0;
        float cosd = dot(D, uRiverCarvePatchN);
        if (cosd <= cos(uRiverCarvePatchAngular)) return 0.0;   // outside the cap
        float su = dot(D, uRiverCarvePatchU) / cosd;            // gnomonic-tan lateral coords
        float sv = dot(D, uRiverCarvePatchV) / cosd;
        float R  = tan(uRiverCarvePatchAngular);                // == bake ortho half-size
        vec2  uv = vec2(su, sv) / (2.0 * R) + 0.5;
        float lateral = length(vec2(su, sv)) / R;               // 0 centre .. 1 edge
        float falloff = 1.0 - smoothstep(0.7, 1.0, lateral);    // fade out at the cap edge (no seam)
        return texture2D(uRiverCarvePatchMap, uv).r * falloff;
      }
      // Returns valley depth at dir and writes the tangential gradient of depth (object space).
      float sampleCarve(vec3 dir, out vec3 depthGrad){
        float eps = 0.0045;
        vec3 ref = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 t1 = normalize(cross(dir, ref));
        vec3 t2 = cross(dir, t1);
        // global cube depth UNIONED (MAX) with the fine patch depth at the SAME dir, on all 5 taps —
        // so the finite-diff gradient (below) bends the fine valley WALLS, not just darkens the floor.
        vec3 oP1 = normalize(dir + eps * t1), oM1 = normalize(dir - eps * t1);
        vec3 oP2 = normalize(dir + eps * t2), oM2 = normalize(dir - eps * t2);
        float dC  = max(textureCube(uRiverCarveMap, dir).r, patchDepth(dir));
        float dP1 = max(textureCube(uRiverCarveMap, oP1).r, patchDepth(oP1));
        float dM1 = max(textureCube(uRiverCarveMap, oM1).r, patchDepth(oM1));
        float dP2 = max(textureCube(uRiverCarveMap, oP2).r, patchDepth(oP2));
        float dM2 = max(textureCube(uRiverCarveMap, oM2).r, patchDepth(oM2));
        depthGrad = ((dP1 - dM1) * t1 + (dP2 - dM2) * t2) / (2.0 * eps);
        return dC;
      }
      void main(){
        // FIRST statement in main, before the uDebugMode early-return path below — a fragment that
        // returns early must still write its depth, or the debug views sort by traversal order
        // while the normal path sorts correctly, which looks like a debug-view bug and is not.
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vObjN);
        float carveDepth = 0.0;

        // ── voronoi3d seam-gate debug (index §5 risk #1) — early-return viz ──
        if (uDebugMode > 0){
          vec3 vCell, vGrad;
          vec2 ff = voronoi3d(vPos * uVoroScale, uVoroCells, vCell, vGrad);
          vec3 dbg;
          if (uDebugMode == 1){
            dbg = vec3(ff.x);                                        // F1 grayscale — cell bowls
          } else if (uDebugMode == 2){
            dbg = vec3(1.0 - smoothstep(0.0, 0.06, ff.y - ff.x));    // F2-F1 crack mask (borders)
          } else if (uDebugMode == 3){
            dbg = hash33(vCell);                                     // flat per-cell color — SEAM TEST
          } else if (uDebugMode == 4){
            vec3 pn = perturbAnalytic(N, vGrad, 0.5);               // voronoi grad as lit relief
            dbg = uBaseColor * (max(dot(pn, uLightDir), 0.0) + 0.05);
          } else if (uDebugMode == 5){
            // emissiveBlackbody ramp swatch — pole(500K)→pole(4000K) gradient.
            // Confirms the GLSL transcription matches the CPU mirror: bottom
            // deep-red, climbing through orange/amber to warm-white on top.
            float tempK = mix(500.0, 4000.0, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
            dbg = emissiveBlackbody(tempK);
          } else {
            // mode 6: vSubstellarAngle varying — 0 (white, substellar) → π (black,
            // antistellar). Confirms the shared varying is computed correctly:
            // a bright sub-star spot fading to a dark antistellar hemisphere.
            dbg = vec3(1.0 - vSubstellarAngle / 3.14159265);
          }
          gl_FragColor = vec4(dbg, 1.0);
          return;
        }

        // ════════════════════════════════════════════════════════════════════
        // §3 PIPELINE ORDER (integration-index) — the compositing contract.
        // Each Stage-C domain inserts at its labeled stage; the foundation wires
        // stages 1 / 6 / 8 / 9 + the ★ emissive channel, and leaves stages 2-5/7
        // as placeholders the domains fill from their per-domain docs. The one
        // hard invariant already honored: ★ emissive terms are added AFTER the
        // posterize split so they don't band into gray steps (Stage-A §2.C).
        // ════════════════════════════════════════════════════════════════════

        // ── Stage 0.5: Stage-D province fields — ONCE per fragment, BEFORE any consumer
        // (relief combiners, rayField, lavaCrackEmissive, frostCoverage all read gProvince).
        initProvinces(vPos);

        // ── Stage 1: noised() height/derivative base (Stage-A foundation) ──
        vec3 shadeN;
        // canonical shared accumulator (index §1): Relief writes tectonic graben;
        // Fluvial incised gorges + Cryo chasma ADD IN. Stages 2/3/4 consume it.
        float canyonHeight = 0.0;
        float fluvialWet = 0.0;   // F12 deposition gate — seeded by fluvialCombiner, read by deltaCombiner (the F11 floor-tint consumer was retired 2026-06-19)
        // Stage 3 CRYO frost-coverage (F23/F22) — albedo overlay, set in the analytic branch
        // (needs the accumulated height for the altitude lapse), consumed at Stage 6.
        float frostCover = 0.0;
        float frostBandCoord = 0.0;   // F22 PLD pole-distance coordinate (set by frostCoverage)
        // F16 dust-mantle cover — set by dustCombiner (analytic branch; out param, always
        // written), consumed at the Stage-6 ochre lift. 0.0 here covers the finite-diff path.
        float dustCover = 0.0;
        // F14 standing-liquid coverage — set by the Stage-4 level-set cut (analytic branch),
        // consumed at Stage 6 (liquid albedo fill) + implicitly by spec (flat normal = glint).
        float liquidMask = 0.0;
        // F20 coastline luminance signals — set by the shore-distance block (analytic branch),
        // consumed at Stage 6 (beach band / cliff darkening / strandline albedo terms).
        float beachBand  = 0.0;
        float cliffDark  = 0.0;
        float strandLine = 0.0;
        // F42 carbon-crust signals — set in the analytic branch (carbTarCombiner mask
        // + the crest probe on the accumulated height), consumed at Stage 6 (graphite/
        // tar albedo) + the post-posterize F42 emissive block (sheen + diamond glints).
        // 0.0 here covers the finite-diff path (tar/glint signals inert there; the
        // Stage-6 graphite mask computes inline and still applies — review NOTE 1).
        float carbTar   = 0.0;
        float carbCrest = 0.0;
        // F43 crystal-facet signal — the coverage-gated grown-facet presence (0..1), set by
        // facetCombiner in the analytic branch, consumed by the post-posterize F43 per-facet
        // spark. 0.0 here covers the finite-diff path (facet sparks inert there — review NOTE 1).
        float fctMask   = 0.0;
        // Terrain-material signals — the local geology the Stage-6 ground palette selects on. Set in the analytic
        // branch from the ACCUMULATED relief (post-combiners), consumed at Stage 6. Defaults cover the finite-diff
        // path, where the palette collapses to the weathered endmember — the same treatment carbTar/fctMask get
        // (review NOTE 1). This is deliberate, not an oversight: the two normalMode paths render different fields
        // (finite-diff sees only computeHeight; analytic sees the baked plate cube + fbmd + the combiner chain),
        // so a slope threshold calibrated on one is meaningless on the other.
        float surfElev  = 0.0;   // accumulated relief height at this pixel (signed, field units)
        if (uNormalMode == 1){
          // Production finite-diff path (regression reference)
          shadeN = perturbFiniteDiff(N, vPos, uPerturb);
        } else {
          // New analytic path — relief amplitude grows with approach (lodRamp), so
          // "one scalar drives all complexity" (spec §2.B): octaves AND detail depth.
          float fwBase = max(max(fwidth(vPos.x), fwidth(vPos.y)), fwidth(vPos.z));
          // AC2 — baked-relief height source, BRANCH-guarded (SPLIT-TRAP #4: if/else, NEVER mix()-to-0).
          // strength 0 ⇒ ELSE branch = the verbatim pre-AC2 fbmd line, NO textureCube fetch (byte-identical).
          // strength 1 ⇒ pure baked field (R=height, GBA=gradient) so the surface tracks the baked cube.
          vec4 hd;
          if (uReliefBakeStrength > 0.0) {
            vec4 baked = sampleBakedRelief(vObjN);          // object-space direction-keyed, seam-free
            vec4 synth = fbmd(vPos, uOctaves, fwBase);      // in-shader DETAIL residual
            // §C.3 LOCKED blend: body = baked, residual = synth fraction; s=1 => pure baked.
            hd = vec4(baked.x * uReliefBakeStrength, baked.yzw * uReliefBakeStrength) + synth * (1.0 - uReliefBakeStrength);
          } else {
            hd = fbmd(vPos, uOctaves, fwBase);              // VERBATIM pre-AC2 path, NO cube fetch
          }
          // ── Slice D-fix: restore the crater overlay the display crossover faded out of the blend
          // above. BRANCH-guarded exactly like the bake gate (SPLIT-TRAP #4: if, NEVER mix()-to-0), so
          // restore 0 ⇒ no cube fetch ⇒ byte-identical. Craters are a signed ADDITIVE overlay by
          // design (bowl < 0, rim/ejecta > 0), so this composites correctly onto whichever body won
          // the blend — baked, analytic, or any mix. Gradient rides along so rims/bowls keep shading.
          if (uCraterBakeRestore > 0.0) {
            vec4 cr = sampleBakedCraters(vObjN);
            hd += vec4(cr.x * uCraterBakeRestore, cr.yzw * uCraterBakeRestore);
          }
          if (uFieldTap == 1){ gl_FragColor = hd; return; }   // AC-SAMPLER tap: composited body, pre-combiner
          float h = hd.x;
          vec3 grad = hd.yzw;
          // F19 — base-FBM gradient snapshot: massWastCombiner subtracts it from the running
          // grad to recover the EXACT accumulated host-relief slope (hosts off ⇒ zero deposits).
          vec3 gradBase = hd.yzw;
          // ── Stage 2: RELIEF combiners — mountains (F1, ridged base), craters
          // (F2, voronoi3d consumer), then canyons (F4, tectonic graben → canyonHeight).
          // Each ADDS a height delta + chain-rule gradient onto the FBM base; the single
          // perturbAnalytic below bends the normal so crestlines/rims/bowls/central-peaks/
          // trench-walls/scarp-faces all light correctly. F4 writes the shared canyonHeight
          // accumulator (Fluvial incised gorges + Cryo chasma ADD IN at stages 3/4); F5
          // scarps add fault-block relief onto h/grad (no shared accumulator).
          mountainCombiner(vPos, fwBase, h, grad);
          craterCombiner(vPos, h, grad);
          ejectaCombiner(vPos, h, grad);            // F3 — apron wrapping the F2 craters
          canyonCombiner(vPos, h, canyonHeight, grad);
          fluvialCombiner(vPos, h, canyonHeight, grad, fluvialWet);   // F11 — channels carve into canyonHeight
          float outflowOrder = textureCube(uRiverCarveMap, N).b;   // AC5 — baked Strahler order (B): place outflow on the REAL trunk (same object-space dir N as sampleCarve / deltaCombiner)
          outflowCombiner(vPos, h, canyonHeight, grad, outflowOrder);    // F13 — megaflood trunk scours into canyonHeight (after F11: same accumulator, distinct event)
          karstCombiner(vPos, h, canyonHeight, grad);      // F21 — dolines + labyrinth dissolve into canyonHeight (before F12/F14: collapse lakes come free)
          scarpCombiner(vPos, h, grad);
          plateauCombiner(vPos, fwBase, h, grad);
          tesseraCombiner(vPos, h, grad);
          edificeCombiner(vPos, h, grad);          // F7 — volcanic shield/strato cones + caldera
          chaosCombiner(vPos, h, grad);            // F9 — ice-shell chaos rafts (reads shared uCryoActivity)
          facetCombiner(vPos, h, grad, fctMask);   // F43 — crystalline facet field (the F9 chaos-raft mechanism at crystal amplitude; ADDITIVE on grad, the F19 contract; exports fctMask for the post-posterize spark)
          hexCrust(vPos, h, grad);                 // F44 — hex-tessellated crust (voronoi3dReg + regularity knob; F2−F1 trough borders + flat/domed interiors; ADDITIVE on grad, F19 contract; gated by uHexStrength × provinceWeight(PROV_HEXTESS))
          shatterCombiner(vPos, h, grad);          // F45 — shattered/fractured crust (globalized two-octave chaosCombiner: voronoi3d mega-blocks w/ per-cell flat+tilt, F2−F1 graben crevasses, sub-fracture lattice; ADDITIVE on grad, F19 contract; gated by uShatStrength × region × provinceWeight(PROV_SHATTER))
          machineRelief(vPos, h, grad);            // F47 panel bevels onto grad (ADDITIVE, F19 contract; gated by uMachCoverage × provinceWeight(PROV_MACHINE))
          ecuRelief(vPos, h, grad);                // F49 — Voronoi-border street canyons onto grad (ADDITIVE, F19 contract; gated by uEcuCoverage × provinceWeight(PROV_ECUMENOPOLIS))
          cryoRidgeCombiner(vPos, h, grad);        // F10 — double ridges + grooved bands (reads shared uCryoActivity)
          sublimationCombiner(vPos, h, grad);      // F18 — sublimation landscapes (species-switched: pits/polygons/blades/hollows)
          glacialCombiner(vPos, fwBase, h, grad);  // F17 — glacial ice mantle + flow-aligned moraine/esker lineations (reads frost cap gate)
          // CONTRACT (F19 gradBase trick): every combiner ABOVE this line must stay ADDITIVE on
          // grad (grad += only) — F19 derives its host-relief gate from gradIn − gradBase, so a
          // pre-F19 multiplicative smoother would leak base FBM into hostGrad. Multiplicative
          // passes (F16 dust, F8 lava, F42 tar, F14 cut) all run below.
          massWastCombiner(vPos, gradBase, h, grad); // F19 — talus aprons + landslide tongues bank at the FOOT of the accumulated steep relief (after ALL steep hosts incl. F17's mantle; before F15/F16 — dunes + dust then mantle over the deposits)
          duneCombiner(vPos, h, grad);             // F15 — linear ergs DEPOSIT on near-final lowlands (after all constructional relief so sand pools around it; before F8 — fresh basalt buries sand; before F12/F14 — deltas/sea read the final surface)
          dustCombiner(vPos, h, grad, dustCover);  // F16 — dust mantle SMOOTHS relief (after F15 — dust settles over the ergs; before F8 — fresh basalt punches through any mantle); writes dustCover for the Stage-6 ochre lift
          lavaCombiner(vPos, h, grad);             // F8 — flood-basalt plains SMOOTH/suppress relief + wrinkle ridges (last of the F8-era passes; F42 tar follows)
          carbTarCombiner(vPos, h, grad, carbTar); // F42 — tar flats FILL/SMOOTH low basins (the F8 multiplicative slot; exports the Stage-6 + sheen mask)
          // F42 crest probe — threshold on the accumulated height (the cheapest robust
          // crest proxy, card section 6.5 step 6), excluding tar fills: diamond glints
          // live on uplifted crests, never in basins. Local-only (no h/grad writes);
          // strength 0 skips it and carbCrest stays 0 — the F42 regression contract.
          if (uCarbonStrength > 0.0) carbCrest = smoothstep(0.05, 0.16, h) * (1.0 - carbTar);
          // AC4 (2026-06-19): gate F12 deltas on the baked carve-cube MOUTH channel (.g) — the
          // real routed river mouths (sized by accum) — sampled with the SAME object-space surface
          // direction N that sampleCarve uses for its center tap (line ~214: textureCube(...,dir).r,
          // dir==N). The cube is direction-keyed (rotation-invariant) and the valley graph was
          // rasterized on the unit sphere, so N is the correct key. NOT gated on uRiverCarveStrength
          // (that's the terrain-gouge toggle): the mouth channel exists whenever the real cube is
          // bound (AC3). Dummy cube (pre-first-route) ⇒ .g=0 ⇒ no deltas (safe).
          float deltaMouth = textureCube(uRiverCarveMap, N).g;
          deltaCombiner(vPos, h, grad, fluvialWet, deltaMouth);// F12 — depositional aprons at REAL river mouths (reads FINAL h)
          // ── AC4 river carve (Option B) — incise the routed valley network into h BEFORE the
          // F14 cut, so the carved floor can drop below sea level and flood with REAL water via
          // the same level-set mechanism as oceans (liquidMask fill + flat normal + glint + coast
          // for free). Depth + wall gradient are roughened by a surface-keyed fbm so the V-walls
          // and the resulting waterline aren't mathematically smooth — the roughness rides ON the
          // real dendritic network (sampleCarve), not a noise mask (the F11 worm-trail failure).
          // carveDepth is reused at Stage 6 for dry-wall floor darkening. uRiverCarveStrength == 0
          // ⇒ h/grad untouched (regression-safe; planet byte-identical with the overlay off).
          if (uRiverCarveStrength > 0.0){
            vec3 carveGrad;
            carveDepth = sampleCarve(N, carveGrad);
            float cr = 1.0;
            if (uRiverCarveRough > 0.0){
              float rn = 0.5 * snoise(vPos * 14.0) + 0.25 * snoise(vPos * 30.0) + 0.125 * snoise(vPos * 62.0);
              cr = clamp(1.0 + uRiverCarveRough * rn, 0.0, 2.0);
            }
            // RELIEF GATE (UAT item 3, 2026-06-18): the routed network is baked on the 40k-vertex
            // global mesh, which aliases over relief finer than its ~140km spacing; where a routed
            // segment crosses a rendered ridge, the UNCONDITIONAL carve gouged a trench THROUGH the
            // peak (Max UAT: "rivers cut straight into mountains"). Gate the carve by the LOCAL
            // RENDERED elevation — the accumulated analytic h here is the only field that sees the
            // sub-mesh ridge (the router's own h does not) — so it incises lowland valleys but fades
            // out on high ground: the height-modifying features "work together". uRiverCarveGateHi
            // large ⇒ reliefGate ~1 everywhere = prior (unconditional) behavior.
            float aboveSea = max(0.0, h - uSeaLevel);
            float reliefGate = 1.0 - smoothstep(uRiverCarveGateHi * 0.35, uRiverCarveGateHi, aboveSea);
            cr *= reliefGate;                                  // gates depth, wall-bend AND dry-floor darkening together
            carveDepth *= cr;
            h    -= carveDepth * uRiverCarveDepth;              // lower the floor → F14 floods it
            grad += -carveGrad * cr * uRiverCarveStrength;      // bend the walls into the V
          }
          if (uFieldTap == 2){ gl_FragColor = vec4(h, grad); return; }   // AC-SAMPLER tap: solid surface
          // ── Stage 4 (F14): standing-liquid level-set cut (card §4) — AFTER all relief so
          // fluvial channels + basins flood for free off the accumulated h. Inside the mask
          // the height clamps to the equipotential and the gradient flattens to the geometric
          // normal — the flat-vs-perturbed normal contrast IS the liquid read, and the existing
          // Blinn-Phong spec catches a coherent glint lobe with no spec-path changes.
          // provinceWeight(PROV_LAKES) is NEUTRAL (floor 1.0 — hydrology, not geology).
          // (the liquidStability gate lives in applyDrivers: not-wet ⇒ seaLevel = -1)
          if (uSeaLevel > -1.0){
            liquidMask = smoothstep(uSeaLevel + 0.02, uSeaLevel - 0.02, h) * provinceWeight(PROV_LAKES);
            h    = mix(h, uSeaLevel, liquidMask);
            grad = mix(grad, vec3(0.0), liquidMask);
          }
          if (uFieldTap == 3){ gl_FragColor = vec4(h, grad); return; }   // AC-SAMPLER tap: post-liquid surface
          // ── F20 coastlines (card §6.5) — signed shore distance + three pre-posterize
          // luminance signals, computed AFTER the F14 cut (the land side is untouched by
          // the cut, so h/grad here still carry the land-side field; the liquid side is
          // masked out via 1-liquidMask) and BEFORE perturbAnalytic. The SDF-from-implicit-
          // function trick (card §4): d = (h − uSeaLevel)/|∇h| converts the height margin
          // into a true geometric shore distance — beach width auto-widens on flats and
          // collapses to a cliff line on steeps. All three signals are albedo/luminance
          // only (v1 scope cut, card §6.5.6: strandlines are NOT relief benches; dry-world
          // relict shorelines deferred — v1 coasts require a live sea). Consumed at Stage 6.
          // provinceWeight(PROV_COAST) is NEUTRAL (floor 1.0 — margins live wherever the
          // sea is, like lakes/frost).
          if (uSeaLevel > -1.0 && uCoastStrength > 0.0){
            float slope  = length(grad);
            float d      = (h - uSeaLevel) / max(slope, 0.15);   // signed shore distance
            float gentle = 1.0 - smoothstep(0.5 * uCoastCliffSlope, uCoastCliffSlope, slope);
            float coastW = uCoastStrength * provinceWeight(PROV_COAST) * (1.0 - liquidMask);
            // AC6 (2026-06-19): estuarine keying — widen the beach band specifically at REAL
            // river mouths via the baked carve-cube MOUTH channel (.g), the same object-space
            // surface dir N used by AC4's deltaMouth tap (~line 363) and sampleCarve's center
            // tap. Plain (river-free) coast has .g == 0 ⇒ beachWEff == uBeachWidth ⇒ the
            // beachBand smoothsteps below are BYTE-IDENTICAL to the shipped F20 (the regression
            // contract). This is the F20 "keyed to rivers specifically" piece from the carve-map
            // coupling feasibility briefing: the carve→F14-flood→shore-SDF breach shoreline
            // already lights flooded carved valleys emergently — this ADDS a broad estuarine/
            // deltaic shore band ON TOP at the discrete mouths. Albedo-only (beachBand feeds the
            // Stage-6 beachCol mix); no h/grad writes, so finite-diff parity is untouched. Dummy
            // cube (pre-first-route) ⇒ .g == 0 ⇒ no estuary (safe).
            float coastMouth = textureCube(uRiverCarveMap, N).g;
            const float ESTUARY_WIDEN = 2.0;                     // mouth .g=1 ⇒ 3× beach width (estuary/delta breadth); .g=0 ⇒ ×1 (identity)
            float beachWEff = uBeachWidth * (1.0 + coastMouth * ESTUARY_WIDEN);
            // (a) beach band — 0 < d < beachWEff on gentle shores (wave-built terrace,
            // widened to an estuarine/deltaic band at real river mouths)
            beachBand = smoothstep(0.0, 0.3 * beachWEff, d)
                      * (1.0 - smoothstep(0.7 * beachWEff, beachWEff, d))
                      * gentle * coastW;
            // estuarine brightness lift — faint extra beach intensity AT mouths only
            // (scaled by coastMouth ⇒ plain coast untouched), so the deltaic flats read a
            // touch brighter/sandier than a generic wave terrace. mouth .g=0 ⇒ ×1 (identity).
            beachBand *= 1.0 + 0.25 * coastMouth;
            // (b) cliff darkening — wave-cut face: near-shore (|d| small) × steep slope
            cliffDark = (1.0 - smoothstep(0.0, 2.0 * uBeachWidth, abs(d)))
                      * (1.0 - gentle) * coastW;
            // (c) paleo-strandlines — thin bright lines at d ≈ k·uTerraceStep (k = 1..3),
            // the Bonneville terrace-flight read; older (higher) lines fade with k.
            for (int k = 1; k <= 3; k++){
              float fk = float(k);
              strandLine += (1.0 - smoothstep(0.0, 0.15 * uTerraceStep,
                                              abs(d - fk * uTerraceStep)))
                          * pow(0.7, fk - 1.0);
            }
            strandLine *= gentle * uStrandStrength * coastW;
          }
          float reliefAmp = uPerturb * mix(0.7, 1.0, uLodRamp);
          // Snapshot the accumulated relief height for the Stage-6 ground palette, at the same point the normal is
          // bent from it — so colour and shading read the SAME surface. Slope is NOT taken from grad here: it is
          // recovered at Stage 6 as the deviation of shadeN from N, which is dimensionless, bounded, needs no
          // calibration against field units, and is valid on BOTH normalMode paths since both write shadeN.
          surfElev  = h;
          shadeN = perturbAnalytic(N, grad, reliefAmp);
          // F24 gas flattening — a banded gas deck has no terrain to light: relax the
          // perturbed normal back to the geometric sphere as uBandStrength rises. The
          // bands carry ALL their structure through albedo luminance instead (card
          // §6.5 step 4); the branch keeps uBandStrength 0 (every solid preset)
          // byte-identical — an unconditional renormalize would shift low bits.
          if (uBandStrength > 0.0) shadeN = normalize(mix(shadeN, N, uBandStrength));
          // ── Stage 3: CRYO frost-coverage mask (F23/F22) — coverage test, not relief; needs the
          // accumulated height h for the altitude lapse. Consumed at the Stage-6 albedo overlay.
          frostCover = frostCoverage(vPos, h, frostBandCoord);
          // F14 × F22 phase consistency: standing liquid means local T is ABOVE the volatile's
          // condensation point (liquid phase, by definition) — frost cannot deposit on the open
          // sea. Titan's methane seas stay radar-dark against bright frosted terrain. (Frozen-sea
          // / eyeball ice-ring variant deferred — flagged in card §7 for the integration pass.)
          frostCover *= 1.0 - liquidMask;
          // F16 × F14 — same phase logic: settled dust can't mantle the open sea (it sinks);
          // the airborne veil (Stage 8) is unaffected — haze hangs over water too.
          dustCover *= 1.0 - liquidMask;
        }

        // ── Stage 2 (cont.): mountains / scarps; writes canyonHeight   [domain: Relief]
        // ── Stage 3: CRYO — frost-mask + sublimation pits; reads uCryoActivity; adds into canyonHeight [domain: Cryo]
        // ── Stage 4: FLUVIAL incision — channels/karst carve, add into canyonHeight; uLiquidMask cut at seaLevel [domain: Fluvial]
        // ── Stage 5: AEOLIAN — dunes (anisotropic relief mod); dust mantle SMOOTHS relief (runs AFTER stage 2) [domain: Aeolian]
        //    (stages 2-5 reshape shadeN / height / canyonHeight; placeholders until their domains land.)

        // ── F41 magma-sea mask + in-sea relief suppression (Exotic, card §6.5 steps
        // 3 + 5) — computed ONCE here, consumed by the Stage-6 albedo terms (crust
        // replace + rayBright kill + nightside rock-frost) and the ★ Stage-9 emissive
        // sea below. Mask = smoothstep around the DRIVEN liquidus iso-angle of the
        // SHARED vSubstellarAngle varying (0 substellar, pi antistellar — the
        // uFrostLocked cap field, hot side), with a noised() breakup so the shoreline
        // reads as a ragged iso-temperature line, not a drawn-on circle (the frost
        // fractal-snowline convention). SUPPRESSION CONTRACT: molten = zero-age —
        // inside the mask the shading normal blends toward the GEOMETRIC sphere at
        // the COLOR + shadeN level ONLY (NO h/grad accumulator writes), so craters /
        // F8 wrinkles / all relief vanish in the sea and survive untouched on the
        // solid nightside (the F24 gas-flatten precedent — branch-guarded, because an
        // unconditional renormalize would shift low bits: angle 0 stays
        // byte-identical, the F41 regression contract). provinceWeight(PROV_MAGMA)
        // is NEUTRAL (floor 1.0 — irradiation, not geology: the sea follows the
        // star, FROST-row pattern); the multiply stays for the registry convention.
        float mgSeaMask = 0.0;
        float mgAngleW = vSubstellarAngle;
        if (uMagmaSeaAngle > 0.0){
          mgAngleW = vSubstellarAngle + 0.05 * noised(vPos * 3.3 + uMacroOffset).x;
          mgSeaMask = smoothstep(uMagmaSeaAngle + 0.05, uMagmaSeaAngle - 0.05, mgAngleW)
                    * provinceWeight(PROV_MAGMA);
          shadeN = normalize(mix(shadeN, N, mgSeaMask));
        }

        // ── Envelope composite-split (spec §2.C) — each term is the A/B/C surface.
        // A bypassed term skips the quantizer => smooth glow over the posterized base.
        float diff = max(dot(shadeN, uLightDir), 0.0);
        float ambient = 0.035;
        vec2 fc = gl_FragCoord.xy;
        // View vector — planet sits at origin, identity quaternion, so world==object space
        vec3 V = normalize(cameraPosition - vPos);

        // ── Stage 6: surface albedo / material (relief + cryo frost tint + liquid material) ──
        // F3 bright rays — fresh high-albedo ejecta streaks brighten the lit surface BEFORE
        // posterize (the relief doc §F3.a albedo exception; only term here that's albedo not relief).
        float rayBright = rayField(vPos) * diff;       // sunlit fresh material only
        // Cryo frost (F23/F22): high-albedo overlay mixed into the base BEFORE posterize so the
        // luminance lift survives quantization as a bright cap (cryo-doc §2.a; the colour TINT is
        // the stylize/drop part). frostCover=0 ⇒ uBaseColor unchanged (regression-safe).
        // F22 PLD strata: dim the frost albedo in alternating annular layers (pldBands), keyed on the
        // pole-distance coordinate (frostBandCoord = coldFactor) which ramps smoothly across the whole
        // cap — the coverage itself saturates to the budget past the snowline, so it cannot carry rings.
        // The mix gates the strata to the cap (frostCover=0 ⇒ mix→uBaseColor, bare ground untouched).
        vec3 frostShade = uFrostAlbedo * pldBands(frostBandCoord);
        // F14 standing liquid — species-keyed fill mixed BEFORE frost so frost wins where
        // cold (sea ice; the eyeball ice-ring falls out of the latitude lapse for free).
        // Water = dark cool fill; methane/ethane = darker warm fill (Titan radar-dark).
        vec3 liquidCol = (uLiquidSpecies == 1) ? vec3(0.11, 0.07, 0.03) : vec3(0.04, 0.10, 0.22);
        // ── Ground palette (terrain-driven). The BODY's condition picked the three endmembers (surfacePaletteOf);
        // the LOCAL geology picks where between them this pixel sits. Two real processes, no hand-painting:
        //   steep  → fresh bedrock. Mass wasting strips regolith faster than weathering forms it, so slopes and
        //            crests expose unaltered rock. This is why fresh Martian scarps read grey under the rust.
        //   lowFlat→ transported fines. Sediment is deposited where gradient dies and there is somewhere to put
        //            it, i.e. flat LOW ground; a flat CREST is stripped, not filled, so the elevation term gates it.
        // Slope is the deviation of the relief-perturbed normal from the geometric one — bounded [0,1], needs no
        // field-unit calibration, and valid on both normalMode paths since both write shadeN.
        // uTerrainAlbedoMix = 0 ⇒ collapses to the single uBaseColor (pre-palette behaviour, regression-safe).
        const float TERRAIN_SLOPE_GAIN = 3.0;    // 1-dot(shadeN,N) is 0.134 at a 30° tilt, 0.293 at 45° — this
                                                 // gain puts the fresh-rock transition across normal hillslopes
                                                 // rather than only on near-vertical faces. CALIBRATED LIVE.
        const float TERRAIN_ELEV_LO    = -0.35;  // field units — below this the ground reads as basin floor
        const float TERRAIN_ELEV_HI    =  0.05;  // above this no sediment fill at all (a flat CREST is stripped,
                                                 // not filled). CALIBRATED LIVE against the real height spread.
        const float VEG_ELEV_LO        = -0.10;  // treeline: cover is full at/below this accumulated-relief height
        const float VEG_ELEV_HI        =  0.55;  // and gone at/above it. Wide band — a treeline is gradual.
        const float VEG_BASIN_RICH     =  1.35;  // basins carry ~35% denser cover than shield interiors (water)
        float terrSteep   = clamp((1.0 - dot(shadeN, N)) * TERRAIN_SLOPE_GAIN, 0.0, 1.0);
        float terrLow     = 1.0 - smoothstep(TERRAIN_ELEV_LO, TERRAIN_ELEV_HI, surfElev);
        float terrLowFlat = (1.0 - terrSteep) * terrLow;
        // ── V2-4 province ground. This is the HISTORY-derived selector, and it runs FIRST, beneath the
        // slope/elevation terms: province says what KIND of crust this is (an ancient shield, an active
        // deformation belt, a sediment sink — decided on the CPU from fault density, structural grain and
        // accommodation, then relaxed), while slope and elevation then say what the LOCAL surface is doing
        // on top of it. A steep scarp exposes fresh rock whether it is cut into a craton or an orogen, so
        // those modulate afterwards rather than competing.
        //   craton → uCratonColor  (deeply weathered, erosion-unrefreshed)
        //   orogen → uFreshColor   (uplifting, stripped to bedrock)
        //   basin  → uSedColor     (the sink; fill)
        // ⚠ GATE ON THE WEIGHT SUM, NOT ON ALPHA. The real cube clears to (0,0,0,0), so alpha looks like a
        // natural coverage flag — but the BOOT-TIME dummy bound before route() ever bakes is a 1x1 canvas
        // filled with '#000', which is OPAQUE black: alpha 1, rgb 0. An alpha gate passes it, the weights
        // normalize to zero, and the planet renders BLACK until the first route. The rgb sum is the honest
        // coverage test: the dummy fails it, and any genuinely baked direction sums to ~1 by construction.
        // (Sum, not any single channel: craton is R=1,G=0,B=0, indistinguishable from the dummy per-channel.)
        vec3 groundCol = uBaseColor;
        vec4 provS = sampleProvince(vObjN);
        float provSum = provS.r + provS.g + provS.b;
        float provBasin = 0.0;   // hoisted: the biosphere term below reads it (basins hold the water)
        if (provSum > 0.001) {
          vec3 pw = provS.rgb / provSum;                         // renormalize: interpolation is not partition-safe
          provBasin = pw.b;
          if (uProvinceColorMix > 0.0) {
            vec3 provCol = pw.r * uCratonColor + pw.g * uFreshColor + pw.b * uSedColor;
            groundCol = mix(groundCol, provCol, uProvinceColorMix * clamp(provSum, 0.0, 1.0));
          }
        }
        groundCol = mix(groundCol, uFreshColor, terrSteep   * uTerrainAlbedoMix);
        groundCol = mix(groundCol, uSedColor,   terrLowFlat * uTerrainAlbedoMix);
        // ── Biosphere ground cover. uBioGroundCover = biosphereOf(cond) — the condition-derived photosynthetic
        // cover fraction (liquid water × atmosphere × volatiles × time × not-frozen), NOT the preset's authored
        // authored habitability field (see the law's note on why). Distinct from F46 fungal mats, an EMISSIVE
        // NIGHTSIDE effect on a lab knob; this is a daylight surface albedo.
        // Applied AFTER province and terrain (it grows on whatever crust is there) but BEFORE the liquid mix and
        // the ice/frost overlays, so open water covers it and a seasonal frost cap still wins on top of it.
        // Three terrain modulations, all real:
        //   (1 − terrSteep)  — a steep face sheds soil faster than it forms; scarps stay bare rock.
        //   elevation        — a treeline: cover thins out with altitude.
        //   basin enrichment — water collects in the sinks, so basins carry denser cover than shield interiors.
        // Vegetation is DARKER than the rock it grows on (canopy albedo ~0.15–0.25), so a living world's disc
        // gets darker, not brighter — the opposite of what "add a green tint" would do.
        if (uBioGroundCover > 0.0) {
          float vegElev = 1.0 - smoothstep(VEG_ELEV_LO, VEG_ELEV_HI, surfElev);
          float vegWet  = mix(1.0, VEG_BASIN_RICH, clamp(provBasin, 0.0, 1.0));
          float veg = clamp(uBioGroundCover * (1.0 - terrSteep) * vegElev * vegWet, 0.0, 1.0);
          groundCol = mix(groundCol, uBioGroundColor, veg);
        }
        vec3 albedoCol = mix(groundCol, liquidCol, liquidMask);
        // ── V2-6 S3 iceness material (BUILD-PLAN §1E) — an icy body's BASE ground reads as ice (bluish-white),
        // not rock-brown. Condition-derived (uIcenessMix = icenessOf(cond), driven in applyDrivers); pre-posterize
        // so the ice band survives quantization; uIcenessMix=0 ⇒ bare rock ramp (byte-identical Stage-6 base).
        // Mixed BEFORE the dust/frost overlays so a seasonal frost cap still wins on top of the base ice material.
        albedoCol = mix(albedoCol, uIcenessAlbedo, uIcenessMix);
        // F16 dust ochre lift — settled-mantle albedo mixed BEFORE the frost mix so frost
        // WINS where cold (F20's frost-wins ordering; ice-cemented mantles still read
        // frosty). Butterscotch ochre = dust absorbs blue, scatters the rest (card §3
        // webexhibits read). Pre-posterize so the warm/bright band survives quantization
        // as its own bin instead of collapsing into bare rock (card §6 item 4).
        const vec3 DUST_OCHRE = vec3(0.72, 0.52, 0.30);
        albedoCol = mix(albedoCol, DUST_OCHRE, dustCover * 0.6);
        albedoCol = mix(albedoCol, frostShade, frostCover);
        // (F11 species floor-tint removed 2026-06-19 — the dendritic overlay's carve-floor
        // darkening below is now THE river floor albedo. fluvialWet still flows into F12
        // deltaCombiner as its depositional gate, so the variable is kept live above.)
        // ── AC4 river carve — wet valley-floor darkening along the carved network (the F11 tint's
        // role, but keyed on the real carve depth, not a noise mask). uRiverCarveFloor 0 ⇒ no-op.
        vec3 carveFloorCol = (uLiquidSpecies == 1) ? vec3(0.10, 0.07, 0.03) : vec3(0.05, 0.07, 0.12);
        albedoCol = mix(albedoCol, carveFloorCol, clamp(carveDepth * uRiverCarveFloor, 0.0, 1.0) * (1.0 - liquidMask));
        // F20 coastlines — three pre-posterize luminance terms (card §6.5 step 3). Beach
        // mixes toward a species-keyed band: water → pale sand, methane → dark tholin
        // shore (card §6: NO bright water-world beach on Titan); frost wins over beach
        // where cold (same phase logic as the F14 liquid fill — snow buries the strand).
        // Cliff multiplies albedo DOWN (a wave-cut face reads dark at any hue);
        // strandlines brighten faintly. All luminance — survives the posterize.
        vec3 beachCol = (uLiquidSpecies == 1) ? vec3(0.13, 0.09, 0.05) : vec3(0.78, 0.70, 0.52);
        albedoCol = mix(albedoCol, beachCol, beachBand * (1.0 - frostCover));
        albedoCol *= 1.0 - 0.45 * cliffDark;
        albedoCol += vec3(0.10) * strandLine;
        // ── F24 zonal belts (Bands step 4b) — the gas deck REPLACES the solid-surface
        // albedo story above (a gas world has no surface to read; mask 1 ⇒ pure deck).
        // Runs LAST in the albedo chain, pre-posterize, so the zone/belt luminance
        // ladder lands on its own quantize bins (card §6 item 4). bandMask derives 0
        // on every terrestrial preset — the whole block is a no-op there.
        // provinceWeight(PROV_BANDS) is NEUTRAL (floor 1.0 — atmosphere, not geology).
        float bandMask = uBandStrength * provinceWeight(PROV_BANDS);
        if (bandMask > 0.0){
          // ── F27 great spot — the swirl is applied to the DIRECTION the whole band
          // computation reads, BEFORE zonalBandCol: trueLat AND the warp/noise domain
          // both see the storm-rotated sphere, so the stripes deflect and wrap around
          // the vortex (embedded IN the flow, card §6 item 3 — not a pasted sticker).
          // provinceWeight(PROV_GREATSPOT) is NEUTRAL (floor 1.0 — same gas-deck
          // pattern as PROV_BANDS/PROV_JETS). uStormCount 0 (feature off, or any
          // terrestrial preset deriving spotStrength 0) takes the raw N/vPos path:
          // byte-identical F25 rendering — the F27 regression contract.
          vec3 bandN = N, bandPos = vPos;
          // slice K: the RAW (un-swirled) sphere direction — the latitude the ink advection deflects FROM
          // (bandN is storm-swirled; Nraw must be the un-rotated direction so dBand reads the true baked band).
          vec3 bandNraw = normalize(vPos);
          if (uStormCount > 0){
            bandN = stormSwirl(normalize(vPos));
            bandPos = bandN * length(vPos);
          }
          albedoCol = mix(albedoCol, zonalBandCol(bandN, bandNraw, bandPos, vBand, vShear, vMush, vStorm), bandMask);
        }
        // ── F25 jets solo visibility — jets key on uJetStrength ALONE: with the deck
        // dark (solo('jets') zeroes uBandStrength), the shear turbulence still reads
        // as a multiplicative 1±turb LUMINANCE factor on whatever albedo is beneath
        // (provinceWeight(PROV_JETS) is neutral, floor 1.0). The (1.0 - bandMask)
        // complement keeps full-deck gas worlds single-counted — there the same
        // displacement already lives INSIDE zonalBandCol. Jets off ⇒ exact no-op.
        float jetSoloMask = uJetStrength * provinceWeight(PROV_JETS) * (1.0 - bandMask);
        if (jetSoloMask > 0.0){
          float jLat  = asin(clamp(N.y, -1.0, 1.0)) * 0.63661977;
          float jLatC = sign(jLat) * pow(abs(jLat), uBandLatPow);
          albedoCol *= clamp(1.0 + 1.2 * jetSoloMask * jetsDisp(jLat, jLatC, vPos), 0.4, 1.6);
        }
        // ── F40 dust devil tracks (card §6.5 step 5 — the low-activity garnish):
        // thin dark curlicues ETCHED into the surface albedo where vortices stripped
        // the bright settled dust (HiRISE ESP_031199_2070 — albedo SUBTRACTION, never
        // a dark cloud added on top). Strokes = the zero-crossing contours of a
        // domain-warped noised() field (loopy thin lines for free; the warp vector is
        // the .yzw analytic gradient of one extra sample — cheap, card §6.5 step 5),
        // clustered sparse by a low-frequency patch mask. LUMINANCE-only: a
        // multiplicative darkening scales all channels equally (hue ratios survive,
        // card item 5 "never hue"). STATIC — no uTime: tracks are persistent ground
        // etchings, deterministic on re-approach. Windowed to activity ~0.1-0.4 and
        // fading as the veil takes over; activity 0 (enable off via the per-frame
        // writer, or every non-carrier preset) skips the block — albedoCol untouched,
        // the F40 regression contract. NO h/grad writes (F19 contract).
        if (uDustActivity > 0.0){
          float trackWin = smoothstep(0.08, 0.15, uDustActivity) * (1.0 - smoothstep(0.30, 0.45, uDustActivity));
          if (trackWin > 0.0){
            vec3 tp = vPos * 6.0;
            vec3 twp = tp + 0.8 * noised(tp * 0.5 + vec3(13.1, 7.7, -9.3)).yzw;   // curl the strokes
            float stroke = 1.0 - smoothstep(0.0, 0.05, abs(noised(twp).x));        // thin zero-crossing curlicues
            float cluster = smoothstep(0.15, 0.5, noised(vPos * 1.1 + vec3(31.7, -11.2, 17.9)).x);
            albedoCol *= 1.0 - 0.22 * stroke * cluster * trackWin * provinceWeight(PROV_DUSTSTORM);
          }
        }
        // ── F41 magma-sea surface + nightside rock-frost (Exotic, card §6.5 steps
        // 5-6 — ALBEDO/COLOR only, the suppression contract's second half). In-sea
        // the rock albedo is REPLACED by the dark foundering-crust tone (the Kilauea
        // dark-plate base — brightness lives in the emissive seams added at Stage 9,
        // NOT here, so the sea reads near-black where the crust is whole) and the F3
        // fresh-ray brightening is killed (zero-age melt holds no ejecta — multiply
        // INSIDE the gate so angle 0 never touches rayBright). On the antistellar
        // side a SLIGHT warm-grey albedo lift reads as rock-vapor condensate plains
        // (the K2-141b GCM cycle: vapor blown across the terminator snows back out)
        // — the uFrostLocked cap pattern on the SAME vSubstellarAngle field, kept
        // patchy via noised() and DELIBERATELY warm grey (rock frost), distinct from
        // the white polar F22/F23 frost. Relief survives there (albedo lift only).
        // Angle 0 (enable off via the per-frame writer, or every non-magma preset)
        // skips the block: albedoCol/rayBright untouched — the F41 regression contract.
        if (uMagmaSeaAngle > 0.0){
          float mgNight = smoothstep(1.9, 2.7, vSubstellarAngle);
          float mgPatch = smoothstep(0.3, 0.75, 0.5 + 0.5 * noised(vPos * 2.4 + uMacroOffset + vec3(17.3, -5.1, 8.9)).x);
          albedoCol = mix(albedoCol, vec3(0.47, 0.44, 0.40), 0.35 * mgNight * mgPatch * provinceWeight(PROV_MAGMA));
          albedoCol = mix(albedoCol, vec3(0.055, 0.045, 0.042), mgSeaMask);
          rayBright *= 1.0 - mgSeaMask;
        }
        // ── F42 graphite crust + tar-flat fill (Exotic, card section 6.5 steps 4-5 —
        // ALBEDO only, the lighting-routed-detail discipline: relief keeps reading
        // through the analytic normals + dither + limb, the albedo just goes DARK).
        // Graphite plain = the whole-world near-black mask (the Ryugu 4-5 percent
        // albedo target): master gate x ONE low-frequency fbm01 octave at planet
        // scale, range-mapped to ~0.85-1.0 so the world is uniformly dark with only
        // subtle low-freq variation — deliberately NO high-frequency albedo noise
        // that would fight the dither and shimmer under the posterizer (card section
        // 6 item 7). Tar flats then overprint DARKER still with a warm hydrocarbon
        // cast (the Titan radar-dark read; the warm-vs-cool split keeps graphite and
        // tar distinguishable inside the lowest luminance buckets). F3 fresh rays
        // are DAMPED, not killed (carbonaceous ejecta is dark too — Ryugu's rays
        // barely contrast; the F41 rayBright-inside-the-gate precedent, so strength
        // 0 never touches rayBright). Strength 0 (enable off via the per-frame
        // writer, or every preset without the C/O field) skips the block:
        // albedoCol/rayBright untouched — the F42 regression contract.
        if (uCarbonStrength > 0.0){
          float cbVar = 0.5 + 0.5 * noised(vPos * 0.9 + uMacroOffset + vec3(-19.3, 6.7, 11.1)).x;
          float cbMask = uCarbonStrength * (0.85 + 0.15 * cbVar) * provinceWeight(PROV_CARBON);
          albedoCol = mix(albedoCol, vec3(0.045, 0.043, 0.048), cbMask);   // graphite — near-black, faintly cool
          albedoCol = mix(albedoCol, vec3(0.030, 0.024, 0.018), carbTar);  // tar fill — darker, faintly warm, dead smooth
          rayBright *= 1.0 - 0.8 * cbMask;
        }
        // ── F49 ecumenopolis day-side albedo crossfade (PRE-posterize, the F41/F42 albedoCol=mix(...)
        // precedent). At high coverage the surface color is REPLACED toward a single FLAT concrete tone
        // (per-block variation rides RELIEF + dither, NOT albedo — avoids fighting the posterize, the
        // F42 graphite precedent). Coverage 0 ⇒ mix(...,0) = albedoCol unchanged (regression-safe).
        if (uEcuCoverage > 0.0) {
          float ecuCovA = ecuCoverageMask(vPos) * provinceWeight(PROV_ECUMENOPOLIS);
          albedoCol = mix(albedoCol, uEcuConcreteColor, ecuCovA);
        }
        // ── F16 butterscotch veil (Stage-8 haze channel, computed HERE so it hits each
        // term PRE-posterize — there is no single final quantizer, every surface term
        // carries its own). Airborne suspended dust warms ALL light passing through it
        // (card §3): whole-disk multiplicative muting col·(1.06, 0.96, 0.82) blended by
        // uDustTint·uDustDepth — applied to the lit SURFACE (terminator included via
        // diff), the CLOUD deck and the LIMB glow below, NOT painted on the ground albedo
        // (card §6 item 5). The ★ emissive/spec/aurora bypass channels stay unmuted —
        // they are the designated posterize-survivors (incandescence punches through).
        // uDustDepth 0 (airless / feature off) ⇒ veilTint = 1.0 exactly — regression-safe.
        float dustVeil = clamp(uDustTint * uDustDepth, 0.0, 1.0);
        vec3 veilTint = mix(vec3(1.0), vec3(1.06, 0.96, 0.82), dustVeil);
        // ── F31c regime-2 HAZE MUTE — the Stage-8 reserved muting slot ("haze muting
        // runs BEFORE final posterize"), hoisted here because every term carries its
        // own quantizer (the F16 veil precedent above). Photochemical tholin haze
        // (card §4: GJ 1214 b flat transmission spectrum) kills surface contrast
        // toward ONE haze tone: deviation from uHazeColor scales by (1 - uHazeMute)
        // — the mix IS the contrast + saturation kill. Applied to the PRE-LIT albedo
        // (not the lit color) so day/night shading and the limb read survive — a
        // deliberately featureless muted globe, never a broken texture (card §6
        // item F31c: 2-3 flat lighting bands + limb glow are all that remain).
        // uHazeMute 0 (every non-sub-neptune preset, or clouds disabled via the
        // per-frame writer) leaves the albedo untouched — regression-safe.
        albedoCol = mix(albedoCol, uHazeColor, uHazeMute);
        // ── F40 dust storm VEIL — the Stage-8 reserved UPPER slot ("AEOLIAN F40 storm
        // veil wins the upper slot"), hoisted to this pre-posterize seat like the F16
        // veil / F31c mute above because every term carries its own quantizer. The lit
        // surface is computed FIRST (litSurf — identical arithmetic to the old inline
        // posterize argument), then veiled: tau = activity^2 (a*a, no pow) x a
        // recursive domain-warped patch mask (q=fbm(p); r=fbm(p+4q) — the shredded,
        // lobed, asymmetric leading edge, card §6 item 1), and the FLATTEN job runs as
        // mix(litSurf, dustTone, 1-exp(-tau)) BEFORE the posterize, so obscuration
        // reads as the band count collapsing 6 -> 2-3 (card §4's critical insight —
        // exp(-tau) is spec-defined everywhere). The dust tone is lit by the front's
        // OWN diffuse: the F31a clouds-as-relief slot (uCloudRelief) applied to the
        // dust field's analytic gradient, so the advancing wall's sunlit top reads
        // BRIGHTER than the ground it covers and survives as dither texture, not a
        // flat wash (card §6 item 4). F19 CONTRACT: never touches h/grad or the
        // terrain normal. Drift is BOUNDED two-phase time (the F25 fract crossfade —
        // nothing accumulates; fly-away/re-approach lands in a plausible nearby state,
        // card §6 item 6). The patch floor rises with activity (engulf smoothstep) so
        // activity 1 is planet-encircling. dustTau also attenuates the F31 weather
        // deck below — the storm hangs ABOVE it (the upper-slot rule). Activity 0
        // (enable off via the per-frame writer, or every non-carrier preset) skips the
        // block: litSurf untouched, exp(-0) = 1.0 on the deck — byte-identical pre-F40
        // output, the F40 regression contract.
        float dustTau = 0.0;
        vec3 litSurf = min(veilTint * (albedoCol * (diff + ambient) + uBaseColor * rayBright), vec3(1.0));
        if (uDustActivity > 0.0){
          float a2 = uDustActivity * uDustActivity;            // activity^2 via a*a (no pow)
          float dph0 = fract(uTime * 0.008);
          float dph1 = fract(uTime * 0.008 + 0.5);
          float dwgt = abs(2.0 * dph0 - 1.0);                  // triangle weight hides each phase wrap
          vec3 dp = vPos * 2.1;
          float dq = fbmd(dp, 3.0, 0.0).x;                     // static recursive-warp q (the shred stays put; the field slides under it)
          vec3 shredO = vec3(9.2, -3.1, 7.4);
          vec3 ddrift = vec3(0.45, 0.0, 0.30);                 // each phase displaced +-half around its rest pose
          vec4 dr0 = fbmd(dp + vec3(4.0 * dq) + shredO + ddrift * (dph0 - 0.5), 4.0, 0.0);
          vec4 dr1 = fbmd(dp + vec3(4.0 * dq) + shredO + ddrift * (dph1 - 0.5), 4.0, 0.0);
          vec4 dr = mix(dr0, dr1, dwgt);
          // patch mask: storms grow + multiply as the threshold bias rises with
          // activity; the engulf floor takes the whole disc by activity 1 (§6.5 step 3)
          // Verify fix cycle 2: threshold band lowered 0.30..0.55 -> 0.15..0.45
          // so the DRIVEN Mars activity 0.55 reads as a credible regional storm
          // (was 2.5-3 percent disc coverage - no-storm on the feature's own carrier).
          float patchRaw = smoothstep(0.15, 0.45, dr.x + 0.30 * uDustActivity);
          float engulf = smoothstep(0.55, 1.0, uDustActivity);
          float dustPatch = mix(patchRaw, 1.0, engulf) * provinceWeight(PROV_DUSTSTORM); // NB: 'patch' is a GLSL ES 3.00 reserved word
          dustTau = 3.0 * a2 * dustPatch;
          // self-shading front — F31a mechanism on the dust field's own tangential gradient
          vec3 dgt = dr.yzw - N * dot(dr.yzw, N);
          vec3 ddn = normalize(N - uCloudRelief * dgt);
          float ddiff = max(dot(ddn, uLightDir), 0.0);
          litSurf = mix(litSurf, min(uDustColor * (ddiff + 0.05), vec3(1.0)), 1.0 - exp(-dustTau));
        }
        vec3 surface = posterize(litSurf, uLevels, fc, 0.4, uDitherMode);

        // ── Stage 7: EXOTIC overlay — base-type + overlay-layer composite; consumes the FULL natural-base
        //    lit color + landMask; renders LAST among surface terms, before the envelope split. [domain: Exotic]
        //    F47 machine surface — dark-metal plate albedo composited OVER the posterized natural base,
        //    under the maturity-driven coverage mask. Posterized inside the mix so the quantizer never
        //    sees an albedo gradient to crush; guarded on uMachCoverage>0 so coverage 0 ⇒ surface
        //    byte-identical (bare Stage-6 base — the overlay-correctness regression guarantee). Panel
        //    seams/bevels ride the normal channel (machineRelief); traces/windows ride the emissive bypass.
        if (uMachCoverage > 0.0) {
          float machCov = machCoverageMask(vPos) * provinceWeight(PROV_MACHINE);
          surface = mix(surface,
                        posterize(uMachMetalColor * (diff + ambient), uLevels, fc, 0.4, uDitherMode),
                        machCov);
        }

        // ── Stage 8: CLOUDS & HAZE — F31 regime-dispatched family combiner (LIVE 2026-06-10): clouds-as-
        //    relief deck (regimes 0/3/4 below) + haze muting (regime 2 — LIVE, hoisted to the pre-posterize
        //    albedo slot above, the F16 veil precedent, because every term carries its own quantizer);
        //    AEOLIAN F40 storm veil wins the upper slot when both active (LIVE 2026-06-10: the veil
        //    sits in the hoisted pre-posterize seat above; dustTau attenuates this deck below). [domains: Clouds, Aeolian]
        // Clouds (analytic-FBM weather layer — animated via uTime; off plain snoise, onto noised() — Q7).
        vec4 cw = fbmd(vPos * 1.7 + vec3(uTime * 0.02, 0.0, 0.0), 5.0, 0.0);
        // ── F26 latitude weather bands — bias the threshold INPUT (card §6.5 step 5):
        // wet belts (ITCZ / storm tracks / polar) lift the cloud FBM over the coverage
        // threshold; the -uWeatherDry term sinks the subtropical troughs below baseline
        // (clear gaps, card §6 item 2). The latitude input is pre-warped by a
        // recursive-warp fbm so belt edges shred into fronts, not drawn-on latitude
        // circles (card §6 item 3). Eyeball switch: tidally-locked retained-atmosphere
        // worlds reorganize circulation around the substellar point — latCoord mixes
        // |spin-axis lat| → substellar-angle space via the SHARED vSubstellarAngle
        // varying (the frost convention). Drift comes free from the cw FBM's existing
        // uTime term sliding under the static belt envelope — no new time terms.
        // Density stays lighting-routed via the existing (diff + 0.05) factor below,
        // so the bands survive the posterize as dither texture (card §6 item 5). At
        // uWeatherStrength 0 the branch is skipped: bit-identical threshold argument.
        float cwx = cw.x;
        if (uWeatherStrength > 0.0){
          float wLat = mix(abs(normalize(vPos).y),
                           clamp(vSubstellarAngle / 3.14159265, 0.0, 1.0),
                           uWeatherLocked);
          float wLatW = abs(wLat + uWeatherWarp * weatherWarpField(vPos));
          // provinceWeight(PROV_WEATHER) is NEUTRAL (floor 1.0 — climate, not geology).
          // 0.65 bias scale (live tune 2026-06-10, was 0.45): the signed fbmd base
          // spans ~±0.6 against a 0.15..0.5 threshold window, so belts need ~+0.4
          // to clearly clear it where the base runs low; troughs go negative via
          // uWeatherDry (belts +0.37, ITCZ +0.24, trough −0.06 at defaults).
          cwx += uWeatherStrength * provinceWeight(PROV_WEATHER) * (weatherLatBias(wLatW) * 0.65 - uWeatherDry);
        }
        // ── F31a CLOUDS-AS-RELIEF (card §6.5 step 5a) — the deck self-shades by
        // tilting the CLOUD TERM'S OWN diffuse with the tangential component of the
        // fbmd analytic gradient (cw.yzw — already computed, no second fbm). The
        // lighting VALUE carries the cloud form through the posterize, not the hue
        // (the research-doc posterization adaptation). F19 CONTRACT: this never
        // touches h/grad or the surface normal — terrain shading is untouched.
        // Replacing the old terrain-coupled (diff + 0.05) with the cloud-shaded
        // (cdiff + 0.05) is the card's intentional, judged F31a upgrade: clouds no
        // longer inherit ground-relief shadows, they cast their own.
        vec3 cgt = cw.yzw - N * dot(cw.yzw, N);              // tangential cloud gradient
        vec3 cn  = normalize(N - uCloudRelief * cgt);        // cloud-top shading normal
        float cdiff = max(dot(cn, uLightDir), 0.0);
        float cloud = smoothstep(0.15, 0.5, cwx) * uCloudCoverage * (cdiff + 0.05);
        // ── F31 REGIME DISPATCH (card §6.5 step 5) — gated on uCloudCoverage like
        // the deck itself: cloudsEnabled off forces coverage 0 at the per-frame
        // writer, so blanket / pupil / ring all vanish with the deck (no deck at all).
        float blanketMask = 0.0;          // regime 3 — 1.0 hides surface + thermal floor below
        vec3 cloudTint = vec3(1.0);       // weather decks stay white; the venus blanket tints
        if (uCloudCoverage > 0.0){
          if (uCloudRegime == 2){
            // F31c — the haze veil hangs ABOVE the deck: the patchy weather layer is
            // muted away with the rest of the structure (the albedo mute upstream
            // owns the featureless read; a visible swirling deck would defeat it).
            cloud *= 1.0 - uHazeMute;
          } else if (uCloudRegime == 3){
            // F31d — VENUS BLANKET: the deck IS the visible surface. Coverage is
            // driven to 1.0 and the term REPLACES the ground (blanketMask zeroes
            // the surface + thermal-floor emissive below — zero ground leak at any
            // distance, card §6). Shading = the clouds-as-relief diffuse over the
            // geometric sphere, with a faint field variation for dither texture and
            // ONE [subtle] planetary-scale Y/V chevron: a single-bucket darkening
            // whose arms sweep back from the equator in (lat, lon - slow uTime
            // drift) — the 4-day superrotating Kelvin/Rossby wave read (card §4).
            blanketMask = 1.0;
            vec3 bn = normalize(vPos);
            float bLat = asin(clamp(bn.y, -1.0, 1.0));
            float bLon = atan(bn.z, bn.x) - uTime * 0.03;    // slow superrotation drift
            float arm  = cos(bLon + 1.6 * abs(bLat));        // arms rake back with |lat| - the sideways V/Y
            float chev = smoothstep(0.55, 0.95, arm) * (1.0 - smoothstep(0.5, 1.2, abs(bLat)));
            cloud = (cdiff + 0.05) * (0.97 + 0.06 * cw.x) * (1.0 - uChevronStrength * chev);
            cloudTint = uHazeColor;                          // sulfuric deck tone (driven: atmosphere color)
          } else if (uCloudRegime == 4){
            // F31f — EYEBALL: standing substellar convection cap ("pupil") +
            // terminator cloud ring, both pure functions of the pre-plumbed
            // vSubstellarAngle — STATIC against uTime, they move only with the
            // light direction (card §6). Shaded by the GEOMETRIC diffuse (not
            // cdiff) so the cap stays still while the regular weather deck keeps
            // drifting underneath at its derived coverage. The ring sits near 90
            // degrees where gdiff is ~0, so it carries its own 0.3 luminance floor
            // (edge-lit terminator clouds) — one dithered bucket at 6 levels.
            float gdiff = max(dot(N, uLightDir), 0.0);
            float pupil = smoothstep(uPupilR, uPupilR * 0.55, vSubstellarAngle);
            float ringT = (vSubstellarAngle - 1.5708) / 0.22;
            float ring  = exp(-ringT * ringT);
            cloud += pupil * (gdiff + 0.05) + 0.55 * ring * (gdiff + 0.3);
          }
        }
        vec3 cloudC = cloudTint * cloud;
        cloudC *= veilTint;   // F16 — suspended dust warms the cloud deck too (pre-posterize)
        cloudC *= exp(-dustTau);   // F40 — the storm veil hangs ABOVE the weather deck (the upper-slot rule); dust off => exp(-0) = 1.0 exactly
        cloudC = posterize(cloudC, uLevels, fc, 0.4, uDitherMode);
        // F31d — the blanket replaces the ground entirely (regime 3 only; 0.0 elsewhere = exact no-op).
        surface *= 1.0 - blanketMask;

        // ── Stage 9: OPTICAL — limb/terminator scattering (additive-tint ONLY; must not double-darken). [domain: Optical]
        // F34 limb / atmosphere rim glow — fresnel against the GEOMETRIC normal N (the
        // rim hugs the true silhouette; relief never drags glow inboard), sun-weighted
        // by (diff + 0.15): lit limb brightest, night limb keeps a faint floor.
        // Driver-true since F34: width = uLimbExponent (thin clear atmosphere ~3.5 =
        // narrow Earth blue line; thick-haze class ~1.8 = fat Titan/Venus halo), tint
        // = uLimbColor (per-preset atmosphere hue — no longer the surface uBaseColor).
        // The fresnel base is clamped to [0,1] and the exponent stays positive, so
        // pow() never hits the spec-undefined region. Strength 0 (enable off, or any
        // airless preset) zeroes the whole additive term: byte-identical pre-F34
        // output — the F34 regression contract.
        float limb = pow(1.0 - max(dot(N, V), 0.0), uLimbExponent) * uLimbStrength * (diff + 0.15);
        vec3 limbC = uLimbColor * limb * provinceWeight(PROV_LIMB);
        limbC *= veilTint;    // F16 — the lit limb reads through the haze (card §6 item 5)
        limbC = (uLimbBypass == 1) ? limbC : posterize(limbC, uLevels, fc, 0.4, uDitherMode);
        // F35 terminator color gradient — the F34 rim's twilight half: a 1-D gaussian
        // band of SIGNED mu = dot(N, uLightDir) against the same GEOMETRIC normal N
        // (an atmospheric great-circle band; relief never bends twilight), peaked at
        // mu = 0 so it straddles the boundary and bleeds slightly onto the night side.
        // Written exp(-tt*tt) — NEVER pow(negative, y), which is spec-undefined for
        // signed mu. Width is floored in-shader (max(w, 1e-3)) AND the whole term is
        // gated on strength > 0: enable off, or any airless preset, derives strength
        // 0 and skips the block entirely — byte-identical pre-F35 output, the F35
        // regression contract. Additive tint ONLY (Stage-9 rule: never darkens).
        vec3 termC = vec3(0.0);
        if (uTermStrength > 0.0){
          float mu = dot(N, uLightDir);
          float tt = mu / max(uTermWidth, 1e-3);
          termC = uTermColor * uTermStrength * exp(-tt * tt) * provinceWeight(PROV_TERM);
          termC *= veilTint;  // F16 — twilight reads through the haze, same as the limb
          termC = (uTermBypass == 1) ? termC : posterize(termC, uLevels, fc, 0.4, uDitherMode);
        }

        // ════════ posterize(surface) split — ★ EMISSIVE channel: all terms below BYPASS the quantizer ════════
        // Owners: thermal Bands F32/F33 (emissiveBlackbody), magma Exotic F41 (emissiveBlackbody),
        // city lights F48/49, bioluminescence F46, aurora Optical F37, sunglint Optical F36.

        // ★ Emissive glow (whole-globe thermal-floor — the old lava/hot stand-in,
        // now RETIRED for BOTH its named owners: F32 zeroes state.emissive on
        // hot-jupiter, F41 zeroes it on the magma class (locked + solid + T_ss >
        // liquidus — Lava and K2-141b), both at applyDrivers. What remains is the
        // faint non-magma hot floor, e.g. Venus ~0.14 hidden under the blanket.)
        // Lambert-independent (visible on the dark side).
        // F31d blanketMask: an opaque venus deck also hides the ground's thermal floor
        // (Venus T_eq 737 derives emissive ~0.14 — a night-side glow would read as
        // ground leak through the shroud). Lava cracks / lightning below still punch
        // through: they are above-deck or designated posterize-survivor channels.
        vec3 emissive = uBaseColor * uEmissive * (1.0 - blanketMask);
        emissive = (uEmissiveBypass == 1) ? emissive : posterize(emissive, uLevels, fc, 0.4, uDitherMode);
        // ★ F8 lava cracks — ALWAYS bypass the quantizer (the canonical Option-C survivor, §F8.c):
        // spatial Worley crack-mask glow that stays crisp over the posterized basalt.
        // Review M1 (F41): cracks are masked OUT of the magma sea — the molten
        // zero-age dayside owns its own seams, F8 rides the solid nightside
        // (card item 8). mgSeaMask is 0.0 unless the F41 angle gate ran; x*1.0
        // is bit-exact, so the pre-F41 contract holds everywhere else.
        emissive += lavaCrackEmissive(vPos) * (1.0 - mgSeaMask);
        // ★ F46 bioluminescent / fungal mats — emissive OVERLAY (NOT relief): a night-side biosphere
        // glow added AFTER the quantizer (Option-C bypass survivor, like lava cracks above / aurora).
        // Coverage = thresholded domain-warped FBM (sparse patches → planet-spanning mat as uBioCoverage→1);
        // reticulated veining = thresholded warped-noise contour (deterministic fake-Turing, NO ping-pong);
        // gated to the dark hemisphere by nightMask + slow noised() shimmer. uBioCoverage 0 ⇒ bioC = vec3(0).
        vec3 bioC = vec3(0.0);
        if (uBioCoverage > 0.0) {
          // domain warp (lava-crack idiom) so colonies meander, not a noise grid
          vec4 bw1 = noised(vPos * (uBioScale*0.6) + uMacroOffset + vec3(5.2, 18.7, -9.3));
          vec4 bw2 = noised(vPos * (uBioScale*0.6) + uMacroOffset + vec3(-12.1, 3.4, 7.8));
          vec3 bwPos = vPos + 0.35 * vec3(bw1.x, bw2.x, bw1.y);
          // coverage FBM → patch mask; raising uBioCoverage lowers the threshold (patches grow & merge)
          float bfbm = 0.5 + 0.5 * noised(bwPos * uBioScale + uMacroOffset).x;
          float thresh = mix(0.72, 0.08, uBioCoverage);                 // high thresh = sparse, low = full mat
          float bioPatch = smoothstep(thresh, thresh + 0.18, bfbm);     // soft colony patches ('patch' is a GLSL ES 3.00 reserved word)
          // reticulated veining — thresholded contour of a 2nd warped noise = "fake-Turing" net (deterministic)
          float vein01 = 0.5 + 0.5 * noised(bwPos * (uBioScale*2.3) + uMacroOffset + vec3(31.0,-4.0,12.0)).x;
          float veins  = 1.0 - smoothstep(0.0, 0.10, abs(vein01 - 0.5)); // bright on the iso-0.5 contour ridges
          float mat    = bioPatch * mix(0.55, 1.0, veins);              // veins brighten within colonies
          // night gate (the aurora nightMask) + slow living shimmer (aurora flicker)
          float nightMask = 1.0 - smoothstep(-0.1, 0.1, diff);
          float shimmer   = 0.75 + 0.25 * noised(vec3(bwPos.xy * 1.5, uTime * 0.06)).x;
          float bio = mat * nightMask * shimmer * uBioIntensity * provinceWeight(PROV_BIOMATS);
          bioC = uBioColor * clamp(bio, 0.0, 1.0);
        }
        // ★ F47 machine surface — glowing circuit traces (district-grid seam ridge) + per-cell-hash
        // lit windows (block grid), on the emissive-bypass channel so they stay crisp over the 6-level
        // posterize and read on the night side (the F8 lava-crack / F46 bioC survivor pattern). Spatial
        // pattern is deterministic (uMacroOffset-seeded grids); only an optional intensity shimmer uses
        // uTime — NO time-based coverage/grid. uMachCoverage 0 ⇒ machC = vec3(0) exactly.
        vec3 machC = vec3(0.0);
        if (uMachCoverage > 0.0) {
          float machCovE = machCoverageMask(vPos) * provinceWeight(PROV_MACHINE);
          float machChD, machChB;
          float machDD = machGridSDF(vPos, uMachDistrictScale, machChD).x;   // district seam distance
          float machDB = machGridSDF(vPos, uMachBlockScale,    machChB).x;   // block seam distance + cell hash
          float machTrace  = 1.0 - smoothstep(0.0, uMachSeamWidth, machDD);  // bright circuit traces on district seams
          float machWindow = step(1.0 - uMachWindowDensity, machChB) * (1.0 - smoothstep(0.0, 0.5, machDB)); // lit cells (hash-selected, bright at cell center)
          float machShimmer = 0.85 + 0.15 * noised(vec3(vPos.xy * 3.0, uTime * 0.1)).x;
          machC = uMachGlowColor * (machTrace + machWindow) * machShimmer * uMachGlowIntensity * machCovE;
        }
        // ★ F48 city lights — warm artificial night-side glow on the emissive-bypass channel
        // (the F46 bioC / F8 lava-crack survivor pattern: crisp over the 6-level posterize, reads on
        // the dark hemisphere). Suitability = land × coast-proximity × 2-octave noise threshold,
        // maturity-swept. Deterministic (uMacroOffset-seeded); uCityMaturity 0 ⇒ cityC = vec3(0) exactly.
        vec3 cityC = vec3(0.0);
        if (uCityMaturity > 0.0) {
          float cityLand  = 1.0 - liquidMask;                                   // land where there's no standing liquid
          // coast-proximity: bright band where land meets ocean (liquidMask edge). On dry/relict worlds
          // (uSeaLevel <= -1 ⇒ liquidMask == 0) cityCoast == 1.0 everywhere, so lights still appear inland.
          float cityCoast = mix(1.0, uCityCoastBoost, smoothstep(0.0, 0.25, liquidMask) * (1.0 - liquidMask) * 4.0);
          // settlement-suitability noise: base FBM + a half-weight 2× octave (bright cores + dim web,
          // the akikun / Black-Marble two-scale read). uMacroOffset ties the pattern to the seed.
          float cityFbm = 0.5 + 0.5 * ( noised(vPos * uCityScale + uMacroOffset).x
                                      + 0.5 * noised(vPos * (uCityScale * 2.0) + uMacroOffset).x );
          float cityThresh = mix(0.78, 0.30, uCityMaturity);                    // maturity lowers threshold: specks → bands
          float cityMask = smoothstep(cityThresh, cityThresh + 0.12, cityFbm) * cityLand * clamp(cityCoast, 0.0, uCityCoastBoost);
          float cityNight = 1.0 - smoothstep(-0.1, 0.1, diff);                  // LIVE aurora nightMask form (NOT the card-prose smoothstep(0.1,-0.1,diff), invalid GLSL)
          float city = cityMask * cityNight * uCityIntensity * provinceWeight(PROV_CITYLIGHTS);
          cityC = uCityColor * clamp(city, 0.0, 1.0);
        }
        // ★ F49 ecumenopolis night glow — F48's warm grid run to SATURATION (whole-surface lattice, no
        // dark rural/ocean gaps — UAT item 1) + per-district hash brightness tiering (bright cores / dim
        // sprawl — UAT item 6), on the post-quantizer emissive-bypass channel, gated by the aurora nightMask.
        // SATURATION distinctive vs F48: the +0.25 floor on the grid term + HIGH default coverage means the
        // WHOLE nightside glows. Deterministic (uMacroOffset-seeded); uEcuCoverage 0 ⇒ ecuC = vec3(0) exactly.
        vec3 ecuC = vec3(0.0);
        if (uEcuCoverage > 0.0) {
          float ecuCovE = ecuCoverageMask(vPos) * provinceWeight(PROV_ECUMENOPOLIS);
          vec4 ecuEw = noised(vPos * (uEcuDistrictScale*0.6) + uMacroOffset + vec3(-3.1,8.4,1.7));
          vec3 ecuEwp = vPos + uEcuWarpAmt * vec3(ecuEw.x, ecuEw.y, ecuEw.z);
          vec3 ecuDistId, ecuGE;
          vec2 ecuRE = voronoi3d(ecuEwp * uEcuDistrictScale, 27, ecuDistId, ecuGE);
          float ecuDistHash = hash33(ecuDistId).x;
          float ecuBright = mix(0.35, 1.0, ecuDistHash);                       // bright cores / dim sprawl tiering
          float ecuGrid = 1.0 - smoothstep(0.0, uEcuSeamWidth*1.5, ecuRE.y - ecuRE.x); // glowing street lattice
          float ecuNight = 1.0 - smoothstep(-0.1, 0.1, diff);                  // LIVE aurora nightMask form (NOT card-prose smoothstep(0.1,-0.1), invalid GLSL)
          float ecuGlow = (ecuGrid + 0.25) * ecuBright * ecuNight * uEcuGlowIntensity * ecuCovE;  // +0.25 floor ⇒ whole nightside glows (saturation)
          ecuC = uEcuGlowColor * clamp(ecuGlow, 0.0, 1.0);
        }
        // ★ F30 lightning — transient convective flash blobs; bypasses the quantizer so
        // each pop stays crisp over the posterized cloud deck (card §6 item 6). Strength 0
        // (enable off, or any airless preset) skips the call: byte-identical F29 output —
        // the F30 regression contract.
        if (uLightningStrength > 0.0) emissive += lightningEmissive(vPos, N, diff, cw.x);
        // ★ F32/F33 thermal day/night — irradiation-driven self-emission on locked hot
        // worlds (ONE temperature curve, two consumers — the emissiveBlackbody header
        // contract). Energy-balance kernel (F32 card section 4): tempK ramps from the
        // F33 night floor to the F32 day peak with starFacing^redistribution, where the
        // facing is taken against uThermalDir — uLightDir rotated EAST about the spin
        // axis by the superrotation hotspot offset (CPU per-frame writer), so the glow
        // bleeds past one terminator and dies before the other. Hue = the shared
        // emissiveBlackbody ramp. Brightness = a stylized Stefan-Boltzmann nod,
        // (tempK/1800)^4 saturating at 1800 K — an ABSOLUTE ramp (deliberately NOT
        // normalized by uDayTempK): the writer's ownership split rewrites uDayTempK /
        // uNightTempK on enable toggles, and an absolute ramp means the split changes
        // WHICH temps render, never how bright a given temperature is (exact A/B
        // continuity between solo and combined). F33 terms in the same block: a
        // low-frequency 3-octave fbmd silicate-cloud mask that only DARKENS the glow
        // on the night hemisphere (Gao/Powell nightside decks block outgoing IR —
        // dark patches, never bright), plus a thin warm fresnel rim on the dark limb
        // so the silhouette stays legible at full-disk distance; the rim rides the
        // night temperature's own brightness ramp, so F33-off extinguishes it with
        // the floor. Strength 0 (every pre-existing preset derives 0) skips the whole
        // block: byte-identical F31 output — the F32/F33 regression contract.
        if (uThermalStrength > 0.0){
          float sf = max(dot(N, uThermalDir), 0.0);
          float tempK = mix(uNightTempK, uDayTempK, pow(sf, uRedistribution));
          float tb = clamp(tempK * (1.0 / 1800.0), 0.0, 1.0);
          float tb2 = tb * tb;
          float thermalBright = tb2 * tb2;                          // (tempK/1800)^4 via squares (no pow edge cases)
          // F33 silicate occlusion — patchy low-freq deck, slow superrotation drift;
          // confined to the night hemisphere (fades out by sf 0.25) so the dayside
          // lobe stays clear (the decks condense where it is cold, card F33 section 4).
          float nightHemi = 1.0 - smoothstep(0.0, 0.25, sf);
          float socc = smoothstep(0.05, 0.45, fbmd(vPos * 0.9 + vec3(uTime * 0.012, 0.0, 0.0), 3.0, 0.0).x);
          float thermalOcc = 1.0 - uThermalOcclusion * socc * nightHemi;
          vec3 thermalC = emissiveBlackbody(tempK) * thermalBright * thermalOcc * provinceWeight(PROV_DAYTHERM);
          // F33 warm limb rim (dark side only) — fresnel^4 against the geometric
          // normal, night-gated; kept subtle (0.6 of the floor brightness at grazing).
          float fres = clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0);
          float fres2 = fres * fres;
          float nb = clamp(uNightTempK * (1.0 / 1800.0), 0.0, 1.0);
          float nb2 = nb * nb;
          thermalC += emissiveBlackbody(uNightTempK) * (nb2 * nb2) * (fres2 * fres2) * nightHemi * 0.6 * provinceWeight(PROV_NIGHTTHERM);
          emissive += uThermalStrength * thermalC;
        }
        // ★ F41 hemispheric magma ocean — the EXOTIC consumer of the shared
        // emissiveBlackbody ramp (ONE curve, the F32/F33/F41 header contract; the
        // 1800 K-normalized quartic brightness is reused VERBATIM so a given
        // temperature renders the same energy in either feature). T(theta) follows
        // the K2-141b GCM irradiation law T_ss x cos^(1/4)(theta) — the pow base is
        // floored at 0.05 (always positive: never the spec-undefined pow region) —
        // so the bypass glow forms CONCENTRIC temperature contours: white/amber hot
        // pole fading to a dull-red shoreline rim along the blackbody ramp. In-sea
        // structure (the Kilauea foundering-crust read): dark plates separated by
        // bright incandescent seams — the F8 crack vocabulary on the SHARED
        // voronoi3d keystone, REUSING the F8 uCrackScale / uCrackWidth knobs +
        // uLavaOffset seed (one crack language per planet, no duplicated Voronoi).
        // Churn = BOUNDED two-phase advection (the F25/F40 fract crossfade —
        // nothing accumulates; fly-away/re-approach lands in a plausible nearby
        // state): two half-period phases drift the warp domain +-half around a rest
        // pose and crossfade on a triangle weight; the warp vector is the noised()
        // analytic gradient (one sample = a free vec3). Open melt at the hot pole
        // fades into crusted plates toward the shoreline (the mgCrust ramp — seams
        // carry the glow, plates keep a faint translucent floor), and the brightness
        // ramp itself dims the seams shoreward as T(theta) falls. The shoreline is
        // a thin ANIMATED emissive band straddling the mask edge (liquidus-
        // temperature waves lapping the rock; gaussian via exp(-t*t) — never
        // pow(neg); shimmer is periodic sin, no accumulation). ALL terms ride this
        // post-posterize emissive channel (the designated survivor, card §4).
        // Angle 0 (enable off via the per-frame writer, or every non-magma preset)
        // skips the block: byte-identical pre-F41 emissive — the regression contract.
        if (uMagmaSeaAngle > 0.0){
          float mgPh0 = fract(uTime * uMagmaChurnSpeed);
          float mgPh1 = fract(uTime * uMagmaChurnSpeed + 0.5);
          float mgWgt = abs(2.0 * mgPh0 - 1.0);                 // triangle weight hides each phase wrap
          vec3 mgDrift = vec3(0.30, 0.0, 0.22);                 // each phase displaced +-half around its rest pose
          vec4 mgW0 = noised(vPos * 1.9 + uLavaOffset + mgDrift * (mgPh0 - 0.5));
          vec4 mgW1 = noised(vPos * 1.9 + uLavaOffset + mgDrift * (mgPh1 - 0.5));
          vec3 mgWarpV = mix(mgW0.yzw, mgW1.yzw, mgWgt);        // churn warp vector (analytic gradient — free)
          vec3 mgC = vec3(0.0);
          if (mgSeaMask > 0.0){
            // cos floor 0.04 (review N1): K2's shoreline sits at cos 0.0465 — a
            // 0.05 floor disagrees with the CPU liquidus iso-angle solve there.
            float mgTempK = uMagmaTemp * pow(max(cos(vSubstellarAngle), 0.04), 0.25);
            float mgTb = clamp(mgTempK * (1.0 / 1800.0), 0.0, 1.0);
            float mgTb2 = mgTb * mgTb;                          // (tempK/1800)^4 via squares (no pow edge cases)
            vec3 mgCid; vec3 mgGrd;
            vec2 mgFF = voronoi3d((vPos + 0.16 * mgWarpV) * uCrackScale + uLavaOffset, uVoroCells, mgCid, mgGrd);
            float mgSeam = 1.0 - smoothstep(0.0, uCrackWidth, mgFF.y - mgFF.x);
            float mgRelT = clamp(vSubstellarAngle / max(uMagmaSeaAngle, 1e-3), 0.0, 1.0);   // 0 hot pole -> 1 shoreline (guarded div)
            float mgCrust = smoothstep(0.15, 0.65, mgRelT);     // open melt at the pole -> foundering plates shoreward
            float mgStruct = mix(1.0, max(mgSeam, 0.06), mgCrust);   // whole crust keeps a faint translucent floor
            mgC = emissiveBlackbody(mgTempK) * (mgTb2 * mgTb2) * mgStruct * mgSeaMask;   // mask already carries provinceWeight
          }
          // shoreline waves — thin emissive band on the SAME breakup-warped angle the
          // mask uses (so the band hugs the ragged shore exactly), at the liquidus
          // temperature: 0.27 = the 1300 K point on the shared 1800 K quartic.
          float mgShoreT = (mgAngleW - uMagmaSeaAngle) / 0.035;
          float mgShore = exp(-mgShoreT * mgShoreT) * (0.65 + 0.35 * sin(uTime * 1.3 + mgWarpV.x * 9.0));
          emissive += mgC + emissiveBlackbody(1300.0) * 0.27 * mgShore * provinceWeight(PROV_MAGMA);
        }
        // ★ F42 diamond glints + tar sheen — the carbon crust's two specular accents,
        // BOTH riding this post-posterize channel (the designated survivor family,
        // card section 6 item 3: "the few high-energy effects that look wrong when
        // banded" — a glint dithered into a soft blob is no glint). NOT thermal
        // emission (graphite at T_eq 600 is not visibly incandescent): both terms
        // are sun+view-dependent reflections, so each carries step(0.0001, diff) —
        // dark side stays dark. Diamond glints (card section 6.5 step 6) = the
        // game snow-sparkle technique: ONE voronoi3d call tiles sparse cells, a
        // per-cell hash33 picks the rare diamond-bearing cells (high threshold via
        // uGlintDensity) AND jitters a per-cell micro-normal off shadeN, then
        // pow(max(dot(Nc,H),0), 60) fires only when that cell's facet aligns with
        // the half-vector — isolated crisp specks that shift as sun/camera move,
        // confined to carbCrest (uplifted crests, the high-pressure-carbon story)
        // and masked OUT of tar fills upstream. Tar sheen = a broad soft
        // Blinn-Phong (exponent 8, dim — a waxy hydrocarbon flat, DELIBERATELY
        // distinct from F36's tight liquid glint at exp ~200 and from the hard
        // specks beside it) on the carbTar mask, whose F14-style flattened normal
        // the combiner already relaxed. Spec-safety: pow bases are max(dot,0)
        // clamped, exponents constant; no divisions. Strength 0 (enable off via
        // the per-frame writer, or every preset without the C/O field) skips the
        // block: byte-identical pre-F42 emissive — the F42 regression contract.
        if (uCarbonStrength > 0.0){
          vec3 cbHv = normalize(uLightDir + V);
          if (carbCrest > 0.0 && uGlintDensity > 0.0){
            vec3 cbCid; vec3 cbGrd;
            vec2 cbFF = voronoi3d(vPos * 16.0 + uDetailOffset, uVoroCells, cbCid, cbGrd);
            vec3 cbHash = hash33(cbCid + vec3(31.0));
            float cbSparse = step(1.0 - 0.15 * uGlintDensity, cbHash.x);     // rare diamond-bearing cells
            float cbSpot = 1.0 - smoothstep(0.0, 0.18, cbFF.x);              // speck hugs the cell center
            vec3 cbN = normalize(shadeN + 0.45 * (cbHash - 0.5));            // per-cell hashed micro-facet
            float cbGlint = pow(max(dot(cbN, cbHv), 0.0), 60.0);
            emissive += vec3(0.92, 0.96, 1.0) * 2.5 * cbGlint * cbSparse * cbSpot
                        * carbCrest * step(0.0001, diff)
                        * uCarbonStrength * provinceWeight(PROV_CARBON);
          }
          if (carbTar > 0.0){
            float cbSheen = pow(max(dot(shadeN, cbHv), 0.0), 8.0);
            emissive += vec3(0.32, 0.30, 0.26) * 0.12 * cbSheen * carbTar * step(0.0001, diff);
          }
        }
        // ★ F43 crystal facet sparks — per-facet specular glints riding the SAME post-
        // posterize emissive bypass family as the F42 glints (card section 6 item 3: a
        // crystal spark dithered into a soft blob is no spark). DISTINCT vocabulary from
        // F42: F42 sparks ride crest∩cell (diamond on uplifted carbon crests); F43 sparks
        // ride FACET ALIGNMENT — the facet's own tilted micro-normal (a per-cell hashed
        // tilt off shadeN, the same per-cell tilt the combiner banked into the relief)
        // aligning with the half-vector H, so as yaw sweeps the field, sparks flip on and
        // off facet-by-facet (the euhedral-face brightness-flip read, card UAT item 3).
        // Gated by fctMask (only on GROWN facets) × a sparse per-cell hash (rare bright
        // faces, not a speckle texture) × step(0.0001, diff) (dark side stays dark). A
        // reflection, NOT thermal emission (a crystal world at T_eq 150 is not incandescent).
        // Spec-safety: pow base is max(dot,0) clamped, exponent constant; no divisions.
        // uFacetStrength 0 (enable off via the writer, or every preset off the crystal class)
        // skips the block: byte-identical pre-F43 emissive — the F43 regression contract.
        if (uFacetStrength > 0.0 && fctMask > 0.0){
          vec3 fctHv = normalize(uLightDir + V);
          vec3 fctCid; vec3 fctCgrd;
          vec2 fctSF = voronoi3d(vPos * uFacetScale + uMacroOffset + vec3(41.3, -27.6, 9.4),
                                 uVoroCells, fctCid, fctCgrd);
          vec3 fctSh = hash33(fctCid);                                  // SAME cell hash as the combiner
          float fctSparse = step(0.62, hash33(fctCid + vec3(88.0)).y);  // rare bright faces
          float fctSpot = 1.0 - smoothstep(0.0, 0.30, fctSF.x);         // spark hugs the facet-face center (crisp, not whole-cell)
          vec3  fctN = normalize(shadeN + 0.55 * (fctSh - 0.5));        // the facet's tilted micro-normal
          float fctSpark = pow(max(dot(fctN, fctHv), 0.0), 80.0);       // tight per-facet lobe
          emissive += vec3(0.85, 0.92, 1.0) * 2.2 * fctSpark * fctSparse * fctSpot
                      * fctMask * step(0.0001, diff)
                      * uFacetStrength * provinceWeight(PROV_FACETS);
        }

        // ★ Sunglint (F36) — the mirror image of the star on standing liquid, LIQUID-ONLY.
        // Promoted from the Blinn-Phong stand-in (which glinted on the whole surface,
        // land included): the lobe now multiplies by the SAME Stage-4 liquidMask the
        // F14 sea cut / water coloring already use (the reserved Fluvial-to-Optical
        // contract), so adjacent land/ice stays matte and any no-sea preset (airless,
        // gas h2-he envelope, hot Venus: uSeaLevel -1 keeps liquidMask 0) renders NO
        // glint. shadeN inside the mask is the flattened (geometric) sea normal — the
        // F14 cut already relaxed grad to 0 there, so the lobe reads as one coherent
        // specular point pinned to the half-vector geometry, not relief sparkle.
        // Species + Cox-Munk arrive pre-derived (uGlintTint / uGlintExp / uSpecStrength:
        // water cold-white exp ~200, methane warm dim exp ~120; roughness broadens AND
        // dims at the per-frame writer). pow() base keeps the clamped max(dot, 0)
        // pattern and the exponent is floored — never spec-undefined. Glitter breakup
        // (card section 4 step 3): ONE high-frequency noised() sample from vPos (slow
        // uTime domain drift = shimmer, deterministic, no accumulation) resolves the
        // far-distance point into discrete specks at close LOD; the mask fades in on
        // uLodRamp (0 at d20 = clean single point) and the x2.2 gain compensates the
        // sparse-speck duty cycle so integrated energy stays comparable across the
        // fade. The strength-and-mask guard skips the whole block when the glint
        // cannot fire: enable off (writer zeroes uSpecStrength), no-sea presets, or
        // land fragments all yield specC = vec3(0) EXACTLY — the F36 regression
        // contract (the default LOOK changes by design: the stand-in's land sheen is
        // retired, logged as the card section 6.5 taste fork).
        vec3 specC = vec3(0.0);
        if (uSpecStrength > 0.0 && liquidMask > 0.0){
          vec3 H = normalize(uLightDir + V);
          float spec = pow(max(dot(shadeN, H), 0.0), max(uGlintExp, 1.0)) * uSpecStrength * step(0.0001, diff);
          spec *= liquidMask * provinceWeight(PROV_GLINT);
          float gn = noised(vPos * 60.0 + vec3(uTime * 0.35)).x;
          float specks = smoothstep(0.05, 0.35, gn) * 2.2;
          spec *= mix(1.0, specks, smoothstep(0.5, 1.0, uLodRamp));
          specC = uGlintTint * spec;
          specC = (uSpecBypass == 1) ? specC : posterize(specC, uLevels, fc, 0.4, uDitherMode);
        }

        // ★ Aurorae (F37) — driver-true night-side magnetic ovals, promoted from the
        // fixed-constant stand-in (lat 0.7 / width 0.12 / hard-coded green). The whole
        // production applyAurora() structure (Planet.js) ports in: a gaussian ring in
        // MAGNETIC latitude (mlat = dot(N, uMagAxis) — the ~11-deg dipole tilt makes
        // the oval visibly off-axis from the spin pole, the cheapest realism
        // multiplier per card section 4), a 2-octave anisotropic curtain (striations
        // HIGH-frequency along azimuth, LOW along latitude — the load-bearing curtain
        // cue), and a second slower noised() term as flicker (shimmer over a STEADY
        // oval — the card section 6 animation contract). nightMask + the additive
        // emissive-bypass compositing stay exactly where the stand-in sat (pure
        // luminance glow, never posterized — Option C). Spec-safety: the gaussian is
        // exp(-t*t) (no pow(neg)); azimuth needs NO atan at all — the unit in-plane
        // direction mDir (N projected off the dipole axis, normalized with a floored
        // denominator) feeds the noise domain directly, so the domain is continuous
        // everywhere (no -pi/pi seam) and merely spins fast near the magnetic pole,
        // where azStable fades the striation contrast to flat glow (the ring gaussian
        // still leaks ~exp(-2) at the pole, so the degenerate region IS visible and
        // must degrade gracefully). The uAuroraIntensity > 0.0 guard skips the whole
        // block: enable off (the per-frame writer zeroes it), the field <= 0.05 hard
        // gate, airless worlds, and the Venus regime-3 override all yield
        // auroraC = vec3(0) EXACTLY — the F37 regression contract.
        vec3 auroraC = vec3(0.0);
        if (uAuroraIntensity > 0.0){
          float mlat = dot(N, uMagAxis);                       // -1..1 magnetic latitude
          float t = (abs(mlat) - uAuroraRingLat) / max(uAuroraRingWidth, 1e-3);
          float ringMask = exp(-t * t);
          // night mask — same -0.1..0.1 twilight band as the stand-in, but with the
          // edges in spec order (smoothstep with edge0 > edge1 is undefined GLSL).
          float nightMask = 1.0 - smoothstep(-0.1, 0.1, diff); // visible in darkness/twilight
          // magnetic-frame azimuth direction: tangent basis about uMagAxis. The cross
          // with +z is safe — uMagAxis keeps y ~cos(11 deg) ~0.98, never parallel to z.
          vec3 mE1 = normalize(cross(uMagAxis, vec3(0.0, 0.0, 1.0)));
          vec3 mE2 = cross(uMagAxis, mE1);
          vec2 mxz = vec2(dot(N, mE1), dot(N, mE2));
          float mr = length(mxz);
          vec2 mDir = mxz / max(mr, 1e-4);                     // unit azimuth dir (floored: no 0/0)
          float azStable = smoothstep(0.0, 0.1, mr);           // fade striations where azimuth degenerates
          // 2-octave curtain (the Planet.js applyAurora structure on the lab's
          // analytic noised()): azimuth freq 8/16 vs latitude freq 1.5/2.5 —
          // anisotropy is the striation. Time drifts the LATITUDE slot (curtains
          // rise); bounded/periodic-free accumulation is fine (weather-layer class).
          float curtain = noised(vec3(mDir * 8.0,  mlat * 1.5 + uTime * 0.12)).x * 0.5 + 0.5;
          curtain += (noised(vec3(mDir * 16.0, mlat * 2.5 + uTime * 0.2)).x * 0.5 + 0.5) * 0.25;
          float cb = max(curtain, 0.0) * 0.8;                  // normalize the 1.25 2-octave max
          float rays = mix(0.4, cb * cb, azStable);            // square via multiply (no pow); flat at the pole
          // slow flicker — a LOW-frequency azimuth domain on a slow clock multiplies
          // brightness 0.5..1.0: the rays shimmer while the oval geometry stays put.
          float flicker = clamp(0.75 + 0.25 * noised(vec3(mDir * 2.0, uTime * 0.05)).x, 0.0, 1.0);
          float aurora = ringMask * nightMask * rays * flicker * uAuroraIntensity
                       * provinceWeight(PROV_AURORA);
          // gain 0.8 (stand-in 0.6): the flicker mean 0.75 would otherwise dim the
          // default read below the stand-in's — 0.6/0.75 = 0.8 preserves mean energy.
          auroraC = uAuroraColor * aurora * 0.8;
        }

        // ★ Airglow (F38) — thin UNIFORM night-limb photochemical shell (P24 non-
        // magnetic half; aurora's sibling). NOT a polar oval (F37), NOT a broad
        // scattering halo (F34), NOT a hemisphere fill (F33): a thin DEFINED green
        // ring pinned exactly at the grazing-angle limb on the dark hemisphere, at
        // ALL latitudes. Two masks on the emissive-bypass channel (never posterized):
        //   • night mask — the LIVE aurora form 1.0 - smoothstep(-0.1,0.1,diff)
        //     (edge0 < edge1; the reversed card-prose form is spec-undefined GLSL).
        //   • limb mask — fresnel/grazing term grazing = 1 - |dot(N,V)| (~0 face-on,
        //     →1 at the silhouette), raised to K and passed through a SHARP smoothstep
        //     window (E0→E1 high on the grazing curve) so the band is a thin crisp ring
        //     with defined inner/outer edges — the stylization directive (tracker:127-130)
        //     to BEAT the 6-level envelope: a discrete band, not a smooth low-contrast
        //     fade (the fade is exactly what posterize+Bayer crushes). Color is the hard
        //     airglow-green constant (OI 557.7 nm), uniform — NO composition lookup. The
        //     uAirglowIntensity > 0.0 guard skips the whole block: enable off (writer
        //     zeroes it) and airless worlds (atmoFactor 0) both yield airglowC = vec3(0)
        //     EXACTLY — the F38 regression contract.
        vec3 airglowC = vec3(0.0);
        if (uAirglowIntensity > 0.0){
          float nightMask = 1.0 - smoothstep(-0.1, 0.1, diff);          // night/twilight gate (LIVE aurora form)
          float grazing   = 1.0 - abs(dot(N, V));                        // 0 face-on → 1 at the limb (geometric normal, like F34)
          float limb      = smoothstep(0.55, 0.78, pow(grazing, 2.0));   // SHARP window high on the grazing curve → thin DEFINED ring (K=2.0, E0=0.55, E1=0.78)
          airglowC = uAirglowColor * (limb * nightMask * uAirglowIntensity) * provinceWeight(PROV_AIRGLOW);
        }

        // ★ Cloud optics (F39) — antisolar BACKSCATTER GLORY: discrete colored concentric
        // rings on the LIT cloud deck, centered where the camera looks back along the sun
        // line (dot(V, uLightDir) → 1 at the antisolar point). The exact OPPOSITE gate of
        // airglow: a LIT-cloud-top effect (dayside), not a night-limb shell. Three
        // deliberate stylizations vs the real sub-degree spectral glory (card §1):
        //   • the ring radius uGloryRadius is inflated far past the real angle so the bands
        //     read at planet distance;
        //   • the palette is a flat constant warm-outer→cool-inner (red → green → violet),
        //     NO composition lookup (mirrors airglow's flat green);
        //   • 2–3 HARD posterized colour steps (floor-quantized theta/uGloryRadius) — leans
        //     INTO discreteness so the bands survive the 6-level envelope as INTENTIONAL
        //     steps. Emissive-bypass channel ⇒ never double-quantized by Bayer.
        // Reuses the live V (view-to-camera, L3302), diff (max(dot(shadeN,uLightDir),0), L3298)
        // and uLightDir — no redeclaration. The uCloudOpticsIntensity > 0.0 && uCloudCoverage
        // > 0.0 guard skips the whole block: enable off (writer zeroes intensity) and any
        // cloudless world (master gate 0) both yield cloudOpticsC = vec3(0) EXACTLY — the
        // F39 regression contract.
        vec3 cloudOpticsC = vec3(0.0);
        if (uCloudOpticsIntensity > 0.0 && uCloudCoverage > 0.0){
          float theta = acos(clamp(dot(V, uLightDir), -1.0, 1.0));     // 0 at antisolar point, grows outward
          float lit   = smoothstep(0.0, 0.1, diff);                    // dayside gate (OPPOSITE of airglow's night mask)
          float radius = max(uGloryRadius, 1e-3);                      // floor the denominator — no 0/0
          float ringMask = step(theta, radius);                       // 1 inside the ring stack, 0 beyond uGloryRadius
          float band = floor(clamp(theta / radius, 0.0, 0.999) * 3.0); // 3 HARD steps: 0 (inner) / 1 (mid) / 2 (outer)
          // flat constant palette, warm-outer → cool-inner (NO composition lookup)
          vec3 gloryInner = vec3(0.35, 0.45, 1.00);   // blue-violet inner
          vec3 gloryMid   = vec3(0.35, 1.00, 0.45);   // green mid
          vec3 gloryOuter = vec3(1.00, 0.45, 0.35);   // reddish outer
          vec3 gloryCol = band < 0.5 ? gloryInner : (band < 1.5 ? gloryMid : gloryOuter);
          cloudOpticsC = gloryCol * (ringMask * lit * uCloudOpticsIntensity) * provinceWeight(PROV_CLOUDOPTICS);
        }

        gl_FragColor = vec4(min(surface + emissive + specC + limbC + termC + cloudC + auroraC + airglowC + cloudOpticsC + bioC + machC + cityC + ecuC, vec3(1.0)), 1.0);
      }
`;

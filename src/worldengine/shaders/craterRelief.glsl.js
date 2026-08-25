// src/worldengine/shaders/craterRelief.glsl.js — the impact record, ported from the world-engine lab.
//
// Rung 4's first landform. Transcribed from planet-lod-height.glsl.js (F2 craters + F3 ejecta apron),
// which is itself pinned against a CPU oracle in planet-lod-lab-core.js. `craterProfile` and
// `ejectaProfile` are byte-faithful to that source and are held so by
// tests/crater-relief-transcription.test.js — they carry the analytic dh/dr that the whole
// relief-normal path depends on, so they are the two functions that must NOT drift.
//
// ── THREE DELIBERATE DIVERGENCES FROM THE LAB. Each is measured, and each is recorded in
//    docs/FEATURES/surface-variation-beyond-mvp.md under "RUNG 4, CRATERS — MEASURED BEFORE WRITING".
//
// 1. ONE COMBINER, NOT TWO. The lab's craterCombiner and ejectaCombiner each run their own
//    voronoi3d over the SAME domain with the SAME cells, the SAME per-cell hash, the SAME host gate
//    and the SAME hashed radius — the lab pays for that twice because its two features are
//    independently GUI-gated. Merging them is EXACT, not an approximation: every input to the second
//    call is bit-identical to the first. It halves the cellular cost, which at uVoroCells = 27 is
//    27 hash33 evaluations, the dominant term in the whole crater pass.
//
// 2. PROVINCE GATING — WAS STUBBED, LIVE SINCE 2026-08-25 (Max: game adopts the lab's version).
//    The paragraph below describes the STUB and is kept because it explains why the call survived
//    the stubbed years. What replaced it is the CRATER SLICE of the lab's law, not the whole
//    machinery — see the block at `const int PROV_CRATERS`. Historic text follows.
//    The lab's provinceWeight ends
//    `mix(1.0, fl + (1.0 - fl) * f, uProvinceWeight)`, so at uProvinceWeight = 0 it returns EXACTLY
//    1.0 for every feature id. The game pins provinces neutral until rung 5, so the whole ~4.8 KB /
//    ~50-constant province machinery reduces to that constant. The CALL is kept rather than deleted
//    so rung 5 is a drop-in replacement of one function body.
//
// 3. THE DOMAIN IS THE UNIT SPHERE, not object space. uCraterScale is R_km / D_char — crater
//    diameters per planet RADIUS — so the law is angular and wants a unit direction. That also makes
//    the gradient this returns a true dimensionless slope dh/ds (h in planet radii, s in radians),
//    which is why the caller must NOT push it through perturbNormalAnalytic's divide-by-base-
//    frequency: uCraterAmp * uCraterScale == 1 exactly, so the crater slope is body-independent
//    while fbmd's is not. Mixing them before that divide rescales craters by noiseScale, which spans
//    ~100x across this game's bodies.

export const CRATER_RELIEF_UNIFORMS_GLSL = /* glsl */ `
uniform int   uVoroCells;         // 27 = full 3x3x3 (seam-free); 9 = centre slab (lossy, mobile)
uniform float uCraterDensity;     // 0..1 fraction of cells that host a crater; <=0 EARLY-OUTS the pass
uniform float uCraterComplexD;    // simple->complex transition diameter, in CELL units
uniform float uCraterRelaxation;  // 0..1 viscous/palimpsest flattening
uniform float uTerraceCount;      // inner-wall terrace ring count
uniform float uCraterScale;       // crater cells per planet radius (R_km / D_char)
uniform float uCraterAmp;         // crater relief amplitude, in planet radii (= D_char / R_km)
uniform vec3  uCraterOffset;      // per-body domain offset, so two worlds do not share a crater field
uniform float uEjectaStrength;    // apron gate; <=0 skips the apron, craters unchanged
uniform float uEjectaRampart;     // 0 = dry 1/r^2 skirt <-> 1 = fluidized lobate terminal ridge
uniform float uEjectaAmp;         // apron amplitude, in planet radii
uniform float uEjectaLump;        // 0..1 FBM lumpiness of the apron
uniform float uProvinceWeight;    // global province-influence dial; 0 restores the pre-2026-08-25 neutral look
`;

export const CRATER_RELIEF_GLSL = /* glsl */ `
// ── hash33 + voronoi3d — the cellular keystone. Transcribed from planet-lod-height.glsl.js. ──
// 3D-domain cellular noise sampled on the direction vector: inherently seam-free on the sphere (no
// UV seam, no pole pinch), which is the reason to pay for 27 cells. hash33 returns [0,1)^3 cell
// jitter and is DISTINCT from hash3 in heightNoise.glsl.js, which is signed.
vec3 hash33(vec3 p){
  p = vec3( dot(p, vec3(127.1, 311.7,  74.7)),
            dot(p, vec3(269.5, 183.3, 246.1)),
            dot(p, vec3(113.5, 271.9, 124.6)) );
  return fract(sin(p) * 43758.5453123);
}
// returns vec2(F1, F2); cellId + grad(=dF1/dp, the relief-normal term) via out.
vec2 voronoi3d(vec3 p, int cells, out vec3 cellId, out vec3 grad){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float f1 = 1e9, f2 = 1e9;
  vec3 nCell = ip, nR = vec3(0.0);
  for (int gz=-1; gz<=1; gz++){
    if (cells < 27 && gz != 0) continue;     // 9-cell: centre slab only
    for (int gy=-1; gy<=1; gy++){
      for (int gx=-1; gx<=1; gx++){
        vec3 g = vec3(float(gx), float(gy), float(gz));
        vec3 c = g + hash33(ip + g);          // jittered centre, rel to ip cell
        vec3 r = c - fp;                       // fragment -> centre
        float d = length(r);
        if (d < f1){ f2 = f1; f1 = d; nCell = ip + g; nR = r; }
        else if (d < f2){ f2 = d; }
      }
    }
  }
  cellId = nCell;
  grad = (f1 > 1e-6) ? (-nR / f1) : vec3(0.0); // = normalize(p - centre)
  return vec2(f1, f2);
}

// ── Province gating — LIVE as of 2026-08-25. Max: "game adopts lab's version." ─────────────────
//
// ⭐ THIS IS THE CRATER SLICE OF THE LAB'S LAW, NOT A REDUCTION OF IT. The header above priced this
// at "~4.8 KB / ~50-constant province machinery"; that is the cost of porting ALL of it. This path
// calls 'provinceWeight' with 'PROV_CRATERS' and nothing else (the single call site below), and the
// crater branch — height.glsl.js:853 'else if (fid == PROV_CRATERS) { f = 1.0 - gProvince.x; fl = 0.25; }'
// — reads ONLY 'gProvince.x'. That channel is a pure function of the a1/a2 octave pair
// (height.glsl.js:845-846); the other four octaves feed '.y' and '.z', which nothing here reads.
// So two 'noised()' samples reproduce the lab EXACTLY on this path. It is an exact port of the
// reachable subset, not an approximation of the whole.
//
// ⚠ 'noised()' IS ALREADY ON THIS PATH and is held byte-identical to the lab's — Planet.js:279
// splices in 'HEIGHT_NOISE_GLSL'. 'uMacroOffset' and 'uDispDomainScale' are likewise already
// declared there. The only genuinely new uniform is 'uProvinceWeight', added above.
//
// ⛔ THE CALL SITE IS UNCHANGED, which is what the original stub's note asked for: this really was a
// drop-in replacement of one function body plus a per-fragment init, exactly as it predicted.
const int PROV_CRATERS = 1;   // matches height.glsl.js:787 — was 0 while the body was a stub
vec3 gProvince = vec3(0.5);   // .x only is meaningful here; .y/.z stay at the lab's rest value
void initProvinces(vec3 pos){
  pos *= uDispDomainScale;    // height.glsl.js:836 — province scale tracks the display scale
  vec4 a1 = noised(pos * 0.75 + uMacroOffset + vec3(17.3, -9.1, 4.7));
  vec4 a2 = noised(pos * 1.5  + uMacroOffset + vec3(-3.2, 8.8, -12.6));
  gProvince.x = smoothstep(0.35, 0.65, 0.5 + 0.5 * (a1.x + 0.35 * a2.x) / 1.35);
}
float provinceWeight(int fid){
  float f = 1.0 - gProvince.x; float fl = 0.25;   // height.glsl.js:853, the PROV_CRATERS branch
  return mix(1.0, fl + (1.0 - fl) * f, uProvinceWeight);   // height.glsl.js:901, verbatim
}

// ── craterProfile — BYTE-FAITHFUL to the lab (vitest-pinned analytic dhdr). ──
// r = dist(fragment, centre) / craterRadius. Returns vec2(height, dh/dr).
vec2 craterProfile(float r, float morphology, float relaxation, float terraceCount){
  float h = 0.0, dhdr = 0.0;
  if (r < 1.0){
    h    += 0.2 * (r*r - 1.0);                        // parabolic cavity (depth/diam ~0.2)
    dhdr += 0.2 * 2.0 * r;
    float u = clamp(r/0.4, 0.0, 1.0);                 // central peak: s = 1 - smoothstep(0,0.4,r)
    float s = 1.0 - (u*u*(3.0-2.0*u));
    float dsdr = -(6.0*u*(1.0-u)) * (1.0/0.4);        // d/dr; auto-0 once clamped (u=1)
    h    += morphology * 0.14 * s;
    dhdr += morphology * 0.14 * dsdr;
    float tw = 0.02 * morphology;                     // terraces: cos rings on the inner wall
    float w  = 6.28318530718 * terraceCount;
    h    += tw * cos(w*r);
    dhdr += tw * (-w) * sin(w*r);
  }
  float rs = (r - 1.0)/0.18;                          // rim: gaussian peak at r~1
  float rg = exp(-(rs*rs));
  h    += 0.05 * rg;
  dhdr += 0.05 * rg * (-2.0*(r-1.0)/(0.18*0.18));
  float k = 1.0 - relaxation;                         // relaxation -> palimpsest
  return vec2(h*k, dhdr*k);
}

// ── ejectaProfile — BYTE-FAITHFUL to the lab. ──
// Apron lives in 1 < r < rOuter; craterProfile owns r <= 1. rampart blends the dry 1/r^2 skirt (0)
// against the fluidized lobate terminal ridge (1). Returns vec2(h, dh/dr).
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

// ── The merged crater + ejecta combiner (divergence 1 above). ──
// dir MUST be a unit vector (divergence 3). Accumulates the height delta in planet radii and its
// gradient, which in this domain is already a dimensionless SLOPE.
// uCraterDensity <= 0 early-outs, so a body with no crater record is byte-identical to no call.
void craterEjectaCombiner(vec3 dir, inout float h, inout vec3 slope){
  if (uCraterDensity <= 0.0) return;

  vec3 cellId, voroGrad;
  vec2 ff = voronoi3d(dir * uCraterScale + uCraterOffset, uVoroCells, cellId, voroGrad);
  vec3 ch = hash33(cellId);                        // per-cell hash: host gate + radius
  float host = step(1.0 - uCraterDensity, ch.x);   // uCraterDensity fraction of cells crater
  float craterRadius = mix(0.18, 0.55, ch.y);      // hashed size (cell units)
  float diameter = 2.0 * craterRadius;
  // morphology 0 = simple bowl, 1 = complex (central peak + wall terraces). The game feeds the real
  // gravity-set transition diameter here, so its ~0.1-radius craters come out complex — unlike the
  // lab, which pins this to force morphology == 0 because every crater it draws is sub-floor.
  float morphology = smoothstep(uCraterComplexD*0.6, uCraterComplexD, diameter);
  float r = ff.x / craterRadius;
  initProvinces(dir);                             // per-fragment province field (lab: initProvinces(pos))
  float pw = provinceWeight(PROV_CRATERS);         // craters keep to old terrain (anti-tectonic)

  // dr/d(dir), chain-ruled exactly. Shared by both profiles — the merge's whole point.
  vec3 drdp = (1.0/craterRadius) * voroGrad * uCraterScale;

  vec2 prof = craterProfile(r, morphology, uCraterRelaxation, uTerraceCount);
  float amp = uCraterAmp * host * pw;
  h     += amp * prof.x;
  slope += amp * prof.y * drdp;

  if (uEjectaStrength <= 0.0) return;

  // The apron rings the SAME crater — same centre, same hashed radius, same host gate. The radial
  // apron is modulated by an FBM lumpiness times a discontinuous-patch mask (continuous near the
  // rim, breaking into patches outward) so it reads as broken ejecta rather than a smooth donut.
  // The radial slope is chain-ruled exactly; the patch mask's r-derivative is held locally constant
  // (the Musgrave convention this codebase already uses for octave weights).
  vec2 eprof = ejectaProfile(r, uEjectaRampart, 2.5);
  vec4 ln = noised(dir * (uCraterScale * 2.7) + uCraterOffset);   // .x value, .yzw gradient
  float fbm = 0.5 + 0.5 * ln.x;                                    // 0..1
  float patchMask = mix(1.0, smoothstep(0.35, 0.85, fbm), smoothstep(1.2, 2.2, r));
  float lump = mix(1.0, fbm, uEjectaLump);
  float m = host * lump * patchMask;
  float eamp = uEjectaStrength * uEjectaAmp * pw;
  h += eamp * m * eprof.x;
  vec3 dfbm = 0.5 * ln.yzw * (uCraterScale * 2.7);                 // d(fbm)/d(dir) from noised()
  vec3 dmdp = host * patchMask * uEjectaLump * dfbm;
  slope += eamp * (m * eprof.y * drdp + eprof.x * dmdp);
}
`;

// planet-lod-river-amplifier.glsl.js — SHARED Dendry-style river sub-tributary AMPLIFIER.
//
// Instance #1 of the future progressive feature-LOD system, RIVERS ONLY (spec:
// docs/superpowers/specs/2026-06-19-river-lod-design.md §4.1). This module is the
// make-or-break primitive de-risked in isolation BEFORE any production edit
// (spec §7 build-sequence step 1 + the isolated-test-harness rule).
//
// WHAT IT IS. "Distance to a dendritic tree constructed on-the-fly only in a tiny
// neighborhood of the query point" — Dendry's f(p)=d(p,T) (Gaillard19 eq.1),
// RE-TARGETED so children grow OFF the baked trunks instead of building a fresh
// independent network. The baked carve cube (R=valley depth, G=mouth/apron,
// B=Strahler order) IS the Dendry control function, used MORE strongly than the
// paper: it also supplies the level-0 PARENT GEOMETRY (the reconstructed trunk
// segment), which is the mechanism that forces convergence-into-real-trunks.
//
// HEADLESS REALITY. This file is authored so the JS reference port (RiverAmplifierJS
// below) is the AUTHORITATIVE numerical reference the unit tests exercise; the GLSL
// string (RIVER_AMPLIFIER_GLSL) is a faithful transcription of the SAME math, sharing
// the SAME scalar constants (AMP) so the two cannot drift. Tests prove the MATH
// (determinism / downhill / trunk-convergence / spacing / width). The GPU later
// proves RENDERING — that is a separate manual gate (chrome-devtools :9223) AFTER this.
//
// DETERMINISM. Pure position-seeded hashing (Dendry §4.1 reproducibility guarantee).
// Each cell's key-point is a deterministic function of (integer cell coords, level,
// uRiverSeed) ONLY — NOTHING reads cameraPosition, frame number, or query order.
// lodRamp scales STRENGTH and generation-count K and AA width; it never changes WHICH
// key-points/segments exist for a given surface point. Cross-level nesting uses the
// point-sharing rule q_{k+1}(2i,2j)=q_k(i,j) so finer grids reuse coarser key-points
// exactly (paper Fig.7). Result: same surface point → same (sdf, flowDir) on every
// re-approach → no popping, no shimmer.

// ───────────────────────── shared scalar constants (single source) ─────────────────────────
// JS and GLSL both read these so a tuning change can't desync the two transcriptions.
export const AMP = Object.freeze({
  MAXGEN: 4,            // finest generations admitted (K runs 0..MAXGEN-1); spec "K≈3-4 finest levels"
  EPS: 0.12,            // key-point jitter band [EPS,1-EPS] (Dendry GeneratePoint); →0.5 regular, →0 random
  BASE_SPACING: 0.25,   // level-0 cell size in tangent-plane units, before order scaling
  DISP: 0.06,           // bend offset Δ as a fraction of segment length (spec Δ≤0.08; smoothing §4.2)
  // per-level minimum slope floor (Dendry GenerateSubSegments {0.09,0.18,0.38,1.0});
  // index k=0..MAXGEN-1. zChild = max(zConn + MINSLOPE[k]*dist, controlElev).
  MINSLOPE: [0.09, 0.18, 0.38, 1.0],
  MAX_ORDER: 6.0,       // baked Strahler max (router maxOrder; planet-lod-rivers.js)
  TRUNK_EPS: 0.02,      // carve.r gate: amplifier emits ZERO unless depth > this in the neighborhood
  // width law (Dunne–Leopold; planet-lod-rivers.js:25) — child accum proxy keeps children < parent
  WIDTH_PHI: 0.42, WIDTH_EXP: 0.69,
  AA: 0.004,            // analytic anti-alias half-width on the SDF zero-crossing
  ORDER_GATE_LO: 0.3,   // K scales with clamp(order/MAX_ORDER, ORDER_GATE_LO, 1)
});

// ───────────────────────── GLSL primitive (faithful transcription of the JS port) ─────────────
// Interpolates the AMP constants so the GLSL literally shares the JS numbers. The function
// signature is shaped to drop into sampleCarve (planet-lod-lab.html:209-221): it takes the
// object-space surface dir, a local tangent-plane (uv) coordinate, the control fields decoded
// from the carve cube, and the lodRamp gate; returns vec2(signedDist, incisionWeight) and writes
// the local flow direction (tangent-plane) for carveGrad bending.
// GLSL3 (WebGL2) deterministic hash — integer bit-mix (wang-style) on packed cell coords; avoids
// sin() precision drift across GPUs. This is the AUTHORITATIVE hash the JS port (ampHash) mirrors,
// so the headless tests and the GLSL3 harness agree bit-for-bit.
const AMP_HASH_GLSL3 = /* glsl */ `
  float ampHash(ivec2 cell, int lvl, float seed){
    uint h = uint(cell.x) * 541u + uint(cell.y) * 79u + uint(lvl) * 0x9e3779b9u + uint(seed);
    h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16;
    return float(h) / 4294967296.0;
  }`;

// GLSL1 (WebGL1) FALLBACK hash — sin-fract, used ONLY when the amplifier is inlined into a GLSL1
// shader (production sampleCarve, planet-lod-lab.html, is GLSL1: textureCube + no glslVersion:GLSL3).
// IMPORTANT: this is NOT bit-identical to ampHash/AMP_HASH_GLSL3 — sin-fract and the uint bit-mix
// produce different jitter. Determinism (no flicker) still holds: it is a pure function of the same
// (cell, lvl, seed). The headless tests lock the GLSL3/JS path; the GLSL1 path is proven by the
// chrome-devtools GPU gate only. If exact GLSL1↔JS parity is ever required, port the uint bit-mix
// using highp float emulation instead of this sin-fract.
const AMP_HASH_GLSL1 = /* glsl */ `
  float ampHash(ivec2 cell, int lvl, float seed){
    float n = float(cell.x) * 127.1 + float(cell.y) * 311.7 + float(lvl) * 74.7 + seed * 0.013;
    return fract(sin(n) * 43758.5453123);
  }`;

// minSlopes lookup body. GLSL3 supports the float[](...) array constructor; GLSL1 does NOT, so it
// gets sequential assignment into a fixed-size array. Both are k-indexed (NOT a constant) so finer
// generations k=1,2,3 use the steeper {0.18,0.38,1.0}, mirroring AMP.MINSLOPE[k] in the JS port.
const MINSLOPES_INIT_GLSL3 = `float minSlopes[${AMP.MAXGEN}] = float[](${AMP.MINSLOPE.map((s) => s.toFixed(2)).join(', ')});`;
const MINSLOPES_INIT_GLSL1 = `float minSlopes[${AMP.MAXGEN}];\n    ${AMP.MINSLOPE.map((s, i) => `minSlopes[${i}] = ${s.toFixed(2)};`).join('\n    ')}`;

// Shared amplifier body, parameterized by the variant-specific hash + minSlopes initializer so the
// GLSL3 and GLSL1 strings are the SAME math (cannot drift). hashSrc/slopeInit are injected.
const ampBody = (hashSrc, slopeInit) => /* glsl */ `
  // ---- deterministic position-seeded hash (Dendry seed = 541*i+79*j + level_salt + seed) ----
${hashSrc}
  vec2 ampKeyPoint(ivec2 cell, int lvl, float seed){           // qk(i,j) jittered in [EPS,1-EPS]
    float jx = mix(${AMP.EPS.toFixed(4)}, ${(1 - AMP.EPS).toFixed(4)}, ampHash(cell, lvl, seed));
    float jy = mix(${AMP.EPS.toFixed(4)}, ${(1 - AMP.EPS).toFixed(4)}, ampHash(cell, lvl, seed + 11.0));
    return (vec2(cell) + vec2(jx, jy));                         // cell-space; caller multiplies by cellSize
  }
  float ampDistSeg(vec2 p, vec2 a, vec2 b){                     // clamped projection SDF (math2d distToLineSegment)
    vec2 ab = b - a; float u = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0.0, 1.0);
    return length(p - (a + u * ab));
  }
  // Strahler-driven level-0 cell size: high-order trunks subdivide FINER (smaller cell).
  float ampBaseSpacing(float orderN){
    return ${AMP.BASE_SPACING.toFixed(4)} / max(0.35, orderN);  // 6th-order finer than 2nd
  }
  // synthesized child accum proxy → ALWAYS < parent so child is narrower (width-law consistency).
  float ampWidthKm(float orderN, int gen){
    float accum = max(0.02, orderN) / pow(2.0, float(gen) + 1.0);   // halves per generation
    return ${AMP.WIDTH_PHI.toFixed(4)} * pow(accum, ${AMP.WIDTH_EXP.toFixed(4)});
  }

  // The amplifier. uvT = tangent-plane coords of the query; trunkA/trunkB = reconstructed baked
  // trunk segment (level-0 parent) from the control function; trunkZa/trunkZb = its elevations;
  // orderN = normalized Strahler (carve.b); depth = carve.r (the GATE); lod in [0,1]; pxPerKmInv
  // = half-pixel floor scale. Returns vec2(signedDist, incision); writes flowDir (tangent-plane).
  vec2 riverAmplifier(vec2 uvT, vec2 trunkA, vec2 trunkB, float trunkZa, float trunkZb,
                      float orderN, float depth, float lod, float pxPerKmInv, float widthScale,
                      float seed, out vec2 flowDir){
    flowDir = normalize(trunkB - trunkA + vec2(1e-6, 0.0));
    if (lod <= 0.0 || depth < ${AMP.TRUNK_EPS.toFixed(4)}) return vec2(1e9, 0.0);  // early-out: far OR no trunk

    int K = int(floor(mix(1.0, ${AMP.MAXGEN.toFixed(1)}, lod)
                      * clamp(orderN, ${AMP.ORDER_GATE_LO.toFixed(2)}, 1.0)));
    float cellSize = ampBaseSpacing(orderN);
    vec2 paA = trunkA, paB = trunkB; float paZa = trunkZa, paZb = trunkZb;
    float bestSDF = 1e9; float bestZ = 1e9; int bestGen = 0; vec2 bestFlow = flowDir;
    // per-level minimum slope floor (Dendry GenerateSubSegments) — MUST be k-indexed, NOT constant,
    // so finer generations (k=1,2,3) use the steeper {0.18,0.38,1.0}, mirroring AMP.MINSLOPE[k] in JS.
    ${slopeInit}

    for (int k = 0; k < ${AMP.MAXGEN}; ++k){
      if (k >= K) break;
      ivec2 base = ivec2(floor(uvT / cellSize));
      // track the child whose key-point is nearest the query, to DESCEND as next level's parent
      // (this is what makes finer generations nest INSIDE coarser detail; mirrors the JS port).
      float nearD = 1e9; vec2 nA = paA, nB = paB; float nZa = paZa, nZb = paZb;
      for (int dy = -2; dy <= 2; ++dy)
      for (int dx = -2; dx <= 2; ++dx){                          // 5x5 Moore neighborhood (paper N>=5)
        ivec2 cell = base + ivec2(dx, dy);
        // point-sharing: finer levels reuse the coarse key-point at the SAME world cell corner.
        vec2 q = ampKeyPoint(cell, k, seed) * cellSize;
        // connect q to nearest of {a, b, mid} of the PARENT segment (ConnectPointToSegmentRivers)
        vec2 mid = 0.5 * (paA + paB);
        vec2 conn = mid; float dC = distance(q, mid); float zConn = 0.5 * (paZa + paZb);
        if (distance(q, paA) < dC){ conn = paA; dC = distance(q, paA); zConn = paZa; }
        if (distance(q, paB) < dC){ conn = paB; dC = distance(q, paB); zConn = paZb; }
        // DOWNHILL: child key-point elevation forced strictly above its connection (Dendry GenerateSubSegments).
        // zChild = max(zConn + MINSLOPE[k]*dist, controlElev(q)). controlElev = terrain height at q;
        // in the harness this is the linear elevation along the ORIGINAL baked trunk axis at q's foot
        // (mirrors controlElev(qx,qy,trunk) in the JS port — note: the ORIGINAL trunk, not the
        // descended parent paA/paB). In production this reads the baked height sampler at q.
        float trunkLen2 = max(dot(trunkB - trunkA, trunkB - trunkA), 1e-9);
        float trunkU = clamp(dot(q - trunkA, trunkB - trunkA) / trunkLen2, 0.0, 1.0);
        float ctrlElev = trunkZa + (trunkZb - trunkZa) * trunkU;
        float zChild = max(zConn + minSlopes[k] * dC, ctrlElev);
        // bend child toward connection by Δ*len, then 2-seg spline (smoothing §4.2)
        vec2 dir = normalize(conn - q + vec2(1e-9, 0.0));
        vec2 perp = vec2(-dir.y, dir.x);
        float sgn = (ampHash(cell, k + 7, seed) < 0.5) ? -1.0 : 1.0;
        vec2 m1 = mix(q, conn, 0.5) + ${AMP.DISP.toFixed(4)} * dC * perp * sgn;
        float s = min(ampDistSeg(uvT, q, m1), ampDistSeg(uvT, m1, conn));
        if (s < bestSDF){ bestSDF = s; bestGen = k; bestFlow = dir; }
        float dq = distance(q, uvT);
        if (dq < nearD){ nearD = dq; nA = q; nB = conn; nZa = zChild; nZb = zConn; }
      }
      // descend: next level's parent = the child nearest the query
      paA = nA; paB = nB; paZa = nZa; paZb = nZb;
      cellSize *= 0.5;                                           // resolution doubles each level
    }
    float wKm = ampWidthKm(orderN, bestGen);
    // widthScale decouples the rendered channel radius from the km magnitude of the Dunne–Leopold
    // width law. ampWidthKm() outputs object-space KM (~0.1–0.26) which, used directly as a
    // tangent-plane-uv radius, floods the whole patch (channels as wide as the cells). widthScale
    // is a tunable RENDER-space factor; the width-LAW RATIO (child < parent) is preserved because
    // every generation's wKm is multiplied by the SAME widthScale.
    float radius = max(wKm * widthScale * 0.5, 0.5 * pxPerKmInv);  // half-pixel width floor
    float incision = smoothstep(radius + ${AMP.AA.toFixed(4)}, radius - ${AMP.AA.toFixed(4)}, bestSDF) * lod;
    flowDir = bestFlow;
    return vec2(bestSDF - radius, incision);                     // x = signed distance, y = incision weight
  }
`;

// ── Exported variants ──────────────────────────────────────────────────────────────────────────
// RIVER_AMPLIFIER_GLSL — GLSL ES 3.00 (WebGL2). The AUTHORITATIVE transcription the JS port mirrors;
//   used by the isolated harness (rivers-viewdependent-lab.html, glslVersion:THREE.GLSL3) and the
//   eventual GLSL3 promotion of the production shader.
// RIVER_AMPLIFIER_GLSL1 — GLSL ES 1.00 (WebGL1) fallback for inlining into the CURRENT GLSL1
//   sampleCarve (planet-lod-lab.html). Same math; sin-fract hash (see AMP_HASH_GLSL1 caveat).
// RIVER_AMPLIFIER_REQUIRES_GLSL3 — true: the default export is the GLSL3 variant; callers targeting
//   a GLSL1 shader MUST inline RIVER_AMPLIFIER_GLSL1 instead (do NOT inline both).
export const RIVER_AMPLIFIER_GLSL = ampBody(AMP_HASH_GLSL3, MINSLOPES_INIT_GLSL3);
export const RIVER_AMPLIFIER_GLSL1 = ampBody(AMP_HASH_GLSL1, MINSLOPES_INIT_GLSL1);
export const RIVER_AMPLIFIER_REQUIRES_GLSL3 = true;

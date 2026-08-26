// ── Analytic-derivative height noise — THE source of these three functions ────────────────
//
// hash3(), noised() and fbmd() live here and NOWHERE else. Both consumers import them:
//   • planet-lod-height.glsl.js (the lab / river-router 260 KB height GLSL) splices them back
//     into HEIGHT_GLSL at the two points they used to occupy.
//   • src/objects/Planet.js injects HEIGHT_NOISE_GLSL into the game's planet shader, which
//     needs these three and none of the other ~200 functions in that string.
//
// HISTORY, so the shape makes sense. Until 2026-07-30 this file held a VERBATIM COPY guarded by
// tests/height-noise-transcription.test.js, which re-extracted the functions from the lab file
// and asserted byte-identity. That copy existed for ONE reason: planet-lod-height.glsl.js was
// being rewritten concurrently on feature/world-engine-atmo-3b, so editing it would have
// manufactured a merge conflict. That lane merged (c854c09) and the file is no longer contested,
// so the copy and its drift-guard are gone and this is a plain shared module.
//
// WHY THE SPLIT IS TWO CONSTANTS AND NOT ONE. In HEIGHT_GLSL these functions are NOT contiguous:
// the voronoi3d keystone (with its own, differently-signed hash33) and emissiveBlackbody sit
// between noised and fbmd. Splicing one combined block would REORDER that file's declarations.
// Two constants splice back exactly where the originals were, which is what keeps the resolved
// HEIGHT_GLSL byte-identical to the pre-hoist string that six tests read.
//
// fbmd() returns vec4(height, gradient.xyz) — the gradient is ANALYTIC (chain-ruled through
// every octave), which is what lets the game drop the 3-sample finite-difference normal.

// The five uniforms fbmd() reads. The lab declares these in its own header; the game has to
// declare them itself because it injects only the function bodies.
//   uNoiseScale       per-planet base feature frequency (the game mirrors its own noiseScale)
//   uDispDomainScale  global domain multiplier; 1.0 = identity, which is what the game uses
//   uFwClamp          0 = octave clamp off · 1 = anti-shimmer bar (ships) · 2 = the 4 render px bar
//   uMacroOffset      seed offset for the big-feature octaves (0..2)
//   uDetailOffset     seed offset for the remaining octaves
export const HEIGHT_NOISE_UNIFORMS_GLSL = /* glsl */ `
uniform float uNoiseScale;
uniform float uDispDomainScale;
uniform int   uFwClamp;
uniform vec3  uMacroOffset;
uniform vec3  uDetailOffset;
`;

// ── hash3 + noised. IQ analytic-derivative gradient noise: value in .x, gradient in .yzw. ──
// https://iquilezles.org/articles/gradientnoise/
export const HASH3_NOISED_GLSL = /* glsl */ `vec3 hash3(vec3 p){
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
      }`;

// ── fbmd — variable-octave analytic FBM. Returns vec4(height, gradient.xyz). ──
// octaves = mix(4,9,lodRamp); fractional trailing-octave weight = pop-free ramp;
// fwidth clamp fades sub-pixel octaves to their mean (kills dither shimmer).
//
// ⭐⭐ uFwClamp IS TRI-STATE AS OF 2026-08-26, AND THE TWO NON-ZERO ARMS ARE DIFFERENT RULES.
// The clamp's anchor is read in CYCLES PER RENDER PIXEL, so 0.25 means "one cycle per 4 render px".
//
//   1  ANTI-SHIMMER (0.40, 0.80) = 2.50 -> 1.25 px per cycle. The historical, shipped value. It is
//      an ALIASING bar: it drops an octave only once that octave is past Nyquist and would crawl.
//      An octave at 3 px per cycle passes it at FULL weight.
//   2  LEGIBILITY   (0.125, 0.25) = 8.00 -> 4.00 px per cycle. The SAME 2x-wide ramp re-anchored on
//      the rule src/worldengine/port/craterUniforms.js already states for craters: a feature must
//      span at least 4 RENDER px to READ as one, "2x Nyquist, because a crater has to show bowl AND
//      rim to read as one, not merely be detected".
//
// ⛔ WHY THE GAP IS NOT COSMETIC. The two bars disagree by 2x, so 2.50..4.00 px per cycle was gated
// by NOTHING — kept at full weight while below the engine's own legibility bar. MEASURED at the
// game's framing, at the top of the macro-wavelength range, HALF the surface normal came from that
// band; from 12 down to 6 body radii it was ALL of it.
// ⚠ AND THE GRADIENT IS WHY THIS MATTERS MORE THAN THE HEIGHT WEIGHTS SUGGEST: grad accumulates
// amp*w*freq while amp halves and freq doubles, so amp*freq is CONSTANT — every surviving octave
// shades exactly as hard as octave 0 however small its height weight. A 1/256-amplitude octave is
// not a whisper in the lighting; it is an equal partner.
// ⛔ AND THE SCENE IS RENDERED NATIVELY SMALL, NOT SUPERSAMPLED DOWN (RetroRenderer's scene target
// is width/pixelScale with NearestFilter and antialias off), so a sub-pixel octave has nothing to
// average into. It does not become texture. It becomes crawl.
// ⛔ ALL FOUR fbm VARIANTS MUST TEST != 0, NOT == 1 — fbmdRidged/fbmdHetero/fbmdDamped in
// height.glsl.js share this uniform, and an == 1 guard turns their clamp OFF at arm 2, which would
// make mountains, plateaus and glacial ice shimmer and read as a false result for this A/B.
// Derivation + the live sweep: docs/FEATURES/macro-frequency-rootcause-2026-08-26.md.
export const FBMD_GLSL = /* glsl */ `vec4 fbmd(vec3 pos, float octaves, float fwBase){
        float freq = uNoiseScale * 0.3 * uDispDomainScale;     // matches computeHeight's largest feature scale
        float amp  = 0.5;
        float h = 0.0;
        vec3 grad = vec3(0.0);
        for (int i = 0; i < 12; i++){
          if (float(i) >= octaves) break;
          float w = clamp(octaves - float(i), 0.0, 1.0);    // trailing-octave fade
          if (uFwClamp != 0){
            float screenF = fwBase * freq;                  // per-octave screen freq, CYCLES PER RENDER PIXEL
            w *= 1.0 - smoothstep((uFwClamp == 2) ? 0.125 : 0.4, (uFwClamp == 2) ? 0.25 : 0.8, screenF);
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
      }`;

// What the game injects: all three, in dependency order. The lab does NOT use this — it splices
// the two constants above individually, at their original positions.
export const HEIGHT_NOISE_GLSL = HASH3_NOISED_GLSL + '\n\n' + FBMD_GLSL;

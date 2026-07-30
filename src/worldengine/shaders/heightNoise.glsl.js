// ── Analytic-derivative height noise, transcribed from the world-engine lab ──
//
// SOURCE OF TRUTH: planet-lod-height.glsl.js (repo root). The three functions below are a
// VERBATIM copy of hash3(), noised() and fbmd() from that file.
//
// Why a copy and not an import: the lab string exports one 239 KB GLSL blob and imports
// nothing, so pulling it in to reach 3 KB of noise would add ~76 KB gzip to the game bundle
// for a 60x waste. The structurally clean fix — hoisting these primitives into a module both
// sides import — requires EDITING planet-lod-height.glsl.js, which is being rewritten right
// now on feature/world-engine-atmo-3b (+320 lines). Editing it would manufacture a merge
// conflict for no gain, so the copy stands until that lane lands.
//
// The copy cannot drift silently: tests/height-noise-transcription.test.js re-extracts these
// same three functions from planet-lod-height.glsl.js by brace matching and asserts
// byte-identity. Edit the lab file and this repo's suite fails until the copy is re-synced.
//
// fbmd() returns vec4(height, gradient.xyz) — the gradient is ANALYTIC (chain-ruled through
// every octave), which is what lets the game drop the 3-sample finite-difference normal.

// The five uniforms fbmd() reads. The lab declares these in its own header; the game has to
// declare them itself because only the function bodies are transcribed.
//   uNoiseScale       per-planet base feature frequency (the game mirrors its own noiseScale)
//   uDispDomainScale  global domain multiplier; 1.0 = identity, which is what the game uses
//   uFwClamp          1 = fade sub-pixel octaves to their mean (anti-shimmer)
//   uMacroOffset      seed offset for the big-feature octaves (0..2)
//   uDetailOffset     seed offset for the remaining octaves
export const HEIGHT_NOISE_UNIFORMS_GLSL = /* glsl */ `
uniform float uNoiseScale;
uniform float uDispDomainScale;
uniform int   uFwClamp;
uniform vec3  uMacroOffset;
uniform vec3  uDetailOffset;
`;

// VERBATIM from planet-lod-height.glsl.js — do not hand-edit; re-run the transcription and
// keep the drift-guard green instead.
export const HEIGHT_NOISE_GLSL = /* glsl */ `
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

vec4 fbmd(vec3 pos, float octaves, float fwBase){
        float freq = uNoiseScale * 0.3 * uDispDomainScale;     // matches computeHeight's largest feature scale
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
`;

// The exact signatures the drift-guard extracts, exported so the test and this module can
// never disagree about what "these three functions" means.
export const HEIGHT_NOISE_SIGNATURES = [
  'vec3 hash3(vec3 p){',
  'vec4 noised(vec3 x){',
  'vec4 fbmd(vec3 pos, float octaves, float fwBase){',
];

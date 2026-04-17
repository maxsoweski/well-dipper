import * as THREE from 'three';
import { BAYER4, HASH22 } from '../rendering/shaders/common.glsl.js';

/**
 * MilkyWay — hybrid galaxy renderer: particles + glow plane + volumetric dust.
 *
 * Three visual layers:
 *   1. GLOW — flat analytical plane computing arm density (additive, renderOrder 0)
 *   2. PARTICLES — star-like dots from MilkyWayModel (additive, renderOrder 1)
 *   3. DUST — dark absorbing 3D particles (normal blending, renderOrder 2)
 *      True volumetric — actual points in 3D space, not a flat plane.
 *      Normal blending with near-black color darkens whatever's behind them.
 *
 * Coordinates: X/Z = galactic plane (kpc), Y = vertical (kpc).
 */
export class MilkyWay {
  constructor(particleData, options = {}) {
    const {
      brightness = 1.0,
      scale = 0.5,
      armData = null,
      glowBrightness = 0.3,
      dustData = null,
      dustOpacity = 0.3,
      dustScale = 1.0,
      radius = 15,
    } = options;

    this.data = particleData;
    this.mesh = new THREE.Group();
    this._glowMesh = null;
    this._dustPoints = null;

    // ── Star particles (additive, renderOrder 1) ──
    {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(particleData.positions, 3));
      geo.setAttribute('aColor', new THREE.Float32BufferAttribute(particleData.colors, 3));
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(particleData.sizes, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 }, uScale: { value: scale }, uBrightness: { value: brightness },
          uSpread: { value: 3.0 }, uNearFade: { value: 0.0 }, uDither: { value: 0.0 },
          uChoke: { value: 15.0 },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aColor;
          attribute float aSize;
          varying vec3 vColor;
          varying float vBright;
          varying float vDist;
          uniform float uTime, uScale, uNearFade, uChoke;
          void main() {
            vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            vDist = -mv.z;
            gl_PointSize = clamp(aSize * uScale * (400.0 / max(vDist, 0.1)), 1.0, 128.0);
            float h = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
            vBright = 0.8 + 0.2 * sin(uTime * (0.1 + h * 0.15) + h * 6.28);
            // Fade out particles closer than uNearFade kpc
            if (uNearFade > 0.0) {
              vBright *= smoothstep(0.0, uNearFade, vDist);
            }
            // Choke: fade out particles beyond uChoke kpc from galaxy center
            float galR = length(position.xz);
            vBright *= 1.0 - smoothstep(uChoke * 0.7, uChoke, galR);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vBright;
          varying float vDist;
          uniform float uBrightness, uSpread, uDither;

          // 4x4 Bayer matrix
          ${BAYER4}

          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = exp(-d * d * uSpread) * vBright * uBrightness;
            if (a < 0.005) discard;

            // Dither: threshold against Bayer pattern to break up smooth gradients
            if (uDither > 0.0) {
              float threshold = bayerDither(gl_FragCoord.xy) * uDither;
              if (a < threshold) discard;
              // Snap surviving pixels to full brightness for that retro stippled look
              a = max(a, threshold);
            }

            gl_FragColor = vec4(vColor * a, a);
          }
        `,
      });
      this._points = new THREE.Points(geo, mat);
      this._points.renderOrder = 1;
      this.mesh.add(this._points);
    }

    // ── Glow plane (additive, renderOrder 0) ──
    if (armData) {
      this._buildGlow(armData, glowBrightness, radius);
    }

    // ── Dust particles (normal blending, renderOrder 2) ──
    if (dustData) {
      this._buildDust(dustData, dustOpacity, dustScale);
    }
  }

  // ════════════════════════════════════════
  // GLOW — flat analytical arm density
  // ════════════════════════════════════════

  _buildGlow(armData, brightness, radius) {
    const offsets = new Float32Array(8), widths = new Float32Array(8), strengths = new Float32Array(8);
    const n = Math.min(armData.arms.length, 8);
    for (let i = 0; i < n; i++) {
      offsets[i] = armData.arms[i].offset;
      widths[i] = armData.arms[i].width;
      strengths[i] = armData.arms[i].densityBoost / 2.5;
    }

    const size = radius * 2.4;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uBrightness: { value: brightness }, uRadius: { value: radius },
        uDust: { value: 0.5 },
        uArmOffsets: { value: offsets }, uArmWidths: { value: widths },
        uArmStrengths: { value: strengths }, uNumArms: { value: n }, uPitchK: { value: armData.pitchK },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime, uBrightness, uRadius, uDust;
        uniform float uArmOffsets[8], uArmWidths[8], uArmStrengths[8];
        uniform int uNumArms;
        uniform float uPitchK;
        varying vec3 vWorldPos;

        ${HASH22}
        float noise(vec2 p) {
          vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
          float a=dot(hash22(i)-0.5,f), b=dot(hash22(i+vec2(1,0))-0.5,f-vec2(1,0));
          float c=dot(hash22(i+vec2(0,1))-0.5,f-vec2(0,1)), d=dot(hash22(i+vec2(1,1))-0.5,f-vec2(1,1));
          return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)+0.5;
        }
        float fbm(vec2 p) { float v=0.0,a=0.5; for(int i=0;i<4;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }

        float spiralArm(float R, float theta) {
          if(R<0.5) return 0.0;
          float sinP=sin(atan(1.0/uPitchK)), best=0.0;
          for(int i=0;i<8;i++){
            if(i>=uNumArms) break;
            float ex=uArmOffsets[i]+uPitchK*log(R/4.0);
            float dt=mod(theta-ex+3.14159,6.28318)-3.14159;
            best=max(best, exp(-0.5*pow(abs(dt)*R*sinP/uArmWidths[i],2.0))*uArmStrengths[i]);
          }
          return best;
        }

        // Dust lanes: narrow bands on the inner (trailing) edge of each arm.
        // Offset slightly from arm center, with wispy FBM texture.
        float dustLane(float R, float theta) {
          if (R < 3.0) return 0.0; // no dust near core
          float sinP = sin(atan(1.0/uPitchK));
          float best = 0.0;
          for (int i = 0; i < 8; i++) {
            if (i >= uNumArms) break;
            // Offset inward from arm center
            float ex = uArmOffsets[i] + uPitchK * log(R/4.0) - 0.08;
            float dt = mod(theta - ex + 3.14159, 6.28318) - 3.14159;
            float dist = abs(dt) * R * sinP;
            // Narrower than arm — dust is more concentrated
            float w = uArmWidths[i] * 0.35;
            float g = exp(-0.5 * pow(dist/w, 2.0));
            best = max(best, g * uArmStrengths[i]);
          }
          return best;
        }

        void main() {
          float wx=vWorldPos.x, wz=vWorldPos.z, R=length(vec2(wx,wz)), theta=atan(wz,wx);
          float fade=1.0-smoothstep(uRadius*0.7,uRadius,R);
          if(fade<0.01) discard;

          // Disk + bulge density (clamped to prevent blowup near center)
          float disk = exp(-R / 2.6);
          float Rsafe = max(R, 0.3);
          float bulge = 0.02 / (Rsafe * pow(Rsafe + 0.5, 3.0));
          bulge = min(bulge, 2.0);

          float arm = spiralArm(R, theta);
          // Gradual blend: pure smooth bulge at center, arm structure fades in
          // over a wide range (0–5 kpc) so there's no visible edge
          float armBlend = smoothstep(0.5, 5.0, R);
          float armMod = mix(1.0, 0.15 + arm * 2.0, armBlend);
          float density = (disk + bulge) * armMod;

          // Noise texture — angular coords near center to avoid collapse
          float noiseR = max(R, 0.5);
          vec2 np = vec2(wx, wz) / noiseR * 3.0 + vec2(wx, wz) * 0.3 + 42.0;
          vec2 q = vec2(fbm(np + uTime * 0.003), fbm(np + vec2(5.2, 1.3) + uTime * 0.002));
          float noiseTex = 0.5 + fbm(np + 2.0 * q) * 0.8;
          // Noise fades in gradually — core stays smooth over wide region
          float noiseBlend = smoothstep(1.0, 6.0, R);
          density *= mix(1.0, noiseTex, noiseBlend);
          density = pow(max(density, 0.0), 0.4);

          // ── Dust absorption ──
          // Compute dust lane strength, modulate with wispy noise
          float dust = dustLane(R, theta);
          // Wispy noise at different scale for filamentary texture
          float dustNoise = fbm(vec2(wx,wz) * 1.5 + 77.0);
          dust *= smoothstep(0.25, 0.6, dustNoise);
          // Dust absorbs: reduce glow brightness in dust regions
          float absorption = 1.0 - dust * uDust;
          absorption = max(absorption, 0.0);

          float alpha = density * fade * uBrightness * absorption;
          if(alpha<0.003) discard;

          // ── Color ──
          vec3 bulgeCol=vec3(1,.82,.5), armCol=vec3(.65,.78,1), interCol=vec3(.9,.82,.65);
          float bf=smoothstep(2.0,0.0,R);
          vec3 col=mix(mix(interCol,armCol,smoothstep(.2,.7,arm)),bulgeCol,bf);

          // HII pink in arms
          float hn=fbm(vec2(wx,wz)*3.0+84.0);
          if(arm>0.4&&hn>0.6) col=mix(col,vec3(.9,.3,.4),(hn-0.6)*arm);

          // Dust tints light reddish-brown where it's strong
          if (dust > 0.2) {
            vec3 dustTint = vec3(0.4, 0.15, 0.05);
            col = mix(col, dustTint, dust * uDust * 0.3);
          }

          gl_FragColor=vec4(col*alpha,alpha);
        }
      `,
    });

    this._glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    this._glowMesh.rotation.x = -Math.PI / 2;
    this._glowMesh.renderOrder = 0;
    this.mesh.add(this._glowMesh);
  }

  // ════════════════════════════════════════
  // DUST — volumetric dark 3D particles
  //
  // Normal blending + near-black color = absorption.
  // final = srcAlpha * black + (1-srcAlpha) * existing
  //       = existing * (1 - srcAlpha)
  // True 3D points — volumetric from every angle.
  // ════════════════════════════════════════

  _buildDust(dustData, opacity, scale) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(dustData.positions, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(dustData.sizes, 1));

    // Custom blending: multiply destination by (1 - srcAlpha).
    // This darkens whatever's already drawn without painting black on top.
    // dst = dst * (1 - srcAlpha) + src * 0
    // Since src color is 0, this purely absorbs.
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
      uniforms: {
        uOpacity: { value: opacity }, uScale: { value: scale },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale * (150.0 / max(-mv.z, 0.1)), 0.5, 24.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = (1.0 - smoothstep(0.0, 0.45, d)) * uOpacity;
          // Hard cap per-particle absorption — with 200K particles,
          // even tiny alpha stacks up catastrophically
          a = min(a, 0.003);
          if (a < 0.0005) discard;
          gl_FragColor = vec4(0.0, 0.0, 0.0, a);
        }
      `,
    });

    this._dustPoints = new THREE.Points(geo, mat);
    this._dustPoints.renderOrder = 2;
    this.mesh.add(this._dustPoints);
  }

  // ════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════

  update(deltaTime) {
    this._points.material.uniforms.uTime.value += deltaTime;
    if (this._glowMesh) this._glowMesh.material.uniforms.uTime.value += deltaTime;
    if (this._dustPoints) this._dustPoints.material.uniforms.uTime.value += deltaTime;
  }

  setBrightness(val)     { this._points.material.uniforms.uBrightness.value = val; }
  setScale(val)          { this._points.material.uniforms.uScale.value = val; }
  setSpread(val)         { this._points.material.uniforms.uSpread.value = val; }
  setNearFade(val)       { this._points.material.uniforms.uNearFade.value = val; }
  setDither(val)         { this._points.material.uniforms.uDither.value = val; }
  setChoke(val)          { this._points.material.uniforms.uChoke.value = val; }
  setGlowBrightness(val) { if (this._glowMesh) this._glowMesh.material.uniforms.uBrightness.value = val; }
  setDustOpacity(val)    { if (this._glowMesh) this._glowMesh.material.uniforms.uDust.value = val; }

  addTo(scene) { scene.add(this.mesh); }
  removeFrom(scene) { scene.remove(this.mesh); }

  dispose() {
    this._points.geometry.dispose(); this._points.material.dispose();
    if (this._glowMesh) { this._glowMesh.geometry.dispose(); this._glowMesh.material.dispose(); }
    if (this._dustPoints) { this._dustPoints.geometry.dispose(); this._dustPoints.material.dispose(); }
  }
}

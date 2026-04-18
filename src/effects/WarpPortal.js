import * as THREE from 'three';
import {
  portalApertureScene,
  portalPreviewDistanceScene,
  TUNNEL_LENGTH_SCENE,
  TUNNEL_INTERIOR_RADIUS_SCENE,
} from '../core/ScaleConstants.js';

// INSIDE-mode tunnel mesh scale — applied in setTraversalMode('INSIDE').
// See the block comment in setTraversalMode for the rationale. Scale factors
// bring the ship-scale cylinder (radius ~1.34e-7 AU, length ~6.68e-5 AU) up
// to lab-equivalent dimensions (~2 AU radius, ~10 AU length) during HYPER
// rendering only — the shader's procedural starfield is already validated
// at those dimensions in starfield-cylinder-lab.html. Outside of INSIDE
// mode the scale resets to 1 so warp navigation timing, stencil alignment,
// and portal aperture geometry remain ship-scale.
const TUNNEL_INSIDE_RADIUS_SCALE = 1.5e7;
const TUNNEL_INSIDE_LENGTH_SCALE = 1.5e5;

/**
 * WarpPortal — a dual-portal stencil traversal effect.
 *
 * Two circular discs write to the stencil buffer; a straight cylindrical
 * tunnel between them renders only where stencil is set (so the tunnel
 * appears as a view "through" each disc) OR unconditionally (when the
 * camera is INSIDE the tunnel).
 *
 * Traversal state machine (ported from portal-traversal-lab.html):
 *   OUTSIDE_A  — camera in origin system, sees tunnel through Portal A disc
 *   INSIDE     — camera between A and B, tunnel renders without stencil mask,
 *                both system sides hidden by the caller
 *   OUTSIDE_B  — camera in destination system, sees tunnel through Portal B disc
 *
 * Layout (group-local axes; group.lookAt(target) aligns -Z with the rift dir):
 *   Portal A (this._discA):  local (0, 0, 0), normal +Z → faces the origin camera
 *   Portal B (this._discB):  local (0, 0, -tunnelLength), rotated 180° → normal -Z
 *   Tunnel (this._tunnel):   uniform-radius cylinder spanning both portals
 */
export class WarpPortal {
  /**
   * Scale notes (Max 2026-04-16 "think from first principles"):
   *
   * Ships spawn at `planetRadius × 0.05..0.15` (ShipSpawner.js:72), with a
   * minimum of 0.002. A typical ship near an Earth-sized planet (0.042 radius)
   * renders at ~0.005 scene units. Max's spec: portal ≈ 5× ship visible size,
   * "way smaller than a planet," appearing close to the player.
   *
   * Scale math:
   *   5× ship (0.005) = 0.025 portal radius. For reference — this is smaller
   *   than Earth (0.042), much smaller than Jupiter (0.48), but larger than
   *   a small moon (0.004). A player looking at the portal sees something
   *   ship-scale, not planet-scale.
   *
   * Astronomical scale (previous values 8 / 540 / 130) was 300-400× too big —
   * portal appeared past planetary orbits, landing strip spanned an AU.
   *
   *   portal radius 0.025   → 5× typical ship, way < any planet
   *   tunnel length 200     → unchanged; fits HYPER_DUR=3s × 80u/s = 240u budget
   *   tunnel radius 0.025   → thin tube (aspect 8000:1) — camera on axis sees
   *                            a converging hyperspace corridor from inside
   *   preview distance 2    → close (portal 0.025 subtends ~0.7° at 2u, small
   *                            but visible dot; camera reaches in first 0.3s
   *                            of FOLD via the 40u/s peak ramp)
   *   entry strip 5 × 0.4   → 2u span fits 2u preview
   *   landing strip 20 × 0.2 → 4u "runway" past Portal B, local not astronomical
   *
   * Note: tunnel interior RADIUS is decoupled from portal APERTURE radius.
   * Aperture is ship-scale per Max's spec (0.025 = 5× ship). Tunnel interior
   * is larger (2.0 = "hyperspace corridor" scale) so the inside-the-tunnel
   * visual reads as flying through a cylindrical space instead of a thread.
   * The stencil mask of the disc clips the tunnel to the small aperture
   * from outside, so viewers outside see a ship-scale portal. Once inside,
   * stencil is off (setTraversalMode INSIDE) and the full wider cylinder
   * renders — it's a TARDIS-style "bigger on the inside" effect.
   *
   * @param {number} [radius=0.025] — portal opening (aperture) radius in scene units
   * @param {number} [tunnelLength=200] — distance between Portal A and Portal B
   * @param {number} [tunnelRadius=2.0] — tunnel interior cylinder radius
   */
  constructor(
    radius = portalApertureScene(),
    tunnelLength = TUNNEL_LENGTH_SCENE,
    tunnelRadius = TUNNEL_INTERIOR_RADIUS_SCENE,
  ) {
    this._radius = radius;
    this._tunnelLength = tunnelLength;
    this._tunnelRadius = tunnelRadius;

    const STENCIL_REF = 1;

    // ── Shared disc geometry ──
    // Stencil writers for both Portal A and Portal B. Invisible (colorWrite
    // off) — the rim provides the visible ring.
    const discGeo = new THREE.CircleGeometry(radius, 64);
    const makeDiscMat = () => new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: STENCIL_REF,
      stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilFail: THREE.KeepStencilOp,
    });

    // Portal A — origin system entry (near end of tunnel, normal +Z)
    this._discA = new THREE.Mesh(discGeo, makeDiscMat());
    this._discA.renderOrder = 10;
    // Back-compat alias — legacy code refers to warpPortal._disc
    this._disc = this._discA;

    // Portal B — destination system exit (far end of tunnel, normal -Z via 180° Y-rotation)
    this._discB = new THREE.Mesh(discGeo, makeDiscMat());
    this._discB.position.set(0, 0, -tunnelLength);
    this._discB.rotation.y = Math.PI;
    this._discB.renderOrder = 10;

    // ── Tunnel interior (stencil-masked, star-textured walls) ──
    // Uniform-radius cylinder spanning both portals. Stencil read when outside,
    // unconditional render when camera is INSIDE (driven by setTraversalMode).
    // CylinderGeometry(radiusTop, radiusBottom, height) — top at +Y, bottom at -Y
    const tunnelGeo = new THREE.CylinderGeometry(
      tunnelRadius,   // radiusTop — same as bottom for a straight tunnel
      tunnelRadius,   // radiusBottom — was 0.3× before (tapered vanishing point)
      tunnelLength,
      48,
      1,
      true
    );
    // rotateX(+π/2) maps +Y → +Z. After translate(0, 0, -tunnelLength/2):
    //   +Y end (was +Y, now +Z=0):  at Portal A
    //   -Y end (was -Y, now -Z=-tunnelLength): at Portal B
    tunnelGeo.rotateX(Math.PI / 2);
    tunnelGeo.translate(0, 0, -tunnelLength / 2);

    this._tunnel = new THREE.Mesh(
      tunnelGeo,
      new THREE.ShaderMaterial({
        // DoubleSide so tunnel walls render regardless of camera angle.
        // Stencil mask clips to portal disc shape, so tunnel only shows where portal is.
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilRef: STENCIL_REF,
        stencilFunc: THREE.EqualStencilFunc,
        stencilFail: THREE.KeepStencilOp,
        stencilZFail: THREE.KeepStencilOp,
        stencilZPass: THREE.KeepStencilOp,

        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uHashSeed: { value: new THREE.Vector3(123.34, 456.21, 45.32) },
          uDestHashSeed: { value: new THREE.Vector3(271.67, 891.43, 73.11) },
          uCircCells: { value: 32 },     // integer for seamless cylindrical wrap
          uLengthCells: { value: 16 },
          uDestMix: { value: 0 },        // 0 = all origin, 1 = all destination
          uBridgeCenter: { value: 0.5 }, // blend center position along tunnel
          uBridgeWidth: { value: 0.3 },  // blend zone width
        },

        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,

        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uScroll;
          uniform vec3  uHashSeed;
          uniform vec3  uDestHashSeed;
          uniform float uCircCells;
          uniform float uLengthCells;
          uniform float uDestMix;
          uniform float uBridgeCenter;
          uniform float uBridgeWidth;

          varying vec2 vUv;

          #define NUM_LAYERS 3.0
          #define PI 3.14159265

          float Hash21(vec2 p, vec3 seed) {
            p = fract(p * seed.xy);
            p += dot(p, p + seed.z);
            return fract(p.x * p.y);
          }

          float Star(vec2 uv, float flare) {
            float d = length(uv);
            float m = 0.02 / d;
            float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
            m += rays * flare;
            float c = cos(PI * 0.25), s = sin(PI * 0.25);
            vec2 r = mat2(c, -s, s, c) * uv;
            rays = max(0.0, 1.0 - abs(r.x * r.y * 1000.0));
            m += rays * 0.3 * flare;
            m *= smoothstep(0.6, 0.2, d);
            return m;
          }

          vec3 StarColor(float rand, float destMix) {
            float hotness = fract(rand * 1603.8);
            vec3 originCol = (hotness < 0.6)
              ? vec3(1.0, hotness / 0.6, hotness * 0.9)
              : vec3(1.0 - (hotness - 0.6) / 0.4, 1.0 - (hotness - 0.6) / 0.4, 1.0);
            vec3 destCol = (hotness < 0.6)
              ? vec3(hotness * 0.9, hotness * 0.95, 1.0)
              : vec3(1.0 - (hotness - 0.6) / 0.4, 0.8, 1.0);
            return mix(originCol, destCol, destMix);
          }

          vec3 StarLayer(vec2 uv, vec3 seed, float destMix, float circCells) {
            vec3 col = vec3(0.0);
            vec2 gv = fract(uv) - 0.5;
            vec2 id = floor(uv);
            for (int y = -1; y <= 1; y++) {
              for (int x = -1; x <= 1; x++) {
                vec2 offs = vec2(float(x), float(y));
                vec2 cellId = id + offs;
                cellId.x = mod(cellId.x, circCells);  // seamless cylindrical wrap
                float n  = Hash21(cellId, seed);
                float n2 = fract(n * 345.32);
                float size = n2;
                vec2 sub = vec2(n, fract(n * 42.0)) - 0.5;
                float flare = smoothstep(0.92, 1.0, size) * 0.6;
                float star = Star(gv - offs - sub, flare);
                vec3 c = StarColor(n, destMix);
                star *= 0.75 + 0.25 * sin(uTime * 2.0 + n * 6.2831);
                col += star * size * c;
              }
            }
            return col;
          }

          void main() {
            vec2 uv = vec2(
              vUv.x * uCircCells,
              (vUv.y + uScroll) * uLengthCells
            );

            // ── Origin starfield ──
            vec3 colOrigin = vec3(0.0);
            float t = uTime * 0.02;
            for (float i = 0.0; i < NUM_LAYERS; i += 1.0) {
              float depth = fract(i / NUM_LAYERS + t);
              float scale = mix(1.5, 0.5, depth);
              float fade = depth * smoothstep(1.0, 0.9, depth);
              colOrigin += StarLayer(uv * scale + i * 453.2, uHashSeed, 0.0, uCircCells * scale) * fade;
            }

            // ── Destination starfield (different seed) ──
            vec3 colDest = vec3(0.0);
            for (float i = 0.0; i < NUM_LAYERS; i += 1.0) {
              float depth = fract(i / NUM_LAYERS + t);
              float scale = mix(1.5, 0.5, depth);
              float fade = depth * smoothstep(1.0, 0.9, depth);
              colDest += StarLayer(uv * scale + i * 453.2, uDestHashSeed, 1.0, uCircCells * scale) * fade;
            }

            // ── Bridge blend: smoothstep along vUv.y offset by uDestMix ──
            // uDestMix=0 means all origin, uDestMix=1 means all destination.
            float bridgeT = smoothstep(
              uBridgeCenter - uBridgeWidth * 0.5,
              uBridgeCenter + uBridgeWidth * 0.5,
              vUv.y + uDestMix - 0.5
            );
            vec3 col = mix(colOrigin, colDest, bridgeT);

            // Dim wall base so tunnel is visible even between stars
            col += vec3(0.04, 0.05, 0.1) * 0.4;

            // Retro Bayer dither
            int bx = int(mod(gl_FragCoord.x, 4.0));
            int by = int(mod(gl_FragCoord.y, 4.0));
            float bayer[16];
            bayer[0]=0.0; bayer[1]=8.0; bayer[2]=2.0; bayer[3]=10.0;
            bayer[4]=12.0; bayer[5]=4.0; bayer[6]=14.0; bayer[7]=6.0;
            bayer[8]=3.0; bayer[9]=11.0; bayer[10]=1.0; bayer[11]=9.0;
            bayer[12]=15.0; bayer[13]=7.0; bayer[14]=13.0; bayer[15]=5.0;
            float threshold = bayer[bx + by * 4] / 16.0 - 0.5;
            float levels = 5.0;
            col = floor(col * levels + threshold) / levels;
            col = clamp(col, 0.0, 1.0);

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    this._tunnel.renderOrder = 11;  // render after disc

    // ── Accretion disk rims (one per portal) ──
    // Additive glow around each portal aperture. Non-stenciled so the rims
    // are always visible regardless of which side the camera is on.
    this._rimA = this._createRim(radius);
    this._rimB = this._createRim(radius);
    this._rimB.position.set(0, 0, -tunnelLength);
    this._rimB.rotation.y = Math.PI;
    // Back-compat alias
    this._rim = this._rimA;

    // ── Destination-side "landing strip" ──
    // Two parallel rows of green cross sprites extending from Portal B into
    // the destination system. Gives the player motion reference as the
    // camera exits Portal B and decelerates — without the crosses, nearby
    // geometry is absent and stars are at infinity so there's no parallax
    // cue. Visibility is gated to OUTSIDE_B in setTraversalMode so the
    // crosses don't show through Portal A's stencil view.
    this._landingStrip = this._createLandingStrip(radius, tunnelLength);

    // ── Origin-side "entry strip" ──
    // Two parallel rows of green cross sprites between the camera and
    // Portal A, used by the lab-mode 3-stage spacebar flow to visualize
    // alignment with the portal (crosses light up sequentially from ship
    // toward portal). Positioned at group local +Z (same axis as camera's
    // side of Portal A). Count and spacing are sized so the last cross
    // sits just past Portal A — caller controls how far the first cross
    // sits from the camera by picking the portal open distance.
    this._entryStrip = this._createEntryStrip(radius);
    // Individual cross visibility is managed by setEntryStripProgress(t).
    // Starts fully invisible so the strip appears dark until Space #2.
    this.setEntryStripProgress(0);

    // ── Group all meshes together ──
    this.group = new THREE.Group();
    this.group.add(this._discA);
    this.group.add(this._discB);
    this.group.add(this._tunnel);
    this.group.add(this._rimA);
    this.group.add(this._rimB);
    this.group.add(this._landingStrip);
    this.group.add(this._entryStrip);
    this.group.visible = false;

    // ── Traversal state (3-state machine — see setTraversalMode) ──
    this._traversalMode = 'OUTSIDE_A';
    this._prevDotA = null;
    this._prevDotB = null;
    this.onTraversal = null;  // optional callback: (newMode) => void

    // Scratch vectors reused each frame to avoid allocation in the render loop
    this._scratch = {
      discAPos: new THREE.Vector3(),
      discANormal: new THREE.Vector3(),
      discBPos: new THREE.Vector3(),
      discBNormal: new THREE.Vector3(),
      camToPortal: new THREE.Vector3(),
      camLateral: new THREE.Vector3(),
    };
  }

  /**
   * Build a two-rail "landing strip" of green cross sprites extending from
   * Portal B into the destination system (group local -Z direction past
   * Portal B). Gives the player speed + distance reference as the camera
   * decelerates after exiting.
   *
   * @param {number} radius — portal radius (sprites spaced proportionally)
   * @param {number} tunnelLength — so we know where Portal B sits in local Z
   */
  _createLandingStrip(radius, tunnelLength) {
    // Procedural 32×32 canvas texture: thin green + cross on transparent bg.
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#00ff55';
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(16, 4); ctx.lineTo(16, 28);  // vertical
    ctx.moveTo(4, 16); ctx.lineTo(28, 16);  // horizontal
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;  // preserve crisp edges (retro fit)
    tex.minFilter = THREE.NearestFilter;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Layout: two rails offset ±sideOffset from the tunnel axis, first pair
    // one spacing past Portal B, then N pairs receding into the distance.
    // All lengths proportional to `radius` so the strip tracks ship scale
    // automatically. At PORTAL_APERTURE_TO_SHIP = 5× ship, the 20-cross
    // landing strip spans count × radius = 20× radius = 100× ship length.
    const sideOffset = radius * 2.0;
    const count = 20;
    const spacing = radius * 1.0;
    const scale = radius * 0.5;
    const strip = new THREE.Group();
    const z0 = -tunnelLength - spacing;  // group local: past Portal B
    for (let i = 0; i < count; i++) {
      const z = z0 - i * spacing;
      const left = new THREE.Sprite(mat);
      left.position.set(-sideOffset, 0, z);
      left.scale.setScalar(scale);
      strip.add(left);
      const right = new THREE.Sprite(mat);
      right.position.set(sideOffset, 0, z);
      right.scale.setScalar(scale);
      strip.add(right);
    }
    return strip;
  }

  /**
   * Build a two-rail entry strip of green cross sprites extending from the
   * ship-side of Portal A back toward the camera (group local +Z direction).
   * Pair count + spacing is hardcoded — the number of crosses (6 pairs at
   * 20u spacing = 120u of strip) defines how far the first cross is from
   * Portal A, which tells the caller how far to position the portal from
   * the camera during the lab-mode preview.
   */
  _createEntryStrip(radius) {
    // Reuse the sprite material from the landing strip so both strips share
    // the same cached texture — they're visually identical.
    const srcSprite = this._landingStrip.children[0];
    const mat = srcSprite.material;

    // Crosses span the camera↔portal distance with a ~10% margin on each end,
    // so the nearest cross sits in front of the ship and the farthest cross
    // sits in front of Portal A — regardless of what PORTAL_PREVIEW_TO_SHIP
    // happens to be. Previously the spacing was hard-tied to `radius` (2R,
    // 4R, ..., 10R) assuming preview distance ≈ 12R; when preview shrank to
    // 5R, three of five crosses ended up BEHIND the camera.
    const count = 5;
    const previewDist = portalPreviewDistanceScene();  // ship-to-portal distance during Space #1
    const margin = previewDist * 0.1;                  // padding at each end
    const span = previewDist - margin * 2;             // usable span between portal and camera
    const spacing = count > 1 ? span / (count - 1) : 0;
    const scale = radius * 0.5;
    const sideOffset = radius * 2.0;
    const strip = new THREE.Group();
    // Crosses at group local +Z side of Portal A (which is at z=0). Camera
    // will be positioned at z ≈ previewDist during the preview stage, so
    // i=0 sits near-portal (small z), i=count-1 sits near-ship (close to
    // previewDist).
    for (let i = 0; i < count; i++) {
      const z = margin + i * spacing;
      const left = new THREE.Sprite(mat);
      left.position.set(-sideOffset, 0, z);
      left.scale.setScalar(scale);
      strip.add(left);
      const right = new THREE.Sprite(mat);
      right.position.set(sideOffset, 0, z);
      right.scale.setScalar(scale);
      strip.add(right);
    }
    return strip;
  }

  /**
   * Entry strip distance from Portal A to the far (ship-side) end in group
   * local +Z units. Callers use this when positioning the portal so the
   * camera sits just past the last cross on the preview.
   */
  get entryStripLength() {
    // Strip now spans from (previewDist × 0.1) to (previewDist × 0.9),
    // so the ship-side end is at previewDist × 0.9.
    return portalPreviewDistanceScene() * 0.9;
  }

  /**
   * Sequentially reveal entry-strip crosses from ship-nearest to portal-
   * nearest as t goes from 0 to 1. Used by the lab-mode alignment
   * animation (Space #2) — at t=0 all crosses hidden; at t=1 all lit.
   */
  setEntryStripProgress(t) {
    const kids = this._entryStrip.children;
    const pairs = kids.length / 2;
    const litCount = Math.max(0, Math.min(pairs, Math.floor(t * pairs + 1e-6)));
    for (let i = 0; i < pairs; i++) {
      // i=0 is nearest portal (lowest z), i=pairs-1 is nearest ship.
      // Light order: ship-first, portal-last. Cross i is lit when the
      // lighting wave has passed it from the ship side.
      const shipDistance = (pairs - 1 - i);  // 0 for ship-nearest, pairs-1 for portal-nearest
      const lit = shipDistance < litCount;
      kids[i * 2].visible = lit;
      kids[i * 2 + 1].visible = lit;
    }
  }

  _createRim(radius) {
    const geo = new THREE.RingGeometry(radius * 0.92, radius * 1.45, 96, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      // NO stencil — rim renders everywhere, not clipped by portal mask
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0.3, 0.7, 1.0) },
        uIntensity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float valueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
            mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x),
            u.y
          );
        }

        void main() {
          float dist = abs(vUv.y - 0.2);
          float rim = 1.0 - smoothstep(0.0, 0.6, dist);
          rim = pow(rim, 1.5);

          vec2 polar = vUv;
          polar.x += polar.y * 0.5;
          polar.x += uTime * 0.03;
          polar.y -= uTime * 0.15;

          float n1 = valueNoise(polar * vec2(12.0, 3.0));
          float n2 = valueNoise(polar * vec2(24.0, 6.0) + 17.3);
          float noise = 0.6 * n1 + 0.4 * n2;
          rim *= (0.5 + 0.9 * noise);

          float breathe = 0.75 + 0.25 * sin(uTime * 0.8);
          float flarePhase = fract(uTime * 0.12);
          float flare = smoothstep(0.9, 1.0, flarePhase) * (1.0 - flarePhase) * 3.0;
          rim *= breathe;
          rim += flare * 0.3 * noise;

          rim = clamp(rim, 0.0, 3.0) * uIntensity;
          vec3 core = mix(uColor, vec3(1.0, 0.95, 1.0), smoothstep(0.5, 1.5, rim));
          vec3 final = core * rim;

          int bx = int(mod(gl_FragCoord.x, 4.0));
          int by = int(mod(gl_FragCoord.y, 4.0));
          float bayer[16];
          bayer[0]=0.0; bayer[1]=8.0; bayer[2]=2.0; bayer[3]=10.0;
          bayer[4]=12.0; bayer[5]=4.0; bayer[6]=14.0; bayer[7]=6.0;
          bayer[8]=3.0; bayer[9]=11.0; bayer[10]=1.0; bayer[11]=9.0;
          bayer[12]=15.0; bayer[13]=7.0; bayer[14]=13.0; bayer[15]=5.0;
          float threshold = bayer[bx + by * 4] / 16.0 - 0.5;
          float levels = 5.0;
          final = floor(final * levels + threshold) / levels;
          final = clamp(final, 0.0, 1.0);

          gl_FragColor = vec4(final, rim);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 12;  // after disc (10) and tunnel (11)
    return mesh;
  }

  /** Show the portal at a position, facing a direction.
   *
   * Orient the group so that the camera, approaching from the -direction side,
   * sees Portal A's disc facing it and the tunnel (local -Z) extending in
   * +direction (forward). Because Object3D.lookAt points the object's LOCAL
   * +Z at its target, we lookAt the OPPOSITE of `direction` — this puts
   * local +Z = -direction and local -Z = +direction. Portal B at local
   * (0,0,-tunnelLength) then lands at `position + tunnelLength * direction`,
   * ahead of the camera along the flight path.
   */
  open(position, direction) {
    this.group.position.copy(position);
    const target = position.clone().sub(direction);
    this.group.lookAt(target);
    this.group.visible = true;
  }

  /** Hide the portal. */
  close() {
    this.group.visible = false;
  }

  /** Set portal disc radius (for animating the opening). Scales both discs. */
  setRadius(r) {
    const s = r / this._radius;
    this._discA.scale.setScalar(s);
    this._discB.scale.setScalar(s);
  }

  /** Update scroll time for star animation. Drives both rims. */
  update(deltaTime) {
    if (!this.group.visible) return;
    this._tunnel.material.uniforms.uTime.value += deltaTime;
    // Advance uScroll so tunnel walls stream past the camera during HYPER.
    // Matches starfield-cylinder-lab.html's playScroll rate (0.5 units/sec).
    this._tunnel.material.uniforms.uScroll.value += deltaTime * 0.5;
    this._rimA.material.uniforms.uTime.value += deltaTime;
    this._rimB.material.uniforms.uTime.value += deltaTime;
  }

  /** Set rim glow intensity (0 = hidden, 1 = normal pulse, >1 = boosted). */
  setRimIntensity(v) {
    this._rimA.material.uniforms.uIntensity.value = v;
    this._rimB.material.uniforms.uIntensity.value = v;
  }

  /** Set rim color (accent the portal based on destination star class). */
  setRimColor(r, g, b) {
    this._rimA.material.uniforms.uColor.value.setRGB(r, g, b);
    this._rimB.material.uniforms.uColor.value.setRGB(r, g, b);
  }

  /** Scroll the starfield along the tunnel axis (stream toward camera as you fly in). */
  setTunnelScroll(v) {
    this._tunnel.material.uniforms.uScroll.value = v;
  }

  /** Origin seed for the near-end starfield. vec3 of hash constants. */
  setOriginSeed(x, y, z) {
    this._tunnel.material.uniforms.uHashSeed.value.set(x, y, z);
  }

  /** Destination seed for the far-end starfield. Different from origin seed. */
  setDestinationSeed(x, y, z) {
    this._tunnel.material.uniforms.uDestHashSeed.value.set(x, y, z);
  }

  /** Bridge blend position (0 = all origin, 1 = all destination). Sweeps during HYPER. */
  setBridgeMix(v) {
    this._tunnel.material.uniforms.uDestMix.value = v;
  }

  // ── Traversal state machine ──────────────────────────────────────────────
  //
  // The player flies from the origin system, through the tunnel, into the
  // destination system. Three visual states map to three camera locations:
  //
  //   OUTSIDE_A — camera on the +Z side of Portal A. Stencil is ON, so the
  //               tunnel renders only where Portal A's disc is. Both discs
  //               are visible (B is visible far down-tunnel).
  //   INSIDE    — camera between the two portals. Stencil is OFF so the
  //               tunnel renders everywhere. The caller is responsible for
  //               hiding both systems' scene meshes during this state.
  //   OUTSIDE_B — camera on the -Z side of Portal B. Stencil is back ON, so
  //               tunnel renders only where Portal B's disc is.
  //
  // `setTraversalMode` flips render state directly. `updateTraversal` is
  // called every frame with the camera and detects plane crossings; on a
  // valid crossing it auto-updates the mode and fires `onTraversal(mode)`.

  /**
   * @param {'OUTSIDE_A'|'INSIDE'|'OUTSIDE_B'} mode
   */
  setTraversalMode(mode) {
    if (this._traversalMode === mode) return;
    this._traversalMode = mode;

    // Stencil ON outside, OFF inside
    const stencilOn = (mode !== 'INSIDE');
    if (this._tunnel.material.stencilWrite !== stencilOn) {
      this._tunnel.material.stencilWrite = stencilOn;
      this._tunnel.material.needsUpdate = true;
    }

    // INSIDE-mode tunnel scaling ("TARDIS bigger on the inside" — see the
    // constructor comment). The tunnel geometry is constructed at ship-scale
    // (radius = player ship length, length = 500× ship) so that in OUTSIDE
    // modes the portal aperture is ship-scale and the warp-timing physics
    // stay consistent. But at ship-scale the cylinder is microscopic in AU
    // scene units (radius ~1.3e-7 AU for a 20m ship), and when the camera
    // sits essentially at the cylinder's axis during HYPER the DoubleSide
    // fragment shader's per-pixel vUv sampling degenerates into radial
    // streaks instead of a wall-textured starfield — the dimness bug. Scale
    // the mesh up only for INSIDE rendering so the starfield shader sees
    // the camera at a meaningful distance from walls; reset to 1 in OUTSIDE
    // modes so the disc-clipped view remains crisp and warp nav timing is
    // unaffected. Scale factors target lab-equivalent dimensions
    // (~2 unit radius, ~13 unit length) which the standalone
    // starfield-cylinder-lab.html has already validated as producing a
    // correctly-bright procedural starfield at the same uniform inputs.
    if (mode === 'INSIDE') {
      this._tunnel.scale.set(TUNNEL_INSIDE_RADIUS_SCALE, TUNNEL_INSIDE_RADIUS_SCALE, TUNNEL_INSIDE_LENGTH_SCALE);
    } else {
      this._tunnel.scale.set(1, 1, 1);
    }

    // Per-side visibility: each portal is only visible from ITS system's
    // side. In OUTSIDE_A, only Portal A writes stencil + rim is shown; in
    // OUTSIDE_B, only Portal B. This prevents the "both ends of the tunnel
    // visible" artifact in the destination system. Without this gate, Portal
    // A's stencil mask would still be active when the camera is in the
    // destination, and the tunnel would render through it too (showing you
    // a view BACK through the tunnel from the destination side, which is
    // confusing and not what the non-Euclidean portal metaphor implies).
    this._discA.visible = (mode === 'OUTSIDE_A');
    this._discB.visible = (mode === 'OUTSIDE_B');
    this._rimA.visible  = (mode === 'OUTSIDE_A');
    this._rimB.visible  = (mode === 'OUTSIDE_B');
    // Landing strip is destination-side reference. Per Max 2026-04-16:
    // "the walls of the tunnel and the portal should occlude everything
    // beyond them, including those crosses." Tunnel walls + Portal B cap
    // the interior visually so landing strip crosses don't leak through
    // Portal B's aperture from inside the tunnel. Strip only becomes
    // visible in OUTSIDE_B, after the camera has emerged into destination.
    this._landingStrip.visible = (mode === 'OUTSIDE_B');
    // Entry strip is the origin-side counterpart: only visible while the
    // player is approaching Portal A. Individual cross visibility within
    // the strip is controlled by setEntryStripProgress.
    this._entryStrip.visible = (mode === 'OUTSIDE_A');

    if (this.onTraversal) this.onTraversal(mode);
  }

  /** Current traversal mode. */
  getTraversalMode() {
    return this._traversalMode;
  }

  /**
   * Plane-crossing detection. Call every frame while a warp is active.
   * Fires `setTraversalMode(...)` when the camera crosses a portal plane
   * within the disc radius. Safe to call continuously — mode flips are
   * dedup'd in setTraversalMode.
   *
   * @param {THREE.Camera} camera
   */
  updateTraversal(camera) {
    if (!this.group.visible) {
      this._prevDotA = null;
      this._prevDotB = null;
      return;
    }

    // Ensure world matrices are current
    this.group.updateMatrixWorld();
    this._discA.updateMatrixWorld();
    this._discB.updateMatrixWorld();

    const S = this._scratch;

    // World position + normal for each disc. Lab convention: each disc's
    // normal is its CircleGeometry's natural +Z face. After open() orients
    // the group with +Z = -direction, Portal A's world normal = -direction
    // (pointing toward the origin system camera), and Portal B — rotated
    // 180° around Y in its local frame — has world normal = +direction
    // (pointing toward the destination side).
    S.discAPos.setFromMatrixPosition(this._discA.matrixWorld);
    S.discANormal.set(0, 0, 1).transformDirection(this._discA.matrixWorld);
    S.discBPos.setFromMatrixPosition(this._discB.matrixWorld);
    S.discBNormal.set(0, 0, 1).transformDirection(this._discB.matrixWorld);

    // Effective disc radius in world space (respect scale)
    const discRadius = this._radius * this._discA.scale.x;

    // ── Portal A plane ──
    S.camToPortal.subVectors(camera.position, S.discAPos);
    const dotA = S.camToPortal.dot(S.discANormal);
    if (this._prevDotA !== null) {
      // Forward crossing: OUTSIDE_A → INSIDE (camera goes from +Z side to -Z side of A)
      if (this._traversalMode === 'OUTSIDE_A' && this._prevDotA > 0 && dotA <= 0) {
        if (this._lateralDistance(S.camToPortal, S.discANormal) <= discRadius) {
          this.setTraversalMode('INSIDE');
        }
      }
      // Backward crossing: INSIDE → OUTSIDE_A (camera backs out through Portal A)
      if (this._traversalMode === 'INSIDE' && this._prevDotA < 0 && dotA >= 0) {
        if (this._lateralDistance(S.camToPortal, S.discANormal) <= discRadius) {
          this.setTraversalMode('OUTSIDE_A');
        }
      }
    }
    this._prevDotA = dotA;

    // ── Portal B plane ──
    S.camToPortal.subVectors(camera.position, S.discBPos);
    const dotB = S.camToPortal.dot(S.discBNormal);
    if (this._prevDotB !== null) {
      // Forward crossing: INSIDE → OUTSIDE_B (camera emerges through Portal B)
      // Portal B's normal points toward the destination side, so the camera
      // reaches OUTSIDE_B when dotB flips from negative (inside) to positive.
      if (this._traversalMode === 'INSIDE' && this._prevDotB < 0 && dotB >= 0) {
        if (this._lateralDistance(S.camToPortal, S.discBNormal) <= discRadius) {
          this.setTraversalMode('OUTSIDE_B');
        }
      }
      // Backward crossing: OUTSIDE_B → INSIDE (camera re-enters Portal B)
      if (this._traversalMode === 'OUTSIDE_B' && this._prevDotB > 0 && dotB <= 0) {
        if (this._lateralDistance(S.camToPortal, S.discBNormal) <= discRadius) {
          this.setTraversalMode('INSIDE');
        }
      }
    }
    this._prevDotB = dotB;
  }

  /**
   * Perpendicular distance from (camera - portal) vector to the portal normal.
   * This is the lateral (in-disc-plane) distance — used to reject crossings
   * that happen outside the disc's radial footprint.
   * @private
   */
  _lateralDistance(camToPortal, normal) {
    const S = this._scratch;
    // Project out the normal component; remainder is the in-plane vector
    const alongNormal = camToPortal.dot(normal);
    S.camLateral.copy(normal).multiplyScalar(alongNormal);
    S.camLateral.subVectors(camToPortal, S.camLateral);
    return S.camLateral.length();
  }

  /**
   * Reset traversal state to OUTSIDE_A. Call before opening a fresh warp so
   * stale dot values from a previous warp don't spuriously fire a mode flip.
   */
  resetTraversal() {
    this._traversalMode = 'OUTSIDE_A';
    this._prevDotA = null;
    this._prevDotB = null;
    // Re-enable stencil for the starting state
    if (!this._tunnel.material.stencilWrite) {
      this._tunnel.material.stencilWrite = true;
      this._tunnel.material.needsUpdate = true;
    }
    // Per-side visibility for starting OUTSIDE_A (see setTraversalMode)
    this._discA.visible = true;
    this._discB.visible = false;
    this._rimA.visible = true;
    this._rimB.visible = false;
    this._landingStrip.visible = false;  // destination-side only
    this._entryStrip.visible = true;     // origin-side: visible in OUTSIDE_A
    this.setEntryStripProgress(0);       // but all crosses dark until Space #2
  }

  dispose() {
    // Shared disc geometry — dispose once
    this._discA.geometry.dispose();
    this._discA.material.dispose();
    this._discB.material.dispose();
    this._tunnel.geometry.dispose();
    this._tunnel.material.dispose();
    this._rimA.geometry.dispose();
    this._rimA.material.dispose();
    this._rimB.geometry.dispose();
    this._rimB.material.dispose();
  }
}

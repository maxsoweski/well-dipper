import * as THREE from 'three';
import { assignName } from '../util/scene-naming.js';

/**
 * WarpTunnel — one mesh, one shader, one system for the entire warp visual.
 *
 * Architecture:
 *   1. Before warp: capture the full sky (stars + glow + nebulae) to a cubemap
 *   2. The mesh starts as a SPHERE (looks identical to the sky) and morphs into
 *      a CYLINDER during FOLD. Every vertex has two positions — sphere and cylinder.
 *   3. The fragment shader samples the cubemap at the vertex's ORIGINAL sky direction,
 *      so the sky content is literally wallpapered onto whatever shape the mesh is.
 *   4. During HYPER, the shader blends between origin and destination cubemaps along
 *      the tunnel depth. The bridge IS the blend region — no separate layer needed.
 *   5. During EXIT, the mesh morphs back from cylinder to sphere (destination sky).
 *
 * During warp, ALL normal sky layers are hidden. This mesh is the sole visual.
 */
export class WarpTunnel {
  /**
   * @param {number} [radius=350] — tunnel interior radius at full cylinder
   * @param {number} [sphereRadius=500] — sky sphere radius (must match SkyRenderer)
   * @param {number} [cubemapSize=256] — resolution per cubemap face
   */
  constructor(radius = 350, sphereRadius = 500, cubemapSize = 256) {
    this._radius = radius;
    this._sphereRadius = sphereRadius;
    this._cubemapSize = cubemapSize;

    // Cubemap render targets — created lazily on first capture
    this._originCubemap = null;
    this._destCubemap = null;
    this._cubeCamera = null;

    // Tunnel forward direction basis (set at warp start)
    this._forward = new THREE.Vector3(0, 0, -1);
    this._right = new THREE.Vector3(1, 0, 0);
    this._up = new THREE.Vector3(0, 1, 0);

    // Build the morphable mesh
    this.mesh = this._createMesh();
    this.mesh.visible = false;
    assignName(this.mesh, { category: 'effect', kind: 'warp', id: 'tunnel-cubemap' });
    this.mesh.renderOrder = 2;
    this.mesh.frustumCulled = false;

    this._hasOrigin = false;
    this._hasDest = false;
  }

  // ── Cubemap capture ──

  _ensureCubemaps() {
    if (this._originCubemap) return;
    const size = this._cubemapSize;
    const opts = { format: THREE.RGBAFormat, generateMipmaps: false };
    this._originCubemap = new THREE.WebGLCubeRenderTarget(size, opts);
    this._destCubemap = new THREE.WebGLCubeRenderTarget(size, opts);
    this._cubeCamera = new THREE.CubeCamera(0.1, 2000, this._originCubemap);
  }

  /**
   * Capture the current sky to the origin cubemap.
   * Call at the very start of warp, before hiding sky layers.
   */
  captureOriginSky(renderer, skyScene) {
    this._ensureCubemaps();
    this._cubeCamera.renderTarget = this._originCubemap;
    this._cubeCamera.position.set(0, 0, 0);
    // Sky meshes follow the camera — temporarily zero their positions for capture
    const saved = this._zeroPositions(skyScene);
    // Count visible objects for debug
    let visCount = 0;
    skyScene.traverse(c => { if ((c.isMesh || c.isPoints) && c.visible) visCount++; });
    console.log(`[WarpTunnel] captureOriginSky: ${visCount} visible objects in scene`);
    this._cubeCamera.update(renderer, skyScene);
    this._restorePositions(saved);
    this._hasOrigin = true;
    this.mesh.material.uniforms.uOriginCubemap.value = this._originCubemap.texture;
    console.log(`[WarpTunnel] origin cubemap captured, texture=`, this._originCubemap.texture);
  }

  /**
   * Capture the destination sky to the destination cubemap.
   * Call during system swap (HYPER phase).
   */
  captureDestSky(renderer, skyScene) {
    this._ensureCubemaps();
    this._cubeCamera.renderTarget = this._destCubemap;
    this._cubeCamera.position.set(0, 0, 0);
    const saved = this._zeroPositions(skyScene);
    this._cubeCamera.update(renderer, skyScene);
    this._restorePositions(saved);
    this._hasDest = true;
    this.mesh.material.uniforms.uDestCubemap.value = this._destCubemap.texture;
  }

  _zeroPositions(scene) {
    const saved = [];
    scene.traverse(child => {
      if ((child.isMesh || child.isPoints || child.isGroup) && child !== this.mesh) {
        saved.push({ obj: child, pos: child.position.clone() });
        child.position.set(0, 0, 0);
      }
    });
    return saved;
  }

  _restorePositions(saved) {
    for (const s of saved) s.obj.position.copy(s.pos);
  }

  // ── Uniform setters ──

  /** Set tunnel forward direction. Computes orthonormal basis for cubemap lookup. */
  setForward(vec3) {
    this._forward.copy(vec3).normalize();
    const tempUp = Math.abs(this._forward.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    this._right.crossVectors(this._forward, tempUp).normalize();
    this._up.crossVectors(this._right, this._forward).normalize();
    const u = this.mesh.material.uniforms;
    u.uTunnelForward.value.copy(this._forward);
    u.uTunnelRight.value.copy(this._right);
    u.uTunnelUp.value.copy(this._up);
  }

  /** Morph phase: 0 = sphere (sky), 1 = cylinder (tunnel). */
  setPhase(v) {
    this.mesh.material.uniforms.uPhase.value = v;
    this.mesh.visible = v > 0.001;
  }

  /** Scroll position — shifts texture along tunnel depth for streaming effect. */
  setScroll(v) {
    this.mesh.material.uniforms.uScroll.value = v;
  }

  /** Crossover progress: 0 = all origin, 1 = all destination. */
  setCrossoverProgress(v) {
    this.mesh.material.uniforms.uCrossoverProgress.value = v;
  }

  /** Move mesh to follow camera (sky sphere convention). */
  update(cameraPosition) {
    this.mesh.position.copy(cameraPosition);
  }

  // ── Geometry: sphere↔cylinder morphable mesh ──

  _createMesh() {
    // Build a mesh with two sets of vertex positions:
    //   position  = cylinder wall position (tunnel shape)
    //   aSpherePos = sphere position (sky shape)
    // Vertex shader interpolates: mix(aSpherePos, position, uPhase)
    // Fragment shader always samples cubemap at the SPHERE direction.

    const azimuthalSegments = 96;
    const depthSegments = 128;
    const R = this._radius;       // cylinder radius
    const SR = this._sphereRadius; // sphere radius
    const PI = Math.PI;

    const spherePositions = [];
    const cylinderPositions = [];
    const indices = [];
    const vertCount = (azimuthalSegments + 1) * (depthSegments + 1);

    for (let j = 0; j <= depthSegments; j++) {
      const v = j / depthSegments; // 0 = near end (behind), 1 = far end (ahead)

      // Map v to polar angle theta from tunnel forward:
      // v=0 (near) → theta=PI (behind), v=1 (far) → theta≈0.05 (nearly ahead)
      // Don't go all the way to theta=0 to avoid pole singularity
      const theta = PI * (1.0 - v * 0.95);

      // Cylinder taper: full radius near camera, pinches at far end
      const taper = 1.0 - v * v * 0.93;
      const cylR = R * taper;
      // Cylinder Z: centered, near end at -L/2, far end at +L/2
      const tunnelLength = 3000;
      const cylZ = (v - 0.5) * tunnelLength;

      for (let i = 0; i <= azimuthalSegments; i++) {
        const u = i / azimuthalSegments;
        const phi = u * PI * 2;

        // Sphere position (original sky direction × radius)
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        const sx = sinT * Math.cos(phi);
        const sy = sinT * Math.sin(phi);
        const sz = cosT;
        spherePositions.push(sx * SR, sy * SR, sz * SR);

        // Cylinder position (ring at depth cylZ)
        cylinderPositions.push(
          Math.cos(phi) * cylR,
          Math.sin(phi) * cylR,
          cylZ
        );
      }
    }

    // Triangle indices
    for (let j = 0; j < depthSegments; j++) {
      for (let i = 0; i < azimuthalSegments; i++) {
        const a = j * (azimuthalSegments + 1) + i;
        const b = a + azimuthalSegments + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(cylinderPositions, 3));
    geometry.setAttribute('aSpherePos', new THREE.Float32BufferAttribute(spherePositions, 3));
    geometry.setIndex(indices);

    const blackCube = new THREE.CubeTexture();

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,

      uniforms: {
        uOriginCubemap: { value: blackCube },
        uDestCubemap: { value: blackCube },
        uPhase: { value: 0.0 },
        uScroll: { value: 0.0 },
        uCrossoverProgress: { value: 0.0 },
        uTunnelForward: { value: new THREE.Vector3(0, 0, -1) },
        uTunnelRight: { value: new THREE.Vector3(1, 0, 0) },
        uTunnelUp: { value: new THREE.Vector3(0, 1, 0) },
      },

      vertexShader: /* glsl */ `
        attribute vec3 aSpherePos;
        uniform float uPhase;
        uniform float uScroll;
        uniform vec3 uTunnelForward;
        uniform vec3 uTunnelRight;
        uniform vec3 uTunnelUp;

        varying vec3 vSkyDir;   // original sky direction for cubemap lookup
        varying float vDepth;   // 0=near, 1=far — for origin/dest blend

        void main() {
          // ── Morph between sphere and cylinder ──
          vec3 morphed = mix(aSpherePos, position, uPhase);

          // ── Sky direction for cubemap lookup ──
          // The sphere positions are in a LOCAL frame (Z=tunnel forward).
          // Transform to WORLD frame using the tunnel basis so the cubemap
          // lookup matches what was captured by the CubeCamera in world space.
          vec3 localDir = normalize(aSpherePos);
          vSkyDir = uTunnelRight * localDir.x
                  + uTunnelUp * localDir.y
                  + uTunnelForward * localDir.z;

          // ── Depth for origin/destination blend ──
          // In local frame, Z=1 is ahead (far end), Z=-1 is behind (near end).
          vDepth = localDir.z * 0.5 + 0.5; // remap [-1,1] to [0,1]

          // ── Scroll: offset the morphed position along tunnel forward ──
          // Only applies when in cylinder mode (uPhase > 0)
          // This creates the streaming-past effect during HYPER.
          vec3 scrollOffset = uTunnelForward * (-uScroll * uPhase);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(morphed + scrollOffset, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform samplerCube uOriginCubemap;
        uniform samplerCube uDestCubemap;
        uniform float uPhase;
        uniform float uCrossoverProgress;

        varying vec3 vSkyDir;
        varying float vDepth;

        void main() {
          // ── Sample both cubemaps ──
          vec3 originColor = textureCube(uOriginCubemap, vSkyDir).rgb;
          vec3 destColor = textureCube(uDestCubemap, vSkyDir).rgb;

          // ── Three-section blend (origin → bridge → destination) ──
          float sweepPos = mix(1.2, -0.2, uCrossoverProgress);
          float blend = smoothstep(sweepPos - 0.25, sweepPos + 0.25, vDepth);
          vec3 color = mix(originColor, destColor, blend);

          // DEBUG: add bright gradient so we can see the tunnel geometry
          // regardless of cubemap content. Blue=near, red=far.
          color += vec3(vDepth * 0.3, 0.05, (1.0 - vDepth) * 0.3);

          // Depth fade: dim the vanishing point slightly
          float depthFade = 1.0 - vDepth * vDepth * 0.4;

          // Alpha = 1.0 for additive blending (uPhase controls visibility via mesh.visible)
          gl_FragColor = vec4(color * depthFade, 1.0);
        }
      `,
    });

    return new THREE.Mesh(geometry, material);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this._originCubemap) this._originCubemap.dispose();
    if (this._destCubemap) this._destCubemap.dispose();
  }
}

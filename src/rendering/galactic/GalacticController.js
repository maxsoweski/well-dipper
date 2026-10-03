// GalacticController.js — L4: the ONE production controller for the Galactic Engine sky volume.
//
// The game and the cloud lab both instantiate this class; front-end differences live only in `ctx`.
// Step 1 draws ONE emission nebula as a volume: a low-resolution pass raymarches the shared GLSL field for
// every sky pixel (camera ray DIRECTION only — in-system movement is negligible at pc scale), then two
// fullscreen passes composite it into the sky target, premultiplied: sky * T, then + L.
//
// TODO(AC-7): composition happens after glow+stars, so every star is dimmed by the FULL column T, as if it
// were behind the cloud. Stars in front must be left alone — needs per-star distance in StarfieldLayer.
// TODO(AC-9/§5): this is a live per-frame pass; the per-warp bake (L/T cubes) replaces it in a later step.

import * as THREE from 'three';
import { featureHistory, featureKeyOf } from '../../galactic/featureHistory.js';
import { renderPack, packHash, COLOUR_MODES, DEFAULT_COLOUR_MODE } from '../../galactic/renderPacks.js';
import { pickVolumeFeature } from '../../galactic/subjects.js';
import { integrateRay, applyColourMode } from '../../galactic/cloudFieldCPU.js';
import { FULLSCREEN_VERT, CLOUD_VOLUME_FRAG, CLOUD_COMPOSITE_FRAG, } from '../../galactic/shaders/cloudField.glsl.js';
import { MAX_STEPS } from '../../galactic/cloudConstants.js';

export const DEFAULT_CTX = Object.freeze({
  label: 'game',
  steps: 48,             // ray-march step budget per pixel
  volumePixelScale: 3,   // fallback when the caller does not pass the RetroRenderer's pixelScale
});

/** The single place a feature becomes GPU parameters: lab and game both go through here. */
export function buildPack(feature, colourMode) {
  return renderPack(featureHistory(feature), { colourMode });
}

/** (tan(fov/2) * aspect, tan(fov/2)) — the volume's ray basis. Independent of near/far on purpose. */
export function cameraTanHalf(camera) {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  return [t * camera.aspect, t];
}

export class GalacticController {
  constructor(ctx = {}) {
    this.ctx = { ...DEFAULT_CTX, ...ctx };
    this._enabled = true;
    this._mode = DEFAULT_COLOUR_MODE;
    this._feature = null;
    this._pinned = null;
    this._observerKpc = null;
    this._observerOverridePc = null;
    this._pack = null;
    this._hash = null;
    this._lastFrameMs = null;
    this._target = null;
    this._build();
  }

  // ── Target selection ─────────────────────────────────────────────────────────────────────────────────

  /** Draw `feature` as seen from `observerGalacticPosKpc` (galactocentric kpc, CPU doubles). */
  setTarget(feature, observerGalacticPosKpc) {
    this._feature = feature && feature.type === 'emission-nebula' ? feature : null;
    if (observerGalacticPosKpc) this._observerKpc = { ...observerGalacticPosKpc };
    this.refresh();
  }

  /** Move the observer without changing the feature (lab distance slider). */
  setObserver(observerGalacticPosKpc) {
    this._observerKpc = { ...observerGalacticPosKpc };
    this._uploadObserver();
  }

  /** Debug/lab: force the feature regardless of what the sky offers (null = back to automatic). */
  pinFeature(feature) {
    this._pinned = feature || null;
  }

  /** Debug: place the observer at a fixed offset from the nebula centre, in pc (null = use the real one). */
  setObserverOverridePc(relPc) {
    this._observerOverridePc = relPc ? relPc.slice() : null;
    this._uploadObserver();
  }

  /** Called by SkyRenderer whenever it (re)builds the sky. Returns the feature key the billboard layer must
   *  skip, or null when the volume is off / has nothing to draw. */
  onSkyFeatures(features, playerPosKpc) {
    this.setTarget(this._pinned || pickVolumeFeature(features), playerPosKpc);
    return this.isActive() ? this.featureKey : null;
  }

  get feature() {
    return this._feature;
  }

  get featureKey() {
    return this._feature ? featureKeyOf(this._feature) : null;
  }

  // ── Switches ─────────────────────────────────────────────────────────────────────────────────────────

  setEnabled(on) { this._enabled = !!on; }
  isEnabled() { return this._enabled; }
  isActive() { return this._enabled && !!this._pack; }

  setColourMode(mode) {
    if (!COLOUR_MODES.includes(mode)) throw new Error(`setColourMode: '${mode}' is not one of ${COLOUR_MODES.join(', ')}`);
    this._mode = mode;
    this.refresh();
  }
  getColourMode() { return this._mode; }

  /** Rebuild the pack (history → params) and upload it. Call after renderPackOverrides change. */
  refresh() {
    this._pack = this._feature ? buildPack(this._feature, this._mode) : null;
    this._hash = this._pack ? packHash(this._pack) : null;
    if (this._pack) this._uploadPack(this._pack);
    this._uploadObserver();
  }

  getPack() { return this._pack; }

  /** Observer position relative to the nebula centre, in pc (subtracted in CPU doubles before upload). */
  observerRelPc() {
    if (!this._feature) return null;
    if (this._observerOverridePc) return this._observerOverridePc.slice();
    if (!this._observerKpc) return null;
    const c = this._feature.position, o = this._observerKpc;
    return [(o.x - c.x) * 1000, (o.y - c.y) * 1000, (o.z - c.z) * 1000];
  }

  // ── GPU ──────────────────────────────────────────────────────────────────────────────────────────────

  _build() {
    const u = (v) => ({ value: v });
    this._volumeUniforms = {
      uObserverPc: u(new THREE.Vector3()), uRot: u(new THREE.Matrix3()),
      uRadius: u(1), uBoundRadius: u(1), uSoftness: u(0.5),
      uNoiseOffset: u(new THREE.Vector3()), uNoiseScale: u(1), uGain: u(0.5), uLacunarity: u(2),
      uSigma: u(1), uRidgeGain: u(0), uOctaves: u(5),
      uCavityCentre: u(new THREE.Vector3()), uCavityRadius: u(0), uCavityDepth: u(0),
      uIonCentre: u(new THREE.Vector3()), uGlowRadius: u(1), uOiiiRadius: u(1), uHardness: u(0),
      uEmissionScale: u(0), uHa: u(new THREE.Vector3()), uOiii: u(new THREE.Vector3()),
      uExtScale: u(0), uExtRGB: u(new THREE.Vector3()),
      uSteps: u(Math.min(this.ctx.steps, MAX_STEPS)),
      uTanHalf: u(new THREE.Vector2(1, 1)), uCameraWorld: u(new THREE.Matrix4()),
    };
    this._volumeMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: CLOUD_VOLUME_FRAG,
      uniforms: this._volumeUniforms,
      depthTest: false,
      depthWrite: false,
    });
    const compUniforms = {
      uL: u(null), uT: u(null), uPass: u(0),
      uColourMode: u(0), uRealTint: u(new THREE.Vector3(1, 1, 1)), uRealSat: u(new THREE.Vector4(0, 0.5, 0.1, 0.3)),
    };
    const base = { glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VERT, fragmentShader: CLOUD_COMPOSITE_FRAG, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation };
    // Pass 0: dst = dst * T (per channel). Pass 1: dst = dst + L. Alpha is left as it is.
    this._multiplyMaterial = new THREE.ShaderMaterial({ ...base, uniforms: compUniforms,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    this._addMaterial = new THREE.ShaderMaterial({ ...base, uniforms: { ...compUniforms, uPass: u(1) },
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    this._compUniforms = compUniforms;
    this._addUniforms = this._addMaterial.uniforms;

    const geo = new THREE.PlaneGeometry(2, 2);
    this._quad = new THREE.Mesh(geo, this._volumeMaterial);
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  _uploadPack(p) {
    const U = this._volumeUniforms;
    U.uRot.value.fromArray(p.rotation);
    U.uRadius.value = p.radiusPc;
    U.uBoundRadius.value = p.boundRadiusPc;
    U.uSoftness.value = p.envelopeSoftness;
    U.uNoiseOffset.value.fromArray(p.noise.offset);
    U.uNoiseScale.value = p.noise.scalePc;
    U.uGain.value = p.noise.gain;
    U.uLacunarity.value = p.noise.lacunarity;
    U.uSigma.value = p.noise.sigma;
    U.uRidgeGain.value = p.noise.ridgeGain;
    U.uOctaves.value = p.noise.octaves;
    U.uCavityCentre.value.fromArray(p.cavity.centrePc);
    U.uCavityRadius.value = p.cavity.radiusPc;
    U.uCavityDepth.value = p.cavity.depth;
    U.uIonCentre.value.fromArray(p.ionizing.centrePc);
    U.uGlowRadius.value = p.ionizing.glowRadiusPc;
    U.uOiiiRadius.value = p.ionizing.oiiiRadiusPc;
    U.uHardness.value = p.ionizing.hardness;
    U.uEmissionScale.value = p.emission.scale;
    U.uHa.value.fromArray(p.emission.ha);
    U.uOiii.value.fromArray(p.emission.oiii);
    U.uExtScale.value = p.extinction.scale;
    U.uExtRGB.value.fromArray(p.extinction.rgb);
    for (const C of [this._compUniforms, this._addUniforms]) {
      C.uColourMode.value = p.colourMode === 'realistic' ? 1 : 0;
      C.uRealTint.value.fromArray(p.realistic.tint);
      C.uRealSat.value.set(p.realistic.satMin, p.realistic.satMax, p.realistic.lumLo, p.realistic.lumHi);
    }
  }

  _uploadObserver() {
    const rel = this.observerRelPc();
    if (rel) this._volumeUniforms.uObserverPc.value.fromArray(rel);
  }

  _ensureTarget(w, h) {
    if (this._target && this._target.width === w && this._target.height === h) return;
    if (this._target) this._target.dispose();
    this._target = new THREE.WebGLRenderTarget(w, h, {
      count: 2,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
    });
    this._compUniforms.uL.value = this._target.textures[0];
    this._compUniforms.uT.value = this._target.textures[1];
    this._addUniforms.uL.value = this._target.textures[0];
    this._addUniforms.uT.value = this._target.textures[1];
  }

  /**
   * Draw the volume into `skyTarget` (already holding glow + stars). Restores the renderer's autoClear.
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera — directions only
   * @param {THREE.WebGLRenderTarget} skyTarget
   * @param {number} [pixelScale] — the RetroRenderer's pixelScale (volume renders at the scene's low res)
   */
  render(renderer, camera, skyTarget, pixelScale = this.ctx.volumePixelScale) {
    if (!this.isActive() || !skyTarget) return;
    const t0 = performance.now();
    const ps = Math.max(1, pixelScale || 1);
    this._ensureTarget(Math.ceil(skyTarget.width / ps), Math.ceil(skyTarget.height / ps));

    camera.updateMatrixWorld();
    const th = cameraTanHalf(camera);
    this._volumeUniforms.uTanHalf.value.set(th[0], th[1]);
    this._volumeUniforms.uCameraWorld.value.copy(camera.matrixWorld);
    this._volumeUniforms.uSteps.value = Math.min(this.ctx.steps, MAX_STEPS);

    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this._target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    this._quad.material = this._volumeMaterial;
    renderer.render(this._scene, this._orthoCam);

    renderer.setRenderTarget(skyTarget);
    this._quad.material = this._multiplyMaterial;
    renderer.render(this._scene, this._orthoCam);
    this._quad.material = this._addMaterial;
    renderer.render(this._scene, this._orthoCam);
    renderer.autoClear = prevAutoClear;
    this._lastFrameMs = performance.now() - t0;
  }

  /**
   * Live probe: the GPU's L/T at a low-res volume pixel next to the CPU twin's answer for the same ray.
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   * @param {number} u — 0..1 across the screen
   * @param {number} v — 0..1 up the screen
   */
  probe(renderer, camera, u = 0.5, v = 0.5) {
    if (!this._target || !this._pack) return null;
    const w = this._target.width, h = this._target.height;
    const px = Math.min(w - 1, Math.floor(u * w)), py = Math.min(h - 1, Math.floor(v * h));
    const read = (i) => {
      const buf = new Uint16Array(4);
      renderer.readRenderTargetPixels(this._target, px, py, 1, 1, buf, undefined, i);
      return Array.from(buf.slice(0, 3), (x) => THREE.DataUtils.fromHalfFloat(x));
    };
    // Same ray the shader built for the centre of that pixel.
    const th = cameraTanHalf(camera);
    const dir = new THREE.Vector3((((px + 0.5) / w) * 2 - 1) * th[0], (((py + 0.5) / h) * 2 - 1) * th[1], -1).normalize().transformDirection(camera.matrixWorld);
    const cpu = integrateRay(this._pack, this.observerRelPc(), dir.toArray(), Math.min(this.ctx.steps, MAX_STEPS));
    return { pixel: [px, py], gpu: { L: read(0), T: read(1) }, cpu: { L: cpu.L, T: cpu.T, display: applyColourMode(cpu.L, this._pack) } };
  }

  snapshot() {
    const rel = this.observerRelPc();
    const r = this._pack ? this._pack.radiusPc : null;
    return {
      ctx: this.ctx.label,
      enabled: this._enabled,
      active: this.isActive(),
      mode: this._mode,
      featureId: this.featureKey,
      pinned: !!this._pinned,
      radiusPc: r,
      observerRelPc: rel,
      distancePc: rel ? Math.hypot(rel[0], rel[1], rel[2]) : null,
      insideCloud: rel && r ? Math.hypot(rel[0], rel[1], rel[2]) < r : false,
      paramsHash: this._hash,
      steps: Math.min(this.ctx.steps, MAX_STEPS),
      volumeRes: this._target ? [this._target.width, this._target.height] : null,
      lastFrameMs: this._lastFrameMs, // CPU submit time, not a GPU timer (AC-10 needs a GPU timer query)
    };
  }

  dispose() {
    if (this._target) this._target.dispose();
    this._target = null;
    this._volumeMaterial.dispose();
    this._multiplyMaterial.dispose();
    this._addMaterial.dispose();
    this._quad.geometry.dispose();
  }
}

// GalacticController.js — L4: the ONE production controller for the Galactic Engine sky volume.
//
// The game and the cloud lab both instantiate this class; front-end differences live only in `ctx`.
//
// Step 2 (plan §5, AC-7/9/10): the volume is BAKED per system, not marched every frame.
//   • A request (feature + observer) becomes an immutable snapshot with a generation token (BakeScheduler).
//   • The bake marches the shared GLSL integrator once per texel of a six-face sky atlas (3 x 2 cells of
//     N x N, edge-inclusive texels → seamless), in bounded row tiles across frames, into the BACK set of two
//     MRT targets: (L.rgb, tau) and the optical-depth CDF G. A set is published only when every tile is done.
//   • Per frame the controller only samples the published atlas in screen space (per low-res sky pixel) and
//     composites premultiplied: sky·T BEFORE the stars, + L after them. Stars dim themselves by the dust up to
//     THEIR distance (CLOUD_STAR_DUST_GLSL in StarfieldLayer).
//   • Warps: SkyRenderer holds the published sky while a warp is in flight; the destination bakes during
//     FOLD/ENTER/HYPER and is published at the swap point (see SkyRenderer.releaseVolumeHold and main.js).
//   • ctx.source = 'live' keeps the step-1 per-frame march as a debug/reference path (and the fallback when the
//     GPU cannot render to half-float targets).

import * as THREE from 'three';
import { featureHistory, featureKeyOf } from '../../galactic/featureHistory.js';
import { renderPack, packHash, COLOUR_MODES, DEFAULT_COLOUR_MODE, SHAPE_VERSIONS, DEFAULT_SHAPE_VERSION } from '../../galactic/renderPacks.js';
import { pickVolumeFeature } from '../../galactic/subjects.js';
import { integrateRay, applyColourMode } from '../../galactic/cloudFieldCPU.js';
import { atlasSize, atlasUV, texelCoord } from '../../galactic/cubeAtlas.js';
import { FULLSCREEN_VERT, CLOUD_VOLUME_FRAG, CLOUD_COMPOSITE_FRAG, CLOUD_BAKE_FRAG } from '../../galactic/shaders/cloudField.glsl.js';
import { MAX_STEPS, ATLAS_COLS } from '../../galactic/cloudConstants.js';
import { BakeScheduler } from './bakeScheduler.js';

export const DEFAULT_CTX = Object.freeze({
  label: 'game',
  steps: 48,              // ray-march step budget per ray (bake and live reference use the same)
  volumePixelScale: 3,    // fallback when the caller does not pass the RetroRenderer's pixelScale
  source: 'bake',         // 'bake' (production) | 'live' (debug/reference: step-1 per-frame march)
  // Bake face size. Game render height = window height / 3 → at 1080p, 360 rows over FOV 70° ≈ 0.194°/px.
  // An edge-inclusive face texel spans 2/(N-1) rad at the face centre (smaller toward edges): N = 512 gives
  // 0.224° — within 15% of one game pixel at the centre and finer everywhere else, so the bake is never visibly
  // coarser than the screen at 1080p; 384 (0.30°) would be ~1.5 px per texel. Cost: 2 sets × 25 MB.
  bakeFaceSize: 512,
  bakeRowsPerTile: 64,    // one tile = 64 rows of one face (32k rays at N=512) → 48 tiles per sky
  bakeTilesPerFrame: 1,   // ~0.8 s per bake at 60 fps; the warp gives ~8.5 s
  bakeTimeoutMs: 20000,   // an unfinished bake fails after this; the feature keeps its billboard
  holdTimeoutMs: 45000,   // a warp hold that is never released (interrupted warp) lapses after this
  ditherAmp: 0,           // screen-space ordered dither on L after sampling (0 = off: the look is not judged yet)
});

/** The single place a feature becomes GPU parameters: lab and game both go through here. */
export function buildPack(feature, colourMode, shapeVersion = DEFAULT_SHAPE_VERSION) {
  return renderPack(featureHistory(feature), { colourMode, shapeVersion });
}

/** Hash of the parts of a pack the BAKE depends on (colour mode is applied at composite time). */
export function bakeHashOf(pack) {
  return packHash({ ...pack, colourMode: null, realistic: null });
}

/** (tan(fov/2) * aspect, tan(fov/2)) — the volume's ray basis. Independent of near/far on purpose. */
export function cameraTanHalf(camera) {
  const t = Math.tan((camera.fov * Math.PI) / 360);
  return [t * camera.aspect, t];
}

/** Bytes of one RGBA16F texel. */
const TEXEL_BYTES = 8;

/** EXT_disjoint_timer_query_webgl2 wrapper: begin/end named spans, results arrive a few frames later. */
class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    this.pending = [];
    this.ms = {};
    this.active = null;
  }
  get available() { return !!this.ext; }
  begin(name) {
    if (!this.ext || this.active) return;
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = { name, q };
  }
  end() {
    if (!this.ext || !this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }
  poll() {
    if (!this.ext) return;
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    const keep = [];
    for (const p of this.pending) {
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) { keep.push(p); continue; }
      if (!disjoint) {
        const ms = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
        const prev = this.ms[p.name];
        this.ms[p.name] = prev == null ? ms : prev * 0.9 + ms * 0.1; // EMA
        this.ms[p.name + 'Last'] = ms;
      }
      gl.deleteQuery(p.q);
    }
    this.pending = keep.length > 32 ? keep.slice(-32) : keep;
  }
  dispose() {
    if (!this.ext) return;
    for (const p of this.pending) this.gl.deleteQuery(p.q);
    this.pending = [];
  }
}

export class GalacticController {
  constructor(ctx = {}) {
    this.ctx = { ...DEFAULT_CTX, ...ctx };
    this._enabled = true;
    this._dust = true;
    this._mode = DEFAULT_COLOUR_MODE;
    this._shape = DEFAULT_SHAPE_VERSION;
    this._feature = null;
    this._pinned = null;
    this._observerKpc = null;
    this._observerOverridePc = null;
    this._pack = null;
    this._hash = null;
    this._lastFrameMs = null;
    this._liveTarget = null;
    this._sets = null;
    this._bakeSupported = null; // decided on the first frame (needs the renderer)
    this._timer = null;
    this._starDustState = 'off:no-layer';
    this._prepared = null;      // {feature, observerKpc}: a sky being baked before it goes live (never drawn)
    this._liveReq = null;       // {key, gen}: the newest bake request for the LIVE target
    this._stagedReq = null;     // {key, gen}: the newest bake request for the prepared target
    this.onPublishChange = null; // SkyRenderer: rebuild billboards when the drawn feature changes
    const N = this.ctx.bakeFaceSize;
    this._tilesPerFace = Math.ceil(N / this.ctx.bakeRowsPerTile);
    this.scheduler = new BakeScheduler({
      tilesPerBake: 6 * this._tilesPerFace,
      timeoutMs: this.ctx.bakeTimeoutMs,
      holdTimeoutMs: this.ctx.holdTimeoutMs,
    });
    this._build();
  }

  // ── Target selection ─────────────────────────────────────────────────────────────────────────────────

  /** Draw `feature` as seen from `observerGalacticPosKpc` (galactocentric kpc, CPU doubles). */
  setTarget(feature, observerGalacticPosKpc) {
    this._feature = feature && feature.type === 'emission-nebula' ? feature : null;
    if (observerGalacticPosKpc) this._observerKpc = { ...observerGalacticPosKpc };
    this.refresh();
  }

  /** Move the observer without changing the feature (lab distance slider). Requests a new bake. */
  setObserver(observerGalacticPosKpc) {
    this._observerKpc = { ...observerGalacticPosKpc };
    this.refresh();
  }

  /** Debug/lab: force the feature regardless of what the sky offers (null = back to automatic). */
  pinFeature(feature) {
    this._pinned = feature || null;
  }

  /** Debug: place the observer at a fixed offset from the nebula centre, in pc (null = use the real one). */
  setObserverOverridePc(relPc) {
    this._observerOverridePc = relPc ? relPc.slice() : null;
    this.refresh();
  }

  /** SkyRenderer.prepareForPosition*: the next sky's features are known → start baking it now (FOLD).
   *  The prepared sky is its OWN target and never replaces the live one: a refresh (shape/colour flip, slider)
   *  before it goes live must not re-aim the drawn volume at a sky that is not on screen. */
  prepare(features, playerPosKpc) {
    const f = this._pinned || pickVolumeFeature(features);
    this._prepared = f && f.type === 'emission-nebula' && playerPosKpc ? { feature: f, observerKpc: { ...playerPosKpc } } : null;
    this._stagedReq = null;
    this._requestPrepared();
    this._applyEvents();
  }

  /** Called by SkyRenderer whenever it (re)builds the sky. Returns the feature key the billboard layer must
   *  skip — the feature the volume is DRAWING right now — or null. */
  onSkyFeatures(features, playerPosKpc) {
    this.setTarget(this._pinned || pickVolumeFeature(features), playerPosKpc);
    // This sky is now live: a prepared (staged) bake of it may be shown once complete.
    const j = this.scheduler.latest();
    if (j && j.staged && this._liveReq && this._liveReq.gen === j.gen) this.scheduler.commit(j.gen);
    this._prepared = null;
    this._stagedReq = null;
    this._applyEvents();
    return this.skipKey();
  }

  /** The key of the feature currently drawn as a volume (its billboard must be skipped), or null. */
  skipKey() {
    if (!this.isActive()) return null;
    if (this._source() === 'live') return this.featureKey;
    return this.scheduler.published ? this.scheduler.published.snapshot.featureKey : null;
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
  isActive() {
    if (!this._enabled) return false;
    return this._source() === 'live' ? !!this._pack : !!this.scheduler.published;
  }

  /** AC-7 A/B: dust off = no sky·T and no star dimming (emission unchanged). */
  setDust(on) { this._dust = !!on; }
  getDust() { return this._dust; }

  /** 'bake' | 'live'. Live is the step-1 per-frame march — a debug/reference path. */
  setSource(source) {
    if (source !== 'bake' && source !== 'live') throw new Error(`setSource: '${source}'`);
    this.ctx.source = source;
    if (source === 'bake' && this._liveTarget) { this._liveTarget.dispose(); this._liveTarget = null; }
    if (this.onPublishChange) this.onPublishChange();
  }

  _source() {
    return this.ctx.source === 'live' || this._bakeSupported === false ? 'live' : 'bake';
  }

  setColourMode(mode) {
    if (!COLOUR_MODES.includes(mode)) throw new Error(`setColourMode: '${mode}' is not one of ${COLOUR_MODES.join(', ')}`);
    this._mode = mode;
    this.refresh(); // the bake hash ignores colour mode: no re-bake, only the composite uniforms change
  }
  getColourMode() { return this._mode; }

  /** A/B of the cloud shape model: 1 = the step-1 field (reads as a ring), 2 = reshaped (blister, ionization front,
   *  neutral dust, lobed outline). The shape changes the field, so the pack hash changes and the sky re-bakes. */
  setShapeVersion(v) {
    const n = Number(v);
    if (!SHAPE_VERSIONS.includes(n)) throw new Error(`setShapeVersion: '${v}' is not one of ${SHAPE_VERSIONS.join(', ')}`);
    this._shape = n;
    this.refresh();
  }
  getShapeVersion() { return this._shape; }

  /** Debug (AC-9): hold every bake tile — a deliberately delayed bake. */
  setBakeStalled(on) { this.scheduler.stalled = !!on; }

  /** Warp gating (SkyRenderer): hold = keep the published sky until the swap point. */
  setWarpHold(on) {
    this.scheduler.setHold(on);
    this._applyEvents();
  }

  /** Rebuild the pack (history → params), request a bake if anything the bake depends on changed. */
  refresh() {
    this._pack = this._feature ? buildPack(this._feature, this._mode, this._shape) : null;
    this._hash = this._pack ? packHash(this._pack) : null;
    if (this._pack) {
      this._uploadPack(this._pack);
      this._uploadDisplay(this._pack);
    }
    this._uploadObserver(this.observerRelPc());
    this._requestBake();
  }

  _requestBake() {
    const rel = this.observerRelPc();
    if (!this._pack || !rel) {
      if (this.scheduler.job || this.scheduler.published) this.scheduler.clear();
      this._liveReq = null;
      this._stagedReq = null;
      this._applyEvents();
      return;
    }
    this._liveReq = this._request(this._feature, this._pack, rel, this._observerOverridePc ? null : this._observerKpc, false, this._liveReq);
    // A new live request may have superseded the prepared sky's bake: re-queue it (it waits behind the live one).
    this._requestPrepared();
    this._applyEvents();
  }

  _requestPrepared() {
    const p = this._prepared;
    if (!p) return;
    const c = p.feature.position, o = p.observerKpc;
    const rel = [(o.x - c.x) * 1000, (o.y - c.y) * 1000, (o.z - c.z) * 1000];
    this._stagedReq = this._request(p.feature, buildPack(p.feature, this._mode, this._shape), rel, o, true, this._stagedReq);
  }

  /** Is generation `gen` still requested (queued, baking, ready or on screen)? */
  _alive(gen) {
    const s = this.scheduler;
    if (s.deferred && s.deferred.gen === gen) return true;
    if (s.published && s.published.gen === gen) return true;
    return !!(s.job && s.job.gen === gen && s.job.state !== 'failed');
  }

  /** Request a bake unless the same sky is already requested and alive. Returns the {key, gen} memo. */
  _request(feature, pack, rel, observerKpc, staged, memo) {
    const bakeHash = bakeHashOf(pack);
    const key = `${featureKeyOf(feature)}|${bakeHash}|${rel.join(',')}|${this.ctx.steps}`;
    if (memo && memo.key === key && this._alive(memo.gen)) return memo;
    if (!staged) {
      // The sky that just went live may be exactly the one prepared (staged) or already on screen: adopt that
      // bake rather than redoing it — unless a different live bake is pending, which would replace it.
      const s = this.scheduler, j = s.latest();
      if (j && j.snapshot.key === key && j.state !== 'failed') return { key, gen: j.gen };
      const otherLivePending = s.job && !s.job.staged && s.job.state !== 'failed' && s.job.state !== 'published';
      if (s.published && s.published.snapshot.key === key && !otherLivePending) return { key, gen: s.published.gen };
    }
    const gen = this.scheduler.request({
      key,
      feature,
      featureKey: featureKeyOf(feature),
      pack: JSON.parse(JSON.stringify(pack)),
      bakeHash,
      observerRelPc: rel,
      observerKpc: observerKpc ? { ...observerKpc } : null,
      steps: Math.min(this.ctx.steps, MAX_STEPS),
    }, { staged });
    return { key, gen };
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
      uShape: u(1), uInvAxes: u(new THREE.Vector3(1, 1, 1)), uLobeAmp: u(0), uLobeFreq: u(2), uLobeOffset: u(new THREE.Vector3()),
      uOpenDir: u(new THREE.Vector3(0, 0, 1)), uBlister: u(0), uWallGradient: u(0), uFrontRadius: u(1),
      uFront: u(new THREE.Vector2(0.7, 1.3)), uFrontClump: u(0), uDustDestroy: u(0), uDiffuse: u(0.5),
      uTanHalf: u(new THREE.Vector2(1, 1)), uCameraWorld: u(new THREE.Matrix4()),
      uAtlasN: u(this.ctx.bakeFaceSize),
    };
    const pass = { glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VERT, depthTest: false, depthWrite: false };
    this._volumeMaterial = new THREE.ShaderMaterial({ ...pass, fragmentShader: CLOUD_VOLUME_FRAG, uniforms: this._volumeUniforms });
    this._bakeMaterial = new THREE.ShaderMaterial({ ...pass, fragmentShader: CLOUD_BAKE_FRAG, uniforms: this._volumeUniforms });

    const compUniforms = {
      uL: u(null), uT: u(null), uAtlasLT: u(null), uAtlasN: u(this.ctx.bakeFaceSize), uSource: u(1),
      uCompExtRGB: u(new THREE.Vector3(1, 1, 1)), uCompTanHalf: u(new THREE.Vector2(1, 1)),
      uCompCameraWorld: u(new THREE.Matrix4()), uLowRes: u(new THREE.Vector2(1, 1)), uDitherAmp: u(0), uPass: u(0),
      uColourMode: u(0), uRealTint: u(new THREE.Vector3(1, 1, 1)), uRealSat: u(new THREE.Vector4(0, 0.5, 0.1, 0.3)),
    };
    const base = { ...pass, fragmentShader: CLOUD_COMPOSITE_FRAG, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation };
    // Pass 0: dst = dst * T (per channel). Pass 1: dst = dst + L. Alpha is left as it is.
    this._multiplyMaterial = new THREE.ShaderMaterial({ ...base, uniforms: compUniforms,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    this._addUniforms = { ...compUniforms, uPass: u(1) };
    this._addMaterial = new THREE.ShaderMaterial({ ...base, uniforms: this._addUniforms,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    this._compUniforms = compUniforms;

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
    const sh = p.shapeVersion === 2 ? p.shape : null;
    U.uShape.value = sh ? 2 : 1;
    if (sh) {
      U.uInvAxes.value.fromArray(sh.invAxes);
      U.uLobeAmp.value = sh.lobeAmp;
      U.uLobeFreq.value = sh.lobeFreq;
      U.uLobeOffset.value.fromArray(sh.lobeOffset);
      U.uOpenDir.value.fromArray(sh.openDir);
      U.uBlister.value = sh.blister;
      U.uWallGradient.value = sh.wallGradient;
      U.uFrontRadius.value = sh.frontRadiusPc;
      U.uFront.value.fromArray(sh.front);
      U.uFrontClump.value = sh.frontClump;
      U.uDustDestroy.value = sh.dustDestroy;
      U.uDiffuse.value = sh.diffuse;
    }
  }

  /** Composite-time display parameters (colour mode + the extinction colour T is rebuilt from). */
  _uploadDisplay(p) {
    for (const C of [this._compUniforms, this._addUniforms]) {
      C.uColourMode.value = this._mode === 'realistic' ? 1 : 0;
      C.uRealTint.value.fromArray(p.realistic.tint);
      C.uRealSat.value.set(p.realistic.satMin, p.realistic.satMax, p.realistic.lumLo, p.realistic.lumHi);
      C.uCompExtRGB.value.fromArray(p.extinction.rgb);
    }
  }

  _uploadObserver(rel) {
    if (rel) this._volumeUniforms.uObserverPc.value.fromArray(rel);
  }

  _decideSupport(renderer) {
    if (this._bakeSupported !== null) return;
    const ext = renderer.extensions;
    this._bakeSupported = !!(ext && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')));
    if (!this._bakeSupported) console.warn('[galactic] no half-float render targets: falling back to the live march');
    this._timer = new GpuTimer(renderer.getContext ? renderer.getContext() : null);
  }

  _ensureSets() {
    if (this._sets) return;
    const [w, h] = atlasSize(this.ctx.bakeFaceSize);
    const make = () => new THREE.WebGLRenderTarget(w, h, {
      count: 2,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      generateMipmaps: false,
    });
    this._sets = [make(), make()];
  }

  _ensureLiveTarget(w, h) {
    if (this._liveTarget && this._liveTarget.width === w && this._liveTarget.height === h) return;
    if (this._liveTarget) this._liveTarget.dispose();
    this._liveTarget = new THREE.WebGLRenderTarget(w, h, {
      count: 2,
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
    });
    for (const C of [this._compUniforms, this._addUniforms]) {
      C.uL.value = this._liveTarget.textures[0];
      C.uT.value = this._liveTarget.textures[1];
    }
  }

  /** Turn scheduler events into GPU-side state (atlas bindings) and tell the sky about the drawn feature. */
  _applyEvents() {
    const ev = this.scheduler.drainEvents();
    let changed = false;
    for (const e of ev) if (e.type === 'publish' || e.type === 'unpublish') changed = true;
    const pub = this.scheduler.published;
    if (pub && this._sets) {
      for (const C of [this._compUniforms, this._addUniforms]) C.uAtlasLT.value = this._sets[pub.set].textures[0];
    }
    if (changed && this.onPublishChange) this.onPublishChange();
  }

  /**
   * Every frame, before the sky pass (whether or not the volume is drawing): run this frame's bake tiles,
   * collect GPU timings, apply publications. Restores the render target to null.
   */
  preRender(renderer) {
    this._decideSupport(renderer);
    if (this._timer) this._timer.poll();
    if (this._source() === 'live' && this._bakeSupported === false) return;
    const tiles = this.scheduler.nextTiles(this.ctx.bakeTilesPerFrame);
    if (tiles.length) {
      this._ensureSets();
      const N = this.ctx.bakeFaceSize, rows = this.ctx.bakeRowsPerTile;
      const prevAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      this._quad.material = this._bakeMaterial;
      for (const t of tiles) {
        // The job's frozen snapshot, not the controller's current state (it may have moved on).
        this._uploadPack(t.snapshot.pack);
        this._uploadObserver(t.snapshot.observerRelPc);
        this._volumeUniforms.uSteps.value = t.snapshot.steps;
        const face = Math.floor(t.tile / this._tilesPerFace), band = t.tile % this._tilesPerFace;
        const col = face % ATLAS_COLS, row = Math.floor(face / ATLAS_COLS);
        const y0 = band * rows, h = Math.min(rows, N - y0);
        const target = this._sets[t.set];
        target.viewport.set(col * N, row * N + y0, N, h);
        target.scissor.set(col * N, row * N + y0, N, h);
        target.scissorTest = true;
        renderer.setRenderTarget(target);
        if (this._timer) this._timer.begin('bake');
        renderer.render(this._scene, this._orthoCam);
        if (this._timer) this._timer.end();
        target.scissorTest = false;
        target.viewport.set(0, 0, target.width, target.height);
        target.scissor.set(0, 0, target.width, target.height);
        this.scheduler.tileDone(t.gen, t.tile);
      }
      renderer.setRenderTarget(null);
      renderer.autoClear = prevAutoClear;
      // Back to the controller's current request for the live path / probes.
      if (this._pack) this._uploadPack(this._pack);
      this._uploadObserver(this.observerRelPc());
      this._volumeUniforms.uSteps.value = Math.min(this.ctx.steps, MAX_STEPS);
    }
    this._applyEvents();
  }

  _setCamera(camera, skyTarget, ps) {
    camera.updateMatrixWorld();
    const th = cameraTanHalf(camera);
    const lw = Math.ceil(skyTarget.width / ps), lh = Math.ceil(skyTarget.height / ps);
    for (const C of [this._compUniforms, this._addUniforms]) {
      C.uCompTanHalf.value.set(th[0], th[1]);
      C.uCompCameraWorld.value.copy(camera.matrixWorld);
      C.uLowRes.value.set(lw, lh);
      C.uDitherAmp.value = this.ctx.ditherAmp;
      C.uSource.value = this._source() === 'live' ? 0 : 1;
      C.uAtlasN.value = this.ctx.bakeFaceSize;
    }
    this._volumeUniforms.uTanHalf.value.set(th[0], th[1]);
    this._volumeUniforms.uCameraWorld.value.copy(camera.matrixWorld);
    return [lw, lh];
  }

  /**
   * Sky pass, part 1 (after glow, BEFORE the stars): live march if in live mode, then sky *= T.
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera — directions only
   * @param {THREE.WebGLRenderTarget} skyTarget
   * @param {number} [pixelScale] — the RetroRenderer's pixelScale (volume samples the scene's low-res grid)
   */
  renderBeforeStars(renderer, camera, skyTarget, pixelScale = this.ctx.volumePixelScale) {
    if (!this.isActive() || !skyTarget) return;
    const t0 = performance.now();
    const ps = Math.max(1, pixelScale || 1);
    const [lw, lh] = this._setCamera(camera, skyTarget, ps);
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    if (this._source() === 'live') {
      this._ensureLiveTarget(lw, lh);
      this._volumeUniforms.uSteps.value = Math.min(this.ctx.steps, MAX_STEPS);
      renderer.setRenderTarget(this._liveTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      this._quad.material = this._volumeMaterial;
      if (this._timer) this._timer.begin('live');
      renderer.render(this._scene, this._orthoCam);
      if (this._timer) this._timer.end();
    }
    if (this._dust) {
      renderer.setRenderTarget(skyTarget);
      this._quad.material = this._multiplyMaterial;
      if (this._timer) this._timer.begin('compositeMul');
      renderer.render(this._scene, this._orthoCam);
      if (this._timer) this._timer.end();
    }
    renderer.setRenderTarget(skyTarget);
    renderer.autoClear = prevAutoClear;
    this._lastFrameMs = performance.now() - t0;
  }

  /** Sky pass, part 3 (after the stars): sky += L (colour mode applied here). */
  renderAfterStars(renderer, camera, skyTarget) {
    if (!this.isActive() || !skyTarget) return;
    const t0 = performance.now();
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(skyTarget);
    this._quad.material = this._addMaterial;
    if (this._timer) this._timer.begin('compositeAdd');
    renderer.render(this._scene, this._orthoCam);
    if (this._timer) this._timer.end();
    renderer.autoClear = prevAutoClear;
    this._lastFrameMs += performance.now() - t0;
  }

  /** Step-1 entry point kept for callers that draw the volume in one go (no star split). */
  render(renderer, camera, skyTarget, pixelScale) {
    this.renderBeforeStars(renderer, camera, skyTarget, pixelScale);
    this.renderAfterStars(renderer, camera, skyTarget);
  }

  /**
   * Point the star layers' dust uniforms at the published bake. A layer is dimmed only when the bake was made
   * from THAT layer's observer (its star distances are measured from there); otherwise its dust is off.
   * @param {Array<{mesh: THREE.Points, observerKpc?: object}>} layers
   */
  bindStarDust(layers) {
    const pub = this.scheduler.published;
    let state = 'on';
    if (!this.isActive()) state = 'off:volume-inactive';
    else if (!this._dust) state = 'off:dust-switched-off';
    else if (this._source() === 'live' && !pub) state = 'off:no-bake';
    else if (!pub) state = 'off:no-bake';
    const counts = { on: 0, mismatch: 0 };
    for (const layer of layers) {
      const U = layer && layer.mesh && layer.mesh.material && layer.mesh.material.uniforms;
      if (!U || !U.uDustOn) continue;
      let on = state === 'on';
      if (on) {
        const o = layer.observerKpc, s = pub.snapshot.observerKpc;
        if (!o || !s || Math.abs(o.x - s.x) > 1e-9 || Math.abs(o.y - s.y) > 1e-9 || Math.abs(o.z - s.z) > 1e-9) {
          on = false;
          counts.mismatch++;
        }
      }
      U.uDustOn.value = on ? 1 : 0;
      if (!on) continue;
      counts.on++;
      const p = pub.snapshot.pack, c = pub.snapshot.feature.position, o = layer.observerKpc;
      U.uDustLT.value = this._sets[pub.set].textures[0];
      U.uDustG.value = this._sets[pub.set].textures[1];
      U.uDustN.value = this.ctx.bakeFaceSize;
      U.uDustObserverPc.value.set((o.x - c.x) * 1000, (o.y - c.y) * 1000, (o.z - c.z) * 1000);
      U.uDustBound.value = p.boundRadiusPc;
      U.uDustExtRGB.value.fromArray(p.extinction.rgb);
    }
    if (state === 'on') state = counts.on > 0 ? 'on' : (counts.mismatch > 0 ? 'off:observer-mismatch' : 'off:no-layer');
    this._starDustState = state;
  }

  /**
   * Live probe: GPU vs the CPU twin for the ray through screen point (u, v). In bake mode the GPU value is the
   * bilinear read of the published atlas (the 2x2 texels read back), in live mode the low-res target pixel.
   */
  probe(renderer, camera, u = 0.5, v = 0.5) {
    const pack = this._source() === 'bake' ? this.scheduler.published?.snapshot.pack : this._pack;
    if (!pack) return null;
    const rel = this._source() === 'bake' ? this.scheduler.published.snapshot.observerRelPc : this.observerRelPc();
    const steps = Math.min(this.ctx.steps, MAX_STEPS);
    camera.updateMatrixWorld();
    const th = cameraTanHalf(camera);
    if (this._source() === 'live') {
      if (!this._liveTarget) return null;
      const w = this._liveTarget.width, h = this._liveTarget.height;
      const px = Math.min(w - 1, Math.floor(u * w)), py = Math.min(h - 1, Math.floor(v * h));
      const read = (i) => {
        const buf = new Uint16Array(4);
        renderer.readRenderTargetPixels(this._liveTarget, px, py, 1, 1, buf, undefined, i);
        return Array.from(buf.slice(0, 3), (x) => THREE.DataUtils.fromHalfFloat(x));
      };
      const dir = new THREE.Vector3((((px + 0.5) / w) * 2 - 1) * th[0], (((py + 0.5) / h) * 2 - 1) * th[1], -1).normalize().transformDirection(camera.matrixWorld);
      const cpu = integrateRay(pack, rel, dir.toArray(), steps);
      return { source: 'live', pixel: [px, py], gpu: { L: read(0), T: read(1) }, cpu: { L: cpu.L, T: cpu.T, display: applyColourMode(cpu.L, { ...pack, colourMode: this._mode }) } };
    }
    const dir = new THREE.Vector3((u * 2 - 1) * th[0], (v * 2 - 1) * th[1], -1).normalize().transformDirection(camera.matrixWorld).toArray();
    const gpu = this.readAtlas(renderer, dir);
    const cpu = integrateRay(pack, rel, dir, steps);
    const ext = pack.extinction.rgb;
    return {
      source: 'bake',
      direction: dir,
      atlasUV: atlasUV(dir, this.ctx.bakeFaceSize),
      gpu: { L: gpu.L, tau: gpu.tau, T: ext.map((e) => Math.exp(-gpu.tau * e)), G: gpu.G },
      cpu: { L: cpu.L, tau: cpu.tau, T: cpu.T, G: cpu.G },
    };
  }

  /** Bilinear read of the published atlas at a direction (2x2 texel readback; debug only — stalls the GPU). */
  readAtlas(renderer, dir) {
    const pub = this.scheduler.published;
    if (!pub) return null;
    const N = this.ctx.bakeFaceSize;
    const { face, x, y } = texelCoord(dir, N);
    const i0 = Math.min(N - 2, Math.floor(x)), j0 = Math.min(N - 2, Math.floor(y));
    const fx = x - i0, fy = y - j0;
    const col = face % ATLAS_COLS, row = Math.floor(face / ATLAS_COLS);
    const read = (ti) => {
      const buf = new Uint16Array(16);
      renderer.readRenderTargetPixels(this._sets[pub.set], col * N + i0, row * N + j0, 2, 2, buf, undefined, ti);
      const v = Array.from(buf, (h) => THREE.DataUtils.fromHalfFloat(h));
      const at = (dx, dy, c) => v[(dy * 2 + dx) * 4 + c];
      return [0, 1, 2, 3].map((c) => (at(0, 0, c) * (1 - fx) + at(1, 0, c) * fx) * (1 - fy) + (at(0, 1, c) * (1 - fx) + at(1, 1, c) * fx) * fy);
    };
    const lt = read(0), g = read(1);
    return { L: lt.slice(0, 3), tau: lt[3], G: g };
  }

  /**
   * Bake vs live reference ON THE GPU'S OWN BAKE: `n` directions across the current view, atlas read-back vs the
   * CPU twin marching the exact ray. Errors in luminance, normalised by the brightest sample (same metric as
   * tests/galactic-bake.test.js).
   */
  compareBakeToLive(renderer, camera, n = 64) {
    const pub = this.scheduler.published;
    if (!pub) return null;
    const errs = [], errT = [];
    let maxY = 0;
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const rows = [];
    const side = Math.max(2, Math.round(Math.sqrt(n)));
    for (let iy = 0; iy < side; iy++) for (let ix = 0; ix < side; ix++) {
      const p = this.probe(renderer, camera, (ix + 0.5) / side, (iy + 0.5) / side);
      if (!p) continue;
      rows.push(p);
      maxY = Math.max(maxY, lum(p.cpu.L));
    }
    for (const p of rows) {
      errs.push(Math.abs(lum(p.gpu.L) - lum(p.cpu.L)) / Math.max(maxY, 1e-9));
      errT.push(Math.max(...p.gpu.T.map((t, c) => Math.abs(t - p.cpu.T[c]))));
    }
    const sorted = errs.slice().sort((a, b) => a - b);
    const rms = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / Math.max(errs.length, 1));
    return { samples: errs.length, rmsL: rms, p99L: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))], maxT: Math.max(...errT) };
  }

  textureBytes() {
    let b = 0;
    if (this._sets) for (const s of this._sets) b += s.width * s.height * TEXEL_BYTES * 2;
    if (this._liveTarget) b += this._liveTarget.width * this._liveTarget.height * TEXEL_BYTES * 2;
    return b;
  }

  snapshot() {
    const rel = this.observerRelPc();
    const r = this._pack ? this._pack.radiusPc : null;
    const st = this.scheduler.status(this._tilesPerFace);
    const pub = this.scheduler.published;
    const ms = this._timer ? this._timer.ms : {};
    const comp = ms.compositeMul != null || ms.compositeAdd != null ? (ms.compositeMul || 0) + (ms.compositeAdd || 0) : null;
    return {
      ctx: this.ctx.label,
      enabled: this._enabled,
      active: this.isActive(),
      source: this._source(),
      mode: this._mode,
      shape: this._shape,                      // 1 = step-1 field (ring), 2 = reshaped (R1-R4)
      dust: this._dust,
      featureId: this.featureKey,
      drawnFeatureId: this.skipKey(),
      pinned: !!this._pinned,
      radiusPc: r,
      boundRadiusPc: this._pack ? this._pack.boundRadiusPc : null,
      observerRelPc: rel,
      distancePc: rel ? Math.hypot(rel[0], rel[1], rel[2]) : null,
      insideCloud: rel && r ? Math.hypot(rel[0], rel[1], rel[2]) < r : false,
      paramsHash: this._hash,
      steps: Math.min(this.ctx.steps, MAX_STEPS),
      bake: {
        state: st.state,                       // idle | baking | ready (waiting for the warp's swap point) | failed
        faces: `${st.facesDone}/6`,
        tiles: `${st.tilesDone}/${st.tilesPerBake}`,
        generation: st.generation,             // the newest request's token
        publishedGeneration: st.publishedGeneration, // the token of the sky on screen
        publishedFeatureId: pub ? pub.snapshot.featureKey : null,
        publishedObserverRelPc: pub ? pub.snapshot.observerRelPc : null,
        hold: st.hold,
        staged: st.staged,                     // prepared for a sky that is not live yet
        stalled: st.stalled,
        ageMs: st.ageMs,
        faceSize: this.ctx.bakeFaceSize,
        atlas: atlasSize(this.ctx.bakeFaceSize),
        supported: this._bakeSupported,
        stats: st.stats,
      },
      starDust: this._starDustState,
      textureBytes: this.textureBytes(),
      gpuMs: this._timer && this._timer.available
        ? { composite: comp, bakeTile: ms.bake ?? null, bakeTileLast: ms.bakeLast ?? null, live: ms.live ?? null }
        : null,
      lastFrameMs: this._lastFrameMs, // CPU submit time of the composite
    };
  }

  dispose() {
    if (this._liveTarget) this._liveTarget.dispose();
    this._liveTarget = null;
    if (this._sets) for (const s of this._sets) s.dispose();
    this._sets = null;
    if (this._timer) this._timer.dispose();
    this._volumeMaterial.dispose();
    this._bakeMaterial.dispose();
    this._multiplyMaterial.dispose();
    this._addMaterial.dispose();
    this._quad.geometry.dispose();
  }
}

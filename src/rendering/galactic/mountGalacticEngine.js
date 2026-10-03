// mountGalacticEngine.js — wires the Galactic Engine controller into a SkyRenderer + RetroRenderer pair.
//
// The game calls it once at boot (behind the 'wd.galacticEngine' flag); the cloud lab calls the SAME
// function with `force: true`, so the lab runs the production wiring, keys and debug hooks.
//
// Keys (free in main.js as of 2026-10-03 — N and M are taken):
//   J — A/B: volume ↔ the old billboard for the volume's feature
//   U — colour mode: realistic ↔ photo

import { GalacticController, DEFAULT_CTX } from './GalacticController.js';
import { galacticEngineFlag } from '../../galactic/galacticEngineFlag.js';
import { findCloudSubjects, OBSERVER_PRESETS, presetDistancePc, approachDirection } from '../../galactic/subjects.js';
import { COLOUR_MODES } from '../../galactic/renderPacks.js';
import { starTransmittance } from '../../galactic/cubeAtlas.js';
import { cameraTanHalf } from './GalacticController.js';
import * as THREE from 'three';

export const AB_KEY = 'KeyJ';
export const COLOUR_KEY = 'KeyU';

/**
 * @param {{skyRenderer, retroRenderer, galacticMap?, ctx?: object, force?: boolean, win?: Window}} opts
 * @returns {object|null} the debug API (also at window._galactic), or null when the flag is off
 */
export function mountGalacticEngine({ skyRenderer, retroRenderer, galacticMap = null, ctx = {}, force = false, win = window }) {
  const flag = force ? { enabled: true, source: 'forced' } : galacticEngineFlag(win);
  if (!flag.enabled) {
    // Off: nothing is attached, the sky is untouched. Only a read-only note for live checks.
    win._galactic = { flag, snapshot: () => ({ flag, mounted: false }) };
    return null;
  }

  const controller = new GalacticController({ ...DEFAULT_CTX, ...ctx });
  retroRenderer.setSkyVolume(controller);
  skyRenderer.setVolumeController(controller);

  const camera = () => retroRenderer.camera;
  const setEnabled = (on) => { controller.setEnabled(on); skyRenderer.refreshVolumeFeature(); return controller.snapshot(); };
  const setColourMode = (mode) => { controller.setColourMode(mode); return controller.snapshot(); };
  const toggleAB = () => setEnabled(!controller.isEnabled());
  const toggleColour = () => setColourMode(controller.getColourMode() === 'photo' ? 'realistic' : 'photo');

  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    if (e.code === AB_KEY) console.log('[galactic] A/B →', toggleAB().active ? 'volume' : 'billboard');
    else if (e.code === COLOUR_KEY) console.log('[galactic] colour →', toggleColour().mode);
  };
  win.addEventListener('keydown', onKey);

  const api = {
    flag,
    controller,
    skyRenderer,     // debug access for live checks (pixel read-backs of retroRenderer.bgTarget)
    retroRenderer,
    keys: { ab: AB_KEY, colour: COLOUR_KEY },
    colourModes: COLOUR_MODES,
    snapshot: () => ({ flag, mounted: true, ...controller.snapshot() }),
    setEnabled,
    setColourMode,
    toggleAB,
    toggleColour,
    /** Force the volume onto a subject ('procedural' | 'orion' | a feature record | null = automatic). */
    pin(subject) {
      let f = subject;
      if (typeof subject === 'string') {
        if (!galacticMap) throw new Error('pin(name) needs galacticMap');
        f = findCloudSubjects(galacticMap)[subject];
        if (!f) throw new Error(`no subject '${subject}'`);
      }
      controller.pinFeature(f || null);
      skyRenderer.reselectVolumeFeature();
      return api.snapshot();
    },
    /** Place the observer on the fixed approach line (preset name or pc from the centre); null = real position.
     *  Moves the volume's viewpoint only — the stars stay where the system is (debug hook for AC-5 sweeps). */
    placeObserver(presetOrPc) {
      if (presetOrPc == null) { controller.setObserverOverridePc(null); return api.snapshot(); }
      const feature = controller.feature;
      if (!feature) throw new Error('no volume feature');
      const preset = typeof presetOrPc === 'string' ? OBSERVER_PRESETS.find((p) => p.name === presetOrPc) : null;
      const pc = preset ? presetDistancePc(preset, feature) : Number(presetOrPc);
      controller.setObserverOverridePc(approachDirection(feature).map((c) => c * pc));
      return api.snapshot();
    },
    presets: OBSERVER_PRESETS.map((p) => p.name),
    /** GPU vs CPU twin for the ray through screen point (u, v) in 0..1 (needs a rendered frame). In bake mode
     *  the GPU value is the published atlas read back at that direction. */
    probe: (u = 0.5, v = 0.5) => controller.probe(retroRenderer.renderer, camera(), u, v),
    /** Baked atlas vs the CPU twin's exact ray over an n-point grid of the current view: {rmsL, p99L, maxT}. */
    compareBake: (n = 64) => controller.compareBakeToLive(retroRenderer.renderer, camera(), n),
    /** AC-7 A/B: dust on/off (off = no sky·T, no star dimming; emission unchanged). */
    setDust(on) { controller.setDust(on); return api.snapshot(); },
    /** 'bake' (production) | 'live' (debug reference: the step-1 per-frame march). */
    setSource(source) { controller.setSource(source); return api.snapshot(); },
    /** AC-9: hold every bake tile (a deliberately delayed bake); false resumes. */
    stallBake(on = true) { controller.setBakeStalled(on); return api.snapshot(); },
    /** Star-dust probe: the transmittance the star layer applies to the star nearest screen point (u, v). */
    starDust(u = 0.5, v = 0.5) {
      const cam = camera();
      const th = cameraTanHalf(cam);
      const dir = new THREE.Vector3((u * 2 - 1) * th[0], (v * 2 - 1) * th[1], -1).normalize().transformDirection(cam.matrixWorld);
      const layer = skyRenderer._starfieldLayer;
      const hit = layer ? layer.findNearestStar(dir) : null;
      if (!hit) return null;
      const dist = layer.mesh.geometry.attributes.aDistPc ? layer.mesh.geometry.attributes.aDistPc.array[hit.index] : null;
      const atlas = controller.readAtlas(retroRenderer.renderer, hit.direction.toArray());
      const pub = controller.scheduler.published;
      if (!atlas || !pub || !layer.observerKpc) return { index: hit.index, distPc: dist, transmittance: null, starDust: controller.snapshot().starDust };
      const c = pub.snapshot.feature.position, o = layer.observerKpc;
      const obs = [(o.x - c.x) * 1000, (o.y - c.y) * 1000, (o.z - c.z) * 1000];
      const T = starTransmittance(hit.direction.toArray(), dist, atlas.tau, atlas.G, obs, pub.snapshot.pack.boundRadiusPc, pub.snapshot.pack.extinction.rgb);
      return { index: hit.index, distPc: dist, cloudDistancePc: Math.hypot(...obs), transmittance: T, starDust: controller.snapshot().starDust };
    },
    dispose() {
      win.removeEventListener('keydown', onKey);
      retroRenderer.setSkyVolume(null);
      skyRenderer.setVolumeController(null);
      controller.dispose();
    },
  };
  win._galactic = api;
  console.log(`[galactic] mounted (${flag.source}); keys: J = volume/billboard A/B, U = realistic/photo`);
  return api;
}

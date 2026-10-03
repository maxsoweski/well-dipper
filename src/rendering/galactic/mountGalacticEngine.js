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
    /** GPU vs CPU twin for the ray through screen point (u, v) in 0..1 (needs a rendered frame). */
    probe: (u = 0.5, v = 0.5) => controller.probe(retroRenderer.renderer, camera(), u, v),
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

/**
 * DestinationPicker — classifies a warp destination type.
 *
 * The legacy random "dice-roll" deep-sky arrival was removed
 * (deep-sky-cleanup-2026-05-29): every warp now resolves to a real
 * star-system or an explicitly-chosen target. The only surviving deep-sky
 * arrival is the external-galaxy click Easter egg, whose distant-view spawn
 * path uses isDeepSky() below to route a galaxy destType to spawnDeepSky().
 */
export class DestinationPicker {
  /** Check if a destination type is a deep sky object (not a star system). */
  static isDeepSky(type) {
    return type !== 'star-system';
  }
}

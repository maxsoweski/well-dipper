// Known-object sky features must carry a truthy seed (root cause #2, 2026-06-10).
//
// GalacticMap._generateFeatureRegion injects known objects as sky features
// with `seed: profile.messier || profile.ngc`. Four catalog entries (IC1396,
// IC434, CasA, IC2602) have NEITHER field, so their feature seed was
// undefined. When a warp destination's sky included one, SkyFeatureLayer.
// _hashSeed(undefined) threw `.length of undefined` INSIDE onSwapSystem
// (via skyRenderer.activate → setFeatures → _createNebulaBillboard), which
// aborted the swap pipeline: compile gate held to onComplete, AC4 forced
// emergence (player-visible stall), and the arrived system had NO sky/
// starfield — follow-up warps aborted with "No star found for warp".
// Reproduced live on GPU 9223 (warp 9 → 2873954553, then warps 10-11
// stranded). Fix: fall back to the profile's catalog key, which always
// exists and is stable per object.
import { describe, it, expect } from 'vitest';
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { KNOWN_OBJECT_PROFILES } from '../src/data/KnownObjectProfiles.js';

describe('known-object feature seeds', () => {
  const map = new GalacticMap();

  it('every known object injected into a feature region has a truthy seed', () => {
    // IC434 (Horsehead) is currently SHADOWED by M78: identical galacticPos
    // in the catalog, and the known-object injection dedups against features
    // already pushed — the later entry (M78) splices the earlier (IC434).
    // Separate latent bug (data + dedup design), found 2026-06-10 while
    // pinning the seed fix; tracked in docs/NOW.md. Presence is therefore
    // asserted for all profiles EXCEPT shadowed ones; the seed invariant is
    // asserted for everything that renders.
    const SHADOWED = new Set(['IC434']);
    for (const [key, profile] of Object.entries(KNOWN_OBJECT_PROFILES)) {
      const pos = profile.galacticPos;
      const feats = map.findNearbyFeatures(pos, 0.1);
      const mine = feats.find(f => f.isKnownObject && f.knownProfile?.name === profile.name);
      if (SHADOWED.has(key)) continue;
      expect(mine, `${key} (${profile.name}) not found near its own position`).toBeDefined();
      expect(mine.seed, `${key} (${profile.name}) has falsy feature seed`).toBeTruthy();
    }
  });

  it('all known-object features returned anywhere carry truthy seeds', () => {
    for (const [, profile] of Object.entries(KNOWN_OBJECT_PROFILES)) {
      for (const f of map.findNearbyFeatures(profile.galacticPos, 3.0)) {
        if (f.isKnownObject) {
          expect(f.seed, `${f.knownProfile?.name} has falsy seed`).toBeTruthy();
        }
      }
    }
  });
});

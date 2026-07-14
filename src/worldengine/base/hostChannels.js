// src/worldengine/base/hostChannels.js
// World Engine V2-4 slice-1 — the two NEW host channels (sediment + accommodation).
//
// THREE-FREE, RNG-FREE, PURE. Both writers are pure functions of an existing carrier: they read only
// `carrier.height`/`carrier.count` and write only the two unhashed host channels — so they are byte-inert
// against the 75-golden HASHED_FIELDS = [height, grainAngle, grainMag, regime, faultDensity] (they touch
// none of those five) and draw no alea stream. Works on the sphere carrier (makeSphereField) OR the flat
// grid twin (makeSubstrate); both allocate `sediment`+`accommodation`. Index-based, no adjacency.
//
// accommodation is SINK-RANKING ONLY — a bounded [0,1] ranking of WHERE deposition would go, NOT a mass or
// volume computation (V2-7 owns the volumetric budget; designDecision #HOST-CHANNELS + the ROADMAP note).
// sediment is a ZERO host this increment — V2-4 does not deposit (that is V2-8's job, a documented non-goal).

import { clamp01 } from './mathutil.js';

// The reference datum defaults to this height percentile — the level below which deposition accumulates.
// A low-ish percentile so most sinks (below-datum nodes) get positive accommodation and the highlands rank 0.
const DEFAULT_DATUM_PCT = 0.6;

// Deterministic percentile of a typed height array (numeric ascending sort on a copy; no RNG, no mutation
// of the source). Float32Array.prototype.sort is numeric-ascending by default (unlike Array.prototype.sort).
function heightPercentile(height, p) {
  const sorted = Float32Array.from(height).sort();
  const n = sorted.length;
  if (n === 0) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))));
  return sorted[i];
}

// writeAccommodation(carrier, { datum })
// SINK-RANKING read of the FINISHED carrier.height. For each node i:
//   accommodation[i] = clamp01( (refDatum - height[i]) / depthScale )
// where refDatum is a low-percentile reference height (default the DEFAULT_DATUM_PCT-th percentile, or a
// passed `datum`) and depthScale = refDatum - min(height) so the DEEPEST sink maps to exactly 1. Deeper
// below datum ⇒ higher accommodation; at/above datum ⇒ 0. This is a per-node RANKING of deposition sinks —
// no volumetric accumulation, no mass sum, no compound-assign into a budget. Non-degeneracy (a live-relief
// world): accommodation varies across nodes (variance > 0) and is inversely associated with height.
// Must run AFTER carrier.height is finalized (BUILD-PLAN §0 post-dispatch seam) — it reads the finished height.
export function writeAccommodation(carrier, { datum = null } = {}) {
  const { height, count, accommodation } = carrier;
  const refDatum = datum != null ? datum : heightPercentile(height, DEFAULT_DATUM_PCT);
  let minH = Infinity;
  for (let i = 0; i < count; i++) if (height[i] < minH) minH = height[i];
  const depthScale = refDatum - minH;                        // depth of the deepest sink below datum
  const invScale = depthScale > 1e-12 ? 1 / depthScale : 0;  // flat world ⇒ all-zero accommodation (still bounded)
  for (let i = 0; i < count; i++) {
    accommodation[i] = clamp01((refDatum - height[i]) * invScale);
  }
  return carrier;
}

// initSedimentHost(carrier)
// Zero-fills the sediment host — pristine bedrock. V2-4 does NOT deposit; this exists so the channel has a
// defined, readable owner (not an accidental reserve). Idempotent + re-runnable.
//   V2-8 SEAM: deposition will write `carrier.sediment[i] += depositedThickness` at sink nodes ranked by
//   `carrier.accommodation[i]` (highest-accommodation sinks fill first), read back by the erosion/relaxation
//   read-history stage. No V2-4 code deposits here.
export function initSedimentHost(carrier) {
  carrier.sediment.fill(0);
  return carrier;
}

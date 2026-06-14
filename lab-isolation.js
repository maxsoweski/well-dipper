// lab-isolation.js
// Pure enable-set logic for the lab's non-destructive solo (Phase 2, Tier-2 prereq).
// Kept DOM-free and GPU-free so vitest can exercise it headless; the lab imports
// computeEnableSet to drive solo / unsolo / soloMode without re-deriving the rules.

// computeEnableSet(allKeys, { solo, mode, isolationKit }) -> Set<string>
//   solo null         -> all keys (un-solo)
//   mode 'bare'       -> just [solo]
//   mode 'context'    -> [solo, ...isolationKit]   (default)
// The result is always intersected with allKeys, so a stale kit entry never
// asks the caller to enable a feature that does not exist.
export function computeEnableSet(allKeys, { solo = null, mode = 'context', isolationKit = [] } = {}) {
  const all = new Set(allKeys);
  if (solo === null) return new Set(allKeys);
  const want = mode === 'bare' ? [solo] : [solo, ...isolationKit];
  return new Set(want.filter(k => all.has(k)));
}

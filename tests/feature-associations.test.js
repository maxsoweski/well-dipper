// tests/feature-associations.test.js
import { describe, it, expect } from 'vitest';
import { FEATURES, ARCHETYPES, PROVINCES } from '../planet-archetypes.js';
import { ASSOCIATIONS, DOMAINS, PROVINCE_GROUPS, provinceGroupOf } from '../planet-feature-associations.js';
import { DRIVERS, PROCESSES, driversFor } from '../planet-drivers.js';

const featureKeys = Object.keys(FEATURES);

// ── Tier-1 ground truth (cross-source) ──────────────────────────────────────
// The 17 DRIVER_PRESETS keys, hard-pinned from planet-lod-lab.html L5326–5520.
// rendersOn strings must be members of this set. If a preset is added/renamed in
// the lab, update this list (it is the manifest's external contract for rendersOn).
const DRIVER_PRESETS = [
  'Rocky (Earthlike)', 'Lava (hot airless)', 'Ocean (temperate)', 'Titan (methane seas)',
  'Frozen (airless)', 'Europa (icy moon)', 'Gas giant (Jovian)', 'Gas giant (Saturnian)',
  'Ice giant (Neptunian)', 'Venus (sulfuric shroud)', 'Sub-Neptune (hazy)',
  'Eyeball (locked temperate)', 'Hot Jupiter (locked giant)', 'Mars (arid rocky)',
  'Magma (K2-141b)', 'Carbon (high C/O)', 'Crystal (faceted)',
];

// Features whose rendersOn deliberately diverges from their archetype-preset union.
// Single source of truth = the manifest's per-feature `rendersOnDivergent` flag
// (Max's Decision 2, 2026-06-14): hexTess is a member of exotic-geometric (preset
// 'Crystal (faceted)') but the shader rides it on 'Frozen (airless)'. Any flagged
// feature is exempt from the rendersOn⊆archetype-union check.
const RENDERSON_DIVERGENT = new Set(featureKeys.filter(k => ASSOCIATIONS[k].rendersOnDivergent));

// Union of preset names across a feature's archetype memberships.
function archetypePresetUnion(featureKey) {
  const archs = FEATURES[featureKey].archetypes || [];
  const presets = new Set();
  for (const a of archs) for (const p of (ARCHETYPES[a]?.presets || [])) presets.add(p);
  return presets;
}

describe('feature association manifest', () => {
  it('has an entry for every FEATURES key (no gaps)', () => {
    const missing = featureKeys.filter(k => !ASSOCIATIONS[k]);
    expect(missing, `features missing an association entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no orphan entries (every entry maps to a real feature)', () => {
    const orphans = Object.keys(ASSOCIATIONS).filter(k => !FEATURES[k]);
    expect(orphans, `association entries for unknown features: ${orphans.join(', ')}`).toEqual([]);
  });

  it('every entry uses a valid domain and provinceGroup', () => {
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      expect(DOMAINS, `${k}.domain`).toContain(a.domain);
      expect(Object.keys(PROVINCE_GROUPS), `${k}.provinceGroup`).toContain(a.provinceGroup);
    }
  });

  it('dependsOn.features / modifies / isolationKit reference real feature keys', () => {
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      for (const ref of [...a.dependsOn.features, ...a.modifies, ...a.isolationKit]) {
        expect(FEATURES[ref], `${k} references unknown feature '${ref}'`).toBeTruthy();
      }
    }
  });
});

describe('provinceGroup ⇔ PROVINCES consistency', () => {
  it('each provinced feature\'s group matches its PROVINCES field+polarity', () => {
    for (const k of Object.keys(FEATURES)) {
      const p = PROVINCES[k];
      if (!p || p.floor >= 1.0) continue;            // global / unprovinced — skip
      const expected = provinceGroupOf(p.field, p.polarity);
      expect(ASSOCIATIONS[k].provinceGroup, `${k}`).toBe(expected);
    }
  });

  it('every floor-1.0 (unprovinced) feature is marked global', () => {
    for (const k of Object.keys(FEATURES)) {
      const p = PROVINCES[k];
      if (p && p.floor < 1.0) continue;
      expect(ASSOCIATIONS[k].provinceGroup, `${k}`).toBe('global');
    }
  });
});

// ── Tier-1: cross-source consistency (vs DRIVER_PRESETS + shader call-order) ──

describe('Tier-1: rendersOn validity (Claim 1)', () => {
  it('every rendersOn string is a real DRIVER_PRESETS key', () => {
    const presetSet = new Set(DRIVER_PRESETS);
    const bad = [];
    for (const k of featureKeys) {
      for (const p of ASSOCIATIONS[k].rendersOn) {
        if (!presetSet.has(p)) bad.push(`${k} → '${p}'`);
      }
    }
    expect(bad, `rendersOn entries referencing unknown presets:\n  ${bad.join('\n  ')}`).toEqual([]);
  });
});

describe('Tier-1: modifies ⇄ dependsOn.features inverse-edge (Claim 3)', () => {
  // The shader couplings are a single relation with two stored directions.
  // X.modifies ∋ Y  means  X writes a field Y reads  ⇒  Y.dependsOn.features ∋ X.
  // This test enforces the relation is a true inverse in BOTH directions; every
  // failure is a shader-grounded missing or spurious edge (audit doc Claim 3).
  it('every X.modifies ∋ Y implies Y.dependsOn.features ∋ X', () => {
    const broken = [];
    for (const x of featureKeys) {
      for (const y of ASSOCIATIONS[x].modifies) {
        if (!ASSOCIATIONS[y].dependsOn.features.includes(x)) {
          broken.push(`${x}.modifies ∋ ${y}  but  ${y}.dependsOn.features ∌ ${x}`);
        }
      }
    }
    expect(broken, `missing read-edges:\n  ${broken.join('\n  ')}`).toEqual([]);
  });

  it('every X.dependsOn.features ∋ Y implies Y.modifies ∋ X', () => {
    const broken = [];
    for (const x of featureKeys) {
      for (const y of ASSOCIATIONS[x].dependsOn.features) {
        if (!ASSOCIATIONS[y].modifies.includes(x)) {
          broken.push(`${x}.dependsOn.features ∋ ${y}  but  ${y}.modifies ∌ ${x}`);
        }
      }
    }
    expect(broken, `missing/spurious write-edges:\n  ${broken.join('\n  ')}`).toEqual([]);
  });
});

describe('Tier-1: rendersOn vs archetype coherence (Claim 7)', () => {
  it('every rendersOn preset is in the feature\'s archetype-preset union (unless flagged divergent)', () => {
    const bad = [];
    for (const k of featureKeys) {
      if (RENDERSON_DIVERGENT.has(k)) continue;
      const union = archetypePresetUnion(k);
      for (const p of ASSOCIATIONS[k].rendersOn) {
        if (!union.has(p)) bad.push(`${k} renders on '${p}' ∉ archetype union {${[...union].join(', ')}}`);
      }
    }
    expect(bad, `rendersOn outside archetype union:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('every flagged-divergent feature actually diverges (no stale flags)', () => {
    const stale = [];
    for (const k of RENDERSON_DIVERGENT) {
      const union = archetypePresetUnion(k);
      const diverges = ASSOCIATIONS[k].rendersOn.some(p => !union.has(p));
      if (!diverges) stale.push(k);
    }
    expect(stale, `flagged divergent but rendersOn ⊆ archetype union: ${stale.join(', ')}`).toEqual([]);
  });
});

// Claim 8 — driver-name validity. RESOLVED 2026-06-14 (Max: "re-base all 47 on D1–D16").
// dependsOn.drivers is now DERIVED from each feature's `processes` (+ directDrivers) via the
// canonical L0/L1 model in planet-drivers.js (DRIVERS D1–D16, PROCESSES P1–P28). These tests
// pin the manifest to that model: valid process/driver refs, correct derivation, no empties.
describe('Tier-1: driver model grounding (Claim 8)', () => {
  it('every feature.processes entry is a real PROCESSES key', () => {
    const bad = [];
    for (const k of featureKeys) {
      for (const p of (ASSOCIATIONS[k].processes || [])) {
        if (!PROCESSES[p]) bad.push(`${k} → '${p}'`);
      }
    }
    expect(bad, `processes referencing unknown P#:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('every directDrivers entry is a real DRIVERS key', () => {
    const bad = [];
    for (const k of featureKeys) {
      for (const d of (ASSOCIATIONS[k].directDrivers || [])) {
        if (!DRIVERS[d]) bad.push(`${k} → '${d}'`);
      }
    }
    expect(bad, `directDrivers referencing unknown D#:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('every derived dependsOn.drivers name is a canonical D1–D16 driver', () => {
    const bad = [];
    for (const k of featureKeys) {
      for (const d of ASSOCIATIONS[k].dependsOn.drivers) {
        if (!DRIVERS[d]) bad.push(`${k} → '${d}'`);
      }
    }
    expect(bad, `dependsOn.drivers referencing unknown D#:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('dependsOn.drivers is the exact derivation of processes + directDrivers (no hand-edits)', () => {
    const bad = [];
    for (const k of featureKeys) {
      const a = ASSOCIATIONS[k];
      const expected = driversFor(a.processes, a.directDrivers);
      if (JSON.stringify(a.dependsOn.drivers) !== JSON.stringify(expected)) {
        bad.push(`${k}: got [${a.dependsOn.drivers}] expected [${expected}]`);
      }
    }
    expect(bad, `drivers out of sync with the model:\n  ${bad.join('\n  ')}`).toEqual([]);
  });

  it('every feature derives at least one driver (no empty driver columns)', () => {
    const empty = featureKeys.filter(k => ASSOCIATIONS[k].dependsOn.drivers.length === 0);
    expect(empty, `features with no derived drivers: ${empty.join(', ')}`).toEqual([]);
  });

  it('every PROCESSES driver is itself a canonical D1–D16 driver (registry self-consistency)', () => {
    const bad = [];
    for (const [p, def] of Object.entries(PROCESSES)) {
      for (const d of def.drivers) if (!DRIVERS[d]) bad.push(`${p} → '${d}'`);
    }
    expect(bad, `PROCESSES referencing unknown drivers:\n  ${bad.join('\n  ')}`).toEqual([]);
  });
});

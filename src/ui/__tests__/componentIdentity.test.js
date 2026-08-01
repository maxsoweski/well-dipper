/**
 * componentIdentity pure helpers — S5 of multistar-components-2026-07-19
 * (AC5 view-model layer + AC9 helper purity: this file imports the module
 * bare and constructs NO NavComputer). One concrete assertion per
 * system-identity grammar clause (docs/NAMING_AND_REAL_OBJECTS.md 1–4).
 */

import { describe, it, expect } from 'vitest';
import {
  findComponentIndexByName,
  deriveComponentView,
} from '../componentIdentity.js';

// Synthetic parent payload shaped like the resolved Alpha Centauri system —
// exactly the fields the helpers read (payload-shape source of truth is the
// substrate suite; this layer is pure view-model).
const PROXIMA_PLANETS = [
  { letter: 'd', known: true, orbitRadiusAU: 0.02881 },
  { letter: 'b', known: true, orbitRadiusAU: 0.04848 },
];
const parent = () => ({
  _knownSystemNames: { system: 'Alpha Centauri', star: 'Rigil Kentaurus', star2: 'Toliman' },
  farCompanions: [
    { name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000 },
  ],
  componentSystems: [
    {
      name: 'Proxima Centauri', class: 'M5.5Ve', type: 'M', separationAU: 13000,
      seed: 'alpha-centauri:component-0:x',
      systemData: { star: { type: 'M', spectFull: 'M5.5Ve' }, planets: PROXIMA_PLANETS, zones: {} },
    },
  ],
});

describe('findComponentIndexByName', () => {
  it('matches componentSystems[i].name, -1 on miss', () => {
    expect(findComponentIndexByName(parent(), 'Proxima Centauri')).toBe(0);
    // Close members and procgen names are NOT components.
    expect(findComponentIndexByName(parent(), 'Rigil Kentaurus')).toBe(-1);
    expect(findComponentIndexByName(parent(), 'Toliman')).toBe(-1);
    expect(findComponentIndexByName(parent(), 'ZZZ Procgen 90210')).toBe(-1);
    // Degenerate inputs never throw.
    expect(findComponentIndexByName(null, 'Proxima Centauri')).toBe(-1);
    expect(findComponentIndexByName({}, 'Proxima Centauri')).toBe(-1);
    expect(findComponentIndexByName(parent(), null)).toBe(-1);
  });
});

describe('deriveComponentView — the four grammar clauses', () => {
  const view = () => deriveComponentView(parent(), 0, 'Proxima Centauri');

  it('title names the SYSTEM (clause 1): Alpha Centauri, not Proxima Centauri', () => {
    expect(view().title).toBe('Alpha Centauri');
  });

  it('annotation marks the component (clause 3): via Proxima Centauri — far companion', () => {
    expect(view().annotation).toBe('via Proxima Centauri — far companion');
  });

  it('breadcrumb cues co-membership (clause 4): part of Alpha Centauri', () => {
    expect(view().breadcrumb).toBe('part of Alpha Centauri');
  });

  it('systemData.planets are payload-sourced (clause 2): deep-equal componentSystems[idx].systemData.planets', () => {
    const p = parent();
    const v = deriveComponentView(p, 0, 'Proxima Centauri');
    expect(v.systemData.planets).toEqual(p.componentSystems[0].systemData.planets);
    expect(v.systemData).toBe(p.componentSystems[0].systemData); // the SAME payload, never a copy
    expect(v.componentName).toBe('Proxima Centauri');
  });

  it('annotation derives from the COMPONENT even when entered from another marker', () => {
    // Entry (a) drills from the parent SYSTEM view (marker = Rigil): the
    // annotation must still mark the viewed component, while the title stays
    // the system's.
    const v = deriveComponentView(parent(), 0, 'Rigil Kentaurus');
    expect(v.title).toBe('Alpha Centauri');
    expect(v.annotation).toBe('via Proxima Centauri — far companion');
    expect(v.breadcrumb).toBe('part of Alpha Centauri');
  });

  it('procgen system (no _knownSystemNames / no componentSystems) → falls back, no throw', () => {
    const v = deriveComponentView({ star: {}, planets: [] }, 0, 'Some Procgen Star');
    expect(v.title).toBe('Some Procgen Star'); // marker fallback, as systemIdentity does
    expect(v.breadcrumb).toBe('part of Some Procgen Star');
    expect(v.annotation).toBeNull();
    expect(v.systemData).toBeNull();           // caller renders nothing, never throws
    expect(v.componentName).toBeNull();
    // Out-of-range index on a REAL component-bearing payload degrades the same way.
    expect(deriveComponentView(parent(), 7, 'Proxima Centauri').systemData).toBeNull();
    // Null parent never throws.
    expect(deriveComponentView(null, 0, null).systemData).toBeNull();
  });
});

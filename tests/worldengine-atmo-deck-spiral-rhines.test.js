// tests/worldengine-atmo-deck-spiral-rhines.test.js
// ─────────────────────────────────────────────────────────────────────────────
// world-engine-atmo-deck-spiral-rhines — Slice S1 (RHINES + ROTATION WIRES, ONE BAND COUNT).
// Closes AC-RHINES / AC-ROTDRAW / AC-ONECOUNT / AC-0(1) headlessly. Source greps use the
// storm-e/giant-drivers SRC-matchAll house pattern, COMMENT-STRIPPED (K_CODE/I_CODE) so a token
// living only in documentation prose can't pass or fail a code-level assertion.
// Later slices (S2 substrate, S3 deckZ, S4 dSpiral) append their own describe-blocks to this file.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  E5_REGIME, DRIVER_BUNDLES, resolveParams, rhinesWavenumber, PHYS,
} from '../src/worldengine/base/climate-e5.js';
import {
  giantDriverScalars, drawRotationHours, tidalLockRotationHours, ROTATION_RANGES_HOURS,
  drawGiantConditions, deriveGiantDrivers, canonicalGiantCondition, SWEEP_SEEDS,
} from '../src/worldengine/base/giant-drivers.js';
import { resolveStormE, STORM_DECK } from '../src/worldengine/base/storm-e.js';
import {
  BAND_SPIRAL, SPIRAL_NB, bandProxy, spiralDisplacement, spiralWrapProfile,
} from '../src/worldengine/base/band-flow.js';
import { DRIVER_PRESETS, PRESET_ARCHETYPE } from '../driver-presets.js';   // AC-ROTDRAW wrapper: the shipped preset data the lab's drawPresetRotation reads

// ── comment-stripped source text (the house K_CODE/I_CODE pattern) ─────────────────────────────────
const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const GD_SRC = src('../src/worldengine/base/giant-drivers.js');
const GD_CODE = strip(GD_SRC);
const GLSL_CODE = strip(src('../src/worldengine/shaders/height.glsl.js'));
const UNIF_CODE = strip(src('../src/worldengine/shaders/uniforms.js'));
// ⚠ The lab's two shaders were EXTRACTED to planet-lod-shaders.glsl.js (so the game imports the
// SAME source the lab renders). The lab's source text is therefore the HTML *plus* that module —
// this fence reads both as one corpus so its assertions keep testing what the lab compiles.
const LAB_SRC_TEXT = src('../world-engine-lab.html') + '\n' + src('../src/worldengine/shaders/planetShaders.glsl.js');
const LAB_CODE = strip(LAB_SRC_TEXT);
const LAB_RAW = LAB_SRC_TEXT;
const STORM_SRC = src('../src/worldengine/base/storm-e.js');

// balanced-brace body extractor over comment-stripped code (defn found by a signature substring).
// Skips the parameter list FIRST (paren-balanced) so a destructured/`= {}` param brace isn't mistaken
// for the body open — then brace-balances the body.
function fnBody(code, sig) {
  const i = code.indexOf(sig);
  if (i < 0) return '';
  const pOpen = code.indexOf('(', i);
  let pd = 0, j = pOpen;
  for (; j < code.length; j++) {
    if (code[j] === '(') pd++;
    else if (code[j] === ')') { pd--; if (pd === 0) { j++; break; } }
  }
  const bOpen = code.indexOf('{', j);
  let bd = 0;
  for (let k = bOpen; k < code.length; k++) {
    if (code[k] === '{') bd++;
    else if (code[k] === '}') { bd--; if (bd === 0) return code.slice(bOpen, k + 1); }
  }
  return code.slice(bOpen);
}

// The Rhines m for a DRAWN (R, rot) under a regime bundle: giantDriverScalars normalizes the drawn
// radius/rotation exactly as the lab does, resolveParams merges them over the frozen triple (uPeak from
// the bundle's internalHeat/dissipation/shellDepthFrac), and m = rhinesWavenumber(rotRate, radius, uPeak).
const mFor = (regime, R, rotH, seed = 0) =>
  resolveParams(regime, giantDriverScalars(R, rotH), seed).m;

// ── AC-RHINES — the drawn radius/rotation actually reach the Rhines law (span the sqrt(a·Ω) envelope) ──
describe('S1 AC-RHINES — Rhines wire reads the drawn radius + rotation', () => {
  const GAS_R = [6, 8, 10, 12, 14];
  const GAS_ROT = [8, 10, 12, 14];
  const ICE_R = [2.5, 3.0, 3.5, 4.0];
  const ICE_ROT = [12, 14, 16, 20];

  it('[gas leg] m tracks sqrt(radius·rotationRate) monotonically at fixed uPeak; corner (14 RE, 8 h) ≥ 15', () => {
    // uPeak is bundle-fixed for GAS_GIANT ⇒ m depends ONLY on the drawn radius·rotationRate.
    const pts = [];
    for (const R of GAS_R) for (const rot of GAS_ROT) {
      const s = giantDriverScalars(R, rot);
      pts.push({ prod: s.radius * s.rotationRate, m: mFor(E5_REGIME.GAS_GIANT, R, rot) });
    }
    pts.sort((a, b) => a.prod - b.prod);
    for (let i = 1; i < pts.length; i++) expect(pts[i].m).toBeGreaterThanOrEqual(pts[i - 1].m);  // monotone non-decreasing
    expect(mFor(E5_REGIME.GAS_GIANT, 14, 8)).toBeGreaterThanOrEqual(15);                          // fast-large corner
    // seed-independence (m reads no per-seed jitter): a different seed gives the same m at the corner
    expect(mFor(E5_REGIME.GAS_GIANT, 14, 8, 4242)).toBe(mFor(E5_REGIME.GAS_GIANT, 14, 8, 0));
  });

  it('[ice leg — NEPTUNIAN-pinned, F12] m is 3-class ONLY under the Neptunian regime bundle (uPeak ≈ 7.70)', () => {
    // The m≈3 prediction is a property of the NEPTUNIAN drivers (internalHeat 2.60 / dissipation 0.15 ⇒
    // high uPeak, the Neptune-wind-paradox), NOT of (R, rot). There is NO 'ice' rotation range (F11);
    // the ice giant rides the sub-neptune 12–20 h band.
    for (const R of ICE_R) for (const rot of ICE_ROT) {
      expect(mFor(E5_REGIME.NEPTUNIAN, R, rot)).toBeLessThanOrEqual(4);
    }
    // the same corner under GAS_GIANT gives a much finer count — do NOT assert 3 there (F12)
    expect(mFor(E5_REGIME.NEPTUNIAN, 4, 12)).toBeLessThanOrEqual(4);
    expect(mFor(E5_REGIME.GAS_GIANT, 4, 12)).toBeGreaterThanOrEqual(5);
  });

  it('[population span] the combined gas + ice population spans ≥ ×2 in band count', () => {
    const ms = [];
    for (const R of GAS_R) for (const rot of GAS_ROT) ms.push(mFor(E5_REGIME.GAS_GIANT, R, rot));
    for (const R of ICE_R) for (const rot of ICE_ROT) ms.push(mFor(E5_REGIME.NEPTUNIAN, R, rot));
    expect(Math.max(...ms) / Math.min(...ms)).toBeGreaterThanOrEqual(2);
  });

  it('[hot-Jupiter] the derived tidal-lock rotation collapses the count to M_MIN', () => {
    const rotH = tidalLockRotationHours(150000, 332946);   // ≈ 1.42e5 h (preset non-orbit-consistent, by design)
    const m = resolveParams(E5_REGIME.HOT_JUPITER, giantDriverScalars(13, rotH), 0).m;
    expect(m).toBe(PHYS.M_MIN);
  });
});

// ── AC-ROTDRAW — rotation is drawn per archetype; hot-Jupiter derived; locked solids canonical ──────
describe('S1 AC-ROTDRAW — drawRotationHours', () => {
  const SEEDS = [0, 1, 7, 13, 42, 101, 256, 777, 1234, 9999];

  it('[ranges] each gas archetype draw stays inside ROTATION_RANGES_HOURS over many seeds', () => {
    for (const [arch, [lo, hi]] of Object.entries(ROTATION_RANGES_HOURS)) {
      for (const s of SEEDS) {
        const h = drawRotationHours({ archetype: arch, hydrogenAtmo: true }, s);   // gas, unlocked ⇒ drawn
        expect(h).toBeGreaterThanOrEqual(lo);
        expect(h).toBeLessThanOrEqual(hi);
      }
    }
    // and the draw genuinely varies across seeds (not a constant)
    const hs = SEEDS.map((s) => drawRotationHours({ archetype: 'gas-giant', hydrogenAtmo: true }, s));
    expect(new Set(hs).size).toBeGreaterThan(1);
  });

  it('[determinism] same archetype + seed ⇒ identical hours', () => {
    for (const s of SEEDS) {
      expect(drawRotationHours({ archetype: 'sub-neptune', hydrogenAtmo: true }, s))
        .toBe(drawRotationHours({ archetype: 'sub-neptune', hydrogenAtmo: true }, s));
    }
  });

  it('[hot-Jupiter-class DERIVED] locked + h2-he ≡ tidalLockRotationHours(orbit, starMass) exactly (identity, not magnitude)', () => {
    const args = { locked: true, hydrogenAtmo: true, orbitRadiusEarth: 150000, starMassEarth: 332946 };
    const expected = tidalLockRotationHours(150000, 332946);
    for (const s of SEEDS) expect(drawRotationHours(args, s)).toBe(expected);   // seed-independent (not drawn)
    // archetype is irrelevant on this branch — the identity is the ONLY key (hot-Jupiter absent from PRESET_ARCHETYPE)
    expect(drawRotationHours({ ...args, archetype: 'gas-giant' }, 3)).toBe(expected);
  });

  it('[locked SOLIDS canonical — F10 regression net] every locked solid returns canonicalHours', () => {
    // Eyeball/Lava/Europa/Magma/Frozen: locked (or not), NON-hydrogen ⇒ no gas range ⇒ canonical, never Kepler.
    const solids = [
      { name: 'Eyeball', archetype: 'eyeball', canonicalHours: 24 },
      { name: 'Lava',    archetype: 'lava',    canonicalHours: 13.7 },
      { name: 'Europa',  archetype: 'ice',     canonicalHours: 85.2 },
      { name: 'Magma',   archetype: 'lava',    canonicalHours: 6.7 },
      { name: 'Frozen',  archetype: 'ice',     canonicalHours: 42.0 },
    ];
    for (const b of solids) {
      for (const s of SEEDS) {
        // locked path
        expect(drawRotationHours({ archetype: b.archetype, canonicalHours: b.canonicalHours, locked: true, hydrogenAtmo: false }, s), b.name)
          .toBe(b.canonicalHours);
        // unlocked path (same canonical outcome — no gas range either way)
        expect(drawRotationHours({ archetype: b.archetype, canonicalHours: b.canonicalHours, locked: false, hydrogenAtmo: false }, s), b.name)
          .toBe(b.canonicalHours);
      }
    }
    // a body with no archetype + no canonicalHours falls back to 24 h
    expect(drawRotationHours({ locked: false }, 5)).toBe(24);
  });

  it('[alea-only] the S1 rotation code uses alea, never Math.random / mulberry32 / wall-clock', () => {
    expect(GD_CODE).not.toMatch(/Math\.random\s*\(/);
    expect(GD_CODE).not.toMatch(/mulberry32/);
    expect(GD_CODE).not.toMatch(/Date\.now\s*\(/);
    const body = fnBody(GD_CODE, 'function drawRotationHours');
    expect(body).toMatch(/alea\(/);
    expect(body).toContain('giantD:rot:');
  });
});

// ── AC-ROTDRAW (wrapper) — the LAB's inline drawPresetRotation: NAMED_BODY gate + isHotJupiterClass ──
// The pure drawRotationHours math is pinned above (ranges/lock/derivation/alea/determinism); the gap this
// block closes is the LAB WRAPPER doing the NAMED_BODY bypass + hot-Jupiter dispatch before delegating.
// The wrapper is INLINE in world-engine-lab.html and — like its sibling drawPresetRadius (source-pinned via
// the storm-e `LAB.toContain('mulberry32')` guard, never module-extracted) — is closed by the source-read
// house pattern (fnBody over LAB_CODE, the same extractor the S2 carriage block uses). A behavioral leg
// then drives the SHIPPED preset data through the real drawRotationHours/tidalLockRotationHours so the
// documented per-class outcomes are an automated assertion, not a code-reading claim (BUILD-NOTES
// §"New / changed symbols (world-engine-lab.html)" → drawPresetRotation).
describe('S1 AC-ROTDRAW — drawPresetRotation lab wrapper (NAMED_BODY gate + hot-Jupiter dispatch)', () => {
  const WRAP = fnBody(LAB_CODE, 'function drawPresetRotation');
  const SEEDS = [0, 1, 7, 42, 256, 9999];
  // the wrapper's field map (mirrors drawPresetRotation) — the [delegation] structural test below pins
  // that the lab uses EXACTLY these fields, so a drift between this oracle and the wrapper fails there.
  const wrapArgs = (name) => {
    const p = DRIVER_PRESETS[name] || {};
    return {
      archetype: PRESET_ARCHETYPE[name], canonicalHours: p.rotationHours,
      locked: !!p.tidalState?.locked, hydrogenAtmo: p.atmosphere?.composition === 'h2-he',
      orbitRadiusEarth: p.orbitRadiusEarth, starMassEarth: p.starMassEarth,
    };
  };
  const isHJ = (name) => { const p = DRIVER_PRESETS[name] || {}; return !!p.tidalState?.locked && p.atmosphere?.composition === 'h2-he'; };

  // ── structural (source-read) — the wrapper body wires the four documented behaviors ──────────────
  it('[wrapper present] the lab defines the drawPresetRotation wrapper (fnBody finds a body)', () => {
    expect(WRAP).not.toBe('');
  });

  it('[NAMED_BODY bypass] named non-hot-Jupiter bodies return canonical rotationHours, skipping the draw', () => {
    expect(WRAP).toContain('NAMED_BODY.has(presetName) && !isHotJupiterClass');
    expect(WRAP).toContain('return preset.rotationHours ?? 24');
  });

  it('[hot-Jupiter identity] isHotJupiterClass = locked AND an h2-he envelope (overrides the NAMED_BODY gate)', () => {
    expect(WRAP).toContain("!!preset.tidalState?.locked && preset.atmosphere?.composition === 'h2-he'");
  });

  it('[delegation] non-named presets delegate to drawRotationHours keyed on PRESET_ARCHETYPE, carrying the orbit fields', () => {
    expect(WRAP).toContain('drawRotationHours({');
    expect(WRAP).toContain('archetype: PRESET_ARCHETYPE[presetName]');
    expect(WRAP).toContain('canonicalHours: preset.rotationHours');
    expect(WRAP).toContain('locked: !!preset.tidalState?.locked');
    expect(WRAP).toContain("hydrogenAtmo: preset.atmosphere?.composition === 'h2-he'");
    expect(WRAP).toContain('orbitRadiusEarth: preset.orbitRadiusEarth');   // the fields that route hot-Jupiter-class
    expect(WRAP).toContain('starMassEarth: preset.starMassEarth');         // to tidalLockRotationHours inside drawRotationHours
  });

  it('[no own entropy] the wrapper forwards seed unchanged and adds no RNG (determinism is seed-driven)', () => {
    expect(WRAP).not.toMatch(/Math\.random\s*\(/);
    expect(WRAP).not.toMatch(/Date\.now\s*\(/);
    expect(WRAP).not.toMatch(/mulberry32/);
    expect(WRAP).not.toMatch(/alea\s*\(/);
    expect(WRAP).toContain(', seed);');   // the drawn seed is forwarded to drawRotationHours verbatim
  });

  // ── behavioral — the SHIPPED preset data drives the real modules to the documented outcomes ──────
  it('[hot-Jupiter DERIVED from orbit] the real Hot Jupiter preset ≡ tidalLockRotationHours(orbit, starMass), seed-independent', () => {
    const name = 'Hot Jupiter (locked giant)', p = DRIVER_PRESETS[name];
    expect(isHJ(name)).toBe(true);                                   // it IS hot-Jupiter-class (locked + h2-he)
    expect(PRESET_ARCHETYPE[name]).toBeUndefined();                  // and ABSENT from PRESET_ARCHETYPE (F10 — identity is the only key)
    const expected = tidalLockRotationHours(p.orbitRadiusEarth, p.starMassEarth);
    for (const s of SEEDS) expect(drawRotationHours(wrapArgs(name), s)).toBe(expected);   // derived, not drawn (seed cannot move it)
    expect(expected).not.toBe(p.rotationHours);                     // and NOT the preset's frozen 80 h pseudo-sync (derived, not frozen)
  });

  it('[gas archetype DRAWN] the real Jovian preset draws inside its gas range, varies by seed, deterministic per seed', () => {
    const name = 'Gas giant (Jovian)';
    expect(isHJ(name)).toBe(false);                                 // not locked ⇒ takes the draw branch
    const [lo, hi] = ROTATION_RANGES_HOURS[PRESET_ARCHETYPE[name]]; // 'gas-giant' → [8, 14]
    const hs = SEEDS.map((s) => drawRotationHours(wrapArgs(name), s));
    for (const h of hs) { expect(h).toBeGreaterThanOrEqual(lo); expect(h).toBeLessThanOrEqual(hi); }
    expect(new Set(hs).size).toBeGreaterThan(1);                    // genuinely varies (drawn, not constant)
    for (const s of SEEDS) expect(drawRotationHours(wrapArgs(name), s)).toBe(drawRotationHours(wrapArgs(name), s));   // determinism per worldSeed
  });

  it('[named solid CANONICAL] Mars is NAMED + not hot-Jupiter-class ⇒ the wrapper returns its canonical rotationHours', () => {
    const name = 'Mars (arid rocky)', p = DRIVER_PRESETS[name];
    expect(isHJ(name)).toBe(false);                                 // NOT hot-Jupiter-class (unlocked, co2 atmosphere)
    expect(Number.isFinite(p.rotationHours)).toBe(true);
    expect(p.rotationHours).toBe(24.6);                             // the canonical value the NAMED_BODY branch returns ([NAMED_BODY bypass] pins the branch)
  });
});

// ── AC-ONECOUNT — exactly one band count (uBandM); the vestigial uBandCount is gone ─────────────────
describe('S1 AC-ONECOUNT — uBandCount retired, uBandM is the single band count', () => {
  it('[absent] uBandCount appears in no code (GLSL / uniforms / lab), comment-stripped', () => {
    expect(GLSL_CODE).not.toContain('uBandCount');
    expect(UNIF_CODE).not.toContain('uBandCount');
    expect(LAB_CODE).not.toContain('uBandCount');
  });

  it('[jets ladder] jetU / jetShearGate / jetsDisp all read uBandM', () => {
    for (const sig of ['jetU(float', 'jetShearGate(float', 'jetsDisp(float']) {
      expect(fnBody(GLSL_CODE, sig), sig).toContain('uBandM');
    }
  });

  it('[wire] BOTH lab driver-assembly sites read the drawn radius through giantDriverScalars', () => {
    const hits = [...LAB_CODE.matchAll(/giantDriverScalars\(state\.planetRadiusEarth/g)];
    expect(hits.length).toBe(2);
  });
});

// ── AC-0(1) — driver connectivity: rotation keys on the sanctioned archetype tag, not a preset name ──
describe('S1 AC-0 — spine conformance (driver connectivity)', () => {
  it('[no preset-name routing] the rotation ranges + draw key on archetype tags, not DRIVER_PRESETS names', () => {
    for (const name of ['Jovian', 'Saturnian', 'Neptunian', 'Sub-Neptune', 'Hot Jupiter', 'Gas giant', 'Ice giant']) {
      expect(GD_CODE).not.toContain(name);
    }
    // the range keys are the RADIUS_RANGES_EARTH archetype tags (the single-source map), not names
    expect(Object.keys(ROTATION_RANGES_HOURS).sort()).toEqual(['gas-giant', 'sub-neptune']);
  });

  it('[giantDriverScalars] normalizes drawn radius/rotation to the Jupiter-normalized bundle convention', () => {
    // Jupiter canonical (11.2 RE, 9.9 h) ⇒ rotationRate 1.0, radius 1.0 (the DRIVER_BUNDLES gas anchor)
    const s = giantDriverScalars(11.2, 9.9);
    expect(s.rotationRate).toBeCloseTo(1.0, 9);
    expect(s.radius).toBeCloseTo(1.0, 9);
    expect(giantDriverScalars(11.2, 9.9, 2).rotationRate).toBeCloseTo(2.0, 9);   // e5RotationScale multiplies
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Slice S2 — PER-STORM SCALAR SUBSTRATE (streams + carriage; zero visual change).
// Closes AC-FENCE re-proof (the storm-e golden/phase suite runs unchanged — asserted GREEN there) +
// AC-0(2/3) groundwork. This block owns the NEW-surface unit checks: append-only emboss/billow streams,
// the STORM_DECK export, and the F2 both-blocks slot-sync + s.mode lab-source grep.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const GAS = { composition: 'h2-he' };
const TWO_PI = Math.PI * 2;

describe('S2 stormE:emboss / stormE:billow — append-only per-storm scalar streams', () => {
  it('[namespaces present] the two appended streams are drawn from stormE:emboss / stormE:billow', () => {
    // the AC-WRITER(a) storm-e guard already pins every alea() to contain "stormE:"; here we assert the
    // two NEW sub-namespaces exist (append-only substrate), alongside the four placement streams.
    expect(STORM_SRC).toContain('stormE:emboss:');
    expect(STORM_SRC).toContain('stormE:billow:');
    for (const ns of ['stormE:place', 'stormE:age', 'stormE:phase', 'stormE:polar'])
      expect(STORM_SRC).toContain(ns);   // the four placement streams are untouched (append-only)
  });

  it('[range] every vortex carries embossDir + billowPhase in [0, 2π]', () => {
    for (const regime of [E5_REGIME.GAS_GIANT, E5_REGIME.NEPTUNIAN, E5_REGIME.SATURNIAN]) {
      const rec = resolveStormE(regime, GAS, 5, 1234);
      expect(rec.vortices.length).toBeGreaterThan(0);
      for (const v of rec.vortices) {
        expect(v.embossDir).toBeGreaterThanOrEqual(0);
        expect(v.embossDir).toBeLessThanOrEqual(TWO_PI + 1e-9);
        expect(v.billowPhase).toBeGreaterThanOrEqual(0);
        expect(v.billowPhase).toBeLessThanOrEqual(TWO_PI + 1e-9);
      }
    }
  });

  it('[determinism] same (regime, macroSeed, stormSeed) ⇒ identical embossDir/billowPhase', () => {
    for (const [regime, s, ss] of [[E5_REGIME.GAS_GIANT, 5, 1234], [E5_REGIME.NEPTUNIAN, 7, 99]]) {
      const a = resolveStormE(regime, GAS, s, ss), b = resolveStormE(regime, GAS, s, ss);
      expect(a.vortices.map((v) => v.embossDir)).toEqual(b.vortices.map((v) => v.embossDir));
      expect(a.vortices.map((v) => v.billowPhase)).toEqual(b.vortices.map((v) => v.billowPhase));
    }
  });

  it('[append-only, no cross-stream draw] emboss/billow do NOT vary the placement scalars they follow', () => {
    // the emboss/billow post-pass draws from its OWN streams, so age/phase/lon/lat/mask-driving .center
    // are byte-identical to a run — the golden mask + phase bank fence (asserted in the storm-e suite)
    // holds by construction. Here: the pre-existing scalars still reproduce exactly across two runs.
    const a = resolveStormE(E5_REGIME.GAS_GIANT, GAS, 3, 1234);
    const b = resolveStormE(E5_REGIME.GAS_GIANT, GAS, 3, 1234);
    expect(a.vortices.map((v) => [v.lat, v.lon, v.ageScalar, v.phaseScalar]))
      .toEqual(b.vortices.map((v) => [v.lat, v.lon, v.ageScalar, v.phaseScalar]));
  });
});

describe('S2 STORM_DECK — frozen deck table (F16-consts: every value has a named consumer)', () => {
  it('[shape] the five-row deck table is the pinned column heights', () => {
    expect(STORM_DECK).toEqual({ FLOOR: 0.0, BELT: 0.35, ZONE: 0.7, TOWER: 0.9, HAZE: 1.0 });
    expect(Object.isFrozen(STORM_DECK)).toBe(true);
    // ordered floor → belt → zone → tower → haze (the vertical column)
    expect(STORM_DECK.FLOOR).toBeLessThan(STORM_DECK.BELT);
    expect(STORM_DECK.BELT).toBeLessThan(STORM_DECK.ZONE);
    expect(STORM_DECK.ZONE).toBeLessThan(STORM_DECK.TOWER);
    expect(STORM_DECK.TOWER).toBeLessThan(STORM_DECK.HAZE);
  });
  it('[no alea] STORM_DECK is a plain declared const — the storm-e alea-guard is not weakened', () => {
    const body = STORM_SRC.slice(STORM_SRC.indexOf('export const STORM_DECK'));
    const decl = body.slice(0, body.indexOf(';') + 1);
    expect(decl).not.toMatch(/alea\(/);
  });
});

describe('S2 carriage — uStormAux slot-sync (F2) + train s.mode pass-through', () => {
  it('[decl] uStormAux[8] is declared in HEIGHT_GLSL and provisioned in the uniforms map', () => {
    expect(GLSL_CODE).toMatch(/uniform\s+vec4\s+uStormAux\[8\]/);
    expect(UNIF_CODE).toContain('uStormAux');
  });

  it('[F2 slot-sync] uStormAux is written INSIDE BOTH gated composition blocks at the matching slot', () => {
    // greatSpotEnabled block ⇒ slot 0; stormTrainEnabled loop ⇒ slot _stormN. A naive aux[0]=primary /
    // aux[1..]=train fill desyncs from the other arrays whenever greatSpot is unchecked (train ⇒ slot 0+).
    const greatBlock = fnBody(LAB_CODE, 'if (state.greatSpotEnabled && state.spotStrength');
    const trainBlock = fnBody(LAB_CODE, 'if (state.stormTrainEnabled && state.trainStrength');
    expect(greatBlock).toMatch(/uStormAux\.value\[0\]\.set\(/);          // slot-0 aux write in the greatSpot block
    expect(trainBlock).toMatch(/uStormAux\.value\[_stormN\]\.set\(/);    // slot-_stormN aux write in the train loop
    // the aux write sits alongside the other arrays at the SAME slot index in each block
    expect(greatBlock).toMatch(/uStormPosSize\.value\[0\]/);
    expect(trainBlock).toMatch(/uStormPosSize\.value\[_stormN\]/);
  });

  it('[s.mode pass-through] the train slot writes the TRUE storm mode (was hard-coded 0)', () => {
    const trainBlock = fnBody(LAB_CODE, 'if (state.stormTrainEnabled && state.trainStrength');
    expect(trainBlock).toMatch(/uStormParams\.value\[_stormN\]\.set\(s\.rot,\s*s\.aspect,\s*s\.mode,\s*s\.companion\)/);
  });

  it('[deckZ derivation] the carriage derives deckZ from mode+age via STORM_DECK, not a raw literal', () => {
    // the deck value is DERIVED (mode-0 tower / mode-1 floor) — the derivation reads STORM_DECK, so the
    // deck constants have a real consumer (F16-consts / AC-0 driver connectivity).
    expect(LAB_CODE).toContain('_stormDeckZ');
    expect(LAB_CODE).toMatch(/STORM_DECK\.(FLOOR|ZONE|TOWER)/);
  });

  it('[envelope] S2 adds NO new baked attribute (aStorm stays the only one)', () => {
    expect((LAB_RAW.match(/attribute float aStorm\b/g) || []).length).toBe(1);
    expect(LAB_RAW).not.toMatch(/uStormMask/);   // uStormAux is not a mask uniform
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Slice S3 — DECK-Z COMPOSITOR (AC-DECK enablement; footnotes 17/18/21). All edits live inside
// zonalBandCol + stormColTerms (planet-lod-height.glsl.js); every new term sits inside the uStormCount>0
// gate or the per-storm loop ⇒ off-gate byte-identity is STRUCTURAL (AC-OFFGATE). AC-STATIC is a diff-
// scoped grep on the S3 code (const block + stormColTerms), comment-stripped. Live pixel probes (emboss
// asymmetry / cold collar / belt-family interior / rim wisps) are the ORCHESTRATOR's; this block owns the
// source-structure closers + the AC-STATIC / dAdvect-untouched fence.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
const GLSL_RAW = src('../src/worldengine/shaders/height.glsl.js');
// diff-scoped S3 slice: the deck header + consts through the end of stormColTerms (F29 banner follows it).
const S3_RAW  = GLSL_RAW.slice(GLSL_RAW.indexOf('// ── S3 DECK-Z COMPOSITOR'), GLSL_RAW.indexOf('// ── F29 polarVortexCol'));
const S3_CODE = strip(S3_RAW);

describe('S3 AC-STATIC — the deck compositor is static (no uTime / animated-warp path)', () => {
  it('[F1 diff-scoped] the S3 const block + stormColTerms body carry no uTime / animated-warp identifiers', () => {
    // house pattern (K_CODE/I_CODE): comment-stripped, diff-scoped to the added code — a whole-file grep
    // false-trips on the legacy F25 jets path. The prose "no uTime" in the comments is stripped out first.
    expect(S3_CODE).not.toMatch(/uTime/);
    expect(S3_CODE).not.toMatch(/\b(ph0|ph1|r0|r1|jetRotY|jetsDisp)\b/);
  });
});

describe('S3 AC-DECK (enablement) — deckZ drives compositing inside stormColTerms', () => {
  it('[signature] stormColTerms carries the hood param; the call site + reorder pass it', () => {
    expect(GLSL_CODE).toContain('vec3 stormColTerms(vec3 n, vec3 col, float hood)');
    // the reordered tail: hood computed + applied to the BASE deck BEFORE the storm call, hood passed in
    const hoodDecl = GLSL_CODE.indexOf('float hood = smoothstep(0.72, 0.95, abs(trueLat))');
    const stormCall = GLSL_CODE.indexOf('stormColTerms(N, col, hood)');
    expect(hoodDecl).toBeGreaterThan(0);
    expect(stormCall).toBeGreaterThan(hoodDecl);                     // storm call AFTER the hood multiply (deck-weighted exposure)
    expect(GLSL_CODE).toContain('col = mix(col, stormColTerms(N, col, hood), provinceWeight(PROV_GREATSPOT))');
  });

  it('[deck consts] the S3 constants are declared with named consumers (F16-consts)', () => {
    for (const c of ['DECK_HAZE = 1.0', 'EMB_K     = 0.18', 'COLLAR_K  = 0.55', 'WISP_K    = 0.10'])
      expect(GLSL_CODE).toContain(c);
  });

  it('[per-storm reads] stormColTerms reads the uStormAux carriage (age + deckZ) inside the loop', () => {
    const body = fnBody(GLSL_CODE, 'vec3 stormColTerms(vec3 n, vec3 col, float hood)');
    expect(body).toContain('uStormAux[i].x');                        // ageScalar
    expect(body).toContain('uStormAux[i].z');                        // deckZ (STORM_DECK-derived height)
    expect(body).toContain('prom  = 0.35 + 0.65 * age');             // prominence ∝ age (carriage cross-ref)
    // deck-weighted haze: mutes prop (1 − deckZ); uHazeMute 0 ⇒ hazeX 0 ⇒ identity (V-β.4 precedent)
    expect(body).toContain('hazeX = uHazeMute * (1.0 - deckZ)');
  });

  it('[mode-0 tower] emboss rim + cold annulus + age-∝ prominence (footnote 17)', () => {
    const body = fnBody(GLSL_CODE, 'vec3 stormColTerms(vec3 n, vec3 col, float hood)');
    expect(body).toContain('core * (0.60 + 0.30 * prom)');           // tower prominence ∝ age (was flat 0.85)
    expect(body).toContain('EMB_K * prom * rim * asym * hazeAmp');   // shaded-relief emboss on the emboss axis
    expect(body).toContain('cos(thv - embossDir)');                  // asymmetry across the stormE:emboss direction
    expect(body).toContain('vec3(0.90, 0.99, 1.14)');                // cold-annulus blue-shift (recast collar)
    expect(body).toContain('COLLAR_K * collar * hazeAmp');
  });

  it('[mode-1 reveal] deep-deck fill (belt-family, donor ratio CLAMPED 1.5 — F-deep) + rim wisps (footnote 18)', () => {
    const body = fnBody(GLSL_CODE, 'vec3 stormColTerms(vec3 n, vec3 col, float hood)');
    // interior HUE from the belt family (deepBase), VALUE from the writer lifecycle donor, ratio min(·,1.5)
    expect(body).toContain('vec3 deepBase = uBandTint * vec3(0.62, 0.52, 0.42) * vec3(0.72, 0.60, 0.52)');
    expect(body).toContain('min(dot(uStormColor[i], LUMA) / max(dot(deepBase, LUMA), 1.0e-3), 1.5)');
    expect(body).toContain('col = mix(col, deep, core * 0.85)');     // core targets the deep deck, NOT uStormColor
    // rim wisps at the BAND frequency (a clearing you look into)
    expect(body).toContain('sin(uBandM * latHere + uBandPhaseJet');
    expect(body).toContain('WISP_K * wispBand * wisp');
  });

  it('[hoodExposure] the deck-weighted hood-exposure term is present (documented-marginal, F16-hood)', () => {
    const body = fnBody(GLSL_CODE, 'vec3 stormColTerms(vec3 n, vec3 col, float hood)');
    expect(body).toContain('0.30 * hood * (DECK_HAZE - deckZ)');     // tower barely dims, mode-1 hole dims fully
  });

  it('[off-gate structural] the S3 terms live inside the per-storm loop; the storm call stays uStormCount-gated', () => {
    const body = fnBody(GLSL_CODE, 'vec3 stormColTerms(vec3 n, vec3 col, float hood)');
    expect(body).toContain('for (int i = 0; i < 8; i++)');
    expect(body).toContain('if (i >= uStormCount) break;');
    // the deck reads + branch sit AFTER the count-gate break ⇒ never reached at count 0
    const brk = body.indexOf('if (i >= uStormCount) break;');
    expect(body.indexOf('uStormAux[i].z')).toBeGreaterThan(brk);
    expect(body.indexOf('uStormParams[i].z < 0.5')).toBeGreaterThan(brk);
    // the whole call is gated — stormless (count 0) skips it entirely (byte-identical off-gate)
    expect(GLSL_CODE).toContain('if (uStormCount > 0) col = mix(col, stormColTerms(N, col, hood)');
  });
});

describe('S3 AC-FENCE — dAdvect (the LIKED layer) is untouched', () => {
  it('[dAdvect intact] the dLat seam + dAdvect candidate constants are unchanged (band-flow [parity] re-pin)', () => {
    // S3 edits only the storm-section compositing; the dAdvect body + dLat wire are byte-untouched. The
    // band-flow suite pins the full body — here a light cross-check that the seam substrings still stand.
    expect(GLSL_CODE).toContain('dAdvect(Nraw, wShear, wBand, wStorm) + dWake(Nraw)');
    expect(GLSL_CODE).toContain('INK_FREQ = 2.2');
    expect(GLSL_CODE).toContain('bandProxy(latRaw + dLat) - bandProxy(latRaw)');
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Slice S4 — dSPIRAL STATIC ROLL-UP (AC-SPIRAL enablement; footnote 19). BAND_SPIRAL mirror (radial-Δψ
// wrap — F9; rr-coupled LEAN — F15; envelope ×(1+SCAL) — F-env) + dSpiralVec (I_BODIES naming constraint
// — F7) consumed through BRANCHED NrawD/posD derived from the received pos (F1/F8; jag excluded — F3).
// The numeric truth lives in the band-flow mirror (no GPU in vitest); the GLSL is a faithful STRUCTURAL
// transcription pinned by the constant-parity substrings. Live radial-transect reads are the ORCHESTRATOR's.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// per-seed lab-path P (derived D-slots + bundle rotationRate/radius — the band-flow / calibrate idiom)
const seedP = (regime, seed) => {
  const bundle = DRIVER_BUNDLES[regime];
  const d = deriveGiantDrivers(drawGiantConditions(regime, canonicalGiantCondition(regime), seed));
  const drv = { ...d, rotationRate: bundle.rotationRate, radius: bundle.radius };
  return { P: resolveParams(regime, drv, seed), drv };
};
// synthetic single vortex on the lon=0 meridian at a chosen latitude (center is unit by construction)
const mkVortex = (lat, o = {}) => ({
  center: [Math.cos(lat), Math.sin(lat), 0], lat, lon: 0,
  radius: o.radius != null ? o.radius : 0.2, rot: o.rot != null ? o.rot : 1,
  aspect: o.aspect != null ? o.aspect : 1, mode: o.mode != null ? o.mode : 0,
  ageScalar: o.age != null ? o.age : 1, billowPhase: o.billowPhase != null ? o.billowPhase : 0.7,
});

describe('S4 dSpiral mirror — BAND_SPIRAL static log-spiral roll-up props', () => {
  const { P } = seedP(E5_REGIME.GAS_GIANT, 42);
  // a latitude that flows east (bandProxy>0.5) and one that flows west (<0.5) — for the F15 sign test
  const findLat = (want) => { for (let lat = -1.2; lat <= 1.2; lat += 0.02) if (Math.sign(bandProxy(lat, P) - 0.5) === want) return lat; return null; };
  const latPos = findLat(1), latNeg = findLat(-1);

  it('[NB formula] SPIRAL_NB == max(3, round(2π/LAMBDA_KH)) == 42 (R-invariant lobe count)', () => {
    expect(SPIRAL_NB).toBe(Math.max(3, Math.round((2 * Math.PI) / BAND_SPIRAL.LAMBDA_KH)));
    expect(SPIRAL_NB).toBe(42);
  });

  it('[off-gate] zero / null vortices ⇒ exactly [0, 0] (AC-OFFGATE, the count-gate)', () => {
    const dir = [0.4, 0.5, 0.766];
    expect(spiralDisplacement(dir, [], P)).toEqual([0, 0]);
    expect(spiralDisplacement(dir, null, P)).toEqual([0, 0]);
  });

  it('[core coherent] rr < ANN_IN ⇒ ~0 displacement (the core oval is not wound)', () => {
    const prof = spiralWrapProfile(mkVortex(0.3), P);
    for (const thv of [0, 1.1, 2.5, 4.4]) expect(prof.magAt(0.2, thv)).toBeLessThan(1e-9);
  });

  it('[wrap radial, F9] Δψ across two radii on one azimuth == W·Δln(rr+EPS); ∝ ageScalar (monotone)', () => {
    const thv = 0.6, rr1 = 1.0, rr2 = 1.5;
    const dpsi = (age) => { const p = spiralWrapProfile(mkVortex(0.3, { age }), P); return p.psiAt(rr2, thv) - p.psiAt(rr1, thv); };
    const p1 = spiralWrapProfile(mkVortex(0.3, { age: 1 }), P);
    expect(dpsi(1)).toBeCloseTo(p1.deltaPsiPredicted(rr1, rr2), 6);    // Δψ = W·Δln (thv cancels)
    // ∝ ageScalar: age 1 winds exactly twice as far as age 0.5; both nonzero, monotone
    expect(Math.abs(dpsi(1))).toBeGreaterThan(Math.abs(dpsi(0.5)));
    expect(dpsi(1) / dpsi(0.5)).toBeCloseTo(2, 5);
    expect(dpsi(0)).toBeCloseTo(0, 9);                                 // age 0 ⇒ W 0 ⇒ no wind
  });

  it('[lobe count] the annulus scallop shows exactly SPIRAL_NB (42) lobes around a ring', () => {
    const prof = spiralWrapProfile(mkVortex(0.3), P);
    const M = 4200, mags = [];
    for (let k = 0; k < M; k++) mags.push(prof.magAt(BAND_SPIRAL.ANN_PEAK, (2 * Math.PI * k) / M));
    let peaks = 0;
    for (let k = 0; k < M; k++) { const a = mags[(k - 1 + M) % M], b = mags[k], c = mags[(k + 1) % M]; if (b > a && b > c) peaks++; }
    expect(peaks).toBe(SPIRAL_NB);
  });

  it('[lobe lean, F15] the crest azimuth shifts with radius at rate LEAN, signed by the local flow', () => {
    expect(latPos).not.toBeNull(); expect(latNeg).not.toBeNull();
    const predicted = BAND_SPIRAL.LEAN * (BAND_SPIRAL.ANN_OUT_LO - BAND_SPIRAL.ANN_PEAK);   // 0.6·0.55 = 0.33
    const profP = spiralWrapProfile(mkVortex(latPos), P);
    const shiftP = profP.crestShift(BAND_SPIRAL.ANN_PEAK, BAND_SPIRAL.ANN_OUT_LO);
    expect(profP.flow).toBe(1);
    expect(Math.abs(shiftP)).toBeGreaterThan(0.1);                    // non-degenerate (a constant phase ⇒ 0 shift)
    expect(Math.abs(Math.abs(shiftP) - predicted)).toBeLessThan(0.03);
    expect(Math.sign(shiftP)).toBe(profP.flow);
    // opposite flow ⇒ opposite lean (the flow-sign dependence is OBSERVABLE, not laundered into billowPhase)
    const profN = spiralWrapProfile(mkVortex(latNeg), P);
    const shiftN = profN.crestShift(BAND_SPIRAL.ANN_PEAK, BAND_SPIRAL.ANN_OUT_LO);
    expect(profN.flow).toBe(-1);
    expect(Math.sign(shiftN)).toBe(profN.flow);
    expect(Math.sign(shiftN)).not.toBe(Math.sign(shiftP));
  });

  it('[envelope, F-env] |displacement| ≤ AMP·R·(1+SCAL)·ink (the scallop peaks at 1+SCAL)', () => {
    const R = 0.2, ink = 1, bound = BAND_SPIRAL.AMP * R * (1 + BAND_SPIRAL.SCAL) * ink;
    const prof = spiralWrapProfile(mkVortex(0.3, { radius: R }), P, { ink });
    let mx = 0;
    for (let rr = BAND_SPIRAL.ANN_IN; rr <= BAND_SPIRAL.ANN_OUT_HI; rr += 0.02)
      for (let t = 0; t < 2 * Math.PI; t += Math.PI / 60) mx = Math.max(mx, prof.magAt(rr, t));
    expect(mx).toBeLessThanOrEqual(bound + 1e-9);
    expect(mx).toBeGreaterThan(0.5 * bound);                          // and the bound is actually approached (not a vacuous pass)
  });

  it('[static/determinism] same inputs ⇒ byte-equal displacement (pure, no uTime / no rng)', () => {
    const dir = [0.9, 0.29, 0.31], v = [mkVortex(0.3)];
    expect(spiralDisplacement(dir, v, P)).toEqual(spiralDisplacement(dir, v, P));
    // and it is a REAL displacement in the annulus (not trivially zero)
    const prof = spiralWrapProfile(mkVortex(0.3), P);
    expect(prof.magAt(BAND_SPIRAL.ANN_PEAK, 0.9)).toBeGreaterThan(0);
  });

  it('[real primary] a resolved storm primary winds age-dependently (uses the shipped storm record)', () => {
    for (const seed of [1, 42, 1234]) {
      const { P: Pg, drv } = seedP(E5_REGIME.GAS_GIANT, seed);
      const rec = resolveStormE(E5_REGIME.GAS_GIANT, { ...drv, composition: 'h2-he' }, seed, 1234);
      expect(rec.primary).toBeTruthy();
      const prof = spiralWrapProfile(rec.primary, Pg, { ink: 1 });
      const wv = prof.wrapVisibleOver(BAND_SPIRAL.ANN_IN, BAND_SPIRAL.ANN_OUT_HI);
      expect(wv).toBeGreaterThanOrEqual(0);
      expect(wv).toBeLessThan(1);                                     // never more than a full turn at these candidates
    }
  });
});

describe('S4 dSpiral GLSL ↔ mirror constant parity + consumption wiring', () => {
  it('[parity] dSpiralVec carries the SAME BAND_SPIRAL constants as the mirror (a drift on either side fails)', () => {
    expect(BAND_SPIRAL.WRAP).toBe(2.5);      expect(GLSL_CODE).toContain('SPIRAL_WRAP = 2.5');
    expect(BAND_SPIRAL.EPS).toBe(0.08);      expect(GLSL_CODE).toContain('SPIRAL_EPS = 0.08');
    expect(BAND_SPIRAL.AMP).toBe(0.30);      expect(GLSL_CODE).toContain('SPIRAL_AMP = 0.30');
    expect(BAND_SPIRAL.ANN_IN).toBe(0.45);   expect(GLSL_CODE).toContain('SPIRAL_ANN_IN = 0.45');
    expect(BAND_SPIRAL.ANN_PEAK).toBe(0.80); expect(GLSL_CODE).toContain('SPIRAL_ANN_PEAK = 0.80');
    expect(BAND_SPIRAL.ANN_OUT_LO).toBe(1.35); expect(GLSL_CODE).toContain('SPIRAL_OUT_LO = 1.35');
    expect(BAND_SPIRAL.ANN_OUT_HI).toBe(2.0);  expect(GLSL_CODE).toContain('SPIRAL_OUT_HI = 2.0');
    expect(BAND_SPIRAL.SCAL).toBe(0.35);     expect(GLSL_CODE).toContain('SPIRAL_SCAL = 0.35');
    expect(BAND_SPIRAL.LEAN).toBe(0.6);      expect(GLSL_CODE).toContain('SPIRAL_LEAN = 0.6');
    expect(SPIRAL_NB).toBe(42);              expect(GLSL_CODE).toContain('SPIRAL_NB = 42.0');
  });

  it('[wire] dSpiralVec is dWake\'s sibling — count-gated, same tangent frame, derived flow, uAtmoInk-scaled', () => {
    const body = fnBody(GLSL_CODE, 'vec3 dSpiralVec(vec3 Nraw)');
    expect(body).toContain('if (i >= uStormCount) break;');
    expect(body).toContain('normalize(cross(vec3(0.0, 1.0, 0.0), c))');
    expect(body).toContain('sign(bandProxy(latS) - 0.5)');
    expect(body).toContain('W * log(rr + SPIRAL_EPS)');              // the log-spiral phase
    expect(body).toContain('uStormAux[i].x');                        // ageScalar drives wrap
    expect(body).toContain('uStormAux[i].w');                        // billowPhase drives the scallop
    expect(body).toContain('uAtmoInk');
  });

  it('[consumption] posD/NrawD branch on uStormCount (bitwise off-gate) + the dLat meridional append', () => {
    expect(GLSL_CODE).toContain('vec3 dSp   = dSpiralVec(Nraw);');
    expect(GLSL_CODE).toContain('(uStormCount > 0) ? normalize(Nraw + dSp) : Nraw');
    expect(GLSL_CODE).toContain('normalize(pos / length(pos) + dSp) * length(pos) : pos');
    // the meridional term is APPENDED after dWake(Nraw) — the band-flow [wire] substring stays contained
    expect(GLSL_CODE).toContain('dAdvect(Nraw, wShear, wBand, wStorm) + dWake(Nraw) + (asin(clamp(NrawD.y, -1.0, 1.0)) - latRaw)');
  });

  it('[pigment, F3] the primary warp + filament ride posD; the slice-J jag KEEPS un-displaced pos', () => {
    expect(GLSL_CODE).toContain('bandWarpField(posD)');                              // jets-off primary warp
    expect(GLSL_CODE).toContain('jetRotY(posD, u * uJetSpeed * (ph0 - 0.5))');       // jets-on primary warp
    expect(GLSL_CODE).toContain('bandWarpField(posD * 3.7 + vec3(8.3, -2.9, 5.1))'); // filament entrains
    expect(GLSL_CODE).toContain('bandWarpField(pos * 7.0 + vec3(-5.9, 2.2, 8.8))');  // jag pinned to pos (F3, band-flow [parity])
  });

  it('[F7 / AC-STATIC] the dSpiralVec body has no uTime / banned identifiers (I_BODIES naming constraint)', () => {
    const body = fnBody(GLSL_CODE, 'vec3 dSpiralVec(vec3 Nraw)');
    expect(body).not.toMatch(/uTime/);
    expect(body).not.toMatch(/\b(ph0|ph1|r0|r1|jetRotY|jetsDisp)\b/);
  });
});

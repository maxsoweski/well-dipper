// tests/shader-warmup-source-parity.test.js — the warm-up must warm the program the game DRAWS.
//
// WHAT THIS PROTECTS. Stage 0's title-screen warm-up (src/rendering/ShaderWarmup.js) removes the
// measured 4 076 ms of cold planet-shader link cost by compiling the three GAME planet-surface
// programs before any planet exists. ⭐ The registry holds FOUR variants, not three — `lab` (Step 6c)
// is the lab planet material's own 366,262-byte program, measured 29.8 s cold, and it is warmed only
// when the Step-6e flag admits it. Nothing below may hardcode the three: a literal list is how the
// lab entry became deletable with zero tests moving.
//
// three caches GPU programs by shader SOURCE, so the parity half of this file
// rests on one invariant: the string the warm-up compiles is character-for-character the string
// Planet._createSurface builds its material from. Break that and the warm-up still runs, still
// resolves, still reports a healthy multi-second compile — and warms a program nothing ever draws,
// while the game pays the full cost again on first arrival. There is no failure signal at runtime.
//
// WHY IT IS NOT AN IN-GAME CHECK. The live measurement (cache-busted compile cost, before/after)
// is the real proof and was taken. But it is a wall-clock measurement on one machine's driver, and
// a future edit that retypes a shader in the warm-up — or applies the cache-bust to one path and
// not the other — would only show up as "the warm-up stopped helping", months later, on a number
// nobody re-measures. This pins the invariant in plain JS instead.

import * as THREE from 'three';
import { describe, it, expect, afterEach } from 'vitest';
import {
  PLANET_SHADER_VARIANTS,
  shaderVariantFor,
  planetShaderSource,
  setLabGasBodiesOverride,
} from '../src/objects/Planet.js';
import {
  buildProbeMaterial,
  WARMUP_VARIANTS,
  VARIANT_ORDER,
  resolveWarmVariants,
  MATERIAL_SWAPS,
  recordMaterialSwap,
  restoreMaterialSwap,
  pruneMaterialSwaps,
  warmPlanetPrograms,
} from '../src/rendering/ShaderWarmup.js';
import { isLabPlanetMaterial } from '../src/rendering/LabPlanetMaterial.js';

// ⭐ DERIVED, NEVER TYPED. Every loop below that means "the game variants" asks the registry which
// ones those are. The literal `['gas','rocky','exotic']` this file used to carry is precisely why
// the `lab` entry could be deleted without a single test moving: no test could ever see a key the
// list did not already name. Membership is pinned separately, below.
const GAME_VARIANTS = Object.keys(WARMUP_VARIANTS).filter((k) => WARMUP_VARIANTS[k].kind === 'game');

// planetShaderSource reads window.__shaderCacheBust; the vitest environment is node, so there is
// no window unless a test makes one. The 6e flag override and the swap registry are module-level
// state too, and a leaked value from one test is a silent pass in the next.
afterEach(() => {
  delete globalThis.window;
  setLabGasBodiesOverride(null);
  MATERIAL_SWAPS.clear();
});

describe('planet shader variants', () => {
  it('collapses every planet type the game generates to one of exactly three programs', () => {
    // The full type list, from the GAS_TYPES / ROCKY_TYPES sets in Planet.js plus the exotics that
    // fall through to the else branch. Three programs for 18 types is the reason warming three
    // programs warms the whole game.
    const types = [
      'gas-giant', 'hot-jupiter', 'eyeball', 'sub-neptune',
      'rocky', 'ice', 'lava', 'ocean', 'terrestrial', 'venus', 'carbon',
      'iron', 'chthonian', 'super-earth', 'dwarf', 'shattered', 'ringworld', undefined,
    ];
    const variants = new Set(types.map(shaderVariantFor));
    expect([...variants].sort()).toEqual(['exotic', 'gas', 'rocky']);
    for (const v of variants) expect(PLANET_SHADER_VARIANTS[v]).toBeDefined();
  });

  it('gives the three variants genuinely distinct fragment source', () => {
    // If two variants ever shared source they would share a program, and the per-variant compile
    // numbers this lane measured (GAS 576 / EXOTIC 1 677 / ROCKY 1 823 ms) would be measuring the
    // same link twice.
    const frags = GAME_VARIANTS.map((k) => PLANET_SHADER_VARIANTS[k].fragmentShader);
    expect(new Set(frags).size).toBe(GAME_VARIANTS.length);
    // All three share the header, so they must not be trivially distinct either.
    for (const f of frags) expect(f.length).toBeGreaterThan(1000);
  });

  it('shares ONE vertex program across all three', () => {
    const verts = GAME_VARIANTS.map((k) => PLANET_SHADER_VARIANTS[k].vertexShader);
    expect(new Set(verts).size).toBe(1);
  });
});

describe('warm-up registry membership', () => {
  // ⭐ THE POINT OF THIS BLOCK (finding S6-M11/S6-M4). Before it, deleting the `lab` entry from
  // WARMUP_VARIANTS moved ZERO tests: every loop in this file walked a hardcoded
  // `['gas','rocky','exotic']`, so the fourth key was invisible to the suite by construction. These
  // are the only literals in the file, and they are literals ON PURPOSE — this is the membership
  // pin, and a membership pin that derives its expectation from the thing it is pinning pins
  // nothing (PLAN §4 Step 4's scar: a count-preserving permutation passed every instrument
  // byte-identically).
  const EXPECTED = ['exotic', 'gas', 'lab', 'rocky'];

  it('registers exactly four variants, one of them the lab program', () => {
    expect(Object.keys(WARMUP_VARIANTS).sort()).toEqual(EXPECTED);
    expect(WARMUP_VARIANTS.lab).toBeDefined();
    expect(WARMUP_VARIANTS.lab.kind).toBe('lab');
    expect(GAME_VARIANTS.sort()).toEqual(['exotic', 'gas', 'rocky']);
  });

  it('keeps VARIANT_ORDER and the registry the SAME SET, with lab last', () => {
    // Two independent lists that must not drift: a key in the registry but not the order is never
    // warmed by default, and a key in the order but not the registry warms nothing and is recorded
    // as an unknown-variant skip.
    expect([...VARIANT_ORDER].sort()).toEqual(EXPECTED);
    expect([...VARIANT_ORDER].sort()).toEqual(Object.keys(WARMUP_VARIANTS).sort());
    // ⚠ Order is load-bearing, not cosmetic: the lab link is roughly 7x the wall-clock of all three
    // game links combined, and kicking it off first would queue the programs EVERY arrival needs
    // behind a ~30 s job on a title screen the player may dismiss in two.
    expect(VARIANT_ORDER[VARIANT_ORDER.length - 1]).toBe('lab');
  });

  it('points the lab entry at the real lab shader, not a stand-in', () => {
    // Measured: gas 27 887 / rocky 46 146 / exotic 34 841 / lab 366 262 fragment bytes. An entry
    // wired to the wrong source would still be "present", so presence alone is not the assertion.
    const biggestGame = Math.max(...GAME_VARIANTS.map((k) => WARMUP_VARIANTS[k].bytes()));
    expect(WARMUP_VARIANTS.lab.bytes()).toBeGreaterThan(biggestGame * 5);
    for (const key of Object.keys(WARMUP_VARIANTS)) {
      expect(typeof WARMUP_VARIANTS[key].build).toBe('function');
      expect(WARMUP_VARIANTS[key].bytes()).toBeGreaterThan(1000);
    }
  });
});

describe('the DEFAULT warm set is gated on the 6e flag', () => {
  // S6-M2/S6-M9. main.js's title-screen call passes no `variants`, so the default set IS what boots.
  // With the flag off, defaulting to the whole of VARIANT_ORDER built and permanently retained a
  // 366 262-byte / 356-uniform lab material — and queued its ~30 s link — for a program no body in
  // the session could be drawn with.
  it('omits lab, WITH A REASON, when lab gas bodies are off', () => {
    setLabGasBodiesOverride(false);
    const sel = resolveWarmVariants();
    expect(sel.variants).toEqual(['gas', 'rocky', 'exotic']);
    expect(sel.source).toBe('default');
    expect(sel.labGasBodies.enabled).toBe(false);
    // The reason is the deliverable: an absent key alone cannot distinguish "the flag excluded it"
    // from "someone deleted the registry entry".
    expect(sel.omitted.map((o) => o.key)).toEqual(['lab']);
    expect(sel.omitted[0].reason).toContain('OFF');
    expect(sel.omitted[0].reason).toContain(sel.labGasBodies.source);
  });

  it('warms lab in the default set when the flag is on', () => {
    setLabGasBodiesOverride(true);
    const sel = resolveWarmVariants();
    expect(sel.variants).toEqual(VARIANT_ORDER);
    expect(sel.labGasBodies.enabled).toBe(true);
    expect(sel.omitted).toEqual([]);
  });

  it('never gates an EXPLICIT request — the measurement path still warms lab with the flag off', () => {
    setLabGasBodiesOverride(false);
    const sel = resolveWarmVariants({ variants: ['gas', 'lab'] });
    expect(sel.variants).toEqual(['gas', 'lab']);
    expect(sel.source).toBe('caller');
    expect(sel.omitted).toEqual([]);
  });

  it('falls back to LAB_GAS_BODIES_DEFAULT (off) when nothing sets the flag', () => {
    // No override, no window: the shipped boot. This is the case main.js actually hits.
    setLabGasBodiesOverride(null);
    const sel = resolveWarmVariants();
    expect(sel.labGasBodies.source).toBe('default');
    expect(sel.variants).not.toContain('lab');
  });
});

describe('the boot warm-up itself, end to end', () => {
  // ⛔ THE MEASURED DEFECT, at the call site that actually runs. main.js's title-screen call is
  // `warmPlanetPrograms(renderer, camera, { target })` — no `variants` — so the resolver test above
  // is only half the proof; this pins that warmPlanetPrograms USES it. Before the gate, this boot
  // handed the driver a material for which `isLabPlanetMaterial()` is true (366 262 fragment bytes,
  // 356 uniforms) and then retained it in `_keepAlive` forever, with the 6e flag off.
  const runBoot = async (opts) => {
    const compiled = [];
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: () => {},
      compileAsync: (scene) => { compiled.push(scene); return Promise.resolve(); },
    };
    globalThis.requestAnimationFrame = (cb) => { setTimeout(() => cb(0), 0); return 0; };
    const report = await warmPlanetPrograms(renderer, new THREE.Camera(), { force: true, ...opts });
    const materials = compiled.flatMap((s) => s.children.map((c) => c.material));
    return { report, materials };
  };

  afterEach(() => { delete globalThis.requestAnimationFrame; });

  it('builds NO lab material on a default boot with the flag off', async () => {
    setLabGasBodiesOverride(false);
    const { report, materials } = await runBoot();
    expect(report.requested).toEqual(['gas', 'rocky', 'exotic']);
    expect(report.warmed).toEqual(['gas', 'rocky', 'exotic']);
    expect(materials.some(isLabPlanetMaterial)).toBe(false);
    // And the record says WHY, so an absent key is never read as a deleted registry entry.
    expect(report.variantSelection.source).toBe('default');
    expect(report.variantSelection.labGasBodies.enabled).toBe(false);
    expect(report.omitted.map((o) => o.key)).toEqual(['lab']);
  });

  it('still builds the lab material when a caller asks for it explicitly', async () => {
    setLabGasBodiesOverride(false); // ⭐ flag OFF, explicit request — the measurement path
    const { report, materials } = await runBoot({ variants: ['lab'] });
    expect(report.warmed).toEqual(['lab']);
    expect(materials.some(isLabPlanetMaterial)).toBe(true);
    expect(report.variants.lab.fragmentBytes).toBeGreaterThan(300000);
    expect(report.variantSelection.source).toBe('caller');
  });

  it('builds the lab material on a default boot when the flag is ON', async () => {
    setLabGasBodiesOverride(true);
    const { report, materials } = await runBoot();
    expect(report.warmed).toEqual(['gas', 'rocky', 'exotic', 'lab']);
    expect(materials.some(isLabPlanetMaterial)).toBe(true);
  });
});

describe('MATERIAL_SWAPS does not accumulate torn-down bodies', () => {
  // The doc comment on MATERIAL_SWAPS used to claim entries "are deleted on restore and on system
  // teardown". Only the restore delete was ever implemented, so a body swapped via _lab.tryLabShader
  // and left swapped pinned its MESH, its GEOMETRY and BOTH materials past spawnSystem's teardown —
  // once per system. These pin the sweep that now bounds it.
  const liveMesh = (scene, name) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial());
    m.name = name;
    scene.add(m);
    return m;
  };

  it('sweeps a mesh that was live at record time and has since left the scene', () => {
    const scene = new THREE.Scene();
    const a = liveMesh(scene, 'planet-a');
    recordMaterialSwap(a, new THREE.MeshBasicMaterial());
    expect(MATERIAL_SWAPS.size).toBe(1);

    scene.remove(a); // what spawnSystem's teardown does, one line before .dispose()
    expect(pruneMaterialSwaps()).toEqual({ dropped: ['planet-a'], remaining: 0 });
    expect(MATERIAL_SWAPS.has(a)).toBe(false);
  });

  it('sweeps through a removed GROUP, not only a removed mesh', () => {
    // `mesh.parent` alone is not the test: removing the group leaves the mesh with a live-looking
    // non-null parent that leads nowhere.
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial());
    m.name = 'moon-in-group';
    group.add(m);
    scene.add(group);
    recordMaterialSwap(m, new THREE.MeshBasicMaterial());

    scene.remove(group);
    expect(m.parent).toBe(group); // still non-null — the reason the sweep walks to the root
    expect(pruneMaterialSwaps().dropped).toEqual(['moon-in-group']);
  });

  it('bounds the population at one system: recording a new swap sweeps the last one', () => {
    const scene = new THREE.Scene();
    const a = liveMesh(scene, 'system-1-body');
    recordMaterialSwap(a, new THREE.MeshBasicMaterial());
    scene.remove(a);

    const b = liveMesh(scene, 'system-2-body');
    recordMaterialSwap(b, new THREE.MeshBasicMaterial());
    expect([...MATERIAL_SWAPS.keys()]).toEqual([b]);
  });

  it('NEVER sweeps a mesh that was never attached — that is a different state', () => {
    // A bare mesh built off-graph is detached for the opposite reason. Sweeping it would delete a
    // baseline that is still wanted, and restore would then report "never manually swapped" about a
    // body that was.
    const orphan = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial());
    const next = new THREE.MeshBasicMaterial();
    recordMaterialSwap(orphan, next);
    orphan.material = next;
    expect(pruneMaterialSwaps()).toEqual({ dropped: [], remaining: 1 });
    expect(restoreMaterialSwap(orphan).ok).toBe(true);
  });

  it('still keeps the ORIGINAL baseline when a live mesh is swapped twice', () => {
    // The sweep runs before the lookup in recordMaterialSwap; this pins that it cannot disturb the
    // idempotence contract, because a mesh being swapped right now is by definition attached.
    const scene = new THREE.Scene();
    const m = liveMesh(scene, 'twice-swapped');
    const original = m.material;
    const first = new THREE.MeshBasicMaterial();
    const second = new THREE.MeshBasicMaterial();
    expect(recordMaterialSwap(m, first)).toBe(true);
    m.material = first;
    expect(recordMaterialSwap(m, second)).toBe(false);
    m.material = second;
    expect(restoreMaterialSwap(m).ok).toBe(true);
    expect(m.material).toBe(original);
  });
});

describe('warm-up / body source parity', () => {
  it('hands the warm-up probe the exact source a body would render', () => {
    // ⚠ GAME variants only, and by KIND rather than by a literal: `planetShaderSource` is the game
    // path's accessor and has no answer for `lab`, whose source comes from `labShaderSource` in the
    // other renderer. The lab entry's parity holds by construction (its probe IS the real material —
    // see WARMUP_VARIANTS) and is pinned by the registry tests above, not by this loop.
    for (const key of GAME_VARIANTS) {
      const body = planetShaderSource(key);
      const probe = buildProbeMaterial(key);
      expect(probe.vertexShader).toBe(body.vertexShader);
      expect(probe.fragmentShader).toBe(body.fragmentShader);
    }
  });

  it('passes source through unchanged when no cache-bust is set', () => {
    // The identity, not merely an equality: the shipped path must not allocate a second copy of a
    // ~100 KB shader string per body.
    expect(planetShaderSource('rocky')).toBe(PLANET_SHADER_VARIANTS.rocky);
  });

  it('applies the measurement cache-bust to the probe and the body IDENTICALLY', () => {
    // ⛔ The failure this exists for. A cache-bust that reaches only one of the two paths makes the
    // warm-up compile a program the game never asks for — which reads, in a measurement run, as
    // "the warm-up does nothing", and would send the next session hunting a phantom bug in
    // compileAsync or the render-target binding.
    globalThis.window = { __shaderCacheBust: 'parity-test-run' };
    for (const key of GAME_VARIANTS) {
      const body = planetShaderSource(key);
      const probe = buildProbeMaterial(key);
      expect(body.fragmentShader).not.toBe(PLANET_SHADER_VARIANTS[key].fragmentShader);
      expect(body.fragmentShader).toContain('parity-test-run');
      expect(probe.fragmentShader).toBe(body.fragmentShader);
    }
  });

  it('leaves the vertex source alone under a cache-bust', () => {
    // The vertex program is shared and cheap; busting it too would triple-count a link that the
    // game only pays once, and inflate the "before" number this lane is measured against.
    globalThis.window = { __shaderCacheBust: 'parity-test-run' };
    expect(planetShaderSource('rocky').vertexShader).toBe(PLANET_SHADER_VARIANTS.rocky.vertexShader);
  });
});

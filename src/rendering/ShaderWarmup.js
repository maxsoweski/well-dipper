import * as THREE from 'three';
import { planetShaderSource, labGasBodiesFlag } from '../objects/Planet.js';
import { buildLabProbeMaterial, labShaderSource, ensureLabAttributes } from './LabPlanetMaterial.js';

/**
 * ShaderWarmup — build the planet-surface GPU programs BEFORE a planet needs to be drawn.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────────────────────────
 * The first time the game draws a planet it pays the cold link cost of that planet's program on the
 * main thread, inside the draw call. Measured cold, cache-busted, on an RTX 5080 / ANGLE / D3D11 —
 * the three GAME programs:
 *
 *     GAS      576 ms
 *     EXOTIC 1 677 ms
 *     ROCKY  1 823 ms
 *     ───────────────
 *     total  4 076 ms
 *
 * Every planet the LEGACY path renders runs one of exactly those three programs — 18 planet TYPES
 * collapse to 3 because the type only chooses which fragment BODY is concatenated onto the shared
 * header, and three caches programs by shader SOURCE. So warming three programs warms the whole
 * legacy planet population, once.
 *
 * ⭐ THERE IS A FOURTH VARIANT AND IT IS NOT ONE OF THOSE THREE. `lab` (PLAN §4 Step 6c) is the lab
 * planet material's own program — MEASURED 366,262 fragment bytes / 356 uniforms, and 29.8 s cold —
 * and it is drawn only when the Step-6e flag `wd.labGasBodies` is ON, which it is not by default
 * (`LAB_GAS_BODIES_DEFAULT === false`). `WARMUP_VARIANTS` and `VARIANT_ORDER` therefore carry FOUR
 * entries, while the DEFAULT warm set is the flag-gated subset `resolveWarmVariants` returns — read
 * it for why a ~30 s driver link must not be started for a program the boot has already decided
 * nothing in the session will draw. ⚠ Unqualified counts in this file mean the GAME trio; anything
 * covering all four says so.
 *
 * The warp arrival path already gates on `compileAsync` (main.js, "AC9") — it buries the cost inside
 * the tunnel. But the cost is still paid, and it still extends the cruise via HYPER's load-adaptive
 * gate. This module moves it earlier still, onto the title screen, where the player is reading a
 * logo and nothing is waiting on it.
 *
 * ── Why it can be done off the main thread ───────────────────────────────────────────────────────
 * `KHR_parallel_shader_compile` is present on this hardware, and three 0.183 exposes
 * `renderer.compileAsync(scene, camera)`, which links every material in a scene and resolves once
 * the driver reports the programs ready. The synchronous half is just three's JS (string assembly,
 * `glShaderSource`/`glCompileShader`/`glLinkProgram` calls that return immediately under the
 * extension); the multi-second half runs on driver threads.
 *
 * ── Three things that will silently warm NOTHING if you get them wrong ───────────────────────────
 *
 * 1. ⛔ THE WARM MATERIALS MUST STAY ALIVE. three refcounts programs per material and destroys the
 *    program when the last material referencing it is disposed. Dispose the warm-up material and
 *    you hand the program straight back — the real planet then links it again, cold. They are kept
 *    in `_keepAlive` for the lifetime of the page. Three tiny game materials; the cost is a rounding
 *    error against 4 s. ⚠ When the 6e flag admits `lab`, a FOURTH material is retained and it is not
 *    tiny — 356 uniforms and six placeholder textures. Retained anyway, because re-linking it costs
 *    a measured 29.8 s; that is the trade, and it is the reason the default set is gated at all
 *    rather than the retention being made conditional after the fact.
 *
 * 2. ⛔ THE RENDER TARGET MUST MATCH THE ONE THE REAL DRAW USES. The program cache key bakes in
 *    `toneMapping` and `outputColorSpace`, and BOTH are read from the currently-bound target
 *    (canvas: SRGB + renderer.toneMapping; offscreen target: LinearSRGB + none). RetroRenderer draws
 *    the scene into `sceneTarget`, so warming with the canvas bound produces a variant that is never
 *    drawn — and the first real frame links the real one, cold, exactly as before. This is the same
 *    trap main.js's warp gate documents as "Goal 3b"; it cost that lane a debugging session.
 *
 * 3. ⛔ THE SOURCE MUST BE THE SAME STRING. Hence `PLANET_SHADER_VARIANTS` is exported from
 *    Planet.js rather than retyped here.
 *
 * Lights and fog are NOT a trap for these particular materials, unlike the warp gate's lit ones:
 * `ShaderMaterial` defaults to `lights: false` and `fog: false`, so the planet program's cache key
 * carries no light-count or fog variant. Nothing needs to be made visible for this compile.
 */

// ⛔ Never dispose these, never let them be garbage collected — see note 1 above.
const _keepAlive = [];

let _warmPromise = null;

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PLAN §4 STEP 6c — THE LAB PROGRAM IS A WARM-UP VARIANT.
 *
 * ⛔ WHAT LINE `if (!PLANET_SHADER_VARIANTS[key]) continue;` DID. The loop below used to resolve
 * every requested variant against `PLANET_SHADER_VARIANTS`, the GAME's three-entry table, and skip
 * anything absent from it — silently, with `continue`. The lab's fragment shader (363,566 bytes when
 * the plan recorded it; 366,262 measured today via `labShaderSource().fragmentShader.length`) is not
 * in that table and cannot be (it is built in this repo's other renderer), so it was never a
 * candidate for pre-warming at all. Measured by the plan of record at **29.8 s cold / 46.6 ms warm**.
 * On a warp arrival that cost is paid where the player is looking: `compileAsync` overruns HYPER's
 * safety ceiling, main.js force-restores the gated roots, and the link is paid SYNCHRONOUSLY on the
 * first draw.
 *
 * ⛔ AND THE `continue` WAS ITS OWN SMALLER DEFECT. A typo'd or retired variant name vanished with
 * no record — `warmShaders({variants:['labb']})` returned `{ok:true, variants:{}}`, a clean report
 * of nothing. Skips are now recorded with a reason, so "warmed zero programs" and "warmed every
 * program asked for" stop producing the same output.
 *
 * ⭐ ONE REGISTRY, AND MEMBERSHIP IS THE THING THE NEXT AUTHOR EDITS. Step 4's scar is that a gate
 * pinning COUNTS does not pin MEMBERSHIP; the answer here is that there is exactly one place a
 * program can be registered for warming, and both consumers (`buildProbeMaterial`, the warm loop)
 * read it. Adding Step 9's rocky pack material — or Step 10's moon material, if it ever carries its
 * own program — is one entry.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * @type {Object<string, {kind: string, build: () => THREE.ShaderMaterial, bytes: () => number}>}
 */
export const WARMUP_VARIANTS = {
  gas:    { kind: 'game', build: () => _gameProbe('gas'),    bytes: () => planetShaderSource('gas').fragmentShader.length },
  rocky:  { kind: 'game', build: () => _gameProbe('rocky'),  bytes: () => planetShaderSource('rocky').fragmentShader.length },
  exotic: { kind: 'game', build: () => _gameProbe('exotic'), bytes: () => planetShaderSource('exotic').fragmentShader.length },
  // ⭐ The lab probe is `buildLabPlanetMaterial().material` itself — see `buildLabProbeMaterial`.
  // There is no second expression of the lab shader anywhere in the repo, so the parity this
  // module's own test has to assert for the three game variants holds here by construction.
  lab:    { kind: 'lab',  build: () => buildLabProbeMaterial(), bytes: () => _labProbeBytes() },
};

// ⚠ `lab` LAST. `KHR_parallel_shader_compile` overlaps the links, but the driver still takes them in
// the order they are handed over, and the lab program is roughly 7x the wall-clock of all three game
// programs combined. Kicking it off first would put the three programs EVERY arrival needs behind a
// 30 s job on a title screen the player may dismiss in two.
export const VARIANT_ORDER = ['gas', 'rocky', 'exotic', 'lab'];

/**
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * S6-M2 / S6-M9 — THE DEFAULT WARM SET IS FLAG-GATED, AND THE REPORT SAYS WHY.
 *
 * ⛔ WHAT WAS WRONG. `_warmPlanetPrograms` defaulted `variants` to the whole of `VARIANT_ORDER`, and
 * main.js's title-screen call site passes no `variants` at all. So EVERY boot built and linked the
 * lab material — MEASURED at 366,262 fragment bytes and 356 uniforms, `isLabPlanetMaterial()` true —
 * while `LAB_GAS_BODIES_DEFAULT` is `false` and nothing in the session could ever draw it. That is
 * note 1's keep-alive pinning six placeholder textures for the life of the page, plus a ~30 s driver
 * link queued on the title screen that the player's first arrival can still end up waiting behind.
 *
 * ⛔ WHY READING THE FLAG HERE, AT WARM TIME, IS THE RIGHT READ AND NOT A RACE. Both explicit
 * sources `labGasBodiesFlag` consults are settled before this runs: `localStorage['wd.labGasBodies']`
 * is set before boot and survives the reload that IS the 6e OFF frame, and `window.__wdLabGasBodies`
 * is set by the harness before the module graph runs. The warm-up runs later still, from the title
 * screen. There is no window between this read and the first planet draw that a page reload — the
 * only way the 6e flag is flipped — does not already close.
 *
 * ⭐ AN EXPLICIT REQUEST IS NEVER GATED. `warmShaders({variants:[...,'lab']})`, the measurement path,
 * still warms lab with the flag OFF. Only the DEFAULT changes. Gating the explicit form would leave
 * the measurement path unable to measure the one program it exists to measure.
 *
 * ⭐ GATED BY `kind`, NOT BY THE LITERAL `'lab'`. The registry is the one place membership is edited
 * (see WARMUP_VARIANTS); Step 9's rocky pack material and Step 10's moon material arrive as entries,
 * and an entry of kind `lab` is gated the day it is added rather than the day someone remembers.
 *
 * ⭐ AND THE DECISION IS RECORDED, NOT INFERRED. `report.variantSelection` carries which set ran, who
 * chose it, what the flag read and WHICH SOURCE answered. "lab is absent because the flag is off" and
 * "lab is absent because someone deleted the registry entry" are opposite findings that a missing key
 * alone cannot tell apart — the same unreadability the old `continue` produced.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * @param {object} [opts] — the opts object `warmPlanetPrograms` takes; only `variants` is read.
 * @returns {{variants: string[], source: 'caller'|'default',
 *            labGasBodies: {enabled: boolean, source: string},
 *            omitted: Array<{key: string, reason: string}>}}
 */
export function resolveWarmVariants(opts = {}) {
  // `labGasBodiesEnabled()` is exactly `labGasBodiesFlag().enabled`. The flag form is used because it
  // additionally reports WHICH of the three sources answered, and that is half of what the record is
  // for: "off by default" and "explicitly turned off by the harness" read identically otherwise.
  const flag = labGasBodiesFlag();
  const labGasBodies = { enabled: flag.enabled, source: flag.source };

  if (Array.isArray(opts.variants)) {
    return { variants: [...opts.variants], source: 'caller', labGasBodies, omitted: [] };
  }

  const omitted = [];
  const variants = VARIANT_ORDER.filter((key) => {
    if (WARMUP_VARIANTS[key]?.kind !== 'lab') return true;
    if (flag.enabled) return true;
    omitted.push({
      key,
      reason: `lab gas bodies are OFF (${flag.source}), so no body in this session is drawn by the `
            + `'${key}' program. Pass variants:['${key}'] to warm it anyway (measurement path).`,
    });
    return false;
  });
  return { variants, source: 'default', labGasBodies, omitted };
}

function _gameProbe(variantKey) {
  const variant = planetShaderSource(variantKey);
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: variant.vertexShader,
    fragmentShader: variant.fragmentShader,
  });
}

// Reported in the warm-up record so a reader can tell WHICH program the wall-clock belongs to
// (366,262 bytes vs the game variants' 27,887 / 46,146 / 34,841 — all four measured). Read through
// the source accessor, not by building a material: a byte count that allocates six placeholder
// textures is a measurement with a side effect.
function _labProbeBytes() {
  return labShaderSource().fragmentShader.length;
}

/**
 * Build a probe material carrying one variant's exact shader source.
 *
 * No uniforms for the three GAME variants: the program cache key is built from the shader source and
 * the renderer/scene parameters, never from uniform values, and `compile()` never uploads a uniform.
 * A probe with the real planet's ~90-uniform block would link the identical program. (The lab probe
 * carries its full uniform block for the opposite reason — it IS the real material.)
 *
 * The source comes from `planetShaderSource` / `labShaderSource`, the same accessors the real bodies
 * use, so the measurement cache-bust (`window.__shaderCacheBust`) applies identically to the probe
 * and to the real bodies. Busting only one of the two would warm a program nothing draws.
 *
 * @param {string} variantKey — a key of `WARMUP_VARIANTS`
 * @returns {THREE.ShaderMaterial}
 */
export function buildProbeMaterial(variantKey) {
  const entry = WARMUP_VARIANTS[variantKey];
  if (!entry) {
    throw new Error(
      `[SHADER-WARMUP] unknown variant '${variantKey}'. Known: ${Object.keys(WARMUP_VARIANTS).join(', ')}. `
      + 'Returning undefined here is how a warm-up reported success having compiled nothing.',
    );
  }
  return entry.build();
}

/**
 * Compile the planet-surface programs off the main thread — by default the FLAG-GATED subset of
 * `VARIANT_ORDER` that `resolveWarmVariants` returns: the three GAME programs always, plus `lab`
 * only when the Step-6e flag admits it.
 *
 * Idempotent: the first call owns the work, later calls get the same promise. Never rejects — a
 * failed warm-up must degrade to "the game links it later, as it always did", never to a broken
 * boot. Safe to call before any planet exists; that is the point.
 *
 * One variant per animation frame. compileAsync's synchronous half is small but not free (three
 * assembles and hands over that variant's whole GLSL string — measured 27,887 / 46,146 / 34,841
 * bytes for gas / rocky / exotic, and 366,262 for lab), and doing several in one frame is a visible
 * stutter on the title screen — the exact thing this module exists to remove.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera} camera
 * @param {object} [opts]
 * @param {THREE.WebGLRenderTarget|null} [opts.target] — the target the real draw binds. See note 2.
 * @param {string[]} [opts.variants] — an explicit subset of `Object.keys(WARMUP_VARIANTS)`
 *   (`gas`, `rocky`, `exotic`, `lab`), for measurement. ⭐ An explicit list BYPASSES the 6e flag
 *   gate, so this is how `lab` is warmed while the flag is OFF.
 * @param {boolean} [opts.force] — re-run even if a warm-up already ran. Measurement only; only
 *   meaningful alongside a changed `window.__shaderCacheBust`, since otherwise the second run
 *   finds the program already linked and reports a few ms of nothing.
 * @returns {Promise<{variants: object, totalMs: number, ok: boolean, requested: string[],
 *   warmed: string[], skipped: string[], omitted: Array<{key: string, reason: string}>,
 *   variantSelection: object}>}
 */
export function warmPlanetPrograms(renderer, camera, opts = {}) {
  if (_warmPromise && !opts.force) return _warmPromise;
  const p = _warmPlanetPrograms(renderer, camera, opts);
  if (!opts.force) _warmPromise = p;
  return p;
}

async function _warmPlanetPrograms(renderer, camera, opts = {}) {
  const { target = null } = opts;
  // ⭐ S6-M2/S6-M9 — the DEFAULT set is flag-gated; an explicit `opts.variants` passes through
  // untouched. See resolveWarmVariants for why the flag is read here and not at module load.
  const selection = resolveWarmVariants(opts);
  const variants = selection.variants;
  const report = { variants: {}, totalMs: 0, ok: true };
  const t0 = performance.now();

  // ── Kick them ALL off, THEN await ──────────────────────────────────────────────────────────────
  // Awaiting each variant before starting the next made the total the SUM of the game trio's links
  // (measured 4 263 ms) instead of roughly the longest one, because the driver only ever had one
  // link in flight. KHR_parallel_shader_compile exists precisely to overlap them. The title screen
  // is not infinite — a player who dismisses it quickly only gets the variants that finished — so
  // the difference between sum and max is a difference in how much of the win actually lands.
  //
  // Still one KICKOFF per animation frame: the synchronous half is small but not free (three
  // assembles and hands over the variant's whole GLSL string — 27,887 / 46,146 / 34,841 bytes for
  // the game variants, 366,262 for lab), and doing several of those in one frame is a visible
  // title-screen stutter — the exact thing this module exists to remove. Yielding between kickoffs
  // costs one frame each and buys back nothing, because the driver is already working.
  const inflight = [];
  for (const key of variants) {
    // ⛔ WAS `if (!PLANET_SHADER_VARIANTS[key]) continue;` — the line PLAN §4 Step 6c names. It
    // resolved against the GAME's three-entry table, so the lab program could never be a candidate,
    // and an unknown key produced a clean report of nothing. Both halves are recorded now.
    if (!WARMUP_VARIANTS[key]) {
      report.ok = false;
      report.variants[key] = {
        ok: false, skipped: true,
        error: `unknown warm-up variant '${key}' — not a key of WARMUP_VARIANTS `
             + `(${Object.keys(WARMUP_VARIANTS).join(', ')})`,
      };
      console.warn('[SHADER-WARMUP] unknown variant %s — nothing warmed for it', key);
      continue;
    }
    // Yield first, so the caller's own frame is never the one that pays the synchronous half.
    await _nextFrame();
    const vt0 = performance.now();
    try {
      const scene = new THREE.Scene();
      const material = buildProbeMaterial(key);
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material);
      // The lab vertex shader reads aBand/aShear/aMush/aStorm. ⚠ NOT a cache-key concern — three's
      // program key is built from shader source and renderer/material parameters, and attributes are
      // not in it, so the program would link identically without this. It is here because a missing
      // attribute is not a link error and `compileAsync` may still exercise the draw setup; giving
      // the probe the same vertex layout as the real body removes a difference rather than fixing a
      // known bug. If this line is ever deleted, nothing about the warm-up's PURPOSE is lost.
      if (WARMUP_VARIANTS[key].kind === 'lab') ensureLabAttributes(mesh.geometry);
      scene.add(mesh);
      _keepAlive.push(material, mesh);

      // Bind the real draw's target across the SYNCHRONOUS half only — that is where getProgram
      // reads toneMapping/outputColorSpace off the bound target and builds the cache key. No render
      // can interleave a synchronous block, so nothing else sees the swapped target.
      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const pending = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(prevTarget);

      inflight.push({ key, vt0, pending });
    } catch (e) {
      report.ok = false;
      report.variants[key] = { ms: +(performance.now() - vt0).toFixed(1), ok: false, error: String(e) };
      console.warn('[SHADER-WARMUP] %s failed (the game will link it on first draw):', key, e);
    }
  }

  for (const { key, vt0, pending } of inflight) {
    try {
      await pending;
      // Elapsed from this variant's own kickoff. These now OVERLAP, so they no longer sum to
      // totalMs — that is the point. Read totalMs for wall clock, the per-variant figures for
      // which shader is the expensive one.
      report.variants[key] = {
        ms: +(performance.now() - vt0).toFixed(1), ok: true,
        kind: WARMUP_VARIANTS[key].kind,
        fragmentBytes: WARMUP_VARIANTS[key].bytes(),
      };
    } catch (e) {
      report.ok = false;
      report.variants[key] = { ms: +(performance.now() - vt0).toFixed(1), ok: false, error: String(e) };
      console.warn('[SHADER-WARMUP] %s failed (the game will link it on first draw):', key, e);
    }
  }

  report.totalMs = +(performance.now() - t0).toFixed(1);
  // ⭐ MEMBERSHIP, not just counts (Step 4's scar: a count-preserving permutation passed every
  // instrument byte-identically). `requested` is the set that was actually attempted — the caller's
  // list, or the flag-gated default — and `warmed` is what a program actually exists for; a reader
  // comparing them sees a silent skip, which is what the old `continue` made unreadable. What the
  // GATE removed before the loop ever saw it is `variantSelection.omitted`, immediately below.
  report.requested = [...variants];
  // ⭐ S6-M2/S6-M9 — WHY the set is what it is, not merely what it is. A reader who finds no `lab`
  // key in `report.variants` reads this and learns whether the 6e flag excluded it (and which source
  // answered the flag), or whether the registry entry is gone — opposite findings that an absent key
  // cannot distinguish. `omitted` is the gate's own record; `skipped` below is the unknown-key one.
  report.variantSelection = selection;
  report.omitted = selection.omitted;
  report.warmed = Object.keys(report.variants).filter((k) => report.variants[k].ok);
  report.skipped = Object.keys(report.variants).filter((k) => report.variants[k].skipped);
  report.cacheBust = (typeof window !== 'undefined' && window.__shaderCacheBust) || null;
  if (typeof window !== 'undefined') window.__shaderWarmup = report;
  return report;
}

function _nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Swap a mesh onto a new material only once that material's program is linked and ready.
 *
 * This is the other half of Stage 0 and the reason it is the enabler: it is the mechanism by which
 * a body can be rendered by the shader we have TODAY while a heavier target shader links in the
 * background, then upgrade in place with no frame ever waiting on a link. The upgrade is a pure
 * material assignment — the mesh, its geometry and its transform are untouched — so a body that
 * swapped is indistinguishable from one that started warm.
 *
 * ⚠ The old material is deliberately NOT disposed. Planet materials are per-body but their PROGRAM
 * is shared across every body running that variant; disposing on swap would be correct for the
 * material and catastrophic for the program if this body happened to hold the last reference.
 * Disposal is the caller's call, made with knowledge of the population.
 *
 * ⚠ This is a different axis from BodyRenderer.setLOD's procedural↔textured swap, which has a
 * standing rule that it never returns to procedural. This swap is procedural→procedural
 * (cold→warm) and must not be routed through that path or it will fight it.
 *
 * ── Instrument E item 2: the material registry ──────────────────────────────────────────────────
 * ⛔ THE SWAP IS DESTRUCTIVE AND THE ONLY REVERT TODAY IS A PAGE RELOAD. `mesh.material = material`
 * below is the single line where the game's own material for that body still exists and is about to
 * stop existing; nothing anywhere keeps a reference to it. That is what makes an A/B pair
 * impossible on a manually swapped body, and an A/B pair is the whole of Instrument E (PLAN §12
 * E-1). One Map entry, written one line before the overwrite, buys the OFF twin.
 *
 * ⚠ WHAT THIS DOES **NOT** BUY, stated here so nobody reads a restore that cannot exist as a bug.
 * The OFF twin exists ONLY for MANUALLY swapped bodies — the `tryLabShader` / preview path. It does
 * NOT exist on the automatic path Step 6e introduces: with that flag ON the lab material is chosen
 * at material-CREATION time and the legacy material for that body is never constructed, so there is
 * no `prevMaterial` and nothing to restore. `restoreGameMaterial` returns `{ ok: false }` with a
 * reason there, and it must, because the alternative is a hook that silently returns success having
 * restored a material the body never had. On the automatic path the OFF twin is a flag flip plus a
 * reload at a pose restored through `_lab.setCameraPose`, per §12.3 E-1.
 *
 * ⚠ Keyed by mesh OBJECT, deliberately not by index and not by name. Indices shift (PLAN §12 E-2:
 * Step 10 widens the scene-walk prefix and every index moves), and a mesh can outlive the name its
 * parent group carries. A Map — not a WeakMap — because Step 5's swap ledger has to ENUMERATE the
 * swapped population and `_lab.restoreGameMaterial` reports `MATERIAL_SWAPS.size`; a WeakMap offers
 * neither.
 *
 * ⛔ WHAT THIS COMMENT USED TO CLAIM, AND WHAT IS TRUE. It said the entries "are deleted on restore
 * and on system teardown, and a stale entry pins one material, not a scene". Only the first half was
 * ever implemented — `restoreMaterialSwap`'s `MATERIAL_SWAPS.delete(mesh)` is the ONLY delete in the
 * repo, which `grep -rn 'MATERIAL_SWAPS' src/` shows in one screen — and the consequence was
 * understated on both axes. A strong Map keyed by the mesh pins the MESH, its GEOMETRY and BOTH
 * materials. `spawnSystem`'s teardown does `scene.remove(entry.planet.mesh)` then `.dispose()`,
 * which frees the GPU handles but cannot free the JS objects this Map still points at, so one such
 * carcass accrues per system in which a body was swapped and not restored.
 *
 * ⭐ THE SWEEP, and why it lives here rather than in the teardown. `pruneMaterialSwaps()` drops every
 * entry whose mesh WAS attached to a Scene when it was recorded and is no longer attached to one —
 * exactly the shape `scene.remove(...)` leaves behind. `recordMaterialSwap` runs it before it
 * records, which bounds the residue at the entries made since the last swap rather than letting it
 * grow with the session. It is exported so the teardown can call it at the discontinuity, which
 * would be strictly better (it frees then, not at the next swap) — but the ONLY write path is
 * `swapMaterialWhenReady`, reached only from `_lab.tryLabShader`, a dev/preview entry point on
 * `window._lab` that no player path touches. So what is bounded here is a developer's session, not
 * a shipped leak, and that is why this is a sweep in the owning module rather than a new call edited
 * into main.js's teardown.
 *
 * ⚠ `wasLive` is RECORDED at swap time, not assumed, so a mesh that was never in a scene at all — a
 * unit test's bare mesh, a body built off-graph and attached later — is never swept. "Detached
 * because the system was torn down" and "detached because it has not been attached yet" are opposite
 * states, and sweeping the second would silently delete a baseline that is still wanted, which is the
 * failure `restoreMaterialSwap`'s reasons exist to prevent.
 *
 * ⚠ The retained `prevMaterial` is NOT disposed here for the reason note 1 at the top of this file
 * gives at length: three refcounts GPU programs per material, and dropping the last reference hands
 * the program back to be linked cold. Retention is the correct behaviour on both axes at once.
 *
 * @type {Map<THREE.Mesh, {prevMaterial: THREE.Material, nextMaterial: THREE.Material, at: number}>}
 */
export const MATERIAL_SWAPS = new Map();

// Walks to the graph root rather than testing `mesh.parent`: a swapped body may sit under a group,
// and `scene.remove(group)` leaves the mesh with a non-null parent that leads nowhere.
function _graphRootOf(object) {
  let node = object;
  while (node.parent) node = node.parent;
  return node;
}

/** True while `mesh` is still reachable from a live THREE.Scene root. */
function _isAttachedToScene(mesh) {
  return !!(mesh && _graphRootOf(mesh).isScene);
}

/**
 * Drop every entry whose mesh was live when it was recorded and has since been detached from its
 * Scene — the shape system teardown leaves behind. See the MATERIAL_SWAPS note above for why this
 * exists, why it is keyed on `wasLive`, and what it deliberately does NOT sweep.
 *
 * @returns {{dropped: string[], remaining: number}} — `dropped` carries the released meshes' names
 *   (`'?'` when unnamed) rather than only a count, so a caller can print WHAT was released.
 */
export function pruneMaterialSwaps() {
  const dropped = [];
  for (const [mesh, entry] of MATERIAL_SWAPS) {
    if (!entry.wasLive) continue;
    if (_isAttachedToScene(mesh)) continue;
    dropped.push(mesh.name || '?');
    MATERIAL_SWAPS.delete(mesh);
  }
  return { dropped, remaining: MATERIAL_SWAPS.size };
}

/**
 * Record a material swap so the previous material can be put back. Idempotent per mesh in the sense
 * that matters: a SECOND swap on an already-swapped mesh keeps the ORIGINAL `prevMaterial` rather
 * than overwriting it with the first swap's replacement. Otherwise two previews in a row would make
 * "restore" mean "go back to the previous preview", and the OFF twin would quietly become another
 * ON frame — a pair that differs in nothing, reported as a pair that differs in one thing.
 *
 * @param {THREE.Mesh} mesh
 * @param {THREE.Material} nextMaterial — the material about to be assigned.
 * @returns {boolean} true if a NEW baseline was recorded; false if one was already held.
 */
export function recordMaterialSwap(mesh, nextMaterial) {
  if (!mesh) return false;
  // Sweep the torn-down systems' carcasses before growing the population. Runs BEFORE the lookup on
  // purpose: the sweep can never touch `mesh` itself here, because a mesh being swapped right now is
  // attached, so the idempotence contract below is unaffected by it.
  pruneMaterialSwaps();
  const existing = MATERIAL_SWAPS.get(mesh);
  if (existing) {
    existing.nextMaterial = nextMaterial;
    existing.at = Date.now();
    return false;
  }
  MATERIAL_SWAPS.set(mesh, {
    prevMaterial: mesh.material,
    nextMaterial,
    at: Date.now(),
    wasLive: _isAttachedToScene(mesh),
  });
  return true;
}

/**
 * Put a recorded mesh back on the material it carried before the FIRST swap.
 *
 * ⚠ Returns a REASON, never a bare boolean, and the reason is the point: "this body was never
 * swapped" and "this body was restored" are opposite findings, and a hook that collapses them into
 * `false` lets an OFF frame that is actually an ON frame be captioned as an OFF frame.
 *
 * @param {THREE.Mesh} mesh
 * @returns {{ok: boolean, reason?: string, restoredFrom?: string}}
 */
export function restoreMaterialSwap(mesh) {
  if (!mesh) return { ok: false, reason: 'no mesh' };
  const entry = MATERIAL_SWAPS.get(mesh);
  if (!entry) {
    return {
      ok: false,
      reason: 'no recorded swap for this mesh — it was never manually swapped. On the Step-6e '
            + 'automatic path the legacy material was never constructed, so the OFF twin is a flag '
            + 'flip plus a reload at a restored pose (PLAN §12.3 E-1), NOT a restore.',
    };
  }
  const from = entry.nextMaterial?.type || '?';
  mesh.material = entry.prevMaterial;
  MATERIAL_SWAPS.delete(mesh);
  return { ok: true, restoredFrom: from };
}

/**
 * @param {object} args
 * @param {THREE.WebGLRenderer} args.renderer
 * @param {THREE.Camera} args.camera
 * @param {THREE.WebGLRenderTarget|null} [args.target] — the target the real draw binds. See note 2.
 * @param {THREE.Mesh} args.mesh — the mesh to upgrade.
 * @param {THREE.Material} args.material — the material to swap in once ready.
 * @returns {Promise<boolean>} true if the swap happened; false if compilation failed (the mesh is
 *   left on its existing material, which is always a working one).
 */
export async function swapMaterialWhenReady({ renderer, camera, target = null, mesh, material }) {
  try {
    const scene = new THREE.Scene();
    // A probe mesh, not `mesh` itself: adding the real mesh to a second scene would detach it from
    // the live one mid-flight. The program is keyed by source, so linking it here readies it there.
    const probe = new THREE.Mesh(mesh.geometry, material);
    scene.add(probe);

    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    const pending = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(prevTarget);

    await pending;
    scene.remove(probe);
    // Instrument E item 2 — record BEFORE the overwrite, because after it there is nothing left to
    // record. See MATERIAL_SWAPS above for why this is the only line where the OFF twin exists.
    recordMaterialSwap(mesh, material);
    mesh.material = material;
    return true;
  } catch (e) {
    console.warn('[SHADER-WARMUP] deferred material swap failed (keeping current material):', e);
    return false;
  }
}

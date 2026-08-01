import * as THREE from 'three';
import { PLANET_SHADER_VARIANTS, planetShaderSource } from '../objects/Planet.js';

/**
 * ShaderWarmup — build the planet-surface GPU programs BEFORE a planet needs to be drawn.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────────────────────────
 * The first time the game draws a planet it pays the cold link cost of that planet's program on the
 * main thread, inside the draw call. Measured cold, cache-busted, on an RTX 5080 / ANGLE / D3D11:
 *
 *     GAS      576 ms
 *     EXOTIC 1 677 ms
 *     ROCKY  1 823 ms
 *     ───────────────
 *     total  4 076 ms
 *
 * Every planet in the game renders one of exactly these three programs — 18 planet TYPES collapse
 * to 3 because the type only chooses which fragment BODY is concatenated onto the shared header, and
 * three caches programs by shader SOURCE. So warming three programs warms the whole game, once.
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
 *    in `_keepAlive` for the lifetime of the page. Three tiny materials; the cost is a rounding
 *    error against 4 s.
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

const VARIANT_ORDER = ['gas', 'rocky', 'exotic'];

/**
 * Build a probe material carrying one variant's exact shader source.
 *
 * No uniforms: the program cache key is built from the shader source and the renderer/scene
 * parameters, never from uniform values, and `compile()` never uploads a uniform. A probe with the
 * real planet's ~90-uniform block would link the identical program.
 *
 * The source comes from `planetShaderSource`, the same accessor `_createSurface` uses, so the
 * measurement cache-bust (`window.__shaderCacheBust`) applies identically to the probe and to the
 * real bodies. Busting only one of the two would warm a program nothing draws.
 *
 * @param {string} variantKey — 'gas' | 'rocky' | 'exotic'
 * @returns {THREE.ShaderMaterial}
 */
export function buildProbeMaterial(variantKey) {
  const variant = planetShaderSource(variantKey);
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: variant.vertexShader,
    fragmentShader: variant.fragmentShader,
  });
}

/**
 * Compile the three planet-surface programs off the main thread.
 *
 * Idempotent: the first call owns the work, later calls get the same promise. Never rejects — a
 * failed warm-up must degrade to "the game links it later, as it always did", never to a broken
 * boot. Safe to call before any planet exists; that is the point.
 *
 * One variant per animation frame. compileAsync's synchronous half is small but not free (three
 * assembles and hands over ~100 KB of GLSL per variant), and three of them in one frame is a visible
 * stutter on the title screen — the exact thing this module exists to remove.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera} camera
 * @param {object} [opts]
 * @param {THREE.WebGLRenderTarget|null} [opts.target] — the target the real draw binds. See note 2.
 * @param {string[]} [opts.variants] — subset of ['gas','rocky','exotic'], for measurement.
 * @param {boolean} [opts.force] — re-run even if a warm-up already ran. Measurement only; only
 *   meaningful alongside a changed `window.__shaderCacheBust`, since otherwise the second run
 *   finds the program already linked and reports a few ms of nothing.
 * @returns {Promise<{variants: object, totalMs: number, ok: boolean}>}
 */
export function warmPlanetPrograms(renderer, camera, opts = {}) {
  if (_warmPromise && !opts.force) return _warmPromise;
  const p = _warmPlanetPrograms(renderer, camera, opts);
  if (!opts.force) _warmPromise = p;
  return p;
}

async function _warmPlanetPrograms(renderer, camera, opts = {}) {
  const { target = null, variants = VARIANT_ORDER } = opts;
  const report = { variants: {}, totalMs: 0, ok: true };
  const t0 = performance.now();

  for (const key of variants) {
    if (!PLANET_SHADER_VARIANTS[key]) continue;
    // Yield first, so the caller's own frame is never the one that pays the synchronous half.
    await _nextFrame();
    const vt0 = performance.now();
    try {
      const scene = new THREE.Scene();
      const material = buildProbeMaterial(key);
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material);
      scene.add(mesh);
      _keepAlive.push(material, mesh);

      // Bind the real draw's target across the SYNCHRONOUS half only — that is where getProgram
      // reads toneMapping/outputColorSpace off the bound target and builds the cache key. No render
      // can interleave a synchronous block, so nothing else sees the swapped target.
      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const pending = renderer.compileAsync(scene, camera);
      renderer.setRenderTarget(prevTarget);

      await pending;
      report.variants[key] = { ms: +(performance.now() - vt0).toFixed(1), ok: true };
    } catch (e) {
      report.ok = false;
      report.variants[key] = { ms: +(performance.now() - vt0).toFixed(1), ok: false, error: String(e) };
      console.warn('[SHADER-WARMUP] %s failed (the game will link it on first draw):', key, e);
    }
  }

  report.totalMs = +(performance.now() - t0).toFixed(1);
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
    mesh.material = material;
    return true;
  } catch (e) {
    console.warn('[SHADER-WARMUP] deferred material swap failed (keeping current material):', e);
    return false;
  }
}

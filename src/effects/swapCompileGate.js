// Swap compile gate (Goal 3, 2026-06-09).
//
// At the warp swap, spawnSystem inserts the destination system into the scene
// while the camera cruises inside the tunnel. The very next render() pass
// would draw those meshes and force-compile their shader programs
// SYNCHRONOUSLY (ANGLE link-wait at first use) — measured 0.5-2.0s on one
// frame, which is the "everything stops moving right when we enter the
// tunnel" hitch. renderer.compileAsync() can do the same work without
// blocking (KHR_parallel_shader_compile), but only if the renderer doesn't
// draw the new materials first.
//
// The gate: snapshot scene.children before spawnSystem, hide the roots it
// added (visible=false — renderer.compile() still reaches them: three r183
// collects materials via scene.traverse, which ignores visibility), await
// compileAsync mid-cruise behind the tunnel walls, then restore. Pure
// bookkeeping here; wiring lives in main.js onSwapSystem.

/**
 * Hide every root in `children` that is not in the `before` snapshot.
 * Roots that are already invisible are left alone — their own logic owns
 * that flag — and are NOT included in the returned restore list.
 * @param {Set<Object>} before — scene.children snapshot taken pre-spawn
 * @param {Object[]} children — scene.children after spawn
 * @returns {Object[]} the roots that were hidden (restore list)
 */
export function hideNewRoots(before, children) {
  const hidden = [];
  for (const c of children) {
    if (!before.has(c) && c.visible) {
      c.visible = false;
      hidden.push(c);
    }
  }
  return hidden;
}

/** Make every gated root visible again. Idempotent. */
export function restoreRoots(hidden) {
  for (const c of hidden) c.visible = true;
}

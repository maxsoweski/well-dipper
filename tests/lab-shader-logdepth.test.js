// tests/lab-shader-logdepth.test.js — LAYER 2 item 4 fence: logarithmic depth in the lab shader.
//
// WHAT THIS PROTECTS. The game's renderer runs `logarithmicDepthBuffer: true` with near = 1e-9
// (src/rendering/RetroRenderer.js:49), so every world-body ShaderMaterial must include the three.js
// logdepthbuf chunks and write LOG depth. The lab's shader had none — `grep -c logdepthbuf` was 0 —
// so every fragment wrote z ~= 1.0. The disc still DREW (LessEqualDepth passes against a cleared
// buffer), which is why this is easy to miss: nothing looks broken until a ring, a moon or the ship
// shares the frame, at which point they sort by traversal order.
//
// THIS PROJECT HAS SHIPPED THIS EXACT BUG BEFORE — tests/warp-portal-logdepth.test.js exists
// because the warp tunnel wrote conventional depth against bodies writing log depth, and sparse
// belt pixels survived through the walls. Same convention mismatch, different material.
//
// ⛔ THE LAB MUST STAY INERT. planet-lod-lab.html builds its renderer WITHOUT the flag, so
// USE_LOGDEPTHBUF is undefined there and all four chunks compile to nothing. That is asserted
// against the lab's source below rather than assumed — it is the whole reason this fix is allowed
// to live in the shared module instead of being patched game-side.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LAB_VERTEX_SHADER, LAB_FRAGMENT_SHADER } from '../planet-lod-shaders.glsl.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('LAYER 2 item 4 — logarithmic depth', () => {
  describe('the four chunks are present', () => {
    it('vertex declares and writes', () => {
      expect(LAB_VERTEX_SHADER).toContain('#include <logdepthbuf_pars_vertex>');
      expect(LAB_VERTEX_SHADER).toContain('#include <logdepthbuf_vertex>');
    });

    it('fragment declares and writes', () => {
      expect(LAB_FRAGMENT_SHADER).toContain('#include <logdepthbuf_pars_fragment>');
      expect(LAB_FRAGMENT_SHADER).toContain('#include <logdepthbuf_fragment>');
    });

    it('vertex includes <common>, which logdepthbuf_vertex actually needs', () => {
      // logdepthbuf_vertex calls isPerspectiveMatrix(), defined by three in <common>. Dropping this
      // include gives a link error only when logarithmicDepthBuffer is ON — i.e. in the game and
      // never in the lab, which is the worst possible place for it to hide.
      expect(LAB_VERTEX_SHADER).toContain('#include <common>');
    });
  });

  describe('placement — a chunk in the wrong place is worse than a missing one', () => {
    it('pars come before main() on both sides', () => {
      expect(LAB_VERTEX_SHADER.indexOf('#include <logdepthbuf_pars_vertex>'))
        .toBeLessThan(LAB_VERTEX_SHADER.indexOf('void main'));
      expect(LAB_FRAGMENT_SHADER.indexOf('#include <logdepthbuf_pars_fragment>'))
        .toBeLessThan(LAB_FRAGMENT_SHADER.indexOf('void main'));
    });

    it('logdepthbuf_vertex comes AFTER gl_Position — it reads gl_Position.w', () => {
      const glPos = LAB_VERTEX_SHADER.indexOf('gl_Position = projectionMatrix');
      const chunk = LAB_VERTEX_SHADER.indexOf('#include <logdepthbuf_vertex>');
      expect(glPos).toBeGreaterThan(-1);
      expect(chunk).toBeGreaterThan(glPos);
    });

    it('⛔ logdepthbuf_fragment precedes the uDebugMode early-return path', () => {
      // The fragment main() has an early-return debug visualiser. A fragment that returns before
      // writing gl_FragDepth sorts by traversal order, so the debug views would mis-sort while the
      // normal path sorted correctly — which reads as a debug-view bug and is not one.
      const chunk = LAB_FRAGMENT_SHADER.indexOf('#include <logdepthbuf_fragment>');
      const debugBranch = LAB_FRAGMENT_SHADER.indexOf('if (uDebugMode > 0)');
      expect(chunk).toBeGreaterThan(-1);
      expect(debugBranch).toBeGreaterThan(-1);
      expect(chunk).toBeLessThan(debugBranch);
    });
  });

  describe('the two renderers disagree, and that is the point', () => {
    it('the GAME enables logarithmicDepthBuffer', () => {
      expect(read('src/rendering/RetroRenderer.js')).toMatch(/logarithmicDepthBuffer:\s*true/);
    });

    it('⛔ the LAB does not, so the chunks compile to nothing there', () => {
      // If this ever flips, the chunks stop being free in the lab and the lab's own look changes.
      // That is a decision, not an accident — this assertion is where it gets noticed.
      const lab = read('planet-lod-lab.html');
      expect(lab).toMatch(/new THREE\.WebGLRenderer\(/);
      expect(lab).not.toMatch(/logarithmicDepthBuffer/);
    });
  });

  describe('CONTROL — the pre-fix state, kept live', () => {
    it('a shader without the chunks would not satisfy the assertions above', () => {
      // The broken form: the exact vertex main the lab shipped before this fix.
      const preFix = 'void main() {\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}';
      expect(preFix).not.toContain('logdepthbuf');
      // ...and it is what `grep -c logdepthbuf planet-lod-shaders.glsl.js` returned: 0.
      expect((preFix.match(/logdepthbuf/g) || []).length).toBe(0);
    });
  });
});

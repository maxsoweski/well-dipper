// Goal 2 (warp workstream, 2026-06-10): the renderer runs
// logarithmicDepthBuffer:true, so every world-body ShaderMaterial includes
// the three.js logdepthbuf chunks (AsteroidBelt, Planet, rings, ...) and
// writes LOG depth. The tunnel wall material wrote conventional depth —
// the depth comparison between belt fragments (drawn first, renderOrder 0)
// and wall fragments (renderOrder 11) was meaningless, so sparse belt
// pixels survived through the walls. The tunnel is the occluder: it must
// write + test depth in the same convention as the bodies it occludes.
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { WarpPortal } from '../src/effects/WarpPortal.js';

// WarpPortal's constructor draws a 32×32 canvas sprite (_createLandingStrip).
// Node has no DOM — stub just the surface it touches so the real constructor
// can run and we can assert on the real tunnel material.
const stubCanvas = () => ({
  width: 0, height: 0,
  getContext: () => ({
    strokeStyle: '', lineWidth: 0, lineCap: '',
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  }),
});
let hadDocument;
beforeAll(() => {
  hadDocument = 'document' in globalThis;
  if (!hadDocument) globalThis.document = { createElement: stubCanvas, createElementNS: stubCanvas };
});
afterAll(() => {
  if (!hadDocument) delete globalThis.document;
});

describe('WarpPortal tunnel material — logarithmic depth convention', () => {
  test('tunnel shaders include the three.js logdepthbuf chunks', () => {
    const p = new WarpPortal();
    const mat = p._tunnel.material;
    expect(mat.vertexShader).toContain('#include <logdepthbuf_pars_vertex>');
    expect(mat.vertexShader).toContain('#include <logdepthbuf_vertex>');
    expect(mat.fragmentShader).toContain('#include <logdepthbuf_pars_fragment>');
    expect(mat.fragmentShader).toContain('#include <logdepthbuf_fragment>');
  });

  test('tunnel writes depth (it is the occluder)', () => {
    const p = new WarpPortal();
    expect(p._tunnel.material.depthWrite).toBe(true);
  });
});

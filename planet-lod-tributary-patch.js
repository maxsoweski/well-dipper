// planet-lod-tributary-patch.js — Option B river-LOD STEP 2: GPU patch bake + blend.
//
// Context (decided — see docs/superpowers/specs/2026-06-19-river-lod-design.md). STEP 1
// (planet-lod-tributaries.js, commit 31dacc8) proved the PURE topology: growTributaries grows real
// connected dendritic tributaries by local refined re-routing onto trunk-channels-as-outlets. STEP 2
// (this module) is the GPU side: it reads the REAL GPU height at the fine lattice, grows the fine
// network, rasterizes its valley DEPTH into a camera-localised 2D ORTHOGRAPHIC RenderTarget, and sets
// the uniforms the planet shader unions into sampleCarve. The whole point of the 2D ortho patch (vs a
// 2nd cube) is ANGULAR CONCENTRATION: 1024 texels over an ~8° cap ≈ 1 km/texel (~9× finer than the
// ~9 km/texel global carve cube) — that is what makes "bloom on approach" NEW structure not blur.
//
// This module imports THREE (it does GPU work). The pure primitives stay PURE in
// planet-lod-tributaries.js so their headless STEP-1 tests are untouched. projectToPatch (below) is a
// pure no-THREE port of the shader's gnomonic-tangent inverse projection, exported so the UV
// transform is unit-testable AND kept byte-aligned with the GLSL in planet-lod-lab.html.

import * as THREE from 'three';
import {
  localFrame, buildFineGrid, snapToLattice, growTributaries, DEFAULT_TRIB_PARAMS,
} from './planet-lod-tributaries.js';
import { createHeightSampler, paramsForRadius, DEFAULT_PARAMS } from './planet-lod-rivers.js';

// ───────────────────────── projectToPatch (pure; byte-aligned with the GLSL) ─────────────────────────
// GNOMONIC-TANGENT inverse projection: given an object-space unit dir and a patch frame {N,u,v,angular},
// return the planar lateral coords (su,sv), the UV in [0,1]², the normalised lateral distance (0 centre,
// 1 cap edge), and whether the dir is inside the cap. This EXACTLY inverts buildFineGrid's forward
// placement dir = normalize(N + su·u + sv·v): su = dot(dir,u)/dot(dir,N), sv = dot(dir,v)/dot(dir,N),
// with frustum/UV half-extent R = tan(angular). MUST stay identical to patchDepth() in the lab GLSL.
export function projectToPatch(dir, { N, u, v, angular }) {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cosd = dot(dir, N);
  const inside = cosd > Math.cos(angular);
  const su = cosd !== 0 ? dot(dir, u) / cosd : 0;
  const sv = cosd !== 0 ? dot(dir, v) / cosd : 0;
  const R = Math.tan(angular);
  const uv = [su / (2 * R) + 0.5, sv / (2 * R) + 0.5];
  const lateral = Math.hypot(su, sv) / R;
  return { su, sv, uv, lateral, inside };
}

// ───────────────────────── buildFineValleyGeometry (depth-rails only) ─────────────────────────
// Adapt buildValleyGeometry (planet-lod-rivers.js:589) to the FINE receiver chains, in PLANAR
// (su,sv,0) space (so the bake ortho cam can draw it directly — see §7 of the spec). Differences from
// the cube builder: (1) walks out.freceiver chains for out.isFineChannel===1 verts; (2) emits the
// 3-rail strip (L depth 0 · C depth d · R depth 0) at the verts' PLANAR coords out.planar[k]=[su,sv],
// z=0; (3) the side offset is the 2D planar normal of the chain direction; (4) aDepth only — mouth(G)/
// order(B) stay the global cube's job (v1 is depth-only). depthAt reuses VALLEY_DEPTH_LO/HI lerped by
// fstrahler, exactly like the global cube, so the patch floor depths read on the same scale as global.
export function buildFineValleyGeometry({ out, planar, params = {} }) {
  const P = { ...DEFAULT_PARAMS, ...params };
  const { VALLEY_DEPTH_HI, VALLEY_WIDTH_MUL } = P;   // FINE_LO below replaces the global VALLEY_DEPTH_LO (Fork D)
  // fine-channel render threshold (Strahler ≥ this). Configurable so the lab can thin the network to a
  // legible density (§8.10); also the depth-lerp FLOOR, so the smallest RENDERED order grades to the
  // shallow/dry end regardless of the threshold (else a raised threshold would carve small channels too deep).
  const MIN_ORDER = params.channelOrderMin != null ? params.channelOrderMin : DEFAULT_TRIB_PARAMS.channelOrderMin;
  const { freceiver, fstrahler, isFineChannel, isOceanFine } = out;
  const Nf = planar.length;

  // max fine order present (for depth normalisation; ≥ MIN_ORDER so the lerp is well-formed).
  let maxOrder = MIN_ORDER;
  for (let k = 0; k < Nf; k++) if (fstrahler[k] > maxOrder) maxOrder = fstrahler[k];
  // §2 Fork D — order-graded DRY→FLOOD depth. The fine carve floor depth is graded by fine Strahler
  // so the SMALLEST tributaries carve a shallow DRY groove (floor stays above sea ⇒ no flood, just the
  // Stage-6 dry-floor albedo darkening at lab:582), while the LARGER fine orders near the trunk outlet
  // carve deep enough that h − carveDepth·uRiverCarveDepth crosses uSeaLevel and floods via the same
  // F14 level-set as the trunks. FINE_LO is below the global VALLEY_DEPTH_LO (0.45) so the dark/thin
  // end is genuinely shallow; a gamma>1 biases small orders shallow. The ABSOLUTE dry→flood cutoff is
  // tuned live at the GPU gate via uRiverCarveDepth (open fork §8.2) — this bakes only the RELATIVE grade.
  const FINE_LO = P.FINE_VALLEY_DEPTH_LO != null ? P.FINE_VALLEY_DEPTH_LO : 0.20;
  const FINE_HI = P.FINE_VALLEY_DEPTH_HI != null ? P.FINE_VALLEY_DEPTH_HI : VALLEY_DEPTH_HI;
  const FINE_GAMMA = P.FINE_VALLEY_DEPTH_GAMMA != null ? P.FINE_VALLEY_DEPTH_GAMMA : 1.6;
  const depthAt = (o) => {
    const t = Math.max(0, Math.min(1, (o - MIN_ORDER) / Math.max(1, maxOrder - MIN_ORDER)));
    return FINE_LO + (FINE_HI - FINE_LO) * Math.pow(t, FINE_GAMMA);
  };
  // valley half-width in PLANAR units. The fine cell already sets the lattice spacing; a small fixed
  // multiple of it (× VALLEY_WIDTH_MUL) gives a valley a couple of cells wide — wide enough to read,
  // narrow enough to stay finer than the global carve. cellPlanar derived from the lattice extent.
  // (planar coords are in tan-units; the patch spans ±R = ±tan(angular).)
  let suMin = Infinity, suMax = -Infinity, svMin = Infinity, svMax = -Infinity;
  for (let k = 0; k < Nf; k++) {
    const s = planar[k]; if (s[0] < suMin) suMin = s[0]; if (s[0] > suMax) suMax = s[0];
    if (s[1] < svMin) svMin = s[1]; if (s[1] > svMax) svMax = s[1];
  }
  const span = Math.max(suMax - suMin, svMax - svMin) || 1;
  const halfWidth = 1.6 * (span / Math.sqrt(Nf)) * (VALLEY_WIDTH_MUL || 1);

  const vPos = [], vDepth = [], vIdx = [];
  let vBase = 0;
  for (let k = 0; k < Nf; k++) {
    if (isFineChannel[k] !== 1) continue;
    if (fstrahler[k] < MIN_ORDER) continue;    // render threshold (§8.10): only orders ≥ MIN_ORDER draw
    const r = freceiver[k];
    if (r === k || r < 0) continue;            // sink / self — no segment to emit
    if (isOceanFine && (isOceanFine[k] || isOceanFine[r])) continue;   // Fix 3: never carve over water
    const a = planar[k], b = planar[r];
    // chain direction in the planar plane; side = 90° rotation (the 2D normal).
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1e-9; dx /= L; dy /= L;
    const nx = -dy, ny = dx;                    // planar normal
    const wK = halfWidth, wR = halfWidth;
    const dK = depthAt(fstrahler[k] || MIN_ORDER), dR = depthAt(fstrahler[r] || MIN_ORDER);
    // 3 rails at k: L,C,R  then 3 rails at r: L,C,R  → two quads (left + right) like the cube builder.
    vPos.push(
      a[0] - nx * wK, a[1] - ny * wK, 0,  a[0], a[1], 0,  a[0] + nx * wK, a[1] + ny * wK, 0,
      b[0] - nx * wR, b[1] - ny * wR, 0,  b[0], b[1], 0,  b[0] + nx * wR, b[1] + ny * wR, 0,
    );
    vDepth.push(0.0, dK, 0.0, 0.0, dR, 0.0);
    const aB = vBase, bB = vBase + 3;           // aB:[L,C,R]@k   bB:[L,C,R]@r
    vIdx.push(aB, aB + 1, bB, aB + 1, bB + 1, bB);             // left quad  (L,C)
    vIdx.push(aB + 1, aB + 2, bB + 1, aB + 2, bB + 2, bB + 1); // right quad (C,R)
    vBase += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(vDepth, 1));
  g.setIndex(vIdx);
  g.userData.segmentCount = vIdx.length / 6;
  return g;
}

// ───────────────────────── buildFineRibbonGeometry (the legibility render — §2 Fork A/B/E) ─────────────────────────
// The fine tier's VISIBLE water-line. Mirrors buildRibbonGeometry (planet-lod-rivers.js:473) — a
// 2-rail Chaikin-smoothed strip walked down receiver chains, vertex-coloured by the SHARED cOrd
// stream-order ramp, width = widthAt(accum) — but on the FINE network (out.freceiver / out.faccum /
// out.fstrahler over out.fverts, which are already on the unit sphere). Reusing the rivers' own
// legibility renderer (representation parity, §2 obligation 1) guarantees the fine network reads
// regardless of whether its carve floods.
//   Fork B: same navy→blue cOrd ramp (low fine Strahler ⇒ dark/thin end automatically); width clamped
//           to the trunk's width at the path's outlet so a fine rail never out-widths the trunk it joins.
//   Fork E: at an outlet pinned to a TRUNK node (outletBaseNode ≥ 0), the terminal cross-section is
//           emitted at the trunk centerline position with the trunk's width and the trunk's cOrd colour
//           (read off the global routed graph), so the fine rail tapers INTO the trunk rail — no
//           T-junction gap, no doubled line, no colour jump. Sea outlets (bn = -1) just end at the coast.
export function buildFineRibbonGeometry({ out, routed, baseVerts, params = {} }) {
  const P = { ...DEFAULT_PARAMS, ...params };
  const { WIDTH_PHI, WIDTH_EXP, WIDTH_SCALE, WIDTH_MIN, WIDTH_MAX, CHAIKIN_ITERS, LIFT } = P;
  // order floor for the cOrd ramp = the fine-channel render threshold (so the smallest RENDERED fine
  // order maps to the dark/thin end of the shared ramp), tracking the configurable threshold (§8.10).
  // Fall back to the SAME canonical constant buildFineValleyGeometry uses (DEFAULT_TRIB_PARAMS.channelOrderMin)
  // so the carve floor and the ribbon floor can never silently diverge if a default is retuned.
  const MIN_ORDER = P.channelOrderMin != null ? P.channelOrderMin : DEFAULT_TRIB_PARAMS.channelOrderMin;
  const { fverts, fadj, freceiver, fstrahler, faccum, isFineChannel, isOutlet, outletBaseNode } = out;
  const Nf = fverts.length;
  const C_LO = new THREE.Color(0x1d3c5e), C_HI = new THREE.Color(0x4486bb);   // shared deep-water ramp

  // rendered gate = fine channel (Strahler ≥ MIN_ORDER), the same gate buildFineValleyGeometry uses.
  const rendered = new Uint8Array(Nf);   // render gate = fine channel AND order ≥ threshold (§8.10)
  for (let k = 0; k < Nf; k++) if (isFineChannel[k] === 1 && fstrahler[k] >= MIN_ORDER) rendered[k] = 1;

  let fineMaxOrder = MIN_ORDER;
  for (let k = 0; k < Nf; k++) if (fstrahler[k] > fineMaxOrder) fineMaxOrder = fstrahler[k];
  const widthLaw = (accum) => THREE.MathUtils.clamp(WIDTH_SCALE * (WIDTH_PHI * Math.pow(accum, WIDTH_EXP)), WIDTH_MIN, WIDTH_MAX);
  const fineCOrd = (o) => C_LO.clone().lerp(C_HI, THREE.MathUtils.clamp((o - MIN_ORDER) / Math.max(1, fineMaxOrder - MIN_ORDER), 0, 1));

  // trunk readers (Fork B clamp + Fork E pin). routed carries the GLOBAL accum/strahler/maxOrder; the
  // trunk width law uses the SAME pEff params as the fine ribbon so the two are directly comparable.
  const trunkMaxOrder = (routed && routed.maxOrder) || fineMaxOrder;
  const trunkWidthAt = (bn) => (routed && routed.accum) ? widthLaw(routed.accum[bn]) : WIDTH_MAX;
  const trunkCOrd = (bn) => C_LO.clone().lerp(C_HI, THREE.MathUtils.clamp(((routed && routed.strahler ? routed.strahler[bn] : MIN_ORDER) - MIN_ORDER) / Math.max(1, trunkMaxOrder - MIN_ORDER), 0, 1));

  function chaikin(pts, iters) {
    let cur = pts;
    for (let it = 0; it < iters; it++) {
      if (cur.length < 3) break;
      const out2 = [cur[0]];
      for (let k = 0; k < cur.length - 1; k++) {
        const a = cur[k], b = cur[k + 1];
        const mk = (t) => {
          const v = new THREE.Vector3(a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t).normalize().multiplyScalar(LIFT);
          return { p: [v.x, v.y, v.z], w: a.w + (b.w - a.w) * t, c: a.c.clone().lerp(b.c, t) };
        };
        out2.push(mk(0.25), mk(0.75));
      }
      out2.push(cur[cur.length - 1]);
      cur = out2;
    }
    return cur;
  }

  // heads = rendered verts with no rendered upstream child (the dendritic sources).
  const heads = [];
  for (let k = 0; k < Nf; k++) {
    if (!rendered[k]) continue;
    let isHead = true;
    for (const nb of fadj[k]) { if (rendered[nb] && freceiver[nb] === k) { isHead = false; break; } }
    if (isHead) heads.push(k);
  }

  const ribPos = [], ribCol = [], ribIdx = []; let vBase = 0;
  const drawn = new Uint8Array(Nf);
  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3();
  function emitRibbon(spts) {
    if (spts.length < 2) return;
    const Pv = spts.map(s => new THREE.Vector3(s.p[0], s.p[1], s.p[2]));
    for (let k = 0; k < spts.length; k++) {
      const cur = Pv[k];
      fwd.set(0, 0, 0);
      if (k > 0) fwd.add(cur.clone().sub(Pv[k - 1]));
      if (k < spts.length - 1) fwd.add(Pv[k + 1].clone().sub(cur));
      up.copy(cur).normalize();
      fwd.sub(up.clone().multiplyScalar(fwd.dot(up)));
      if (fwd.lengthSq() < 1e-14) fwd.set(up.y, up.z, up.x);
      fwd.normalize();
      side.crossVectors(up, fwd).normalize().multiplyScalar(spts[k].w);
      const L = cur.clone().sub(side), Rr = cur.clone().add(side);
      const c = spts[k].c;
      ribPos.push(L.x, L.y, L.z, Rr.x, Rr.y, Rr.z);
      ribCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (k > 0) { const b0 = vBase + (k - 1) * 2, b1 = vBase + k * 2; ribIdx.push(b0, b0 + 1, b1, b0 + 1, b1 + 1, b1); }
    }
    vBase += spts.length * 2;
  }
  // path: walk freceiver while rendered; include the terminal outlet vertex (Fork E pins it).
  function pathFrom(start) {
    const raw = []; let c = start, g = 0;
    while (rendered[c] && g++ < 200000) {
      raw.push(c);
      if (drawn[c]) break;
      drawn[c] = 1;
      const r = freceiver[c];
      if (r === c || !rendered[r]) { if (r !== c) raw.push(r); break; }   // r is the outlet/sink terminal
      c = r;
    }
    return raw;
  }
  function buildAndEmit(start) {
    const raw = pathFrom(start);
    if (raw.length < 2) return;
    // outlet width cap (Fork B): clamp every fine width on this path to the trunk's width at its outlet.
    const term = raw[raw.length - 1];
    const termBn = isOutlet[term] ? outletBaseNode[term] : -1;
    const cap = (termBn >= 0) ? trunkWidthAt(termBn) : WIDTH_MAX;
    const pts = raw.map((idx, i) => {
      const isTerm = (i === raw.length - 1) && isOutlet[idx];
      if (isTerm && termBn >= 0 && baseVerts && baseVerts[termBn]) {
        // Fork E: pin the terminal cross-section to the trunk rail (position + width + colour).
        const tp = baseVerts[termBn];
        return { p: [tp[0] * LIFT, tp[1] * LIFT, tp[2] * LIFT], w: trunkWidthAt(termBn), c: trunkCOrd(termBn) };
      }
      const f = fverts[idx];
      return { p: [f[0] * LIFT, f[1] * LIFT, f[2] * LIFT], w: Math.min(widthLaw(faccum[idx]), cap), c: fineCOrd(fstrahler[idx] || MIN_ORDER) };
    });
    emitRibbon(chaikin(pts, CHAIKIN_ITERS));
  }
  for (const h of heads) buildAndEmit(h);
  for (let k = 0; k < Nf; k++) { if (rendered[k] && !drawn[k]) buildAndEmit(k); }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(ribPos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(ribCol, 3));
  g.setIndex(ribIdx); g.computeVertexNormals();
  g.userData.renderedCount = rendered.reduce((a, b) => a + b, 0);
  g.userData.ribbonVerts = ribPos.length / 3;
  return g;
}

// ═══════════════════════════════ createTributaryPatch ═══════════════════════════════
// Returns { texture, bake({routed, baseMesh, center, angularRadius, seed, params}), dispose }.
// Internals: a FloatType (→ HalfFloat fallback) 2D RenderTarget, a depth-passthrough ShaderMaterial
// (vDepth → gl_FragColor.r) with MAX-union CustomBlending (same as createCarveCubeMap), and an
// OrthographicCamera looking down +z at the planar geometry (frustum half-size = tan(angularRadius),
// set per-bake). bake() reads the GPU height at the fine lattice, grows the fine network, rasterizes
// the planar valley geometry into the target, and sets uRiverCarvePatch* uniforms (NOT Strength —
// the GUI owns that). Static, on-demand: re-bake-on-move / windowing are deferred (spec §9).
export function createTributaryPatch({ renderer, uniforms, octaves = 12, size = 1024 }) {
  // 2D ortho RTT. FloatType first; HalfFloat fallback (the carve cube proves HalfFloat + MaxEquation).
  let target;
  try {
    target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.FloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
  } catch (e) {
    target = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
    });
  }

  const mat = new THREE.ShaderMaterial({
    glslVersion: null,   // GLSL1, matching createCarveCubeMap (gl_FragColor)
    vertexShader: `
      precision highp float;
      attribute float aDepth;
      varying float vDepth;
      void main(){ vDepth = aDepth; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      precision highp float;
      varying float vDepth;
      void main(){ gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }
    `,
    side: THREE.DoubleSide,
    depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });

  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  // Ortho cam at (0,0,1) looking down -z onto the planar geometry at z=0 (up = +y = the v tangent
  // axis in planar space). frustum half-size R = tan(angularRadius) is set per-bake (R is per-bake).
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
  cam.position.set(0, 0, 1);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);

  const _c = new THREE.Color();

  // §2 Fork C — the FINE-RIBBON mesh: a second persistent Mesh next to the trunk ribbon, parented to
  // `planet` by the lab so it co-rotates identically, same material as the trunk ribbon but
  // renderOrder 11 (one above the trunk's 10) so the fine rail draws last where it joins the trunk (no
  // z-fight). Geometry is swapped on every bake (exactly as route() swaps the trunk ribbon). Created
  // hidden; the lab shows it when patchStrength > 0. The carve patch (the co-dependence channel) and
  // this ribbon (the legibility channel) are the rivers' TWO render jobs reused at the fine tier (§2).
  const fineRibbon = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false }),
  );
  fineRibbon.frustumCulled = false;
  fineRibbon.renderOrder = 11;
  fineRibbon.visible = false;

  function bake({ routed, baseMesh, center, angularRadius, seed = 0, params = {} }) {
    const gridRes = params.gridRes != null ? params.gridRes : DEFAULT_TRIB_PARAMS.gridRes;
    const region = { center, angularRadius, gridRes };

    // 1. fine lattice (deterministic; growTributaries rebuilds the SAME lattice from the same region).
    const grid = buildFineGrid({ center, angularRadius }, gridRes);
    const { fverts } = grid;

    // 2. REAL GPU height at the fine verts (replaces STEP 1's CPU fbm). Higher octave count than the
    //    base router's 9 reveals sub-base-mesh relief for the fine network to follow.
    const sampler = createHeightSampler({ renderer, uniforms, verts: fverts, octavesDuringRead: octaves });
    const { height } = sampler.read();
    sampler.dispose();

    // 3. nearest-fine-vert lookup so growTributaries' macro height trends with the GPU field. The
    //    spike mixes 0.5·baseMacro + 0.5·sampleHeight; here sampleHeight returns the GPU height at the
    //    nearest fine vert (the same lattice growTributaries uses ⇒ exact index correspondence for the
    //    snapped fine verts; for arbitrary p it's the nearest, which is what the macro trend wants).
    const sampleHeight = (p) => {
      const k = snapToLattice(grid, p);    // O(1) closed-form lattice inverse (§3.2; was an O(Nf) scan)
      return k >= 0 ? height[k] : height[0];
    };

    // 4. grow the fine dendritic network onto the in-patch trunk outlets. Forward the full §4.3
    //    reader bundle: sampleHeight (mountains, coeff 1.0), the per-vert GPU height array + seaLevel
    //    (the shared ocean boundary) so growTributaries can claim sea outlets (Fix 2) and flag ocean
    //    cells (Fix 3). seaLevel is orchestrator-owned: read straight off the carve uniform.
    const seaLevel = uniforms.uSeaLevel ? uniforms.uSeaLevel.value : undefined;
    const out = growTributaries({ baseMesh, routed, sampleHeight, height, seaLevel, region, seed, params });

    // 5. build the planar fine valley geometry (depth rails only) and render it into the patch RTT.
    const valleyGeo = buildFineValleyGeometry({ out, planar: out.planar, params });
    mesh.geometry.dispose();
    mesh.geometry = valleyGeo;

    // 5b. §2 Fork A/B/C/E — build the FINE RIBBON (the legibility channel) and swap it onto the
    //     persistent fineRibbon mesh. Width law uses the radius-scaled pEff so fine widths are directly
    //     comparable to the trunk's (Fork B clamp), and the outlet vertex pins to the trunk rail via
    //     the global routed graph + base verts (Fork E).
    const pEff = paramsForRadius({ ...DEFAULT_PARAMS, ...params }, params.radiusEarth);
    const ribGeo = buildFineRibbonGeometry({ out, routed, baseVerts: baseMesh.verts, params: pEff });
    fineRibbon.geometry.dispose();
    fineRibbon.geometry = ribGeo;

    const R = Math.tan(angularRadius);
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.updateProjectionMatrix();

    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c); const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);   // depth 0 = MAX baseline (no valley)
    renderer.clear(true, false, false);
    renderer.render(scene, cam);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);

    // 6. set the patch uniforms (NOT Strength — the GUI owns it). N == patch centre (object space);
    //    u,v are the local-frame tangents the gnomonic inverse projection uses in the shader.
    const { u, v, n } = localFrame(center);
    if (uniforms.uRiverCarvePatchMap)     uniforms.uRiverCarvePatchMap.value = target.texture;
    if (uniforms.uRiverCarvePatchN)       uniforms.uRiverCarvePatchN.value.set(n[0], n[1], n[2]);
    if (uniforms.uRiverCarvePatchU)       uniforms.uRiverCarvePatchU.value.set(u[0], u[1], u[2]);
    if (uniforms.uRiverCarvePatchV)       uniforms.uRiverCarvePatchV.value.set(v[0], v[1], v[2]);
    if (uniforms.uRiverCarvePatchAngular) uniforms.uRiverCarvePatchAngular.value = angularRadius;

    return {
      center: n, u, v, angular: angularRadius,
      segmentCount: valleyGeo.userData.segmentCount,
      ribbonVerts: ribGeo.userData.ribbonVerts,
      renderedFineChannels: ribGeo.userData.renderedCount,
    };
  }

  function dispose() {
    target.dispose(); mat.dispose(); mesh.geometry.dispose();
    fineRibbon.geometry.dispose(); fineRibbon.material.dispose();
  }

  return { texture: target.texture, fineRibbon, bake, dispose };
}

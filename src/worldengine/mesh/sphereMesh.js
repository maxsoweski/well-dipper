// src/worldengine/mesh/sphereMesh.js
// THE IRREGULAR SPHERE MESH BUILDER — moved here from planet-lod-rivers.js lines 376–429 (at dbe17e5) on 2026-09-01.
//
// FUNCTION: builds the carrier mesh every sphere-native world-engine writer runs over — a Fibonacci
// point set, Lloyd-relaxed, triangulated by spherical Delaunay (a convex hull of unit points), with
// per-node adjacency. Terrain-independent: `buildIrregularSphere(N, iters)` is a pure function of
// its two integers, and every body in a session can share ONE mesh (makeSphereField wraps it per body).
//
// INTENT: the GAME needs to build a carrier to bake the province cube (and, after it, the relief,
// crater and river-carve cubes) — and nothing under src/ could reach this builder while it lived in
// the 108 KB river module the boundary fence keeps out (tests/src-boundary-fence.test.js). Moving the
// ~55 lines alone, byte-verbatim, is the same shape as the dispatch move (df6818c): the root module
// imports it back and re-exports it, so world-engine-lab.html and ~60 test suites keep their import
// path unchanged.
//
// WHY `mesh/` AND NOT `base/` OR `rendering/bake/`. It is three-coupled (Vector3, ConvexHull) but
// GPU-free, so carried C25 — "needs a renderer" vs "does not" — puts it under src/worldengine/, not
// under src/rendering/bake/ (one-pipeline-two-frontends-PLAN.md § THE PROVINCE CUBE, MEASURED, last
// paragraph: reading C25 as a file-level rule sends the mesh builder to the wrong layer). It is not
// in base/ because base/ WRITERS take a carrier and never build one, and the base suite records base/
// as three-free (tests/worldengine-base-sphere.test.js: "three lives here, not in sphereField.js").
// Its own layer, like dispatch/, keeps both of those true.
//
// DELIBERATE NON-GOALS: no RNG (one-pipeline-fence registration 5: no SeededRandom under
// src/worldengine/), no resolution policy — the caller chooses N and iters; the game's choice is
// measured in tests/province-bake-host.test.js (AC-2), not defaulted here.
//
// ⛔ BYTE-VERBATIM BELOW THIS LINE. The four functions are the identical text; only the import
// specifiers changed from a bare `three` pair to the same bare pair (nothing to change).
import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
// ───────────── irregular sphere mesh (Fibonacci + Lloyd + spherical Delaunay) ─────────────
function fibonacciSphere(n) {
  const pts = new Array(n);
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * ga;
    pts[i] = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
  }
  return pts;
}
function sphericalDelaunay(points) {
  for (let i = 0; i < points.length; i++) points[i].__i = i;
  const hull = new ConvexHull().setFromPoints(points);
  const faces = [];
  for (const f of hull.faces) {
    const a = f.edge.head().point.__i;
    const b = f.edge.next.head().point.__i;
    const c = f.edge.next.next.head().point.__i;
    faces.push([a, b, c]);
  }
  return faces;
}
function buildAdjacency(N, faces) {
  const adjSet = Array.from({ length: N }, () => new Set());
  for (const [a, b, c] of faces) {
    adjSet[a].add(b); adjSet[a].add(c);
    adjSet[b].add(a); adjSet[b].add(c);
    adjSet[c].add(a); adjSet[c].add(b);
  }
  return adjSet.map(s => Array.from(s));
}
// Returns { verts:[[x,y,z]…], faces:[[a,b,c]…], adj:[[…neighbours]…] } — terrain-independent.
export function buildIrregularSphere(targetN, lloydIters) {
  let points = fibonacciSphere(targetN);
  for (let it = 0; it < lloydIters; it++) {
    const faces = sphericalDelaunay(points);
    const adj = buildAdjacency(points.length, faces);
    const moved = new Array(points.length);
    const c = new THREE.Vector3();
    for (let i = 0; i < points.length; i++) {
      c.copy(points[i]);
      for (const nb of adj[i]) c.add(points[nb]);
      c.normalize();
      moved[i] = c.clone();
    }
    points = moved;
  }
  const faces = sphericalDelaunay(points);
  const verts = points.map(p => [p.x, p.y, p.z]);
  const adj = buildAdjacency(verts.length, faces);
  return { verts, faces, adj };
}

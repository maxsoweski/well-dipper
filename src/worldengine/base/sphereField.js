// src/worldengine/base/sphereField.js
// F3: seam-free sphere field carrier. THREE-FREE BY CONSTRUCTION — it consumes a PLAIN mesh
// {verts:[[x,y,z]], faces, adj} built elsewhere (the caller uses buildIrregularSphere, which imports
// three; this module never does). verts are unit dirs, y-up (+y north pole).
const RAD2DEG = 180 / Math.PI;

export function makeSphereField(mesh) {
  const { verts, faces, adj } = mesh;
  const N = verts.length;
  const count = N;
  return {
    N, verts, faces, adj, count,
    height: new Float32Array(count),
    grainAngle: new Float32Array(count),
    grainMag: new Float32Array(count),
    regime: new Uint8Array(count),
    faultDensity: new Float32Array(count),
    flowAccum: new Float32Array(count),
    baseLevel: new Float32Array(count),
    standing: new Uint8Array(count),
    maturity: new Float32Array(count),
    nodeDir(i) { return verts[i]; },
    latDegOf(i) {
      const y = Math.max(-1, Math.min(1, verts[i][1]));
      return Math.asin(y) * RAD2DEG;
    },
    tangentFrameAt(i) {
      const d = verts[i];
      // east = normalize((0,1,0) x d) = normalize((d.z, 0, -d.x))
      let ex = d[2], ey = 0, ez = -d[0];
      const el = Math.hypot(ex, ey, ez);
      if (el < 1e-8) { ex = 1; ey = 0; ez = 0; }       // pole fallback (documented): world-x as east
      else { ex /= el; ey /= el; ez /= el; }
      // north = d x east (orthonormal, toward +y)
      const nx = d[1] * ez - d[2] * ey;
      const ny = d[2] * ex - d[0] * ez;
      const nz = d[0] * ey - d[1] * ex;
      return { east: [ex, ey, ez], north: [nx, ny, nz] };
    },
  };
}

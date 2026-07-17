// src/worldengine/base/stressFabric.js — SP-STRESS-FABRIC (World Engine V2-4 slice-2).
//
// THE ONE OWNED COPY of steeredNoise3, the anisotropic ridged-noise fabric that four base writers
// (tectonic.js grain, shellRelief.js ridge/trajectory, mixedInterior.js + stagnantLid.js tessera
// fold+ribbon) all sampled from a VERBATIM private copy. This module follows the V2-7d family-module
// extraction mold (the disjoint-concern precedent): a leaf module byte-exact at every call site (proven
// by dual-run compare in tests/worldengine-v2-4-stress-fabric.test.js), zero production behavior change.
//
// PURE + THREE-FREE: imports nothing; the noise3 sampler (a simplex-noise createNoise3D closure) is
// passed IN by the caller, so this module has no dependency on the noise seed/instance. No Math.random,
// no Date.now — a pure function of its arguments.
//
// CANONICAL FORM (the `ridged`-boolean form — the shellRelief.js/mixedInterior.js/stagnantLid.js text
// verbatim). The tectonic.js copy wrote the final transform as a REGIME ternary
//   `regime === REGIME.NORMAL ? Math.abs(nVal) - 0.5 : 0.5 - Math.abs(nVal)`
// which is ARITHMETICALLY IDENTICAL to the ridged form: NORMAL (ridged=false) ⇒ |n|-0.5, non-NORMAL
// (ridged=true) ⇒ 0.5-|n|. tectonic.js therefore imports this and passes `ridged = regime !== REGIME.NORMAL`
// at its call site — same floating-point expressions, same operand order, bit-identical output.
//
// SEAM-FREE (the invariant every caller relies on): the rotation is applied in the pole-safe tangent frame
// {east, north} and the sample is a continuous 3D simplex of the rotated unit direction, so same-direction
// neighbours — across the antimeridian and at the poles — sample the same value. The LOCKED anisotropy
// constants ({0.7|1.5} fScale / {0.25|0.55} along / {1.9|1.2} across) and the ridged transform are applied
// identically for every caller; only the `ridged` flag and (angle, freq, sign) vary per call site.
//
// PARAMS: noise3 — createNoise3D sampler; dir — unit sphere direction [x,y,z]; east,north — tangent frame
// at dir; angle — grain-rotation (rad); ridged — true ⇒ 0.5-|n| (positive relief lobe), false ⇒ |n|-0.5;
// freq — sample frequency; sign — +1 contraction (default) / -1 extension (selects the anisotropy set).
export function steeredNoise3(noise3, dir, east, north, angle, ridged, freq, sign = +1) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const contraction = sign >= 0;
  const fScale = contraction ? 0.7 : 1.5;
  const along  = contraction ? 0.25 : 0.55;
  const across = contraction ? 1.9 : 1.2;
  const sU = freq * fScale * along;
  const sV = freq * fScale * across;
  const ux = east[0] * ca + north[0] * sa;
  const uy = east[1] * ca + north[1] * sa;
  const uz = east[2] * ca + north[2] * sa;
  const vx = -east[0] * sa + north[0] * ca;
  const vy = -east[1] * sa + north[1] * ca;
  const vz = -east[2] * sa + north[2] * ca;
  const px = dir[0] * freq + ux * sU + vx * sV;
  const py = dir[1] * freq + uy * sU + vy * sV;
  const pz = dir[2] * freq + uz * sU + vz * sV;
  const nVal = noise3(px, py, pz);
  return ridged ? (0.5 - Math.abs(nVal)) : (Math.abs(nVal) - 0.5);
}

// Pure portal-traversal state machine — dot-product plane-crossing detection
// (Metzler-Gilbertz 2021). No THREE.js objects mutated; takes plain vectors,
// returns a new immutable-ish state. Shared by WarpPortal.updateTraversal and
// the headless tests so production and tests agree by construction.

export function createTraversal(mode = 'OUTSIDE_A') {
  return { mode, prevDotA: null, prevDotB: null };
}

// camPos/aPos/bPos: THREE.Vector3 (or any {x,y,z} with .dot via THREE).
// aNrm/bNrm: portal normals. discRadius: lateral capture radius.
export function stepTraversal(state, { camPos, aPos, aNrm, bPos, bNrm, discRadius }) {
  let { mode, prevDotA, prevDotB } = state;

  // Lateral distance from a portal's local axis (assumes axis ~ pocket centerline).
  const lat = (p) => Math.sqrt(
    (camPos.x - p.x) * (camPos.x - p.x) + (camPos.y - p.y) * (camPos.y - p.y)
  );

  // ── Portal A plane (entry/back-out) ──
  const dotA = (camPos.x - aPos.x) * aNrm.x + (camPos.y - aPos.y) * aNrm.y + (camPos.z - aPos.z) * aNrm.z;
  if (prevDotA !== null) {
    if (mode === 'OUTSIDE_A' && prevDotA > 0 && dotA <= 0 && lat(aPos) <= discRadius) {
      mode = 'INSIDE';
    } else if (mode === 'INSIDE' && prevDotA < 0 && dotA >= 0 && lat(aPos) <= discRadius) {
      mode = 'OUTSIDE_A';
    }
  }
  prevDotA = dotA;

  // ── Portal B plane (emergence/re-enter) ──
  const dotB = (camPos.x - bPos.x) * bNrm.x + (camPos.y - bPos.y) * bNrm.y + (camPos.z - bPos.z) * bNrm.z;
  if (prevDotB !== null) {
    if (mode === 'INSIDE' && prevDotB < 0 && dotB >= 0 && lat(bPos) <= discRadius) {
      mode = 'OUTSIDE_B';
    } else if (mode === 'OUTSIDE_B' && prevDotB > 0 && dotB <= 0 && lat(bPos) <= discRadius) {
      mode = 'INSIDE';
    }
  }
  prevDotB = dotB;

  return { mode, prevDotA, prevDotB };
}

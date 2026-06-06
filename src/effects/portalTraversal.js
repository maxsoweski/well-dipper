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

  // Perpendicular (lateral) distance from the camera to a portal's center axis:
  // total offset magnitude with the along-normal component projected out. This is
  // orientation-invariant (matches the removed WarpPortal._lateralDistance), so the
  // disc-radius gate works for arbitrarily-positioned/oriented production portals,
  // not just the axis-aligned test fixture.
  const lat = (p, n) => {
    const dx = camPos.x - p.x, dy = camPos.y - p.y, dz = camPos.z - p.z;
    const along = dx * n.x + dy * n.y + dz * n.z;
    return Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
  };

  // ── Portal A plane (entry/back-out) ──
  const dotA = (camPos.x - aPos.x) * aNrm.x + (camPos.y - aPos.y) * aNrm.y + (camPos.z - aPos.z) * aNrm.z;
  if (prevDotA !== null) {
    if (mode === 'OUTSIDE_A' && prevDotA > 0 && dotA <= 0 && lat(aPos, aNrm) <= discRadius) {
      mode = 'INSIDE';
    } else if (mode === 'INSIDE' && prevDotA < 0 && dotA >= 0 && lat(aPos, aNrm) <= discRadius) {
      mode = 'OUTSIDE_A';
    }
  }
  prevDotA = dotA;

  // ── Portal B plane (emergence/re-enter) ──
  const dotB = (camPos.x - bPos.x) * bNrm.x + (camPos.y - bPos.y) * bNrm.y + (camPos.z - bPos.z) * bNrm.z;
  if (prevDotB !== null) {
    if (mode === 'INSIDE' && prevDotB < 0 && dotB >= 0 && lat(bPos, bNrm) <= discRadius) {
      mode = 'OUTSIDE_B';
    } else if (mode === 'OUTSIDE_B' && prevDotB > 0 && dotB <= 0 && lat(bPos, bNrm) <= discRadius) {
      mode = 'INSIDE';
    }
  }
  prevDotB = dotB;

  return { mode, prevDotA, prevDotB };
}

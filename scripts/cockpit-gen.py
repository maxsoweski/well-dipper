#!/usr/bin/env python3
"""
cockpit-gen.py -- HELM cockpit interior geometry (increment 1, lab-only).

WHAT THIS BUILDS
    An angular, faceted cockpit interior authored entirely from named constants and
    exported as a single GLB, plus a JSON metrics sidecar that declares -- in glTF axes
    -- exactly what the GLB should contain. Objects:

        Eye_Point      an empty at the world origin: the pilot's eye.
        Cockpit_Frame  the canopy frame: an octagonal aperture (a rectangle with its four
                       corners chamfered) at the canopy plane, extruded BACK toward the eye
                       and flared outward at the rear, so from the seat you look through the
                       hole and see the inner faces of the pillars. Closed solid.
        Screen_UL/UR/LL/LR
                       four flat quads, one per chamfered corner, each MOUNTED ON that
                       corner's pillar face (not hung in the window) and rotated so its
                       normal points exactly at the eye-point. Increment 2 replaces
                       Mat_Screen with the phosphor CRT shader; these quads are its
                       mounting surfaces, and Mat_Screen is the one double-sided material
                       here so they do not vanish from the lab's exterior orbit view.
        Hull_Nose      the ship's OWN NOSE below the median -- exterior hull, seen like
                       looking over a car bonnet. There is deliberately NO interior console.

COORDINATE CONVENTION -- the single easiest thing to get wrong
    Authored in BLENDER axes:  +X right, +Y FORWARD, +Z up, eye at (0, 0, 0), 1 unit = 1 m.
    Exported with export_yup=True, which maps Blender (x, y, z) -> glTF (x, z, -y).
    So Blender +Y forward becomes glTF -Z, which is three.js forward. In the GLB and in
    three.js the model therefore reads: +X right, +Y up, forward is -Z, eye at the origin.
    NO scale normalisation anywhere -- unlike the ships pipeline (ShipLoader.js), this is the
    one object whose real-world metres matter, so every node is left at identity.

    The metrics sidecar reports every point and direction in glTF axes (post-conversion),
    because that is what a headless GLB parse sees.

THE CONSTANTS ARE THE RE-AUTHOR SURFACE
    Max changes the cockpit's proportions by editing the CONSTANTS block below and re-running
    this script -- never by hand-modelling. Every vertex is a deterministic function of those
    constants (explicit vertex/face lists, no random, no modifiers, no bmesh operators, no
    booleans, no iteration over unordered containers), so a re-run reproduces the same mesh.

    The script also prints an ANALYTIC PREDICTION of the AC-FRAME occlusion fraction (what
    share of a 70 deg / 16:9 frame the cockpit covers) so proportions can be tuned without a
    browser round-trip. The browser measurement remains authoritative; this is a fast guide.

RUNNING IT
    blender.exe --background --factory-startup --python cockpit-gen.py -- \
        --out <path/to/cockpit.glb> --metrics <path/to/cockpit-metrics.json>

    Both arguments are optional; without them the script writes to
    <repo>/public/assets/cockpit/ derived from __file__. --factory-startup is recommended
    (it guarantees a clean startup file) but not required: the script purges the scene itself.

ASSUMPTIONS the spec did not pin down
    FRAME_WALL (0.10 m)     The spec described only the frame's inner surface. A zero-thickness
                            shell would look correct from the seat but hollow from the orbit
                            view, so the frame is built as a closed solid: inner surface, outer
                            surface, front rim, back rim. The offset is a uniform 0.10 m miter
                            at the FRONT ring only; the rear ring is that same offset polygon
                            scaled by FRAME_FLARE, so the wall reads FRAME_WALL * FRAME_FLARE
                            = 0.134 m back there. Either way it changes nothing the pilot sees:
                            the aperture that clips the view is the inner front ring at scale 1.0.
    NOSE_THICKNESS (0.30 m) The spec asked for "a little thickness/underside"; it did not give
                            a number. The underside is a constant vertical offset, keeping the
                            nose an eight-vertex angular slab.
    Screen width axis       "SCREEN_W along the bevel" and "normal points at the eye" cannot
                            both hold exactly -- the bevel direction is not perpendicular to
                            the eye ray. The normal wins (AC-FORM measures it); the width axis
                            is the bevel direction projected into the quad's plane.
    Screen standoff         A panel tilted to face the eye is not parallel to the pillar face it
                            hangs on, so it needs to stand PROUD of that face or its corners bury
                            themselves in the frame solid and poke out through the canopy plane.
                            That standoff is DERIVED per screen from SCREEN_W, SCREEN_H and the
                            panel's tilt (screen_clearance()), never authored -- so it re-derives
                            itself when Max changes the proportions. What IS authored is
                            SCREEN_MOUNT_DEPTH: WHERE on the pillar face the panel sits.

TUNING NOTES (all measured by this script's own predictor -- run it under plain python3 to
re-measure; the bpy import is guarded so analyse() works with no Blender)
    Shipped constants predict 27.57% occlusion: frame 22.78 + nose 4.80 + screens 0.00. That
    sits mid-band in AC-FRAME's 25-30% window on purpose, so a small browser-vs-analytic
    discrepancy cannot push the measured value out of band.

    The screens contribute ZERO. That is deliberate and is the point of the mounting scheme:
    they sit entirely on pillar the frame already occludes, so AC-FRAME's floor rests on the
    frame and the nose alone. An earlier revision met the band only because the screens dangled
    into the open aperture -- i.e. it passed BECAUSE of a defect, and seating them correctly
    would have dropped it to 24.4%. If a future edit makes "screens occlude" non-zero, the
    screens have drifted back into the window; fix the mounting, do not bank the percentage.

    Levers, at the shipped operating point:
      * the four aperture constants are the occlusion control. Shrinking all of them by 1%
        adds ~1.30 percentage points of occlusion.
      * BEVEL_X / BEVEL_Z are the double lever. They add occlusion AND enlarge the flat corner
        pads the screens mount on. They are large here for that reason: with a small chamfer
        there is nowhere to put a screen that is both on structure and inside the 70 deg frame.
      * FRAME_FLARE and SCREEN_MOUNT_DEPTH place the screens without touching occlusion at all
        (the front ring is what clips the view). More flare or more depth pushes a screen
        angularly outward, off the edge of the 70 deg frame; less pulls it in over the window.
        At the shipped values 92-96% of each screen falls inside the frame and 0% overlaps the
        aperture. The run prints both numbers per screen.

    The screens were 0.42 x 0.28 m and are now 0.30 x 0.20 m. At the corners a panel's tan-space
    footprint is inflated by the off-axis stretch (sec^2 of ~48 deg, i.e. more than double), and
    a 0.42 m panel simply does not fit between the aperture rim and the frame edge at any
    aperture that also honours the 30% occlusion ceiling. This is a real constraint, not a
    preference: enlarging the screens forces them either off-screen or back into the window.

SCOPE -- what this increment deliberately does NOT do
    No CRT/phosphor shader (increment 2). No glass or refraction (increment 3). No head/hull
    decoupling, no 5th render pass, no HELM gating (increment 4). No screen data (increment 5).
    No file under src/ is touched by this workstream at all (AC-NOGAME).

Workstream: docs/WORKSTREAMS/cockpit-lab-geometry-2026-07-28/
"""

import json
import math
import os
import sys

try:
    import bpy
except ImportError:  # importable outside Blender for inspection; main() will refuse to run
    bpy = None


# =============================================================================
# CONSTANTS -- Blender frame (+X right, +Y forward, +Z up), METRES.
# This block is the re-author surface. Edit here, re-run, re-measure.
# =============================================================================

HULL_REF_LENGTH   = 20.0     # Bible S8A player hull, house-sized. The nose is a fraction of this.
CANOPY_Y          = 1.20     # aperture plane, forward of the eye
APERTURE_HALF_W   = 1.4557   # +/-X at the canopy plane  (= 1.20 * tan(50.5 deg))
APERTURE_TOP_Z    = 0.7615   # +Z at the canopy plane    (= 1.20 * tan(32.4 deg))
APERTURE_BOT_Z    = -0.8528  # -Z at the canopy plane    (= -1.20 * tan(35.4 deg))
BEVEL_X           = 0.79     # corner chamfer run in X  -> octagonal aperture (the "angular" read).
BEVEL_Z           = 0.51     # These are LARGE on purpose: the chamfers are the flat corner pads the
                             # four screens are mounted on, and a small chamfer leaves nowhere to put
                             # them that is both on structure and inside the 70 deg frame. They are
                             # also the most efficient occlusion lever, because they add frame
                             # exactly where the screens need backing. See TUNING NOTES.
FRAME_DEPTH       = 0.45     # frame shell extends BACK toward the eye by this much (Y: 1.20 -> 0.75)
FRAME_FLARE       = 1.34     # frame silhouette scales by this at the rear -> pillars flare outward.
                             # Also sets how far the mounting faces lean back, which is what lets a
                             # screen's derived standoff clear the canopy plane -- see bevel_face().
FRAME_WALL        = 0.10     # ADDED (see ASSUMPTIONS): wall thickness, makes the frame a closed solid
SCREEN_W          = 0.30     # each corner screen, along the bevel
SCREEN_H          = 0.20
SCREEN_MOUNT_DEPTH = 0.10    # how far BACK along the pillar's bevel face the panel is mounted
                             # (0 = hung off the front rim, FRAME_DEPTH = flat against the rear
                             # rim). This is WHERE on the pillar it sits; how far it stands PROUD
                             # of the pillar is derived, not authored -- see screen_clearance().
SCREEN_MARGIN     = 0.004    # 4 mm air gap held between the panel and every surface it clears
NOSE_NEAR_Y       = 1.20     # nose starts at the canopy plane, at the aperture's lower lip
NOSE_NEAR_Z       = APERTURE_BOT_Z   # DERIVED, never a second literal: the nose top deck starts
                             # exactly on the aperture's lower lip, so no gap can open between
                             # them when APERTURE_BOT_Z is retuned.
NOSE_FAR_Y        = 3.00
NOSE_FAR_Z        = -1.618   # (= -3.00 * tan(28.3 deg)) so the nose reads as falling away forward
NOSE_HALF_W_NEAR  = 1.30
NOSE_HALF_W_FAR   = 0.62     # tapers to a blunt angular tip
NOSE_THICKNESS    = 0.30     # ADDED (see ASSUMPTIONS): hull slab depth, so the nose is a solid

# The frame is judged against the game's real camera (src/ui/Settings.js:40).
GAME_FOV_DEG      = 70.0     # vertical FOV
GAME_ASPECT       = 16.0 / 9.0

# Material base colours, linear RGB.
MAT_FRAME_RGB     = (0.055, 0.058, 0.062)   # dark grey
MAT_SCREEN_RGB    = (0.010, 0.012, 0.011)   # near-black (increment 2 replaces this material)
MAT_HULL_RGB      = (0.155, 0.158, 0.165)   # mid grey

# Node names. The headless tests key off these -- do not rename without updating the tests.
NAME_EYE     = "Eye_Point"
NAME_FRAME   = "Cockpit_Frame"
NAME_NOSE    = "Hull_Nose"
SCREEN_NAMES = ("Screen_UL", "Screen_UR", "Screen_LL", "Screen_LR")


# =============================================================================
# Small vector / polygon helpers (pure Python -- no bpy, fully deterministic)
# =============================================================================

def v_add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def v_sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def v_mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def v_dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def v_cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def v_len(a):
    return math.sqrt(v_dot(a, a))


def v_norm(a):
    L = v_len(a)
    if L == 0.0:
        raise ValueError("cannot normalise a zero-length vector")
    return (a[0] / L, a[1] / L, a[2] / L)


def to_gltf(p):
    """Blender (x, y, z) -> glTF (x, z, -y). Matches export_yup=True.

    This is a proper rotation (determinant +1), so it applies unchanged to directions
    and normals, and it preserves face winding.
    """
    return (p[0], p[2], -p[1])


def r6(x):
    """Round for a stable, diff-friendly sidecar. 1e-6 m is far below every AC tolerance."""
    v = round(float(x), 6)
    return 0.0 if v == 0.0 else v


def r6v(p):
    return [r6(p[0]), r6(p[1]), r6(p[2])]


def bbox_of(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    zs = [p[2] for p in points]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def poly_area_2d(poly):
    """Absolute shoelace area of a 2D polygon."""
    n = len(poly)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) * 0.5


def _side(a, b, p):
    """> 0 if p is left of the directed line a->b."""
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])


def _line_intersect(p, q, a, b):
    """Intersection of segment p->q with the infinite line a->b (assumed to cross)."""
    r = (q[0] - p[0], q[1] - p[1])
    s = (b[0] - a[0], b[1] - a[1])
    denom = r[0] * s[1] - r[1] * s[0]
    if denom == 0.0:
        return q
    t = ((a[0] - p[0]) * s[1] - (a[1] - p[1]) * s[0]) / denom
    return (p[0] + r[0] * t, p[1] + r[1] * t)


def clip_poly(subject, clip_ccw):
    """Sutherland-Hodgman: clip a polygon against a CONVEX, counter-clockwise clip polygon."""
    out = list(subject)
    n = len(clip_ccw)
    for i in range(n):
        if not out:
            return []
        a = clip_ccw[i]
        b = clip_ccw[(i + 1) % n]
        inp = out
        out = []
        m = len(inp)
        for j in range(m):
            cur = inp[j]
            prv = inp[j - 1]
            cur_in = _side(a, b, cur) >= 0.0
            prv_in = _side(a, b, prv) >= 0.0
            if cur_in:
                if not prv_in:
                    out.append(_line_intersect(prv, cur, a, b))
                out.append(cur)
            elif prv_in:
                out.append(_line_intersect(prv, cur, a, b))
    return out


def point_in_convex_ccw(poly, p, eps=1e-12):
    n = len(poly)
    for i in range(n):
        if _side(poly[i], poly[(i + 1) % n], p) < -eps:
            return False
    return True


def _edge_outward_normal_2d(p, q):
    """Outward unit normal of edge p->q for a counter-clockwise polygon in (x, z)."""
    dx = q[0] - p[0]
    dz = q[1] - p[1]
    L = math.hypot(dx, dz)
    return (dz / L, -dx / L)


def offset_polygon_2d(poly_ccw, dist):
    """Miter-offset a convex CCW polygon outward by a constant perpendicular distance.

    Uniform wall thickness on every edge (a uniform scale would not give that on a
    non-square octagon). Deterministic: pure arithmetic on the input order.
    """
    n = len(poly_ccw)
    out = []
    for i in range(n):
        p_prev = poly_ccw[(i - 1) % n]
        p = poly_ccw[i]
        p_next = poly_ccw[(i + 1) % n]
        n1 = _edge_outward_normal_2d(p_prev, p)
        n2 = _edge_outward_normal_2d(p, p_next)
        mx = n1[0] + n2[0]
        mz = n1[1] + n2[1]
        L = math.hypot(mx, mz)
        mx /= L
        mz /= L
        c = mx * n2[0] + mz * n2[1]
        s = dist / c
        out.append((p[0] + mx * s, p[1] + mz * s))
    return out


# =============================================================================
# Geometry authoring -- pure data (name, verts, faces). No bpy in this section,
# so the metrics sidecar and the exported mesh are computed from the SAME lists.
# =============================================================================

def aperture_octagon():
    """The canopy aperture in the canopy plane, as 8 (x, z) points, counter-clockwise.

    A rectangle whose four corners are chamfered by BEVEL_X / BEVEL_Z -- that chamfer is
    what makes the aperture read as angular rather than as a window. Index order runs
    right -> top -> left -> bottom; the four bevel edges are (0,1), (2,3), (4,5), (6,7).
    """
    w = APERTURE_HALF_W
    t = APERTURE_TOP_Z
    b = APERTURE_BOT_Z
    bx = BEVEL_X
    bz = BEVEL_Z
    return [
        (w,          t - bz),   # 0  right edge, upper end
        (w - bx,     t),        # 1  top edge, right end
        (-(w - bx),  t),        # 2  top edge, left end
        (-w,         t - bz),   # 3  left edge, upper end
        (-w,         b + bz),   # 4  left edge, lower end
        (-(w - bx),  b),        # 5  bottom edge, left end
        (w - bx,     b),        # 6  bottom edge, right end
        (w,          b + bz),   # 7  right edge, lower end
    ]


# Which octagon bevel edge each screen is mounted on. Left/right are the PILOT's,
# looking forward: left is -X, up is +Z.
SCREEN_BEVELS = {
    "Screen_UL": (2, 3),   # upper-left  (-X, +Z)
    "Screen_UR": (0, 1),   # upper-right (+X, +Z)
    "Screen_LL": (4, 5),   # lower-left  (-X, -Z)
    "Screen_LR": (6, 7),   # lower-right (+X, -Z)
}


def build_frame():
    """Cockpit_Frame: a closed octagonal ring solid.

    Front (far) rim sits in the canopy plane at scale 1.0 -- that ring IS the aperture and
    is what clips the pilot's view. The ring is extruded BACK toward the eye by FRAME_DEPTH
    and scaled by FRAME_FLARE, so the pillars flare outward behind the aperture: from the
    seat you see their inner faces, and that depth is what will give head-sway parallax in
    increment 4. FRAME_WALL gives the ring an outer surface so it is a solid, not a film.
    """
    inner = aperture_octagon()
    outer = offset_polygon_2d(inner, FRAME_WALL)
    y_f = CANOPY_Y
    y_b = CANOPY_Y - FRAME_DEPTH
    f = FRAME_FLARE

    IF = [(x, y_f, z) for (x, z) in inner]                  # 0..7   inner front (the aperture)
    IB = [(x * f, y_b, z * f) for (x, z) in inner]          # 8..15  inner back  (flared)
    OF = [(x, y_f, z) for (x, z) in outer]                  # 16..23 outer front
    OB = [(x * f, y_b, z * f) for (x, z) in outer]          # 24..31 outer back  (flared)

    verts = IF + IB + OF + OB
    faces = []
    for i in range(8):
        j = (i + 1) % 8
        faces.append((i, 8 + i, 8 + j, j))                  # inner wall, normal points inward
        faces.append((16 + i, 16 + j, 24 + j, 24 + i))      # outer wall, normal points outward
        faces.append((i, j, 16 + j, 16 + i))                # front rim,  normal +Y (forward)
        faces.append((8 + i, 24 + i, 24 + j, 8 + j))        # back rim,   normal -Y (at the eye)
    return verts, faces


def bevel_face(name):
    """The pillar inner face a screen is mounted on, plus the mount point on it.

    The frame's inner wall runs from the aperture octagon at the canopy plane BACK toward
    the eye, scaling by FRAME_FLARE, so every wall face is a planar trapezoid (the front and
    rear edges are parallel by construction, because the rear ring is the front ring scaled
    about the aperture axis).

    Because the wall flares OUTWARD as it comes back toward the eye, the face's inward
    normal tilts BACKWARD as well as inward. That is the whole reason a screen is offset
    along this normal rather than along -Y: one offset clears the wall it hangs on AND
    retreats from the canopy plane at the same time.

    Returns a dict:
        mount   point on the face, SCREEN_MOUNT_DEPTH metres back from the canopy plane,
                on the line that bisects the face
        normal  unit normal of the face, pointing INWARD (toward the aperture axis)
        along   unit vector along the bevel edge (identical at every depth: parallel edges)
    """
    if not (0.0 <= SCREEN_MOUNT_DEPTH <= FRAME_DEPTH):
        raise ValueError("SCREEN_MOUNT_DEPTH (%.4f) must lie between 0 and FRAME_DEPTH (%.4f) "
                         "-- it is a position ON the pillar face" % (SCREEN_MOUNT_DEPTH, FRAME_DEPTH))
    i0, i1 = SCREEN_BEVELS[name]
    oct2 = aperture_octagon()
    p0 = oct2[i0]
    p1 = oct2[i1]
    y_f = CANOPY_Y
    y_b = CANOPY_Y - FRAME_DEPTH
    f = FRAME_FLARE

    a_front = (p0[0], y_f, p0[1])
    b_front = (p1[0], y_f, p1[1])
    a_back = (p0[0] * f, y_b, p0[1] * f)

    along = v_norm(v_sub(b_front, a_front))
    nrm = v_norm(v_cross(along, v_sub(a_back, a_front)))
    n2 = _edge_outward_normal_2d(p0, p1)            # 2D outward normal of that octagon edge
    if nrm[0] * n2[0] + nrm[2] * n2[1] > 0.0:       # orient it inward, toward the aperture axis
        nrm = v_mul(nrm, -1.0)

    s = 1.0 + (FRAME_FLARE - 1.0) * SCREEN_MOUNT_DEPTH / FRAME_DEPTH
    mid_x = (p0[0] + p1[0]) * 0.5
    mid_z = (p0[1] + p1[1]) * 0.5
    mount = (mid_x * s, CANOPY_Y - SCREEN_MOUNT_DEPTH, mid_z * s)
    return {"mount": mount, "normal": nrm, "along": along}


def screen_basis(centre, along, name):
    """Orthonormal frame for a screen quad centred at `centre`.

    The normal IS the centre->eye direction (never a hand-tuned Euler angle), the width axis
    is the bevel direction projected into the quad's plane, and the height axis completes it.
    """
    n = v_norm(v_mul(centre, -1.0))                 # centre -> eye at the origin
    u = v_sub(along, v_mul(n, v_dot(along, n)))     # bevel direction, projected into the plane
    if v_len(u) < 1e-9:
        raise ValueError("%s: bevel direction is parallel to the eye ray" % name)
    u = v_norm(u)
    w = v_norm(v_cross(n, u))                       # completes the basis; u x w == n
    if w[2] < 0.0:                                  # keep "up" up; flipping both preserves u x w
        u = v_mul(u, -1.0)
        w = v_mul(w, -1.0)
    return n, u, w


def screen_clearance(name, mount, face_n, u, w):
    """How far the panel must stand PROUD of its mounting face -- DERIVED, not authored.

    A quad tilted to face the eye is not parallel to the face it hangs on, so its corners
    reach out of that face by  hw*|u.n_face| + hh*|w.n_face|,  and reach forward toward the
    canopy plane by  hw*|u_y| + hh*|w_y|.  Standing the whole quad off along the face's
    inward normal by the larger of the two requirements puts EVERY vertex -- not just the
    centre -- at or behind both surfaces, and re-derives itself the moment SCREEN_W,
    SCREEN_H, the bevel angles or the frame proportions change. That is the point: there is
    no clearance literal here to go stale when Max re-authors the constants.
    """
    hw = SCREEN_W * 0.5
    hh = SCREEN_H * 0.5

    # (1) Clear of the pillar's inner face: the corners' reach out of that face plane.
    #     `mount` lies ON the plane, so the offset needed is exactly that reach.
    need_face = hw * abs(v_dot(u, face_n)) + hh * abs(v_dot(w, face_n)) + SCREEN_MARGIN

    # (2) Clear of the canopy plane at y = CANOPY_Y. SCREEN_MOUNT_DEPTH already buys some
    #     headroom; the standoff only has to make up whatever is still missing.
    reach_fwd = hw * abs(u[1]) + hh * abs(w[1]) + SCREEN_MARGIN
    headroom = CANOPY_Y - mount[1]
    need_canopy = 0.0
    if reach_fwd > headroom:
        back_per_metre = -face_n[1]     # metres of retreat in Y bought per metre of standoff
        if back_per_metre <= 1e-9:
            raise ValueError(
                "%s: the mounting face does not lean back (FRAME_FLARE=%.4f), so no standoff "
                "along it can clear the canopy plane. Raise SCREEN_MOUNT_DEPTH to at least "
                "%.4f m, or raise FRAME_FLARE." % (name, FRAME_FLARE, reach_fwd))
        need_canopy = (reach_fwd - headroom) / back_per_metre

    return max(need_face, need_canopy)


# The standoff depends on the panel's tilt, and the tilt depends on where the standoff puts
# the panel -- a small fixed point. It contracts hard (the standoff is ~1/10 of the distance
# to the eye), so a handful of rounds converge to machine precision. Pure arithmetic in a
# fixed order: bit-for-bit reproducible, which AC-REPRO asserts.
SCREEN_SOLVE_MAX_ITERS = 64
SCREEN_SOLVE_TOL = 1e-13


def build_screen(name):
    """One corner screen: a flat quad, mounted ON the pillar's bevel face, normal at the eye.

    Mount point   the bevel face, SCREEN_MOUNT_DEPTH back from the canopy plane -- i.e. on
                  the pillar, not hung off its front lip.
    Standoff      along that face's INWARD normal, by the clearance screen_clearance()
                  derives from the panel's size and tilt, so every vertex stays at or behind
                  both the canopy plane and the pillar's inner face.
    Basis         from the centre->eye vector: the normal IS that vector, the width axis is
                  the bevel direction projected into the quad's plane, the height axis
                  completes the frame. Winding makes the face normal equal the centre->eye
                  direction exactly.
    """
    face = bevel_face(name)
    mount = face["mount"]
    m = face["normal"]
    along = face["along"]

    standoff = 0.0
    for _ in range(SCREEN_SOLVE_MAX_ITERS):
        centre = v_add(mount, v_mul(m, standoff))
        n, u, w = screen_basis(centre, along, name)
        nxt = screen_clearance(name, mount, m, u, w)
        converged = abs(nxt - standoff) <= SCREEN_SOLVE_TOL
        standoff = nxt
        if converged:
            break
    else:
        raise ValueError("%s: the screen standoff fixed point did not converge in %d rounds"
                         % (name, SCREEN_SOLVE_MAX_ITERS))

    centre = v_add(mount, v_mul(m, standoff))
    n, u, w = screen_basis(centre, along, name)

    hw = SCREEN_W * 0.5
    hh = SCREEN_H * 0.5
    verts = [
        v_add(centre, v_add(v_mul(u, -hw), v_mul(w, -hh))),
        v_add(centre, v_add(v_mul(u, hw), v_mul(w, -hh))),
        v_add(centre, v_add(v_mul(u, hw), v_mul(w, hh))),
        v_add(centre, v_add(v_mul(u, -hw), v_mul(w, hh))),
    ]
    faces = [(0, 1, 2, 3)]
    return verts, faces, centre, n, standoff


def build_nose():
    """Hull_Nose: the ship's own nose below the median -- exterior hull, not a console.

    An eight-vertex angular slab. Its top deck is a single planar trapezoid running from the
    aperture's lower lip forward and DOWN, so from the seat it reads as falling away like a
    car bonnet; NOSE_THICKNESS gives it an underside so it is a solid rather than a plane.
    """
    zt_n = NOSE_NEAR_Z
    zt_f = NOSE_FAR_Z
    zb_n = NOSE_NEAR_Z - NOSE_THICKNESS
    zb_f = NOSE_FAR_Z - NOSE_THICKNESS
    hn = NOSE_HALF_W_NEAR
    hf = NOSE_HALF_W_FAR

    verts = [
        (hn, NOSE_NEAR_Y, zt_n),    # 0 top near right
        (-hn, NOSE_NEAR_Y, zt_n),   # 1 top near left
        (-hf, NOSE_FAR_Y, zt_f),    # 2 top far  left
        (hf, NOSE_FAR_Y, zt_f),     # 3 top far  right
        (hn, NOSE_NEAR_Y, zb_n),    # 4 bottom near right
        (-hn, NOSE_NEAR_Y, zb_n),   # 5 bottom near left
        (-hf, NOSE_FAR_Y, zb_f),    # 6 bottom far  left
        (hf, NOSE_FAR_Y, zb_f),     # 7 bottom far  right
    ]
    faces = [
        (0, 3, 2, 1),   # top deck,  normal up/forward
        (4, 5, 6, 7),   # underside, normal down
        (0, 1, 5, 4),   # near cap,  normal -Y (toward the eye)
        (3, 7, 6, 2),   # far cap,   normal +Y
        (0, 4, 7, 3),   # right side, normal +X
        (1, 2, 6, 5),   # left side,  normal -X
    ]
    return verts, faces


def build_all():
    """Every mesh, in a fixed order. Returns a list of dicts (name, verts, faces, material)."""
    fv, ff = build_frame()
    parts = [{"name": NAME_FRAME, "verts": fv, "faces": ff, "material": "Mat_Frame",
              "centre": None, "normal": None, "standoff": None}]
    for nm in SCREEN_NAMES:
        sv, sf, centre, normal, standoff = build_screen(nm)
        parts.append({"name": nm, "verts": sv, "faces": sf, "material": "Mat_Screen",
                      "centre": centre, "normal": normal, "standoff": standoff})
    nv, nf = build_nose()
    parts.append({"name": NAME_NOSE, "verts": nv, "faces": nf, "material": "Mat_Hull",
                  "centre": None, "normal": None, "standoff": None})
    return parts


# =============================================================================
# Analysis -- angles, the AC-FRAME occlusion prediction, and clearance diagnostics.
# All analytic and deterministic; the browser measurement stays authoritative.
# =============================================================================

def project_tan(p):
    """Blender point -> (tan of horizontal angle, tan of vertical angle) at the eye.

    A perspective camera maps directions linearly onto this plane, so an area fraction
    measured here IS the pixel fraction. Straight 3D lines stay straight here.
    """
    if p[1] <= 1e-9:
        raise ValueError("point is not in front of the eye: %r" % (p,))
    return (p[0] / p[1], p[2] / p[1])


def analyse():
    """Predict the AC-FRAME occlusion fraction and check the frame/screen clearances."""
    tan_v = math.tan(math.radians(GAME_FOV_DEG * 0.5))
    tan_h = tan_v * GAME_ASPECT
    frame_rect = [(-tan_h, -tan_v), (tan_h, -tan_v), (tan_h, tan_v), (-tan_h, tan_v)]
    frame_area = poly_area_2d(frame_rect)

    oct2 = aperture_octagon()
    aperture_tan = [(x / CANOPY_Y, z / CANOPY_Y) for (x, z) in oct2]
    open_poly = clip_poly(aperture_tan, frame_rect)
    open_area = poly_area_2d(open_poly)

    # The nose's visible silhouette from the seat is its top deck: the near cap projects
    # entirely below the aperture's lower lip and the side faces are back-facing.
    nv, _ = build_nose()
    nose_tan = [project_tan(nv[i]) for i in (0, 3, 2, 1)]
    nose_clipped = clip_poly(clip_poly(nose_tan, aperture_tan), frame_rect)
    nose_area = poly_area_2d(nose_clipped)

    # Screens only ADD occlusion where they hang into the open aperture; the rest of each
    # quad covers pillar, which the frame already occludes. Subtract any part that also
    # overlaps the nose silhouette, or the two would be counted twice.
    #
    # Mounted properly on the pillar faces this term is ~0, and AC-FRAME's band must be met
    # by the frame and the nose alone -- a cockpit whose 25% floor depended on its screens
    # dangling in the window would fail the moment they were seated correctly.
    screen_geo = {nm: build_screen(nm) for nm in SCREEN_NAMES}
    screens_area = 0.0
    screen_detail = []
    screen_outside_game_frame = 0.0
    for nm in SCREEN_NAMES:
        sv, _, _, _, standoff = screen_geo[nm]
        s_tan = [project_tan(v) for v in sv]
        in_frame = clip_poly(s_tan, frame_rect)
        a = poly_area_2d(clip_poly(in_frame, aperture_tan))
        a -= poly_area_2d(clip_poly(clip_poly(in_frame, aperture_tan), nose_tan))
        a = max(0.0, a)
        screens_area += a
        # Visibility: a screen the pilot cannot see is a screen increment 2 cannot use.
        for (tx, tz) in s_tan:
            screen_outside_game_frame = max(screen_outside_game_frame,
                                            abs(tx) - tan_h, abs(tz) - tan_v)
        projected = poly_area_2d(s_tan)
        visible = poly_area_2d(in_frame)
        screen_detail.append({
            "name": nm,
            "standoff": standoff,
            "areaTanSpace": a,
            "visibleFraction": (visible / projected) if projected > 0.0 else 0.0,
            "overWindowFraction": (a / projected) if projected > 0.0 else 0.0,
        })

    sky_area = max(0.0, open_area - nose_area - screens_area)
    occlusion = 1.0 - sky_area / frame_area

    # Does the flared rear ring still cover the whole border at this FOV? If a corner of
    # the frame escapes it, there is a hole in the cockpit and the prediction understates.
    y_b = CANOPY_Y - FRAME_DEPTH
    rear_tan = [((x * FRAME_FLARE) / y_b, (z * FRAME_FLARE) / y_b) for (x, z) in oct2]
    border_covered = all(point_in_convex_ccw(rear_tan, c) for c in frame_rect)

    # Screen clearance, checked INDEPENDENTLY of screen_clearance()'s derivation -- this walks
    # the finished vertices against the finished frame, so a wrong derivation shows up here
    # rather than being confirmed by its own arithmetic. Both numbers must be 0.
    #   forward_overshoot: any vertex forward of the canopy plane, i.e. hanging out of the
    #                      window in front of the frame.
    #   pillar_overshoot:  any vertex radially outside the frame's inner surface at that
    #                      depth, i.e. buried in the Cockpit_Frame solid. Vertices behind the
    #                      rear rim are skipped: there is no frame back there to be inside of.
    forward_overshoot = 0.0
    pillar_overshoot = 0.0
    for nm in SCREEN_NAMES:
        sv, _, _, _, _ = screen_geo[nm]
        for v in sv:
            forward_overshoot = max(forward_overshoot, v[1] - CANOPY_Y)
            if y_b <= v[1] <= CANOPY_Y:
                s = 1.0 + (FRAME_FLARE - 1.0) * (CANOPY_Y - v[1]) / FRAME_DEPTH
                if not point_in_convex_ccw(oct2, (v[0] / s, v[2] / s)):
                    # how far outside, measured radially in the aperture plane
                    inner_pt = (v[0] / s, v[2] / s)
                    worst = 0.0
                    for i in range(8):
                        a2 = oct2[i]
                        b2 = oct2[(i + 1) % 8]
                        n2 = _edge_outward_normal_2d(a2, b2)
                        dist = (inner_pt[0] - a2[0]) * n2[0] + (inner_pt[1] - a2[1]) * n2[1]
                        worst = max(worst, dist)
                    pillar_overshoot = max(pillar_overshoot, worst * s)

    return {
        "fovDeg": GAME_FOV_DEG,
        "aspect": GAME_ASPECT,
        "halfAngleHorizontalDeg": math.degrees(math.atan(tan_h)),
        "halfAngleVerticalDeg": math.degrees(math.atan(tan_v)),
        "apertureHalfAngleLeftRightDeg": math.degrees(math.atan(APERTURE_HALF_W / CANOPY_Y)),
        "apertureHalfAngleUpDeg": math.degrees(math.atan(APERTURE_TOP_Z / CANOPY_Y)),
        "apertureHalfAngleDownDeg": math.degrees(math.atan(-APERTURE_BOT_Z / CANOPY_Y)),
        "noseTipHalfAngleDownDeg": math.degrees(math.atan(-NOSE_FAR_Z / NOSE_FAR_Y)),
        "frameAreaTanSpace": frame_area,
        "apertureOpenAreaTanSpace": open_area,
        "noseOccludedAreaTanSpace": nose_area,
        "screensOccludedAreaTanSpace": screens_area,
        "predictedOcclusionFraction": occlusion,
        "predictedOcclusionByFrame": 1.0 - open_area / frame_area,
        "predictedOcclusionByNose": nose_area / frame_area,
        "predictedOcclusionByScreens": screens_area / frame_area,
        "borderFullyCoveredByFlaredRing": border_covered,
        "screenForwardOfCanopyPlane": forward_overshoot,
        "screenOutsidePillarInnerFace": pillar_overshoot,
        "screenOutsideGameFrame": max(0.0, screen_outside_game_frame),
        "screenAreaDetail": screen_detail,
    }


# =============================================================================
# Blender scene assembly
# =============================================================================

def purge_scene():
    """Start from a genuinely empty scene, deterministically and without touching prefs.

    Deliberately NOT bpy.ops.wm.read_factory_settings(): that resets user preferences,
    which is a rude thing to do to someone's Blender install from a build script. Removing
    every datablock by hand is order-independent in effect and just as clean.
    """
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    for cam in list(bpy.data.cameras):
        bpy.data.cameras.remove(cam)
    for light in list(bpy.data.lights):
        bpy.data.lights.remove(light)

    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0


def make_material(name, rgb, roughness, metallic=0.0, double_sided=False):
    """Create a Principled material.

    double_sided maps straight onto glTF's `doubleSided` (the exporter writes
    `doubleSided = not use_backface_culling`), and it is set EXPLICITLY on every material
    rather than left to Blender's default, because the default is not the same answer for
    every mesh here:

        Cockpit_Frame / Hull_Nose  closed solids -- single-sided is correct and cheaper;
                                   you never legitimately see their back faces.
        Screen_*                   single quads. Single-sided would make all four vanish
                                   the moment the lab's orbit camera swings behind them,
                                   which reads as "the screens are missing", not as a
                                   deliberate culling choice.
    """
    mat = bpy.data.materials.new(name)
    if mat.name != name:
        raise RuntimeError("material name collision: got %r, wanted %r" % (mat.name, name))
    mat.use_nodes = True
    if hasattr(mat, "use_backface_culling"):
        mat.use_backface_culling = not double_sided
    else:  # pragma: no cover - only on a Blender that renamed the flag
        print("  NOTE: this Blender has no material.use_backface_culling; %s may export "
              "with the wrong doubleSided flag" % name)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is None:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                bsdf = node
                break
    if bsdf is not None:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    mat.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    mat.roughness = roughness
    mat.metallic = metallic
    return mat


def make_mesh_object(name, verts, faces, material):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata([tuple(float(c) for c in v) for v in verts], [], [tuple(f) for f in faces])
    if mesh.validate(verbose=False):
        print("  WARNING: mesh.validate() altered %s -- check the vertex/face lists" % name)
    mesh.update()
    if hasattr(mesh, "shade_flat"):
        mesh.shade_flat()
    else:
        for poly in mesh.polygons:
            poly.use_smooth = False
    mesh.materials.append(material)

    obj = bpy.data.objects.new(name, mesh)
    if obj.name != name:
        raise RuntimeError("object name collision: got %r, wanted %r" % (obj.name, name))
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)     # AC-METRIC: no scale normalisation anywhere
    bpy.context.scene.collection.objects.link(obj)
    return obj


def make_eye_point():
    """The pilot's eye as an empty at the world origin, so AC-METRIC has something to read."""
    empty = bpy.data.objects.new(NAME_EYE, None)
    empty.empty_display_type = 'PLAIN_AXES'
    empty.empty_display_size = 0.1
    empty.location = (0.0, 0.0, 0.0)
    empty.rotation_euler = (0.0, 0.0, 0.0)
    empty.scale = (1.0, 1.0, 1.0)
    bpy.context.scene.collection.objects.link(empty)
    return empty


def export_glb(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    wanted = {
        "filepath": path,
        "export_format": 'GLB',
        "use_selection": False,
        "export_apply": True,
        "export_yup": True,          # Blender (x, y, z) -> glTF (x, z, -y)
        "export_normals": True,
        "export_materials": 'EXPORT',
        "export_cameras": False,
        "export_lights": False,
        "export_extras": False,
        "export_animations": False,
        "export_skins": False,
        "export_morph": False,
        "export_tangents": False,
    }
    # Blender's exporter has churned its operator properties across versions; filter against
    # the live RNA so a renamed flag degrades to a printed note instead of a TypeError.
    valid = set()
    try:
        valid = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    except Exception as exc:  # noqa: BLE001 - diagnostics only
        print("  NOTE: could not introspect exporter properties (%s); passing all kwargs" % exc)
    if valid:
        dropped = sorted(k for k in wanted if k not in valid)
        if dropped:
            print("  NOTE: exporter does not accept %s -- dropped" % ", ".join(dropped))
        wanted = {k: v for k, v in wanted.items() if k in valid}
    bpy.ops.export_scene.gltf(**wanted)
    return path


# =============================================================================
# Metrics sidecar
# =============================================================================

def build_metrics(parts, analysis):
    """Everything the headless tests assert on, expressed in glTF axes.

    Written by the same run that writes the GLB, and computed from the same vertex lists,
    so AC-FORM / AC-METRIC compare the GLB against SCRIPT-DECLARED values rather than
    against magic numbers copied into a test file.
    """
    all_pts_gltf = []
    objects = []
    for part in parts:
        pts = [to_gltf(v) for v in part["verts"]]
        all_pts_gltf.extend(pts)
        lo, hi = bbox_of(pts)
        objects.append({
            "name": part["name"],
            "material": part["material"],
            "vertexCount": len(part["verts"]),
            "faceCount": len(part["faces"]),
            "boundingBox": {"min": r6v(lo), "max": r6v(hi)},
        })
    scene_lo, scene_hi = bbox_of(all_pts_gltf)

    # NOTE on what is NOT here: an "is the normal pointing at the eye?" angle. Computing one
    # from this dict's own centre and normal would be 0.0 by construction -- both come from
    # the same build_screen() call -- so it could never catch a misaligned screen and would
    # only look like a check. AC-FORM's real measurement is made from the EXPORTED GLB's
    # triangles by tests/cockpit-geometry.test.js, against the centre and normal below.
    # What IS reported is the tilt off the pillar face, which is genuinely non-zero and is
    # what forces the derived standoff.
    screens = []
    for part in parts:
        if part["centre"] is None:
            continue
        c = to_gltf(part["centre"])
        n = to_gltf(part["normal"])
        face_n = bevel_face(part["name"])["normal"]
        cos_tilt = max(-1.0, min(1.0, v_dot(part["normal"], face_n)))
        screens.append({
            "name": part["name"],
            "centre": r6v(c),
            "normal": r6v(n),
            "width": SCREEN_W,
            "height": SCREEN_H,
            "mountDepth": r6(SCREEN_MOUNT_DEPTH),
            "standoffFromMountFace": r6(part["standoff"]),
            "tiltOffMountFaceDeg": r6(math.degrees(math.acos(cos_tilt))),
        })

    nose_len = NOSE_FAR_Y - NOSE_NEAR_Y
    nose_slope = math.hypot(nose_len, NOSE_FAR_Z - NOSE_NEAR_Z)

    return {
        "schemaVersion": 1,
        "generatedBy": "scripts/cockpit-gen.py",
        "workstream": "cockpit-lab-geometry-2026-07-28",
        "units": "metres",
        "axes": ("glTF / three.js: +X right, +Y up, forward is -Z, eye at the origin. "
                 "Authored in Blender (+X right, +Y forward, +Z up) and converted by "
                 "export_yup=True, which maps Blender (x, y, z) -> glTF (x, z, -y)."),
        "scaleNormalisation": "none - every node is identity, 1 unit = 1 metre",
        "eyePoint": [0.0, 0.0, 0.0],
        "eyePointNodeName": NAME_EYE,

        "constants": {
            "HULL_REF_LENGTH": HULL_REF_LENGTH,
            "CANOPY_Y": CANOPY_Y,
            "APERTURE_HALF_W": APERTURE_HALF_W,
            "APERTURE_TOP_Z": APERTURE_TOP_Z,
            "APERTURE_BOT_Z": APERTURE_BOT_Z,
            "BEVEL_X": BEVEL_X,
            "BEVEL_Z": BEVEL_Z,
            "FRAME_DEPTH": FRAME_DEPTH,
            "FRAME_FLARE": FRAME_FLARE,
            "FRAME_WALL": FRAME_WALL,
            "SCREEN_W": SCREEN_W,
            "SCREEN_H": SCREEN_H,
            "SCREEN_MOUNT_DEPTH": SCREEN_MOUNT_DEPTH,
            "SCREEN_MARGIN": SCREEN_MARGIN,
            "NOSE_NEAR_Y": NOSE_NEAR_Y,
            "NOSE_NEAR_Z": NOSE_NEAR_Z,
            "NOSE_FAR_Y": NOSE_FAR_Y,
            "NOSE_FAR_Z": NOSE_FAR_Z,
            "NOSE_HALF_W_NEAR": NOSE_HALF_W_NEAR,
            "NOSE_HALF_W_FAR": NOSE_HALF_W_FAR,
            "NOSE_THICKNESS": NOSE_THICKNESS,
            "GAME_FOV_DEG": GAME_FOV_DEG,
            "GAME_ASPECT": r6(GAME_ASPECT),
        },

        "hullReferenceLength": HULL_REF_LENGTH,
        "noseVisibleLength": r6(nose_len),
        "noseFractionOfHull": r6(nose_len / HULL_REF_LENGTH),
        "noseSlopeLength": r6(nose_slope),
        "noseTipDistanceFromEye": r6(NOSE_FAR_Y),
        "noseTipFractionOfHull": r6(NOSE_FAR_Y / HULL_REF_LENGTH),
        "noseDropFromLip": r6(NOSE_NEAR_Z - NOSE_FAR_Z),

        "apertureWidth": r6(2.0 * APERTURE_HALF_W),
        "apertureHeight": r6(APERTURE_TOP_Z - APERTURE_BOT_Z),
        "apertureHalfAnglesDeg": {
            "leftRight": r6(analysis["apertureHalfAngleLeftRightDeg"]),
            "up": r6(analysis["apertureHalfAngleUpDeg"]),
            "down": r6(analysis["apertureHalfAngleDownDeg"]),
        },

        "sceneBoundingBox": {"min": r6v(scene_lo), "max": r6v(scene_hi)},
        "objects": objects,
        "screens": screens,

        "predictedOcclusionFraction": r6(analysis["predictedOcclusionFraction"]),
        "predictedOcclusionNote": ("Analytic estimate at GAME_FOV_DEG / GAME_ASPECT from the "
                                   "authored polygons. AC-FRAME's browser measurement is "
                                   "authoritative; this exists so proportions can be tuned "
                                   "without a render round-trip."),

        "diagnostics": {
            "predictedOcclusionByFrame": r6(analysis["predictedOcclusionByFrame"]),
            "predictedOcclusionByNose": r6(analysis["predictedOcclusionByNose"]),
            "predictedOcclusionByScreens": r6(analysis["predictedOcclusionByScreens"]),
            "frameHalfAngleHorizontalDeg": r6(analysis["halfAngleHorizontalDeg"]),
            "frameHalfAngleVerticalDeg": r6(analysis["halfAngleVerticalDeg"]),
            "noseTipHalfAngleDownDeg": r6(analysis["noseTipHalfAngleDownDeg"]),
            "borderFullyCoveredByFlaredRing": analysis["borderFullyCoveredByFlaredRing"],
            "screenForwardOfCanopyPlane": r6(analysis["screenForwardOfCanopyPlane"]),
            "screenOutsidePillarInnerFace": r6(analysis["screenOutsidePillarInnerFace"]),
            "screenOutsideGameFrame": r6(analysis["screenOutsideGameFrame"]),
            "screenDetail": [
                {
                    "name": d["name"],
                    "standoff": r6(d["standoff"]),
                    "visibleFraction": r6(d["visibleFraction"]),
                    "overWindowFraction": r6(d["overWindowFraction"]),
                }
                for d in analysis["screenAreaDetail"]
            ],
        },
    }


# =============================================================================
# Entry point
# =============================================================================

def parse_args(argv):
    tail = argv[argv.index("--") + 1:] if "--" in argv else []
    out = None
    metrics = None
    i = 0
    while i < len(tail):
        a = tail[i]
        if a == "--out" and i + 1 < len(tail):
            out = tail[i + 1]
            i += 2
        elif a.startswith("--out="):
            out = a[len("--out="):]
            i += 1
        elif a == "--metrics" and i + 1 < len(tail):
            metrics = tail[i + 1]
            i += 2
        elif a.startswith("--metrics="):
            metrics = a[len("--metrics="):]
            i += 1
        else:
            i += 1
    return out, metrics


def default_paths():
    """Repo-relative fallback so the script also works when run with no arguments."""
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    outdir = os.path.join(repo, "public", "assets", "cockpit")
    return os.path.join(outdir, "cockpit.glb"), os.path.join(outdir, "cockpit-metrics.json")


def print_summary(metrics, analysis, glb_path, metrics_path):
    print("")
    print("=" * 78)
    print("WELL DIPPER -- HELM cockpit, increment 1 geometry")
    print("=" * 78)
    print("  GLB     : %s" % glb_path)
    print("  metrics : %s" % metrics_path)
    print("")
    print("  Objects (bounding boxes in glTF axes: +X right, +Y up, forward -Z, metres)")
    print("    %-16s %5s %5s  %-26s %-26s" % ("name", "verts", "faces", "bbox min", "bbox max"))
    print("    %-16s %5s %5s  %-26s %-26s" % (NAME_EYE, "-", "-",
                                              "(empty at the origin)", ""))
    for o in metrics["objects"]:
        lo = "[%7.3f %7.3f %7.3f]" % tuple(o["boundingBox"]["min"])
        hi = "[%7.3f %7.3f %7.3f]" % tuple(o["boundingBox"]["max"])
        print("    %-16s %5d %5d  %-26s %-26s" % (o["name"], o["vertexCount"],
                                                  o["faceCount"], lo, hi))
    sb = metrics["sceneBoundingBox"]
    print("    %-16s %5s %5s  [%7.3f %7.3f %7.3f] [%7.3f %7.3f %7.3f]"
          % ("SCENE", "", "", sb["min"][0], sb["min"][1], sb["min"][2],
             sb["max"][0], sb["max"][1], sb["max"][2]))
    print("")
    print("  Aperture from the eye  : %.2f deg left/right, %.2f deg up, %.2f deg down"
          % (analysis["apertureHalfAngleLeftRightDeg"],
             analysis["apertureHalfAngleUpDeg"],
             analysis["apertureHalfAngleDownDeg"]))
    print("  Game frame half-angles : %.2f deg horizontal, %.2f deg vertical  (fov %.0f, %.4f aspect)"
          % (analysis["halfAngleHorizontalDeg"], analysis["halfAngleVerticalDeg"],
             GAME_FOV_DEG, GAME_ASPECT))
    print("  Nose tip               : %.2f deg below the horizon, %.2f m forward of the eye"
          % (analysis["noseTipHalfAngleDownDeg"], NOSE_FAR_Y))
    print("  Nose section           : %.2f m long = %.1f%% of the %.0f m reference hull"
          % (metrics["noseVisibleLength"], 100.0 * metrics["noseFractionOfHull"],
             HULL_REF_LENGTH))
    print("")
    print("  AC-FRAME prediction (analytic; the browser measurement is authoritative)")
    print("    frame occludes  : %6.2f %%" % (100.0 * analysis["predictedOcclusionByFrame"]))
    print("    nose occludes   : %6.2f %%" % (100.0 * analysis["predictedOcclusionByNose"]))
    print("    screens occlude : %6.2f %%" % (100.0 * analysis["predictedOcclusionByScreens"]))
    total = 100.0 * analysis["predictedOcclusionFraction"]
    verdict = "IN BAND" if 25.0 <= total <= 30.0 else "OUT OF BAND (target 25-30 %)"
    print("    TOTAL           : %6.2f %%   <- %s" % (total, verdict))
    print("")
    print("  Screens (mounted on the pillar bevel faces; standoff is DERIVED, not authored)")
    print("    %-12s %9s %9s %9s %9s" % ("name", "standoff", "tilt deg", "visible", "in window"))
    detail = {d["name"]: d for d in analysis["screenAreaDetail"]}
    for s in metrics["screens"]:
        d = detail[s["name"]]
        print("    %-12s %8.4fm %8.2f  %8.1f%% %8.1f%%"
              % (s["name"], s["standoffFromMountFace"], s["tiltOffMountFaceDeg"],
                 100.0 * d["visibleFraction"], 100.0 * d["overWindowFraction"]))
    print("    (normal-at-the-eye is exact by construction; AC-FORM re-measures it from the")
    print("     exported GLB in tests/cockpit-geometry.test.js, which is where it can fail)")
    print("")
    print("  Checks")
    print("    flared ring covers the border: %s"
          % ("yes" if analysis["borderFullyCoveredByFlaredRing"] else "NO - gap at a frame corner"))
    fo = analysis["screenForwardOfCanopyPlane"]
    print("    screen forward of canopy plane: %.4f m %s"
          % (fo, "" if fo <= 0.0 else "<- MUST be 0; the derived standoff is not clearing the plane"))
    po = analysis["screenOutsidePillarInnerFace"]
    print("    screen outside pillar face   : %.4f m %s"
          % (po, "" if po <= 0.0 else "<- MUST be 0; the panel is buried in the frame solid"))
    og = analysis["screenOutsideGameFrame"]
    min_vis = min(d["visibleFraction"] for d in analysis["screenAreaDetail"])
    print("    screen outside the 70 deg frame: %.4f tan (least-visible screen is %.0f%% in frame)%s"
          % (og, 100.0 * min_vis,
             "" if min_vis >= 0.85 else "  <- too much falls off-screen to read"))
    print("=" * 78)
    print("")


def main():
    if bpy is None:
        sys.stderr.write("cockpit-gen.py must be run inside Blender:\n"
                         "  blender --background --factory-startup --python "
                         "scripts/cockpit-gen.py -- --out <glb> --metrics <json>\n")
        return 1

    glb_path, metrics_path = parse_args(list(sys.argv))
    d_glb, d_metrics = default_paths()
    glb_path = glb_path or d_glb
    metrics_path = metrics_path or d_metrics

    purge_scene()

    mats = {
        "Mat_Frame": make_material("Mat_Frame", MAT_FRAME_RGB, roughness=0.55,
                                   double_sided=False),
        "Mat_Screen": make_material("Mat_Screen", MAT_SCREEN_RGB, roughness=0.28,
                                    double_sided=True),
        "Mat_Hull": make_material("Mat_Hull", MAT_HULL_RGB, roughness=0.62,
                                  double_sided=False),
    }

    make_eye_point()
    parts = build_all()
    for part in parts:
        make_mesh_object(part["name"], part["verts"], part["faces"], mats[part["material"]])

    analysis = analyse()
    metrics = build_metrics(parts, analysis)

    export_glb(glb_path)

    os.makedirs(os.path.dirname(os.path.abspath(metrics_path)) or ".", exist_ok=True)
    with open(metrics_path, "w") as fh:
        json.dump(metrics, fh, indent=2)
        fh.write("\n")

    print_summary(metrics, analysis, glb_path, metrics_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

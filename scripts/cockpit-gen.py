#!/usr/bin/env python3
"""
cockpit-gen.py -- HELM cockpit interior geometry (increment 1, lab-only).

WHAT THIS BUILDS
    An angular, faceted cockpit authored entirely from named constants and exported as a
    single GLB, plus a JSON metrics sidecar that declares -- in glTF axes -- exactly what
    the GLB should contain. Objects:

        Eye_Point          an empty at the world origin: the pilot's eye.
        Canopy_Glass       a FACETED SHELL that spans the view opening and PROTRUDES
                           FORWARD: its rim is a planar rectangle at CANOPY_Y_EDGE and its
                           centre is pushed CANOPY_BULGE metres further forward, so the
                           surface bows away from the pilot. Its facet layout puts two
                           symmetric VERTICAL RIDGES at +/-CANOPY_RIB_X -- the fold where
                           the flat centre panel meets the raked quarter panels -- and those
                           ridges are what the ribs sit on. Placeholder material; increment 3
                           makes it real glass. EXCLUDED from the occlusion measurement
                           because it is see-through by design.
        Canopy_Rib_L/_R    the two vertical strips. Thin solid straps swept along the
                           shell's ridges from the bottom rim, up over the bulge, to the top
                           rim. They are the ONLY frame structure in the cockpit -- there is
                           no octagonal ring. Because the ridge protrudes, each rib bows
                           INWARD on screen as it crosses the bulge, and that bow is the cue
                           that reads as "the canopy sticks out in front of me".
        Screen_UL/UR/LL/LR the DISPLAY FACE of each screen unit: one flat quad, SCREEN_W x
                           SCREEN_H, normal pointing exactly at the eye by construction.
                           Kept as its own node because increment 2's phosphor CRT shader
                           targets it and AC-FORM measures its normal.
        ScreenBody_UL/...  the BOX around each display face: a closed solid with a
                           SCREEN_BEZEL-wide bezel around a pocket, SCREEN_BODY_DEPTH of
                           backing behind it, and the display face recessed
                           SCREEN_FACE_RECESS behind the bezel plane so the bezel reads as a
                           bezel rather than as a painted border.
        Arm_UL/UR/LL/LR    one tapered angular strut per screen, running from a root that is
                           provably OUTSIDE the 70 deg / 16:9 view frustum to the back of its
                           box, so the arms read as monitor arms reaching in from beyond the
                           player's field of view and disappearing out of frame.

    There is NO ship nose and no octagonal canopy frame. Both were in the previous revision
    (commit 1056f30) and Max deleted them at UAT. If a node named Hull_Nose or Cockpit_Frame
    reappears anywhere, that is an AC-FORM failure, not a merge artefact.

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

    The script also prints an ANALYTIC MEASUREMENT of the occlusion fraction -- what share of
    a 70 deg / 16:9 frame the cockpit covers -- so proportions can be tuned without a browser
    round-trip. The browser measurement remains authoritative; this is a fast guide that uses
    the same method (a scanline rasterisation of the projected silhouettes).

OCCLUSION IS MEASURED, NOT TARGETED
    The previous revision aimed at a [0.25, 0.30] band. That band was derived from a design
    Max has since replaced, so AC-FRAME is now measure-and-report: build the form Max asked
    for, then say what it measures. Do NOT pad or shrink geometry to hit a number. The
    predictor reports ribs / screens+bodies / arms separately, and Canopy_Glass is EXCLUDED
    from every total because the pilot sees through it.

    Because the occluders overlap in projection (an arm hides behind its own screen box), the
    breakdown is reported two ways: each category's OWN silhouette area, and its MARGINAL
    contribution in the fixed order ribs -> screens -> arms. Only the marginal numbers sum to
    the total; the "own" numbers say how big each category is in isolation.

ASSUMPTIONS the spec did not pin down
    RIB_WIDTH / RIB_DEPTH   Max said "fairly thin". 0.065 m across and 0.050 m deep is a
                            structural canopy rail at this scale; it is a named constant
                            precisely because it is a judgement call.
    RIB_GLASS_GAP           The rib's outer face would otherwise be coplanar with the shell
                            and z-fight against it, so the whole strap is held 2 mm inboard
                            of the surface it follows.
    Rib cross-section axis  A rib on a crease has no single "surface tangent" to lie in. The
                            cross-section is therefore built face-on to the pilot -- its
                            width axis is perpendicular to both the rib's own direction and
                            the eye ray -- which is what gives it a stable apparent width all
                            the way along.
    SCREEN_FACE_GAP         The body is a CLOSED solid, so its pocket has a floor. The
                            display face sits 1.5 mm in front of that floor rather than on
                            it, so the two never z-fight.
    ARM_ATTACH_U / _W       Where on the back plate the arm lands. Dead centre would bury the
                            whole strut behind its own box; landing it toward the outboard-far
                            corner keeps a readable length of arm visible between the box edge
                            and the frame edge.
    ARM_ROOT_*              The root has to be somewhere, and increment 1 has no cabin walls
                            for it to be somewhere ON. It is placed by TAN COORDINATES times a
                            depth, so "outside the frustum" is expressed directly in the units
                            the assertion checks.

TUNING NOTES (all measured by this script's own predictor -- run it under plain python3 to
re-measure; the bpy import is guarded so analyse() works with no Blender)
    Levers, at the shipped operating point:
      * SCREEN_DIST is the master occlusion lever. The screen boxes dominate the total, and
        their tan-space footprint falls as 1/SCREEN_DIST^2. It is deliberately held at 1.60 m,
        which is where the previous revision's panels sat (1.60 m upper, 1.65 m lower), so
        that Max's "50% bigger" buys a bigger ANGULAR size rather than just a bigger number
        in metres that reads the same on screen. Being precise about how much bigger: the
        display face is 1.5x per dimension at the same distance, but it also sits less
        off-axis than before (tan 0.74 vs 1.05), and off-axis positions are stretched in
        tan-space. Net, the display face covers 1.37x the frame area it used to, and the
        whole unit with its bezel covers 1.86x. "50% bigger" is honoured in metres exactly
        and in apparent size approximately.
      * SCREEN_TAN_X / SCREEN_TAN_Z_UP / SCREEN_TAN_Z_DOWN place the boxes in the frame. They
        trade two things off: pushed out, the boxes clear the centre of the view but start
        falling off the edge of the 70 deg frame (the previous revision's failure mode);
        pulled in, they are fully visible but crowd the windscreen. The run prints each
        display face's visible fraction -- keep it at 1.000.
      * The gap between a box's outboard edge and the frame edge is the ONLY place its arm can
        be seen. Pushing the screens outboard closes that gap and the arms vanish. The run
        prints each arm's visible tan-space run for exactly this reason.
      * CANOPY_RIB_X sets how wide the clear central windscreen is and how far the ribs bow.
        Moving the ribs inboard makes the bow more visible but narrows the clear centre.
      * CANOPY_BULGE is the whole "protruding shape" cue. At zero the ribs are straight lines
        and the canopy reads as a flat pane. The run prints the bow in degrees.

SCOPE -- what this increment deliberately does NOT do
    No CRT/phosphor shader (increment 2). No real glass or refraction (increment 3) -- the
    Canopy_Glass material here is an alpha-blended placeholder so the lab can see through it.
    No head/hull decoupling, no 5th render pass, no HELM gating (increment 4). No screen data
    (increment 5). No file under src/ is touched by this workstream at all (AC-NOGAME).

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

INCH               = 0.0254   # metres. Max specified the bezel and the backing in inches,
                              # so they are derived from this rather than written as decimals.
HULL_REF_LENGTH    = 20.0     # Bible S8A player hull, house-sized. Sanity scale for the cabin.

# ---- Canopy shell (Canopy_Glass) -------------------------------------------
CANOPY_Y_EDGE      = 1.70     # +Y of the shell's RIM -- its rearmost ring, a planar rectangle
CANOPY_BULGE       = 0.60     # extra +Y at the centre. THIS is the forward protrusion.
CANOPY_HALF_W      = 2.35     # rim half-width  (+/-X)
CANOPY_TOP_Z       = 1.38     # rim top
CANOPY_BOT_Z       = -1.54    # rim bottom
CANOPY_RIB_X       = 1.38     # |X| of the two vertical RIDGES. The centre panel is flat in X
                              # out to here; outboard of it the shell rakes back. That change
                              # of slope IS the ridge, and the ribs sit on it.
CANOPY_SHOULDER_X  = 1.82     # a second, shallower fold outboard of the ridge: extra faceting
CANOPY_SHOULDER_F  = 0.45     # so the quarter panels read angular rather than as a single
                              # flat rake. No rib sits here.

# Column profile: (x, bulge fraction). Symmetric, ordered left -> right. The bulge fraction
# is 1.0 across the whole centre panel, which is what makes +/-CANOPY_RIB_X the sharpest
# crease in the surface (slope steps from 0 straight to the quarter-panel rake).
CANOPY_COLUMNS = (
    (-CANOPY_HALF_W,     0.00),
    (-CANOPY_SHOULDER_X, CANOPY_SHOULDER_F),
    (-CANOPY_RIB_X,      1.00),
    ( CANOPY_RIB_X,      1.00),
    ( CANOPY_SHOULDER_X, CANOPY_SHOULDER_F),
    ( CANOPY_HALF_W,     0.00),
)
CANOPY_RIB_COLUMNS = (2, 3)   # indices into CANOPY_COLUMNS; asserted against +/-CANOPY_RIB_X

# Row profile: (z, bulge fraction). Ordered bottom -> top. The peak sits just below eye level,
# like the widest point of a real canopy, and the fractions fall to 0 at both rims so the rim
# is planar and the ribs run off the top and bottom of the 70 deg frame instead of stopping
# visibly inside it.
CANOPY_ROWS = (
    (CANOPY_BOT_Z, 0.00),
    (-0.82,        0.62),
    (-0.10,        1.00),
    ( 0.62,        0.70),
    (CANOPY_TOP_Z, 0.00),
)

# ---- Canopy ribs (Canopy_Rib_L / Canopy_Rib_R) -----------------------------
RIB_WIDTH          = 0.065    # across the strap. "Fairly thin" is the brief.
RIB_DEPTH          = 0.050    # how far the strap stands inboard of the glass, toward the eye
RIB_GLASS_GAP      = 0.002    # air held between the strap's outer face and the shell surface.
                              # HOW FAR the strap must stand off to hold that gap everywhere
                              # is derived per station, not authored -- see rib_sections().
RIB_SOLVE_MAX_ITERS = 64
RIB_SOLVE_TOL      = 1e-12

# ---- Screen units (Screen_* display face + ScreenBody_* box) ---------------
SCREEN_W           = 0.45     # display face, 50% larger than the previous 0.30 x 0.20 m panel
SCREEN_H           = 0.30
SCREEN_BEZEL       = 1.0 * INCH   # bezel all round the display face  -> body 0.5008 x 0.3508
SCREEN_BODY_DEPTH  = 2.0 * INCH   # backing depth behind the bezel plane
SCREEN_FACE_RECESS = 0.004    # display face sits this far BEHIND the bezel plane
SCREEN_FACE_GAP    = 0.0015   # and this far in FRONT of the pocket floor, so neither z-fights
SCREEN_DIST        = 1.60     # eye -> display-face centre. Held at the previous revision's
                              # screen distance on purpose: see TUNING NOTES.
SCREEN_TAN_X       = 0.74     # where the display-face centres sit in tan-space...
SCREEN_TAN_Z_UP    = 0.35     # ...upper pair
SCREEN_TAN_Z_DOWN  = -0.37    # ...lower pair (a little lower: that is where instruments live)

# (suffix, tan x, tan z). Left/right are the PILOT's: left is -X, up is +Z.
SCREEN_QUADRANTS = (
    ("UL", -SCREEN_TAN_X, SCREEN_TAN_Z_UP),
    ("UR",  SCREEN_TAN_X, SCREEN_TAN_Z_UP),
    ("LL", -SCREEN_TAN_X, SCREEN_TAN_Z_DOWN),
    ("LR",  SCREEN_TAN_X, SCREEN_TAN_Z_DOWN),
)

# ---- Support arms (Arm_*) --------------------------------------------------
ARM_ROOT_Y         = 0.95     # depth of the root plane, forward of the eye. Deep enough that
                              # the WHOLE arm sits further from the eye than its screen's front
                              # face -- a shallower root swings the strut around in front of
                              # its own bezel, which reads as a bug rather than as a mount.
                              # arm_in_front_of_box() below is the check that catches it.
ARM_ROOT_TAN_X     = 1.55     # root position expressed in TAN COORDINATES at that depth, so
ARM_ROOT_TAN_Z     = 0.92     # "outside the frustum" is stated in the units it is checked in
                              # (the 70 deg / 16:9 frame is tan 1.2448 x 0.7002). Clearance
                              # from the frustum grows with ARM_ROOT_Y at fixed tangents, so
                              # pushing the root deeper helps both properties at once.
ARM_ROOT_CLEARANCE_MIN = 0.05  # metres the root must clear the nearest frustum side plane by
ARM_ATTACH_U       = 0.65     # where the arm lands on the back plate, as a fraction of its
ARM_ATTACH_W       = 0.55     # half-extents, toward the OUTBOARD-FAR corner
ARM_EMBED          = 0.010    # tip pushed this far into the box, so there is no seam gap
ARM_ROOT_HALF_U    = 0.035    # tapered rectangular strut: half-extents at the root...
ARM_ROOT_HALF_W    = 0.045
ARM_TIP_HALF_U     = 0.020    # ...and at the tip
ARM_TIP_HALF_W     = 0.026

# The cockpit is judged against the game's real camera (src/ui/Settings.js:40).
GAME_FOV_DEG       = 70.0     # vertical FOV
GAME_ASPECT        = 16.0 / 9.0

# Occlusion predictor. A scanline rasterisation of the projected silhouettes, which is the
# same operation the browser's pixel readback performs -- so analytic and measured should
# agree closely rather than merely correlate.
OCC_SCANLINES      = 2160     # rows across the frame's vertical extent
OCC_NEAR_Y         = 0.05     # occluders are clipped to y >= this before projecting; a point
                              # at or behind the eye plane has no image to measure

BLENDER_UP         = (0.0, 0.0, 1.0)

# Material base colours, linear RGB.
MAT_FRAME_RGB      = (0.055, 0.058, 0.062)   # ribs: dark structural grey
MAT_SCREEN_RGB     = (0.010, 0.012, 0.011)   # display faces (increment 2 replaces this)
MAT_BODY_RGB       = (0.085, 0.087, 0.092)   # screen boxes: a shade lighter, so the bezel reads
MAT_ARM_RGB        = (0.042, 0.043, 0.047)   # arms: darker, semi-metallic
MAT_GLASS_RGB      = (0.030, 0.045, 0.055)   # canopy shell placeholder
MAT_GLASS_ALPHA    = 0.12     # so the lab can see THROUGH the shell. Increment 3 replaces the
                              # whole material with real transmissive glass.

# Node names. The headless tests key off these -- do not rename without updating the tests.
NAME_EYE           = "Eye_Point"
NAME_GLASS         = "Canopy_Glass"
NAME_RIBS          = ("Canopy_Rib_L", "Canopy_Rib_R")   # order matches CANOPY_RIB_COLUMNS
SCREEN_PREFIX      = "Screen_"
BODY_PREFIX        = "ScreenBody_"
ARM_PREFIX         = "Arm_"


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


def convex_hull_2d(points):
    """Andrew's monotone chain, returning a counter-clockwise hull.

    Deduplication walks a LIST rather than building a set: iterating a set would be an
    unordered traversal, which is exactly the class of thing AC-REPRO forbids. The point
    counts here are tiny (<= 16), so the quadratic dedupe costs nothing.
    """
    uniq = []
    for p in points:
        if p not in uniq:
            uniq.append(p)
    pts = sorted(uniq)
    if len(pts) < 3:
        return pts

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cr(lower[-2], lower[-1], p) <= 0.0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cr(upper[-2], upper[-1], p) <= 0.0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def edges_of(faces):
    """Unique undirected edges of a face list, in first-seen order (deterministic)."""
    seen = {}
    order = []
    for f in faces:
        n = len(f)
        for i in range(n):
            a = f[i]
            b = f[(i + 1) % n]
            key = (a, b) if a < b else (b, a)
            if key not in seen:
                seen[key] = True
                order.append(key)
    return order


# =============================================================================
# Geometry authoring -- pure data (name, verts, faces). No bpy in this section,
# so the metrics sidecar and the exported mesh are computed from the SAME lists.
# =============================================================================

def _check_rib_columns():
    """The ribs must sit on the shell's ridges, not near them."""
    want = (-CANOPY_RIB_X, CANOPY_RIB_X)
    for k, idx in enumerate(CANOPY_RIB_COLUMNS):
        if CANOPY_COLUMNS[idx][0] != want[k]:
            raise ValueError(
                "CANOPY_RIB_COLUMNS[%d] = %d points at x = %.4f, but CANOPY_RIB_X says the "
                "ridge is at %.4f. The ribs would float off the crease. Fix CANOPY_COLUMNS "
                "or CANOPY_RIB_COLUMNS." % (k, idx, CANOPY_COLUMNS[idx][0], want[k]))
        if CANOPY_COLUMNS[idx][1] != 1.00:
            raise ValueError(
                "CANOPY_RIB_COLUMNS[%d] = %d has bulge fraction %.3f, not 1.0. The ridge is "
                "defined as the crest of the shell; a rib elsewhere is not on a crease."
                % (k, idx, CANOPY_COLUMNS[idx][1]))


def _profile(table, t):
    """Piecewise-linear interpolation of a (coordinate, fraction) table, clamped at the ends."""
    if t <= table[0][0]:
        return table[0][1]
    if t >= table[-1][0]:
        return table[-1][1]
    for i in range(len(table) - 1):
        a = table[i]
        b = table[i + 1]
        if a[0] <= t <= b[0]:
            if b[0] == a[0]:
                return a[1]
            return a[1] + (t - a[0]) / (b[0] - a[0]) * (b[1] - a[1])
    return table[-1][1]


def canopy_y(x, z):
    """Where a shell VERTEX goes: y = Y_EDGE + BULGE * fx(x) * fz(z).

    This is the ideal surface, and it is what places the grid points. It is NOT what gets
    exported between them -- see canopy_surface_y() -- and the difference is load-bearing.

    Both profiles clamp outside the rim, which makes the function conservative there (it
    reports glass where the shell has already ended) -- the safe direction for a clearance.
    """
    return CANOPY_Y_EDGE + CANOPY_BULGE * _profile(CANOPY_COLUMNS, x) * _profile(CANOPY_ROWS, z)


def _cell_index(table, t):
    """Index i such that table[i][0] <= t <= table[i+1][0], clamped to the ends."""
    n = len(table)
    if t <= table[0][0]:
        return 0
    if t >= table[n - 1][0]:
        return n - 2
    for i in range(n - 1):
        if table[i][0] <= t <= table[i + 1][0]:
            return i
    return n - 2


def canopy_surface_y(x, z):
    """Where the EXPORTED shell actually is at (x, z): the triangulated surface.

    y = Y_EDGE + BULGE*fx*fz is bilinear on each cell, and a bilinear patch with non-zero
    twist is NOT planar -- these twist by up to 0.125 m. A non-planar quad has to be split
    into triangles somewhere, and the resulting surface cuts up to |twist|/4 BELOW the ideal
    one, i.e. toward the pilot. Under the ribs' footprint that reaches 7.0 mm, against a
    RIB_GLASS_GAP of 2.0 mm -- so a clearance solved against the ideal surface is not
    automatically a clearance against the shipped one.

    So the canopy is emitted as explicit TRIANGLES (build_canopy) rather than as quads the
    exporter would split by its own rule, and this function evaluates exactly those triangles.
    The split runs along the a->c diagonal of each cell, which in local (u, v) is the line
    u == v: v >= u is the (a, b, c) triangle, v <= u is the (a, c, d) triangle. On a cell
    boundary and at every grid corner this agrees with canopy_y() exactly.

    Honest note on what this bought at the SHIPPED constants: nothing yet. The binding
    clearance sits on the ridge line x = +/-CANOPY_RIB_X, which is a cell boundary, where the
    two surfaces coincide -- solving against either gives the same 2.0 mm. That is luck, not
    design: move CANOPY_RIB_X off a column, widen RIB_WIDTH, or add a row and the 7.0 mm
    starts to bite. The point of measuring the shipped surface is that the constants block is
    meant to be re-authored.
    """
    i = _cell_index(CANOPY_COLUMNS, x)
    j = _cell_index(CANOPY_ROWS, z)
    x0, fx0 = CANOPY_COLUMNS[i]
    x1, fx1 = CANOPY_COLUMNS[i + 1]
    z0, fz0 = CANOPY_ROWS[j]
    z1, fz1 = CANOPY_ROWS[j + 1]
    u = 0.0 if x1 == x0 else (x - x0) / (x1 - x0)
    v = 0.0 if z1 == z0 else (z - z0) / (z1 - z0)
    u = 0.0 if u < 0.0 else (1.0 if u > 1.0 else u)
    v = 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)
    y00 = CANOPY_Y_EDGE + CANOPY_BULGE * fx0 * fz0
    y01 = CANOPY_Y_EDGE + CANOPY_BULGE * fx0 * fz1
    y10 = CANOPY_Y_EDGE + CANOPY_BULGE * fx1 * fz0
    y11 = CANOPY_Y_EDGE + CANOPY_BULGE * fx1 * fz1
    if v >= u:
        return y00 + v * (y01 - y00) + u * (y11 - y01)
    return y00 + u * (y10 - y00) + v * (y11 - y10)


def canopy_grid():
    """The shell as a column-major grid of Blender points: grid[column][row].

    Both profiles fall to 0 at the outer column/row, so the whole rim lies in the plane
    y = CANOPY_Y_EDGE and everything inside it is pushed forward -- a shell that protrudes,
    with a planar rectangular mouth.
    """
    _check_rib_columns()
    grid = []
    for (x, _fx) in CANOPY_COLUMNS:
        col = []
        for (z, _fz) in CANOPY_ROWS:
            col.append((x, canopy_y(x, z), z))
        grid.append(col)
    return grid


def build_canopy():
    """Canopy_Glass: the faceted protruding shell. Normals point AWAY from the eye.

    An open surface, not a solid -- it is a windscreen. The material is double-sided so the
    lab's orbit camera sees it from outside too.

    Emitted as TRIANGLES, not quads. Each cell twists (the height field is a product of two
    profiles), so a quad here would be non-planar and Blender would split it by a rule this
    script does not control -- leaving the exported surface subtly different from the one the
    rib clearances were solved against. Splitting it here makes every face planar by
    construction, makes canopy_surface_y() exact, and reads MORE angular under flat shading,
    which is the brief.
    """
    grid = canopy_grid()
    nc = len(CANOPY_COLUMNS)
    nr = len(CANOPY_ROWS)
    verts = []
    for i in range(nc):
        for j in range(nr):
            verts.append(grid[i][j])
    faces = []
    for i in range(nc - 1):
        for j in range(nr - 1):
            a = i * nr + j
            b = i * nr + (j + 1)
            c = (i + 1) * nr + (j + 1)
            d = (i + 1) * nr + j
            faces.append((a, b, c))     # winding gives a +Y-ish normal: away from the eye
            faces.append((a, c, d))     # split on the a->c diagonal; canopy_surface_y matches
    return verts, faces


def rib_sections(col_index):
    """Cross-sections of one rib, one per canopy row, following that column's ridge.

    Frame at each station:
        V  eye -> point (the view ray)
        W  -V, i.e. INBOARD, toward the eye: the direction the strap's depth runs
        T  the rib's own direction along the ridge
        U  perpendicular to both -- the direction the strap's WIDTH is measured in, which is
           also the direction its apparent width is measured in from the seat. A rib laid on
           a crease has no unambiguous surface tangent, so this face-on frame is used instead;
           it keeps the strap the same visual thickness the whole way up.

    U = normalise(W x T) is right-handed with (U, W, T) by construction (Lagrange), which is
    what lets loft() below wind every face outward without a per-face orientation test.

    The strap's STANDOFF from the ridge is DERIVED, not authored. U is perpendicular to the
    view ray, so at 31 degrees off axis it tilts about 31 degrees out of the surface, and a
    half-width of RIB_WIDTH/2 lifts the strap's corners ~17 mm FORWARD of the ridge -- i.e.
    straight through the glass, which RIB_GLASS_GAP alone does not prevent because it only
    offsets along the ray. So the standoff is solved per station against canopy_y() until
    both corners sit RIB_GLASS_GAP behind the surface. It re-derives itself the moment
    RIB_WIDTH, the ridge position or the bulge changes; there is no clearance literal here
    to go stale when Max re-authors the constants.
    """
    grid = canopy_grid()
    pts = grid[col_index]
    nr = len(pts)
    hw = RIB_WIDTH * 0.5
    sections = []
    for j in range(nr):
        if j == 0:
            T = v_sub(pts[1], pts[0])
        elif j == nr - 1:
            T = v_sub(pts[nr - 1], pts[nr - 2])
        else:
            T = v_sub(pts[j + 1], pts[j - 1])
        T = v_norm(T)
        V = v_norm(pts[j])
        W = v_mul(V, -1.0)
        U = v_norm(v_cross(W, T))

        def violation(s):
            """How far the worse corner is IN FRONT of where it is allowed to be, in metres."""
            base = v_add(pts[j], v_mul(W, s))
            worst = None
            for sgn in (1.0, -1.0):
                c = v_add(base, v_mul(U, sgn * hw))
                gap = c[1] + RIB_GLASS_GAP - canopy_surface_y(c[0], c[2])
                if worst is None or gap > worst:
                    worst = gap
            return worst

        rate = -W[1]    # metres of retreat in y bought per metre of standoff
        if rate <= 1e-9:
            raise ValueError(
                "rib station %d on column %d looks along the eye ray, so no standoff along it "
                "can retreat behind the canopy. Move CANOPY_RIB_X or the row profile."
                % (j, col_index))
        standoff = RIB_GLASS_GAP
        for _ in range(RIB_SOLVE_MAX_ITERS):
            viol = violation(standoff)
            if abs(viol) <= RIB_SOLVE_TOL:
                break
            standoff += viol / rate
        else:
            raise ValueError(
                "the rib standoff fixed point did not converge in %d rounds at station %d of "
                "column %d. RIB_WIDTH (%.4f m) is probably large relative to the facet it sits "
                "on." % (RIB_SOLVE_MAX_ITERS, j, col_index, RIB_WIDTH))
        if standoff < RIB_GLASS_GAP:
            standoff = RIB_GLASS_GAP   # never let the strap sit flush and z-fight the shell

        base = v_add(pts[j], v_mul(W, standoff))
        out = v_add(base, v_mul(U, hw))
        inn = v_add(base, v_mul(U, -hw))
        sections.append((
            out,
            v_add(out, v_mul(W, RIB_DEPTH)),
            v_add(inn, v_mul(W, RIB_DEPTH)),
            inn,
        ))
    return sections


def loft(sections):
    """Close a swept solid over a list of 4-corner cross-sections.

    Each section's corners are given counter-clockwise in its own (U, W) plane, with
    (U, W, T) right-handed and T the sweep direction, so:
        start cap  reversed  -> normal -T
        side k     (a_k, a_k+1, b_k+1, b_k) -> normal outward
        end cap    forward   -> normal +T
    No orientation test, no centroid heuristic: the winding is correct because the basis is.
    """
    m = 4
    n = len(sections)
    verts = []
    for s in sections:
        verts.extend(s)
    faces = [(3, 2, 1, 0)]
    for j in range(n - 1):
        a = j * m
        b = (j + 1) * m
        for k in range(m):
            k2 = (k + 1) % m
            faces.append((a + k, a + k2, b + k2, b + k))
    last = (n - 1) * m
    faces.append((last + 0, last + 1, last + 2, last + 3))
    return verts, faces


def loft_segments(sections):
    """The same sweep as loft(), decomposed into one convex box per gap.

    Only the occlusion predictor uses this: a bowed rib is not convex, so its silhouette
    cannot be taken as one convex hull, but each segment between adjacent stations is (near
    enough) a convex box and its hull IS its silhouette.
    """
    segs = []
    for j in range(len(sections) - 1):
        v = list(sections[j]) + list(sections[j + 1])
        f = [(3, 2, 1, 0), (4, 5, 6, 7)]
        for k in range(4):
            k2 = (k + 1) % 4
            f.append((k, k2, 4 + k2, 4 + k))
        segs.append((v, f))
    return segs


RIB_CHECK_SAMPLES = 12   # subdivisions per barycentric axis when walking a rib's front face


def triangulate(faces):
    """Fan every n-gon from its first vertex. Deterministic, and the ONLY split rule here.

    Every exported face is then planar by construction, so no surface in this model depends
    on how Blender's exporter chooses to split a non-planar quad -- which matters because the
    rib clearances are solved against specific triangles, and a different split would move
    the surface they were solved against by millimetres.
    """
    out = []
    for f in faces:
        for i in range(1, len(f) - 1):
            out.append((f[0], f[i], f[i + 1]))
    return out


def _tri_grid(p0, p1, p2, n):
    """Barycentric lattice over a triangle, endpoints included. Deterministic order."""
    pts = []
    for i in range(n + 1):
        for j in range(n + 1 - i):
            a = i / float(n)
            b = j / float(n)
            c = 1.0 - a - b
            pts.append((p0[0] * c + p1[0] * a + p2[0] * b,
                        p0[1] * c + p1[1] * a + p2[1] * b,
                        p0[2] * c + p1[2] * a + p2[2] * b))
    return pts


def rib_glass_clearance(col_index):
    """Smallest gap between a finished rib's FRONT face and the exported canopy, in metres.

    Deliberately checked INDEPENDENTLY of the solver in rib_sections(): this walks the
    finished geometry, so a wrong derivation shows up here rather than being confirmed by its
    own arithmetic.

    It walks the front face's INTERIOR, not just its two long edges. The face spans from the
    inboard corner to the outboard corner and from one station to the next; both its edges
    can clear the glass while the surface between them does not, because the face is ruled
    and the shell is folded. The samples follow the exact triangles triangulate() will emit
    -- (inn_j, out_j, out_j+1) and (inn_j, out_j+1, inn_j+1), matching loft()'s k=3 side face
    -- so this measures the surface that actually ships. Negative means the rib has broken
    through the glass.
    """
    secs = rib_sections(col_index)
    worst = None
    for j in range(len(secs) - 1):
        inn_a, out_a = secs[j][3], secs[j][0]
        inn_b, out_b = secs[j + 1][3], secs[j + 1][0]
        for tri in ((inn_a, out_a, out_b), (inn_a, out_b, inn_b)):
            for p in _tri_grid(tri[0], tri[1], tri[2], RIB_CHECK_SAMPLES):
                clr = canopy_surface_y(p[0], p[2]) - p[1]
                if worst is None or clr < worst:
                    worst = clr
    return worst if worst is not None else 0.0


def build_rib(col_index):
    return loft(rib_sections(col_index))


def screen_frame(tan_x, tan_z):
    """Orthonormal frame for one screen unit, from its tan-space position.

    The display face's normal IS the centre->eye direction -- never a hand-tuned Euler angle
    -- so AC-FORM's "within 20 degrees of the centre-to-eye vector" is 0 degrees by
    construction, and the thing that can actually fail is the EXPORT, which is where
    tests/cockpit-geometry.test.js measures it.

    u is screen-right (+X-ish), w is screen-up, and u x w == n.
    """
    d = v_norm((tan_x, 1.0, tan_z))
    centre = v_mul(d, SCREEN_DIST)
    n = v_mul(d, -1.0)
    side = v_cross(BLENDER_UP, n)
    if v_len(side) < 1e-9:
        raise ValueError("screen at tan (%.4f, %.4f) looks straight up or down; its width "
                         "axis is undefined" % (tan_x, tan_z))
    u = v_norm(side)
    w = v_cross(n, u)
    return centre, n, u, w


def _rect(centre, u, w, hu, hw):
    """Four corners of a rectangle, ordered (-,-) (+,-) (+,+) (-,+) in the (u, w) basis."""
    return [
        v_add(centre, v_add(v_mul(u, -hu), v_mul(w, -hw))),
        v_add(centre, v_add(v_mul(u, hu), v_mul(w, -hw))),
        v_add(centre, v_add(v_mul(u, hu), v_mul(w, hw))),
        v_add(centre, v_add(v_mul(u, -hu), v_mul(w, hw))),
    ]


def build_screen_face(centre, n, u, w):
    """Screen_*: the display face alone -- one quad, wound so its normal is n (at the eye)."""
    verts = _rect(centre, u, w, SCREEN_W * 0.5, SCREEN_H * 0.5)
    return verts, [(0, 1, 2, 3)]


def build_screen_body(centre, n, u, w):
    """ScreenBody_*: a CLOSED solid -- bezel ring, recess pocket, backing, back plate.

    Along n (which points at the eye) the unit reads, front to back:
        bezel plane            centre + n * SCREEN_FACE_RECESS
        display face           centre                                  <- the Screen_* node
        pocket floor           centre - n * SCREEN_FACE_GAP
        back plate             bezel plane - n * SCREEN_BODY_DEPTH
    The pocket is what makes the bezel read as a bezel instead of as a painted border: the
    display sits down inside a SCREEN_FACE_RECESS-deep well with a SCREEN_BEZEL-wide lip.
    """
    if SCREEN_FACE_RECESS + SCREEN_FACE_GAP >= SCREEN_BODY_DEPTH:
        raise ValueError(
            "the recess pocket (%.4f m) is as deep as the body (%.4f m); the display face "
            "would break out of the back of the box. Lower SCREEN_FACE_RECESS or raise "
            "SCREEN_BODY_DEPTH." % (SCREEN_FACE_RECESS + SCREEN_FACE_GAP, SCREEN_BODY_DEPTH))
    hu = SCREEN_W * 0.5
    hw = SCREEN_H * 0.5
    Hu = hu + SCREEN_BEZEL
    Hw = hw + SCREEN_BEZEL
    bezel_c = v_add(centre, v_mul(n, SCREEN_FACE_RECESS))
    floor_c = v_sub(centre, v_mul(n, SCREEN_FACE_GAP))
    back_c = v_sub(bezel_c, v_mul(n, SCREEN_BODY_DEPTH))

    verts = (_rect(bezel_c, u, w, Hu, Hw)      # 0..3   outer, bezel plane
             + _rect(bezel_c, u, w, hu, hw)    # 4..7   inner, bezel plane
             + _rect(floor_c, u, w, hu, hw)    # 8..11  inner, pocket floor
             + _rect(back_c, u, w, Hu, Hw))    # 12..15 outer, back plate

    faces = []
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append((k, k2, 4 + k2, 4 + k))            # bezel ring, normal +n
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append((4 + k, 4 + k2, 8 + k2, 8 + k))    # pocket wall, normal into the pocket
    faces.append((8, 9, 10, 11))                        # pocket floor, normal +n
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append((k, 12 + k, 12 + k2, k2))          # side wall, normal outward
    faces.append((15, 14, 13, 12))                      # back plate, normal -n
    return verts, faces


def screen_outer_box(centre, n, u, w):
    """The body's convex outer envelope. Predictor only -- its silhouette is the body's.

    The recess pocket is a dent in the front face, entirely inside this envelope, so it
    cannot change the silhouette and does not need to be modelled for the measurement.
    """
    Hu = SCREEN_W * 0.5 + SCREEN_BEZEL
    Hw = SCREEN_H * 0.5 + SCREEN_BEZEL
    bezel_c = v_add(centre, v_mul(n, SCREEN_FACE_RECESS))
    back_c = v_sub(bezel_c, v_mul(n, SCREEN_BODY_DEPTH))
    verts = _rect(bezel_c, u, w, Hu, Hw) + _rect(back_c, u, w, Hu, Hw)
    faces = [(0, 1, 2, 3), (7, 6, 5, 4)]
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append((k, 4 + k, 4 + k2, k2))
    return verts, faces


def arm_endpoints(centre, n, u, w, tan_x, tan_z):
    """Where one arm starts and stops.

    Root: placed by TAN COORDINATES at depth ARM_ROOT_Y, in the same quadrant as its screen,
    so "outside the 70 deg / 16:9 frustum" is a direct comparison against ARM_ROOT_TAN_X /
    ARM_ROOT_TAN_Z rather than something you have to re-derive from metres.

    Tip: the back plate, offset toward its OUTBOARD-FAR corner and pushed ARM_EMBED into the
    box. Landing on the dead centre of the plate would hide the entire strut behind its own
    screen; landing it off-corner keeps a readable length of arm between the box's edge and
    the edge of the frame.
    """
    sx = 1.0 if tan_x >= 0.0 else -1.0
    sz = 1.0 if tan_z >= 0.0 else -1.0
    root = (sx * ARM_ROOT_TAN_X * ARM_ROOT_Y, ARM_ROOT_Y, sz * ARM_ROOT_TAN_Z * ARM_ROOT_Y)

    Hu = SCREEN_W * 0.5 + SCREEN_BEZEL
    Hw = SCREEN_H * 0.5 + SCREEN_BEZEL
    bezel_c = v_add(centre, v_mul(n, SCREEN_FACE_RECESS))
    back_c = v_sub(bezel_c, v_mul(n, SCREEN_BODY_DEPTH))
    attach = v_add(back_c, v_add(v_mul(u, sx * ARM_ATTACH_U * Hu),
                                 v_mul(w, sz * ARM_ATTACH_W * Hw)))
    tip = v_add(attach, v_mul(n, ARM_EMBED))
    return root, tip


def build_arm(root, tip):
    """Arm_*: a tapered rectangular strut. Six flat faces -- angular, not a cylinder."""
    axis = v_sub(tip, root)
    if v_len(axis) < 1e-6:
        raise ValueError("arm has zero length: its root and its screen coincide")
    axis = v_norm(axis)
    ref = BLENDER_UP
    if abs(v_dot(ref, axis)) > 0.98:
        ref = (1.0, 0.0, 0.0)
    au = v_norm(v_cross(ref, axis))
    aw = v_cross(axis, au)          # (au, aw, axis) is right-handed: au x aw == axis

    def section(p, su, sw):
        return (
            v_add(p, v_add(v_mul(au, su), v_mul(aw, -sw))),
            v_add(p, v_add(v_mul(au, su), v_mul(aw, sw))),
            v_add(p, v_add(v_mul(au, -su), v_mul(aw, sw))),
            v_add(p, v_add(v_mul(au, -su), v_mul(aw, -sw))),
        )

    return loft([section(root, ARM_ROOT_HALF_U, ARM_ROOT_HALF_W),
                 section(tip, ARM_TIP_HALF_U, ARM_TIP_HALF_W)])


def screen_units():
    """Every screen unit, built once and shared by the exporter, the predictor and the sidecar.

    One builder, three consumers: the GLB, the analytic measurement and the metrics sidecar
    can never disagree about where a screen is, because there is only one place it is decided.
    """
    units = []
    for (suffix, tan_x, tan_z) in SCREEN_QUADRANTS:
        centre, n, u, w = screen_frame(tan_x, tan_z)
        face_v, face_f = build_screen_face(centre, n, u, w)
        body_v, body_f = build_screen_body(centre, n, u, w)
        box_v, box_f = screen_outer_box(centre, n, u, w)
        root, tip = arm_endpoints(centre, n, u, w, tan_x, tan_z)
        arm_v, arm_f = build_arm(root, tip)
        units.append({
            "suffix": suffix,
            "tanX": tan_x,
            "tanZ": tan_z,
            "centre": centre,
            "normal": n,
            "u": u,
            "w": w,
            "faceVerts": face_v, "faceFaces": face_f,
            "bodyVerts": body_v, "bodyFaces": body_f,
            "boxVerts": box_v, "boxFaces": box_f,
            "armVerts": arm_v, "armFaces": arm_f,
            "armRoot": root, "armTip": tip,
        })
    return tuple(units)


def build_all():
    """Every mesh, in a fixed order. Returns a list of dicts (name, verts, faces, material)."""
    parts = []
    gv, gf = build_canopy()
    parts.append({"name": NAME_GLASS, "verts": gv, "faces": gf,
                  "material": "Mat_Glass", "kind": "glass"})
    for k, col in enumerate(CANOPY_RIB_COLUMNS):
        rv, rf = build_rib(col)
        parts.append({"name": NAME_RIBS[k], "verts": rv, "faces": rf,
                      "material": "Mat_Frame", "kind": "rib"})
    units = screen_units()
    for un in units:
        parts.append({"name": SCREEN_PREFIX + un["suffix"], "verts": un["faceVerts"],
                      "faces": un["faceFaces"], "material": "Mat_Screen", "kind": "screen"})
    for un in units:
        parts.append({"name": BODY_PREFIX + un["suffix"], "verts": un["bodyVerts"],
                      "faces": un["bodyFaces"], "material": "Mat_Body", "kind": "body"})
    for un in units:
        parts.append({"name": ARM_PREFIX + un["suffix"], "verts": un["armVerts"],
                      "faces": un["armFaces"], "material": "Mat_Arm", "kind": "arm"})
    for part in parts:
        part["faces"] = triangulate(part["faces"])
    return parts, units


# =============================================================================
# Analysis -- the occlusion measurement, the frustum assertions, clearances.
# All analytic and deterministic; the browser measurement stays authoritative.
# =============================================================================

def frame_tangents():
    tan_v = math.tan(math.radians(GAME_FOV_DEG * 0.5))
    return tan_v * GAME_ASPECT, tan_v


def project_tan(p):
    """Blender point -> (tan of horizontal angle, tan of vertical angle) at the eye.

    A perspective camera maps directions linearly onto this plane, so an area fraction
    measured here IS the pixel fraction. Straight 3D lines stay straight here.
    """
    if p[1] <= 1e-9:
        raise ValueError("point is not in front of the eye: %r" % (p,))
    return (p[0] / p[1], p[2] / p[1])


def silhouette_tan(verts, faces, y_min=OCC_NEAR_Y):
    """Projected silhouette of a CONVEX solid, clipped to the half-space y >= y_min.

    The vertices of a convex polytope cut by a plane are the original vertices that survive
    plus the plane's intersections with the original EDGES -- so collecting those and hulling
    their projections gives the exact silhouette, and an arm whose root sits at or behind the
    eye plane still measures correctly instead of raising.
    """
    pts = []
    for v in verts:
        if v[1] >= y_min:
            pts.append(v)
    for (i, j) in edges_of(faces):
        a = verts[i]
        b = verts[j]
        if (a[1] - y_min) * (b[1] - y_min) < 0.0:
            t = (y_min - a[1]) / (b[1] - a[1])
            pts.append((a[0] + t * (b[0] - a[0]), y_min, a[2] + t * (b[2] - a[2])))
    if len(pts) < 3:
        return []
    return convex_hull_2d([project_tan(p) for p in pts])


def _poly_rows(poly):
    zs = [p[1] for p in poly]
    return min(zs), max(zs)


def coverage_fraction(polys):
    """Fraction of the 70 deg / 16:9 frame covered by the UNION of convex tan-space polygons.

    A scanline sweep, which is the same operation the browser's pixel readback performs --
    so the analytic figure and the measured one should agree rather than merely correlate.
    Overlapping occluders are counted once, which matters here: every arm spends most of its
    length hidden behind its own screen box.
    """
    tan_h, tan_v = frame_tangents()
    prepared = []
    for poly in polys:
        if len(poly) >= 3:
            lo, hi = _poly_rows(poly)
            prepared.append((lo, hi, poly))
    if not prepared:
        return 0.0
    total = 0.0
    dz = 2.0 * tan_v / OCC_SCANLINES
    for i in range(OCC_SCANLINES):
        z = -tan_v + (i + 0.5) * dz
        spans = []
        for (lo, hi, poly) in prepared:
            if z < lo or z > hi:
                continue
            xs = []
            n = len(poly)
            for k in range(n):
                x1, z1 = poly[k]
                x2, z2 = poly[(k + 1) % n]
                if (z1 <= z < z2) or (z2 <= z < z1):
                    xs.append(x1 + (z - z1) / (z2 - z1) * (x2 - x1))
            if len(xs) < 2:
                continue
            xs.sort()
            a = xs[0] if xs[0] > -tan_h else -tan_h
            b = xs[-1] if xs[-1] < tan_h else tan_h
            if b > a:
                spans.append((a, b))
        if not spans:
            continue
        spans.sort()
        cur_a, cur_b = spans[0]
        for (a, b) in spans[1:]:
            if a > cur_b:
                total += cur_b - cur_a
                cur_a, cur_b = a, b
            elif b > cur_b:
                cur_b = b
        total += cur_b - cur_a
    return total / (OCC_SCANLINES * 2.0 * tan_h)


def frustum_clearances(p):
    """Signed distance in metres by which p lies OUTSIDE each frustum side plane.

    The four side planes all pass through the eye, so this is well defined for points beside,
    in front of, or behind the eye -- unlike a tan-space test, which needs y > 0. A point is
    outside the frustum iff any of these is positive.
    """
    tan_h, tan_v = frame_tangents()
    planes = (
        ("right", (1.0, -tan_h, 0.0)),
        ("left", (-1.0, -tan_h, 0.0)),
        ("top", (0.0, -tan_v, 1.0)),
        ("bottom", (0.0, -tan_v, -1.0)),
    )
    out = []
    for (nm, nrm) in planes:
        out.append((nm, v_dot(nrm, p) / v_len(nrm)))
    return out


ARM_DEPTH_SAMPLES = 33   # points sampled along each of an arm's four long edges


def arm_in_front_of_box(arm_verts, un):
    """How far an arm pokes in FRONT of a screen box's bezel plane, where it overlaps it.

    A mount that swings around and crosses its own display face reads as a bug, not as a
    mount, and it is invisible in the occlusion total (union counts it once either way) --
    so it needs its own check. For every sample along the strut that projects INSIDE the
    box's silhouette, this compares the sample's distance from the eye against where the eye
    ray crosses the box's bezel plane. Positive means the strut is nearer: a visible defect.

    Returns (signed_metres, overlapping_samples). Positive metres is an incursion; negative
    is the margin by which the strut stays behind. The sample COUNT is returned as well
    because "0.0" would otherwise be ambiguous between "checked and clear" and "the two never
    overlap, so nothing was checked" -- a pass that measured nothing is not a pass.
    """
    box_poly = silhouette_tan(un["boxVerts"], un["boxFaces"])
    if len(box_poly) < 3:
        return 0.0, 0
    n = un["normal"]
    plane_d = v_dot(n, v_add(un["centre"], v_mul(n, SCREEN_FACE_RECESS)))
    worst = None
    hits = 0
    # The four long edges of the tapered strut: root corner k -> tip corner k.
    for k in range(4):
        a = arm_verts[k]
        b = arm_verts[4 + k]
        for s in range(ARM_DEPTH_SAMPLES):
            t = s / float(ARM_DEPTH_SAMPLES - 1)
            p = v_add(a, v_mul(v_sub(b, a), t))
            if p[1] <= OCC_NEAR_Y:
                continue
            if not point_in_convex_ccw(box_poly, project_tan(p)):
                continue
            dist = v_len(p)
            if dist < 1e-9:
                continue
            denom = v_dot(n, v_mul(p, 1.0 / dist))
            if denom > -1e-6:
                continue
            hits += 1
            gap = plane_d / denom - dist
            if worst is None or gap > worst:
                worst = gap
    return (worst if worst is not None else 0.0), hits


def analyse(units=None):
    """Measure the occlusion and check every geometric claim the form makes."""
    if units is None:
        units = screen_units()
    tan_h, tan_v = frame_tangents()
    frame_rect = [(-tan_h, -tan_v), (tan_h, -tan_v), (tan_h, tan_v), (-tan_h, tan_v)]

    # ---- Canopy shell: excluded from occlusion, but it must actually span the opening ----
    gv, gf = build_canopy()
    glass_hull = convex_hull_2d([project_tan(p) for p in gv])
    glass_covers_frame = all(point_in_convex_ccw(glass_hull, c) for c in frame_rect)
    glass_min_dist = min(v_len(p) for p in gv)

    # ---- Ribs ----
    rib_polys = []
    rib_detail = []
    for k, col in enumerate(CANOPY_RIB_COLUMNS):
        secs = rib_sections(col)
        polys = [silhouette_tan(sv, sf) for (sv, sf) in loft_segments(secs)]
        rib_polys.extend(polys)
        ridge = [canopy_grid()[col][j] for j in range(len(CANOPY_ROWS))]
        tans = [project_tan(p) for p in ridge]
        standoffs = [v_len(v_sub(v_mul(v_add(s[0], s[3]), 0.5), ridge[j]))
                     for j, s in enumerate(secs)]
        rib_detail.append({
            "name": NAME_RIBS[k],
            "columnIndex": col,
            "tanXAtRim": tans[0][0],
            "tanXAtCrest": tans[len(tans) // 2][0],
            "angleAtRimDeg": math.degrees(math.atan(abs(tans[0][0]))),
            "angleAtCrestDeg": math.degrees(math.atan(abs(tans[len(tans) // 2][0]))),
            "standoffMin": min(standoffs),
            "standoffMax": max(standoffs),
            "glassClearance": rib_glass_clearance(col),
            "ownOcclusion": coverage_fraction(polys),
        })

    breached = [d for d in rib_detail if d["glassClearance"] < 0.0]
    if breached:
        lines = ["    %s breaks through Canopy_Glass by %.4f m"
                 % (d["name"], -d["glassClearance"]) for d in breached]
        raise ValueError(
            "a canopy rib punches through the shell it is supposed to be lying on:\n%s\n"
            "  Fix: the standoff solver in rib_sections() should have prevented this, so "
            "either it failed to converge or RIB_WIDTH (%.4f m) is too wide for the facet at "
            "that station. Narrow RIB_WIDTH or move CANOPY_RIB_X."
            % ("\n".join(lines), RIB_WIDTH))

    # ---- Screens (display face + body) and arms ----
    screen_polys = []
    arm_polys = []
    screen_detail = []
    arm_detail = []
    arm_failures = []
    max_unit_dist = 0.0
    for un in units:
        box_poly = silhouette_tan(un["boxVerts"], un["boxFaces"])
        screen_polys.append(box_poly)
        face_tan = [project_tan(p) for p in un["faceVerts"]]
        face_area = poly_area_2d(face_tan)
        face_in = poly_area_2d(clip_poly(face_tan, frame_rect))
        box_area = poly_area_2d(box_poly)
        box_in = poly_area_2d(clip_poly(box_poly, frame_rect))
        c_tan = project_tan(un["centre"])
        screen_detail.append({
            "name": SCREEN_PREFIX + un["suffix"],
            "tanCentre": c_tan,
            "distance": v_len(un["centre"]),
            "faceVisibleFraction": (face_in / face_area) if face_area > 0.0 else 0.0,
            "bodyVisibleFraction": (box_in / box_area) if box_area > 0.0 else 0.0,
            "ownOcclusion": coverage_fraction([box_poly]),
        })
        for v in un["faceVerts"] + un["bodyVerts"]:
            d = v_len(v)
            if d > max_unit_dist:
                max_unit_dist = d

        arm_poly = silhouette_tan(un["armVerts"], un["armFaces"])
        arm_polys.append(arm_poly)
        clr = frustum_clearances(un["armRoot"])
        best = max(clr, key=lambda t: t[1])
        if best[1] < ARM_ROOT_CLEARANCE_MIN:
            arm_failures.append((ARM_PREFIX + un["suffix"], un["armRoot"], best))
        root_tan = project_tan(un["armRoot"]) if un["armRoot"][1] > 1e-9 else None
        # How much of the arm is actually visible: its silhouette inside the frame but NOT
        # behind its own screen box. An arm you cannot see is not an arm reaching in.
        arm_in_frame = poly_area_2d(clip_poly(arm_poly, frame_rect))
        arm_marginal = coverage_fraction([box_poly, arm_poly]) - coverage_fraction([box_poly])
        depth_fault = None
        depth_fault_against = None
        depth_samples = 0
        for other in units:
            f, hits = arm_in_front_of_box(un["armVerts"], other)
            depth_samples += hits
            if hits and (depth_fault is None or f > depth_fault):
                depth_fault = f
                depth_fault_against = BODY_PREFIX + other["suffix"]
        if depth_fault is None:
            depth_fault = 0.0
        arm_detail.append({
            "name": ARM_PREFIX + un["suffix"],
            "root": un["armRoot"],
            "rootTan": root_tan,
            "clearances": clr,
            "clearanceBest": best,
            "outsideFrustum": best[1] > 0.0,
            "length": v_len(v_sub(un["armTip"], un["armRoot"])),
            "areaInFrameTanSpace": arm_in_frame,
            "occlusionBeyondItsScreen": arm_marginal,
            "inFrontOfBoxBy": depth_fault,
            "inFrontOfBox": depth_fault_against,
            "depthSamplesOverlappingABox": depth_samples,
        })
        for v in un["armVerts"]:
            d = v_len(v)
            if d > max_unit_dist:
                max_unit_dist = d

    if arm_failures:
        lines = []
        for (nm, root, best) in arm_failures:
            lines.append("    %s root (%.4f, %.4f, %.4f) clears the nearest frustum plane by "
                         "only %.4f m (best plane: %s)"
                         % (nm, root[0], root[1], root[2], best[1], best[0]))
        raise ValueError(
            "AC-FORM(b): every arm must be rooted OUTSIDE the %.0f deg / %.4f aspect view "
            "frustum by at least ARM_ROOT_CLEARANCE_MIN = %.3f m, so the arms read as reaching "
            "in from beyond the player's field of view. These do not:\n%s\n"
            "  Fix: raise ARM_ROOT_TAN_X above %.4f and/or ARM_ROOT_TAN_Z above %.4f (the "
            "frame's own half-tangents), or lower ARM_ROOT_Y so the same tan coordinates sit "
            "further from the frustum's apex."
            % (GAME_FOV_DEG, GAME_ASPECT, ARM_ROOT_CLEARANCE_MIN, "\n".join(lines),
               tan_h, tan_v))

    crossers = [d for d in arm_detail if d["inFrontOfBoxBy"] > 1e-6]
    if crossers:
        lines = []
        for d in crossers:
            lines.append("    %s swings %.4f m in front of %s"
                         % (d["name"], d["inFrontOfBoxBy"], d["inFrontOfBox"]))
        raise ValueError(
            "an arm crosses in FRONT of a screen box's bezel plane where the two overlap on "
            "screen, so it would draw across the display face it is supposed to be holding "
            "up:\n%s\n"
            "  Fix: raise ARM_ROOT_Y (currently %.3f m) so the root sits further from the eye "
            "than the screens do -- that also increases the frustum clearance -- or reduce "
            "ARM_ATTACH_U / ARM_ATTACH_W so the strut lands closer to the middle of the back "
            "plate and approaches from further behind." % ("\n".join(lines), ARM_ROOT_Y))

    if max_unit_dist >= glass_min_dist:
        raise ValueError(
            "a screen unit or arm reaches %.4f m from the eye, but the nearest point of "
            "Canopy_Glass is only %.4f m away -- the screens would punch through the canopy. "
            "Lower SCREEN_DIST, or push the shell out with CANOPY_Y_EDGE / CANOPY_BULGE."
            % (max_unit_dist, glass_min_dist))

    # ---- Occlusion. Canopy_Glass is NOT in any of these lists, by design. ----
    ribs_own = coverage_fraction(rib_polys)
    screens_own = coverage_fraction(screen_polys)
    arms_own = coverage_fraction(arm_polys)
    ribs_marginal = ribs_own
    ribs_screens = coverage_fraction(rib_polys + screen_polys)
    screens_marginal = ribs_screens - ribs_own
    total = coverage_fraction(rib_polys + screen_polys + arm_polys)
    arms_marginal = total - ribs_screens

    return {
        "fovDeg": GAME_FOV_DEG,
        "aspect": GAME_ASPECT,
        "tanH": tan_h,
        "tanV": tan_v,
        "halfAngleHorizontalDeg": math.degrees(math.atan(tan_h)),
        "halfAngleVerticalDeg": math.degrees(math.atan(tan_v)),
        "scanlines": OCC_SCANLINES,

        "canopyProtrusion": CANOPY_BULGE,
        "canopyRimY": CANOPY_Y_EDGE,
        "canopyCrestY": CANOPY_Y_EDGE + CANOPY_BULGE,
        "canopyMinDistance": glass_min_dist,
        "canopyCoversFrame": glass_covers_frame,
        "canopyHalfAnglesDeg": {
            "leftRight": math.degrees(math.atan(CANOPY_HALF_W / CANOPY_Y_EDGE)),
            "up": math.degrees(math.atan(CANOPY_TOP_Z / CANOPY_Y_EDGE)),
            "down": math.degrees(math.atan(-CANOPY_BOT_Z / CANOPY_Y_EDGE)),
        },

        "ribDetail": rib_detail,
        "screenDetail": screen_detail,
        "armDetail": arm_detail,
        "maxUnitDistance": max_unit_dist,

        "occlusionTotal": total,
        "occlusionRibsOwn": ribs_own,
        "occlusionScreensOwn": screens_own,
        "occlusionArmsOwn": arms_own,
        "occlusionRibsMarginal": ribs_marginal,
        "occlusionScreensMarginal": screens_marginal,
        "occlusionArmsMarginal": arms_marginal,
        "occlusionExcludes": [NAME_GLASS],
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


def make_material(name, rgb, roughness, metallic=0.0, double_sided=False, alpha=1.0):
    """Create a Principled material.

    double_sided maps straight onto glTF's `doubleSided` (the exporter writes
    `doubleSided = not use_backface_culling`), and it is set EXPLICITLY on every material
    rather than left to Blender's default, because the default is not the same answer for
    every mesh here:

        ScreenBody_* / Arm_*  closed solids -- single-sided is correct and cheaper.
        Canopy_Rib_*          closed solids too, but the lab orbits outside the cockpit, so
                              they are double-sided to avoid reading as "the ribs vanished".
        Screen_*              single quads. Single-sided would make all four disappear the
                              moment the orbit camera swings behind them.
        Canopy_Glass          an open shell with two visible sides, by definition.

    alpha < 1 is only used by Canopy_Glass, so the lab can see THROUGH the placeholder shell.
    Blender has churned its transparency flags (blend_method in <=4.1, surface_render_method
    in 4.2+), so both are set behind hasattr guards; if the exporter still writes alphaMode
    OPAQUE, the lab overrides Mat_Glass by name -- the geometry is unaffected either way.
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
    if alpha < 1.0:
        if hasattr(mat, "blend_method"):
            try:
                mat.blend_method = 'BLEND'
            except (TypeError, AttributeError) as exc:  # pragma: no cover - version drift
                print("  NOTE: could not set blend_method on %s (%s)" % (name, exc))
        if hasattr(mat, "surface_render_method"):
            try:
                mat.surface_render_method = 'BLENDED'
            except (TypeError, AttributeError) as exc:  # pragma: no cover - version drift
                print("  NOTE: could not set surface_render_method on %s (%s)" % (name, exc))
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
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
    mat.diffuse_color = (rgb[0], rgb[1], rgb[2], alpha)
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

def build_metrics(parts, units, analysis):
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
            "kind": part["kind"],
            "material": part["material"],
            "vertexCount": len(part["verts"]),
            "faceCount": len(part["faces"]),
            "boundingBox": {"min": r6v(lo), "max": r6v(hi)},
        })
    scene_lo, scene_hi = bbox_of(all_pts_gltf)

    # NOTE on what is NOT here: an "is the normal pointing at the eye?" angle. Computing one
    # from this dict's own centre and normal would be 0.0 by construction -- both come from
    # the same screen_frame() call -- so it could never catch a misaligned screen and would
    # only look like a check. AC-FORM's real measurement is made from the EXPORTED GLB's
    # triangles by tests/cockpit-geometry.test.js, against the centre and normal below.
    sdet = {d["name"]: d for d in analysis["screenDetail"]}
    screens = []
    for un in units:
        nm = SCREEN_PREFIX + un["suffix"]
        d = sdet[nm]
        screens.append({
            "name": nm,
            "bodyName": BODY_PREFIX + un["suffix"],
            "armName": ARM_PREFIX + un["suffix"],
            "centre": r6v(to_gltf(un["centre"])),
            "normal": r6v(to_gltf(un["normal"])),
            "widthAxis": r6v(to_gltf(un["u"])),
            "heightAxis": r6v(to_gltf(un["w"])),
            "width": r6(SCREEN_W),
            "height": r6(SCREEN_H),
            "displayArea": r6(SCREEN_W * SCREEN_H),
            "distanceFromEye": r6(d["distance"]),
            "tanCentre": [r6(d["tanCentre"][0]), r6(d["tanCentre"][1])],
            "visibleFraction": r6(d["faceVisibleFraction"]),
            "bodyVisibleFraction": r6(d["bodyVisibleFraction"]),
            "bodyOuterSize": [r6(SCREEN_W + 2.0 * SCREEN_BEZEL),
                              r6(SCREEN_H + 2.0 * SCREEN_BEZEL),
                              r6(SCREEN_BODY_DEPTH)],
        })

    adet = {d["name"]: d for d in analysis["armDetail"]}
    arms = []
    for un in units:
        nm = ARM_PREFIX + un["suffix"]
        d = adet[nm]
        arms.append({
            "name": nm,
            "screenName": SCREEN_PREFIX + un["suffix"],
            "root": r6v(to_gltf(d["root"])),
            "tip": r6v(to_gltf(un["armTip"])),
            "rootTanSpace": ([r6(d["rootTan"][0]), r6(d["rootTan"][1])]
                             if d["rootTan"] is not None else None),
            "length": r6(d["length"]),
            "outsideFrustum": d["outsideFrustum"],
            "frustumClearanceMetres": {k: r6(v) for (k, v) in d["clearances"]},
            "nearestFrustumPlane": d["clearanceBest"][0],
            "nearestFrustumClearance": r6(d["clearanceBest"][1]),
            "inFrontOfAnyScreenBoxBy": r6(d["inFrontOfBoxBy"]),
            "depthSamplesOverlappingABox": d["depthSamplesOverlappingABox"],
            "occlusionBeyondItsScreen": r6(d["occlusionBeyondItsScreen"]),
        })

    ribs = []
    for d in analysis["ribDetail"]:
        ribs.append({
            "name": d["name"],
            "ridgeX": r6(CANOPY_RIB_X if d["columnIndex"] == CANOPY_RIB_COLUMNS[1]
                         else -CANOPY_RIB_X),
            "width": r6(RIB_WIDTH),
            "depth": r6(RIB_DEPTH),
            "glassGap": r6(RIB_GLASS_GAP),
            "standoffFromRidgeMin": r6(d["standoffMin"]),
            "standoffFromRidgeMax": r6(d["standoffMax"]),
            "measuredGlassClearance": r6(d["glassClearance"]),
            "angleAtRimDeg": r6(d["angleAtRimDeg"]),
            "angleAtCrestDeg": r6(d["angleAtCrestDeg"]),
            "bowDeg": r6(d["angleAtRimDeg"] - d["angleAtCrestDeg"]),
            "bowTanSpace": r6(abs(d["tanXAtRim"]) - abs(d["tanXAtCrest"])),
        })

    return {
        "schemaVersion": 2,
        "generatedBy": "scripts/cockpit-gen.py",
        "workstream": "cockpit-lab-geometry-2026-07-28",
        "units": "metres",
        "axes": ("glTF / three.js: +X right, +Y up, forward is -Z, eye at the origin. "
                 "Authored in Blender (+X right, +Y forward, +Z up) and converted by "
                 "export_yup=True, which maps Blender (x, y, z) -> glTF (x, z, -y)."),
        "scaleNormalisation": "none - every node is identity, 1 unit = 1 metre",
        "eyePoint": [0.0, 0.0, 0.0],
        "eyePointNodeName": NAME_EYE,
        "removedInThisRevision": ["Hull_Nose", "Cockpit_Frame"],
        "removedWhy": ("Max removed the ship nose and replaced the octagonal canopy frame "
                       "with two vertical ribs at UAT on 1056f30. Either node reappearing "
                       "is an AC-FORM failure."),

        "constants": {
            "INCH": INCH,
            "HULL_REF_LENGTH": HULL_REF_LENGTH,
            "CANOPY_Y_EDGE": CANOPY_Y_EDGE,
            "CANOPY_BULGE": CANOPY_BULGE,
            "CANOPY_HALF_W": CANOPY_HALF_W,
            "CANOPY_TOP_Z": CANOPY_TOP_Z,
            "CANOPY_BOT_Z": CANOPY_BOT_Z,
            "CANOPY_RIB_X": CANOPY_RIB_X,
            "CANOPY_SHOULDER_X": CANOPY_SHOULDER_X,
            "CANOPY_SHOULDER_F": CANOPY_SHOULDER_F,
            "CANOPY_COLUMNS": [[r6(x), r6(f)] for (x, f) in CANOPY_COLUMNS],
            "CANOPY_ROWS": [[r6(z), r6(f)] for (z, f) in CANOPY_ROWS],
            "CANOPY_RIB_COLUMNS": list(CANOPY_RIB_COLUMNS),
            "RIB_WIDTH": RIB_WIDTH,
            "RIB_DEPTH": RIB_DEPTH,
            "RIB_GLASS_GAP": RIB_GLASS_GAP,
            "SCREEN_W": SCREEN_W,
            "SCREEN_H": SCREEN_H,
            "SCREEN_BEZEL": r6(SCREEN_BEZEL),
            "SCREEN_BODY_DEPTH": r6(SCREEN_BODY_DEPTH),
            "SCREEN_FACE_RECESS": SCREEN_FACE_RECESS,
            "SCREEN_FACE_GAP": SCREEN_FACE_GAP,
            "SCREEN_DIST": SCREEN_DIST,
            "SCREEN_TAN_X": SCREEN_TAN_X,
            "SCREEN_TAN_Z_UP": SCREEN_TAN_Z_UP,
            "SCREEN_TAN_Z_DOWN": SCREEN_TAN_Z_DOWN,
            "ARM_ROOT_Y": ARM_ROOT_Y,
            "ARM_ROOT_TAN_X": ARM_ROOT_TAN_X,
            "ARM_ROOT_TAN_Z": ARM_ROOT_TAN_Z,
            "ARM_ROOT_CLEARANCE_MIN": ARM_ROOT_CLEARANCE_MIN,
            "ARM_ATTACH_U": ARM_ATTACH_U,
            "ARM_ATTACH_W": ARM_ATTACH_W,
            "ARM_EMBED": ARM_EMBED,
            "ARM_ROOT_HALF_U": ARM_ROOT_HALF_U,
            "ARM_ROOT_HALF_W": ARM_ROOT_HALF_W,
            "ARM_TIP_HALF_U": ARM_TIP_HALF_U,
            "ARM_TIP_HALF_W": ARM_TIP_HALF_W,
            "GAME_FOV_DEG": GAME_FOV_DEG,
            "GAME_ASPECT": r6(GAME_ASPECT),
            "OCC_SCANLINES": OCC_SCANLINES,
            "OCC_NEAR_Y": OCC_NEAR_Y,
        },

        "screenUnit": {
            "displayFace": [r6(SCREEN_W), r6(SCREEN_H)],
            "displayFaceArea": r6(SCREEN_W * SCREEN_H),
            "previousDisplayFace": [0.30, 0.20],
            "displayAreaRatioVsPrevious": r6((SCREEN_W * SCREEN_H) / (0.30 * 0.20)),
            "bezelWidth": r6(SCREEN_BEZEL),
            "bezelInches": r6(SCREEN_BEZEL / INCH),
            "bodyDepth": r6(SCREEN_BODY_DEPTH),
            "bodyDepthInches": r6(SCREEN_BODY_DEPTH / INCH),
            "faceRecess": r6(SCREEN_FACE_RECESS),
            "bodyOuterSize": [r6(SCREEN_W + 2.0 * SCREEN_BEZEL),
                              r6(SCREEN_H + 2.0 * SCREEN_BEZEL),
                              r6(SCREEN_BODY_DEPTH)],
        },

        "canopy": {
            "name": NAME_GLASS,
            "rimY": r6(CANOPY_Y_EDGE),
            "crestY": r6(CANOPY_Y_EDGE + CANOPY_BULGE),
            "protrusionDepth": r6(CANOPY_BULGE),
            "rimWidth": r6(2.0 * CANOPY_HALF_W),
            "rimHeight": r6(CANOPY_TOP_Z - CANOPY_BOT_Z),
            "facetColumns": len(CANOPY_COLUMNS),
            "facetRows": len(CANOPY_ROWS),
            "ridgeX": [r6(-CANOPY_RIB_X), r6(CANOPY_RIB_X)],
            "coversGameFrame": analysis["canopyCoversFrame"],
            "minDistanceFromEye": r6(analysis["canopyMinDistance"]),
            "halfAnglesDeg": {
                "leftRight": r6(analysis["canopyHalfAnglesDeg"]["leftRight"]),
                "up": r6(analysis["canopyHalfAnglesDeg"]["up"]),
                "down": r6(analysis["canopyHalfAnglesDeg"]["down"]),
            },
            "excludedFromOcclusion": True,
            "excludedWhy": ("see-through by design; increment 3 replaces this placeholder "
                            "with real glass, and AC-FRAME counts only opaque structure"),
        },

        "sceneBoundingBox": {"min": r6v(scene_lo), "max": r6v(scene_hi)},
        "objects": objects,
        "ribs": ribs,
        "screens": screens,
        "arms": arms,

        # Top-level alias of occlusion.total, kept at the schema-v1 spelling. The headless
        # tests resolve script-declared scalars by name out of the top level / .constants /
        # .declared, so the headline number has to be reachable as a plain key and not only
        # as a leaf of the richer block below.
        "predictedOcclusionFraction": r6(analysis["occlusionTotal"]),

        "occlusion": {
            "method": ("analytic scanline rasterisation of the projected silhouettes at "
                       "GAME_FOV_DEG / GAME_ASPECT, %d rows, union of overlapping occluders"
                       % OCC_SCANLINES),
            "excludes": analysis["occlusionExcludes"],
            "excludesWhy": "Canopy_Glass is see-through by design",
            "total": r6(analysis["occlusionTotal"]),
            "marginal": {
                "ribs": r6(analysis["occlusionRibsMarginal"]),
                "screensAndBodies": r6(analysis["occlusionScreensMarginal"]),
                "arms": r6(analysis["occlusionArmsMarginal"]),
            },
            "own": {
                "ribs": r6(analysis["occlusionRibsOwn"]),
                "screensAndBodies": r6(analysis["occlusionScreensOwn"]),
                "arms": r6(analysis["occlusionArmsOwn"]),
            },
            "note": ("Marginal figures are measured in the fixed order ribs -> screens -> "
                     "arms and sum to the total; 'own' figures are each category in "
                     "isolation and overlap, so they do not. AC-FRAME's browser measurement "
                     "is authoritative; this exists so proportions can be tuned without a "
                     "render round-trip, and no geometry is padded to hit a number."),
        },

        "diagnostics": {
            # Declared as an explicit ZERO rather than omitted. AC-FRAME says Canopy_Glass
            # earns no occlusion credit; a missing key would let that pass by silence, while
            # a stated 0.0 is a claim the headless test can actually catch being wrong.
            "predictedOcclusionByCanopyGlass": 0.0,
            "frameHalfAngleHorizontalDeg": r6(analysis["halfAngleHorizontalDeg"]),
            "frameHalfAngleVerticalDeg": r6(analysis["halfAngleVerticalDeg"]),
            "frameTanHalfExtents": [r6(analysis["tanH"]), r6(analysis["tanV"])],
            "canopyCoversGameFrame": analysis["canopyCoversFrame"],
            "maxScreenOrArmDistance": r6(analysis["maxUnitDistance"]),
            "canopyMinDistance": r6(analysis["canopyMinDistance"]),
            "minRibGlassClearance": r6(min(d["glassClearance"]
                                           for d in analysis["ribDetail"])),
            "everyArmRootOutsideFrustum": all(d["outsideFrustum"]
                                              for d in analysis["armDetail"]),
            "minArmRootClearance": r6(min(d["clearanceBest"][1]
                                          for d in analysis["armDetail"])),
            "minScreenVisibleFraction": r6(min(d["faceVisibleFraction"]
                                               for d in analysis["screenDetail"])),
            "worstArmInFrontOfScreenBox": r6(max(d["inFrontOfBoxBy"]
                                                 for d in analysis["armDetail"])),
            "armDepthSamplesChecked": sum(d["depthSamplesOverlappingABox"]
                                          for d in analysis["armDetail"]),
            "armVisibilityBeyondItsScreen": [
                {"name": d["name"], "occlusion": r6(d["occlusionBeyondItsScreen"])}
                for d in analysis["armDetail"]
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
    print("=" * 82)
    print("WELL DIPPER -- HELM cockpit, increment 1 geometry (re-spec: boxy screens on arms)")
    print("=" * 82)
    print("  GLB     : %s" % glb_path)
    print("  metrics : %s" % metrics_path)
    print("")
    print("  Objects (bounding boxes in glTF axes: +X right, +Y up, forward -Z, metres)")
    print("    %-18s %5s %5s  %-26s %-26s" % ("name", "verts", "faces", "bbox min", "bbox max"))
    print("    %-18s %5s %5s  %-26s %-26s" % (NAME_EYE, "-", "-",
                                              "(empty at the origin)", ""))
    for o in metrics["objects"]:
        lo = "[%7.3f %7.3f %7.3f]" % tuple(o["boundingBox"]["min"])
        hi = "[%7.3f %7.3f %7.3f]" % tuple(o["boundingBox"]["max"])
        print("    %-18s %5d %5d  %-26s %-26s" % (o["name"], o["vertexCount"],
                                                  o["faceCount"], lo, hi))
    sb = metrics["sceneBoundingBox"]
    print("    %-18s %5s %5s  [%7.3f %7.3f %7.3f] [%7.3f %7.3f %7.3f]"
          % ("SCENE", "", "", sb["min"][0], sb["min"][1], sb["min"][2],
             sb["max"][0], sb["max"][1], sb["max"][2]))
    print("")
    print("  Game frame  : %.2f deg horizontal / %.2f deg vertical half-angles "
          "(fov %.0f, %.4f aspect)"
          % (analysis["halfAngleHorizontalDeg"], analysis["halfAngleVerticalDeg"],
             GAME_FOV_DEG, GAME_ASPECT))
    print("                tan half-extents %.4f x %.4f" % (analysis["tanH"], analysis["tanV"]))
    print("")
    cp = metrics["canopy"]
    print("  Canopy shell (Canopy_Glass -- EXCLUDED from occlusion, see-through by design)")
    print("    rim plane %.3f m forward, crest %.3f m forward -> PROTRUDES %.3f m"
          % (cp["rimY"], cp["crestY"], cp["protrusionDepth"]))
    print("    rim %.3f x %.3f m; %d facet columns x %d rows; ridges at x = %+.3f / %+.3f"
          % (cp["rimWidth"], cp["rimHeight"], cp["facetColumns"], cp["facetRows"],
             cp["ridgeX"][0], cp["ridgeX"][1]))
    print("    subtends %.2f deg left/right, %.2f deg up, %.2f deg down"
          % (cp["halfAnglesDeg"]["leftRight"], cp["halfAnglesDeg"]["up"],
             cp["halfAnglesDeg"]["down"]))
    print("")
    print("  Ribs (the two vertical strips -- the ONLY frame structure)")
    print("    %-16s %8s %8s %9s %9s %8s %18s" % ("name", "width", "depth", "at rim",
                                                  "at crest", "bow", "standoff (derived)"))
    for r in metrics["ribs"]:
        print("    %-16s %7.3fm %7.3fm %8.2fd %8.2fd %7.2fd  %.4f-%.4f m"
              % (r["name"], r["width"], r["depth"], r["angleAtRimDeg"],
                 r["angleAtCrestDeg"], r["bowDeg"], r["standoffFromRidgeMin"],
                 r["standoffFromRidgeMax"]))
    print("    (bow = how far the rib swings toward the centre-line as it crosses the bulge;")
    print("     that swing IS the cue that reads as 'the canopy sticks out in front of me'.")
    print("     standoff is solved per station so the strap's corners clear the glass, not")
    print("     authored -- it re-derives itself when RIB_WIDTH or the bulge changes)")
    print("")
    su = metrics["screenUnit"]
    print("  Screen units (boxy: bezel + backing, display face recessed)")
    print("    display face  %.3f x %.3f m = %.4f m2  (%.2fx the previous %.2f x %.2f m)"
          % (su["displayFace"][0], su["displayFace"][1], su["displayFaceArea"],
             su["displayAreaRatioVsPrevious"], su["previousDisplayFace"][0],
             su["previousDisplayFace"][1]))
    print("    bezel         %.4f m (%.2f in)   backing %.4f m (%.2f in)   recess %.4f m"
          % (su["bezelWidth"], su["bezelInches"], su["bodyDepth"], su["bodyDepthInches"],
             su["faceRecess"]))
    print("    body outer    %.4f x %.4f x %.4f m"
          % (su["bodyOuterSize"][0], su["bodyOuterSize"][1], su["bodyOuterSize"][2]))
    print("")
    print("    %-14s %8s %16s %10s %10s %9s" % ("name", "dist", "tan centre", "face vis",
                                                "body vis", "occludes"))
    sd = {d["name"]: d for d in analysis["screenDetail"]}
    for s in metrics["screens"]:
        d = sd[s["name"]]
        print("    %-14s %7.3fm  (%+.3f, %+.3f) %9.1f%% %9.1f%% %8.2f%%"
              % (s["name"], s["distanceFromEye"], s["tanCentre"][0], s["tanCentre"][1],
                 100.0 * d["faceVisibleFraction"], 100.0 * d["bodyVisibleFraction"],
                 100.0 * d["ownOcclusion"]))
    print("    (normal-at-the-eye is exact by construction; AC-FORM re-measures it from the")
    print("     exported GLB in tests/cockpit-geometry.test.js, which is where it can fail)")
    print("")
    print("  Arms (rooted OUTSIDE the %.0f deg / 16:9 frustum -- asserted, not assumed)"
          % GAME_FOV_DEG)
    print("    %-12s %26s %14s %8s %10s" % ("name", "root (Blender x,y,z)", "root tan",
                                            "length", "clearance"))
    ad = {d["name"]: d for d in analysis["armDetail"]}
    for a in metrics["arms"]:
        d = ad[a["name"]]
        rt = ("(%+.3f, %+.3f)" % (a["rootTanSpace"][0], a["rootTanSpace"][1])
              if a["rootTanSpace"] is not None else "(behind the eye)")
        print("    %-12s (%+7.3f, %+7.3f, %+7.3f) %14s %7.3fm %8.3fm %s"
              % (a["name"], d["root"][0], d["root"][1], d["root"][2], rt, a["length"],
                 a["nearestFrustumClearance"],
                 "OUTSIDE" if a["outsideFrustum"] else "*** INSIDE ***"))
    print("    frame tan half-extents are %.4f x %.4f, so every root tan above is beyond it"
          % (analysis["tanH"], analysis["tanV"]))
    print("    visible beyond its own screen box: %s"
          % ", ".join("%s %.2f%%" % (d["name"].replace(ARM_PREFIX, ""),
                                     100.0 * d["occlusionBeyondItsScreen"])
                      for d in analysis["armDetail"]))
    print("")
    print("  OCCLUSION at %.0f deg / %.4f aspect  (analytic, %d scanlines; Canopy_Glass "
          "EXCLUDED)" % (GAME_FOV_DEG, GAME_ASPECT, OCC_SCANLINES))
    occ = metrics["occlusion"]
    print("    %-22s %10s %10s" % ("", "marginal", "own"))
    print("    %-22s %9.2f%% %9.2f%%" % ("ribs", 100.0 * occ["marginal"]["ribs"],
                                         100.0 * occ["own"]["ribs"]))
    print("    %-22s %9.2f%% %9.2f%%" % ("screens + bodies",
                                         100.0 * occ["marginal"]["screensAndBodies"],
                                         100.0 * occ["own"]["screensAndBodies"]))
    print("    %-22s %9.2f%% %9.2f%%" % ("arms", 100.0 * occ["marginal"]["arms"],
                                         100.0 * occ["own"]["arms"]))
    print("    %-22s %9.2f%%" % ("TOTAL (union)", 100.0 * occ["total"]))
    print("    Marginal columns are measured in the order ribs -> screens -> arms and sum to")
    print("    the TOTAL. 'Own' columns are each category alone and overlap, so they do not.")
    print("    AC-FRAME is measure-and-report: this number describes the form Max asked for,")
    print("    it is not a target the geometry was tuned to hit.")
    print("")
    print("  Checks")
    dg = metrics["diagnostics"]
    print("    canopy shell spans the whole game frame : %s"
          % ("yes" if dg["canopyCoversGameFrame"] else "NO - a frame corner sees past the glass"))
    rc = dg["minRibGlassClearance"]
    print("    ribs stay behind the glass they follow  : %s (measured on the finished mesh, "
          "min gap %.4f m)" % ("yes" if rc >= 0.0 else "NO - a rib breaks through", rc))
    print("    every arm root outside the frustum      : %s (min clearance %.3f m, "
          "floor %.3f m)" % ("yes" if dg["everyArmRootOutsideFrustum"] else "NO",
                             dg["minArmRootClearance"], ARM_ROOT_CLEARANCE_MIN))
    print("    screens+arms stay inboard of the glass  : %s (farthest %.3f m vs nearest "
          "glass %.3f m)" % ("yes" if dg["maxScreenOrArmDistance"] < dg["canopyMinDistance"]
                             else "NO", dg["maxScreenOrArmDistance"], dg["canopyMinDistance"]))
    wa = dg["worstArmInFrontOfScreenBox"]
    print("    no arm crosses in front of a screen     : %s (%d samples overlapped a box; "
          "nearest stays %.4f m behind it)"
          % ("yes" if wa <= 0.0 else "NO", dg["armDepthSamplesChecked"], -wa))
    mv = dg["minScreenVisibleFraction"]
    print("    least-visible display face              : %.1f%% inside the frame%s"
          % (100.0 * mv, "" if mv >= 0.999 else "   <- part of a screen falls off-screen"))
    print("    no Hull_Nose, no Cockpit_Frame          : %s"
          % ("yes" if not any(o["name"] in ("Hull_Nose", "Cockpit_Frame")
                              for o in metrics["objects"]) else "NO - a deleted node is back"))
    print("=" * 82)
    print("")


def analyse_only():
    """Measure the current constants without Blender and without writing anything.

        python3 scripts/cockpit-gen.py --analyse-only

    The whole geometry section is pure Python, so the numbers this prints are the numbers the
    exported GLB will have. This is the tuning loop: edit the CONSTANTS block, re-run this,
    read the occlusion and the visibility diagnostics, repeat -- no Blender, no dev server, no
    browser round-trip. Blender is only needed to turn the same vertex lists into a GLB.
    """
    parts, units = build_all()
    analysis = analyse(units)
    metrics = build_metrics(parts, units, analysis)
    print_summary(metrics, analysis, "(not written -- --analyse-only)",
                  "(not written -- --analyse-only)")
    return 0


def main():
    if bpy is None:
        if "--analyse-only" in sys.argv or "--analyze-only" in sys.argv:
            return analyse_only()
        sys.stderr.write("cockpit-gen.py must be run inside Blender:\n"
                         "  blender --background --factory-startup --python "
                         "scripts/cockpit-gen.py -- --out <glb> --metrics <json>\n"
                         "\nTo measure the current constants with no Blender:\n"
                         "  python3 scripts/cockpit-gen.py --analyse-only\n")
        return 1

    glb_path, metrics_path = parse_args(list(sys.argv))
    d_glb, d_metrics = default_paths()
    glb_path = glb_path or d_glb
    metrics_path = metrics_path or d_metrics

    purge_scene()

    mats = {
        "Mat_Frame": make_material("Mat_Frame", MAT_FRAME_RGB, roughness=0.55,
                                   double_sided=True),
        "Mat_Screen": make_material("Mat_Screen", MAT_SCREEN_RGB, roughness=0.28,
                                    double_sided=True),
        "Mat_Body": make_material("Mat_Body", MAT_BODY_RGB, roughness=0.48,
                                  double_sided=False),
        "Mat_Arm": make_material("Mat_Arm", MAT_ARM_RGB, roughness=0.40, metallic=0.6,
                                 double_sided=False),
        "Mat_Glass": make_material("Mat_Glass", MAT_GLASS_RGB, roughness=0.08,
                                   double_sided=True, alpha=MAT_GLASS_ALPHA),
    }

    make_eye_point()
    parts, units = build_all()
    for part in parts:
        make_mesh_object(part["name"], part["verts"], part["faces"], mats[part["material"]])

    analysis = analyse(units)
    metrics = build_metrics(parts, units, analysis)

    export_glb(glb_path)

    os.makedirs(os.path.dirname(os.path.abspath(metrics_path)) or ".", exist_ok=True)
    with open(metrics_path, "w") as fh:
        json.dump(metrics, fh, indent=2)
        fh.write("\n")

    print_summary(metrics, analysis, glb_path, metrics_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())

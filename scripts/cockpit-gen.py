#!/usr/bin/env python3
"""
cockpit-gen.py -- HELM cockpit interior geometry (increment 1, lab-only).

WHAT THIS BUILDS
    An angular, faceted cockpit authored entirely from named constants and exported as a
    single GLB, plus a JSON metrics sidecar that declares -- in glTF axes -- exactly what
    the GLB should contain. Objects:

        Eye_Point          an empty at the world origin: the pilot's eye.
        Canopy_Glass       a FACETED SHELL that spans the CLEAR OPENING and PROTRUDES
                           FORWARD: its rim is a planar rectangle at CANOPY_Y_EDGE and its
                           centre is pushed CANOPY_BULGE metres further forward, so the
                           surface bows away from the pilot. Its facet layout puts two
                           symmetric VERTICAL RIDGES at +/-CANOPY_RIB_X -- the fold where
                           the flat centre panel meets the raked quarter panels -- and those
                           ridges are what the ribs sit on. Placeholder material; increment 3
                           makes it real glass. EXCLUDED from the occlusion measurement
                           because it is see-through by design.
        Canopy_Frame       the PERIMETER BAND where the glass meets the hull: a closed,
                           faceted ring that follows the shell's rim the whole way round --
                           INCLUDING THE BOTTOM, whose lower run IS the simple sill Max's
                           second reference (No Man's Sky) shows under the screens. This is
                           the "fairly thin" frame Max asked for: its runs are FRAME_WIDTH
                           across, the same ballpark as RIB_WIDTH, and from the seat it
                           shows only as a narrow edge hugging the border of the view. Eight
                           straight runs meeting at eight visible corner breaks -- folded
                           metal, not a moulded ring. Its inner boundary overlaps the glass
                           by FRAME_OVERLAP so there is no seam; its outer boundary reaches
                           PAST the 70 deg / 16:9 frame edge so the pilot never sees a hole
                           where the cockpit should be. It is what makes the model read as
                           an enclosure you are sitting inside rather than as four monitors
                           on two posts.

                           IT IS NOT the deleted Cockpit_Frame. That node was a chunky
                           octagonal ring standing free in the cabin and carrying the screen
                           pads; Max deleted it at UAT on 1056f30 and it stays deleted. This
                           is a thin band lying on the canopy's own edge. A node named
                           Cockpit_Frame reappearing is still an AC-FORM failure.
        Canopy_Rib_L/_R    the two vertical strips. Thin solid straps running from the
                           frame's LOWER run, up and forward over the shell's bulge, to its
                           UPPER run -- so each rib terminates ON the perimeter frame at
                           both ends rather than floating (rib_end_joins() is the check).
                           They are built as THREE STRAIGHT SEGMENTS meeting at two visible
                           KINKS, not as a swept curve: both of Max's references show
                           structural members that BEND as they rise, and it is the bend,
                           not curvature, that conveys the canopy's protruding shape.
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

    There is NO ship nose, no interior console or dash, and no free-standing octagonal ring.
    All were in the previous revision (commit 1056f30) and Max deleted them at UAT. If a node
    named Hull_Nose or Cockpit_Frame reappears anywhere, that is an AC-FORM failure, not a
    merge artefact. Canopy_Frame is a different object with a different job -- see above.

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
    contribution in the fixed order ribs -> frame -> screens -> arms. Only the marginal
    numbers sum to the total; the "own" numbers say how big each category is in isolation.

ASSUMPTIONS the spec did not pin down
    Where the frame is    The previous revision's opening subtended MORE than the game's
                          70 deg / 16:9 frame in every direction, which meant any band drawn
                          on its rim projected entirely outside the pilot's view: an
                          enclosure the pilot could never see. So the CLEAR OPENING was
                          brought in until its rim sits just inside the frame edge
                          (CANOPY_HALF_W / CANOPY_TOP_Z / CANOPY_BOT_Z), and the band was
                          hung outboard of it. The opening is now the thing sized against the
                          view; the band is what closes the remaining margin. The bottom came
                          in furthest, which is what gives the sill Max asked for.
    FRAME_WIDTH etc.      "Fairly thin" is the brief and it is a judgement call, so it is
                          three named constants, not one: FRAME_WIDTH for the sides and top,
                          FRAME_SILL_WIDTH for the lower run (a sill is deeper than a
                          mullion on every real canopy, and it has further to reach to cover
                          the bottom of the frame), and FRAME_OVERLAP for how far the band
                          laps INSIDE the glass edge so there is no seam. Read the apparent
                          width, not the metric one: the run prints what fraction of the
                          frame each side of the band actually covers.
    FRAME_CHAMFER_IN/_OUT The corner breaks. The INNER chamfer is the big one -- it is the
                          visible faceting, and it is what stops the opening reading as a
                          plain rectangle. The OUTER chamfer is small on purpose: the outer
                          boundary has to keep containing the frame's own corners, so it can
                          only be cut a little. The difference between them is why the
                          corners read as gussets, which is what Max's first reference shows.
    FRAME_DEPTH           How far the band stands toward the pilot. Deeper than RIB_DEPTH
                          because it is the outer structure and its inner wall is what gives
                          the opening a visible thickness from the seat.
    FRAME_GLASS_GAP       As RIB_GLASS_GAP, and derived the same way -- see frame_front_y().
    RIB_KINK_Z            Where the two rib kinks sit. Two named heights, three straight
                          runs. Fewer, longer runs with sharper joints read as a bent
                          structural member; more, shorter ones read as a curve.
    RIB_END_OVERRUN       How far each rib runs PAST the glass rim into the band, so the
                          joint is an embedded one rather than two surfaces touching.
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
    Material values       The previous revision's base colours (0.04 - 0.085 linear) were
                          near-black, and with the cabin light OFF -- which is what Max asked
                          for and is now the lab default -- the structure could not be
                          told from empty space, so its form could not be judged at all.
                          Raised to 0.13 - 0.21 linear, which reads under the lab's key light
                          alone. NOTE the low metalness: the lab has no environment map, so a
                          metal surface has nothing to reflect and goes BLACKER, not
                          brighter. The form is carried by the diffuse term; roughness is
                          what decides whether a facet catches the key as a highlight.
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
      * CANOPY_HALF_W / CANOPY_TOP_Z / CANOPY_BOT_Z are now the FRAMING lever, not just the
        shell's size: they set how much of the 70 deg view is clear opening and how much is
        perimeter band. The run prints each side of the band as a percentage of the frame's
        half-extent -- that percentage, not the width in metres, is what "fairly thin" means
        from the seat. Push a rim outboard past the frame edge and that side of the band
        disappears from the pilot's view entirely (which is the defect this revision fixes);
        pull it in and the band grows into a visor.
      * FRAME_WIDTH / FRAME_SILL_WIDTH must keep the band's OUTER boundary outside the frame
        edge, or the pilot sees a hole between the band and the edge of the screen. The run
        asserts that rather than trusting it -- see frame_covers_game_frame().
      * RIB_KINK_Z is the rib's shape. The run prints each rib's kink angles; if they fall
        below a few degrees the rib is reading as a curve again, which is the thing Max
        rejected.

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

# ---- Canopy shell (Canopy_Glass) -- the CLEAR OPENING ----------------------
# The rim is sized against the GAME FRAME, not against the cabin: it sits just INSIDE the
# 70 deg / 16:9 view on every side, so that the perimeter band hung outboard of it is
# visible from the seat as a thin edge. The previous revision's rim (2.35 / 1.38 / -1.54)
# subtended more than the frame in every direction, which is why that build had no visible
# enclosure at all. frame_side_coverage() prints where each rim actually lands.
CANOPY_Y_EDGE      = 1.70     # +Y of the shell's RIM -- its rearmost ring, a planar rectangle
CANOPY_BULGE       = 0.60     # extra +Y at the centre. THIS is the forward protrusion.
CANOPY_HALF_W      = 2.02     # rim half-width  (+/-X)
CANOPY_TOP_Z       = 1.12     # rim top
CANOPY_BOT_Z       = -1.04    # rim bottom -- highest of the three relative to the frame, so
                              # the band's lower run reads as a SILL under the screens
CANOPY_RIB_X       = 1.38     # |X| of the two vertical RIDGES. The centre panel is flat in X
                              # out to here; outboard of it the shell rakes back. That change
                              # of slope IS the ridge, and the ribs sit on it.
CANOPY_SHOULDER_X  = 1.72     # a second, shallower fold outboard of the ridge: extra faceting
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
    (-0.60,        0.62),
    (-0.10,        1.00),
    ( 0.48,        0.70),
    (CANOPY_TOP_Z, 0.00),
)

# ---- Canopy perimeter frame (Canopy_Frame) ---------------------------------
# A closed faceted ring lying on the shell's rim: the band where the glass meets the hull.
# INNER boundary  the rim rectangle pulled FRAME_OVERLAP into the opening, with a big corner
#                 chamfer -- this is the edge the pilot actually sees, and the chamfer is the
#                 visible faceting.
# OUTER boundary  the rim rectangle pushed out by FRAME_WIDTH (FRAME_SILL_WIDTH at the
#                 bottom), with a SMALL corner chamfer -- it has to keep containing the
#                 game frame's own corners, so it can only be cut a little.
# The two chamfers differing is what makes the corners read as gussets rather than as a
# constant-width bevel, which is the structure Max's first reference shows.
FRAME_WIDTH        = 0.16     # outward run of the band at the sides and the top
FRAME_SILL_WIDTH   = 0.24     # ...and at the bottom. A sill is deeper than a mullion, and it
                              # has further to reach: CANOPY_BOT_Z is the rim closest in.
FRAME_OVERLAP      = 0.025    # how far the band laps INSIDE the glass edge, so the glass runs
                              # under the band instead of butting against it and showing a
                              # hairline of background at the join
FRAME_DEPTH        = 0.100    # how far the band stands toward the pilot. Its inner wall is
                              # what gives the opening a visible thickness from the seat.
FRAME_CHAMFER_IN   = 0.22     # corner cut on the inner boundary -- the visible corner break
FRAME_CHAMFER_OUT  = 0.10     # ...and on the outer one. Kept small: see frame_covers_game_frame()
FRAME_GLASS_GAP    = 0.0015   # air held between the band's front face and the shell surface.
                              # As with the ribs, the STANDOFF that holds it is derived per
                              # station against the exported surface -- see frame_front_y().
                              # Deliberately SMALLER than RIB_GLASS_GAP: both are held behind
                              # the same flat rim, so equal gaps would leave the band's front
                              # face exactly coplanar with each rib's where the two overlap.
                              # Half a millimetre of difference puts the rib ends properly
                              # inside the band instead of flush with its skin.
FRAME_FOOT_SAMPLES = 7        # grid resolution when walking a band quad's footprint

# ---- Canopy ribs (Canopy_Rib_L / Canopy_Rib_R) -----------------------------
RIB_WIDTH          = 0.065    # across the strap. "Fairly thin" is the brief.
RIB_DEPTH          = 0.050    # how far the strap stands inboard of the glass, toward the eye
RIB_GLASS_GAP      = 0.002    # air held between the strap's outer face and the shell surface.
                              # HOW FAR the strap must stand off to hold that gap everywhere
                              # is derived per station, not authored -- see rib_sections().
RIB_KINK_Z         = (-0.55, 0.05)   # the two KINKS, in shell z. With the two ends below,
                              # that is four stations and THREE straight runs. Max's
                              # references show members that BEND as they rise; the bend is
                              # the protrusion cue, so the joints are few and sharp rather
                              # than many and shallow. rib_kink_angles() prints what they
                              # actually came out as.
RIB_END_OVERRUN    = 0.040    # how far each end runs PAST the glass rim, into the band, so
                              # the joint is embedded rather than merely touching
RIB_FRAME_JOIN_TOL = 0.012    # how far a rib end's outermost corner may sit outside the band
                              # solid before the joint stops reading as a joint
RIB_SOLVE_MAX_ITERS = 64
RIB_SOLVE_TOL      = 1e-12
RIB_PROBE_U        = (-1.0, -0.5, 0.0, 0.5, 1.0)     # across the strap, as fractions of its
RIB_PROBE_T        = (0.25, 0.5, 0.75)               # half-width, and along the ruled face
                              # toward each neighbouring station. The standoff solver walks
                              # this patch rather than only the station's two corners -- see
                              # violation() in rib_sections().

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
ARM_ROOT_Y         = 1.05     # depth of the root plane, forward of the eye. Deep enough that
                              # the WHOLE arm sits further from the eye than its screen's front
                              # face -- a shallower root swings the strut around in front of
                              # its own bezel, which reads as a bug rather than as a mount.
                              # arm_in_front_of_box() below is the check that catches it.
                              # Raised from 0.95 with the chunkier cross-section: a thicker
                              # strut swings its corners further from its own axis, which ate
                              # the margin (19 mm -> 6 mm). At 1.05 it is back to 12 mm, the
                              # frustum clearance improves too, and the arm reads longer.
ARM_ROOT_TAN_X     = 1.55     # root position expressed in TAN COORDINATES at that depth, so
ARM_ROOT_TAN_Z     = 0.92     # "outside the frustum" is stated in the units it is checked in
                              # (the 70 deg / 16:9 frame is tan 1.2448 x 0.7002). Clearance
                              # from the frustum grows with ARM_ROOT_Y at fixed tangents, so
                              # pushing the root deeper helps both properties at once.
ARM_ROOT_CLEARANCE_MIN = 0.05  # metres the root must clear the nearest frustum side plane by
ARM_ATTACH_U       = 0.65     # where the arm lands on the back plate, as a fraction of its
ARM_ATTACH_W       = 0.55     # half-extents, toward the OUTBOARD-FAR corner
ARM_EMBED          = 0.010    # tip pushed this far into the box, so there is no seam gap
# Cross-section: raised from (0.035, 0.045) root / (0.020, 0.026) tip, which read as sticks.
# Max's first reference shows short CHUNKY brackets, so the strut is now roughly a 100 x 124
# mm section at the root tapering to 64 x 80 mm. Still tapered, still six flat faces.
ARM_ROOT_HALF_U    = 0.050    # tapered rectangular strut: half-extents at the root...
ARM_ROOT_HALF_W    = 0.062
ARM_TIP_HALF_U     = 0.032    # ...and at the tip
ARM_TIP_HALF_W     = 0.040

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

# Material base colours (linear RGB), roughness and metalness.
#
# WHY THESE ARE NOT NEAR-BLACK ANY MORE. The previous revision sat at 0.042 - 0.085 linear.
# The lab's cabin light is OFF by default (Max, this session) and the only remaining sources
# are a key, a weak fill and 0.22 of ambient, so every surface facing away from the key
# rendered at roughly ambient x albedo -- which at 0.055 is indistinguishable from empty
# space. The structure could not be judged because it could not be seen. Max's references are
# dark but READABLE: their form comes off specular and edge highlights under a bright key.
#
# WHY THE METALNESS IS LOW. The lab has no environment map. A metallic surface has no diffuse
# term and nothing to reflect except three analytic lights, so raising metalness makes a part
# DARKER and flatter, not shinier -- which is part of why the old arms read as thin sticks at
# metalness 0.6. Form is carried by diffuse; roughness decides which facets catch the key.
MAT_FRAME_RGB      = (0.155, 0.160, 0.172)   # ribs + perimeter band: cool structural grey.
MAT_FRAME_ROUGH    = 0.42                    # satin: each facet takes a different share of
MAT_FRAME_METAL    = 0.15                    # the key, so the folds read as folds
MAT_SCREEN_RGB     = (0.010, 0.012, 0.011)   # display faces: STAYS near-black -- it is an
MAT_SCREEN_ROUGH   = 0.28                    # unlit CRT until increment 2 lights it
MAT_SCREEN_METAL   = 0.0
MAT_BODY_RGB       = (0.205, 0.208, 0.220)   # screen boxes: lighter than the frame, so the
MAT_BODY_ROUGH     = 0.38                    # bezel reads as a bezel against the structure
MAT_BODY_METAL     = 0.10                    # behind it and the near-black display face in it
MAT_ARM_RGB        = (0.128, 0.130, 0.140)   # arms: darker than the frame so the brackets
MAT_ARM_ROUGH      = 0.34                    # read as separate parts, and the smoothest of
MAT_ARM_METAL      = 0.30                    # the three so a machined highlight runs the edge
MAT_GLASS_RGB      = (0.030, 0.045, 0.055)   # canopy shell placeholder
MAT_GLASS_ROUGH    = 0.08
MAT_GLASS_ALPHA    = 0.12     # so the lab can see THROUGH the shell. Increment 3 replaces the
                              # whole material with real transmissive glass.

# Node names. The headless tests key off these -- do not rename without updating the tests.
NAME_EYE           = "Eye_Point"
NAME_GLASS         = "Canopy_Glass"
NAME_FRAME         = "Canopy_Frame"     # NOT the deleted "Cockpit_Frame" -- see the docstring
NAME_RIBS          = ("Canopy_Rib_L", "Canopy_Rib_R")   # order matches CANOPY_RIB_COLUMNS
NAME_DELETED       = ("Hull_Nose", "Cockpit_Frame")     # must never come back
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


# =============================================================================
# Canopy_Frame -- the perimeter band where the glass meets the hull
# =============================================================================

def _chamfered_ring(half_w, top_z, bot_z, chamfer):
    """A rectangle with its four corners cut off, as an ordered list of (x, z).

    Eight vertices, eight straight runs, eight corner breaks -- folded metal rather than a
    moulded ring. The traversal order is fixed and is NOT arbitrary: it is the order for
    which (U, W, T) comes out right-handed at every station, with U the outward direction in
    the rim plane, W = -Y (toward the pilot) and T the direction of travel. That is what lets
    build_frame() wind every face outward without a per-face orientation test, exactly as
    loft() does for the ribs.

        bottom run travels -X, left run +Z, top run +X, right run -Z.
    """
    if chamfer <= 0.0:
        raise ValueError("a chamfer of %.4f m would leave the ring's corners square, and a "
                         "square corner puts two stations at the same point" % chamfer)
    if 2.0 * chamfer >= min(2.0 * half_w, top_z - bot_z):
        raise ValueError(
            "chamfer %.4f m is at least half the ring it is cutting (%.4f x %.4f m); the "
            "straight runs between the corners would vanish" % (chamfer, 2.0 * half_w,
                                                                top_z - bot_z))
    return (
        ( half_w - chamfer, bot_z),            # bottom run, right end   (travel -X)
        (-half_w + chamfer, bot_z),            # bottom run, left end
        (-half_w,           bot_z + chamfer),  # bottom-left break       (travel +Z)
        (-half_w,           top_z - chamfer),  # left run, top end
        (-half_w + chamfer, top_z),            # top-left break          (travel +X)
        ( half_w - chamfer, top_z),            # top run, right end
        ( half_w,           top_z - chamfer),  # top-right break         (travel -Z)
        ( half_w,           bot_z + chamfer),  # right run, bottom end
    )


def frame_polygons():
    """The band's inner and outer (x, z) boundaries, matched station for station.

    Inner: the rim pulled FRAME_OVERLAP INTO the opening, so the glass runs under the band.
    Outer: the rim pushed out by FRAME_WIDTH (FRAME_SILL_WIDTH at the bottom).

    Both are chamfered, but by different amounts, and that difference is the design: a big
    inner chamfer is the visible corner break, while the outer one has to stay small because
    the outer boundary is what closes the pilot's view at the corners.
    """
    inner = _chamfered_ring(CANOPY_HALF_W - FRAME_OVERLAP,
                            CANOPY_TOP_Z - FRAME_OVERLAP,
                            CANOPY_BOT_Z + FRAME_OVERLAP,
                            FRAME_CHAMFER_IN)
    outer = _chamfered_ring(CANOPY_HALF_W + FRAME_WIDTH,
                            CANOPY_TOP_Z + FRAME_WIDTH,
                            CANOPY_BOT_Z - FRAME_SILL_WIDTH,
                            FRAME_CHAMFER_OUT)
    if len(inner) != len(outer):
        raise ValueError("the band's two boundaries have different station counts")
    for j in range(len(inner)):
        if (inner[j][0] - outer[j][0]) ** 2 + (inner[j][1] - outer[j][1]) ** 2 < 1e-12:
            raise ValueError("band station %d has zero width: the inner and outer boundaries "
                             "meet at (%.4f, %.4f)" % (j, inner[j][0], inner[j][1]))
    return inner, outer


def frame_front_y():
    """The y of the band's FRONT face at each station -- DERIVED, never authored.

    The band has to sit behind the shell everywhere it laps over it, and "everywhere" has to
    include the INTERIOR of each quad, not just its stations: the quads are metres long and
    the shell is folded, so two clear stations can straddle a bulge that is not.

    So each station takes the minimum of (surface - FRAME_GLASS_GAP) over the footprints of
    BOTH quads it belongs to. That is what makes the guarantee airtight rather than likely:
    for the quad between stations j and j+1, both endpoints are then <= the minimum over that
    quad's own footprint, and the front face is ruled between them, so no point on it can
    rise above the surface. frame_glass_clearance() re-measures the finished mesh
    independently, so a wrong derivation shows up there rather than being confirmed by its
    own arithmetic.

    HONEST NOTE ON WHAT THIS BOUGHT AT THE SHIPPED CONSTANTS: nothing visible. Every station
    comes out at exactly CANOPY_Y_EDGE - FRAME_GLASS_GAP, because every footprint reaches
    OUTBOARD of the rim, where the shell has ended and canopy_surface_y() clamps to the rim
    plane -- so the flat rim is what binds, at every station, and a hand-written 2 mm gap
    would have produced the same numbers. That is the right answer rather than a missing one,
    and the derivation is not decoration: move the band's whole footprint inboard onto the
    bulge (which is what a re-author widening FRAME_OVERLAP past FRAME_WIDTH would do) and
    the stations spread out over ~75 mm to follow the surface, with the independent walk in
    frame_glass_clearance() still reporting the full FRAME_GLASS_GAP. The point of deriving
    it is that the constants block is meant to be re-authored -- same reasoning as
    canopy_surface_y()'s note about the twist.
    """
    inner, outer = frame_polygons()
    n = len(inner)

    def quad_min(j):
        k = (j + 1) % n
        worst = None
        for a in range(FRAME_FOOT_SAMPLES):
            ta = a / float(FRAME_FOOT_SAMPLES - 1)
            i_edge = (inner[j][0] + ta * (inner[k][0] - inner[j][0]),
                      inner[j][1] + ta * (inner[k][1] - inner[j][1]))
            o_edge = (outer[j][0] + ta * (outer[k][0] - outer[j][0]),
                      outer[j][1] + ta * (outer[k][1] - outer[j][1]))
            for b in range(FRAME_FOOT_SAMPLES):
                tb = b / float(FRAME_FOOT_SAMPLES - 1)
                x = i_edge[0] + tb * (o_edge[0] - i_edge[0])
                z = i_edge[1] + tb * (o_edge[1] - i_edge[1])
                v = canopy_surface_y(x, z) - FRAME_GLASS_GAP
                if worst is None or v < worst:
                    worst = v
        return worst

    quads = [quad_min(j) for j in range(n)]
    return [min(quads[j - 1], quads[j]) for j in range(n)]


def frame_stations():
    """(inner_point, outer_point, front_y) per station, in Blender coordinates."""
    inner, outer = frame_polygons()
    ys = frame_front_y()
    out = []
    for j in range(len(inner)):
        out.append(((inner[j][0], ys[j], inner[j][1]),
                    (outer[j][0], ys[j], outer[j][1]),
                    ys[j]))
    return out


def build_frame():
    """Canopy_Frame: a CLOSED, consistently wound ring solid.

    Four vertices per station -- inner and outer, front and back -- and four quads per run:
    front, back, outer wall, inner wall. No caps: the ring closes on itself, which is what
    makes it one solid rather than eight bars laid end to end.

    Winding: U (outward, in the rim plane), W = -Y (toward the pilot) and T (the direction of
    travel) are right-handed in the station order _chamfered_ring() returns, so writing the
    faces in the fixed order below puts every normal OUT of the solid. There is no
    orientation test here for the same reason there is none in loft(): the basis decides it.
    """
    stations = frame_stations()
    n = len(stations)
    verts = []
    for (i_pt, o_pt, _y) in stations:
        verts.append(i_pt)                                        # 4j + 0  inner front
        verts.append(o_pt)                                        # 4j + 1  outer front
        verts.append((o_pt[0], o_pt[1] - FRAME_DEPTH, o_pt[2]))   # 4j + 2  outer back
        verts.append((i_pt[0], i_pt[1] - FRAME_DEPTH, i_pt[2]))   # 4j + 3  inner back
    faces = []
    for j in range(n):
        a = 4 * j
        b = 4 * ((j + 1) % n)
        faces.append((a + 0, a + 1, b + 1, b + 0))   # front  -> +Y, away from the eye
        faces.append((b + 3, b + 2, a + 2, a + 3))   # back   -> toward the eye
        faces.append((a + 1, a + 2, b + 2, b + 1))   # outer wall -> outward
        faces.append((b + 0, b + 3, a + 3, a + 0))   # inner wall -> into the opening
    return verts, faces


def frame_segments():
    """One convex piece per run. Predictor and containment test only, never exported.

    A ring is not convex, so its silhouette cannot be taken as one hull -- but each run
    between two stations is a prismatoid between two planar quads, and its hull IS its
    silhouette. Same reasoning as loft_segments() for a bowed rib.
    """
    stations = frame_stations()
    n = len(stations)
    segs = []
    for j in range(n):
        k = (j + 1) % n
        v = []
        for idx in (j, k):
            i_pt, o_pt, _y = stations[idx]
            v.append(i_pt)
            v.append(o_pt)
            v.append((o_pt[0], o_pt[1] - FRAME_DEPTH, o_pt[2]))
            v.append((i_pt[0], i_pt[1] - FRAME_DEPTH, i_pt[2]))
        f = [(0, 1, 2, 3), (7, 6, 5, 4),
             (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
        segs.append((v, f))
    return segs


FRAME_CHECK_SAMPLES = 10   # subdivisions per barycentric axis when walking the band's front


def frame_glass_clearance():
    """Smallest gap between the band's finished FRONT face and the exported shell, in metres.

    Independent of frame_front_y()'s solver on purpose: it walks the triangles that actually
    ship, sampling their interiors rather than only their corners. Negative means the band
    has broken through the glass.

    Conservative outboard of the rim, where canopy_surface_y() clamps to CANOPY_Y_EDGE and so
    reports glass over a stretch of bare hull. That is the safe direction for a clearance.
    """
    stations = frame_stations()
    n = len(stations)
    worst = None
    for j in range(n):
        k = (j + 1) % n
        i_a, o_a, _ya = stations[j]
        i_b, o_b, _yb = stations[k]
        for tri in ((i_a, o_a, o_b), (i_a, o_b, i_b)):
            for p in _tri_grid(tri[0], tri[1], tri[2], FRAME_CHECK_SAMPLES):
                clr = canopy_surface_y(p[0], p[2]) - p[1]
                if worst is None or clr < worst:
                    worst = clr
    return worst if worst is not None else 0.0


def _newell_planes(verts, faces):
    """Outward-facing planes (normal, offset) of a convex-ish solid.

    Newell's method, so a quad that twists by a fraction of a millimetre still yields a
    stable plane, and each plane is then flipped if it puts the solid's own centroid outside
    -- which makes the result independent of face winding. The band's runs twist only where
    the derived standoff steps between stations, which is sub-millimetre at these constants.
    """
    cx = sum(v[0] for v in verts) / len(verts)
    cy = sum(v[1] for v in verts) / len(verts)
    cz = sum(v[2] for v in verts) / len(verts)
    centre = (cx, cy, cz)
    planes = []
    for f in faces:
        nx = ny = nz = 0.0
        m = len(f)
        for i in range(m):
            a = verts[f[i]]
            b = verts[f[(i + 1) % m]]
            nx += (a[1] - b[1]) * (a[2] + b[2])
            ny += (a[2] - b[2]) * (a[0] + b[0])
            nz += (a[0] - b[0]) * (a[1] + b[1])
        nrm = (nx, ny, nz)
        if v_len(nrm) < 1e-12:
            continue
        nrm = v_norm(nrm)
        d = v_dot(nrm, verts[f[0]])
        if v_dot(nrm, centre) - d > 0.0:
            nrm = v_mul(nrm, -1.0)
            d = -d
        planes.append((nrm, d))
    return planes


def _outside_distance(planes, p):
    """How far p lies outside a convex solid: <= 0 means inside.

    The max over the bounding half-spaces. Exact for a point over a face; near an edge or a
    corner it UNDER-reports the true distance, which is stated here because it matters for
    how the result is read: "inside" (<= 0) is exact and unambiguous, while a small positive
    number is a lower bound on how far out the point really is.
    """
    worst = None
    for (nrm, d) in planes:
        s = v_dot(nrm, p) - d
        if worst is None or s > worst:
            worst = s
    return worst if worst is not None else 0.0


def frame_solid_distance(p):
    """Smallest _outside_distance over the band's runs. <= 0 means p is inside the band."""
    best = None
    for (v, f) in frame_segments():
        s = _outside_distance(_newell_planes(v, f), p)
        if best is None or s < best:
            best = s
    return best if best is not None else 0.0


def frame_covers_game_frame():
    """Does the band's outer boundary close the pilot's view at all four corners?

    If it does not, there is a strip of nothing between the edge of the cockpit and the edge
    of the screen -- the pilot looks past the ship and sees background where hull should be.
    The check is against the band's FRONT ring, which is the conservative choice: the back
    ring is nearer the eye and so projects further out.

    The outer boundary is convex, so its projected hull is exactly its silhouette and the
    test is exact rather than approximate.
    """
    tan_h, tan_v = frame_tangents()
    corners = [(-tan_h, -tan_v), (tan_h, -tan_v), (tan_h, tan_v), (-tan_h, tan_v)]
    hull = convex_hull_2d([project_tan(o_pt) for (_i, o_pt, _y) in frame_stations()])
    return all(point_in_convex_ccw(hull, c) for c in corners), hull


# Which stations bound each straight run of the ring, in _chamfered_ring()'s fixed order,
# and which tan axis that run is measured on. The corner chamfers between them are excluded
# on purpose: a gusset reaching further in is a different fact from a run being thick.
FRAME_RUNS = (
    ("bottom", 0, 1, "v"),
    ("left",   2, 3, "h"),
    ("top",    4, 5, "v"),
    ("right",  6, 7, "h"),
)


def frame_side_coverage():
    """Where each straight run of the band lands in the pilot's frame.

    The number that decides whether "fairly thin" was achieved is not the width in metres --
    it is how much of the view the band eats. This reports, per run, the tan position of its
    INNER edge as a fraction of the frame's half-extent on that axis. 0.94 means the band
    covers the outer 6% of that side; 1.0 or more means the run is entirely outside the view
    and the pilot cannot see it at all -- which is precisely the defect this revision exists
    to fix, and why the constant that decides it (the rim) is now sized against the frame.

    Measured on the FRONT ring. tan = coordinate / y, so the front edge (largest y) is the
    innermost point of the silhouette and therefore the one the pilot sees the band begin at.
    """
    tan_h, tan_v = frame_tangents()
    stations = frame_stations()
    out = {}
    for (label, a, b, axis) in FRAME_RUNS:
        ta = project_tan(stations[a][0])
        tb = project_tan(stations[b][0])
        if axis == "h":
            out[label] = min(abs(ta[0]), abs(tb[0])) / tan_h
        else:
            out[label] = min(abs(ta[1]), abs(tb[1])) / tan_v
    return out


def rib_station_z():
    """The rib's stations in shell z, bottom to top.

    THREE long runs -- rim to kink, kink to kink, kink to rim -- which is the shape Max asked
    for, plus a short FLAT stub at each end that runs RIB_END_OVERRUN past the glass rim into
    the perimeter band, so each rib terminates INSIDE the frame solid rather than stopping at
    its face. A rib that stops short reads as floating, which is half of the defect this
    revision is fixing, so rib_end_joins() measures the joint rather than trusting it.

    The stubs have to be FLAT, and that is not cosmetic. Outside the rim the shell's row
    profile clamps, so canopy_y() is level at CANOPY_Y_EDGE there. A stub that ran straight
    from below the rim up to the first kink would climb while the surface under it stayed
    level, and would come out ~30 mm in FRONT of the glass -- which is exactly what
    rib_glass_clearance() caught on the first build of this revision. Landing the rib on the
    rim first and only then running the stub out level keeps every run behind the surface it
    follows.
    """
    zs = ((CANOPY_BOT_Z - RIB_END_OVERRUN, CANOPY_BOT_Z) + tuple(RIB_KINK_Z)
          + (CANOPY_TOP_Z, CANOPY_TOP_Z + RIB_END_OVERRUN))
    for i in range(len(zs) - 1):
        if zs[i + 1] <= zs[i]:
            raise ValueError(
                "the rib's stations must climb: station %d is at z = %.4f and station %d is "
                "at z = %.4f. Check RIB_KINK_Z (%s) against CANOPY_BOT_Z / CANOPY_TOP_Z."
                % (i, zs[i], i + 1, zs[i + 1], ", ".join("%.3f" % z for z in RIB_KINK_Z)))
    for z in RIB_KINK_Z:
        if not (CANOPY_BOT_Z < z < CANOPY_TOP_Z):
            raise ValueError(
                "rib kink at z = %.4f is outside the canopy opening (%.4f .. %.4f), so it "
                "would sit on clamped profile and produce no kink at all"
                % (z, CANOPY_BOT_Z, CANOPY_TOP_Z))
    return zs


def rib_path(col_index):
    """The rib's centre-line: one point per station, lying on the shell.

    Short and explicit. Three straight runs between four stations, which is what makes the
    two joints read as KINKS; the previous revision took one station per canopy row and the
    result read as a swept curve, which Max rejected.

    x is held on the ridge (CANOPY_RIB_X), so the strap still lies along the shell's sharpest
    crease and the standoff solver still has a well-defined surface under it. The shape comes
    from z and from the bulge the shell gives each z -- "up and forward over the crest".
    """
    _check_rib_columns()
    x = CANOPY_COLUMNS[col_index][0]
    return [(x, canopy_y(x, z), z) for z in rib_station_z()]


def rib_kink_angles(col_index):
    """Turn angle in degrees at each interior station. A curve measures near zero at each."""
    pts = rib_path(col_index)
    out = []
    for j in range(1, len(pts) - 1):
        a = v_norm(v_sub(pts[j], pts[j - 1]))
        b = v_norm(v_sub(pts[j + 1], pts[j]))
        c = v_dot(a, b)
        c = -1.0 if c < -1.0 else (1.0 if c > 1.0 else c)
        out.append(math.degrees(math.acos(c)))
    return out


def rib_sections(col_index):
    """Cross-sections of one rib, one per station, following that column's ridge.

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

    T is a CENTRAL difference at the interior stations, which mitres each joint: the two runs
    meeting there keep their own orientations and their faces meet at an angle. That is what
    makes a kink visible as a crease rather than as a smooth blend.
    """
    pts = rib_path(col_index)
    nr = len(pts)
    hw = RIB_WIDTH * 0.5

    frames = []
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
        frames.append((pts[j], W, U))

    sections = []
    for j in range(nr):
        P, W, U = frames[j]
        neighbours = []
        if j > 0:
            neighbours.append(frames[j - 1])
        if j < nr - 1:
            neighbours.append(frames[j + 1])

        def violation(s, _P=P, _W=W, _U=U, _n=neighbours):
            """How far the worst point of this station's front face is IN FRONT of where it
            is allowed to be, in metres.

            Samples the ruled face TOWARD each neighbour, not just the station's own two
            corners. The face between two stations is a ruled quad and the shell under it is
            folded, so both ends can clear while the middle does not: the first build of this
            revision solved corner-only and came out with 0.5 mm where it had asked for 2 mm.
            The neighbour is probed at this station's own standoff, which is an approximation
            (its solved value differs by a fraction of a millimetre here) -- so
            rib_glass_clearance() still walks the finished mesh independently, and that walk
            is what the assertion in analyse() reads.
            """
            worst = None
            base = v_add(_P, v_mul(_W, s))
            for f in RIB_PROBE_U:
                c = v_add(base, v_mul(_U, f * hw))
                probes = [c]
                for (Pk, Wk, Uk) in _n:
                    ck = v_add(v_add(Pk, v_mul(Wk, s)), v_mul(Uk, f * hw))
                    d = v_sub(ck, c)
                    for t in RIB_PROBE_T:
                        probes.append(v_add(c, v_mul(d, t)))
                for p in probes:
                    gap = p[1] + RIB_GLASS_GAP - canopy_surface_y(p[0], p[2])
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

        base = v_add(P, v_mul(W, standoff))
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


def rib_end_joins(col_index):
    """Does each end of this rib actually terminate ON the perimeter band?

    A rib that stops short of the frame reads as a bar hanging in space -- which is half of
    the defect this revision exists to fix -- and nothing else in this script would notice,
    because a floating rib still clears the glass, still bows, and still occludes. So it gets
    its own measurement: for each end cross-section, how far its corners and its centroid lie
    OUTSIDE the band solid. Zero or negative is embedded.

    The instrument is checked against a PLANTED DEFECT in the same call: the same end
    section, translated one metre back along the rib toward the crest, must read as clearly
    outside. A containment test that cannot fail is not a test -- see
    feedback_measurement-channels-need-planted-defects.md.
    """
    secs = rib_sections(col_index)
    pts = rib_path(col_index)
    out = []
    for (label, idx, toward) in (("foot", 0, 1), ("head", len(secs) - 1, len(secs) - 2)):
        sec = secs[idx]
        centroid = v_mul((sec[0][0] + sec[1][0] + sec[2][0] + sec[3][0],
                          sec[0][1] + sec[1][1] + sec[2][1] + sec[3][1],
                          sec[0][2] + sec[1][2] + sec[2][2] + sec[3][2]), 0.25)
        corner_worst = max(frame_solid_distance(c) for c in sec)
        inward = v_norm(v_sub(pts[toward], pts[idx]))
        planted = frame_solid_distance(v_add(centroid, v_mul(inward, 1.0)))
        out.append({
            "end": label,
            "centroidOutsideBy": frame_solid_distance(centroid),
            "worstCornerOutsideBy": corner_worst,
            "plantedDefectOutsideBy": planted,
        })
    return out


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
    fv, ff = build_frame()
    parts.append({"name": NAME_FRAME, "verts": fv, "faces": ff,
                  "material": "Mat_Frame", "kind": "frame"})
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
        if part["name"] in NAME_DELETED:
            raise ValueError(
                "part %r is one of the nodes Max deleted at UAT on 1056f30 (%s). Canopy_Frame "
                "is the perimeter band on the canopy's own edge and is NOT a revival of the "
                "free-standing octagonal ring; if a build ever emits one of the deleted names "
                "again that is an AC-FORM failure, not a naming accident."
                % (part["name"], ", ".join(NAME_DELETED)))
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

    # ---- Canopy shell: excluded from occlusion, but it must actually span the OPENING ----
    # NOTE what changed with the perimeter band: the shell alone no longer covers the whole
    # game frame, and is not supposed to. The clear opening now sits just inside the frame
    # edge and Canopy_Frame closes the remaining margin. What must still hold is that the
    # ASSEMBLY leaves no gap -- see frame_covers_game_frame(), asserted below.
    gv, gf = build_canopy()
    glass_hull = convex_hull_2d([project_tan(p) for p in gv])
    glass_covers_frame = all(point_in_convex_ccw(glass_hull, c) for c in frame_rect)
    glass_min_dist = min(v_len(p) for p in gv)

    # ---- Canopy_Frame: the perimeter band ----
    frame_polys = [silhouette_tan(sv, sf) for (sv, sf) in frame_segments()]
    frame_clearance = frame_glass_clearance()
    if frame_clearance < 0.0:
        raise ValueError(
            "Canopy_Frame breaks through Canopy_Glass by %.4f m. The band's front face is "
            "held behind the shell by a standoff derived per station in frame_front_y(), so "
            "either FRAME_OVERLAP (%.4f m) now laps far enough inboard to reach a fold the "
            "footprint sampling steps over, or FRAME_FOOT_SAMPLES (%d) is too coarse for the "
            "facet it is walking. Raise FRAME_FOOT_SAMPLES or reduce FRAME_OVERLAP."
            % (-frame_clearance, FRAME_OVERLAP, FRAME_FOOT_SAMPLES))

    frame_covers, _frame_hull = frame_covers_game_frame()
    if not frame_covers:
        raise ValueError(
            "Canopy_Frame's outer boundary does not close the %.0f deg / %.4f view at every "
            "corner, so the pilot would see background in the gap between the edge of the "
            "cockpit and the edge of the screen.\n"
            "  Fix: widen FRAME_WIDTH (%.3f m) / FRAME_SILL_WIDTH (%.3f m), or cut less off "
            "the corners with FRAME_CHAMFER_OUT (%.3f m) -- the outer chamfer is the usual "
            "culprit, because it is the corners that run out of cover first."
            % (GAME_FOV_DEG, GAME_ASPECT, FRAME_WIDTH, FRAME_SILL_WIDTH, FRAME_CHAMFER_OUT))

    frame_stns = frame_stations()
    frame_standoffs = [CANOPY_Y_EDGE - y for (_i, _o, y) in frame_stns]
    frame_detail = {
        "name": NAME_FRAME,
        "stations": len(frame_stns),
        "standoffMin": min(frame_standoffs),
        "standoffMax": max(frame_standoffs),
        "glassClearance": frame_clearance,
        "coversGameFrame": frame_covers,
        "sideCoverage": frame_side_coverage(),
        "ownOcclusion": coverage_fraction(frame_polys),
    }

    # ---- Ribs ----
    rib_polys = []
    rib_detail = []
    for k, col in enumerate(CANOPY_RIB_COLUMNS):
        secs = rib_sections(col)
        polys = [silhouette_tan(sv, sf) for (sv, sf) in loft_segments(secs)]
        rib_polys.extend(polys)
        path = rib_path(col)
        tans = [project_tan(p) for p in path]
        inner = min(range(len(tans)), key=lambda i: abs(tans[i][0]))
        standoffs = [v_len(v_sub(v_mul(v_add(s[0], s[3]), 0.5), path[j]))
                     for j, s in enumerate(secs)]
        rib_detail.append({
            "name": NAME_RIBS[k],
            "columnIndex": col,
            "stations": len(path),
            "tanXAtFoot": tans[0][0],
            "tanXAtCrest": tans[inner][0],
            "angleAtFootDeg": math.degrees(math.atan(abs(tans[0][0]))),
            "angleAtCrestDeg": math.degrees(math.atan(abs(tans[inner][0]))),
            "kinkAnglesDeg": rib_kink_angles(col),
            "standoffMin": min(standoffs),
            "standoffMax": max(standoffs),
            "glassClearance": rib_glass_clearance(col),
            "joins": rib_end_joins(col),
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

    # A rib must land ON the band at both ends, or it reads as a bar hanging in space -- the
    # "monitors on lamp-posts" defect. Checked, not assumed.
    floating = []
    for d in rib_detail:
        for j in d["joins"]:
            if j["centroidOutsideBy"] > 0.0 or j["worstCornerOutsideBy"] > RIB_FRAME_JOIN_TOL:
                floating.append((d["name"], j))
    if floating:
        lines = ["    %s %s end: centre %.4f m outside the band, worst corner %.4f m "
                 "(tolerance %.4f m)"
                 % (nm, j["end"], j["centroidOutsideBy"], j["worstCornerOutsideBy"],
                    RIB_FRAME_JOIN_TOL) for (nm, j) in floating]
        raise ValueError(
            "a canopy rib does not terminate on Canopy_Frame:\n%s\n"
            "  Fix: raise RIB_END_OVERRUN (currently %.3f m) so the end runs further into the "
            "band, or widen the band on that side -- a rib that stops short of the frame is "
            "the floating-bar look Max rejected."
            % ("\n".join(lines), RIB_END_OVERRUN))

    # The containment test's own planted defect: the same end section, displaced a metre up
    # the rib, must read as clearly outside. A check that cannot fail proves nothing.
    blind = [(d["name"], j) for d in rib_detail for j in d["joins"]
             if j["plantedDefectOutsideBy"] < 0.10]
    if blind:
        raise ValueError(
            "the rib-to-frame containment test is not discriminating: a point planted 1.0 m "
            "away from the joint still reads as only %.4f m outside the band (%s %s end). "
            "frame_solid_distance() is not measuring what it claims to."
            % (blind[0][1]["plantedDefectOutsideBy"], blind[0][0], blind[0][1]["end"]))

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

    # Nothing may be inside the band. The screens and arms live well inboard of it, but the
    # band is new geometry and "well inboard" is an assumption, not a measurement -- and a
    # screen box pushed outboard by a re-author would otherwise disappear into the hull
    # silently, because the union counts overlapping occluders once either way.
    in_frame = []
    for un in units:
        for (nm, vs) in ((BODY_PREFIX + un["suffix"], un["bodyVerts"]),
                         (SCREEN_PREFIX + un["suffix"], un["faceVerts"]),
                         (ARM_PREFIX + un["suffix"], un["armVerts"])):
            for v in vs:
                d = frame_solid_distance(v)
                if d <= 0.0:
                    in_frame.append((nm, v, d))
    if in_frame:
        nm, v, d = in_frame[0]
        raise ValueError(
            "%d vertices of the screen units / arms are buried inside Canopy_Frame -- e.g. %s "
            "at (%.4f, %.4f, %.4f), %.4f m in. They would be swallowed by the hull band.\n"
            "  Fix: pull the units inboard (lower SCREEN_TAN_X / SCREEN_TAN_Z_*), or move the "
            "band outboard by widening the opening."
            % (len(in_frame), nm, v[0], v[1], v[2], -d))
    min_clear_of_frame = min(frame_solid_distance(v)
                             for un in units
                             for v in (un["bodyVerts"] + un["faceVerts"] + un["armVerts"]))

    if max_unit_dist >= glass_min_dist:
        raise ValueError(
            "a screen unit or arm reaches %.4f m from the eye, but the nearest point of "
            "Canopy_Glass is only %.4f m away -- the screens would punch through the canopy. "
            "Lower SCREEN_DIST, or push the shell out with CANOPY_Y_EDGE / CANOPY_BULGE."
            % (max_unit_dist, glass_min_dist))

    # ---- Occlusion. Canopy_Glass is NOT in any of these lists, by design. Canopy_Frame IS:
    # it is opaque hull, and it is the single biggest change this revision makes to what the
    # pilot sees. The marginal order is ribs -> frame -> screens -> arms.
    ribs_own = coverage_fraction(rib_polys)
    frame_own = coverage_fraction(frame_polys)
    screens_own = coverage_fraction(screen_polys)
    arms_own = coverage_fraction(arm_polys)
    ribs_marginal = ribs_own
    ribs_frame = coverage_fraction(rib_polys + frame_polys)
    frame_marginal = ribs_frame - ribs_own
    ribs_frame_screens = coverage_fraction(rib_polys + frame_polys + screen_polys)
    screens_marginal = ribs_frame_screens - ribs_frame
    total = coverage_fraction(rib_polys + frame_polys + screen_polys + arm_polys)
    arms_marginal = total - ribs_frame_screens

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
        "assemblyCoversFrame": frame_covers,
        "canopyHalfAnglesDeg": {
            "leftRight": math.degrees(math.atan(CANOPY_HALF_W / CANOPY_Y_EDGE)),
            "up": math.degrees(math.atan(CANOPY_TOP_Z / CANOPY_Y_EDGE)),
            "down": math.degrees(math.atan(-CANOPY_BOT_Z / CANOPY_Y_EDGE)),
        },

        "frameDetail": frame_detail,
        "ribDetail": rib_detail,
        "screenDetail": screen_detail,
        "armDetail": arm_detail,
        "maxUnitDistance": max_unit_dist,
        "minUnitClearanceOfFrame": min_clear_of_frame,

        "occlusionTotal": total,
        "occlusionRibsOwn": ribs_own,
        "occlusionFrameOwn": frame_own,
        "occlusionScreensOwn": screens_own,
        "occlusionArmsOwn": arms_own,
        "occlusionRibsMarginal": ribs_marginal,
        "occlusionFrameMarginal": frame_marginal,
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
        Canopy_Rib_* /        closed solids too, but the lab orbits outside the cockpit, so
        Canopy_Frame          Mat_Frame is double-sided to avoid the structure reading as
                              "the ribs and the band vanished" from half the orbit.
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
            "stations": d["stations"],
            "stationZ": [r6(z) for z in rib_station_z()],
            "kinkAnglesDeg": [r6(a) for a in d["kinkAnglesDeg"]],
            "standoffFromRidgeMin": r6(d["standoffMin"]),
            "standoffFromRidgeMax": r6(d["standoffMax"]),
            "measuredGlassClearance": r6(d["glassClearance"]),
            "angleAtFootDeg": r6(d["angleAtFootDeg"]),
            "angleAtCrestDeg": r6(d["angleAtCrestDeg"]),
            "bowDeg": r6(d["angleAtFootDeg"] - d["angleAtCrestDeg"]),
            "bowTanSpace": r6(abs(d["tanXAtFoot"]) - abs(d["tanXAtCrest"])),
            "endsOnFrame": [
                {"end": j["end"],
                 "centreOutsideFrameBy": r6(j["centroidOutsideBy"]),
                 "worstCornerOutsideFrameBy": r6(j["worstCornerOutsideBy"]),
                 "plantedDefectOutsideFrameBy": r6(j["plantedDefectOutsideBy"])}
                for j in d["joins"]
            ],
        })

    fd = analysis["frameDetail"]
    inner_ring, outer_ring = frame_polygons()
    canopy_frame = {
        "name": NAME_FRAME,
        "what": ("the band where the glass meets the hull: a closed faceted ring on the "
                 "canopy's own edge, the whole way round INCLUDING THE BOTTOM. This is the "
                 "'fairly thin' frame Max asked for, and its lower run is the simple sill "
                 "his second reference shows under the screens."),
        "notCockpitFrame": ("distinct from the deleted Cockpit_Frame, which was a chunky "
                            "free-standing octagonal ring carrying the screen pads"),
        "runWidth": r6(FRAME_WIDTH),
        "sillWidth": r6(FRAME_SILL_WIDTH),
        "glassOverlap": r6(FRAME_OVERLAP),
        "depth": r6(FRAME_DEPTH),
        "chamferInner": r6(FRAME_CHAMFER_IN),
        "chamferOuter": r6(FRAME_CHAMFER_OUT),
        "glassGap": r6(FRAME_GLASS_GAP),
        "stations": fd["stations"],
        "straightRuns": len(FRAME_RUNS),
        "cornerBreaks": fd["stations"] - len(FRAME_RUNS),
        "innerBoundary": [[r6(x), r6(z)] for (x, z) in inner_ring],
        "outerBoundary": [[r6(x), r6(z)] for (x, z) in outer_ring],
        "standoffFromRimMin": r6(fd["standoffMin"]),
        "standoffFromRimMax": r6(fd["standoffMax"]),
        "measuredGlassClearance": r6(fd["glassClearance"]),
        "outerBoundaryCoversGameFrame": fd["coversGameFrame"],
        "innerEdgeAsFractionOfHalfFrame": {k: r6(v) for (k, v) in fd["sideCoverage"].items()},
        "widthNote": ("innerEdgeAsFractionOfHalfFrame is what 'fairly thin' means from the "
                      "seat: 0.94 says the band covers the outer 6% of that side of the "
                      "view. 1.0 or more would mean the run is outside the 70 deg frame "
                      "entirely and the pilot cannot see it -- the defect this revision "
                      "fixes. The metric width alone cannot tell you that."),
    }

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
        "removedInThisRevision": list(NAME_DELETED),
        "removedWhy": ("Max removed the ship nose and the free-standing octagonal frame at "
                       "UAT on 1056f30. Either node reappearing is an AC-FORM failure. "
                       "Canopy_Frame is NOT a revival of Cockpit_Frame: it is a thin band on "
                       "the canopy's own edge, not a ring standing in the cabin, and it "
                       "carries nothing. build_all() refuses to emit either deleted name."),

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
            "FRAME_WIDTH": FRAME_WIDTH,
            "FRAME_SILL_WIDTH": FRAME_SILL_WIDTH,
            "FRAME_OVERLAP": FRAME_OVERLAP,
            "FRAME_DEPTH": FRAME_DEPTH,
            "FRAME_CHAMFER_IN": FRAME_CHAMFER_IN,
            "FRAME_CHAMFER_OUT": FRAME_CHAMFER_OUT,
            "FRAME_GLASS_GAP": FRAME_GLASS_GAP,
            "FRAME_FOOT_SAMPLES": FRAME_FOOT_SAMPLES,
            "RIB_WIDTH": RIB_WIDTH,
            "RIB_DEPTH": RIB_DEPTH,
            "RIB_GLASS_GAP": RIB_GLASS_GAP,
            "RIB_KINK_Z": [r6(z) for z in RIB_KINK_Z],
            "RIB_END_OVERRUN": RIB_END_OVERRUN,
            "RIB_FRAME_JOIN_TOL": RIB_FRAME_JOIN_TOL,
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

        # Declared so increments 2-4 (and any re-author) can see what the surfaces were
        # actually set to, and why they are no longer near-black. See the constants block.
        "materials": {
            "Mat_Frame": {"baseColorLinear": list(MAT_FRAME_RGB), "roughness": MAT_FRAME_ROUGH,
                          "metallic": MAT_FRAME_METAL, "usedBy": [NAME_FRAME] + list(NAME_RIBS)},
            "Mat_Body": {"baseColorLinear": list(MAT_BODY_RGB), "roughness": MAT_BODY_ROUGH,
                         "metallic": MAT_BODY_METAL, "usedBy": [BODY_PREFIX + "*"]},
            "Mat_Arm": {"baseColorLinear": list(MAT_ARM_RGB), "roughness": MAT_ARM_ROUGH,
                        "metallic": MAT_ARM_METAL, "usedBy": [ARM_PREFIX + "*"]},
            "Mat_Screen": {"baseColorLinear": list(MAT_SCREEN_RGB),
                           "roughness": MAT_SCREEN_ROUGH, "metallic": MAT_SCREEN_METAL,
                           "usedBy": [SCREEN_PREFIX + "*"]},
            "Mat_Glass": {"baseColorLinear": list(MAT_GLASS_RGB), "roughness": MAT_GLASS_ROUGH,
                          "alpha": MAT_GLASS_ALPHA, "usedBy": [NAME_GLASS]},
            "note": ("Raised out of near-black (0.042 - 0.085 linear) because the lab's cabin "
                     "light is off by default and the structure could not be told from empty "
                     "space. Metalness is kept low on purpose: with no environment map a "
                     "metal has nothing to reflect and renders darker, not shinier. "
                     "Mat_Screen stays near-black -- it is an unlit CRT until increment 2."),
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
            "coversGameFrameNote": ("false by design as of this revision: the CLEAR OPENING "
                                    "now sits just inside the 70 deg frame on every side so "
                                    "that Canopy_Frame is visible from the seat. What must "
                                    "hold is assemblyCoversGameFrame below -- glass plus "
                                    "band, with no gap for the pilot to see through."),
            "assemblyCoversGameFrame": analysis["assemblyCoversFrame"],
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
        "canopyFrame": canopy_frame,
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
                "canopyFrame": r6(analysis["occlusionFrameMarginal"]),
                "screensAndBodies": r6(analysis["occlusionScreensMarginal"]),
                "arms": r6(analysis["occlusionArmsMarginal"]),
            },
            "own": {
                "ribs": r6(analysis["occlusionRibsOwn"]),
                "canopyFrame": r6(analysis["occlusionFrameOwn"]),
                "screensAndBodies": r6(analysis["occlusionScreensOwn"]),
                "arms": r6(analysis["occlusionArmsOwn"]),
            },
            "note": ("Marginal figures are measured in the fixed order ribs -> frame -> "
                     "screens -> arms and sum to the total; 'own' figures are each category "
                     "in isolation and overlap, so they do not. AC-FRAME's browser "
                     "measurement is authoritative; this exists so proportions can be tuned "
                     "without a render round-trip, and no geometry is padded to hit a "
                     "number. Canopy_Frame is new in this revision and is the reason the "
                     "total is above the 21.30% the frameless build measured; that rise is "
                     "the enclosure Max asked for, not padding."),
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
            "assemblyCoversGameFrame": analysis["assemblyCoversFrame"],
            "maxScreenOrArmDistance": r6(analysis["maxUnitDistance"]),
            "canopyMinDistance": r6(analysis["canopyMinDistance"]),
            "minRibGlassClearance": r6(min(d["glassClearance"]
                                           for d in analysis["ribDetail"])),
            "frameGlassClearance": r6(analysis["frameDetail"]["glassClearance"]),
            "minScreenOrArmClearanceOfFrame": r6(analysis["minUnitClearanceOfFrame"]),
            # Every rib end is inside the band, so these are <= 0. Stated as a number rather
            # than a boolean so a joint that is merely grazing the band shows up as a joint
            # that is merely grazing the band.
            "worstRibEndOutsideFrame": r6(max(j["worstCornerOutsideBy"]
                                              for d in analysis["ribDetail"]
                                              for j in d["joins"])),
            "worstRibEndCentreOutsideFrame": r6(max(j["centroidOutsideBy"]
                                                    for d in analysis["ribDetail"]
                                                    for j in d["joins"])),
            # The containment instrument's planted defect: a point 1 m off the joint must
            # read as clearly outside, or "the rib ends on the frame" is unfalsifiable.
            "ribEndJoinPlantedDefectMin": r6(min(j["plantedDefectOutsideBy"]
                                                 for d in analysis["ribDetail"]
                                                 for j in d["joins"])),
            "frameInnerEdgeAsFractionOfHalfFrame": {
                k: r6(v) for (k, v) in analysis["frameDetail"]["sideCoverage"].items()},
            "minRibKinkAngleDeg": r6(min(a for d in analysis["ribDetail"]
                                         for a in d["kinkAnglesDeg"])),
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
    print("  Canopy shell (Canopy_Glass -- the CLEAR OPENING; EXCLUDED from occlusion,")
    print("                see-through by design)")
    print("    rim plane %.3f m forward, crest %.3f m forward -> PROTRUDES %.3f m"
          % (cp["rimY"], cp["crestY"], cp["protrusionDepth"]))
    print("    rim %.3f x %.3f m; %d facet columns x %d rows; ridges at x = %+.3f / %+.3f"
          % (cp["rimWidth"], cp["rimHeight"], cp["facetColumns"], cp["facetRows"],
             cp["ridgeX"][0], cp["ridgeX"][1]))
    print("    subtends %.2f deg left/right, %.2f deg up, %.2f deg down"
          % (cp["halfAnglesDeg"]["leftRight"], cp["halfAnglesDeg"]["up"],
             cp["halfAnglesDeg"]["down"]))
    print("")
    cf = metrics["canopyFrame"]
    cov = cf["innerEdgeAsFractionOfHalfFrame"]
    print("  Canopy_Frame -- the perimeter band where the glass meets the hull")
    print("    the whole way round INCLUDING THE BOTTOM, whose lower run IS the sill")
    print("    %d stations = %d straight runs + %d corner breaks; depth %.3f m toward the eye"
          % (cf["stations"], cf["straightRuns"], cf["cornerBreaks"], cf["depth"]))
    print("    runs %.3f m across, sill %.3f m, lapping %.3f m under the glass"
          % (cf["runWidth"], cf["sillWidth"], cf["glassOverlap"]))
    print("    corner chamfers: inner %.3f m (the visible break), outer %.3f m (kept small "
          "so the" % (cf["chamferInner"], cf["chamferOuter"]))
    print("      outer boundary still closes the view at the corners)")
    print("    standoff from the rim plane %.4f-%.4f m (derived per station, not authored --"
          % (cf["standoffFromRimMin"], cf["standoffFromRimMax"]))
    print("      a single value is the correct answer while the band straddles the rim, since")
    print("      the flat rim binds at every station; it spreads out if the band moves inboard)")
    print("    APPARENT WIDTH from the seat -- inner edge as a fraction of the frame's own")
    print("    half-extent, which is what 'fairly thin' means here:")
    print("      left %.3f   right %.3f   top %.3f   bottom (sill) %.3f"
          % (cov["left"], cov["right"], cov["top"], cov["bottom"]))
    print("      i.e. the band covers the outer %.1f%% at the sides, %.1f%% at the top and "
          "%.1f%% at" % (100.0 * (1.0 - cov["left"]), 100.0 * (1.0 - cov["top"]),
                         100.0 * (1.0 - cov["bottom"])))
    print("      the bottom. At 1.000 a run would be outside the 70 deg frame entirely and")
    print("      the pilot could not see it -- which is what the previous revision measured.")
    print("")
    print("  Ribs (the two vertical strips: three straight runs, two kinks, both ends")
    print("        terminating INSIDE Canopy_Frame)")
    print("    %-16s %8s %8s %9s %9s %8s %18s" % ("name", "width", "depth", "at foot",
                                                  "at crest", "bow", "standoff (derived)"))
    for r in metrics["ribs"]:
        print("    %-16s %7.3fm %7.3fm %8.2fd %8.2fd %7.2fd  %.4f-%.4f m"
              % (r["name"], r["width"], r["depth"], r["angleAtFootDeg"],
                 r["angleAtCrestDeg"], r["bowDeg"], r["standoffFromRidgeMin"],
                 r["standoffFromRidgeMax"]))
    for r in metrics["ribs"]:
        print("    %-16s stations z = %s" % (r["name"],
                                             ", ".join("%+.3f" % z for z in r["stationZ"])))
        print("    %-16s kinks       %s" % ("", ", ".join("%.1f deg" % a
                                                          for a in r["kinkAnglesDeg"])))
        print("    %-16s ends        %s" % ("", ", ".join(
            "%s %s the band by %.4f m (worst corner %.4f m)"
            % (e["end"], "inside" if e["centreOutsideFrameBy"] <= 0 else "OUTSIDE",
               abs(e["centreOutsideFrameBy"]), e["worstCornerOutsideFrameBy"])
            for e in r["endsOnFrame"])))
    print("    (bow = how far the rib swings toward the centre-line as it crosses the bulge;")
    print("     that swing IS the cue that reads as 'the canopy sticks out in front of me'.")
    print("     The KINKS are the other half of it: Max's references show members that bend")
    print("     as they rise, so the runs are few and the joints sharp. The first and last")
    print("     kinks are the flat stubs that land each end inside the band -- see")
    print("     rib_station_z(). standoff is solved per station so the strap clears the")
    print("     glass; it re-derives itself when RIB_WIDTH or the bulge changes)")
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
    print("    %-22s %9.2f%% %9.2f%%" % ("canopy frame",
                                         100.0 * occ["marginal"]["canopyFrame"],
                                         100.0 * occ["own"]["canopyFrame"]))
    print("    %-22s %9.2f%% %9.2f%%" % ("screens + bodies",
                                         100.0 * occ["marginal"]["screensAndBodies"],
                                         100.0 * occ["own"]["screensAndBodies"]))
    print("    %-22s %9.2f%% %9.2f%%" % ("arms", 100.0 * occ["marginal"]["arms"],
                                         100.0 * occ["own"]["arms"]))
    print("    %-22s %9.2f%%" % ("TOTAL (union)", 100.0 * occ["total"]))
    print("    Marginal columns are measured in the order ribs -> frame -> screens -> arms")
    print("    and sum to the TOTAL. 'Own' columns are each category alone and overlap, so")
    print("    they do not. AC-FRAME is measure-and-report: this number describes the form")
    print("    Max asked for, it is not a target the geometry was tuned to hit. The rise")
    print("    over the 21.30% the frameless build measured IS the enclosure he asked for.")
    print("")
    print("  Checks")
    dg = metrics["diagnostics"]
    print("    glass + frame close the whole view      : %s"
          % ("yes" if dg["assemblyCoversGameFrame"]
             else "NO - the pilot sees background past the cockpit edge"))
    print("    (the shell ALONE covers the frame: %s -- false is correct now, the opening is"
          % ("yes" if dg["canopyCoversGameFrame"] else "no"))
    print("     deliberately inside the view so the band is visible from the seat)")
    rc = dg["minRibGlassClearance"]
    print("    ribs stay behind the glass they follow  : %s (measured on the finished mesh, "
          "min gap %.4f m)" % ("yes" if rc >= 0.0 else "NO - a rib breaks through", rc))
    fc = dg["frameGlassClearance"]
    print("    frame stays behind the glass it laps    : %s (measured on the finished mesh, "
          "min gap %.4f m)" % ("yes" if fc >= 0.0 else "NO - the band breaks through", fc))
    re_ = dg["worstRibEndOutsideFrame"]
    rec = dg["worstRibEndCentreOutsideFrame"]
    print("    both ribs terminate ON the frame        : %s (worst end centre %.4f m inside "
          "the band," % ("yes" if rec <= 0.0 and re_ <= RIB_FRAME_JOIN_TOL else "NO", -rec))
    print("                                              worst corner %+.4f m vs tolerance "
          "%.3f m)" % (re_, RIB_FRAME_JOIN_TOL))
    print("      instrument planted-defect check       : a point 1.0 m off the joint reads "
          "%.3f m OUTSIDE" % dg["ribEndJoinPlantedDefectMin"])
    print("                                              (so the containment test can "
          "actually fail)")
    print("    ribs read as kinked, not curved         : smallest turn %.1f deg across %d "
          "joints" % (dg["minRibKinkAngleDeg"],
                      sum(len(r["kinkAnglesDeg"]) for r in metrics["ribs"])))
    print("    every arm root outside the frustum      : %s (min clearance %.3f m, "
          "floor %.3f m)" % ("yes" if dg["everyArmRootOutsideFrustum"] else "NO",
                             dg["minArmRootClearance"], ARM_ROOT_CLEARANCE_MIN))
    print("    screens+arms stay inboard of the glass  : %s (farthest %.3f m vs nearest "
          "glass %.3f m)" % ("yes" if dg["maxScreenOrArmDistance"] < dg["canopyMinDistance"]
                             else "NO", dg["maxScreenOrArmDistance"], dg["canopyMinDistance"]))
    print("    screens+arms stay clear of the band     : %s (nearest vertex %.3f m outside "
          "it)" % ("yes" if dg["minScreenOrArmClearanceOfFrame"] > 0.0 else "NO",
                   dg["minScreenOrArmClearanceOfFrame"]))
    wa = dg["worstArmInFrontOfScreenBox"]
    print("    no arm crosses in front of a screen     : %s (%d samples overlapped a box; "
          "nearest stays %.4f m behind it)"
          % ("yes" if wa <= 0.0 else "NO", dg["armDepthSamplesChecked"], -wa))
    mv = dg["minScreenVisibleFraction"]
    print("    least-visible display face              : %.1f%% inside the frame%s"
          % (100.0 * mv, "" if mv >= 0.999 else "   <- part of a screen falls off-screen"))
    print("    no Hull_Nose, no Cockpit_Frame          : %s"
          % ("yes" if not any(o["name"] in NAME_DELETED
                              for o in metrics["objects"])
             else "NO - a deleted node is back"))
    print("                                              (Canopy_Frame is the band on the")
    print("                                               canopy's edge, not the deleted ring)")
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
        # Mat_Frame is shared by the ribs and the perimeter band on purpose: they are the
        # same structure, and Max named one material for the frame.
        "Mat_Frame": make_material("Mat_Frame", MAT_FRAME_RGB, roughness=MAT_FRAME_ROUGH,
                                   metallic=MAT_FRAME_METAL, double_sided=True),
        "Mat_Screen": make_material("Mat_Screen", MAT_SCREEN_RGB, roughness=MAT_SCREEN_ROUGH,
                                    metallic=MAT_SCREEN_METAL, double_sided=True),
        "Mat_Body": make_material("Mat_Body", MAT_BODY_RGB, roughness=MAT_BODY_ROUGH,
                                  metallic=MAT_BODY_METAL, double_sided=False),
        "Mat_Arm": make_material("Mat_Arm", MAT_ARM_RGB, roughness=MAT_ARM_ROUGH,
                                 metallic=MAT_ARM_METAL, double_sided=False),
        "Mat_Glass": make_material("Mat_Glass", MAT_GLASS_RGB, roughness=MAT_GLASS_ROUGH,
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

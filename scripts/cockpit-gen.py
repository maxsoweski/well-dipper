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

# ---- THE ENCLOSURE: a faceted vault swept between transverse arch RINGS ----
#
# WHY THIS PARAMETERISATION, AND WHY THE OLD ONE HAD TO GO.
# The previous revision modelled the canopy as a HEIGHT FIELD, y = f(x, z): a rectangle
# pushed forward in the middle. That form cannot express an enclosure at all. A shell that
# wraps past the pilot's shoulders has to DOUBLE BACK in y, and a height field has exactly
# one y per (x, z) by definition -- so no amount of re-tuning those constants could ever
# have produced canopy "above, in front and to either side". It could only ever be a window.
# That is the root cause of the form Max rejected, and it is a parameterisation bug, not a
# proportions bug.
#
# The canopy is now a SWEPT VAULT: a few transverse arch RINGS at fixed depths, lofted
# together. Each panel is a flat quad between adjacent rings -- faceted by construction,
# never moulded -- and every fold between two panels is a SEAM.
#
# THE SEAMS ARE THE POINT. A rib structurally IS the member on a seam. In this build ribs
# are not drawn ON a surface and then checked; they are GENERATED FROM the seam polylines,
# so "a rib not lying on a seam" is unrepresentable rather than merely tested for. That is
# the structural answer to Max's "the ribs read as decoration": they had nothing to be.
# WHY THE PROFILE IS NOW CLOSED, AND WHY THAT IS THE WHOLE CHANGE.
# The previous revision's ring was an OPEN arch: sill -> shoulder -> roof, mirrored, with a
# flat Floor_Pan slapped underneath and nothing between the two. From the seat there was no
# near surface anywhere below chest height, which is why it read as a barn rather than a
# cockpit. Max's correction was to make the SOLID TUB the primary form -- "a seat against a
# bulkhead; below the waist of the pilot there's no canopy, it's solid and curves around him;
# the canopy begins around chest/shoulder height, extending around and above."
#
# Asked of the parameterisation FIRST, per the lesson from the height-field failure: can it
# express that at all? An open arch cannot -- it has no below. A CLOSED section can, and it
# costs nothing else: the ring simply continues past the rail, down the tub wall and across
# the floor, and every existing piece of vault machinery keeps working unchanged, because all
# of it is written against panels and seams rather than against "canopy".
#
# The payoff is that THE RAIL BECOMES A REAL SEAM. Where the hull meets the glass is a fold
# like any other, so the canopy rail is GENERATED from it exactly as the ribs are, rather than
# being authored as trim. That is the same structural argument that killed Canopy_Frame.
FLOOR_Z            = -1.20    # cabin floor. Below the pilot's heel line at -1.18.
RAIL_Z             = -0.34    # THE WAISTLINE. Solid hull below, glass above. Constant
                              # fore-aft, so the rail reads as one continuous line.
                              #
                              # This number is Max's, chosen in cockpit-section-lab.html, and
                              # it lands AT CHEST HEIGHT -- the seated pilot's chest is at
                              # -0.35 with the eye at the origin. That is what "the canopy
                              # begins around chest/shoulder height" resolves to in metres.

# (label, y, half-width, roof z). Ordered BOW -> AFT, i.e. DECREASING y.
#
# WHY THIS IS 1.52 m ACROSS AND NOT 4.3 m. The old bow ring was sized in TAN SPACE to sit
# just inside the 70 deg frame edge, on the reasoning that a realistically-scaled canopy close
# to the face fills the view with metal. Sweeping the section lab shows that reasoning buys
# very little: cabin width moves the occluded fraction only 29.7% -> 37.6% across 1.04 m to
# 4.6 m and saturates by about 2.1 m, because once the tub spans the lower field of view,
# widening it adds almost nothing. RAIL HEIGHT is the term that actually costs view -- 46.1%
# down to 4.8% over -0.15 to -0.75. So width became a free choice and Max made it on feel.
#
# All three half-widths below are his, read straight off the lab.
#
# WHY THE ROOF TAPERS. The first tub carried roof z = 0.70 at all three stations, which made
# the canopy a SHED -- a flat lid over a narrowing tub. Max: "taper the roof toward the bow."
# The taper is asymmetric on purpose. MID stays at 0.70 because that is where the pilot's head
# is (headroom = 0.70 - head radius), so it is not a free number; AFT stays at 0.70 because the
# bulkhead is behind the head and dropping it would only shrink the cabin. Only the BOW moves,
# which is what "toward the bow" means and also what a real canopy does: flat over the seat,
# sloping down over the nose. The 3-station loft turns that into a flat rear bay and a sloping
# forward bay for free -- no extra station needed.
#
# The cost is measured, not assumed: the bow rim is the top edge of the forward aperture, so
# lowering it brings structure DOWN into the forward view. 0.70 -> 0.52 moves that edge from
# 23.4 deg to 17.8 deg above the horizon, still well inside the 35 deg frame edge. See
# canopy_frame_landing(), which reports it every run.
STATIONS = (
    ("bow",  1.62, 0.59, 0.52),
    ("mid",  0.00, 0.76, 0.70),
    ("aft", -0.97, 0.57, 0.70),
)

# THE TUB half-section, RIGHT HALF ONLY, ordered CENTRELINE -> OUTBOARD.
#   x fraction  of that station's half-width
#   z fraction  from FLOOR_Z up to RAIL_Z
# The first entry sits on the centreline and is SHARED between the two halves, so the floor
# is one continuous pane and there is no seam running down the middle of the footwell.
TUB_HALF = (
    ("floor",  0.00, 0.00),
    ("chine",  0.72, 0.10),   # the floor's outboard edge, very slightly dished
    ("wall",   1.00, 0.52),   # the wall turns up here -- this fold is the tub's hard chine
    ("rail",   1.00, 1.00),   # ...and arrives at the rail, full half-width
)

# THE CANOPY half-section, RIGHT HALF ONLY, ordered RAIL -> ROOF.
#   z fraction  from RAIL_Z up to that station's roof z
# Entry 0 is the SAME POINT as TUB_HALF's last entry; it is listed in both tables because the
# rail is where the two materials meet, and it is spliced once in station_ring().
# The roof pair sits at +/-0.45 rather than at 0, so the centre roof panel is ONE flat pane
# and there is no seam running down the middle of the pilot's upward view.
CANOPY_HALF = (
    ("rail",     1.00, 0.00),
    ("shoulder", 0.92, 0.42),
    ("roofedge", 0.45, 1.00),
)

# Which of the 11 ring segments are HULL and which are GLASS. Indexed by segment, where
# segment k joins ring vertex k to vertex k+1 and the last wraps back to 0. This single
# table is what splits the shell into two meshes; nothing else in the file decides it.
SEG_HULL, SEG_GLASS = "hull", "glass"

# (width across the seam, depth standing inboard toward the eye)
#
# THINNED 0.65x ACROSS THE BOARD. Max, looking at the first tub: "the ribs are too thick."
# All four families moved, not just the two called Rib_*, because in the render they read as
# one visual family and the RAIL was the fattest thing in the view -- 130 mm across, occluding
# 5.64% per side against a rib's 3.02%. The earlier comments here claimed Max set the rail
# height and the bow width in cockpit-section-lab.html; he did not. His `max` preset carries
# railCap 0.100 / bowSec 0.130 / pillarSec 0.085 UNCHANGED from the `game` preset it was
# copied off, so those three were defaults he never moved, not choices. They were free.
#
# One uniform factor rather than four independent guesses, so the HIERARCHY survives: rail and
# bow rim stay the heavy members, the arches sit between, the ribs stay lightest. That is the
# part that reads as structure; the absolute thickness is what read as clutter.
RAIL_SECTION       = (0.085, 0.065)   # the canopy rail: still the heaviest member in the model
                                      # and the one the pilot's hands would rest on
RIB_SECTION        = (0.049, 0.038)   # "fairly thin" is the brief, and it is a judgement call
ARCH_SECTION       = (0.055, 0.046)   # the transverse arches: mid and aft
BOW_SECTION        = (0.085, 0.068)   # the forward rim -- the member the pilot reads as
                                      # "the frame", so it keeps the rail's weight
RIB_GLASS_GAP      = 0.002    # air held between a member's outer face and the panels it lies
                              # on, so nothing z-fights against the glass it is bolted to.

# ---- Bulkhead --------------------------------------------------------------
# The aft closure: full height, floor to roof, because Max's form language is "a seat against
# a bulkhead". Floor_Pan is RETIRED -- not deleted in disgrace like Hull_Nose, simply
# subsumed: the floor is now segments 0 and 10 of the ring, so a separate pan would be a
# second surface in the same place.
BULKHEAD_INSET     = 0.010    # the aft panel sits this far forward of the aft ring plane, so
                              # it beds inside Arch_Aft instead of being coplanar with it

# ---- Dash shelf ------------------------------------------------------------
# Max, after seeing the tub: "we need to have a space where a dashboard WOULD go even though
# we're not putting anything on it yet; so we need to place a basic panel in front of the
# player on the bottom half of the canopy." That sentence had two readings with different
# geometry -- a raked panel standing UP into the lower windscreen, or a horizontal glare
# shield lying ON the coaming -- and asked, he chose the SHELF. So this is a flat placeholder
# surface with nothing on it, reserving the volume. Content is increment 2's problem.
#
# NOTE THIS REVERSES an earlier ruling of his, deliberately: at increment-1 scoping he said
# "we shouldn't need a separate dash since we have these 4 screens". The four screens stay;
# what he now wants is the SPACE, not instruments.
#
# IT COSTS NOTHING IN THE FORWARD VIEW, and that is a property of where it sits rather than
# luck. Its top face lies in the rail plane, and Coaming_Bow already fills everything below
# the rail line at the bow. A ray from the eye that reaches the shelf has already dropped
# below -11.85 deg, which is where the coaming starts, so the shelf projects into a part of
# the frame that was opaque anyway. analyse() MEASURES that rather than assuming it -- if
# total occlusion moves when the shelf is added, this paragraph is wrong.
NAME_DASH          = "Dash_Shelf"
DASH_TOP_Z         = RAIL_Z   # the top surface lies IN the rail plane, so the shelf reads as
                              # the rail line carried across the bow rather than as a slab
                              # floating in the tub.
DASH_AFT_Y         = 1.05     # the near edge -- how far the shelf cantilevers back toward the
                              # pilot. 1.10 m from the eye along the sightline, so it is
                              # within arm's reach, and 17.9 deg below the horizon, so you
                              # look DOWN at it, which is the whole point of the reading Max
                              # chose. Clear of the pilot by a wide margin: the knees are at
                              # z ~= -0.72, 0.38 m below this surface.
DASH_THICK         = 0.045    # slab depth. A real glare shield is a shell; this is a
                              # placeholder, and six flat faces read correctly under the lab's
                              # flat shading, which a shell would not.
DASH_SIDE_GAP      = 0.012    # air between the shelf's outboard edge and the rail member's
                              # inboard face, so the two neither intersect nor z-fight.
DASH_BOW_GAP       = 0.002    # the front face sits this far AFT of Coaming_Bow's plane, so
                              # the shelf beds against the coaming without being coplanar with
                              # it. It is NOT the ARM_EMBED idiom, and that was the first
                              # thing tried: an arm embeds into a screen BOX, which is a solid
                              # with more solid behind it, whereas the coaming is the hull's
                              # own front wall -- embedding 10 mm through it pushed nine probe
                              # points OUTSIDE THE SHIP, and the containment check said so
                              # before anything was exported.
DASH_PROBE_N       = 9        # containment probes per axis on the slab's faces

# ---- The seated pilot: the datum every height in this file rests on --------
# These have governed the whole build since the tub proportions were settled -- RAIL_Z is at
# chest height BECAUSE the chest is at -0.35, and the roof is at 0.70 BECAUSE the head needs
# clearance -- but they have only ever existed in cockpit-section-lab.html, cited in prose
# over here. Written down now because the seat is the one part whose entire job is to put
# this body where the rest of the model already assumes it is, and a seat authored against
# remembered numbers is a seat that drifts.
#
# 50th-percentile seated adult, lightly reclined, eye at the origin by the GLB convention.
# NOT TUNABLE. If these move, the cabin moves, not the seat.
BODY_SEAT_Z        = -0.80
BODY_WAIST_Z       = -0.52
BODY_CHEST_Z       = -0.35
BODY_SHOULDER_Z    = -0.20
BODY_HEEL_Z        = -1.18
BODY_KNEE_Y        = 0.46
BODY_TOE_Y         = 0.74
BODY_HIP_HALF      = 0.19
BODY_SHOULDER_HALF = 0.24
BODY_HEAD_R        = 0.105

# ---- The seat -------------------------------------------------------------
# Max asked for it directly ("if you can model the seat...I guess, why not"), which REVERSES
# his earlier "no seat/headrest -- we can build stuff like that in later" for the second
# time. It has been form language since he corrected the build order: "a seat against a
# bulkhead" is WHY Bulkhead_Aft is full height. Now the seat itself exists.
#
# NOTHING HERE IS A FREE CHOICE, and that is the point of doing it last rather than first.
# THE ANTHROPOMETRY IS THE DATUM: the eye is pinned at the origin by the GLB convention, so
# a seated pilot fixes every height in the cabin. The seat is the one object in the model
# whose entire job is to put that body where it already is. Every number below is read off
# the body, not authored:
#     seat pan    z = -0.80   the pilot sits ON it
#     waist       z = -0.52
#     chest       z = -0.35
#     shoulder    z = -0.20   the backrest tops out just above this
#     knee        y = +0.46   the pan front stops well short of it
#     hip half-width 0.19 / shoulder half-width 0.24 -- the pan and back clear both
#
# It costs nothing in the view and that is checked, not assumed: the pan sits 0.80 m below
# an eye that is looking forward, so it projects to tan_z = -2.7 at the knees against a
# frame edge of 0.70, and the backrest is behind the eye entirely.
NAME_SEAT_PAN      = "Seat_Pan"
NAME_SEAT_BACK     = "Seat_Back"
NAME_SEAT_BASE     = "Seat_Base"
SEAT_PAN_Z         = BODY_SEAT_Z          # -0.80, the body's own seat height
SEAT_PAN_FRONT_Y   = 0.30     # front lip. Short of the knees at y = 0.46, so the pan
                              # supports the thigh without fouling the knee bend.
SEAT_PAN_BACK_Y    = -0.22    # where the pan meets the backrest, just behind the spine
SEAT_PAN_HALF      = 0.24     # hip half-width is 0.19; the extra 50 mm is the bolster
SEAT_PAN_THICK     = 0.055
SEAT_BACK_TOP_Z    = -0.08    # just above the shoulder at -0.20, so it reads as a seat
                              # back rather than a headrest. Max ruled headrests out and
                              # has not un-ruled them.
SEAT_BACK_RAKE_Y   = -0.14    # how far further AFT the top of the backrest sits than its
                              # root: a reclined seat, which is what the eye height and the
                              # -0.20 shoulder already imply
SEAT_BACK_HALF     = 0.26     # shoulder half-width is 0.24
SEAT_BACK_THICK    = 0.06
SEAT_BASE_HALF     = 0.15     # the pedestal, narrower than the pan so the pan reads as
                              # cantilevered rather than as a block
SEAT_BASE_FRONT_Y  = 0.10
SEAT_BASE_BACK_Y   = -0.20
SEAT_FLOOR_GAP     = 0.005    # air between the pedestal's foot and the cabin floor. Without
                              # it the foot is coplanar with the hull, which both z-fights and
                              # reads to the signed eye-ray containment check as 3 mm OUTSIDE
                              # -- a surface exactly on the shell is not reliably inside it.
                              # Same idiom, same reason, as RIB_GLASS_GAP and DASH_BOW_GAP.
SEAT_PROBE_N       = 7        # containment probes per axis, per seat part

# ---- What makes it an ENCLOSURE rather than a window -----------------------
ENCLOSURE_SECTOR_MIN = 0.97   # minimum solid-angle coverage in the ABOVE / LEFT / RIGHT /
                              # BEHIND sectors. AHEAD is deliberately NOT in that list: the
                              # bow aperture is supposed to be open, and requiring coverage
                              # there would be requiring a windscreen made of hull.
                              # This is the single number that separates what Max rejected
                              # from what he asked for -- the old flat window scored ~0 in
                              # all four -- so it is a hard error, not a report.
MEMBER_SEAM_TOL    = 1e-6     # metres a member's centreline may stray from a real
                              # panel-to-panel seam. Essentially zero: members are GENERATED
                              # from the seams, so any drift at all means the seam table and
                              # the panel mesh have diverged and one of them is lying.

# ---- Screen units (Screen_* display face + ScreenBody_* box) ---------------
# ---- WHAT MAX APPROVED, and how it is preserved ----------------------------
# These six numbers are option A exactly as he set and accepted it: a 0.30 x 0.25 m face at
# 0.79 / 0.83 m, in a 1 inch bezel with a 2 inch body. He evaluated it and said yes.
#
# THEY DO NOT FIT, and that is not a matter of taste. The lab he chose them on modelled the
# section as a SUPERELLIPSE while the generator builds a FACETED profile with a flat roof --
# up to 89 mm roomier through the shoulder band, which is exactly where the screens sit. It
# also checked the display FACE and not the housing. Measured against the built hull, the
# bezel corners are 92 mm outside and the back plates 135 mm. Even a bare zero-thickness face
# at 0.79 m is 62 mm out. See the section lab's own comment for the table.
SCREEN_APPROVED_W       = 0.30
SCREEN_APPROVED_H       = 0.25
SCREEN_APPROVED_DIST_UP = 0.79
SCREEN_APPROVED_DIST_DN = 0.83
SCREEN_APPROVED_BEZEL   = 1.0 * INCH
SCREEN_APPROVED_DEPTH   = 2.0 * INCH

# SO THE WHOLE ASSEMBLY IS SCALED UNIFORMLY TOWARD THE EYE, and that is the point: a uniform
# scale on (face, bezel, body, distance) moves NOTHING that Max can see. Angular size and
# bearing are both invariant under it -- 2*atan((w*k/2)/(d*k)) == 2*atan((w/2)/d) -- so the
# screens still subtend 21.50 deg and 20.49 deg at tan x 0.91 / 0.88 and +/-9 deg elevation,
# to the digit. What changes is only the metric size, which he never chose directly, never
# sees, and which lane F is indifferent to: its UVs run over the unit square and the seam test
# asserts face AREA while saying in its own comment that "aspect ratio stays the generator's
# business". Holding the metres instead would have been holding the one number he did NOT
# evaluate, at the cost of the two he did.
#
# 0.82 is solved, not chosen: it is the largest scale at which every screen, body and arm
# vertex stays inside the built shell with room to spare. The margin at 0.82 is +0.0219 m; at
# 0.85 it is -0.0043 and the units are back outside. analyse() re-derives the approved angles
# from the constants above and raises if this scaling has drifted from preserving them.
SCREEN_FIT_SCALE   = 0.82

SCREEN_W           = SCREEN_APPROVED_W * SCREEN_FIT_SCALE       # 0.2460
SCREEN_H           = SCREEN_APPROVED_H * SCREEN_FIT_SCALE       # 0.2050
SCREEN_BEZEL       = SCREEN_APPROVED_BEZEL * SCREEN_FIT_SCALE   # bezel all round the face
SCREEN_BODY_DEPTH  = SCREEN_APPROVED_DEPTH * SCREEN_FIT_SCALE   # backing behind the bezel
SCREEN_FACE_RECESS = 0.004    # display face sits this far BEHIND the bezel plane
SCREEN_FACE_GAP    = 0.0015   # and this far in FRONT of the pocket floor, so neither z-fights
# WHERE THE SCREENS GO -- all six numbers are Max's, set in cockpit-section-lab.html.
#
# He placed both pairs at nearly the same outboard angle and split them symmetrically about
# eye level: two vertical stacks flanking the view at +9 deg and -9 deg. That RESOLVES the
# ambiguity in "the screens should be oriented around the eye level of the pilot" -- it means
# positioned AROUND eye level, not sitting low on the coaming angled up.
#
# THE DISTANCES ARE NOT THE ONES HE FIRST SET, and that is deliberate. At his original 1.32 /
# 1.26 m all four units sat 40 cm OUTSIDE the hull: the centres reach x = +/-0.88 where the
# canopy is only 0.60 m out at that height. The section lab did not catch it because it drew
# the screens straight into tan space and never asked whether they were inside the cabin --
# the same blind spot that let four monitors on lamp-posts pass 48/48 in this file's own
# ancestor. Shown the three ways out, Max chose to keep the ANGLES and pull the DISTANCES in.
SCREEN_TAN_X_UP    = 0.91     # upper pair, outboard   -- HIS, untouched
SCREEN_TAN_Z_UP    = 0.22     # ...and its height, about +9 deg   -- HIS, untouched
SCREEN_DIST_UP     = SCREEN_APPROVED_DIST_UP * SCREEN_FIT_SCALE   # 0.6478
SCREEN_TAN_X_DOWN  = 0.88     # lower pair, outboard   -- HIS, untouched
SCREEN_TAN_Z_DOWN  = -0.21    # ...and its height, about -9 deg   -- HIS, untouched
SCREEN_DIST_DOWN   = SCREEN_APPROVED_DIST_DN * SCREEN_FIT_SCALE   # 0.6806
# The two TAN pairs are the BEARINGS and are not scaled, because a bearing has no length in
# it. Scaling the distances alone slides each unit along its own sightline, which is why the
# composition Max set survives untouched.

# (suffix, tan x, tan z, distance). Left/right are the PILOT's: left is -X, up is +Z.
SCREEN_QUADRANTS = (
    ("UL", -SCREEN_TAN_X_UP,   SCREEN_TAN_Z_UP,   SCREEN_DIST_UP),
    ("UR",  SCREEN_TAN_X_UP,   SCREEN_TAN_Z_UP,   SCREEN_DIST_UP),
    ("LL", -SCREEN_TAN_X_DOWN, SCREEN_TAN_Z_DOWN, SCREEN_DIST_DOWN),
    ("LR",  SCREEN_TAN_X_DOWN, SCREEN_TAN_Z_DOWN, SCREEN_DIST_DOWN),
)

# ---- Support arms (Arm_*) --------------------------------------------------
# ARMS ATTACH TO RIBS. The old rule -- every arm ROOT outside the 70 deg / 16:9 frustum,
# enforced by ARM_ROOT_TAN_X / ARM_ROOT_TAN_Z / ARM_ROOT_CLEARANCE_MIN -- is RETIRED, and
# deliberately not reimplemented here. Max resolved the ambiguity it encoded: "arms coming
# from outside the player's POV" means the arm's ORIGIN IS HIDDEN BY STRUCTURE, not that it
# sits beyond the view. An arm now roots on a named seam member, which is both the honest
# reading and a stronger property -- "is on a rib" is checkable against the rib's actual
# solid, whereas "is outside the frustum" was satisfiable by floating in empty space, which
# is precisely what produced the monitors-on-lamp-posts build.
#
# (screen suffix -> the profile index of the longitudinal member it hangs from).
# Upper screens hang from the ROOF-EDGE rib and reach down and inboard, which is the
# arrangement Max's first reference shows. Lower screens come off the SHOULDER rib rather
# than the sill rail: same reach, but it keeps the sill clear as a visual edge and gives the
# lower arms a mount at a readable height instead of at the pilot's feet.
# Which longitudinal member each arm bolts to. The UPPER pair reach down from the SHOULDER
# ribs; the LOWER pair reach up off the RAILS, which is the heaviest member in the model and
# the natural place to hang weight. Indices are ring vertices -- see LONGITUDINAL_NAMES.
ARM_MOUNT_PROFILE  = {"UL": 4, "UR": 7, "LL": 3, "LR": 8}
ARM_MOUNT_Y        = 0.90     # where along its member each arm bolts on.
                              #
                              # THE OLD RULE HERE WAS "AFT OF THE SCREENS, so every arm
                              # reaches FORWARD", and it is now UNACHIEVABLE rather than
                              # merely restated. The faces used to sit near y = 1.23 and this
                              # was 0.95; option A moved them to y ~ 0.48, so "aft" now means
                              # y < 0.48 -- and every such root FAILS arm_in_front_of_box().
                              # Measured, the crossing boundary is between 0.56 and 0.58: at
                              # 0.56 an arm swings 12 mm in front of its own bezel, at 0.45
                              # 87 mm. The reason is structural, not tunable. From a root that
                              # far aft the run to the attach is a long CHORD, and a chord
                              # between two points at similar radius dips nearer the eye than
                              # both ends -- straight through the bezel plane it has to stay
                              # behind. Shortening ARM_BOOM_A_LEN cut it tenfold and still
                              # left 3-14 mm, which is where tuning was stopped.
                              #
                              # So the rule's INTENT is what carries, and it is now three
                              # measured properties instead of one authored number: the root
                              # is on a real rib (ARM_MOUNT_TOL), the arm never crosses in
                              # front of a bezel (arm_in_front_of_box), and the pilot can
                              # actually SEE it (ARM_VISIBLE_MIN, new -- Max: "we need to
                              # model their arms though").
                              #
                              # 0.90 is chosen on that third one. Visible arm, as a fraction
                              # of the frame beyond its own screen box:
                              #     mount_y   upper    lower
                              #       0.90    0.477%   0.345%   <- balanced
                              #       0.80    0.253%   0.612%
                              #       0.65    0.054%   1.549%   <- uppers all but vanish
                              # The upper pair hangs off the SHOULDER ribs and the lower off
                              # the RAILS, which sit lower and further outboard, so the two
                              # pairs trade visibility as the root moves. 0.90 is where they
                              # balance, and it is 0.32 clear of the crossing boundary.
ARM_MOUNT_TOL      = 1e-6     # metres the arm root may sit off its member's inboard face.
                              # Essentially zero: rib_mount_point() places it there, so any
                              # gap means ARM_MOUNT_PROFILE names a member the arm never
                              # reaches -- which is the lamp-post defect in its purest form.
ARM_ATTACH_U       = 0.45     # where the arm lands on the back plate, as a fraction of its
ARM_ATTACH_W       = 0.55     # half-extents: INBOARD in u, and in w toward the side the arm
                              # comes from (up for the upper pair, down for the lower).
                              #
                              # IT USED TO AIM AT THE OUTBOARD-FAR CORNER, and that single
                              # sign was what jammed the whole fitting. Measured clearance
                              # from the housing to the hull, per direction, on the upper
                              # units: outboard 0.037 m, up 0.093, straight back 0.123,
                              # INBOARD 0.497. The old rule put the arm head in the tightest
                              # gap in the cabin and then asked why it did not fit. Flipping
                              # u inboard removes the arm from the binding constraint set
                              # entirely -- the solved fit scale is identical with the arms
                              # present and absent, i.e. the HOUSING is now the limit.
                              #
                              # It costs no visible arm. The length a pilot sees is the run
                              # between the rib and the screen's outboard edge, which is set
                              # by where the arm is ROOTED; past that edge it is behind the
                              # box either way. Landing inboard only moves the hidden part.
ARM_EMBED          = 0.010    # tip pushed this far into the box, so there is no seam gap
# Cross-section: raised from (0.035, 0.045) root / (0.020, 0.026) tip, which read as sticks.
# Max's first reference shows short CHUNKY brackets, so the strut is now roughly a 100 x 124
# mm section at the root tapering to 64 x 80 mm. Still tapered, still six flat faces.
# A real monitor arm, in five parts. The previous revision's single tapered stick is what Max
# called out -- "we need to model their arms though" -- and it also could not be made to work:
# a straight strut from a rib to an off-centre point on a screen's back plate is oblique to
# that screen by construction, so it swings 15-68 mm in FRONT of its own bezel no matter where
# the mount is moved. Measured across ARM_MOUNT_Y from 0.90 down to 0.10: moving the root aft
# makes it monotonically WORSE. The articulated form removes the problem rather than tuning it
# -- ARM_HEAD runs parallel to the screen normal, so it lies behind the bezel plane by
# construction, and BoomB approaches from behind the back plate instead of around the side.
ARM_MOUNT_HALF_U   = 0.050    # the bolt-on plate: a flat pad lying on the rib's inner face
ARM_MOUNT_HALF_W   = 0.038
ARM_MOUNT_THICK    = 0.018
ARM_BOOM_A_LEN     = 0.13     # first boom, straight off the mounting face
ARM_BOOM_A_HALF_U  = 0.028    # booms are rectangular sections, not cylinders: six flat faces
ARM_BOOM_A_HALF_W  = 0.022    # each, so they read angular under the lab's flat shading
ARM_BOOM_B_HALF_U  = 0.024
ARM_BOOM_B_HALF_W  = 0.019
ARM_ELBOW_RADIUS   = 0.038    # the hinge puck. Fatter than either boom on purpose -- that
ARM_ELBOW_HALF_LEN = 0.030    # step in section is what reads as a JOINT rather than a bend,
ARM_ELBOW_SIDES    = 8        # and eight sides keeps it faceted rather than turned
ARM_HEAD_LEN       = 0.060    # the tilt head: runs along the screen's own normal into the
ARM_HEAD_HALF_U    = 0.026    # back plate, which is what keeps every arm behind its bezel
ARM_HEAD_HALF_W    = 0.021
ARM_VISIBLE_MIN    = 0.0005   # each arm must occlude at least this fraction of the frame
                              # BEYOND its own screen box. Max asked for the arms to be
                              # modelled; an arm hidden entirely behind the panel it holds is
                              # not modelled, it is deleted with extra steps. Measured as
                              # marginal coverage over the box, so hiding behind the screen
                              # does not count and neither does hiding outside the frame --
                              # which is exactly how the retired "root outside the frustum"
                              # rule let four monitors ship on invisible lamp-posts.
ARM_MIN_BEND_DEG   = 15.0     # below this the two booms are effectively one straight stick and
                              # the arm has stopped reading as articulated -- which is the
                              # exact defect this shape exists to fix, so it is an error

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
MAT_HULL_RGB       = (0.088, 0.090, 0.098)   # bulkhead + floor pan: the darkest surfaces in
MAT_HULL_ROUGH     = 0.62                    # the cabin. They are unlit hull behind and below
MAT_HULL_METAL     = 0.05                    # the pilot and must not compete with the frame.
MAT_GLASS_RGB      = (0.030, 0.045, 0.055)   # canopy shell placeholder
MAT_GLASS_ROUGH    = 0.08
MAT_GLASS_ALPHA    = 0.12     # so the lab can see THROUGH the shell. Increment 3 replaces the
                              # whole material with real transmissive glass.

# Node names. The headless tests key off these -- do not rename without updating the tests.
NAME_EYE           = "Eye_Point"
NAME_GLASS         = "Canopy_Glass"
NAME_HULL          = "Hull_Tub"      # the solid tub: floor, chine and both walls, one mesh
NAME_BULKHEAD      = "Bulkhead_Aft"
NAME_COAMING       = "Coaming_Bow"   # the tub's forward wall, below the rail

# Ring vertex indices. Written out rather than computed so the member tables below can be
# read without simulating station_ring() in your head.
#   0  floor centreline
#   1  L chine      2  L wall      3  L RAIL      4  L shoulder   5  L roof edge
#   6  R roof edge  7  R shoulder  8  R RAIL      9  R wall      10  R chine
RING_FLOOR_C = 0
RING_RAIL_L, RING_RAIL_R = 3, 8
RING_GLASS_SPAN = (RING_RAIL_L, RING_RAIL_R)   # transverse arches span rail -> roof -> rail

# Every member is named for the SEAM it lies on, because that is what decides where it is.
# NOTE WHAT IS AND IS NOT HERE. The two RAILS are members on the hull/glass fold -- that fold
# exists only because the profile closed, and it is the structural reason the rail does not
# have to be authored as trim the way Canopy_Frame was. The tub's chine folds (1/2 and 9/10)
# carry NOTHING: a pressed tub has no internal framing, and adding ribs down there would be
# decorating a surface rather than expressing one.
LONGITUDINAL_NAMES = {
    3: ("Rail_L",          RAIL_SECTION),
    4: ("Rib_Shoulder_L",  RIB_SECTION),
    5: ("Rib_RoofEdge_L",  RIB_SECTION),
    6: ("Rib_RoofEdge_R",  RIB_SECTION),
    7: ("Rib_Shoulder_R",  RIB_SECTION),
    8: ("Rail_R",          RAIL_SECTION),
}
TRANSVERSE_NAMES = {
    0: ("Arch_Bow", BOW_SECTION),
    1: ("Arch_Mid", ARCH_SECTION),
    2: ("Arch_Aft", ARCH_SECTION),
}
NAME_DELETED       = ("Hull_Nose", "Cockpit_Frame", "Canopy_Frame",
                      "Sill_L", "Sill_R", "Floor_Pan")
                              # Hull_Nose and Cockpit_Frame Max deleted at UAT on 1056f30.
                              # Canopy_Frame was the flat perimeter BAND of ceb277e -- the
                              # window-edge trim. An enclosure has no such thing: its edge is
                              # Arch_Bow, a real structural rim on a real seam.
                              # Sill_L/R and Floor_Pan are the OPEN-ARCH build's bottom edge
                              # and its flat pan. They are not failures, they are superseded:
                              # a closed profile has no free lower edge to rail, and its floor
                              # is part of the shell. If one reappears, the ring has come open
                              # again and the tub has silently gone back to being a vault.
# THE FITTINGS SWITCH. Max's ordering correction was "begin by building the enclosure of the
# cockpit, then we'll fit the canopy, ribs, and screens to that" -- and he asked to see the tub
# with nothing on it before anything is hung off it. So the screens and their arms can be left
# out of a build without deleting them from the file, which keeps lane F's Screen_* UV contract
# (d528f6c) intact: the DEFAULT build still carries them, and only an explicit --no-fittings
# omits them. Set by parse_args(); read by build_all().
INCLUDE_FITTINGS   = True

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

def station_ring(index):
    """The eleven points of one transverse ring, as a CLOSED loop.

    Order, starting on the floor centreline and going up the LEFT side, across the roof and
    down the RIGHT side:
        0 floor_c | 1 L chine | 2 L wall | 3 L RAIL | 4 L shoulder | 5 L roof edge
                  | 6 R roof edge | 7 R shoulder | 8 R RAIL | 9 R wall | 10 R chine
    and segment 10 wraps back to 0 across the other half of the floor.

    Built by MIRRORING the two half-tables rather than by listing both sides, so the section
    is symmetric by construction. A re-author cannot accidentally make the left differ from
    the right, which is the kind of drift a table of twenty numbers invites.

    The rail point appears in both TUB_HALF and CANOPY_HALF and is spliced here exactly once
    -- CANOPY_HALF[0] is skipped. If it were emitted twice the ring would carry a zero-length
    segment, which has no tangent, and member_sections() would raise on it rather than
    silently produce a degenerate rail.
    """
    _label, y, half_w, top_z = STATIONS[index]
    tub_h = RAIL_Z - FLOOR_Z
    can_h = top_z - RAIL_Z

    def right_half():
        pts = [(fx * half_w, y, FLOOR_Z + fz * tub_h) for (_nm, fx, fz) in TUB_HALF]
        pts += [(fx * half_w, y, RAIL_Z + fz * can_h) for (_nm, fx, fz) in CANOPY_HALF[1:]]
        return pts

    right = right_half()                       # floor_c, chine, wall, rail, shoulder, roofedge
    left = [(-p[0], p[1], p[2]) for p in right]
    # right[0] is the shared centreline point; left[0] is the same point mirrored, i.e. itself.
    #
    # LEFT half first, then the RIGHT half in reverse. That circulation direction is not a
    # style choice: with stations ordered bow -> aft, panel_quads()' winding only produces
    # INWARD (eye-facing) normals for this handedness. Going up the right side instead flips
    # every panel in the model, and panel_normals_face_eye() raises on it -- which is how this
    # was caught rather than shipped.
    return [right[0]] + left[1:] + list(reversed(right[1:]))


def ring_grid():
    """rings[i][j] -- every shell vertex. i indexes stations bow->aft, j the ring, closed."""
    return [station_ring(i) for i in range(len(STATIONS))]


N_ARCH = 2 * len(TUB_HALF) + 2 * (len(CANOPY_HALF) - 1) - 1   # 11 points per ring
N_BAYS = len(STATIONS) - 1                                    # fore-aft bays
N_FACETS = N_ARCH                                             # CLOSED: one facet per segment


def segment_materials():
    """Material of each of the N_ARCH ring segments, segment k joining vertex k to k+1.

    Derived from the ring layout rather than typed out, so it cannot fall out of step with
    station_ring() when either half-table is re-authored. Everything strictly between the two
    RAIL vertices going up over the roof is glass; everything else -- the walls, the chine and
    the floor -- is solid hull.
    """
    mats = []
    for k in range(N_ARCH):
        mats.append(SEG_GLASS if RING_RAIL_L <= k < RING_RAIL_R else SEG_HULL)
    return mats


def panel_quads(material=None):
    """Every shell panel as four (station, ring) index pairs, optionally filtered by material.

    Winding is (i,j) (i,j+1) (i+1,j+1) (i+1,j), which puts every panel normal on the INSIDE
    of the shell -- pointing at the pilot. That is deliberate and it is the same convention
    the screens use: the face the pilot sees is the face whose normal reaches them. It is
    verified rather than assumed -- see panel_normals_face_eye().

    The ring is CLOSED, so j+1 wraps. That wrap is the segment across the footwell floor, and
    it is the one facet the open-arch build could not have: it is what turns a vault into a
    tub. If N_FACETS ever goes back to N_ARCH-1 the floor opens up again.
    """
    mats = segment_materials()
    out = []
    for i in range(N_BAYS):
        for j in range(N_FACETS):
            if material is not None and mats[j] != material:
                continue
            jn = (j + 1) % N_ARCH
            out.append(((i, j), (i, jn), (i + 1, jn), (i + 1, j)))
    return out


def _grid_index(i, j):
    return i * N_ARCH + j


def build_shell(material):
    """One material's worth of the shell as its own mesh, flat quads only.

    Called twice -- Canopy_Glass and Hull_Tub -- off the SAME ring grid and the same winding,
    so the two meshes meet exactly along the rail with no crack and no overlap. Vertices are
    remapped rather than shared, because the two are separate glTF nodes with separate
    materials and only one of them is see-through.
    """
    grid = ring_grid()
    remap = {}
    verts = []
    faces = []
    for quad in panel_quads(material):
        face = []
        for (i, j) in quad:
            key = (i, j)
            if key not in remap:
                remap[key] = len(verts)
                verts.append(grid[i][j])
            face.append(remap[key])
        faces.append(tuple(face))
    return verts, faces


def panel_normal_in(quad, grid):
    """Inward (eye-facing) unit normal of one panel, by Newell over its four corners.

    Newell rather than a single cross product because a lofted quad between two rings need
    not be exactly planar, and a cross product taken at one corner would then describe a
    corner rather than the panel.
    """
    pts = [grid[i][j] for (i, j) in quad]
    nx = ny = nz = 0.0
    for k in range(len(pts)):
        a = pts[k]
        b = pts[(k + 1) % len(pts)]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return v_norm((nx, ny, nz))


def panel_centroid(quad, grid):
    pts = [grid[i][j] for (i, j) in quad]
    return v_mul((sum(p[0] for p in pts), sum(p[1] for p in pts), sum(p[2] for p in pts)),
                 1.0 / len(pts))


def panel_normals_face_eye():
    """Every panel normal must point at the eye. Returns the worst dot, and a planted defect.

    The winding convention in panel_quads() is a CLAIM about handedness, and a claim that is
    never checked is how the last build shipped ribs bolted to the outside of the canopy. So
    it is measured: dot(normal, eye - centroid) > 0 for every panel. The planted defect is the
    same quantity with the winding reversed, which must come out negative -- a test that
    cannot fail proves nothing (feedback_measurement-channels-need-planted-defects.md).
    """
    grid = ring_grid()
    worst = None
    worst_flipped = None
    for quad in panel_quads():
        n = panel_normal_in(quad, grid)
        to_eye = v_norm(v_mul(panel_centroid(quad, grid), -1.0))
        d = v_dot(n, to_eye)
        if worst is None or d < worst:
            worst = d
        f = v_dot(v_mul(n, -1.0), to_eye)
        if worst_flipped is None or f > worst_flipped:
            worst_flipped = f
    return worst, worst_flipped


def vertex_normals_out():
    """Per-vertex OUTWARD normal (away from the eye), accumulated over incident panels.

    This is what every seam member is hung from: a member lies on a seam, and the direction
    it must stand off in is the average of the surfaces meeting there. Accumulation order is
    fixed by panel_quads(), so the result is deterministic to the last bit.
    """
    grid = ring_grid()
    acc = [[(0.0, 0.0, 0.0)] * N_ARCH for _ in range(len(STATIONS))]
    for quad in panel_quads():
        n_out = v_mul(panel_normal_in(quad, grid), -1.0)
        for (i, j) in quad:
            acc[i][j] = v_add(acc[i][j], n_out)
    return [[v_norm(acc[i][j]) for j in range(N_ARCH)] for i in range(len(STATIONS))]


# =============================================================================
# Seams, and the members generated FROM them.
#
# A seam is a fold: the polyline where two vault panels meet. There are exactly two families:
#   LONGITUDINAL  fixed arch index j, running bow -> aft   (sill rails, shoulder and roof ribs)
#   TRANSVERSE    fixed station index i, running across    (the bow, mid and aft arches)
# Every structural member in this model is generated from one of them. That is the whole
# point of the re-spec: a rib IS a seam member, so "a rib not on a seam" cannot be built.
# =============================================================================

def incident_panel_normals():
    """For each vault vertex, the INWARD normals of every panel touching it. Fixed order.

    A member lying on a fold has to clear BOTH panels that make the fold, and those are the
    only surfaces it can break through locally -- so the containment solve is a handful of
    plane inequalities rather than a search.

    THESE ARE TRIANGLE PLANES, NOT QUAD PLANES, and the distinction is load-bearing here in a
    way it was not in the open-arch build. A lofted quad between two stations of DIFFERENT
    half-width is not planar -- the shoulder panels in this build are warped by about 80 mm --
    so its Newell normal describes an average surface that the exported mesh does not actually
    have. triangulate() fans every quad from its first vertex, and THAT is the surface the
    glass really is. Solving against the average instead put the roof-edge ribs 1.1 mm through
    the glass, and gave the giveaway symptom: the residual differed LEFT from RIGHT, on a model
    that is mirror-symmetric by construction, because the fan diagonal is mirrored too.

    So the split rule is read from the same place the exporter reads it. triangulate()'s
    docstring already claimed "the rib clearances are solved against specific triangles"; it is
    true now.
    """
    grid = ring_grid()
    acc = [[[] for _ in range(N_ARCH)] for _ in range(len(STATIONS))]
    for quad in panel_quads():
        # same fan as triangulate(): (0,1,2), (0,2,3)
        for t in range(1, len(quad) - 1):
            tri = (quad[0], quad[t], quad[t + 1])
            n_in = panel_normal_in(tri, grid)
            for (i, j) in tri:
                acc[i][j].append(n_in)
    return acc


def _panel_triangle_normals(bay, seg, grid):
    """Inward normals of the triangles of ONE shell panel, in the exporter's own fan order."""
    if bay < 0 or bay >= N_BAYS:
        return []
    j = seg % N_ARCH
    jn = (j + 1) % N_ARCH
    quad = ((bay, j), (bay, jn), (bay + 1, jn), (bay + 1, j))
    return [panel_normal_in((quad[0], quad[t], quad[t + 1]), grid)
            for t in range(1, len(quad) - 1)]


def seam_span_planes(kind, index, n_pts):
    """The panels adjacent to a seam OVER EACH SPAN -- one list per span, not per vertex.

    WHY THIS EXISTS, AND WHAT IT REPLACES. member_sections() has to solve each section's
    standoff against the panels the member could poke through between its neighbours. That
    was previously done by unioning `planes[k-1] + planes[k] + planes[k+1]`, where planes[v]
    is every triangle touching VERTEX v. Vertex incidence is the wrong relation and it is
    wrong in both directions:

      TOO LITTLE. A quad fans into (0,1,2) and (0,2,3), so the triangle (i,j)(i,j+1)(i+1,j+1)
      touches (i,j) but NOT (i+1,j). A longitudinal member's far section was therefore never
      constrained against a triangle it lies directly under. That is the mid-span bulge
      finding 3 of 10d5878 chased, and unioning the neighbours hid it rather than fixing it.

      TOO MUCH, and this is the one that shipped a defect. planes[k+1] also carries panels
      hanging off the FAR side of vertex k+1, which the member never approaches. At the roof
      edge of a transverse arch that pulls in the opposite shoulder panel, which is nearly
      edge-on to the member's inward direction: denom = -dot(m, w) came out at 0.0122, so a
      2 mm clearance demand was divided by 0.0122 and became a 0.51 m standoff. Arch_Mid's
      roof corners were hauled half a metre into the cabin -- its top sat at z = 0.455 with
      the roof at 0.700, floating in mid-air with nothing touching it.

      NEITHER EXISTING CHECK COULD SEE IT. member_seam_residual() measures the SEAM, and the
      seam points are exact by construction whatever the standoff does. member_inboard_margin()
      only asks whether a member has broken OUT through the shell, and a member dragged too
      far IN is trivially inside. It took the test suite measuring the member's own VERTICES
      against the shell's folds. Recorded in full because the class of error -- a check that
      is blind to the direction the defect actually went -- is this file's recurring one.

    The relation that IS correct is SPAN incidence: over the stretch of seam between vertex k
    and k+1, the member lies on exactly the two panels meeting along that stretch, and every
    triangle of both is a real constraint on both end sections. Constraint satisfaction stays
    linear in the corners, so bounding the two ends still bounds the whole span exactly --
    finding 3's argument is preserved, it is just applied to the right set.
    """
    grid = ring_grid()
    spans = []
    if kind == "long":
        # seam runs fore-aft at ring index `index`; span b joins station b to b+1. The two
        # panels meeting along it are the segments either side of that ring line.
        for b in range(n_pts - 1):
            spans.append(_panel_triangle_normals(b, index - 1, grid)
                         + _panel_triangle_normals(b, index, grid))
    elif kind == "trans":
        # seam runs around ring station `index`; span j joins ring vertex j to j+1 (offset by
        # the glass span's start). The two panels meeting along it are the same ring segment
        # in the bay ahead and the bay behind -- and at the bow and aft stations one of those
        # does not exist, which _panel_triangle_normals() returns empty for.
        lo, _hi = RING_GLASS_SPAN
        for s in range(n_pts - 1):
            seg = lo + s
            spans.append(_panel_triangle_normals(index - 1, seg, grid)
                         + _panel_triangle_normals(index, seg, grid))
    else:
        raise ValueError("unknown seam family %r" % (kind,))
    return spans


def seam_points(kind, index):
    """One seam: its polyline, the outward normal at each vertex, and the panels meeting there."""
    grid = ring_grid()
    norms = vertex_normals_out()
    inc = incident_panel_normals()
    if kind == "long":
        rng = range(len(STATIONS))
        pts = [grid[i][index] for i in rng]
        ns = [norms[i][index] for i in rng]
        planes = [inc[i][index] for i in rng]
    elif kind == "trans":
        # An arch runs RAIL -> roof -> RAIL and stops there. Now that the ring is closed it
        # would otherwise carry on down the tub walls and across the footwell floor, which is
        # a member no aircraft has: an arch is what holds the CANOPY up. The span is the glass
        # run, so the arch lands exactly on the two rails and is bounded by the same fold that
        # decides the material.
        lo, hi = RING_GLASS_SPAN
        rng = range(lo, hi + 1)
        pts = [grid[index][j] for j in rng]
        ns = [norms[index][j] for j in rng]
        planes = [inc[index][j] for j in rng]
    else:
        raise ValueError("unknown seam family %r" % (kind,))
    return pts, ns, planes


def _tangents(pts):
    """Unit tangent at each polyline vertex: segment direction at the ends, average inside."""
    n = len(pts)
    segs = [v_norm(v_sub(pts[k + 1], pts[k])) for k in range(n - 1)]
    out = []
    for k in range(n):
        if k == 0:
            out.append(segs[0])
        elif k == n - 1:
            out.append(segs[-1])
        else:
            out.append(v_norm(v_add(segs[k - 1], segs[k])))
    return out


def member_sections(pts, norms, planes, width, depth, spans=None):
    """Four-corner cross-sections for a member lying ON a seam.

    At each seam vertex the frame is (c, n_out, t): t is the seam tangent, n_out the averaged
    outward normal, and c = n_out x t lies across the seam. The member straddles the seam by
    width/2 either way and stands `depth` inboard, toward the pilot.

    THE STANDOFF IS DERIVED, NOT AUTHORED, and this is not a detail.
    A seam is a fold, and on a shell that bulges outward the fold's tangent plane lies OUTSIDE
    the surface everywhere except along the crease itself. So a flat section placed in that
    tangent plane has its two outer corners POKING THROUGH the panels either side -- by 21 mm
    for the ribs here and 217 mm for the sill rails, measured. Authoring a single constant gap
    cannot fix that, because the required depth depends on the fold angle, which differs at
    every vertex and changes the moment anyone re-authors STATIONS.

    So it is solved per vertex, in closed form, against the actual incident panel planes:
    for each panel (inward normal m) and each corner offset u, the corner
        q = p + c*u - n_out*d
    is inboard by at least RIB_GLASS_GAP when
        u*dot(m,c) - d*dot(m,n_out) >= RIB_GLASS_GAP
    which is linear in d. Take the largest d any panel or corner demands, and the whole
    section clears every surface it lies on by construction -- and then
    member_inboard_margin() re-measures the finished geometry by raycast, independently of
    this algebra, so a wrong derivation surfaces instead of confirming itself.

    Corners are ordered CCW in the (U=c, W=n_out) plane with T=t the sweep direction, which is
    what loft() requires: c x n_out == t, so the winding needs no orientation test. The sign on
    n_out is the whole ballgame -- ceb277e's rib-to-shell check used an UNSIGNED distance, so a
    rib bolted to the OUTSIDE of the canopy measured identical to one correctly inboard, and
    48/48 tests passed a build with the structure on the wrong side of the glass.
    """
    if spans is None:
        raise ValueError(
            "member_sections() needs the SPAN panel sets; passing only per-vertex `planes` is "
            "the incidence relation that pulled Arch_Mid's roof corners 0.51 m into the cabin. "
            "See seam_span_planes().")
    tans = _tangents(pts)
    hw = width * 0.5
    sections = []
    standoffs = []

    # SOLVE EACH VERTEX AGAINST ITS NEIGHBOURS' PLANES TOO, and the reason is not caution.
    # The solve is exact AT a vertex, but the member between two vertices is a RULED surface
    # -- loft() interpolates the two sections linearly -- while the panels it lies on are flat
    # quads whose fold angle changes from station to station. So a member can clear both of
    # its end vertices and still bulge out mid-span, which is precisely what the roof-edge
    # ribs did here: 1.1 mm through the glass, invisible at every vertex.
    #
    # Constraint satisfaction is LINEAR in the section corners, so if section k and section
    # k+1 both satisfy every plane incident to the span between them, every interpolated point
    # in between satisfies it as well. Taking the union with both neighbours is therefore not
    # a safety margin, it is the exact condition -- and it costs a fraction of a millimetre of
    # extra standoff rather than the blanket RIB_GLASS_GAP increase that would have hidden it.
    # Each section answers for the panels adjacent to the spans it bounds -- see
    # seam_span_planes() for why VERTEX incidence was both too little and far too much.
    span_planes = []
    for k in range(len(pts)):
        acc = []
        for s in (k - 1, k):
            if 0 <= s < len(spans):
                acc.extend(spans[s])
        if not acc:
            raise ValueError(
                "seam vertex %d bounds no span, so its section would be solved against no "
                "panels at all and its standoff would be whatever RIB_GLASS_GAP says. A seam "
                "with fewer than two points is not a member." % k)
        span_planes.append(acc)

    for k, p in enumerate(pts):
        n_out = norms[k]
        t = tans[k]
        c = v_cross(n_out, t)
        if v_len(c) < 1e-9:
            raise ValueError(
                "seam member is degenerate at vertex %d: its tangent is parallel to the "
                "surface normal, so there is no 'across the seam' direction" % k)
        c = v_norm(c)
        w = v_norm(v_cross(t, c))    # re-orthogonalised n_out, square to the seam
        need = RIB_GLASS_GAP
        for m in span_planes[k]:
            denom = -v_dot(m, w)
            if denom <= 1e-9:
                # this panel does not face the member; it cannot constrain it
                continue
            for u in (-hw, hw):
                d = (RIB_GLASS_GAP - u * v_dot(m, c)) / denom
                if d > need:
                    need = d
        standoffs.append(need)
        near = -need
        far = -(need + depth)
        sections.append((
            v_add(p, v_add(v_mul(c, -hw), v_mul(w, far))),
            v_add(p, v_add(v_mul(c, hw), v_mul(w, far))),
            v_add(p, v_add(v_mul(c, hw), v_mul(w, near))),
            v_add(p, v_add(v_mul(c, -hw), v_mul(w, near))),
        ))
    return sections, standoffs


def seam_members():
    """Every structural member, in a fixed order. One builder; the GLB, the predictor and the
    sidecar all read this, so they cannot disagree about where a rib is."""
    members = []
    for j in sorted(LONGITUDINAL_NAMES):
        name, (width, depth) = LONGITUDINAL_NAMES[j]
        pts, norms, planes = seam_points("long", j)
        secs, standoffs = member_sections(pts, norms, planes, width, depth,
                                          seam_span_planes("long", j, len(pts)))
        verts, faces = loft(secs)
        members.append({
            "name": name, "kind": "long", "seamIndex": j,
            "width": width, "depth": depth,
            "seam": pts, "normals": norms, "sections": secs,
            "standoffs": standoffs,
            "verts": verts, "faces": faces,
        })
    for i in sorted(TRANSVERSE_NAMES):
        name, (width, depth) = TRANSVERSE_NAMES[i]
        pts, norms, planes = seam_points("trans", i)
        secs, standoffs = member_sections(pts, norms, planes, width, depth,
                                          seam_span_planes("trans", i, len(pts)))
        verts, faces = loft(secs)
        members.append({
            "name": name, "kind": "trans", "seamIndex": i,
            "width": width, "depth": depth,
            "seam": pts, "normals": norms, "sections": secs,
            "standoffs": standoffs,
            "verts": verts, "faces": faces,
        })
    return tuple(members)


def build_bulkhead():
    """Bulkhead_Aft: the closure behind the pilot, floor to roof.

    Max's form language is "a seat against a bulkhead", so this is full height rather than the
    shoulder-high panel the open-arch build carried: it is the surface the seat is bolted to.
    The ring is closed, so the aft station's eleven points already ARE the outline -- there is
    no separate sill line to close along any more. Wound so the normal comes out +Y, i.e. at
    the eye, matching every other inward surface.

    Floor_Pan is gone and is not replaced here. The floor is segments 0 and 10 of the shell.
    """
    ring = station_ring(len(STATIONS) - 1)
    y = ring[0][1] + BULKHEAD_INSET
    verts = [(p[0], y, p[2]) for p in ring]
    faces = [tuple(range(N_ARCH))]
    n = _newell_normal(verts, faces[0])
    if n[1] < 0.0:
        faces = [tuple(reversed(range(N_ARCH)))]
    return verts, faces


def build_coaming():
    """Coaming_Bow: the forward closure BELOW the rail -- the tub's front wall.

    WHY THIS EXISTS AT ALL, since the open-arch build had no such thing. A loft between three
    stations is an open-ended trough: it has walls and a floor but no end caps. That was
    harmless when the sill sat 1.08 m below the eye, because the hole under the bow rim was
    far outside a 70 deg frame and nobody could look through it. With the rail at -0.34 the
    same hole lands in the LOWER CENTRE OF THE FORWARD VIEW, and the first render showed stars
    through the middle of the coaming.

    Worth noting how it was caught, because the instruments did not catch it: enclosure
    coverage read 100% below and "ahead 67.5%, open by design", so the hole was absorbed into
    the aperture the AC deliberately does not constrain. It took looking at the thing.

    Spans the HULL half of the ring -- rail, down the wall, across the floor, up the far wall,
    rail -- and closes rail-to-rail along the top. That top edge IS the rail line, so the
    coaming meets both rails exactly and needs no separate trim.
    """
    ring = station_ring(0)
    y = ring[0][1] - BULKHEAD_INSET          # inset AFT of the bow plane, same reason
    order = list(range(RING_RAIL_R, N_ARCH)) + list(range(0, RING_RAIL_L + 1))
    verts = [(ring[k][0], y, ring[k][2]) for k in order]
    faces = [tuple(range(len(order)))]
    n = _newell_normal(verts, faces[0])
    if n[1] > 0.0:                            # inward normal must point AFT, at the pilot
        faces = [tuple(reversed(range(len(order))))]
    return verts, faces


def _station_bracket(y):
    """(index of the station just FORWARD of y, index just AFT, blend t in [0,1] toward aft)."""
    for k in range(len(STATIONS) - 1):
        hi, lo = STATIONS[k][1], STATIONS[k + 1][1]
        if lo - 1e-9 <= y <= hi + 1e-9:
            span = hi - lo
            return k, k + 1, 0.0 if span < 1e-12 else (hi - y) / span
    raise ValueError(
        "y = %.4f is outside the station range %.4f .. %.4f, so there is no shell there to "
        "measure against" % (y, STATIONS[-1][1], STATIONS[0][1]))


def station_half_width(y):
    """The tub's half-width at station y, i.e. where the wall is -- NOT where the rail is."""
    a, b, t = _station_bracket(y)
    return STATIONS[a][2] + (STATIONS[b][2] - STATIONS[a][2]) * t


def rail_inboard_x(y):
    """The innermost |x| the rail members reach at station y, read off the BUILT sections.

    The shelf has to stop short of the rails or it grows through them, and the rails do NOT sit
    at the tub's half-width: member_sections() stands each one inboard by a standoff SOLVED
    against the fold angle, which changes the moment anyone re-authors STATIONS or
    RAIL_SECTION. Reading the clearance back off the generated geometry means the shelf follows
    the rail instead of following a number typed next to it -- the same reason screen standoffs
    are derived rather than authored.

    Exact anywhere in a bay, not an approximation: loft() interpolates sections linearly, so
    linear interpolation between the two bounding sections IS the built surface.
    """
    a, b, t = _station_bracket(y)
    best = None
    for mem in seam_members():
        if mem["kind"] != "long" or mem["seamIndex"] not in (RING_RAIL_L, RING_RAIL_R):
            continue
        for (ca, cb) in zip(mem["sections"][a], mem["sections"][b]):
            x = abs(ca[0] + (cb[0] - ca[0]) * t)
            if best is None or x < best:
                best = x
    if best is None:
        raise ValueError(
            "no rail member was found at ring indices %d / %d, so the dash shelf has nothing "
            "to clear. LONGITUDINAL_NAMES and RING_RAIL_L/R have diverged."
            % (RING_RAIL_L, RING_RAIL_R))
    return best


def dash_extents():
    """(y_front, y_back, half-width at each, top z, bottom z) for the dash shelf."""
    y_front = STATIONS[0][1] - BULKHEAD_INSET - DASH_BOW_GAP
    y_back = DASH_AFT_Y
    if y_back >= y_front - 1e-6:
        raise ValueError(
            "DASH_AFT_Y (%.3f) is at or ahead of the coaming (%.3f), so the shelf has no depth"
            % (y_back, y_front))
    hf = rail_inboard_x(min(y_front, STATIONS[0][1])) - DASH_SIDE_GAP
    hb = rail_inboard_x(y_back) - DASH_SIDE_GAP
    if min(hf, hb) <= 0.0:
        raise ValueError(
            "the rails meet on the centreline at the dash shelf (half-widths %.4f / %.4f after "
            "DASH_SIDE_GAP %.4f), so there is no room for a shelf between them"
            % (hf, hb, DASH_SIDE_GAP))
    return y_front, y_back, hf, hb, DASH_TOP_Z, DASH_TOP_Z - DASH_THICK


def tub_floor_z(x, y):
    """Height of the cabin floor at (x, y), read off the TUB_HALF profile.

    The floor is DISHED -- TUB_HALF puts the chine 10% of the way up the tub's height -- so a
    pedestal dropped to a flat FLOOR_Z would hang in the air at the centreline and bury itself
    at the edges. Derived rather than authored for the same reason the rail clearance is: it
    re-fits itself if anyone re-authors the profile or the station half-widths.
    """
    half_w = station_half_width(y)
    tub_h = RAIL_Z - FLOOR_Z
    ax = abs(x)
    for k in range(len(TUB_HALF) - 1):
        (_n0, fx0, fz0), (_n1, fx1, fz1) = TUB_HALF[k], TUB_HALF[k + 1]
        x0, x1 = fx0 * half_w, fx1 * half_w
        if x0 - 1e-9 <= ax <= x1 + 1e-9:
            t = 0.0 if abs(x1 - x0) < 1e-12 else (ax - x0) / (x1 - x0)
            return FLOOR_Z + (fz0 + (fz1 - fz0) * t) * tub_h
    raise ValueError(
        "x = %.4f is outside the tub's half-width %.4f at y = %.4f, so there is no floor "
        "under it" % (x, half_w, y))


def build_seat():
    """Seat_Pan / Seat_Back / Seat_Base -- the pilot's seat, against the bulkhead.

    Three parts rather than one, because they are three different structural ideas and the
    flat shading in the lab reads the folds between them: a pan you sit on, a back you lean
    against, and a pedestal carrying both to the floor.

    EVERY DIMENSION COMES OFF THE BODY (see the BODY_* block). The pan is at BODY_SEAT_Z and
    stops short of BODY_KNEE_Y; the back tops out just above BODY_SHOULDER_Z and is wider than
    BODY_SHOULDER_HALF; the pedestal lands on the DISHED floor via tub_floor_z() rather than on
    a flat FLOOR_Z it does not have.

    NO HEADREST. Max ruled headrests out when he ruled the seat out, and only the seat has
    been un-ruled. The back stops at the shoulder line on purpose.
    """
    parts = []

    # ---- pan: a slab under the thighs, tilted very slightly nose-up so the pilot is held
    # rather than sliding forward. The tilt is 0.02 m over its length, i.e. about 2 degrees.
    pan_front_z = SEAT_PAN_Z + 0.02
    pan_back_z = SEAT_PAN_Z
    parts.append((NAME_SEAT_PAN,) + _extrude_profile(
        [(SEAT_PAN_FRONT_Y, pan_front_z), (SEAT_PAN_BACK_Y, pan_back_z)],
        SEAT_PAN_HALF, SEAT_PAN_THICK, down=True))

    # ---- back: from the pan's rear edge up and AFT to SEAT_BACK_TOP_Z
    parts.append((NAME_SEAT_BACK,) + _extrude_profile(
        [(SEAT_PAN_BACK_Y, pan_back_z),
         (SEAT_PAN_BACK_Y + SEAT_BACK_RAKE_Y, SEAT_BACK_TOP_Z)],
        SEAT_BACK_HALF, SEAT_BACK_THICK, down=False))

    # ---- base: pedestal from under the pan down to the floor. Its underside follows the
    # dish, so the seat rests ON the tub instead of intersecting or floating over it.
    # MAX, not min, over the footprint. The floor dishes DOWN toward the centreline, so a
    # flat-bottomed pedestal dropped to the deepest point it spans (-1.200 at x=0) would push
    # its outer corners 24 mm THROUGH the hull, where the floor is only -1.176. Resting it on
    # the highest point instead leaves a lens of air under the middle of the pedestal, which
    # is entirely enclosed by the seat and the floor and can never be seen.
    z_lo = max(tub_floor_z(SEAT_BASE_HALF, SEAT_BASE_FRONT_Y),
               tub_floor_z(SEAT_BASE_HALF, SEAT_BASE_BACK_Y),
               tub_floor_z(0.0, SEAT_BASE_FRONT_Y),
               tub_floor_z(0.0, SEAT_BASE_BACK_Y)) + SEAT_FLOOR_GAP
    z_hi = pan_back_z
    if z_lo >= z_hi - 1e-6:
        raise ValueError(
            "the cabin floor at %.4f is at or above the seat pan at %.4f, so the pedestal has "
            "no height. FLOOR_Z and BODY_SEAT_Z have crossed." % (z_lo, z_hi))
    verts = [
        (-SEAT_BASE_HALF, SEAT_BASE_FRONT_Y, z_lo), (SEAT_BASE_HALF, SEAT_BASE_FRONT_Y, z_lo),
        (SEAT_BASE_HALF, SEAT_BASE_BACK_Y, z_lo), (-SEAT_BASE_HALF, SEAT_BASE_BACK_Y, z_lo),
        (-SEAT_BASE_HALF, SEAT_BASE_FRONT_Y, z_hi), (SEAT_BASE_HALF, SEAT_BASE_FRONT_Y, z_hi),
        (SEAT_BASE_HALF, SEAT_BASE_BACK_Y, z_hi), (-SEAT_BASE_HALF, SEAT_BASE_BACK_Y, z_hi),
    ]
    faces = _orient_outward(verts, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
                                    (3, 2, 6, 7), (1, 2, 6, 5), (0, 3, 7, 4)])
    parts.append((NAME_SEAT_BASE, verts, faces))
    return parts


def _orient_outward(verts, faces):
    """Wind every face so its Newell normal points away from the solid's centroid."""
    cx = sum(v[0] for v in verts) / len(verts)
    cy = sum(v[1] for v in verts) / len(verts)
    cz = sum(v[2] for v in verts) / len(verts)
    out = []
    for f in faces:
        n = _newell_normal(verts, f)
        c = [sum(verts[k][i] for k in f) / len(f) for i in range(3)]
        if v_dot(n, v_sub(c, (cx, cy, cz))) < 0.0:
            f = tuple(reversed(f))
        out.append(f)
    return out


def _extrude_profile(spine, half, thick, down):
    """A slab following a (y, z) spine, `half` wide either side of the centreline.

    `down=True` puts the thickness BELOW the spine (the pan: you sit on the spine), False puts
    it BEHIND (the backrest: you lean on the spine). Returns (verts, faces) for a closed solid.
    """
    (y0, z0), (y1, z1) = spine[0], spine[-1]
    dy, dz = y1 - y0, z1 - z0
    ln = math.hypot(dy, dz)
    if ln < 1e-9:
        raise ValueError("seat slab has zero length; its two spine points coincide")
    # offset direction: perpendicular to the spine in the y-z plane, pointing away from
    # the pilot -- down for the pan, aft for the back.
    ox, oz = (0.0, -1.0) if down else (-dz / ln, dy / ln)
    if not down and ox > 0.0:
        ox, oz = -ox, -oz
    top = [(y0, z0), (y1, z1)]
    bot = [(y + ox * thick, z + oz * thick) for (y, z) in top]
    verts = []
    for (y, z) in top + bot:
        verts.append((-half, y, z))
        verts.append((half, y, z))
    # verts: 0,1 = top front L/R | 2,3 = top back | 4,5 = bot front | 6,7 = bot back
    faces = [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (1, 3, 7, 5), (0, 2, 6, 4)]
    return verts, _orient_outward(verts, faces)


def seat_probe_points():
    """A grid over every seat part's surface, for the containment check."""
    pts = []
    for (_nm, verts, _faces) in build_seat():
        lo = [min(v[i] for v in verts) for i in range(3)]
        hi = [max(v[i] for v in verts) for i in range(3)]
        for a in range(SEAT_PROBE_N):
            for b in range(SEAT_PROBE_N):
                for c in range(2):
                    fa, fb = a / (SEAT_PROBE_N - 1.0), b / (SEAT_PROBE_N - 1.0)
                    pts.append((lo[0] + (hi[0] - lo[0]) * fa,
                                lo[1] + (hi[1] - lo[1]) * fb,
                                lo[2] + (hi[2] - lo[2]) * c))
    return pts


def build_dash():
    """Dash_Shelf: the glare shield lying on the coaming. A placeholder surface, no content.

    Trapezoidal in plan rather than rectangular, because the tub narrows toward the bow and a
    rectangle would either overhang the rails at the front or waste 6 cm a side at the back.
    Its outboard edges track rail_inboard_x(), so the shelf re-fits itself whenever the cabin
    is re-proportioned.

    Every face is oriented OUTWARD by measuring its Newell normal against the slab centre
    rather than by hand-winding eight vertices, which is the class of mistake that flipped every
    panel in the model once already (see station_ring()).
    """
    y_front, y_back, hf, hb, top, bot = dash_extents()
    verts = [
        (-hf, y_front, top), (hf, y_front, top), (hf, y_back, top), (-hf, y_back, top),
        (-hf, y_front, bot), (hf, y_front, bot), (hf, y_back, bot), (-hf, y_back, bot),
    ]
    faces = _orient_outward(verts, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
                                    (3, 2, 6, 7), (1, 2, 6, 5), (0, 3, 7, 4)])
    return verts, faces


def dash_probe_points():
    """Points across the shelf's top and bottom faces, for the containment check.

    The eight corners alone would be a weak test: the shelf is a ruled surface between two
    stations, and the tub wall it has to stay inside of is too, so the two can only cross where
    they are checked. A grid catches a mid-span crossing that the corners would clear.
    """
    y_front, y_back, hf, hb, top, bot = dash_extents()
    pts = []
    for i in range(DASH_PROBE_N):
        s = i / (DASH_PROBE_N - 1.0)
        y = y_front + (y_back - y_front) * s
        half = hf + (hb - hf) * s
        for j in range(DASH_PROBE_N):
            u = -1.0 + 2.0 * j / (DASH_PROBE_N - 1.0)
            for z in (top, bot):
                pts.append((u * half, y, z))
    return pts


def _newell_normal(verts, face):
    nx = ny = nz = 0.0
    for k in range(len(face)):
        a = verts[face[k]]
        b = verts[face[(k + 1) % len(face)]]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return v_norm((nx, ny, nz))


# =============================================================================
# Containment: is a point INSIDE the enclosure?
#
# The previous revision compared distances -- "no screen vertex may be further from the eye
# than the nearest point of the glass". That was adequate for a window and is wrong for an
# enclosure, where the roof genuinely comes closer to the eye than the screens are wide.
# The honest question is a ray question: cast from the eye through the point, and ask whether
# the shell is crossed before the point or after it. Rays that leave through the OPEN bow
# aperture hit nothing, and correctly impose no constraint -- that is the windscreen.
# =============================================================================

def shell_triangles(include_closures=True):
    """Surfaces a ray from the eye could cross, as world triangles.

    include_closures=True   the whole enclosure: every shell panel, glass and hull, plus the
                            aft bulkhead. This is what "is the pilot enclosed?" and "is this
                            screen inside the cabin?" mean.
    include_closures=False  the SHELL PANELS ALONE, still both materials. This is what a seam
                            member must be inboard of, and it is now the more natural of the
                            two: with the profile closed, a member's incident panels can be
                            one glass and one hull -- that is exactly what the RAIL is -- so
                            splitting the shell by material here would measure the rail
                            against half of the surface it lies on.

    The open-arch build drew this line between glass and hull instead, because a sill rail sat
    on the vault's free bottom edge and legitimately hung below the separate floor pan. There
    is no free edge and no separate pan any more, so that exemption is gone with them.
    """
    tris = []
    for material in (SEG_GLASS, SEG_HULL):
        sv, sf = build_shell(material)
        for f in triangulate(sf):
            tris.append((sv[f[0]], sv[f[1]], sv[f[2]]))
    if include_closures:
        for (cv, cf) in (build_bulkhead(), build_coaming()):
            for f in triangulate(cf):
                tris.append((cv[f[0]], cv[f[1]], cv[f[2]]))
    return tris


def _ray_tri(origin, d, tri):
    """Moller-Trumbore. Returns t along d, or None. Two-sided: the shell has no outside here."""
    e1 = v_sub(tri[1], tri[0])
    e2 = v_sub(tri[2], tri[0])
    pv = v_cross(d, e2)
    det = v_dot(e1, pv)
    if abs(det) < 1e-12:
        return None
    inv = 1.0 / det
    tv = v_sub(origin, tri[0])
    u = v_dot(tv, pv) * inv
    if u < -1e-9 or u > 1.0 + 1e-9:
        return None
    qv = v_cross(tv, e1)
    w = v_dot(d, qv) * inv
    if w < -1e-9 or u + w > 1.0 + 1e-9:
        return None
    t = v_dot(e2, qv) * inv
    return t if t > 1e-9 else None


def shell_exit_distance(direction, tris=None):
    """Distance from the eye to the shell along a unit direction, or None if it never crosses."""
    if tris is None:
        tris = shell_triangles()
    best = None
    for tri in tris:
        t = _ray_tri((0.0, 0.0, 0.0), direction, tri)
        if t is not None and (best is None or t < best):
            best = t
    return best


def inside_margin(p, tris=None):
    """Metres by which p sits INSIDE the shell along its own eye ray. None if the ray exits
    through the open bow aperture, where there is nothing to be inside of."""
    d = v_len(p)
    if d < 1e-9:
        return None
    hit = shell_exit_distance(v_mul(p, 1.0 / d), tris)
    if hit is None:
        return None
    return hit - d


# =============================================================================
# Measurements. Every claim AC-FORM makes about the enclosure becomes a number here.
# =============================================================================

SPHERE_LAT = 90     # latitude bands over the full sphere, sampled at cell centres
SPHERE_LON = 180    # ...and meridians. Area-weighted by cos(latitude), so the fractions
                    # below are true solid-angle fractions and not sample-count fractions.

# Sector -> the axis it is centred on. A direction belongs to a sector when it lies within
# SECTOR_HALF_ANGLE of that axis. Named for the head movement that finds them, because that
# is how Max stated the requirement: "canopy above, in front, and to either side."
SECTOR_AXES = (
    ("ahead", (0.0, 1.0, 0.0)),
    ("above", (0.0, 0.0, 1.0)),
    ("left", (-1.0, 0.0, 0.0)),
    ("right", (1.0, 0.0, 0.0)),
    ("behind", (0.0, -1.0, 0.0)),
    ("below", (0.0, 0.0, -1.0)),
)
SECTOR_HALF_ANGLE = 45.0


def sphere_samples():
    """Deterministic area-weighted directions over the whole sphere, in a fixed order."""
    out = []
    for a in range(SPHERE_LAT):
        lat = -math.pi * 0.5 + math.pi * (a + 0.5) / SPHERE_LAT
        weight = math.cos(lat)
        for b in range(SPHERE_LON):
            lon = -math.pi + 2.0 * math.pi * (b + 0.5) / SPHERE_LON
            out.append(((math.cos(lat) * math.sin(lon),
                         math.cos(lat) * math.cos(lon),
                         math.sin(lat)), weight))
    return out


def enclosure_coverage():
    """What fraction of the sphere around the pilot's eye is cockpit rather than empty space?

    THIS IS THE MEASUREMENT THE RE-SPEC EXISTS FOR. Max's correction was that the build was a
    WINDOW and he wanted an ENCLOSURE -- "the player should be situated with canopy above, in
    front, and to either side of them". Turned into an instrument, that is: cast rays from the
    eye in every direction and ask how many of them find structure. A window scores near zero
    everywhere except ahead; an enclosure scores near one everywhere except through its
    aperture. AC-FORM's "turning the head finds canopy rather than empty space" stops being a
    vibe and becomes six numbers.

    Reported per sector AND overall, all solid-angle weighted.
    """
    tris = shell_triangles()
    cos_lim = math.cos(math.radians(SECTOR_HALF_ANGLE))
    hit_w = {nm: 0.0 for (nm, _ax) in SECTOR_AXES}
    tot_w = {nm: 0.0 for (nm, _ax) in SECTOR_AXES}
    hit_all = 0.0
    tot_all = 0.0
    for (d, weight) in sphere_samples():
        covered = shell_exit_distance(d, tris) is not None
        tot_all += weight
        if covered:
            hit_all += weight
        for (nm, ax) in SECTOR_AXES:
            if v_dot(d, ax) >= cos_lim:
                tot_w[nm] += weight
                if covered:
                    hit_w[nm] += weight
    sectors = {}
    for (nm, _ax) in SECTOR_AXES:
        sectors[nm] = (hit_w[nm] / tot_w[nm]) if tot_w[nm] > 0.0 else 0.0
    return {
        "sphereFraction": (hit_all / tot_all) if tot_all > 0.0 else 0.0,
        "sectors": sectors,
        "sectorHalfAngleDeg": SECTOR_HALF_ANGLE,
        "samples": len(sphere_samples()),
    }


def canopy_frame_landing():
    """Where the BOW rim lands relative to the 70 deg / 16:9 frame edge, per side.

    The bow ring is the pilot's forward aperture, and the whole sizing argument in the
    constants block is a claim about where it lands. This is that claim measured: negative
    "insideBy" means the rim sits inside the frame edge (structure visible at that edge),
    positive means it has run outside the view entirely -- which is the defect that made the
    pre-ceb277e build have no visible enclosure at all.
    """
    tan_h, tan_v = frame_tangents()
    ring = station_ring(0)
    y = STATIONS[0][1]
    half_w = STATIONS[0][2]
    top_z = STATIONS[0][3]
    out = {}
    # The aperture's lower bound is now THE RAIL, not the old sill. Below the rail the bow is
    # solid coaming, so measuring down to the floor would report an opening that is hull.
    for (nm, val, limit) in (("right", half_w / y, tan_h),
                             ("left", half_w / y, tan_h),
                             ("top", top_z / y, tan_v),
                             ("bottom", -RAIL_Z / y, tan_v)):
        out[nm] = {
            "tan": val,
            "frameTan": limit,
            "insideBy": limit - val,
            "halfAngleDeg": math.degrees(math.atan(val)),
            "frameHalfAngleDeg": math.degrees(math.atan(limit)),
        }
    out["ringPoints"] = len(ring)
    return out


MEMBER_PROBE_T = (0.0, 0.25, 0.5, 0.75, 1.0)    # along each section-to-section span
MEMBER_PROBE_U = (-1.0, -0.5, 0.0, 0.5, 1.0)    # across the member, as fractions of half-width


def member_probe_points(member):
    """Points on a member's OUTER face -- the face nearest the glass -- in a fixed order."""
    secs = member["sections"]
    pts = []
    for k in range(len(secs) - 1):
        # corners 2 and 3 are the near (outer) edge of the section; see member_sections()
        a_out, a_inn = secs[k][2], secs[k][3]
        b_out, b_inn = secs[k + 1][2], secs[k + 1][3]
        for t in MEMBER_PROBE_T:
            for u in MEMBER_PROBE_U:
                f = (u + 1.0) * 0.5
                a = v_add(a_inn, v_mul(v_sub(a_out, a_inn), f))
                b = v_add(b_inn, v_mul(v_sub(b_out, b_inn), f))
                pts.append(v_add(a, v_mul(v_sub(b, a), t)))
    return pts


def member_inboard_margin(member, tris=None):
    """Smallest margin by which a member sits INSIDE the shell, in metres.

    Deliberately measured against the FINISHED shell by ray casting, independently of the
    arithmetic in member_sections() that placed it -- so a wrong derivation shows up here
    instead of being confirmed by its own algebra.

    SIGNED, unlike the check this replaces. ceb277e's rib-to-shell test took an UNSIGNED
    distance, so a rib bolted to the OUTSIDE of the canopy measured identical to one correctly
    inboard, and the whole suite passed a build with the structure on the wrong side of the
    glass. Negative here means the member has broken out through the panels it lies on.

    Returns (worst_margin, planted_defect_margin). The planted defect is the same probe set
    displaced OUTWARD along the seam normal by MEMBER_PLANT_OFFSET: it must come out clearly
    negative, or this instrument is not discriminating and its pass means nothing.
    """
    if tris is None:
        tris = shell_triangles(include_closures=False)
    worst = None
    worst_planted = None
    secs = member["sections"]
    norms = member["normals"]
    for idx, p in enumerate(member_probe_points(member)):
        m = inside_margin(p, tris)
        if m is not None and (worst is None or m < worst):
            worst = m
    for k, p in enumerate(member["seam"]):
        planted = v_add(p, v_mul(norms[k], MEMBER_PLANT_OFFSET))
        m = inside_margin(planted, tris)
        if m is not None and (worst_planted is None or m > worst_planted):
            worst_planted = m
    return (worst if worst is not None else 0.0,
            worst_planted if worst_planted is not None else 0.0)


MEMBER_PLANT_OFFSET = 0.05   # metres a probe is pushed OUTWARD through the glass to prove the
                             # containment instrument can actually read a breakout


def panel_edges():
    """Every vault edge, split by how many panels meet along it. Fixed order, derived from the
    PANEL MESH -- deliberately not read back off the seam tables, so the two can be compared.

    fold  two panels meet: a genuine crease in the surface. This is what AC-FORM means by "the
          SEAM where those panels meet", and it is what the interior ribs must lie on.
    rim   one panel only: the shell's boundary -- the bow aperture, the aft opening, and the
          two sill lines. Structurally these are rails and rims rather than folds. They carry
          members too, and those members are just as real, but calling them fold-seams would
          be sloppy: the difference is exactly the difference between a mullion and a sill.
    """
    grid = ring_grid()
    counts = {}
    for quad in panel_quads():
        n = len(quad)
        for k in range(n):
            key = tuple(sorted((quad[k], quad[(k + 1) % n])))
            counts[key] = counts.get(key, 0) + 1
    out = {"fold": [], "rim": []}
    for key in sorted(counts):
        (ia, ja), (ib, jb) = key
        seg = (grid[ia][ja], grid[ib][jb])
        if counts[key] == 2:
            out["fold"].append(seg)
        elif counts[key] == 1:
            out["rim"].append(seg)
    return out


def member_seam_family(member):
    """Which edge family this member is supposed to lie on -- derived, not declared.

    A longitudinal member at the first or last arch index runs along the shell's outer edge;
    a transverse member at the first or last station runs along its bow or aft rim. Everything
    else is an interior fold. Deriving it means a re-author who adds a station or an arch point
    cannot leave a stale declaration behind.
    """
    if member["kind"] == "long":
        # The ring is CLOSED, so no longitudinal seam is an outer edge any more -- every one
        # of them is an interior fold between two panels. That is the point: the rail is a
        # fold between hull and glass, not a free rim that needs trimming.
        return "fold"
    return "rim" if member["seamIndex"] in (0, len(STATIONS) - 1) else "fold"


def _point_segment_distance(p, a, b):
    ab = v_sub(b, a)
    L2 = v_dot(ab, ab)
    if L2 < 1e-18:
        return v_len(v_sub(p, a))
    t = v_dot(v_sub(p, a), ab) / L2
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    return v_len(v_sub(p, v_add(a, v_mul(ab, t))))


def member_seam_residual(member, edges=None):
    """How far a member's centreline strays from the nearest edge OF ITS OWN FAMILY.

    AC-FORM(b): "a rib not lying on a panel-to-panel seam is a failure." Here that is a
    distance in metres, taken between the member's own vertices and the edges recovered
    independently from the panel mesh -- and specifically against the family the member is
    supposed to be on, so a fold rib cannot pass by happening to sit near a rim.

    It is ~0 by construction. It is measured anyway, with a planted defect, because "true by
    construction" is precisely the claim ceb277e's three unfalsifiable assertions were making
    when they passed a build whose ribs lay on a flat pane with no seams at all.

    Returns (worst_residual, planted_defect_residual). The planted defect displaces every
    vertex ACROSS the seam by MEMBER_PLANT_OFFSET and must register clearly.
    """
    if edges is None:
        edges = panel_edges()
    segs = edges[member_seam_family(member)]
    if not segs:
        raise ValueError(
            "no %s edges exist in the vault, so %s cannot be checked against anything. The "
            "panel mesh and the member tables have diverged."
            % (member_seam_family(member), member["name"]))
    pts = member["seam"]
    norms = member["normals"]
    worst = 0.0
    for p in pts:
        d = min(_point_segment_distance(p, a, b) for (a, b) in segs)
        if d > worst:
            worst = d

    # The planted defect is probed at SEGMENT MIDPOINTS, never at vertices.
    #
    # Seams cross each other at vertices -- the shoulder rib meets the mid arch at exactly one
    # point, a sill rail meets the bow rim at exactly one point -- and "across" one seam at
    # such a vertex is "along" the other. Displacing there lands back on a seam and reads as a
    # blind instrument when in fact it is a true statement about the joint. A midpoint has no
    # crossing seam within half a panel, so a displacement there is a genuine departure and
    # the test measures what it claims to.
    worst_planted = None
    for k in range(len(pts) - 1):
        mid = v_mul(v_add(pts[k], pts[k + 1]), 0.5)
        t = v_norm(v_sub(pts[k + 1], pts[k]))
        n_out = v_norm(v_add(norms[k], norms[k + 1]))
        c = v_cross(n_out, t)
        if v_len(c) < 1e-9:
            continue
        q = v_add(mid, v_mul(v_norm(c), MEMBER_PLANT_OFFSET))
        dp = min(_point_segment_distance(q, a, b) for (a, b) in segs)
        if worst_planted is None or dp < worst_planted:
            worst_planted = dp
    if worst_planted is None:
        raise ValueError(
            "%s yielded no usable planted-defect probe, so its seam-membership instrument was "
            "never checked against a defect at all. A pass it reports means nothing."
            % member["name"])
    return worst, worst_planted


def member_bend_angles(member):
    """Interior bend at each seam vertex, in degrees. 0 is straight; large is a sharp fold.

    Reported because the FOLD is the form cue: Max's references show members that bend as they
    run, and it is the bend rather than any curvature that conveys the canopy's shape. If
    these all come out near zero the vault has flattened out and the enclosure is drifting
    back toward the window it replaced.
    """
    pts = member["seam"]
    out = []
    for k in range(1, len(pts) - 1):
        a = v_norm(v_sub(pts[k], pts[k - 1]))
        b = v_norm(v_sub(pts[k + 1], pts[k]))
        d = v_dot(a, b)
        d = -1.0 if d < -1.0 else (1.0 if d > 1.0 else d)
        out.append(math.degrees(math.acos(d)))
    return out


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


def screen_frame(tan_x, tan_z, dist):
    """Orthonormal frame for one screen unit, from its tan-space position.

    The display face's normal IS the centre->eye direction -- never a hand-tuned Euler angle
    -- so AC-FORM's "within 20 degrees of the centre-to-eye vector" is 0 degrees by
    construction, and the thing that can actually fail is the EXPORT, which is where
    tests/cockpit-geometry.test.js measures it.

    u is screen-right (+X-ish), w is screen-up, and u x w == n.
    """
    d = v_norm((tan_x, 1.0, tan_z))
    centre = v_mul(d, dist)
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


# Display-face UVs, in the SAME corner order _rect() emits: (-u,-w) (+u,-w) (+u,+w) (-u,+w).
# So (0,0) is the pilot's LOWER-LEFT of the panel and (1,1) its upper-right.
#
# WHY THIS EXISTS AT ALL. Increment 2's Phosphor CRT and increment 5's screen content both
# need to draw a render target onto these quads, and a mesh with no TEXCOORD_0 cannot carry
# one. Emitting the layer here rather than making the content lane rebuild its own quads
# keeps ONE definition of where a screen is: the content lane binds a texture, and where
# that surface sits in space stays this script's business. That seam is what lets the two
# lanes move independently -- the screens' POSITIONS are still being re-fitted, and nothing
# downstream should have to care.
SCREEN_FACE_UV = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))


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


def rib_mount_point(profile_index, y):
    """A mounting point on the INNER face of a longitudinal member, at depth y.

    Returns (face_point, seam_point, inward_unit). The face point is where a bracket would
    actually bolt on -- the member's inboard face, not its centreline -- so an arm rooted here
    starts ON the rib rather than buried inside it or floating beside it.

    This is the mechanism that replaces the retired "root outside the frustum" rule. It is a
    stronger property: it is defined against a named member's real solid, so it cannot be
    satisfied by hanging in empty space, which is exactly how the previous build got four
    monitors on two lamp-posts while passing every assertion in the suite.
    """
    pts, norms, planes = seam_points("long", profile_index)
    _name, (width, depth) = LONGITUDINAL_NAMES[profile_index]
    _secs, standoffs = member_sections(pts, norms, planes, width, depth,
                                       seam_span_planes("long", profile_index, len(pts)))
    ys = [p[1] for p in pts]           # stations run bow -> aft, i.e. DECREASING y
    if y > ys[0] or y < ys[-1]:
        raise ValueError(
            "ARM_MOUNT_Y = %.3f is outside the canopy's fore-aft extent (%.3f .. %.3f). The "
            "arm would bolt to a point its rib does not reach." % (y, ys[-1], ys[0]))
    k = 0
    while k < len(ys) - 2 and y < ys[k + 1]:
        k += 1
    span = ys[k] - ys[k + 1]
    t = 0.0 if abs(span) < 1e-12 else (ys[k] - y) / span
    seam_p = v_add(pts[k], v_mul(v_sub(pts[k + 1], pts[k]), t))
    n_out = v_norm(v_add(norms[k], v_mul(v_sub(norms[k + 1], norms[k]), t)))
    inward = v_mul(n_out, -1.0)
    # the standoff is SOLVED per vertex in member_sections(), so the member's inboard face is
    # not at a fixed depth -- read the real one rather than re-assuming the authored gap
    standoff = standoffs[k] + (standoffs[k + 1] - standoffs[k]) * t
    face_p = v_add(seam_p, v_mul(inward, standoff + depth))
    return face_p, seam_p, inward, standoff


def arm_endpoints(centre, n, u, w, tan_x, tan_z, suffix):
    """Where one arm starts and stops.

    Root: ON A RIB. The arm bolts to the inboard face of the longitudinal member named for its
    quadrant in ARM_MOUNT_PROFILE, at depth ARM_MOUNT_Y -- which is AFT of the screens, so
    every arm reaches forward to its panel instead of running flat across the pilot's view.

    Tip: the back plate, offset toward its OUTBOARD-FAR corner and pushed ARM_EMBED into the
    box. Landing on the dead centre of the plate would hide the entire strut behind its own
    screen; landing it off-corner keeps a readable length of arm between the box's edge and
    the edge of the frame.
    """
    sx = 1.0 if tan_x >= 0.0 else -1.0
    sz = 1.0 if tan_z >= 0.0 else -1.0
    profile_index = ARM_MOUNT_PROFILE[suffix]
    root, seam_p, inward, mount_standoff = rib_mount_point(profile_index, ARM_MOUNT_Y)

    Hu = SCREEN_W * 0.5 + SCREEN_BEZEL
    Hw = SCREEN_H * 0.5 + SCREEN_BEZEL
    bezel_c = v_add(centre, v_mul(n, SCREEN_FACE_RECESS))
    back_c = v_sub(bezel_c, v_mul(n, SCREEN_BODY_DEPTH))
    # -sx is INBOARD. See ARM_ATTACH_U: the outboard-far corner has 37 mm to the hull and the
    # inboard one has 497 mm, and aiming at the former is what made the arms unfittable.
    attach = v_add(back_c, v_add(v_mul(u, -sx * ARM_ATTACH_U * Hu),
                                 v_mul(w, sz * ARM_ATTACH_W * Hw)))
    return root, attach, seam_p, inward, profile_index, mount_standoff


def _prism(centre, axis, radius, half_len, sides):
    """A regular n-gon prism about `axis`. Deterministic, flat-faced, used for the elbow puck."""
    axis = v_norm(axis)
    ref = BLENDER_UP if abs(v_dot(BLENDER_UP, axis)) < 0.98 else (1.0, 0.0, 0.0)
    u = v_norm(v_cross(ref, axis))
    w = v_cross(axis, u)
    a = v_sub(centre, v_mul(axis, half_len))
    b = v_add(centre, v_mul(axis, half_len))
    verts = []
    for end in (a, b):
        for k in range(sides):
            ang = 2.0 * math.pi * k / sides
            verts.append(v_add(end, v_add(v_mul(u, radius * math.cos(ang)),
                                          v_mul(w, radius * math.sin(ang)))))
    faces = [tuple(range(sides - 1, -1, -1)),
             tuple(range(sides, 2 * sides))]
    for k in range(sides):
        k2 = (k + 1) % sides
        faces.append((k, k2, sides + k2, sides + k))
    return verts, faces


def _boom(a, b, half_u, half_w, ref=None):
    """A straight rectangular boom from a to b. Six flat faces; no taper, unlike the old stick."""
    axis = v_sub(b, a)
    if v_len(axis) < 1e-6:
        raise ValueError("boom has zero length")
    axis = v_norm(axis)
    if ref is None:
        ref = BLENDER_UP if abs(v_dot(BLENDER_UP, axis)) < 0.98 else (1.0, 0.0, 0.0)
    au = v_norm(v_cross(ref, axis))
    aw = v_cross(axis, au)          # (au, aw, axis) right-handed: au x aw == axis

    def section(p):
        return (
            v_add(p, v_add(v_mul(au, half_u), v_mul(aw, -half_w))),
            v_add(p, v_add(v_mul(au, half_u), v_mul(aw, half_w))),
            v_add(p, v_add(v_mul(au, -half_u), v_mul(aw, half_w))),
            v_add(p, v_add(v_mul(au, -half_u), v_mul(aw, -half_w))),
        )

    return loft([section(a), section(b)])


def build_arm(root, inward, n, attach):
    """One monitor arm, in five parts, from its rib mount to the back of its screen.

    root    the point on the rib's INBOARD face where the arm bolts on
    inward  that member's inward direction -- the plate lies flat on it and BoomA leaves
            perpendicular to it, which is how a real bracket comes off a rail
    n       the screen's normal (pointing at the eye)
    attach  the point on the screen's back plate the head drives into

    Front to back the chain is  Mount -> BoomA -> Elbow -> BoomB -> Head -> (into the box).
    HEAD IS PARALLEL TO n. That is not a style choice: it is what makes the arm provably
    incapable of crossing in front of its own bezel, which a straight strut cannot avoid.
    """
    parts = []
    plate_c = v_add(root, v_mul(inward, ARM_MOUNT_THICK * 0.5))
    pv, pf = _boom(v_sub(plate_c, v_mul(inward, ARM_MOUNT_THICK * 0.5)),
                   v_add(plate_c, v_mul(inward, ARM_MOUNT_THICK * 0.5)),
                   ARM_MOUNT_HALF_U, ARM_MOUNT_HALF_W)
    parts.append(("Mount", pv, pf))

    elbow_c = v_add(root, v_mul(inward, ARM_MOUNT_THICK + ARM_BOOM_A_LEN))
    av, af = _boom(v_add(root, v_mul(inward, ARM_MOUNT_THICK)), elbow_c,
                   ARM_BOOM_A_HALF_U, ARM_BOOM_A_HALF_W)
    parts.append(("BoomA", av, af))

    head_start = v_sub(attach, v_mul(n, ARM_HEAD_LEN))
    seg_a = v_mul(inward, 1.0)
    seg_b = v_sub(head_start, elbow_c)
    if v_len(seg_b) < 1e-6:
        raise ValueError("arm elbow coincides with its screen head; shorten ARM_BOOM_A_LEN")
    bend = math.degrees(math.acos(max(-1.0, min(1.0, v_dot(seg_a, v_norm(seg_b))))))
    if bend < ARM_MIN_BEND_DEG:
        raise ValueError(
            "arm bends only %.1f degrees at the elbow (minimum %.1f), so its two booms read as "
            "one straight stick and the arm has stopped being articulated -- which is the "
            "defect the five-part form exists to fix. Change ARM_BOOM_A_LEN (%.3f m) or "
            "ARM_MOUNT_Y (%.3f m)."
            % (bend, ARM_MIN_BEND_DEG, ARM_BOOM_A_LEN, ARM_MOUNT_Y))

    # the hinge pin lies across the plane the two booms turn in -- that is what a hinge is
    pin = v_cross(seg_a, v_norm(seg_b))
    if v_len(pin) < 1e-6:
        pin = BLENDER_UP
    ev, ef = _prism(elbow_c, pin, ARM_ELBOW_RADIUS, ARM_ELBOW_HALF_LEN, ARM_ELBOW_SIDES)
    parts.append(("Elbow", ev, ef))

    bv, bf = _boom(elbow_c, head_start, ARM_BOOM_B_HALF_U, ARM_BOOM_B_HALF_W)
    parts.append(("BoomB", bv, bf))

    hv, hf = _boom(head_start, v_add(attach, v_mul(n, ARM_EMBED)),
                   ARM_HEAD_HALF_U, ARM_HEAD_HALF_W)
    parts.append(("Head", hv, hf))
    return parts, elbow_c, bend


def screen_units():
    """Every screen unit, built once and shared by the exporter, the predictor and the sidecar.

    One builder, three consumers: the GLB, the analytic measurement and the metrics sidecar
    can never disagree about where a screen is, because there is only one place it is decided.
    """
    units = []
    for (suffix, tan_x, tan_z, dist) in SCREEN_QUADRANTS:
        centre, n, u, w = screen_frame(tan_x, tan_z, dist)
        face_v, face_f = build_screen_face(centre, n, u, w)
        body_v, body_f = build_screen_body(centre, n, u, w)
        box_v, box_f = screen_outer_box(centre, n, u, w)
        (root, attach, seam_p, inward, prof,
         mount_standoff) = arm_endpoints(centre, n, u, w, tan_x, tan_z, suffix)
        arm_parts, elbow_c, bend = build_arm(root, inward, n, attach)
        units.append({
            "suffix": suffix,
            "armMountProfile": prof,
            "armMountMember": LONGITUDINAL_NAMES[prof][0],
            "armMountSeamPoint": seam_p,
            "armMountStandoff": mount_standoff,
            "armMountInward": inward,
            "tanX": tan_x,
            "tanZ": tan_z,
            "dist": dist,
            "centre": centre,
            "normal": n,
            "u": u,
            "w": w,
            "faceVerts": face_v, "faceFaces": face_f,
            "bodyVerts": body_v, "bodyFaces": body_f,
            "boxVerts": box_v, "boxFaces": box_f,
            "armParts": arm_parts,
            "armElbow": elbow_c,
            "armBendDeg": bend,
            "armRoot": root, "armTip": v_add(attach, v_mul(n, ARM_EMBED)),
        })
    return tuple(units)


def _assert_no_deleted_names(parts):
    """No part may carry a name Max deleted at UAT.

    Hoisted out of build_all()'s tail because the --no-fittings path returned BEFORE reaching
    it, so the one guard that catches Floor_Pan and Sill_L/R coming back was silently inactive
    in exactly the build mode the tub work has been using. The names it watches for are shell
    parts, not fittings, so it belongs on both paths.
    """
    for part in parts:
        if part["name"] in NAME_DELETED:
            raise ValueError(
                "part %r is one of the nodes Max deleted at UAT on 1056f30 (%s). Canopy_Frame "
                "is the perimeter band on the canopy's own edge and is NOT a revival of the "
                "free-standing octagonal ring; if a build ever emits one of the deleted names "
                "again that is an AC-FORM failure, not a naming accident."
                % (part["name"], ", ".join(NAME_DELETED)))


def build_all():
    """Every mesh, in a fixed order. Returns a list of dicts (name, verts, faces, material)."""
    parts = []
    hv, hf = build_shell(SEG_HULL)
    parts.append({"name": NAME_HULL, "verts": hv, "faces": hf,
                  "material": "Mat_Hull", "kind": "hull"})
    gv, gf = build_shell(SEG_GLASS)
    parts.append({"name": NAME_GLASS, "verts": gv, "faces": gf,
                  "material": "Mat_Glass", "kind": "glass"})
    bv, bf = build_bulkhead()
    parts.append({"name": NAME_BULKHEAD, "verts": bv, "faces": bf,
                  "material": "Mat_Hull", "kind": "hull"})
    cv, cf = build_coaming()
    parts.append({"name": NAME_COAMING, "verts": cv, "faces": cf,
                  "material": "Mat_Hull", "kind": "hull"})
    dv, df = build_dash()
    parts.append({"name": NAME_DASH, "verts": dv, "faces": df,
                  "material": "Mat_Hull", "kind": "hull"})
    for (snm, sv, sf) in build_seat():
        parts.append({"name": snm, "verts": sv, "faces": sf,
                      "material": "Mat_Body", "kind": "seat"})
    for mem in seam_members():
        parts.append({"name": mem["name"], "verts": mem["verts"], "faces": mem["faces"],
                      "material": "Mat_Frame", "kind": "member"})
    if not INCLUDE_FITTINGS:
        _assert_no_deleted_names(parts)
        for part in parts:
            part["faces"] = triangulate(part["faces"])
        return parts, ()
    units = screen_units()
    for un in units:
        parts.append({"name": SCREEN_PREFIX + un["suffix"], "verts": un["faceVerts"],
                      "faces": un["faceFaces"], "material": "Mat_Screen", "kind": "screen",
                      "uv": list(SCREEN_FACE_UV)})
    for un in units:
        parts.append({"name": BODY_PREFIX + un["suffix"], "verts": un["bodyVerts"],
                      "faces": un["bodyFaces"], "material": "Mat_Body", "kind": "body"})
    for un in units:
        for (pname, pv, pf) in un["armParts"]:
            parts.append({"name": "%s%s_%s" % (ARM_PREFIX, un["suffix"], pname),
                          "verts": pv, "faces": pf,
                          "material": "Mat_Arm", "kind": "arm"})
    _assert_no_deleted_names(parts)
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


def arm_in_front_of_box(arm_parts, un):
    """How far an arm pokes in FRONT of a screen box's bezel plane, where it overlaps it.

    A mount that swings around and crosses its own display face reads as a bug, not as a
    mount, and it is invisible in the occlusion total (the union counts it once either way) --
    so it needs its own check. For every sample along every EDGE of every part of the arm that
    projects INSIDE the box's silhouette, this compares the sample's distance from the eye
    against where the eye ray crosses the box's bezel plane. Positive means the arm is nearer:
    a visible defect.

    It walks all five parts' edges rather than one strut's four long edges, because the
    articulated arm has an elbow puck that bulges past both booms -- checking only the booms
    would step straight over the fattest part of the assembly.

    Returns (signed_metres, overlapping_samples). The sample COUNT is returned as well because
    "0.0" would otherwise be ambiguous between "checked and clear" and "the two never overlap,
    so nothing was checked" -- a pass that measured nothing is not a pass.
    """
    box_poly = silhouette_tan(un["boxVerts"], un["boxFaces"])
    if len(box_poly) < 3:
        return 0.0, 0
    n = un["normal"]
    plane_d = v_dot(n, v_add(un["centre"], v_mul(n, SCREEN_FACE_RECESS)))
    worst = None
    hits = 0
    for (_pname, pv, pf) in arm_parts:
        for (i, j) in edges_of(pf):
            a = pv[i]
            b = pv[j]
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

    # ---- The ENCLOSURE: does it actually enclose? ----------------------------
    # This is the measurement the re-spec exists for. The previous build was a WINDOW; Max
    # asked for canopy above, in front and to either side. enclosure_coverage() turns that
    # into six solid-angle numbers by casting rays from the eye in every direction, so
    # "turning the head finds canopy rather than empty space" is checked, not asserted.
    tris = shell_triangles()
    glass_tris = shell_triangles(include_closures=False)
    coverage = enclosure_coverage()
    landing = canopy_frame_landing()
    panel_dot, panel_dot_flipped = panel_normals_face_eye()

    if panel_dot <= 0.0:
        raise ValueError(
            "a canopy panel's normal points AWAY from the pilot (worst dot %.4f). The winding "
            "convention in panel_quads() is inverted, so the pilot would be looking at the "
            "back faces of their own canopy." % panel_dot)
    if panel_dot_flipped >= 0.0:
        raise ValueError(
            "the panel-orientation test is not discriminating: reversing every winding still "
            "reads as facing the eye (%.4f). panel_normals_face_eye() is not measuring what "
            "it claims to." % panel_dot_flipped)

    missing = [nm for nm in ("above", "left", "right", "behind")
               if coverage["sectors"][nm] < ENCLOSURE_SECTOR_MIN]
    if missing:
        raise ValueError(
            "AC-FORM(a): this is a WINDOW, not an ENCLOSURE. Within %.0f degrees of %s the "
            "pilot finds empty space rather than cockpit:\n%s\n"
            "  Every sector: %s\n"
            "  Fix: widen STATIONS' half-widths / roof heights, or extend the station "
            "list aft -- the vault has to wrap past the shoulders, which is the whole "
            "difference between what Max rejected and what he asked for."
            % (SECTOR_HALF_ANGLE, ", ".join(missing),
               "\n".join("    %-7s %.1f%% covered (needs %.0f%%)"
                          % (nm, 100.0 * coverage["sectors"][nm], 100.0 * ENCLOSURE_SECTOR_MIN)
                          for nm in missing),
               ", ".join("%s %.1f%%" % (nm, 100.0 * coverage["sectors"][nm])
                         for (nm, _ax) in SECTOR_AXES)))

    # ---- Seam members: on a seam, and inboard of the glass -------------------
    members = seam_members()
    edges = panel_edges()
    member_polys = []
    member_detail = []
    for mem in members:
        polys = [silhouette_tan(sv, sf) for (sv, sf) in loft_segments(mem["sections"])]
        member_polys.extend(polys)
        inboard, planted_inboard = member_inboard_margin(mem, glass_tris)
        residual, planted_residual = member_seam_residual(mem, edges)
        member_detail.append({
            "name": mem["name"],
            "seamFamily": mem["kind"],
            "edgeFamily": member_seam_family(mem),
            "seamIndex": mem["seamIndex"],
            "width": mem["width"],
            "depth": mem["depth"],
            "vertices": len(mem["seam"]),
            "seamResidual": residual,
            "seamResidualPlantedDefect": planted_residual,
            "inboardMargin": inboard,
            "inboardMarginPlantedDefect": planted_inboard,
            "bendAnglesDeg": member_bend_angles(mem),
            "ownOcclusion": coverage_fraction(polys),
        })

    off_seam = [d for d in member_detail if d["seamResidual"] > MEMBER_SEAM_TOL]
    if off_seam:
        raise ValueError(
            "AC-FORM(b): a member is not lying on a panel-to-panel seam, which is the one "
            "thing a rib structurally IS:\n%s\n"
            "  Fix: members are generated FROM seam_points(), so this means the seam table and "
            "the panel mesh have diverged -- check LONGITUDINAL_NAMES / TRANSVERSE_NAMES "
            "against panel_quads()."
            % "\n".join("    %s strays %.4f m from the nearest seam (tolerance %.4f m)"
                         % (d["name"], d["seamResidual"], MEMBER_SEAM_TOL) for d in off_seam))

    blind_seam = [d for d in member_detail
                  if d["seamResidualPlantedDefect"] < MEMBER_PLANT_OFFSET * 0.5]
    if blind_seam:
        raise ValueError(
            "the seam-membership test is not discriminating: %s displaced %.3f m ACROSS its "
            "seam still measures only %.4f m away from one. member_seam_residual() would pass "
            "a rib that is not on a seam, which is the assertion class that let the "
            "monitors-on-lamp-posts build ship 48/48 green."
            % (blind_seam[0]["name"], MEMBER_PLANT_OFFSET,
               blind_seam[0]["seamResidualPlantedDefect"]))

    broke_out = [d for d in member_detail if d["inboardMargin"] < 0.0]
    if broke_out:
        raise ValueError(
            "a member has broken OUT through the canopy panels it lies on:\n%s\n"
            "  This is the defect ceb277e's UNSIGNED rib-to-shell distance could not see -- a "
            "rib bolted to the outside of the glass measured identical to one correctly "
            "inboard. Reduce that member's depth, or raise RIB_GLASS_GAP (%.4f m)."
            % ("\n".join("    %s pokes out by %.4f m" % (d["name"], -d["inboardMargin"])
                          for d in broke_out), RIB_GLASS_GAP))

    blind_inboard = [d for d in member_detail
                     if d["inboardMarginPlantedDefect"] > -MEMBER_PLANT_OFFSET * 0.5]
    if blind_inboard:
        raise ValueError(
            "the inboard-containment test is not discriminating: a probe planted %.3f m "
            "OUTSIDE the glass on %s still reads as %.4f m inside. inside_margin() is not "
            "measuring what it claims to."
            % (MEMBER_PLANT_OFFSET, blind_inboard[0]["name"],
               blind_inboard[0]["inboardMarginPlantedDefect"]))

    # ---- Is the composition Max approved still the composition being built? --
    # SCREEN_FIT_SCALE shrinks the whole screen assembly toward the eye so it fits inside the
    # hull. That is only legitimate because a uniform scale is invisible: angular size and
    # bearing are both invariant under it. This checks that claim against the approved numbers
    # instead of trusting the arithmetic, so that scaling one term and forgetting another --
    # the face but not the distance, say -- is a build error rather than a silent change to
    # something he chose by eye.
    approved = []
    for (suffix, tan_x, tan_z, dist) in SCREEN_QUADRANTS:
        up = tan_z >= 0.0
        want_dist = (SCREEN_APPROVED_DIST_UP if up else SCREEN_APPROVED_DIST_DN)
        want_deg = 2.0 * math.degrees(math.atan((SCREEN_APPROVED_W * 0.5) / want_dist))
        got_deg = 2.0 * math.degrees(math.atan((SCREEN_W * 0.5) / dist))
        want_h = 2.0 * math.degrees(math.atan((SCREEN_APPROVED_H * 0.5) / want_dist))
        got_h = 2.0 * math.degrees(math.atan((SCREEN_H * 0.5) / dist))
        approved.append({"name": SCREEN_PREFIX + suffix,
                         "approvedWidthDeg": want_deg, "widthDeg": got_deg,
                         "approvedHeightDeg": want_h, "heightDeg": got_h,
                         "tanX": tan_x, "tanZ": tan_z,
                         "approvedDistance": want_dist, "distance": dist,
                         "scale": SCREEN_FIT_SCALE})
    drift = [a for a in approved
             if abs(a["widthDeg"] - a["approvedWidthDeg"]) > 1e-6
             or abs(a["heightDeg"] - a["approvedHeightDeg"]) > 1e-6]
    if drift:
        raise ValueError(
            "the screens no longer subtend what Max approved. A uniform SCREEN_FIT_SCALE is "
            "invisible to him precisely BECAUSE it holds these angles; if they have moved, "
            "something was scaled that should not have been, or not scaled that should:\n%s\n"
            "  Fix: SCREEN_W/H, SCREEN_BEZEL, SCREEN_BODY_DEPTH and both SCREEN_DIST_* must "
            "ALL carry the same SCREEN_FIT_SCALE (%.4f); the two TAN pairs must carry none."
            % ("\n".join("    %s subtends %.4f deg wide, approved %.4f"
                         % (a["name"], a["widthDeg"], a["approvedWidthDeg"]) for a in drift),
               SCREEN_FIT_SCALE))
    if SCREEN_FIT_SCALE > 1.0 + 1e-9:
        raise ValueError(
            "SCREEN_FIT_SCALE is %.4f. Scaling the assembly UP past what Max set is not a fit "
            "correction, it is a redesign of his composition." % SCREEN_FIT_SCALE)

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

        unit_arm_polys = [silhouette_tan(pv, pf) for (_pn, pv, pf) in un["armParts"]]
        arm_polys.extend(unit_arm_polys)
        root_tan = project_tan(un["armRoot"]) if un["armRoot"][1] > 1e-9 else None
        # Is the arm actually ON its rib? Distance from the root to the member's SEAM, minus
        # the offset that root was placed at. The retired rule asked whether the root was
        # outside the frustum, which empty space satisfies; this asks whether it is on a named
        # solid, which only a rib satisfies.
        mount_gap = abs(v_len(v_sub(un["armRoot"], un["armMountSeamPoint"]))
                        - (un["armMountStandoff"]
                           + LONGITUDINAL_NAMES[un["armMountProfile"]][1][1]))
        if mount_gap > ARM_MOUNT_TOL:
            arm_failures.append((ARM_PREFIX + un["suffix"], un["armMountMember"], mount_gap))
        # How much of the arm is actually visible: its silhouette inside the frame but NOT
        # behind its own screen box. An arm you cannot see is not an arm reaching in.
        arm_in_frame = sum(poly_area_2d(clip_poly(p, frame_rect)) for p in unit_arm_polys)
        arm_marginal = (coverage_fraction([box_poly] + unit_arm_polys)
                        - coverage_fraction([box_poly]))
        depth_fault = None
        depth_fault_against = None
        depth_samples = 0
        for other in units:
            f, hits = arm_in_front_of_box(un["armParts"], other)
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
            "mountMember": un["armMountMember"],
            "mountSeamPoint": un["armMountSeamPoint"],
            "mountGap": mount_gap,
            "parts": [pn for (pn, _v, _f) in un["armParts"]],
            "elbowBendDeg": un["armBendDeg"],
            "length": (v_len(v_sub(un["armElbow"], un["armRoot"]))
                       + v_len(v_sub(un["armTip"], un["armElbow"]))),
            "areaInFrameTanSpace": arm_in_frame,
            "occlusionBeyondItsScreen": arm_marginal,
            "inFrontOfBoxBy": depth_fault,
            "inFrontOfBox": depth_fault_against,
            "depthSamplesOverlappingABox": depth_samples,
        })
        for (_pn, pv, _pf) in un["armParts"]:
            for v in pv:
                d = v_len(v)
                if d > max_unit_dist:
                    max_unit_dist = d

    if arm_failures:
        raise ValueError(
            "AC-FORM(d): every arm must be AFFIXED TO A RIB. These do not land on the member "
            "they claim to:\n%s\n"
            "  Fix: rib_mount_point() places the root on the member's inboard face, so a gap "
            "here means ARM_MOUNT_PROFILE names a member the arm is not actually reaching, or "
            "ARM_MOUNT_Y (%.3f) falls outside that member's run."
            % ("\n".join("    %s sits %.4f m off %s (tolerance %.4f m)"
                          % (nm, gap, mem, ARM_MOUNT_TOL) for (nm, mem, gap) in arm_failures),
               ARM_MOUNT_Y))

    invisible = [d for d in arm_detail if d["occlusionBeyondItsScreen"] < ARM_VISIBLE_MIN]
    if invisible:
        raise ValueError(
            "an arm is not VISIBLE -- it adds nothing to the frame beyond the screen box it "
            "holds, so the pilot cannot see there is a mount there at all:\n%s\n"
            "  Max asked for the arms to be modelled, and an arm hidden entirely behind its "
            "own panel is not modelled. Move ARM_MOUNT_Y (currently %.3f) so the root sits "
            "further from its screen's tan footprint -- the upper pair gains visibility as it "
            "moves FORWARD along the shoulder rib, the lower pair as it moves AFT along the "
            "rail, so the two trade and there is a balance point."
            % ("\n".join("    %s adds %.4f%% of the frame (floor %.4f%%)"
                         % (d["name"], 100.0 * d["occlusionBeyondItsScreen"],
                            100.0 * ARM_VISIBLE_MIN) for d in invisible),
               ARM_MOUNT_Y))

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
            "  Fix: move ARM_MOUNT_Y (currently %.3f m) further AFT so the arm approaches its "
            "screen from behind, or reduce ARM_ATTACH_U / ARM_ATTACH_W so the strut lands "
            "closer to the middle of the back plate." % ("\n".join(lines), ARM_MOUNT_Y))

    # ---- Is everything actually INSIDE the enclosure? ------------------------
    # The check this replaces compared DISTANCES: no screen vertex further from the eye than
    # the nearest point of the glass. That was adequate for a window and is simply wrong for
    # an enclosure, where the roof legitimately comes closer to the eye (1.35 m) than the
    # screens sit wide (1.6 m) -- it would fail a correct build. The honest question is a ray
    # question, asked per vertex along its own eye ray. Vertices whose ray leaves through the
    # OPEN bow aperture return None and impose no constraint: that is the windscreen, and
    # there is nothing there to be inside of.
    outside = []
    worst_inside = None
    unconstrained = 0
    for un in units:
        for (nm, vs) in ((BODY_PREFIX + un["suffix"], un["bodyVerts"]),
                         (SCREEN_PREFIX + un["suffix"], un["faceVerts"]),
                         (ARM_PREFIX + un["suffix"],
                          [v for (_pn, pv, _pf) in un["armParts"] for v in pv])):
            for v in vs:
                m = inside_margin(v, tris)
                if m is None:
                    unconstrained += 1
                    continue
                if worst_inside is None or m < worst_inside:
                    worst_inside = m
                if m < 0.0:
                    outside.append((nm, v, m))
    if outside:
        nm, v, m = min(outside, key=lambda t: t[2])
        raise ValueError(
            "%d vertices of the screen units / arms have punched THROUGH the enclosure -- "
            "worst is %s at (%.4f, %.4f, %.4f), %.4f m outside.\n"
            "  Fix: lower SCREEN_DIST, or push the vault out by widening STATIONS."
            % (len(outside), nm, v[0], v[1], v[2], -m))
    if worst_inside is None and units:
        raise ValueError(
            "the containment check measured NOTHING: every screen and arm vertex projects "
            "through the open bow aperture, so nothing was actually tested. A pass that "
            "measured nothing is not a pass.")
    # `and units` is the ONLY exemption, and it is narrow on purpose. A --no-fittings build
    # has no screens and no arms to contain, so there is genuinely nothing to measure and the
    # guard would be reporting the absence of a test rather than the absence of a defect. With
    # fittings present the guard still fires, which is the case it was written for: every
    # vertex projecting through the open bow aperture means the instrument is blind, not that
    # the geometry is good.

    # ---- The dash shelf: is it actually inside the tub? ----------------------
    # Same instrument as the screens and arms -- a per-vertex ray from the eye, signed -- and
    # for the same reason: the shelf's outboard edge is placed by rail_inboard_x(), and this
    # re-measures the finished geometry against the finished shell rather than confirming that
    # arithmetic with itself. Points whose ray leaves through the open bow aperture return None
    # and constrain nothing; the shelf's forward corners do exactly that, which is why the
    # count of what was actually constrained is reported and not just the worst margin.
    dash_verts, dash_faces = build_dash()
    dash_outside = []
    dash_worst = None
    dash_unconstrained = 0
    dash_constrained = 0
    for p in dash_probe_points():
        m = inside_margin(p, tris)
        if m is None:
            dash_unconstrained += 1
            continue
        dash_constrained += 1
        if dash_worst is None or m < dash_worst:
            dash_worst = m
        if m < 0.0:
            dash_outside.append((p, m))
    if dash_outside:
        p, m = min(dash_outside, key=lambda t: t[1])
        raise ValueError(
            "%d probe points on %s are OUTSIDE the enclosure -- worst at (%.4f, %.4f, %.4f), "
            "%.4f m through the hull.\n"
            "  Fix: raise DASH_SIDE_GAP (%.4f m), or move DASH_AFT_Y (%.3f) forward so the "
            "shelf spans less of the bay where the tub is narrowing."
            % (len(dash_outside), NAME_DASH, p[0], p[1], p[2], -m, DASH_SIDE_GAP, DASH_AFT_Y))
    if dash_constrained == 0:
        raise ValueError(
            "the dash-shelf containment check measured NOTHING: every probe projects through "
            "the open bow aperture, so the shelf was not actually tested. A pass that measured "
            "nothing is not a pass.")
    # ...and the instrument has to be shown to fire, exactly as the member checks are.
    #
    # THE FIRST VERSION OF THIS PLANTED DEFECT WAS WRONG, and the way it was wrong is worth
    # keeping. It widened the shelf past the RAILS and expected inside_margin() to go negative.
    # It does not, and it should not: the rails stand a solved standoff INBOARD of the tub
    # wall, so a shelf 50 mm wider than the rails is still comfortably inside the hull, and the
    # instrument was reporting that correctly. Two different properties -- "inside the shell"
    # and "clear of the rails" -- had been collapsed into one check with one instrument. The
    # planted defect for a hull-containment test has to breach the HULL.
    _yf, _yb, _hf, _hb, _tz, _bz = dash_extents()
    dash_planted = None
    for i in range(DASH_PROBE_N):
        s = i / (DASH_PROBE_N - 1.0)
        y = _yf + (_yb - _yf) * s
        wall = station_half_width(y) + MEMBER_PLANT_OFFSET
        for z in (_tz, _bz):
            for x in (-wall, wall):
                m = inside_margin((x, y, z), tris)
                if m is not None and (dash_planted is None or m < dash_planted):
                    dash_planted = m
    if dash_planted is None or dash_planted > -MEMBER_PLANT_OFFSET * 0.25:
        raise ValueError(
            "the dash-shelf containment check is not discriminating: a probe planted %.3f m "
            "OUTSIDE the tub wall still reads %s. inside_margin() is not measuring what it "
            "claims to for this part."
            % (MEMBER_PLANT_OFFSET,
               "nothing at all" if dash_planted is None else "%.4f m inside" % dash_planted))

    # ---- ...and separately, is it clear of the RAILS? ------------------------
    # A different property needing a different check. This one is a CONSTRUCTION check, not an
    # independent one, and saying so is the point: build_dash() places the outboard edge at
    # rail_inboard_x() - DASH_SIDE_GAP, and this reads the gap back off the emitted vertices to
    # confirm the builder actually applied it. What makes it more than a restatement is that
    # measuring the two ENDS bounds the whole span: the shelf edge and the rail's inboard face
    # are both linear in y across the bay, so their separation is linear too and cannot dip
    # between the points checked. Same argument as the span-planes union in member_sections().
    dash_rail_gap = None
    for (y, half) in ((_yf, _hf), (_yb, _hb)):
        emitted = max(abs(v[0]) for v in dash_verts if abs(v[1] - y) < 1e-9)
        gap = rail_inboard_x(min(y, STATIONS[0][1])) - emitted
        if dash_rail_gap is None or gap < dash_rail_gap:
            dash_rail_gap = gap
    if dash_rail_gap < 0.0:
        raise ValueError(
            "%s grows THROUGH the canopy rails by %.4f m. build_dash() did not apply the "
            "clearance rail_inboard_x() gives it.\n"
            "  Fix: raise DASH_SIDE_GAP (%.4f m), or thin RAIL_SECTION so the rails reach less "
            "far inboard." % (NAME_DASH, -dash_rail_gap, DASH_SIDE_GAP))
    if dash_rail_gap > DASH_SIDE_GAP + 1e-6:
        raise ValueError(
            "%s sits %.4f m clear of the rails but DASH_SIDE_GAP asks for %.4f m, so the shelf "
            "is narrower than it was authored to be and there is a visible slot along each "
            "rail. dash_extents() and build_dash() have diverged."
            % (NAME_DASH, dash_rail_gap, DASH_SIDE_GAP))

    # ---- The seat: inside the tub, and clear of the pilot ---------------------
    # Same signed eye-ray instrument as the dash and the fittings. The seat is the one part
    # whose position is fully determined by the body, so the interesting check is not "did I
    # place it well" but "does the cabin still contain the thing the cabin was sized for".
    seat_outside = []
    seat_worst = None
    seat_constrained = 0
    seat_unconstrained = 0
    for p in seat_probe_points():
        m = inside_margin(p, tris)
        if m is None:
            seat_unconstrained += 1
            continue
        seat_constrained += 1
        if seat_worst is None or m < seat_worst:
            seat_worst = m
        if m < 0.0:
            seat_outside.append((p, m))
    if seat_outside:
        p, m = min(seat_outside, key=lambda t: t[1])
        raise ValueError(
            "%d probe points on the seat are OUTSIDE the enclosure -- worst at "
            "(%.4f, %.4f, %.4f), %.4f m through the hull.\n"
            "  The seat is placed FROM the anthropometry, so this means the cabin no longer "
            "contains the pilot it was proportioned around -- check STATIONS and FLOOR_Z "
            "before touching any SEAT_* constant."
            % (len(seat_outside), p[0], p[1], p[2], -m))
    if seat_constrained == 0:
        raise ValueError(
            "the seat containment check measured NOTHING: every probe projects through the "
            "open bow aperture. A pass that measured nothing is not a pass.")

    # ---- Occlusion. Canopy_Glass is NOT in any of these lists, by design: the pilot sees
    # through it. The opaque structure is the seam members, the aft bulkhead and THE TUB --
    # which is new and is the single biggest term now. The marginal order is
    # members -> hull -> screens -> arms.
    #
    # Hull_Tub replaces the old Floor_Pan here, and it is not a like-for-like swap: a flat pan
    # 1.08 m down projected almost nothing into the frame, whereas a tub whose rail sits 0.34 m
    # below the eye fills the lower third of it. The section lab predicts about 32% for these
    # constants; this is the independent analytic check of that.
    hull_polys = []
    bkv, bkf = build_bulkhead()
    cmv, cmf = build_coaming()
    tbv, tbf = build_shell(SEG_HULL)
    for (hv, hf) in ((bkv, bkf), (cmv, cmf), (tbv, tbf)):
        for f in hf:
            poly = silhouette_tan([hv[k] for k in f], [tuple(range(len(f)))])
            if len(poly) >= 3:
                hull_polys.append(poly)

    # The dash shelf is measured SEPARATELY from the rest of the hull and then folded in, so
    # its marginal cost is a number rather than a claim. The constants block asserts it is
    # zero -- the shelf lies in the coaming's shadow -- and this is where that gets checked.
    dash_polys = []
    for f in dash_faces:
        poly = silhouette_tan([dash_verts[k] for k in f], [tuple(range(len(f)))])
        if len(poly) >= 3:
            dash_polys.append(poly)
    dash_own = coverage_fraction(dash_polys)
    dash_marginal = coverage_fraction(hull_polys + dash_polys) - coverage_fraction(hull_polys)
    hull_polys.extend(dash_polys)

    # The seat, likewise measured separately before being folded in. It sits 0.80 m BELOW an
    # eye that is looking forward, so the expectation is zero and this is where that is
    # checked rather than asserted.
    seat_polys = []
    for (_snm, sv, sf) in build_seat():
        for f in sf:
            poly = silhouette_tan([sv[k] for k in f], [tuple(range(len(f)))])
            if len(poly) >= 3:
                seat_polys.append(poly)
    seat_own = coverage_fraction(seat_polys)
    seat_marginal = coverage_fraction(hull_polys + seat_polys) - coverage_fraction(hull_polys)
    hull_polys.extend(seat_polys)

    members_own = coverage_fraction(member_polys)
    hull_own = coverage_fraction(hull_polys)
    screens_own = coverage_fraction(screen_polys)
    arms_own = coverage_fraction(arm_polys)
    members_marginal = members_own
    mh = coverage_fraction(member_polys + hull_polys)
    hull_marginal = mh - members_own
    mhs = coverage_fraction(member_polys + hull_polys + screen_polys)
    screens_marginal = mhs - mh
    total = coverage_fraction(member_polys + hull_polys + screen_polys + arm_polys)
    arms_marginal = total - mhs

    return {
        "fovDeg": GAME_FOV_DEG,
        "aspect": GAME_ASPECT,
        "tanH": tan_h,
        "tanV": tan_v,
        "halfAngleHorizontalDeg": math.degrees(math.atan(tan_h)),
        "halfAngleVerticalDeg": math.degrees(math.atan(tan_v)),
        "scanlines": OCC_SCANLINES,

        "enclosure": coverage,
        "enclosureSectorMin": ENCLOSURE_SECTOR_MIN,
        "bowRimLanding": landing,
        "panelFacesEyeWorstDot": panel_dot,
        "panelFacesEyeFlippedDot": panel_dot_flipped,
        "stations": [{"label": s[0], "y": s[1], "halfWidth": s[2], "topZ": s[3]}
                     for s in STATIONS],
        "floorZ": FLOOR_Z,
        "railZ": RAIL_Z,
        "panelCount": len(panel_quads()),
        "facetsAcross": N_FACETS,
        "bays": N_BAYS,

        "dash": {
            "name": NAME_DASH,
            "frontY": _yf, "aftY": _yb,
            "halfWidthFront": _hf, "halfWidthAft": _hb,
            "topZ": _tz, "bottomZ": _bz,
            "depth": _yf - _yb,
            "railClearance": dash_rail_gap,
            "railClearanceAuthored": DASH_SIDE_GAP,
            "nearEdgeElevationDeg": math.degrees(math.atan(_tz / _yb)),
            "worstInsideMargin": dash_worst,
            "insideMarginPlantedDefect": dash_planted,
            "probesConstrained": dash_constrained,
            "probesUnconstrained": dash_unconstrained,
            "ownOcclusion": dash_own,
            "marginalOcclusion": dash_marginal,
        },

        "seat": {
            "parts": [nm for (nm, _v, _f) in build_seat()],
            "panZ": SEAT_PAN_Z, "backTopZ": SEAT_BACK_TOP_Z,
            "panFrontY": SEAT_PAN_FRONT_Y, "backRakeY": SEAT_BACK_RAKE_Y,
            "worstInsideMargin": seat_worst,
            "probesConstrained": seat_constrained,
            "probesUnconstrained": seat_unconstrained,
            "ownOcclusion": seat_own,
            "marginalOcclusion": seat_marginal,
            "body": {"seatZ": BODY_SEAT_Z, "chestZ": BODY_CHEST_Z,
                     "shoulderZ": BODY_SHOULDER_Z, "kneeY": BODY_KNEE_Y,
                     "hipHalf": BODY_HIP_HALF, "shoulderHalf": BODY_SHOULDER_HALF},
        },

        "memberDetail": member_detail,
        "screenDetail": screen_detail,
        "armDetail": arm_detail,
        "maxUnitDistance": max_unit_dist,
        "worstInsideMargin": worst_inside,
        "unconstrainedVertices": unconstrained,

        "occlusionTotal": total,
        "occlusionMembersOwn": members_own,
        "occlusionHullOwn": hull_own,
        "occlusionScreensOwn": screens_own,
        "occlusionArmsOwn": arms_own,
        "occlusionMembersMarginal": members_marginal,
        "occlusionHullMarginal": hull_marginal,
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


def make_mesh_object(name, verts, faces, material, uv=None):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata([tuple(float(c) for c in v) for v in verts], [], [tuple(f) for f in faces])
    if mesh.validate(verbose=False):
        print("  WARNING: mesh.validate() altered %s -- check the vertex/face lists" % name)
    mesh.update()
    if uv is not None:
        # PER-VERTEX uv assigned through the loops. Every vertex of a display face carries one
        # and only one uv (it is a single quad), so a loop-indexed write is unambiguous and
        # survives triangulate() splitting the quad -- both triangles index the same corners.
        if len(uv) != len(verts):
            raise ValueError("%s: %d uvs for %d vertices" % (name, len(uv), len(verts)))
        layer = mesh.uv_layers.new(name="UVMap")
        for loop in mesh.loops:
            layer.data[loop.index].uv = tuple(float(c) for c in uv[loop.vertex_index])
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

def _agg(fn, rows, key):
    """min/max over a fittings list, or None when the build has no fittings.

    Never 0.0. A zero in one of these slots reads as "measured, and perfect", which is exactly
    the false pass the containment vacuity guard exists to prevent.
    """
    return r6(fn(d[key] for d in rows)) if rows else None


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
            "uv": [list(c) for c in SCREEN_FACE_UV],
            "uvNote": ("TEXCOORD_0 on the display face, (0,0) at the pilot's LOWER-LEFT corner "
                       "and (1,1) at the upper-right, in the face's own (widthAxis, heightAxis) "
                       "frame. This is the seam the screen-content work binds to: it does not "
                       "need to know where the panel sits, only that it is a unit-square UV "
                       "surface 0.45 x 0.30 m. Screen POSITIONS are still being re-fitted; this "
                       "contract is not."),
        })

    adet = {d["name"]: d for d in analysis["armDetail"]}
    arms = []
    for un in units:
        nm = ARM_PREFIX + un["suffix"]
        d = adet[nm]
        arms.append({
            "name": nm,
            "nodeNames": ["%s_%s" % (nm, pn) for (pn, _v, _f) in un["armParts"]],
            "screenName": SCREEN_PREFIX + un["suffix"],
            "mountedOn": d["mountMember"],
            "mountSeamPoint": r6v(to_gltf(d["mountSeamPoint"])),
            "mountGap": r6(d["mountGap"]),
            "root": r6v(to_gltf(d["root"])),
            "elbow": r6v(to_gltf(un["armElbow"])),
            "tip": r6v(to_gltf(un["armTip"])),
            "elbowBendDeg": r6(d["elbowBendDeg"]),
            "rootTanSpace": ([r6(d["rootTan"][0]), r6(d["rootTan"][1])]
                             if d["rootTan"] is not None else None),
            "length": r6(d["length"]),
            "inFrontOfAnyScreenBoxBy": r6(d["inFrontOfBoxBy"]),
            "depthSamplesOverlappingABox": d["depthSamplesOverlappingABox"],
            "occlusionBeyondItsScreen": r6(d["occlusionBeyondItsScreen"]),
        })
    arms_note = ("AC-FORM(d): arms are AFFIXED TO RIBS, and each is five parts -- Mount, "
                 "BoomA, Elbow, BoomB, Head -- not a tapered stick. mountedOn names the seam "
                 "member the plate bolts to and mountGap is how far off that member's inboard "
                 "face the root actually sits; it must be ~0. The retired rule (root outside "
                 "the view frustum) is deliberately absent: empty space satisfies it, which "
                 "is how the previous build passed with four monitors on two lamp-posts.")

    members = []
    for d in analysis["memberDetail"]:
        members.append({
            "name": d["name"],
            "seamFamily": d["seamFamily"],
            "seamIndex": d["seamIndex"],
            "edgeFamily": d["edgeFamily"],
            "width": r6(d["width"]),
            "depth": r6(d["depth"]),
            "glassGap": r6(RIB_GLASS_GAP),
            "vertices": d["vertices"],
            "seamResidual": r6(d["seamResidual"]),
            "seamResidualPlantedDefect": r6(d["seamResidualPlantedDefect"]),
            "inboardMargin": r6(d["inboardMargin"]),
            "inboardMarginPlantedDefect": r6(d["inboardMarginPlantedDefect"]),
            "bendAnglesDeg": [r6(a) for a in d["bendAnglesDeg"]],
            "ownOcclusion": r6(d["ownOcclusion"]),
        })
    members_note = ("Every structural member is GENERATED FROM a seam of the vault, so 'a rib "
                    "not on a seam' is unrepresentable rather than merely tested for -- which "
                    "is the structural answer to Max's 'the ribs read as decoration'. "
                    "edgeFamily distinguishes a FOLD (two panels meet: the interior ribs and "
                    "the mid arch) from a RIM (one panel: the sill rails and the bow and aft "
                    "arches). seamResidual is measured against edges recovered independently "
                    "from the panel mesh, and each measurement carries a planted defect "
                    "because an assertion nobody has seen fail is not evidence.")

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
            "FLOOR_Z": FLOOR_Z,
            "RAIL_Z": RAIL_Z,
            "STATIONS": [[s[0], r6(s[1]), r6(s[2]), r6(s[3])]
                                for s in STATIONS],
            "TUB_HALF": [[a[0], r6(a[1]), r6(a[2])] for a in TUB_HALF],
            "CANOPY_HALF": [[a[0], r6(a[1]), r6(a[2])] for a in CANOPY_HALF],
            "RAIL_SECTION": [r6(x) for x in RAIL_SECTION],
            "RIB_SECTION": [r6(x) for x in RIB_SECTION],
            "ARCH_SECTION": [r6(x) for x in ARCH_SECTION],
            "BOW_SECTION": [r6(x) for x in BOW_SECTION],
            "RIB_GLASS_GAP": RIB_GLASS_GAP,
            "BULKHEAD_INSET": BULKHEAD_INSET,
            "ENCLOSURE_SECTOR_MIN": ENCLOSURE_SECTOR_MIN,
            "MEMBER_SEAM_TOL": MEMBER_SEAM_TOL,
            "MEMBER_PLANT_OFFSET": MEMBER_PLANT_OFFSET,
            "SCREEN_W": SCREEN_W,
            "SCREEN_H": SCREEN_H,
            "SCREEN_BEZEL": r6(SCREEN_BEZEL),
            "SCREEN_BODY_DEPTH": r6(SCREEN_BODY_DEPTH),
            "SCREEN_FACE_RECESS": SCREEN_FACE_RECESS,
            "SCREEN_FACE_GAP": SCREEN_FACE_GAP,
            "SCREEN_DIST_UP": SCREEN_DIST_UP,
            "SCREEN_DIST_DOWN": SCREEN_DIST_DOWN,
            "SCREEN_TAN_X_UP": SCREEN_TAN_X_UP,
            "SCREEN_TAN_X_DOWN": SCREEN_TAN_X_DOWN,
            "SCREEN_TAN_Z_UP": SCREEN_TAN_Z_UP,
            "SCREEN_TAN_Z_DOWN": SCREEN_TAN_Z_DOWN,
            "ARM_MOUNT_PROFILE": dict(ARM_MOUNT_PROFILE),
            "ARM_MOUNT_Y": ARM_MOUNT_Y,
            "ARM_MOUNT_TOL": ARM_MOUNT_TOL,
            "ARM_ATTACH_U": ARM_ATTACH_U,
            "ARM_ATTACH_W": ARM_ATTACH_W,
            "ARM_EMBED": ARM_EMBED,
            "ARM_MOUNT_HALF_U": ARM_MOUNT_HALF_U,
            "ARM_MOUNT_HALF_W": ARM_MOUNT_HALF_W,
            "ARM_MOUNT_THICK": ARM_MOUNT_THICK,
            "ARM_BOOM_A_LEN": ARM_BOOM_A_LEN,
            "ARM_BOOM_A_HALF_U": ARM_BOOM_A_HALF_U,
            "ARM_BOOM_A_HALF_W": ARM_BOOM_A_HALF_W,
            "ARM_BOOM_B_HALF_U": ARM_BOOM_B_HALF_U,
            "ARM_BOOM_B_HALF_W": ARM_BOOM_B_HALF_W,
            "ARM_ELBOW_RADIUS": ARM_ELBOW_RADIUS,
            "ARM_ELBOW_HALF_LEN": ARM_ELBOW_HALF_LEN,
            "ARM_ELBOW_SIDES": ARM_ELBOW_SIDES,
            "ARM_HEAD_LEN": ARM_HEAD_LEN,
            "ARM_HEAD_HALF_U": ARM_HEAD_HALF_U,
            "ARM_HEAD_HALF_W": ARM_HEAD_HALF_W,
            "ARM_MIN_BEND_DEG": ARM_MIN_BEND_DEG,
            "GAME_FOV_DEG": GAME_FOV_DEG,
            "GAME_ASPECT": r6(GAME_ASPECT),
            "OCC_SCANLINES": OCC_SCANLINES,
            "OCC_NEAR_Y": OCC_NEAR_Y,
        },

        # Declared so increments 2-4 (and any re-author) can see what the surfaces were
        # actually set to, and why they are no longer near-black. See the constants block.
        "materials": {
            "Mat_Frame": {"baseColorLinear": list(MAT_FRAME_RGB), "roughness": MAT_FRAME_ROUGH,
                          "metallic": MAT_FRAME_METAL,
                          "usedBy": [m["name"] for m in seam_members()]},
            "Mat_Hull": {"baseColorLinear": list(MAT_HULL_RGB), "roughness": MAT_HULL_ROUGH,
                         "metallic": MAT_HULL_METAL, "usedBy": [NAME_BULKHEAD, NAME_COAMING, NAME_HULL]},
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
            "form": ("a faceted VAULT swept between transverse arch rings -- an ENCLOSURE, "
                     "not a window. The previous revision was a height field y = f(x, z), "
                     "which cannot represent a shell that wraps past the pilot's shoulders "
                     "because such a shell doubles back in y. That was a parameterisation "
                     "bug, not a proportions bug, and no re-tuning of those constants could "
                     "ever have produced what Max asked for."),
            "stations": [{"label": s["label"], "y": r6(s["y"]),
                          "halfWidth": r6(s["halfWidth"]), "topZ": r6(s["topZ"])}
                         for s in analysis["stations"]],
            "floorZ": r6(FLOOR_Z),
            "railZ": r6(RAIL_Z),
            "tubProfileHalf": [[a[0], r6(a[1]), r6(a[2])] for a in TUB_HALF],
            "canopyProfileHalf": [[a[0], r6(a[1]), r6(a[2])] for a in CANOPY_HALF],
            "facetsAcross": analysis["facetsAcross"],
            "bays": analysis["bays"],
            "panelCount": analysis["panelCount"],
            "panelNormalsFaceEye": {
                "worstDot": r6(analysis["panelFacesEyeWorstDot"]),
                "flippedWindingDot": r6(analysis["panelFacesEyeFlippedDot"]),
                "note": ("every panel normal points at the pilot. The flipped figure is the "
                         "planted defect: reversing the winding must read clearly negative, "
                         "or the orientation test cannot fail and proves nothing."),
            },
            "bowRimLanding": {
                k: {kk: r6(vv) for (kk, vv) in v.items()}
                for (k, v) in analysis["bowRimLanding"].items() if isinstance(v, dict)
            },
            "bowRimLandingNote": ("insideBy > 0 means that rim sits INSIDE the 70 deg / 16:9 "
                                  "frame edge, so structure is visible at that edge of the "
                                  "forward view. Negative means the rim has run outside the "
                                  "view entirely -- the defect that made the pre-ceb277e "
                                  "build have no visible enclosure at all."),
            "excludedFromOcclusion": True,
            "excludedWhy": ("see-through by design; increment 3 replaces this placeholder "
                            "with real glass, and AC-FRAME counts only opaque structure"),
        },

        "enclosure": {
            "what": ("AC-FORM(a) as a measurement. Rays are cast from the eye over the whole "
                     "sphere and asked whether they find cockpit or empty space, "
                     "solid-angle weighted. A window scores near zero everywhere but ahead; "
                     "an enclosure scores near one everywhere but through its aperture. This "
                     "is the number that separates what Max rejected from what he asked "
                     "for."),
            "sphereFraction": r6(analysis["enclosure"]["sphereFraction"]),
            "sectors": {k: r6(v) for (k, v) in analysis["enclosure"]["sectors"].items()},
            "sectorHalfAngleDeg": r6(analysis["enclosure"]["sectorHalfAngleDeg"]),
            "samples": analysis["enclosure"]["samples"],
            "requiredSectors": ["above", "left", "right", "behind"],
            "requiredSectorMin": r6(ENCLOSURE_SECTOR_MIN),
            "aheadIsOpenByDesign": ("AHEAD is deliberately not required: the bow ring is the "
                                    "pilot's aperture, and demanding coverage there would be "
                                    "demanding a windscreen made of hull."),
        },

        "closures": {
            "bulkhead": {"name": NAME_BULKHEAD, "inset": r6(BULKHEAD_INSET),
                         "what": ("the aft closure behind the pilot, FLOOR TO ROOF -- Max's "
                                  "form language is 'a seat against a bulkhead', so it is the "
                                  "surface a seat would bolt to, not a shoulder-high panel")},
            "floorPanRetired": ("Floor_Pan is GONE and is not replaced. With the ring profile "
                                "closed, the cabin floor is segments 0 and 10 of Hull_Tub, so "
                                "a separate pan would be a second surface in the same place. "
                                "This is a supersession, not a deletion like Hull_Nose."),
            "noSeat": ("Still deferred. Max reintroduced 'a seat against a bulkhead' as FORM "
                       "language when he corrected the build order, which is why the bulkhead "
                       "is now full height -- but whether the seat is MODELLED or merely "
                       "implied by the tub has not been asked yet. Deliberately absent."),
            "seat": dict(analysis["seat"], what=(
                "the pilot's seat -- pan, back and pedestal. Max asked for it directly, which "
                "reverses 'no seat/headrest' for the second time; it has been FORM language "
                "since he corrected the build order ('a seat against a bulkhead' is why "
                "Bulkhead_Aft is full height). Every dimension is read off the BODY_* "
                "anthropometry rather than authored. No headrest: only the seat was un-ruled.")),
            "dash": dict(analysis["dash"], what=(
                "the glare shield lying on top of Coaming_Bow -- a PLACEHOLDER SURFACE with "
                "nothing on it, reserving the volume a dashboard would occupy. Max's words "
                "were 'a basic panel in front of the player on the bottom half of the canopy', "
                "which admitted two readings; asked, he chose the shelf over a raked panel "
                "standing up into the windscreen. Content is increment 2's problem. Note it "
                "reverses his increment-1 ruling 'we shouldn't need a separate dash' -- the "
                "four screens stay; what he wants here is the SPACE.")),
        },

        "sceneBoundingBox": {"min": r6v(scene_lo), "max": r6v(scene_hi)},
        "objects": objects,
        "members": members,
        "membersNote": members_note,
        "screens": screens,
        "arms": arms,
        "armsNote": arms_note,

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
            "excludesWhy": ("Canopy_Glass is see-through by design -- and with an "
                             "enclosure that matters far more than it did with a window, "
                             "because the vault now wraps the pilot and would otherwise "
                             "count as near-total occlusion"),
            "total": r6(analysis["occlusionTotal"]),
            "marginalOrder": ["seamMembers", "bulkheadAndFloor", "screensAndBodies", "arms"],
            "marginal": {
                "seamMembers": r6(analysis["occlusionMembersMarginal"]),
                "bulkheadAndFloor": r6(analysis["occlusionHullMarginal"]),
                "screensAndBodies": r6(analysis["occlusionScreensMarginal"]),
                "arms": r6(analysis["occlusionArmsMarginal"]),
            },
            "own": {
                "seamMembers": r6(analysis["occlusionMembersOwn"]),
                "bulkheadAndFloor": r6(analysis["occlusionHullOwn"]),
                "screensAndBodies": r6(analysis["occlusionScreensOwn"]),
                "arms": r6(analysis["occlusionArmsOwn"]),
            },
            "note": ("Marginal figures are measured in the fixed order ribs -> frame -> "
                     "screens -> arms and sum to the total; 'own' figures are each category "
                     "in isolation and overlap, so they do not. AC-FRAME's browser "
                     "measurement is authoritative; this exists so proportions can be tuned "
                     "without a render round-trip, and no geometry is padded to hit a "
                     "number. Categories changed with the enclosure: there is no perimeter "
                     "band any more, and the opaque structure is now the seam members plus "
                     "the bulkhead and floor pan."),
        },

        "diagnostics": {
            # Declared as an explicit ZERO rather than omitted. AC-FRAME says Canopy_Glass
            # earns no occlusion credit; a missing key would let that pass by silence, while
            # a stated 0.0 is a claim the headless test can actually catch being wrong.
            "predictedOcclusionByCanopyGlass": 0.0,
            "frameHalfAngleHorizontalDeg": r6(analysis["halfAngleHorizontalDeg"]),
            "frameHalfAngleVerticalDeg": r6(analysis["halfAngleVerticalDeg"]),
            "frameTanHalfExtents": [r6(analysis["tanH"]), r6(analysis["tanV"])],
            "maxScreenOrArmDistance": r6(analysis["maxUnitDistance"]),

            # ---- the enclosure, as the numbers AC-FORM(a) is judged on ----
            "enclosureSphereFraction": r6(analysis["enclosure"]["sphereFraction"]),
            "enclosureSectors": {k: r6(v)
                                 for (k, v) in analysis["enclosure"]["sectors"].items()},
            "enclosureSectorMin": r6(ENCLOSURE_SECTOR_MIN),

            # ---- every member is on a seam, and inboard of the glass ----
            # Stated as numbers rather than booleans so a member that is merely GRAZING its
            # seam shows up as a member that is merely grazing its seam.
            "worstMemberSeamResidual": r6(max(d["seamResidual"]
                                              for d in analysis["memberDetail"])),
            "worstMemberInboardMargin": r6(min(d["inboardMargin"]
                                               for d in analysis["memberDetail"])),
            "minMemberBendAngleDeg": r6(min([a for d in analysis["memberDetail"]
                                             for a in d["bendAnglesDeg"]] or [0.0])),

            # ---- and the planted defects that make those measurements mean something ----
            # Every instrument above has been shown to register a deliberate fault. ceb277e
            # shipped 48/48 green with three assertions that structurally could not fail; the
            # rule taken from that is that an assertion nobody has seen fail is not evidence.
            "seamResidualPlantedDefectMin": r6(min(d["seamResidualPlantedDefect"]
                                                   for d in analysis["memberDetail"])),
            "inboardMarginPlantedDefectMax": r6(max(d["inboardMarginPlantedDefect"]
                                                    for d in analysis["memberDetail"])),
            "plantedDefectOffset": r6(MEMBER_PLANT_OFFSET),
            "panelFacesEyeWorstDot": r6(analysis["panelFacesEyeWorstDot"]),
            "panelFacesEyeFlippedDot": r6(analysis["panelFacesEyeFlippedDot"]),

            # ---- containment: nothing has punched out of the cabin ----
            "worstScreenOrArmInsideMargin": (r6(analysis["worstInsideMargin"])
                                         if analysis["worstInsideMargin"] is not None else None),
            "screenOrArmVerticesUnconstrained": analysis["unconstrainedVertices"],
            "unconstrainedWhy": ("vertices whose eye ray leaves through the OPEN bow aperture "
                                 "have no shell to be inside of. Reported rather than hidden: "
                                 "if this were the whole count, the containment check would "
                                 "have measured nothing and its pass would be worthless."),

            # ---- arms are on ribs, and behind their own bezels ----
            # Every one of these aggregates is over the FITTINGS, so a --no-fittings build has
            # nothing to reduce. They report null rather than 0.0: a zero here would read as a
            # measured perfect score, which is the same lie the vacuity guard above exists to
            # prevent. Absent and good are different answers.
            "fittingsIncluded": bool(INCLUDE_FITTINGS),
            "worstArmMountGap": _agg(max, analysis["armDetail"], "mountGap"),
            "armMountTol": r6(ARM_MOUNT_TOL),
            "minArmElbowBendDeg": _agg(min, analysis["armDetail"], "elbowBendDeg"),
            "armPartsEach": (len(analysis["armDetail"][0]["parts"])
                             if analysis["armDetail"] else None),
            "minScreenVisibleFraction": _agg(min, analysis["screenDetail"],
                                             "faceVisibleFraction"),
            "worstArmInFrontOfScreenBox": _agg(max, analysis["armDetail"], "inFrontOfBoxBy"),
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
    global INCLUDE_FITTINGS
    tail = argv[argv.index("--") + 1:] if "--" in argv else []
    if "--no-fittings" in tail or "--no-fittings" in argv:
        INCLUDE_FITTINGS = False
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
    enc = metrics["enclosure"]
    print("  THE ENCLOSURE -- is the pilot inside something, or looking through a window?")
    print("    solid-angle coverage around the eye, by sector (within %.0f deg of each axis):"
          % enc["sectorHalfAngleDeg"])
    for nm in ("ahead", "above", "left", "right", "behind", "below"):
        req = " (required >= %.0f%%)" % (100.0 * enc["requiredSectorMin"]) \
              if nm in enc["requiredSectors"] else "  -- open by design" \
              if nm == "ahead" else ""
        print("      %-7s %6.1f%%%s" % (nm, 100.0 * enc["sectors"][nm], req))
    print("    whole sphere %.1f%% covered, from %d ray samples"
          % (100.0 * enc["sphereFraction"], enc["samples"]))
    print("    (AHEAD is the aperture and is meant to be open. The other four are what the")
    print("     word ENCLOSURE means; the previous flat-window build scored ~0%% in all of")
    print("     them, which is exactly the correction Max made.)")
    print("")
    print("  THE SHELL -- one CLOSED profile per station, split by material at the rail")
    print("    %d panels = %d segments around x %d bays fore-aft"
          % (cp["panelCount"], cp["facetsAcross"], cp["bays"]))
    print("    floor z = %+.3f m   RAIL z = %+.3f m  <- hull below, glass above"
          % (cp["floorZ"], cp["railZ"]))
    print("    %-6s %9s %12s %10s" % ("ring", "y", "half-width", "roof z"))
    for s in cp["stations"]:
        print("    %-6s %+8.3fm %11.3fm %+9.3fm"
              % (s["label"], s["y"], s["halfWidth"], s["topZ"]))
    print("    tub profile    (right half, centreline -> rail): %s"
          % ", ".join("%s (%.2f, %.2f)" % (a[0], a[1], a[2]) for a in cp["tubProfileHalf"]))
    print("    canopy profile (right half, rail -> roof):       %s"
          % ", ".join("%s (%.2f, %.2f)" % (a[0], a[1], a[2]) for a in cp["canopyProfileHalf"]))
    print("    panel normals face the eye: worst dot %+.4f  (flipped winding %+.4f = the"
          % (cp["panelNormalsFaceEye"]["worstDot"],
             cp["panelNormalsFaceEye"]["flippedWindingDot"]))
    print("      planted defect; it must be clearly negative or the test cannot fail)")
    print("")
    print("    BOW RIM vs the 70 deg / 16:9 frame edge -- where the forward aperture lands:")
    for side in ("left", "right", "top", "bottom"):
        L = cp["bowRimLanding"][side]
        where = "inside the frame by" if L["insideBy"] >= 0 else "OUTSIDE the frame by"
        print("      %-7s tan %.4f vs %.4f  (%.2f deg vs %.2f deg)  %s %.4f"
              % (side, L["tan"], L["frameTan"], L["halfAngleDeg"], L["frameHalfAngleDeg"],
                 where, abs(L["insideBy"])))
    print("    (inside = the pilot sees structure at that edge of the forward view, which is")
    print("     the 'classic cockpit' read. Outside = the rim has left the view entirely and")
    print("     there is no visible enclosure at all -- the pre-ceb277e defect.)")
    print("")
    print("  SEAM MEMBERS -- every one GENERATED FROM a fold or rim of the vault.")
    print("    A rib not on a seam is unrepresentable here, not merely tested for.")
    print("    %-17s %-6s %8s %8s %11s %12s %9s"
          % ("name", "edge", "width", "depth", "seam resid", "inboard marg", "occludes"))
    for m in metrics["members"]:
        print("    %-17s %-6s %7.3fm %7.3fm %10.6fm %11.4fm %8.2f%%"
              % (m["name"], m["edgeFamily"], m["width"], m["depth"],
                 m["seamResidual"], m["inboardMargin"], 100.0 * m["ownOcclusion"]))
    dg0 = metrics["diagnostics"]
    print("    planted defects: displacing a member %.3f m ACROSS its seam moves it >= %.4f m"
          % (dg0["plantedDefectOffset"], dg0["seamResidualPlantedDefectMin"]))
    print("                     off one; pushing a probe %.3f m OUT through the glass reads"
          % dg0["plantedDefectOffset"])
    print("                     %.4f m (negative = outside). Both instruments demonstrably fire."
          % dg0["inboardMarginPlantedDefectMax"])
    print("    bend angles (the FOLD is the form cue -- flat means the vault has collapsed):")
    for m in metrics["members"]:
        if m["bendAnglesDeg"]:
            print("      %-17s %s" % (m["name"],
                                      ", ".join("%.1f deg" % a for a in m["bendAnglesDeg"])))
    print("")
    print("  Closures")
    print("    %-14s inset %.3f m -- %s"
          % (metrics["closures"]["bulkhead"]["name"],
             metrics["closures"]["bulkhead"]["inset"],
             metrics["closures"]["bulkhead"]["what"]))
    print("    Floor_Pan      RETIRED -- the floor is now part of Hull_Tub")
    d = metrics["closures"]["dash"]
    print("")
    st = metrics["closures"]["seat"]
    print("  THE SEAT -- placed FROM the anthropometry, which is the datum the cabin was")
    print("  proportioned around. Not a free choice: the eye is the origin, so a seated pilot")
    print("  fixes every height, and the seat's job is to put that body where the model")
    print("  already assumes it is.")
    print("    parts: %s" % ", ".join(st["parts"]))
    print("    pan at z %.3f (the body's seat height) | back tops out at %.3f, just above the"
          % (st["panZ"], st["backTopZ"]))
    print("      shoulder at %.3f -- a seat back, NOT a headrest, which Max ruled out"
          % st["body"]["shoulderZ"])
    print("    pan front at y %.3f, short of the knees at %.3f; back raked %.3f m aft"
          % (st["panFrontY"], st["body"]["kneeY"], -st["backRakeY"]))
    print("    pedestal foot follows the DISHED floor via tub_floor_z(), resting on the")
    print("      highest point it spans -- a flat foot at the deepest point would push its")
    print("      outer corners through the hull")
    print("    inside the tub: worst margin %+.4f m over %d probes, %d unconstrained"
          % (st["worstInsideMargin"], st["probesConstrained"], st["probesUnconstrained"]))
    print("    COSTS NOTHING IN THE VIEW: own silhouette %.4f%%, marginal %.4f%% -- it sits"
          % (100.0 * st["ownOcclusion"], 100.0 * st["marginalOcclusion"]))
    print("      0.80 m BELOW an eye that is looking forward. Measured, not assumed.")
    print("")
    print("  DASH SHELF -- the glare shield on the coaming. A placeholder surface, no content.")
    print("    %-14s %.3f m across x %.3f m deep, %.0f mm thick, top face IN the rail plane"
          % (d["name"], d["halfWidthAft"] * 2.0, d["depth"],
             (d["topZ"] - d["bottomZ"]) * 1000.0))
    print("      spans y %.3f (against the coaming) back to %.3f, half-width %.3f -> %.3f"
          % (d["frontY"], d["aftY"], d["halfWidthFront"], d["halfWidthAft"]))
    print("      near edge sits %.1f deg BELOW the horizon -- the pilot looks DOWN at it"
          % -d["nearEdgeElevationDeg"])
    print("      clear of the rails by %.4f m (authored %.4f; outboard edge tracks"
          % (d["railClearance"], d["railClearanceAuthored"]))
    print("        rail_inboard_x(), so it re-fits itself if the cabin is re-proportioned)")
    print("      inside the tub: worst margin %+.4f m over %d probes, %d unconstrained"
          % (d["worstInsideMargin"], d["probesConstrained"], d["probesUnconstrained"]))
    print("        instrument planted-defect check: a probe %.3f m outside the tub wall"
          % MEMBER_PLANT_OFFSET)
    print("        reads %.4f m (negative = outside)" % d["insideMarginPlantedDefect"])
    print("      COSTS NOTHING IN THE VIEW: own silhouette %.2f%%, but marginal over the rest"
          % (100.0 * d["ownOcclusion"]))
    print("        of the hull %.2f%% -- it lies entirely in Coaming_Bow's shadow, because its"
          % (100.0 * d["marginalOcclusion"]))
    print("        top face is in the rail plane and the coaming already fills everything")
    print("        below the rail line at the bow. Measured, not assumed.")
    print("")
    if not metrics["diagnostics"]["fittingsIncluded"]:
        print("  FITTINGS OMITTED -- this is a --no-fittings build.")
        print("    No screens and no arms were generated, so every screen/arm measurement")
        print("    below is ABSENT rather than passing. Max asked to see the tub with")
        print("    nothing on it before anything is fitted to it; this is that build.")
        print("")
        print_footer(metrics, analysis, glb_path, metrics_path)
        return
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
    print("  ARMS -- five parts each, AFFIXED TO RIBS (the retired 'root outside the")
    print("          frustum' rule is gone: empty space satisfied it, which is how the")
    print("          previous build passed with four monitors on two lamp-posts)")
    print("    %-10s %-17s %9s %8s %10s %11s"
          % ("name", "mounted on", "mount gap", "bend", "length", "in-front-by"))
    for a in metrics["arms"]:
        print("    %-10s %-17s %8.6fm %7.1fd %9.3fm %10.4fm"
              % (a["name"], a["mountedOn"], a["mountGap"], a["elbowBendDeg"],
                 a["length"], a["inFrontOfAnyScreenBoxBy"]))
    print("    parts: %s" % ", ".join(metrics["arms"][0]["nodeNames"][0].split("_")[-1:]
                                      + [n.split("_")[-1] for n in
                                         metrics["arms"][0]["nodeNames"][1:]]))
    print("    visible beyond its own screen box: %s"
          % ", ".join("%s %.2f%%" % (d["name"].replace(ARM_PREFIX, ""),
                                     100.0 * d["occlusionBeyondItsScreen"])
                      for d in analysis["armDetail"]))
    print("")
    print_footer(metrics, analysis, glb_path, metrics_path)


def print_footer(metrics, analysis, glb_path, metrics_path):
    """Occlusion table and the checks block. Split out of print_summary() so a --no-fittings
    build can reach it after skipping the screen and arm sections, rather than duplicating it."""
    print("  OCCLUSION at %.0f deg / %.4f aspect  (analytic, %d scanlines; Canopy_Glass "
          "EXCLUDED)" % (GAME_FOV_DEG, GAME_ASPECT, OCC_SCANLINES))
    occ = metrics["occlusion"]
    print("    %-22s %10s %10s" % ("", "marginal", "own"))
    for key, label in (("seamMembers", "seam members"),
                       ("bulkheadAndFloor", "bulkhead + floor"),
                       ("screensAndBodies", "screens + bodies"),
                       ("arms", "arms")):
        print("    %-22s %9.2f%% %9.2f%%"
              % (label, 100.0 * occ["marginal"][key], 100.0 * occ["own"][key]))
    print("    %-22s %9.2f%%" % ("TOTAL (union)", 100.0 * occ["total"]))
    print("    Marginal columns are measured in the order members -> hull -> screens -> arms")
    print("    and sum to the TOTAL. 'Own' columns are each category alone and overlap, so")
    print("    they do not. AC-FRAME is MEASURE-AND-REPORT with no band at this stage (Max:")
    print("    'I'm not all that worried about it. I more want to get the general")
    print("    shape/composition right') -- nothing here was tuned toward a number.")
    print("")
    print("  Checks")
    dg = metrics["diagnostics"]
    print("    it is an ENCLOSURE, not a window          : above %.1f%%  left %.1f%%  "
          "right %.1f%%  behind %.1f%%"
          % (100.0 * dg["enclosureSectors"]["above"], 100.0 * dg["enclosureSectors"]["left"],
             100.0 * dg["enclosureSectors"]["right"],
             100.0 * dg["enclosureSectors"]["behind"]))
    print("                                                (floor %.0f%%; ahead %.1f%% and "
          "open by design)"
          % (100.0 * dg["enclosureSectorMin"], 100.0 * dg["enclosureSectors"]["ahead"]))
    print("    every member lies on a real seam          : worst residual %.8f m "
          "(tolerance %.0e m)" % (dg["worstMemberSeamResidual"], MEMBER_SEAM_TOL))
    print("      instrument planted-defect check         : %.3f m across the seam reads "
          "%.4f m off one" % (dg["plantedDefectOffset"], dg["seamResidualPlantedDefectMin"]))
    print("    every member stays INBOARD of the glass   : worst margin %+.4f m "
          "(signed -- ceb277e's was not)" % dg["worstMemberInboardMargin"])
    print("      instrument planted-defect check         : a probe %.3f m out through the "
          "glass reads %+.4f m" % (dg["plantedDefectOffset"],
                                   dg["inboardMarginPlantedDefectMax"]))
    print("    panels face the pilot                     : worst dot %+.4f  "
          "(flipped winding %+.4f)"
          % (dg["panelFacesEyeWorstDot"], dg["panelFacesEyeFlippedDot"]))
    print("    members read as folded, not curved        : smallest bend %.1f deg"
          % dg["minMemberBendAngleDeg"])
    if dg["fittingsIncluded"]:
        print("    nothing has punched out of the cabin      : worst margin %+.4f m "
              "(%d vertices project through the open"
              % (dg["worstScreenOrArmInsideMargin"],
                 dg["screenOrArmVerticesUnconstrained"]))
        print("                                                aperture and are correctly "
              "unconstrained)")
    if dg["fittingsIncluded"]:
        print("    every arm is ON its rib                   : worst gap %.8f m "
              "(tolerance %.0e m)" % (dg["worstArmMountGap"], dg["armMountTol"]))
        print("    every arm is articulated                  : %d parts each, smallest elbow "
              "bend %.1f deg" % (dg["armPartsEach"], dg["minArmElbowBendDeg"]))
        wa = dg["worstArmInFrontOfScreenBox"]
        print("    no arm crosses in front of a screen       : %s (%d samples overlapped a box; "
              "nearest stays %.4f m behind)"
              % ("yes" if wa <= 0.0 else "NO", dg["armDepthSamplesChecked"], -wa))
        mv = dg["minScreenVisibleFraction"]
        print("    least-visible display face                : %.1f%% inside the frame%s"
              % (100.0 * mv, "" if mv >= 0.999 else "   <- part of a screen falls off-screen"))
    print("    no Hull_Nose / Cockpit_Frame / Canopy_Frame: %s"
          % ("yes" if not any(o["name"] in NAME_DELETED for o in metrics["objects"])
             else "NO - a deleted node is back"))
    print("                                                (an enclosure has no perimeter")
    print("                                                 band; its edge is Arch_Bow, a")
    print("                                                 real member on a real seam)")
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
    global INCLUDE_FITTINGS
    if "--no-fittings" in sys.argv:
        INCLUDE_FITTINGS = False
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
        # Mat_Frame is shared by every seam member -- sill rails, ribs and arches alike --
        # on purpose: they are one structure, distinguished by section rather than by finish.
        "Mat_Frame": make_material("Mat_Frame", MAT_FRAME_RGB, roughness=MAT_FRAME_ROUGH,
                                   metallic=MAT_FRAME_METAL, double_sided=True),
        # The bulkhead and floor pan are single-sided closures seen only from inside the
        # cabin, but the lab orbits OUTSIDE the cockpit, so they are double-sided too --
        # otherwise half the orbit reads as "the back of the cockpit is missing".
        "Mat_Hull": make_material("Mat_Hull", MAT_HULL_RGB, roughness=MAT_HULL_ROUGH,
                                  metallic=MAT_HULL_METAL, double_sided=True),
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
        make_mesh_object(part["name"], part["verts"], part["faces"], mats[part["material"]],
                         uv=part.get("uv"))

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

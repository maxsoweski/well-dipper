# Round 03 feedback

Max's words, verbatim (this is the acceptance criterion for this round):

Max, verbatim, on round 02 (Claude Code's flag first: "the hull tapers to a long thin nose with the glass box sitting ahead of it; sheet r10 has a blunt low head with the bubble hanging beneath"):
"at least what I'm seeing of the outside, your call is right. That is a problem. Also, it's a bit too sleek. Like we've lost lots of the shapes of the kind of flat pancakes on the side and so on. And I'm noticing that the exhaust for the engines have protrusions when I want them to all be recessed."

Attached: your round-02 side render and rear render (the rejected state), plus sheet (1) again for reference.

Change these three things on the exterior; keep the cockpit interior, the named nodes, the materials, the length (18 m), the bubble width (2.6 m), the Eye_Point placement relative to the cockpit, and everything that already passed:
1. THE HEAD: rebuild the front to match sheet (1): a SHORT, BLUNT, LOW head — not a long thin taper — with the glass bubble hanging UNDER it, tucked beneath the head (the bubble's top meets the underside of the head; the bubble is the lowest point at the front). The steep climb from that head to the high back stays. The overall length stays 18 m: the body behind the head may lengthen or the head shorten, as the sheet's proportions need. Move the cockpit interior with the bubble.
2. LESS SLEEK — THE PANCAKES: bring back the big FLAT PANCAKE/LENS-shaped layers that intersect the hull, especially along the SIDES (as on sheet (1) and Chris Foss's liner): broad, flattish, rounded-edged plates and lenses that stick out from and cut into the body's flanks and stack along the climb, plus the domes. The silhouette should be bumpy and layered with these forms, not one smooth streamlined wedge. Keep the spine ridge, the protrusions and the undercarriage (Max's must-keeps).
3. ENGINES FULLY RECESSED: nothing of the main engines protrudes. The four nozzles sit sunk INSIDE sockets in the rear: their rims are flush with or behind the surrounding rear face, the engine block's rear face is flush with or behind the hull's rear outline, and in the side and top views nothing sticks out behind the hull. (In your round-02 rear render the octagonal nozzle rims stand proud of the grey block — that is what Max is objecting to.)

Same budget (≤ 3,000 tris total — spend more of it on the exterior's layered forms if the cockpit can spare it), same outputs, same review loop (3–6 passes) comparing side/rear/¾ against sheet (1), same acceptance report. Report the before/after for each of the three changes.

---

# Checkpoint — after round 02

## artifact versions
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.glb — SHA-256 d2e060aef42bba6d96c28c13f069d7529082e702f268794391d12f7baeedaeca
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/player-ship.blend — SHA-256 7b50a02630c7e33d491444bfb438869409655319c5bec5330e944e8e7de68f25
- /mnt/c/Users/Max/Documents/Blender/astra/well-dipper-trunk/player-ship/report.md — SHA-256 3169b89080a5f414da5638be68a3b48f5d223c32d661229b3f34bba9349e27a7

## invariants
- Preserve the spine, lobes, protrusions, supported undercarriage and hanging cockpit.
- Forward is Blender +Y / glTF −Z.
- Maintain exact interface names and 13 specified materials.
- Remain at or below 3,000 triangles; current total 2,850.
- Keep UVs only on the seven display objects, with blank faces.
- Keep guides hidden and excluded from export.

## accepted decisions
- Round 02 authorized clean retopology from the sculpt as a shape guide.
- Final model contains 34 meshes and Eye_Point.
- Six review passes and final independent checks completed.

## rejected approaches
- Further hull decimation: prohibited by round 02 and previously destroyed or crumpled the surface.
- Conforming hatch patch: intersected the convex hull; replaced with a fitted plane.
- Independent paired port fits: introduced centimetre-scale drift; replaced with exact mirroring.

## unresolved

## next action
Present player-ship-34.png, player-ship-pilot.png and review-r02-pass6.png for Max’s visual review; preserve the validated interface during any subsequent revision.

---

Reply with the same JSON result contract as before (status / report / artifacts / decisions / questions / checkpoint).

# Consultation (NO building, NO Blender, NO file edits) — how do we get a 3D model faithful to the r10 concept sheet?

You are being consulted as a senior hard-surface 3D colleague. Answer in plain prose; no JSON result contract.

## Context (self-contained; you have no prior thread)
Well Dipper's player ship. Image 1 is the accepted concept sheet "r10" — the authority. Target model: ~18 m long,
≤ ~3,000 triangles, flat-shaded, one solid colour slot per face (the sheet's legend: bubble, cockpit frame, spine,
decks, underslung modules, engine block, nozzles, hatch, manoeuvring thrusters), glTF, +Y up, game-ready.

Max (owner) keeps rejecting results NOT on outline but on SHAPES: "the big sloping shapes that the concept art has
terminating in the rear aren't present ... the shapes are just not the same". Outline overlap (IoU 0.88–0.91) did not
make a model look like r10.

What failed, in order:
1. An image model REDREW a clean turnaround → Hunyuan3D-2mv → your cleanup. Hunyuan was faithful to its input but
   the redrawn turnaround had drifted from r10. Cleanup rounds then produced stacked "Gore-Tex pancakes".
2. You scripted the hull: lofts of intersecting volumes, then a line-driven connected cage from 10 labelled feature
   lines in metres (rear third only). Clean topology, but the sloping shells terminating at the rear were missing.
   Your own diagnosis then: your weakness is inferring 3D surface relationships from a stylised, partly inconsistent
   sheet; generic decimation/remesh won't preserve feature lines; if a constrained test still needs repeated
   interpretation repairs, use a human hard-surface modeller for cage/edge layout.
3. Decimating a dense Hunyuan sculpt to a few thousand tris collapsed or crumpled it.

## New evidence (today)
- Image 2: the input I just fed Hunyuan3D-2mv — r10's OWN views, cropped, labels/leader lines removed by pixel
  editing (no redrawing), all four at one shared metres-per-pixel scale (front, left = mirrored side, back = rear,
  right = side). Image 3: the raw Hunyuan mesh (343k tris, untextured), rendered from front/left/back/right.
  My read by eye (I am not the judge, Max is): the sloping deck shells sweeping up into the rounded rear lobe are
  present for the first time; underslung boxes and the bubble-under-head are in place. Defects: a vertical slab
  across the engine block in the back view (spurious), the bubble came out as a pumpkin-ish sphere, surfaces lumpy.
- Web research summary (another agent; vendor claims, not all verified):
  a) Flat-colour line art makes image-to-3D models produce thin/odd geometry (Art3D paper); fix = add shading by
     depth/Canny-locked ControlNet or an image EDIT that keeps the silhouette, then check by outline diff.
  b) Hosted multi-view generators with low-poly output: Tripo P1 multiview ([front,left,back,right], face_limit
     48–20,000, "clean low-poly, stable topology", ~$0.50/job unverified); Rodin Gen-2 (multi-view, quad output
     4k+); Hunyuan 3.1 Pro Multiview (up to 8 views incl. top, dense only); Hunyuan PolyGen 1.5 (hosted retopo of an
     existing mesh). These are a NEW SPEND CATEGORY — Max must approve any of them.
  c) LLM-scripted modelling research (BlenderGym, 3D-CoS 2026, LL3M): agents get coarse similarity but fail at
     component assembly and high-curvature transitions — the same failures Max saw. An agent working against a
     MEASURED 3D reference (raycast/snap/shrinkwrap/cross-sections of a sculpt) is a better-posed task.
  d) Freelance low-poly hard-surface ship from clean orthos: roughly $50–300 (estimate), days.
  The researcher's ranking: (1) shaded r10 views → hosted low-poly multiview (Tripo/Rodin) → you clean up;
  (2) dense sculpt → auto retopo; (3) dense sculpt as a measuring stick, YOU build a low-poly cage per shell snapped/
  shrinkwrapped to it, using cross-sections of the sculpt to place loops; (4) human modeller; (5) more pure-LLM.

## Questions — be candid, critique me and the researcher, don't just agree
1. Looking at image 3 against image 1: is this sculpt a good enough SHAPE reference to build from? Which r10 forms
   does it get right and which wrong (be specific: shells, rear lobe, head, bubble, spine, modules, engine block)?
   Which defects can be fixed in cleanup vs need a better generation (shaded inputs, other seeds, top view)?
2. Pipeline 3 (sculpt as measuring stick, you build a ≤3k-tri cage shell by shell snapped to it): how would you
   actually do it via the Blender bridge, and what can you reliably do vs not? Does having a 3D reference really
   remove your stated weakness, or does the "which surface overlaps which / where shells terminate" judgement still
   fall on you? What would CC need to give you (e.g., per-shell masks, section slices, a parts list with the sculpt
   region for each)?
3. Would you rank Tripo/Rodin low-poly output above pipeline 3 for THIS ship's beetle-armour shells? Why?
4. Your single recommended path, with what it will and won't achieve, the first cheap test that would prove or
   kill it, and the stop condition at which you'd say "hire a human".
Keep it under ~900 words.

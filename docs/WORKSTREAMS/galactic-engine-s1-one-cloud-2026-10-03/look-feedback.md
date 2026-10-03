# Max's look feedback — first cloud

## 2026-10-03, round 1 (step-1 build, commit 3ff13a4, live game + lab)
- "The mouse dragging is reversed for how it should be." → lab drag reversed in 6a309f8.
- "I'm unhappy with the shape of the nebulas."
- "It looks like a ring. That's the thing I don't like. It looks like a circle."
- "I think what you should do is collect a bunch of pictures of real nebulas that you can use as references in this
  project." → reference library being collected into `refs/nebulae/` (licensed, with MANIFEST.md).

Diagnosis (Claude): the step-1 density is a soft sphere with a central ionized cavity, so its limb-brightened shell
reads as a ring from every angle; a separate dotted grey ring (not the volume — its L is red across it) sits in the
same direction and is being identified in step 2.

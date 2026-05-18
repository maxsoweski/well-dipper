# Intake — Max's verbatim feature status (2026-05-18)

**Status:** Temporary intake doc. Captured from Max's verbal/typed audit
delivered 2026-05-18 across two messages in the session that hit the
context limit. Destined for migration into the new doc structure (step 3
of the structural overhaul). **Do not treat this as a finished feature
inventory.** It's the source material for one.

**Why this file exists:** The session compact summarized Max's feature
status but lost specifics that matter for how we move forward. Max
explicitly asked: "this is important information to have documented
somewhere because it pertains to how we will move forward on many of
the important features that still need work before we can ship to
friends and family."

**How to use this file:**
- Reference when populating the new FEATURE_INVENTORY (or equivalent) doc
- Cross-check claims in `FEATURE_AUDIT.md` against Max's verbatim
- Resolve open audit items (deep-sky dead code; autopilot target type)
  before treating any section as definitive
- Delete after migration is complete

---

## Context from Max (preceding the audit)

> "MVP means we are ready to ship the screensaver mode to friends and
> family. That means all of the major features need to be complete for
> that MVP. Complete means developed and tested, of course, and then
> also shipped. We're also going to have to find a different place to
> host this, probably on easymaking. Do you have a good sense from all
> of these memory files and GitHub of what all of the features are
> that we have shipped already and which ones still need work?"

Max then walked through the feature audit Claude had drafted (now lost
to compaction), correcting where Claude had things wrong. The verbatim
below is from his second message in that exchange.

---

## Music

- **Hyperspace music**: still a placeholder (confirmed Claude's prior
  note).
- **Deep-sky music**: Max called this "really kind of like an Easter egg
  thing" — see Deep Sky section below for what's actually going on.
- **Verdict**: "there is indeed more music that we need to complete
  before shipping to friends and family."

## Sound effects

- **All SFX are placeholders.** Made by Max + Claude from "clipping and
  pitch shifting the title theme."
- Needs full replacement / proper SFX before F&F ship.

## Warp (single biggest unfinished feature)

Max grouped items 2, 3, 4 from the audit Claude had drafted as "all
related to the warp feature being still largely unfinished":

- **Opening of the warp tunnel** isn't done.
- **Tunnel, once it does open, follows you around in a really buggy
  way.**
- **Landing strip multiplies a bunch of times.** (This is the
  warp-landing-strip-persists workstream — fix at `e31ee65` pending
  Max UAT.)
- **Exit of the warp tunnel is broken.**
- **Second half of the tunnel doesn't render.** (Tracked as
  `warp-tunnel-second-half-not-rendering` in NOW.md; needs PM scoping.
  Likely substantial Phase E rewrite.)

> "We haven't even worked on adjusting the visuals or anything like
> that because it's still so damn buggy. So the warp is a major feature
> that needs a lot of work still."

**Implication:** Warp is the biggest single MVP-blocker. Five distinct
broken pieces, only one of which (landing-strip-multiplies) is in
flight.

## Item 5 (whatever I claimed was shipped that isn't)

Max disputed something Claude listed as a clean ship-class:

> "Number five, I mean, that's just wrong, really. I mean, I am
> constantly playing around with it in chrome and seeing how things
> fit together. And that is just not a gait at all, really. There
> should be lots of to-dos still marked in your memory related to the
> features that have ship evidence that you found here."

Then:

> "I think it's pretty clear that you need to think harder about this,
> so I'm changing your model."

**Action item for new doc structure:** Whatever I (prior Claude)
listed at #5 in the lost audit was wrong. The new FEATURE_INVENTORY
must NOT take "shipped commit" as evidence of "feature done." Max is
the source of truth on feature completeness; commit history is at most
supporting evidence.

## Planet generation

- **18 planet types exist, but not all are wired and working.** Need
  to audit which types are actually reachable + rendering correctly.
- **Generation seed → rendering pipeline needs more work.** Max didn't
  specify what's wrong, but the framing is "needs a lot more work,"
  not "polish."
- **Higher-LOD version needed for all planet types.** Currently
  presumably one LOD level per type.

## Exotic and civilized planet types (worst-off)

- The rendering pipeline aspects of exotic and civilized planet types
  "probably need the most work."
- "They just look the furthest away from how I actually want them to
  work."

## All rendering generally

- "What we have today as far as all the different renderings should be
  considered placeholders and still are not quite what I would want to
  be there for friends and family testing."
- "I would want these to be more visually striking and interesting."
- "The pipeline that we have today works okay, but we need to work on
  this a lot more to really make the planets interesting. And moons as
  well, of course."

**Implication:** Even the planet types that render need a visual pass
before F&F. This is a substantial bucket of work — every planet type's
shader/material at minimum.

## Autopilot

> "Autopilot is still quite buggy. I would lump the autopilot feature
> in with warp as still needing lots of work."

**Open audit question (Max raised):** "I'm not totally sure about what
the autopilot tour's auto-warping does. I believe that it always will
select a star system, but you should check and figure out if this is
actually the case. It's possible that the deep sky arrivals are dead
code."

**Action item:** Code audit needed — does autopilot ever target
non-stellar destinations? If so, that's likely dead code per the deep-sky
reframe below.

## Deep sky (full historical context)

This is the section where Max said Claude's "overall structural
understanding of the game is flawed." Capturing the full history in
his words because the language we currently use ("deep sky") carries
first-month meaning that no longer applies.

### History

> "In our first month of development, we were rendering the star field
> randomly every time. And you could select a star, or really it was
> just a point of light, from the star field and then hit spacebar and
> you would enter a warp sequence. And then it would just keep
> repeating. And the way that we decided what system you ended up in
> when you did this was based on a dice roll mechanic. And there was a
> low chance that you could end up in a deep sky object. So you could
> end up inside of a nebula or end up in front of a galaxy that you
> were looking at from a distance, but close enough that you could see
> the shape of the galaxy. And we built shader rendering pipelines for
> all of that stuff. Actually, some of it was particle based."

### Why that mechanic is dead

> "These were cool, but beyond the first sort of experiment phase, I
> wanted to move to an actual procedurally generated model of the Milky
> Way galaxy, which we built. And from there, it became structurally
> necessary, like absolutely our prerogative to make sure that
> everything in the pipeline from procedural generation to rendering to
> gameplay was all built up on this basis. This mathematically created
> seed for generating locations in the galaxy and everything was built
> up from there. So this old model of a random chance to arrive in a
> deep sky object no longer makes any sense."

### What deep-sky rendering code legitimately serves now

> "The deep sky objects that we have the code for rendering in the
> game really only serves the purpose of giving us a title screen.
> Asset, which is randomly generated for the title screen, and also is
> available in the debug mode gallery. At least that is how it should
> work. It sounds like we probably need an audit to confirm that that
> is the case."

**Action items (Max named):**
1. Code audit — confirm deep-sky rendering serves ONLY title screen +
   debug gallery. Any path that hooks deep-sky rendering into in-game
   navigation is dead code and needs removal.
2. Audit autopilot tour auto-warp target selection (above).
3. There's an Easter egg Max wants: "select another galaxy and get to
   it and then receive a message that you need to turn back." Max
   doesn't believe this has been shipped/developed yet.

### Terminology cleanup

Per Max: "that's language from the first month of our development that
does not belong anymore, really, in how we think about this from a
general gameplay perspective."

**Action item for new doc structure:** Audit for stale "deep sky"
terminology that implies the dead dice-roll mechanic. Replace with
specific terms (nebula / external galaxy / globular cluster / title-screen
asset) per actual current role.

## Nebulas (TWO distinct issues)

### Issue 1 — in-game presence doesn't work

> "Actually seeing nebulas when you're in the game, especially as you
> get closer to them when you arrive, what should be like right outside
> of a nebula or inside of it, it should really dominate the star
> field or change what it feels like to be in the star field,
> especially if you're inside of a nebula. Today, that does not work."

### Issue 2 — visual quality

> "The nebulas themselves need a lot of work in terms of their
> rendering, like what they look like. Right now, they're kind of
> messy, and there's lots of repeated shapes and unfinished stuff
> there."

### Related new feature Max wants

> "I would like to be able to select a nebula from the star field the
> way that you can select a star to warp to and then figure out a
> system by which we warp just outside of that nebula so that it
> visually dominates the star field. This would also be a good way to
> test whether the nebulas are rendering properly."

**Implication:** Three threads — wiring (in-game nebula presence),
visual (shader quality), and new feature (nebula-as-warp-target).
Currently no scope brief for any of them.

## Navigation computer

Max walked through each zoom level:

### Zoom level 1 — full galaxy disk (most zoomed out)

> "The most zoomed out version of the navigation computer, where you
> can see the full galaxy disk, looks pretty good. I'm pretty happy
> with that."

**Status:** SHIPPED-quality. The one nav computer view Max is happy
with.

### Zoom level 2 — between full-galaxy and column view

> "The zoomed in version of the individual cells between that
> resolution and the column view need work. Right now, they're just
> zoomed in versions of that one image. Really, what I would want is a
> way that as you zoom closer and closer to the column view, you
> actually start to resolve more detail of the galaxy. We have not
> figured out a way to make that work in the nav screen. We figured
> out a pretty good image, like a PNG that we created of the galaxy
> disk from that one resolution, that one distance from the galaxy
> view. But we have not figured out a way to also make it look good
> when you're kind of zooming into different parts of it, where you
> would expect to resolve additional detail. We have not figured that
> out at all. We don't have a working model for that."

**Status:** UNSOLVED design problem. Not a polish item — Max says
explicitly there is no working model for multi-resolution detail.

### Zoom level 3 — column view (most zoomed in)

> "Speaking of the navigation computer, there's quite a few bugs that
> have to do with the column view. We need to work that out."

**Status:** Buggy. Specific bugs not enumerated — needs Max walkthrough.

## Galaxy / starfield rendering (in-game, not nav view)

Three distinct artifact classes Max called out:

### 1. Galactic glow + giant molecular clouds

> "Outside of the nav view, when you're actually in the starfield, the
> way that the galactic glow and the giant molecular clouds render
> still needs work. It's working okay, but there's still weird angular
> artifacts that I'm seeing in the way that it renders often or
> streaking that looks kind of like it happens in straight lines or
> cuts off abruptly in the magnetic clouds that needs to be fixed."

### 2. Galaxy center / bar

> "The center of the galaxy still needs work. The bar looks somewhat
> artificial, like it doesn't actually belong."

### 3. Overall galaxy glow color

> "The overall galaxy glow also is not quite right. It should be not
> the uniform color that it is all the way across. It should be
> brighter and probably a warmer color towards the center that needs
> work."

**Implication:** Galaxy rendering is one of the most-visible features
(player sees it constantly in cruise mode) and has at least 3 distinct
unfixed visual issues. None currently scoped as a workstream.

## Layer 2 (ENRICHED) items that should come into F&F MVP

> "I think actually the things from the feature audit that are marked
> as layer 2 enriched, at least some of those I am going to want to
> bring in for the friends and family MVP. We need to look at all
> those and decide which belong in that. There are other things
> marked unknown that we also need to figure out where they belong."

**Action item for new doc structure:** The Layer 1/2/3 taxonomy from
the Game Bible is not a clean cut for F&F MVP scoping. Need a separate
F&F-MVP scope decision that pulls SOME Layer 2 items into MVP. The
"unknown" bucket in the FEATURE_AUDIT also needs disposition.

## Max's specific ask at the end

> "So I want you to take everything that I just told you, incorporate
> that into the features list, and by the way, tell me where the
> features list lives, and then feed this back to me showing me of the
> friends and family MVP, what is currently done, what still needs
> work, and then the features that you're not sure belong in the
> friends and family or later on in the development Workstream."

This is the deliverable that will eventually come out of the new doc
structure — a feature inventory organized by F&F MVP status with
unsure-disposition items flagged.

---

## What's NOT captured here

This intake doc only covers what Max explicitly said in his
2026-05-18 verbal/typed audit. It does NOT cover:

- Features Max didn't mention (probably because they're working
  acceptably — but absence is not confirmation; check during migration)
- Pre-2026-05-18 status notes from FEATURE_AUDIT.md, progress files,
  workstream Status: lines (those need to be cross-checked against this
  intake)
- Ship Scanner (just shipped this session, separate from audit)
- Reticle ghosting fix (just shipped this session)
- Warp landing strip persistence fix (in flight, VERIFIED_PENDING_MAX,
  separate from audit)

## Open audit items (must resolve during migration)

1. **Deep-sky rendering code audit** — confirm only used for title
   screen + debug gallery. Find + remove any in-game references.
2. **Autopilot tour target audit** — does it ever target non-stellar
   destinations? If so, dead code per (1).
3. **18 planet types audit** — which are wired/working, which aren't.
4. **Easter egg audit** — does the "warp to another galaxy →
   turn-back message" exist in any form, or is it unimplemented?
5. **Reconcile this intake against existing FEATURE_AUDIT.md** —
   anywhere they disagree, Max's verbatim wins.
6. **Re-evaluate Layer 2 items for F&F MVP inclusion** — case by case.
7. **Disposition "unknown" bucket items** in FEATURE_AUDIT.

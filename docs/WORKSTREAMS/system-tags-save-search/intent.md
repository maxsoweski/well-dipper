# system-tags-save-search — intent

## Why we care

Max wants the **universe to be searchable by tags** — to find, return to, save, and
share specific *kinds* of systems ("a binary with rings," "a habitable world out
near that nebula"), not just opaque coordinates. The immediate, concrete driver:
during the binary orbit-ring debug, when asked "which system did you see it in?"
he couldn't reference it — there's no way to name "the system where X happened."
Reproducible, nameable, shareable system identity is the felt need; tag-search over
the universe is where he wants it to go.

Max raised one load-bearing worry himself: *"if we visit the same coordinates twice,
will the system be identical?"* — because if not, none of this is buildable. **It is.**
The entire position→system chain is deterministic (even the "scatter" RNG is seeded by
position at `GalacticMap.js:956`; zero `Math.random`/`Date` in the generation core).
The only lossy path is the bare-seed debug spawn, which drops position context — so
the design saves a **position snapshot (`navStarData`)**, not a bare seed, and reloads
through the existing deterministic warp path.

He wants the search aimed by a **"probe"** — pick an arbitrary region/sector/prism to
sweep, even outside the system you're in — and **"different options for scanning"**
(selectable scan depth, because some tags are cheap and some need full generation).

## Success criteria (Max's language)

- "If I visit the same coordinates twice, the system is identical both times" — and a
  saved system, reloaded, is the *same* system, not a near-miss.
- "I can see what a system *is* at a glance" — its tags: binary?, star types, planet
  count, has-rings, has-habitable, archetype.
- "I can save the system I'm in" to a list that's still there after I reload, and "jump
  back to it" and land in the identical system.
- "I can search my saved systems by tag."
- "I can point a **probe** at a region — even one I'm not in — and search *the universe*
  there by tag," with **different scanning options** (a fast shallow scan, and a deeper
  scan that confirms the expensive tags like rings/habitability).
- All of this on the **debug/QA surface first** (Phase 1); the player-facing share UI is
  a deliberate Phase 2 follow-on, not part of this contract.

## Scope note

This is the **full vertical slice** Max chose for Phase 1 (debug/QA surface): tag
derivation + cheap fast-path + region probe-search (shallow + deep) + persisted saved
list + faithful reload. Player-facing UI and any "share a link with a friend" surface
are **out of scope** here (Phase 2). The single biggest build risk — flagged for the
builder — is that the cheap tag fast-path must **not** perturb the Alea RNG draw order
of full generation, or every system silently changes; it must be a read-only/replayed
computation. See `contract.json` → `architecturalConnections.mustStayWorking`.

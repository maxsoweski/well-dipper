# Handoff — Phase 4c REOPENED: F51 ring rework + F38/F39 build (2026-06-13)

**Durable on-disk in the repo** (NOT `/tmp` — that wipes on WSL restart). Start a
FRESH session in `~/projects/well-dipper` and read this first. Supersedes
`HANDOFF-phase4c-F51-pickup.md` (now stale — F51 v1 is built & committed) and
`HANDOFF-phase4c-F46-pickup.md`/`HANDOFF-phase4c-F44-pickup.md` (both stale; Max to delete).

## TL;DR — what changed this session and what's left
- The Overlay family (F46–F49) shipped LAST session. THIS session I built **F51 rings v1**
  (a flat `RingGeometry` annulus mesh, physics-driven ringlet/gap shader) and wrote the
  F38/F39 keep/stylize/drop recommendation. Phase 4c's formal /goal was technically met.
- **Then Max reviewed and overrode two outcomes (this is the new work):**
  1. **F51 rings — v1 REJECTED, needs ARCHITECTURAL REWORK.** Max: the flat-annulus shader
     "still look[s] pretty much like the old ones." He wants rings that **look like genuine
     3D objects that interact with the scene dynamically, with their own LOD — close enough
     and they resolve into individual particles.** This is a different substrate, not a tune.
  2. **F38 + F39 — BUILD both** (Max overrode my DROP recommendation). He wants them.
- So **Phase 4c is REOPENED** (tracker line ~22). Remaining 4c work = F51 rework + F38 + F39.
  The other 12 4c cards stay VERIFIED_PENDING_MAX (untouched, fine).

## Source of truth / where to read
- **Tracker:** `docs/FEATURES/planet-lod-campaign-tracker.md` — phase row reopened; F51 row =
  `🔁 v1 rejected`; F38/F39 row = `KEEP — BUILD both`; the F38/F39 reasoning block (now the
  *design challenge*, not a drop rationale) sits just above "## Launch cards".
- **F51 card:** `docs/FEATURES/cards/F51-rings.md` — §6.5 (v1 build plan), §7 (v1 verdict +
  **Max's UAT feedback / rework brief**). Read §7 first.
- **Campaign method:** spec §13.4 heavy loop. The five-dispatch loop mechanics + the full
  ⭐ HARD-WON LESSONS list are in `HANDOFF-phase4c-F51-pickup.md` — **reference that file for
  loop/lesson detail; not duplicated here.** (It's stale on F51 STATUS only; its *process* is
  still the playbook.)

---

## WORK ITEM 1 — F51 rings: rework to a 3D LOD particle ring (the big one)

**This is an architectural rethink and should START WITH A DESIGN/BRAINSTORM PASS, not an
implement dispatch.** The prior handoff already anticipated this ("if F51 needs real
architectural rethinking, brainstorming is reasonable before committing to an approach").

### What v1 is (and why it's the wrong substrate)
A single flat `THREE.RingGeometry` + one fragment shader (committed `093523c`, in
`planet-lod-lab.html`, toggled by `state.ringsEnabled` / `window._lab.rings(true)`). It's a
2D disk: no depth, no per-particle structure, no LOD, scene interaction limited to an analytic
planet-shadow cylinder test. The physics chain (ringlets/gaps/density from
`generateRingPhysics()`) and the retro envelope (Bayer dither-discard alpha, 6-level posterize,
cylinder shadow) work well and are **reusable reference** — keep them, they're not throwaway.

### What Max wants (his words, 2026-06-13)
"rings that look more like 3d objects that interact with the scene dynamically / have their own
lod (if we get close enough, can resolve individual particles)."

### Approach SPACE for the design pass to evaluate (not a decision — options)
- **LOD tiers:** far = cheap impostor (the v1 shader annulus, or a baked texture) → mid =
  instanced particle bands / point-sprite glints → near = individual instanced 3D particle
  meshes (icy/rock chunks) with real depth, lit + planet-shadowed per-particle. The hard part
  is the **transition** (crossfade/morph without a popping seam as distance crosses thresholds).
- **Instanced rendering:** `THREE.InstancedMesh` for particle chunks distributed across the
  annulus by the physics density profile (ringlets dense, gaps empty). Only instantiate
  particles within a camera-proximity shell of the ring plane — the rest stays impostor. This is
  the classic "resolve detail only where the camera is close" budget problem (a full ring is
  ~billions of particles; you render thousands, near the camera only).
- **"Interact with scene dynamically":** per-particle lighting + the planet's shadow as real 3D
  occlusion sweeping the disk; particles catching starlight; possibly parallax/self-shadow up
  close. Clarify with Max how literal "interact" is (just lighting/shadow, or
  collision/fly-through gameplay?).
- **Retro envelope MUST still apply per-particle** (6-level posterize + dither) — the particle
  aesthetic likely wants low-poly faceted/cube-ish chunks, not smooth spheres, to match the
  Well Dipper look.
- **Research first (research-beyond-training rule):** WebSearch current techniques for
  planetary-ring / asteroid-field particle LOD (Elite Dangerous & Star Citizen rings are prior
  art), and `three.js` InstancedMesh + LOD + impostor-transition patterns. Use the
  `library-context` skill for three.js capabilities since cutoff.

### Where to build it
Campaign discipline = prototype in the lab first. BUT this is big enough that the
`feedback_isolated-test-harnesses` rule likely applies: **build a standalone
`rings-lod-lab.html` harness** (just a planet + ring + camera-distance control) to get the LOD
particle mechanism working in isolation BEFORE integrating into `planet-lod-lab.html` /
production. If the mechanism doesn't work isolated, the integration can't save it.

### Design questions to resolve WITH Max (brainstorm pass)
1. How close is "close enough to resolve particles"? (Lab distance range 1.1–30 R; ring spans
   ~4–8 R_p — resolving particles implies getting near the ring plane.)
2. Particle aesthetic: low-poly ice/rock chunks vs. point-sprite glints vs. dithered cube-ish
   voxels (matching the retro envelope)?
3. Is this gameplay-relevant (will the player fly THROUGH rings? that justifies heavy LOD/perf
   engineering) or purely a visual flourish (lighter touch)?
4. Stay strictly inside the 6-level posterize envelope? (Almost certainly yes for consistency.)

---

## WORK ITEM 2 — F38 airglow + F39 cloud-optics: build both (no dossier yet)

Max overrode the DROP rec. Both are unbuilt `[subtle]` optical features with **no dossier card**.

### The design challenge (= my old drop reasoning, retained as constraints to beat)
The reasons I recommended dropping are now the problems the build must solve — see the F38/F39
block in the tracker for the full version:
- **F38 airglow** (faint diffuse night-limb ring, from P24): the 6-level posterize crushes faint
  smooth gradients, AND it overlaps 3 built features on the night limb (F34 limb glow, F33
  nightside-glow, F37 aurorae). To justify standalone, stylize toward a **defined, discrete
  airglow band** with enough contrast to survive posterize, visually distinct from those three.
- **F39 cloud-optics** (rainbows/glories, from P26): a rainbow is the highest-frequency COLOUR
  detail in the catalog — the retro palette destroys smooth spectral arcs. Stylize toward a
  **deliberate 2–3 banded posterized colour arc** (read as intentional, not a failed gradient);
  glories → a bright forward-scatter hotspot on the F31 cloud deck. Needs the F31 cloud substrate.
- **Fallback if standalone can't beat the envelope:** fold F38 → night-limb tint on F33/F34;
  F39 glory → forward-scatter hotspot on F31. But Max's directive is BUILD STANDALONE first.

### Build path (per campaign)
Author a dossier card for each (§1–§6, like the other Fxx cards — copy an Optical sibling such
as `F34-limb-glow.md` / `F37-aurorae.md` for structure), then run the §13.4 heavy loop
(architect §6.5 → implement → review → pre-check blackout → verify §7). Both are surface/atmos
shader terms (unlike F51) so the **overlay-family plumbing DOES transfer** here: emissive-bypass
site, neutral PROV row if registered in FEATURES (highest PROV id = `PROV_ECUMENOPOLIS=45` →
next 46), coverage-guard pattern. Reuse the `tectonic-terrestrial` archetype (presets cover the
terrestrial/ocean/venus bases F38/F39 list). Watch the live aurora nightMask form
(`1.0 - smoothstep(-0.1,0.1,diff)`) — F38 shares the night-limb region with F37.

---

## Infra state (verified live this session)
- **Dev server:** `npm run dev` on **:5173** — UP this session. May stop between sessions; ONLY
  Max can restart (Claude can't). Pre-check via MCP `list_pages` (NOT bash curl — sandbox returns
  `000` false-negative on localhost ports).
- **GPU Chrome :9223:** UP, left on the lab (`?fresh=1`, zero console errors). innerW 1402 /
  dpr 1.25 (sane, no scaling trap). Re-navigate to
  `http://localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`; relaunch only if the window
  closed (`~/.claude/projects/-home-ax/memory/chrome-devtools-9223-launch.md`).
- **chrome-devtools MCP tools are DEFERRED** — load via ToolSearch:
  `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages`.
  Use chrome-devtools (GPU), NOT Playwright (CPU — useless for shaders).

## Commit discipline (shared tree — a parallel warp session has WIP in `src/`)
Two-commit pattern, **explicit paths only, NEVER `git add -A`** (untracked loose PNGs + parallel
`src/` warp WIP must stay out): (1) `git add planet-lod-lab.html planet-archetypes.js
tests/planet-archetypes.test.js` (+ any new `rings-lod-lab.html`) → commit → grab sha;
(2) stamp the sha into the card §7 + flip the tracker row → `git add` explicit doc paths →
commit. The commit hook prints harmless `grep: subpattern name expected` lines — not a failure.
Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
**Nothing is pushed** — 5 local commits this session (HEAD `9ce591e`); Max confirms pushes.

## Git state at handoff
- HEAD `9ce591e`. This session's commits: `093523c` (F51 v1 code), `58f1178` (F51 doc),
  `9ce591e` (4c-close, now amended by the reopen edits — see below).
- **Uncommitted right now:** the reopen edits to `docs/FEATURES/cards/F51-rings.md` (§7 Max
  feedback) + `docs/FEATURES/planet-lod-campaign-tracker.md` (F51/F38-39/phase rows). **Commit
  these doc-only changes before ending** (the handoff-writing session should do it) so the next
  session reads clean truth. Campaign code paths are clean (F51 v1 is committed).
- Loose untracked PNGs + `src/` warp WIP sit OUTSIDE campaign paths — leave them.

## Loose ends to surface to Max (don't silently delete)
- Stale handoff files Max may want to delete: `HANDOFF-phase4c-F51-pickup.md`,
  `HANDOFF-phase4c-F46-pickup.md`, `HANDOFF-phase4c-F44-pickup.md`.
- F51 v1 verify shots are in `docs/FEATURES/cards/shots/F51-*.png` (gitignored) — reference for
  what v1 looks like (the "looks like the old ones" baseline the rework must beat).

## Suggested skills for the next session
- **`superpowers:brainstorming`** — START HERE for the F51 rework. It's a genuine architectural
  rethink (3D LOD particle rings); brainstorm the approach + the 4 design questions WITH Max
  before any build. (The campaign normally skips brainstorming because cards pre-scope features —
  but F51's card scoped the now-rejected flat-annulus v1, so this one needs a real design pass.)
- **`library-context`** + WebSearch — for current three.js InstancedMesh/LOD/impostor patterns
  and planetary-ring particle-LOD prior art (per `feedback_research-beyond-training`).
- **Do NOT** use `dev-collab-scope` or the `verify-workstream` workflow — the campaign replaces
  them for these cards.
- For F38/F39: no special skill — author dossier cards then the §13.4 heavy loop via direct
  `Agent` dispatches (general-purpose, model `opus` — `fable` unavailable here).

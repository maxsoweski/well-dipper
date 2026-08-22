# AC2 — the wholesale-extraction plan, and why it was killed

*Produced by a 6-agent workflow, 2026-08-22. The design agent proposed moving `applyDrivers`
(planet-lod-lab.html:1933-2760) into a shared module wholesale. The adversarial agent was told to
REFUTE rather than improve, to default to "this breaks" when uncertain, and to cite `file:line`.*

⭐ **VERDICT: the plan did not survive — 13 defects, 5 breaking currently-green gates.** Max ruled
for the pack-shaped alternative on this evidence, 2026-08-22.

⛔ **THE DEFECT THE WHOLE EXERCISE EXISTED TO FIND:** the plan's own acceptance criterion was a
state-value diff, which is *structurally blind* to every gate below. A plan that cannot fail its own
test is the thing the "cheaper next time" fence discipline is for, applied one level up.

## Independently re-verified before acceptance (not taken on the agent's word)

| claim | agent | working-Claude's own measurement |
|---|---|---|
| citations anchored into the move range | 25 in-range, 90 at >= 1933 (symbol-anchored subset the fence checks) | **175 in-range, 500 at >= 1933** over ALL line-anchored refs — the broader set, consistent with the agent's narrower one |
| `radius-live-feed-fence.test.js` pins literal lab bytes in-range | :676, :681 | **confirmed** — those byte-strings are at planet-lod-lab.html:2283 and :2406 |

## The five gate-breakers

1. **Citation fence.** `planet-lod-lab.html` is a `CITE_SOURCE`. Deleting 828 lines from 1933 orphans
   every in-range ref and shifts every later one. Exit 2, and the plan's green could not see it.
2. **`tests/radius-live-feed-fence.test.js`** — two planted-defect controls assert those exact bytes
   are still in the lab (`:727 expect(LAB.includes(d.live)).toBe(true)`).
3. **`tests/src-boundary-fence.test.js`** — the moved body's first two statements call
   `drawPresetConditions`/`drawPresetRadius`, imported from the REPO-ROOT `./driver-presets.js`. A
   shared module importing it needs a second root allowlist entry; `:135` asserts the allowlist is
   **exactly one** root entry.
4. **`tests/vis-scale-fence.test.js`** — the plan's own declared safety net for its self-declared
   highest-risk hazard **does not exist**: `_dispR`/`sVis` have ZERO occurrences in 1933-2760. The
   fence cannot match tokens that are not there.
5. **It reinvents `src/worldengine/port/writePackUniforms.js`.** The proposed
   `projectDriverState(state, uniforms, {gates, animRate, skip})` is that module minus its
   display-policy validation, and its `skip` flag would BYPASS the pack collision guard
   (`drivers/index.js:317`) rather than preserve it — that guard only runs inside `applyDriverPacks`'s
   own loop, so a later writer is simply last-writer-wins.

## Two silent-divergence defects worth keeping

- **`preset: null` zeros all 13 feature-relevance gates.** `planet-lod-lab.html:1986-1989` does
  `(ASSOCIATIONS[key]?.rendersOn || []).includes(ctx.preset) ? 1.0 : 0.0`, and `includes(null)` is
  false for every key. The game path would run with every feature OFF and a parity ledger would be
  comparing against an all-off shadow.
- **`drawPresetRotation` is lab-local** (`planet-lod-lab.html:878`, keyed on preset NAME). Skipping it
  on the game path leaves `state.rotationHours` unwritten, and `_rotH` consumes it in-range at `:2252`
  via `?? 24` — a shadow state on a fallback constant, with nothing red.

## What the plan got RIGHT, and it is the load-bearing good news

⭐ **Zero `document.`/`window.`/`getElementById`/`.style.` and zero `THREE.` in 1933-2760.** The range
is genuinely portable JavaScript. **The obstacle was never the code — it is that the file is
load-bearing as a REFERENCE TARGET.** That is why the answer is incremental pack conversion rather
than a big-bang move, and it is a fact about this repo that will outlive this workstream.

## The priced alternative, recorded so it can be reopened

Wholesale move, if ever wanted: 175 refs repointed to the new home, ~325 more protected by granting
the region §10's symbol-only citation form (the exemption `conditionFromBody.js` already holds, for
exactly this reason), 2 fence repairs, 1 boundary ruling on the root `driver-presets.js` import, and
the `writePackUniforms` duplication question resolved first.

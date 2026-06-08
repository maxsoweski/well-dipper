# Planet-LOD feature-completion campaign — tracker

**Started:** 2026-06-07 · **Goal:** finish the planet-lod-lab feature set by
working the **unbuilt** features in build-sequence order, F11 onward, across
however many sessions it takes, until the lab is feature-complete.

**Source of the order:** [`planet-visual-features.md`](planet-visual-features.md)
§"Build sequence" (Stage A foundation → Stage C feature-by-feature, sequenced by
domain). This tracker is the *cross-session position marker* on top of that doc.

**Lab surface:** `planet-lod-lab.html` (exposes `window._lab`). **Scope = lab
only** — wiring into the production game (`src/objects/Planet.js`) is a separate,
later effort with no parity goal. "Done" per feature = working + visually verified
in the lab on GPU Chrome `:9223`.

**Per-feature process (Max's choice, 2026-06-07): FULL CEREMONY.**
brainstorm → spec (`docs/superpowers/specs/`) → writing-plans
(`docs/superpowers/plans/`) → subagent-driven implement → code-review subagent →
self-verify `:9223` → commit. Strict retro envelope (Option A: relief/albedo, no
bypass channels) unless banding demands otherwise.

---

## Sequence + status

Legend: ✅ done · 🟡 partial · ⬜ unbuilt (placeholder/aspirational) · ▶️ current

| # | Feature | Domain | Lab status |
|---|---|---|---|
| — | Stage-A foundation (analytic noise, lodRamp, envelope split, driver→uniform) | foundation | ✅ |
| F1–F10 | mountains, craters, ejecta, canyons(tectonic), scarps, plateaus, tessera, edifices, lava, chaos, ridged-icy | Relief | ✅ |
| F17/F18/F22/F23 | glacial, sublimation, polar caps (PLD), frost mask | Cryo/volatile | ✅ |
| **F11** | **River networks & valleys** | **Fluvial** | **▶️ current** |
| F12 | Deltas & alluvial fans | Fluvial | ⬜ |
| F13 | Outflow / megaflood channels | Fluvial | ⬜ |
| F14 | Lakes & seas (standing liquid) | Fluvial | 🟡 (ocean water only) |
| F21 | Karst / dissolution | Fluvial | ⬜ |
| F15 | Dunes & wind forms | Aeolian | ⬜ (Stage-5 placeholder) |
| F16 | Dust mantles | Aeolian | ⬜ |
| F19 | Mass-wasting deposits | (gradational) | ⬜ |
| F20 | Coastlines | (gradational) | ⬜ |
| F28 | Storm clusters / oval trains | Storms | 🟡 (`storms.spots` unwired) |
| F29 | Polar vortex (hexagon) | Storms | 🟡 (polar darkening only) |
| F30 | Lightning | Storms | ⬜ |
| F31c/F31e | sub-neptune haze / layered haze shells | Clouds | 🟡 / ⬜ |
| F36 | Sunglint off liquid | Optical | ⬜ |
| F41–F45 | magma ocean, carbon crust, crystal, hex, shattered | Exotic-natural | ⬜ |
| F46–F49 | fungal, machine, city-lights, ecumenopolis (lab Stage-7) | Overlay | ⬜ in lab (✅ in game) |
| F53 | Close-up LOD2 surface detail | Crosscutting | ⬜ (`lodLevel` dead) |

> Statuses past the Fluvial block are from `planet-visual-features.md` tags + lab
> folder absence; **confirm each against the lab when the campaign reaches it.**
> `[subtle]` features (F38/F39, sprites, UV Y-markings) need an explicit
> keep/stylize/drop call when their domain comes up — don't spend budget on them.

## Per-feature artifact log

| Feature | Spec | Plan | Commit(s) | Verified |
|---|---|---|---|---|
| F11 | [`2026-06-07-f11-fluvial-river-networks-design.md`](../superpowers/specs/2026-06-07-f11-fluvial-river-networks-design.md) (approved + audited `e2430ab`) | [`2026-06-07-f11-fluvial-river-networks.md`](../superpowers/plans/2026-06-07-f11-fluvial-river-networks.md) (6 tasks, spike-first) | _(next: implement)_ | |

## Session pickup

1. Read this tracker → find the ▶️ row = current feature.
2. Read that feature's spec + plan (artifact log) if they exist; else start the
   full-ceremony loop at brainstorm.
3. Shared-tree caution: a warp session may have uncommitted WIP in this tree —
   stage **only explicit paths you touch**, never `git add -A`.

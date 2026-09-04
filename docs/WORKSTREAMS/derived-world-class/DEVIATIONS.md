# derived-world-class — deviations, carve-outs and things found

Recorded rather than silently assumed. Each is a decision a later session would otherwise have to
re-derive from the diff.

## 1. Gas bodies keep the formation roll — a carve-out, not an oversight

`worldClassOf` returns `null` for `compositionClass(cv) === 'gas'` and `displayClassOf` falls back to
`type`. Three reasons, in order of weight:

- **No AC needs it.** `gas-giant` / `hot-jupiter` / `sub-neptune` are formation outcomes the roll gets
  right from orbit and size, and none is contradicted by its own physics the way `ocean` (dry),
  `lava` (cold) and `ice` (boiling) were.
- **The engine's own derived giant classifier emits a vocabulary the UI has no copy for.** Measured
  over 200 seeds, `giantRegimeOf()` returns only `sub-neptune` (231), `saturnian` (61) and
  `neptunian` (82) — never `gas-giant`, never `hot-jupiter`. Adopting it would rename every gas giant
  into words `PLANET_TYPE_NAMES` cannot render.
- Reclassifying giants is its own workstream.

## 2. `eyeball` is NOT derived — and it costs something

3 of the 14 habitable worlds are tidally locked. Deriving `eyeball` for them would have been more
informative (the HUD would say "Tidally Locked"), but it would also have moved the goalposts on AC-2,
whose bar was written as "named `ocean` or `terrestrial`". The contract was not rewritten mid-build.

⚠ **The cost is real and is not zero:** a locked habitable world now reads `ocean`/`terrestrial` and
its lockedness is no longer in its name. Backlog row, not a shrug. It also sits next to the parked
REPORT Block B work, which is about exactly this class of body.

## 3. `carbon` is derivable but fires on nothing — and that is a FINDING, not a bug here

The derived cut is `carbonToOxygen > 0.8`, `deriveComposition`'s own threshold for
`surfaceType: 'carbon'` (PhysicsEngine.js:596). Measured across 200 seeds, **C/O tops out at 0.769**
and never reaches it — while the formation roll labels **126 bodies `carbon`**, whose own
`composition.surfaceType` reads `silicate`.

So "Carbon World" has had no physical referent in this galaxy at all. Those bodies now read by their
actual physics (54 → `rocky`, 23 → `venus`, 24 → `ice` among the solid ones).

⚠ It also means the derived `carbon` branch is **untested by the population** — it is written, and
nothing exercises it. Treat it as unproven code, not as a passing case.

## 4. A SECOND one-name-two-meanings pair, found while scoping

`compositionClass` cuts carbon at **C/O > 1.0** (e1Regime.js:68); `deriveComposition` cuts
`surfaceType` at **C/O > 0.8** (PhysicsEngine.js:596). Two thresholds, one concept, no error.
Logged, deliberately NOT fixed here — it is the same bug shape this workstream is about and it
deserves its own decision rather than a drive-by.

## 5. A fifth display surface, found live and added to scope

The contract's outputs named three surfaces. Driving the game turned up a fourth read of the raw
label: `CockpitSnapshot.js:271` fed the cockpit's **TYPE** row from `bodyData.type`. In HELM that row
*is* "the panel" from Max's own success criterion ("when I fly to a warm wet world, the panel tells me
that is what it is"), so it was wired rather than left. `displayClassOf` falls back to `type`, so
stars, moons and hand-authored bodies read exactly as before.

⚠ **Not visually confirmed.** The cockpit survey rows render blank for an unscanned target, so the
populated row was never seen. Unit-covered only.

## 6. Moons are untouched

`MoonGenerator._pickType` still names moons by their formation roll. Out of scope this pass by the
contract; planets prove the shape first.

## 7. `T_MELT_LO` was tried for `lava` and rejected

surfaceMaterial's `T_MELT_LO` (900 K) is a **rendering** threshold — its own comment says "below this
no melt sheen". Used as the lava gate it called **100 of 476** bodies lava. `T_LIQUIDUS_BASALT`
(1400 K, the tholeiitic basalt liquidus) is the temperature rock is actually molten at, and it yields
1. Recorded because 900 is the more obvious constant to reach for and the mistake is invisible
without counting.

## 8. The suite was already red at HEAD

8 files / 20 tests fail at `6a6c0e4`, before any edit in this workstream:
`agent-camera-api`, `driver-pack-giantdeck`, `gas-body-lab-material`, `lab-shader-perframe-seam`,
`moon-condition-contract`, `moon-rng-stream-identity`, `port-condition-contract`,
`relief-octave-lod-ramp`. The handoff's "all four instruments green" referred to four named
instruments, not the suite. After this workstream the same 8 fail and no others.

## 9. Stale citations repaired, three of them pre-existing

Editing `PlanetGenerator` drifts every line-anchored citation into it (trap #16). Both new imports were
**appended to existing lines** (the `e1Regime.js:22` / `main.js:7` idiom) and both UI edits were made
**line-count neutral**, so only one ref actually moved (`:875` → `:890`, repaired by symbol).

While repairing it, three short-form refs in `moon-formation-channel-model-PLAN-2026-08-15.md`
(`:922`, `:977`, `:991-993`) turned out to be **already stale at HEAD** — pointing at a bare `//` and
a closing brace. Repaired to the metalFactor sites they describe (`:911` definition; `:956`, `:1013`,
`:1027-1028` consumption).

## 10. A month-old workflow worktree is inside the repo

`.claude/worktrees/wf_440dc97c-63b-4` (detached at `47170f9`, Aug 25) holds a full copy of the tree,
and running a single test file by path makes vitest execute **both** copies. It did not affect the
`--dir tests` counts above, but it doubles single-file runs and reports failures from a month-old
snapshot as if they were current. Not removed — it is not this workstream's to delete.

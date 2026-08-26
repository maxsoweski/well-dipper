# The pack-authoring path

*The route the shrink-only ratchet sends you down. Companion to `tests/lab-surface-ratchet.test.js`; specified by `docs/FEATURES/one-pipeline-two-frontends-PLAN.md` §4 "Step 5", part 5f.*

⛔ **Everything under "The new path" describes work, not a hook to call.** At `4e864bc` there is no `applyPackToState`; the first instance of it lands with Step 5c's gas deck. If you are reading this before that ships, you are reading the design you are about to implement, and the worked example below is the shape to implement it in — not an API to import.

---

## 1. Why you are here

You added a feature to the World Engine Lab and the build went red with something like:

```
applyDrivers state field GREW by 1: dustDevilStrength
```

That is `tests/lab-surface-ratchet.test.js`, and it is not complaining about your feature. It is complaining about **where you put it**. The ratchet pins three sets — the `state.*` fields `applyDrivers()` assigns, the uniforms `frame()` touches, and the uniforms `applyDrivers()` touches — and fails when any of them grows. Shrinking is always allowed; growing is a deliberate act that has to be declared.

**The reason it exists.** The lab can draw about 52 planetary features; the game draws four of them through the world engine. Every feature that has ever crossed over crossed by an agent reading the lab, re-deriving the law, and re-typing it into `Planet.js` — and three laws have already silently drifted apart doing exactly that. The whole plan this ratchet belongs to replaces that with **driver packs**: small pure modules under `src/worldengine/drivers/` that both front-ends import. A pack costs one module and reaches both. A feature written inside `applyDrivers()` costs one module, one re-derivation, one drift, and it reaches one.

Nothing else in the plan makes the pack the default. Every authoring affordance in the lab pulls the other way — the 470-line `state` literal opening at world-engine-lab.html:891 `const state = {`, the 186 `.listen()` bindings that bind lil-gui controllers to its fields, `_driverTouched`. So the ratchet closes the old path and **this document opens the new one**, because a ratchet that blocks the wrong path without offering the right one gets deleted the first time it fires.

---

## 2. The old path, in three hops

Take gas bands, the feature Step 5's first pack replaces. Today it is spread across three functions and a GUI folder:

**Hop 1 — derive, into `state`.** `applyDrivers()` computes a value and parks it on the shared `state` object:

- world-engine-lab.html:2233 `state.bandStrength = _gas ? 1.0 : 0.0;`
- world-engine-lab.html:2274 `state.bandContrast = 0.08 + 0.92 * _vigor;`

**Hop 2 — publish, into uniforms.** `frame()` reads `state` and writes the shader, applying the lab's own enable gate on the way through:

- world-engine-lab.html:5111 `uniforms.uBandStrength.value = state.bandsEnabled ? state.bandStrength : 0.0;   // ✓ enable gate`
- world-engine-lab.html:5112 `uniforms.uBandContrast.value = state.bandContrast;`

**Hop 3 — display, into the GUI.** lil-gui binds a controller to the *same* `state` field with `.listen()`, so the slider tracks whatever `applyDrivers` derived instead of showing a stale authored default:

- world-engine-lab.html:3687 `fBands.add(state, 'bandStrength', 0, 1, 0.01).name('strength (driven)').listen();`
- world-engine-lab.html:3694 `fBands.add(state, 'bandsEnabled').name('✓ enabled');`

Hop 3 is the constraint that makes this document necessary. **`state` is not an implementation detail of the lab — it is the lab's display surface.** 186 `.listen()` bindings read from it, and the name `strength (driven)` is a promise to whoever is turning the knob.

---

## 3. Why you cannot just call the writer and skip `state`

The obvious move is to have the lab do what the game will do — call the shared writer straight onto the material:

```js
// ⛔ DO NOT DO THIS IN THE LAB.
writePackUniforms(uniforms, giantDeckPack(condition, ctx).drivers, ctx);
```

Three things break, and none of them throws:

1. **Every `.listen()` controller in the affected folders goes dead.** `state.bandStrength` stops being written, so the slider freezes at its authored literal while the shader shows something else. The panel is now lying, quietly, and it is the panel the whole lab exists to be looked at through.
2. **The uniform is written twice per frame, and the second write wins.** `frame()` still runs hop 2 unconditionally. Whatever the pack wrote is overwritten by `state.bandsEnabled ? state.bandStrength : 0.0` a few milliseconds later, reading the now-stale `state`. The pack appears to do nothing at all.
3. **The ratchet does not save you.** Deleting hop 1 shrinks set 1, and shrink is green. Nothing in this repo notices that a GUI folder went inert. That is why this failure mode is written here rather than left for a test to catch — there is no test that can.

---

## 4. The rule that keeps hop 3 honest

> **`state` holds the RAW driven value. The front-end applies enable gate × per-feature relevance × animation rate exactly once, at its own publishing seam.**

The lab already obeys this and it is worth seeing why, because a pack that gets it wrong produces a GUI that erases itself:

- world-engine-lab.html:5111 `uniforms.uBandStrength.value = state.bandsEnabled ? state.bandStrength : 0.0;   // ✓ enable gate`
- world-engine-lab.html:5126 `uniforms.uJetSpeed.value     = state.jetSpeed * _animRate;   // AC4 storm/band drift slower on a large giant (Jovian) than a small one (Neptune)`
- world-engine-lab.html:5174 `uniforms.uPolarStrength.value = state.polarVortexEnabled ? state.polarStrength * state.featureRelevant.polarVortex : 0.0;   // ✓ enable gate × per-feature relevance hard-gate (Thread B idiom) — zeros Mars leak (polar vortex authored for gas giants, not terrestrial)`

`state.bandStrength` is the **ungated** number. Untick "✓ enabled" and the shader goes to zero while the slider still shows 1.0 — which is correct, because the enable box is a *view* decision and the derived value has not changed. Tick it back and the feature returns.

Now suppose a pack shim wrote the gated value into `state` instead. Unticking the box would drive the slider to 0, the driven value would be lost, and re-ticking would restore 0. A checkbox that destroys data is not what anyone means by an enable gate. **So the shim resolves the pack's drivers with all gates on, all relevances 1.0 and `animRate` 1.0 — the "driven value" context — and lets `frame()` apply the real ones exactly as it does today.**

The game applies the same three factors exactly once too, on the other side: `resolveDriver` in `src/worldengine/port/writePackUniforms.js` (symbol-only — that file is being authored in a concurrent lane in this same step, so any line number written here is stale before it lands) folds `ctx.gates`, `ctx.relevance` and `ctx.animRate` into the value it returns, and it **throws** rather than guessing when a driver names a gate that `ctx.gates` does not carry. Both front-ends therefore gate once; neither gates twice; and nobody had to write "remember to gate" in a comment.

---

## 5. The new path

Four hops, and the middle two are shared code that neither front-end owns.

```
condition ──► pack(condition, ctx) ──► { drivers, attributes }
                                            │
        LAB  ─────────────────────────────► │ ──► applyPackToState(state, drivers, MAP)
                                            │        └─ frame() publishes, gating as it always has
                                            │           └─ .listen() controllers keep tracking state
                                            │
        GAME ─────────────────────────────► └──► writePackUniforms(uniforms, drivers, ctx)
                                                     └─ no state, no GUI, no mirror
```

**The pack** is a pure function under `src/worldengine/drivers/`. It takes a condition vector and a context, and returns drivers **keyed by uniform name** — `uBandStrength`, not `bandStrength`. It knows nothing about `state`, nothing about lil-gui, and nothing about either front-end's display policy. It emits sizes in km, never frequencies; `featureFrequencyFromKm` is applied once, by the writer, against the display radius the front-end supplied. (That parameter is the whole reason the contract exists: for the same body the lab's correct first argument is R^0.5 and the game's is R, i.e. 2× versus 4× on a 4 R⊕ world, and the wrong one is a finite, plausible, in-band number no value-range test can see.)

**`applyPackToState`** — the piece this document is really about, and the piece that does not exist yet — is a shim of maybe fifteen lines. It resolves each driver under the *driven-value* context and assigns it into `state` under an explicit **uniform-name → state-field name map**. The map is explicit rather than derived by de-`u`-ing and lower-casing the first letter, for the reason this program keeps relearning: `uBaseColor` and `uWeatheredColor` were one value under two spellings for months, and a mechanical name rule is exactly what hides that. A map that is written down can be read.

**What does NOT change:** `frame()`. Not one line. It keeps reading `state`, keeps applying the gates, keeps writing the uniforms — which is why the ratchet's set 2 does not move when a feature migrates, and why migration is invisible to the controllers bound to those fields.

---

## 6. Worked example — the gas bands

### Before

```js
// world-engine-lab.html, inside applyDrivers()
state.bandStrength = _gas ? 1.0 : 0.0;                 // :2233
state.bandContrast = 0.08 + 0.92 * _vigor;             // :2274
state.bandWarp     = 0.12 + 0.43 * _vigor;             // :2279
if (_gas) state.bandTint = _fp.atmosphere.color.slice();  // :2281
state.jetSpeed     = Math.min(1.2, Math.max(0.2, 8 / _rotH));  // :2292
```

Five derivations, in a 6,420-line HTML file that nothing under `src/` can import. To reach the game they must be read, re-derived and re-typed — the exact operation that produced the aurora, `limbExponent` and crater-relief divergences.

### After

**1. The law moves to a pack** — `src/worldengine/drivers/giantDeck.js`, importable by both:

```js
// SKETCH, not shipped code — `vigor` and `clamp` stand in for the real giant-driver
// derivations, and the real pack is Step 5c's, in that lane, not this one's.
import { scalar, sizeKm } from '../port/writePackUniforms.js';

export function giantDeckPack(condition, ctx) {
  const vigor = /* … from the giant-driver modules … */;
  return {
    drivers: {
      uBandStrength: scalar(condition.compositionClass === 'gas' ? 1.0 : 0.0, { gate: 'bands' }),
      uBandContrast: 0.08 + 0.92 * vigor,
      uBandWarp:     0.12 + 0.43 * vigor,
      uBandTint:     condition.atmosphereColor.slice(),
      uJetSpeed:     scalar(clamp(8 / condition.rotationHours, 0.2, 1.2), { animRate: true, gate: 'jets' }),
    },
    attributes: { /* aBand / aShear / aMush */ },
  };
}
```

Note what moved into the *shape* rather than into code: the enable gate is `{ gate: 'bands' }` and the animation scaling is `{ animRate: true }`. Both were previously spelled out at the publishing seam in `frame()` and would have had to be re-spelled in `Planet.js`. Now each front-end supplies its own `ctx` and the writer applies them.

**2. `applyDrivers` calls the pack and mirrors into `state`:**

```js
// world-engine-lab.html, inside applyDrivers() — replaces the five lines above
const _pack = giantDeckPack(condition, labPackCtx());
applyPackToState(state, _pack.drivers, GIANT_DECK_STATE_MAP);
```

with the map alongside the pack, in the lab, where the display names live:

```js
const GIANT_DECK_STATE_MAP = {
  uBandStrength: 'bandStrength',
  uBandContrast: 'bandContrast',
  uBandWarp:     'bandWarp',
  uBandTint:     'bandTint',
  uJetSpeed:     'jetSpeed',
};
```

**3. `frame()` is untouched.** world-engine-lab.html:5111 still reads `state.bandsEnabled ? state.bandStrength : 0.0`; world-engine-lab.html:5126 still multiplies `state.jetSpeed` by `_animRate`.

**4. The GUI is untouched.** world-engine-lab.html:3687 is still bound to `state.bandStrength` with `.listen()`, and it still says `strength (driven)` — which is now more true than it was, because the value arrives from a module the game runs too.

**5. The ratchet is green.** Set 1 lost `bandStrength`, `bandContrast`, `bandWarp`, `bandTint`, `jetSpeed`; set 2 and set 3 did not move. Removal is always allowed. The test prints what it shed:

```
[ratchet] applyDrivers shed 5 state field(s) since 4e864bc: bandContrast, bandStrength, bandTint, bandWarp, jetSpeed
```

**6. The game gets the feature for one array entry**, not one re-derivation — which is the sentence this whole plan is trying to make true.

---

## 7. The two context objects

The lab and the game hand the same pack two different contexts, and the difference is the point.

| field | lab | game |
|---|---|---|
| `displayRadiusEarth` | its display pseudo-radius, world-engine-lab.html:4895 `const _dispR = sVis;` | the real radius, via `gameDisplayRadiusEarth` |
| `macroSeed` | the lab's own macro seed, coerced to an integer (cited below the table) | the numeric `fnv1aString` form — ⚠ never the hex form, `'da81e221' \| 0 === 0` and every giant silently shares one band phase while every driver-algebra distinctness gate still passes |
| `gates` | all-on for the mirror; the real checkboxes are applied by `frame()` | a named constant, and Max sees its consequence at Step 6 |
| `relevance` | all-1.0 for the mirror; `state.featureRelevant` is applied by `frame()` | the game's own relevance source, named explicitly |
| `animRate` | 1.0 for the mirror; world-engine-lab.html:4971 `const _animRate = animationRateFactor(_RE);` is applied by `frame()` | the game's animation rate |

The lab's seed, kept out of the table because a `|` inside a cell splits it: world-engine-lab.html:1941 `const _dp = drawPresetConditions(driverUI.preset, state.macroSeed | 0);`

**Read the lab column carefully.** All three of `gates`, `relevance` and `animRate` are *neutral* in the lab's pack context. That is not because the lab ignores them — it is because the lab applies them one hop later, at the seam that has always applied them, and applying them twice is the bug this table exists to prevent.

---

## 8. Overrides, and why they still work

The lab lets a user drag a slider and keep the dragged value until the preset changes. That machinery is on the `state` field, not on the derivation:

- world-engine-lab.html:1627 `const _driverTouched = new Set();   // field names the user has dragged (overrides) since last preset change`
- world-engine-lab.html:1670 `const useOv = (key) => (_driverAbMode === 'override' && _driverTouched.has(key));`
- world-engine-lab.html:1788 `if (!_driverTouched.has('bandRough')) state.bandRough = drawBandRoughness(regime, state.macroSeed | 0);`

That last line is the pattern to copy: **guard the mirror write, not the pack call.** The pack always runs and always returns a value; `applyPackToState` declines to overwrite a field the user has touched. The pack stays pure and stays ignorant of the GUI, the override keeps working, and the A/B flip back to `preset` mode restores the derived value because it was never lost.

---

## 9. When the ratchet fires, there are exactly three legal answers

**A. Move it to a pack.** The default, and §5 is how. Set 1 shrinks or holds; nothing grows; no fixture edit.

**B. It is genuinely new lab-only plumbing.** A debug readout, a probe surface, a display-scale intermediate — something that will never reach the game. Add the entry to `tests/fixtures/lab-surface-baseline.mjs` **in the same commit**, with a one-line reason on the entry. That is the declaration the ratchet is asking for; it is not a defeat, it is the point. A reviewer can then see the growth in the diff instead of not seeing it.

**C. The measurement is wrong.** Possible, and the harness names its own limits at the top of `tests/lab-surface-ratchet.test.js` rather than hiding them. If you have found a new one, write it into that block with the construct that produced it. ⛔ A limit recorded only in a ledger has been forgotten, not accepted.

**Not a legal answer: deleting the assertion, widening a floor, or re-recording the fixture without naming what moved.** The fixture has no record mode, deliberately.

---

## 10. What this document does not claim

It does not claim a pack is cheaper to write than five lines in `applyDrivers` — for a single feature in a single front-end it is not, and pretending otherwise would be the kind of true-and-misleading statement this program keeps having to retract. It is cheaper across **both** front-ends and across **every future change**, and that is the trade being made.

It does not claim `applyPackToState` exists. It does not exist at `4e864bc`; §5 and §6 are its specification.

It does not cover the storm and polar families. Their producer is a fourth driver function, `applyStormState()`, which Step 5c fences out of pack #1 by name — and the ratchet does not watch it either. Both facts are recorded as a named limit in the test rather than smoothed over: 27 state fields and 6 uniforms across `applyStormState()` and `rebakeE5Bands()` are outside the watched surface today.

It does not make the game render anything. A pack that nobody composes is an orphaned module, and an orphaned module passes a byte-identity fence — `atmosphereOptics.js` already proved that. Composition is Step 6.

---

*Citations in `line + symbol` form resolve against `world-engine-lab.html` at commit `4e864bc`. Step 5c deletes a block out of `applyDrivers()`, which moves every line below it in that file: if a line and its symbol ever disagree, grep the symbol — the symbol is the reference and the integer is the convenience (PLAN §10).*

# Live pair — NOT YET MEASURED

The A/B key exists and the wire is confirmed live in the running game, but **the live pair for AC-5
and AC-6 has not been captured** and this directory holds no evidence. Recorded here so the gap is
not mistaken for an oversight.

## What IS confirmed live (read out of the running game, 2026-09-04)

Deep link `?system=rocky-2`, after a hard reload and clearing `localStorage['wd.labGasBodies']`:

- `_labRelief.size()` → **8** registered lab materials, `masters` → **11**, state `on`.
- On every one, `uniformValues[n] === packValues[n]` for all eleven masters — the material carries
  exactly what the pack resolved, so the wire reaches game uniforms.
- **7 distinct `uOrogenyAxis` values across the 8 bodies** — the seeded axes are per-body in the
  game, which is the property the whole `reliefAxesFor` lift exists for.
- The body at `radiusEarth` 0.7896 carries **11 non-zero masters**, matching `population.json`'s
  row for `rocky-2/planet/3` exactly (10 live + the constant `uMassWastDensity`).

## Why there is no pair yet

A first ON/OFF pair was captured and **discarded as inadmissible**: it read 60.5 % of pixels changed,
which is not a credible relief delta on a framed body — the planet rotates between two screenshots,
so the pair measured ROTATION plus relief and cannot separate them. `_lab.freezeFrame()` is the
control for exactly this, and the chrome-devtools connection dropped before the frozen pair could be
taken. A number that large should be disbelieved before it is reported, so it was not kept.

## What the pair must do when it is taken

1. `_lab.freezeFrame()` FIRST, so the only variable between the two shots is the eleven masters.
2. Subjects, both named from `population.json` rather than picked by eye:
   - `rocky-2/planet/3` (R⊕ 0.79) — all ten live masters, the "full deck" case.
   - `rocky-2/moon/1.0` (R⊕ 0.027) — far below the 0.22 R⊕ bake-crossover floor, so the deck is the
     ONLY road relief can take there. **This is the sharpest claim in the workstream and the one that
     most needs a picture.**
3. [CONTROL — the null body] a body whose eleven masters all resolve 0 must show a pixel delta of 0
   with a NON-NULL `_labRelief.record()`. A body that moved nothing because it was never registered
   is a blind spot, not a control.
4. [CONTROL — sabotage] `_labRelief.sabotage(surface)` writes `uMountainAmp` 1.0, a value the law
   cannot produce (its ceiling is 0.6, and it is 0 on an icy crust). The frame must change, and
   `record().state` must read `sabotage`.
5. AC-6's lab-vs-game composed-height comparison on one of the 10 `stagnantLid` bodies, and the
   small-moon ON/OFF that proves the "only road" claim rather than asserting it.

⛔ Artifacts land HERE, in-repo. A verifier cannot trace evidence that exists only in a session
scratchpad and will mark the AC INSUFFICIENT.

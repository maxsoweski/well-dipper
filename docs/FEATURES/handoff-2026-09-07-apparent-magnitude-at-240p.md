# Handoff — ▶ **APPARENT MAGNITUDE AT 240p**

> ⚠ **IN-REPO ON PURPOSE**, same as its predecessor: `/tmp` does not survive a WSL restart. The
> handoff skill says "temp directory"; this project's standing convention overrides it.
> Supersedes `handoff-2026-09-06-rendering-scale-aesthetic.md`, whose arc — the seven-surface
> inventory — is **DONE** (`docs/FEATURES/rendering-scale-seven-surface-INVENTORY.md`).
> **Branch** `feature/world-engine-production-L1` (lane A, **NOT** master).
> ⛔ **11 commits UNPUSHED.** Max has not been asked. Ask before pushing.
> ⛔ **662 untracked stray PNGs are normal — NEVER `git add -A`.** Stage explicitly.
> ⚠ ALWAYS `npx vitest run --dir tests --root /home/ax/projects/well-dipper`.

## 0. Test baseline — 20 failed / 3917, 8 files. UNCHANGED all session.

Same list the previous handoff carried. Capture and diff; never attribute a pre-existing failure to
your change. ⚠ **Two of them are FLAKY**, measured: `worldengine-inc3b-composite-budget.test.js`'s
crater tests failed once in a full run, passed in isolation, and passed on re-run — four data points.
Don't chase them.

## 1. ▶ THE NEW ARC — Max's words, 2026-09-06

> *"even the close star looks no brighter (dimmer in some cases) than stars much farther away; we have
> to reconsider how apparent magnitude functions at this resolution"*

and, still open from the same message:

> *"[the billboards are] still illegible [against the starfield]"*

**One problem, two faces.** At 240p a star cannot encode magnitude with SIZE — everything collapses
to one or two pixels — so brightness has to carry it, and the brightness range available is small.
Planet/moon billboards are deliberately dimmer than stars (`PlanetBillboard.js` 1.2× HDR vs
StarFlare's 1.8×), which worked when the starfield was sparse and is now lost in it.

⭐ **This is a DESIGN question, not a bug hunt.** How does a fifth-generation-console starfield say
"this one is close" when every star is one pixel? The answers the era actually used are worth
looking at before inventing one: brightness tiers, colour, a 2×2 cluster for the brightest, a cross/
flare sprite reserved for the nearest few.

## 2. ⭐ THE ONE CONCRETE LEAD, ALREADY LOCATED — do this first

Max: *"close stars look the same"* (i.e. still checkerboarded) after the dither-authority fix landed.

**`src/rendering/sky/StarfieldLayer.js:336` is the ONE dither site that never got the fade.**

```glsl
if (solid < 0.5 && shape < cutoff * 0.5) discard;
```

Every other stipple — nebula, glow, StarFlare, PlanetBillboard, StarRenderer — now mixes its
threshold toward 0.5 via `ditherAuthority = 1.0 - smoothstep(3.0, 4.5, <scale>)`. StarfieldLayer
instead got a *different* fix (the `solid` bypass), which only spares **small** stars. `solid`
approaches 0 as a star gets large, so a close star takes the **full Bayer stipple across its whole
disc** — exactly what he is seeing. Give it the same `ditherAuthority` treatment as the other five.

## 3. WHAT SHIPPED THIS SESSION — read the commits, not a summary

`git log --oneline 92df203..HEAD` — 11 commits, each with the measurement in its message. Do not
re-derive; the reasoning is in the commit bodies and in the code comments at the sites.

Load-bearing outcomes:
- **The inventory** (`docs/FEATURES/rendering-scale-seven-surface-INVENTORY.md`) — §8-11 carry the
  sourced era bar (all three machines: 320×240, 15-bit) and my recommendations. **Max has ruled on
  most of them since; the doc predates those rulings.**
- **Two new shared uniform objects**, same pattern and same argument as `posterizeLevels.js`:
  `src/rendering/pixelScaleUniform.js` (world) and `src/rendering/skyPixelScale.js` (sky). Every
  dither cell and every star point size now reads one of them. ⛔ **Two objects, not one** — the sky
  and the world are separate buffers with separate divisors, by Max's ruling.
- **Settings**: `Pixel Scale` (1–8, step 0.5) and a new `Sky Pixel Scale`, both labelled with the
  setting AND the buffer they produce; sky names `= WORLD` when the two match. `Color Depth` slider
  added (the setting had shipped in August with no control at all).

### ⭐ MAX'S RULINGS THIS SESSION — treat as settled
1. **240p is the target.** *"I do like the 240p the most I think."*
2. **31 / RGB555 stays.** Never in question; the number was already his and already correct.
3. **Framebuffer-wide quantisation: OFF.** He said yes, I measured the cost, he said off. `]` still
   toggles it. Reason in `RetroRenderer.js`'s `uQuantizeAll` block — it re-bands the emissive terms
   `planetShaders.glsl.js:203` deliberately exempts.
4. **The sky at the world's resolution is fine** — the first attempt only looked bad because of a
   `gl_PointSize` bug. He is actively using `Sky Pixel Scale`.
5. **Sol is an easter egg, NOT a priority.** Its 16 textured bodies are still unwired at 8 levels.
   Do not spend time there.

## 4. ⛔ TRAPS — carried, plus what cost time THIS session

Carried, still live: 10 (`cd` moves cwd — absolute paths) · 15 (`namespacedFloat`, not a fresh
`SeededRandom`) · 16 (repair citations by SYMBOL, never by bumping the integer) · 17 (`git add -A`
once committed 705 PNGs) · 18 (**a liveness probe can itself be vacuous**) · 24 (stale worktree
double-runs a file invoked by path; `--dir tests` is unaffected) · 25 (**a reload can report success
and still carry contamination**) · 26 (read the unit before the number) · 27 (an opacity is not an
area) · 28 (a citation can point at nothing) · 29 (lab presets are archetypes).

### NEW — each of these cost real time
30. ⭐⭐⭐ **`esbuild` WITHOUT `--bundle` DOES NOT RESOLVE IMPORTS.** I ran "parse ok" five times over
    a file that used `SKY_PIXEL_SCALE` with no import, shipped it, and it threw
    `Uncaught ReferenceError` at module scope — which **emptied the entire sky scene**
    (`getSkyScene().children` was `[]`: no glow, no nebulae, no starfield). Max saw it before I did.
    **Always `--bundle`, and always check the browser console after a shader/uniform edit.**
31. ⭐⭐⭐ **BACKTICKS INSIDE A GLSL TEMPLATE LITERAL TERMINATE THE STRING.** I did this THREE times in
    one session (`` `shape` ``, `` `result` ``, `` `floor(...)` `` inside `/* glsl */ \`...\``). The
    error surfaces as a nonsense JS parse error like `Unexpected identifier 'result'`. **Use quotes
    in shader comments.**
32. ⭐⭐ **A METRIC THAT MEASURES THE WRONG THING READS PLAUSIBLE.** Twice: (a) a flicker metric
    counting pixels that toggled between frames read ~95% at EVERY resolution, because rotating the
    camera MOVES stars — it measured motion, not flicker; counting stars per frame and taking the
    coefficient of variation separated them. (b) an alternation metric meant to prove the
    checkerboard was gone moved only 24%→20%, because it is dominated by the starfield — an isolated
    one-pixel star IS a local spike. **State plainly when a metric is not evidence.**
33. ⭐⭐ **`scrollWidth === clientWidth` CANNOT SEE OCCLUSION.** I "verified" the settings readout was
    unclipped, and it was — but `.settings-panel` had `padding: 12px 0` and the scrollbar drew over
    the rightmost column. Max: *"still gets cut off by the scroll bar."* Ask "is the box under
    something", not "does the text fit its box".
34. ⭐⭐ **`gl_FragCoord` AND `gl_PointSize` ARE IN BUFFER PIXELS, NOT SCREEN PIXELS.** Both bit hard.
    A hardcoded `/ 3.0` dither cell is 13.5 SCREEN px at scale 4.5; an absolute `gl_PointSize` makes
    a star 3× BIGGER when drawn into a 1/3 buffer. Anything sized in pixels must divide by the scale.
35. ⭐ **A `visible = true` WRITE DOES NOT SURVIVE A FRAME** if something re-derives visibility each
    render. Four sites set the glow visible without clearing `_hiddenForTitle`; `RetroRenderer.js:1016`
    clobbered them every frame. **Set the field the renderer actually reads.**
36. ⚠ **A dynamic `import()` in the page may hand you a SECOND module instance.** Identity checks
    against it then read as "not shared" when the app is internally fine. Test that the APP's own
    materials share one object with each other, not with your probe.

## 5. ⭐ WORKING WITH MAX — what this session demonstrated

- ⭐⭐⭐ **HIS EYE FINDS THE CLASS OF BUG, NOT JUST THE INSTANCE.** *"These dithering effects were not
  designed for this resolution"* was the correct diagnosis and it retired my fix (cell SIZE) in
  favour of the right one (dither AUTHORITY). *"What is sky resolution 3?"* was a bug report about a
  control whose name and number ran in opposite directions. **Answer the observation with a
  mechanism, and be ready for the mechanism to invalidate what you just shipped.**
- ⭐⭐ **HE SAID YES, THEN OFF, AND BOTH WERE RIGHT.** Composite quantisation — I sold it as a free
  win, measured it, and it wasn't. **Recalculate the recommendation out loud when the evidence moves;
  he changes his mind on evidence and expects the same.**
- ⭐ **ASK IN HIS UNITS.** "Try Sky Pixel Scale 4.5" named a number the UI never displayed. He
  answered: *"There is no measurement that says 4.5 only ratios like 630x323."* The fix was to print
  the setting AND name the relationship (`= WORLD`), not to explain the divisor better.
- **He is testing live while you work.** Settings in `localStorage` change under you mid-session.
  ⛔ **Do NOT reset his stored settings** — read them, don't write them.
- **One line per ask, recommendation stated.** He answers tersely and in order: *"1 that's better;
  2 Yes, off; 3 yes"*.

## 6. FIRST FIVE MINUTES

1. `docs/NOW.md` top entry, then this file.
2. Capture the test baseline (§0) **before** touching anything.
3. **Fix `StarfieldLayer.js:336` (§2)** — it is located, small, and closes his "close stars look the
   same".
4. Then open the actual arc: **how magnitude reads at 240p** (§1). That is a design conversation with
   him, not a fix to go and make. Put options in front of him in the live game, on a bare key,
   while moving.
5. ⚠ `~/.claude/state/dev-collab/active-workstream.json` already points at `rendering-scale-aesthetic`.

## 7. Suggested skills

- **`superpowers:brainstorming`** — §1 is a genuine design question ("how should apparent magnitude
  work at 240p"), not an implementation task. Brainstorm with Max before writing shader code.
- **`superpowers:systematic-debugging`** — if the §2 fix does not resolve the close-star stipple.
- **`dev-collab-scope`** — only if the magnitude work grows into a multi-system feature; a
  StarfieldLayer brightness law alone does not meet the threshold.
- **`library-context`** — a SessionStart hook reports no cached three.js brief for this project and
  r183/r184 capabilities may be invisible. Worth running once.
- ⛔ **NOT `verify-workstream`** — there is no contract for this arc.

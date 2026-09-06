# chrome-and-ui-at-240p — the reconciled batch plans

> ⚠ **PERSISTED INTO THE REPO ON PURPOSE, 2026-09-06.** These are the reconciled outputs of two
> planning workflows. They lived only in `/tmp` task-output files, which do not survive a WSL
> restart — and they are the difference between the next session applying a verified plan and
> re-deriving one. Contract and intent: `docs/WORKSTREAMS/chrome-and-ui-at-240p/`.
>
> ⭐ **EACH PLAN WAS ADVERSARIALLY ATTACKED BEFORE IT LANDED HERE.** The attack phase materially
> changed both — it downgraded the world orbit rings to "no change needed", and it killed three
> defects in the batch-2 type scale including one that would have frozen all four cockpit screens.
> Treat the numbers as checked, but re-verify any anchor before applying it: line numbers drift.

---

## BATCH 1 — orbit lines, minimap, HUD, reticle

Read the contract, the intent, and every file the four plans touch. Here is the resolved application order.

---

# BATCH 1 — APPLICATION ORDER

## 0. THE ONE INCOMPATIBILITY, NAMED AND PICKED

Two surfaces asked for **different mechanisms for the same thing** — getting a 2D overlay onto the world's pixel grid:

| | HUD plan | Reticle plan |
|---|---|---|
| Where the canvas lives | one offscreen canvas owned by `RetroRenderer`, uploaded as a `CanvasTexture` and mixed inside the composite | the existing DOM canvases, backing store resized to the world buffer, CSS-stretched with `image-rendering: pixelated` |
| Gets grain / quantise / palette | yes | no |
| Composite shader touched | yes (new uniform pair + branch) | no |

**They are not rivals. They are stage 1 and stage 2 of one change, and stage 2 is a strict superset of stage 1.** Both require: canvas at buffer size, every constant re-denominated in buffer px, integer snapping, bitmap text, cabin mask at buffer resolution. The only delta from the reticle plan's mechanism to the HUD plan's is: don't append to the DOM, add one uniform pair, one composite branch, and move the clear. About six edits.

**The pick:** land the reticle plan's mechanism as steps 4–5 (it closes AC-6 on its own), then the HUD plan's compositing as step 6, **separately gated**. Reasons, in order:

1. **AC-6's observable is closed by stage 1 alone.** "share the world's pixel grid rather than being drawn crisp on a DOM canvas at device resolution over it" — a DOM canvas at *buffer* resolution is not at device resolution. Stage 2 is not needed for the AC; it is needed for AC-9, which is Max's eye and no agent's verdict.
2. **Stage 2's two headline justifications are weaker than the HUD plan assumed, and I checked.** `uQuantizeAll` defaults to **0** (`RetroRenderer.js:358`) — the framebuffer quantise is a debug A/B on a keypress (`main.js:13499`), not the shipped state. And the quantise delta on the HUD's own inks is imperceptible anyway (`#9fe8ff` = 159,232,255 → 156,230,255 on the 31-level lattice). The palette is a real setting but a niche one.
3. **The one justification that survives is grain, and it is genuinely visible.** `uGrainStrength` defaults to 0.045 and the grain runs at *screen* resolution (`gl_FragCoord.xy`, `RetroRenderer.js:876`). So every fat world pixel has fine noise inside it and a stage-1 overlay's fat pixels would be flat and clean. That is exactly the "chrome sitting on top" reading AC-9 judges. So stage 2 should land — but last, and revertible on its own.
4. **Stage 2's failure modes are loud, not silent** (upside-down HUD = `flipY`; invisible HUD = branch not firing), so gating it costs nothing.

Precedent worth knowing before you argue stage 2 is mandatory: the cockpit is composited **after** the grain (`RetroRenderer.js:884` vs `:875-882`), so the cabin has no grain either, and Max has already accepted that.

---

## 1. THE SHARED PLUMBING, RESOLVED — stated once

### P1 · NEW FILE `src/rendering/renderBuffer.js`

Three consumers need the world buffer's dimensions and none of them should re-derive it: `TargetingReticle`, `SupercruiseHud`, `cabinMask`. Built on the `pixelScaleUniform.js` / `posterizeLevels.js` pattern — a shared **mutable** object, handed over, never copied, because all three are constructed once at boot and would otherwise strand on the constructor's value.

```js
import { bufferForLines, RENDER_LINES_DEFAULT } from './renderLines.js';
export const RENDER_BUFFER = { width: 0, height: 0, scale: 1 };
export function setRenderBuffer(width, height, scale) { /* finite/≥1 guard, then assign */ }
export function resolveRenderBuffer(windowWidth, windowHeight) {
  if (RENDER_BUFFER.width >= 1 && RENDER_BUFFER.height >= 1) return RENDER_BUFFER;
  return bufferForLines(windowWidth, windowHeight, RENDER_LINES_DEFAULT);
}
```

`resolveRenderBuffer` exists so consumers that may run before the first `resize()` (the lab, a test host) get a real buffer instead of a 0-dimension one — a throwing canvas in 2D. One import per consumer instead of three copies of `bufferForLines` + `RENDER_LINES_DEFAULT`.

**Exactly one writer**, and it is the line the file exists to sit beside.

### P2 · `RetroRenderer.resize()` — THREE coordinated changes, ONE pass

The minimap surface and the reticle/HUD surfaces both edit this function. Apply in this order or the portrait branch is one resize stale:

**(a) HOIST the orientation block.** Cut `RetroRenderer.js:989-1000` (the `// Adjust HUD position/size based on orientation` comment through the closing brace of its `else`) and paste it immediately after `this.renderer.setSize(width, height, false);` (`:940`), substituting `this._compositeMesh.material.uniforms.hudRect.value.set(...)` for `u.hudRect.value.set(...)`.
⛔ Do **not** also hoist `const u` (`:982`). The moved block can address the uniform directly; hoisting `u` reorders lines around the cockpit target that batch 2 owns, for nothing. `_compositeMesh` exists from `_setupComposite()` at `:118`, before `resize()` at `:120`.
*Why:* `_hudFrac` is currently assigned at `:994/:998`, **after** the `hudTarget` allocation at `:969`. Harmless while `_hudSize` is a constant; the moment (b) reads `_hudFrac`, the first resize on a portrait phone allocates against the landscape 0.255 seeded at `:91`.

**(b) DERIVE `_hudSize`.** Insert one line immediately before `RetroRenderer.js:969`:
```js
this._hudSize = Math.max(8, Math.round(this._hudFrac * renderWidth));
```
Leave the allocation itself alone — it already reads `this._hudSize`. Change `:90` to seed `0` with a comment saying it is derived.
Use `renderWidth` (the local at `:931`), **not** `world.width`: trunk's divisor-era `resize()` also names a local `renderWidth`, so the edit survives the lane-A/master merge.
*Derivation:* the shader computes `hudH = hudRect.w * aspect` (`:723`) against a window-sized `resolution` (`:987`), so the HUD is a **square of side `_hudFrac × windowWidth`**. The world buffer is `renderWidth` px across that same width. Therefore `_hudFrac × renderWidth` is that square measured in world buffer pixels — parity by construction, on every window, every aspect, every line count.

**(c) WRITE the shared buffer.** Add immediately after `setPixelScale(world.scale);` (`RetroRenderer.js:938`):
```js
setRenderBuffer(world.width, world.height, world.scale);
```
plus the import beside `:7`. It sits there for the reason `:933-936` already gives: `resize()` is the only place that knows both the setting and the window, and a second derivation is what produced the 13.5 px checker.

**(d) NOT HERE.** `cockpitTarget` at `RetroRenderer.js:976` is the only target in `resize()` that skips `bufferForLines()`. That is **AC-1, batch 2**. Leave it. It is independent of (a)–(c) — no interleaving, no conflict — but batch 2's agent must know (b) inserted a line above their allocation.

### P3 · NEW FILE `src/rendering/PixelText.js` — ONE glyph set for the whole game

`GLYPH_W=3, GLYPH_H=5, ADVANCE=4`, integer scale, `fillRect` only, uppercase, frozen map of 5×3-bit row masks. Nothing like it exists in `src/` today (`PhosphorScreen` uses real fonts; `NavComputer._drawStarGlyph` is a star symbol).

Must cover **by name**: A–Z, 0–9, space, `.` `,` `:` `/` `-` `%` and **U+2014 EM DASH** (`AlertCue.test.js:272-289` pins `'TOO CLOSE — SUBLIGHT ONLY'` to exactly one U+2014; `withThousands` in `SpeedFormat.js:27-35` inserts commas).

⭐ **A correction to both submitted plans: the missing-glyph policy cannot be one policy.** The HUD draws fixed literals — a missing glyph there is a bug and should throw. The reticle draws **procedurally generated body names**, and a throw in that draw path takes the whole reticle layer down, which is precisely the failure `TargetingReticle.js:386-397` wraps the mask source to prevent. So: `drawPixelText(ctx, str, x, y, { color, scale=1, align='left', onMissing='throw' })`, and the reticle passes `onMissing:'tofu'` (draw a filled 3×5 box).

Also export `measurePixelText(str, scale) = str.length * ADVANCE * scale - scale`.

⛔ Batch 2's cockpit panels have the identical problem at a different buffer size (`PhosphorScreen.js:195-217`, body tier 2.9 buffer px, label 2.4). **Do not let a second glyph set exist in this repo.** If batch 2 needs a bigger face, add a 5×7 set to this module.

### P4 · WHAT NOBODY NEEDS, so it does not get built

- No new export from `renderLines.js`. No new `RetroRenderer` accessor for the minimap — `retroRenderer.hudTarget.height` is already the truth once (b) lands.
- No composite-shader change in steps 1–5.
- **Zero net line-count change in `src/main.js`.** Sourced, not invented: `main.js:199` — *"⛔ RIDES THIS LINE: main.js carries ~700 line-anchored citations."* Every `main.js` edit below is text-within-an-existing-line.

---

## 2. THE ORDER

Cheapest and least-risky first; each step independently verifiable live.

### STEP 0 — the world orbit rings: **NO CHANGE.** (5 min, read-only)
See §3. Optionally land four comment-only edits (§3, "stale prose"). No AC depends on them.

### STEP 1 — `RetroRenderer.resize()` plumbing: P2 (a)+(b)+(c). **Closes AC-5's minimap clause.**
Three edits, one file, one pass. (c) is inert until step 4 — say so rather than pretending it is verified; its liveness probe arrives at step 4.
**Visible consequence, immediately:** the minimap's buffer drops 320 → 119 at 240p and its orbit rings go from a 1.76-screen-px hairline to a 4.7-screen-px chunky line matching the world's conic band. That *is* the AC. Its sprites become tiny — step 2 fixes that.
**Verify:** V1 below.

### STEP 2 — `SystemMap` legibility redesign. Depends on step 1.
Isotropic frustum (`SystemMap.js:49-50`, `vFrustum = e * 1.2`), a `bufferPx` fifth argument to `update()` fed from `retroRenderer.hudTarget.height` (one-line edit at `main.js:13167`), a `_applyPixelFloors()` that recomputes every sprite scale from `this.extent` + `this.planetMapData` (so the three build sites at `:150/:156/:168` stay untouched), an absolute 1-buffer-px focus rim in place of the 1.35× ratio (`SystemMap.js:306-307`), a pixel-art chevron Sprite replacing the flat `ShapeGeometry` triangle (`:180-208`), Nearest filtering + an 8×8 hard disc on the shared `_circleTexture` (`:228-240`), and the stale-`320²` prose sweep.

Two corrections carried from the attacked plans, both load-bearing:
- The isotropic frustum is a **hard precondition** for the sprite pointer, not a nicety: three's sprite shader scales in view space, rotates, *then* projects (`sprite.glsl.js:27/29-31/35`), so an anisotropic frustum **shears a rotating glyph**.
- The rotation is `this._camPointer.material.rotation = -mainYaw - this._mapYaw;` — **same sign**, no negation (replacing `SystemMap.js:294`).
- `_pxToWorld` divides by `_bufferPx`; the `_bufferPx === 0 → return 0` guard is **not optional** — without it a dropped plumbing edit gives `Infinity` scales and a blown-out map.
- ⛔ Do not touch `NavSource.test.js:226/231` — that 320 is the cockpit nav canvas, batch 2.

**Verify:** V2.

### STEP 3 — `src/rendering/PixelText.js`. Pure module, zero integration.
Verified by unit test, not the live game, and I will not dress that up as a live check. Add a small spec file asserting: every required codepoint present, `onMissing:'throw'` throws, `onMissing:'tofu'` does not, `measurePixelText('ABC',1) === 11`.

### STEP 4 — `SupercruiseHud` onto the world buffer. **Closes AC-6's HUD half.** Depends on P1 + step 3.
- Delete `_resize()` (`SupercruiseHud.js:35-41`) and its `window.addEventListener('resize', ...)`; replace with a `_syncBuffer()` that reads `resolveRenderBuffer(...)` and sets `canvas.width/height` to the buffer, `canvas.style.width/height` to the window. Call it from a window `resize` listener **and** as the first statement of `update()` — the Resolution setting changes the buffer with **no window resize at all** (`main.js:6268-6271`), so a listener alone strands the canvas at the previous resolution.
- Add `#supercruise-hud` (give the canvas an id) to `src/style.css` beside the `#canvas` rule with `image-rendering: pixelated; image-rendering: crisp-edges;` — **same two declarations, same order** as `style.css:22-23`. ⛔ Not inline in JS and not in the reverse order; a browser supporting both could otherwise resolve the world and the overlay to different resampling.
- Convert **all eleven** `innerWidth`/`innerHeight` reads (`SupercruiseHud.js:37,38,39,46,66,69,125,133,138,173,207,272`) to `this._w`/`this._h`, read fresh off the canvas each frame. `_project` at `:46` is the one most easily missed — left on `innerWidth` the at-the-body cue lands ~4.7× off-screen.
- `cx = Math.round(this._w/2), cy = Math.round(this._h/2)`; **delete** `c.lineWidth = 1` (`:70`) and every `stroke()`/`beginPath()` — a 1-px stroke at an integer coordinate straddles it and lands as two half-covered grey rows, a 9-screen-px smear where one texel was intended.
- Redesign in buffer px: `lx = 6`, `barW = 60`, bars **filled two-tone 4 rows tall** (a stroked rect 2 tall has no interior), pins/ticks as 1×4 `fillRect` columns, reticle as four 4×1 arms with a 3-texel gap, deflection dot as a 3×3 `fillRect`, `jr = Math.min(this._w,this._h)*0.25`.
- Every string through `drawPixelText` at **scale 1** (5-row cap = 23.5 screen px, ~1.5× today's). ⭐ I am *not* recommending the submitted plan's `scale: 2` speed number on the first landing: it makes the cap 47 screen px, 3× today's, and the whole cluster only draws in ORRERY or on a GLB failure anyway (`showReadouts: !_cockpitReplaces('DRIVE')`, `main.js:13112`). Scale 2 is the named lever if Max says the speed does not read.
- ⛔ Do not shorten the three alert strings. **Clamp** the drop cue instead: `Math.max(2, Math.min(p.x + 4, this._w - measurePixelText(s,1) - 2))` — `'SAFE TO DROP'` goes from ~20 buffer px wide to 47, so near the right edge it runs off, and that is a readout the pilot flies with.
- **Three test edits, all required or the suite goes red** (baseline measured just now: `SupercruiseHud.readouts.test.js` + `AlertCue.test.js` + `cabinMask.test.js` = 6 files / 58 tests, all green):
  - `SupercruiseHud.readouts.test.js`: `rec.text` is filled only from `fillText`/`strokeText` (`helpers/headlessNav.mjs:53-55`), so bitmap text empties it and 5 of 6 `it` blocks fail. Add a single private `_text()` wrapper + `getDrawnText()` (⛔ a wrapper, **not** a `push` beside each call — two adjacent statements drift).
  - Same file, `:111-113`: replace **both** the `arc` and the `lineTo` assertions with exact geometry against the fixture's own numbers (canvas 1920×1080 → cx 960, cy 540, jr 270, deflection {0.1,−0.2} → `fillRect(986, 485, 3, 3)`). ⛔ A colour filter is impossible: `makeRecordingContext`'s Proxy has `set() { return true; }` (`headlessNav.mjs:76`), so `fillStyle` is never recorded.
  - Same file, `:118-125`: this case runs `showReticle:false, showReadouts:true`, so a naive `arc`→`fillRect` swap makes the `toBe(0)` assertion **fail** — the cluster draws many fillRects. The discriminator must be reticle-**specific** (the two coordinate regions above).
  - `AlertCue.test.js:266`: widen to `(?:fillText|drawPixelText)\(...` with an optional leading-argument group. ⛔ Do not hard-code the context variable name.

⚠ **Honest weakening, flagged not hidden:** `getDrawnText()` is a class self-report where the file's own header (`:15-19`) insists it asks the *context* what it drew, "because this lane's source scans were proven evadable seven ways". Mitigations: the single wrapper, `onMissing:'throw'` on the HUD's path, and the reticle assertions staying at the glass. The strictly stronger option — decoding strings back out of the recorded fillRects via PixelText's exported glyph table — is ~30 lines if you want to pay for it.

**Verify:** V3.

### STEP 5 — `TargetingReticle` + `cabinMask` onto the world buffer. **Closes AC-6's reticle half.** Depends on P1 + step 3. Independent of step 4.
- `#targeting-overlay` gets the same `style.css` `image-rendering` pair.
- `_resize()` (`:172-180`): `canvas.width/height` = the buffer; **keep** `_cssW`/`_cssH` exactly as they are (they now mean "the CSS extent" and only the probe reads them) and **add** `_bufW`, `_bufH`, `_magX = w/_bufW`, `_magY = h/_bufH`. ⛔ Do not rename `_cssW/_cssH` away and reconstruct the CSS extent as `_bufW * _magX` — a float round-trip that makes the probe's `canvasW` 2204.999….
- Per-frame resync after `this._lastFrame.maskAppliedAt = 0;` (`:292`): `if (RENDER_BUFFER.width !== this._bufW || ...) this._resize();`
- `PX = 3` → `PX = 1` (`:65`); the constant block (`:49-62`) re-denominated **and redesigned**: `BRACKET_MIN_HALF 6`, `MARGIN 3`, `EDGE_MARGIN 8`, `ARM_LEN 4`, `THICK_TENT 1`, `THICK_SEL 2`, `GHOST_HALF 4`, `GHOST_ARM_LEN 3`, `GHOST_THICK 1`. At 240p there are exactly two representable stroke weights, so selected-vs-tentative must be carried by 2-vs-1 — today both quantise to 3 CSS px (`round(3/3)=1` and `round(4/3)=1`) and **only alpha has ever separated them**.
- ⭐ **Seven sites the submitted plan for this surface got right and the earlier one missed entirely** — without them the change is worse than no change: the two viewport clamps in `_drawTarget` (`:459-460`), the two in `_drawShipReticle` (`:504-505`), `halfW/halfH` in the off-screen chevron (`:567-568`), the cull margin (`:195`, 200 CSS → 42 buffer), and `_projectedPixelRadius`'s `this._cssH * 0.5` (`:211`).
- ⭐ **A latent defect that only fires now.** `fillRect(bx - (sx > 0 ? 0 : t - PX), ...)` (`:243` and `:252`) is symmetric only when `t === PX` — always true until today. At `PX=1` with a 2-px selected stroke the square becomes `2h+3` wide and half a pixel off centre. Fix both sites to `bx - (sx > 0 ? t : 0)`: thickness grows **inward** from the outer corner, so the square's boundary is `[cx-h, cx+h)` regardless of `t`.
- `vx = ox + sx * PX` (`:251`, indented **eight** spaces) is one block *outward*, contradicting its own comment and the ASCII art at `:220-224`. → `vx = ox - sx * t`.
- Delete `ctx.scale(this._dpr, this._dpr)` at **four** sites (`:430, :466, :510, :581`) — each needs its own multi-line anchor; the bare line is not unique.
- Integer centre snap at the top of `_drawBrackets`.
- Label: route `_drawNameBelow` (`:262-270`) through `drawPixelText` at scale 1 with `onMissing:'tofu'`. This **removes the Google-Fonts dependency** for the label entirely (`index.html:10`, `display=swap`, no local font file) — a proportional fallback at 8 buffer px is a smear, and `fillText` antialiases unconditionally at any size.
- `_recordDraw`: convert on the way **out** so the probe keeps reporting CSS px (`x: screen.x * this._magX`, `bracketHalf: half * this._magY`), and add `bufferW/bufferH/magnification` to `_lastFrame`. Non-negotiable: `integration-suite.js:1103` compares the reticle's `screenSpace` against `SceneInspector`'s, which is `renderer.domElement.clientWidth/Height` (`SceneInspector.js:190-194`) with a ±2 px tolerance, and `main.js:2865-2878` compares the same numbers against synthetic mouse `clientX/clientY`.
- `cabinMask.js:302-304`: size the mask from `RENDER_BUFFER` instead of `innerWidth * dpr`. **Not optional dressing** — `_applyCabinMask` does `drawImage(mask, 0, 0, canvas.width, canvas.height)` with smoothing off (`:410`), so an unchanged full-res mask would be point-sampled down 4.7× at CSS-pixel centres that do not coincide with buffer-pixel centres: a cut that flickers holes along thin ribs.
- `cabinMask.test.js` must land **in the same commit** — `:~210` asserts the old `innerWidth * dpr` regex verbatim and turns red otherwise. Repoint it at `/RENDER_BUFFER\.width/`.

**Verify:** V4.

### ⛔ STEP 6 IS ON HOLD — ITS HEADLINE JUSTIFICATION IS NOT DELIVERED BY ITS OWN SPEC (found 2026-09-07)

Read this before starting step 6. Steps 4 and 5 are landed and green, so its gate is MET; the hold is
about the spec below, not about the gate.

**§0 point 3 argues the one surviving reason to composite is GRAIN** — "`uGrainStrength` defaults to
0.045 and the grain runs at *screen* resolution, so every fat world pixel has fine noise inside it and
a stage-1 overlay's fat pixels would be flat and clean. That is exactly the 'chrome sitting on top'
reading AC-9 judges." It also establishes that the quantise justification is near-dead
(`uQuantizeAll` defaults to 0) and the palette one is "a real setting but a niche one".

**Edit 4 then places the branch where the grain cannot reach it.** Verified in the source, not the
prose — `RetroRenderer.js`: grain `:883`, cockpit `:898`, `// ── THE FRAMEBUFFER ──` `:907`,
`applyPalette` `:916`. The instruction is to insert "immediately after the `result = mix(result, c,
cockpit.a);` block's closing brace and before the `// ── THE FRAMEBUFFER ──` comment", i.e. at ~`:906`
— **after** the grain block. Edit 4's own ⛔ note says as much and accepts it, because the branch is
meant to travel with the cockpit when batch 2 moves it above the grain.

**So step 6, landed today, delivers the PALETTE and the framebuffer quantise, and NOT the grain.**
That is the small half of its own argument, bought at the full structural price: two DOM canvases
removed, a shared-canvas mode added to two classes, the flipY and clear-ordering coin-flips taken,
`body.hud-hidden #targeting-overlay` (`style.css`) turned into dead CSS, and `LabMode.js:72`'s
`'targeting-overlay': '#targeting-overlay'` registration left resolving to nothing.

**Recommendation: fold step 6 into batch 2 and land it in the same commit that moves the cockpit
above the grain.** Then the branch is written once, in its final position, and the grain arrives with
it — which is the outcome §0 point 3 actually wanted. Nothing about AC-6 waits on this: AC-6 is closed
by steps 4 and 5, live-verified.

⚠ If it is landed early anyway, the ⛔ in edit 4 becomes load-bearing rather than advisory: left
behind when the cockpit moves, the cabin gets grain and the chrome does not — a NEW seam of exactly
the kind AC-9 judges, which is worse than today's.

---

### STEP 6 — GATED. Composite the overlay. Closes the grain/palette seam. Depends on 4 **and** 5 both green.
Six edits, all revertible on their own:
1. In `resize()`, after the hudTarget block: create **one** offscreen canvas at `renderWidth × renderHeight` (never appended to the DOM), re-fetch its 2D context and re-set `imageSmoothingEnabled = false` after every resize (a canvas resize resets context state), and on first creation only make a `CanvasTexture` with Nearest/Nearest, `generateMipmaps = false`. Leave `flipY` and `colorSpace` at their defaults. Expose `getOverlay() → { canvas, ctx }` returning **live references only, no dimensions** (they go stale).
2. `u.overlayTexture.value = this._overlayTexture;` beside `RetroRenderer.js:985`.
3. Uniform pair `overlayTexture` / `overlayEnabled` after `hudEnabled` (`:358` region) + their GLSL declarations after `uniform float hudEnabled;`.
4. Composite branch **immediately after** the `result = mix(result, c, cockpit.a);` block's closing brace and **before** the `// ── THE FRAMEBUFFER ──` comment: `if (overlayEnabled > 0.5) { vec4 ov = texture2D(overlayTexture, vUv); result = mix(result, ov.rgb, ov.a); }`.
   ⛔ **It must stay adjacent to the cockpit branch.** When batch 2 moves the cockpit above the grain block, this moves with it and the HUD gains grain for free. Left behind, the cabin gets grain and the HUD does not — a new seam of exactly the kind AC-9 judges.
5. `needsUpdate = true` + `overlayEnabled = 1` just before `// Pass 4: Composite` (`:1098`); the **one clear** immediately **after** `r.render(this._compositeScene, this._compositeCamera);` (`:1101`). ⭐ After, not before: `needsUpdate` copies nothing — three uploads the canvas while binding the material inside that `render()`. Clearing first publishes an empty overlay. Clearing after also closes the gallery stale-frame case for free (`main.js:12906` early-returns from `renderFrame` while `:11289` still calls `render()`).
6. Both classes take an **optional** second constructor argument (`main.js:401` and `main.js:399`, one-line edits each, zero net lines). When present: adopt the shared canvas, skip the DOM append, and make `_clear()` a no-op that still stamps `lastClearAt`. When absent: today's own-canvas behaviour, which keeps every test fixture unchanged.
   ⛔ **Draw order is load-bearing and must be commented at both ends.** `TargetingReticle._applyCabinMask` erases with `globalCompositeOperation = 'destination-out'` across the whole canvas (`:404-413`). The reticle must draw **and erase** before the HUD draws — which is today's order (`main.js:13046` then `:13068`) and today's zIndex 50-then-51. Reversed, the cabin mask eats the HUD.

⚠ **Two coin-flips that die to one screenshot, not to reading.** `flipY`: the composite's `vUv = uv` on a `PlaneGeometry(2,2)` (`:302/:375`) puts vUv.y=0 at the screen **bottom** and a 2D canvas has y=0 at the **top**, so three's default `flipY = true` is what lands them together — an upside-down HUD is this one line, and ⛔ do **not** copy `PanelPointer.js:252`, which sets the opposite for its own inverted panel convention. `colorSpace`: `NoColorSpace`, because this composite is a raw `ShaderMaterial` with no colorspace include anywhere in the file, sitting alongside render-target textures sampled raw.

Also: `body.hud-hidden #targeting-overlay { display: none }` (`style.css:831-834`) becomes dead CSS at step 6. Harmless — `targetingReticle.enabled` is driven from `_hudVisible` at `main.js:12988` and already gates the draw — but note it, and note `LabMode.js:72` registers `'targeting-overlay': '#targeting-overlay'`, which will resolve to nothing after step 6.

---

## 3. WHAT NEEDS NO CHANGE

**⭐ The world's orbit rings. Do not edit `OrbitRingSDF.js`, `OrbitLine.js`, `OrbitConicField.js` or `ringConic.js` for AC-5.** Established, not assumed:

- `OrbitRingSDF` renders **nothing**. Its `.mesh` is `new THREE.Mesh(new THREE.BufferGeometry(), material)` (`:133`) on `ORBIT_PROXY_LAYER = 10` (`:17`, applied `:142`), and its `ShaderMaterial` (`:101-116`) has uniforms only — no vertex shader, no fragment shader. It is a transform proxy plus a param bag. `OrbitLine` adds hover-colour and hit-position shims on top and also draws nothing.
- Every ring is painted by **one** `OrbitConicField` fullscreen pass, added to the **world** scene at `main.js:227`, drawn by `r.render(this.scene, this.camera)` at `RetroRenderer.js:1070` with `sceneTarget` bound at `:1055`. `sceneTarget` is the `bufferForLines()` allocation at `:958`, Nearest/Nearest. **The rings are already in the world buffer.**
- The shader works in `vec3 p = vec3(gl_FragCoord.xy, 1.0)` (`OrbitConicField.js:244`) — literally sceneTarget pixels — and every knob is in those units. `grep -n 'innerWidth|innerHeight|devicePixelRatio|getBoundingClientRect'` across all four files returns **nothing**.
- The stroke is a 1.0-buffer-px opaque core inside a 2.0-buffer-px reach (`uPixelWidth = 1.0`, `uFeatherPx = 0.5`, `:394`), so it tracks magnification exactly at every setting — 4.71 CSS px at 240p, 7.85 at 144p, 1.57 at 720p. That is the definition AC-5 asks for.
- It picks up a resolution change for free: `main.js:13180` re-reads `retroRenderer.sceneTarget` every frame.
- ⚠ The brief's guess was right but its reasoning is dated. `OrbitRingSDF.js:65-72` is **past tense** — the SDF coverage band that "beat the 1/3-res LineLoop dropout" was deleted by orbit-ring-conic Slice D. The live renderer is a later rewrite that reaches the same answer.
- `npx vitest run src/objects/__tests__/` → 14 files, 204 tests, green. The `ringConic` harnesses pin their own fixed geometry (`ringConic.test.js:15` W=657 H=282), so they are resolution-agnostic.

**The minimap's ring *width* also needs no change.** `LineBasicMaterial` gives a 1-buffer-px GL line (`linewidth` is ignored in WebGL) and the world's conic band is `uPixelWidth = 1.0` render px. Once the buffers match at step 1, 1 px == 1 px. Parity is free.

**Minimap picking and dragging need no change.** `getHudUV` works in screen UV off the `hudRect` uniform (`RetroRenderer.js:172-205`); `hitTest` projects into NDC (`SystemMap.js:356-394`); the drag is `movementX`-based (`main.js:14552`). All buffer-size-blind.

**`SystemMap` and the cockpit NAV panel share no code.** `SystemMap` is imported once (`main.js:49`), constructed once (`main.js:7983`); the cockpit nav panel is `makeNavPainter` (`CockpitRig.js:82`). Nothing in step 2 reaches batch 2.

**`hitTestBodies` needs no change.** `main.js:7232-7236` uses the WebGL canvas's own `getBoundingClientRect`, independent of both overlays.

**No test asserts `_hudSize === 320`.** It appears only at `RetroRenderer.js:90` and `:969`; no test file references `hudTarget`. The `320` in `mainHudSlot.test.js:2/278` is prose.

**Stale prose worth sweeping (comment-only, no AC depends on it):** `OrbitLine.js` header still claims the class *is* an analytic coverage ring "in RetroRenderer's 1/3-res sceneTarget"; `OrbitConicField.js:117`'s `@param` says the same; both cite a resolution scheme that has not existed since the line-count change. Their two hover-highlight line citations (`main.js ~:11127-11138`, `main.js :11210`) are stale — the real block is `main.js:14598-14621`. `SystemMap.js:14` says "LineLoop circles" while `:136` builds a `THREE.Line`. `cabinMask.js:66` claims "nothing else in `src/` touches `layers`" — `OrbitRingSDF.js:142` now does (layer 10; no collision with the mask's 7).

---

## 3.5 ⛔ CORRECTIONS TO THIS PLAN, FOUND WHILE APPLYING STEPS 4 AND 5 (2026-09-07)

The plan held up well; these are the places it did not, recorded so the next reader trusts the rest.
⭐ **Item 2 is the one that reached Max's eyes.** It is a plan instruction that is actively wrong, not
merely imprecise — read it before touching `_drawBrackets`.

1. ⭐⭐ **THE `t - PX` ARITHMETIC IN STEP 5 IS OFF BY ONE.** The plan prescribes
   `bx - (sx > 0 ? t : 0)`, claiming the boundary becomes `[cx-h, cx+h)`. It does — but that is
   `2h` lit columns, `[cx-h, cx+h-1]`, whose centre is `cx-0.5`: asymmetric about the body's centre
   pixel. The correct form is **`bx - (sx > 0 ? t - PX : 0)`** — the same offset the original had,
   moved to the other branch — giving `[cx-h, cx+h]`, `2h+1` columns, centred. Measured live at
   240p: lit columns `[-6..-3]` and `[3..6]` about the centre. The plan's DIAGNOSIS was right
   (thickness anchored outward, so selecting a body widened its square) and its BRANCH was right;
   only the amount was wrong.
2. ⭐⭐⭐ **THE `vx` "FIX" IS WRONG AND IT DESTROYS THE RETICLE'S SHAPE. DO NOT APPLY IT.** The plan
   says `vx = ox + sx * PX` "is one block *outward*, contradicting its own comment and the ASCII art
   at `:220-224`. → `vx = ox - sx * t`." The observation is true and the conclusion is backwards:
   **the outward step WAS the rounding.** It set the vertical arm one block out and one block down
   from the horizontal, chamfering the vertex so the bracket read as the corner of a rounded square.
   The ASCII diagram was the thing that was wrong. Applied as written, each corner becomes a **T** —
   a stem one texel in from the end of a 3-4 texel arm. Max caught it on sight: *"the reticle no
   longer reads like the same shape at all. The shape we're going for is the four corners of a
   slightly rounded square."* ⛔ A plan noting that a comment and its code disagree tells you one of
   them is wrong, NOT which. `_drawBrackets` now states the shape as two explicit rects per corner
   with the `t x t` vertex block left empty, and its diagram is copied from measured output.
3. **The original was not "half a pixel off centre" at PX=1.** It was symmetric and `2h+3` wide —
   it grew outward. The off-centre-by-`PX-1` asymmetry the plan is remembering is real but belongs
   to the historical PX=3 case, where the blocks are anchored top-left.
4. ⭐ **STEP 4 NEEDS FOUR TEST FILES, NOT THREE.** `src/cockpit/__tests__/FlightReadout.test.js`
   source-scans `SupercruiseHud.js` in three places and is not in the plan's list or in V6's fence:
   two bar-mark guards pinning `lx + barW * speedToBarFrac(...)` verbatim, and
   `/fillText\(\s*'SUBLIGHT'/`. All three go red on step 4 as specified.
5. **The off-screen ship chevron needed redesigning, not just re-denominating.** The plan converts
   its `halfW`/`halfH` and cull margin but leaves it a `translate`/`rotate` + `fill()` of a path —
   which antialiases unconditionally, leaving one blurred element on a canvas whose whole premise is
   hard texels. It is now rasterised by hand (`_fillTriangleTexels`), which also keeps the rotation
   continuous rather than snapping to eight directions.
6. **Step 5 does NOT remove the Google-Fonts dependency.** It removes it from the reticle LABEL, which
   is what matters for the draw path. 'Pixelify Sans' still has five users in `src/style.css`, so
   `index.html:10` stays.
7. **AC-MASK-AGREES-WITH-THE-ORACLE cannot be closed on an arbitrary window.** 0.587202 is stated in
   its own contract as measured at "1600x900 CSS (exactly 16:9) … head centred". Coverage moves with
   aspect ratio and head pose, so on a 1.977:1 window it reads ~0.550 with the mask at ANY resolution
   from 41k to 2.3M sampled px. The portable half of the AC is its second clause — agreement with
   same-session `_cockpitOcclusion()` — which held at 0.0063.
8. **V0/V1's predicted numbers assume a 2205x1130 window.** Nothing depends on them; just do not read
   a different window's figures as a failure.

---

## 4. THE LIVE VERIFICATION SCRIPT

Objective assertions only. Drive Resolution from script (`applySettingChange` is not global, but `retroRenderer.renderLines = N; retroRenderer.resize()` is exactly what `main.js:6268-6271` does). Restore to 240 after each sweep. ⚠ **RELOAD before measuring** in any session where `src` was edited — HMR-duplicated module state has faked a reproducible defect in this repo before.

**V0 — baseline, before anything.**
```js
const r = window._retroRenderer;
({ lines: r.renderLines, scene: [r.sceneTarget.width, r.sceneTarget.height],
   hud: [r.hudTarget.width, r.hudTarget.height], mag: r.pixelScale,
   win: [innerWidth, innerHeight], dpr: devicePixelRatio })
```
Expect on 2205×1130 @240p: `scene [468,240]`, `hud [320,320]`, `mag 4.7083`.

**V1 — after step 1. AC-5 minimap clause.** In ORRERY.
```js
const r = window._retroRenderer, out = [];
for (const n of [144,180,240,288,360,480,720]) {
  r.renderLines = n; r.resize();
  const f = r._compositeMesh.material.uniforms.hudRect.value.z;
  out.push({ n, world: +r.pixelScale.toFixed(4),
             hud: +((f*innerWidth)/r.hudTarget.width).toFixed(4),
             buf: r.hudTarget.width });
}
r.renderLines = 240; r.resize(); out
```
**Assert:** `world` and `hud` agree within **1%** at every stop, and `buf` is never 320. Predicted on 2205×1130 — 144p 7.847/7.809 (72), 180p 6.278/6.248 (90), 240p 4.708/4.725 (**119**), 288p 3.924/3.932 (143), 360p 3.139/3.141 (179), 480p 2.354/2.353 (239), 720p 1.569/1.571 (358). Worst error 0.5%. Before the fix the `hud` column is a constant 1.757 and the ratio runs 4.47 → 0.89.
Read `hudRect.z` off the **live** uniform, not the constant, so the check is correct on mobile too.
**Portrait ordering check (this is what edit (a) buys):** `emulate` a 390×844 touch viewport, **RELOAD** (do not rely on a resize event), then `r.hudTarget.width` must be `round(0.35 × 111) = 39` on the **first** frame, not `round(0.255 × 111) = 28`.

**V2 — after step 2.** In ORRERY at 240p.
```js
const r = window._retroRenderer, B = r.hudTarget.height, m = r._hudScene;
const c = r._hudCamera; const V = new (window._scene.constructor.prototype.constructor)
// simpler: read scales directly
r._hudScene.children.filter(o=>o.isSprite).map(s=>({ n:s.name||'', sx:+s.scale.x.toFixed(3), sy:+s.scale.y.toFixed(3) }))
```
**Assert:** (a) every sprite has `sx === sy` (round dots — the isotropic frustum landed); (b) converting each to buffer px via `s.scale.x * B / (2.4 * systemMapExtent)` gives ≥ 3 for planets, ≥ 5 for stars, ≥ 7 for the pointer; (c) sweep 144p ↔ 720p and confirm the scales **move** and then settle — floors bind harder at 144p (B=72), nothing drops below the numbers; (d) `(strokeSize - dotSize)/2` in buffer px equals **1.0** for every planet index, including the smallest (today it is `0.175 × dotSize` = 0.35 buffer px on the smallest rocky world — the focus indicator silently vanishes there).
**Operability, which is why the minimap survives in ORRERY at all:** click-to-jump on the innermost planet and on two adjacent planets, and drag-to-rotate. `pickRadius = 0.2` is a fixed NDC radius (`SystemMap.js:362`) and the isotropic frustum spreads bodies 1.333× further apart in NDC y, so picking becomes slightly more discriminating and slightly less generous vertically.

**V3 — after step 4. AC-6 HUD half.** In ORRERY at 240p (so the full cluster draws — in HELM with a cockpit only the cross, dot and at-the-body cue are on, `main.js:13112`).
```js
const r = window._retroRenderer, h = window._sc?.hud || window._scHud;
({ hudCanvas: [h.canvas.width, h.canvas.height],
   scene: [r.sceneTarget.width, r.sceneTarget.height],
   domCanvases: document.querySelectorAll('canvas').length,
   imgRendering: getComputedStyle(h.canvas).imageRendering,
   canvasImgRendering: getComputedStyle(document.getElementById('canvas')).imageRendering })
```
**Assert:** `hudCanvas` equals `scene` exactly, and stays equal across a 144p→720p sweep **with no window resize**; `imgRendering` string is identical to `canvasImgRendering`.
**Then, at the glass:** cross arms are single fully-opaque texel lines with no grey edge (any grey means a `stroke()` survived); the deflection dot is a hard 3×3 block that steps texel-by-texel as the stick moves; every bar is 4 solid rows with a visible two-tone fill boundary; cap heights measure **5** buffer rows; the mass-lock banner is centred and fully readable with the em dash present as a dash, not a gap. Manoeuvre a selected body to the right edge inside the drop window — `SAFE TO DROP` must stay fully on screen (it is 47 buffer px wide now, up from ~20).

**V4 — after step 5. AC-6 reticle half.**
```js
const o = document.getElementById('targeting-overlay'), r = window._retroRenderer;
const fs = window._reticle.getLastFrameState();
({ overlay: [o.width, o.height], scene: [r.sceneTarget.width, r.sceneTarget.height],
   probeBuf: [fs.bufferW, fs.bufferH], mag: fs.magnification,
   probeCanvas: [fs.canvasW, fs.canvasH], entry: fs.entries[0] })
```
**Assert:** `overlay === scene`; `probeBuf === scene` (**this is `RENDER_BUFFER`'s liveness probe — the first thing that reads what step 1(c) writes**); `probeCanvas` is still `[2205, 1130]` exactly (CSS px, integers, not 2204.999…); sweep 144p→720p **without touching the window** and confirm `o.height` reads 144…720; `entry.bracketHalf / fs.magnification` is an integer.
**Inspection contract:** `await window.__wd.runReticleInspectionTests()` — R1–R6 pass, R3's delta still under 2 px.
**Cabin cut:** `window._cabinMaskCoverage()` must land within **0.02 of 0.587202** — the standing `AC-MASK-AGREES-WITH-THE-ORACLE` gate. ⚠ Re-**measure** this, do not assume it: dropping the sample count from 2.49M to 112k adds ~0.15% sampling noise (well inside 0.02) but thin ribs can gain or lose coverage systematically at a coarse grid. Then sweep a reticle behind a canopy rib in HELM at 240p: a hard one-world-pixel staircase, no flicker, and `getLastFrameState().maskAppliedAt` non-zero.
**Off-screen chevron:** ship scanner on with a ship behind you — a `ui.reticle.ship-offscreen.*` entry in `window.__wd.takeSceneInventory()` (not `ui.reticle.ship.*`), and the chevron visible and tracking as you yaw. Without the `halfW/halfH` and cull-margin edits it is placed ~4.7× outside the buffer and never drawn.
**Symmetry:** magnify a 240p screenshot of a selected reticle — the left and right bracket columns equidistant from the body's centre pixel (this is the `t - PX` defect), and the vertical arm starting one **stroke inside** the horizontal arm's outer end at both weights.

**V5 — after step 6.**
```js
const r = window._retroRenderer, u = r._compositeMesh.material.uniforms;
({ overlay: [r._overlayCanvas.width, r._overlayCanvas.height],
   scene: [r.sceneTarget.width, r.sceneTarget.height],
   enabled: u.overlayEnabled.value, tex: !!u.overlayTexture.value,
   domCanvases: document.querySelectorAll('canvas').length })
```
**Assert:** `domCanvases` **drops by two** versus V0; `enabled === 1` while the HUD is up.
**Then, at the glass:** with a body selected in HELM, the green brackets **and** the HUD's centre cross are on screen **at the same time** (if the brackets vanished, the clear is in the wrong place — that is the whole point of moving it after the composite draw call); switch the palette to GameBoy and the HUD ink goes green **with** the world; press the framebuffer A/B key (`main.js:13499`) and the HUD bands with everything else; enter the object gallery and **no** HUD ink appears over it.

**V6 — regression fence, after every step.**
`npx vitest run src/ui/__tests__/SupercruiseHud.readouts.test.js src/ui/__tests__/AlertCue.test.js src/cockpit/__tests__/cabinMask.test.js` — **6 files / 58 tests, all green** (measured today, before any edit). Plus `npx vitest run tests/render-lines-invariant.test.js` for the line-count invariant.
⚠ **AC-8's stated baseline is stale and I am not going to repeat it.** The contract says "unchanged at 20 across the same 8 files"; `npm run test:baseline --check` already reports drift on this tree before batch 1 touches anything. The honest gate for this batch is narrower: **those 58 stay green, and no newly-red file is attributable to the files listed here.**

---

## 5. WHAT COULD MAKE MAX SAY NO

Every assertion above can pass and he can still reject the picture. These are the specific ways, ranked by how likely they are to be the first thing he says.

1. **The minimap gets 7.2× fewer pixels and he sees it the instant he enters ORRERY.** 320² → 119². Its orbit rings go from a 1.76-screen-px hairline to a 4.7-screen-px chunky line. That *is* AC-5 and it is the single biggest look change in the batch. ⛔ If he judges it unusable, the honest lever is the minimap's **screen fraction** (0.255 → larger buys more buffer px *at* parity), never a finer buffer — a finer buffer is the defect returning.
2. **The reticle gets bigger, and it is not subtle.** Minimum bracket square 56 screen px (was 32), arms 18.8 (was 12), selected stroke 9.4 (was 3), label cap ~2× today. That is the arithmetic of a shape made of 4.708-px pixels — you cannot draw a 3-px line out of 4.7-px pixels. Levers in order: `BRACKET_MIN_HALF 6→5` (kills the selected-state corner gap), `ARM_LEN 4→3`, `THICK_SEL 2→1` (loses the only representable weight distinction; alpha would carry it alone).
3. **The minimap's camera pointer grows from 13×11 to ~33 screen px** — 5.9% of the minimap's width against 2.3% today. Unavoidable: you cannot draw a heading in a 3×2 glyph. Same shot, same judgement.
4. **The HUD's readouts go all-caps.** `formatSpeed` emits lowercase units (`SpeedFormat.js:40`), so the readout becomes `KM/S` / `MM/S` / `C`. They stay mutually distinct and all-caps is period-correct for this generation, but it is a visible decision and it belongs in front of him rather than in a diff.
5. **Sub-pixel motion becomes a staircase, everywhere.** The ghost lock-in animation (`_ghostLockScale` 2.5 over 400 ms) becomes a ~7-step staircase because `half` now rounds to whole world pixels. The reticle no longer glides as a body drifts; it steps. Correct at 240p by definition, and it will read as "jittery" if he is not expecting it.
6. **The off-screen chevron keeps antialiased diagonals.** `ctx.rotate` + `fill()` on a triangle cannot produce a hard edge. It will be the one element on the reticle whose edges are soft while everything beside it is hard. Escalation: quantise `arrowAngle` to 8 directions and draw a pre-baked pixel chevron from fillRects.
7. **At steps 1–5 the HUD and reticle still take no grain and no palette.** With grain at 0.045 running at screen resolution, the world's fat pixels have noise inside them and the overlay's do not. If he says the chrome "sits on top", **that is step 6**, and it is six edits away — do not reach for anything else first.
8. **Mobile portrait is genuinely tight and I am not hiding it.** Parity on a 390×844 phone at 240p gives `round(0.35 × 111)` = a **39-pixel minimap**; at 144p it is **23**. Today it is masked because a 320 buffer is point-sampled *down* 2.34× — so mobile is currently **aliased**, not sharp, and the fix strictly improves the shimmer while making the map coarse. The pixel floors stop things vanishing at 39, but at 23 the pointer alone is 30% of the map. Options if it fails UAT, in order: portrait `_hudFrac` 0.35 → 0.5 (56 px at 240p, but 0.35 was chosen to dodge the mobile menu, so this moves a shipped layout); or drop the backdrop disc and focus halo in the portrait branch. ⛔ Do not solve it by exempting mobile from parity.
9. **Thin canopy ribs may cut less cleanly.** A ~7-CSS-px rib is ~1.5 buffer px and rasterises to 1–2 px, occasionally with gaps. Strictly better than today's half-pixel-offset point-sample (which flickers with head motion), and it is the same rule the cockpit pass will use once AC-1 lands — but it is the resolution doing what resolution does.
10. **The minimap's innermost orbit ring is ~15×12 buffer px** with a 64-segment polyline over it (~0.7 px per segment), so it nearest-rasterises to a lumpy little ellipse. Not a dropout — the world's LineLoop dropout was an edge-on 3D problem the minimap's fixed 35° tilt does not have — but flagging it so it is not mistaken for a bug.
11. **Two things I could not close by reading, only by looking.** (a) The world rings' *continuity at grazing angles* at 240p is **unobserved** — every mechanism argues it is resolution-invariant (Sampson band, extent margin `:282`, front-arc tolerance `:626` all in render px; `CONIC_WCLIP_TIE_EPS = 0.005` relative), but the calibration battery ran at the old divisor default of ~377 lines. Sit in ORRERY, put a ring near edge-on, sweep 144p→720p, watch for it breaking up. The knobs are `setBand({pixelWidth, featherPx})` and `setAngularCutoff()`, both settable, both currently unwired outside the class. (b) `uFeatherPx = 0.5` is a half-buffer-pixel alpha ramp — antialiasing, quantised to the world grid so it does not violate AC-5, but fifth-generation hardware did not do it. If he says the rings still read "soft" or "vector-y", `setBand({featherPx: 0})` gives a hard one-pixel line with no new plumbing. **Do not pre-emptively change either** — that is inventing work against a surface that is already conformant.
12. **Two corrections to the record so nothing is oversold to him.** The moon-ring sub-pixel cull did **not** get 1.57× more aggressive: against Max's *actual* stored setting (4.5 → 240p, old buffer 252 lines) the threshold moved 5.557 → 5.835 mrad, a factor of **1.05**, practically invisible — and it is already the live shipped state, not something this batch introduces. And orbit *click* targeting is narrower than the drawn stroke below ~188 lines: the 6-px click threshold (`main.js:14229`) is under the stroke's 6.28/7.85 CSS-px reach at 180p/144p, so the outermost sliver of a lit ring is not clickable. The 8-px hover threshold (`main.js:14598`) clears every setting. Cosmetic, pre-existing, no edit proposed — recorded because an earlier draft asserted full coverage at 144p and that is false."
  },
  "workflowProgress": [
    {
      "type": "workflow_phase",
      "index": 1,
      "title": "Plan"
    },
    {
      "type": "workflow_phase",
      "index": 2,
      "title": "Attack"
    },
    {
      "type": "workflow_phase",
      "index": 3,
      "title": "Reconcile"
    },
    {
      "type": "workflow_agent",
      "index": 1,
      "label": "plan:world-orbit-lines",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "a0d545d372e1983c9",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788700739746,
      "queuedAt": 1788700736629,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The world's orbit lines in ORRERY and HELM — src/objects/Or…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788701081181,
      "tokens": 117452,
      "toolCalls": 38,
      "durationMs": 340748,
      "resultPreview": "{"surface":"The world's orbit lines in ORRERY and HELM — src/objects/OrbitLine.js, src/objects/OrbitRingSDF.js, src/objects/OrbitConicField.js, src/objects/ringConic.js, and the two main.js sites that build and drive them (AC-5, first clause).","verdict":"already-conformant","currentState":"THE PIXELS ALREADY LAND IN THE WORLD BUFFER, AND THE SDF REBUILD IS NOT WHY — A LATER REWRITE IS.\
\
⚠ First…"
    },
    {
      "type": "workflow_agent",
      "index": 2,
      "label": "plan:minimap",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "aaae9b5085014f7f4",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788700739462,
      "queuedAt": 1788700736630,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The minimap / SystemMap — `src/ui/SystemMap.js` plus the HU…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788701393622,
      "tokens": 134555,
      "toolCalls": 36,
      "durationMs": 653189,
      "resultPreview": "{"surface":"The minimap / SystemMap — `src/ui/SystemMap.js` plus the HUD render target and composite rect that host it in `src/rendering/RetroRenderer.js`. Serves AC-5.","verdict":"needs-change","currentState":"THE 2.68x CLAIM IS TRUE, AND THE INVERSION IS TRUE. Verified by reading the four files that produce the number, not by trusting the contract.\
\
WHERE THE MINIMAP'S PIXELS ACTUALLY END UP\
…"
    },
    {
      "type": "workflow_agent",
      "index": 3,
      "label": "plan:hud",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "a816fabae1a82bcb9",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788700739547,
      "queuedAt": 1788700736630,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The HUD — src/ui/SupercruiseHud.js (the screen-space flight…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788701475265,
      "tokens": 152642,
      "toolCalls": 50,
      "durationMs": 734832,
      "resultPreview": "{"surface":"The HUD — src/ui/SupercruiseHud.js (the screen-space flight overlay) and RetroRenderer's hudTarget. Serves AC-6.","verdict":"needs-change","currentState":"FIRST, A NAMING TRAP THAT HAS TO BE CLEARED, BECAUSE THE CONTRACT SPLITS ACROSS IT: `hudTarget` IS NOT THE HUD. `RetroRenderer.setHud()` is fed exactly one thing — `retroRenderer.setHud(systemMap.scene, systemMap.camera)` at main.js:…"
    },
    {
      "type": "workflow_agent",
      "index": 4,
      "label": "plan:reticle",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "aac55b46c15522c43",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788700739441,
      "queuedAt": 1788700736630,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The targeting reticle — src/ui/TargetingReticle.js (#target…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788701400374,
      "tokens": 141028,
      "toolCalls": 35,
      "durationMs": 660931,
      "resultPreview": "{"surface":"The targeting reticle — src/ui/TargetingReticle.js (#targeting-overlay), plus its erase source src/cockpit/cabinMask.js. Serves AC-6.","verdict":"needs-change","currentState":"NOT conformant. It is the single most off-grid surface in the batch — worse than the orbit rings ever were, because its stroke is thinner than one world pixel.\
\
WHERE THE PIXELS GO\
- `TargetingReticle.js:103-1…"
    },
    {
      "type": "workflow_agent",
      "index": 5,
      "label": "attack:world-orbit-lines",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "a04eb81efdb58767d",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788701083555,
      "queuedAt": 1788701083549,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The world's orbit lines in ORRERY and HELM — src/objects/Or…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788701489444,
      "tokens": 122862,
      "toolCalls": 43,
      "durationMs": 405888,
      "resultPreview": "{"surface":"The world's orbit lines in ORRERY and HELM — src/objects/OrbitLine.js, src/objects/OrbitRingSDF.js, src/objects/OrbitConicField.js, src/objects/ringConic.js, and the two main.js sites that build and drive them (main.js:226-227 construct+add, main.js:13180 per-frame update). AC-5, FIRST CLAUSE ONLY. The minimap (AC-5's second clause) is src/ui/SystemMap.js and is not mine.","verdict":"a…"
    },
    {
      "type": "workflow_agent",
      "index": 6,
      "label": "attack:minimap",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "a85beef0c63cae720",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788701397875,
      "queuedAt": 1788701395691,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The minimap / SystemMap — `src/ui/SystemMap.js` plus the HU…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788702045139,
      "tokens": 133476,
      "toolCalls": 33,
      "durationMs": 647260,
      "resultPreview": "{"surface":"The minimap / SystemMap — `src/ui/SystemMap.js` plus the HUD render target and composite rect that host it in `src/rendering/RetroRenderer.js`. Serves AC-5's second half.","verdict":"needs-change","currentState":"VERDICT UPHELD AFTER ADVERSARIAL CHECK. Every anchor in the input plan was grepped (all 11 present, verbatim, count == 1); every 240p figure was recomputed from source; the th…"
    },
    {
      "type": "workflow_agent",
      "index": 7,
      "label": "attack:reticle",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "aa8c6c361366e2f23",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788701405256,
      "queuedAt": 1788701402399,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The targeting reticle — src/ui/TargetingReticle.js (#target…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788702328928,
      "tokens": 168385,
      "toolCalls": 45,
      "durationMs": 923672,
      "resultPreview": "{"surface":"The targeting reticle — src/ui/TargetingReticle.js (#targeting-overlay), its erase source src/cockpit/cabinMask.js, and the one line of src/style.css that governs how the overlay is magnified. Serves AC-6.","verdict":"needs-change","currentState":"NOT conformant. I traced the pixels rather than accepting the claim, and the surface is genuinely off-grid: its stroke is thinner than one w…"
    },
    {
      "type": "workflow_agent",
      "index": 8,
      "label": "attack:hud",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "a99c7d0579334570f",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788701479258,
      "queuedAt": 1788701475832,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The HUD — src/ui/SupercruiseHud.js (the screen-space flight…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788702341480,
      "tokens": 172404,
      "toolCalls": 47,
      "durationMs": 862222,
      "resultPreview": "{"surface":"The HUD — src/ui/SupercruiseHud.js (the screen-space flight overlay), the shared low-res overlay surface it needs from src/rendering/RetroRenderer.js, and a new src/rendering/PixelText.js. Serves AC-6's HUD half.","verdict":"needs-change","currentState":"THE NAMING TRAP IS REAL AND I RE-VERIFIED IT: `hudTarget` IS NOT THE HUD. `grep -n \"setHud(\" src/main.js` returns exactly four hits…"
    },
    {
      "type": "workflow_agent",
      "index": 9,
      "label": "reconcile",
      "phaseIndex": 3,
      "phaseTitle": "Reconcile",
      "agentId": "a5b2230915ea827df",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788702349854,
      "queuedAt": 1788702344383,
      "attempt": 1,
      "lastToolName": "Bash",
      "lastToolSummary": "sed -n '258,285p' src/ui/TargetingReticle.js",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never guess from a name; never trust a comment's line citation without checking it (several in this repo are stale).

THE CONTRACT you are implementing against: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/contract.json, intent at intent.md in the same dir. READ BOTH FIRST.

MAX'S RULE, which is the w…",
      "lastProgressAt": 1788702926896,
      "tokens": 195599,
      "toolCalls": 40,
      "durationMs": 577041,
      "resultPreview": "Read the contract, the intent, and every file the four plans touch. Here is the resolved application order.

---

# BATCH 1 — APPLICATION ORDER

## 0. THE ONE INCOMPATIBILITY, NAMED AND PICKED

Two surfaces asked for **different mechanisms for the same thing** — getting a 2D overlay onto the world's pixel grid:

| | HUD plan | Reticle plan |
|---|---|---|
| Where the canvas lives | one offscreen c…"
    }
  ],
  "totalTokens": 1338403,
  "totalToolCalls": 367
}

---

## BATCH 2 — cockpit panels, panel content, nav panel, cabin mask

I have everything I need. All the load-bearing arithmetic is now verified against the assets and code rather than any plan's prose.

---

# BATCH 2 — APPLICATION ORDER

## 0. Corrections to the contract itself, established before anything is ordered

Three numbers the contract states are wrong. They must not propagate into commits or ACs.

| Contract says | Truth | Evidence |
|---|---|---|
| AC-1: `cockpitTarget` allocated at `RetroRenderer.js:976` | **`:1021`** (`:976` is a blank line) | `grep -n cockpitTarget` |
| AC-2: panel is **48.9** buffer px tall | **42.84** (upper), **46.07** (lower) | projected below |
| AC-8: baseline "20 across the same 8 files" | **47 tests across 12 files** | `tests/baseline/known-failures.json` → `summary.counts` |

The 48.9 figure is the **angular** fraction. A perspective projection is linear in *tan*, not angle, and `panelPose.js:34-49` already writes both forms out under the heading **"PIXEL FRACTION, NOT ANGULAR FRACTION"**, warning that "solving the angular form yields a panel that measures correct on a protractor and looks wrong in the cockpit." I projected all four measured corners of every screen from `public/assets/cockpit/cockpit-metrics.json` through a 70° camera:

```
Screen_UL/UR  d=0.800   HEAD-ON 42.84 rows x 51.41 cols   AS-MOUNTED bbox 74.3 x 93.6
Screen_LL/LR  d=0.744   HEAD-ON 46.07 rows x 55.28 cols   AS-MOUNTED bbox 71.2 x 97.1
              angular form gives 48.86 / 52.49  <- 14% high, this is the contract's number
```

Each panel's `normal` equals its own `-centre` normalised, so the panels are **aimed at the eye**: looking straight at one gives a true head-on view with no foreshortening. That head-on case is reachable — `ShipCameraSystem.js:59` clamps free look at ±90° yaw and ±60° pitch, against the 39.7° yaw and 13.4° pitch needed to face `Screen_UL`. **Head-on is therefore the floor, and the floor is 42.84 rows.** Sizing to the floor means every other view is *magnified*, never minified — which is the only safe direction.

---

## 0.5 ⛔ CORRECTIONS FOUND 2026-09-08 — THE COLUMN BUDGET, AND WHICH PANEL IS WHICH

⭐ **Read this before designing any panel content.** Two of §1's and §4's numbers are wrong, and the
second one has been wrong in a way that reads plausibly.

### (i) The column arithmetic died with the 3×5 face

§1's **row** maths still holds — both faces are five rows tall, so seven lines is still
`2·pad + 5 + 6·6 = 43` and DRIVE still totals 43 exactly. Its **column** maths does not. The shipped
5×5 face has `advance` **6** where the 3×5 had 4, so:

    chars across = floor((floor(cols) - 2·pad + 1) / advance)

⚠ **Validate the method before trusting a new number from it:** at `advance = 4` it returns **12**
and **13**, which is what §1 derived independently. That agreement is the only reason to believe 8
and 9.

### (ii) ⛔ INFO IS ON THE LOWER PAIR. THE HANDOFF AND §4 BOTH GROUPED IT WITH THE UPPER.

The live role map is `PanelLayout.js:53-56` and it is **not** the pairing the plan assumed:

| role | node | pair | head-on rows × cols | chars across | value budget |
|---|---|---|---|---|---|
| NAV | `Screen_UL` | upper, d=0.800 | 42.84 × 51.41 | **8** | 4 |
| DRIVE | `Screen_UR` | upper, d=0.800 | 42.84 × 51.41 | **8** | 4 |
| INFO | `Screen_LL` | lower, d=0.744 | 46.07 × 55.28 | **9** | **5** |
| TARGET | `Screen_LR` | lower, d=0.744 | 46.07 × 55.28 | **9** | **5** |

All four screens are 0.24 × 0.20 m (`cockpit-metrics.json` `/screens`); only the eye distance differs.
So **INFO gets five characters to a value, not four**, and NAV is the panel that drops to four.

⭐ The general form, and it is the session's own lesson wearing a different hat: *the arithmetic was
right and the input was wrong.* A number recomputed correctly off the wrong panel is not a weaker
answer than no number — it is a more dangerous one, because it carries the authority of having been
derived.

### (iii) §4's "what is NOT his" list has two entries that are now his

- ⛔ *"Labels shorten to 3 characters and values to 8"* — that was a 12-column row. Values are **5**
  on INFO/TARGET and **4** on NAV/DRIVE.
- ⛔ *"INFO keeps all seven fields… nothing comes off, so there is nothing to ask"* — the seven
  **rows** survive; one of their **values** does not. At five characters `ATM` keeps the pressure and
  loses the gas mix (`co2-n2` is six characters on its own). `CMP` dropping "rock" is not a loss —
  `TYP` already carries the surface type — but the gas mix genuinely comes off the glass. **That is a
  content decision and it is Max's.**

### (iv) The lab that renders all of this

`cockpit-panel-budget-lab.html` (repo root, served at `/well-dipper/`). It imports the shipped
`drawPixelText`, PhosphorScreen's own `TYPE_RATIOS`, and runs a real survey snapshot through
`buildInfoRows`, so the "today" column is today's actual mechanism rather than an impression of it,
and the strings are the ones the game would really draw. It projects the panel sizes from
`cockpit-metrics.json` in the open rather than quoting them.
⚙ It carries an `assertFits` guard that logs a panel overflow to the console — added because the
first draft silently drew three panels past their own floor. **The guard was probed by sabotage**
(pushing a row start down 20 texels, watching it fire, reverting); a fit check that has never failed
is not yet a check.

---

## 0.6 MAX'S RULINGS, 2026-09-08 — (a) AND (b) ARE CLOSED

- **(a) CAP and TURN come off DRIVE.** *"1, okay"*. The throttle bar stays.
- **(b) TARGET shouts the short name and the distance, and drops the full designation.** *"2. sounds
  good"*. ⚠ This is **not** §4(b)'s option (a) — Max did not take "big discriminator with the full
  name small underneath". The full designation comes OFF the glass; it is not relegated to small
  type. Nine characters at scale 1 is what the panel has, and a nine-character name at the display
  tier would be 106 texels on a 55-texel panel, so the hero tier cannot carry a name at all.
- **(c) The value budget — CLOSED at five characters.** *"1. this is fine"*, against the lab. `ATM`
  keeps the **pressure**; the gas mix comes off.

### ⛔⛔ AND THE CONSTRAINT HE ATTACHED TO IT, WHICH OUTRANKS THE LAYOUT

> *"know we'll probably switch this up in the near future so don't get rid of any code that allows
> you to display what we want to display."* — Max, 2026-09-08

**The gas mix comes off the GLASS. It does not come out of the PIPELINE.** Those are different
edits and only the first one was approved.

Concretely, and this is what the next session must not get wrong:

- ⛔ **Do not delete `formatAtmosphere`'s composition clause**, and do not make it stop returning the
  full `"co2-n2 0.85 bar"`. It keeps producing what it produces.
- ⛔ **Do not remove a row from `INFO_ROWS`.** All seven stay. `INFO_VALUE_MAX_CHARS` is a backstop
  and is not the place to encode a panel's width either.
- ✅ **The panel decides what it can draw.** Choosing the pressure over the mix is a LAYOUT decision
  and it lives in `InfoPanel.js`, downstream of the readout, where changing our mind later is one
  edit in one file rather than an archaeology exercise.

⭐ This is the module's own design being honoured rather than a new rule: `InfoReadout.js`'s header
says *"THE PIPELINE IS THE DELIVERABLE AND THE FIELDS ARE DISPOSABLE"*, and the whole reason it is a
table is that *"dropping one field meant three coordinated edits in three files — which is exactly
the shape of change that does not get made, so the panel silently ossifies"*. Deleting a formatter to
make a five-character row fit would ossify it around a decision Max has already said is temporary.

⚠ The same test applies to every other panel in this batch. `MODE:` losing its prefix, the mass-lock
banner going to eight characters, TARGET dropping the full designation — **all of those are panels
choosing what to draw, none of them is a readout losing the ability to produce it.** If an edit
makes a string unproducible rather than undrawn, it is the wrong edit.

---

## 1. THE TYPE SCALE, SETTLED

Stop deriving type from ratios of panel height. Ratios cannot land a bitmap face on integer rows, and snapping them independently makes the character budget wander with resolution. Derive from a **grid**, so the layout is the invariant and only the texel size moves.

```
Design grid:      PANEL_LINES = 7      PANEL_COLS = 12
Unit scale:       s = max(1, floor(min(H / 43, W / 49)))

pad     = 1s          hair    = 1s  (was max(1, body/8) — PhosphorScreen.js:411)
base    = 5s          markLen = 2s  (was hair*3 — PhosphorScreen.js:697)
  body  = label = base   ⭐ the two tiers MERGE; a 5-row face has no size between them
lead    = 6s
display = 10s         ⭐ the SAME 3x5 face at integer scale 2 — not a second face

GRID_ROWS = 2*pad + base + 6*lead        = 43   (imported GLYPH_H, never typed)
GRID_COLS = 2*pad + 12*ADVANCE - 1       = 49
```

`GLYPH_W=3`, `GLYPH_H=5`, `ADVANCE=4` come from `src/rendering/PixelText.js:37-40`. **That module already exists and is complete** — the brief's "planned for batch 1" is stale. It is the one glyph set; a larger face means adding a 5×7 set *there*, per its own header at `PixelText.js:20-25`.

**The floor is an absolute texel count, not a ratio.** `MIN_TEXT_TEXELS = GLYPH_H = 5`, replacing `MIN_TEXT_RATIO = 1/20` (`PhosphorScreen.js:217`). Once the buffer *is* the display grid, a fractional floor can only be wrong at some resolution — a 1/8 ratio floor demands 5.375 texels at H=43, which rejects the only legal size (5), and 8 at H=64, which no legal multiple of 5 below 10 can clear. Every draw would throw and `PanelHost` would freeze all four screens.

**The row budget this buys, per panel, across every shipped setting** (`RENDER_LINE_OPTIONS`, `renderLines.js:51`):

| lines | upper H×W | s | budget | lower H×W | s | budget |
|---|---|---|---|---|---|---|
| 144 | 26×31 | 1 | 4×7 | 28×34 | 1 | 4×8 |
| 180 | 32×38 | 1 | 5×9 | 35×42 | 1 | 5×10 |
| **240** | **43×52** | **1** | **7×12** | **46×55** | **1** | **7×12** |
| 288 | 51×61 | 1 | 7×12 | 55×66 | 1 | 7×12 |
| 360 | 64×77 | 1 | 7×12 | 69×83 | 1 | 7×12 |
| 480 | 86×103 | 2 | 7×12 | 92×110 | 2 | 7×12 |
| 720 | 129×155 | 3 | 7×12 | 138×166 | 3 | 7×12 |

**From 240p up it is the same picture, only sharper.** That is the property AC-2 and AC-3 need in order to be checkable at all. Below 240p it degrades honestly, so `typeScale` must also return `lines` and `cols` and the painters must consume them rather than running off the glass.

**Seven lines is what dissolves the INFO problem.** `INFO_ROWS` has seven entries; line 1 carries the body NAME unlabelled at full width and lines 2-7 carry the six labelled rows. **No INFO field comes off.** Plan B's proposed TIDAL cut is unnecessary — do not make it.

---

## 2. THE ORDER

⛔ **The one hard ordering constraint, and it runs the opposite way to intuition.** Today `cockpitTarget` is full window resolution, so a 512-tall panel canvas is *minified* ~2:1 and looks fine. The moment AC-1 routes it through `bufferForLines`, 512 across 43 rows becomes **~12:1 point-sampling** and the glyphs disintegrate. So:

> **Step 3 must land BEFORE or WITH AC-1 — never after.** Step 3 landing early is safe (the panel is merely chunkier than final); AC-1 landing alone makes the panels visibly *worse* than today and the obvious diagnosis points at the wrong change.

### Step 1 — Glyph coverage (cheapest, zero risk, unblocks everything)

`src/rendering/PixelText.js` + a coverage test.

The face has **47 glyphs** and is missing characters live call sites emit. Verified absent: `_` `'` `?` `(` `)` `[` `]` `~` `°` `·` `` ` `` `⊕` `☉`. Present: `—` `+` `<` `>`. `drawPixelText`'s default `onMissing` is `'throw'` (`PixelText.js:136`), and `NavPanel` clears the screen before drawing, so **an unmapped codepoint is a black panel, not a missing character.**

Live consequences already in the shipped data: `InfoReadout`'s `T_EQ` label carries `_`; `NavComputer`'s `[ BURN ]` / `[ WARP ]` carry brackets; `real-star-supplement.json` carries `Barnard's Star`. Add the glyphs, and add a test asserting `hasGlyph` over every fixed literal the cockpit and nav emit.

*Verifiable headless, immediately. Nothing else depends on order here.*

### Step 2 — The kit and the four panels, at today's 512 buffer

`PhosphorScreen.js` + `DrivePanel.js` + `InfoPanel.js` + `TargetPanel.js` + `NavHoldingCard.js` + `FlightReadout.js` + `AlertCue.js` + `InfoReadout.js` + the two test files.

⭐ **The buffer does not move in this step.** At H=512 the grid gives s=11 — the *final 7×12 layout* at high texel resolution. That isolates layout bugs from resolution bugs, which is the whole reason to split here.

Kit changes: replace `TYPE_RATIOS` (`:194-200`) with the grid; `MIN_TEXT_RATIO` (`:217`) → `MIN_TEXT_TEXELS`; `typeScale` (`:344-348`) returns integers plus `lines`/`cols`, taking width as an argument; route `text()`/`banner()` through `drawPixelText` (`fillText` at `:569`, `:762`); delete `_setFont`, the `measureText`-based `_measure`, `ASCENT`/`DESCENT`, `INK_BLOCK_PAD_X`; add a private `_px()` rounding **every** geometry argument, not just text; `hair = pad`; `markLen = hair*2`.

⛔ **Always pass `color` explicitly to `drawPixelText`.** It saves and restores `ctx.fillStyle` and its default is the literal `'#ffffff'` — which would put a third value on the context without appearing in this file's source, which is all the one-ink source scan inspects.

⛔ **`onMissing`: `'throw'` for fixed literals, `'tofu'` for anything from the snapshot.** `PanelHost` catches a painter throw once and then leaves the screen frozen.

Defects this step fixes, all confirmed by reading:

- **The speed bar draws no fill at any speed.** `PhosphorScreen.js:678` computes `fillH = max(0, h - inset*2)` with `inset = hair*2` (`:667`); `DrivePanel.js:120` `BAR_HEIGHT: 0.07` × 43 = 3.01, so `fillH = 0`. The throttle bar (`:136`, 0.05 → 2.15) the same. A safety readout silently reporting nothing.
- **INFO's seventh row falls off the glass.** `FIRST_ROW_BASELINE = 0.23` (`InfoPanel.js:73`) × 43 = 9.89, plus 6 × lead = 45.89 in a 43-row panel.
- ⭐ **Two independent `inset = hair*2`** at `:667` (the fill) and `:719` (`_fracToX`, the pin and ticks). Change one and the commanded pin no longer lands on the fill's leading edge. **Both or neither.**
- `AlertCue`'s MASS_LOCK is **25 characters** against 13 at full banner width — it needs two lines, split in the model (`MASS_LOCK_LINES` with a join-test), never by the painter.
- `readout.speedText` worst case is 11 characters against a 6-column display line — `speedValue`/`speedUnit`/`reverse` must arrive pre-separated from `FlightReadout`. `DrivePanel.js:16-21` forbids a painter re-deriving a model string.

*Verifiable live at 512: the panels show the final layout, sharp, with every field present.*

### Step 3 — The buffer drops, and the filter (the step AC-1 is coupled to)

`PanelHost.js` + `PanelPointer.js` + `CockpitRig.js` + one line of `main.js`.

`bufferHeightPx` is currently **one scalar for four panels** — `PanelHost.js:405`, consumed inside the per-panel loop at `:472`, set to 512 at `main.js:4686`. Widen it to accept `number | ((role, metrics) => number)`; `role` is already destructured at that call site, so this is one line and it is what makes NAV separable in Step 4.

Derive per panel from the **pixel** fraction: `rows = (metrics.height / distance) / (2·tan(fov/2)) · RENDER_BUFFER.height`, with the eye **passed in, never assumed** — `CockpitRig._mountEye:586-597` refuses the origin assumption by name. Consume `RENDER_BUFFER` via `resolveRenderBuffer`; never copy its fields (`renderBuffer.js:9-12`). Re-derive on the `renderLines` setting change and on the FOV change; `setBufferHeightPx` (`CockpitRig.js:851`) already remounts and keeps the NavComputer.

⛔ **`magFilter = NearestFilter` in `PanelPointer.js` — and this is the edit that decides whether any of the rest reads.** `createPanelTexture` sets `minFilter = LinearFilter` and **no `magFilter`**, so three.js defaults it to Linear. Once the buffer is the world grid the panel is *magnified* in every real view (52-74 rows as mounted against a 43-row texture), and every hard texel becomes a bilinear ramp of greys on the GPU — invisible to the one-ink test, which watches `fillStyle`, not pixels. `cockpitTarget` itself already uses Nearest/Nearest (`RetroRenderer.js:1022-1023`); this makes the panels agree with it.

⚠ **Add a debug handle in this step.** `window._cockpit()` (`main.js:4846`) exposes `panels` as roles only — there is **no way to read a panel canvas's dimensions from the console**, so AC-2 is currently unverifiable except by eye. Extend it with `buffers: host.panels.map(p => ({role, w, h}))`. Without this the verification script in §3 cannot run.

*Verifiable live: canvas dimensions, a resolution sweep, and a measured glyph height.*

### Step 4 — The nav computer

`NavComputer.js` (**44** `ctx.font` sites — not "~42" — in a 4446-line file shared with the ORRERY overlay), `NavPanel.js`, `AutopilotNavSequence.js`.

Last because it is the largest, the riskiest, and the only one that depends on Step 3's per-role mechanism. It draws in **absolute canvas pixels** into a canvas whose size it never reasons about, so canvas size *is* legibility here in a way it is not for the phosphor panels.

The safe seam is a per-instance `_type` driver defaulting to `null` = today's `fillText` path byte-for-byte, so the ORRERY overlay (AC-4, AC-7) is untouched. ⚠ That is a change whose own output cannot prove it is live — **sabotage the default tier table and confirm the overlay visibly moves** before trusting a "no change" reading.

Three catches that would otherwise ship broken: there are **three** `tabH = 32` sites (renderer, autopilot placement, and the **click hit-test**) — shrink one and taps miss; there are **four** `h - 50` reserves in NavComputer plus **two more** in `AutopilotNavSequence` that derive the screensaver's performed cursor from the live canvas; and `NavPanel.js:234` already calls `source.resize(screen.width, screen.height)` every paint with a hard size-agreement throw below it, so NAV self-heals on a buffer change and does *not* need a new listener.

### Step 5 — Baseline

Re-record and confirm **12 failing files / 47 failing tests**, unchanged. `PhosphorScreen.test.js`, `panels.test.js` and `cabinMask.test.js` are all absent from the failing list — they pass today and must still pass.

Tests that **will** break and must be re-derived, not deleted: `PhosphorScreen.test.js:420` (pins `MIN_TEXT_RATIO`), `:447-448` (`lead/body >= 1.4`, becomes 6/5 = 1.2 — the honest bound is `lead >= body + s`), `:409` (`SCREEN_PX_PER_PANEL = 220`), `:507-514` (`hair === body/8`); and `panels.test.js:194` `MIN_TEXT_DIVISOR = 24` — **which has been enforcing a floor looser than the kit's own H/20 since it was written**, at `PANEL_H = 512`, a geometry the game will no longer have.

---

## 3. THE LIVE VERIFICATION SCRIPT

Objective assertions, read off the running game via chrome-devtools `evaluate_script`. These are AC-1 to AC-4 — integration, not UAT. ⛔ Max never touches the console; the main thread drives all of this itself.

**Preconditions:** HELM, Resolution 240p, FOV 70. Requires the `buffers` handle from Step 3.

```js
// ── AC-1 — the cockpit is on the world's grid ───────────────────────────────
const rt = window._retroRenderer.cockpitTarget;
[rt.width, rt.height]                    // height === 240, NOT window.innerHeight
rt.texture.magFilter === 1003            // NearestFilter

// ── AC-2 — the type clears the floor, in the unit that matters ──────────────
window._cockpit().buffers
// upper (NAV, DRIVE): h === 43, w === 52     ⛔ NOT 49x59 — that is the angular form
// lower (INFO, TARGET): h === 46, w === 55
// every returned typeScale value is an integer multiple of 5; lines === 7; cols === 12
```

**LIVENESS PROBE — the step that separates a wired derivation from a coincidence.** A cached or unwired read passes the assertions above and fails only here:

```js
// Sweep Resolution 144 → 180 → 240 → 288 → 360 → 480 → 720, asserting at each stop:
//   upper h: 26, 32, 43, 51, 64, 86, 129
//   lower h: 28, 35, 46, 55, 69, 92, 138
//   budget:  4x7, 5x9, 7x12, 7x12, 7x12, 7x12, 7x12
// Then move FOV 70 → 50: upper h rises to 64.  FOV → 90: falls to 30, lines reports 4.
// Then resize the window at a fixed setting: canvases do NOT change
//   (bufferForLines sets height = the line count; only width tracks aspect).
```

**Pixel-level assertions** (screenshot + sample, not description):

- A capital measures **exactly 5 texels tall by 3 wide**; the display tier exactly 10 by 6.
- Every pixel on a panel texture is exactly `PHOSPHOR.INK` or `PHOSPHOR.BACK` — **no intermediate values**. A grey ramp across a glyph edge means `magFilter` did not land.
- Every recorded `fillRect` has integer `x`, `y`, `w`, `h`. This is the assertion that fails today and that the existing one-ink test passes either way, because it watches `fillStyle`, not geometry.

**AC-3 — nothing silently dropped.** Fly a supercruise leg and a warp arrival:

- DRIVE: speed value moving, unit legible, commanded pin *above* and drop tick *below* the bar and both distinguishable, throttle bar filling right of centre forward and left in reverse, MODE line inside the glass. Push to the Mm/s tier (`299.79`) and reverse (`REV`) — neither clips at either margin.
- INFO: body name on line 1 plus **all six** labelled rows, none clipped. Clear the focus: the name blanks, six labels remain with blank values, **no row moves**.
- Trigger mass-lock: **two** banner lines, blinking in step, clearing together.

**AC-4 — a destination actually selected and jumped to.** Press N, drive the level tabs galaxy→sector→region→prism→system, click a star, press `[ WARP ]`, and confirm the ship warps there. Then the same through the mobile dock and an autopilot-initiated open — all three route via `_openCockpitNav` (`main.js:5912`). Confirm a click 8 rows above the panel's bottom edge changes level and one 20 rows above it reaches the body picker (the three-`tabH` catch). Confirm the DOM fallback still appears in ORRERY.

⛔ **Use `_lab.spawnProceduralSystem(seed)` or Caph for every body-rendering check — never Sol.** Sol is NASA-textured with a different renderer and cannot validate procgen.

---

## 4. WHAT MAX HAS TO DECIDE

Strictly: mechanism is mine, what a panel **stops saying** is his. By that test there are exactly **two**, both on the same screen or the one beside it.

### (a) Can the two ceilings come off the drive screen?

DRIVE today shows speed, the SUBLIGHT tag, the speed bar, the throttle bar, **CAP** (the gravity-well speed ceiling), **TURN** (turn authority in degrees per second), the MODE line and the mass-lock warning. At 240p that screen is 43 rows, and laid out in whole rows it holds: the big speed number (10), a line for its unit and the REV/SUBLIGHT tag (5), the speed bar with its pin above and drop tick below (10), the throttle bar (6), and the MODE line (5), plus margins. **That totals 43 exactly.** CAP and TURN are the two with nowhere to go, and there is no other screen to move them to — the full-screen HUD is being coarsened in this same pass, and in HELM the cockpit *replaces* the DOM readouts (`main.js:790-800`).

My recommendation is to cut both. CAP's real job — how much of the bar is available right now — is already drawn, as the drop tick on the speed bar itself. TURN is a slowly-changing derived number that nothing in the flight loop asks you to act on. Both are cockpit-panel-only, added 2026-07-28; `DrivePanel.js:25-33` records that `buildFlightReadout` never sees either, so the game was flown without them before that. But whether you fly by either is a question about flying, and I have not flown it.

If you want to keep one, the cheapest thing to give up is the **throttle bar** (6 rows) — the lever's position is also readable from the speed bar's commanded pin. That trade is second because you asked for that bar by name in UAT on 2026-07-31.

⛔ **Not a real option: keeping both by shrinking the type.** That is the move the floor exists to block, and it is "exempt the text" arriving through the back door.

### (b) When you're locked onto a planet, what does the TARGET screen shout?

Right now it prints the whole designation big — `PVX J4K7Q2M+9XP3RWZ b` — and `TargetPanel.js:24-32` admits the common case runs off both edges, at which point it redraws the whole thing small, *below the legibility floor*. So this panel is already broken today, before 240p. At the new grid, big type fits 6 characters and small type fits 12, so the full name can only exist as two small lines.

**(a) Big letter, small name underneath.** The screen shouts the part that distinguishes this body from the others — the `b`, the `-3`, `Prime` — at double size, with the full designation in two small lines below. Readable from the corner of your eye, but what it shouts is one or two characters that only mean anything because you already know which system you're in. Roughly three planets in four are named off their system, so three times in four there is such a part.

**(b) No hero at all.** The full designation, two small lines, nothing bigger than anything else. Honest and complete, but TARGET stops having anything readable without looking straight at it.

I'd build (a) — the panel's whole job is "what am I pointed at", and inside a system the letter *is* the answer. The full name is on the glass either way, so nothing is lost in either.

### What is NOT his, and I will just do

- **The grid, the floor, the scale, the buffer arithmetic, the filter.** All forced by the measurement; there is no taste in them.
- **INFO keeps all seven fields.** Seven lines is exactly what the grid buys. Nothing comes off, so there is nothing to ask.
- **Label and body merge into one size.** A 5-row face has no size between them; row contrast becomes positional, which `row()`'s own comment already says is what makes a column scannable.
- **Labels shorten to 3 characters and values to 8.** Mechanical consequence of a 12-column row.
- **`markLen` drops from 3 hairs to 2.** DRIVE's integer layout totals 43 with 2 and 45 with 3.

---

## 5. WHAT COULD MAKE HIM SAY NO

He judges by eye, in motion, in HELM. Five things could read as damage.

**1. ⭐ The panels get worse before they get better, and the wrong step gets blamed.** If AC-1 lands before Step 3, 512 texels across 43 rows is ~12:1 point-sampling and the glyphs disintegrate. He would see it in HELM within seconds and conclude the *resolution* work broke the cockpit, when the cause is a buffer that has not moved yet. **This is the single highest-probability way this batch produces a "no", and it is entirely an ordering choice.** Land Step 3 first, or with AC-1, never after.

**2. The nav computer's zoom stops paying for itself.** NAV is the only zoomable role (`CockpitRig.js:270`) at 0.75 fill (`PanelMover.js:85`), so zoomed it covers 180 of 240 rows. If it keeps the phosphor panels' 43-row buffer, pulling it to your eye reveals **no additional information** — the zoom's stated purpose, "interact with the full menu", stops being served, and a 4000-line colour instrument is drawing into 52×43. My plan gives NAV its own height in Step 3 for exactly this reason, but the consequence is that at rest NAV is *minified* (a 180-row canvas across a 43-74 row footprint) and will shimmer on a moving star field with `generateMipmaps = false`. **Either way NAV has a visible cost, and it is the surface he steers with.** This is the one place where I expect a second pass after he looks.

**3. At rest, the corner nav screen goes wordless — and I decided that, not him.** At 43 rows a letter is 12% of the panel height; nothing on that screen resolves at rest today either, and nothing on it is clickable until it has landed at the eye (`CockpitRig.js:947` gates on `navZoomLanded()`). So no information he flies by is lost, which is why I am not asking. But he will *see* a corner screen that used to be covered in chrome become a bare star map. It is one flag in one file if he wants it back.

**4. Everything on the panels gets bigger and there is less of it.** Seven lines of twelve characters is a real reduction from what the panels hold today. It reads as a deliberate MFD if it lands well and as an impoverished one if it does not. There is no way to preview this except in the running game — which is why Step 2 deliberately lands the new layout at the **old** 512 buffer, so he can judge the layout while it is still sharp, before the texels get coarse. **Park him in the live game at that point rather than sending a screenshot.**

**5. The mid-travel window.** `navIsZoomed()` is true throughout the ~550ms zoom, so the panel is transiently between 43 and 180 rows while the full instrument draws. It fails toward legible-later rather than toward a live invisible button, but it will be visible in motion, and motion is how he judges.

⛔ **What is NOT in here, checked four ways.** No text exemption in any disguise: every resolution number moves *down* (panel buffers 512 → 43/46), there is no higher-res panel target, no separate sharp text pass, no DOM overlay, no per-surface carve-out. No second glyph set: `PixelText.js` is consumed and extended, never forked, and the display tier is the same 3×5 face at integer scale 2. No `RetroRenderer.js` edit — AC-1 is assumed and the corrected line number (`:1021`) is handed over. The PhosphorDither one-ink law is untouched and is *strengthened* by the integer-coordinate work and by `NearestFilter`.

---

## OPEN ITEMS

1. **Can CAP and TURN come off the DRIVE screen?** My recommendation: cut both — CAP is already drawn as the drop tick on the speed bar, TURN is a number nothing in the flight loop asks you to act on. If you want one back, the cheapest thing to give up instead is the throttle bar. This is the only item blocking Step 2's DRIVE layout.
2. **On TARGET, does the big type shout the discriminator (the "b", the "-3") with the full name small underneath, or is there no big type at all?** My recommendation: the discriminator — inside a system, the letter is the answer to "what am I pointed at". The full name is on the glass either way.
3. **Nothing else needs you.** The panel is 42.84 rows tall, a letter needs five of them, and the grid that follows is 7 lines of 12 characters — identical at 240p, 480p and 720p. The code settles the rest."
  },
  "workflowProgress": [
    {
      "type": "workflow_phase",
      "index": 1,
      "title": "Plan"
    },
    {
      "type": "workflow_phase",
      "index": 2,
      "title": "Attack"
    },
    {
      "type": "workflow_phase",
      "index": 3,
      "title": "Reconcile"
    },
    {
      "type": "workflow_agent",
      "index": 1,
      "label": "plan:type-scale",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "a2a18b05ca033ca55",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788711990895,
      "queuedAt": 1788711988525,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The cockpit panel type scale — `/home/ax/projects/well-dipp…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788713006234,
      "tokens": 192063,
      "toolCalls": 51,
      "durationMs": 1014357,
      "resultPreview": "{"surface":"The cockpit panel type scale — `/home/ax/projects/well-dipper/src/cockpit/PhosphorScreen.js` (TYPE_RATIOS, MIN_TEXT_RATIO, typeScale, hair, and the text/banner/row draw path), plus the four painters that consume it (`src/cockpit/panels/DrivePanel.js`, `InfoPanel.js`, `TargetPanel.js`, `NavHoldingCard.js`) and the one number that decides whether the scale ever reaches the eye crisply, `…"
    },
    {
      "type": "workflow_agent",
      "index": 2,
      "label": "plan:panel-content",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "ae34e3a21ee34373c",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788711990806,
      "queuedAt": 1788711988525,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "What the four cockpit panels SAY: `src/cockpit/PanelHost.js…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788712752200,
      "tokens": 192538,
      "toolCalls": 53,
      "durationMs": 760323,
      "resultPreview": "{"surface":"What the four cockpit panels SAY: `src/cockpit/PanelHost.js` (the one buffer knob), `src/cockpit/PhosphorScreen.js` (the type scale every painter inherits), the four content authors `src/cockpit/panels/{DrivePanel,TargetPanel,InfoPanel,NavHoldingCard}.js`, and the two upstream content models `src/cockpit/InfoReadout.js` (the INFO_ROWS table) and `src/cockpit/FlightReadout.js` (read-onl…"
    },
    {
      "type": "workflow_agent",
      "index": 3,
      "label": "plan:nav-panel",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "a77d85907f738a8b5",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788711990738,
      "queuedAt": 1788711988525,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The nav computer on the glass — the cockpit NAV panel (Scre…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788712798299,
      "tokens": 197580,
      "toolCalls": 63,
      "durationMs": 806422,
      "resultPreview": "{"surface":"The nav computer on the glass — the cockpit NAV panel (Screen_UL) that `liveNavComputer()` returns in HELM: its prism star-picking view, its SYSTEM selection view, its level tabs / autopilot toggle / [ BURN ] / [ WARP ] chrome, its star glyph, and the ambient-vs-zoomed states. Files: `src/main.js` (wiring, 4686 / 5630 / 5912), `src/cockpit/panels/NavPanel.js`, `src/cockpit/NavSource.js…"
    },
    {
      "type": "workflow_agent",
      "index": 4,
      "label": "plan:cabin-mask",
      "phaseIndex": 1,
      "phaseTitle": "Plan",
      "agentId": "a3b44a9687910149a",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788711990716,
      "queuedAt": 1788711988525,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "src/cockpit/cabinMask.js — the cabin SILHOUETTE mask. A sec…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788712515437,
      "tokens": 120959,
      "toolCalls": 30,
      "durationMs": 524720,
      "resultPreview": "{"surface":"src/cockpit/cabinMask.js — the cabin SILHOUETTE mask. A second THREE.WebGLRenderer on an offscreen, never-DOM-attached canvas, drawing the cockpit's occluder set flat-white on transparent black from a copy of the live cockpit camera restricted to CABIN_MASK_LAYER (7), which TargetingReticle then composites over the reticle overlay with `destination-out`. Its sizing rule (`_syncSize`, c…"
    },
    {
      "type": "workflow_agent",
      "index": 5,
      "label": "attack:cabin-mask",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "ae6b115087313e20b",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788712522604,
      "queuedAt": 1788712517405,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "src/cockpit/cabinMask.js — the cabin SILHOUETTE mask. A sec…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788713085694,
      "tokens": 152725,
      "toolCalls": 37,
      "durationMs": 563088,
      "resultPreview": "{"surface":"src/cockpit/cabinMask.js — the cabin SILHOUETTE mask. A second THREE.WebGLRenderer on an offscreen, never-DOM-attached canvas, drawing the cockpit's occluder set flat-white on transparent black from a copy of the live cockpit camera restricted to CABIN_MASK_LAYER (7), which TargetingReticle then composites over the reticle overlay with `destination-out`. Its sizing rule (`_syncSize`, d…"
    },
    {
      "type": "workflow_agent",
      "index": 6,
      "label": "attack:panel-content",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "a800b9e538d043a06",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788712756738,
      "queuedAt": 1788712754213,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "What the four cockpit panels SAY, plus the machinery that d…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788713664377,
      "tokens": 181879,
      "toolCalls": 57,
      "durationMs": 907635,
      "resultPreview": "{"surface":"What the four cockpit panels SAY, plus the machinery that decides how big a letter is. In scope: `src/cockpit/PanelHost.js` (the buffer knob + `derivePanelBuffer`), `src/cockpit/CockpitRig.js` (the only object that knows both the eye and the camera, so the only one that can derive a panel's footprint), `src/cockpit/PhosphorScreen.js` (the type scale every painter inherits), `src/render…"
    },
    {
      "type": "workflow_agent",
      "index": 7,
      "label": "attack:nav-panel",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "a137427376a0efd61",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788712806686,
      "queuedAt": 1788712803562,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The nav computer on the glass — the cockpit NAV panel (Scre…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788713909201,
      "tokens": 193215,
      "toolCalls": 80,
      "durationMs": 1102515,
      "resultPreview": "{"surface":"The nav computer on the glass — the cockpit NAV panel (Screen_UL) that `liveNavComputer()` returns in HELM: its prism star-picking view, its SYSTEM selection view, its level tabs / autopilot toggle / [ BURN ] / [ WARP ] chrome, its star glyph, and the ambient-vs-zoomed states. Files: `src/main.js` (wiring at 4686 / 6269 / 13226), `src/cockpit/PanelHost.js` (the one buffer number), `src…"
    },
    {
      "type": "workflow_agent",
      "index": 8,
      "label": "attack:type-scale",
      "phaseIndex": 2,
      "phaseTitle": "Attack",
      "agentId": "ad9fd07e82ad8952c",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788713013545,
      "queuedAt": 1788713010343,
      "attempt": 1,
      "lastToolName": "StructuredOutput",
      "lastToolSummary": "The cockpit panel type scale — `/home/ax/projects/well-dipp…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788714074924,
      "tokens": 204614,
      "toolCalls": 70,
      "durationMs": 1061379,
      "resultPreview": "{"surface":"The cockpit panel type scale — `/home/ax/projects/well-dipper/src/cockpit/PhosphorScreen.js` (TYPE_RATIOS, MIN_TEXT_RATIO, typeScale, hair, markLen, ASCENT/DESCENT, the `NO 5x7 BITMAP ALPHABET` non-goal, and the text/banner/row/bar/rule draw paths); the five painters that consume it (`src/cockpit/panels/DrivePanel.js`, `InfoPanel.js`, `TargetPanel.js`, `NavHoldingCard.js`, and `src/coc…"
    },
    {
      "type": "workflow_agent",
      "index": 9,
      "label": "reconcile",
      "phaseIndex": 3,
      "phaseTitle": "Reconcile",
      "agentId": "aedf33e77a70042fd",
      "model": "claude-opus-5",
      "state": "done",
      "startedAt": 1788714089685,
      "queuedAt": 1788714080064,
      "attempt": 1,
      "lastToolName": "Bash",
      "lastToolSummary": "cd /home/ax/projects/well-dipper; sed -n '4846,4870p' src/m…",
      "promptPreview": "Well Dipper repo at /home/ax/projects/well-dipper. Read the ACTUAL FILES. Never trust a comment's line citation without checking it — several in this repo are provably stale.

READ FIRST: /home/ax/projects/well-dipper/docs/WORKSTREAMS/chrome-and-ui-at-240p/intent.md and contract.json. They are the authority.

MAX'S RULE, the whole scope discipline: "I want the whole game to read as a 5th gen game …",
      "lastProgressAt": 1788714519203,
      "tokens": 194329,
      "toolCalls": 23,
      "durationMs": 429517,
      "resultPreview": "I have everything I need. All the load-bearing arithmetic is now verified against the assets and code rather than any plan's prose.

---

# BATCH 2 — APPLICATION ORDER

## 0. Corrections to the contract itself, established before anything is ordered

Three numbers the contract states are wrong. They must not propagate into commits or ACs.

| Contract says | Truth | Evidence |
|---|---|---|
| AC-1:…"
    }
  ],
  "totalTokens": 1629902,
  "totalToolCalls": 464
}

---


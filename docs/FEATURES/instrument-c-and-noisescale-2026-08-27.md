# Instrument C, the uNoiseScale row, and the lab/game gate at :5359 — investigation record

**Date** 2026-08-27 · **Method** 6-agent workflow (3 surveyors, 2 adversarial lenses, 1 synthesis)
**Status** ⛔ NOTHING BUILT. Investigation + plan only.

> ⭐⭐ **THE HEADLINE IS A REFUTATION OF MY OWN FINDING, AND IT IS THE MOST VALUABLE THING HERE.**
> I reported to Max that Instrument C had found "a real lab/game difference in terrain noise scale on
> 133 planets". **Instrument C never differences the lab against the game.** Its own header states the
> constraint (`tools/port-uniform-delta.mjs:24-30`): *"EVERY comparison this tool makes is
> SAME-TREE-BEFORE vs SAME-TREE-AFTER, on the SAME BODY RECORD — the game route measured against
> itself across a code change. It is NEVER lab-vs-game."* `measure()` reads
> `planet.surface.material.uniforms` and nothing else. My framing was wrong, and a session spent
> "converging" that row would have been chasing a defect that does not exist.
>
> ⚠ I put a lens in the workflow whose only job was to kill this finding. It did. That is why it was
> worth the tokens — see [[feedback_converge-dont-declare-divergence]] and the measure-then-propose
> discipline this program keeps re-learning.

## The three facts my framing collapsed into one

| # | Fact | Status |
|---|---|---|
| 1 | `uNoiseScale` moved on 133/592 bodies, Δ ∈ [−7.2285, 0] | **Real, CORRECT BY DESIGN.** `b0c0cda` deliberately moved the tidal term from frequency to amplitude; the capture (`87e678f`, 2026-08-21) predates it by five days. Not a bug. |
| 2 | 41 body records changed · +27 moons · draw profile moved on 28 seeds | **Real, UNEXPLAINED, and Instrument B is RED on it.** This is the actual blocker. |
| 3 | Lab writes `uNoiseScale 4.0` / `uCoarseCut 0` by default; game writes `2.8736` / `coarseReliefCut(cond)` — **1.392× apart** | **A REAL lab/game divergence — and Instrument C is structurally incapable of seeing it.** Under Max's converge ruling this is debt. |

⭐ **The one-sidedness is fully explained.** The old `macroWavelengthKm` multiplied by
`macroShortening(t)`, bounded in `(SHORT_FLOOR, 1]`, which only ever SHRANK the wavelength. Frequency
is inversely proportional to wavelength, so the new value is ≤ the old on every body, and exactly
equal on the 459 with no tidal heat. Δ ≤ 0 always, by construction.

⛔ **NEVER CITE INSTRUMENT C IN A CONVERGE ARGUMENT.** It measures the game against its own past. The
tools that answer converge questions are `tests/one-pipeline-fence.test.js` and the lab's A/B keys.

---

## FACTS I VERIFIED MYSELF (this session, read-only)

Ran: `node tools/port-uniform-delta.mjs --check`, `--selftest`, `npm run port-uniform-delta:citations`, `npx vitest run --dir tests body-identity-fence.test.js`, plus `git diff 87e678f..HEAD -- src/worldengine/base/macroWavelength.js`, `git merge-base --is-ancestor 87e678f b0c0cda`, and direct reads of `tools/port-uniform-delta.mjs`, `world-engine-lab.html:2076/2880/5359/5566`, `src/worldengine/shaders/uniforms.js:10`, `src/worldengine/drivers/rockySurface.js:268`.

Confirmed:
1. **`measure()` reads only the game.** `tools/port-uniform-delta.mjs:805-806` — `const u = planet.surface.material.uniforms;` after `new Planet(b.rec)`. No lab value is ever differenced. Header lines 24-30 state this as the tool's one constraint. **Instrument C cannot report a lab/game divergence. The premise of the investigation as framed is dead.**
2. **The capture predates the law change.** Capture `recordedAtGit.sha = 87e678f…` (dirty), 2026-08-21. `b0c0cda "Tidal drive moves from FREQUENCY to AMPLITUDE"` is 2026-08-26 and `git merge-base --is-ancestor 87e678f b0c0cda` exits 0. HEAD = `4e804db`.
3. **The diff is exactly the shortening removal.** `- return K_MACRO_R * macroShortening(t) * c.radiusEarth * R_EARTH_KM;` → `+ return K_MACRO_R * c.radiusEarth * R_EARTH_KM;` and `MACRO_FREQ_CEIL` simplified to `C_MACRO / K_MACRO_R`. Algebraically the radius cancels in `featureFrequencyFromKm`, so the new game value is the constant `(1/0.3)/1.16 = 2.8735632…` for every non-gas body. `−7.22853` off `10.10209…` lands exactly there. Sign is one-sided because shortening was bounded in `(SHORT_FLOOR, 1]` and only ever shrank λ.
4. **The run's structural break has THREE causes, and only one was in the brief:**
   - `⛔ WATCHED-UNIFORM SET CHANGED since the capture: added (+2): uCoarseCut, uProvinceWeight`
   - `⛔ POPULATION MISMATCH … record changed : 41  e.g. S:00003:p3, S:00009:p4, …`
   - composition drift (descriptive only, does not count toward `structural`)
5. **Instrument B is RED right now** — `npx vitest run --dir tests body-identity-fence.test.js` → 3 failed / 5 passed:
   - `DRAW STREAM: draw profile moved on 28 seed(s)`
   - `BODY IDENTITY: expected { planets: 961, moons: 821 } to deeply equal { planets: 961, moons: 794 }` (+27 moons)
   - `RECORD SHAPE: planetClass records 24 → 51` (+27)
   This is unblessed and unexplained. It is the source of C's 41-body population mismatch.
6. **`--selftest` is GREEN (exit 0)** and does not read the capture — it measures the same population twice in-process. That makes it the only currently-trustworthy arm of the instrument.
7. **The citation fence is green: `all 848 symbol-anchored citations resolve … Exit 0`**, and citations land on tool lines 118, 168, 508, 529, 674, 735, 756, 758, 943, 952, 964, 972, 1023, 1086, 1090, 1093, 1154, 1565, 1628, 1685, 1697, 1872, 2054, 2066. **Any line insertion above 2066 breaks a citation.** Every edit below is line-neutral.
8. **`TIER_BY_NAME` (declared :676) is a plain `const` object — not frozen.** Nothing in the file calls `Object.freeze`. This is what makes the control in Deliverable 2 possible without a signature change.
9. **Headline reporting bug, real:** `:1933  console.log(\`  bodies compared        : ${stats.length ? stats[0].compared : 0}\`);` — `stats` is built in `nowSet` order, unsorted, so the verdict prints the *first* uniform's population (232, a legacy-only row) while `uNoiseScale` compared 592.
10. **The lab/game divergence is real and covers TWO uniforms, not one.** `world-engine-lab.html:5359` is one line containing both `uniforms.uNoiseScale.value = (state.abNoiseScale && state._abNoiseScaleGame > 0) ? state._abNoiseScaleGame : 4.0;` **and** `uniforms.uCoarseCut.value = state.abNoiseScale ? (state._abCoarseCut || 0) : 0.0;`. `grep -c localStorage world-engine-lab.html` = 0 and `state.abNoiseScale` has no initializer (occurrences only at :2076 badge, :5359 ×2, :5566 toggle) — so default-off is deterministic on every load. Default lab = `uNoiseScale 4.0`, `uCoarseCut 0`. Default game = `2.8736`, `coarseReliefCut(condition)`. Ratio on the frequency: **1.392×**.

Not verified by me: whether the +27 moons are intended; whether `--capture <path>` accepts an arbitrary path (I read it in the usage string at :892, did not exercise it); the lab's rendered value in a browser (source reading only).

---

# DELIVERABLE 1 — THE uNoiseScale DRIFT

## a) VERDICT

**The premise is refuted. This is not a lab/game divergence, and it is not a defect. It is a stale baseline reporting an intended, already-committed law change — and it is sitting on top of a *different*, genuinely unblessed regression that the framing did not mention.**

Three separate things are true and were being collapsed into one:

| # | Fact | Status |
|---|---|---|
| 1 | `uNoiseScale` moved on 133/592 bodies, Δ ∈ [−7.2285, 0] | **Real, correct-by-design.** `b0c0cda` deliberately moved the tidal term from frequency to amplitude. Capture predates it by 5 days. Not a bug. |
| 2 | The population moved: 41 body records changed, +27 moons, draw profile moved on 28 seeds | **Real, unexplained, Instrument B is RED.** This is the actual open finding. |
| 3 | Lab writes `uNoiseScale 4.0` / `uCoarseCut 0` by default; game writes `2.8736` / `coarseReliefCut(cond)` | **Real divergence, invisible to Instrument C.** Under Max's converge ruling this is debt. |

Item 1 is what the instrument reported. Item 2 is what it *also* reported and what actually blocks. Item 3 is what the investigation was framed around and Instrument C is structurally incapable of seeing.

The valuable outcome here is the refutation: **Instrument C never differences the two front-ends. Do not use it to answer converge questions, ever.** The place that answers converge questions is `tests/one-pipeline-fence.test.js` and the lab's own A/B keys, not this tool.

## b) WHAT SHOULD CHANGE

### For item 1 (correct-by-design) — re-tier, then re-record at a clean commit

The tier is wrong and that is a real instrument defect, independent of everything else.

`tools/port-uniform-delta.mjs:705` currently reads:
```
  uNoiseScale: 'record',      // d.noiseScale             — Planet.js:1681 `uNoiseScale`
```
`Planet.js:1681` is the **legacy** branch. Since B7 flipped `LAB_GAS_BODIES_DEFAULT = true`, essentially every admitted body never reaches it — the shipped value comes from `rockySurface.js:268 sizeKm(macroWavelengthKm(condition), C_MACRO)`, i.e. condition-derived. In the capture, 262 rows carry both `noiseScale` and `uNoiseScale` (legacy, byte-identical) and 371 carry `uNoiseScale` only (lab surface). All 133 movers are in the lab-surface set.

Consequence of the wrong tier, visible in today's output: `uNoiseScale` appears in the `⚠ THE POPULATION MOVED, so the 21 rows at tier \`record\` are NOT evidence of stability` list *while being the one row that moved*. The caveat and the finding contradict each other on the same page.

**Line-neutral edit** (`:705`, append before the first `//`):
```
  uNoiseScale: 'condition',   // ⭐ RE-TIERED 2026-08-27, was 'record'. The cited legacy branch Planet.js:1681 `uNoiseScale` is DEAD for admitted bodies since B7 (LAB_GAS_BODIES_DEFAULT = true, Planet.js:2158): the shipped value comes from src/worldengine/drivers/rockySurface.js:268 `sizeKm(macroWavelengthKm(condition), C_MACRO)`, i.e. the condition, not a drawn field. MEASURED in the 87e678f capture: 262 rows carry both `noiseScale` and `uNoiseScale` byte-identical (legacy material) and 371 carry `uNoiseScale` alone (lab surface); all 133 movers were in the latter. Tiering it 'record' put it on the "NOT evidence of stability" caveat list at the same time as it was the only row that moved.
```
Breaks: only the printed TIER column and the caveat membership. `tier` is display-only — grep confirms it is read at :629 (assign), :1627 (`--list` grouping) and the table/caveat printers, and appears nowhere in `measure()` or `statsFor()`. It cannot create or suppress a delta.

### Ordered steps

1. **Re-tier `uNoiseScale` → `'condition'`** (edit above). Run `npm run port-uniform-delta:citations` — expect 848 still resolving.
2. **Fix the headline bug at `:1933`.** Line-neutral: `console.log(\`  bodies compared        : ${stats.length ? Math.max(...stats.map((s) => s.compared)) : 0}\`);` — the max over rows, so a 232-body legacy row can never understate a 592-body one. Breaks: nothing; it is a print.
3. **Resolve Instrument B first.** `npx vitest run --dir tests body-identity-fence.test.js` is red for +27 moons and 28 moved draw profiles. Either explain and re-bless (`npm run test:body-identity:rebless`) or fix. **Until B is green, step 4 is forbidden.**
4. **Only then**, at a clean (non-dirty) commit: `npm run port-uniform-delta:record -- --force`, in a commit whose message names all three moves — the b0c0cda law change, the +2 watched uniforms (`uCoarseCut`, `uProvinceWeight`, which are currently *not in the capture at all* and therefore not being gated), and whatever B's +27 moons turn out to be.
5. **Item 3 is a separate workstream.** The lab/game `uNoiseScale`/`uCoarseCut` gate at `world-engine-lab.html:5359` needs Max's eye on the [N] key, then the losing arm deleted. Do not bundle it with the instrument work — it moves lab pixels, the instrument work does not.

## c) ⚠ WHAT MUST NOT BE DONE

**Do not run `port-uniform-delta:record` today.** It would not bless the `uNoiseScale` move (that is a legitimate, declared law change) — but it *would* silently freeze a population that Instrument B currently rejects. The 41 changed records, the +27 moons and the 28 moved draw profiles would become the new baseline, and the tool prints `⭐ This is Instrument B's finding surfacing here. Fix or bless it there first.` for exactly this reason. That is the one irreversible mistake available here.

**Do not reach for `--allow-deltas` to get past this.** Verified by code order at `:2064-2071`: the `if (structural)` branch runs first and `process.exit(2)` before `--allow-deltas` is ever consulted. The in-source note at `:738` says the same. `--allow-deltas` cannot rescue a structural break, by design.

**Do not "fix" `macroWavelengthKm`.** The removed shortening term is the deliberate output of `b0c0cda`, with its reasoning written into the file. Reverting it re-creates the 27-km-features-on-a-2032-km-world problem Max caught by eye.

**Do not cite Instrument C in any converge argument.** It measures the game against its own past. `tests/vis-scale-fence.test.js:206` still lists `uNoiseScale` in its permissive `ALLOW` set from 2026-08-25, when the lab arm still carried `* sVis`; that multiply was deleted on 2026-08-26. The entry is stale-but-passing and is the one thing in the repo that would license an "it's the display scale" answer. It is wrong now. Worth removing in the same pass as step 1, but it is not load-bearing.

---

# DELIVERABLE 2 — HARDENING INSTRUMENT C

## a) THE DESIGN

**A uniform with no tier is a coverage gap in exactly one row. It is not a reason the other 55 rows cannot be compared.**

Today `resolveSharedUniforms` throws at `:630` on such a name. The throw is uncaught (grep confirms zero top-level `try`/`catch` and zero `process.on('uncaughtException')` in the file), Node prints a bare stack and exits **1** — the *same* code the tool deliberately uses for "shipped uniforms moved" at `:2076`. A dead instrument and a firing instrument are indistinguishable from the outside. This has now happened twice: `uProvinceWeight` (2026-08-25) and `uCoarseCut` (b0c0cda, found 2026-08-27).

There is a second, worse property I verified: **the completeness fence at `:596-606` does not catch this case.** `const classified = new Set([...nameMatched, ...aliasGames, ...onlyGames, ...UNWATCHED.map(...)])` folds in `nameMatched` wholesale with no `TIER_BY_NAME` membership test. So a new name-matched uniform passes the loud, banner-printing, exit-2 fence and dies four lines later on a bare `throw`.

New behaviour:

- **Drop** the untiered name from `watched` and from `shapes`, record it in `RES.untiered`.
- **Print a loud banner** naming every untiered uniform and what to do about it — modelled on the existing `⛔ INSTRUMENT C: THE UNIFORM MAP IS OUT OF DATE.` banner, which already collects all problems and reports them together.
- **Compare everything else normally.** The table prints; the other 55 rows keep their evidential value.
- **Exit non-zero on `--check`** — new code **4**, "coverage gap". Not 0, because a uniform escaping its gate is the `uWeatheredColor` failure this whole map exists to prevent. Not 1 or 2, because a reader must be able to tell "a value moved" from "a row is missing".
- **`--record` writes `untiered` into the capture** so the gap is durable and shows up as a diff next time. It still succeeds — recording is an explicit human act — but it prints the banner.
- **Ordering on `--check`**: structural (2) → coverage gap (4) → moved (1). All three banners print regardless of which exit code wins, so nothing is textually hidden by the ordering.

Alternative if you would rather not touch the exit-code contract: reuse exit **2**. Defensible — dropping a name genuinely shrinks the watched set, which is a basis change. I prefer 4 because "the basis changed" and "I am blind to one row" are different instructions to the reader. Your call; the edits differ by one integer.

## b) EXACT EDITS, BY SYMBOL

**All six are line-neutral: one line in, one line out, every new statement placed BEFORE the first `//` on its line.** No `//` currently exists on any of the target lines except where noted.

### Edit 1 — `resolveSharedUniforms`, the `const shapes = {};` declaration
```
  const shapes = {};   const untiered = [];
```
*Breaks:* nothing. New local.

### Edit 2 — `resolveSharedUniforms`, the `if (!gk) throw …` guard
```
    if (!gk) { untiered.push({ n, why: 'unrecognised value shape on the production material' }); continue; }
```
*Breaks:* a uniform whose value shape `kindOf` does not know now vanishes from the table instead of stopping the run. That is the intended trade, and it is reported. Risk: if `kindOf` ever regresses across many names at once, you would see a long untiered list rather than a crash — which is the louder, more diagnosable failure.

### Edit 3 — `resolveSharedUniforms`, the `if (!tier) throw …` guard
```
    if (!tier) { untiered.push({ n, why: 'name-matched but absent from TIER_BY_NAME — add it IN THE COMMIT THAT ADDS THE UNIFORM' }); continue; }
```
*Breaks:* this is the named mechanism. After this, a new uniform is **reported and excluded**, never fatal.

### Edit 4 — `resolveSharedUniforms`, the return object's `shared:` line
```
    shared: watched.filter((n) => !untiered.some((x) => x.n === n)),   untiered,
```
*Breaks:* `RES.shared` shrinks when a gap exists. Every consumer (`measure`, `compareAndReport`, `--list`, `runSelftest`) already treats `RES.shared` as the authority, so they follow automatically. **Verify:** `compareAndReport` intersects `nowSet` against `capIdx`, so a name present in the capture but dropped now simply does not get a row — no crash. I read that path; I have not executed it with a synthetic gap. The control in (c) is what proves it.

### Edit 5 — `resolveSharedUniforms`, `counts.shared` line
```
      shared: watched.length - untiered.length,
```
*Breaks:* only the `--list` header arithmetic. Without it the printed count contradicts the printed set.

### Edit 6 — the module-level `const RES = …` line (`:1681`)
```
const RES = resolveSharedUniforms(probeU);   if (RES.untiered.length) { console.error('⛔ INSTRUMENT C: COVERAGE GAP — ' + RES.untiered.length + ' watched uniform(s) have no tier and were EXCLUDED from the comparison. Every other uniform below is still measured and still trustworthy.'); for (const g of RES.untiered) console.error(`   ${g.n}: ${g.why}`); console.error('   ⛔ THIS USED TO BE A BARE THROW, AND A THROWN INSTRUMENT READS EXACTLY LIKE A PASSING ONE — uProvinceWeight killed it on 2026-08-25 and uCoarseCut re-killed it in b0c0cda, both unnoticed. Fix TIER_BY_NAME in tools/port-uniform-delta.mjs, then re-run.'); }
```
*Breaks:* the banner prints on **every** mode including `--list` and `--check-citations`. That is deliberate — the gap is a property of the map, not of the mode. It goes to `stderr` so it cannot be mistaken for table content.

### Edit 7 — the `--check` structural block's closing brace (`:2070`, currently a bare `}`)
```
}   if (RES.untiered.length) { console.log(''); console.log(`RESULT: COVERAGE GAP (4) — ${RES.untiered.length} uniform(s) had no tier and were not compared: ${RES.untiered.map((g) => g.n).join(', ')}. Every other row above IS a real reading. Exit 4.`); process.exit(4); }
```
*Breaks:* `npm run check:instruments` goes red on a coverage gap (it treats any non-zero as failure). Correct. **You must also append the new code to the header's exit-code block at `:20-23`** — line-neutral, append `· 4 coverage gap (an untiered uniform was excluded)` to the existing text on one of those lines, before its content wraps.

### Edit 8 (optional, different throw site) — `measure`, the `const v = sharedNames.map(…)` line (`:806`)
```
    let v; try { v = sharedNames.map((n) => (n in u ? flatten(u[n].value) : null)); } catch (e) { failures.push({ id: b.id, error: 'flatten: ' + String(e && e.message || e) }); continue; }
```
*Breaks:* `v` becomes `let`. Reuses the existing `failures` idiom two lines above (which already guards `new Planet(b.rec)` and was simply never extended past it), so a bad cell is counted as a build failure — and `compareAndReport` already treats a *change* in failure count as a structural break at `:1885-1890`. Zero new machinery.

**Deliberately NOT edited:** `toSceneData`'s throw at `:188` and its three unguarded call sites (`:212`, `:228`, `:257`). Wrapping those line-neutrally is fiddly and it is not the mechanism that killed the instrument twice. The G-stratum at `:244-251` already shows the right idiom if you want it later. Also not edited: the unguarded `JSON.parse` at `:2050` — a corrupt capture is genuinely fatal to `--check` and has no meaningful "continue", though it deserves the `loadOrExplain` treatment eventually.

## c) ⭐ THE CONTROL

The control must show both halves. It goes in `runSelftest`, which is the right home for three reasons I verified: it is currently **green (exit 0)**, it does **not read the stale capture** (it measures the same population twice in-process), and it already owns exit code 3 with a `problems`-array reporting path.

### Arm 1 — an untiered uniform is VISIBLE, not fatal (runnable today)

`TIER_BY_NAME` is a plain unfrozen `const` object at `:676`. So the control poisons the real map, calls the real function, and restores — no synthetic uniform, no signature change, no test-only parameter. It exercises the exact production path.

**Line-neutral edit** to `runSelftest`'s `const problems = [];` line:
```
  const problems = [];   const CTL = 'uMacroOffset'; const _savedTier = TIER_BY_NAME[CTL]; delete TIER_BY_NAME[CTL]; let _gapRes = null, _gapThrew = null; try { _gapRes = resolveSharedUniforms(probeU); } catch (e) { _gapThrew = String(e && e.message || e); } finally { TIER_BY_NAME[CTL] = _savedTier; } if (_gapThrew) problems.push(`UNTIERED CONTROL: removing ${CTL} from TIER_BY_NAME still THREW (${_gapThrew}) — an unclassified uniform is still fatal and still reads like a pass`); else if (!_gapRes.untiered.some((g) => g.n === CTL)) problems.push(`UNTIERED CONTROL: ${CTL} was not reported in RES.untiered — the gap is INVISIBLE, which is worse than fatal`); else if (_gapRes.shared.includes(CTL)) problems.push(`UNTIERED CONTROL: ${CTL} has no tier but is still in the watched set — it would be compared with an undefined tier`); else if (_gapRes.shared.length !== RES.shared.length - 1 || RES.shared.filter((n) => n !== CTL).some((n, i) => n !== _gapRes.shared[i])) problems.push(`UNTIERED CONTROL: one untiered uniform cost ${RES.shared.length - _gapRes.shared.length} row(s); it must cost exactly 1 and leave the rest byte-identical`); else if (Object.keys(_gapRes.shapes).some((n) => _gapRes.shapes[n].tier !== RES.shapes[n].tier)) problems.push('UNTIERED CONTROL: a surviving uniform changed tier when a different one was dropped');
```

**And a ✓ line**, appended to the existing `console.log('  RESULT: the gate bites. Exit 0.');`:
```
  console.log(`  ✓ ${CTL} with its tier deleted → REPORTED in RES.untiered, excluded from the table, and the other ${_gapRes.shared.length} rows compared unchanged (was a bare throw that exited 1, indistinguishable from a pass)`);   console.log('  RESULT: the gate bites. Exit 0.');
```

Four independent assertions, each of which fails through the existing `problems` → exit 3 path:
- **did not throw** — the fatality is gone
- **appears in `untiered`** — the gap is visible (this is the assertion that stops the "fix" from being a silent `catch {}`)
- **not in `shared`** — it is genuinely excluded, not compared with `tier === undefined`
- **costs exactly one row, and the survivors' tiers are byte-identical** — the fix did not eat the rest of the table

Use `uMacroOffset` and not `uNoiseScale` as `CTL`, so the control does not entangle with Deliverable 1's re-tier.

**Liveness check on the control itself** (`identical-output-needs-a-liveness-probe`): before trusting it, sabotage it — comment out the `delete TIER_BY_NAME[CTL];` and confirm `--selftest` then fails with `UNTIERED CONTROL: uMacroOffset was not reported in RES.untiered`. A control whose poison never lands prints the same silence as a passing one; that is the specific failure this repo has hit three times in `world-engine-lab.html` alone.

### Arm 2 — the instrument still fails on things that genuinely invalidate a comparison

⚠ **These arms are currently VACUOUS and must not be run as evidence yet.** `--check` exits 2 today from the pre-existing population mismatch and watched-set change, so any doctored-capture run also exits 2 for reasons that have nothing to do with the doctoring. **Run Arm 2 only after step 4 of Deliverable 1** (clean re-record, `--check` exiting 0 on an unmodified tree). Until then, Arm 1 is the whole control.

Post-re-record, using `--capture <path>` on temp copies (no source edits, nothing in the repo touched):

| Arm | Doctoring | Expected |
|---|---|---|
| 2a | flip one character of one row's `fp` | exit **2**, `POPULATION MISMATCH — record changed : 1` |
| 2b | perturb one captured `uNoiseScale` value by `1e-9` | exit **1**, that row and only that row moved; then exit **0** with `--allow-deltas` |
| 2c | delete one name from the capture's `uniforms` array | exit **2**, `WATCHED-UNIFORM SET CHANGED` |

2a proves the basis check still bites, 2b proves value detection is still tolerance-free and that `--allow-deltas` still only relaxes *values*, 2c proves the set check still bites. Together with Arm 1 they separate "I am blind to one row" (4) from "the basis moved" (2) from "a value moved" (1) — three distinct instructions, three distinct codes.

*Caveat I have not closed:* I read `[--capture <path>]` in the usage string at `:892` but did not exercise it against a temp path. Confirm it before relying on Arm 2.

### After every edit
`npm run port-uniform-delta:citations` — must still print `all 848 symbol-anchored citations resolve … Exit 0`. If it drops below 848, an edit added a line. And read the edited lines back with `sed -n 'NNNp'` to confirm every new statement sits **before** the first `//` — the trap that has killed six changes in this repo, three of them on `world-engine-lab.html:5359` alone, each time with every headless gate staying green.

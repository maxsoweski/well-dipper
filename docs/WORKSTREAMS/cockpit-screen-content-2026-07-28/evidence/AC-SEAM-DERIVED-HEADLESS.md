# AC-SEAM-DERIVED — the headless half, run against lane E's CURRENT cockpit

**2026-07-28.** Lane F, `feature/cockpit-screens`. Not the full AC — that one is live
and needs the panel host. This is the falsification half that can be run today, and it
is the half that actually matters, because it is the one a hard-coded implementation
fails.

## The question

AC-PANEL-BINDING and AC-UV-ORIENTATION both say lane F writes down nothing about how
big a screen is or what shape it is — that it comes off whatever model is loaded. A
suite that only ever sees ONE model cannot tell a derived implementation from a
hard-coded one, because the hard-coded numbers are right for that model by
construction.

Lane F's own worktree carries the **older** cockpit: display faces `0.450 x 0.300 m`,
aspect **1.500 (3:2)**. Lane E's current alpha at `adeecd5` is `0.240 x 0.200 m`,
aspect **1.200 (6:5)** — a face area of `0.0480 m²`. The **aspect changed**, so a panel
authored against 3:2 does not merely come out small on the new cockpit; it comes out
**stretched**. That makes the two models a genuine A/B.

## What was done

```
git checkout adeecd5 -- public/assets/cockpit/     # lane E's current, committed, clean
npx vitest run src/cockpit/__tests__/
git checkout HEAD -- public/assets/cockpit/        # reverted, see below
```

No lane-F source or test was edited between the two runs. That is the whole point:
one unedited host, two different cockpits.

## Result

**All seven lane-F test files passed unchanged against the 6:5 model.** The screens
were re-measured off the new mesh, the four roles bound to the new nodes, the UV
orderings held per vertex, and Max's all-four-monitors-identical ruling held on a model
nobody had checked it against. Nothing needed a number changed.

That is the derivation property demonstrated rather than asserted.

## Why the assets were then reverted

Lane E's **own** `tests/cockpit-geometry.test.js` — the copy carried in this worktree,
which dates from lane F's branch point — fails 9 tests against lane E's current assets:

| Failure | Cause |
|---|---|
| node inventory not as expected | `Sill_L` is gone, `Dash_Shelf` was added |
| `Sill_L` not found | same |
| `Screen_UL display face is 0.0480 m², floor is 0.0900 m²` | the face shrank past that older floor |
| sidecar objects array mismatch | the part list moved with the model |

**None of this is a lane-F defect and none of it is a lane-E defect.** Lane E evolves
its test and its assets together; pulling only the assets takes half a matched pair.
Keeping them would have left lane F's branch with 9 red tests and broken
AC-BASELINE-GREEN, so the sync was reverted and the evidence recorded here instead.

Bringing lane E's cockpit into lane F properly is a **merge of `feature/cockpit`**, and
per Max's plan that belongs to the third, integration workstream — not to lane F.

## One thing to carry to lane E

Lane E's older test asserted a display-face floor of `0.0900 m²`, its comment citing
Max asking for a panel ~50% bigger than the old `0.3 x 0.2`. The current model ships
`0.0480 m²` — about **half** that floor. Presumably their current test relaxed it along
with the re-proportioning, so this is very likely intentional and already agreed. But
it compounds with the known legibility budget (the screens subtend 17.06° / 18.32° at
the eye, down from 21.5°), and lane F has to choose a type scale that reads at 17° of a
70° FOV. Worth one sentence of confirmation from lane E before the type scale is set.

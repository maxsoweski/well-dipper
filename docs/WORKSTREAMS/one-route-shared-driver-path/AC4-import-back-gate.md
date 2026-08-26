# AC4 — the import-back gate, and the hole it actually closes

**Landed:** 2026-08-22 · **Home:** `tests/one-pipeline-fence.test.js`, registration **2b**
**Fixture:** `tests/fixtures/broken-control-pack/new-unimported-pack/`

---

## The hole, stated as a mechanism rather than a policy

Registration 2 already caught a diverging module. It offered the author two ways out: import it back,
or add a debt row. **The second way out is the one that must not exist for packs** — it is exactly
what the seven rows in `IMPORT_BACK_DEBT` record having happened seven consecutive times.

And that route was about to re-open. The ledger's ceiling was `<=`, not `==`:

> the liveness test deletes a cleared row → length drops 11 → 10 → the ceiling stays 11 → a free
> slot now sits there for the next pack, and **nothing reds**.

Clearing rows is the stated purpose of the work in flight. So the hole opens **on success** — the
worst moment to discover it, and the moment nobody is looking for a regression.

## Two laws, separate because they fail differently

| law | what it stops |
|---|---|
| **The roster is CLOSED** — seven packs grandfathered by name; any other file under `src/worldengine/drivers/` must be in the lab's import closure | a NEW pack shipping unimported. No ledger row can buy it in. This is AC4 verbatim. |
| **The ledger has NO SLACK** — `IMPORT_BACK_DEBT_CEILING` must EQUAL the ledger length | a cleared row leaving an unearned slot behind it |

⛔ **The roster is NOT derived from the debt ledger, and that is the whole mechanism.** Deriving it
would mean adding a debt row also extends the roster — the hole, re-opened by the fix for it. It is
a frozen list, asserted to be a SUBSET of the ledger so the two cannot disagree, and asserted LIVE
so an entry the lab has since imported is deleted rather than left standing as cover.

## Evidence it bites — executed, not asserted

- ⭐ **The control was executed RED before the scanner existed** (`ReferenceError: unimportedNewPacks
  is not defined`), then RED against the fixture, then green. A pass with no failing control is worthless.
- ⭐⭐ **AND IT WAS PROVEN ON THE REAL TREE, NOT ONLY THE FIXTURE.** A probe pack was dropped into
  `src/worldengine/drivers/` and registration 2b went red naming `src/worldengine/drivers/__probeDeck.js`
  with the full remediation message. Probe deleted. This is the check §6 of the 08-22 handoff demands:
  four instruments in this workstream were broken rather than the thing they measured, and every one
  was caught by making the instrument fail on a known case first.
- **Both directions.** The fixture ships `lab-stub-broken.html` AND `lab-stub-fixed.html`, so the
  control asserts the transition — AC4's observable ends *"Restoring the import returns it to green."*
  A fence that can only be shown to go red has not been shown to be about anything.
- **The roster cannot be quietly extended.** The non-vacuity control drives the same scanner with an
  EMPTY roster and pins exactly the seven. A newcomer added to the roster reds that control too.

## Gates at the landing commit

| gate | value |
|---|---|
| Instrument A | **membership drift is ONE line — `one-pipeline-fence.test.js: 23 → 31`.** 341 files, 6 failing, 15 non-collecting, **31 failed — all unchanged. No NEWLY RED.** |
| Instrument C | ZERO delta on all shipped shared uniforms, exit 0 |
| Citations | **815, exit 0 — CHECKED ROSE from 814** (the two new refs were authored in checked form) |
| Fence suites | 176/176 across the 5 named suites |
| `Planet.js` / `world-engine-lab.html` | **2304 / 6559 — neither file touched.** No citation event. |

## What AC4 does NOT do

- It moves **no pixels** and needs **no ruling from Max**.
- It does **not** clear the seven existing rows. Those clear through AC2/AC5 conversions; this gate
  only guarantees the count can never grow past them.
- It says nothing about **non-pack** modules entering as debt. That stays possible — but the
  no-slack law makes it a deliberate, visible ceiling edit instead of a silent slot fill.

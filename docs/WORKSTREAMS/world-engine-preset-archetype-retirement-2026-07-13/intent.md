# world-engine-preset-archetype-retirement — intent

## Why we care (Max's words, carried from the V2-3 scoping 2026-07-11)

> The name tag stops being load-bearing. After this, what a world looks like comes from its
> derived conditions, and the archetype is just a diagnostic label — the condition-first bet
> is live in the real dispatch, not just the lab.

V2-3 made that true for every production/lab path but left the old archetype chain in the tree
as an enumerated migration bridge, "deleted only after post-V2-3 verify + my UAT." Both halves
of that trigger are now satisfied (verify green 2026-07-13 morning; Max's 17-preset UAT sweep
passed 2026-07-13). This workstream is the promised deletion: the old routing actually gone,
not just bypassed — so no future increment has to keep a second, legacy dispatch byte-safe.

**Orientation:** serves the JOURNEY world-engine objective ("condition combinations produce
predicted-but-never-observed landforms") by closing the condition-first flip's last debt;
PLAYER_EXPERIENCE-wise still lab-only by charter (screensaver sees this at V2-10 game-port).

## Success criteria (Max's language, from the V2-3 contract clauses he greenlit + UAT'd)

- The old routing is deleted, not bypassed: the migration bridge in `writeBodyRelief`, the four
  label-keyed dispatch predicates (`isEarthlikePlatePath` / `isShellReliefPath` /
  `isVolcanicPath` / `isStagnantLidPath`), and the bridge-tune gate go together, one seam.
- Nothing changes anywhere he can see — byte-provable: the 83/83 byte-identity goldens pass
  UNCHANGED (never re-captured), quartet green, full suite exactly at baseline.
- `PRESET_ARCHETYPE` itself SURVIVES for radius selection (the V2-3 garble-test adjudication:
  retirement = the dispatch bridge only, not the radius map).
- The tests that leaned on the old chain — the ~8 condition-less callers and the oracle suites
  that compose the legacy chain from the exported predicates — are migrated/re-anchored
  openly, enumerated in the build plan, never silently.
- The `lidResponse.js` degenerate-ternary minor (pre-existing V2-2a,
  `... ? STRONG_REGIME : STRONG_REGIME`) is folded in, as the V2-3 verifier logged.

## DOES / UNLOCKS (Rule 15 card)

**DOES:** deletes the condition-less archetype chain (migration bridge) from `writeBodyRelief`,
the four label-keyed dispatch predicates + `VOLCANIC_ARCHETYPES` set, and the V2-5s bridge-tune
gate; pins one explicit, tested behavior for condition-less input (loud throw — a missed caller
fails immediately, never misroutes silently); migrates the ~8 condition-less test call sites to
condition-bearing bundles that route to the same writer with the same args; re-anchors the four
predicate-composing oracle suites (dispatch-oracle `writer_today`, e1-conformance-oracle,
lid-classifier, v2-3-taxonomy) to pinned expectations; folds the lidResponse degenerate ternary.

**UNLOCKS:** a single routing path — every later increment (V2-4 substrate, V2-5 bombardment,
V2-7 epochs, V2-8 sculpting, atmo #3b, V2-10 game-port) keys on ONE dispatch with no legacy
chain to keep byte-safe; ends double-maintenance of routing semantics.

## Deliberate non-goals (fences)

- `PRESET_ARCHETYPE` map + radius plumbing: untouched (radius selection is its surviving job).
- `shellRegimeOf` / `stagnantLidRegimeOf` stay exported from their writer modules (test oracles
  may keep using them); only their production-dispatch consumption in `planet-lod-rivers.js` dies.
- Zero expression/writer changes; zero lab-GUI changes; no game-port wiring.
- The 4 pre-existing known suite failures (KnownObjects ×3, GalacticFeatures ×1) are not
  touched and must not grow.

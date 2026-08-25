# This directory is VENDORED, not a submodule — 2026-08-25

Upstream: `https://github.com/maxsoweski/motion-test-kit`
Vendored at upstream commit **`175a998`** — *"predicates: phase A screen-space — meshOnScreen,
meshAtViewportPosition, meshApparentSize, cameraNear"*. 55 files, 588K, copied with a clean upstream
working tree.

## ⛔ WHY, so nobody "tidies" it back into a submodule

It was a git submodule until 2026-08-25, and that made the PUBLIC SITE'S DEPLOY depend on a SECOND
repo's visibility flag. On 2026-08-25 the first `master` push in 24 days failed at
`actions/checkout@v4` — before `npm ci` or `npm run build` ever ran — with:

```
repository 'https://github.com/maxsoweski/motion-test-kit.git/' not found
clone of '...' into submodule path 'vendor/motion-test-kit' failed
```

The kit repo had gone PRIVATE, and `actions/checkout` authenticates with the default `GITHUB_TOKEN`,
which is scoped to well-dipper alone and cannot read another private repo (GitHub answers 404, hence
"not found" rather than "permission denied").

⚠ **THE FAILURE WAS INVISIBLE FOR AS LONG AS 12 DAYS.** `.gitmodules` and the workflow's
`submodules: recursive` were both already present at `6c4f49e`, the master that deployed fine on
2026-08-01; the kit repo was last touched 2026-08-13. Nothing deployed in between because master was
stale, so the push that closed a 790-commit merge is what FOUND the break. A deploy that can be
broken by an unrelated repo's settings, silently, is the failure MODE — vendoring removes it, rather
than removing one instance of it.

⭐ **THIS IS NOT TEST-ONLY TOOLING.** The production bundle imports it three times, so it cannot
simply be dropped from checkout — that turns a failed deploy into a failed build:

- `src/main.js:100-101` — `createAccumulator`, `bindToRAF`
- `src/objects/Planet.js:6` — `fnv1aString` (the 5d macroSeed shape)
- `src/util/scene-naming.js:20` — `fnv1aString`, `toHex`

`vite.config.js` aliases the bare specifier `motion-test-kit` to this directory; that alias is
unchanged by vendoring and is why no import site had to move.

## How to take an upstream change

There is no submodule pointer any more, so this is a copy-in: pull the kit repo elsewhere, copy its
tree over this directory excluding `.git`, update the commit named above, and re-run the build plus
`vendor/motion-test-kit/tests`. ⛔ Do NOT re-add it as a submodule without first solving the deploy
credential problem above — a deploy key or PAT in repo secrets, which did not exist on 2026-08-25
(`gh secret list` was empty).

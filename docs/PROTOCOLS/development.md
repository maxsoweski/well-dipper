# Development — Well Dipper

Build, run, deploy, common workflows, troubleshooting. Well-dipper
specifics; cross-project patterns linked (not pasted) per Rule 12.

## Stack

Vite + Three.js (vanilla JS, ES modules) + custom GLSL shaders.
Vendored `motion-test-kit` submodule at `vendor/motion-test-kit/`.

## First-time setup

1. **Install dependencies:** `npm install`
2. **Install git hooks:** `bash scripts/install-hooks.sh`
   - One-time. Required for Rule 8 pre-push rot check to fire.
   - Verify: `ls .git/hooks/pre-push` should resolve.
3. **(Optional) Configure rot-check thresholds:** see Troubleshooting
   §"Rot-check thresholds" for env vars.

## Dev server

```
cd ~/projects/well-dipper
npm run dev
```

Default port: **5174** (5173 often taken by other Vite projects).
URL: `http://localhost:5174/well-dipper/` (base path per
`vite.config.js`).

**Applies cross-project rule from `feedback_no-start-servers.md`** —
working-Claude does NOT autostart the dev server. Max runs in his
own terminal. If working-Claude needs the dev server up for testing,
ping Max with the exact command above.

## Build

```
npm run build
```

Output: `dist/`. Vite handles asset hashing + minification.

## Deploy

**Current hosting:** GitHub Pages at `wow.pjh.is/well-dipper/`
(deploys on every push to `master`).

**Planned hosting:** easymaking subdomain (migration scoped post-MVP).

**Applies cross-project rule from `feedback_deploy-established-sites.md`**
— well-dipper is on the established-deploy list. Push origin without
asking after Shipped flip. The Shipped commit IS the deploy commit.

**Applies cross-project rule from `feedback_push-on-shipped.md`** —
push immediately after Shipped flip; verify deploy succeeded.

Verification: GitHub Pages action completes ~30-60s after push;
`wow.pjh.is/well-dipper/` reflects the commit. Backstop:
`~/.local/bin/deploy-status.sh` daily cron writes drift to
`~/briefings/`.

## Common workflows

### Visual QA after edits

**Applies cross-project rule from `feedback_visual-qa-mandatory.md`** —
after any edit to a visual-scope file
(WarpEffect / WarpPortal / ShipSpawner / Planet / Moon / RetroRenderer /
SkyRenderer / ScaleConstants / main.js / *Effect* / *Shader* /
*Billboard*), take a chrome-devtools screenshot before reporting done.

### chrome-devtools on port 9223

**Applies cross-project rule from `feedback_prefer-chrome-devtools.md`** —
default to chrome-devtools MCP over Playwright. Same real-GPU output;
Playwright's CDP wedges regularly.

**Launch:** see `chrome-devtools-9223-launch.md` in Claude memory for
the second-Chrome launch pattern (Max's main Chrome stays on its own
profile; the MCP-target Chrome runs at port 9223 with a separate
user-data-dir).

### Lab mode

URL flag `?lab=1` + Shift+1..7 scenario keybinds. Used for visual
feature iteration.

### Audio mute for dev sessions

```javascript
localStorage.setItem('well-dipper-settings', JSON.stringify({masterVolume: 0}))
```

**Applies cross-project rule from `feedback_default-mute-audio-in-dev.md`.**

### Visual lab harnesses

For shader / rendering work, build a standalone `<feature>-lab.html`
harness first. See `PROTOCOLS/test-harnesses.md` §"Visual lab harness
pattern" for the full convention.

## npm scripts (project-local)

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server (port 5174) |
| `npm run build` | Production build to `dist/` |
| `npm test` | vitest unit tests |
| `npm run doc-rot` | Run all rot checks project-wide (also auto-fires on `git push`) |
| `npm run doc-rot --workstream <slug>` | Scoped rot check (Tester usage) |
| `npm run doc-graph` | Regenerate SYSTEMS.md dep graph |
| `npm run uat-status` | Roll up FEATURES.md rows waiting on Max UAT |
| `npm run mood-bootstrap` | Refresh MOOD/README.md Unannotated section from Pictures folder |

## Troubleshooting

### Stale modules after edits

**Applies cross-project rule from `feedback_vite-wsl2-stale-modules.md`** —
Vite on Windows + WSL2-edited files can serve stale module cache. Edit
lands but browser fetches old bytes. Verify with `fetch(...)` via
chrome-devtools `evaluate_script` before claiming the fix took. Fix:
restart `npm run dev`.

### Rot-check thresholds

`scripts/doc-rot-check.sh` reads env vars for tunable thresholds:

| Env var | Default | Purpose |
|---|---|---|
| `WELL_DIPPER_DOC_ROT_STALE_DAYS` | 30 | Stale deep dive threshold |
| `WELL_DIPPER_DOC_ROT_STUCK_DAYS` | 14 | In-flight without verdict threshold |
| `WELL_DIPPER_DOC_ROT_CONFIRM_DAYS` | 7 | shipped-code without shipped-confirmed |
| `WELL_DIPPER_DOC_ROT_BLOCK` | (unset) | If `true`, hard-block pushes on rot |

Set persistent overrides in your shell init OR run inline:
```
WELL_DIPPER_DOC_ROT_STALE_DAYS=60 npm run doc-rot
```

### Pre-push hook didn't fire

Run `bash scripts/install-hooks.sh` again. The installer:
- Checks `.git/hooks/pre-push` already exists (won't overwrite without
  asking)
- Copies `scripts/git-hooks/pre-push` into place
- Marks executable

Verify: `git push --dry-run` — hook should print rot summary.

### Doc-graph errors on Module(s) duplicate

`scripts/doc-graph.js` enforces Rule 10 strict 1-to-1 ownership. If a
file appears in two systems' `Module(s):` lines without a
`(scope: ...)` qualifier, generation fails with stderr message
naming the duplicate. Fix: either move the file to one system's
Module(s) OR add `(scope: methodName)` qualifiers to BOTH entries.

## Cross-references

- `PROTOCOLS/test-harnesses.md` — three-layer testing + visual lab pattern
- `PROTOCOLS/shipped-gate.md` — what counts as Shipped
- `PROTOCOLS/doc-updates-on-ship.md` — doc updates required before Shipped
- `PROTOCOLS/glossary.md` — project terminology
- Claude memory `feedback_*` files referenced above

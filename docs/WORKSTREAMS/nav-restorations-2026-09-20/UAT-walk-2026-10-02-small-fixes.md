# Small fixes from the 2026-09-30 walk — status (2026-10-02)

A–E built (`d918f66`, `43301cd`, `a2d3dd2`), Astra-reviewed (`.astra/jobs/20261002-125927-nav-walk-small-fixes-review`),
fixup `320e6d2`, all live-verified (incl. re-verify of the fixup). Pending Max's eye.

**RULING (Max, 2026-10-02) — GPS line to moons:** "Yes, the GPS line should also draw to moons, and again it should draw
from wherever the player is currently. I'm not sure how you make this work on the two-dimensional line view exactly, but
I'm sure you can figure it out. And check your ideas against Astra if you need a second opinion."
→ Queued after Phase 1 of naming-prism-segments (both edit the lab/designs). Line origin = the ship's actual position
in every look (design 1 ladder, design 2 orrery, legacy), endpoint = planet, moon or star.

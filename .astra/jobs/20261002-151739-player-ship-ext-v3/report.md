# Round 01 — complete

Provenance: tool output_hint selected `/home/ax/.codex/generated_images/01a0fe0c-fe59-7d92-9604-bc21a57d7abe/exec-07bb6e8c-ec40-49b4-bb20-47338ca566e0.png`; copied unmodified to `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png`. Verified byte equality; 1,430,596 bytes; 1944 × 809 pixels; SHA256 `750b20e293357fb39b6ec544e11b2c1c01c1074e24644de2ad1a6efdc19ed5e5`. Tool calls: 2 (initial generation + 1 edit). Initial prompt sent verbatim.

1. PASS: four named orthographic views, shared baseline, small three-quarter view and black silhouette. Scale assessed visually, not measured.
2. FAIL: figure labelled 1.8 m, LENGTH 18 m and all five part callouts present. The edit added BUBBLE but removed BUBBLE 2.6 m from the front view.
3. PASS: side and silhouette show a low head rising steeply into a high, bulky body; deck rolls and orange spine follow the climb.
4. FAIL: cockpit pillars, forward sockets, four recessed rear nozzles, modules, hatch and nine-entry legend are present. Bottom-facing magenta thrusters are not clearly visible.
5. PASS: no decorative numbers, insignia, flames, exhaust, scene or cast shadows; text limited to labels and legend.

Edit prompt, verbatim:

Change only the missing BUBBLE part callout: add the label BUBBLE with a leader line pointing to the pale-blue hanging cockpit in the side view.

KEEP: everything in Image 1 except the front profile — parts, colours, legend, views and view names, labels, the bubble's rounded-cube shape and front pillars, the recessed engines and thrusters, the figure; flat fills with dark outlines on plain off-white. Add nothing not listed above.

## Decisions
- Used Image 1's part colours over the canon paint scheme.
- Accepted the tool-selected 1944 × 809 canvas.
- Stopped after the single permitted edit and reported remaining failures as instructed.
- Used actual absolute Linux paths; this environment provided no /mnt/c destination.

## Artifacts
- `/home/ax/projects/well-dipper-trunk/.astra/jobs/20261002-151739-player-ship-ext-v3/out/player-ship-ext-sheet.png` — Selected concept sheet, copied unmodified.

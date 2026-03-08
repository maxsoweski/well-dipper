# Title Screen & Keybinds Overlay

## What We're Building

**Title screen** shown on startup:
- Background: camera slowly orbits a random deep sky object (galaxy, nebula, cluster)
- "WELL-DIPPER" centered, NABLA font (`EDPT: 130, EHLT: 10`)
- "PRESS ANY KEY TO BEGIN" below in white DotGothic16
- Small corner text: "K — KEYBINDS"
- Press any key → title fades out (~1s), you're in front of the deep sky object
- Auto-dismisses after 30 seconds if no input

**Keybinds overlay** (toggle with K):
- Works on title screen AND during gameplay
- Lists all keyboard shortcuts
- DotGothic16 font, semi-transparent background
- Dismiss with K or Escape

## Implementation Steps

### Step 1: Add fonts to `index.html`
- Google Fonts `<link>` tags for NABLA and DotGothic16

### Step 2: Add HTML overlays to `index.html`
- `<div id="title-screen">` — title + subtitle + corner hint
- `<div id="keybinds-overlay">` — all keybinds listed

### Step 3: CSS in `style.css`
- Title screen: fullscreen fixed overlay, centered title, NABLA font-variation-settings, fade-out transition
- Keybinds overlay: semi-transparent dark panel, toggle visibility
- Apply DotGothic16 to UI text (gallery overlay, keybinds, subtitle)

### Step 4: Title screen logic in `main.js`
- `titleScreenActive = true` on startup
- Force first spawn to be a deep sky object (not a star system)
- Camera auto-orbits the object (auto-rotate enabled)
- Any keydown/click dismisses: fade out overlay, start normal gameplay
- 30-second auto-dismiss timer
- Block other gameplay input while title is showing
- K key toggles keybinds overlay (works always)

### Keybinds list
Space, Tab, Shift+Tab, A, W, M, G, F, R, D, S, 1-9, Arrow keys, Scroll, Click, Right-click, K

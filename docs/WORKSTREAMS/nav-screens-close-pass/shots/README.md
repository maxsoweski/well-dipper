# The A/B Max rules on

Both taken **in the same build, back to back, with nothing else touched** — same system (Sol),
same selection (planet 0, `VELI`), same target in the header, same status line. The only
difference is where the bodies sit on their rings.

| shot | what it is |
|---|---|
| `orrery-A-old-index-angles.png` | **A — what shipped.** Bodies placed at `i * 1.7 + 0.6`, where `i` is the body's position in the DRAW LOOP. An arbitrary even fan. |
| `orrery-B-real-orbit-angles.png` | **B — what is now in the build.** Bodies at their real `orbitAngle`, the same number the LEGACY orrery has always drawn. |
| `galaxy-design1-today.png` | design 1's GALAXY before the close pass — the 8×8 grid whose outer ring is 47% dead ground |
| `galaxy-design2-today.png` | design 2's GALAXY before the close pass — the `wide` projection that crops 20 of 775 sectors off the glass |

## ⛔ THE HONEST READ, AND IT IS NOT ONE-SIDED

**A looks better. B is correct.**

- **A** spreads the fifteen bodies evenly around the rings. Every roman numeral has room; the picture
  reads at a glance. But the placement is a **lie** — it is a list index, not an orbit — and because
  `D.bodies` is re-sorted by `[` and `]`, pressing the sort key **teleported every planet around its
  ring**. That is the defect AC-13 names, and it was live before this pass.
- **B** puts each body where it actually is. It matches the legacy orrery, it survives every sort,
  and it is the only version rotation can mean anything against. ⚠ **But real angles cluster**, and on
  Sol the inner planets bunch into a ~60-texel knot to the right of the star: `II`, `III`, `IV`, `VI`
  and `VII` overlap in B and are clearly separated in A. That is a **real legibility regression**, and
  it is the same failure `d2System`'s own header records having fought once before — seven names
  overprinting on 116 texels.

`placeLabel` only tries seven vertical offsets and checks them against other labels, so it cannot
solve a genuine angular cluster. If Max keeps B, the label placer needs a pass of its own; that is
scoped work, not a tweak.

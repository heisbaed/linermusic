# Cine music brand guide

## Identity

A bold rounded C flows into a quaver note. Cyan, blue and violet express music, energy and listening. The identity is for a music app.

## Palette

| Name | Hex | Use |
|---|---|---|
| Midnight navy | #061126 | Dark splash and brand backgrounds |
| Icon background | #071127 | Launcher icon background |
| Cyan | #00D9F2 | Primary highlight |
| Blue | #2477FF | Gradient transition |
| Violet | #8143FF | Secondary highlight |
| Magenta | #C42AF7 | Small gradient accent |
| Ivory | #F6F7FC | Light wordmarks and light surfaces |
| Ink | #101B33 | Lettering on light surfaces |

The gradient emblem uses custom intermediate stops to preserve the approved ribbon effect. Use the supplied vector instead of independently rebuilding the gradient.

## Logo selection

- `_dark` logo files have light lettering for dark backgrounds.
- `_light` logo files have dark lettering for light backgrounds.
- `_white` and `_black` files are single-colour marks for restricted colour use.
- Keep the symbol free of text inside launcher icons.
- Preserve proportions. Allow clear space of at least 15% of the symbol width around standalone logos.
- Use the simplified white notification mark at notification size. The Android monochrome icon is a transparent, single-colour layer for system tinting.

## Lettering

The wordmark is `Cine music`: a heavier Cine and a lighter music. Production lettering is outlined using DejaVu Sans Bold and DejaVu Sans ExtraLight (regular fallback when ExtraLight is unavailable). The font files are not required to display any delivered logo.

## Master files

`source_svg/cine_symbol_gradient.svg` is the standalone emblem master. Horizontal and stacked SVG logos contain editable paths, not embedded raster images. Change SVG path fills for a custom single-colour export. All included Android brand vectors use the same Bezier geometry.

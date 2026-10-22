# Artwork provenance and prompt record

The built-in image generation tool was used for the initial approved preview and a transparent emblem reference. Production paths are a cleaned Bezier redraw, shared by the SVG, Android XML and raster exports.

## Approved preview prompt

Create a polished, spacious landscape brand preview for a music app named exactly "Cine music". A custom rounded C flows into a musical note as one bold integrated emblem. Use an electric cyan-to-violet gradient, midnight navy and soft ivory. Show a large app icon, a horizontal logo with Cine heavier and music lighter, small circular and monochrome previews, and a slim Android phone showing a centered emblem and wordmark splash. Keep the same emblem throughout. Exclude film reels, filmstrip perforations, clapperboards, cinema imagery, soundtrack references and gold/amber. Section labels: APP ICON, LOGO, SPLASH SCREEN.

## Transparent emblem reference prompt

Extract and faithfully recreate only the large cyan-blue-violet C/musical-note emblem from the approved preview. Preserve its overall silhouette and proportions: broad rounded open C curve, integrated quaver note on the right, diagonal single flag, and rounded oval note head overlapping the lower curve. Preserve the cyan-to-blue-to-violet gradient and internal overlapping ribbon detail. Center one sharp emblem on a genuinely transparent square canvas with clear margin. No tile, exterior glow, text, labels, phone or background. Preserve the approved identity.

## Rebuilding exports

Run `python3 source/build_assets.py` from the extracted pack on a system with Python 3, fonttools, Pillow, Inkscape, ImageMagick, FFmpeg and DejaVu Sans fonts. The builder regenerates vector files, PNGs, Android resources, documentation, the manifest and validation report. Font paths near the top can be changed for another system. It does not need an image-generation API or network access.

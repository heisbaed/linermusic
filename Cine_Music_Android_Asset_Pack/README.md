# Cine music — Android asset pack

The approved cyan-to-violet C + music-note identity, prepared as matching Android resources and editable artwork.

## Start here

1. Open `preview/Cine_Music_Asset_Pack_Preview.png` to see the finished kit.
2. Copy the contents of `android/res/` into your app's `app/src/main/res/` directory. Merge the prefixed values files with your existing resources when necessary.
3. Follow `android/README.md` for launcher icons, the native splash screen, and notifications.
4. Upload the two ready-sized files in `store/` for the Google Play icon and feature graphic.

## Folders

| Folder | Contents |
|---|---|
| `android/` | Adaptive and themed launcher XML, six legacy density sets, notifications, UI controls, splash themes, light/dark placeholder resources, setup snippets |
| `source_svg/` | Editable vector symbols, outlined wordmarks and logos, app icons, splash designs, placeholders and marketing artwork |
| `logos/png/` | Transparent gradient/white/black/cyan symbols and horizontal/stacked logos |
| `icons/` | Square, rounded and round icons; separate adaptive layers; notification density exports |
| `splash/` | Dark/light splash compositions, transparent native icon/branding exports, Android animation, GIF/MP4 preview and animated SVGs |
| `ui_icons/` | 32 matching playback/navigation controls in SVG and transparent PNG |
| `placeholders/` | Album, song, artist, playlist and favourites artwork in light/dark variants |
| `store/` | 512 px Play icon, 1024 × 500 feature graphic, reusable screenshot backdrop |
| `documentation/` | Brand guide, asset manifest, validation report and font attribution |
| `source/` | Reproducible vector/export builder and the generation prompt record |

The screenshot backdrop is a design template. Add genuine screenshots from your app before submitting it as store screenshot material.

This is an asset pack, not an APK or a music-player implementation. Vector/XML structure and export dimensions are checked; native integration still needs a build and a launch check inside your app.

## Source artwork

The master mark is a clean, editable Bezier redraw of the approved AI-generated concept. Final PNGs and Android vector paths derive from that shared vector geometry. Logo lettering is outlined, so installing a font is unnecessary for normal use. Export tooling and attribution are in `source/` and `documentation/`.

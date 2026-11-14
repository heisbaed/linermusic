# Cine music progress — 15 November 2026

## Latest release

Version 0.1.7, Android versionCode 8 is published. Source and progress are pushed to release/0.1.7. The landing page and OTA manifest are live at https://cinemusic.web.app.

## Delivered changes

- New Releases uses confirmed dates within 30 days. Exact artist and title matching uses public iTunes release metadata. Old, unknown and future dates are excluded.
- Animated-flow lyrics blur adjacent lines and keep the current line sharp. Timing adjustments live in Lyrics timing. Removed Tap to open.
- Sorting sheets follow the app theme and render above the navigation and mini-player. Liked Songs and saved albums support sorting.
- Song sharing uses one URL, with title/artist metadata for the browser page. Browser pages show real catalog artwork and open the selected song in Android. Lyrics URLs reach the song route.
- Native splash uses a separate animated C-and-note reveal with the Cine music wordmark and By Osborne's Digital Solutions footer. It dismisses when React commits the app, without a fixed launch hold. System reduced-motion settings disable motion.
- Launcher uses a dark background and pink emblem, including adaptive icons.
- Landing page has updated branding, current release highlights, file information and generic social preview artwork.

## Verification

- 105 unit tests passed.
- Eight core rendered feature groups and eleven smart-feature groups passed. Coverage includes search, radio, library routes, lyric navigation, four themes, selected playback controls, bulk downloads, sorting, narrow layouts and exclusion of old releases.
- Browser song page checked at 360 px with actual artwork, correct app URL and no horizontal overflow.
- Android build succeeded. All 509 packaged assets match the release-source snapshot byte for byte.
- Version 0.1.7 / code 8 was installed over USB. Previous physical library check retained 361 completed downloads. A concurrent TV chat subsequently installed 0.1.7-connect.1 / code 9. Reinstalling the public release was rejected as a version downgrade. No downgrade or data removal was performed.
- Final cold-launch recording and physical screenshots were blocked by the phone lock screen. The recording was black and is not counted as splash verification. AVD configuration exists, but its phone system image is incomplete, so no emulator visual check has been claimed.

## Release artifact

- File releases/Cine-Music-0.1.7.apk
- Size 12,294,157 bytes
- SHA-256 cdc1174140bf4295693429a1cdfb69a2638fa51453800d68b4e3cbd192b0695c
- Source branch release/0.1.7
- Public download https://github.com/heisbaed/linermusic/releases/tag/v0.1.7
- GitHub asset digest, uploaded size, website download URL, website checksum and live OTA manifest independently matched this artifact.

## Remaining work and decisions

- Song-specific social chat previews were skipped at the owner's request. Firebase billing is disabled and no preview server was deployed. Generic site preview metadata remains.
- A complete fresh OTA download-to-install cycle remains unverified. APK installation uses Android confirmation.
- Concurrent device-transfer/backend work remains in the main workspace. The release snapshot retains the playback engine verified in v0.1.6. TV/device transfer is not claimed verified in this release.
- Final splash appearance and fresh playback on the installed package await an unlocked physical phone. No exhaustive all-catalog, Google-account, Bluetooth-output or TV-device test is claimed.
- The owner has been asked to authorize coordination with Plan Cine Music Android TV before sending that chat a message. The phone currently carries its newer Connect preview, and the public release stays separate pending that decision.
- Release remains debug-signed for compatibility with the previously distributed app.

Historical progress is in Git history and PROGRESS-before-2026-11-14.md.

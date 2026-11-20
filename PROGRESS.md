# Cine music repair progress - 20 November 2026

## Release 0.1.13 / code 16

Separate TV and mobile builds contain Smart Shuffle context cancellation, bounded session lyrics caching, TV lyric rendering improvements, shared Connect media notification/widget state, one fresh source-session retry for rejected audio URLs, private last-failure diagnostics, and platform validation for updates. See RELEASE-0.1.13.md for evidence and limits.

The reported evening playback error was not reproduced; the same song played during diagnosis. This is not a claim that all playback failures are resolved. No automated test suites were run. Full OTA installation and extended TV performance remain unverified.

---
# Cine music release progress � 15 November 2026

## Release 0.1.8 / code 11

Separate mobile and TV APKs use dedicated interfaces, launcher entries, labels and update feeds. Existing package identity and signing are retained on each platform to preserve accounts and installation data.

- Mobile Connect replaces the top-bar Lyrics action. The lyrics preview remains available. Existing playback positions and layout were preserved in rendered checks before the final build.
- TV keeps its top-bar tabs and has a slimmer seven-control mini-player. The direct Queue Back/focus path was adjusted.
- TV Smart Shuffle cycles Off, Shuffle and Smart Shuffle using the existing recommendation engine, with a distinct sparkles icon.
- Native private artwork cache persists across launches, with 64 MB mobile and 32 MB TV limits. TV WebView no-cache mode was removed. Cache clearing continues to preserve encrypted music downloads.
- Unboxed animated pink emblem, Cine music wordmark and By Osborne's Digital Solutions footer. Startup follows application readiness.
- Connect supports device ownership, remote controls and offline phone listening with reconnection.
- Landing page presents separate mobile and TV downloads with sizes/checksums. OTA feeds are /ota/manifest.json for mobile and /ota/tv-manifest.json for TV.

## Verification and limits

105 unit tests, eight core rendered groups and twelve smart-feature groups passed earlier. The TV chat verified actual audio ownership, transfer, remote pause/seek/next and offline/reconnection on the prior Connect preview. Both separate APK builds succeeded and installation commands returned Success on phone and TV.

The owner explicitly requested stopping all tests to conserve quota. No further testing is being performed. Final artwork caching, TV Smart Shuffle and Queue focus restoration remain unverified on devices. Final splash appearance and the complete OTA download-to-install cycle are also unverified. Do not claim complete end-to-end verification.

Song-specific social previews remain skipped at the owner's request. Generic site previews and song browser links are present. Existing debug signing is retained for update compatibility.

## Artifacts

- releases/Cine-Music-Mobile-0.1.8.apk
- releases/Cine-Music-TV-0.1.8.apk
- releases/SHA256SUMS.txt
- Source branch release/0.1.8
- Public site https://cinemusic.web.app

Separate platform web builds are available through npm run build:mobile and npm run build:tv in mobile. Native packaging selects cinePlatform=mobile or cinePlatform=tv with cineAssetsDir pointing to the corresponding web output.

Publication is being completed. No further testing is authorized. The reported mobile layout regression was traced to platform-bundle CSS ordering. CineApp now imports its canonical theme/layout styles after component styles, and the corrected mobile APK is being installed.

## Signalroom analytics

First-party, privacy-safe analytics were added for the mobile app, Android TV and landing page. Events are coarse counts and labels only: no search text, song titles, artwork URLs or device identifiers are uploaded. Events are written idempotently through Firebase RTDB REST to `/analytics/<surface>/events/<id>` with server timestamps and a local retry queue.

- `mobile/src/analytics.ts` initializes a fresh session per launch, tracks app opens, installs/version changes, heartbeats, page views, playback start/pause/resume/skip/complete, downloads, search counts, radio, lyrics, theme, Connect pairing/selection, sign-in/out and OTA checks.
- `MainActivity` exposes `appVersion()` through the existing native bridge so release versions can be grouped.
- `landing page web/src/lib/telemetry.ts` records landing page views and APK download clicks; `/dashboard` is an admin-only REST/polling analytics view in `src/pages/Dashboard.tsx`.
- `database.rules.json` adds a validated public-write/admin-read analytics node with a timestamp index. The rules were deployed to `cinemusic-1-default-rtdb`; unauthenticated analytics reads correctly return HTTP 401.
- Landing hosting was deployed to `https://cinemusic.web.app`; `/dashboard` returns the SPA shell and `/firebase-config.json` is publicly readable.

Type checks, 105 unit tests and production builds pass for both `mobile` and `landing page web`. No device testing was performed, per the owner's testing freeze.

## Release 0.1.9 / code 12

Published via the existing OTA feeds on 15 November 2026.

- Mobile and TV APKs rebuilt from the platform web bundles with Signalroom analytics included and verified inside the packaged assets.
- GitHub release: https://github.com/heisbaed/linermusic/releases/tag/v0.1.9
- Live feeds: https://cinemusic.web.app/ota/manifest.json and https://cinemusic.web.app/ota/tv-manifest.json
- Landing download links, sizes, checksums and version copy were updated and hosting redeployed.
- No device update was performed. Android will show its installer confirmation when an installed 0.1.8 app receives the 0.1.9 update.

## Release 0.1.10 / code 13

Published via the existing OTA feeds on 15 November 2026.

- Mobile and TV check for updates automatically five seconds after launch and only open the update prompt when the manifest version code is newer.
- The check reuses the validated manifest fetch in `UpdateActivity`; up-to-date launches remain silent and network failures are ignored.
- Manual `Settings > About > Check for updates` remains available.
- GitHub release: https://github.com/heisbaed/linermusic/releases/tag/v0.1.10
- Live feeds: https://cinemusic.web.app/ota/manifest.json and https://cinemusic.web.app/ota/tv-manifest.json
- Landing hosting was redeployed with 0.1.10 download links, sizes and checksums.
- Users on 0.1.8 or 0.1.9 must update once manually because those builds do not contain the launch check. Android still requires installer confirmation.
- No device testing was performed, per the owner's testing freeze.

## Release 0.1.11 / code 14

Published via the existing OTA feeds on 15 November 2026.

- Fixed playback analytics so a new track is counted as `play` rather than `resume` when native playback passes through a transient paused state.
- Fixed search analytics so settled Browse typing is counted once per query without requiring Enter.
- Fixed download analytics by reconciling persisted download state on launch and foreground, restoring completions lost while the app was backgrounded or closed.
- Dashboard downloads KPI now separates started and completed downloads.
- Mobile and TV APKs rebuilt from the platform web bundles with the analytics fixes verified inside the packaged assets.
- GitHub release: https://github.com/heisbaed/linermusic/releases/tag/v0.1.11
- Live feeds: https://cinemusic.web.app/ota/manifest.json and https://cinemusic.web.app/ota/tv-manifest.json
- Landing hosting was redeployed with 0.1.11 download links, sizes and checksums.
- No device testing was performed, per the owner's testing freeze.

## Release 0.1.12 / code 15

Published via the existing OTA feeds on 15 November 2026.

- Fixed the update screen reopening on every launch by comparing the manifest against the installed package version at runtime.
- Automatic updates now show a dismissible in-app prompt instead of opening a persistent update screen; choosing Later suppresses that version.
- Successful installs clear the cached update APK and update notification.
- Mobile and TV APKs rebuilt from the platform web bundles with the update-flow fix verified in the packaged bytecode.
- GitHub release: https://github.com/heisbaed/linermusic/releases/tag/v0.1.12
- Live feeds: https://cinemusic.web.app/ota/manifest.json and https://cinemusic.web.app/ota/tv-manifest.json
- Landing hosting was redeployed with 0.1.12 download links, sizes and checksums.
- No device testing was performed, per the owner's testing freeze.

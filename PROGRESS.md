# 28 November 2026 — 0.1.18 service/algorithm delivery

- Owner requested deeper algorithm/service research, UI/button improvements, dashboard work and public updates. Do not install on devices. No automated or runtime verification is authorized; leave manual acceptance to the owner.
- Implemented changes and primary research are recorded in SERVICE-REVIEW-0.1.18.md; release notes in RELEASE-0.1.18.md. Existing code/package/signing/private offline formats are preserved.
- Search retrieval/intent/aliases/ranking, recommendation context and genre provenance, lyric request/parsing overhead, Connect seek coalescing, protected download recovery, cloud playlist conflict handling and telemetry integrity are addressed.
- Native reCAPTCHA App Check is configured for the sideloaded app; paid billing was not enabled. Restricted DJ key remains ignored native build input. No live AI/speech success is claimed.
- Added trusted TV media-browser integration and optional user-selected Cine music playback screensaver; Mobile has actual notification preferences/history. Shared selected/focus/input/button states improved.
- Both interface bundles, Java/native APK packaging, dashboard TypeScript compilation and the website production build succeeded. Separate APKs, SHA-256 checksums and version-code-21 update feeds are prepared. Source/release/hosting publication is the remaining delivery step.
- No app launches, device installs, playback/offline/AI checks, screenshots, benchmarks or automated tests were run. Small read-only reported-title metadata lookups and configuration operations are documented separately from runtime verification.

---

# Cine music TV refinement and DJ configuration - 28 November 2026

## Release 0.1.17 / code 20 - installed and published

Implemented TV Home/focus/splash/DJ refinements, native AI App Check, reduced player/lyrics update work, realtime Connect command wake-up, original-recording search ranking and TV MediaSession/notification/widget integration. See RELEASE-0.1.17.md for exact scope and dependencies.

GitHub secret alerts identify Firebase client API keys, including the DJ config committed in 0.1.16 and an older authentication key. Removed the DJ source JSON; created a package/signing/service-restricted replacement in ignored native build configuration; removed Firebase AI from the old shared key's allowlist while preserving its other Firebase services. Existing client-key alerts remain open; no claim of revocation or historical misuse audit. DJ-BUILD.md documents actual protections.

Both web interfaces, native APKs and the landing page compile. Separate Mobile and TV 0.1.17 APKs installed successfully on R58M34PT7SN and 192.168.10.105:44323. Published both APKs and SHA256SUMS at https://github.com/heisbaed/linermusic/releases/tag/v0.1.17; the first upload attempt encountered a connection error and the retry succeeded. Firebase reported successful deployment of the landing page and separate code-20 update feeds at https://cinemusic.web.app. Source is on codex/release-0.1.17. No independent public-download checks, automated tests or new-build UI/playback/AI verification, as instructed. Device attestation/Play Console requirements and launcher media surfaces remain runtime dependencies.

---

# Cine music TV polish, playback preparation and Dj Cine - 28 November 2026

## Release 0.1.16 / code 19

Top TV navigation; personalized Home; denser shared layouts; idle full-art listening with a persistent bottom-left title; unboxed Lyrics and Up Next over blurred artwork; higher-resolution artwork and known artist fallback; theme-linked icons, logos and TV banners; next-song preparation independent of crossfade with fast-Next reuse; Dj Cine with configured Firebase AI Logic and installed-device narration.

Both web interfaces, native APKs and the landing page compile. Mobile and TV 0.1.16 were installed successfully via ADB on R58M34PT7SN and 192.168.10.105:44323. Published both APKs and SHA256SUMS at https://github.com/heisbaed/linermusic/releases/tag/v0.1.16. Deployed the landing page and separate version-code-19 update feeds to https://cinemusic.web.app. Publishing/deployment tools reported success; no independent download or runtime checks were performed. No new-build UI/playback/AI tests or screenshots, per the owner's instruction. Paid billing remains disabled by this work. See RELEASE-0.1.16.md for exact behavior and dependencies.

---

# Cine music UI and recommendation follow-up - 27 November 2026

## Release 0.1.15 / code 18

Expanded this release after the owner supplied Liked Songs screenshots and requested a Spotify reference review: matched recording/artist genre metadata warms in the background, both apps expose library-derived horizontal categories, and generation uses the current song rather than unrelated favorites/history. Mobile song rows and controls are flatter/denser. TV lists/detail pages, Home shortcuts, full-screen cover art and concentrated glass surfaces were rebuilt. Native widget layout uses a clear three-control transport. Library Settings shortcut is mobile-only as explicitly corrected.

The phone screenshot and Spotify reference review were explicitly authorized. No automated tests or new-build functionality checks. Only compilation and installation status will be reported as confirmed. RELEASE-0.1.15.md records metadata coverage and verification limits.

---

# Cine music follow-up repair - 27 November 2026

## Release 0.1.15 / code 18

Daily Mix daily/refresh rotation; broader search retrieval; seed-anchored recommendations; cached catalog genre enrichment; compact mobile Liked Songs and direct mobile Library Settings; dense TV browsing and full-screen artwork; redesigned native widget. See RELEASE-0.1.15.md for implementation and verification limits.

Owner explicitly limited Library Settings placement to mobile. The unrelated TV-title report remains excluded. Only the old screenshots and Spotify reference view were inspected; no automated tests or functional verification of the new build.

---

# Cine music repair progress - 27 November 2026

## Release 0.1.14 / code 17

Offline Media3 decoding, container screening before download completion, truthful playlist download readiness, remembered Liked Songs sorting and genre/type filters, synced genre labels, four runtime-selectable launcher icons, and in-screen updater progress/install controls. See RELEASE-0.1.14.md.

Only compilation/package work is authorized; no runtime tests or device verification. Existing damaged downloads are not repaired automatically. All four icon directions were approved for user selection. The unrelated TV-title report was explicitly withdrawn and excluded.

---

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

# Active implementation — v0.1.6, 14 November 2026

## Completed changes and verification

- Five smart features are implemented. Daily Mix saves actual catalog recommendations to private playlists. Hidden song/artist exclusions can be restored in Settings. Resume restores the queue and position. Playlist duplicate cleanup preserves alternate versions. Lyric timing adjusts in 250 ms steps and persists per song.
- Added bulk library/playlist selection, song/album sorting, Pause all/Resume all/download priority, transfer size/speed feedback and four mini-player controls. Sort controls use a themed bottom sheet with selected indicators. Removed Tap to open from the lyrics preview.
- Widgets and notification/lock-screen controls share the native playback session, including actual cover artwork. Current notification title explicitly includes Cine music. Physical notification data confirmed Cine music · My Darling.
- Real phone search and playback verified Neema Gospel Choir Umenipendelea (Live), ID eafzURCG1X0. Duration 797164 ms, source resolution 3599 ms, preparation 6762 ms. Accepted MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC and included video-filter results. Instrumentals and beat uploads rank lower unless requested.
- Fixed genre tiles using supplied bundled artwork immediately in two columns, long title overflow in Top result and ordinary rows, and Home waiting for all artwork downloads.
- Fixed bulk-download freezes by batching submissions, removing synchronous vault rescans from progress, sending incremental job progress, limiting rendered rows, moving startup scans to a worker and using direct hex filename conversion. Fixed vault listing replacing the first completed song with a summary. Socket timeouts use bounded reconnects. Saved songs retain authenticated encrypted app-private storage.
- 102 unit tests passed. Eight original rendered feature groups and ten smart/download/sort groups passed. Nine physical instrumentation checks passed, including widget PendingIntents, MediaSession transport/seek, encrypted storage, offline playback and restored position.
- Phone with 359 completed downloads remained responsive during a diagnostic burst of 60 progress events in 1362 ms. These events were simulated in the real app. Actual catalog/audio playback was separately checked.
- A bounded network probe read 524288 bytes in 1508 ms. This is a measured connection rate, not a guaranteed download speed increase.
- Physical phone sorting controls were checked after USB installation. Android notification data showed the Cine music app name. The final USB refresh includes phrase removal and the themed sorting sheet.

## Release and remaining verification

- v0.1.6, versionCode 7. APK releases/Cine-Music-0.1.6.apk, 12298420 bytes, SHA-256 cfa5bbbb4dd58bb6a85b3cba669d42a2b25cf75c6a1d9e37fa151fb4fd3a0e3f. Source branch release/0.1.6. Publication is being completed.
- Final installation is via USB at the user's request. Installer validation, unknown-source permission return and Android confirmation were exercised. A complete live OTA download-to-install cycle remains unverified.
- The updater now uses PackageInstaller sessions and status callbacks, reports cancellation/failure, supports retry and clears stale install notices when a cached APK is no longer newer.
- Device queue and listening preferences were restored after testing. Bulk user downloads were paused to recover the frozen screen. Keep them paused until the user resumes them.
- Concurrent TV and pairing changes in this shared workspace were preserved. They compile with this release. Exhaustive TV, Google account-selection and Bluetooth-device testing are outside the verification completed here.

---

# Cine music — current checkpoint, 14 November 2026

## Final update — supersedes the earlier device and release checkpoint below

- Final published release: **v0.1.4**, versionCode **5**, `releases/Cine-Music-0.1.4.apk`, 12,152,918 bytes.
- SHA-256: `36759e2f8a9782cdc09a2faa7beea74a2d896d2225e7b1e493c2a61073b35b0c`.
- Source branch: `release/0.1.4`. Website and OTA manifest target 0.1.4. Intermediate 0.1.2/0.1.3 packages remain historical releases.
- **Installed final APK on the physical phone** with `adb install -r`; verified versionCode 5 and versionName 0.1.4. App data was preserved and the existing signed-in library rendered.
- Reproduced the search box twice: sticky wrapper painted a square background, and a global `!important` TV focus rule drew a rectangular outline only when the Android keyboard opened. Removed wrapper fill, disabled native input decoration, and scoped TV focus styling to `.is-tv`.
- **Actual keyboard-open screenshot inspected**, `.device-test/phone-search-keyboard-final.png`: rounded field, no inner rectangle. Native input method confirmed visible. Added a rendered focus regression assertion.
- Latest rendered fixture audit passes seven feature groups, including radio queue and selected heart/repeat states in four themes. Unit suite: 90 passed. Cloud sync: six race checks passed. Native phone instrumentation: eight checks passed.
- Final live phone search for `Muziki Darassa` returned six visible song rows; opening Start song radio loaded **39 actual related tracks** with state ready. Captures: `.device-test/phone-live-search.png`, `.device-test/phone-live-radio.png`. This was real phone/catalog data, not fixture content.
- OTA download was observed complete and integrity-verified, and Android's installation screen opened. That system installer remained on Installing during the test; final installation was completed with ADB. **Do not claim a completed permission-return/end-to-end OTA installation test.** The implemented updater still requires Android/user installation confirmation.
- Full APK OTA is implemented; a separate JavaScript hot-update channel is not implemented. No exhaustive Google/Bluetooth/all-TV-device/all-source verification is claimed.

The remaining sections describe the earlier 0.1.2 checkpoint and are retained for traceability.

## Published artifacts

- Latest release: https://github.com/heisbaed/linermusic/releases/tag/v0.1.2
- APK: `releases/Cine-Music-0.1.2.apk`, 12,152,894 bytes, versionCode 3.
- SHA-256: `5b428edf4c3ff0e0b8737b226e2311e19bb1245bcc239897ceb6b66b50bb7720`.
- Website and OTA manifest deployed to https://cinemusic.web.app and `/ota/manifest.json`.
- Source published on `release/0.1.2`, commit `fcf9413c9ddb828b7ddde9674996fbbdaccd1627`.
- Local master also contains the repair commits. Direct master push was refused because the old unpublished website commits contain Git LFS objects disallowed on the public fork. A clean worktree `.release-source` publishes the complete source with the two small original PNGs as ordinary Git files.

## Implemented repairs and additions

- Fixed missing lyrics scroll-container ref, follow-scroll coordinates, viewport-clipped transport controls, legacy string cache migration, shared lyric state reset, request timeouts, and rejection of unrelated fallback lyrics.
- Sticky rounded Search field; flatter typed result lists; recent searches, genre browsing, and personalized song-radio discovery tiles.
- Start song radio from song menus or Search's recent-listening shelf. Uses actual catalog radio recommendations, deduplicates recordings, displays loading/error/empty states, and starts a real playback queue.
- Heart, shuffle and repeat use clearly distinct selected surfaces in each theme; Repeat All dot and Repeat One badge.
- Removed competing JavaScript download queue/unbounded retries. Android owns persistent download jobs; paused/failed jobs wait for explicit Resume/Retry.
- Restored permanent audio focus handling and proper native Stop cleanup.
- Replaced broken service-context updater dialog with a foreground review activity and foreground download service. Verifies bounded size, SHA-256, app identity, increasing versionCode, and matching signing certificate. Supports Android 8+, FileProvider installer, and resuming after unknown-app permission return.
- Updates are full APK OTA downloads, initiated from Help & about > Check for updates. No separate JavaScript hot-update channel is implemented.

## Verification actually completed

- 90 unit tests passed; mobile TypeScript/Vite and offline Android APK builds passed.
- Seven rendered fixture checks: Search typing/scrolling, radio queue, Library destinations, lyrics seek/manual browsing/follow, four themes and selected controls, profile/settings routes, 320 dp layout. `.device-test/design-review/audit-report.json`, screenshots alongside.
- Six isolated cloud-sync race checks passed against the Vite test harness (port 5179). `.device-test/cloud-ui-report.json`.
- Eight checks passed on Galaxy S10+ `R58M34PT7SN`: trusted update source validation, same-version APK rejection, exact backend host validation, AES-GCM private storage, tamper rejection, interrupted download cleanup, deduplication, cancellation boundary, and native offline playback surviving Activity closure.
- Bounded public-source probe returned valid audio samples; does not prove every catalog recording is playable.

## Current physical-device work — do not claim complete

- The phone has a temporary updater test build named 0.1.2 but versionCode **2**. Final published APK has versionCode **3** and includes new Search/radio/selected-control styling.
- An OTA download was observed progressing but no completed APK remained after disconnection. Phone reconnected; the final installer-permission-return and final focused Search screenshot are still being checked.
- User says the search field still has a rectangular box bug. Old physical screenshot `.device-test/phone-search-focused.png` shows the underlined old input and old placeholder; that screenshot is not the published final screen. Inspect the actual final APK on phone before claiming this complaint resolved.
- Phone was in Facebook on reconnection; avoid unrelated interaction. `scripts/open-phone-updates.mjs` opens the updater through the app bridge. `scripts/check-phone-search.mjs` focuses Search and captures its actual geometry/style without exposing account tokens.
- Don't clear app data. Preserve authentication, library, saved songs and downloads.

## Honest limits

Google account selection, every Bluetooth/output device, every TV remote and every real catalog song have not been exhaustively verified. Fixture tests are isolated and not production data. Existing release remains debug-signed to preserve update compatibility with previously distributed builds.

Old historical notes were preserved in `PROGRESS-before-2026-11-14.md`.

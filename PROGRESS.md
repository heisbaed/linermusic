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

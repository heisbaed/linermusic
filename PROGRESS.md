 # Cine music — progress and resume notes

Updated: 2026-10-21. Workspace: `D:\2nd Year projects\linermusic`.

## Current UI reconstruction

This section supersedes older visual-completion and authentication notes below. The approved written Cine music specification and local reference images are being implemented as real components, not screenshots or demonstration songs.

- [x] Audit Android/WebView architecture, real catalog contracts, playback/download integrations, reference boards, and original vector/splash pack.
- [x] Identify Firebase endpoint restrictions, stale queue reconciliation, broken navigation/back handling, and unsupported controls before rebuilding.
- [x] Replace the monolithic presentation with a typed shared shell, retained tabs, four semantic themes, shared accessible components, and a single playback controller.
- [x] Integrate rebuilt browsing/library/detail and account/authentication screens.
- [x] Integrate native queue snapshots, real download jobs, service-owned sleep timer, Firebase endpoint repair, image chooser, and system-bar/back fixes.
- [ ] Verify type checking, unit tests, local-browser layouts/interactions, and offline Android build. No new device or integration results are claimed until run.

Use installed/cached tooling and local assets; avoid large network installs and media tests over the mobile hotspot. Audio downloads remain AES-GCM encrypted in private app storage, without plaintext public export. Firebase configuration is supplied for the real project; enabled providers, deployed database rules, and real email delivery remain separate verification requirements.

### Verified checkpoints

- Mobile production build passed; the final Android debug APK and instrumentation APK assembled using `--offline`.
- Current mobile suite: **55 tests passing**. Native bridge suite: **7 device checks passing** on Samsung SM-G975U1 (Android 12).
- Offline Chrome UI report: `.device-test/ui-report.json`, with responsive and interaction checks, local test-only catalog/artwork/native fixtures, no external requests, and no uncaught JavaScript errors.
- Actual cloud-hook browser regressions: `.device-test/cloud-ui-report.json`, 6/6 passing. Covers delayed/null PATCHes, newer SSE edits, nested array updates, account-deletion drain/suspension, failed writes, and stale token-refresh failure after a new session.
- Independent correctness review findings were fixed: fresh reauthentication must not reuse an old ID token; pending deletions must not strand later edits; old refresh failures must not sign out a newer session; SSE arrays must retain siblings; acknowledged writes must not overwrite newer server events; deletion must suspend and settle cloud writes before removing data.
- Live Firebase checks confirmed the real Authentication project, enabled email/password endpoint, and Google OAuth authorization setup. The actual Web OAuth client was discovered from the service and added to `mobile/public/firebase-config.json`, without logging tokens or authorization URLs.
- Live RTDB check initially found anonymous reads allowed. Owner-only, verified-user rules from `database.rules.json` were deployed using the existing Firebase CLI session. An independent follow-up returned HTTP 401 `Permission denied` for unauthenticated reads.
- Live endpoint reports: `.device-test/online-report.json`. The hosted public init-config URL returns 404; it is optional because the app bundles its configuration. User sign-in, email delivery, and device Google consent are not inferred from endpoint availability.
- **New:** Download auto-retry with exponential backoff (30s → 1m → 2m, max 5m, 3 attempts) implemented in `useDownloads.ts`, mirroring Spotify offline behavior.
- **New:** Auth gate + onboarding flow (country → genres → real catalog artist search) gated behind verified Firebase account; taste profile personalizes Home queries.
- **New:** Google sign-in fixed on Android 12+ via CredentialManager + cached AndroidX Google ID library; cancellation returns usable form.
- **New:** Streaming playback fixed via anonymous visitor warm-cache; public tracks verified (Mtu Mzima, Shape of You, Never Gonna Give You Up) with valid audio/mp4 containers.
- **New:** Search updates live per keystroke with 300ms debounce, stale request cancellation, and clean history (no partial keystrokes saved).
- **New:** Playlist picker in song menu shows all playlists with covers/counts; "Create playlist" option.
- **New:** Email verification and password recovery screens include "check spam/junk folder" guidance.
- **New:** Verification screen centered layout with larger touch targets and clear visual hierarchy.
- Final debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` (4,520,366 bytes, SHA-256 `1d2532708a07220a26eb7b5fedb108089e7f992d87de70a144465af0ef5abb0d`).

## User requirements and decisions

- Turn the user's fork, https://github.com/heisbaed/linermusic, into an Android app.
- The Android app name is **Cine music** (exact display label).
- Downloads must behave like Spotify offline downloads: listen inside this app; no exported MP3, sharing download files, or public Downloads/music-library copy.
- The user's local asset pack is `Cine_Music_Android_Asset_Pack/` (4.8 MB). Android launcher, native splash, notification and matching UI icons have now been integrated. Android theme colors are tuned to the existing dark app; web UI icons are color-tinted through CSS masks. Pack source remains in place.
- Latest instruction: **save progress in Markdown because the user is running out of tokens**. Do not treat this checkpoint as a finished production app.

## Current outcome

There is a compiled, installed Android **debug** APK, a mobile React interface, and native playback/encrypted offline-storage code. This is a first Android implementation, not complete feature parity with upstream.

- App APK: `android/app/build/outputs/apk/debug/app-debug.apk` (1,433,343 bytes; latest build includes the asset pack).
- Device-test APK: `android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk` (latest local instrumentation build).
- Application ID: `com.heisbaed.cinemusic`.
- Version: `0.1.0` / versionCode `1`.
- Android min SDK 26; compile and target SDK 36.
- **Nothing has been committed, pushed, published, or released.**

## GitHub and source acquisition

The original workspace was empty. Shell GitHub access, Git clone, GitHub CLI login, and npm registry downloads are blocked by this environment's network permissions. The saved `gh` token also originally reported invalid; avoid exposing tokens.

The user connected the **GitHub plugin**, reloaded this session, and its repository tools now work. Use the available GitHub connector tools for reads if terminal access remains blocked. The fork is public, default branch `main`, upstream `tryliner/desktop`.

The original is a React 19 / TypeScript / Electron desktop application. Its API signing, CORS/header rewriting, desktop controls, and playback cannot just be wrapped unchanged into an APK.

Source was fetched through GitHub tools into this workspace. This is a **source snapshot, not a Git clone**: `.git` does not exist. Snapshot tree SHA: `332b77295537fb87dd3a152338581aa1b2d54cd5` (a Git **tree** SHA, not a verified commit SHA).

- Tree response is saved in `.source-import/tree.json`.
- 504 source files matched Git blob hashes exactly after correcting an import-added trailing newline.
- `.gitignore` and `src/languages/locales/de.json` differ in line endings; their original files use CRLF.
- `.github/assets/` README preview images/GIF were intentionally excluded from the import.
- **Import gap:** `src/assets/wallhaven-5g1yz8.jpg` is currently a zero-byte file. GitHub's contents API returned empty content for this >1 MB image, and the connector's blob fetch rejected binary content. Restore the original wallpaper later. It is used by the original desktop login UI; the mobile app does not import it.
- `.source-import/` contains base64 intermediates for imported binary icons/images. Do not commit these or the environment caches.
- `scripts/verify-source-snapshot.py` checks the upstream snapshot. Once intentionally changing original files, mismatches are expected.

Upstream `LICENSE` is **source-available**, not unrestricted open source. It explicitly permits local personal noncommercial modifications, and restricts public competing forks/binary redistribution without permission. Work here stayed local; inspect that actual license before a public release. Original attribution/license files are preserved.

## Implementation

### Mobile frontend (`mobile/`)

An independent React 18 mobile entry/build reuses the fork's pure Innertube catalog/search mappers and playback profiles. Desktop entry and Electron files remain separate. React 18 and Vite 5 were available in the machine's cache; the root desktop package was not downgraded.

- `mobile/src/App.tsx`: home, search, liked songs, local playlists, YouTube/YouTube Music playlist-link import, downloads, song menus, queue, mini player, full player, seeking, shuffle/repeat controls, lyrics, settings, messages, error states.
- `mobile/src/style.css`, `tokens.css`: dark green/lime responsive design; CSS masks tint the pack's UI SVG icons to the existing palette; temporary CSS vinyl art remains.
- `mobile/src/Icons.tsx`: code-native SVG icons.
- `mobile/src/catalog.ts`: reuses `src/shared/media/innertube/` search/catalog mappers. Resolves direct audio using the fork's VISIONOS and ANDROID_VR profiles; prefers AAC. It does **not** yet port Electron's WEB_REMIX PO-token worker/fallback.
- `mobile/src/native.ts`: async native HTTP bridge, bounded/chunked responses, request cancellation/timeouts, player/download event plumbing, browser-preview fallback.
- `mobile/src/library.ts`: local library persistence, deduplication and LRC parsing.
- `mobile/src/main.tsx`: entry and root error boundary.
- Likes/playlists/recent queue are local to the device. **Upstream account login/cloud library sync is not ported.**
- Lyrics use LRCLIB `/api/get` (https://lrclib.net/docs), with simple timestamp sync and localStorage caching; not upstream syllable-level rendering.
- Downloaded artwork is not yet explicitly cached for offline use; missing images show an app placeholder.
- `mobile/vite.config.ts`: builds assets straight into `android/app/src/main/assets`.
- `mobile/index.html`: viewport/CSP and Cine music title.
- `mobile/public/cine-icon.png`, `mobile/public/cine-symbol.png`, and `mobile/public/cine-icons/`: supplied app icon, brand symbol, and UI icon SVGs.

### Android (`android/`)

Native Java + Android framework APIs; no Capacitor dependency. Gradle Android plugin 9.0.1.

- `MainActivity.java`: serves bundled assets at `https://appassets.androidplatform.net`; disables file/content access and mixed content; restricts navigation; exposes the JS bridge only in the bundled WebView. Native HTTP allows explicit HTTPS hosts, supports headers needed by upstream catalog, cancels requests, and chunks replies. Notification permission is requested on playback/download. Back handling is delegated to the UI; root can background the activity. WebView debugging is enabled only for debug builds.
- `PlaybackService.java`: foreground native MediaPlayer/MediaSession, notification controls, audio focus, headset-unplug pause, seek/pause/resume; queue lives natively and supports next/previous/shuffle/repeat after the activity closes. Native resolver handles the next streamed track; offline entries use the vault directly. Pause/loading/error behavior still needs broader device testing.
- `StreamResolver.java`: native counterpart to the fork's direct playback profiles, used for background queue advancement. Live success is unverified.
- `OfflineVault.java`: AES-GCM encryption using a non-exportable Android Keystore AES key. Ciphertext lives under app-private `getNoBackupFilesDir()/offline` as hashed `.cine` files. Track ID is authenticated as AAD. Writes use `.partial` + rename, metadata uses AtomicFile, failures remove partial files. Playback decrypts into a memory-backed MediaDataSource, avoiding decrypted files on disk. Downloads have a **64 MB per-track limit** because playback decrypts the whole track into memory. Key generation uses a static lock.
- `DownloadService.java`: foreground download work, progress and error events, serialized native download queue; validates audio responses, sends bytes straight to the vault. Does not use MediaStore, public downloads, FileProvider, or share intents. Resume/retry across app/process death is not implemented.
- `Events.java`: package-scoped broadcasts protected by a signature permission.
- `AndroidManifest.xml`: app-private services, no storage permissions/provider; backups disabled and data-extraction exclusions.
- Supplied adaptive and round launcher resources live in `res/mipmap-*`; Android 12+ animated splash resources are under `res/drawable-v31` and `res/values-v31`, with a centered static pre-Android-12 launch background. Notification uses `@drawable/ic_cine_notification`.
- The AndroidX splash dependency documented by the pack was not added because its cached metadata needs an uncached AndroidX annotation artifact. The app uses platform splash theme resources directly and starts `MainActivity` with the existing app theme.

## Verification: what passed

1. `npm.cmd run build` from `mobile/`: TypeScript and Vite succeeded. Approximate bundled JS 199 KB; CSS 20 KB.
2. `npm.cmd run test --prefix mobile`: **4 tests passed** (`mobile/src/library.test.ts`) covering favorite toggling, playlist order/deduplication, multi-timestamp LRC parsing, and playback-time formatting.
3. Gradle `:app:assembleDebug :app:assembleDebugAndroidTest --offline --no-daemon`: **BUILD SUCCESSFUL**. Latest test-only rebuild also succeeded.
4. Both APKs installed successfully on the local Android API 34 emulator. All four instrumentation checks passed: encrypted private storage roundtrip/deletion, tamper rejection, interrupted-download cleanup, and native offline play/pause/seek/queue advance after activity close. Queue test race was fixed by restoring its explicit test queue after WebView startup.
5. The asset-integrated APK built offline successfully, installed, and rendered the home screen. The pack's gradient symbol and lime-tinted UI icons are visible. Screenshot: `.device-test/cine-music-assets-installed.png` (landscape Android TV emulator; not phone validation). Recent log check showed no app startup exception.
6. Chrome mobile viewport **393 x 852** UI check passed: home no horizontal overflow, all four navigation screens render, playlist creation persists, settings open/close; **no uncaught JS exceptions**. Report: `.device-test/ui-report.json`. Runner: `scripts/check-mobile-ui.mjs`.
7. Browser screenshots inspected/generated:
   - `.device-test/cine-music-home.png` (visually inspected, looks correct)
   - `.device-test/cine-music-search.png`
   - `.device-test/cine-music-library.png`
   - `.device-test/cine-music-downloads.png`
   - `.device-test/cine-music-settings.png`

## Verification: incomplete / failed / next

Native encrypted offline playback and vault checks passed on the local Android TV API 34 emulator. Streaming/network download and physical-phone behavior are still unverified.

`android/app/src/androidTest/java/com/heisbaed/cinemusic/VaultChecks.java` implements real device checks for:

1. AES-GCM round trip, private ciphertext/metadata, deletion.
2. Tamper rejection.
3. Interrupted-download cleanup.
4. Generated WAV stored encrypted, native offline playback, pause, seek/resume, and advancing the native queue after closing the activity.

The first instrumentation run ended with a MainActivity input-focus ANR. A later run reached the first three passes but failed the queue-advance assertion because WebView startup could overwrite the test queue. The instrumentation setup now restores its explicit queue after app startup; the latest full run passed all four checks.

The only actual installed system image is Android TV API 34 x86. `Pixel_7_API_33` AVD config exists but its system image is missing. A new workspace-local AVD (`CineMusicTest`) avoids modifying the user's AVDs. The emulator was switched back to `1920x1080`, density `320`; after that the actual Cine music UI rendered and the short app error log check was clean. This is **not physical-phone validation**.

Next actions:

- Validate real search, direct playback, downloads over network, offline reopening and notification controls on a phone. **Live catalog, streaming, lyric retrieval and network downloading have not been proven.**
- Investigate/port WEB_REMIX PO-token handling if direct profiles fail in practice.
- Test a larger real download: memory behavior, tag validation, interruption, retry and deletion.
- Check lifecycle/audio focus (calls/headset), screen off, app swipe-away, and native background next on a real device.
- Fix `SongRows` defined inside `App`: its component identity changes on each playback tick, causing list remounts. Move it out or make it a plain render helper. Native player updates arrive about every 750 ms.
- Avoid duplicate IDs when adding songs to queue; native current-index lookup uses the first ID match, so intentional repeated entries need queue-entry IDs or deduplication.
- Consider caching artwork/lyrics for saved songs, download cancellation and interrupted-download recovery.
- Check cold-launch appearance and splash on a physical phone; current screenshot check covered the integrated home UI on the Android TV emulator only.
- Add a portable Gradle wrapper to `android/` (not present yet), normal dependency installation/lockfile, and build instructions.
- Restore the missing upstream wallpaper if retaining/building the desktop source.
- Add `.gitignore` rules for new environment caches/build/test outputs before creating a Git repo or pushing anything. Root upstream `.gitignore` has not yet been extended for these new folders.

## Build environment and useful commands

PowerShell blocks `npm.ps1`: use `npm.cmd`.

The environment's npm cache is readable but not writable. Registry networking is blocked. Helpers copied cached artifacts into the workspace and installed mobile packages from those cached tarballs:

```powershell
node scripts/prepare-offline-cache.cjs --copy
node scripts/install-mobile-offline.cjs
npm.cmd run build --prefix mobile
npm.cmd run test --prefix mobile
```

`mobile/package.json` currently pins direct registry tarball URLs and esbuild/rollup overrides used during offline setup. `mobile/package-lock.json` does **not** exist. The helper installed 60 packages. Standard `npm install` attempts failed on cache metadata/permissions; a normal network-enabled setup and lockfile should replace this workaround later.

Android dependency resolution also needed a local Maven cache:

```powershell
python scripts/prepare-android-cache.py
& 'C:\Users\baed\.gradle\wrapper\dists\gradle-9.3.1-bin\23ovyewtku6u96viwx3xl3oks\gradle-9.3.1\bin\gradle.bat' -p android :app:assembleDebug :app:assembleDebugAndroidTest --offline --no-daemon
```

- `.maven-offline/` exposes cached Maven artifacts using hard links/copies. Gradle settings use it when present.
- `android/local.properties` points to workspace `.android-sdk/`. Android platform 36, build tools 36.0.0 and licenses were copied here because javac's ZIP handling of the original read-only SDK JAR paths failed with AccessDeniedException.
- JDK: `C:\Program Files\Java\jdk-24`; Gradle 9.3.1.
- Gradle warns local platform-tools is absent; build still succeeds. Use the original SDK adb for tests.
- These caches are large and are **environment artifacts, not source**. Do not publish/commit them. Do not recursively delete/move any outside-workspace paths.

Device commands:

```powershell
adb reconnect offline
adb devices
adb -s emulator-5562 install -r android/app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5562 install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5562 shell pm grant com.heisbaed.cinemusic android.permission.POST_NOTIFICATIONS
adb -s emulator-5562 shell am instrument -w com.heisbaed.cinemusic.test/com.heisbaed.cinemusic.VaultChecks
```

## Processes potentially still running at checkpoint

- Vite: `http://127.0.0.1:5178`, exec session `15232`.
- Chrome headless CDP: `http://127.0.0.1:9228`, browser PID `14736`; profile `.device-test/chrome-profile`, PID also saved in `.device-test/chrome.pid`.
- Workspace test emulator: `emulator-5562`, launcher PID `12192`, QEMU PID `21428` at last check; PID recorded in `.device-test/emulator.pid`. ADB can intermittently show offline; `adb reconnect offline` restored it twice.
- Fresh instrumentation APK build session `1439` is **complete, successful**.
- Older Gradle/UI sessions mentioned in this conversation are complete unless noted above. No need to restart/source-import everything.

The other emulator process started during a failed attempt to use the user's source TV AVD was stopped. Do not stop unrelated user emulators or edit their original AVDs.

## Suggested next-session instruction

Read `PROGRESS.md`, then continue Cine music from the existing code. Native encrypted playback checks and local asset integration are complete. Prioritize phone/network validation; do not confuse local emulator checks with live catalog/streaming/download proof.

## 2026-10-20 UI redesign checkpoint

- Reworked Home toward an Apple Music editorial / Spotify playback direction: icon-matched midnight/violet palette, concise home intro, Kenya/East Africa playlist rail, perspective card depth, cover-art fallback cards, and fewer Home sections. Live playlist results are fetched from the existing catalog; if the network is unavailable, regional query cards remain usable and resolve a playlist when tapped.
- Search bar now sticks while browsing results. Navigation is Home, Search, Library, Account; downloads live in Library. The account screen is a visual placeholder only because Firebase project/config creation is still blocked.
- Player supports swipe-up from mini-player, swipe-down to collapse, horizontal artwork swipes to change track, draggable seek, and cycling Repeat off / all / one. Android native queue now receives repeat mode strings.
- Song rows now render through a stable helper to avoid component remounts on frequent playback-state updates.
- Reduced Innertube first-request delay by sending immediately with cached visitor data (refresh happens in background). Native resolver now tries Android profile first with shorter timeouts; download service resolves a stream when no URL was passed, and uses the Cine notification icon.
- Updated native window/splash theme colors to the new UI palette and removed conflicting Android 12 splash attrs from the base activity theme.
- `npm.cmd run build --prefix mobile` passed after the UI changes and `npm.cmd test --prefix mobile` passed (4 tests). Current offline Gradle debug + instrumentation APK build is running; it must complete before the updated APK is considered ready.
- Emulator `emulator-5562` is available, but physical Galaxy S10+ `R58M34PT7SN` is currently absent from `adb devices`; prior home screenshot was inspected on Android TV emulator only. Emulator has no DNS/network, so live playlist art and playback could not be verified there. Do not claim physical-device validation for this iteration.
- No packages or media were downloaded. Firebase CLI `login:list` showed a signed-in account earlier, but `firebase projects:list`/`projects:create` both failed with EPERM reading `C:\Users\baed\.config\configstore\firebase-tools.json`; no project was created and no auth backend is configured. Do not attempt to bypass filesystem policy; continue after access is available.

## Dashboard analytics follow-up

- User requested Cine music analytics and a future dashboard view that can include stats from older apps as well. Keep one cross-app event model with app/platform attribution and session IDs so Cine music can be distinguished from legacy apps without double counting.
- Proposed events: `session_start`, `session_heartbeat`, `session_end`, `page_view`, `media_start`, `media_progress`, `media_end`, plus app-specific playlist/download actions. Include `appId`, `appVersion`, `platform`, `sessionId`, timestamp, and privacy-safe content IDs. Do not upload email, raw account identifiers, or audio/download data.
- Dashboard/UI work is not implemented yet. The analytics backend choice/config remains pending; auth project creation currently fails due Firebase CLI `EPERM` on the external configstore path noted above. Revisit after Firebase configuration can be provisioned, and then extend the existing Cine-verse dashboard to ingest old app telemetry as well as Cine music.

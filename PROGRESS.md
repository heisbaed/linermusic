# CineMusic Feature Updates

## Phase 1 playback fixes — 2026-11-08

- [x] Replaced the dead Bluetooth broadcast receiver with `AudioDeviceCallback` route monitoring in `PlaybackService`.
  - Pauses when a Bluetooth A2DP/SCO/LE audio output is removed while playback is active.
  - Records the pending resume and resumes after a Bluetooth output is added again.
  - Explicit pause, stop, track change, sleep fade, error, and manual resume clear the pending resume.
- [x] Removed unused Bluetooth manifest permissions and `BluetoothConnectionReceiver.java`; route monitoring needs no Bluetooth permission.
- [x] Added a 3-second volume fade-out for time-based sleep timers and restored volume on cancel/resume/stop.
- [x] Fixed playback notifications so pause/resume updates the action icon and foreground state.
- [x] Fixed widget play/pause to send `pause` while playing or loading instead of always sending `resume`.
- [x] Fixed widget cover loading so it re-renders the full widget instead of replacing it with a cover-only view.
- [x] Removed duplicate `super.onReceive` widget dispatch.
- [x] Updated account and sleep-timer copy to reflect supported Bluetooth resume and sleep fade.
- [x] 86 mobile tests pass; `tsc --noEmit`, Vite production build, and offline `assembleDebug` pass.
- [x] Device verification: background playback continues after Home with `PlaybackState.STATE_PLAYING`; service remains foreground; sleep timer faded and paused after the requested interval; `cinemusic://song/dQw4w9WgXcQ` opened and played “Never Gonna Give You Up”; share links resolve to `https://cinemusic.web.app/song/<id>` and `/download`.
- [ ] Physical Bluetooth disconnect/reconnect verification still needs a paired audio device. Widget placement/control verification still needs a home-screen widget instance.

## Phase 2 playback engine — 2026-11-08

- [x] Fixed widgets not appearing after placement: added `initialLayout`/`initialKeyguardLayout`, `widgetCategory`, removed the invalid 15-second `updatePeriodMillis`, compacted the layout for a 3x2 home-screen cell, switched periodic refreshes to broadcast updates, and draw the widget even if artwork loading cannot start.
- [x] Added streamed audio-quality preference: Auto, Low, Normal, High. The resolver now prefers low-bandwidth, balanced, or highest available audio itags and keeps quality-specific URL caches.
- [x] Added gapless preloading: while a track is near its end, the next queue item is resolved and prepared in a second `CinePlayer`; completion swaps to the prepared player immediately.
- [x] Added crossfade from 0–12 seconds: the prepared track starts at zero volume shortly before the outgoing track ends, both volumes ramp across the overlap, then the outgoing player is released.
- [x] Preloaded players stay muted and do not auto-start while preparing; volume and play-state settings now survive `CinePlayer` switching from local to ExoPlayer.
- [x] Transition handling cancels safely on pause, stop, seek/manual track change, sleep timer, queue change, playback error, and service destruction. Equalizer state moves to the incoming player.
- [x] Wired Gapless, Crossfade, and Streaming quality controls into Audio & playback, with live native setting updates and persisted preferences.
- [x] 86 mobile tests pass; `tsc --noEmit`, Vite production build, and offline `assembleDebug` pass.
- [ ] Device verification pending: the test device disconnected before install. Reinstall and verify widget placement, gapless/crossfade transitions, and quality selection.

## Summary of Changes

This update adds several requested features to CineMusic:

### 1. OTA Updates Channel
- Created `OTAUpdateService.java` - Background service that checks for app updates
- Created `OTAUpdateReceiver.java` - Broadcast receiver for update triggers
- Updates are checked on app start and every 12 hours
- On Wi-Fi, updates are automatically downloaded
- Shows dialog to user when update is available
- Downloads APK to cache directory
- Requests unknown sources permission if needed
- Uses FileProvider for secure APK installation
- Notification shown during download with progress

**New files:**
- `android/app/src/main/java/com/heisbaed/cinemusic/OTAUpdateService.java`
- `android/app/src/main/java/com/heisbaed/cinemusic/OTAUpdateReceiver.java`
- `android/app/src/main/res/xml/file_paths.xml`

### 2. Home Screen Widgets
- Created `MusicWidgetProvider.java` - AppWidgetProvider for music control widget
- Created `MusicWidgetService.java` - Background service for widget updates
- Widget shows current track info (title, artist)
- Play/pause, next, previous, and stop controls
- Progress bar showing current playback position
- Updates every 15 seconds
- Resizable widget (min 250dp x 110dp)

**New files:**
- `android/app/src/main/java/com/heisbaed/cinemusic/MusicWidgetProvider.java`
- `android/app/src/main/java/com/heisbaed/cinemusic/MusicWidgetService.java`
- `android/app/src/main/res/layout/widget_music_control.xml`
- `android/app/src/main/res/drawable/widget_background.xml`
- `android/app/src/main/res/drawable/widget_progress.xml`
- `android/app/src/main/res/drawable/playing_indicator.xml`
- `android/app/src/main/res/xml/widget_info.xml`

### 3. Enhanced Song Sharing
- Updated `songLinks.ts` with universal link support
- Songs now share via `https://cinemusic.web.app/song/ID` (web) or `cinemusic://song/ID` (native)
- Share text includes:
  - Song title and artist
  - Duration
  - Direct song link
  - App download link for recipients without the app
- `getShareText()` function creates rich share text
- `appShareLink()` provides direct app download link

**Updated files:**
- `mobile/src/songLinks.ts`
- `mobile/src/Player.tsx`
- `mobile/src/CineApp.tsx`

### 4. App Sharing Link
- Added deep link support for `https://cinemusic.web.app/song/*`
- Added `getAppShareLink()` and `getSongShareLink()` to native bridge
- When recipient has no app, they're directed to download page
- Deep links properly handle both cinemusic:// and https:// schemes

**Updated files:**
- `android/app/src/main/java/com/heisbaed/cinemusic/MainActivity.java`

### 5. Bluetooth Auto-Resume/Stop
- Implemented in `PlaybackService.java` with `AudioDeviceCallback` output-route monitoring
- Pauses playback when a Bluetooth audio output disconnects
- Resumes playback when a Bluetooth output reconnects after a disconnect during playback
- Uses the Android audio route without requesting Bluetooth permissions

**Updated files:**
- `android/app/src/main/java/com/heisbaed/cinemusic/PlaybackService.java`

### 6. Background Playback (Music continues when app closed)
- Updated `PlaybackService.java`:
  - Changed to `START_STICKY` so service persists after app closes
  - Don't stop foreground service on stop command - keeps notification for background playback
  - Bluetooth pause/resume commands handled via broadcasts
  - Audio focus loss no longer pauses playback (for background listening)

**Updated files:**
- `android/app/src/main/java/com/heisbaed/cinemusic/PlaybackService.java`

### 7. Download Speed Optimization
- Changed from single-thread to multi-thread executor (based on CPU cores)
- Increased buffer size to 64KB for faster downloads
- More frequent progress updates (every 200ms instead of 500ms)
- Better connection handling

**Updated files:**
- `android/app/src/main/java/com/heisbaed/cinemusic/DownloadService.java`

### Android Permissions Added
- RECEIVE_BOOT_COMPLETED
- REQUEST_INSTALL_PACKAGES

### Android Components Added
- OTAUpdateService
- OTAUpdateReceiver
- MusicWidgetProvider
- MusicWidgetService
- FileProvider for APK installation

## Testing Notes

1. **OTA Updates**: Need to host a manifest.json at `https://cinemusic.web.app/ota/manifest.json` with:
   ```json
   {
     "version": "0.1.2",
     "downloadUrl": "https://example.com/app.apk",
     "fileSize": 12345678,
     "releaseNotes": "Bug fixes and improvements"
   }
   ```

2. **Widgets**: Add widget from home screen long-press > Widgets > Cine music

3. **Bluetooth**: Pair Bluetooth device, play music, disconnect Bluetooth - music should pause. Reconnect - music should resume.

4. **Sharing**: Use the share button in the player. The shared text includes both the song link and app download link.

5. **Background Playback**: Start playing music, close the app. Music should continue playing. Check notification drawer for playback controls.

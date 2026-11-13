Cine music 0.1.2 repairs

- Spotify-style Search with a fixed rounded input, flatter results, browse categories, and radio discovery from recent listening. Song menus can open a radio view that loads actual related catalog tracks and starts a real queue.
- Heart, Shuffle and Repeat have high-contrast selected surfaces across four themes; Repeat All has an active dot and Repeat One has an explicit 1 badge.

- Restored synchronized lyrics following, old lyric cache compatibility, full-screen lyrics controls, and recovery from stalled lyrics requests. Search fallback rejects lyrics from a different song/artist/recording.
- Search remains editable and visible while scrolling results.
- Restored permanent audio-focus loss handling and proper shutdown when playback is stopped.
- Downloads use the persistent Android queue. Paused and failed jobs remain paused/failed until Resume or Retry; removed the competing UI queue and unbounded retry loop.
- Replaced the broken update service dialog with an Android update screen. Downloads run in a foreground service, verify SHA-256, package identity, newer version code, and the installed signing certificate. Installation resumes after granting Android's unknown-app permission and requires Android confirmation.

Verification: 90 unit tests; rendered phone checks for search, Library, lyrics, themes, profile/settings routes and narrow layout; six isolated cloud sync race checks; seven physical-device checks for encrypted storage and native offline playback. A bounded live catalog/source probe returned valid audio samples. Screenshots and detailed reports are in .device-test.

This remains a debug-signed testing build, matching the existing release signing identity. Install this APK once to obtain the repaired updater; the previously published updater cannot be repaired remotely. Future full-APK updates are checked from Help & about > Check for updates using the hosted OTA manifest. There is no JavaScript hot-update channel.

Limits: Google account selection, Bluetooth hardware switching, every real catalog song, and every TV/remote device are not exhaustively verified by these automated checks. Lyrics and stream availability depend on the source services. Test fixtures are isolated and are not production content.

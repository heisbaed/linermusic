Cine music 0.1.7

- New Releases uses confirmed release dates from the last 30 days. Unconfirmed and older music stays out of this shelf.
- Restored soft blur and animated transitions around the active lyric. Timing adjustment is available through the lyrics menu. Removed the Tap to open label.
- App-themed sorting sheets stay above playback controls. Sorting is available for liked songs and saved albums.
- Song shares contain one song URL. Opening a new shared link in a browser displays the supplied song title, artist and catalog artwork, with an Android app link.
- Dark launcher background and consistent pink emblem. Splash includes By Osborne's Digital Solutions.
- Startup uses an animated emblem reveal, the Cine music wordmark and the owner branding footer, then fades as the app renders.

Verification includes 105 unit tests, 11 rendered feature groups, successful Android build, and a narrow browser song page. Physical-device checks and release hashes are recorded in PROGRESS.md.

Song-specific social chat previews were skipped at the owner's request because the Firebase server endpoint requires enabling billing. Shared pages retain generic site preview metadata. APK updates use Android's installer confirmation. A complete fresh OTA download-to-install cycle remains unverified.

Recent-release dates are cross-checked against public iTunes catalog metadata. Tracks with unavailable exact dates are omitted. Existing offline downloads and playback integrations are retained.

The phone currently has a newer Connect preview installed by the parallel TV work. The public APK retains the playback engine verified in v0.1.6. Final splash appearance and fresh physical playback remain pending because the phone is locked. The available phone-emulator configuration has an incomplete system image.

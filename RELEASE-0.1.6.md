# Cine music v0.1.6

## Search and discovery

- Live suggestions, progressive results, partial-name/typo matching and artist/album navigation.
- Official-source live recordings are included in All and Songs. Unrequested instrumental/beat uploads rank lower.
- Verified the original Umenipendelea (Live) by Neema Gospel Choir in real phone search and playback.
- Genre tiles use bundled artwork in a two-column layout. Long top-result and song-row titles stay inside their bounds.
- Home loads catalog results without waiting for every artwork download. Radio offers Balanced, Familiar and Discover ordering.

## Five smart features

- Daily Mix creates a private playlist from actual related tracks using favorites and recent music.
- Hide songs/artists from new recommendations, with Restore under Settings > Hidden music.
- Continue a listening session from its saved position and queue.
- Clean duplicate playlist recordings while preserving separate versions.
- Adjust synchronized lyrics earlier/later in 250 ms steps, saved per song.

## Playback, library and downloads

- Four mini-player controls, synchronized Hearts and visible Repeat One state.
- Earlier next-track preparation, one bounded stream recovery attempt, coherent Off/Gapless/Crossfade preferences.
- Sort songs and albums through a themed bottom sheet, multi-select, favorite, add/create playlists, download or remove selections.
- Pause all, Resume all, queue priority, transfer speed/size, truthful Wi-Fi and failure states. Bulk submissions are batched. Progress avoids repeated storage scans and large full-queue broadcasts. Large collections render incrementally while retaining their full playback queues.
- Fixed a vault listing bug that replaced the first completed song with a summary record. Socket timeouts now use bounded reconnects.
- Widget and notification/lock-screen controls share the native playback session. Current artwork populates media metadata. Artwork/title taps open the player.
- Add the home-screen widget from Settings or the launcher Widgets menu.

## Verification

102 unit tests, 18 rendered fixture feature groups, and 9 physical-device instrumentation checks passed during development. Native checks include private encrypted storage, offline playback, widget PendingIntents, MediaSession transport/seek, and restored position. Real Neema playback reached audio in approximately 6.8 seconds in the measured test.

The final APK was installed over USB. A complete live OTA download-to-install cycle remains unverified. Permission return and Android installer handoff were exercised.

## Distribution and scope

This APK uses the existing debug signing identity for compatibility with installed Cine music builds. Updates use full APK download with integrity/signature verification and Android installation confirmation. Discovery depends on catalog availability. Hidden-music preferences and lyric timing are device-local. Resume checkpoints also use the existing account service where configured. Daily Mix playlists use the existing library/cloud sync. Genre illustration uses supplied bundled artwork. The lyrics preview keeps its LYRICS label and chevron. The requested Tap to open copy was removed.

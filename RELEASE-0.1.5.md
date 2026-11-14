Cine music 0.1.5 — responsive search and batch download recovery

- Real catalog autocomplete while typing, with matching recent searches and a separate action to use a suggestion without submitting it.
- Search results appear progressively as requests finish. Typing preserves existing results while refreshing; cancelled responses cannot overwrite a newer query. All search uses two requests instead of six; category filters load their own results.
- Partial artist/song names and single-character misspellings receive better ranking. Suggestions can help refine or correct a query; source catalog availability still determines results.
- Song taps start playback and dismiss the keyboard; artist, album and playlist results open their detail pages. Search state survives returning from details.
- Resume all queues paused/failed downloads through the persistent native service, respecting connection and Wi-Fi-only preferences. Completed downloads are preserved.
- Retains the physical-device search focus fix and verified APK update metadata from 0.1.4.

This is a debug-signed testing build, compatible with the existing release identity. The app uses its configured music catalog and does not access Spotify's private search or recommendation backend.

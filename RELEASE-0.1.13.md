# Cine music 0.1.13

Version code: 16. Separate Mobile and TV APKs.

## Changes

- Starting a different music context clears prior Smart Shuffle additions and listening seeds. Cancelled or stale recommendation responses cannot append to the new queue.
- Avoids overlapping Smart Shuffle and autoplay requests while recommendations are loading.
- TV lyrics reuse inactive lyric rows, reduce unnecessary progress updates outside timed lyrics, prefetch lyrics in the player, and cache up to 50 lyric results during the session.
- Phone media notification, lock-screen metadata and widget follow the shared Connect playback state, including TV track changes.
- A rejected media URL (HTTP 403/410) can trigger one fresh source session within the existing resolution deadline. Native playback records the latest sanitized failure code locally for intermittent-failure diagnosis.
- Update manifests and downloaded APKs are checked against their Mobile/TV platform. Repeated update requests preserve an active download's progress.

## Verification and limits

Both web interfaces and native APKs were compiled. USB installation succeeded on the phone and network installation succeeded on the TV; both report version 0.1.13/code 16. No automated test suites were run, respecting the testing freeze. The reported song played during targeted diagnosis; the evening playback failure was not reproduced, so this release does not establish that every intermittent playback failure is resolved. The complete OTA permission/download/installer flow and extended Smart Shuffle/lyrics performance remain unverified.

Existing package identity, signing and user data are preserved. Source restrictions can still prevent individual tracks from playing.

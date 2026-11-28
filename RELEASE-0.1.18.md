# Cine music 0.1.18

Version code 21. Separate Mobile and Android TV APKs. Existing package identity, signing and saved account/offline formats are retained. Native APK upgrade is required.

- Search: broader independent music/video retrieval, richer identity merging, title-before-unrelated-artist ranking, official-source evidence, typed/natural query intent, conservative artist aliases and a bounded title fallback. Cross-screen search requests survive navigation. No hardcoded Gidi/Katika recording IDs.
- Recommendations: bounded taste adjustments preserve seed relevance; artist/recording genre evidence is distinguished. Duplicate identity includes the artist; queue continuation preserves exclusions and changed accounts/contexts cancel old recommendations.
- Playback/lyrics/Connect: shared cancellable lyric requests, metadata matching, memoized mobile parsing, consistent offsets and immediate seek jumps. Rapid remote seeks coalesce to the latest account-safe request. Upcoming-track preparation remains independent of crossfade.
- Downloads: captured quality for future jobs, coalesced background queue updates, free-space checks, bounded transfer recovery/range validation and one fresh expired-source lookup. Protected-file identity/length checks and authenticated decryption retain private storage and Keystore keys. Partial transfers never become offline-ready; explicit Pause/Resume restarts the protected transfer.
- Dj Cine: configured native reCAPTCHA App Check for this sideloaded Android distribution, retaining enforcement and restricted native configuration. Installed online voices are supported, preferring offline voices; no voice packs are downloaded automatically. No provider advertising was added.
- Cloud playlists: conditional writes and three-way merging preserve concurrent edits, with bounded retries and durable pending changes. Auth refresh/account fencing and monotonic sleep timing are retained/improved.
- TV system controls: standard trusted media-browser/session integration and optional native Cine music playback screensaver. Choose it in TV system Screensaver settings; OEM media-panel availability remains system-dependent.
- Mobile notifications: real completed-download, followed-release and update-reminder preferences, permission state and activity history. Release checks are bounded local background work; update reminders only fetch metadata.
- Controls: readable theme-aware selected states and Repeat One marker; corrected search input surface/title bounds; consistent hit targets, TV focus and reduced motion. Accepted artwork-led player placement is preserved.
- Dashboard: truthful session/foreground metrics, overlapping-interval deduplication, correct zero peak, latest observed release per installation, bounded incremental feeds and stale/error status. New app events retain occurrence time; hidden web pages stop accumulating activity. Historical incorrectly timed events cannot be repaired retroactively.

## Evidence and limits

Both app interfaces/native packages and the website are compiled during delivery. Publication outcomes are recorded in PROGRESS.md. No automated tests, device installation, visual checks, playback/offline/AI requests or installer/notification runtime checks were performed, as requested. The owner will update and assess both builds manually.

Firebase verification configuration is completed without enabling paid billing. AI still depends on verification, connection, model availability and quota; successful live AI/speech is not claimed. Upstream music/lyrics/release coverage and TV launcher/OS surfaces remain external constraints. This is not a claim of perfection or equivalence to private Spotify/Apple/YouTube algorithms.

Read SERVICE-REVIEW-0.1.18.md for the research links, implementation details, security alert status and manual acceptance checklist. Existing Firebase client-key alerts are not falsely marked revoked; no administrator credential is added.

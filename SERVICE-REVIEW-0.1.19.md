# Cine music 0.1.19 — service, algorithm and interaction review

Implementation review, 28 November 2026. Deliver separate Mobile and TV APKs, public downloads and platform update feeds. Do not install on the owner's devices. Runtime, UI, playback, AI and automated testing remain excluded by the owner's instruction; compilation and source/configuration review are authorized. The owner will update and check the release manually.

## Evidence and design basis

- [Apple Music metadata](https://artists.apple.com/support/1119-music-metadata): distinguish recording titles, primary/featured artists and release facts. Mood/genre labels need relevant metadata.
- [Apple catalog suggestions](https://developer.apple.com/documentation/applemusicapi/get-catalog-search-suggesions): typed query suggestions and top results are distinct from final catalog resources.
- [Spotify recommendation explanation](https://www.spotify.com/uk/safetyandprivacy/understanding-recommendations), [YouTube Music personalization](https://support.google.com/youtubemusic/answer/6313542), [Apple listening preferences](https://support.apple.com/guide/iphone/get-personalized-recommendations-iph2b1748696/ios): listening and feedback inform discovery; private listening/history controls affect that input. These are published product principles, not access to proprietary ranking models or user data from those services.
- [Spotify TV](https://newsroom.spotify.com/2023-11-09/find-your-favorite-audio-more-easily-with-the-redesigned-spotify-on-tv-experience/): clear discovery shortcuts, current listening and an accessible upcoming queue.
- [Android TV focus](https://developer.android.com/design/ui/tv/guides/styles/focus-system), [TV buttons](https://developer.android.com/design/ui/tv/guides/components/buttons), [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps), [Apple buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): distinguish focused, pressed and selected states, retain readable labels, use clear action hierarchy and adequate hit areas.
- [Firebase native reCAPTCHA App Check](https://firebase.google.com/docs/app-check/android/recaptcha-enterprise-provider): supported app verification for native apps, including Spark configuration. Keep enforcement and risk scoring enabled; do not ship debug bypass tokens.
- [Android media browser](https://developer.android.com/media/legacy/audio/mediabrowserservice), [DreamService](https://developer.android.com/reference/android/service/dreams/DreamService): expose the actual shared session to trusted system clients; a user-selected screensaver is a separate OS integration.
- [HTTP range semantics](https://www.rfc-editor.org/rfc/rfc9110.html), [bounded retry guidance](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/), [Android Keystore](https://developer.android.com/privacy-and-security/keystore), [Firebase conditional writes](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests): bound retries and data sizes, avoid mixing changed resources, preserve cryptographic authentication, and avoid overwriting concurrent changes blindly.

## Findings and implemented changes

### Search, listing and recording identity

Small read-only source lookups for the reported titles showed that YouTube Music calls Diamond Platnumz's own Gidi videos `GIDI (COVER)`. YouTube's original video metadata retains the full original titles and official artist-channel evidence. The previous blanket cover penalty pushed these uploads below unrelated songs by the same artist. Katika's official current release uses Aika & Nahreel in its metadata, so a Navy Kenzo-only query can omit it from the first music response. These observations diagnose metadata/retrieval problems; they are not proof of playback.

Implemented merging richer duplicate-ID metadata, preserving official source/artist evidence, recording-title priority over unrelated artist hits, separation of uploader identity, a supplemental public artist-video search and one bounded title-focused lookup for poor full-query recall. No recording IDs or artist aliases are hardcoded. Search still retains available alternatives and does not use genre/country as an availability gate.

### Recommendations, smart shuffle and daily mixes

Reviewed seed fencing, context cancellation, known genre compatibility, hidden music, early skips, daily rotation and artist diversity. Implemented stronger preservation of source candidate relevance and bounded diversity adjustment. Duplicate recording identity now includes the artist. Exhausted-queue continuation preserves heard/generated exclusions instead of resetting them. A new listening context or account cancels previous recommendation requests. Strong recording-level genre conflicts can exclude a candidate; broad artist tags and legacy tags without provenance remain soft evidence.

### DJ and speech

The owner confirmed a device-verification rejection. The old Play Integrity registration uses its default app-recognition policy, unsuitable for the present distribution flow. Created a package-scoped native reCAPTCHA key and configured App Check at the standard 0.5 risk threshold, without enabling paid billing. Native code uses the supported reCAPTCHA provider; its Java integration compiles. A successful attestation/model request is not claimed.

Installed online voices were excluded from enumeration. Speech now prefers installed offline voices and can use an installed engine's online voice, with a clear connection note; it never installs voice packs automatically. Remote-output narration remains limited to the device producing audio. Voice information refreshes when returning to the app.

### Downloads and offline storage

Implemented captured quality for newly queued jobs, actual free-space checking, a bounded reconnect budget with jitter, non-retryable HTTP rejection handling, range validators and one fresh source resolution for expired/rejected media addresses. Explicit Pause/Resume continues to restart the protected transfer, as existing job metadata states; it does not falsely promise a persisted byte resume.

Offline readiness now checks expected ciphertext length and metadata identity. Decryption uses a preallocated output buffer, validates the GCM tag before returning audio and clears buffers on failure. Existing private storage, non-exportable Keystore keys and authenticated AAD format are retained. A size check is not a claim that arbitrary corruption is cryptographically verified during library listing.

### Authentication, cloud, analytics and updates

Authentication cancellation now remains cancellation rather than a misleading network failure. Reviewed protected native token storage, same-account isolation and refresh fencing. Cloud playlists use conditional ETag writes and three-way merging of fields, song membership and ordering, with bounded conflict retries. Successful paths are acknowledged individually; pending local edits survive recoverable failures. Reconnection uses backoff and stops retrying configuration/permission failures blindly. Fixed analytics retry-flush loss of newly queued events. The updater retains hash, package, signer and newer-version checks, now requires the correct platform in the manifest/APK, and checks available storage. Cache clearing remains separate from protected saved songs. The Mobile and TV update feeds remain separate.

### System media and TV screensaver

Implemented a standard browser interface in the existing playback service, a published queue, queue-selection callbacks and trusted system-client access. Internal start intents carry a private capability, while browser binding uses framework access checks. Added an optional TV-only native DreamService using the current session and actual artwork/transport state. The owner must select `Cine music playback` in TV system Screensaver settings after updating; the app will not replace the selected system screensaver automatically.

### UI and button system

Implemented a shared interaction-state layer following the referenced guidance. Preserve the approved artwork-led direction and existing mobile/TV composition. Prioritize readable theme-aware states, consistent hit areas and action hierarchy, focus restoration, text overflow, loading/error states and reduced motion. No visual-fit or device-layout claim without the owner's manual review.

## Deeper algorithm design

The implementation uses public design principles, not Spotify, Apple or YouTube private code, trained weights, recommendation graphs or account histories. No claim of outperforming those services is supported by measurements.

- [Spotify Neural Instant Search](https://research.atspotify.com/2021/8/neural-instant-search-for-music-and-podcasts) distinguishes prefix matching, intent and item representation. Cine music uses a practical bounded counterpart: query-field parsing (`track:`, `artist:`, `album:`), natural “title by artist” interpretation while preserving the literal source query, prefix/one-edit matching, typed results and source-specific identity evidence. It does not implement the paper's trained neural network.
- [Google candidate generation and ranking](https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/) informs separating retrieval from ranking. Cine music first gathers candidates from mixed music search, Songs, Videos and public artist-video metadata, then merges evidence and ranks. One title-focused fallback and, for an explicit artist query with weak results, one validated alias lookup improve recall. Calls are bounded and cancelled when obsolete; partial results appear while supplementary retrieval finishes.
- [MusicBrainz aliases](https://musicbrainz.org/doc/MusicBrainz_API/Search) are accepted only for one unambiguous exact name/alias match with a high source score. The existing shared queue keeps its [one-request-per-second limit](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting). Aliases have a bounded cache and optional deadline; missing metadata never blocks playback. No hand-maintained song-ID or artist-rename exception list is shipped.
- [Spotify contextual recommendations](https://research.atspotify.com/2021/04/contextual-and-sequential-user-embeddings-for-music-recommendation) motivates retaining current listening context. Cine music preserves provider seed relevance, applies bounded feedback/genre adjustments, limits adjacent artist repetition without replacing much more relevant candidates, and excludes hidden/recently skipped music. It does not train session embeddings.
- Recommendation generation is fenced by account, queue generation and current track. Smart Shuffle additions are cleared on an explicit context change and preserved appropriately during automatic continuation. Existing native preparation of upcoming audio remains active independently of crossfade; the resolver now tries its last successfully probed profile first, with other profiles retained as fallbacks.

### Search pipeline and its limits

1. Parse intent and preserve the editable query.
2. Retrieve independent catalog/video candidates; show useful partial results.
3. Merge duplicate IDs without dropping richer artist, title, album or official-source metadata.
4. Score title relevance before unrelated artist matches; distinguish artist identity from uploaders. Official evidence can outweigh a misleading “COVER” label, while requested versions remain discoverable.
5. For weak recall, use a bounded title lookup and optional authoritative aliases; retain alternatives rather than filtering the catalog by country/genre.
6. Open the typed resource or play the actual selected recording. Search requests from other screens are retained until the search destination mounts.

The Gidi/Katika source findings explain the reported failure and motivate general changes. They do not establish an exhaustive catalog, guarantee the original recording for every spelling/territory, or prove these recordings play. Public upstream responses can change. Artist aliases are optional source evidence, not guessed equivalence.

## Responsiveness and reliability details

- Mobile lyrics are parsed only when text changes, not on every progress update. Both parsers respect global offsets and reject invalid seconds. Matching checks cleaned title, artist and duration; a shared request service avoids duplicate fetches, cancels abandoned requests and briefly caches unavailable results. Existing lyric presentation/blur flows remain intact.
- Routine native progress updates are coalesced; seek discontinuities bypass that coalescing. Connect coalesces rapid seeks into the latest immutable target/account request, keeping one in flight and rejecting changed-account work.
- Bulk-download persistence and full job-list publication are coalesced off the main thread. Per-job progress remains available. There is still one active audio download, protecting playback/network capacity; a universal speed gain is not claimed.
- Artwork fetches share per-key locks and bounded disk caches. TV native artwork cache is 64 MB. Failed-art callbacks complete rather than leaving callers waiting indefinitely.
- Auth refresh checks that the saved account/token still matches before writing a response. Sleep timers use monotonic elapsed time. Native cancellation was reviewed and its existing pending-request checks retained.
- Permanent download HTTP failures are not retried endlessly; temporary failures have a total retry budget and jitter. An expired/rejected source gets one fresh resolution. Changed range validators/totals cannot silently combine different content.
- Offline files retain AES-GCM, app-private storage and Android Keystore keys. Readiness checks identity/expected size; playback authenticates the file before returning plaintext. The 64 MB per-track bound remains. Damaged/truncated old files need downloading again; the update cannot reconstruct missing bytes.

## Notifications

The Mobile Notifications screen replaces placeholder rows with actual preferences and activity:

- Completed downloads record activity and can alert after the protected transfer completes.
- Followed-artist release reminders are opt-in. A local Android scheduled job checks a bounded rotating group while connected, matches exact artist metadata, uses the earliest returned edition date per title and only accepts releases within 30 days. Catalog coverage is limited; it is not a guarantee of every artist release.
- Optional app-update reminders check platform manifest metadata only. They never download or install an APK automatically; the alert opens the updater.
- Permission state is read from Android; blocked notifications are explained. Preferences/history are stored locally, release preferences follow the account, and release checks do not expose account tokens to the catalog provider. Refresh and activity rows have working destinations.
- Android controls background scheduling and may defer alerts for battery/network restrictions. This requires no paid push backend. TV system transport/screensaver integration is separate from these Mobile notification preferences.

## Dashboard and measurement integrity

The website dashboard now:

- Deduplicates event IDs, scopes session identity by surface, and measures the union of heartbeat intervals instead of counting overlapping seconds twice.
- Displays a true zero-session peak, and labels the 90-second live window as sessions rather than people. A connection failure retains received data and marks current activity unavailable.
- Uses each installation's latest observed version within the period, avoiding counting the same installation in multiple release buckets.
- Bounds feeds at 50,000 events per surface and explicitly warns about incomplete totals at that limit. Ordinary refreshes retrieve a short overlap; full refresh runs every five minutes or on the Refresh action, incorporating delayed events.
- Preserves original occurrence time on new Mobile/TV uploads. Previously uploaded events whose timestamp was overwritten cannot be reconstructed; older app versions may still send them that way.
- Stops website activity accumulation while hidden, records actual observed elapsed intervals, preserves events queued during an upload, and retries network/transient failures without endlessly retrying permanent rejections.
- Labels completion/download figures as event ratios in the selected window, rather than claiming matched-cohort success rates or unique people. Foreground time is not audio listening time.
- Adds keyboard focus, adequate filter targets and reduced-motion treatment. No synthetic production events or fabricated metrics were written to demonstrate the dashboard.

Analytics remain first-party client observations, not audited billing/unique-person counts. Existing anonymous append-only event ingestion remains susceptible to fabricated submissions by a determined client; this release does not turn it into a trusted financial measurement system. Backend access rules still protect dashboard reads. No broad rule rewrite was performed for this release.

## UI and button changes

Shared controls have consistent press, focus, disabled and selected states. Favorite/shuffle/repeat use readable theme-aware fills, and Repeat One has a visible `1`. Search fields avoid a second native input box; long result titles stay within their cards. Narrow/short-screen sizing and reduced-motion rules are retained. TV focus uses a theme-accent outline without obscuring artwork/text. Compact short-viewport Home adjustments preserve the accepted full-art player/control composition. These are source-level changes; no new screenshot or visual-fit result is claimed.

## Configuration, security and owner setup

Native reCAPTCHA App Check is configured in cinemusic-1 with a package-scoped Android key and 0.5 risk threshold. The restricted DJ client key is native build input, not tracked public JSON. Enforcement remains on; debug bypass tokens and administrator credentials are not shipped. No billing upgrade or paid service was enabled. Installed online/offline TTS voices are enumerated without downloading voice packs.

There is no known unprovided owner configuration needed to package these builds. Actual AI requests remain subject to device verification, model availability, connection and free quota. Speech needs an installed voice for the selected language and internet if that voice is online. The build/configuration work is not proof of a successful live request.

The TV screensaver is included, but Android requires the owner to select **Cine music playback** under TV Settings → Screensaver. Existing OEM screensavers cannot be forced to host another app's controls. Trusted system media clients receive the current shared session; whether a launcher exposes its own media panel remains under OS/launcher control.

The prior Firebase client-key alerts remain open rather than falsely labelled revoked. The old shared browser key remains needed by existing clients and no longer has Firebase AI access. Source history was not rewritten, and historical key misuse has not been audited. See DJ-BUILD.md.

## Compilation, delivery and manual checks

Final delivery status is recorded in RELEASE-0.1.19.md and PROGRESS.md. Required packaging: compile both web interfaces, both native APKs and the website; publish separate APK assets, source and platform update feeds. Do not install on the owner's devices.

No automated tests, app launches, screenshots, song playback, offline playback, live AI/speech requests, notification/installer flow checks or performance benchmarks were performed. Source review, small read-only reported-title metadata lookups, configuration operations and compilation are the actual evidence.

After updating manually, the owner should check: Gidi/Katika and other artist/title queries; Smart Shuffle after changing genre/context; Dj Cine plus spoken introductions; interrupted and completed offline downloads; lyrics/seek/Connect notification synchronization; theme-selected controls; dashboard activity; and TV media/screensaver controls after selecting the screensaver. These are normal runtime acceptance checks, not a claim that all unknown bugs have been eliminated.

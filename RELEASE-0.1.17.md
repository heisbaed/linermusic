# Cine music 0.1.17

Version code 20. Separate Mobile and TV APKs; existing package identity, signing and account storage retained.

- TV Home: greeting and compact library/recent shortcuts above an open artist-radio/new-release feature, with a floating cover, known artist backdrop and smaller music shelves. Content uses actual listening/catalog data; New releases retains the 30-day date check.
- TV focus: theme-accent outlines and subdued surfaces replace the bright gradients that obscured labels. Artwork and text remain visible without focus scaling or glow.
- TV splash: one locally bundled video composition presents the complete original emblem, wordmark and Osborne branding together. Each theme has a matching static fallback. Reduced animation uses the fallback; application readiness still controls dismissal. Mobile keeps its existing splash.
- Dj Cine: TV uses an uncluttered two-column request/mix layout with optional preferences. User-facing provider branding is removed. Native Play Integrity App Check supplies limited-use tokens for AI requests; missing verification/configuration, timeout, quota and connection errors have truthful recovery actions. Music-only requests remain an explicit alternative.
- Security: removed the tracked DJ Firebase-key JSON and moved the replacement client key to ignored native build configuration. The replacement is restricted to this Android package/signing certificate and the three required services. Removed Firebase AI access from the previous shared browser key while retaining its other services. Existing Firebase authentication client keys are not revoked. A client key remains extractable from an APK; service restrictions, App Check and backend access rules are the protections. No server credential is introduced.
- Responsiveness: player progress is interpolated without rerendering the entire app on every native tick; unchanged queues are omitted from repeated native events. TV lyric rows are memoized and word updates are bounded. Cached public artwork retains CORS headers so the small sampled background can avoid a costly full-screen blur.
- Connect: a realtime command wake-up stream replaces waiting solely for the polling interval. Fresh account/owner/epoch checks still validate each command. Acknowledgements are batched, duplicate execution protection is retained, and polling remains a fallback.
- Search: exact recording/title/artist and official catalog evidence improve ordering. Covers, karaoke and altered versions are demoted unless requested. Results are not discarded by genre/country gates. This does not guarantee retrieval of a recording missing from the source catalog.
- TV system playback: the TV build explicitly identifies its platform, publishes fuller MediaSession artwork/track metadata and a transport notification with TV information, and updates installed playback widgets. OS media/widget entry opens the player. Settings exposes notification settings and widget pinning where supported; unsupported TV launchers report unavailability.

## Compilation and delivery

Both interfaces and native APKs are compiled during packaging. Actual installation, upload and hosting outcomes are recorded in PROGRESS.md. No automated tests, screenshots, playback, AI requests, latency measurements or new-build UI checks were performed, following the owner's instruction.

## Remaining dependencies and limits

Play Integrity was enabled for the Firebase project; native app signing registration is configured. AI availability still depends on device attestation/Google Play services, any required Play Console linkage, model availability and quota. No successful live DJ request is claimed. No paid billing was enabled.

The original shared Firebase browser key remains active for other Firebase clients; GitHub's existing client-key alerts are not falsely marked revoked. This change does not constitute an audit of historical access or proof that no misuse occurred. See DJ-BUILD.md for build configuration and protections.

TV system media panels and widget pinning depend on the installed launcher/OS; publishing a MediaSession cannot add a missing launcher surface. Runtime performance, visual fit and the reported Gidi search outcome remain for the owner to assess.

# Cine music 0.1.14

Version code: 17. Separate Mobile and TV APKs.

- Encrypted offline songs now use the same Media3 audio engine as streaming, including seeking and preloaded transitions. Previously offline playback used Android MediaPlayer, whose container/codec handling could differ from streaming.
- New downloads must contain a supported MP4 or WebM header before being marked complete. Offline decoder errors now explain the download recovery path. Queued or partial playlist downloads no longer count as completed downloads.
- Liked Songs has remembered sorting (recent, oldest, title both directions, artist, duration), genre/type filter chips, and bulk Edit genres. Explicit saved tags and words in source titles supply filters; artist identities are not used to invent genres. Genre labels survive library sync and playlist backups.
- Four sharp launcher icons: Forest Original (default), Forest Mint, Midnight Rose and Charcoal Ivory. Settings > Appearance > App icon on mobile, and App icon in TV settings, changes the Android launcher icon independently of the UI theme. Launchers may take time to refresh.
- The update screen displays percentage, transferred/total MB, verification and failure states, and an Install update button. Progress survives leaving and reopening the screen; installation uses Android's required permission/confirmation flow.

## Delivery limits

Builds only; no automated tests, device checks, or live playback verification were performed at the owner's request. The reported offline failure was not reproduced on a device. Existing corrupted/incomplete files may still need removal and a fresh download; this release does not claim to repair their bytes. Genre completeness depends on supplied metadata and the user's labels. Android launcher behavior and the complete update-install flow remain unverified.

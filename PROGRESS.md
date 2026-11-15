# Cine music release progress — 15 November 2026

## Release 0.1.8 / code 11

Separate mobile and TV APKs use dedicated interfaces, launcher entries, labels and update feeds. Existing package identity and signing are retained on each platform to preserve accounts and installation data.

- Mobile Connect replaces the top-bar Lyrics action. The lyrics preview remains available. Existing playback positions and layout were preserved in rendered checks before the final build.
- TV keeps its top-bar tabs and has a slimmer seven-control mini-player. The direct Queue Back/focus path was adjusted.
- TV Smart Shuffle cycles Off, Shuffle and Smart Shuffle using the existing recommendation engine, with a distinct sparkles icon.
- Native private artwork cache persists across launches, with 64 MB mobile and 32 MB TV limits. TV WebView no-cache mode was removed. Cache clearing continues to preserve encrypted music downloads.
- Unboxed animated pink emblem, Cine music wordmark and By Osborne's Digital Solutions footer. Startup follows application readiness.
- Connect supports device ownership, remote controls and offline phone listening with reconnection.
- Landing page presents separate mobile and TV downloads with sizes/checksums. OTA feeds are /ota/manifest.json for mobile and /ota/tv-manifest.json for TV.

## Verification and limits

105 unit tests, eight core rendered groups and twelve smart-feature groups passed earlier. The TV chat verified actual audio ownership, transfer, remote pause/seek/next and offline/reconnection on the prior Connect preview. Both separate APK builds succeeded and installation commands returned Success on phone and TV.

The owner explicitly requested stopping all tests to conserve quota. No further testing is being performed. Final artwork caching, TV Smart Shuffle and Queue focus restoration remain unverified on devices. Final splash appearance and the complete OTA download-to-install cycle are also unverified. Do not claim complete end-to-end verification.

Song-specific social previews remain skipped at the owner's request. Generic site previews and song browser links are present. Existing debug signing is retained for update compatibility.

## Artifacts

- releases/Cine-Music-Mobile-0.1.8.apk
- releases/Cine-Music-TV-0.1.8.apk
- releases/SHA256SUMS.txt
- Source branch release/0.1.8
- Public site https://cinemusic.web.app

Separate platform web builds are available through npm run build:mobile and npm run build:tv in mobile. Native packaging selects cinePlatform=mobile or cinePlatform=tv with cineAssetsDir pointing to the corresponding web output.

Publication is being completed. No further testing is authorized. The reported mobile layout regression was traced to platform-bundle CSS ordering. CineApp now imports its canonical theme/layout styles after component styles, and the corrected mobile APK is being installed.

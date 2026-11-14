Cine music 0.1.4

Includes the complete 0.1.2 repair and discovery update, plus the physical-device fix for the dark rectangular wrapper behind the Search field. The search input now has a single rounded surface and no native Android search-field decoration. Radio discovery tiles retain the page gutter.

Restored synchronized lyrics following, cache compatibility and visible transport; fixed paused/failed download jobs restarting themselves; restored audio-focus handling; added song radio with actual related queues and clearer Heart/Shuffle/Repeat states across themes.

In-app full-APK OTA updates: Help & about > Check for updates. Downloads verify SHA-256, size, package identity, increasing versionCode and matching signer. Android still requires installation confirmation. This is a debug-signed testing build compatible with the previous release identity. No separate JavaScript hot-update channel is included.

Verification: 90 unit tests, seven rendered feature groups, six isolated cloud-sync race checks, eight physical-device native checks, bounded live audio samples, and physical inspection of the focused Search field. Exhaustive Google sign-in, Bluetooth, TV and all catalog content testing is not claimed.

Fixed the root cause of the phone search box: TV-only focus outlines are now scoped to TV. Verified with the actual Android keyboard open, in addition to rendered checks.

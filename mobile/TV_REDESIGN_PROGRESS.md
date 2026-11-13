# TV UI Redesign Progress

## Goal
Redesign the whole TV UI without using mobile screens. TV-only themes: **pink glass** and **dark green**. Apple-style liquid glass UI, smooth flows/navigation/transitions. Exclude download features on TV (limited capacity). Profile editing only on mobile; TV is linking and using. Playlist/song cards like Spotify, with YouTube Music smooth animation style and artist cover on the right.

## Completed
- `AppContext.tsx`: added `TV_THEMES` (default/pink glass, green/dark green) and `tvThemeId()` normalizer.
- `CineApp.tsx`: TV theme init/persistence (`cine-tv-theme-v1`, `tvThemeId` clamp), separate TV/mobile theme storage/background/system bars, TV prefs/download gating (`useDownloads(..., isTv)`, no `wifi-only-downloads` save on TV), TV-only render branch (`TvShell` + `TvPlayer` + TV sheets), `openPlayer` dispatches `cine:tv-player-open` on TV, and `renderRoute(..., isTv)` maps to TV route components (blocks playlist-form/import/edit on TV).
- TV components: rewrote `TvLayout.tsx` as `TvShell`/sidebar/now bar/transitions; rewrote `TvHomeScreen.tsx`, `TvSearchScreen.tsx`, `TvExploreScreen.tsx`, `TvLibraryScreen.tsx`; added `TvRoutes.tsx` (catalog/playlist/collections including downloads-mobile-only/account-appearance/profile-mobile-only) and `TvPlayer.tsx` (liquid-glass player, controls, progress, animated right-side artist visual).
- Styling: replaced `tv-redesign.css` with Apple liquid-glass TV system for `data-theme="default"` pink glass and `data-theme="green"` dark green (rails/cards/rows, focus, transitions, reduced-motion); minimized `tv.css`.
- Shared gating: `ui.tsx` limits TV theme picker to Pink glass/Dark green; `Player.tsx` hides download actions and avoids download side effects in add-to-playlist on TV.
- Verification: `mobile` web build succeeded (`tsc --noEmit && vite build` → `android/app/src/main/assets/`, `index-y30NH_aQ.js`/`index-K7dP5ZHx.css`). Restored missing Android Gradle wrapper (`gradlew.bat`, `gradle-wrapper.properties`, compatible `gradle-wrapper.jar`, Gradle 9.3.1). `android\gradlew.bat :app:clean :app:assembleDebug` succeeded and rebuilt APK installed to TV `adb-18ACC29C0EEF-NrdtX7._adb-tls-connect._tcp` (Smart TV / `ro.build.characteristics=tv`). Remaining: on-device runtime validation — D-pad/focus order on rails/cards/sheets/player, now-bar/player transitions/back behavior, artist-cover fallback, TV auth/pairing, and visual polish on target TV.

## In progress / Next steps
1. **Finish `CineApp.tsx` TV wiring**
   - TV theme init: `tvThemeId(loadSaved('cine-tv-theme-v1','default'))`; persist `cine-tv-theme-v1` on TV.
   - `setTheme` clamps to TV themes on TV.
   - TV prefs: disable wifi-only/download relevance.
   - Theme effect: use TV backgrounds; system bars light only for pink glass TV.
   - Render: on TV use `TvShell` + TV routes (`TvHome/Search/Explore/Library` + catalog/playlist/collection/account TV screens) + `TvPlayer` + sheets/menu adapted; no mobile header/tab bar/bottom dock/player.
   - Route rendering: TV variants for collection/catalog/playlist/account; skip playlist-form/import/profile edit on TV (show read-only/linking message).
2. **Create/replace TV components (standalone, no mobile screens)**
   - `TvLayout.tsx`: `TvShell` + sidebar (Home/Search/Explore/Library/Profile) with liquid glass, focus states, page transition container, now-playing mini bar.
   - `TvHomeScreen.tsx`, `TvSearchScreen.tsx`, `TvExploreScreen.tsx`, `TvLibraryScreen.tsx`: Spotify-like rails/cards/rows, artist imagery emphasis, smooth entrance/hover/focus transitions.
   - `TvPlayer.tsx`: full-screen/immersive now-playing; YT Music style with large animated/blended artist/album art on the right, controls/queue/lyrics left or layered; smooth transitions; no download actions.
   - `TvRoutes.tsx`: TV catalog (album/artist/playlist), playlist view, collection views (no downloads collection), account/profile link screen (no edit forms) — all TV layout/styling.
3. **Styling**
   - Rewrite/extend `tv-redesign.css` (and keep `tv.css` minimal) for Apple liquid glass: blurred/translucent surfaces, soft depth, rounded geometry, pink-glass and dark-green `data-theme` variants, smooth motion (`transform/opacity` transitions), overscan-safe spacing, strong D-pad focus rings.
   - Card style: Spotify-like rectangular/rounded covers, metadata hierarchy; song rows with clear focus/playing state.
   - YT Music-inspired artist cover animation on player/right side (ken-burns/slow pan/scale/fade, reduced-motion aware).
4. **Download exclusion on TV**
   - Gate UI: hide download buttons/collections/jobs/progress in TV screens, player/menu, route screens.
   - `useDownloads.ts` / `CineApp.tsx`: on TV, no-op download operations and avoid download toasts/state churn (or provide disabled TV stub).
   - Library/collections on TV: show Favorites/Playlists/Artists/Albums/Recent only (no Downloads/Manage downloads).
5. **Profile editing mobile-only**
   - TV profile screen: show linked account, sign out/switch account via pairing flow link guidance; no edit-profile/change-email/password/delete forms.
   - Block `edit-profile`/change-email/change-password/delete routes on TV with safe message.
6. **Shared tweaks**
   - `ui.tsx` `ThemeEdition`: on TV show only pink glass/dark green.
   - `Player.tsx`/`SongMenu`: hide download actions on TV (if reused) or ensure TV uses `TvPlayer` actions only.
   - `spatialNav.ts`: ensure focus works with new TV components/overlays.
7. **Verification**
   - `cd mobile && npm run typecheck` / build as available; fix TS/CSS import issues.

## Key files
- `mobile/src/CineApp.tsx`, `AppContext.tsx`, `TvLayout.tsx`, `TvHomeScreen.tsx`, `TvSearchScreen.tsx`, `TvLibraryScreen.tsx`, `tv-redesign.css`, `tv.css`, `useDownloads.ts`, `ui.tsx`, `Player.tsx`, `spatialNav.ts`
- New planned: `mobile/src/TvExploreScreen.tsx`, `TvRoutes.tsx`, `TvPlayer.tsx` (or split)

## Constraints/decisions
- TV APK capacity limited: no download features.
- TV is linking/using; profile editing only on mobile APK.
- Only two TV themes: pink glass + dark green.
- Apple liquid glass, smooth flows/transitions; Spotify-like cards/rows; YT Music smooth artist-cover-on-right animation.
- Do not reuse mobile screens for TV; build TV-specific screens/shell.

## Last update
Progress file created after partial `AppContext`/`CineApp` TV wiring. Continuing with `CineApp` render/route wiring and TV component implementations.

# Android integration

## 1. Add resources

Merge `res/` into your app's `app/src/main/res/`. Resource names use `cine_` or `ic_cine_` to reduce collisions. The provided setup targets API 23 and newer. Use a modern compileSdk compatible with the selected AndroidX dependency, preserving a newer SDK already used by your project.

The core brand vectors have solid-colour API 23 fallbacks and gradient `drawable-v24` variants. Legacy launcher PNGs cover ldpi through xxxhdpi. Adaptive resources are selected from API 26; the explicit monochrome layer is selected from API 33.

## 2. Set launcher icons

Merge these attributes into your existing `<application>`:

```xml
android:icon="@mipmap/ic_cine_launcher"
android:roundIcon="@mipmap/ic_cine_launcher_round"
android:label="@string/cine_app_name"
```

See `AndroidManifest-snippet.xml` for context. It is a merge example, not a replacement for your app's manifest.

## 3. Native splash screen

Add the dependency in `build.gradle.kts.snippet`. The documented stable version checked when this pack was prepared is `androidx.core:core-splashscreen:1.2.0`.

Apply `@style/Theme.CineMusic.Starting` to your existing launcher activity. In its `onCreate`, call `installSplashScreen()` before `super.onCreate()`; `InstallSplashScreen.kt` shows the import and insertion point.

**Set `postSplashScreenTheme` to your existing app theme** in BOTH `values/cine_themes.xml` and `values-v31/cine_themes.xml`. `Theme.CineMusic` is a small framework starter theme for examples. If you use AppCompat or Material, preserve your existing compatible post-launch theme and activity base class.

The default starting theme uses the approved dark navy. To choose a light launch screen, use `@style/Theme.CineMusic.Starting.Light` instead.

The static native 288 dp icon keeps the emblem inside its 192 dp visible circle. On API 31+, the wordmark is supplied in the OS branding area as a 200 × 80 dp drawable. The system controls native splash placement; it does not reproduce the centered emblem-and-wordmark composition of a full-screen image exactly.

`splash/` contains full-screen PNG/SVG compositions for design or framework workflows. `layout/cine_brand_welcome.xml` provides the centered logo-and-name layout for an in-app welcome screen. Use that layout only when your app needs such a screen; native startup does not require an additional screen or a fixed delay.

## Animated startup

On API 31+, `Theme.CineMusic.Starting` selects the native 432 dp animated-vector resource. Its emblem remains inside the 288 dp visible circle during the 840 ms reveal, rise and settle. Android controls how long startup stays visible and may skip or shorten the motion when the app is already ready. No fixed wait is introduced.

The system launch icon is static below API 31. If your app has a genuine welcome screen, `CineBrandMotion.kt` animates its emblem and wordmark on older devices too. It respects disabled system animations. Call `CineBrandMotion.play(findViewById(R.id.cine_welcome_emblem), findViewById(R.id.cine_welcome_wordmark))` after inflating the provided welcome layout. Preserve your actual launch/navigation flow.

Animated previews and timing notes are in `splash/animation/`. The native system wordmark remains static in the OS branding area; the preview wordmark fade is for the optional in-app composition.

## 4. Notifications and controls

Use `@drawable/ic_cine_notification` as a notification's **small icon**. It is an un-tinted opaque white silhouette on transparent surroundings. Let Android apply its notification tint. The gradient app logo is suitable for larger artwork or a large icon.

UI controls are `@drawable/ic_cine_play`, `ic_cine_pause`, `ic_cine_next`, etc. Their default tint follows `@color/cine_on_background`; set your view/Compose tint as needed. Icon artwork is 24 dp. Supply appropriate touch-target sizing and accessible descriptions in the app.

Light/dark placeholders use the same resource names, such as `@drawable/cine_placeholder_album`, and Android selects the configured night variant automatically.

## 5. Final app checks

Build your own app after merging. Check a cold launch, a circle and squircle launcher mask, themed icons, light/dark content, and a notification. This kit was validated for resources, geometry, alpha and export dimensions; it has not been compiled or device-tested as part of your application.

## Official references checked 20 October 2026

- Adaptive icon layers, sizing and themes: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
- Native splash dimensions and layout: https://developer.android.com/develop/ui/views/launch/splash-screen
- Splash migration and installSplashScreen: https://developer.android.com/develop/ui/views/launch/splash-screen/migrate
- Stable AndroidX dependency: https://developer.android.com/jetpack/androidx/releases/core
- Play icon format: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
- Feature graphic and store preview assets: https://support.google.com/googleplay/android-developer/answer/9866151

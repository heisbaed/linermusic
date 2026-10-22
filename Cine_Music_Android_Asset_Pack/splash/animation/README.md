# Animated splash

The default Android 12+ starting theme plays `avd_cine_splash.xml`: an 840 ms C reveal, followed by the music note, with a gentle settle. Native branding placement stays under Android's control. The OS can skip or shorten the animation when the app is ready; no artificial launch delay is installed.

- `cine_splash_preview.gif` and `.mp4`: a playable preview of the dark full-logo composition.
- `cine_splash_animated_dark.svg` and `_light.svg`: editable browser-playable vector reveals. Open directly in a browser; some image viewers display only the final frame.
- Android AVD and animators: `android/res/drawable-v31/` and `android/res/animator-v31/`.
- Optional in-app logo/wordmark motion: `android/CineBrandMotion.kt`.

Below API 31 the system launch screen uses the supplied static vector. The optional view animation can animate a real in-app welcome screen on those devices. Native wordmark branding is static; the full-composition previews also show a wordmark fade for that optional screen. Native AVD and video previews can differ slightly in easing and OS placement.

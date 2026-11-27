# Building Dj Cine

The Android build reads the DJ client API key from `CINE_DJ_API_KEY`, or from ignored `android/dj-firebase.local.json` with one `apiKey` property. Keep this file and environment value out of commits and build logs. Missing configuration produces a truthful unavailable state; it must not simulate an AI response.

Use an Android-restricted API key for the configured Firebase project, limited to the application package and the SHA-1 certificate actually used to sign each distributed APK. Limit its service allowlist to Firebase AI Logic (`firebasevertexai.googleapis.com`), App Check (`firebaseappcheck.googleapis.com`) and Firebase Installations (`firebaseinstallations.googleapis.com`). Register the native Firebase app's appropriate signing certificates and configure Play Integrity/App Check for supported distribution. Do not ship App Check debug tokens or disable enforcement to conceal a failed setup.

The Firebase project/native app identifiers are in the Gradle configuration. The non-secret model selection is in `mobile/public/dj-config.json`. The client obtains limited-use App Check tokens through the native bridge; API calls bridged to Android attach package and certificate headers. No administrative credential is required by the application.

Client API keys necessarily ship inside APKs. Keeping the build input out of Git reduces accidental exposure in source, but it is not a replacement for API restrictions, App Check, Firebase database/storage rules or quota controls. Existing authentication clients may use different public Firebase keys; do not revoke shared keys without coordinating those clients.

Build the mobile and TV web bundles separately, then pass the matching `cinePlatform` and `cineAssetsDir` to Gradle. The default checked-in Android web assets contain the mobile interface. Native App Check/configuration changes require an APK upgrade; a web-only update cannot add these native capabilities.

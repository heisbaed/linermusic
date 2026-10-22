package com.heisbaed.cinemusic;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.view.View;
import android.view.WindowInsetsController;
import android.window.OnBackInvokedCallback;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static volatile String databaseHost = "";
    private static volatile String authHost = "";
    private static final int FILE_CHOOSER = 43;
    private final ExecutorService network = Executors.newFixedThreadPool(4);
    private final ConcurrentHashMap<String, HttpURLConnection> requests = new ConcurrentHashMap<>();
    private final Set<String> pending = ConcurrentHashMap.newKeySet();
    private WebView web;
    private ValueCallback<Uri[]> fileChooser;
    private JSONObject pendingAuthLink;
    private OnBackInvokedCallback backCallback;
    private final Handler googleHandler = new Handler(Looper.getMainLooper());
    private CancellationSignal googleCancellation;
    private String googleRequestId;
    private Runnable googleTimeout;
    private final BroadcastReceiver events = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            try { emit(intent.getStringExtra("type"), new JSONObject(intent.getStringExtra("data"))); }
            catch (Exception ignored) {}
        }
    };

    private static final String AUTH_KEY_ALIAS = "cine.music.auth.tokens.v1";
    private javax.crypto.SecretKey authTokenKey() throws Exception {
        java.security.KeyStore store = java.security.KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(AUTH_KEY_ALIAS)) return (javax.crypto.SecretKey) store.getKey(AUTH_KEY_ALIAS, null);
        javax.crypto.KeyGenerator generator = javax.crypto.KeyGenerator.getInstance(
            android.security.keystore.KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new android.security.keystore.KeyGenParameterSpec.Builder(AUTH_KEY_ALIAS,
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT | android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setTheme(R.style.AppTheme);
        configureNetworkHosts(this);
        receiveAuthLink(getIntent());
        getWindow().getDecorView().setBackgroundColor(Color.rgb(6, 17, 38));
        web = new WebView(this); setContentView(web);
        // Keep content clear of system bars, including Android 15/16 edge-to-edge enforcement.
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return android.view.WindowInsets.CONSUMED;
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setTextZoom(Math.round(100 * getResources().getConfiguration().fontScale));
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false); settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new Bridge(), "CineAndroid");
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooser != null) fileChooser.onReceiveValue(null);
                fileChooser = callback;
                try {
                    Intent intent = params.createIntent().setAction(Intent.ACTION_OPEN_DOCUMENT)
                        .addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivityForResult(intent, FILE_CHOOSER);
                } catch (Exception error) { fileChooser = null; callback.onReceiveValue(null); }
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!url.startsWith(ORIGIN + "/") || isFinishing()) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("Cine music").setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!ORIGIN.equals(uri.getScheme() + "://" + uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..") || path.contains("\\")) return response(403, "Forbidden", "text/plain", new byte[0]);
                try {
                    InputStream stream = getAssets().open(path.substring(1));
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", path.endsWith(".html") || path.equals("/firebase-config.json") ? "no-store" : "public, max-age=31536000, immutable");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime(path), "UTF-8", 200, "OK", headers, stream);
                } catch (IOException error) { return response(404, "Not Found", "text/plain", "Asset not found".getBytes(StandardCharsets.UTF_8)); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(ORIGIN + "/")) return false;
                if (request.isForMainFrame()) openExternalUrl(url);
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (url.startsWith(ORIGIN + "/")) {
                    publishState();
                }
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
        });
        IntentFilter filter = new IntentFilter(Events.ACTION);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(events, filter, Events.PERMISSION, null, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(events, filter, Events.PERMISSION, null);
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::dispatchBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        web.loadUrl(ORIGIN + "/index.html");
        web.requestApplyInsets();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER || fileChooser == null) return;
        Uri[] selected = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        List<Uri> safe = new ArrayList<>();
        if (selected != null) for (Uri uri : selected) if (uri != null && "content".equals(uri.getScheme())) safe.add(uri);
        fileChooser.onReceiveValue(safe.isEmpty() ? null : safe.toArray(new Uri[0])); fileChooser = null;
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent); receiveAuthLink(intent); publishState();
    }
    private void receiveAuthLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) return;
        JSONObject action = authAction(intent.getData().toString());
        if (action != null) pendingAuthLink = action;
    }
    static JSONObject authAction(String value) {
        try {
            Uri uri = Uri.parse(value);
            for (int depth = 0; depth < 3; depth++) {
                if (!validExternalUrl(uri.toString())) return null;
                String nested = uri.getQueryParameter("link");
                if (nested == null) break;
                uri = Uri.parse(nested);
            }
            if (!validExternalUrl(uri.toString()) || authHost.isEmpty() || !authHost.equalsIgnoreCase(uri.getHost()) || !"/__/auth/action".equals(uri.getPath())) return null;
            String mode = uri.getQueryParameter("mode"), code = uri.getQueryParameter("oobCode");
            if (!Arrays.asList("verifyEmail", "resetPassword", "verifyAndChangeEmail").contains(mode) || code == null || code.isEmpty() || code.length() > 4096) return null;
            return Events.json("url", uri.toString(), "mode", mode, "oobCode", code, "continueUrl", uri.getQueryParameter("continueUrl"));
        } catch (Exception ignored) { return null; }
    }
    private void publishState() {
        runOnUiThread(() -> {
            emit("downloads", Events.json("items", new OfflineVault(MainActivity.this).list()));
            emit("downloadJobs", Events.json("items", DownloadService.jobs(MainActivity.this)));
            PlaybackService service = PlaybackService.instance;
            if (service != null) service.publish(); else emit("player", PlaybackService.idleSnapshot());
            if (pendingAuthLink != null) { emit("authLink", pendingAuthLink); pendingAuthLink = null; }
        });
    }

    static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }
    private WebResourceResponse response(int status, String reason, String mime, byte[] data) {
        return new WebResourceResponse(mime, "UTF-8", status, reason, Collections.emptyMap(), new ByteArrayInputStream(data));
    }
    private void emit(String type, JSONObject data) {
        if (web == null) return;
        runOnUiThread(() -> {
            if (web == null) return;
            String envelope = Events.json("type", type, "data", data).toString();
            // Large catalog responses are delivered in bounded messages to the WebView.
            String id = UUID.randomUUID().toString();
            for (int i = 0; i < envelope.length(); i += 48_000) {
                String chunk = envelope.substring(i, Math.min(envelope.length(), i + 48_000));
                boolean last = i + 48_000 >= envelope.length();
                web.evaluateJavascript("window.__cineChunk?.(" + JSONObject.quote(id) + "," + JSONObject.quote(chunk) + "," + last + ")", null);
            }
        });
    }

    static synchronized void configureNetworkHosts(Context context) {
        databaseHost = ""; authHost = "";
        try (InputStream input = context.getAssets().open("firebase-config.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] buffer = new byte[1024]; int count;
            while ((count = input.read(buffer)) != -1) { if (bytes.size() + count > 32_768) return; bytes.write(buffer, 0, count); }
            JSONObject config = new JSONObject(bytes.toString("UTF-8"));
            String database = config.optString("databaseURL");
            if (validExternalUrl(database)) databaseHost = new URL(database).getHost().toLowerCase(Locale.ROOT);
            String domain = config.optString("authDomain");
            if (!domain.isEmpty() && validExternalUrl("https://" + domain) && new URL("https://" + domain).getFile().isEmpty()) authHost = domain.toLowerCase(Locale.ROOT);
        } catch (Exception ignored) { /* A missing config must not broaden the network allowlist. */ }
    }
    static boolean validExternalUrl(String value) {
        try {
            if (value == null || value.length() > 16_384 || value.matches("(?s).*[\\x00-\\x20\\\\].*")) return false;
            URL url = new URL(value);
            return "https".equals(url.getProtocol()) && !url.getHost().isEmpty() && url.getUserInfo() == null && (url.getPort() == -1 || url.getPort() == 443);
        } catch (Exception error) { return false; }
    }
    private void openExternalUrl(String value) {
        if (!validExternalUrl(value)) return;
        runOnUiThread(() -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(value)).addCategory(Intent.CATEGORY_BROWSABLE)); }
            catch (Exception ignored) {}
        });
    }
    static boolean allowedNetworkUrl(String value) {
        try {
            URL url = new URL(value); String host = url.getHost().toLowerCase(Locale.ROOT);
            if (!validExternalUrl(value)) return false;
            return host.equals("music.youtube.com") || host.equals("www.youtube.com") || host.equals("api.tryliner.fun")
                || host.equals("lrclib.net") || host.equals("musicbrainz.org") || host.endsWith(".googlevideo.com") || host.equals("identitytoolkit.googleapis.com")
                || host.equals("securetoken.googleapis.com") || (!databaseHost.isEmpty() && host.equals(databaseHost));
        } catch (Exception error) { return false; }
    }
    static HttpURLConnection connection(String value) throws Exception {
        if (!allowedNetworkUrl(value)) throw new IOException("Unsupported network address");
        HttpURLConnection result = (HttpURLConnection) new URL(value).openConnection();
        result.setInstanceFollowRedirects(false); result.setConnectTimeout(15000); result.setReadTimeout(30000);
        result.setRequestProperty("User-Agent", "CineMusic/0.1.0 (Android)");
        return result;
    }

    private class Bridge {
        @JavascriptInterface public String countryCode() {
            String country = "";
            try {
                android.telephony.TelephonyManager manager = (android.telephony.TelephonyManager) getSystemService(TELEPHONY_SERVICE);
                if (manager != null) {
                    country = manager.getNetworkCountryIso();
                    if (country == null || !country.matches("[A-Za-z]{2}")) country = manager.getSimCountryIso();
                }
            } catch (RuntimeException ignored) { /* Coarse region is optional; no location permission is requested. */ }
            if (country == null || !country.matches("[A-Za-z]{2}")) country = getResources().getConfiguration().getLocales().get(0).getCountry();
            return country != null && country.matches("[A-Za-z]{2}") ? country.toUpperCase(Locale.ROOT) : "";
        }
        @JavascriptInterface public void googleSignIn(String requestId, String webClientId, String nonce) {
            runOnUiThread(() -> startGoogleSignIn(requestId, webClientId, nonce));
        }
        @JavascriptInterface public void cancelGoogleSignIn() {
            runOnUiThread(() -> {
                String id = googleRequestId;
                CancellationSignal signal = googleCancellation;
                if (id != null) finishGoogleSignIn(id, null, null, true);
                if (signal != null) signal.cancel();
            });
        }
        @JavascriptInterface public String snapshot() {
            PlaybackService service = PlaybackService.instance;
            return service == null ? PlaybackService.idleSnapshot().toString() : service.snapshot();
        }
        @JavascriptInterface public void ready() { publishState(); }
        @JavascriptInterface public void sleepTimer(double minutes, boolean endOfSong) {
            runOnUiThread(() -> { if (PlaybackService.instance != null) PlaybackService.instance.sleepTimer(minutes, endOfSong); else emit("player", PlaybackService.idleSnapshot()); });
        }
        @JavascriptInterface public String authTokens() {
            try {
                String encoded = getSharedPreferences("cine_auth", MODE_PRIVATE).getString("tokens", "");
                if (encoded.isEmpty()) return "{}";
                byte[] stored = android.util.Base64.decode(encoded, android.util.Base64.NO_WRAP);
                byte[] iv = Arrays.copyOfRange(stored, 0, 12);
                byte[] cipherText = Arrays.copyOfRange(stored, 12, stored.length);
                javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(javax.crypto.Cipher.DECRYPT_MODE, authTokenKey(), new javax.crypto.spec.GCMParameterSpec(128, iv));
                return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
            } catch (Exception ignored) { return "{}"; }
        }
        @JavascriptInterface public void saveAuthTokens(String json) {
            try {
                if (json == null || json.length() > 16_384) return;
                javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, authTokenKey());
                byte[] iv = cipher.getIV(), encrypted = cipher.doFinal(json.getBytes(StandardCharsets.UTF_8));
                ByteArrayOutputStream output = new ByteArrayOutputStream(); output.write(iv); output.write(encrypted);
                getSharedPreferences("cine_auth", MODE_PRIVATE).edit()
                    .putString("tokens", android.util.Base64.encodeToString(output.toByteArray(), android.util.Base64.NO_WRAP)).apply();
            } catch (Exception ignored) {}
        }
        @JavascriptInterface public void clearAuthTokens() {
            getSharedPreferences("cine_auth", MODE_PRIVATE).edit().remove("tokens").apply();
        }
        @JavascriptInterface public void setSystemBars(String color, boolean lightIcons) {
            if (color == null || !color.matches("#[0-9A-Fa-f]{6}")) return;
            runOnUiThread(() -> {
                try {
                    int background = Color.parseColor(color);
                    getWindow().getDecorView().setBackgroundColor(background);
                    if (web != null) web.setBackgroundColor(background);
                    getWindow().setStatusBarColor(background);
                    getWindow().setNavigationBarColor(background);
                    if (Build.VERSION.SDK_INT >= 30) {
                        WindowInsetsController controller = getWindow().getInsetsController();
                        int appearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        if (controller != null) controller.setSystemBarsAppearance(lightIcons ? appearance : 0, appearance);
                    } else {
                        int flags = getWindow().getDecorView().getSystemUiVisibility();
                        flags = lightIcons ? flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                            : flags & ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                        getWindow().getDecorView().setSystemUiVisibility(flags);
                    }
                } catch (Exception ignored) {}
            });
        }
        @JavascriptInterface public boolean isWifiConnected() {
            return DownloadService.isWifiConnected(MainActivity.this);
        }
        @JavascriptInterface public void openNotificationSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                try { startActivity(intent); } catch (Exception ignored) {}
            });
        }
        @JavascriptInterface public boolean configureEqualizer(boolean enabled, String bandsJson) {
            try {
                org.json.JSONArray values = new org.json.JSONArray(bandsJson);
                if (values.length() != 5) return false;
                int[] bands = new int[5]; for (int i = 0; i < bands.length; i++) bands[i] = Math.max(-12, Math.min(12, values.getInt(i)));
                FutureTask<Boolean> apply = new FutureTask<>(() -> PlaybackService.instance == null || PlaybackService.instance.configureEqualizer(enabled, bands));
                runOnUiThread(apply);
                if (!apply.get(2, TimeUnit.SECONDS)) return false;
                getSharedPreferences("cine_audio", MODE_PRIVATE).edit().putBoolean("eq_enabled", enabled).putString("eq_bands", values.toString()).apply();
                return true;
            } catch (Exception ignored) { return false; }
        }
        @JavascriptInterface public void openMediaOutputPanel() {
            runOnUiThread(() -> {
                try { startActivity(new Intent("android.settings.panel.action.MEDIA_OUTPUT")); }
                catch (Exception ignored) { try { startActivity(new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS)); } catch (Exception ignoredAgain) {} }
            });
        }
        @JavascriptInterface public void background() { runOnUiThread(() -> moveTaskToBack(true)); }
        @JavascriptInterface public void openExternal(String url) { openExternalUrl(url); }
        @JavascriptInterface public void share(String text) {
            if (text == null || text.length() > 16_384) return;
            runOnUiThread(() -> {
                try { startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share")); }
                catch (Exception ignored) {}
            });
        }
        @JavascriptInterface public void queue(String json, boolean shuffle, String repeat) {
            runOnUiThread(() -> {
                try { if (PlaybackService.instance != null) PlaybackService.instance.setQueue(new org.json.JSONArray(json), shuffle, repeat); }
                catch (Exception ignored) {}
            });
        }
        @JavascriptInterface public void request(String id, String optionsJson) {
            if (id.length() > 128 || optionsJson.length() > 2_000_000 || !pending.add(id)) return;
            network.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    JSONObject options = new JSONObject(optionsJson);
                    connection = connection(options.getString("url")); requests.put(id, connection);
                    if (!pending.contains(id)) throw new InterruptedIOException("Request cancelled");
                    String method = options.optString("method", "GET");
                    if (!Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD").contains(method)) throw new IOException("Unsupported request method");
                    connection.setRequestMethod(method);
                    JSONObject headers = options.optJSONObject("headers");
                    if (headers != null) for (Iterator<String> it = headers.keys(); it.hasNext();) {
                        String name = it.next();
                        if (name.equalsIgnoreCase("host") || name.equalsIgnoreCase("content-length") || name.equalsIgnoreCase("connection")) continue;
                        connection.setRequestProperty(name.equalsIgnoreCase("x-liner-user-agent") ? "User-Agent" : name, headers.getString(name));
                    }
                    String host = connection.getURL().getHost();
                    if (host.endsWith("youtube.com") || host.endsWith("googlevideo.com")) {
                        String origin = host.equals("www.youtube.com") ? "https://www.youtube.com" : "https://music.youtube.com";
                        connection.setRequestProperty("Origin", origin); connection.setRequestProperty("Referer", origin + "/");
                    }
                    if (options.has("body") && !method.equals("GET") && !method.equals("HEAD")) {
                        connection.setDoOutput(true);
                        try (OutputStream output = connection.getOutputStream()) { output.write(options.getString("body").getBytes(StandardCharsets.UTF_8)); }
                    }
                    int status = connection.getResponseCode();
                    InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    if (input != null) try (InputStream stream = input) {
                        byte[] buffer = new byte[16 * 1024]; int read;
                        while ((read = stream.read(buffer)) != -1) {
                            if (!pending.contains(id)) throw new InterruptedIOException("Request cancelled");
                            if (bytes.size() + read > 8_000_000) throw new IOException("Response is too large");
                            bytes.write(buffer, 0, read);
                        }
                    }
                    JSONObject responseHeaders = new JSONObject();
                    for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
                        if (entry.getKey() != null) responseHeaders.put(entry.getKey(), String.join(", ", entry.getValue()));
                    }
                    emit("http", Events.json("id", id, "status", status, "headers", responseHeaders,
                        "body", android.util.Base64.encodeToString(bytes.toByteArray(), android.util.Base64.NO_WRAP)));
                } catch (Exception error) { emit("http", Events.json("id", id, "error", error.getMessage() == null ? "Network request failed" : error.getMessage())); }
                finally { pending.remove(id); requests.remove(id); if (connection != null) connection.disconnect(); }
            });
        }
        @JavascriptInterface public void cancel(String id) {
            pending.remove(id); HttpURLConnection connection = requests.remove(id); if (connection != null) connection.disconnect();
        }
        @JavascriptInterface public void play(String json) {
            runOnUiThread(() -> {
                try {
                    new JSONObject(json).getString("id");
                    requestNotifications();
                    startForegroundService(new Intent(MainActivity.this, PlaybackService.class).setAction("play").putExtra("track", json));
                } catch (Exception error) { emit("playerError", Events.json("message", "Could not start playback")); }
            });
        }
        @JavascriptInterface public void control(String action, double value) {
            if (!Arrays.asList("pause", "resume", "seek", "next", "previous", "stop").contains(action)) return;
            runOnUiThread(() -> {
                if (PlaybackService.instance != null) PlaybackService.instance.command(action, value);
            });
        }
        @JavascriptInterface public String downloads() { return new OfflineVault(MainActivity.this).list().toString(); }
        @JavascriptInterface public String downloadJobs() { return DownloadService.jobs(MainActivity.this).toString(); }
        @JavascriptInterface public void configureDownloads(boolean wifiOnly) {
            getSharedPreferences("cine_downloads", MODE_PRIVATE).edit().putBoolean("wifi_only", wifiOnly).apply();
            runOnUiThread(() -> { if (DownloadService.instance != null) DownloadService.instance.enforceWifi(); });
        }
        @JavascriptInterface public void cancelDownload(String id) { DownloadService.cancel(MainActivity.this, id, false); }
        @JavascriptInterface public void pauseDownload(String id) { DownloadService.cancel(MainActivity.this, id, true); }
        @JavascriptInterface public void resumeDownload(String id) {
            String track = DownloadService.resumableTrack(MainActivity.this, id);
            if (track != null) startDownload(track, true);
        }
        @JavascriptInterface public void download(String trackJson) {
            startDownload(trackJson, false);
        }
        @JavascriptInterface public void removeDownload(String id) {
            DownloadService.cancel(MainActivity.this, id, false);
            network.execute(() -> {
                try {
                    OfflineVault vault = new OfflineVault(MainActivity.this); vault.remove(id); DownloadService.forget(MainActivity.this, id);
                    emit("downloads", Events.json("items", vault.list())); emit("downloadJobs", Events.json("items", DownloadService.jobs(MainActivity.this)));
                }
                catch (Exception error) { emit("downloadError", Events.json("id", id, "message", "Could not remove this download")); }
            });
        }
    }
    private void startGoogleSignIn(String id, String clientId, String nonce) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,128}")) return;
        if (web == null || web.getUrl() == null || !web.getUrl().startsWith(ORIGIN + "/") || isFinishing()) return;
        if (clientId == null || clientId.length() > 512 || !clientId.matches("[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com")) {
            emit("googleAuth", Events.json("id", id, "error", "Google sign-in needs a configured Web OAuth client ID (googleWebClientId).")); return;
        }
        if (nonce == null || !nonce.matches("[A-Za-z0-9_-]{16,256}")) {
            emit("googleAuth", Events.json("id", id, "error", "Google sign-in requires a cryptographic nonce.")); return;
        }
        if (googleRequestId != null) {
            emit("googleAuth", Events.json("id", id, "error", "A Google sign-in request is already in progress.")); return;
        }
        googleRequestId = id;
        CancellationSignal signal = new CancellationSignal(); googleCancellation = signal;
        googleTimeout = () -> { finishGoogleSignIn(id, null, "Google sign-in timed out. Please try again.", false); signal.cancel(); };
        googleHandler.postDelayed(googleTimeout, 120_000);
        try {
            if (Build.VERSION.SDK_INT < 34) { startCompatGoogleSignIn(id, clientId, nonce, signal); return; }
            android.credentials.CredentialManager manager = getSystemService(android.credentials.CredentialManager.class);
            if (manager == null) { finishGoogleSignIn(id, null, "A Google credential provider is not available on this device.", false); return; }
            String prefix = "com.google.android.libraries.identity.googleid.";
            String type = prefix + "TYPE_GOOGLE_ID_TOKEN_CREDENTIAL";
            // Matches the cached Google ID SDK's GetGoogleIdOption bundle contract.
            Bundle data = new Bundle();
            data.putString(prefix + "BUNDLE_KEY_SERVER_CLIENT_ID", clientId);
            data.putString(prefix + "BUNDLE_KEY_NONCE", nonce);
            data.putBoolean(prefix + "BUNDLE_KEY_FILTER_BY_AUTHORIZED_ACCOUNTS", false);
            data.putBoolean(prefix + "BUNDLE_KEY_REQUEST_VERIFIED_PHONE_NUMBER", false);
            data.putBoolean(prefix + "BUNDLE_KEY_AUTO_SELECT_ENABLED", false);
            android.credentials.CredentialOption option = new android.credentials.CredentialOption.Builder(type, data, new Bundle(data))
                .setIsSystemProviderRequired(false).build();
            android.credentials.GetCredentialRequest request = new android.credentials.GetCredentialRequest.Builder(new Bundle()).addCredentialOption(option).build();
            manager.getCredential(this, request, signal, getMainExecutor(), new OutcomeReceiver<android.credentials.GetCredentialResponse, android.credentials.GetCredentialException>() {
                @Override public void onResult(android.credentials.GetCredentialResponse response) {
                    try {
                        android.credentials.Credential credential = response.getCredential();
                        String token = type.equals(credential.getType()) ? credential.getData().getString(prefix + "BUNDLE_KEY_ID_TOKEN") : null;
                        if (token == null || token.isEmpty() || token.length() > 32_768) { finishGoogleSignIn(id, null, "Google did not return a valid ID token.", false); return; }
                        finishGoogleSignIn(id, token, null, false);
                    } catch (RuntimeException error) { finishGoogleSignIn(id, null, "The Google credential provider returned an invalid response.", false); }
                }
                @Override public void onError(android.credentials.GetCredentialException error) {
                    boolean cancelled = android.credentials.GetCredentialException.TYPE_USER_CANCELED.equals(error.getType());
                    String message = android.credentials.GetCredentialException.TYPE_NO_CREDENTIAL.equals(error.getType())
                        ? "No Google credential is available. Enable a Google credential provider, add a Google account, and check the OAuth configuration."
                        : "Google sign-in failed. Check Google Play services, the Web OAuth client ID, and this app's Android signing configuration.";
                    if (android.credentials.GetCredentialException.TYPE_INTERRUPTED.equals(error.getType())) message = "Google sign-in was interrupted. Please try again.";
                    finishGoogleSignIn(id, null, cancelled ? null : message, cancelled);
                }
            });
        } catch (Exception | LinkageError error) {
            finishGoogleSignIn(id, null, "Google sign-in is unavailable. Check the device's Google credential provider and OAuth configuration.", false);
        }
    }
    private void startCompatGoogleSignIn(String id, String clientId, String nonce, CancellationSignal signal) {
        com.google.android.libraries.identity.googleid.GetGoogleIdOption option = new com.google.android.libraries.identity.googleid.GetGoogleIdOption.Builder()
            .setServerClientId(clientId).setNonce(nonce).setFilterByAuthorizedAccounts(false).setAutoSelectEnabled(false).build();
        androidx.credentials.GetCredentialRequest request = new androidx.credentials.GetCredentialRequest.Builder().addCredentialOption(option).build();
        androidx.credentials.CredentialManager.create(this).getCredentialAsync(this, request, signal, command -> googleHandler.post(command),
            new androidx.credentials.CredentialManagerCallback<androidx.credentials.GetCredentialResponse, androidx.credentials.exceptions.GetCredentialException>() {
                @Override public void onResult(androidx.credentials.GetCredentialResponse response) {
                    try {
                        androidx.credentials.Credential credential = response.getCredential();
                        if (!com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            finishGoogleSignIn(id, null, "Google did not return an ID token credential.", false); return;
                        }
                        String token = com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
                        if (token.isEmpty() || token.length() > 32_768) { finishGoogleSignIn(id, null, "Google did not return a valid ID token.", false); return; }
                        finishGoogleSignIn(id, token, null, false);
                    } catch (RuntimeException error) { finishGoogleSignIn(id, null, "The Google credential provider returned an invalid response.", false); }
                }
                @Override public void onError(androidx.credentials.exceptions.GetCredentialException error) {
                    boolean cancelled = error instanceof androidx.credentials.exceptions.GetCredentialCancellationException;
                    String message = error instanceof androidx.credentials.exceptions.NoCredentialException
                        ? "No Google credential is available. Add a Google account and check the OAuth configuration."
                        : "Google sign-in failed. Check Google Play services, the Web OAuth client ID, and this app's Android signing configuration.";
                    if (error instanceof androidx.credentials.exceptions.GetCredentialProviderConfigurationException) message = "A Google credential provider is unavailable. Enable or update Google Play services and try again.";
                    if (error instanceof androidx.credentials.exceptions.GetCredentialInterruptedException) message = "Google sign-in was interrupted. Please try again.";
                    finishGoogleSignIn(id, null, cancelled ? null : message, cancelled);
                }
            });
    }
    private void finishGoogleSignIn(String id, String token, String error, boolean cancelled) {
        if (!id.equals(googleRequestId)) return;
        if (googleTimeout != null) googleHandler.removeCallbacks(googleTimeout);
        googleRequestId = null; googleCancellation = null; googleTimeout = null;
        if (web != null && web.getUrl() != null && web.getUrl().startsWith(ORIGIN + "/")) {
            emit("googleAuth", Events.json("id", id, "idToken", token, "error", error, "cancelled", cancelled));
        }
    }
    private void startDownload(String trackJson, boolean resume) {
        if (trackJson == null || trackJson.length() > 65_536) return;
        runOnUiThread(() -> {
            try {
                JSONObject track = new JSONObject(trackJson);
                String id = track.getString("id"); if (id.isEmpty() || id.length() > 256) return;
                requestNotifications();
                startForegroundService(new Intent(MainActivity.this, DownloadService.class).putExtra("track", trackJson).putExtra("resume", resume));
            } catch (Exception error) { emit("downloadError", Events.json("message", "Could not start this download")); }
        });
    }
    private void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 42);
        }
    }
    private void dispatchBack() {
        if (web == null) { moveTaskToBack(true); return; }
        web.evaluateJavascript("window.dispatchEvent(new Event('cine:back',{cancelable:true}))", result -> {
            if (!"false".equals(result)) moveTaskToBack(true);
        });
    }
    @Override public void onBackPressed() { dispatchBack(); }
    @Override protected void onDestroy() {
        googleRequestId = null; googleHandler.removeCallbacksAndMessages(null);
        if (googleCancellation != null) { googleCancellation.cancel(); googleCancellation = null; }
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        if (fileChooser != null) { fileChooser.onReceiveValue(null); fileChooser = null; }
        unregisterReceiver(events); pending.clear(); for (HttpURLConnection value : requests.values()) value.disconnect(); network.shutdownNow();
        if (web != null) { web.removeJavascriptInterface("CineAndroid"); web.destroy(); web = null; }
        super.onDestroy();
    }
}

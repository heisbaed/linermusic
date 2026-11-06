package com.heisbaed.cinemusic;

import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.Pattern;

/** Anonymous public-source resolution shared by playback and the encrypted download vault. */
final class StreamResolver {
    private static final String SESSION_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
    private static final String MEDIA_AGENT = "Mozilla/5.0";
    private static final int MEDIA_PROBE_BYTES = 4096;
    private static final Pattern VISITOR = Pattern.compile("Cg[s-v][A-Za-z0-9_-]{20,}(?:%3D|=){0,2}");
    private static final String[][] PROFILES = {
        // Supported upstream visionOS context; unlike web clients these return direct audio.
        {"VISIONOS", "1.02", "101", "https://www.youtube.com", SESSION_AGENT},
        {"VISIONOS", "1.04", "101", "https://music.youtube.com", "com.google.visionos.youtube/1.04(RealityDevice17,1; U; CPU visionOS 26_6_0 like Mac OS X; en_US)"},
        {"ANDROID_VR", "1.65.10", "28", "https://www.youtube.com", "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip"}
    };
    private static volatile VisitorSession session;
    private static final Map<String, CachedStream> streams = new LinkedHashMap<>(8, .75f, true);
    private static final class CachedStream {
        final String url;
        final long deadline;
        CachedStream(String url, long remainingMs) { this.url = url; this.deadline = System.nanoTime() + remainingMs * 1_000_000; }
    }
    static synchronized void invalidate(String videoId) { streams.remove(videoId); }
    private static synchronized String cachedStream(String videoId) {
        CachedStream stream = streams.get(videoId);
        if (stream == null) return null;
        if (stream.deadline <= System.nanoTime()) { streams.remove(videoId); return null; }
        return stream.url;
    }
    private static synchronized void cacheStream(String videoId, String url) {
        // Reuse only a successfully probed, unexpired URL. Keep URLs in memory,
        // for at most two minutes, and leave a full minute before source expiry.
        try {
            String query = new URL(url).getQuery();
            if (query == null) return;
            for (String part : query.split("&")) if (part.startsWith("expire=")) {
                long expiresSeconds = Long.parseLong(part.substring(7));
                long nowSeconds = System.currentTimeMillis() / 1000;
                if (expiresSeconds <= nowSeconds + 60) return;
                long remaining = Math.min(120, expiresSeconds - nowSeconds - 60) * 1000;
                streams.put(videoId, new CachedStream(url, remaining));
                while (streams.size() > 8) streams.remove(streams.keySet().iterator().next());
                return;
            }
        } catch (Exception ignored) { /* Unparseable expiry requires fresh resolution. */ }
    }
    static void warm(BooleanSupplier cancelled, Consumer<HttpURLConnection> connected) {
        try { visitorData(new Request(cancelled, connected), false); }
        catch (Exception ignored) { /* Warm-up is optional; playback reports its own failures. */ }
    }

    private static final class VisitorSession {
        final String data;
        final long expires = System.nanoTime() + 30L * 60 * 1_000_000_000;
        VisitorSession(String data) { this.data = data; }
    }
    private static final class SourceFailure extends IOException {
        final boolean bot, terminal;
        SourceFailure(String message, boolean bot, boolean terminal) { super(message); this.bot = bot; this.terminal = terminal; }
    }
    private static final class Request {
        final BooleanSupplier cancelled;
        final Consumer<HttpURLConnection> connected;
        final long deadline = System.nanoTime() + 45L * 1_000_000_000;
        Request(BooleanSupplier cancelled, Consumer<HttpURLConnection> connected) { this.cancelled = cancelled; this.connected = connected; }
        void check() throws InterruptedIOException {
            if (cancelled.getAsBoolean() || Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Media request cancelled");
            if (System.nanoTime() >= deadline) throw new InterruptedIOException("YouTube audio resolution timed out. Please try again.");
        }
        HttpURLConnection open(String url, String agent) throws Exception {
            check();
            HttpURLConnection connection = MainActivity.connection(url);
            try {
                connected.accept(connection); check();
                int remaining = (int)Math.max(1, (deadline - System.nanoTime()) / 1_000_000);
                connection.setConnectTimeout(Math.min(5000, remaining)); connection.setReadTimeout(Math.min(6000, remaining));
                connection.setRequestProperty("User-Agent", agent);
                // This resolver must never inherit source-account cookies or Cine credentials.
                connection.setRequestProperty("Cookie", "");
                return connection;
            } catch (Exception error) { connection.disconnect(); throw error; }
        }
        byte[] read(HttpURLConnection connection, int cap, boolean partial) throws Exception {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[Math.min(8192, cap)];
                while (bytes.size() < cap) {
                    check();
                    int count = input.read(buffer, 0, Math.min(buffer.length, cap - bytes.size()));
                    if (count == -1) return bytes.toByteArray();
                    bytes.write(buffer, 0, count);
                }
                check();
                if (!partial && input.read() != -1) throw new IOException("YouTube response exceeded the resolver byte limit");
            }
            return bytes.toByteArray();
        }
    }

    static String resolve(String videoId) throws Exception {
        return resolve(videoId, () -> false, connection -> {});
    }
    static String resolve(String videoId, BooleanSupplier cancelled, Consumer<HttpURLConnection> connected) throws Exception {
        if (videoId == null || !videoId.matches("[a-zA-Z0-9_-]{11}")) throw new IOException("Unsupported track");
        Request request = new Request(cancelled, connected);
        request.check();
        String cached = cachedStream(videoId);
        if (cached != null) { request.check(); return cached; }
        String visitor = visitorData(request, false);
        List<String> failures = new ArrayList<>();
        boolean refreshed = false;
        for (String[] profile : PROFILES) {
            for (int attempt = 0; attempt < 2; attempt++) {
                request.check();
                try {
                    JSONObject response = player(videoId, profile, visitor, request);
                    JSONObject status = response.optJSONObject("playabilityStatus");
                    if (status == null) throw new IOException("YouTube returned no playability status");
                    String state = status.optString("status");
                    String reason = sourceReason(status);
                    if (!"OK".equals(state)) {
                        String detail = status.toString().toLowerCase(Locale.ROOT);
                        boolean bot = "LOGIN_REQUIRED".equals(state) && (detail.contains("not a bot") || detail.contains("unusual traffic") || detail.contains("automated queries"));
                        boolean clientOnly = detail.contains("not available on this app") || detail.contains("not supported by this client");
                        String message = bot ? "YouTube blocked anonymous playback with a bot check (LOGIN_REQUIRED). Cine sign-in does not authorize YouTube."
                            : "LOGIN_REQUIRED".equals(state) ? "YouTube rejected public playback (LOGIN_REQUIRED): " + reason + ". Cine sign-in cannot unlock source restrictions."
                            : "YouTube source unavailable (" + safe(state) + "): " + reason;
                        throw new SourceFailure(message, bot, !bot && !clientOnly);
                    }
                    JSONObject details = response.optJSONObject("videoDetails");
                    if (details == null || !videoId.equals(details.optString("videoId"))) throw new IOException("YouTube returned a different or missing video identity");
                    if (details.optBoolean("isAgeRestricted")) throw new SourceFailure("YouTube has age-restricted this source. Cine sign-in cannot unlock it.", false, true);
                    JSONObject data = response.optJSONObject("streamingData");
                    if (data != null && data.optJSONArray("licenseInfos") != null && data.optJSONArray("licenseInfos").length() > 0) throw new SourceFailure("YouTube requires DRM playback for this source. It is unavailable here.", false, true);
                    JSONArray formats = data == null ? null : data.optJSONArray("adaptiveFormats");
                    List<JSONObject> candidates = new ArrayList<>();
                    boolean ciphered = false, protectedAudio = false;
                    if (formats != null) for (int i = 0; i < formats.length(); i++) {
                        JSONObject format = formats.optJSONObject(i);
                        if (format == null || !format.optString("mimeType").startsWith("audio/")) continue;
                        ciphered |= format.has("signatureCipher") || format.has("cipher");
                        if ((format.optJSONArray("drmFamilies") != null && format.optJSONArray("drmFamilies").length() > 0) || !format.optString("drmTrackType").isEmpty()) { protectedAudio = true; continue; }
                        if (mediaUrl(format.optString("url"))) candidates.add(format);
                    }
                    candidates.sort(Comparator.comparingInt(format -> preference(format.optInt("itag"))));
                    if (candidates.isEmpty() && protectedAudio) throw new SourceFailure("YouTube returned only DRM-protected audio. It is unavailable here.", false, true);
                    if (candidates.isEmpty()) throw new IOException(ciphered ? "YouTube returned signature-ciphered audio, not a usable direct stream" : "YouTube returned no direct public audio formats");
                    List<String> rejected = new ArrayList<>();
                    for (int i = 0; i < Math.min(2, candidates.size()); i++) {
                        JSONObject candidate = candidates.get(i);
                        try {
                            String url = candidate.getString("url");
                            probe(url, request);
                            request.check();
                            cacheStream(videoId, url);
                            return url;
                        } catch (Exception error) { request.check(); rejected.add("itag " + candidate.optInt("itag") + ": " + safe(error.getMessage())); }
                    }
                    throw new IOException(String.join(", ", rejected));
                } catch (SourceFailure error) {
                    request.check();
                    failures.add(profile[0] + " " + profile[1] + ": " + error.getMessage());
                    if (error.terminal) throw new IOException(String.join("; ", failures));
                    if (error.bot && !refreshed) {
                        refreshed = true;
                        visitor = visitorData(request, true);
                        if (!visitor.isEmpty()) continue;
                    }
                    break;
                } catch (Exception error) {
                    request.check();
                    failures.add(profile[0] + " " + profile[1] + ": " + safe(error.getMessage()));
                    break;
                }
            }
        }
        throw new IOException("Public audio resolution failed. " + String.join("; ", failures));
    }

    private static String visitorData(Request request, boolean refresh) throws Exception {
        request.check();
        VisitorSession cached = session;
        if (!refresh && cached != null && cached.expires > System.nanoTime()) return cached.data;
        if (refresh && session == cached) session = null;
        HttpURLConnection connection = null;
        try {
            connection = request.open("https://www.youtube.com/sw.js_data", SESSION_AGENT);
            if (connection.getResponseCode() != 200) return "";
            String text = new String(request.read(connection, 1_000_000, false), StandardCharsets.UTF_8);
            String data = "";
            try {
                String json = text.startsWith(")]}'") ? text.substring(text.indexOf('\n') + 1) : text;
                data = new JSONArray(json).getJSONArray(0).getJSONArray(2).getJSONArray(0).getJSONArray(0).getString(13);
                if (!VISITOR.matcher(data).matches()) data = "";
            } catch (JSONException ignored) {}
            if (data.isEmpty()) { java.util.regex.Matcher match = VISITOR.matcher(text); if (match.find()) data = match.group(); }
            if (!data.isEmpty()) { session = new VisitorSession(data); return data; }
        } catch (Exception error) { request.check(); }
        finally { if (connection != null) connection.disconnect(); }
        // A failed warm-up may still allow an ordinary anonymous request; never fabricate a visitor.
        return "";
    }

    private static JSONObject player(String id, String[] profile, String visitor, Request request) throws Exception {
        JSONObject client = Events.json("clientName", profile[0], "clientVersion", profile[1], "hl", "en", "gl", "TZ", "userAgent", profile[4]);
        if (profile[0].equals("ANDROID_VR")) {
            client.put("osName", "Android").put("osVersion", "12L").put("deviceMake", "Oculus").put("deviceModel", "Quest 3").put("androidSdkVersion", 32)
                .put("buildId", "SQ3A.220605.009.A1").put("packageName", "com.google.android.apps.youtube.vr.oculus");
        } else {
            client.put("osName", "visionOS").put("osVersion", profile[1].equals("1.02") ? "26.5.23O471" : "26.6.0.23O770").put("deviceMake", "Apple").put("deviceModel", "RealityDevice17,1");
            if (profile[1].equals("1.04")) client.put("platform", "MOBILE");
        }
        if (!visitor.isEmpty()) client.put("visitorData", visitor);
        JSONObject body = Events.json("videoId", id, "context", Events.json("client", client, "user", Events.json("lockedSafetyMode", false)));
        HttpURLConnection connection = request.open(profile[3] + "/youtubei/v1/player?prettyPrint=false", profile[4]);
        try {
            connection.setRequestMethod("POST"); connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("X-YouTube-Client-Name", profile[2]); connection.setRequestProperty("X-YouTube-Client-Version", profile[1]);
            connection.setRequestProperty("Origin", profile[3]); connection.setRequestProperty("Referer", profile[3] + "/");
            if (!visitor.isEmpty()) connection.setRequestProperty("X-Goog-Visitor-Id", visitor);
            byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(payload.length);
            try (OutputStream output = connection.getOutputStream()) { request.check(); output.write(payload); }
            int code = connection.getResponseCode();
            if (code != 200) throw new IOException("YouTube player returned HTTP " + code);
            return new JSONObject(new String(request.read(connection, 2_000_000, false), StandardCharsets.UTF_8));
        } finally { connection.disconnect(); }
    }

    private static void probe(String source, Request request) throws Exception {
        String url = source.matches(".*[?&]range=[^&#]*.*") ? source.replaceFirst("([?&])range=[^&#]*", "$1range=0-4095") : source + (source.contains("?") ? "&" : "?") + "range=0-4095";
        for (int redirect = 0; redirect <= 2; redirect++) {
            if (!mediaUrl(url)) throw new IOException("YouTube returned an unsupported media host");
            HttpURLConnection connection = request.open(url, MEDIA_AGENT);
            try {
                connection.setRequestProperty("Range", "bytes=0-4095"); connection.setRequestProperty("Referer", "https://music.youtube.com/");
                int code = connection.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = connection.getHeaderField("Location");
                    if (location == null || redirect == 2) throw new IOException("YouTube media redirect limit reached");
                    url = new URL(new URL(url), location).toString(); continue;
                }
                if (code != 200 && code != 206) throw new IOException("YouTube media returned HTTP " + code);
                String type = connection.getContentType();
                if (type == null || !type.toLowerCase(Locale.ROOT).startsWith("audio/")) throw new IOException("YouTube did not return an audio MIME type");
                byte[] sample = request.read(connection, MEDIA_PROBE_BYTES, true);
                boolean mp4 = sample.length >= 12 && sample[4] == 'f' && sample[5] == 't' && sample[6] == 'y' && sample[7] == 'p';
                boolean webm = sample.length >= 4 && (sample[0] & 255) == 0x1a && (sample[1] & 255) == 0x45 && (sample[2] & 255) == 0xdf && (sample[3] & 255) == 0xa3;
                if (!mp4 && !webm) throw new IOException("YouTube returned an invalid audio container");
                return;
            } finally { connection.disconnect(); }
        }
    }

    private static boolean mediaUrl(String value) {
        try { URL url = new URL(value); return MainActivity.allowedNetworkUrl(value) && url.getHost().toLowerCase(Locale.ROOT).endsWith(".googlevideo.com") && url.getPath().equals("/videoplayback"); }
        catch (Exception error) { return false; }
    }
    private static int preference(int itag) {
        switch (itag) { case 140: return 0; case 139: return 1; case 251: return 2; case 250: return 3; case 249: return 4; default: return 5; }
    }
    private static String sourceReason(JSONObject status) {
        String reason = status.optString("reason");
        JSONObject screen = status.optJSONObject("errorScreen");
        JSONObject renderer = screen == null ? null : screen.optJSONObject("playerErrorMessageRenderer");
        if (reason.isEmpty() && renderer != null) {
            JSONObject text = renderer.optJSONObject("reason");
            if (text != null) {
                reason = text.optString("simpleText");
                JSONArray runs = text.optJSONArray("runs");
                if (reason.isEmpty() && runs != null) for (int i = 0; i < runs.length(); i++) { JSONObject run = runs.optJSONObject(i); if (run != null) reason += run.optString("text"); }
            }
        }
        return reason.isEmpty() ? "The source did not permit public playback." : safe(reason);
    }
    private static String safe(String value) {
        if (value == null || value.isEmpty()) return "YouTube network request failed";
        String text = value.replaceAll("https?://\\S+", "[source URL omitted]").replaceAll("[\\r\\n\\t]+", " ");
        return text.substring(0, Math.min(240, text.length()));
    }
}

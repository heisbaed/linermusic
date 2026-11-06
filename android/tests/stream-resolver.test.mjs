import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Only the HTTP/Events boundary is replaced. The production resolver is compiled and executed.
// The cached org.json artifact is for this JVM harness, never an Android runtime dependency.
const root = fileURLToPath(new URL('../../', import.meta.url));
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const jsonJar = option('json-jar', join(homedir(), '.gradle/caches/modules-2/files-2.1/org.json/json/20250517/d67181bbd819ccceb929b580a4e2fcb0c8b17cd8/json-20250517.jar'));
const androidJar = option('android-jar', join(root, '.android-sdk/platforms/android-36/android.jar'));
const execute = promisify(execFile);

const harness = String.raw`
package com.heisbaed.cinemusic;
import org.json.*;
import java.io.*;
import java.net.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

class Events {
    static JSONObject json(Object... values) {
        JSONObject result = new JSONObject();
        try { for (int i = 0; i < values.length; i += 2) result.put((String)values[i], values[i + 1]); }
        catch (JSONException error) { throw new IllegalArgumentException(error); }
        return result;
    }
}
class MainActivity {
    static boolean live;
    static final Deque<Reply> replies = new ArrayDeque<>();
    static final List<HttpURLConnection> opened = new ArrayList<>();
    static boolean allowedNetworkUrl(String value) {
        try {
            URL url = new URL(value); String host = url.getHost().toLowerCase(Locale.ROOT);
            return url.getProtocol().equals("https") && url.getUserInfo() == null && (url.getPort() == -1 || url.getPort() == 443)
                && (host.equals("www.youtube.com") || host.equals("music.youtube.com") || host.endsWith(".googlevideo.com"));
        } catch (Exception error) { return false; }
    }
    static HttpURLConnection connection(String value) throws Exception {
        if (!allowedNetworkUrl(value)) throw new IOException("Unsupported network address");
        HttpURLConnection connection;
        if (live) {
            connection = (HttpURLConnection)new URL(value).openConnection();
            connection.setInstanceFollowRedirects(false);
        } else {
            if (replies.isEmpty()) throw new AssertionError("Unexpected HTTP phase");
            Reply reply = replies.removeFirst();
            String expected = value.contains("sw.js_data") ? "warm" : value.contains("/youtubei/v1/player") ? "player" : "media";
            require(reply.phase.equals(expected), "HTTP phase order");
            reply.address = new URL(value); connection = reply;
        }
        opened.add(connection); return connection;
    }
    static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
class Reply extends HttpURLConnection {
    final String phase, mime;
    final int code;
    final byte[] body;
    final ByteArrayOutputStream sent = new ByteArrayOutputStream();
    URL address;
    String location;
    boolean disconnected;
    int bytesRead;
    Reply(String phase, int code, String mime, byte[] body) throws Exception { super(new URL("https://www.youtube.com/")); this.phase = phase; this.code = code; this.mime = mime; this.body = body; }
    @Override public void connect() {}
    @Override public boolean usingProxy() { return false; }
    @Override public void disconnect() { disconnected = true; }
    @Override public OutputStream getOutputStream() { return sent; }
    @Override public int getResponseCode() {
        MainActivity.require(getRequestProperty("Authorization") == null, "No source auth header");
        MainActivity.require("".equals(getRequestProperty("Cookie")), "No inherited cookies");
        if (phase.equals("player")) {
            try {
                JSONObject body = new JSONObject(sent.toString("UTF-8"));
                JSONObject client = body.getJSONObject("context").getJSONObject("client");
                MainActivity.require(!body.has("contentCheckOk") && !body.has("racyCheckOk"), "No age/content check override");
                MainActivity.require(Objects.equals(client.optString("visitorData", null), getRequestProperty("X-Goog-Visitor-Id")), "Visitor header/context match");
            } catch (Exception error) { throw new AssertionError(error); }
        }
        return code;
    }
    @Override public String getContentType() { return mime; }
    @Override public String getHeaderField(String name) { return name.equals("Location") ? location : null; }
    @Override public InputStream getInputStream() {
        return new ByteArrayInputStream(body) {
            @Override public synchronized int read(byte[] buffer, int start, int length) { int n = super.read(buffer, start, length); if (n > 0) bytesRead += n; return n; }
            @Override public synchronized int read() { int n = super.read(); if (n >= 0) bytesRead++; return n; }
        };
    }
}
public class ResolverChecks {
    static final String ID = "S0pnaaR2X3Q";
    static final String MEDIA = "https://rr1.googlevideo.com/videoplayback?itag=140";
    static final String VISITOR1 = "Cgtabcdefghijklmnopqrstuv%3D%3D", VISITOR2 = "Cgtzyxwvutsrqponmlkjihgfe%3D%3D";
    static int passed;
    interface Checked { void run() throws Exception; }
    static void require(boolean value, String message) { MainActivity.require(value, message); }
    static Reply reply(String phase, int code, String mime, String body) throws Exception { Reply reply = new Reply(phase, code, mime, body.getBytes(StandardCharsets.UTF_8)); MainActivity.replies.add(reply); return reply; }
    static Reply warm(String visitor) throws Exception { return reply("warm", 200, "application/json", visitor); }
    static JSONObject format(int itag, String url) { return Events.json("itag", itag, "url", url, "mimeType", "audio/mp4; codecs=\"mp4a.40.2\""); }
    static JSONObject ok(JSONArray formats) { return Events.json("playabilityStatus", Events.json("status", "OK"), "videoDetails", Events.json("videoId", ID), "streamingData", Events.json("adaptiveFormats", formats)); }
    static Reply player(JSONObject body) throws Exception { return reply("player", 200, "application/json", body.toString()); }
    static Reply ok() throws Exception { return player(ok(new JSONArray().put(format(140, MEDIA)))); }
    static Reply denied(String state, String reason) throws Exception { return player(Events.json("playabilityStatus", Events.json("status", state, "reason", reason))); }
    static Reply media(int code, String mime) throws Exception {
        byte[] audio = new byte[100_000]; System.arraycopy(new byte[]{'f','t','y','p'}, 0, audio, 4, 4);
        Reply reply = new Reply("media", code, mime, audio); MainActivity.replies.add(reply); return reply;
    }
    static void reset() throws Exception {
        Field session = StreamResolver.class.getDeclaredField("session"); session.setAccessible(true); session.set(null, null);
        StreamResolver.invalidate(ID);
        MainActivity.replies.clear(); MainActivity.opened.clear();
    }
    static String resolve() throws Exception {
        List<HttpURLConnection> registered = new ArrayList<>();
        int before = MainActivity.opened.size();
        try { return StreamResolver.resolve(ID, () -> false, registered::add); }
        finally {
            require(registered.equals(MainActivity.opened.subList(before, MainActivity.opened.size())), "Every warm/player/probe connection registered");
            for (HttpURLConnection connection : MainActivity.opened) require(((Reply)connection).disconnected, "Every connection disconnected");
        }
    }
    static String failed() throws Exception {
        try { resolve(); throw new AssertionError("Must not report resolution success"); }
        catch (IOException error) { require(!error.getMessage().contains("https://"), "Signed URLs not exposed"); return error.getMessage(); }
    }
    static void check(String name, Checked run) throws Exception {
        reset(); run.run(); require(MainActivity.replies.isEmpty(), "All expected HTTP phases consumed: " + name);
        passed++; System.out.println("PASS " + name);
    }
    public static void main(String[] args) throws Exception {
        if (args.length > 0 && args[0].equals("live")) {
            MainActivity.live = true;
            for (String id : new String[]{ID, "JGwWNGJdvx8", "dQw4w9WgXcQ"}) {
                List<HttpURLConnection> registered = new ArrayList<>(); int before = MainActivity.opened.size();
                try {
                    String url = StreamResolver.resolve(id, () -> false, registered::add);
                    require(MainActivity.allowedNetworkUrl(url) && new URL(url).getHost().endsWith(".googlevideo.com"), "Validated direct media host");
                    require(registered.size() == MainActivity.opened.size() - before, "Live callback registration");
                    System.out.println("PASS native-live " + id + " directGooglevideo=true audioMimeAndContainerValidated=true mediaReadCap=4096 connections=" + registered.size());
                } catch (Exception error) {
                    System.out.println("FAIL native-live " + id + " " + String.valueOf(error.getMessage()).replaceAll("https?://\\S+", "[source URL omitted]")); System.exit(1);
                }
            }
            return;
        }
        check("warm-cache-and-4KB-read-cap", () -> {
            warm(VISITOR1); ok(); Reply sample = media(206, "audio/mp4"); require(resolve().equals(MEDIA), "Original signed URL returned unchanged");
            require(sample.bytesRead == 4096, "Read at most 4KB even if server ignores Range");
            ok(); media(206, "audio/mp4"); require(resolve().equals(MEDIA), "Cached visitor avoids second warm");
        });
        check("one-bot-visitor-refresh", () -> {
            warm(VISITOR1); denied("LOGIN_REQUIRED", "Sign in to confirm you're not a bot"); warm(VISITOR2); Reply retried = ok(); media(206, "audio/mp4");
            resolve(); require(retried.getRequestProperty("X-Goog-Visitor-Id").equals(VISITOR2), "New authentic visitor used");
        });
        check("validated-stream-replay-skips-network", () -> {
            String url = MEDIA + "&expire=" + (System.currentTimeMillis() / 1000 + 3600);
            warm(VISITOR1); player(ok(new JSONArray().put(format(140, url)))); media(206, "audio/mp4");
            require(resolve().equals(url), "Fresh URL resolved");
            int connections = MainActivity.opened.size();
            require(resolve().equals(url), "Same validated URL reused");
            require(MainActivity.opened.size() == connections, "Replay avoids metadata and probe requests");
        });
        check("invalidate-rejected-stream-before-retry", () -> {
            String url = MEDIA + "&expire=" + (System.currentTimeMillis() / 1000 + 3600);
            warm(VISITOR1); player(ok(new JSONArray().put(format(140, url)))); media(206, "audio/mp4"); resolve();
            StreamResolver.invalidate(ID);
            ok(); media(206, "audio/mp4"); require(resolve().equals(MEDIA), "Retry obtains a new URL");
        });
        check("expiring-stream-is-not-cached", () -> {
            String url = MEDIA + "&expire=" + (System.currentTimeMillis() / 1000 + 20);
            warm(VISITOR1); player(ok(new JSONArray().put(format(140, url)))); media(206, "audio/mp4"); resolve();
            ok(); media(206, "audio/mp4"); require(resolve().equals(MEDIA), "Near-expiry URL resolved again");
        });
        check("cached-stream-respects-cancellation", () -> {
            String url = MEDIA + "&expire=" + (System.currentTimeMillis() / 1000 + 3600);
            warm(VISITOR1); player(ok(new JSONArray().put(format(140, url)))); media(206, "audio/mp4"); resolve();
            try { StreamResolver.resolve(ID, () -> true, connection -> {}); throw new AssertionError("Cancelled cached request must fail"); }
            catch (InterruptedIOException expected) {}
        });
        check("startup-warm-removes-first-play-warm-request", () -> {
            warm(VISITOR1); StreamResolver.warm(() -> false, connection -> {});
            ok(); media(206, "audio/mp4"); resolve();
            require(MainActivity.opened.size() == 3, "Only one visitor fetch across warm and playback");
        });
        check("persistent-bot-is-not-firebase-reauth", () -> {
            warm(VISITOR1); denied("LOGIN_REQUIRED", "Sign in to confirm you're not a bot"); warm(VISITOR2);
            for (int i = 0; i < 3; i++) denied("LOGIN_REQUIRED", "Sign in to confirm you're not a bot");
            String error = failed(); require(error.contains("Cine sign-in does not authorize YouTube") && error.contains("VISIONOS 1.02") && error.contains("VISIONOS 1.04") && error.contains("ANDROID_VR"), "Accurate complete profile reasons");
        });
        for (String reason : new String[]{"Sign in to confirm your age", "This video is private", "Join this channel to play members-only content", "This video is not available in your country"}) {
            check("terminal-source-restriction-" + reason, () -> { warm(VISITOR1); denied("LOGIN_REQUIRED", reason); String error = failed(); require(error.contains(reason) && error.contains("Cine sign-in cannot unlock source restrictions"), "Exact source restriction retained, not bypassed with alternate client"); });
        }
        check("truly-unavailable-source", () -> { warm(VISITOR1); denied("UNPLAYABLE", "This live stream recording is not available."); require(failed().contains("recording is not available"), "Preserve real source reason"); });
        check("age-flag-even-with-OK", () -> {
            warm(VISITOR1); JSONObject body = ok(new JSONArray().put(format(140, MEDIA))); body.getJSONObject("videoDetails").put("isAgeRestricted", true); player(body);
            require(failed().contains("age-restricted"), "No age bypass");
        });
        check("DRM-license-is-unavailable", () -> {
            warm(VISITOR1); JSONObject body = ok(new JSONArray().put(format(140, MEDIA))); body.getJSONObject("streamingData").put("licenseInfos", new JSONArray().put(Events.json("licenseUrl", "https://www.youtube.com/"))); player(body);
            require(failed().contains("DRM"), "No DRM bypass");
        });
        check("DRM-only-formats-do-not-trigger-client-bypass", () -> {
            warm(VISITOR1); JSONObject protectedFormat = format(140, MEDIA).put("drmFamilies", new JSONArray().put("WIDEVINE")); player(ok(new JSONArray().put(protectedFormat)));
            require(failed().contains("DRM-protected"), "No fallback for exclusively protected audio");
        });
        check("supported-profile-fallback-for-ciphered-audio", () -> {
            warm(VISITOR1); player(ok(new JSONArray().put(Events.json("itag", 140, "mimeType", "audio/mp4", "signatureCipher", "unsupported")))); Reply next = ok(); media(206, "audio/mp4");
            resolve(); require(next.getRequestProperty("X-YouTube-Client-Version").equals("1.04"), "Real second profile used");
        });
        check("rejected-media-falls-back-to-next-format", () -> {
            warm(VISITOR1); player(ok(new JSONArray().put(format(140, MEDIA)).put(format(139, MEDIA.replace("140", "139"))))); media(403, "text/plain"); media(206, "audio/mp4");
            require(resolve().contains("itag=139"), "Do not return a 403 media URL");
        });
        check("invalid-audio-MIME-and-container-are-not-success", () -> {
            warm(VISITOR1); ok(); media(200, "text/html"); ok(); reply("media", 200, "audio/mp4", "not audio content"); ok(); media(206, "audio/mp4");
            resolve(); require(MainActivity.opened.size() == 7, "Both invalid responses rejected before fallback");
        });
        check("untrusted-direct-source-is-not-requested", () -> {
            warm(VISITOR1); player(ok(new JSONArray().put(format(140, "https://rr1.googlevideo.com.evil/videoplayback")))); ok(); media(206, "audio/mp4"); resolve();
        });
        check("untrusted-redirect-is-not-followed", () -> {
            warm(VISITOR1); ok(); Reply redirect = media(302, "text/plain"); redirect.location = "https://example.invalid/videoplayback"; ok(); media(206, "audio/mp4"); resolve();
        });
        check("malformed-or-wrong-video-response-not-success", () -> {
            warm(VISITOR1); player(Events.json("streamingData", Events.json())); JSONObject wrong = ok(new JSONArray().put(format(140, MEDIA))); wrong.getJSONObject("videoDetails").put("videoId", "dQw4w9WgXcQ"); player(wrong); ok(); media(206, "audio/mp4"); resolve();
        });
        for (String phase : new String[]{"warm", "player", "media"}) {
            check("cancel-during-" + phase + "-registration", () -> {
                warm(VISITOR1); if (!phase.equals("warm")) ok(); if (phase.equals("media")) media(206, "audio/mp4");
                AtomicBoolean cancel = new AtomicBoolean();
                try { StreamResolver.resolve(ID, cancel::get, connection -> { if (((Reply)connection).phase.equals(phase)) cancel.set(true); }); throw new AssertionError("Cancellation must stop resolution"); }
                catch (InterruptedIOException expected) { require(expected.getMessage().contains("cancelled"), "Truthful cancellation"); }
                for (HttpURLConnection connection : MainActivity.opened) require(((Reply)connection).disconnected, "Cancelled connection disconnected");
            });
        }
        check("cancel-before-network", () -> {
            try { StreamResolver.resolve(ID, () -> true, connection -> { throw new AssertionError("No HTTP after cancellation"); }); throw new AssertionError("Cancellation must throw"); }
            catch (InterruptedIOException expected) { require(MainActivity.opened.isEmpty(), "No connection opened"); }
        });
        check("invalid-track-before-network", () -> {
            try { StreamResolver.resolve("invalid"); throw new AssertionError("Invalid ID must fail"); }
            catch (IOException expected) { require(MainActivity.opened.isEmpty(), "No HTTP for invalid track"); }
        });
        System.out.println("RESOLVER_CHECKS_PASSED=" + passed);
    }
}
`;

test('production native resolver: HTTP flow, restrictions, cancellation, caps and fallback', { timeout: process.argv.includes('--live') ? 180_000 : 30_000 }, async () => {
  await stat(jsonJar); await stat(androidJar);
  const tempParent = join(tmpdir(), 'kilo');
  await mkdir(tempParent, { recursive: true });
  const temp = await mkdtemp(join(tempParent, 'cine-resolver-'));
  try {
    const source = join(root, 'android/app/src/main/java/com/heisbaed/cinemusic/StreamResolver.java');
    assert((await readFile(source, 'utf8')).includes('class StreamResolver'));
    await writeFile(join(temp, 'ResolverChecks.java'), harness);
    await execute('javac', ['--release', '17', '-cp', androidJar, '-d', temp, source, join(temp, 'ResolverChecks.java')], { timeout: 30_000 });
    const { stdout, stderr } = await execute('java', ['-cp', [temp, jsonJar].join(delimiter), 'com.heisbaed.cinemusic.ResolverChecks', ...(process.argv.includes('--live') ? ['live'] : [])], { timeout: process.argv.includes('--live') ? 170_000 : 20_000, maxBuffer: 256_000 });
    console.log(stdout.trim());
    assert.equal(stderr, '');
    if (process.argv.includes('--live')) assert.equal((stdout.match(/PASS native-live/g) || []).length, 3);
    else assert(stdout.includes('RESOLVER_CHECKS_PASSED=27'));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

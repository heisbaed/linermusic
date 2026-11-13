package com.heisbaed.cinemusic;

import android.app.*;
import android.content.*;
import android.os.*;
import org.json.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

/** Device checks for the two core guarantees: protected files and native offline playback. */
public class VaultChecks extends Instrumentation {
    private int passed;
    private final StringBuilder report = new StringBuilder();
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private void test(String name, CheckedRunnable run) throws Exception {
        run.run(); passed++; report.append("PASS: ").append(name).append('\n');
        Bundle update = new Bundle(); update.putString("stream", "PASS: " + name + "\n"); sendStatus(0, update);
    }
    interface CheckedRunnable { void run() throws Exception; }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            Context context = getTargetContext(); OfflineVault vault = new OfflineVault(context);
            test("Update sources and same-version APK rejection", () -> UpdateChecks.verify(context));
            test("Firebase network hosts are exact and external actions are validated", () -> {
                MainActivity.configureNetworkHosts(context);
                check(MainActivity.allowedNetworkUrl("https://identitytoolkit.googleapis.com/v1/accounts:lookup"), "Firebase identity host blocked");
                check(MainActivity.allowedNetworkUrl("https://securetoken.googleapis.com/v1/token"), "Firebase token host blocked");
                JSONObject config;
                try (InputStream input = context.getAssets().open("firebase-config.json"); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096]; int count;
                    while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
                    config = new JSONObject(bytes.toString("UTF-8"));
                }
                String database = config.optString("databaseURL");
                if (!database.isEmpty()) check(MainActivity.allowedNetworkUrl(database + "/users/check.json"), "Configured database blocked");
                for (String url : new String[]{"http://identitytoolkit.googleapis.com", "https://identitytoolkit.googleapis.com.evil.invalid", "https://unconfigured.firebaseio.com", "https://unconfigured.firebasedatabase.app", "https://user@securetoken.googleapis.com", "https://securetoken.googleapis.com:444", "https://securetoken.googleapis.com\\@evil.invalid"}) {
                    check(!MainActivity.allowedNetworkUrl(url), "Unsafe address allowed: " + url);
                }
                check(!MainActivity.validExternalUrl("javascript:alert(1)"), "Script action allowed");
                check(!MainActivity.validExternalUrl("intent://settings"), "Intent action allowed");
                String host = config.optString("authDomain");
                if (!host.isEmpty()) {
                    String action = "https://" + host + "/__/auth/action?mode=resetPassword&oobCode=local-check";
                    check(MainActivity.authAction(action) != null, "Hosted reset action rejected");
                    check(MainActivity.authAction("https://example.invalid/?link=" + android.net.Uri.encode(action)) != null, "Nested hosted action rejected");
                    check(MainActivity.authAction(action.replace(host, "evil.invalid")) == null, "Foreign action host allowed");
                    check(MainActivity.authAction(action.replace("resetPassword", "unexpected")) == null, "Unknown auth action allowed");
                }
            });
            test("AES-GCM round trip, private storage, metadata and deletion", () -> {
                byte[] original = String.join("", Collections.nCopies(100, "Cine offline content that must never appear as an exported audio file")).getBytes(StandardCharsets.UTF_8);
                JSONObject track = Events.json("id", "vault-roundtrip", "title", "Vault check", "artist", "Test", "durationMs", 1000);
                vault.store(track, new ByteArrayInputStream(original), original.length, (read, total) -> {});
                try {
                    check(vault.contains("vault-roundtrip"), "Saved track missing");
                    check(Arrays.equals(original, vault.open("vault-roundtrip")), "Decrypted content changed");
                    File file = audioFile(vault, "vault-roundtrip");
                    byte[] bytes = Files.readAllBytes(file.toPath());
                    check(bytes.length == original.length + 29, "Authenticated encrypted file framing changed");
                    check(!new String(bytes, StandardCharsets.ISO_8859_1).contains("Cine offline content"), "Plain audio content was saved");
                    check(file.getCanonicalPath().startsWith(context.getNoBackupFilesDir().getCanonicalPath() + File.separator), "Audio escaped app-private storage");
                    check(!file.getAbsolutePath().contains("/sdcard/"), "A public file was created");
                } finally { vault.remove("vault-roundtrip"); }
                check(!vault.contains("vault-roundtrip"), "Download deletion failed");
            });
            test("Tampered downloads fail authentication", () -> {
                byte[] audio = new byte[1024]; Arrays.fill(audio, (byte)42);
                JSONObject track = Events.json("id", "vault-tamper", "title", "Tamper check");
                vault.store(track, new ByteArrayInputStream(audio), audio.length, (read, total) -> {});
                try {
                    File file = audioFile(vault, "vault-tamper");
                    byte[] bytes = Files.readAllBytes(file.toPath()); bytes[bytes.length - 1] ^= 1; Files.write(file.toPath(), bytes);
                    boolean rejected = false; try { vault.open("vault-tamper"); } catch (Exception expected) { rejected = true; }
                    check(rejected, "Modified ciphertext was accepted");
                } finally { vault.remove("vault-tamper"); }
            });
            test("Interrupted downloads leave no playable or partial file", () -> {
                boolean failed = false;
                try { vault.store(Events.json("id", "vault-interrupted"), new ByteArrayInputStream(new byte[8192]), 8192, (read, total) -> { throw new IOException("Interrupted for test"); }); }
                catch (IOException expected) { failed = true; }
                check(failed && !vault.contains("vault-interrupted"), "Interrupted download appeared complete");
                File audio = audioFile(vault, "vault-interrupted");
                check(!new File(audio.getParentFile(), audio.getName().replace(".cine", ".partial")).exists(), "A partial audio file was left behind");
            });
            test("Completed download snapshots are truthful and deduplicated", () -> {
                String id = "vault-job-check"; byte[] data = new byte[]{1, 2, 3, 4};
                try {
                    vault.store(Events.json("id", id, "title", "Local job check"), new ByteArrayInputStream(data), data.length, (read, total) -> {});
                    DownloadService.jobs(context);
                    JSONArray jobs = DownloadService.jobs(context); int found = 0;
                    for (int i = 0; i < jobs.length(); i++) {
                        JSONObject job = jobs.getJSONObject(i); if (!id.equals(job.optString("id"))) continue;
                        found++; check("completed".equals(job.optString("status")) && job.optInt("progress") == 100 && job.optLong("bytes") == data.length, "Completed job metadata is inaccurate");
                        check(job.optBoolean("restartOnResume"), "Restart semantics are missing");
                    }
                    check(found == 1, "Completed job was duplicated");
                    DownloadService.cancel(context, id, false); check(vault.contains(id), "Cancel deleted a completed vault item");
                } finally { vault.remove(id); DownloadService.forget(context, id); }
            });
            test("Cancellation at the vault commit boundary cannot complete a download", () -> {
                String id = "vault-cancel-commit"; int[] checkpoints = {0}; boolean[] committed = {false}; boolean cancelled = false;
                try {
                    vault.store(Events.json("id", id), new ByteArrayInputStream(new byte[]{1, 2, 3, 4}), 4,
                        (read, total) -> { if (++checkpoints[0] == 2) throw new InterruptedIOException("Cancelled before commit"); },
                        new Object(), () -> committed[0] = true);
                } catch (InterruptedIOException expected) { cancelled = true; }
                try { check(cancelled && !committed[0] && !vault.contains(id), "Cancelled transfer appeared complete"); }
                finally { vault.remove(id); }
            });
            test("Native offline play, pause, seek and next survive closing the activity", () -> playback(context, vault));
            result.putString("stream", report + "\nOK (" + passed + " device checks)\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("stream", report + "\nFAILED: " + error + "\n" + android.util.Log.getStackTraceString(error));
            finish(Activity.RESULT_CANCELED, result);
        }
    }
    private void playback(Context context, OfflineVault vault) throws Exception {
        byte[] wave = wav(60);
        JSONObject first = Events.json("id", "vault-play-one", "title", "Offline playback check", "artist", "Cine music tests", "durationMs", 60000, "offline", true);
        JSONObject second = Events.json("id", "vault-play-two", "title", "Offline queue check", "artist", "Cine music tests", "durationMs", 60000, "offline", true);
        vault.store(first, new ByteArrayInputStream(wave), wave.length, (read, total) -> {});
        vault.store(second, new ByteArrayInputStream(wave), wave.length, (read, total) -> {});
        AtomicReference<JSONObject> state = new AtomicReference<>(new JSONObject());
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if ("player".equals(intent.getStringExtra("type"))) try { state.set(new JSONObject(intent.getStringExtra("data"))); } catch (Exception ignored) {}
            }
        };
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, new IntentFilter(Events.ACTION), Events.PERMISSION, null, Context.RECEIVER_NOT_EXPORTED);
        else context.registerReceiver(receiver, new IntentFilter(Events.ACTION), Events.PERMISSION, null);
        Activity activity = startActivitySync(new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try {
            JSONArray playbackQueue = new JSONArray().put(new JSONObject(first.toString())).put(second);
            first.put("queue", playbackQueue);
            context.startForegroundService(new Intent(context, PlaybackService.class).setAction("play").putExtra("track", first.toString()));
            await(() -> state.get().optString("status").equals("playing") && state.get().optLong("positionMs") > 400, "Offline playback did not start: " + state.get());
            runOnMainSync(() -> PlaybackService.instance.setQueue(playbackQueue, false, "off"));
            runOnMainSync(() -> PlaybackService.instance.setQueue(playbackQueue, true, "all"));
            JSONObject snapshot = new JSONObject(PlaybackService.instance.snapshot());
            check(snapshot.getJSONArray("queue").length() == 2 && snapshot.getBoolean("shuffle") && "all".equals(snapshot.getString("repeat")), "Queue modes missing from native snapshot");
            check(snapshot.has("output") && snapshot.has("sleepDeadline") && !snapshot.getBoolean("sleepEndOfSong"), "Native snapshot is incomplete");
            check(PlaybackService.PREVIOUS_RESTART_MS == 3000, "Previous restart threshold changed");
            runOnMainSync(() -> PlaybackService.instance.setQueue(playbackQueue, false, "off"));
            runOnMainSync(() -> PlaybackService.instance.command("pause", 0));
            await(() -> state.get().optString("status").equals("paused"), "Pause failed");
            runOnMainSync(() -> PlaybackService.instance.command("seek", 2000));
            runOnMainSync(() -> PlaybackService.instance.command("resume", 0));
            await(() -> state.get().optString("status").equals("playing") && state.get().optLong("positionMs") >= 1900, "Seek/resume failed");
            runOnMainSync(() -> PlaybackService.instance.command("pause", 0));
            runOnMainSync(() -> PlaybackService.instance.command("seek", 5000));
            await(() -> state.get().optLong("positionMs") >= 4900, "Seek-complete state was not published");
            runOnMainSync(() -> PlaybackService.instance.command("previous", 0));
            await(() -> state.get().optLong("positionMs") < 1000, "Previous after 3 seconds did not restart");
            runOnMainSync(() -> PlaybackService.instance.command("resume", 0));
            runOnMainSync(() -> PlaybackService.instance.setQueue(playbackQueue, false, "off"));
            runOnMainSync(activity::finish);
            runOnMainSync(() -> PlaybackService.instance.command("next", 0));
            await(() -> state.get().optString("status").equals("playing") && state.get().optJSONObject("track") != null && state.get().optJSONObject("track").optString("id").equals("vault-play-two"), "Offline queue did not advance in the background");
            runOnMainSync(() -> PlaybackService.instance.command("previous", 0));
            await(() -> state.get().optString("status").equals("playing") && state.get().optJSONObject("track").optString("id").equals("vault-play-one"), "Previous near the start did not use the native queue");
            runOnMainSync(() -> PlaybackService.instance.sleepTimer(.01, false));
            await(() -> state.get().optString("status").equals("paused") && state.get().optLong("sleepDeadline") == 0, "Native sleep timer failed with no activity");
            runOnMainSync(() -> PlaybackService.instance.sleepTimer(1, false));
            runOnMainSync(() -> PlaybackService.instance.sleepTimer(0, true));
            check(new JSONObject(PlaybackService.instance.snapshot()).getLong("sleepDeadline") == 0, "Zero minutes did not cancel the timer");
            runOnMainSync(() -> PlaybackService.instance.sleepTimer(1, true));
            check(new JSONObject(PlaybackService.instance.snapshot()).getBoolean("sleepEndOfSong"), "Current-song timer missing from snapshot");
            runOnMainSync(() -> PlaybackService.instance.command("seek", 59_800));
            runOnMainSync(() -> PlaybackService.instance.command("resume", 0));
            await(() -> state.get().optString("status").equals("paused") && !state.get().optBoolean("sleepEndOfSong"), "Current-song timer did not stop native advance");
            check("vault-play-one".equals(state.get().optJSONObject("track").optString("id")), "Sleep timer advanced the queue");
        } finally {
            runOnMainSync(() -> { if (PlaybackService.instance != null) PlaybackService.instance.command("stop", 0); if (!activity.isFinishing()) activity.finish(); });
            context.unregisterReceiver(receiver); vault.remove("vault-play-one"); vault.remove("vault-play-two");
        }
    }
    private void await(BooleanSupplier condition, String message) throws Exception {
        long deadline = System.currentTimeMillis() + 15_000;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < deadline) Thread.sleep(100);
        check(condition.getAsBoolean(), message);
    }
    private File audioFile(OfflineVault vault, String id) throws Exception {
        java.lang.reflect.Method path = OfflineVault.class.getDeclaredMethod("audio", String.class);
        path.setAccessible(true);
        return (File) path.invoke(vault, id);
    }
    private byte[] wav(int seconds) {
        int samples = seconds * 22050;
        ByteBuffer data = ByteBuffer.allocate(44 + samples * 2).order(ByteOrder.LITTLE_ENDIAN);
        data.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + samples * 2).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII))
            .putInt(16).putShort((short)1).putShort((short)1).putInt(22050).putInt(44100).putShort((short)2).putShort((short)16)
            .put("data".getBytes(StandardCharsets.US_ASCII)).putInt(samples * 2);
        // Silent PCM tests the real decoder and timeline without changing device volume.
        for (int i = 0; i < samples; i++) data.putShort((short)0);
        return data.array();
    }
}

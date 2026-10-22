package com.heisbaed.cinemusic;

import android.app.*;
import android.content.*;
import android.media.*;
import android.media.audiofx.Equalizer;
import android.media.session.*;
import android.os.*;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

public class PlaybackService extends Service {
    static volatile PlaybackService instance;
    static final int PREVIOUS_RESTART_MS = 3000;
    private volatile String snapshotJson = idleSnapshot().toString();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService loader = Executors.newSingleThreadExecutor();
    private final AtomicReference<HttpURLConnection> resolvingConnection = new AtomicReference<>();
    private Future<?> loadTask;
    private MediaPlayer player;
    private Equalizer equalizer;
    private boolean equalizerEnabled;
    private int[] equalizerBands = new int[]{0,0,0,0,0};
    private JSONObject equalizerInfo = Events.json("ready", false, "available", false);
    private MediaSession session;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private JSONObject track;
    private String status = "idle";
    private String error = "";
    private boolean prepared;
    private boolean playWhenReady;
    private boolean resumeOnFocus;
    private volatile int generation;
    private JSONArray queue = new JSONArray();
    private boolean shuffle;
    private String repeat = "off";
    private long sleepDeadline;
    private long sleepAtElapsed;
    private String sleepTrackId;
    private final Runnable sleep = () -> {
        clearSleepTimer();
        command("pause", 0);
    };
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { command("pause", 0); }
    };
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (sleepAtElapsed > 0 && SystemClock.elapsedRealtime() >= sleepAtElapsed) sleep.run();
            else if (prepared) publish();
            handler.postDelayed(this, 750);
        }
    };

    @Override public void onCreate() {
        super.onCreate(); instance = this;
        android.content.SharedPreferences audioPreferences = getSharedPreferences("cine_audio", MODE_PRIVATE);
        equalizerEnabled = audioPreferences.getBoolean("eq_enabled", false);
        try { JSONArray storedBands = new JSONArray(audioPreferences.getString("eq_bands", "[0,0,0,0,0]")); for (int i = 0; i < 5 && i < storedBands.length(); i++) equalizerBands[i] = Math.max(-12, Math.min(12, storedBands.getInt(i))); } catch (Exception ignored) {}
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(change -> {
                if (change == AudioManager.AUDIOFOCUS_LOSS) { resumeOnFocus = false; command("pause", 0); }
                else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                    resumeOnFocus = isPlaying(); playWhenReady = false;
                    if (prepared && player != null) player.pause();
                    status = "paused"; publish(); updateNotification();
                }
                else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK && player != null) player.setVolume(.2f, .2f);
                else if (change == AudioManager.AUDIOFOCUS_GAIN) {
                    if (player != null) player.setVolume(1, 1);
                    if (resumeOnFocus) { resumeOnFocus = false; command("resume", 0); }
                }
            }).build();
        session = new MediaSession(this, "Cine music");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { command("resume", 0); }
            @Override public void onPause() { command("pause", 0); }
            @Override public void onStop() { command("stop", 0); }
            @Override public void onSkipToNext() { command("next", 0); }
            @Override public void onSkipToPrevious() { command("previous", 0); }
            @Override public void onSeekTo(long position) { command("seek", position); }
        });
        session.setActive(true);
        NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notifications.createNotificationChannel(new NotificationChannel("playback", "Music playback", NotificationManager.IMPORTANCE_LOW));
        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, filter, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(noisy, filter);
        handler.post(tick);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        if ("play".equals(intent.getAction())) {
            startForeground(1, notification());
            try {
                JSONObject data = new JSONObject(intent.getStringExtra("track"));
                if (data.has("queue")) setQueue(data.optJSONArray("queue"), data.optBoolean("shuffle"), data.optString("repeat", "off"));
                data.remove("queue"); data.remove("shuffle"); data.remove("repeat");
                load(data);
            }
            catch (Exception error) { fail("Could not load this track"); }
        } else command(intent.getAction(), intent.getLongExtra("position", 0));
        return START_NOT_STICKY;
    }
    private void load(JSONObject next) throws Exception {
        if (sleepTrackId != null && !sleepTrackId.equals(next.optString("id"))) clearSleepTimer();
        track = next; error = ""; status = "loading"; prepared = false; playWhenReady = true; generation++;
        cancelLoad();
        final int epoch = generation;
        if (equalizer != null) { equalizer.release(); equalizer = null; }
        if (player != null) { player.release(); player = null; }
        MediaPlayer media = new MediaPlayer(); player = media;
        media.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
        media.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
        media.setOnPreparedListener(value -> {
            if (epoch != generation) return;
            prepared = true; status = "paused";
            applyEqualizer();
            if (playWhenReady) command("resume", 0); else { publish(); updateNotification(); }
        });
        media.setOnCompletionListener(value -> {
            if (epoch != generation) return;
            if (sleepTrackId != null || (sleepAtElapsed > 0 && SystemClock.elapsedRealtime() >= sleepAtElapsed)) {
                clearSleepTimer(); command("pause", 0); return;
            }
            status = "ended"; playWhenReady = false; publish(); updateNotification();
            advance(1, true);
        });
        media.setOnSeekCompleteListener(value -> { if (epoch == generation) publish(); });
        media.addOnRoutingChangedListener(router -> { if (epoch == generation) publish(); }, handler);
        media.setOnErrorListener((value, what, extra) -> { if (epoch == generation) fail("Playback failed. Try this track again or play a saved download."); return true; });
        media.setOnInfoListener((value, what, extra) -> {
            if (epoch != generation) return false;
            if (what == MediaPlayer.MEDIA_INFO_BUFFERING_START) { status = playWhenReady ? "loading" : "paused"; publish(); }
            if (what == MediaPlayer.MEDIA_INFO_BUFFERING_END) { status = isPlaying() ? "playing" : "paused"; publish(); }
            return false;
        });
        publish(); updateNotification();
        if (new OfflineVault(this).contains(next.getString("id"))) {
            next.put("offline", true);
            String id = next.getString("id");
            loadTask = loader.submit(() -> {
                try {
                    byte[] bytes = new OfflineVault(this).open(id);
                    handler.post(() -> {
                        if (epoch != generation) { Arrays.fill(bytes, (byte)0); return; }
                        try { media.setDataSource(new MemoryAudio(bytes)); media.prepareAsync(); }
                        catch (Exception error) { Arrays.fill(bytes, (byte)0); fail("Offline download could not be opened. Remove it and download it again."); }
                    });
                } catch (Exception error) { handler.post(() -> { if (epoch == generation) fail("Offline download could not be opened. Remove it and download it again."); }); }
            });
        } else {
            next.put("offline", false);
            loadTask = loader.submit(() -> {
                try {
                    String url = next.optString("url");
                    if (url.isEmpty()) url = StreamResolver.resolve(next.getString("id"), () -> epoch != generation || Thread.currentThread().isInterrupted(), connection -> {
                        resolvingConnection.set(connection);
                        if (epoch != generation || Thread.currentThread().isInterrupted()) {
                            if (resolvingConnection.compareAndSet(connection, null)) connection.disconnect();
                        }
                    });
                    if (!MainActivity.allowedNetworkUrl(url) || !new java.net.URL(url).getHost().endsWith(".googlevideo.com")) throw new IOException("Unsupported audio address");
                    final String resolved = url;
                    handler.post(() -> {
                        if (epoch != generation) return;
                        try {
                            Map<String, String> headers = new HashMap<>(); headers.put("User-Agent", "Mozilla/5.0"); headers.put("Referer", "https://music.youtube.com/");
                            media.setDataSource(this, android.net.Uri.parse(resolved), headers); media.prepareAsync();
                        } catch (Exception error) { fail("Could not open this song. Please try again."); }
                    });
                } catch (Exception error) { handler.post(() -> { if (epoch == generation) fail(error.getMessage() == null ? "This song is unavailable" : error.getMessage()); }); }
                finally { HttpURLConnection connection = resolvingConnection.getAndSet(null); if (connection != null) connection.disconnect(); }
            });
        }
    }
    private void cancelLoad() {
        if (loadTask != null) { loadTask.cancel(true); loadTask = null; }
        HttpURLConnection connection = resolvingConnection.getAndSet(null);
        if (connection != null) connection.disconnect();
    }
    void setQueue(JSONArray songs, boolean shuffle, String repeat) {
        this.queue = songs == null ? new JSONArray() : songs;
        this.shuffle = shuffle;
        this.repeat = Arrays.asList("off", "all", "one").contains(repeat) ? repeat : "off";
        publish();
    }
    static JSONObject idleSnapshot() {
        return Events.json("track", JSONObject.NULL, "status", "idle", "positionMs", 0, "durationMs", 0,
            "queue", new JSONArray(), "shuffle", false, "repeat", "off", "output", "System default", "sleepDeadline", 0, "sleepEndOfSong", false);
    }
    String snapshot() { return snapshotJson; }
    void sleepTimer(double minutes, boolean endOfSong) {
        clearSleepTimer();
        if (Double.isFinite(minutes) && minutes > 0 && track != null) {
            if (endOfSong) sleepTrackId = track.optString("id");
            else {
                long delay = (long)(Math.min(minutes, 24 * 60) * 60_000);
                sleepDeadline = System.currentTimeMillis() + delay;
                sleepAtElapsed = SystemClock.elapsedRealtime() + delay;
                handler.postDelayed(sleep, delay);
            }
        }
        publish();
    }
    private void clearSleepTimer() {
        handler.removeCallbacks(sleep); sleepDeadline = 0; sleepAtElapsed = 0; sleepTrackId = null;
    }
    boolean configureEqualizer(boolean enabled, int[] bands) {
        equalizerEnabled = enabled;
        if (bands != null && bands.length == 5) equalizerBands = bands.clone();
        boolean applied = !prepared || applyEqualizer();
        publish();
        return applied;
    }
    private boolean applyEqualizer() {
        try {
            if (equalizer != null) { equalizer.release(); equalizer = null; }
            if (!prepared || player == null) return true;
            equalizer = new Equalizer(0, player.getAudioSessionId());
            short[] range = equalizer.getBandLevelRange();
            short count = equalizer.getNumberOfBands();
            JSONArray frequencies = new JSONArray();
            for (short band = 0; band < Math.min(count, 5); band++) {
                frequencies.put(equalizer.getCenterFreq(band) / 1000);
                int millibels = Math.max(-12, Math.min(12, equalizerBands[band])) * 100;
                short level = (short)Math.max(range[0], Math.min(range[1], millibels));
                equalizer.setBandLevel(band, level);
            }
            equalizer.setEnabled(equalizerEnabled);
            equalizerInfo = Events.json("ready", true, "available", count > 0, "bandCount", count, "frequencies", frequencies,
                "minDb", Math.max(-12, range[0] / 100), "maxDb", Math.min(12, range[1] / 100));
            return true;
        } catch (Exception error) {
            if (equalizer != null) { try { equalizer.release(); } catch (Exception ignored) {} equalizer = null; }
            equalizerInfo = Events.json("ready", true, "available", false);
            return !equalizerEnabled;
        }
    }
    private void advance(int direction, boolean ended) {
        if (track == null) return;
        try {
            if (direction < 0 && prepared && player.getCurrentPosition() > PREVIOUS_RESTART_MS) { command("seek", 0); return; }
            if (ended && "one".equals(repeat)) { load(new JSONObject(track.toString())); return; }
            if (queue.length() == 0) { publish(); return; }
            int current = -1; for (int i = 0; i < queue.length(); i++) if (queue.getJSONObject(i).optString("id").equals(track.optString("id"))) { current = i; break; }
            int next = current + direction;
            if (shuffle && direction > 0 && queue.length() > 1) {
                do { next = new Random().nextInt(queue.length()); } while (next == current);
            }
            if (next < 0 || next >= queue.length()) {
                if ("all".equals(repeat)) next = direction > 0 ? 0 : queue.length() - 1;
                else { if (direction < 0 && prepared) command("seek", 0); else publish(); return; }
            }
            load(new JSONObject(queue.getJSONObject(next).toString()));
        } catch (Exception error) { fail("The next song could not be played."); }
    }
    private boolean isPlaying() { try { return prepared && player != null && player.isPlaying(); } catch (Exception ignored) { return false; } }
    void command(String action, double value) {
        if (action == null) return;
        try {
            switch (action) {
                case "pause":
                    resumeOnFocus = false; playWhenReady = false;
                    if (prepared && player != null) player.pause();
                    status = "paused"; audio.abandonAudioFocusRequest(focus); break;
                case "resume":
                    playWhenReady = true;
                    if (!prepared && player == null && track != null) { load(new JSONObject(track.toString())); return; }
                    if (prepared && player != null) {
                        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { status = "paused"; break; }
                        startForeground(1, notification()); player.start(); status = "playing";
                    } else if (player != null) status = "loading";
                    break;
                case "seek":
                    if (prepared && player != null && Double.isFinite(value)) {
                        player.seekTo(Math.max(0, Math.min(player.getDuration(), (long)value)), MediaPlayer.SEEK_CLOSEST);
                        return;
                    }
                    break;
                case "next": case "previous":
                    advance(action.equals("previous") ? -1 : 1, false); return;
                case "stop":
                    clearSleepTimer();
                    generation++; prepared = false; playWhenReady = false; status = "idle";
                    cancelLoad();
                    if (player != null) { player.release(); player = null; }
                    audio.abandonAudioFocusRequest(focus); publish(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return;
            }
            publish(); updateNotification();
        } catch (Exception error) { fail("Playback could not continue. Try playing the track again."); }
    }
    void publish() {
        long position = 0, duration = track == null ? 0 : track.optLong("durationMs");
        try { if (prepared && player != null) { position = player.getCurrentPosition(); duration = player.getDuration(); } } catch (Exception ignored) {}
        int playbackState = status.equals("playing") ? PlaybackState.STATE_PLAYING : status.equals("loading") ? PlaybackState.STATE_BUFFERING : status.equals("error") ? PlaybackState.STATE_ERROR : PlaybackState.STATE_PAUSED;
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_STOP)
            .setState(playbackState, position, status.equals("playing") ? 1 : 0).build());
        if (track != null) session.setMetadata(new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, track.optString("title"))
            .putString(MediaMetadata.METADATA_KEY_ARTIST, track.optString("artist"))
            .putLong(MediaMetadata.METADATA_KEY_DURATION, duration).build());
        String output = "System default";
        try { AudioDeviceInfo route = player == null ? null : player.getRoutedDevice(); if (route != null) output = route.getProductName().toString(); } catch (Exception ignored) {}
        JSONObject state = Events.json("track", track == null ? JSONObject.NULL : track, "status", status, "positionMs", position, "durationMs", duration, "error", error,
            "queue", queue, "shuffle", shuffle, "repeat", repeat, "output", output, "sleepDeadline", sleepDeadline, "sleepEndOfSong", sleepTrackId != null, "equalizer", equalizerInfo);
        snapshotJson = state.toString();
        Events.send(this, "player", state);
    }
    private void fail(String message) {
        generation++; error = message; status = "error"; prepared = false; playWhenReady = false; resumeOnFocus = false;
        cancelLoad();
        if (equalizer != null) { equalizer.release(); equalizer = null; }
        if (player != null) { player.release(); player = null; }
        publish(); updateNotification(); audio.abandonAudioFocusRequest(focus); stopForeground(STOP_FOREGROUND_DETACH);
    }
    private PendingIntent action(String action) {
        return PendingIntent.getService(this, action.hashCode(), new Intent(this, PlaybackService.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean playing = status.equals("playing");
        return new Notification.Builder(this, "playback").setSmallIcon(R.drawable.ic_cine_notification).setContentTitle(track == null ? "Cine music" : track.optString("title"))
            .setContentText(track == null ? "Ready to play" : track.optString("artist"))
            .setContentIntent(open).setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true).setOngoing(playing)
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Previous", action("previous")).build())
            .addAction(new Notification.Action.Builder(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pause" : "Play", action(playing ? "pause" : "resume")).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "Next", action("next")).build()).build();
    }
    private void updateNotification() { ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1, notification()); }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        generation++; cancelLoad(); handler.removeCallbacksAndMessages(null); loader.shutdownNow();
        if (equalizer != null) equalizer.release(); if (player != null) player.release(); audio.abandonAudioFocusRequest(focus); session.release(); unregisterReceiver(noisy); instance = null; super.onDestroy();
    }
    private static class MemoryAudio extends MediaDataSource {
        private byte[] bytes;
        MemoryAudio(byte[] bytes) { this.bytes = bytes; }
        @Override public synchronized int readAt(long position, byte[] buffer, int offset, int size) {
            if (bytes == null || position >= bytes.length) return -1;
            if (position < 0) return -1;
            int count = Math.min(size, bytes.length - (int)position); System.arraycopy(bytes, (int)position, buffer, offset, count); return count;
        }
        @Override public synchronized long getSize() { return bytes == null ? 0 : bytes.length; }
        @Override public synchronized void close() { if (bytes != null) Arrays.fill(bytes, (byte)0); bytes = null; }
    }
}

package com.heisbaed.cinemusic;

import android.app.*;
import android.content.*;
import android.graphics.BitmapFactory;
import android.graphics.Bitmap;
import android.graphics.Color;
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
    private AudioDeviceCallback audioDeviceCallback;
    private boolean resumeAfterBluetoothDisconnect;
    private long lastRoutePauseAt;
    private CinePlayer player;
    private long loadStartedAt;
    private long sourceResolvedMs;
    private long preparedMs;
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
    private int recoveryAttempts;
    private boolean tv;
    private long lastTvPosition;
    private Runnable tvRetry;
    private Runnable tvStall;
    private Bitmap artwork;
    private String artworkAddress = "";
    private String metadataKey = "";
    private long lastWidgetUpdate;
    private String lastWidgetState = "";
    private float crossfadeDuration = 0; // in seconds, 0 = disabled
    private boolean crossfadeEnabled = false;
    private boolean gaplessEnabled = true;
    private String audioQuality = "auto";
    private CinePlayer preloadPlayer;
    private JSONObject preloadTrack;
    private boolean preloadReady;
    private boolean preloadTried;
    private int preloadEpoch;
    private Future<?> preloadTask;
    private final AtomicReference<HttpURLConnection> preloadResolvingConnection = new AtomicReference<>();
    private long preloadStartedAt;
    private long preloadSourceResolvedMs;
    private long preloadPreparedMs;
    private MemoryAudio preloadMemory;
    private CinePlayer fadingOut;
    private Runnable crossfadeRunnable;

    private void setCrossfade(boolean enabled, float durationSeconds) {
        crossfadeEnabled = enabled;
        crossfadeDuration = Math.max(0, Math.min(12, durationSeconds));
        if (!enabled) cancelCrossfade();
        cancelPreload();
        preloadTried = false;
        publish();
    }
    private void setGapless(boolean enabled) {
        gaplessEnabled = enabled;
        cancelPreload();
        preloadTried = false;
        publish();
    }
    private void setAudioQuality(String quality) {
        audioQuality = normalizeQuality(quality);
        cancelPreload();
        preloadTried = false;
        publish();
    }
    private static String normalizeQuality(String quality) {
        return "low".equals(quality) || "normal".equals(quality) || "high".equals(quality) ? quality : "auto";
    }
    private boolean prepared;
    private boolean playWhenReady;
    private boolean resumeOnFocus;
    private volatile int generation;
    private JSONArray queue = new JSONArray();
    private boolean shuffle;
    private String repeat = "off";
    private final java.util.Set<String> shufflePlayed = new java.util.HashSet<>();
    private long sleepDeadline;
    private long sleepAtElapsed;
    private String sleepTrackId;
    private Runnable sleepFade;
    private static final long SLEEP_FADE_MS = 3000;
    private final Runnable sleep = () -> {
        clearSleepTimer();
        beginSleepFade();
    };
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            boolean bluetooth = isBluetoothOutput();
            if (isAudible()) {
                command("pause", 0);
                lastRoutePauseAt = SystemClock.elapsedRealtime();
                resumeAfterBluetoothDisconnect = bluetooth;
            }
        }
    };
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (sleepAtElapsed > 0 && SystemClock.elapsedRealtime() >= sleepAtElapsed) sleep.run();
            else if (prepared) { maybePreloadNext(); maybeStartCrossfade(); publish(); }
            handler.postDelayed(this, 750);
        }
    };

    @Override public void onCreate() {
        super.onCreate(); instance = this;
        UiModeManager mode = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        tv = getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_LEANBACK)
            || (mode != null && mode.getCurrentModeType() == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION);
        android.content.SharedPreferences audioPreferences = getSharedPreferences("cine_audio", MODE_PRIVATE);
        equalizerEnabled = audioPreferences.getBoolean("eq_enabled", false);
        try { JSONArray storedBands = new JSONArray(audioPreferences.getString("eq_bands", "[0,0,0,0,0]")); for (int i = 0; i < 5 && i < storedBands.length(); i++) equalizerBands[i] = Math.max(-12, Math.min(12, storedBands.getInt(i))); } catch (Exception ignored) {}
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(attributes)
            .setOnAudioFocusChangeListener(change -> {
                if (change == AudioManager.AUDIOFOCUS_LOSS) { 
                    resumeOnFocus = false; 
                    command("pause", 0); 
                }
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
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setSessionActivity(PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).putExtra("openPlayer", true), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notifications.createNotificationChannel(new NotificationChannel("playback", "Music playback", NotificationManager.IMPORTANCE_LOW));
        IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, filter, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(noisy, filter);
        
        audioDeviceCallback = new AudioDeviceCallback() {
            @Override public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                if (!containsBluetoothOutput(addedDevices) || !resumeAfterBluetoothDisconnect) return;
                handler.postDelayed(() -> {
                    if (!resumeAfterBluetoothDisconnect || !prepared || track == null || isPlaying()) return;
                    resumeAfterBluetoothDisconnect = false;
                    command("resume", 0);
                }, 500);
            }

            @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                if (!containsBluetoothOutput(removedDevices)) return;
                boolean recentRoutePause = lastRoutePauseAt > 0 && SystemClock.elapsedRealtime() - lastRoutePauseAt < 2000;
                if (!isAudible() && !recentRoutePause) return;
                command("pause", 0);
                resumeAfterBluetoothDisconnect = true;
            }
        };
        audio.registerAudioDeviceCallback(audioDeviceCallback, handler);
        
        handler.post(tick);
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { 
            // Don't stop service - keep playing in background
            return START_STICKY; 
        }
        if ("play".equals(intent.getAction())) {
            startForeground(1, notification());
            try {
                JSONObject data = new JSONObject(intent.getStringExtra("track"));
                recoveryAttempts = 0;
                if (data.has("quality")) setAudioQuality(data.optString("quality", "auto"));
                if (data.has("gapless")) setGapless(data.optBoolean("gapless", true));
                if (data.has("crossfadeSeconds")) setCrossfade(data.optDouble("crossfadeSeconds", 0) > 0, (float)data.optDouble("crossfadeSeconds", 0));
                if (data.has("queue")) setQueue(data.optJSONArray("queue"), data.optBoolean("shuffle"), data.optString("repeat", "off"));
                data.remove("queue"); data.remove("shuffle"); data.remove("repeat"); data.remove("quality"); data.remove("gapless"); data.remove("crossfadeSeconds");
                load(data);
            }
            catch (Exception error) { fail("Could not load this track"); }
        } else if ("resume".equals(intent.getAction())) {
            command("resume", 0);
        } else if ("pause".equals(intent.getAction())) {
            command("pause", 0);
        } else if ("stop".equals(intent.getAction())) {
            command("stop", 0);
        } else {
            command(intent.getAction(), intent.getLongExtra("position", 0));
        }
        return START_STICKY;
    }
    private void load(JSONObject next) throws Exception {
        cancelTvRecovery();
        if (track == null || !track.optString("id").equals(next.optString("id")) || (tv && !next.optBoolean("tvRetry"))) recoveryAttempts = 0;
        next.remove("tvRetry");
        cancelSleepFade();
        cancelCrossfade();
        cancelPreload();
        preloadTried = false;
        resumeAfterBluetoothDisconnect = false; lastRoutePauseAt = 0;
        if (sleepTrackId != null && !sleepTrackId.equals(next.optString("id"))) clearSleepTimer();
        track = next; error = ""; status = "loading"; prepared = false; playWhenReady = true; generation++;
        final long resumePosition = Math.max(0, next.optLong("startPositionMs"));
        if (tv) lastTvPosition = resumePosition;
        next.remove("startPositionMs");
        loadArtwork(next);
        loadStartedAt = SystemClock.elapsedRealtime(); sourceResolvedMs = 0; preparedMs = 0;
        cancelLoad();
        final int epoch = generation;
        releaseEqualizer();
        if (player != null) { player.release(); player = null; }
        CinePlayer media = new CinePlayer(); player = media;
        media.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
        media.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
        media.setOnPreparedListener(value -> {
            if (epoch != generation) return;
            preparedMs = SystemClock.elapsedRealtime() - loadStartedAt;
            prepared = true; status = "paused";
            if (tvStall != null) handler.removeCallbacks(tvStall);
            if (resumePosition > 0) media.seekTo(Math.min(resumePosition, Math.max(0, media.getDuration() - 1000)), MediaPlayer.SEEK_CLOSEST);
            applyEqualizer();
            if (playWhenReady) command("resume", 0); else { publish(); updateNotification(); }
        });
        bindActiveCallbacks(media, epoch);
        if (tv) watchTvBuffer(epoch, 22_000);
        publish(); updateNotification();
        if (!tv && new OfflineVault(this).contains(next.getString("id"))) {
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
                    if (url.isEmpty()) url = StreamResolver.resolve(next.getString("id"), tv && recoveryAttempts > 0 ? "low" : audioQuality, () -> epoch != generation || Thread.currentThread().isInterrupted(), connection -> {
                        resolvingConnection.set(connection);
                        if (epoch != generation || Thread.currentThread().isInterrupted()) {
                            if (resolvingConnection.compareAndSet(connection, null)) connection.disconnect();
                        }
                    });
                    if (!MainActivity.allowedNetworkUrl(url) || !new java.net.URL(url).getHost().endsWith(".googlevideo.com")) throw new IOException("Unsupported audio address");
                    final String resolved = url;
                    handler.post(() -> {
                        if (epoch != generation) return;
                        sourceResolvedMs = SystemClock.elapsedRealtime() - loadStartedAt;
                        try {
                            Map<String, String> headers = new HashMap<>(); headers.put("User-Agent", "Mozilla/5.0"); headers.put("Referer", "https://music.youtube.com/");
                            media.setDataSource(this, android.net.Uri.parse(resolved), headers); media.prepareAsync();
                        } catch (Exception error) { if (tv) recoverStream(); else fail("Could not open this song. Please try again."); }
                    });
                } catch (Exception error) { handler.post(() -> { if (epoch == generation) { if (tv) recoverStream(); else fail(error.getMessage() == null ? "This song is unavailable" : error.getMessage()); } }); }
                finally { HttpURLConnection connection = resolvingConnection.getAndSet(null); if (connection != null) connection.disconnect(); }
            });
        }
    }
    private void bindActiveCallbacks(CinePlayer media, int epoch) {
        media.setOnCompletionListener(value -> { if (epoch == generation) completeCurrent(); });
        media.setOnSeekCompleteListener(value -> { if (epoch == generation) publish(); });
        media.addOnRoutingChangedListener(router -> { if (epoch == generation) publish(); }, handler);
        media.setOnErrorListener((value, what, extra) -> { if (epoch == generation) recoverStream(); return true; });
        media.setOnInfoListener((value, what, extra) -> {
            if (epoch != generation) return false;
            if (what == MediaPlayer.MEDIA_INFO_BUFFERING_START) { status = playWhenReady ? "loading" : "paused"; if (tv && playWhenReady) watchTvBuffer(epoch, 14_000); publish(); }
            if (what == MediaPlayer.MEDIA_INFO_BUFFERING_END) { if (tvStall != null) handler.removeCallbacks(tvStall); status = isPlaying() ? "playing" : "paused"; publish(); }
            return false;
        });
    }
    private void completeCurrent() {
        if (sleepTrackId != null || (sleepDeadline > 0 && sleepDeadline != Long.MAX_VALUE && SystemClock.elapsedRealtime() >= sleepAtElapsed)) {
            clearSleepTimer();
            status = "paused"; playWhenReady = false; publish(); updateNotification();
            return;
        }
        if (preloadReady && preloadPlayer != null && preloadTrack != null) { transitionToPreloaded(); return; }
        status = "ended"; playWhenReady = false; publish(); updateNotification();
        advance(1, true);
    }
    private void maybePreloadNext() {
        if (preloadPlayer != null || preloadTried || !prepared || player == null || track == null || !isPlaying()) return;
        boolean crossfade = crossfadeEnabled && crossfadeDuration > 0;
        if (!gaplessEnabled && !crossfade) return;
        if (sleepTrackId != null) return;
        long duration = 0, position = 0;
        try { duration = player.getDuration(); position = player.getCurrentPosition(); } catch (Exception ignored) {}
        if (duration > 0) {
            float window = crossfade ? Math.max(25f, crossfadeDuration + 10f) : 25f;
            if (duration - position > window * 1000f) return;
        }
        JSONObject candidate;
        try { candidate = nextTrack(1, true); } catch (Exception error) { candidate = null; }
        if (candidate == null) return;
        preloadTried = true;
        preload(candidate);
    }
    private void maybeStartCrossfade() {
        if (!crossfadeEnabled || crossfadeDuration <= 0 || !preloadReady || preloadPlayer == null || preloadTrack == null) return;
        if (!prepared || player == null || !isPlaying()) return;
        try {
            long duration = player.getDuration();
            long position = player.getCurrentPosition();
            if (duration <= 0 || duration - position > crossfadeDuration * 1000L) return;
            transitionToPreloaded();
        } catch (Exception ignored) {}
    }
    private void preload(JSONObject next) {
        final int epoch = ++preloadEpoch;
        preloadStartedAt = SystemClock.elapsedRealtime();
        preloadSourceResolvedMs = 0; preloadPreparedMs = 0; preloadReady = false;
        CinePlayer media = new CinePlayer();
        preloadPlayer = media; preloadTrack = next;
        media.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
        media.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
        media.setVolume(0, 0);
        media.setPlayWhenReady(false);
        media.setOnPreparedListener(value -> {
            if (epoch != preloadEpoch || preloadPlayer != media) return;
            preloadPreparedMs = SystemClock.elapsedRealtime() - preloadStartedAt;
            preloadReady = true;
        });
        media.setOnErrorListener((value, what, extra) -> { if (epoch == preloadEpoch && preloadPlayer == media) dropPreload(media); return true; });
        attachPreloadSource(media, next, epoch);
    }
    private void attachPreloadSource(CinePlayer media, JSONObject next, int epoch) {
        try {
            if (!tv && new OfflineVault(this).contains(next.getString("id"))) {
                next.put("offline", true);
                String id = next.getString("id");
                preloadTask = loader.submit(() -> {
                    try {
                        byte[] bytes = new OfflineVault(this).open(id);
                        handler.post(() -> {
                            if (epoch != preloadEpoch || preloadPlayer != media) { Arrays.fill(bytes, (byte)0); return; }
                            try {
                                MemoryAudio source = new MemoryAudio(bytes);
                                preloadMemory = source;
                                media.setDataSource(source); media.prepareAsync();
                            } catch (Exception error) { Arrays.fill(bytes, (byte)0); dropPreload(media); }
                        });
                    } catch (Exception error) { handler.post(() -> { if (epoch == preloadEpoch && preloadPlayer == media) dropPreload(media); }); }
                });
            } else {
                next.put("offline", false);
                preloadTask = loader.submit(() -> {
                    try {
                        String url = next.optString("url");
                        if (url.isEmpty()) url = StreamResolver.resolve(next.getString("id"), audioQuality, () -> epoch != preloadEpoch || Thread.currentThread().isInterrupted(), connection -> {
                            preloadResolvingConnection.set(connection);
                            if (epoch != preloadEpoch || Thread.currentThread().isInterrupted()) {
                                if (preloadResolvingConnection.compareAndSet(connection, null)) connection.disconnect();
                            }
                        });
                        if (!MainActivity.allowedNetworkUrl(url) || !new java.net.URL(url).getHost().endsWith(".googlevideo.com")) throw new IOException("Unsupported audio address");
                        final String resolved = url;
                        handler.post(() -> {
                            if (epoch != preloadEpoch || preloadPlayer != media) return;
                            preloadSourceResolvedMs = SystemClock.elapsedRealtime() - preloadStartedAt;
                            try {
                                Map<String, String> headers = new HashMap<>(); headers.put("User-Agent", "Mozilla/5.0"); headers.put("Referer", "https://music.youtube.com/");
                                media.setDataSource(this, android.net.Uri.parse(resolved), headers); media.prepareAsync();
                            } catch (Exception error) { dropPreload(media); }
                        });
                    } catch (Exception error) { handler.post(() -> { if (epoch == preloadEpoch && preloadPlayer == media) dropPreload(media); }); }
                    finally { HttpURLConnection connection = preloadResolvingConnection.getAndSet(null); if (connection != null) connection.disconnect(); }
                });
            }
        } catch (Exception error) { dropPreload(media); }
    }
    private void transitionToPreloaded() {
        cancelSleepFade();
        CinePlayer incoming = preloadPlayer;
        JSONObject incomingTrack = preloadTrack;
        long sourceResolved = preloadSourceResolvedMs, preparedTime = preloadPreparedMs;
        if (incoming == null || incomingTrack == null) { status = "ended"; playWhenReady = false; publish(); advance(1, true); return; }
        CinePlayer outgoing = player;
        boolean shouldPlay = playWhenReady;
        float fadeSeconds = crossfadeDuration;
        if (outgoing != null) {
            try {
                long remaining = outgoing.getDuration() - outgoing.getCurrentPosition();
                if (remaining >= 0) fadeSeconds = Math.min(fadeSeconds, remaining / 1000f);
            } catch (Exception ignored) {}
        }
        boolean crossfade = crossfadeEnabled && fadeSeconds >= 0.25f && shouldPlay && outgoing != null;
        preloadEpoch++;
        preloadPlayer = null; preloadTrack = null; preloadReady = false; preloadTask = null; preloadMemory = null;
        preloadTried = false;
        generation++;
        int epoch = generation;
        player = incoming; track = incomingTrack; prepared = true; playWhenReady = shouldPlay;
        recoveryAttempts = 0; loadArtwork(track);
        sourceResolvedMs = sourceResolved; preparedMs = preparedTime;
        loadStartedAt = SystemClock.elapsedRealtime() - Math.max(0, preparedTime);
        bindActiveCallbacks(incoming, epoch);
        releaseEqualizer();
        if (crossfade) {
            incoming.setVolume(0, 0);
            incoming.start();
            applyEqualizer();
            fadingOut = outgoing;
            startCrossfade(epoch, fadeSeconds);
        } else {
            incoming.setVolume(1, 1);
            if (shouldPlay) incoming.start();
            applyEqualizer();
            if (outgoing != null) outgoing.release();
        }
        status = shouldPlay ? "playing" : "paused";
        publish(); updateNotification(); startForeground(1, notification());
    }
    private void startCrossfade(int epoch, float seconds) {
        final CinePlayer incoming = player;
        final CinePlayer outgoing = fadingOut;
        final long duration = Math.max(250, (long)(seconds * 1000));
        final long started = SystemClock.elapsedRealtime();
        crossfadeRunnable = new Runnable() {
            @Override public void run() {
                if (epoch != generation || player != incoming || fadingOut != outgoing) return;
                float progress = Math.min(1f, (SystemClock.elapsedRealtime() - started) / (float)duration);
                incoming.setVolume(progress, progress);
                try { outgoing.setVolume(1 - progress, 1 - progress); } catch (Exception ignored) {}
                if (progress >= 1f) {
                    crossfadeRunnable = null; fadingOut = null;
                    incoming.setVolume(1, 1);
                    if (outgoing != null) outgoing.release();
                    return;
                }
                handler.postDelayed(this, 50);
            }
        };
        handler.post(crossfadeRunnable);
    }
    private void cancelCrossfade() {
        if (crossfadeRunnable != null) { handler.removeCallbacks(crossfadeRunnable); crossfadeRunnable = null; }
        if (fadingOut != null) { try { fadingOut.release(); } catch (Exception ignored) {} fadingOut = null; }
        if (prepared && player != null) player.setVolume(1, 1);
    }
    private void cancelPreload() {
        preloadEpoch++;
        if (preloadTask != null) { preloadTask.cancel(true); preloadTask = null; }
        HttpURLConnection connection = preloadResolvingConnection.getAndSet(null);
        if (connection != null) connection.disconnect();
        if (preloadPlayer != null) { try { preloadPlayer.release(); } catch (Exception ignored) {} preloadPlayer = null; }
        if (preloadMemory != null) { try { preloadMemory.close(); } catch (Exception ignored) {} preloadMemory = null; }
        preloadTrack = null; preloadReady = false;
    }
    private void dropPreload(CinePlayer expected) {
        if (expected != null && preloadPlayer != expected) return;
        if (preloadPlayer != null) { try { preloadPlayer.release(); } catch (Exception ignored) {} preloadPlayer = null; }
        if (preloadMemory != null) { try { preloadMemory.close(); } catch (Exception ignored) {} preloadMemory = null; }
        HttpURLConnection connection = preloadResolvingConnection.getAndSet(null);
        if (connection != null) connection.disconnect();
        preloadTask = null; preloadTrack = null; preloadReady = false;
    }
    private void cancelLoad() {
        if (loadTask != null) { loadTask.cancel(true); loadTask = null; }
        HttpURLConnection connection = resolvingConnection.getAndSet(null);
        if (connection != null) connection.disconnect();
    }
    void setQueue(JSONArray songs, boolean shuffle, String repeat) {
        if (track == null || songs == null || !songs.toString().contains(track.optString("id"))) shufflePlayed.clear();
        this.queue = songs == null ? new JSONArray() : songs;
        cancelPreload();
        preloadTried = false;
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
        cancelSleepFade();
        clearSleepTimer();
        if (Double.isFinite(minutes) && minutes > 0 && track != null) {
            if (endOfSong) {
                sleepTrackId = track.optString("id");
                sleepDeadline = Long.MAX_VALUE; // Special value: sleep at end of song
            } else {
                long delay = (long)(Math.min(minutes, 24 * 60) * 60_000);
                sleepDeadline = System.currentTimeMillis() + delay;
                sleepAtElapsed = SystemClock.elapsedRealtime() + delay;
                handler.postDelayed(sleep, delay);
            }
        }
        publish();
    }
    
    private void checkSleepTimer() {
        // Check if we should sleep at end of song
        if (sleepTrackId != null && track != null && !sleepTrackId.equals(track.optString("id"))) {
            // Track changed, clear the end-of-song timer
            sleepTrackId = null;
        }
        // Check time-based sleep timer
        if (sleepDeadline > 0 && sleepDeadline != Long.MAX_VALUE && System.currentTimeMillis() >= sleepDeadline) {
            clearSleepTimer();
            command("pause", 0);
        }
    }
    
    private void clearSleepTimer() {
        handler.removeCallbacks(sleep); sleepDeadline = 0; sleepAtElapsed = 0; sleepTrackId = null;
    }
    private void beginSleepFade() {
        cancelCrossfade();
        publish();
        if (!prepared || player == null) { command("pause", 0); return; }
        cancelSleepFade();
        final int epoch = generation;
        final long started = SystemClock.elapsedRealtime();
        sleepFade = new Runnable() {
            @Override public void run() {
                if (epoch != generation || !prepared || player == null) { sleepFade = null; return; }
                float progress = Math.min(1f, (SystemClock.elapsedRealtime() - started) / (float)SLEEP_FADE_MS);
                float volume = Math.max(0f, 1f - progress);
                player.setVolume(volume, volume);
                if (progress >= 1f) {
                    sleepFade = null;
                    command("pause", 0);
                    if (prepared && player != null) player.setVolume(1, 1);
                } else handler.postDelayed(this, 100);
            }
        };
        handler.post(sleepFade);
    }
    private void cancelSleepFade() {
        if (sleepFade != null) { handler.removeCallbacks(sleepFade); sleepFade = null; }
        if (prepared && player != null) player.setVolume(1, 1);
    }
    boolean configureEqualizer(boolean enabled, int[] bands) {
        equalizerEnabled = enabled;
        if (bands != null && bands.length == 5) equalizerBands = bands.clone();
        boolean applied = !prepared || applyEqualizer();
        publish();
        return applied;
    }
    private void releaseEqualizer() {
        if (equalizer != null) { try { equalizer.release(); } catch (Exception ignored) {} equalizer = null; }
    }
    private boolean applyEqualizer() {
        try {
            releaseEqualizer();
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
    private JSONObject nextTrack(int direction, boolean ended) throws Exception {
        if (track == null) return null;
        if (ended && "one".equals(repeat)) return new JSONObject(track.toString());
        if (queue.length() == 0) return null;
        int current = -1; for (int i = 0; i < queue.length(); i++) if (queue.getJSONObject(i).optString("id").equals(track.optString("id"))) { current = i; break; }
        int next = current + direction;
        if (shuffle && direction > 0 && queue.length() > 1) {
            shufflePlayed.add(track.optString("id"));
            java.util.List<Integer> choices = new java.util.ArrayList<>();
            for (int i=0;i<queue.length();i++) if (!shufflePlayed.contains(queue.getJSONObject(i).optString("id"))) choices.add(i);
            next = choices.isEmpty() ? queue.length() : choices.get(new Random().nextInt(choices.size()));
            if (choices.isEmpty() && "all".equals(repeat)) shufflePlayed.clear();
        }
        if (next < 0 || next >= queue.length()) {
            if ("all".equals(repeat)) next = direction > 0 ? 0 : queue.length() - 1;
            else return null;
        }
        return new JSONObject(queue.getJSONObject(next).toString());
    }
    private void advance(int direction, boolean ended) {
        if (track == null) return;
        try {
            if (direction < 0 && prepared && player.getCurrentPosition() > PREVIOUS_RESTART_MS) { command("seek", 0); return; }
            JSONObject next = nextTrack(direction, ended);
            if (next == null) { if (direction < 0 && prepared) command("seek", 0); else publish(); return; }
            load(next);
        } catch (Exception error) { fail("The next song could not be played."); }
    }
    private boolean isPlaying() { try { return prepared && player != null && player.isPlaying(); } catch (Exception ignored) { return false; } }
    private boolean isAudible() { return isPlaying() || playWhenReady || "playing".equals(status) || "loading".equals(status); }
    private boolean isBluetoothOutput() {
        try { AudioDeviceInfo route = player == null ? null : player.getRoutedDevice(); return route != null && isBluetoothDevice(route.getType()); }
        catch (Exception ignored) { return false; }
    }
    private static boolean containsBluetoothOutput(AudioDeviceInfo[] devices) {
        if (devices == null) return false;
        for (AudioDeviceInfo device : devices) if (device != null && isBluetoothDevice(device.getType())) return true;
        return false;
    }
    private static boolean isBluetoothDevice(int type) {
        return type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
            || (Build.VERSION.SDK_INT >= 31 && (type == AudioDeviceInfo.TYPE_BLE_HEADSET || type == AudioDeviceInfo.TYPE_BLE_SPEAKER));
    }
    void command(String action, double value) {
        if (action == null) return;
        try {
            switch (action) {
                case "pause":
                    cancelSleepFade(); cancelCrossfade(); resumeOnFocus = false; resumeAfterBluetoothDisconnect = false; lastRoutePauseAt = 0; playWhenReady = false;
                    if (prepared && player != null) player.pause();
                    status = "paused"; publish(); updateNotification(); audio.abandonAudioFocusRequest(focus); break;
                case "resume":
                    cancelSleepFade(); playWhenReady = true;
                    if (!prepared && player == null && track != null) { recoveryAttempts = 0; load(new JSONObject(track.toString())); return; }
                    if (prepared && player != null) {
                        if (audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { status = "paused"; break; }
                        player.start(); status = "playing"; publish(); startForeground(1, notification());
                    } else if (player != null) status = "loading";
                    break;
                case "seek":
                    if (prepared && player != null && Double.isFinite(value)) {
                        player.seekTo(Math.max(0, Math.min(player.getDuration(), (long)value)), MediaPlayer.SEEK_CLOSEST);
                        return;
                    }
                    break;
                case "setcrossfade":
                    setCrossfade(value > 0, (float)value);
                    break;
                case "setgapless":
                    setGapless(value > 0);
                    break;
                case "setquality":
                    setAudioQuality(value >= 3 ? "high" : value >= 2 ? "normal" : value >= 1 ? "low" : "auto");
                    break;
                case "next": case "previous":
                    advance(action.equals("previous") ? -1 : 1, false); return;
                case "stop":
                    cancelSleepFade(); cancelCrossfade(); cancelPreload();
                    clearSleepTimer();
                    resumeAfterBluetoothDisconnect = false; lastRoutePauseAt = 0;
                    generation++; prepared = false; playWhenReady = false; status = "idle";
                    cancelLoad();
                    if (player != null) { player.release(); player = null; }
                    audio.abandonAudioFocusRequest(focus); publish();
                    stopForeground(STOP_FOREGROUND_REMOVE); stopSelf();
                    return;
            }
        } catch (Exception error) { fail("Playback could not continue. Try playing the track again."); }
    }
    void publish() {
        long position = tv ? lastTvPosition : 0, duration = track == null ? 0 : track.optLong("durationMs");
        try {
            if (prepared && player != null) {
                position = player.getCurrentPosition(); duration = player.getDuration();
                if (tv && position > 0) lastTvPosition = position;
            }
        } catch (Exception ignored) {}
        int playbackState = status.equals("playing") ? PlaybackState.STATE_PLAYING : status.equals("loading") ? PlaybackState.STATE_BUFFERING : status.equals("error") ? PlaybackState.STATE_ERROR : PlaybackState.STATE_PAUSED;
        session.setPlaybackState(new PlaybackState.Builder().setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_STOP)
            .setState(playbackState, position, status.equals("playing") ? 1 : 0).build());
        String nextMetadataKey = track == null ? "" : track.toString() + ":" + duration + ":" + (artwork == null ? 0 : artwork.hashCode());
        if (track != null && !nextMetadataKey.equals(metadataKey)) {
            metadataKey = nextMetadataKey;
            MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, track.optString("title"))
            .putString(MediaMetadata.METADATA_KEY_ARTIST, track.optString("artist"))
            .putString(MediaMetadata.METADATA_KEY_ALBUM, "Cine music")
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, track.optString("title"))
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, track.optString("artist"))
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION, "Cine music")
            .putLong(MediaMetadata.METADATA_KEY_DURATION, duration);
            if (artwork != null) metadata.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artwork).putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, artwork);
            session.setMetadata(metadata.build());
        }
        String output = "System default";
        try { AudioDeviceInfo route = player == null ? null : player.getRoutedDevice(); if (route != null) output = route.getProductName().toString(); } catch (Exception ignored) {}
        JSONObject state = Events.json("track", track == null ? JSONObject.NULL : track, "status", status, "positionMs", position, "durationMs", duration, "error", error,
            "queue", queue, "shuffle", shuffle, "repeat", repeat, "output", output, "sleepDeadline", sleepDeadline, "sleepEndOfSong", sleepTrackId != null, "equalizer", equalizerInfo,
            "sourceResolvedMs", sourceResolvedMs, "preparedMs", preparedMs);
        snapshotJson = state.toString();
        Events.send(this, "player", state);
        String widgetState = (track == null ? "" : track.optString("id")) + status;
        if (!tv && (!widgetState.equals(lastWidgetState) || SystemClock.elapsedRealtime() - lastWidgetUpdate >= 1000)) {
            lastWidgetState = widgetState; lastWidgetUpdate = SystemClock.elapsedRealtime(); MusicWidgetProvider.updateAll(this);
        }
    }
    private void loadArtwork(JSONObject next) {
        String address = next.optString("cover");
        if (address.equals(artworkAddress)) return;
        artworkAddress = address; artwork = MediaArtwork.cached(address); metadataKey = "";
        MediaArtwork.load(address, image -> {
            if (instance != this || !address.equals(artworkAddress)) return;
            artwork = image; metadataKey = ""; lastWidgetUpdate = 0; publish(); updateNotification();
        });
    }
    private void watchTvBuffer(int epoch, long timeout) {
        if (tvStall != null) handler.removeCallbacks(tvStall);
        tvStall = () -> { if (epoch == generation && "loading".equals(status) && playWhenReady) recoverStream(); };
        handler.postDelayed(tvStall, timeout);
    }
    private void cancelTvRecovery() {
        if (tvRetry != null) handler.removeCallbacks(tvRetry);
        if (tvStall != null) handler.removeCallbacks(tvStall);
        tvRetry = null; tvStall = null;
    }
    private void recoverStream() {
        if (tv) {
            if (tvRetry != null) return;
            if (track == null || recoveryAttempts >= 3) {
                fail("Playback lost its connection. Reconnect to Wi-Fi and choose Retry.");
                return;
            }
            recoveryAttempts++;
            final JSONObject retry;
            try {
                retry = new JSONObject(track.toString());
                retry.remove("url"); retry.put("startPositionMs", lastTvPosition); retry.put("tvRetry", true);
            } catch (Exception badTrack) { fail("This song could not be reopened."); return; }
            final int epoch = ++generation;
            final boolean shouldPlay = playWhenReady;
            cancelTvRecovery(); cancelLoad(); releaseEqualizer();
            if (player != null) { player.release(); player = null; }
            prepared = false; status = "loading"; publish(); updateNotification();
            tvRetry = () -> {
                tvRetry = null;
                if (epoch != generation || track == null) return;
                StreamResolver.invalidate(retry.optString("id"));
                try { boolean resume = shouldPlay && playWhenReady; load(retry); playWhenReady = resume; }
                catch (Exception error) { fail("This song could not be reopened."); }
            };
            handler.postDelayed(tvRetry, 1500L << (recoveryAttempts - 1));
            return;
        }
        if (track != null && !track.optBoolean("offline") && recoveryAttempts++ < 1) {
            try {
                long position = prepared && player != null ? player.getCurrentPosition() : 0;
                boolean shouldPlay = playWhenReady;
                JSONObject retry = new JSONObject(track.toString()); retry.remove("url"); retry.put("startPositionMs", position);
                StreamResolver.invalidate(retry.optString("id"));
                load(retry); playWhenReady = shouldPlay;
                return;
            } catch (Exception ignored) {}
        }
        fail("Playback failed. Check your connection and tap Play to retry, or choose a completed download.");
    }
    private void fail(String message) {
        cancelTvRecovery();
        if (track != null) StreamResolver.invalidate(track.optString("id"));
        cancelSleepFade(); cancelCrossfade(); cancelPreload();
        generation++; error = message; status = "error"; prepared = false; playWhenReady = false; resumeOnFocus = false; resumeAfterBluetoothDisconnect = false; lastRoutePauseAt = 0;
        cancelLoad();
        releaseEqualizer();
        if (player != null) { player.release(); player = null; }
        publish(); updateNotification(); audio.abandonAudioFocusRequest(focus); stopForeground(STOP_FOREGROUND_DETACH);
    }
    private PendingIntent action(String action) {
        return PendingIntent.getService(this, action.hashCode(), new Intent(this, PlaybackService.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private Notification notification() {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).putExtra("openPlayer", true), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean playing = status.equals("playing") || status.equals("loading");
        Notification.Builder builder = new Notification.Builder(this, "playback")
            .setSmallIcon(R.drawable.ic_cine_notification)
            .setContentTitle(track == null ? "Cine music" : "Cine music · " + track.optString("title"))
            .setContentText(track == null ? "Ready to play" : track.optString("artist"))
            .setSubText("Cine music")
            .setContentIntent(open)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(playing)
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_previous, "Previous", action("previous")).build())
            .addAction(new Notification.Action.Builder(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pause" : "Play", action(playing ? "pause" : "resume")).build())
            .addAction(new Notification.Action.Builder(android.R.drawable.ic_media_next, "Next", action("next")).build());
        
        // Add large icon (album art) if available
        if (artwork != null) builder.setLargeIcon(artwork);
        
        // Add color styling based on album art (would extract dominant color)
        builder.setColor(Color.parseColor("#B7C5FF"));
        
        return builder.build();
    }
    private void updateNotification() { ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1, notification()); }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        cancelTvRecovery();
        generation++; cancelLoad(); cancelSleepFade(); cancelCrossfade(); cancelPreload(); handler.removeCallbacksAndMessages(null); loader.shutdownNow();
        releaseEqualizer(); if (player != null) player.release(); audio.abandonAudioFocusRequest(focus); session.release();
        if (audioDeviceCallback != null) audio.unregisterAudioDeviceCallback(audioDeviceCallback);
        unregisterReceiver(noisy); instance = null; MusicWidgetProvider.updateAll(this); super.onDestroy();
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

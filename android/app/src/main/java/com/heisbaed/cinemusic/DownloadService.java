package com.heisbaed.cinemusic;

import android.app.*;
import android.content.*;
import android.net.*;
import android.os.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class DownloadService extends Service {
    static volatile DownloadService instance;
    private static final Map<String, Job> JOBS = new LinkedHashMap<>();
    private static boolean loaded;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean closed;
    private int lastStartId;
    private int inFlight;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ConnectivityManager connectivity;
    private final ConnectivityManager.NetworkCallback networks = new ConnectivityManager.NetworkCallback() {
        @Override public void onLost(Network network) { handler.post(() -> enforceWifi()); }
        @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) { handler.post(() -> enforceWifi()); }
    };
    private static final class Job {
        final String id;
        final JSONObject track;
        final String sourceUrl;
        String status = "queued", error = "";
        int progress;
        long bytes, totalBytes, lastProgress;
        volatile boolean stopped;
        volatile HttpURLConnection connection;
        Job(JSONObject source) throws Exception {
            id = source.getString("id"); sourceUrl = source.optString("url");
            track = new JSONObject(source.toString()); track.remove("url"); track.remove("queue");
        }
        JSONObject snapshot() {
            return Events.json("id", id, "track", track, "status", status, "progress", progress, "bytes", bytes,
                "totalBytes", totalBytes, "error", error, "restartOnResume", true);
        }
    }
    private static synchronized void loadJobs(Context context) {
        if (loaded) return;
        loaded = true;
        new OfflineVault(context).cleanPartials();
        try {
            JSONArray saved = new JSONArray(context.getSharedPreferences("cine_downloads", MODE_PRIVATE).getString("jobs", "[]"));
            for (int i = 0; i < saved.length(); i++) {
                JSONObject data = saved.getJSONObject(i); Job job = new Job(data.getJSONObject("track"));
                String state = data.optString("status");
                if ("completed".equals(state)) continue;
                job.status = "failed".equals(state) ? "failed" : "paused";
                job.error = data.optString("error");
                if ("queued".equals(state) || "downloading".equals(state)) job.error = "Download was interrupted. Resume to restart it.";
                job.totalBytes = data.optLong("totalBytes"); JOBS.put(job.id, job);
            }
        } catch (Exception ignored) {}
    }
    private static synchronized void persist(Context context) {
        JSONArray saved = new JSONArray(); for (Job job : JOBS.values()) if (!"completed".equals(job.status)) saved.put(job.snapshot());
        context.getSharedPreferences("cine_downloads", MODE_PRIVATE).edit().putString("jobs", saved.toString()).apply();
    }
    static synchronized JSONArray jobs(Context context) {
        loadJobs(context);
        JSONArray saved = new OfflineVault(context).list();
        for (int i = 0; i < saved.length(); i++) {
            try {
                JSONObject track = saved.getJSONObject(i); String id = track.getString("id");
                if (!JOBS.containsKey(id)) {
                    Job job = new Job(track); job.status = "completed"; job.progress = 100;
                    job.bytes = job.totalBytes = track.optLong("downloadBytes"); JOBS.put(id, job);
                }
            } catch (Exception ignored) {}
        }
        JSONArray result = new JSONArray(); for (Job job : JOBS.values()) result.put(job.snapshot()); return result;
    }
    private static void publishJobs(Context context) { Events.send(context, "downloadJobs", Events.json("items", jobs(context))); }
    private static void publishJob(Context context, Job job) {
        JSONObject state;
        synchronized (DownloadService.class) { if (JOBS.get(job.id) != job) return; state = job.snapshot(); }
        Events.send(context, "downloadProgress", state); publishJobs(context);
    }
    static boolean isWifiConnected(Context context) {
        try {
            ConnectivityManager manager = (ConnectivityManager)context.getSystemService(CONNECTIVITY_SERVICE);
            Network network = manager == null ? null : manager.getActiveNetwork();
            NetworkCapabilities capabilities = network == null ? null : manager.getNetworkCapabilities(network);
            return capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
        } catch (Exception ignored) { return false; }
    }
    private static boolean wifiOnly(Context context) { return context.getSharedPreferences("cine_downloads", MODE_PRIVATE).getBoolean("wifi_only", true); }
    static void cancel(Context context, String id, boolean pause) { cancel(context, id, pause, ""); }
    private static void cancel(Context context, String id, boolean pause, String reason) {
        Job job;
        synchronized (DownloadService.class) {
            loadJobs(context); job = JOBS.get(id);
            if (job == null || "completed".equals(job.status)) return;
            job.stopped = true;
            if (pause) { job.status = "paused"; job.progress = 0; job.bytes = 0; job.error = reason; }
            else JOBS.remove(id);
            persist(context);
        }
        if (job.connection != null) job.connection.disconnect();
        if (pause) publishJob(context, job); else { Events.send(context, "downloadCancelled", Events.json("id", id)); publishJobs(context); }
    }
    static synchronized String resumableTrack(Context context, String id) {
        loadJobs(context); Job job = JOBS.get(id);
        return job != null && ("paused".equals(job.status) || "failed".equals(job.status)) ? job.track.toString() : null;
    }
    static synchronized void forget(Context context, String id) { loadJobs(context); JOBS.remove(id); persist(context); }
    void enforceWifi() {
        if (closed || !wifiOnly(this) || isWifiConnected(this)) return;
        List<String> ids = new ArrayList<>();
        synchronized (DownloadService.class) { for (Job job : JOBS.values()) if ("queued".equals(job.status) || "downloading".equals(job.status)) ids.add(job.id); }
        for (String id : ids) cancel(this, id, true, "Wi-Fi-only downloads are enabled. Connect to Wi-Fi and resume.");
    }
    @Override public void onCreate() {
        super.onCreate(); instance = this; loadJobs(this);
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("downloads", "Offline downloads", NotificationManager.IMPORTANCE_LOW));
        connectivity = (ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        try { if (connectivity != null) connectivity.registerDefaultNetworkCallback(networks); } catch (Exception ignored) {}
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        lastStartId = startId;
        startForeground(2, notification("Preparing your download", 0));
        try {
            JSONObject track = new JSONObject(intent.getStringExtra("track")); String id = track.getString("id");
            Job job;
            synchronized (DownloadService.class) {
                jobs(this); Job existing = JOBS.get(id);
                if (existing != null && !"failed".equals(existing.status) && (!intent.getBooleanExtra("resume", false) || !"paused".equals(existing.status))) {
                    publishJob(this, existing); finishIfIdle(); return START_NOT_STICKY;
                }
                job = new Job(track); JOBS.put(id, job); persist(this);
            }
            if (wifiOnly(this) && !isWifiConnected(this)) { cancel(this, id, true, "Wi-Fi-only downloads are enabled. Connect to Wi-Fi and resume."); finishIfIdle(); return START_NOT_STICKY; }
            publishJob(this, job); inFlight++;
            worker.execute(() -> download(job));
        } catch (Exception error) { finishIfIdle(); }
        return START_NOT_STICKY;
    }
    private void download(Job job) {
        OfflineVault vault = new OfflineVault(this);
        try {
            if (closed || job.stopped) return;
            if (wifiOnly(this) && !isWifiConnected(this)) { cancel(this, job.id, true, "Connect to Wi-Fi and resume."); return; }
            String url = job.sourceUrl;
            if (url.isEmpty()) url = StreamResolver.resolve(job.id, () -> closed || job.stopped, connection -> job.connection = connection);
            if (closed || job.stopped) return;
            if (wifiOnly(this) && !isWifiConnected(this)) { cancel(this, job.id, true, "Connect to Wi-Fi and resume."); return; }
            if (!new URL(url).getHost().endsWith(".googlevideo.com")) throw new IOException("Unsupported audio address");
            JSONObject track = new JSONObject(job.track.toString()); track.put("offline", true);
            try (AudioDownloadStream input = new AudioDownloadStream(url, () -> closed || job.stopped, connection -> job.connection = connection)) {
                long total = input.length();
                synchronized (DownloadService.class) { if (job.stopped) return; job.status = "downloading"; job.totalBytes = total; job.progress = 0; persist(this); }
                publishJob(this, job);
                vault.store(track, input, total, (read, length) -> {
                    if (closed || job.stopped) throw new InterruptedIOException("Download stopped");
                    long now = SystemClock.elapsedRealtime();
                    synchronized (DownloadService.class) {
                        if (job.stopped) throw new InterruptedIOException("Download stopped");
                        job.bytes = read;
                        if (now - job.lastProgress < 500) return;
                        job.lastProgress = now; job.progress = length > 0 ? (int)Math.min(99, read * 100 / length) : -1;
                    }
                    if (wifiOnly(this) && !isWifiConnected(this)) { cancel(this, job.id, true, "Connect to Wi-Fi and resume."); throw new InterruptedIOException("Wi-Fi disconnected"); }
                    publishJob(this, job);
                    ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(2, notification(track.optString("title"), job.progress));
                }, DownloadService.class, () -> {
                    job.status = "completed"; job.progress = 100; job.bytes = job.totalBytes = track.optLong("downloadBytes"); persist(this);
                });
            }
            Events.send(this, "downloads", Events.json("items", vault.list())); publishJob(this, job);
        } catch (Exception error) {
            synchronized (DownloadService.class) {
                if (closed || job.stopped) return;
                StreamResolver.invalidate(job.id);
                job.status = "failed"; job.bytes = 0; job.progress = 0;
                job.error = error.getMessage() == null ? "Download failed. Please retry." : error.getMessage(); persist(this);
            }
            publishJob(this, job); Events.send(this, "downloadError", Events.json("id", job.id, "message", job.error));
        } finally {
            if (job.connection != null) job.connection.disconnect(); job.connection = null;
            handler.post(() -> { inFlight--; finishIfIdle(); });
        }
    }
    private void finishIfIdle() { if (inFlight <= 0) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelfResult(lastStartId); } }
    private Notification notification(String title, int percent) {
        PendingIntent open = PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, "downloads").setSmallIcon(R.drawable.ic_cine_notification).setContentTitle("Saving in Cine music")
            .setContentText(title).setContentIntent(open).setOnlyAlertOnce(true).setOngoing(true).setProgress(100, Math.max(0, percent), percent < 0).build();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onTimeout(int startId, int foregroundServiceType) { pauseActive(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); }
    private void pauseActive() {
        List<String> ids = new ArrayList<>();
        synchronized (DownloadService.class) { for (Job job : JOBS.values()) if ("queued".equals(job.status) || "downloading".equals(job.status)) ids.add(job.id); }
        for (String id : ids) cancel(this, id, true, "Download was interrupted. Resume to restart it.");
    }
    @Override public void onDestroy() {
        closed = true; pauseActive();
        try { if (connectivity != null) connectivity.unregisterNetworkCallback(networks); } catch (Exception ignored) {}
        worker.shutdownNow(); if (instance == this) instance = null; super.onDestroy();
    }
}

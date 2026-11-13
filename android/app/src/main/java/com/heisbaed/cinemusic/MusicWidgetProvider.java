package com.heisbaed.cinemusic;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.Bitmap;
import android.graphics.drawable.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.JSONObject;
import java.util.*;

public class MusicWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_PLAY_PAUSE = "com.heisbaed.cinemusic.widget.PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.heisbaed.cinemusic.widget.NEXT";
    public static final String ACTION_PREVIOUS = "com.heisbaed.cinemusic.widget.PREVIOUS";
    public static final String ACTION_CLOSE = "com.heisbaed.cinemusic.widget.CLOSE";
    public static final String ACTION_UPDATE = "com.heisbaed.cinemusic.widget.UPDATE";

    private final BroadcastReceiver playerListener = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if ("player".equals(intent.getStringExtra("type"))) {
                AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
                ComponentName componentName = new ComponentName(context, MusicWidgetProvider.class);
                for (int appWidgetId : widgetManager.getAppWidgetIds(componentName)) {
                    updateAppWidget(context, widgetManager, appWidgetId);
                }
            }
        }
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        
        String action = intent.getAction();
        if (ACTION_PLAY_PAUSE.equals(action)) {
            sendCommand(context, "toggle");
        } else if (ACTION_NEXT.equals(action)) {
            sendCommand(context, "next");
        } else if (ACTION_PREVIOUS.equals(action)) {
            sendCommand(context, "previous");
        } else if (ACTION_CLOSE.equals(action)) {
            sendCommand(context, "stop");
        } else if (ACTION_UPDATE.equals(action)) {
            AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
            ComponentName componentName = new ComponentName(context, MusicWidgetProvider.class);
            int[] appWidgetIds = widgetManager.getAppWidgetIds(componentName);
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, widgetManager, appWidgetId);
            }
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onEnabled(Context context) {
        // Start periodic updates
        startPeriodicUpdates(context);
        // Also update on every player state change so the widget stays current.
        IntentFilter filter = new IntentFilter(Events.ACTION);
        if (Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(playerListener, filter, Events.PERMISSION, null, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(playerListener, filter, Events.PERMISSION, null);
        }
    }

    @Override
    public void onDisabled(Context context) {
        stopPeriodicUpdates(context);
        context.unregisterReceiver(playerListener);
    }

    private void startPeriodicUpdates(Context context) {
        Intent intent = new Intent(context, MusicWidgetProvider.class);
        intent.setAction(ACTION_UPDATE);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.setRepeating(
                AlarmManager.RTC,
                System.currentTimeMillis() + 1000,
                30000, // Refresh progress while playback is active.
                pendingIntent
            );
        }
    }

    private void stopPeriodicUpdates(Context context) {
        Intent intent = new Intent(context, MusicWidgetProvider.class);
        intent.setAction(ACTION_UPDATE);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
    }

    private void sendCommand(Context context, String command) {
        // A widget can outlive the playback process. Open the app instead of
        // trying to start a background service with no track to control.
        if (PlaybackService.instance == null) { openApp(context); return; }
        Intent intent = new Intent(context, PlaybackService.class);
        switch (command) {
            case "toggle":
                String status = "idle";
                try { status = new JSONObject(MusicWidgetService.getPlayerSnapshot(context)).optString("status", "idle"); } catch (Exception ignored) {}
                intent.setAction("playing".equals(status) || "loading".equals(status) ? "pause" : "resume");
                break;
            case "next":
                intent.setAction("next");
                break;
            case "previous":
                intent.setAction("previous");
                break;
            case "stop":
                intent.setAction("stop");
                break;
        }
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        try { context.startService(intent); }
        catch (Exception ignored) { openApp(context); }
    }

    private void openApp(Context context) {
        try {
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(launch);
            }
        } catch (Exception ignored) {}
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        updateAppWidget(context, appWidgetManager, appWidgetId, null, true);
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bitmap coverBitmap, boolean loadCover) {
        try {
            // Get current player state
            String snapshot = "";
            try {
                snapshot = MusicWidgetService.getPlayerSnapshot(context);
            } catch (Exception ignored) {}
            
            JSONObject playerState;
            try {
                playerState = new JSONObject(snapshot);
            } catch (Exception e) {
                playerState = new JSONObject();
            }
            
            String status = playerState.optString("status", "idle");
            JSONObject track = playerState.optJSONObject("track");
            long positionMs = playerState.optLong("positionMs", 0);
            long durationMs = playerState.optLong("durationMs", 0);
            
            boolean isPlaying = "playing".equals(status);
            boolean hasTrack = track != null && track.has("id");
            
            // Build the widget layout
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_music_control);
            
            // Set text views
            String title = track != null ? track.optString("title", "No track") : "No track";
            String artist = track != null ? track.optString("artist", "Unknown") : "Cine Music";
            
            views.setTextViewText(R.id.widget_title, truncate(title, 25));
            views.setTextViewText(R.id.widget_artist, truncate(artist, 25));
            views.setTextViewText(R.id.widget_status, hasTrack ? (isPlaying ? "Playing" : "Paused") : "Open Cine to play");
            
            // Set progress bar
            if (durationMs > 0 && hasTrack) {
                int progress = (int) (positionMs * 100 / durationMs);
                views.setProgressBar(R.id.widget_progress, 100, Math.min(100, progress), false);
                views.setViewVisibility(R.id.widget_progress, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_progress, View.GONE);
            }
            
            // Set play/pause button and playing indicator
            int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
            views.setImageViewResource(R.id.widget_play_pause, playPauseIcon);
            views.setViewVisibility(R.id.widget_playing_indicator, isPlaying ? View.VISIBLE : View.GONE);
            
            // Set click actions
            Intent playPauseIntent = new Intent(context, MusicWidgetProvider.class);
            playPauseIntent.setAction(ACTION_PLAY_PAUSE);
            PendingIntent playPausePending = PendingIntent.getBroadcast(context, 0, playPauseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_play_pause, playPausePending);
            
            // Next button
            Intent nextIntent = new Intent(context, MusicWidgetProvider.class);
            nextIntent.setAction(ACTION_NEXT);
            PendingIntent nextPending = PendingIntent.getBroadcast(context, 0, nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_next, nextPending);
            
            // Previous button
            Intent prevIntent = new Intent(context, MusicWidgetProvider.class);
            prevIntent.setAction(ACTION_PREVIOUS);
            PendingIntent prevPending = PendingIntent.getBroadcast(context, 0, prevIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_previous, prevPending);
            
            // Close button
            Intent closeIntent = new Intent(context, MusicWidgetProvider.class);
            closeIntent.setAction(ACTION_CLOSE);
            PendingIntent closePending = PendingIntent.getBroadcast(context, 0, closeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_close, closePending);
            
            // Set cover image scale type - handled by layout XML
            
            // Try to set cover image if available
            if (coverBitmap != null) views.setImageViewBitmap(R.id.widget_cover, coverBitmap);

            // Draw the widget even if loading artwork or a background service fails.
            appWidgetManager.updateAppWidget(appWidgetId, views);

            if (coverBitmap == null && loadCover && track != null && track.has("cover")) {
                String coverUrl = track.optString("cover", "");
                if (!coverUrl.isEmpty()) {
                    try {
                        // Load cover asynchronously via service
                        Intent loadCoverIntent = new Intent(context, MusicWidgetService.class);
                        loadCoverIntent.setAction(MusicWidgetService.ACTION_LOAD_COVER);
                        loadCoverIntent.putExtra("coverUrl", coverUrl);
                        loadCoverIntent.putExtra("widgetId", appWidgetId);
                        context.startService(loadCoverIntent);
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            // Silently fail - widget updates shouldn't crash the app
        }
    }
    
    private static String truncate(String text, int maxLength) {
        if (text == null) return "";
        if (text.length() <= maxLength) return text;
        return text.substring(0, maxLength - 1) + "…";
    }
}

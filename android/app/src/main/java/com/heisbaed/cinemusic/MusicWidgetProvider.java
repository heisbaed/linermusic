package com.heisbaed.cinemusic;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class MusicWidgetProvider extends AppWidgetProvider {
    private static String requestedCover = "";
    private static long requestedAt;
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { updateAll(context); }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) { updateAll(context); }
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MusicWidgetProvider.class));
        if (ids.length == 0) return;
        JSONObject state;
        try { state = new JSONObject(CineConnect.get(context).snapshot()); }
        catch (Exception ignored) { state = PlaybackService.idleSnapshot(); }
        for (int id : ids) {
            android.os.Bundle options = manager.getAppWidgetOptions(id);
            int height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80);
            int width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300);
            manager.updateAppWidget(id, buildViews(context, state, height < 132, width));
        }
    }
    static RemoteViews buildViews(Context context, JSONObject state) {
        return buildViews(context, state, false, 300);
    }
    private static RemoteViews buildViews(Context context, JSONObject state, boolean compact, int width) {
        JSONObject track = state.optJSONObject("track");
        String status = state.optString("status", "idle");
        boolean active = track != null && !"idle".equals(status);
        boolean playing = "playing".equals(status) || "loading".equals(status);
        RemoteViews views = new RemoteViews(context.getPackageName(), compact ? R.layout.widget_music_compact : R.layout.widget_music_control);
        if (compact) {
            views.setViewVisibility(R.id.widget_previous, width >= 300 ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.widget_next, width >= 220 ? View.VISIBLE : View.GONE);
        }
        views.setTextViewText(R.id.widget_title, active ? track.optString("title") : "Cine music");
        views.setTextViewText(R.id.widget_artist, active ? track.optString("artist") : "Find your rhythm");
        views.setTextViewText(R.id.widget_status, !active ? "Tap to choose music" : "loading".equals(status) ? "Buffering" : "error".equals(status) ? "Tap Play to retry" : playing ? "Playing" : "Paused");
        long duration = state.optLong("durationMs");
        views.setProgressBar(R.id.widget_progress, 1000, duration > 0 ? (int)Math.min(1000, state.optLong("positionMs") * 1000 / duration) : 0, false);
        views.setViewVisibility(R.id.widget_progress, active && duration > 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_playing_indicator, playing && active ? View.VISIBLE : View.GONE);
        views.setImageViewResource(R.id.widget_play_pause, playing ? R.drawable.ic_cine_pause : R.drawable.ic_cine_play);
        views.setContentDescription(R.id.widget_play_pause, playing ? "Pause" : "Play");
        views.setImageViewResource(R.id.widget_cover, R.drawable.cine_icon_forest);
        Bitmap artwork = active ? MediaArtwork.cached(track.optString("cover")) : null;
        if (artwork != null) views.setImageViewBitmap(R.id.widget_cover, artwork);
        else if (active && !track.optString("cover").isEmpty()) {
            String cover = track.optString("cover");
            long now = android.os.SystemClock.elapsedRealtime();
            if (!cover.equals(requestedCover) || now-requestedAt > 30000) {
                requestedCover = cover; requestedAt = now;
                MediaArtwork.load(context, cover, image -> { if (image != null) new android.os.Handler(android.os.Looper.getMainLooper()).post(() -> updateAll(context.getApplicationContext())); });
            }
        }
        PendingIntent open = PendingIntent.getActivity(context, 40, new Intent(context, MainActivity.class).putExtra("openPlayer", active), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, open);
        views.setOnClickPendingIntent(R.id.widget_cover, open);
        views.setOnClickPendingIntent(R.id.widget_title, open);
        views.setOnClickPendingIntent(R.id.widget_previous, active ? command(context, "previous") : open);
        views.setOnClickPendingIntent(R.id.widget_play_pause, active ? command(context, playing ? "pause" : "resume") : open);
        views.setOnClickPendingIntent(R.id.widget_next, active ? command(context, "next") : open);
        return views;
    }
    static PendingIntent command(Context context, String action) {
        return PendingIntent.getService(context, action.hashCode(), new Intent(context, PlaybackService.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}

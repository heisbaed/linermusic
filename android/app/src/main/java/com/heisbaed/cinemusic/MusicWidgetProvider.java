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
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { updateAll(context); }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) { updateAll(context); }
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, MusicWidgetProvider.class));
        if (ids.length == 0) return;
        JSONObject state;
        try { state = PlaybackService.instance == null ? PlaybackService.idleSnapshot() : new JSONObject(PlaybackService.instance.snapshot()); }
        catch (Exception ignored) { state = PlaybackService.idleSnapshot(); }
        manager.updateAppWidget(ids, buildViews(context, state));
    }
    static RemoteViews buildViews(Context context, JSONObject state) {
        JSONObject track = state.optJSONObject("track");
        String status = state.optString("status", "idle");
        boolean active = track != null && !"idle".equals(status);
        boolean playing = "playing".equals(status) || "loading".equals(status);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_music_control);
        views.setTextViewText(R.id.widget_title, active ? track.optString("title") : "Cine music");
        views.setTextViewText(R.id.widget_artist, active ? track.optString("artist") : "Find your rhythm");
        views.setTextViewText(R.id.widget_status, !active ? "Tap to choose music" : "loading".equals(status) ? "Buffering" : "error".equals(status) ? "Tap Play to retry" : playing ? "Playing" : "Paused");
        long duration = state.optLong("durationMs");
        views.setProgressBar(R.id.widget_progress, 1000, duration > 0 ? (int)Math.min(1000, state.optLong("positionMs") * 1000 / duration) : 0, false);
        views.setViewVisibility(R.id.widget_progress, active && duration > 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_playing_indicator, playing && active ? View.VISIBLE : View.GONE);
        views.setImageViewResource(R.id.widget_play_pause, playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        views.setContentDescription(R.id.widget_play_pause, playing ? "Pause" : "Play");
        views.setImageViewResource(R.id.widget_cover, R.drawable.ic_cine_launcher_foreground);
        Bitmap artwork = active ? MediaArtwork.cached(track.optString("cover")) : null;
        if (artwork != null) views.setImageViewBitmap(R.id.widget_cover, artwork);
        PendingIntent open = PendingIntent.getActivity(context, 40, new Intent(context, MainActivity.class).putExtra("openPlayer", true), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, open);
        views.setOnClickPendingIntent(R.id.widget_cover, open);
        views.setOnClickPendingIntent(R.id.widget_title, open);
        views.setOnClickPendingIntent(R.id.widget_previous, active ? command(context, "previous") : open);
        views.setOnClickPendingIntent(R.id.widget_play_pause, active ? command(context, playing ? "pause" : "resume") : open);
        views.setOnClickPendingIntent(R.id.widget_next, active ? command(context, "next") : open);
        views.setOnClickPendingIntent(R.id.widget_close, active ? command(context, "stop") : open);
        return views;
    }
    static PendingIntent command(Context context, String action) {
        return PendingIntent.getService(context, action.hashCode(), new Intent(context, PlaybackService.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}

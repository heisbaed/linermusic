package com.heisbaed.cinemusic;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.os.*;
import android.widget.*;
import androidx.annotation.Nullable;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

public class MusicWidgetService extends Service {
    private static final String TAG = "MusicWidgetService";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private static String cachedSnapshot = "";
    
    public static final String ACTION_UPDATE = "com.heisbaed.cinemusic.widget.UPDATE";
    public static final String ACTION_LOAD_COVER = "com.heisbaed.cinemusic.widget.LOAD_COVER";
    
    @Override
    public void onCreate() {
        super.onCreate();
    }
    
    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        
        String action = intent.getAction();
        if (ACTION_UPDATE.equals(action)) {
            updateWidget();
        } else if (ACTION_LOAD_COVER.equals(action)) {
            String coverUrl = intent.getStringExtra("coverUrl");
            int widgetId = intent.getIntExtra("widgetId", 0);
            loadCover(coverUrl, widgetId);
        }
        
        return START_NOT_STICKY;
    }
    
    private void updateWidget() {
        executor.execute(() -> {
            try {
                // Get player snapshot from PlaybackService
                String snapshot = getPlayerSnapshot(this);
                cachedSnapshot = snapshot;
                
                JSONObject playerState;
                try {
                    playerState = new JSONObject(snapshot);
                } catch (Exception e) {
                    playerState = new JSONObject();
                }
                
                handler.post(() -> {
                    try {
                        AppWidgetManager widgetManager = AppWidgetManager.getInstance(this);
                        ComponentName componentName = new ComponentName(this, MusicWidgetProvider.class);
                        int[] appWidgetIds = widgetManager.getAppWidgetIds(componentName);
                        
                        for (int appWidgetId : appWidgetIds) {
                            MusicWidgetProvider.updateAppWidget(this, widgetManager, appWidgetId);
                        }
                    } catch (Exception ignored) {}
                });
            } catch (Exception e) {
                // Silently fail
            } finally {
                stopSelf();
            }
        });
    }
    
    public static String getPlayerSnapshot(Context context) {
        // Prefer the live snapshot from the playback service when it is running.
        try {
            if (PlaybackService.instance != null) {
                String live = PlaybackService.instance.snapshot();
                if (live != null && !live.isEmpty()) {
                    cachedSnapshot = live;
                    return live;
                }
            }
        } catch (Exception ignored) {}
        // Fall back to the most recent cached snapshot so the widget still shows something.
        if (cachedSnapshot != null && !cachedSnapshot.isEmpty()) return cachedSnapshot;
        return PlaybackService.idleSnapshot().toString();
    }
    
    private void loadCover(String coverUrl, int widgetId) {
        executor.execute(() -> {
            try {
                URL url = new URL(coverUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setRequestProperty("User-Agent", "CineMusic/Android");
                
                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    connection.disconnect();
                    return;
                }
                
                InputStream inputStream = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                inputStream.close();
                connection.disconnect();
                
                if (bitmap == null) return;
                
                final int widgetIdFinal = widgetId;
                final Bitmap bitmapFinal = bitmap;
                
                handler.post(() -> {
                    try {
                        AppWidgetManager widgetManager = AppWidgetManager.getInstance(this);
                        MusicWidgetProvider.updateAppWidget(this, widgetManager, widgetIdFinal, bitmapFinal, false);
                        bitmapFinal.recycle();
                    } catch (Exception ignored) {
                        if (!bitmapFinal.isRecycled()) bitmapFinal.recycle();
                    }
                });
            } catch (Exception ignored) {}
        });
    }
    
    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}

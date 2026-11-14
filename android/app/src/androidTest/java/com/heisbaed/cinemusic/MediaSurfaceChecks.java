package com.heisbaed.cinemusic;

import android.app.Instrumentation;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.media.session.MediaController;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.util.function.BooleanSupplier;
import org.json.JSONObject;

final class MediaSurfaceChecks {
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
    private static void await(BooleanSupplier condition, String message) throws Exception {
        long deadline = System.currentTimeMillis() + 10000;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < deadline) Thread.sleep(100);
        check(condition.getAsBoolean(), message);
    }
    static void verify(Instrumentation test, Context context) throws Exception {
        PlaybackService service = PlaybackService.instance;
        check(service != null, "Start native playback before testing media surfaces");
        Field field = PlaybackService.class.getDeclaredField("session"); field.setAccessible(true);
        MediaSession session = (MediaSession)field.get(service);
        MediaController controller = new MediaController(context, session.getSessionToken());
        long required = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_SEEK_TO | PlaybackState.ACTION_SKIP_TO_PREVIOUS | PlaybackState.ACTION_SKIP_TO_NEXT;
        check((controller.getPlaybackState().getActions() & required) == required, "System media actions missing");
        controller.getTransportControls().pause();
        await(() -> controller.getPlaybackState().getState() == PlaybackState.STATE_PAUSED, "MediaSession Pause did not affect audio");
        MusicWidgetProvider.command(context, "resume").send();
        await(() -> controller.getPlaybackState().getState() == PlaybackState.STATE_PLAYING, "Widget Play did not affect audio");
        controller.getTransportControls().seekTo(4000);
        await(() -> controller.getPlaybackState().getPosition() >= 3900, "System seek did not reach playback");
        MusicWidgetProvider.command(context, "pause").send();
        await(() -> controller.getPlaybackState().getState() == PlaybackState.STATE_PAUSED, "Widget Pause did not affect audio");
        check(controller.getMetadata() != null && controller.getMetadata().getString("android.media.metadata.TITLE").equals("Offline playback check"), "System song metadata is stale");
        check(((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications().length > 0, "Playback notification missing");
        boolean branded = false;
        for (android.service.notification.StatusBarNotification item : ((NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications()) {
            if (item.getId() == 1) branded = item.getNotification().extras.getCharSequence(android.app.Notification.EXTRA_TITLE, "").toString().startsWith("Cine music");
        }
        check(branded, "Notification app name is missing");
        JSONObject state = new JSONObject(service.snapshot());
        test.runOnMainSync(() -> {
            try {
                View widget = MusicWidgetProvider.buildViews(context, state).apply(context, new FrameLayout(context));
                int width = (int)(320 * context.getResources().getDisplayMetrics().density);
                widget.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
                widget.layout(0, 0, width, widget.getMeasuredHeight());
                check(((TextView)widget.findViewById(R.id.widget_title)).getText().toString().equals("Offline playback check"), "Widget title is stale");
                for (int id : new int[]{R.id.widget_previous, R.id.widget_play_pause, R.id.widget_next, R.id.widget_close}) {
                    View button = widget.findViewById(id);
                    check(button.getWidth() >= 48 * context.getResources().getDisplayMetrics().density && button.getHeight() >= 48 * context.getResources().getDisplayMetrics().density, "Widget control target too small");
                }
                Bitmap image = Bitmap.createBitmap(width, widget.getMeasuredHeight(), Bitmap.Config.ARGB_8888); widget.draw(new Canvas(image));
                try (FileOutputStream out = new FileOutputStream(new File(context.getFilesDir(), "widget-check.png"))) { image.compress(Bitmap.CompressFormat.PNG, 100, out); }
                image.recycle();
            } catch (Exception error) { throw new RuntimeException(error); }
        });
    }
}

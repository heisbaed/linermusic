package com.heisbaed.cinemusic;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Bounded artwork shared by media metadata, notifications and home-screen widgets. */
final class MediaArtwork {
    private static final LruCache<String, Bitmap> cache = new LruCache<>(4);
    private static final Map<String, List<Consumer<Bitmap>>> pending = new HashMap<>();
    private static final Map<String, Long> failures = new HashMap<>();
    private static final java.util.concurrent.ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final Handler main = new Handler(Looper.getMainLooper());
    static Bitmap cached(String url) { return cache.get(url); }

    static void load(String address, Consumer<Bitmap> callback) {
        Bitmap cached = cache.get(address);
        if (cached != null) { callback.accept(cached); return; }
        synchronized (pending) {
            if (address.isEmpty() || System.currentTimeMillis() - failures.getOrDefault(address, 0L) < 30000) return;
            List<Consumer<Bitmap>> listeners = pending.get(address);
            if (listeners != null) { listeners.add(callback); return; }
            listeners = new ArrayList<>(); listeners.add(callback); pending.put(address, listeners);
        }
        worker.execute(() -> {
            Bitmap image = null;
            HttpURLConnection connection = null;
            try {
                if (!MainActivity.allowedNetworkUrl(address)) throw new java.io.IOException("Unsupported artwork address");
                connection = (HttpURLConnection)new URL(address).openConnection();
                connection.setConnectTimeout(6000); connection.setReadTimeout(6000); connection.setInstanceFollowRedirects(false);
                if (connection.getResponseCode() != 200 || connection.getContentLengthLong() > 2_000_000) throw new java.io.IOException("Artwork unavailable");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream input = connection.getInputStream()) {
                    byte[] buffer = new byte[8192]; int count;
                    while ((count = input.read(buffer)) != -1) {
                        if (bytes.size() + count > 2_000_000) throw new java.io.IOException("Artwork too large");
                        bytes.write(buffer, 0, count);
                    }
                }
                byte[] data = bytes.toByteArray();
                BitmapFactory.Options options = new BitmapFactory.Options(); options.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(data, 0, data.length, options);
                options.inSampleSize = 1;
                while (Math.max(options.outWidth, options.outHeight) / options.inSampleSize > 512) options.inSampleSize *= 2;
                options.inJustDecodeBounds = false;
                image = BitmapFactory.decodeByteArray(data, 0, data.length, options);
                if (image != null) cache.put(address, image);
            } catch (Exception ignored) { /* Keep the original logo when artwork is unavailable. */ }
            finally { if (connection != null) connection.disconnect(); }
            final Bitmap result = image;
            main.post(() -> {
                List<Consumer<Bitmap>> listeners;
                synchronized (pending) {
                    listeners = pending.remove(address);
                    if (result == null) { if (failures.size() > 30) failures.clear(); failures.put(address, System.currentTimeMillis()); }
                }
                if (listeners != null) for (Consumer<Bitmap> listener : listeners) listener.accept(result);
            });
        });
    }
}

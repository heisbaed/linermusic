package com.heisbaed.cinemusic;

import android.content.Context;
import android.net.Uri;
import android.util.AtomicFile;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Private, bounded artwork cache shared by all WebView screens across launches. */
final class ArtworkCache {
    private static final Object WRITE_LOCK = new Object();
    private static boolean trusted(String host) {
        return host != null && (host.equals("i.ytimg.com") || host.endsWith(".googleusercontent.com")
            || host.endsWith(".ggpht.com") || host.endsWith(".scdn.co") || host.endsWith(".mzstatic.com"));
    }
    static WebResourceResponse load(Context context, Uri uri) {
        if (!"https".equals(uri.getScheme()) || !trusted(uri.getHost()) || uri.getUserInfo() != null) return null;
        HttpURLConnection connection = null;
        try {
            File directory = new File(context.getCacheDir(), "artwork");
            directory.mkdirs();
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(uri.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder key = new StringBuilder();
            for (byte value : hash) key.append(String.format(Locale.ROOT, "%02x", value & 255));
            File target = new File(directory, key + ".img");
            if (target.isFile() && target.length() > 0) return response(target);
            URL url = new URL(uri.toString());
            for (int redirect = 0; redirect < 4; redirect++) {
                if (!"https".equals(url.getProtocol()) || !trusted(url.getHost())) return null;
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(6000);
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    url = new URL(url, connection.getHeaderField("Location"));
                    connection.disconnect(); connection = null; continue;
                }
                if (status != 200 || !connection.getContentType().toLowerCase(Locale.ROOT).startsWith("image/")) return null;
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                try (InputStream stream = connection.getInputStream()) {
                    byte[] buffer = new byte[16384]; int count;
                    while ((count = stream.read(buffer)) != -1) {
                        if (bytes.size() + count > 2 * 1024 * 1024) return null;
                        bytes.write(buffer, 0, count);
                    }
                }
                synchronized (WRITE_LOCK) {
                    AtomicFile file = new AtomicFile(target);
                    FileOutputStream output = null;
                    try { output = file.startWrite(); output.write(bytes.toByteArray()); file.finishWrite(output); }
                    catch (IOException failure) { file.failWrite(output); throw failure; }
                    File[] entries = directory.listFiles((folder, name) -> name.endsWith(".img"));
                    if (entries != null) {
                        Arrays.sort(entries, Comparator.comparingLong(File::lastModified));
                        long size = 0; for (File entry : entries) size += entry.length();
                        long limit = ("tv".equals(BuildConfig.CINE_PLATFORM) ? 32L : 64L) * 1024 * 1024;
                        for (File entry : entries) { if (size <= limit) break; if (!entry.equals(target)) { long length = entry.length(); if (entry.delete()) size -= length; } }
                    }
                }
                return response(target);
            }
        } catch (Exception unavailable) { /* Let WebView recover through its normal image loader. */ }
        finally { if (connection != null) connection.disconnect(); }
        return null;
    }
    private static WebResourceResponse response(File file) throws IOException {
        file.setLastModified(System.currentTimeMillis());
        BufferedInputStream input = new BufferedInputStream(new FileInputStream(file));
        String mime = java.net.URLConnection.guessContentTypeFromStream(input);
        Map<String,String> headers = new HashMap<>();
        headers.put("Cache-Control", "public, max-age=2592000, immutable");
        // These are public catalog images. Preserve canvas sampling after a disk-cache hit.
        headers.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse(mime == null ? "image/webp" : mime, null, 200, "OK",headers,input);
    }
}

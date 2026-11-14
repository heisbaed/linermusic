package com.heisbaed.cinemusic;

import android.app.Activity;
import android.app.Instrumentation;
import android.os.Bundle;
import android.os.SystemClock;
import java.io.InputStream;
import java.net.HttpURLConnection;

/** Bounded live transfer probe. Each strategy reads at most 512 KiB of one audio source. */
public class DownloadSpeedChecks {
    static String verify(android.content.Context context) throws Exception {
            MainActivity.configureNetworkHosts(context);
            String url = StreamResolver.resolve("eafzURCG1X0", () -> false, connection -> {});
            StringBuilder report = new StringBuilder();
            for (boolean query : new boolean[]{false, true}) {
                long started = SystemClock.elapsedRealtime(); int bytes = 0;
                String address = query ? url + (url.contains("?") ? "&" : "?") + "range=0-524287" : url;
                HttpURLConnection connection = MainActivity.connection(address);
                connection.setRequestProperty("User-Agent", "Mozilla/5.0");
                connection.setRequestProperty("Referer", "https://music.youtube.com/");
                connection.setRequestProperty("Range", "bytes=0-524287");
                connection.setRequestProperty("Accept-Encoding", "identity");
                connection.setReadTimeout(12000);
                int code = connection.getResponseCode();
                try (InputStream input = connection.getInputStream()) {
                    byte[] buffer = new byte[65536]; int count;
                    while (bytes < 524288 && (count = input.read(buffer, 0, Math.min(buffer.length, 524288 - bytes))) != -1) bytes += count;
                } finally { connection.disconnect(); }
                report.append(query ? "query-range" : "header-range").append(" HTTP ").append(code).append(" ").append(bytes).append(" bytes in ").append(SystemClock.elapsedRealtime() - started).append(" ms\n");
            }
            return report.toString();
    }
}

package com.heisbaed.cinemusic;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.*;

/** Sequential bounded ranges with transparent auto-reconnect and byte-accurate resume. */
final class AudioDownloadStream extends InputStream {
    private static final long CHUNK = 8L * 1024 * 1024, MAX = 64L * 1024 * 1024;
    private static final int MAX_RECONNECT_ATTEMPTS = 4;
    private final String url;
    private final BooleanSupplier cancelled;
    private final Consumer<HttpURLConnection> connected;
    private HttpURLConnection connection;
    private InputStream input;
    private long position, end, total = -1;
    private boolean closed;

    AudioDownloadStream(String url, BooleanSupplier cancelled, Consumer<HttpURLConnection> connected) throws Exception {
        this.url = url;
        this.cancelled = cancelled;
        this.connected = connected;
        openWithRetry();
    }

    long length() { return total; }

    private void check() throws IOException {
        if (closed || cancelled.getAsBoolean() || Thread.currentThread().isInterrupted()) {
            throw new InterruptedIOException("Download stopped");
        }
    }

    private void closeConnection() {
        if (input != null) {
            try { input.close(); } catch (Exception ignored) {}
            input = null;
        }
        if (connection != null) {
            try { connection.disconnect(); } catch (Exception ignored) {}
            connection = null;
        }
    }

    private void openWithRetry() throws IOException {
        int attempt = 0;
        while (true) {
            check();
            try {
                open();
                return;
            } catch (IOException error) {
                check();
                if (error instanceof InterruptedIOException && !(error instanceof SocketTimeoutException)) throw error;
                attempt++;
                if (attempt >= MAX_RECONNECT_ATTEMPTS) {
                    throw new IOException("Download connection failed after " + attempt + " attempts: " + error.getMessage(), error);
                }
                closeConnection();
                try {
                    Thread.sleep(Math.min(2000, 300L * (1 << attempt)));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new InterruptedIOException("Download interrupted during retry");
                }
            }
        }
    }

    private void open() throws IOException {
        check();
        closeConnection();
        try {
            connection = MainActivity.connection(url);
            connected.accept(connection);
            check();

            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0");
            connection.setRequestProperty("Referer", "https://music.youtube.com/");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Connection", "keep-alive");

            long requestEnd = total > 0 ? Math.min(total - 1, position + CHUNK - 1) : position + CHUNK - 1;
            connection.setRequestProperty("Range", "bytes=" + position + "-" + requestEnd);

            int status = connection.getResponseCode();
            String type = connection.getContentType();
            if (type == null || !(type.startsWith("audio/") || type.startsWith("video/webm") || type.startsWith("application/octet-stream"))) {
                throw new IOException("The server did not return audio");
            }

            if (status == 206) {
                Matcher range = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(String.valueOf(connection.getHeaderField("Content-Range")));
                if (!range.matches() || Long.parseLong(range.group(1)) != position) {
                    throw new IOException("Invalid audio download range response");
                }
                long nextEnd = Long.parseLong(range.group(2)), size = Long.parseLong(range.group(3));
                if (size <= 0 || size > MAX || nextEnd < position || nextEnd >= size || nextEnd - position + 1 > CHUNK || (total > 0 && total != size)) {
                    throw new IOException("Invalid audio download size");
                }
                total = size;
                end = nextEnd + 1;
            } else if (status == 200 && position == 0) {
                total = connection.getContentLengthLong();
                if (total <= 0 || total > MAX) throw new IOException("Invalid audio download size");
                end = total;
            } else {
                throw new IOException("Download failed (HTTP " + status + "). Try again.");
            }

            input = new BufferedInputStream(connection.getInputStream(), 64 * 1024);
        } catch (Exception error) {
            closeConnection();
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("Download connection failed", error);
        }
    }

    @Override
    public int read(byte[] bytes, int offset, int count) throws IOException {
        if (offset < 0 || count < 0 || offset > bytes.length - count) throw new IndexOutOfBoundsException();
        if (count == 0) return 0;
        check();
        if (total > 0 && position >= total) return -1;

        int retries = 0;
        while (true) {
            check();
            try {
                if (input == null || position >= end) {
                    openWithRetry();
                }

                int toRead = (int) Math.min(count, end - position);
                if (toRead <= 0 && total > 0 && position < total) {
                    openWithRetry();
                    toRead = (int) Math.min(count, end - position);
                }

                int read = input.read(bytes, offset, toRead);
                if (read < 0) {
                    // Premature EOF before the requested chunk or total bytes were received
                    if (total > 0 && position < total) {
                        throw new EOFException("Premature stream termination at " + position + "/" + total);
                    }
                    return -1;
                }

                position += read;
                return read;
            } catch (IOException error) {
                check();
                if (error instanceof InterruptedIOException && !(error instanceof SocketTimeoutException)) throw error;

                retries++;
                if (retries > MAX_RECONNECT_ATTEMPTS) {
                    throw new IOException("Download interrupted: " + error.getMessage(), error);
                }

                // Seamlessly reconnect from the exact current position without losing data
                closeConnection();
                try {
                    Thread.sleep(Math.min(2500, 350L * (1 << retries)));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new InterruptedIOException("Download interrupted during reconnect");
                }
            }
        }
    }

    @Override
    public int read() throws IOException {
        byte[] one = new byte[1];
        return read(one, 0, 1) < 0 ? -1 : one[0] & 255;
    }

    @Override
    public void close() throws IOException {
        closed = true;
        closeConnection();
    }
}

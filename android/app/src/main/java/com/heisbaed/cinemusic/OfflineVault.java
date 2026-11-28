package com.heisbaed.cinemusic;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

/** App-private authenticated ciphertext. No provider, export path or public audio file. */
final class OfflineVault {
    static final int MAX_BYTES = 64 * 1024 * 1024;
    private static final String ALIAS = "cine-music-offline-v1";
    private final File directory;
    OfflineVault(Context context) {
        directory = new File(context.getNoBackupFilesDir(), "offline");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Offline storage unavailable");
    }
    private static synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private String filename(String id) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8));
        char[] result = new char[digest.length * 2];
        char[] hex = "0123456789abcdef".toCharArray();
        for (int index = 0; index < digest.length; index++) { result[index * 2] = hex[(digest[index] & 255) >>> 4]; result[index * 2 + 1] = hex[digest[index] & 15]; }
        return new String(result);
    }
    private File audio(String id) throws Exception { return new File(directory, filename(id) + ".cine"); }
    private File metadata(String id) throws Exception { return new File(directory, filename(id) + ".json"); }
    boolean contains(String id) {
        try { return validEntry(id,new JSONObject(new String(java.nio.file.Files.readAllBytes(metadata(id).toPath()),StandardCharsets.UTF_8))); }
        catch (Exception error) { return false; }
    }
    private boolean validEntry(String id,JSONObject record)throws Exception {
        long size=record.optLong("downloadBytes",-1);
        // Format v1: one IV-length byte, 12-byte IV, ciphertext and 16-byte GCM tag.
        return id.equals(record.optString("id"))&&size>0&&size<=MAX_BYTES&&audio(id).isFile()&&audio(id).length()==size+29;
    }
    interface Progress { void update(long read, long total) throws Exception; }
    void store(JSONObject track, InputStream input, long total, Progress progress) throws Exception {
        store(track, input, total, progress, this, () -> {});
    }
    void store(JSONObject track, InputStream input, long total, Progress progress, Object commitLock, Runnable committed) throws Exception {
        String id = track.getString("id");
        if (total > MAX_BYTES) throw new IOException("This track is too large for offline playback (64 MB limit).");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(id.getBytes(StandardCharsets.UTF_8));
        File partial = new File(directory, filename(id) + ".partial");
        try {
            try (FileOutputStream output = new FileOutputStream(partial)) {
                output.write(cipher.getIV().length); output.write(cipher.getIV());
                byte[] buffer = new byte[64 * 1024]; long read = 0; int count;
                ByteArrayOutputStream header = new ByteArrayOutputStream(16);
                while ((count = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Download cancelled");
                    read += count;
                    if (header.size() < 16) header.write(buffer, 0, Math.min(count, 16 - header.size()));
                    if (read > MAX_BYTES) throw new IOException("This track is too large for offline playback (64 MB limit).");
                    byte[] encrypted = cipher.update(buffer, 0, count);
                    if (encrypted != null) output.write(encrypted);
                    progress.update(read, total);
                }
                if (read == 0 || (total > 0 && read != total)) throw new IOException("Download was incomplete. Please retry.");
                byte[] signature = header.toByteArray();
                boolean mp4 = signature.length >= 12 && signature[4] == 'f' && signature[5] == 't' && signature[6] == 'y' && signature[7] == 'p';
                boolean webm = signature.length >= 4 && (signature[0] & 255) == 0x1a && (signature[1] & 255) == 0x45 && (signature[2] & 255) == 0xdf && (signature[3] & 255) == 0xa3;
                if (!mp4 && !webm) throw new IOException("The source did not return a supported audio file. Please retry.");
                output.write(cipher.doFinal()); output.getFD().sync();
                track.put("downloadBytes", read); track.put("downloadedAt", System.currentTimeMillis());
            }
            // Cancellation and the completed job state share this final commit boundary.
            synchronized (commitLock) {
                progress.update(track.getLong("downloadBytes"), total);
                if (!partial.renameTo(audio(id))) throw new IOException("Could not save offline track");
                AtomicFile json = new AtomicFile(metadata(id)); FileOutputStream output = json.startWrite();
                try { output.write(track.toString().getBytes(StandardCharsets.UTF_8)); json.finishWrite(output); }
                catch (Exception error) { json.failWrite(output); audio(id).delete(); throw error; }
                committed.run();
            }
        } finally { partial.delete(); }
    }
    byte[] open(String id) throws Exception {
        File file = audio(id);
        if (!contains(id)) throw new IOException("This offline file is incomplete. Download the song again.");
        try (FileInputStream input = new FileInputStream(file)) {
            int ivSize = input.read(); if (ivSize != 12) throw new IOException("Offline file is invalid");
            byte[] iv = new byte[ivSize]; new DataInputStream(input).readFully(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            cipher.updateAAD(id.getBytes(StandardCharsets.UTF_8));
            byte[] clear = new byte[(int)file.length()-29],buffer = new byte[64 * 1024];
            try {
                int count,written=0;
                while((count=input.read(buffer))!=-1)written+=cipher.update(buffer,0,count,clear,written);
                written+=cipher.doFinal(clear,written);
                if(written!=clear.length)throw new IOException("Offline file size is invalid");
                return clear;
            }catch(Exception error){java.util.Arrays.fill(clear,(byte)0);throw error;}
            finally{java.util.Arrays.fill(buffer,(byte)0);}
        }
    }
    synchronized JSONArray list() {
        JSONArray result = new JSONArray(); File[] files = directory.listFiles((dir, name) -> name.endsWith(".json"));
        if (files != null) for (File file : files) {
            try {
                JSONObject track = new JSONObject(new String(java.nio.file.Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
                if (validEntry(track.getString("id"),track)) {
                    long audioSize = audio(track.getString("id")).length();
                    long metadataSize = file.length();
                    long storageBytes = audioSize + metadataSize;
                    track.put("storageBytes", storageBytes);
                    track.put("audioBytes", audioSize);
                    result.put(track);
                }
            } catch (Exception ignored) { /* A damaged metadata file must not hide the rest of the library. */ }
        }
        return result;
    }
    void cleanPartials() {
        File[] files = directory.listFiles((dir, name) -> name.endsWith(".partial"));
        if (files != null) for (File file : files) file.delete();
    }
    synchronized void remove(String id) throws Exception {
        File audio = audio(id), metadata = metadata(id);
        if (audio.exists() && !audio.delete()) throw new IOException("Could not remove offline audio");
        if (metadata.exists() && !metadata.delete()) throw new IOException("Could not remove offline metadata");
    }
}

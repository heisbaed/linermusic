package com.heisbaed.cinemusic;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** The account vault shared with the background playback coordinator. */
final class AuthStore {
    private static final String ALIAS = "cine.music.auth.tokens.v1";

    private static synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    static synchronized JSONObject read(Context context) {
        try {
            String encoded = context.getSharedPreferences("cine_auth", Context.MODE_PRIVATE).getString("tokens", "");
            if (encoded.isEmpty()) return new JSONObject();
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (bytes.length < 28) return new JSONObject();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Arrays.copyOfRange(bytes, 0, 12)));
            return new JSONObject(new String(cipher.doFinal(Arrays.copyOfRange(bytes, 12, bytes.length)), StandardCharsets.UTF_8));
        } catch (Exception unavailable) { return new JSONObject(); }
    }

    static synchronized void write(Context context, String json) {
        if (json == null || json.length() > 16384) return;
        try {
            new JSONObject(json);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            bytes.write(cipher.getIV());
            bytes.write(cipher.doFinal(json.getBytes(StandardCharsets.UTF_8)));
            context.getSharedPreferences("cine_auth", Context.MODE_PRIVATE).edit()
                .putString("tokens", Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)).apply();
        } catch (Exception unavailable) { throw new IllegalStateException("The account vault is unavailable."); }
    }

    static synchronized void clear(Context context) {
        context.getSharedPreferences("cine_auth", Context.MODE_PRIVATE).edit().remove("tokens").apply();
    }
}


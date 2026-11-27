package com.heisbaed.cinemusic;

import android.content.Context;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.appcheck.FirebaseAppCheck;
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory;
import java.io.InputStream;
import org.json.JSONObject;

/** Native attestation for the installed application; never uses public debug secrets. */
final class DjAttestation {
    private static FirebaseAppCheck checker;
    private static synchronized FirebaseAppCheck get(Context context) throws Exception {
        if (checker != null) return checker;
        if(BuildConfig.CINE_DJ_API_KEY.isEmpty())throw new IllegalStateException("DJ service is not configured in this build");
        FirebaseOptions options = new FirebaseOptions.Builder().setApiKey(BuildConfig.CINE_DJ_API_KEY)
            .setApplicationId(BuildConfig.CINE_DJ_APP_ID).setProjectId(BuildConfig.CINE_DJ_PROJECT_ID).build();
        FirebaseApp app;
        try { app = FirebaseApp.getInstance("cine-dj-native"); }
        catch (IllegalStateException missing) { app = FirebaseApp.initializeApp(context, options, "cine-dj-native"); }
        app.setDataCollectionDefaultEnabled(false);
        checker = FirebaseAppCheck.getInstance(app);
        checker.installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance(),false);
        return checker;
    }
    static void request(Context context, String id) {
        try {
            get(context.getApplicationContext()).getLimitedUseAppCheckToken()
                .addOnSuccessListener(token -> Events.send(context,"djAttestation",Events.json("id",id,"token",token.getToken(),"expireTimeMillis",token.getExpireTimeMillis())))
                .addOnFailureListener(error -> failure(context,id,error));
        } catch (Exception error) { failure(context,id,error); }
    }
    private static void failure(Context context,String id,Exception error) {
        String detail = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
        detail = detail.replaceAll("https?://[^\\s]+","[service]").replaceAll("AIza[\\w-]+","[key]");
        Events.send(context,"djAttestation",Events.json("id",id,"error","DJ_VERIFY: "+detail.substring(0,Math.min(280,detail.length()))));
    }
    static void attachAndroidHeaders(Context context, java.net.HttpURLConnection connection) throws Exception {
        android.content.pm.PackageInfo info=context.getPackageManager().getPackageInfo(context.getPackageName(),android.content.pm.PackageManager.GET_SIGNATURES);
        if(info.signatures==null||info.signatures.length==0)throw new IllegalStateException("App signing certificate is unavailable");
        byte[] bytes=java.security.MessageDigest.getInstance("SHA-1").digest(info.signatures[0].toByteArray());
        StringBuilder certificate=new StringBuilder();for(byte value:bytes)certificate.append(String.format(java.util.Locale.ROOT,"%02X",value&255));
        connection.setRequestProperty("X-Android-Package",context.getPackageName());connection.setRequestProperty("X-Android-Cert",certificate.toString());
    }
}

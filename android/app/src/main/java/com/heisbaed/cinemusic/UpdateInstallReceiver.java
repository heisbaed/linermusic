package com.heisbaed.cinemusic;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

/** Receives only the explicit PendingIntent issued for this app's installer session. */
public class UpdateInstallReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        android.content.SharedPreferences prefs = context.getSharedPreferences("cine_updates", Context.MODE_PRIVATE);
        int id = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);
        if (id < 0 || id != prefs.getInt("install_session", -2)) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmation = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmation != null) {
                prefs.edit().putString("install_message", "Confirm the update in Android.").apply();
                try { context.startActivity(confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                catch (Exception error) { prefs.edit().putString("install_message", "Reopen Updates and tap Install to continue.").apply(); }
            }
            return;
        }
        String message = status == PackageInstaller.STATUS_SUCCESS ? "Cine music was updated successfully."
            : status == PackageInstaller.STATUS_FAILURE_ABORTED ? "Installation cancelled. Tap Check again to retry."
            : "Android could not install the update. " + intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        prefs.edit().putString("install_message", message).remove("install_session").apply();
        if (status == PackageInstaller.STATUS_SUCCESS) new java.io.File(context.getCacheDir(), "ota/update.apk").delete();
        Events.send(context, "updateInstall", Events.json("message", message, "success", status == PackageInstaller.STATUS_SUCCESS));
    }
}

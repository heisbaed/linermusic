package com.heisbaed.cinemusic;
import android.content.*;
/** Update checks are user initiated; boot must not launch an unrequested download. */
public class OTAUpdateReceiver extends BroadcastReceiver {
    public void onReceive(Context context, Intent intent) {
        if(intent!=null&&Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction()))MusicWidgetProvider.updateAll(context);
        NotificationHub.schedule(context);
    }
}

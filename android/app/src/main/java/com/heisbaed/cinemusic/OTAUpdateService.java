package com.heisbaed.cinemusic;
import android.app.*;
import android.content.*;
import android.os.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.concurrent.*;

public class OTAUpdateService extends Service {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile HttpURLConnection connection;
    private boolean busy;
    public void onCreate() {
        super.onCreate();
        ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("ota_updates", "App updates", NotificationManager.IMPORTANCE_LOW));
    }
    private Notification notice(String message, int progress, boolean done) {
        Intent open = new Intent(this, UpdateActivity.class).setAction(done ? "install" : "progress");
        PendingIntent tap = PendingIntent.getActivity(this, 301, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder n = new Notification.Builder(this,"ota_updates").setSmallIcon(R.drawable.ic_cine_notification).setContentTitle("Cine music update")
            .setContentText(message).setContentIntent(tap).setOnlyAlertOnce(true).setOngoing(!done);
        if (!done) n.setProgress(100,Math.max(progress,0),progress<0);
        return n.build();
    }
    public int onStartCommand(Intent intent,int flags,int startId) {
        startForeground(3,notice("Preparing update",-1,false));
        if(intent==null || !"download".equals(intent.getAction())) { stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();return START_NOT_STICKY; }
        if(busy)return START_NOT_STICKY;
        busy=true;
        String url=intent.getStringExtra("url"), sha=intent.getStringExtra("sha256");long size=intent.getLongExtra("size",0);
        worker.execute(()->{
            File partial=new File(getCacheDir(),"ota/update.part");
            try {
                if(!UpdateActivity.trustedUrl(url)||sha==null||!sha.matches("[a-fA-F0-9]{64}")||size<=0||size>200_000_000)throw new IOException("Invalid update metadata");
                partial.getParentFile().mkdirs();
                connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(30000);
                if(connection.getResponseCode()!=200||!"https".equals(connection.getURL().getProtocol()))throw new IOException("Update download failed");
                MessageDigest digest=MessageDigest.getInstance("SHA-256");long total=0;int last=-1;
                try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(partial)) {
                    byte[] buf=new byte[65536];int n;
                    while((n=in.read(buf))!=-1){
                        if(Thread.currentThread().isInterrupted())throw new IOException("Download interrupted");
                        total+=n;if(total>size)throw new IOException("Update size mismatch");out.write(buf,0,n);digest.update(buf,0,n);
                        int progress=(int)(total*100/size);if(progress!=last){last=progress;((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(3,notice("Downloading "+progress+"%",progress,false));}
                    }
                    out.getFD().sync();
                }
                StringBuilder actual=new StringBuilder();for(byte b:digest.digest())actual.append(String.format("%02x",b&255));
                if(total!=size||!actual.toString().equalsIgnoreCase(sha))throw new IOException("Update integrity check failed");
                UpdateActivity.verifyPackage(this,partial);
                File ready=new File(getCacheDir(),"ota/update.apk");if(ready.exists()&&!ready.delete())throw new IOException("Could not replace update");
                if(!partial.renameTo(ready))throw new IOException("Could not save update");
                stopForeground(STOP_FOREGROUND_DETACH);
                ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(3,notice("Ready. Tap to install",100,true));
                Events.send(this,"updateReady",Events.json("message","Update downloaded. Open Updates to install."));
            }catch(Exception e){
                partial.delete();stopForeground(STOP_FOREGROUND_DETACH);
                ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(3,notice("Download failed. Open Updates to retry.",0,true));
                Events.send(this,"updateError",Events.json("message",e.getMessage()==null?"Update failed. Try again.":e.getMessage()));
            }finally{if(connection!=null)connection.disconnect();busy=false;stopSelf();}
        });
        return START_NOT_STICKY;
    }
    public IBinder onBind(Intent intent){return null;}
    @Override public void onTimeout(int startId,int foregroundServiceType){if(connection!=null)connection.disconnect();worker.shutdownNow();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    public void onDestroy(){if(connection!=null)connection.disconnect();worker.shutdownNow();super.onDestroy();}
}

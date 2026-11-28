package com.heisbaed.cinemusic;

import android.app.*;
import android.app.job.*;
import android.content.*;
import android.os.Build;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import org.json.*;

/** Opt-in local reminders. No push credential, automatic APK download or paid server. */
final class NotificationHub {
    private static final int JOB=18021;
    private static final java.util.concurrent.atomic.AtomicBoolean checking=new java.util.concurrent.atomic.AtomicBoolean();
    private static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("cine_notifications",Context.MODE_PRIVATE); }
    private static String owner(Context c) { return AuthStore.read(c).optString("localId"); }
    static synchronized JSONObject state(Context c) {
        JSONObject result=new JSONObject();
        try {
            var p=prefs(c); String uid=owner(c);
            result.put("releases",p.getBoolean("releases:"+uid,false));
            result.put("updates",p.getBoolean("updates",false));
            result.put("downloads",p.getBoolean("downloads",true));
            result.put("allowed",((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled());
            result.put("history",new JSONArray(p.getString("history:"+uid,"[]")));
            result.put("lastCheck",p.getLong("lastCheck:"+uid,0));
            result.put("error",p.getString("error:"+uid,""));
        } catch(Exception ignored) {}
        return result;
    }
    static synchronized void configure(Context c,String key,boolean value) {
        String stored=key.equals("releases")?"releases:"+owner(c):key;
        if(!key.equals("releases")&&!key.equals("updates")&&!key.equals("downloads"))return;
        prefs(c).edit().putBoolean(stored,value).apply(); schedule(c);
    }
    static synchronized void artists(Context c,String json) {
        try {
            JSONArray input=new JSONArray(json),clean=new JSONArray();
            for(int i=0;i<input.length()&&clean.length()<100;i++) {
                String name=input.optString(i).trim();if(!name.isEmpty()&&name.length()<=120)clean.put(name);
            }
            prefs(c).edit().putString("artists:"+owner(c),clean.toString()).apply(); schedule(c);
        }catch(Exception ignored){}
    }
    static void schedule(Context c) {
        var p=prefs(c); JobScheduler jobs=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if(!p.getBoolean("releases:"+owner(c),false)&&!p.getBoolean("updates",false)){jobs.cancel(JOB);return;}
        if(jobs.getPendingJob(JOB)!=null)return;
        jobs.schedule(new JobInfo.Builder(JOB,new ComponentName(c,MusicNotificationJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(86400000L,21600000L).setPersisted(true).build());
    }
    private static synchronized void record(Context c,String uid,String title,String detail,String query,boolean alert,int id) {
        if(!uid.equals(owner(c)))return;
        try {
            var p=prefs(c); JSONArray old=new JSONArray(p.getString("history:"+uid,"[]")),next=new JSONArray();
            next.put(new JSONObject().put("title",title).put("detail",detail).put("query",query).put("at",System.currentTimeMillis()));
            for(int i=0;i<old.length()&&next.length()<30;i++)next.put(old.get(i));
            p.edit().putString("history:"+uid,next.toString()).apply();
            NotificationManager manager=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
            if(!alert||!manager.areNotificationsEnabled())return;
            manager.createNotificationChannel(new NotificationChannel("music_activity","Music and app updates",NotificationManager.IMPORTANCE_DEFAULT));
            Intent intent=query.equals("@update")?new Intent(c,UpdateActivity.class):new Intent(c,MainActivity.class).putExtra("cine_notifications",true);
            PendingIntent open=PendingIntent.getActivity(c,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            manager.notify(id,new Notification.Builder(c,"music_activity").setSmallIcon(R.drawable.ic_cine_notification)
                .setContentTitle(title).setContentText(detail).setStyle(new Notification.BigTextStyle().bigText(detail)).setContentIntent(open).setAutoCancel(true).build());
        }catch(Exception ignored){}
    }
    static void downloaded(Context c,JSONObject track) {
        record(c,owner(c),"Download completed",track.optString("title"),track.optString("title")+" "+track.optString("artist"),prefs(c).getBoolean("downloads",true),18022);
    }
    private static String norm(String value){return Normalizer.normalize(value,Normalizer.Form.NFKD).replaceAll("\\p{M}","").toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+"," ").trim();}
    private static JSONObject read(String address) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(address).openConnection();
        connection.setConnectTimeout(8000);connection.setReadTimeout(8000);connection.setUseCaches(false);
        try {
            if(connection.getResponseCode()!=200)throw new IOException("Could not check releases. Try again later.");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=connection.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();if(bytes.size()+n>1048576)throw new IOException("Release information was too large.");bytes.write(buffer,0,n);}}
            return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
        }finally{connection.disconnect();}
    }
    static void check(Context c) {
        if(!checking.compareAndSet(false,true))return;
        String uid=owner(c);var p=prefs(c);
        try {
            if(p.getBoolean("updates",false)) {
                JSONObject update=UpdateActivity.fetchManifest();long version=update.optLong("versionCode");
                if(version>UpdateActivity.installedVersion(c)&&version>p.getLong("notifiedVersion",0)) {
                    record(c,uid,"Cine music update available","Version "+update.optString("version"),"@update",true,18023);
                    p.edit().putLong("notifiedVersion",version).apply();
                }
            }
            if(!uid.isEmpty()&&p.getBoolean("releases:"+uid,false)) {
                JSONArray artists=new JSONArray(p.getString("artists:"+uid,"[]"));
                int count=Math.min(8,artists.length()),cursor=p.getInt("cursor:"+uid,0);
                for(int i=0;i<count;i++) {
                    if(Thread.currentThread().isInterrupted()||!uid.equals(owner(c)))return;
                    String artist=artists.optString((cursor+i)%artists.length());
                    JSONObject data=read("https://itunes.apple.com/search?entity=song&limit=25&term="+URLEncoder.encode(artist,"UTF-8"));
                    JSONArray songs=data.optJSONArray("results");Map<String,JSONObject> earliest=new LinkedHashMap<>();
                    if(songs!=null)for(int j=0;j<songs.length();j++) {
                        JSONObject song=songs.optJSONObject(j);if(song==null||!norm(song.optString("artistName")).equals(norm(artist)))continue;
                        String key=norm(song.optString("trackName"));JSONObject existing=earliest.get(key);
                        if(existing==null||song.optString("releaseDate").compareTo(existing.optString("releaseDate"))<0)earliest.put(key,song);
                    }
                    for(var entry:earliest.entrySet()) {
                        JSONObject song=entry.getValue();long release;
                        try{release=Instant.parse(song.optString("releaseDate")).toEpochMilli();}catch(Exception invalid){continue;}
                        long now=System.currentTimeMillis();if(release>now||release<now-30L*86400000)continue;
                        String key="seen:"+uid+":"+norm(artist)+":"+entry.getKey();
                        if(p.contains(key))continue;
                        record(c,uid,"New from "+artist,song.optString("trackName"),song.optString("trackName")+" by "+artist,true,18024);
                        p.edit().putLong(key,now).apply();
                    }
                    if(i+1<count)Thread.sleep(3100);
                }
                p.edit().putInt("cursor:"+uid,(cursor+count)%Math.max(1,artists.length())).apply();
            }
            if(!uid.equals(owner(c)))return;
            long now=System.currentTimeMillis();var edit=p.edit().putLong("lastCheck:"+uid,now).remove("error:"+uid);
            for(var entry:p.getAll().entrySet())if(entry.getKey().startsWith("seen:")&&entry.getValue() instanceof Long&&now-(Long)entry.getValue()>60L*86400000)edit.remove(entry.getKey());
            edit.apply();
        }catch(Exception error){if(!Thread.currentThread().isInterrupted()&&uid.equals(owner(c)))p.edit().putString("error:"+uid,"Could not refresh activity. Check your connection and try again.").apply();}finally{checking.set(false);}
    }
}

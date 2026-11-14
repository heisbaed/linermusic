package com.heisbaed.cinemusic;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.widget.*;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/** Foreground review plus Android's permission-return installation flow. */
public class UpdateActivity extends Activity {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private TextView status;private boolean waiting,checking,installing;
    private File apk(){return new File(getCacheDir(),"ota/update.apk");}
    static boolean trustedUrl(String value){try{URI u=new URI(value);return "https".equals(u.getScheme())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)
        &&("cinemusic.web.app".equals(u.getHost())||("github.com".equals(u.getHost())&&u.getPath().startsWith("/heisbaed/linermusic/releases/download/")));}catch(Exception e){return false;}}
    static void verifyPackage(Context c,File file)throws Exception{
        PackageManager pm=c.getPackageManager();
        int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo incoming=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);
        PackageInfo current=pm.getPackageInfo(c.getPackageName(),flags);
        if(incoming==null||!c.getPackageName().equals(incoming.packageName)||(Build.VERSION.SDK_INT>=28?incoming.getLongVersionCode()<=current.getLongVersionCode():incoming.versionCode<=current.versionCode))throw new IOException("This is not a newer Cine music APK");
        Signature[] existing=Build.VERSION.SDK_INT>=28&&current.signingInfo!=null?current.signingInfo.getApkContentsSigners():current.signatures;
        Signature[] candidate=Build.VERSION.SDK_INT>=28&&incoming.signingInfo!=null?incoming.signingInfo.getApkContentsSigners():incoming.signatures;
        if(existing==null||candidate==null)throw new IOException("Could not verify update signer");
        Set<String>a=new HashSet<>(),b=new HashSet<>();
        for(Signature s:existing)a.add(s.toCharsString());
        for(Signature s:candidate)b.add(s.toCharsString());
        if(!a.equals(b))throw new IOException("Update signing certificate does not match");
    }
    public void onCreate(Bundle state){
        super.onCreate(state);waiting=state!=null&&state.getBoolean("waiting");
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(32,64,32,32);
        TextView title=new TextView(this);title.setText("Cine music updates");title.setTextSize(24);layout.addView(title);
        status=new TextView(this);status.setPadding(0,24,0,24);layout.addView(status);
        Button retry=new Button(this);retry.setText("Check again");retry.setOnClickListener(v->{if(apk().exists())offerInstall();else check();});layout.addView(retry);
        Button close=new Button(this);close.setText("Back to music");close.setOnClickListener(v->finish());layout.addView(close);setContentView(layout);
        if(apk().exists())offerInstall();else if("progress".equals(getIntent().getAction()))status.setText("Download progress is in the notification. Return here when it finishes to install.");else check();
    }
    private void check(){
        if(checking)return;checking=true;status.setText("Checking for updates...");
        worker.execute(()->{HttpURLConnection connection=null;try{
            connection=(HttpURLConnection)new URL("https://cinemusic.web.app/ota/manifest.json").openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setUseCaches(false);
            if(connection.getResponseCode()!=200)throw new IOException("Update server is unavailable");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[]buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(bytes.size()+n>65536)throw new IOException("Invalid manifest");bytes.write(buf,0,n);}}
            JSONObject data=new JSONObject(bytes.toString("UTF-8"));
            if(data.getLong("versionCode")<=BuildConfig.VERSION_CODE){runOnUiThread(()->status.setText("You are up to date. Version "+BuildConfig.VERSION_NAME));return;}
            String url=data.getString("downloadUrl"),hash=data.getString("sha256"),version=data.getString("version");long size=data.getLong("fileSize");
            if(!trustedUrl(url)||!hash.matches("[a-fA-F0-9]{64}")||size<=0||size>200_000_000)throw new IOException("Update metadata is incomplete");
            runOnUiThread(()->{if(isFinishing()||isDestroyed())return;status.setText("Version "+version+" is available.");
                new AlertDialog.Builder(this).setTitle("Update Cine music").setMessage(data.optString("releaseNotes")+"\n\nDownload: "+String.format(Locale.ROOT,"%.1f MB",size/1048576.0))
                    .setNegativeButton("Later",(d,w)->{}).setPositiveButton("Download",(d,w)->{
                        startForegroundService(new Intent(this,OTAUpdateService.class).setAction("download").putExtra("url",url).putExtra("sha256",hash).putExtra("size",size));
                        status.setText("Downloading. You can return to music; tap the notification when ready.");}).show();});
        }catch(Exception e){runOnUiThread(()->status.setText("Could not check for updates. "+(e.getMessage()==null?"Try again.":e.getMessage())));}finally{if(connection!=null)connection.disconnect();checking=false;}});
    }
    private void offerInstall(){try{verifyPackage(this,apk());status.setText("The downloaded update is ready to install.");
        new AlertDialog.Builder(this).setTitle("Install update").setMessage("Confirm installation in Android. Your music library will be kept.").setNegativeButton("Later",(d,w)->{}).setPositiveButton("Install",(d,w)->install()).show();
    }catch(Exception e){apk().delete();getSharedPreferences("cine_updates",MODE_PRIVATE).edit().remove("install_message").remove("install_session").apply();check();}}
    private void install(){
        if(!getPackageManager().canRequestPackageInstalls()){waiting=true;startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())));return;}
        if (installing) return;
        installing = true; status.setText("Preparing the update for Android...");
        worker.execute(() -> {
            PackageInstaller installer = getPackageManager().getPackageInstaller(); int sessionId = -1;
            try {
                verifyPackage(this, apk());
                android.content.SharedPreferences prefs = getSharedPreferences("cine_updates", MODE_PRIVATE);
                int previous = prefs.getInt("install_session", -1);
                if (previous >= 0) { try { installer.abandonSession(previous); } catch (Exception ignored) {} }
                PackageInstaller.SessionParams parameters = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                parameters.setAppPackageName(getPackageName()); parameters.setSize(apk().length());
                if (Build.VERSION.SDK_INT >= 31) parameters.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
                sessionId = installer.createSession(parameters);
                prefs.edit().putInt("install_session", sessionId).putString("install_message", "Confirm the update in Android.").commit();
                try (PackageInstaller.Session session = installer.openSession(sessionId)) {
                    try (InputStream input = new FileInputStream(apk()); OutputStream output = session.openWrite("base.apk", 0, apk().length())) {
                        byte[] buffer = new byte[65536]; int count;
                        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                        session.fsync(output);
                    }
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    PendingIntent callback = PendingIntent.getBroadcast(this, sessionId, new Intent(this, UpdateInstallReceiver.class), flags);
                    session.commit(callback.getIntentSender());
                }
                runOnUiThread(() -> status.setText("Confirm the update in Android. Installation can take a minute while Android verifies it."));
            } catch (Exception error) {
                if (sessionId >= 0) { try { installer.abandonSession(sessionId); } catch (Exception ignored) {} }
                runOnUiThread(() -> status.setText("Could not install. " + error.getMessage()));
            } finally { installing = false; }
        });
    }
    protected void onResume(){super.onResume();if(waiting){waiting=false;if(getPackageManager().canRequestPackageInstalls())install();else status.setText("Installation permission was not granted. Reopen Updates to retry.");}else {String message=getSharedPreferences("cine_updates",MODE_PRIVATE).getString("install_message","");if(!message.isEmpty())status.setText(message);}}
    protected void onSaveInstanceState(Bundle b){super.onSaveInstanceState(b);b.putBoolean("waiting",waiting);}
    protected void onDestroy(){worker.shutdownNow();super.onDestroy();}
}

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
    private TextView status, details; private ProgressBar progress; private Button primary;
    private JSONObject available;
    private boolean waiting,checking,installing,readyShown;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable refresh = new Runnable() { public void run() { showDownload(); ui.postDelayed(this, 500); } };
    private File apk(){return new File(getCacheDir(),"ota/update.apk");}
    static long installedVersion(Context c){try{android.content.pm.PackageInfo info=c.getPackageManager().getPackageInfo(c.getPackageName(),0);return Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;}catch(Exception e){return BuildConfig.VERSION_CODE;}}
    static boolean trustedUrl(String value){try{URI u=new URI(value);return "https".equals(u.getScheme())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)
        &&("cinemusic.web.app".equals(u.getHost())||("github.com".equals(u.getHost())&&u.getPath().startsWith("/heisbaed/linermusic/releases/download/")));}catch(Exception e){return false;}}
    static void verifyPackage(Context c,File file)throws Exception{
        PackageManager pm=c.getPackageManager();
        int flags=(Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES) | PackageManager.GET_META_DATA;
        PackageInfo incoming=pm.getPackageArchiveInfo(file.getAbsolutePath(),flags);
        PackageInfo current=pm.getPackageInfo(c.getPackageName(),flags);
        if(incoming==null||!c.getPackageName().equals(incoming.packageName)||(Build.VERSION.SDK_INT>=28?incoming.getLongVersionCode()<=current.getLongVersionCode():incoming.versionCode<=current.versionCode))throw new IOException("This is not a newer Cine music APK");
        String platform=incoming.applicationInfo==null||incoming.applicationInfo.metaData==null?"":incoming.applicationInfo.metaData.getString("com.heisbaed.cinemusic.PLATFORM", "");
        if (!BuildConfig.CINE_PLATFORM.equals(platform)) throw new IOException("This update is for a different Cine music app");
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
        int pad=(int)(24*getResources().getDisplayMetrics().density);
        int background=getSharedPreferences("cine_appearance",MODE_PRIVATE).getInt("background",0xff08231e);
        boolean light=android.graphics.Color.luminance(background)>.5;
        int ink=light?0xff17262b:0xfff6f7fc;
        ScrollView scroll=new ScrollView(this);scroll.setBackgroundColor(background);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(pad,pad,pad,pad);scroll.addView(layout);
        scroll.setOnApplyWindowInsetsListener((view,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());view.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        TextView title=new TextView(this);title.setText("Cine music updates");title.setTextSize(28);title.setTextColor(ink);layout.addView(title);
        status=new TextView(this);status.setTextColor(ink);status.setTextSize(16);status.setPadding(0,pad,0,pad);layout.addView(status);
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);progress.setVisibility(android.view.View.GONE);layout.addView(progress,new LinearLayout.LayoutParams(-1,pad));
        details=new TextView(this);details.setTextColor(ink);details.setPadding(0,pad,0,pad);layout.addView(details);
        primary=new Button(this);primary.setText("Check again");primary.setOnClickListener(v->{if(apk().exists())install();else if(available!=null)download();else check();});layout.addView(primary);
        Button close=new Button(this);close.setText("Back to music");close.setOnClickListener(v->finish());layout.addView(close);setContentView(scroll);
        if(apk().exists())offerInstall();else if(!showDownload())check();
    }
    static JSONObject fetchManifest()throws Exception{
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL("https://cinemusic.web.app/ota/" + ("tv".equals(BuildConfig.CINE_PLATFORM) ? "tv-manifest.json" : "manifest.json")).openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setUseCaches(false);
            if(connection.getResponseCode()!=200)throw new IOException("Update server is unavailable");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[]buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(bytes.size()+n>65536)throw new IOException("Invalid manifest");bytes.write(buf,0,n);}}
            JSONObject manifest = new JSONObject(bytes.toString("UTF-8"));
            String platform = manifest.optString("platform");
            if (!BuildConfig.CINE_PLATFORM.equals(platform)) throw new IOException("Update channel does not match this app");
            return manifest;
        }finally{if(connection!=null)connection.disconnect();}
    }
    private void check(){
        if(checking)return;checking=true;getSharedPreferences("cine_updates",MODE_PRIVATE).edit().remove("download_state").apply();primary.setEnabled(false);status.setText("Checking for updates...");
        worker.execute(()->{try{
            JSONObject data=fetchManifest();
            if(data.getLong("versionCode")<=installedVersion(this)){runOnUiThread(()->{available=null;status.setText("You are up to date. Version "+BuildConfig.VERSION_NAME);primary.setEnabled(true);primary.setText("Check again");});return;}
            String url=data.getString("downloadUrl"),hash=data.getString("sha256"),version=data.getString("version");long size=data.getLong("fileSize");
            if(!trustedUrl(url)||!hash.matches("[a-fA-F0-9]{64}")||size<=0||size>200_000_000)throw new IOException("Update metadata is incomplete");
            runOnUiThread(()->{if(isFinishing()||isDestroyed())return;available=data;status.setText("Version "+version+" is available.");details.setText(data.optString("releaseNotes")+"\n\nDownload: "+String.format(Locale.ROOT,"%.1f MB",size/1048576.0));primary.setText("Download update");primary.setEnabled(true);});
        }catch(Exception e){runOnUiThread(()->{status.setText("Could not check for updates. "+(e.getMessage()==null?"Try again.":e.getMessage()));primary.setEnabled(true);});}finally{checking=false;}});
    }
    private void download(){
        if(available==null)return;
        getSharedPreferences("cine_updates",MODE_PRIVATE).edit().putString("download_state","downloading").putLong("download_bytes",0).putLong("download_total",available.optLong("fileSize")).putLong("download_updated",System.currentTimeMillis()).apply();
        startForegroundService(new Intent(this,OTAUpdateService.class).setAction("download").putExtra("url",available.optString("downloadUrl")).putExtra("sha256",available.optString("sha256")).putExtra("size",available.optLong("fileSize")));
        showDownload();
    }
    private boolean showDownload(){
        if(installing||waiting)return true;
        if(apk().exists()){if(!readyShown)offerInstall();return true;}
        android.content.SharedPreferences prefs=getSharedPreferences("cine_updates",MODE_PRIVATE);
        String state=prefs.getString("download_state","");
        if(state.equals("downloading")||state.equals("verifying")){
            if(System.currentTimeMillis()-prefs.getLong("download_updated",0)>90000){prefs.edit().putString("download_state","failed").putString("download_message","Download interrupted. Please retry.").apply();return true;}
            long bytes=prefs.getLong("download_bytes",0),total=prefs.getLong("download_total",0);
            int percent=total>0?(int)Math.min(100,bytes*100/total):0;
            progress.setVisibility(android.view.View.VISIBLE);progress.setIndeterminate(state.equals("verifying")||total<=0);progress.setProgress(percent);
            status.setText(state.equals("verifying")?"Verifying update...":"Downloading update - "+percent+"%");
            details.setText(String.format(Locale.ROOT,"%.1f MB / %.1f MB",bytes/1048576.0,total/1048576.0));primary.setText("Downloading...");primary.setEnabled(false);return true;
        }
        if(state.equals("failed")&&!checking){progress.setVisibility(android.view.View.GONE);status.setText(prefs.getString("download_message","Download failed. Please retry."));primary.setText(available==null?"Check again":"Retry download");primary.setEnabled(true);return true;}
        return false;
    }
    private void offerInstall(){try{verifyPackage(this,apk());readyShown=true;progress.setVisibility(android.view.View.VISIBLE);progress.setIndeterminate(false);progress.setProgress(100);status.setText("The downloaded update is ready to install.");details.setText("Confirm installation in Android. Your music library will be kept.");primary.setText("Install update");primary.setEnabled(true);
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
    protected void onResume(){super.onResume();ui.removeCallbacks(refresh);ui.post(refresh);if(waiting){waiting=false;if(getPackageManager().canRequestPackageInstalls())install();else status.setText("Installation permission was not granted. Tap Install update to retry.");}else {String message=getSharedPreferences("cine_updates",MODE_PRIVATE).getString("install_message","");if(!message.isEmpty())status.setText(message);}}
    protected void onPause(){ui.removeCallbacks(refresh);super.onPause();}
    protected void onSaveInstanceState(Bundle b){super.onSaveInstanceState(b);b.putBoolean("waiting",waiting);}
    protected void onDestroy(){ui.removeCallbacks(refresh);worker.shutdownNow();super.onDestroy();}
}

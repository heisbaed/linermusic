package com.heisbaed.cinemusic;

import android.content.Context;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import org.json.JSONObject;

/** A wake-up channel only. The owner still validates fresh state and each command epoch. */
final class ConnectCommandStream {
    private final Context context;
    private final String database,device;
    private final Runnable signal;
    private final ExecutorService reader=Executors.newSingleThreadExecutor();
    private volatile String owner="";
    private volatile int generation;
    private volatile HttpURLConnection connection;
    private volatile boolean connected;
    ConnectCommandStream(Context context,String database,String device,Runnable signal){this.context=context;this.database=database;this.device=device;this.signal=signal;}
    boolean connected(){return connected;}
    synchronized void watch(String uid){
        if(owner.equals(uid))return;
        owner=uid;int epoch=++generation;connected=false;
        HttpURLConnection old=connection;if(old!=null)old.disconnect();
        if(!uid.isEmpty())reader.execute(()->listen(uid,epoch));
    }
    private void listen(String uid,int epoch){
        long delay=1000;
        while(epoch==generation){
            HttpURLConnection current=null;
            try{
                JSONObject account=AuthStore.read(context);
                if(!uid.equals(account.optString("localId")))return;
                String address=database+"/users/"+encode(uid)+"/connect/commands/"+encode(device)+".json?auth="+encode(account.getString("idToken"));
                java.net.URL endpoint=new java.net.URL(address);
                String expectedPath=endpoint.getPath();
                for(int redirect=0;redirect<4;redirect++){
                    if(!endpoint.getProtocol().equals("https")||endpoint.getUserInfo()!=null||(endpoint.getPort()!=-1&&endpoint.getPort()!=443)
                        ||!endpoint.getPath().equals(expectedPath)||!(endpoint.getHost().equals(new java.net.URL(database).getHost())||endpoint.getHost().matches("s-[a-z0-9-]+\\.firebaseio\\.com")))throw new java.io.IOException("Unsupported command redirect");
                    current=(HttpURLConnection)endpoint.openConnection();connection=current;current.setInstanceFollowRedirects(false);
                    current.setRequestProperty("Accept","text/event-stream");current.setReadTimeout(45000);current.setConnectTimeout(5000);
                    int status=current.getResponseCode();
                    if(status==307||status==308){java.net.URL target=new java.net.URL(endpoint,current.getHeaderField("Location"));current.disconnect();endpoint=target;continue;}
                    if(status!=200)throw new java.io.IOException("Command stream unavailable");
                    break;
                }
                if(current==null||current.getResponseCode()!=200)throw new java.io.IOException("Command stream unavailable");
                if(epoch!=generation)return;
                connected=true;delay=1000;
                try(BufferedReader input=new BufferedReader(new InputStreamReader(current.getInputStream(),StandardCharsets.UTF_8))){
                    String event="",line;StringBuilder data=new StringBuilder();
                    while(epoch==generation&&(line=input.readLine())!=null){
                        if(line.isEmpty()){
                            if((event.equals("put")||event.equals("patch"))&&data.length()>0){
                                JSONObject update=new JSONObject(data.toString());Object value=update.opt("data");
                                if(hasCommand(value))signal.run();
                            }
                            if(event.equals("cancel")||event.equals("auth_revoked"))break;
                            event="";data.setLength(0);
                        }else if(line.startsWith("event:"))event=line.substring(6).trim();
                        else if(line.startsWith("data:")){data.append(line.substring(5).trim());if(data.length()>1048576)throw new java.io.IOException("Command event too large");}
                    }
                }
            }catch(Exception unavailable){/* The existing polling path remains available. */}
            finally{if(current!=null)current.disconnect();if(connection==current){connection=null;connected=false;}}
            if(epoch!=generation)return;
            try{Thread.sleep(delay);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();return;}
            delay=Math.min(10000,delay*2);
        }
    }
    private static boolean hasCommand(Object value){
        if(!(value instanceof JSONObject))return false;
        JSONObject object=(JSONObject)value;if(object.has("action"))return true;
        java.util.Iterator<String> keys=object.keys();
        while(keys.hasNext()){JSONObject item=object.optJSONObject(keys.next());if(item!=null&&item.has("action"))return true;}
        return false;
    }
    private static String encode(String value)throws Exception{return URLEncoder.encode(value,StandardCharsets.UTF_8.name());}
}

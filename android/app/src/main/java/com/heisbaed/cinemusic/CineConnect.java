package com.heisbaed.cinemusic;

import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Account playback ownership and remote commands live outside the Activity.
 * The current owner pauses before transferring its fenced session to another device.
 */
final class CineConnect {
    private static final long LEASE_MS = 20000;
    private static final long DEVICE_MS = 35000;
    private static volatile CineConnect instance;
    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private final ConnectCommandStream commandStream;
    private final java.util.concurrent.atomic.AtomicBoolean commandWake = new java.util.concurrent.atomic.AtomicBoolean();
    private long lastCommandPoll;
    private JSONArray lastEventQueue;
    private boolean presentingRemote;
    private final java.util.concurrent.atomic.AtomicBoolean seekQueued=new java.util.concurrent.atomic.AtomicBoolean();
    private static final class SeekRequest { final double value; final String user; SeekRequest(double value,String user){this.value=value;this.user=user;} }
    private volatile SeekRequest pendingSeek=new SeekRequest(0,"");
    private final SharedPreferences preferences;
    private final String deviceId;
    private final String deviceName;
    private final boolean tv;
    private final String database;
    private final String apiKey;
    private volatile boolean foreground;
    private volatile boolean network;
    private volatile JSONObject state = new JSONObject();
    private volatile String localJson = PlaybackService.idleSnapshot().toString();
    private volatile String viewJson = localJson;
    private volatile String infoJson = "{}";
    private JSONObject user = new JSONObject();
    private JSONObject devices = new JSONObject();
    private JSONObject queueData = new JSONObject();
    private String etag = "";
    private String uid = "";
    private String adoptedEpoch = "";
    private String publishedQueue = "";
    private String lastInfo = "";
    private long lastPresence;
    private long lastWrite;
    private long lastRead;
    private long confirmedUntil;
    private long serverOffset;
    private String message = "";

    static CineConnect get(Context context) {
        if (instance == null) {
            synchronized (CineConnect.class) {
                if (instance == null) instance = new CineConnect(context.getApplicationContext());
            }
        }
        return instance;
    }

    private CineConnect(Context context) {
        this.context = context;
        preferences = context.getSharedPreferences("cine_connect", Context.MODE_PRIVATE);
        String saved = preferences.getString("deviceId", "");
        deviceId = saved.isEmpty() ? UUID.randomUUID().toString() : saved;
        preferences.edit().putString("deviceId", deviceId).apply();
        UiModeManager mode = (UiModeManager) context.getSystemService(Context.UI_MODE_SERVICE);
        tv = "tv".equals(BuildConfig.CINE_PLATFORM);
        deviceName = tv ? Build.MANUFACTURER + " TV" : Build.MODEL;
        String configuredDatabase = "", configuredKey = "";
        try (InputStream input = context.getAssets().open("firebase-config.json")) {
            JSONObject config = new JSONObject(read(input, 16384));
            configuredDatabase = config.getString("databaseURL").replaceAll("/+$", "");
            configuredKey = config.getString("apiKey");
            MainActivity.configureNetworkHosts(context);
            if (!MainActivity.allowedNetworkUrl(configuredDatabase + "/")) throw new IllegalArgumentException();
        } catch (Exception unavailable) { configuredDatabase = ""; }
        database = configuredDatabase;
        apiKey = configuredKey;
        commandStream = new ConnectCommandStream(context,database,deviceId,this::wakeCommands);
        worker.scheduleWithFixedDelay(this::tick, 0, 1000, TimeUnit.MILLISECONDS);
    }

    void foreground(boolean visible) {
        foreground = visible;
        worker.execute(() -> { lastPresence = 0; tick(); });
    }

    void accountChanged() { worker.execute(this::tick); }
    String snapshot() { return viewJson; }
    String devices() { return infoJson; }

    void localState(JSONObject value) {
        try { value.put("remoteDeviceId", ""); value.put("remoteDeviceName", ""); } catch (Exception ignored) {}
        localJson = value.toString();
        if (!remote()) {
            viewJson = localJson;
            if (PlaybackService.instance != null) PlaybackService.instance.present(value);
            emitPlayer(value);
        }
    }

    boolean route(String action, double value) {
        if (!java.util.Arrays.asList("pause", "resume", "next", "previous", "seek").contains(action)) return false;
        String requestUser=AuthStore.read(context).optString("localId");
        if (database.isEmpty() || requestUser.isEmpty()) return false;
        if("seek".equals(action)){pendingSeek=new SeekRequest(value,requestUser);if(!seekQueued.compareAndSet(false,true))return true;}
        worker.execute(() -> {
            SeekRequest seek=pendingSeek;
            double selected="seek".equals(action)?seek.value:value;
            String selectedUser="seek".equals(action)?seek.user:requestUser;
            try {
                refreshAccount();
                if(!selectedUser.equals(uid))return;
                if (!online()) {
                    if (!tv) localCommand(action, selected);
                    return;
                }
                refreshState();
                if (alive(state)) sendCommand(state, action, Events.json("value", selected));
                else if ("resume".equals(action)) {
                    JSONObject payload = localPayload();
                    if (payload.has("id")) begin(payload, deviceId);
                } else localCommand(action, selected);
            } catch (Exception unavailable) { failure("Could not reach the selected playback device."); }
            finally{if("seek".equals(action)){seekQueued.set(false);SeekRequest next=pendingSeek;if(next!=seek&&next.user.equals(AuthStore.read(context).optString("localId")))route("seek",next.value);}}
        });
        return true;
    }

    void play(String json) {
        String requestUser=AuthStore.read(context).optString("localId");
        worker.execute(() -> {
            try {
                JSONObject payload = new JSONObject(json);
                refreshAccount();
                if(!requestUser.equals(uid))return;
                if (!online()) {
                    if (!tv) playLocal(payload, false);
                    else failure("Reconnect the TV to play music.");
                    return;
                }
                refreshState();
                // An action made directly on the TV selects that TV.
                String target = tv ? deviceId : alive(state) ? state.optString("owner") : preferredDevice();
                if (alive(state) && !target.equals(state.optString("owner"))) {
                    sendCommand(state, "transfer", Events.json("target", target, "play", payload));
                } else if (alive(state)) {
                    sendCommand(state, "play", payload);
                } else begin(payload, target);
            } catch (Exception unavailable) { failure("Playback could not connect. Please try again."); }
        });
    }

    void queue(String json, boolean shuffle, String repeat) {
        String requestUser=AuthStore.read(context).optString("localId");
        worker.execute(() -> {
            try {
                JSONObject payload = Events.json("queue", new JSONArray(json), "shuffle", shuffle, "repeat", repeat);
                refreshAccount();
                if(!requestUser.equals(uid))return;
                if (!online()) { if (!tv) localQueue(payload); return; }
                refreshState();
                if (alive(state)) sendCommand(state, "queue", payload);
                else localQueue(payload);
            } catch (Exception unavailable) { failure("The queue could not be updated."); }
        });
    }

    void transfer(String target) {
        if (target == null || !target.matches("[A-Za-z0-9-]{1,80}")) return;
        String requestUser=AuthStore.read(context).optString("localId");
        worker.execute(() -> {
            try {
                refreshAccount();
                if(!requestUser.equals(uid))return;
                refreshState();
                if (target.equals(state.optString("owner"))) return;
                JSONObject destination = devices.optJSONObject(target);
                if (!target.equals(deviceId) && (destination == null || destination.optLong("seenAt") + DEVICE_MS < now())) {
                    failure("Open Cine Music on that device and try again.");
                    return;
                }
                if (alive(state)) sendCommand(state, "transfer", Events.json("target", target));
                else {
                    JSONObject payload = localPayload();
                    if (payload.has("id")) begin(payload, target);
                    else claim(PlaybackService.idleSnapshot(), target, false);
                }
            } catch (Exception unavailable) { failure("Could not move playback. Please try again."); }
        });
    }

    private void tick() {
        try {
            refreshAccount();
            network = online();
            if (uid.isEmpty() || database.isEmpty()) { commandStream.watch("");emitView(); return; }
            if (!network) {
                commandStream.watch("");
                if (tv && audible(local())) localCommand("pause", 0);
                emitView();
                return;
            }
            long elapsed = SystemClock.elapsedRealtime();
            if (!foreground && PlaybackService.instance == null && elapsed - lastRead < 5000) return;
            lastRead = elapsed;
            if (elapsed - lastPresence >= 10000) {
                request("devices/" + deviceId, "PUT", Events.json("name", deviceName, "kind", tv ? "tv" : "phone",
                    "seenAt", Events.json(".sv", "timestamp"), "foreground", foreground, "available", foreground || PlaybackService.instance != null), null);
                devices = object(request("devices", "GET", null, null).data);
                lastPresence = elapsed;
            }
            refreshState();
            if (alive(state)) {
                if (deviceId.equals(state.optString("owner"))) {
                    confirmedUntil = state.optLong("expiresAt");
                    commandStream.watch(uid);
                    adopt();
                    if(!commandStream.connected()||elapsed-lastCommandPoll>=5000)receiveCommands();
                    if (deviceId.equals(state.optString("owner")) && elapsed - lastWrite >= 1500) publishState();
                } else {
                    commandStream.watch("");
                    if (audible(local())) localCommand("pause", 0);
                    receiveQueue();
                }
            } else if (confirmedUntil > 0 && now() >= confirmedUntil && audible(local())) {
                commandStream.watch("");
                localCommand("pause", 0);
            }
            message = "";
            emitView();
        } catch (Exception unavailable) {
            // An online device must stop at its last confirmed lease boundary.
            if (confirmedUntil > 0 && now() >= confirmedUntil && online() && audible(local())) localCommand("pause", 0);
            if (tv && audible(local()) && now() >= confirmedUntil) localCommand("pause", 0);
            message = "Device connection is retrying.";
            emitView();
        }
    }

    private void refreshAccount() throws Exception {
        JSONObject saved = AuthStore.read(context);
        String next = saved.optBoolean("emailVerified") ? saved.optString("localId") : "";
        if (!next.equals(uid)) {
            if (!uid.isEmpty() && audible(local())) localCommand("pause", 0);
            uid = next;
            state = new JSONObject();
            queueData = new JSONObject();
            devices = new JSONObject();
            adoptedEpoch = "";
            publishedQueue = "";
            confirmedUntil = 0;
            lastPresence = 0;
        }
        user = saved;
        if (uid.isEmpty()) return;
        if (saved.optLong("expiresAt") > System.currentTimeMillis() + 120000) return;
        HttpURLConnection connection = MainActivity.connection("https://securetoken.googleapis.com/v1/token?key=" + encode(apiKey));
        try {
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            byte[] body = ("grant_type=refresh_token&refresh_token=" + encode(saved.getString("refreshToken"))).getBytes(StandardCharsets.UTF_8);
            connection.getOutputStream().write(body);
            if (connection.getResponseCode() != 200) throw new IllegalStateException("Session refresh failed");
            JSONObject response = new JSONObject(read(connection.getInputStream(), 16384));
            if (!uid.equals(response.optString("user_id"))) throw new IllegalStateException("Account changed");
            JSONObject latest = AuthStore.read(context);
            if (!uid.equals(latest.optString("localId"))) throw new IllegalStateException("Account changed");
            if(!saved.optString("refreshToken").equals(latest.optString("refreshToken"))||!saved.optString("idToken").equals(latest.optString("idToken"))){user=latest;return;}
            latest.put("idToken", response.getString("id_token"));
            latest.put("refreshToken", response.getString("refresh_token"));
            latest.put("expiresAt", System.currentTimeMillis() + response.getLong("expires_in") * 1000);
            AuthStore.write(context, latest.toString());
            user = latest;
        } finally { connection.disconnect(); }
    }

    private void refreshState() throws Exception {
        Response response = request("state", "GET", null, null);
        state = object(response.data);
        etag = response.etag;
    }

    private String preferredDevice() {
        Iterator<String> ids = devices.keys();
        while (ids.hasNext()) {
            String id = ids.next();
            JSONObject value = devices.optJSONObject(id);
            if (value != null && "tv".equals(value.optString("kind")) && value.optBoolean("available")
                && value.optLong("seenAt") + DEVICE_MS >= now()) return id;
        }
        return deviceId;
    }

    private void begin(JSONObject payload, String target) throws Exception {
        JSONObject value = Events.json("track", cleanTrack(payload), "queue", cleanQueue(payload.optJSONArray("queue")),
            "shuffle", payload.optBoolean("shuffle"), "repeat", payload.optString("repeat", "off"),
            "status", "loading", "positionMs", payload.optLong("startPositionMs"), "durationMs", payload.optLong("durationMs"));
        claim(value, target, true);
    }

    private void claim(JSONObject value, String target, boolean resume) throws Exception {
        String epoch = UUID.randomUUID().toString();
        JSONObject desired = stateFor(value, target, epoch);
        desired.put("resume", resume);
        writeQueue(value, target, epoch, desired);
        Response response = request("state", "PUT", desired, etag);
        if (response.code == 412) throw new IllegalStateException("Playback changed on another device");
        state = object(response.data);
        etag = response.etag;
        if (target.equals(deviceId)) {
            adoptedEpoch = epoch;
            confirmedUntil = state.optLong("expiresAt");
            JSONObject track = value.optJSONObject("track");
            if (track != null && !track.optString("id").isEmpty()) {
                JSONObject payload = payload(value);
                playLocal(payload, !resume);
            }
        }
        emitView();
    }

    private void adopt() throws Exception {
        String epoch = state.optString("epoch");
        if (epoch.equals(adoptedEpoch)) return;
        receiveQueue();
        if (!epoch.equals(queueData.optString("epoch"))) return;
        JSONObject track = state.optJSONObject("track");
        adoptedEpoch = epoch;
        if (track == null || track.optString("id").isEmpty()) return;
        JSONObject value = object(state);
        value.put("queue", queueData.optJSONArray("queue"));
        value.put("shuffle", queueData.optBoolean("shuffle"));
        value.put("repeat", queueData.optString("repeat", "off"));
        playLocal(payload(value), !state.optBoolean("resume"));
    }

    private void publishState() throws Exception {
        JSONObject current = local();
        if (current.optJSONObject("track") == null && state.optJSONObject("track") != null) return;
        JSONObject desired = stateFor(current, deviceId, state.getString("epoch"));
        writeQueue(current, deviceId, state.getString("epoch"), desired);
        Response response = request("state", "PUT", desired, etag);
        if (response.code == 412) { refreshState(); return; }
        state = object(response.data);
        etag = response.etag;
        confirmedUntil = state.optLong("expiresAt");
        lastWrite = SystemClock.elapsedRealtime();
    }

    private JSONObject stateFor(JSONObject player, String owner, String epoch) {
        JSONObject known = devices.optJSONObject(owner);
        return Events.json("owner", owner, "epoch", epoch, "name", owner.equals(deviceId) ? deviceName : known == null ? "Cine Music device" : known.optString("name"),
            "track", player.optJSONObject("track") == null ? JSONObject.NULL : cleanTrack(player.optJSONObject("track")),
            "status", player.optString("status", "paused"), "positionMs", player.optLong("positionMs"),
            "durationMs", player.optLong("durationMs"), "error", player.optString("error"),
            "updatedAt", now(), "expiresAt", now() + LEASE_MS);
    }

    private void writeQueue(JSONObject player, String owner, String epoch, JSONObject desired) throws Exception {
        JSONObject blob = Events.json("epoch", epoch, "queue", cleanQueue(player.optJSONArray("queue")),
            "shuffle", player.optBoolean("shuffle"), "repeat", player.optString("repeat", "off"));
        String signature = hash(blob.toString());
        blob.put("signature", signature);
        if (!signature.equals(publishedQueue) || !owner.equals(deviceId)) {
            request("queues/" + owner, "PUT", blob, null);
            if (owner.equals(deviceId)) publishedQueue = signature;
        }
        desired.put("queueSignature", signature);
        if (owner.equals(deviceId)) queueData = blob;
    }

    private void receiveQueue() throws Exception {
        String signature = state.optString("queueSignature");
        if (signature.isEmpty() || signature.equals(queueData.optString("signature"))) return;
        JSONObject blob = object(request("queues/" + state.getString("owner"), "GET", null, null).data);
        if (state.optString("epoch").equals(blob.optString("epoch")) && signature.equals(blob.optString("signature"))) queueData = blob;
    }

    private void sendCommand(JSONObject selected, String action, JSONObject data) throws Exception {
        if (deviceId.equals(selected.optString("owner"))) {
            execute(action, data);
            if (deviceId.equals(state.optString("owner"))) publishState();
            return;
        }
        String id = String.format(java.util.Locale.ROOT, "%016d", now()) + "-" + UUID.randomUUID();
        request("commands/" + selected.getString("owner") + "/" + id, "PUT",
            Events.json("epoch", selected.getString("epoch"), "action", action, "data", data, "expiresAt", now() + 15000), null);
    }

    private void receiveCommands() throws Exception {
        lastCommandPoll=SystemClock.elapsedRealtime();
        JSONObject inbox = object(request("commands/" + deviceId, "GET", null, null).data);
        JSONObject removals = new JSONObject();
        List<String> keys = new ArrayList<>();
        inbox.keys().forEachRemaining(keys::add);
        Collections.sort(keys);
        Set<String> handled = new HashSet<>(preferences.getStringSet("commands:" + uid, Collections.emptySet()));
        for (String key : keys) {
            JSONObject command = inbox.optJSONObject(key);
            if (command == null) continue;
            boolean valid = deviceId.equals(state.optString("owner")) && state.optString("epoch").equals(command.optString("epoch"))
                && command.optLong("expiresAt") > now();
            if (valid && !handled.contains(key)) {
                execute(command.optString("action"), command.optJSONObject("data"));
                handled.add(key);
                if (handled.size() > 80) {
                    List<String> sorted = new ArrayList<>(handled);
                    Collections.sort(sorted);
                    handled = new HashSet<>(sorted.subList(sorted.size() - 40, sorted.size()));
                }
                preferences.edit().putStringSet("commands:" + uid, handled).commit();
            }
            removals.put(key,JSONObject.NULL);
        }
        if(removals.length()>0)request("commands/"+deviceId,"PATCH",removals,null);
    }
    private void wakeCommands(){
        if(!commandWake.compareAndSet(false,true))return;
        worker.execute(()->{
            commandWake.set(false);
            try{
                refreshAccount();if(uid.isEmpty()||!online())return;
                refreshState();
                if(alive(state)&&deviceId.equals(state.optString("owner"))){
                    adopt();receiveCommands();
                    if(deviceId.equals(state.optString("owner")))publishState();
                    emitView();
                }
            }catch(Exception unavailable){/* Polling retries without changing ownership. */}
        });
    }
    private synchronized void emitPlayer(JSONObject value){
        JSONArray items=value.optJSONArray("queue");
        JSONObject event=value;
        if(items==lastEventQueue){
            event=new JSONObject();Iterator<String> fields=value.keys();
            try{while(fields.hasNext()){String key=fields.next();if(!key.equals("queue"))event.put(key,value.opt(key));}}
            catch(Exception unavailable){event=value;}
        }
        else lastEventQueue=items;
        Events.send(context,"player",event);
    }

    private void execute(String action, JSONObject data) throws Exception {
        if (data == null) return;
        switch (action) {
            case "play": playLocal(data, false); break;
            case "queue": localQueue(data); break;
            case "transfer":
                String target = data.optString("target");
                if (!target.matches("[A-Za-z0-9-]{1,80}")) return;
                boolean resume = audible(local());
                localCommand("pause", 0);
                refreshState();
                if (!deviceId.equals(state.optString("owner"))) return;
                JSONObject replacement = data.optJSONObject("play");
                if (replacement != null) begin(replacement, target);
                else claim(local(), target, resume);
                break;
            default:
                if (java.util.Arrays.asList("pause", "resume", "next", "previous", "seek").contains(action)) localCommand(action, data.optDouble("value"));
        }
    }

    private void localCommand(String action, double value) {
        onMain(() -> {
            PlaybackService service = PlaybackService.instance;
            if (service != null) service.commandLocal(action, value);
        });
    }

    private void localQueue(JSONObject payload) {
        onMain(() -> {
            PlaybackService service = PlaybackService.instance;
            if (service != null) service.setQueue(payload.optJSONArray("queue"), payload.optBoolean("shuffle"), payload.optString("repeat", "off"));
        });
    }

    private void playLocal(JSONObject payload, boolean paused) {
        onMain(() -> {
            try {
                JSONObject copy = new JSONObject(payload.toString());
                copy.put("connectPaused", paused);
                PlaybackService service = PlaybackService.instance;
                if (service != null) service.playLocal(copy);
                else context.startForegroundService(PlaybackService.intent(context).setAction("play")
                    .putExtra("track", copy.toString()).putExtra("connectLocal", true));
            } catch (Exception unavailable) { Events.send(context, "playerError", Events.json("message", "Open Cine Music on the selected device to start playback.")); }
        });
    }

    private void onMain(Runnable action) {
        CountDownLatch done = new CountDownLatch(1);
        main.post(() -> { try { action.run(); } finally { done.countDown(); } });
        try { if (!done.await(3, TimeUnit.SECONDS)) throw new IllegalStateException("Playback is busy"); }
        catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
    }

    private boolean remote() {
        JSONObject selected = state;
        return network && alive(selected) && !deviceId.equals(selected.optString("owner"));
    }

    private void emitView() {
        JSONObject selected = state;
        JSONObject view = local();
        try { view.put("remoteDeviceId", ""); view.put("remoteDeviceName", ""); } catch (Exception ignored) {}
        if (remote()) {
            JSONObject value = object(selected);
            long position = value.optLong("positionMs");
            if ("playing".equals(value.optString("status"))) position += Math.max(0, now() - value.optLong("updatedAt", now()));
            value = Events.json("track", value.opt("track"), "status", value.optString("status", "paused"),
                "positionMs", Math.min(position, value.optLong("durationMs", position)), "durationMs", value.optLong("durationMs"),
                "error", value.optString("error"), "queue", queueData.optJSONArray("queue") == null ? new JSONArray() : queueData.optJSONArray("queue"),
                "shuffle", queueData.optBoolean("shuffle"), "repeat", queueData.optString("repeat", "off"),
                "output", selected.optString("name"), "remoteDeviceId", selected.optString("owner"), "remoteDeviceName", selected.optString("name"));
            view = value;
        }
        viewJson = view.toString();
        if (PlaybackService.instance != null) PlaybackService.instance.present(view);
        else if (foreground && remote()) {
            try { context.startForegroundService(PlaybackService.intent(context).setAction("remote")); } catch (Exception ignored) {}
        }
        boolean remoteView=remote();
        if(remoteView||presentingRemote||lastEventQueue==null)emitPlayer(view);
        presentingRemote=remoteView;
        JSONArray list = new JSONArray();
        Iterator<String> ids = devices.keys();
        while (ids.hasNext()) {
            String id = ids.next();
            JSONObject value = devices.optJSONObject(id);
            if (value != null && value.optLong("seenAt") + DEVICE_MS > now() && value.optBoolean("available")) {
                list.put(Events.json("id", id, "name", value.optString("name"), "kind", value.optString("kind"), "thisDevice", id.equals(deviceId)));
            }
        }
        boolean included = false;
        for (int i = 0; i < list.length(); i++) if (deviceId.equals(list.optJSONObject(i).optString("id"))) included = true;
        if (!included) list.put(Events.json("id", deviceId, "name", deviceName, "kind", tv ? "tv" : "phone", "thisDevice", true));
        JSONObject info = Events.json("deviceId", deviceId, "devices", list, "activeDeviceId", alive(selected) ? selected.optString("owner") : "",
            "activeDeviceName", alive(selected) ? selected.optString("name") : "", "online", network, "message", message);
        infoJson = info.toString();
        if (!infoJson.equals(lastInfo)) {
            Events.send(context, "connect", info);
            lastInfo = infoJson;
        }
    }

    private JSONObject localPayload() { return payload(local()); }

    private static JSONObject payload(JSONObject player) {
        JSONObject track = player.optJSONObject("track");
        if (track == null) return new JSONObject();
        JSONObject value = object(track);
        try {
            value.put("queue", player.optJSONArray("queue") == null ? new JSONArray().put(track) : player.optJSONArray("queue"));
            value.put("shuffle", player.optBoolean("shuffle"));
            value.put("repeat", player.optString("repeat", "off"));
            value.put("startPositionMs", player.optLong("positionMs"));
        } catch (Exception ignored) {}
        return value;
    }

    private JSONObject local() { try { return new JSONObject(localJson); } catch (Exception ignored) { return PlaybackService.idleSnapshot(); } }
    private boolean alive(JSONObject value) { return !value.optString("owner").isEmpty() && value.optLong("expiresAt") > now(); }
    private long now() { return System.currentTimeMillis() + serverOffset; }

    private boolean online() {
        ConnectivityManager manager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkCapabilities caps = manager == null ? null : manager.getNetworkCapabilities(manager.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void failure(String text) {
        message = text;
        Events.send(context, "playerError", Events.json("message", text));
        emitView();
    }

    private Response request(String path, String method, JSONObject value, String match) throws Exception {
        if (uid.isEmpty() || !uid.equals(AuthStore.read(context).optString("localId"))) throw new IllegalStateException("Account changed");
        String address = database + "/users/" + encode(uid) + "/connect/" + path + ".json?auth=" + encode(user.getString("idToken"));
        HttpURLConnection connection = MainActivity.connection(address);
        try {
            connection.setConnectTimeout(4000);
            connection.setReadTimeout(5000);
            connection.setRequestMethod(method);
            connection.setRequestProperty("X-Firebase-ETag", "true");
            connection.setRequestProperty("Content-Type", "application/json");
            if (match != null && !match.isEmpty()) connection.setRequestProperty("If-Match", match);
            if (value != null) {
                connection.setDoOutput(true);
                connection.getOutputStream().write(value.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = connection.getResponseCode();
            long date = connection.getDate();
            if (date > 0) serverOffset = date - System.currentTimeMillis();
            String result = read(code >= 400 ? connection.getErrorStream() : connection.getInputStream(), 8388608);
            if (code >= 400 && code != 412) throw new IllegalStateException("Playback connection unavailable");
            return new Response(code, result.equals("null") || result.isEmpty() ? new JSONObject() : new JSONObject(result), connection.getHeaderField("ETag"));
        } finally { connection.disconnect(); }
    }

    private static String read(InputStream input, int limit) throws Exception {
        if (input == null) return "";
        try (InputStream source = input; ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = source.read(buffer)) != -1) {
                if (bytes.size() + count > limit) throw new IllegalStateException("Playback response too large");
                bytes.write(buffer, 0, count);
            }
            return bytes.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String encode(String value) throws Exception { return URLEncoder.encode(value, StandardCharsets.UTF_8.name()); }
    private static JSONObject object(Object value) {
        try { return value instanceof JSONObject ? new JSONObject(value.toString()) : new JSONObject(); }
        catch (Exception ignored) { return new JSONObject(); }
    }
    private static boolean audible(JSONObject value) { return "playing".equals(value.optString("status")) || "loading".equals(value.optString("status")); }
    private static JSONObject cleanTrack(JSONObject value) {
        JSONObject clean = new JSONObject();
        for (String key : java.util.Arrays.asList("id", "title", "artist", "artistId", "albumId", "cover", "durationMs")) {
            try { if (value.has(key)) clean.put(key, value.get(key)); } catch (Exception ignored) {}
        }
        return clean;
    }
    private static JSONArray cleanQueue(JSONArray queue) {
        JSONArray clean = new JSONArray();
        if (queue != null) {
            for (int i = 0; i < queue.length(); i++) {
                JSONObject value = queue.optJSONObject(i);
                if (value != null && !value.optString("id").isEmpty()) clean.put(cleanTrack(value));
            }
        }
        return clean;
    }
    private static String hash(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        return android.util.Base64.encodeToString(digest, android.util.Base64.NO_WRAP | android.util.Base64.URL_SAFE | android.util.Base64.NO_PADDING);
    }
    private static final class Response {
        final int code;
        final JSONObject data;
        final String etag;
        Response(int code, JSONObject data, String etag) { this.code = code; this.data = data; this.etag = etag == null ? "" : etag; }
    }
}


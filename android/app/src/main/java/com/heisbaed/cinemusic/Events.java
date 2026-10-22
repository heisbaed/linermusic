package com.heisbaed.cinemusic;

import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

final class Events {
    static final String ACTION = "com.heisbaed.cinemusic.EVENT";
    static final String PERMISSION = "com.heisbaed.cinemusic.INTERNAL";
    static void send(Context context, String type, JSONObject data) {
        context.sendBroadcast(new Intent(ACTION).setPackage(context.getPackageName())
            .putExtra("type", type).putExtra("data", data.toString()), PERMISSION);
    }
    static JSONObject json(Object... pairs) {
        JSONObject result = new JSONObject();
        try { for (int i = 0; i < pairs.length; i += 2) result.put(pairs[i].toString(), pairs[i + 1]); }
        catch (Exception error) { throw new IllegalArgumentException(error); }
        return result;
    }
}

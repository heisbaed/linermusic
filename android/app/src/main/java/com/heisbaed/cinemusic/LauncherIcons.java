package com.heisbaed.cinemusic;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import java.util.ArrayList;
import java.util.List;

final class LauncherIcons {
    private static final String[] NAMES = {"forest", "mint", "rose", "ivory"};
    private static ComponentName component(Context context, String name) {
        return new ComponentName(context.getPackageName(), context.getPackageName() + ".Icon_" + name);
    }
    static String get(Context context) { return context.getSharedPreferences("cine_appearance", Context.MODE_PRIVATE).getString("launcher_icon", "forest"); }
    static synchronized boolean set(Context context, String selected) {
        if (!java.util.Arrays.asList(NAMES).contains(selected)) return false;
        PackageManager pm = context.getPackageManager();
        int[] previous = new int[NAMES.length];
        for (int i=0;i<NAMES.length;i++) previous[i] = pm.getComponentEnabledSetting(component(context,NAMES[i]));
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                List<PackageManager.ComponentEnabledSetting> changes = new ArrayList<>();
                for (String name : NAMES) changes.add(new PackageManager.ComponentEnabledSetting(component(context,name),name.equals(selected)?PackageManager.COMPONENT_ENABLED_STATE_ENABLED:PackageManager.COMPONENT_ENABLED_STATE_DISABLED,PackageManager.DONT_KILL_APP));
                pm.setComponentEnabledSettings(changes);
            } else {
                pm.setComponentEnabledSetting(component(context,selected),PackageManager.COMPONENT_ENABLED_STATE_ENABLED,PackageManager.DONT_KILL_APP);
                for (String name : NAMES) if (!name.equals(selected)) pm.setComponentEnabledSetting(component(context,name),PackageManager.COMPONENT_ENABLED_STATE_DISABLED,PackageManager.DONT_KILL_APP);
            }
            context.getSharedPreferences("cine_appearance",Context.MODE_PRIVATE).edit().putString("launcher_icon",selected).apply();
            return true;
        } catch (Exception error) {
            for(int i=0;i<NAMES.length;i++) try{pm.setComponentEnabledSetting(component(context,NAMES[i]),previous[i],PackageManager.DONT_KILL_APP);}catch(Exception ignored){}
            return false;
        }
    }
}

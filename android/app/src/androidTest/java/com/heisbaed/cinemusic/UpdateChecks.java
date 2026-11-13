package com.heisbaed.cinemusic;
import android.app.*;
import android.os.Bundle;
import java.io.File;

public class UpdateChecks {
    static void verify(android.content.Context context) throws Exception {
        if(!UpdateActivity.trustedUrl("https://cinemusic.web.app/ota/app.apk"))throw new AssertionError("Hosting URL rejected");
        if(!UpdateActivity.trustedUrl("https://github.com/heisbaed/linermusic/releases/download/v0.1.2/Cine-Music-0.1.2.apk"))throw new AssertionError("Release URL rejected");
        for(String url:new String[]{"http://cinemusic.web.app/app.apk","https://cinemusic.web.app.evil.invalid/app.apk","https://github.com/other/project/releases/download/app.apk","https://user@cinemusic.web.app/app.apk","https://cinemusic.web.app:444/app.apk"})if(UpdateActivity.trustedUrl(url))throw new AssertionError("Untrusted update source accepted");
        boolean rejected=false;try{UpdateActivity.verifyPackage(context,new File(context.getApplicationInfo().sourceDir));}catch(Exception expected){rejected=true;}
        if(!rejected)throw new AssertionError("Same-version package accepted");
    }
}

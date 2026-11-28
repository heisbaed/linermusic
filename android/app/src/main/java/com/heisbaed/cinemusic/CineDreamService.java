package com.heisbaed.cinemusic;

import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.service.dreams.DreamService;
import android.view.Gravity;
import android.view.KeyEvent;
import android.widget.*;
import org.json.JSONObject;

/** Optional system-selected TV screensaver, using the existing playback session. */
public final class CineDreamService extends DreamService {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private ImageView backdrop,cover;
    private TextView title,artist;
    private ImageButton play,previous,next;
    private LinearLayout panel;
    private String artwork="";
    private int ink,accent;
    private long lastShift;
    private int shift;
    private int dp(float value){return (int)(value*getResources().getDisplayMetrics().density+.5f);}
    @Override public void onAttachedToWindow(){
        super.onAttachedToWindow();setInteractive(true);setFullscreen(true);setScreenBright(false);
        int background=getSharedPreferences("cine_appearance",MODE_PRIVATE).getInt("background",0xff08231e);
        boolean light=Color.luminance(background)>.5;ink=light?0xff17262b:0xfff6f7fc;
        accent=light?0xff006c75:background==0xff071f19?0xffcbf595:background==0xff101112?0xffdadcd6:0xffff8eba;
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(background);
        backdrop=new ImageView(this);backdrop.setScaleType(ImageView.ScaleType.CENTER_CROP);backdrop.setAlpha(.16f);root.addView(backdrop,new FrameLayout.LayoutParams(-1,-1));
        panel=new LinearLayout(this);panel.setOrientation(LinearLayout.HORIZONTAL);panel.setGravity(Gravity.CENTER_VERTICAL);panel.setPadding(dp(32),dp(24),dp(32),dp(24));
        FrameLayout.LayoutParams centered=new FrameLayout.LayoutParams(-2,-2,Gravity.CENTER);root.addView(panel,centered);
        cover=new ImageView(this);cover.setImageResource(R.drawable.cine_icon);cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        panel.addView(cover,new LinearLayout.LayoutParams(dp(190),dp(190)));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setPadding(dp(28),0,0,0);panel.addView(info,new LinearLayout.LayoutParams(dp(390),-2));
        TextView brand=new TextView(this);brand.setText("Cine music");brand.setTextColor(ink);brand.setTextSize(14);info.addView(brand);
        title=new TextView(this);title.setTextColor(ink);title.setTextSize(26);title.setMaxLines(2);title.setEllipsize(android.text.TextUtils.TruncateAt.END);info.addView(title);
        artist=new TextView(this);artist.setTextColor(ink);artist.setAlpha(.72f);artist.setTextSize(16);artist.setMaxLines(2);info.addView(artist);
        LinearLayout controls=new LinearLayout(this);controls.setPadding(0,dp(16),0,0);info.addView(controls);
        previous=button("Previous",R.drawable.ic_cine_previous,()->command("previous"));controls.addView(previous);
        play=button("Play",R.drawable.ic_cine_play,()->command("playing".equals(PlaybackService.systemState().optString("status"))?"pause":"resume"));controls.addView(play);
        next=button("Next",R.drawable.ic_cine_next,()->command("next"));controls.addView(next);
        setContentView(root);render();play.requestFocus();
    }
    private ImageButton button(String label,int icon,Runnable action){
        ImageButton button=new ImageButton(this);button.setContentDescription(label);button.setImageResource(icon);button.setColorFilter(ink);
        button.setLayoutParams(new LinearLayout.LayoutParams(dp(64),dp(64)));button.setPadding(dp(19),dp(19),dp(19),dp(19));
        android.graphics.drawable.GradientDrawable normal=new android.graphics.drawable.GradientDrawable();normal.setColor(Color.TRANSPARENT);normal.setCornerRadius(dp(32));
        android.graphics.drawable.GradientDrawable focus=new android.graphics.drawable.GradientDrawable();focus.setColor(Color.TRANSPARENT);focus.setCornerRadius(dp(32));focus.setStroke(dp(2),accent);
        android.graphics.drawable.StateListDrawable background=new android.graphics.drawable.StateListDrawable();background.addState(new int[]{android.R.attr.state_focused},focus);background.addState(new int[]{},normal);button.setBackground(background);
        button.setOnClickListener(view->action.run());return button;
    }
    private void command(String action){PlaybackService service=PlaybackService.instance;if(service!=null)service.command(action,0);}
    private final Runnable refresh=new Runnable(){public void run(){render();handler.postDelayed(this,2000);}};
    private void render(){
        JSONObject state=PlaybackService.systemState(),song=state.optJSONObject("track");
        title.setText(song==null?"Find your rhythm.":song.optString("title"));artist.setText(song==null?"Open Cine music to choose a song.":song.optString("artist"));
        boolean active=song!=null;play.setEnabled(active);previous.setEnabled(active);next.setEnabled(active);
        boolean playing="playing".equals(state.optString("status"));play.setImageResource(playing?R.drawable.ic_cine_pause:R.drawable.ic_cine_play);play.setContentDescription(playing?"Pause":"Play");
        String address=song==null?"":song.optString("cover");
        if(!address.equals(artwork)){artwork=address;cover.setImageResource(R.drawable.cine_icon);backdrop.setImageDrawable(null);
            if(!address.isEmpty())MediaArtwork.load(this,address,image->{if(address.equals(artwork)&&image!=null){cover.setImageBitmap(image);backdrop.setImageBitmap(image);}});}
        long now=android.os.SystemClock.elapsedRealtime();
        if(now-lastShift>60000&&android.animation.ValueAnimator.areAnimatorsEnabled()){
            lastShift=now;shift=(shift+1)%4;panel.setTranslationX(dp(shift%2==0?-10:10));panel.setTranslationY(dp(shift<2?-6:6));
        }
    }
    @Override public void onDreamingStarted(){super.onDreamingStarted();handler.post(refresh);}
    @Override public void onDreamingStopped(){handler.removeCallbacksAndMessages(null);super.onDreamingStopped();}
    @Override public void onDetachedFromWindow(){handler.removeCallbacksAndMessages(null);artwork="";super.onDetachedFromWindow();}
    @Override public boolean dispatchKeyEvent(KeyEvent event){
        if(event.getAction()!=KeyEvent.ACTION_DOWN)return super.dispatchKeyEvent(event);
        int code=event.getKeyCode();
        if(code==KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE){command("playing".equals(PlaybackService.systemState().optString("status"))?"pause":"resume");return true;}
        if(code==KeyEvent.KEYCODE_MEDIA_NEXT){command("next");return true;}
        if(code==KeyEvent.KEYCODE_MEDIA_PREVIOUS){command("previous");return true;}
        return super.dispatchKeyEvent(event);
    }
}

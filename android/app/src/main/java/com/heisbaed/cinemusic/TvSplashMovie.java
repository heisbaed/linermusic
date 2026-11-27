package com.heisbaed.cinemusic;

import android.content.Context;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.media.MediaPlayer;
import android.view.Surface;
import android.view.TextureView;
import android.widget.FrameLayout;
import android.widget.ImageView;

/** A single local video composition. App readiness still determines dismissal. */
final class TvSplashMovie extends FrameLayout implements TextureView.SurfaceTextureListener {
    private final TextureView texture;
    private MediaPlayer player;
    private Surface surface;
    private boolean revealed;
    private boolean prepared;
    private int videoWidth=1280,videoHeight=720;
    private final int movie;
    TvSplashMovie(Context context){
        super(context);
        String icon=LauncherIcons.get(context);
        if(!java.util.Arrays.asList("forest","mint","rose","ivory").contains(icon))icon="rose";
        int poster=getResources().getIdentifier("cine_tv_splash_"+icon,"drawable",context.getPackageName());
        movie=getResources().getIdentifier("cine_tv_intro_"+icon,"raw",context.getPackageName());
        setBackgroundColor(context.getSharedPreferences("cine_appearance",Context.MODE_PRIVATE).getInt("background",android.graphics.Color.rgb(255,243,247)));
        ImageView fallback=new ImageView(context);fallback.setImageResource(poster);fallback.setScaleType(ImageView.ScaleType.FIT_CENTER);
        addView(fallback,new LayoutParams(-1,-1));
        texture=new TextureView(context);texture.setOpaque(false);texture.setAlpha(0);texture.setSurfaceTextureListener(this);
        addView(texture,new LayoutParams(-1,-1));
    }
    void reveal(){revealed=true;if(player!=null&&prepared){try{player.start();}catch(Exception ignored){}}}
    public void onSurfaceTextureAvailable(SurfaceTexture value,int width,int height){
        if(!android.animation.ValueAnimator.areAnimatorsEnabled())return;
        try{
            surface=new Surface(value);player=new MediaPlayer();
            android.content.res.AssetFileDescriptor file=getResources().openRawResourceFd(movie);
            try{player.setDataSource(file.getFileDescriptor(),file.getStartOffset(),file.getLength());}finally{file.close();}
            player.setSurface(surface);player.setVolume(0,0);player.setLooping(false);
            player.setOnPreparedListener(media->{prepared=true;if(revealed)media.start();});
            player.setOnVideoSizeChangedListener((media,w,h)->{videoWidth=w;videoHeight=h;fit();});
            player.setOnInfoListener((media,what,extra)->{if(what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START)texture.setAlpha(1);return false;});
            player.setOnErrorListener((media,what,extra)->{texture.setAlpha(0);return true;});
            player.prepareAsync();
        }catch(Exception unavailable){texture.setAlpha(0);release();}
    }
    private void fit(){
        int width=texture.getWidth(),height=texture.getHeight();if(width<=0||height<=0||videoWidth<=0||videoHeight<=0)return;
        float scale=Math.min(width/(float)videoWidth,height/(float)videoHeight);
        float x=videoWidth*scale/width,y=videoHeight*scale/height;
        Matrix matrix=new Matrix();matrix.setScale(x,y,width/2f,height/2f);texture.setTransform(matrix);
    }
    public void onSurfaceTextureSizeChanged(SurfaceTexture value,int width,int height){fit();}
    public void onSurfaceTextureUpdated(SurfaceTexture value){}
    public boolean onSurfaceTextureDestroyed(SurfaceTexture value){release();return true;}
    private void release(){prepared=false;if(player!=null){player.release();player=null;}if(surface!=null){surface.release();surface=null;}}
    @Override protected void onDetachedFromWindow(){release();super.onDetachedFromWindow();}
}

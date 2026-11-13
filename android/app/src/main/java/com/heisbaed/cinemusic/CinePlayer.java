package com.heisbaed.cinemusic;

import android.content.Context;
import android.media.*;
import android.net.Uri;
import android.os.Handler;
import java.io.IOException;
import java.util.Map;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;

/** Keep encrypted local decoding, but use a bounded startup buffer for network audio. */
final class CinePlayer {
    private MediaPlayer local = new MediaPlayer();
    private ExoPlayer stream;
    private MediaPlayer.OnPreparedListener prepared;
    private MediaPlayer.OnCompletionListener completed;
    private MediaPlayer.OnErrorListener failed;
    private MediaPlayer.OnInfoListener info;
    private MediaPlayer.OnSeekCompleteListener seeked;
    private boolean ready;
    private boolean playWhenReady = true;
    private float volume = 1f;

    void setAudioAttributes(AudioAttributes attributes) { if (local != null) local.setAudioAttributes(attributes); }
    void setWakeMode(Context context, int mode) { if (local != null) local.setWakeMode(context, mode); }
    void setOnPreparedListener(MediaPlayer.OnPreparedListener listener) { prepared=listener; if (local != null) local.setOnPreparedListener(listener); }
    void setOnCompletionListener(MediaPlayer.OnCompletionListener listener) { completed=listener; if (local != null) local.setOnCompletionListener(listener); }
    void setOnErrorListener(MediaPlayer.OnErrorListener listener) { failed=listener; if (local != null) local.setOnErrorListener(listener); }
    void setOnInfoListener(MediaPlayer.OnInfoListener listener) { info=listener; if (local != null) local.setOnInfoListener(listener); }
    void setOnSeekCompleteListener(MediaPlayer.OnSeekCompleteListener listener) { seeked=listener; if (local != null) local.setOnSeekCompleteListener(listener); }
    void addOnRoutingChangedListener(AudioRouting.OnRoutingChangedListener listener, Handler handler) { if (local != null) local.addOnRoutingChangedListener(listener,handler); }
    void setDataSource(MediaDataSource source) throws IOException {
        if (local == null) {
            if (stream != null) throw new IOException("Player is already streaming");
            local = new MediaPlayer();
        }
        local.setDataSource(source);
    }
    void setDataSource(Context context, Uri uri, Map<String,String> headers) throws IOException {
        if (!MainActivity.allowedNetworkUrl(uri.toString()) || uri.getHost()==null || !uri.getHost().endsWith(".googlevideo.com")) throw new IOException("Unsupported audio address");
        local.release(); local=null;
        DefaultHttpDataSource.Factory http=new DefaultHttpDataSource.Factory()
            .setUserAgent("Mozilla/5.0").setDefaultRequestProperties(headers)
            .setConnectTimeoutMs(5000).setReadTimeoutMs(8000).setAllowCrossProtocolRedirects(false);
        stream=new ExoPlayer.Builder(context)
            .setLoadControl(new DefaultLoadControl.Builder()
                .setBufferDurationsMs(5000,15000,750,1500)
                .setPrioritizeTimeOverSizeThresholds(true).build()).build();
        stream.setAudioAttributes(new androidx.media3.common.AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),false);
        stream.setWakeMode(C.WAKE_MODE_NETWORK);
        stream.setPlayWhenReady(playWhenReady);
        stream.setVolume(volume);
        stream.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if(state==Player.STATE_READY) {
                    if(!ready) { ready=true; if(prepared!=null)prepared.onPrepared(null); }
                    else if(info!=null)info.onInfo(null,MediaPlayer.MEDIA_INFO_BUFFERING_END,0);
                } else if(state==Player.STATE_BUFFERING && ready) {
                    if(info!=null)info.onInfo(null,MediaPlayer.MEDIA_INFO_BUFFERING_START,0);
                } else if(state==Player.STATE_ENDED && completed!=null)completed.onCompletion(null);
            }
            @Override public void onPlayerError(PlaybackException error) {
                if(failed!=null)failed.onError(null,MediaPlayer.MEDIA_ERROR_UNKNOWN,error.errorCode);
            }
            @Override public void onPositionDiscontinuity(Player.PositionInfo oldPosition,Player.PositionInfo newPosition,int reason) {
                if(reason==Player.DISCONTINUITY_REASON_SEEK && seeked!=null)seeked.onSeekComplete(null);
            }
        });
        stream.setMediaSource(new ProgressiveMediaSource.Factory(http).createMediaSource(MediaItem.fromUri(uri)));
    }
    void prepareAsync() { if(stream!=null)stream.prepare(); else local.prepareAsync(); }
    void setPlayWhenReady(boolean value) { playWhenReady=value; if(stream!=null)stream.setPlayWhenReady(value); }
    void start() { playWhenReady=true; if(stream!=null)stream.play(); else local.start(); }
    void pause() { playWhenReady=false; if(stream!=null)stream.pause(); else if(local!=null)local.pause(); }
    boolean isPlaying() { return stream!=null?stream.isPlaying():local!=null&&local.isPlaying(); }
    long getCurrentPosition() { return stream!=null?stream.getCurrentPosition():local.getCurrentPosition(); }
    long getDuration() { return stream!=null?Math.max(0,stream.getDuration()):local.getDuration(); }
    int getAudioSessionId() { return stream!=null?stream.getAudioSessionId():local.getAudioSessionId(); }
    AudioDeviceInfo getRoutedDevice() { return local==null?null:local.getRoutedDevice(); }
    void seekTo(long position,int mode) { if(stream!=null)stream.seekTo(position); else local.seekTo(position,mode); }
    void setVolume(float left,float right) { volume=Math.max(0f,Math.min(1f,Math.min(left,right))); if(stream!=null)stream.setVolume(volume); else if(local!=null)local.setVolume(volume,volume); }
    void release() { if(stream!=null){stream.release();stream=null;} if(local!=null){local.release();local=null;} }
}

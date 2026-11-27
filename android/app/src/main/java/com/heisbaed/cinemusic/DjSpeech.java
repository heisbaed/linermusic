package com.heisbaed.cinemusic;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.List;

/** Installed device voices only. Never requests voice downloads or a cloud voice. */
final class DjSpeech {
    private static DjSpeech instance;
    static synchronized DjSpeech get(Context context) { if(instance==null)instance=new DjSpeech(context.getApplicationContext());return instance; }
    static synchronized void stopIfActive() { if(instance!=null)instance.stop(); }
    private final Context context;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final List<Voice> voices=new CopyOnWriteArrayList<>();
    private TextToSpeech tts;
    private volatile boolean ready;
    private String current="";
    private final AudioManager audio;
    private final AudioFocusRequest focus;
    private DjSpeech(Context context) {
        this.context=context;audio=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        AudioAttributes attributes=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setOnAudioFocusChangeListener(change->{if(change<0)stop();},main).build();
        main.post(()->tts=new TextToSpeech(context,status->main.post(()->{
            if(status==TextToSpeech.SUCCESS){
                if(tts.getVoices()!=null)for(Voice voice:tts.getVoices())if(!voice.isNetworkConnectionRequired()&&(voice.getFeatures()==null||!voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)))voices.add(voice);
                ready=true;tts.setAudioAttributes(attributes);tts.setSpeechRate(.98f);
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                    public void onStart(String id){emit(id,"speaking","");}
                    public void onDone(String id){finish(id,"done","");}
                    public void onError(String id){finish(id,"error","The installed voice could not speak. Music playback is still available.");}
                    public void onStop(String id,boolean interrupted){finish(id,"cancelled","");}
                });
            }
            Events.send(context,"djVoices",info());
        })));
    }
    synchronized JSONObject info(){
        JSONArray languages=new JSONArray();
        boolean english=false,swahili=false;
        for(Voice voice:voices){if("en".equals(voice.getLocale().getLanguage()))english=true;if("sw".equals(voice.getLocale().getLanguage()))swahili=true;}
        if(english)languages.put("en");if(swahili)languages.put("sw");
        return Events.json("ready",ready,"languages",languages);
    }
    void speak(String id,String text,String language){main.post(()->{
        Voice selected=null;
        for(Voice voice:voices)if(language.equals(voice.getLocale().getLanguage())){selected=voice;if("US".equals(voice.getLocale().getCountry())||"TZ".equals(voice.getLocale().getCountry()))break;}
        if(!ready||selected==null){emit(id,"error","An installed voice is unavailable for this language.");return;}
        if(text==null||text.trim().isEmpty()||text.length()>500){emit(id,"error","The introduction could not be spoken.");return;}
        if(audio.requestAudioFocus(focus)!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED){emit(id,"error","Audio output is busy. Try again.");return;}
        current=id;tts.setVoice(selected);
        if(tts.speak(text,TextToSpeech.QUEUE_FLUSH,null,id)==TextToSpeech.ERROR)finish(id,"error","The introduction could not be spoken.");
    });}
    void stop(){main.post(()->{String id=current;if(tts!=null)tts.stop();if(!id.isEmpty())finish(id,"cancelled","");});}
    private void finish(String id,String status,String message){main.post(()->{if(id.equals(current)){current="";audio.abandonAudioFocusRequest(focus);}emit(id,status,message);});}
    private void emit(String id,String status,String message){Events.send(context,"djSpeech",Events.json("id",id,"status",status,"message",message));}
}

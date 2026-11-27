import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { PageHeader, Cover, SongRows } from './ui';
import { TvSongs } from './TvLayout';
import { Icon } from './Icons';
import { createDjSet, rememberDjSet, type DjSet } from './djEngine';
import { speakDjIntro } from './djVoice';
import { subscribe } from './native';
import { loadSaved, save } from './library';
import { loadCineUser } from './FirebaseAuth';
import { isTvEnvironment } from './spatialNav';
import type { Song } from './types';
import type { RadioMode } from './smartFeatures';
import './dj-cine.css';

export function DjCineLauncher(){const app=useApp();return <button className="dj-launcher" onClick={()=>app.openRoute({kind:'dj'})}><Icon name="sparkles" size={23}/><span><strong>Dj Cine</strong><small>Your request. Your next set.</small></span><Icon name="chevron_right" size={20}/></button>;}
export function DjCine({ seed }: { seed?: Song }) {
  const app=useApp(), owner=app.account.user?.localId||'guest', tv=isTvEnvironment();
  const [request,setRequest]=useState(''),[mode,setMode]=useState<RadioMode>('balanced');
  const [language,setLanguage]=useState<'en'|'sw'>(()=>loadSaved('dj-language:'+owner,'en'));
  const [ai,setAi]=useState(true),[voice,setVoice]=useState(()=>loadSaved('dj-voice:'+owner,false));
  const [voices,setVoices]=useState<{ready:boolean;languages:string[]}>({ready:false,languages:[]});
  const [listening,setListening]=useState(false),[busy,setBusy]=useState(false),[stage,setStage]=useState(''),[error,setError]=useState('');
  const [starting,setStarting]=useState(false),[saved,setSaved]=useState('');
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [set,setSet]=useState<DjSet|null>(()=>{const last=loadSaved<DjSet|null>('dj-set:'+owner,null);return last&&Array.isArray(last.songs)&&last.songs.every(song=>song&&typeof song.id==='string'&&typeof song.title==='string'&&typeof song.artist==='string')?last:null;});
  const task=useRef<AbortController|null>(null),mounted=useRef(true),startBusy=useRef(false),skipIntro=useRef(false),savedRef=useRef('');
  const canSpeak=voices.ready&&voices.languages.includes(language)&&!app.playback.player.remoteDeviceId;
  const canListen=!!window.CineAndroid?.hasDjVoiceInput?.();
  useEffect(()=>{
    mounted.current=true;
    const stop=subscribe(event=>{
      if(event.type==='djVoices')setVoices({ready:!!event.data.ready,languages:Array.isArray(event.data.languages)?event.data.languages as string[]:[]});
      if(event.type==='djVoiceResult'){setRequest(String(event.data.text||'').slice(0,240));setListening(false);}
      if(event.type==='djVoiceCancelled')setListening(false);
    });
    try{if(window.CineAndroid?.djVoiceInfo)setVoices(JSON.parse(window.CineAndroid.djVoiceInfo()));}catch{/* Music controls remain available without an installed voice. */}
    return()=>{mounted.current=false;task.current?.abort();if(startBusy.current)window.CineAndroid?.stopDjVoice?.();stop();};
  },[owner]);
  async function generate(useAI=ai, anchor=seed, text=request){
    if(task.current)return;
    if(!app.online){setError('Connect to make a new DJ set. Your downloaded music stays available in Library.');return;}
    const controller=new AbortController();task.current=controller;setBusy(true);setError('');
    try{
      const result=await createDjSet({request:text,seed:anchor,language,mode,ai:useAI,owner,favorites:app.account.library.favorites,recent:app.prefs.privateListening?[]:app.account.library.recent,hidden:app.smart.hidden,signal:controller.signal,progress:value=>{if(!controller.signal.aborted)setStage(value);}});
      if(controller.signal.aborted)return;
      setSet(result);setSaved('');savedRef.current='';save('dj-set:'+owner,result);
    }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Your DJ set could not be prepared.');}
    finally{if(task.current===controller){task.current=null;if(mounted.current){setBusy(false);setStage('');}}}
  }
  async function playSet(){
    if(!set?.songs.length||startBusy.current)return;
    const selected=set;startBusy.current=true;skipIntro.current=false;setStarting(true);
    try{
      if(voice&&canSpeak){
        if(app.playback.player.status==='playing'||app.playback.player.status==='loading')app.playback.toggle();
        try{await speakDjIntro(selected.intro,selected.language||language);}catch(reason){
          if(reason instanceof DOMException&&reason.name==='AbortError'&&!skipIntro.current)return;
          if(!(reason instanceof DOMException&&reason.name==='AbortError'))app.toast('The voice is unavailable. Starting your music.');
        }
      }
      if(!mounted.current||(loadCineUser()?.localId||'guest')!==owner)return;
      rememberDjSet(owner,selected);app.playback.setRepeat('off');app.playback.playAll(selected.songs,false,'Dj Cine');app.openPlayer();
    }finally{startBusy.current=false;if(mounted.current)setStarting(false);}
  }
  function saveSet(){
    if(!set)return;
    const existing=savedRef.current||saved;
    if(existing&&app.account.library.playlists.some(item=>item.id===existing)){app.openRoute({kind:'playlist',id:existing});return;}
    const id=crypto.randomUUID();savedRef.current=id;setSaved(id);
    app.account.setLibrary(library=>({...library,playlists:[{id,name:('Dj Cine · '+set.request).slice(0,100),songs:set.songs,isPublic:false,cover:set.songs[0]?.cover},...library.playlists]}));
    app.toast('DJ set saved to Library.');
  }
  if(tv)return <section className="tv-page dj-cine dj-tv dj-tv-studio">
    <header className="dj-tv-header"><button className="tv-button" aria-label="Back" onClick={app.back}><Icon name="back" size={20}/></button><h1>Dj Cine</h1></header>
    <div className="dj-tv-layout"><section className="dj-tv-composer">
      <span className="dj-tv-mark"><Icon name="sparkles" size={26}/></span><h2>What’s your sound?</h2>
      {seed&&<div className="dj-seed"><Cover song={seed}/><span><strong>{seed.title}</strong><small>{seed.artist}</small></span></div>}
      <form onSubmit={event=>{event.preventDefault();window.CineAndroid?.hideTvKeyboard?.();void generate();}}>
        <label className="dj-request-label"><span>Tell Dj Cine</span><textarea rows={2} value={request} maxLength={240} placeholder={language==='sw'?'Wimbo, msanii au aina ya muziki…':'A song, an artist, a mood…'} onClick={()=>window.CineAndroid?.showTvKeyboard?.()} onChange={event=>setRequest(event.target.value)}/></label>
        <div className="dj-actions"><button className="primary-button" type="submit" disabled={busy||(!request.trim()&&!seed)}>{busy?'Preparing…':'Make my mix'}</button>
          {canListen&&<button type="button" className="secondary-button" disabled={listening||busy} onClick={()=>{setListening(true);window.CineAndroid?.listenDj?.(language);}}>{listening?'Listening…':'Speak request'}</button>}
          {busy&&<button type="button" className="text-button" onClick={()=>{task.current?.abort();task.current=null;setBusy(false);setStage('');}}>Cancel</button>}
        </div>
      </form>
      {busy&&<p className="dj-note" role="status">{stage}</p>}
      {error&&<div className="dj-tv-error" role="alert"><p>{error}</p><div className="dj-actions"><button className="secondary-button" onClick={()=>void generate()}>Retry</button>{ai&&<button className="text-button" onClick={()=>void generate(false)}>Music-only mix</button>}</div></div>}
      <button className="text-button dj-tv-tune" aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(!optionsOpen)}><Icon name="equalizer" size={18}/>Preferences<Icon name={optionsOpen?'chevron_up':'chevron_down'} size={16}/></button>
      {optionsOpen&&<div className="dj-tv-preferences">
        <div className="dj-options" role="group" aria-label="Familiarity">{(['familiar','balanced','discover'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='familiar'?'Familiar':value==='balanced'?'Balanced':'Discover'}</button>)}</div>
        <div className="dj-options" role="group" aria-label="Language">{(['en','sw'] as const).map(value=><button key={value} aria-pressed={language===value} onClick={()=>{setLanguage(value);save('dj-language:'+owner,value);}}>{value==='en'?'English':'Kiswahili'}</button>)}</div>
        <div className="dj-options"><button role="switch" aria-checked={ai} onClick={()=>setAi(!ai)}>AI requests · {ai?'On':'Off'}</button><button role="switch" aria-checked={voice&&canSpeak} disabled={!canSpeak} onClick={()=>{setVoice(!voice);save('dj-voice:'+owner,!voice);}}>Spoken intro · {voice&&canSpeak?'On':'Off'}</button></div>
        {!canSpeak&&<small className="dj-note">An installed voice is unavailable for this language or playback device.</small>}
        <small className="dj-note">Online requests use your selected music context. Private listening excludes recent listening history.</small>
      </div>}
    </section><section className="dj-tv-selection" aria-label="Your DJ mix">
      {set?<><header><h2>{set.request}</h2><small>{set.songs.length} songs</small><p className="dj-tv-intro">{set.intro}</p></header><div className="dj-actions"><button className="primary-button" disabled={starting} onClick={()=>void playSet()}><Icon name="play" size={20}/>{starting?'Starting…':'Play mix'}</button>{starting&&<button className="secondary-button" onClick={()=>{skipIntro.current=true;window.CineAndroid?.stopDjVoice?.();}}>Skip intro</button>}<button className="secondary-button" onClick={saveSet}>{saved?'Open playlist':'Save'}</button><button className="secondary-button" disabled={busy} onClick={()=>void generate(ai,app.playback.player.track||set.songs[0],'')}>More like this</button></div><TvSongs songs={set.songs} title="Dj Cine"/></>
        :<div className="dj-tv-await"><Icon name="music" size={36}/><h2>Your next mix</h2><p>Choose a song, artist or mood.</p></div>}
    </section></div>
  </section>;
  const content=<>
    {tv?<header className="dj-title"><h1>Dj Cine</h1><button className="tv-button" onClick={app.back}>Back</button></header>:<PageHeader title="Dj Cine"/>}
    <div className="dj-request-card"><span className="dj-emblem"><Icon name="sparkles" size={28}/></span><h2>What should we play?</h2><p>Choose a vibe. Let the next set follow your lead.</p>
      {seed&&<div className="dj-seed"><Cover song={seed}/><span><strong>{seed.title}</strong><small>Starting from {seed.artist}</small></span></div>}
      <form onSubmit={event=>{event.preventDefault();void generate();}}>
        <label className="dj-request-label">Your music request<textarea value={request} maxLength={240} rows={3} placeholder={language==='sw'?'Mfano: Nyimbo za injili za asubuhi, tulivu na mpya kwangu':'For example: calm gospel for the morning, mostly new to me'} onChange={event=>setRequest(event.target.value)}/></label>
        <div className="dj-examples">{['Morning gospel','Late-night R&B','Amapiano discoveries'].map(example=><button type="button" key={example} onClick={()=>setRequest(example)}>{example}</button>)}</div>
        <div className="dj-options" role="group" aria-label="Familiarity">{(['familiar','balanced','discover'] as const).map(value=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>setMode(value)}>{value==='familiar'?'Familiar':value==='balanced'?'Balanced':'Discover'}</button>)}</div>
        <div className="dj-preferences"><div className="dj-options" role="group" aria-label="DJ language">{(['en','sw'] as const).map(value=><button type="button" key={value} aria-pressed={language===value} onClick={()=>{setLanguage(value);save('dj-language:'+owner,value);}}>{value==='en'?'English':'Kiswahili'}</button>)}</div><label><input type="checkbox" checked={ai} onChange={event=>setAi(event.target.checked)}/>AI requests</label><label><input type="checkbox" checked={voice&&canSpeak} disabled={!canSpeak} onChange={event=>{setVoice(event.target.checked);save('dj-voice:'+owner,event.target.checked);}}/>Spoken introduction</label></div>
        {!canSpeak&&<small className="dj-note">{app.playback.player.remoteDeviceId?'Spoken introductions are available on the device playing music.':'Spoken introductions need an installed device voice for this language.'}</small>}
        <div className="dj-actions"><button className="primary-button" disabled={busy||(!request.trim()&&!seed)} type="submit">{busy?'Preparing your set…':'Ask Dj Cine'}</button>{canListen&&<button className="secondary-button" disabled={listening||busy} type="button" onClick={()=>{setListening(true);window.CineAndroid?.listenDj?.(language);}}><Icon name="lyrics" size={20}/>{listening?'Listening…':'Speak request'}</button>}{busy&&<button type="button" className="text-button" onClick={()=>{task.current?.abort();task.current=null;setBusy(false);setStage('');}}>Cancel</button>}</div>
      </form>
      {busy&&<p role="status" className="dj-note">{stage}</p>}
      {error&&<div className="dj-error" role="alert"><p>{error}</p>{ai&&<button className="secondary-button" onClick={()=>void generate(false)}>Make a music-only set</button>}</div>}
      <small className="dj-note">Online requests use your selected music context. Private listening excludes recent listening history.</small>
    </div>
    {set&&<section className="dj-set"><header><span className="dj-source">{set.ai?'DJ mix':'Music-only mix'}</span><h2>{set.request}</h2><p>{set.intro}</p><small>{set.reason}</small></header><div className="dj-actions"><button className="primary-button" disabled={starting} onClick={()=>void playSet()}><Icon name="play" size={20}/>{starting?'Starting your set…':'Play this set'}</button>{starting&&<button className="secondary-button" onClick={()=>{skipIntro.current=true;window.CineAndroid?.stopDjVoice?.();}}>Skip introduction</button>}<button className="secondary-button" onClick={saveSet}>{saved?'Open saved playlist':'Save playlist'}</button><button className="secondary-button" disabled={busy} onClick={()=>void generate(ai,app.playback.player.track||set.songs[0],'')}>More like this</button></div>{tv?<TvSongs songs={set.songs} title="Dj Cine"/>:<SongRows songs={set.songs} context="Dj Cine"/>}</section>}
  </>;
  return <section className={`screen dj-cine${tv?' dj-tv':''}`}>{content}</section>;
}

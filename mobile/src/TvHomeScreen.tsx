import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { DjCineLauncher } from './DjCine';
import { TvCard, TvShelf } from './TvLayout';
import { Icon } from './Icons';
import { Cover } from './ui';
import { useDiscovery } from './discovery';
import { formatTime } from './library';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { displaySongTitle, relatedSongs } from './catalogQuality';
import { genreCompatible } from './musicMetadata';
import { isHidden } from './smartFeatures';
import { songFrom } from './Browse';
import { homeGreeting } from './greeting';
import type { Song } from './types';

export function TvHomeScreen() {
  const app = useApp();
  const { recent, favorites, artists, playlists } = app.account.library;
  const seed = app.playback.player.track || recent[0] || favorites[0];
  const [view, setView] = useState<'for-you'|'new'|'recent'>('for-you');
  const [edition, setEdition] = useState(() => Math.floor(Date.now()/3_600_000));
  const [radio, setRadio] = useState<{seed:string;songs:Song[]}>({seed:'',songs:[]});
  const [radioError, setRadioError] = useState(''), [radioLoading,setRadioLoading] = useState(false);
  const [starting,setStarting] = useState(false);
  const pending = useRef<AbortController|null>(null);
  const feed = useDiscovery(true,edition);
  const recommendations = radio.seed===seed?.id ? radio.songs : [];
  const featureSong = view==='for-you' ? recommendations[0]||seed : undefined;
  const featureAlbum = view!=='recent' && !featureSong ? feed.items[0] : undefined;
  const checkpoint = app.smart.checkpoint;
  const name = app.account.user?.displayName?.trim().split(/\s+/)[0];
  useEffect(()=>()=>pending.current?.abort(),[]);
  useEffect(()=>{
    if(!seed||!app.online){setRadioLoading(false);return;}
    const task=new AbortController();setRadioError('');setRadioLoading(true);
    void innertubeCatalog.getRadio(seed.id,{signal:task.signal,k:36}).then(result=>{
      if(!task.signal.aborted)setRadio({seed:seed.id,songs:relatedSongs(result.items,[seed]).map(songFrom).filter(song=>!isHidden(song,app.smart.hidden)&&genreCompatible(song,seed)).slice(0,18)});
    }).catch(()=>{if(!task.signal.aborted)setRadioError('Recommendations could not load.');})
      .finally(()=>{if(!task.signal.aborted)setRadioLoading(false);});
    return()=>task.abort();
  },[seed?.id,app.online,edition,app.smart.hidden]);
  async function playFeature(){
    if(!app.online||starting)return;
    if(featureSong){app.playback.setShuffle('off');app.playback.setRepeat('off');void app.playback.play(featureSong,recommendations.length?recommendations:[featureSong],'Made for you');return;}
    if(!featureAlbum)return;
    const task=new AbortController();pending.current?.abort();pending.current=task;setStarting(true);
    try{
      const album=await innertubeCatalog.getAlbum(featureAlbum.id,task.signal);
      if(task.signal.aborted)return;
      const songs=album.tracks.map(track=>({...songFrom(track),albumId:album.id,cover:track.cover?.url||album.cover?.url}));
      if(songs.length){app.playback.setRepeat('off');app.playback.playAll(songs,false,album.title);}
      else app.toast('This release has no playable songs.');
    }catch{if(!task.signal.aborted)app.toast('Could not start this release. Please try again.');}
    finally{if(!task.signal.aborted)setStarting(false);}
  }
  const shelf=(title:string,songs:Song[])=>!!songs.length&&<TvShelf title={title}>{songs.slice(0,18).map(song=><TvCard key={song.id} id={title+'-'+song.id} title={displaySongTitle(song.title,song.artist)} subtitle={song.artist} art={song.cover} song={song} action={()=>{app.playback.setShuffle('off');app.playback.setRepeat('off');void app.playback.play(song,songs,title);}}/>)}</TvShelf>;
  const featureTitle=featureSong?displaySongTitle(featureSong.title,featureSong.artist):featureAlbum?.title;
  const featureArtist=featureSong?.artist||featureAlbum?.artists.map(artist=>artist.name).join(', ');
  const featureArt=featureSong?.cover||featureAlbum?.cover?.url;
  function openFeature(){
    if(featureAlbum)app.openRoute({kind:'catalog',type:'album',id:featureAlbum.id});
    else if(featureSong?.albumId)app.openRoute({kind:'catalog',type:'album',id:featureSong.albumId});
    else if(featureSong)app.openRoute({kind:'dj',seed:featureSong});
  }
  return <section className="tv-page tv-home-page" aria-label="Home">
    <header className="tv-home-top"><div><p>{homeGreeting(new Date().getHours())}{name?', '+name:''}</p><h1>Home</h1></div>
      <div className="tv-home-filters" role="group" aria-label="Home content">{(['for-you','new','recent'] as const).map(value=><button className="tv-button" key={value} aria-pressed={view===value} onClick={()=>setView(value)}>{value==='for-you'?'For you':value==='new'?'New releases':'Recent'}</button>)}
        <button className="tv-button tv-home-refresh" aria-label="Refresh Home" disabled={!app.online||radioLoading||feed.loading||starting} onClick={()=>setEdition(value=>value+1)}><Icon name="refresh" size={20}/></button>
      </div>
    </header>
    {!app.online&&<p className="tv-home-status" role="status">Connect to stream music on TV.</p>}
    {view!=='recent'&&featureTitle&&<section className="tv-home-feature" aria-label={featureSong?'Made for you':'Featured new release'}>
      <div className="tv-home-feature-art" aria-hidden="true"><Cover song={featureSong||{title:featureTitle,cover:featureArt,albumId:featureAlbum?.id}} large/></div>
      <div className="tv-home-feature-copy"><p className="tv-home-feature-label">{featureSong?'Made for you':'New release'}</p><h2>{featureTitle}</h2><p>{featureArtist}</p>
        <div className="tv-actions"><button className="tv-button tv-primary" data-tv-key="featured" disabled={!app.online||starting} onClick={()=>void playFeature()}><Icon name="play" size={20}/>{starting?'Starting…':'Play'}</button><button className="tv-button" onClick={openFeature}>{featureAlbum||featureSong?.albumId?'View release':'Explore with Dj Cine'}<Icon name="chevron_right" size={18}/></button></div>
      </div>
    </section>}
    {view==='for-you'&&<>
      {shelf('Made for you',recommendations)}
      {radioError&&<div className="tv-home-status"><p role="status">{radioError}</p><button className="tv-button" onClick={()=>setEdition(value=>value+1)}>Retry</button></div>}
      <div className="tv-home-personal"><div className="tv-home-shortcuts" aria-label="Your music">
        <button data-tv-key="home-likes" onClick={()=>app.openRoute({kind:'collection',collection:'favorites'})}><Icon name="heart" size={22}/><span>Liked Songs<small>{favorites.length} songs</small></span></button>
        {playlists.slice(0,3).map(playlist=><button key={playlist.id} data-tv-key={'home-'+playlist.id} onClick={()=>app.openRoute({kind:'playlist',id:playlist.id})}><Cover song={{title:playlist.name,cover:playlist.cover||playlist.songs[0]?.cover}}/><span>{playlist.name}<small>{playlist.songs.length} songs</small></span></button>)}
      </div><DjCineLauncher/></div>
      {checkpoint&&checkpoint.song.id!==app.playback.player.track?.id&&<section className="tv-resume"><h2>Continue listening</h2><button className="tv-track" data-tv-key="resume" onClick={()=>void app.playback.play(checkpoint.song,checkpoint.queue,checkpoint.context,checkpoint.positionMs)}><Cover song={checkpoint.song}/><span><strong>{displaySongTitle(checkpoint.song.title,checkpoint.song.artist)}</strong><small>{checkpoint.song.artist} · {formatTime(checkpoint.positionMs)}</small></span><Icon name="play" size={22}/></button></section>}
      {!recommendations.length&&shelf('Back in rotation',recent)}
    </>}
    {view!=='recent'&&!!feed.items.length&&<TvShelf title="New releases">{feed.items.slice(featureAlbum?1:0,18).map(item=><TvCard key={item.id} id={item.id} kind="album" title={item.title} subtitle={item.artists.map(artist=>artist.name).join(', ')} art={item.cover?.url} action={()=>app.openRoute({kind:'catalog',type:'album',id:item.id})}/>)}</TvShelf>}
    {view!=='recent'&&!feed.items.length&&<div className="tv-home-status">{feed.loading?<p role="status">Finding new releases…</p>:feed.error?<><p role="status">{feed.error}</p><button className="tv-button" onClick={feed.retry}>Retry releases</button></>:<p>No releases from the last 30 days are available for your selected artists.</p>}</div>}
    {view==='recent'&&(recent.length?shelf('Recently played',recent):<div className="tv-home-empty"><Icon name="music" size={32}/><h2>Your listening starts here</h2><p>Play a song to find it here again.</p><button className="tv-button" onClick={()=>app.goTab('search')}>Find music</button></div>)}
    {view==='for-you'&&!!artists.length&&<TvShelf title="Your artists">{artists.slice(0,18).map(artist=><TvCard key={artist.id} id={artist.id} kind="artist" title={artist.name} art={artist.cover} action={()=>app.openRoute({kind:'catalog',type:'artist',id:artist.id})}/>)}</TvShelf>}
  </section>;
}

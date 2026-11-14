import { useRef, useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { Cover, Notice } from './ui';
import { Icon } from './Icons';
import { homeGreeting } from './greeting';
import { useDiscovery } from './discovery';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { Song } from './types';
import './home-feed.css';
import { DailyMix } from './DailyMix';
import { isHidden } from './smartFeatures';
import { formatTime } from './library';

export function rotateFeed<T>(items: T[], turn: number): T[] {
  if (!items.length) return [];
  const offset = ((turn % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

export function HomeFeed() {
  const app = useApp();
  const library = app.account.library;
  const [edition, setEdition] = useState(() => Math.floor(Date.now() / 3_600_000));
  const [filter, setFilter] = useState<'all' | 'music' | 'playlists'>('all');
  const feed = useDiscovery(app.tab === 'home', edition);
  const releases = rotateFeed(feed.items, edition);
  const featured = releases[0];
  const [starting, setStarting] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const available = (songs: Song[]) => app.online ? songs : songs.filter(song => app.downloads.some(download => download.id === song.id));
  const recent = available(library.recent).slice(0, 6);
  const favorites = rotateFeed(available(library.favorites).filter(song => !isHidden(song, app.smart.hidden)), edition).slice(0, 10);
  const checkpoint = app.smart.checkpoint;
  const openAlbum = (id: string) => app.openRoute({ kind: 'catalog', type: 'album', id });
  async function playFeatured() {
    if (!featured || starting) return;
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    setStarting(true);
    try {
      const album = await innertubeCatalog.getAlbum(featured.id, controller.signal);
      if (controller.signal.aborted) return;
      const songs = album.tracks.map(track => ({ id: track.id, title: track.title, artist: track.artists.map(a => a.name).join(', '), artistId: track.artists[0]?.id, albumId: album.id, cover: track.cover?.url, durationMs: track.durationMs }));
      if (songs.length) app.playback.playAll(songs, false, album.title);
      else app.toast('This release has no playable songs.');
    } catch { if (!controller.signal.aborted) app.toast('Could not open this release. Please try again.'); }
    finally { if (!controller.signal.aborted) setStarting(false); }
  }
  const songShelf = (songs: Song[], context: string) => <div className="home-rail">{songs.map(song => <button className="home-record" key={song.id} onClick={() => void app.playback.play(song, songs, context)} aria-label={`Play ${song.title} by ${song.artist}`}><Cover song={song}/><strong>{song.title}</strong><small>{song.artist}</small></button>)}</div>;
  return <section className="screen home-feed">
    <div className="home-heading"><div><span className="home-eyebrow">YOUR DAILY SOUNDTRACK</span><h1>{homeGreeting(new Date().getHours())}</h1></div><button className="home-refresh" disabled={feed.loading || starting || !app.online} onClick={() => setEdition(value => value + 1)} aria-label="Refresh Home recommendations">Refresh</button></div>
    <div className="home-filters" aria-label="Home categories">{(['all', 'music', 'playlists'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'For you' : value === 'music' ? 'Music' : 'Playlists'}</button>)}</div>
    {!app.online && <div className="home-offline"><span>You are offline</span><button onClick={() => app.openRoute({kind:'collection',collection:'downloads'})}>Open downloads</button></div>}
    {filter !== 'playlists' && <>
      {checkpoint && checkpoint.song.id !== app.playback.player.track?.id && (app.online || app.downloads.some(song => song.id === checkpoint.song.id)) && <button className="home-resume" onClick={() => { void app.playback.play(checkpoint.song, app.online ? checkpoint.queue : checkpoint.queue.filter(song => app.downloads.some(item => item.id === song.id)), checkpoint.context, checkpoint.positionMs); }}><Cover song={checkpoint.song} /><span className="row-copy"><strong>Continue {checkpoint.song.title}</strong><small>{checkpoint.song.artist} · {formatTime(checkpoint.positionMs)}</small></span><Icon name="play" size={20} /></button>}
      <DailyMix />
      {!!recent.length && <div className="home-shortcuts" aria-label="Jump back in">{recent.map(song => <button key={song.id} onClick={() => void app.playback.play(song, recent, 'Jump back in')}><Cover song={song}/><strong>{song.title}</strong><Icon name="play" size={15}/></button>)}</div>}
      {app.online && featured && <article className="home-spotlight">
        <img className="home-spotlight-wash" src={featured.cover?.url} alt=""/>
        <div className="home-spotlight-top"><span className="home-eyebrow">RELEASE SPOTLIGHT</span><span>{featured.year}</span></div>
        <button className="home-spotlight-art" onClick={() => openAlbum(featured.id)} aria-label={`Open ${featured.title}`}><Cover song={{title:featured.title, cover:featured.cover?.url}}/></button>
        <div className="home-spotlight-bottom"><button className="home-spotlight-copy" onClick={() => openAlbum(featured.id)}><h2>{featured.title}</h2><p>{featured.artists.map(a => a.name).join(', ')}</p></button><button className="home-play" disabled={starting} onClick={() => void playFeatured()} aria-label={`Play ${featured.title}`}>{starting ? <span className="spinner"/> : <Icon name="play" size={24}/>}</button></div>
      </article>}
      {app.online && feed.loading && !featured && <div className="home-loading" role="status"><span className="spinner"/>Finding music for you…</div>}
      {app.online && feed.error && <Notice title="Releases couldn't load" icon="music" action={<button className="secondary-button" onClick={feed.retry}>Try again</button>}>{feed.error}</Notice>}
      {app.online && releases.length > 1 && <section className="home-section"><div className="home-section-heading"><div><h2>Fresh from your artists</h2><p>Recent releases shaped by your listening and taste</p></div></div><div className="home-rail">{releases.slice(1).map(album => <button className="home-record" key={album.id} onClick={() => openAlbum(album.id)}><Cover song={{cover:album.cover?.url,title:album.title}}/><strong>{album.title}</strong><small>{album.artists.map(a=>a.name).join(', ')}</small></button>)}</div></section>}
      {!!favorites.length && <section className="home-section"><div className="home-section-heading"><div><h2>Your favorites, rediscovered</h2><p>A fresh order for songs you love</p></div><button onClick={() => app.playback.playAll(favorites,true,'Your favorites')}>Shuffle</button></div>{songShelf(favorites,'Your favorites')}</section>}
      {!app.online && !!app.downloads.length && <section className="home-section"><h2>Ready wherever you are</h2>{songShelf(rotateFeed(app.downloads,edition).slice(0,10),'Downloads')}</section>}
    </>}
    {filter !== 'music' && <section className="home-section"><div className="home-section-heading"><div><h2>Made by you</h2><p>Your playlists, always close</p></div><button onClick={() => app.openRoute({kind:'playlist-import'})}>Import</button></div>{library.playlists.length ? <div className="home-rail">{library.playlists.map(playlist => <button className="home-record" key={playlist.id} onClick={() => app.openRoute({kind:'playlist',id:playlist.id})}><Cover kind="playlist" song={{title:playlist.name,cover:playlist.cover || playlist.songs[0]?.cover}}/><strong>{playlist.name}</strong><small>{playlist.songs.length} songs</small></button>)}</div> : <button className="home-create" onClick={() => app.openRoute({kind:'playlist-form'})}><Icon name="plus"/><span>Create your first playlist<small>Bring your favorite songs together</small></span></button>}</section>}
    {filter !== 'playlists' && app.online && !!library.artists.length && <section className="home-section"><h2>Artists you follow</h2><div className="home-rail home-artists">{rotateFeed(library.artists,edition).slice(0,10).map(artist => <button className="home-record" key={artist.id} onClick={() => app.openRoute({kind:'catalog',type:'artist',id:artist.id})}><Cover kind="artist" song={{title:artist.name,cover:artist.cover}}/><strong>{artist.name}</strong><small>Artist</small></button>)}</div></section>}
    {app.online && <button className="home-taste" onClick={() => app.openRoute({kind:'account',page:'music-preferences'})}><span>Tune your recommendations<small>Choose the artists and sounds you love</small></span><Icon name="chevron_right" size={20}/></button>}
  </section>;
}

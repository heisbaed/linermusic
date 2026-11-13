import { useEffect, useState } from 'react';
import { useApp } from './AppContext';
import { songFrom } from './Browse';
import { Cover } from './ui';
import { Icon } from './Icons';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { Song } from './types';
import type { Collection } from './AppContext';

function formatDuration(ms?: number) {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function DetailHead({ title, subtitle, art, canPlay, onPlay, onBack }: { title: string; subtitle?: string; art?: string; canPlay?: boolean; onPlay?: () => void; onBack: () => void }) {
  return (
    <header className="tv-detail-head">
      <button type="button" className="tv-icon-btn" aria-label="Back" onClick={onBack}><Icon name="back" size={22} /></button>
      <div className="tv-detail-art">{art ? <img src={art} alt="" /> : <div className="tv-detail-art-empty" />}</div>
      <div className="tv-detail-copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {canPlay ? <button type="button" className="tv-pill tv-pill-primary" data-tv-autofocus="true" onClick={onPlay}><Icon name="play" size={18} />Play</button> : null}
      </div>
    </header>
  );
}

function SongRows({ songs, context }: { songs: Song[]; context: string }) {
  const app = useApp();
  return (
    <div className="tv-song-list" data-tv-shelf-id={`songs-${context}`}>
      {songs.map((song, i) => (
        <button
          key={`${song.id}-${i}`}
          type="button"
          className={`tv-song-row ${app.playback.player.track?.id === song.id ? 'playing' : ''}`}
          onClick={async () => { app.openPlayer(); await app.playback.play(song, songs, context); }}
          aria-label={`Play ${song.title}`}
        >
          <span className="tv-song-index">{i + 1}</span>
          <Cover song={song} />
          <span className="tv-song-copy"><strong>{song.title}</strong><small>{song.artist}</small></span>
          <span className="tv-song-duration">{formatDuration(song.durationMs)}</span>
        </button>
      ))}
    </div>
  );
}

export function TvCatalogScreen({ type, id }: { type: 'album' | 'artist' | 'playlist'; id: string }) {
  const app = useApp();
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState('Loading…');
  const [subtitle, setSubtitle] = useState('');
  const [art, setArt] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setError(''); setSongs([]);
    (async () => {
      try {
        if (type === 'album') {
          const album = await innertubeCatalog.getAlbum(id, controller.signal);
          const next = album.tracks.map(t => ({ id: t.id, title: t.title, artist: t.artists.map(a => a.name).join(', '), artistId: t.artists[0]?.id, albumId: album.id, cover: t.cover?.url || album.cover?.url, durationMs: t.durationMs }));
          setTitle(album.title); setSubtitle(album.artists.map(a => a.name).join(', ')); setArt(album.cover?.url || next[0]?.cover || ''); setSongs(next);
        } else if (type === 'playlist') {
          const playlist: any = await (innertubeCatalog as any).getPlaylist?.(id, controller.signal);
          const tracks = (playlist?.tracks || []).map(songFrom);
          setTitle(playlist?.title || 'Playlist'); setSubtitle(playlist?.author || 'Playlist'); setArt(playlist?.cover?.url || tracks[0]?.cover || ''); setSongs(tracks);
        } else {
          const artist = await innertubeCatalog.getArtist(id, controller.signal);
          const top = ((artist as any).topSongs || (artist as any).songs || []).map(songFrom);
          setTitle(artist.name); setSubtitle('Artist'); setArt((artist as any).cover?.url || (artist as any).images?.[0]?.url || top[0]?.cover || ''); setSongs(top);
        }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load this page.'); }
    })();
    return () => controller.abort();
  }, [type, id]);

  return (
    <section className="tv-screen" aria-label={title}>
      <DetailHead title={title} subtitle={subtitle} art={art} canPlay={!!songs.length} onPlay={async () => { if (songs.length) { app.openPlayer(); await app.playback.playAll(songs, false, title); } }} onBack={app.back} />
      {error ? <div className="tv-glass tv-glass-panel tv-empty"><h2>Could not load</h2><p>{error}</p><div style={{ marginTop: 16 }}><button type="button" className="tv-pill" onClick={() => app.openRoute({ kind: 'catalog', type, id })}>Retry</button></div></div>
        : songs.length ? <SongRows songs={songs} context={title} />
        : <div className="tv-loading" role="status"><span className="spinner" aria-hidden="true" />Loading…</div>}
    </section>
  );
}

export function TvPlaylistScreen({ id }: { id: string }) {
  const app = useApp();
  const playlist = app.account.library.playlists.find(p => p.id === id);
  if (!playlist) return <section className="tv-screen"><DetailHead title="Playlist not found" onBack={app.back} /><div className="tv-glass tv-glass-panel"><p>This playlist could not be opened.</p></div></section>;
  return (
    <section className="tv-screen" aria-label={playlist.name}>
      <DetailHead title={playlist.name} subtitle={`${playlist.songs.length} songs`} art={playlist.cover || playlist.songs[0]?.cover} canPlay={!!playlist.songs.length} onPlay={async () => { if (playlist.songs.length) { app.openPlayer(); await app.playback.playAll(playlist.songs, false, playlist.name); } }} onBack={app.back} />
      {playlist.songs.length ? <SongRows songs={playlist.songs} context={playlist.name} /> : <div className="tv-glass tv-glass-panel"><p>This playlist is empty. Add songs from your phone.</p></div>}
    </section>
  );
}

export function TvCollectionScreen({ collection }: { collection: Collection }) {
  const app = useApp();
  const lib = app.account.library;
  if (collection === 'downloads') return <section className="tv-screen"><DetailHead title="Downloads" subtitle="Mobile only" onBack={app.back} /><div className="tv-glass tv-glass-panel"><h2>Downloads are on your phone</h2><p>To keep TV fast, downloads stay on mobile. You can stream your music and playlists on TV.</p></div></section>;
  if (collection === 'playlists') return (
    <section className="tv-screen"><DetailHead title="Playlists" onBack={app.back} />
      <div className="tv-carousel" data-tv-shelf-id="col-playlists" role="list">{lib.playlists.map(pl => (
        <button key={pl.id} type="button" role="listitem" className="tv-card tv-card-rect" onClick={() => app.openRoute({ kind: 'playlist', id: pl.id })}><div className="tv-card-media"><Cover kind="playlist" song={{ title: pl.name, cover: pl.cover || pl.songs[0]?.cover }} /></div><span className="tv-card-title">{pl.name}</span><span className="tv-card-sub">{pl.songs.length} songs</span></button>
      ))}</div>
    </section>
  );
  if (collection === 'artists') return (
    <section className="tv-screen"><DetailHead title="Artists" onBack={app.back} />
      <div className="tv-carousel" data-tv-shelf-id="col-artists" role="list">{lib.artists.map(a => (
        <button key={a.id} type="button" role="listitem" className="tv-card tv-card-artist" onClick={() => app.openRoute({ kind: 'catalog', type: 'artist', id: a.id })}><div className="tv-card-media"><Cover kind="artist" song={{ title: a.name, cover: a.cover }} /></div><span className="tv-card-title">{a.name}</span><span className="tv-card-sub">Artist</span></button>
      ))}</div>
    </section>
  );
  if (collection === 'albums') return (
    <section className="tv-screen"><DetailHead title="Albums" onBack={app.back} />
      <div className="tv-carousel" data-tv-shelf-id="col-albums" role="list">{lib.albums.map(a => (
        <button key={a.id} type="button" role="listitem" className="tv-card tv-card-rect" onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: a.id })}><div className="tv-card-media"><Cover song={{ title: a.title, cover: a.cover }} /></div><span className="tv-card-title">{a.title}</span><span className="tv-card-sub">{a.artist || 'Album'}</span></button>
      ))}</div>
    </section>
  );
  const songs = collection === 'favorites' ? lib.favorites : (collection as any) === 'recent' ? lib.recent : [];
  const title = collection === 'favorites' ? 'Favorites' : 'Recently played';
  return (
    <section className="tv-screen">
      <DetailHead title={title} subtitle={`${songs.length} songs`} art={songs[0]?.cover} canPlay={!!songs.length} onPlay={async () => { if (songs.length) { app.openPlayer(); await app.playback.playAll(songs, collection === 'favorites', title); } }} onBack={app.back} />
      {songs.length ? <SongRows songs={songs} context={title} /> : <div className="tv-glass tv-glass-panel"><p>No {title.toLowerCase()} yet.</p></div>}
    </section>
  );
}

export function TvAccountScreen({ page: _page }: { page: string }) {
  const app = useApp();
  const profile = app.account.library.profile;
  const user = app.account.user;
  return (
    <section className="tv-screen" aria-label="Settings">
      <header className="tv-page-head"><h1>Settings</h1><p className="tv-body-text">TV is for listening. Manage your account on mobile.</p></header>
      <div className="tv-account-grid">
        <div className="tv-glass tv-glass-panel tv-profile-card">
          <div className="tv-profile-avatar">{(profile as any).photo ? <img src={(profile as any).photo} alt="" /> : <Icon name="account" size={40} />}</div>
          <h2>{user?.displayName || profile.name || 'Cine Music listener'}</h2>
          <p>{user?.email || 'Linked account'}</p>
        </div>
        <div className="tv-glass tv-glass-panel">
          <h3>Profile editing</h3>
          <p>Change your name, email, password, or account details from the Cine Music mobile app.</p>
        </div>
        <div className="tv-glass tv-glass-panel">
          <h3>Playback</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" className="tv-pill tv-pill-primary" data-tv-autofocus="true" onClick={app.openPlayer} disabled={!app.playback.player.track}><Icon name="play" size={18} />Now playing</button>
            <button type="button" className="tv-pill" onClick={() => void app.account.signOut()}><Icon name="close" size={18} />Sign out of TV</button>
          </div>
        </div>
      </div>
    </section>
  );
}

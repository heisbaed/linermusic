import { useEffect, useState } from 'react';
import { TV_THEMES, useApp } from './AppContext';
import { songFrom } from './Browse';
import { TvCard, TvShelf, TvSongs, type TvRoute } from './TvLayout';
import { Cover } from './ui';
import { Icon } from './Icons';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { AlbumDetails, ArtistDetails, CatalogPlaylistDetails } from '@/shared/contracts';
import type { Song } from './types';

function Detail({ title, subtitle, art, songs, artist }: { title: string; subtitle?: string; art?: string; songs: Song[]; artist?: ArtistDetails }) {
  const app = useApp();
  return <section className="tv-page" aria-label={title}>
    <header className="tv-detail">
      <Cover song={{ title, cover: art }} kind={artist ? 'artist' : 'album'} large />
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}
        <div className="tv-actions">
          {songs.length > 0 && <button className="tv-button tv-primary" data-tv-key="play-all" onClick={() => {
            app.playback.setRepeat('off');
            app.playback.playAll(songs, false, title);
          }}><Icon name="play" size={21} />Play</button>}
          <button className="tv-button" onClick={app.back}>Back</button>
        </div>
      </div>
    </header>
    {!!songs.length && <TvSongs songs={songs} title={artist ? 'Top Songs' : title} />}
    {!songs.length && <p>No songs are available here.</p>}
    {artist && [{ items: artist.albums, label: 'Albums' }, { items: artist.singles, label: 'Singles & EPs' }].map(({ items, label }) => {
      if (!items.length) return null;
      return <TvShelf key={label} title={label}>{items.slice(0, 30).map(release =>
        <TvCard key={release.id} id={release.id} title={release.title} art={release.cover?.url} subtitle={release.year?.toString()}
          action={() => app.openRoute({ kind: 'catalog', type: 'album', id: release.id })} />)}</TvShelf>;
    })}
  </section>;
}

function Catalog({ type, id }: Extract<TvRoute, { kind: 'catalog' }>) {
  const app = useApp();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<AlbumDetails | ArtistDetails | CatalogPlaylistDetails>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const task = new AbortController();
    const load = type === 'album' ? innertubeCatalog.getAlbum : type === 'artist' ? innertubeCatalog.getArtist : innertubeCatalog.getPlaylist;
    setData(undefined); setError(false);
    void load(id, task.signal).then(next => { if (!task.signal.aborted) setData(next); })
      .catch(() => { if (!task.signal.aborted) setError(true); });
    return () => task.abort();
  }, [id, type, attempt]);
  if (!data) return <section className="tv-page tv-page-title">
    <h1>{error ? 'Could not open this page' : 'Loading…'}</h1>
    <div className="tv-actions">{error && <button className="tv-button tv-primary" onClick={() => setAttempt(value => value + 1)}>Retry</button>}<button className="tv-button" onClick={app.back}>Back</button></div>
  </section>;
  return <Detail title={data.type === 'artist' ? data.name : data.title} art={data.cover?.url}
    subtitle={data.type === 'album' ? data.artists.map(artist => artist.name).join(', ') : data.type === 'playlist' ? data.author : 'Artist'}
    artist={data.type === 'artist' ? data : undefined}
    songs={data.tracks.map(track => {
      const song = songFrom(track);
      return data.type === 'album' ? { ...song, albumId: data.id, cover: song.cover || data.cover?.url } : song;
    })} />;
}

export function TvLibraryScreen() {
  const app = useApp();
  const { playlists, artists, albums, favorites, recent } = app.account.library;
  return <section className="tv-page"><header className="tv-page-title"><h1>Library</h1></header>
    <div className="tv-actions tv-library-links">
      <button className="tv-button" data-tv-key="likes" onClick={() => app.openRoute({ kind: 'collection', collection: 'favorites' })}><Icon name="heart" size={21} />Liked Songs · {favorites.length}</button>
      <button className="tv-button" data-tv-key="recent" onClick={() => app.openRoute({ kind: 'collection', collection: 'recent' })}><Icon name="music" size={21} />Recently Played · {recent.length}</button>
    </div>
    <TvShelf title="Playlists">{playlists.length ? playlists.map(playlist =>
      <TvCard key={playlist.id} id={playlist.id} title={playlist.name} subtitle={`${playlist.songs.length} songs`} kind="playlist" art={playlist.cover || playlist.songs[0]?.cover}
        action={() => app.openRoute({ kind: 'playlist', id: playlist.id })} />) : <p>Playlists from your phone will appear here.</p>}</TvShelf>
    {!!albums.length && <TvShelf title="Saved Albums">{albums.map(album =>
      <TvCard key={album.id} id={album.id} title={album.title} subtitle={album.artist} art={album.cover} action={() => app.openRoute({ kind: 'catalog', type: 'album', id: album.id })} />)}</TvShelf>}
    {!!artists.length && <TvShelf title="Saved Artists">{artists.map(artist =>
      <TvCard key={artist.id} id={artist.id} title={artist.name} kind="artist" art={artist.cover} action={() => app.openRoute({ kind: 'catalog', type: 'artist', id: artist.id })} />)}</TvShelf>}
  </section>;
}

export function TvRouteScreen({ route }: { route: TvRoute }) {
  const app = useApp();
  if (route.kind === 'catalog') return <Catalog {...route} />;
  if (route.kind === 'playlist') {
    const playlist = app.account.library.playlists.find(item => item.id === route.id);
    return <Detail title={playlist?.name || 'Playlist unavailable'} songs={playlist?.songs || []} art={playlist?.cover || playlist?.songs[0]?.cover} />;
  }
  if (route.kind === 'collection') return <Detail title={route.collection === 'favorites' ? 'Liked Songs' : 'Recently Played'}
    songs={route.collection === 'favorites' ? app.account.library.favorites : app.account.library.recent} />;
  return <section className="tv-page tv-settings">
    <header className="tv-page-title"><h1>Settings</h1><p>{app.account.user?.email}</p></header>
    <section><h2>Appearance</h2><div className="tv-actions">{TV_THEMES.map(theme => <button className="tv-button tv-theme-choice" key={theme.id}
      data-tv-key={theme.id} aria-pressed={theme.id === app.theme} onClick={() => app.setTheme(theme.id)}><span style={{ background: theme.background, borderColor: theme.accent }} />{theme.name}</button>)}</div></section>
    <section><h2>Playback</h2><button className="tv-button" aria-pressed={app.prefs.autoplay}
      onClick={() => app.updatePrefs({ autoplay: !app.prefs.autoplay })}>Autoplay similar songs · {app.prefs.autoplay ? 'On' : 'Off'}</button></section>
    <section><h2>Account</h2><p role="status">{app.account.syncStatus}</p><div className="tv-actions">
      <button className="tv-button" onClick={app.account.retrySync}>Sync library</button><button className="tv-button" onClick={app.account.signOut}>Sign out</button>
    </div></section>
  </section>;
}

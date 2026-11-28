import { ConnectControls } from './ConnectControls';
import { AppIconSettings } from './AppIconSettings';
import { DjCine } from './DjCine';
import { useEffect, useState, type ReactNode } from 'react';
import { TV_THEMES, useApp } from './AppContext';
import { songFrom } from './Browse';
import { TvCard, TvShelf, TvSongs, type TvRoute } from './TvLayout';
import { Cover } from './ui';
import { Icon } from './Icons';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { AlbumDetails, ArtistDetails, CatalogPlaylistDetails } from '@/shared/contracts';
import type { Song } from './types';
import { songLabels, songSortChoices, sortCollectionSongs } from './collectionFilters';
import { useLibraryGenres } from './useLibraryGenres';
import { loadSaved, save } from './library';

function Detail({ title, subtitle, art, songs, artist, tools }: { title: string; subtitle?: string; art?: string; songs: Song[]; artist?: ArtistDetails; tools?: ReactNode }) {
  const app = useApp();
  return <section className="tv-page tv-detail-page" aria-label={title}>
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
    <div className="tv-detail-list">{tools}{songs.length ? <TvSongs songs={songs} title={artist ? 'Top Songs' : title} /> : <p>No songs match this view.</p>}</div>
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

function TvCollectionDetail({ favorites }: { favorites: boolean }) {
  const app = useApp();
  const songs = favorites ? app.account.library.favorites : app.account.library.recent;
  const key = 'tv-collection-sort:' + (app.account.user?.localId || 'guest') + ':' + favorites;
  const [sort, setSort] = useState(() => loadSaved(key, 'recent'));
  const [open, setOpen] = useState(false), [label, setLabel] = useState('All');
  const genres = useLibraryGenres(songs, favorites, app.online);
  const labels = [...new Set(songs.flatMap(songLabels))].sort();
  const visible = sortCollectionSongs(songs.filter(song => label === 'All' || songLabels(song).includes(label)), sort);
  return <Detail title={favorites ? 'Liked Songs' : 'Recently Played'} subtitle={`${songs.length} songs`} songs={visible} art={songs[0]?.cover} tools={<div className="tv-collection-tools">
    <button className="tv-button" aria-expanded={open} onClick={() => setOpen(!open)}>Sort: {songSortChoices.find(choice => choice.value === sort)?.label || 'Recently added'}</button>
    {open && <div className="tv-sort-options" role="group" aria-label="Sort songs">{songSortChoices.map(choice => <button className="tv-button" key={choice.value} aria-pressed={sort === choice.value} onClick={() => { setSort(choice.value); save(key,choice.value); setOpen(false); }}>{choice.label}</button>)}</div>}
    {favorites && !!labels.length && <div className="tv-genre-filters" role="group" aria-label="Genre filters">{['All', ...labels].map(item => <button className="tv-button" key={item} aria-pressed={label === item} onClick={() => setLabel(item)}>{item}</button>)}</div>}
    {genres.loading && <p className="genre-status">Updating genres…</p>}{genres.error && <button className="tv-button" onClick={genres.retry}>Retry genre information</button>}
  </div>} />;
}

export function TvRouteScreen({ route }: { route: TvRoute }) {
  const app = useApp();
  if (route.kind === 'dj') return <DjCine seed={route.seed} />;
  if (route.kind === 'catalog') return <Catalog {...route} />;
  if (route.kind === 'playlist') {
    const playlist = app.account.library.playlists.find(item => item.id === route.id);
    return <Detail title={playlist?.name || 'Playlist unavailable'} songs={playlist?.songs || []} art={playlist?.cover || playlist?.songs[0]?.cover} />;
  }
  if (route.kind === 'collection') return <TvCollectionDetail key={route.collection} favorites={route.collection === 'favorites'} />;
  return <section className="tv-page tv-settings">
    <header className="tv-page-title"><h1>Settings</h1><p>{app.account.user?.email}</p></header>
    <section><h2>Appearance</h2><div className="tv-actions">{TV_THEMES.map(theme => <button className="tv-button tv-theme-choice" key={theme.id}
      data-tv-key={theme.id} aria-pressed={theme.id === app.theme} onClick={() => app.setTheme(theme.id)}><span style={{ background: theme.background, borderColor: theme.accent }} />{theme.name}</button>)}</div></section>
    <AppIconSettings />
    <section><h2>Listen on</h2><ConnectControls /></section>
    <section><h2>Playback</h2><button className="tv-button" aria-pressed={app.prefs.autoplay}
      onClick={() => app.updatePrefs({ autoplay: !app.prefs.autoplay })}>Autoplay similar songs · {app.prefs.autoplay ? 'On' : 'Off'}</button></section>
    <section><h2>Account</h2><p role="status">{app.account.syncStatus}</p><div className="tv-actions">
      <button className="tv-button" onClick={app.account.retrySync}>Sync library</button><button className="tv-button" onClick={app.account.signOut}>Sign out</button>
    </div></section>
    <section><h2>System playback controls</h2><div className="tv-actions">
      <button className="tv-button" onClick={()=>window.CineAndroid?.openNotificationSettings()}>Notification settings</button>
      <button className="tv-button" onClick={()=>{if(window.CineAndroid?.openScreensaverSettings)window.CineAndroid.openScreensaverSettings();else app.toast('Update the TV APK to select Cine music playback in system Screensaver settings.');}}>Screensaver playback</button>
      <button className="tv-button" onClick={()=>{if(!window.CineAndroid?.requestMusicWidget?.())app.toast('Your TV launcher cannot add this widget automatically.');}}>Add playback widget</button>
    </div></section>
  </section>;
}

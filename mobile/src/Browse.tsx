import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { searchCatalog } from '@/shared/media/innertube/innertubeSearch';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { AlbumDetails, ArtistDetails, ArtistAlbum, CatalogPlaylistDetails, SearchResult, SearchType, Track } from '@/shared/contracts';
import { useApp, type Collection, type SearchHistory } from './AppContext';
import { Icon, type IconName } from './Icons';
import { Action, ConfirmDialog, Cover, Notice, PageHeader, SearchField, SongRows } from './ui';
import type { Playlist, Song } from './types';
import { searchMusicCatalog } from './musicSearch';
import { figmaArtwork } from './figmaAssets';
import { mergePlaylistSongDraft } from './playlistDraft';
import { formatTime, playlistBackupFileName, playlistBackupText, playlistIsDownloaded } from './library';
import './browse.css';
import { SongRadio } from './SongRadio';

type CatalogType = 'artist' | 'album' | 'playlist';
type CatalogDetails = AlbumDetails | ArtistDetails | CatalogPlaylistDetails;
type CatalogItem = Exclude<SearchResult, { type: 'track' }>;
type AlbumItem = Extract<SearchResult, { type: 'album' }>;
type PlaylistItem = Extract<SearchResult, { type: 'playlist' }>;

export function songFrom(track: Track): Song {
  return {
    id: track.id,
    title: track.title,
    artist: track.artists.map(artist => artist.name).join(', '),
    cover: track.cover?.url,
    durationMs: track.durationMs,
    ...(track.artists[0]?.id ? { artistId: track.artists[0].id } : {}),
    ...(track.album?.id ? { albumId: track.album.id } : {}),
  };
}

export function matchingSongs(songs: Song[], query: string): Song[] {
  const text = query.trim().toLocaleLowerCase();
  return text ? songs.filter(song => `${song.title} ${song.artist}`.toLocaleLowerCase().includes(text)) : songs;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => !seen.has(item.id) && Boolean(seen.add(item.id)));
}

function count(value: number, noun = 'song'): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

function duration(songs: Song[]): string {
  const milliseconds = songs.reduce((sum, song) => sum + Math.max(0, song.durationMs || 0), 0);
  if (!milliseconds) return '';
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The catalog could not connect. Please try again.';
}

function Loading({ children }: { children: ReactNode }) {
  return <div className="browse-loading" role="status"><span className="browse-spinner" aria-hidden="true" />{children}</div>;
}

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="section-heading"><h2>{title}</h2>{action}</div>;
}

const searchCache = new Map<string, SearchResult[]>();
const detailCache = new Map<string, CatalogDetails>();

const genres = [
  { name: 'Afrobeats', artist: 'Burna Boy' },
  { name: 'R&B', artist: 'SZA' },
  { name: 'Pop', artist: 'Dua Lipa' },
  { name: 'Hip-Hop', artist: 'Kendrick Lamar' },
] as const;
type GenreArtwork = Record<string, { artist: string; sourceId: string; cover: string }>;
const genreArtworkKey = 'cine:browse-cache:genre-art-v1';
let genreArtworkRequest: Promise<GenreArtwork> | null = null;
function cachedGenreArtwork(): { savedAt: number; entries: GenreArtwork } {
  try {
    const saved = JSON.parse(localStorage.getItem(genreArtworkKey) || 'null');
    const entries: GenreArtwork = {};
    for (const genre of genres) {
      const item = saved?.entries?.[genre.name];
      if (item?.artist === genre.artist && typeof item.sourceId === 'string' && typeof item.cover === 'string' && item.cover.startsWith('https://')) entries[genre.name] = item;
    }
    return { savedAt: Number(saved?.savedAt) || 0, entries };
  } catch { return { savedAt: 0, entries: {} }; }
}
function fetchGenreArtwork(): Promise<GenreArtwork> {
  const saved = cachedGenreArtwork();
  if (Object.keys(saved.entries).length === genres.length && Date.now() - saved.savedAt < 86_400_000) return Promise.resolve(saved.entries);
  if (!genreArtworkRequest) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 20_000);
    genreArtworkRequest = Promise.allSettled(genres.map(async genre => {
      const results = await searchCatalog(genre.artist, 'artist', abort.signal);
      const artist = results.find(item => item.type === 'artist' && item.name.toLocaleLowerCase() === genre.artist.toLocaleLowerCase() && item.cover?.url.startsWith('https://'));
      return artist?.type === 'artist' && artist.cover ? [genre.name, { artist: artist.name, sourceId: artist.id, cover: artist.cover.url }] as const : null;
    })).then(results => {
      const entries = { ...saved.entries };
      for (const result of results) if (result.status === 'fulfilled' && result.value) entries[result.value[0]] = result.value[1];
      try { localStorage.setItem(genreArtworkKey, JSON.stringify({ savedAt: Date.now(), entries })); } catch { /* Artwork caching must not block browsing. */ }
      return entries;
    }).finally(() => { clearTimeout(timer); genreArtworkRequest = null; });
  }
  return genreArtworkRequest;
}
function Genres({ onSearch }: { onSearch: (query: string) => void }) {
  const { online } = useApp();
  const grid = useRef<HTMLDivElement>(null);
  const [artwork, setArtwork] = useState(() => cachedGenreArtwork().entries);
  const [loaded, setLoaded] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!online) return;
    let active = true, started = false;
    const load = () => { if (started) return; started = true; void fetchGenreArtwork().then(entries => { if (active) setArtwork(entries); }); };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { load(); observer?.disconnect(); }
    }, { rootMargin: '100px' }) : null;
    if (observer && grid.current) observer.observe(grid.current); else load();
    return () => { active = false; observer?.disconnect(); };
  }, [online]);
  return <div className="browse-genres" ref={grid}>{genres.map(genre => {
    const art = artwork[genre.name], cover = art?.cover;
    const visible = Boolean(cover && failed[genre.name] !== cover && loaded[genre.name] === cover);
    return <button className="browse-genre" data-artwork={visible ? 'ready' : 'pending'} data-artwork-artist={art?.artist} key={genre.name} onClick={() => onSearch(genre.name)} aria-label={`Search ${genre.name} music`}>
      {cover && failed[genre.name] !== cover && <img className="browse-genre-image" src={cover} alt="" decoding="async" onLoad={() => setLoaded(old => ({ ...old, [genre.name]: cover }))} onError={() => setFailed(old => ({ ...old, [genre.name]: cover }))} />}
      <span>{genre.name}</span><Icon name="chevron_right" size={18} />
    </button>;
  })}</div>;
}

function AlbumShelf({ items }: { items: { id: string; title: string; artist?: string; cover?: string; year?: number }[] }) {
  const app = useApp();
  return <div className="art-shelf browse-album-shelf">{items.map(item => <button className="shelf-item" key={item.id}
    onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: item.id })}>
    <Cover kind="album" song={{ title: item.title, cover: item.cover }} />
    <strong>{item.title}</strong><small>{item.artist || (item.year ? String(item.year) : 'Album')}</small>
  </button>)}</div>;
}

function PlaylistRail({ playlists }: { playlists: Playlist[] }) {
  const app = useApp();
  return <div className="art-shelf browse-playlist-rail">{playlists.map(playlist => <button className="shelf-item" key={playlist.id}
    onClick={() => app.openRoute({ kind: 'playlist', id: playlist.id })}>
    <Cover kind="playlist" song={{ title: playlist.name, cover: playlist.cover || playlist.songs[0]?.cover }} />
    <strong>{playlist.name}</strong><small>{count(playlist.songs.length)}</small>
  </button>)}</div>;
}

function CatalogRow({ item, onOpen }: { item: CatalogItem; onOpen?: (item: CatalogItem) => void }) {
  const app = useApp();
  const title = item.type === 'artist' ? item.name : item.title;
  const subtitle = item.type === 'artist' ? 'Artist' : item.type === 'album'
    ? ['Album', item.artists.map(artist => artist.name).join(', '), item.year].filter(Boolean).join(' · ')
    : ['Playlist', item.author].filter(Boolean).join(' · ');
  return <button className={`list-link browse-catalog-row browse-result-${item.type}`}
    onClick={() => onOpen ? onOpen(item) : app.openRoute({ kind: 'catalog', type: item.type, id: item.id })}>
    <Cover kind={item.type} className={item.type === 'artist' ? 'browse-round' : ''} song={{ cover: item.cover?.url, title }} />
    <span className="row-copy"><strong>{title}</strong><small>{subtitle}</small></span><Icon name="chevron_right" size={19} />
  </button>;
}

export { HomeFeed as HomeScreen } from "./HomeFeed";

const filters: { id: SearchType; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'track', label: 'Songs' }, { id: 'artist', label: 'Artists' }, { id: 'album', label: 'Albums' },
  { id: 'playlist', label: 'Playlists' },
];

export function SearchScreen() {
  const app = useApp();
  const [radioSong, setRadioSong] = useState<Song | null>(null);
  const appRef = useRef(app);
  appRef.current = app;
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [filter, setFilter] = useState<SearchType>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const runRef = useRef<(text: string, type?: SearchType, save?: boolean) => void>(() => {});
  useEffect(() => {
    const onSearch = (event: Event) => {
      const text = (event as CustomEvent<{ query: string }>).detail?.query;
      if (text) runRef.current(text, 'all');
    };
    window.addEventListener('cine:browse-search', onSearch);
    return () => { window.removeEventListener('cine:browse-search', onSearch); request.current?.abort(); if (debounce.current) clearTimeout(debounce.current); };
  }, []);

  function remember(entry: SearchHistory) {
    appRef.current.account.setLibrary(library => ({ ...library, history: [entry, ...library.history.filter(item =>
      entry.id ? !(item.type === entry.type && item.id === entry.id) : item.id || item.query.toLocaleLowerCase() !== entry.query.toLocaleLowerCase())].slice(0, 20) }));
  }

  async function run(text = query, type: SearchType = filter, force = false, save = true) {
    if (debounce.current) clearTimeout(debounce.current);
    const value = text.trim();
    request.current?.abort();
    const ticket = ++sequence.current;
    setQuery(text);
    setFilter(type);
    setError('');
    setResults([]);
    setSubmitted(value);
    setLoading(false);
    if (!value) return;
    if (save) remember({ query: value });
    const key = `${type}:${value.toLocaleLowerCase()}`;
    const cached = searchCache.get(key);
    if (cached && !force) { setResults(cached); return; }
    if (!appRef.current.online) { setError('You are offline. Connect to search the music catalog.'); return; }
    const abort = new AbortController();
    request.current = abort;
    setLoading(true);
    try {
      const found = await searchMusicCatalog(value, type, abort.signal);
      if (abort.signal.aborted || ticket !== sequence.current) return;
      if (found.length) searchCache.set(key, found);
      if (searchCache.size > 30) searchCache.delete(searchCache.keys().next().value!);
      setResults(found);
    } catch (reason) {
      if (!abort.signal.aborted && ticket === sequence.current) setError(message(reason));
    } finally {
      if (!abort.signal.aborted && ticket === sequence.current) setLoading(false);
    }
  }
  runRef.current = (text, type, save = true) => { void run(text, type, false, save); };

  function changeQuery(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    request.current?.abort();
    sequence.current++;
    setQuery(value);
    setSubmitted('');
    setResults([]);
    setError('');
    setLoading(false);
    if (!value) setFilter('all');
    if (value.trim()) debounce.current = setTimeout(() => runRef.current(value, filter, false), 350);
  }

  function open(item: CatalogItem) {
    const title = item.type === 'artist' ? item.name : item.title;
    const subtitle = item.type === 'album' ? item.artists.map(artist => artist.name).join(', ') : item.type === 'playlist' ? item.author : 'Artist';
    remember({ query: submitted || title, id: item.id, type: item.type, title, subtitle, cover: item.cover?.url });
    app.openRoute({ kind: 'catalog', type: item.type, id: item.id });
  }

  const songs = results.filter((item): item is Extract<SearchResult, { type: 'track' }> => item.type === 'track').map(songFrom);
  const artists = results.filter((item): item is Extract<SearchResult, { type: 'artist' }> => item.type === 'artist');
  const albums = results.filter((item): item is AlbumItem => item.type === 'album');
  const playlists = results.filter((item): item is PlaylistItem => item.type === 'playlist');
  const target = app.account.library.playlists.find(playlist => playlist.id === app.addToPlaylist);
  const history = app.account.library.history;
  const topResult = filter === 'all' ? results[0] : undefined;
  const shownSongs = filter === 'all' ? songs.slice(0, 5) : songs;
  const seeAll = (type: SearchType, length: number, limit: number) => filter === 'all' && length > limit
    ? <button className="text-button" onClick={() => { void run(submitted, type); }}>See all</button> : undefined;
  return <section className="screen browse-search">
    <h1 className="page-title">Search</h1>{radioSong && <SongRadio song={radioSong} onClose={() => setRadioSong(null)} />}
    <div className="browse-search-input"><SearchField value={query} onChange={changeQuery} onSubmit={() => { void run(); }} placeholder="Songs, artists, albums, playlists" label="Search music" /></div>
    {target && <div className="browse-context" role="status"><span>Adding to <strong>{target.name}</strong></span><button className="text-button" onClick={() => { app.setAddToPlaylist(null); app.openRoute({ kind: 'playlist', id: target.id }); }}>Done</button></div>}
    <div className="filter-tabs browse-search-filters" aria-label="Search type">{filters.map(tab => <button key={tab.id}
      className={filter === tab.id ? 'selected' : ''} aria-pressed={filter === tab.id}
      onClick={() => { setFilter(tab.id); if (query.trim()) void run(query, tab.id); }}>{tab.label}</button>)}</div>
    {!submitted && <>
      {!!history.length && <section className="browse-history"><SectionHeading title="Recent searches" action={<button className="text-button" onClick={() => app.account.setLibrary(library => ({ ...library, history: [] }))}>Clear</button>} />
        {history.slice(0, showHistory ? 20 : 3).map((entry, index) => <div className="browse-history-row" key={`${entry.type || 'query'}:${entry.id || entry.query}:${index}`}>
          <button onClick={() => entry.type && entry.id ? app.openRoute({ kind: 'catalog', type: entry.type, id: entry.id }) : void run(entry.query, 'all')}>
            {entry.id ? <Cover kind={entry.type} className={entry.type === 'artist' ? 'browse-round' : ''} song={{ title: entry.title || entry.query, cover: entry.cover }} /> : <span className="browse-history-icon"><Icon name="search" size={21} /></span>}
            <span className="row-copy"><strong>{entry.title || entry.query}</strong><small>{entry.subtitle || (entry.type ? entry.type[0].toUpperCase() + entry.type.slice(1) : 'Search')}</small></span>
          </button><Action icon="close" label={`Remove ${entry.title || entry.query} from search history`} onClick={() => app.account.setLibrary(library => ({ ...library, history: library.history.filter(item => item !== entry) }))} />
        </div>)}
        {history.length > 3 && <button className="text-button" onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Show less' : 'Show all recent searches'}</button>}
      </section>}
      {!!query.trim() && <button className="browse-submit-hint" onClick={() => { void run(); }}><Icon name="search" size={19} /><span>Search for <strong>{query.trim()}</strong></span><Icon name="chevron_right" size={18} /></button>}
      {!!app.account.library.recent.length && <section className="search-radios"><SectionHeading title="Made from your music" /><div className="art-shelf">{app.account.library.recent.slice(0, 6).map(song => <button className="shelf-item" key={song.id} onClick={() => setRadioSong(song)}><Cover song={song} /><strong>{song.title} Radio</strong><small>{song.artist}</small></button>)}</div></section>}
      <SectionHeading title="Browse all" /><Genres onSearch={text => { void run(text, 'all'); }} />
      <p className="browse-footnote">Find the artists, albums, and playlists that move you.</p>
    </>}
    {loading && <Loading>Searching for {submitted}...</Loading>}
    {!!error && !loading && <Notice title="Search could not connect" icon="wifi" action={<button className="secondary-button" onClick={() => { void run(submitted, filter, true); }}>Try again</button>}>{error}</Notice>}
    {!!submitted && !loading && !error && !results.length && <Notice title={`No results for “${submitted}”`} icon="search">Try a different spelling, a song title, or an artist's name.</Notice>}
    {!loading && !error && !!results.length && <div className="browse-results" aria-live="polite">
      <p className="browse-result-label">Results for <strong>{submitted}</strong></p>
      {topResult && !target && <section><SectionHeading title="Top result" /><div className="browse-top-result">{topResult.type === 'track'
        ? <SongRows songs={[songFrom(topResult)]} singleTrack context={`Search: ${submitted}`} onPlay={() => remember({ query: submitted })} />
        : <CatalogRow item={topResult} onOpen={open} />}</div></section>}
      {!!songs.length && <section><SectionHeading title="Songs" action={seeAll('track', songs.length, 5)} />{target ? <div className="song-list">{shownSongs.map(song => {
        const added = target.songs.some(item => item.id === song.id);
        return <div className="song-row browse-add-result" key={song.id}><button className="song-main" onClick={() => void app.playback.play(song, [song], `Search: ${submitted}`)} aria-label={`Preview ${song.title} by ${song.artist}`}><Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{song.artist}</small></span></button>
          <Action icon={added ? 'check' : 'plus'} label={added ? `${song.title} is in ${target.name}` : `Add ${song.title} to ${target.name}`} active={added} disabled={added} onClick={() => {
            const keepOffline = playlistIsDownloaded(target, app.downloads, app.jobs);
            app.account.setLibrary(library => ({ ...library, playlists: library.playlists.map(playlist => playlist.id === target.id && !playlist.songs.some(item => item.id === song.id) ? { ...playlist, songs: [...playlist.songs, song] } : playlist) }));
            if (keepOffline) app.download(song);
            app.toast(`Added to ${target.name}.`);
          }} />
        </div>;
      })}</div> : <SongRows songs={shownSongs} singleTrack context={`Search: ${submitted}`} onPlay={() => remember({ query: submitted })} />}</section>}
      {!!artists.length && <section><SectionHeading title={artists.length === 1 ? 'Artist' : 'Artists'} action={seeAll('artist', artists.length, 3)} />{(filter === 'all' ? artists.slice(0, 3) : artists).map(item => <CatalogRow item={item} key={item.id} onOpen={open} />)}</section>}
      {!!albums.length && <section><SectionHeading title="Albums" action={seeAll('album', albums.length, 3)} />{(filter === 'all' ? albums.slice(0, 3) : albums).map(item => <CatalogRow item={item} key={item.id} onOpen={open} />)}</section>}
      {!!playlists.length && <section><SectionHeading title="Playlists" action={seeAll('playlist', playlists.length, 3)} />{(filter === 'all' ? playlists.slice(0, 3) : playlists).map(item => <CatalogRow item={item} key={item.id} onOpen={open} />)}</section>}
    </div>}
  </section>;
}

export function LibraryScreen() {
  const app = useApp();
  const library = app.account.library;
  const current = app.playback.player;
  const featured = current.track || library.recent[0] || library.favorites[0];
  const destinations: { id: Collection; icon: IconName; title: string; subtitle: string }[] = [
    { id: 'favorites', icon: 'heart', title: 'Liked Songs', subtitle: count(library.favorites.length) },
    { id: 'downloads', icon: 'download', title: 'Downloaded music', subtitle: `${count(app.downloads.length)} · Available offline` },
    { id: 'playlists', icon: 'library', title: 'Your playlists', subtitle: count(library.playlists.length, 'playlist') },
    { id: 'albums', icon: 'album', title: 'Saved albums', subtitle: count(library.albums.length, 'album') },
    { id: 'artists', icon: 'artist', title: 'Artists', subtitle: count(library.artists.length, 'artist') },
  ];
  return <section className="screen browse-library">
    <h1 className="page-title">Your Library</h1>
    <div className="library-transfer-links">
      <button className="text-button library-import-link" onClick={()=>app.openRoute({kind:'playlist-import'})}><Icon name="plus" size={16}/>Import playlist</button>
      <PlaylistExportButton playlists={library.playlists} label="Back up playlists" />
    </div>
    <article className="library-feature">
      <Cover large song={{ cover: featured?.cover || figmaArtwork.midnight }} />
      <div className="library-feature-copy"><small>{current.track ? 'NOW PLAYING' : featured ? 'PLAY IT AGAIN' : 'YOUR MUSIC'}</small><strong>{featured?.title || 'Make yourself at home'}</strong><span>{featured?.artist || 'Save songs and build your first playlist.'}</span></div>
      <button className="library-feature-play" aria-label={featured ? current.track ? current.status === 'playing' ? 'Pause current song' : 'Resume current song' : `Play ${featured.title}` : 'Create your first playlist'} onClick={() => featured ? current.track ? app.playback.toggle() : app.playback.play(featured, library.recent.length ? library.recent : library.favorites, 'Your library') : app.openRoute({ kind: 'playlist-form' })}><Icon name={featured ? current.status === 'playing' ? 'pause' : 'play' : 'plus'} size={24} /></button>
      {current.track && current.durationMs > 0 && <span className="library-feature-time">{formatTime(current.positionMs)} / {formatTime(current.durationMs)}</span>}
    </article>
    <div className="browse-library-links">{destinations.map(item => <button className={`list-link browse-destination${item.id === 'downloads' ? ' browse-download-destination' : ''}`} key={item.id}
      onClick={() => app.openRoute({ kind: 'collection', collection: item.id })}>
      <span className={`browse-destination-icon browse-destination-${item.id}`}><Icon name={item.icon} size={29} /></span>
      <span className="row-copy"><strong>{item.title}{item.id === 'downloads' && <Icon name="lock" size={14} />}</strong><small>{item.subtitle}</small>{item.id === 'downloads' && <small className="browse-download-note">Saved securely. Plays in Cine music.</small>}</span>
      <Icon name="chevron_right" size={20} />
    </button>)}</div>
    <SectionHeading title="Recently played" action={<button className="text-button" onClick={() => app.openRoute({ kind: 'account', page: 'history' })}>See all</button>} />
    {library.recent.length ? <SongRows songs={library.recent.slice(0, 3)} context="Recently played" /> : <p className="design-quiet-copy">Your listening history will appear here.</p>}
    <SectionHeading title="Your playlists" action={<Action icon="plus" label="Create playlist" onClick={() => app.openRoute({ kind: 'playlist-form' })} />} />
    {library.playlists.length ? <PlaylistRail playlists={library.playlists} />
      : <Notice title="A place for your kind of music" action={<button className="secondary-button" onClick={() => app.openRoute({ kind: 'playlist-form' })}><Icon name="plus" size={18} />Create playlist</button>}>Start a private playlist. Add the songs you want to come back to.</Notice>}
  </section>;
}

function PlayButtons({ songs, context, download }: { songs: Song[]; context: string; download?: ReactNode }) {
  const app = useApp();
  return <div className="browse-play-buttons"><button className="primary-button" disabled={!songs.length} onClick={() => app.playback.playAll(songs, false, context)}><Icon name="play" size={19} />Play all</button>
    <button className="secondary-button" disabled={!songs.length} onClick={() => app.playback.playAll(songs, true, context)}><Icon name="shuffle" size={20} />Shuffle</button>{download}</div>;
}

function DownloadJobs({ query }: { query: string }) {
  const app = useApp();
  const jobs = app.jobs.filter(job => matchingSongs([job.song], query).length && !app.downloads.some(song => song.id === job.id));
  if (!jobs.length) return null;
  const native = window.CineAndroid;
  function control(action: 'pauseDownload' | 'resumeDownload' | 'cancelDownload', id: string) {
    const method = native?.[action];
    if (!method) { app.toast('This download action is unavailable in this build.'); return; }
    try { method.call(native, id); app.refreshDownloads(); }
    catch (reason) { app.toast(message(reason)); }
  }
  return <section className="browse-download-jobs"><SectionHeading title="In progress" />
    {jobs.map(job => {
      const progress = Math.max(0, Math.min(99, Number.isFinite(job.progress) ? job.progress : 0));
      const label = job.status === 'queued' ? (app.prefs.wifiOnly ? 'Queued · Waiting for Wi-Fi or a free slot' : 'Queued')
        : job.status === 'downloading' ? `Downloading · ${Math.round(progress)}%` : job.status === 'paused' ? 'Paused · Resume restarts this transfer' : 'Download failed';
      return <div className="browse-download-job" key={job.id}>
        <Cover song={job.song} /><div className="row-copy"><strong>{job.song.title}</strong><small>{job.song.artist}</small>
          {job.status === 'downloading' && <progress max={100} value={progress} aria-label={`Downloading ${job.song.title}`} />}
          <small className={job.status === 'failed' ? 'browse-error-copy' : ''} role="status">{label}</small>
          {job.error && job.status === 'failed' && <small className="browse-error-copy">{job.error}</small>}
        </div>
        <div className="browse-job-actions">{job.status === 'downloading' || job.status === 'queued'
          ? <Action icon="pause" label={`Pause download of ${job.song.title}`} disabled={!native?.pauseDownload} onClick={() => control('pauseDownload', job.id)} />
          : <button className="text-button" disabled={!native?.resumeDownload} onClick={() => control('resumeDownload', job.id)}>{job.status === 'failed' ? 'Retry' : 'Resume'}</button>}
          <Action icon="close" label={`Cancel download of ${job.song.title}`} disabled={!native?.cancelDownload} onClick={() => control('cancelDownload', job.id)} />
        </div>
      </div>;
    })}
  </section>;
}

export function CollectionScreen({ collection }: { collection: Collection }) {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'az'>('recent');
  useEffect(() => { setQuery(''); setSort('recent'); }, [collection]);
  const title = collection[0].toUpperCase() + collection.slice(1);
  const library = app.account.library;
  const create = () => app.openRoute({ kind: 'playlist-form' });
  const localSongs = collection === 'downloads' ? app.downloads : library.favorites;
  const songs = matchingSongs(localSongs, query);
  const text = query.trim().toLocaleLowerCase();
  const directories = collection === 'artists' ? library.artists.map(artist => ({ id: artist.id, title: artist.name, cover: artist.cover, subtitle: 'Artist' }))
    : collection === 'albums' ? library.albums.map(album => ({ ...album, subtitle: album.artist || 'Album' })) : [];
  const entries = directories.filter(item => `${item.title} ${item.subtitle}`.toLocaleLowerCase().includes(text));
  if (sort === 'az') entries.sort((a, b) => a.title.localeCompare(b.title));
  const playlists = library.playlists.filter(playlist => `${playlist.name} ${playlist.description || ''}`.toLocaleLowerCase().includes(text));
  if (sort === 'az') playlists.sort((a, b) => a.name.localeCompare(b.name));
  const discover = () => {
    app.goTab('search');
    window.dispatchEvent(new CustomEvent('cine:browse-search', { detail: { query: collection === 'artists' ? 'artists' : 'albums' } }));
  };
  return <section className={`screen browse-collection browse-collection-${collection}`}>
    <PageHeader title={title} action={collection === 'playlists' ? <Action icon="plus" label="Create playlist" onClick={create} /> : undefined} />
    {(collection === 'favorites' || collection === 'downloads') ? <>
      <p className="browse-collection-summary">{count(localSongs.length)}{collection === 'downloads' && app.downloads.some(song => song.downloadBytes) ? ` · ${(app.downloads.reduce((sum, song) => sum + (song.downloadBytes || 0), 0) / 1_048_576).toFixed(1)} MB` : ''}</p>
      {collection === 'downloads' && <p className="browse-offline-caption"><Icon name="lock" size={14} />Completed songs, ready to play offline.</p>}
      <SearchField value={query} onChange={setQuery} placeholder={`Search ${collection}`} label={`Search ${collection}`} />
      <PlayButtons songs={songs} context={title} download={collection === 'favorites' ? <DownloadCollection songs={localSongs} title="Liked Songs" /> : undefined} />
      {collection === 'downloads' && <DownloadJobs query={query} />}
      {songs.length ? <>{collection === 'downloads' && !!app.jobs.length && <SectionHeading title="Ready offline" />}<SongRows songs={songs} context={title} showHearts={collection === 'favorites'} /></>
        : <Notice title={query.trim() ? 'No matching songs' : collection === 'favorites' ? 'Keep the songs you love' : 'Your offline listening starts here'} icon={collection === 'favorites' ? 'heart' : 'download'}
          action={query.trim() ? <button className="text-button" onClick={() => setQuery('')}>Clear search</button> : <button className="secondary-button" onClick={() => app.goTab('search')}>Explore music</button>}>
          {query.trim() ? 'Try another song title or artist.' : collection === 'favorites' ? 'Tap the heart on any song to add it to your favorites.' : 'Use a song menu to download. Incomplete transfers are never shown as ready offline.'}
        </Notice>}
      {collection === 'downloads' && <p className="browse-footnote"><Icon name="lock" size={13} />Downloads stay inside Cine music.</p>}
    </> : <>
      <p className="browse-collection-summary">{collection === 'playlists' ? count(library.playlists.length, 'playlist') : collection === 'albums' ? count(library.albums.length, 'album') : count(library.artists.length, 'artist')}</p>
      <SearchField value={query} onChange={setQuery} placeholder={`Find ${collection === 'artists' ? 'an artist' : collection === 'albums' ? 'an album' : 'a playlist'}`} label={`Search saved ${collection}`} />
      <label className="browse-sort"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value as 'recent' | 'az')}><option value="recent">Recently saved</option><option value="az">Name A to Z</option></select><Icon name="chevron_down" size={16} /></label>
      {collection === 'playlists' ? playlists.map(playlist => <button className="list-link browse-directory-row" key={playlist.id} onClick={() => app.openRoute({ kind: 'playlist', id: playlist.id })}>
        <Cover kind="playlist" song={{ title: playlist.name, cover: playlist.cover || playlist.songs[0]?.cover }} /><span className="row-copy"><strong>{playlist.name}</strong><small>{count(playlist.songs.length)} · Private</small></span><Icon name="chevron_right" size={19} />
      </button>) : entries.map(item => <button className="list-link browse-directory-row" key={item.id} onClick={() => app.openRoute({ kind: 'catalog', type: collection === 'artists' ? 'artist' : 'album', id: item.id })}>
        <Cover kind={collection === 'artists' ? 'artist' : 'album'} className={collection === 'artists' ? 'browse-round' : ''} song={{ title: item.title, cover: item.cover }} /><span className="row-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span><Icon name="chevron_right" size={19} />
      </button>)}
      {!(collection === 'playlists' ? playlists.length : entries.length) && <Notice
        title={query.trim() ? `No matching ${collection}` : collection === 'artists' ? 'Stay close to your favorites' : collection === 'albums' ? 'Keep the whole record' : 'Make your first playlist'}
        action={query.trim() ? <button className="text-button" onClick={() => setQuery('')}>Clear search</button> : <button className="secondary-button" onClick={collection === 'playlists' ? create : discover}>{collection === 'playlists' ? 'Create playlist' : `Discover ${collection}`}</button>}>
        {query.trim() ? 'Try a different name.' : collection === 'artists' ? 'Follow an artist from their page to find them here.' : collection === 'albums' ? 'Save an album from its page to add it to your library.' : 'Choose a name, add your songs, and make it yours.'}
      </Notice>}
    </>}
  </section>;
}

function PlaylistExportButton({ playlists, label }: { playlists: Playlist[]; label: string }) {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  async function exportPlaylists() {
    if (!playlists.length || busy) return;
    setBusy(true);
    try {
      const { saveTextFile } = await import('./native');
      await saveTextFile(playlistBackupFileName(playlists), 'application/json', playlistBackupText(playlists));
      app.toast(playlists.length === 1 ? 'Playlist exported.' : 'Playlist backup saved.');
    } catch (error) {
      if ((error as { name?: string } | null)?.name === 'AbortError') app.toast('Export cancelled.');
      else app.toast(error instanceof Error ? error.message : 'The playlists could not be exported.');
    } finally { setBusy(false); }
  }
  return <button className="text-button" disabled={busy || !playlists.length} onClick={() => void exportPlaylists()}>{busy ? 'Preparing backup...' : label}</button>;
}
function DownloadCollection({ songs, title }: { songs: Song[]; title: string }) {
  const app = useApp();
  const [confirm, setConfirm] = useState(false);
  const pending = uniqueById(songs).filter(song => !app.downloads.some(saved => saved.id === song.id)
    && !app.jobs.some(job => job.id === song.id && job.status !== 'failed'));
  return <><Action icon="download" label={pending.length ? `Download songs from ${title}` : 'All available songs are saved or queued'} disabled={!pending.length}
    onClick={() => { if (!window.CineAndroid) app.toast('Offline downloads are available in the Android app.'); else setConfirm(true); }} />
    {confirm && <ConfirmDialog title={`Download ${count(pending.length)}?`} confirmLabel={`Download ${pending.length}`} onClose={() => setConfirm(false)} onConfirm={() => {
      setConfirm(false);
      if (!app.online) { app.toast('Connect before starting downloads.'); return; }
      if (app.prefs.wifiOnly && !window.CineAndroid?.isWifiConnected()) { app.toast('Wi-Fi-only downloads are on. Connect to Wi-Fi before starting.'); return; }
      pending.forEach(song => app.download(song));
    }}>
      <p>Save {count(pending.length)} from <strong>{title}</strong> for offline listening inside Cine music?</p>
      <p>File sizes are not available in advance. This may use a substantial amount of data and device storage.</p>
      <p>{app.prefs.wifiOnly ? 'Wi-Fi-only downloads are on. Transfers can only start when Wi-Fi is connected.' : 'Mobile data may be used. Your network charges may apply.'}</p>
    </ConfirmDialog>}
  </>;
}

function EditableSongs({ playlist }: { playlist: Playlist }) {
  const app = useApp();
  const [remove, setRemove] = useState<Song | null>(null);
  function move(id: string, by: number) {
    app.account.setLibrary(library => ({ ...library, playlists: library.playlists.map(item => {
      if (item.id !== playlist.id) return item;
      const songs = [...item.songs];
      const from = songs.findIndex(song => song.id === id), to = from + by;
      if (from < 0 || to < 0 || to >= songs.length) return item;
      [songs[from], songs[to]] = [songs[to], songs[from]];
      return { ...item, songs };
    }) }));
  }
  return <><p className="browse-footnote">Changes save automatically. Your current playback queue will not change.</p>
    <div className="browse-edit-songs">{playlist.songs.map((song, index) => <div className="browse-edit-song" key={`${song.id}:${index}`}>
      <Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{song.artist}</small></span>
      <span className="browse-reorder"><Action icon="chevron_up" label={`Move ${song.title} up`} disabled={index === 0} onClick={() => move(song.id, -1)} /><Action icon="chevron_down" label={`Move ${song.title} down`} disabled={index === playlist.songs.length - 1} onClick={() => move(song.id, 1)} /></span>
      <Action icon="close" label={`Remove ${song.title} from playlist`} onClick={() => setRemove(song)} />
    </div>)}</div>
    {remove && <ConfirmDialog title="Remove from playlist?" confirmLabel="Remove song" destructive onClose={() => setRemove(null)} onConfirm={() => {
      app.account.setLibrary(library => ({ ...library, playlists: library.playlists.map(item => item.id === playlist.id ? { ...item, songs: item.songs.filter(song => song.id !== remove.id) } : item) }));
      setRemove(null);
    }}><p><strong>{remove.title}</strong> will be removed from this playlist, not your favorites, downloads, or current queue.</p></ConfirmDialog>}
  </>;
}

export function PlaylistScreen({ id }: { id: string }) {
  const app = useApp();
  const playlist = app.account.library.playlists.find(item => item.id === id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { setEditing(false); setDeleting(false); }, [id]);
  if (!playlist) return <section className="screen browse-playlist"><PageHeader title="Playlist" /><Notice title="This playlist is not in your library" action={<button className="secondary-button" onClick={() => app.openRoute({ kind: 'collection', collection: 'playlists' })}>Your playlists</button>}>It may have been removed or belong to a different account. Playback has not been changed.</Notice></section>;
  return <section className="screen browse-playlist">
    <PageHeader title="Playlist" action={<Action icon="more" label={`Edit ${playlist.name}`} onClick={() => app.openRoute({ kind: 'playlist-form', id })} />} />
    <div className="browse-detail-heading"><Cover kind="playlist" large song={{ title: playlist.name, cover: playlist.cover || playlist.songs[0]?.cover }} />
      <h1>{playlist.name}</h1><p className="browse-meta">By you · {count(playlist.songs.length)}{duration(playlist.songs) ? ` · ${duration(playlist.songs)}` : ''}</p>
      <span className="browse-private"><Icon name="lock" size={13} />Private playlist</span>
      {playlist.description && <p className="browse-description">{playlist.description}</p>}
    </div>
    <div className="browse-detail-actions"><DownloadCollection songs={playlist.songs} title={playlist.name} /><button className="text-button" onClick={() => app.openRoute({ kind: 'playlist-form', id })}>Edit details</button><PlaylistExportButton playlists={[playlist]} label="Export" /><span className="browse-flex" />
      <Action icon="shuffle" label={`Shuffle ${playlist.name}`} disabled={!playlist.songs.length} onClick={() => app.playback.playAll(playlist.songs, true, playlist.name)} />
      <button className="browse-round-play" aria-label={`Play ${playlist.name}`} disabled={!playlist.songs.length} onClick={() => app.playback.playAll(playlist.songs, false, playlist.name)}><Icon name="play" size={25} /></button>
    </div>
    {!!playlist.songs.length && <SectionHeading title={count(playlist.songs.length)} action={<button className="text-button" onClick={() => setEditing(value => !value)}>{editing ? 'Done' : 'Edit songs'}</button>} />}
    {playlist.songs.length ? editing ? <EditableSongs playlist={playlist} /> : <SongRows songs={playlist.songs} context={playlist.name} />
      : <Notice title="The start of something good">Add songs from Search or any song's menu to build this playlist.</Notice>}
    <button className="browse-add-songs" onClick={() => { app.setAddToPlaylist(id); app.goTab('search'); }}><Icon name="plus" size={23} /><span>Add songs</span></button>
    <div className="browse-danger-zone"><button className="text-button browse-delete" onClick={() => setDeleting(true)}><Icon name="trash" size={17} />Delete playlist</button></div>
    {deleting && <ConfirmDialog title="Delete this playlist?" confirmLabel="Delete playlist" destructive onClose={() => setDeleting(false)} onConfirm={() => {
      app.account.setLibrary(library => ({ ...library, playlists: library.playlists.filter(item => item.id !== id) }));
      if (app.addToPlaylist === id) app.setAddToPlaylist(null);
      setDeleting(false);
      app.back();
      app.toast('Playlist deleted. Your playback and downloads are unchanged.');
    }}><p><strong>{playlist.name}</strong> will be removed from your library. Your songs, downloads, and current playback queue will not be deleted.</p></ConfirmDialog>}
  </section>;
}

function ArtistLinks({ artists }: { artists: { id: string; name: string }[] }) {
  const app = useApp();
  return <div className="browse-artist-links">{artists.map((artist, index) => <span key={`${artist.id}:${index}`}>{index > 0 && <span className="muted">, </span>}{artist.id
    ? <button className="text-button" onClick={() => app.openRoute({ kind: 'catalog', type: 'artist', id: artist.id })}>{artist.name}</button>
    : <span>{artist.name}</span>}</span>)}</div>;
}

export function CatalogScreen({ type, id }: { type: CatalogType; id: string }) {
  const app = useApp();
  const key = `${type}:${id}`;
  const [state, setState] = useState<{ key: string; data?: CatalogDetails; loading: boolean; error: string }>({ key, data: detailCache.get(key), loading: !detailCache.has(key), error: '' });
  const [retry, setRetry] = useState(0);
  const previousKey = useRef(key);
  useEffect(() => {
    const abort = new AbortController();
    const cached = detailCache.get(key);
    const changed = previousKey.current !== key;
    previousKey.current = key;
    setState({ key, data: cached, loading: !cached, error: '' });
    if (cached && (retry === 0 || changed)) return () => abort.abort();
    if (!app.online) { setState({ key, data: cached, loading: false, error: 'You are offline. Connect to load this page.' }); return () => abort.abort(); }
    setState({ key, data: cached, loading: true, error: '' });
    const load = type === 'artist' ? innertubeCatalog.getArtist(id, abort.signal) : type === 'album' ? innertubeCatalog.getAlbum(id, abort.signal) : innertubeCatalog.getPlaylist(id, abort.signal);
    void load.then(data => {
      if (abort.signal.aborted) return;
      detailCache.set(key, data);
      if (detailCache.size > 20) detailCache.delete(detailCache.keys().next().value!);
      setState({ key, data, loading: false, error: '' });
    }).catch(reason => { if (!abort.signal.aborted) setState({ key, data: cached, loading: false, error: message(reason) }); });
    return () => abort.abort();
  }, [key, type, id, retry, app.online]);

  const data = state.key === key ? state.data : detailCache.get(key);
  const loading = state.key === key ? state.loading : !data;
  const error = state.key === key ? state.error : '';
  const retryButton = <button className="secondary-button" onClick={() => setRetry(value => value + 1)}>Try again</button>;
  if (!data) return <section className="screen browse-catalog"><PageHeader title={type[0].toUpperCase() + type.slice(1)} />{loading ? <Loading>Opening {type}...</Loading>
    : <Notice title={`Could not load this ${type}`} icon="wifi" action={retryButton}>{error || 'This item is unavailable from the catalog right now.'}</Notice>}</section>;
  const songs = data.tracks.map(track => songFrom(data.type === 'album' && !track.album ? { ...track, album: { id: data.id, title: data.title } } : track));
  const title = data.type === 'artist' ? data.name : data.title;
  const artistSaved = data.type === 'artist' && app.account.library.artists.some(item => item.id === data.id);
  const albumSaved = data.type === 'album' && app.account.library.albums.some(item => item.id === data.id);
  const copyId = `catalog:${id}`;
  const playlistSaved = data.type === 'playlist' && app.account.library.playlists.some(item => item.id === copyId);
  function saveArtist() {
    if (data?.type !== 'artist') return;
    app.account.setLibrary(library => ({ ...library, artists: library.artists.some(artist => artist.id === data.id)
      ? library.artists.filter(artist => artist.id !== data.id) : [{ id: data.id, name: data.name, cover: data.cover?.url }, ...library.artists] }));
  }
  function saveAlbum() {
    if (data?.type !== 'album') return;
    app.account.setLibrary(library => ({ ...library, albums: library.albums.some(album => album.id === data.id)
      ? library.albums.filter(album => album.id !== data.id) : [{ id: data.id, title: data.title, artist: data.artists.map(artist => artist.name).join(', '), cover: data.cover?.url }, ...library.albums] }));
  }
  const releases: ArtistAlbum[] = data.type === 'artist' ? uniqueById([...data.albums, ...data.singles]) : [];
  const tracksTotal = data.type !== 'artist' ? data.trackCount : undefined;
  return <section className={`screen browse-catalog browse-catalog-${data.type}`}>
    <PageHeader title={data.type === 'artist' ? 'Artist' : data.type === 'album' ? 'Album' : 'Playlist'} />
    {error && <div className="browse-stale" role="status"><p>Showing the saved page. {error}</p>{retryButton}</div>}
    {loading && <Loading>Refreshing page...</Loading>}
    {data.type === 'artist' ? <div className="browse-artist-hero"><Cover large kind="artist" song={{ title: data.name, cover: data.cover?.url }} /><div><p className="browse-eyebrow">ARTIST</p><h1>{data.name}</h1>{data.monthlyListeners && <p>{data.monthlyListeners} monthly listeners</p>}</div></div>
        : <div className="browse-detail-heading"><Cover large kind={data.type} song={{ title, cover: data.cover?.url }} /><h1>{title}</h1>
        {data.type === 'album' && <ArtistLinks artists={data.artists} />}
        <p className="browse-meta">{[data.type === 'album' ? 'Album' : data.author || 'Catalog playlist', data.year, count(tracksTotal ?? songs.length), duration(songs)].filter(Boolean).join(' · ')}</p>
        {data.type === 'playlist' && data.description && <p className="browse-description">{data.description}</p>}
      </div>}
    <div className="browse-detail-actions">
      {data.type === 'artist' ? <button className={`secondary-button browse-follow${artistSaved ? ' is-saved' : ''}`} aria-pressed={artistSaved} onClick={saveArtist}>{artistSaved && <Icon name="check" size={16} />}{artistSaved ? 'Following' : 'Follow'}</button>
        : data.type === 'album' ? <Action icon="heart" label={albumSaved ? 'Remove album from library' : 'Save album to library'} active={albumSaved} onClick={saveAlbum} />
          : <button className="secondary-button browse-follow" disabled={!songs.length || playlistSaved} onClick={() => {
            const playlist: Playlist = { id: copyId, name: data.title, description: data.description, cover: data.cover?.url, songs, isPublic: false };
            app.account.setLibrary(library => library.playlists.some(item => item.id === copyId) ? library : { ...library, playlists: [playlist, ...library.playlists] });
            app.toast('A private copy was added to your playlists.');
          }}>{playlistSaved ? 'Saved to library' : 'Save a copy'}</button>}
      {data.type !== 'artist' && <DownloadCollection songs={songs} title={title} />}<span className="browse-flex" />
      <Action icon="shuffle" label={`Shuffle ${title}`} disabled={!songs.length} onClick={() => app.playback.playAll(songs, true, title)} />
      <button className="browse-round-play" aria-label={`Play ${title}`} disabled={!songs.length} onClick={() => app.playback.playAll(songs, false, title)}><Icon name="play" size={25} /></button>
    </div>
    {data.type === 'artist' && <SectionHeading title="Popular" />}
    {tracksTotal !== undefined && tracksTotal > songs.length && <p className="browse-footnote">Showing {count(songs.length)} currently returned by the catalog out of {tracksTotal}. Play, save, and download apply only to these loaded songs.</p>}
    {songs.length ? <SongRows songs={data.type === 'artist' ? songs.slice(0, 12) : songs} context={title} /> : <Notice title="No songs available">This page did not return playable songs. Try again later.</Notice>}
    {data.type === 'artist' && <>
      <SectionHeading title="Albums & releases" />
      {releases.length ? <AlbumShelf items={releases.map(album => ({ id: album.id, title: album.title, artist: data.name, cover: album.cover?.url, year: album.year }))} /> : <p className="muted">No album releases were returned for this artist.</p>}
      {data.bio && <details className="browse-bio"><summary>About {data.name}<Icon name="chevron_down" size={18} /></summary><p>{data.bio}</p></details>}
    </>}
    {data.type === 'playlist' && playlistSaved && <button className="browse-add-songs" onClick={() => app.openRoute({ kind: 'playlist', id: copyId })}><Icon name="library" size={21} />Open your private copy<Icon name="chevron_right" size={17} /></button>}
  </section>;
}

export function PlaylistForm({ id, initialSong }: { id?: string; initialSong?: Song }) {
  const app = useApp();
  const playlist = app.account.library.playlists.find(item => item.id === id);
  if (!app.account.ready) return <section className="screen browse-playlist-form"><PageHeader title={id ? 'Edit playlist' : 'New playlist'} /><Loading>Opening your library...</Loading></section>;
  if (id && !playlist) return <section className="screen browse-playlist-form"><PageHeader title="Edit playlist" /><Notice title="Playlist not found">The playlist may have been removed. Your other saved music is unchanged.</Notice></section>;
  return <PlaylistEditor key={id || 'new'} playlist={playlist} initialSong={initialSong} />;
}

function PlaylistEditor({ playlist, initialSong }: { playlist?: Playlist; initialSong?: Song }) {
  const app = useApp();
  const original = useRef({ name: playlist?.name || '', description: playlist?.description || '', cover: playlist?.cover || '', songs: playlist?.songs || (initialSong ? [initialSong] : []) });
  const [name, setName] = useState(original.current.name);
  const [description, setDescription] = useState(original.current.description);
  const [cover, setCover] = useState(original.current.cover);
  const [songs, setSongs] = useState(original.current.songs);
  const songsChanged = songs.map(song => song.id).join(',') !== original.current.songs.map(song => song.id).join(',');
  const [nameError, setNameError] = useState('');
  const [coverError, setCoverError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const imageRequest = useRef(0);
  const guardEnabled = useRef(true);
  const dirty = name !== original.current.name || description !== original.current.description || cover !== original.current.cover || songsChanged;
  useEffect(() => () => { imageRequest.current++; }, []);
  useEffect(() => {
    if (!dirty) return;
    const beforeNavigate = (event: Event) => {
      if (!guardEnabled.current) return;
      const proceed = (event as CustomEvent<{ proceed?: () => void }>).detail?.proceed;
      if (!proceed) return;
      event.preventDefault();
      setLeave(() => proceed);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (guardEnabled.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('cine:before-navigate', beforeNavigate);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('cine:before-navigate', beforeNavigate); window.removeEventListener('beforeunload', beforeUnload); };
  }, [dirty]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const ticket = ++imageRequest.current;
    setCoverError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setCoverError('Choose a JPG, PNG, or WebP image.'); return; }
    if (file.size > 5 * 1_048_576) { setCoverError('Choose an image smaller than 5 MB.'); return; }
    setUploading(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('This image could not be read. Choose another image.')); image.src = url; });
      if (ticket !== imageRequest.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 384;
      const context = canvas.getContext('2d');
      if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('This image could not be resized.');
      if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Choose an image under 40 megapixels to keep memory use small.');
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      context.fillStyle = '#101820';
      context.fillRect(0, 0, 384, 384);
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 384, 384);
      let resized = canvas.toDataURL('image/jpeg', .76);
      if (resized.length > 180_000) resized = canvas.toDataURL('image/jpeg', .48);
      if (resized.length >= 180_000) throw new Error('This image is too detailed to save as a small cover. Try another image.');
      setCover(resized);
    } catch (reason) { if (ticket === imageRequest.current) setCoverError(message(reason)); }
    finally { URL.revokeObjectURL(url); if (ticket === imageRequest.current) setUploading(false); }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (!value) { setNameError('Give your playlist a name.'); document.getElementById('browse-playlist-name')?.focus(); return; }
    if (value.length > 80) { setNameError('Use 80 characters or fewer.'); return; }
    if (uploading) return;
    const id = playlist?.id || crypto.randomUUID();
    app.account.setLibrary(library => {
      const fields = { name: value, description: description.trim(), cover: cover || undefined, isPublic: false };
      return { ...library, playlists: playlist ? library.playlists.map(item => item.id === id ? { ...item, ...fields, songs: songsChanged ? mergePlaylistSongDraft(item.songs, original.current.songs, songs) : item.songs } : item)
        : [{ id, ...fields, songs }, ...library.playlists] };
    });
    guardEnabled.current = false;
    app.toast(playlist ? 'Playlist updated.' : 'Your private playlist is ready.');
    app.back();
    if (!playlist) app.openRoute({ kind: 'playlist', id });
  }

  return <section className={`screen browse-playlist-form ${playlist ? 'editing-playlist' : 'creating-playlist'}`}>
    <PageHeader title={playlist ? 'Edit playlist' : 'New playlist'} />
    <p className="design-form-description">{playlist ? 'Update the cover, name, and track order before saving.' : 'Choose a cover, add a name, and describe the mood.'}</p>
    <form className="browse-form" onSubmit={save} noValidate>
      {!playlist && <fieldset className="playlist-cover-presets"><legend>Playlist artwork</legend><div>{Object.entries(figmaArtwork).map(([label, image]) => <button type="button" key={label} aria-label={`Use ${label} artwork`} aria-pressed={cover === image} onClick={() => { setCover(image); setCoverError(''); }}><img src={image} alt="" /><span>{cover === image ? 'Selected' : label === 'midnight' ? 'Midnight Echo' : label[0].toUpperCase() + label.slice(1)}</span></button>)}</div></fieldset>}
      <div className="browse-cover-editor"><label className="browse-cover-picker">
        <Cover kind="playlist" large song={{ title: name || 'Playlist cover', cover: cover || undefined }} />
        <span><Icon name="plus" size={16} />{uploading ? 'Resizing image...' : cover ? 'Change cover' : 'Add cover'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose playlist cover" disabled={uploading} onChange={event => { void upload(event); }} />
      </label>{cover && <button type="button" className="text-button" disabled={uploading} onClick={() => { setCover(''); setCoverError(''); }}>Remove cover</button>}
        <small>JPG, PNG or WebP. Up to 5 MB, resized before saving.</small>{coverError && <p className="browse-field-error" role="alert">{coverError}</p>}
      </div>
      <label className="browse-form-field" htmlFor="browse-playlist-name">Playlist name<input id="browse-playlist-name" value={name} onChange={event => { setName(event.target.value); if (nameError) setNameError(''); }} onBlur={() => { if (name && !name.trim()) setNameError('Give your playlist a name.'); }} maxLength={80} placeholder="Give it a name" autoComplete="off" required aria-invalid={!!nameError} aria-describedby={nameError ? 'browse-playlist-name-error' : undefined} /></label>
      {nameError && <p className="browse-field-error" id="browse-playlist-name-error" role="alert">{nameError}</p>}
      <label className="browse-form-field" htmlFor="browse-playlist-description">Description <span className="muted">(optional)</span><textarea id="browse-playlist-description" rows={3} maxLength={400} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add a few words" /></label>
      <div className="browse-privacy-note"><Icon name="lock" size={20} /><span><strong>Private playlist</strong><small>Only in your library. Public publishing is not available.</small></span><Icon name="check" size={19} /></div>
      {songs.length > 0 && <section className="playlist-draft-songs"><h2>{playlist ? 'Reorder songs' : 'Included song'}<small>{count(songs.length)}</small></h2>{songs.map((song, index) => <div className="playlist-draft-row" key={song.id}><Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{song.artist}</small></span><div className="playlist-draft-controls"><Action icon="chevron_up" label={`Move ${song.title} up`} disabled={index === 0} onClick={() => setSongs(previous => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} /><Action icon="chevron_down" label={`Move ${song.title} down`} disabled={index === songs.length - 1} onClick={() => setSongs(previous => { const next = [...previous]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} /><Action icon="close" label={`Remove ${song.title} from draft`} onClick={() => setSongs(previous => previous.filter(item => item.id !== song.id))} /></div></div>)}</section>}
      <div className="playlist-form-actions"><button className="secondary-button" type="button" onClick={() => dirty ? setLeave(() => app.back) : app.back()}>Cancel</button><button className="primary-button" type="submit" disabled={uploading}>{playlist ? 'Save changes' : 'Create playlist'}</button></div>
    </form>
    {leave && <ConfirmDialog title="Discard your changes?" confirmLabel="Discard changes" destructive onClose={() => setLeave(null)} onConfirm={() => { guardEnabled.current = false; const proceed = leave; setLeave(null); proceed(); }}><p>Your unsaved playlist details and cover changes will be lost.</p></ConfirmDialog>}
  </section>;
}

import { useRef, useState } from 'react';
import { useApp } from './AppContext';
import { Cover } from './ui';
import { Icon } from './Icons';
import { searchMusicCatalog } from './musicSearch';
import { songFrom } from './Browse';
import type { SearchResult } from '@/shared/contracts';

export function TvSearchScreen() {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(text = query) {
    const value = text.trim(); if (!value) return;
    setSubmitted(value); setQuery(value); setLoading(true); setError(''); setResults([]);
    try {
      if (!app.online) { setError('Connect to the internet to search.'); return; }
      const found = await searchMusicCatalog(value, 'all', new AbortController().signal);
      setResults(found);
    } catch { setError('Search could not connect. Try again.'); }
    finally { setLoading(false); }
  }

  const songs = results.filter((r): r is Extract<SearchResult, { type: 'track' }> => r.type === 'track').map(songFrom);
  const artists = results.filter((r): r is Extract<SearchResult, { type: 'artist' }> => r.type === 'artist');
  const albums = results.filter((r): r is Extract<SearchResult, { type: 'album' }> => r.type === 'album');

  return (
    <section className="tv-screen" aria-label="Search">
      <header className="tv-page-head">
        <h1>Search</h1>
        <div className="tv-searchbar">
          <Icon name="search" size={22} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void run(); }}
            placeholder="Songs, artists, albums"
            aria-label="Search music"
            data-tv-autofocus="true"
          />
          {query ? (
            <button type="button" className="tv-icon-btn" aria-label="Clear search" onClick={() => { setQuery(''); setSubmitted(''); setResults([]); inputRef.current?.focus(); }}>
              <Icon name="close" size={18} />
            </button>
          ) : null}
          <button type="button" className="tv-pill tv-pill-primary" onClick={() => void run()}>Search</button>
        </div>
      </header>

      {loading && <div className="tv-loading" role="status"><span className="spinner" aria-hidden="true" />Searching for {submitted}…</div>}
      {error && <div className="tv-glass tv-glass-panel tv-empty"><h2>Search unavailable</h2><p>{error}</p><div style={{ marginTop: 16 }}><button type="button" className="tv-pill" onClick={() => void run(submitted)}>Try again</button></div></div>}
      {!!submitted && !loading && !error && !results.length && <div className="tv-glass tv-glass-panel tv-empty"><h2>No results for “{submitted}”</h2><p>Try a different song, artist, or album.</p></div>}

      {!!songs.length && (
        <section className="tv-shelf" aria-label="Songs">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Songs</h2><button type="button" className="tv-btn-ghost" style={{ minHeight: 44, padding: '0 18px', fontSize: 16 }} onClick={async () => { app.openPlayer(); await app.playback.playAll(songs, false, `Search: ${submitted}`); }}>Play all</button></div>
          <div className="tv-song-list" data-tv-shelf-id="search-songs">
            {songs.slice(0, 14).map((song, i) => (
              <button key={song.id} type="button" className="tv-song-row" onClick={async () => { app.openPlayer(); await app.playback.play(song, songs, `Search: ${submitted}`); }} aria-label={`Play ${song.title}`}>
                <span className="tv-song-index">{i + 1}</span>
                <Cover song={song} />
                <span className="tv-song-copy"><strong>{song.title}</strong><small>{song.artist}</small></span>
                <Icon name="play" size={18} />
              </button>
            ))}
          </div>
        </section>
      )}

      {!!artists.length && (
        <section className="tv-shelf" aria-label="Artists">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Top Artists</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="search-artists" role="list">
            {artists.slice(0, 12).map(item => (
              <button key={item.id} type="button" role="listitem" className="tv-card tv-card-artist" onClick={() => app.openRoute({ kind: 'catalog', type: 'artist', id: item.id })} aria-label={item.name}>
                <div className="tv-card-media">{item.cover?.url ? <img src={item.cover.url} alt="" loading="lazy" /> : <Cover kind="artist" song={{ title: item.name }} />}</div>
                <span className="tv-card-title">{item.name}</span>
                <span className="tv-card-sub">Artist</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!albums.length && (
        <section className="tv-shelf" aria-label="Albums">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Made For You</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="search-albums" role="list">
            {albums.slice(0, 12).map(item => (
              <button key={item.id} type="button" role="listitem" className="tv-card tv-card-rect" onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: item.id })} aria-label={item.title}>
                <div className="tv-card-media"><img src={item.cover?.url || ''} alt="" loading="lazy" /></div>
                <span className="tv-card-title">{item.title}</span>
                <span className="tv-card-sub">{item.artists.map(a => a.name).join(', ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!submitted && !loading && (
        <div className="tv-glass tv-glass-panel tv-empty" style={{ maxWidth: 760 }}>
          <Icon name="search" size={34} />
          <h2 style={{ marginTop: 10 }}>Find your next favorite</h2>
          <p>Search for songs, artists, and albums. Use the D-pad to move between results and press OK to play or open.</p>
        </div>
      )}
    </section>
  );
}

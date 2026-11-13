import { useState } from 'react';
import { useApp } from './AppContext';
import { Icon } from './Icons';
import { useDiscovery } from './discovery';

export function TvExploreScreen() {
  const app = useApp();
  const { items, loading, error, retry } = useDiscovery(app.tab === 'explore');
  const [query, setQuery] = useState('');
  const featured = items[0];
  const open = (id: string) => app.openRoute({ kind: 'catalog', type: 'album', id });
  const search = () => {
    const text = query.trim(); if (!text) return;
    app.goTab('search');
    setTimeout(() => window.dispatchEvent(new CustomEvent('cine:browse-search', { detail: { query: text } })), 50);
  };

  return (
    <section className="tv-screen" aria-label="Explore">
      <header className="tv-page-head">
        <h1>Explore</h1>
        <div className="tv-searchbar" style={{ minWidth: 420 }}>
          <Icon name="search" size={20} />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Find an artist or album" aria-label="Explore music" data-tv-autofocus="true" />
        </div>
      </header>

      {featured && (
        <div className="tv-home-hero" style={{ minHeight: 320, marginBottom: 30 }}>
          <div className="tv-hero-backdrop" aria-hidden="true">{featured.cover?.url ? <img src={featured.cover.url} alt="" /> : null}</div>
          <div className="tv-hero-scrim" aria-hidden="true" />
          <div className="tv-hero-content">
            <span className="tv-badge-new">SPOTLIGHT</span>
            <h2 className="tv-hero-title" style={{ fontSize: 'clamp(36px,3.6vw,52px)' }}>{featured.title}</h2>
            <p className="tv-hero-sub">{featured.artists.map(a => a.name).join(', ')}</p>
            <div className="tv-hero-actions">
              <button type="button" className="tv-hero-cta" onClick={() => open(featured.id)}><Icon name="play" size={20} /><span>Open</span></button>
            </div>
          </div>
        </div>
      )}

      {!!items.length && (
        <section className="tv-shelf" aria-label="Releases">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Fresh Releases</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="explore-releases" role="list">
            {items.filter(item => item.id !== featured?.id).map(item => (
              <button key={item.id} type="button" role="listitem" className="tv-card tv-card-rect" onClick={() => open(item.id)} aria-label={item.title}>
                <div className="tv-card-media"><img src={item.cover?.url || ''} alt="" loading="lazy" /></div>
                <span className="tv-card-title">{item.title}</span>
                <span className="tv-card-sub">{item.artists.map(a => a.name).join(', ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && <div className="tv-loading" role="status"><span className="spinner" aria-hidden="true" />Finding releases…</div>}
      {error && !loading && <div className="tv-glass tv-glass-panel tv-empty"><h2>Could not load Explore</h2><p>{error}</p><div style={{ marginTop: 16 }}><button type="button" className="tv-pill" onClick={retry}>Try again</button></div></div>}
    </section>
  );
}

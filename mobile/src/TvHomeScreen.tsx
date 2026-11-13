import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { Cover } from './ui';
import { Icon } from './Icons';
import { useDiscovery } from './discovery';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { Song } from './types';

async function playSong(app: ReturnType<typeof useApp>, song: Song, list: Song[], context: string) {
  app.openPlayer();
  await app.playback.play(song, list, context);
}

export function TvHomeScreen() {
  const app = useApp();
  const library = app.account.library;
  const [edition, setEdition] = useState(() => Math.floor(Date.now() / 3_600_000));
  const feed = useDiscovery(true, edition);
  const releases = feed.items;
  const hero = releases[0];
  const recent = library.recent.slice(0, 14);
  const madeForYou = releases.slice(1, 13);
  const topArtists = library.artists.slice(0, 14);
  const [starting, setStarting] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function playHero() {
    if (!hero || starting) return;
    const controller = new AbortController();
    pending.current?.abort(); pending.current = controller; setStarting(true);
    try {
      const album = await innertubeCatalog.getAlbum(hero.id, controller.signal);
      if (controller.signal.aborted) return;
      const songs = album.tracks.map(track => ({
        id: track.id, title: track.title,
        artist: track.artists.map(a => a.name).join(', '),
        artistId: track.artists[0]?.id, albumId: album.id,
        cover: track.cover?.url || album.cover?.url, durationMs: track.durationMs,
      }));
      if (songs.length) { app.openPlayer(); await app.playback.playAll(songs, false, album.title); }
      else app.toast('This release has no playable songs.');
    } catch { if (!controller.signal.aborted) app.toast('Could not open this release.'); }
    finally { if (!controller.signal.aborted) setStarting(false); }
  }

  const heroTitle = hero?.title || (recent[0]?.title ? `Continue: ${recent[0].title}` : 'Your music, ready to play');
  const heroSub = hero?.artists?.map(a => a.name).join(', ') || (recent[0] ? recent[0].artist : 'Pick something you love from your library.');
  const heroArt = hero?.cover?.url || recent[0]?.cover || '';

  return (
    <section className="tv-screen tv-home" aria-label="Home">
      <div className="tv-home-hero">
        <div className="tv-hero-backdrop" aria-hidden="true">
          {heroArt ? <img src={heroArt} alt="" /> : null}
        </div>
        <div className="tv-hero-scrim" aria-hidden="true" />
        <div className="tv-hero-content">
          <span className="tv-badge-new">{hero ? 'NEW RELEASE' : 'READY TO PLAY'}</span>
          <h1 className="tv-hero-title">{heroTitle}</h1>
          <p className="tv-hero-sub">{heroSub}</p>
          <div className="tv-hero-actions">
            <button
              type="button"
              className="tv-hero-cta"
              data-tv-autofocus="true"
              onClick={() => {
                if (hero) void playHero();
                else if (recent[0]) playSong(app, recent[0], recent, 'Recently Played');
              }}
              disabled={starting}
            >
              <Icon name="play" size={20} />
              <span>{starting ? 'Opening…' : 'Play Now'}</span>
            </button>
            {hero && (
              <button type="button" className="tv-btn-ghost" onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: hero.id })}>
                Open
              </button>
            )}
          </div>
        </div>
      </div>

      {!!recent.length && (
        <section className="tv-shelf" aria-label="Recently Played">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Recently Played</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="recently-played" role="list">
            {recent.map(song => (
              <button
                key={`recent-${song.id}`}
                type="button"
                role="listitem"
                className="tv-card tv-card-square"
                onClick={() => playSong(app, song, recent, 'Recently Played')}
                aria-label={`Play ${song.title} by ${song.artist}`}
              >
                <div className="tv-card-media"><Cover song={song} /></div>
                <span className="tv-card-title">{song.title}</span>
                <span className="tv-card-sub">{song.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!madeForYou.length && (
        <section className="tv-shelf" aria-label="Made For You">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Made For You</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="made-for-you" role="list">
            {madeForYou.map(item => (
              <button
                key={`mfy-${item.id}`}
                type="button"
                role="listitem"
                className="tv-card tv-card-rect"
                onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: item.id })}
                aria-label={`Open ${item.title}`}
              >
                <div className="tv-card-media">
                  {item.cover?.url ? <img src={item.cover.url} alt="" loading="lazy" /> : <Cover song={{ title: item.title }} />}
                </div>
                <span className="tv-card-title">{item.title}</span>
                <span className="tv-card-sub">{item.artists.map(a => a.name).join(', ')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!topArtists.length && (
        <section className="tv-shelf" aria-label="Top Artists">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Top Artists</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="top-artists" role="list">
            {topArtists.map(artist => (
              <button
                key={`artist-${artist.id}`}
                type="button"
                role="listitem"
                className="tv-card tv-card-artist"
                onClick={() => app.openRoute({ kind: 'catalog', type: 'artist', id: artist.id })}
                aria-label={`Open ${artist.name}`}
              >
                <div className="tv-card-media"><Cover kind="artist" song={{ title: artist.name, cover: artist.cover }} /></div>
                <span className="tv-card-title">{artist.name}</span>
                <span className="tv-card-sub">Artist</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {feed.loading && !hero && !recent.length && (
        <div className="tv-loading" role="status"><span className="spinner" aria-hidden="true" />Finding music for you…</div>
      )}
    </section>
  );
}

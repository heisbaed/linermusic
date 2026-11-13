import { useApp } from './AppContext';
import { Cover } from './ui';
import { Icon } from './Icons';

export function TvLibraryScreen() {
  const app = useApp();
  const library = app.account.library;
  const recent = library.recent.slice(0, 14);
  const favorites = library.favorites.slice(0, 14);
  const playlists = library.playlists.slice(0, 12);
  const artists = library.artists.slice(0, 14);
  const albums = library.albums.slice(0, 12);

  return (
    <section className="tv-screen" aria-label="Library">
      <header className="tv-page-head">
        <h1>Library</h1>
        <p className="tv-body-text">Your favorites, playlists, artists, and albums.</p>
      </header>

      {!!recent.length && (
        <section className="tv-shelf" aria-label="Recently Played">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Recently Played</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="library-recent" role="list">
            {recent.map(song => (
              <button key={`lr-${song.id}`} type="button" role="listitem" className="tv-card tv-card-square" onClick={() => app.playback.play(song, recent, 'Recently Played')} aria-label={`Play ${song.title}`}>
                <div className="tv-card-media"><Cover song={song} /></div>
                <span className="tv-card-title">{song.title}</span>
                <span className="tv-card-sub">{song.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!playlists.length && (
        <section className="tv-shelf" aria-label="Made For You">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Made For You</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="library-playlists" role="list">
            {playlists.map(pl => (
              <button key={pl.id} type="button" role="listitem" className="tv-card tv-card-rect" onClick={() => app.openRoute({ kind: 'playlist', id: pl.id })} aria-label={pl.name}>
                <div className="tv-card-media"><Cover kind="playlist" song={{ title: pl.name, cover: pl.cover || pl.songs[0]?.cover }} /></div>
                <span className="tv-card-title">{pl.name}</span>
                <span className="tv-card-sub">{pl.songs.length} songs</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!albums.length && (
        <section className="tv-shelf" aria-label="Albums">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Albums</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="library-albums" role="list">
            {albums.map(album => (
              <button key={album.id} type="button" role="listitem" className="tv-card tv-card-rect" onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: album.id })} aria-label={album.title}>
                <div className="tv-card-media"><Cover song={{ title: album.title, cover: album.cover }} /></div>
                <span className="tv-card-title">{album.title}</span>
                <span className="tv-card-sub">{album.artist || 'Album'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!favorites.length && (
        <section className="tv-shelf" aria-label="Favorites">
          <div className="tv-shelf-header">
            <h2 className="tv-shelf-title">Favorites</h2>
            <button type="button" className="tv-btn-ghost" style={{ minHeight: 44, padding: '0 18px', fontSize: 16 }} onClick={() => app.playback.playAll(favorites, true, 'Favorites')}>Shuffle</button>
          </div>
          <div className="tv-carousel" data-tv-shelf-id="library-favorites" role="list">
            {favorites.map(song => (
              <button key={`lf-${song.id}`} type="button" role="listitem" className="tv-card tv-card-square" onClick={() => app.playback.play(song, favorites, 'Favorites')} aria-label={`Play ${song.title}`}>
                <div className="tv-card-media"><Cover song={song} /></div>
                <span className="tv-card-title">{song.title}</span>
                <span className="tv-card-sub">{song.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!!artists.length && (
        <section className="tv-shelf" aria-label="Top Artists">
          <div className="tv-shelf-header"><h2 className="tv-shelf-title">Top Artists</h2></div>
          <div className="tv-carousel" data-tv-shelf-id="library-artists" role="list">
            {artists.map(artist => (
              <button key={artist.id} type="button" role="listitem" className="tv-card tv-card-artist" onClick={() => app.openRoute({ kind: 'catalog', type: 'artist', id: artist.id })} aria-label={artist.name}>
                <div className="tv-card-media"><Cover kind="artist" song={{ title: artist.name, cover: artist.cover }} /></div>
                <span className="tv-card-title">{artist.name}</span>
                <span className="tv-card-sub">Artist</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!recent.length && !favorites.length && !playlists.length && !artists.length && !albums.length && (
        <div className="tv-glass tv-glass-panel tv-empty" style={{ maxWidth: 760 }}>
          <Icon name="library" size={34} />
          <h2 style={{ marginTop: 10 }}>Your library is waiting</h2>
          <p>Play and save music from Search to build your library.</p>
        </div>
      )}
    </section>
  );
}

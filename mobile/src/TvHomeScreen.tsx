import { useEffect, useState } from 'react';
import { useApp } from './AppContext';
import { TvCard, TvShelf } from './TvLayout';
import { Icon } from './Icons';
import { Cover } from './ui';
import { useDiscovery } from './discovery';
import { formatTime } from './library';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { displaySongTitle, relatedSongs } from './catalogQuality';
import { songFrom } from './Browse';
import type { Song } from './types';

export function TvHomeScreen() {
  const app = useApp();
  const { recent, favorites, artists } = app.account.library;
  const [seed] = useState(() => recent[0] || favorites[0]);
  const [recommendations, setRecommendations] = useState<Song[]>([]);
  const feed = useDiscovery(true);
  const featured = feed.items[0];
  const checkpoint = app.smart.checkpoint;
  const showResume = checkpoint && checkpoint.song.id !== app.playback.player.track?.id;
  useEffect(() => {
    if (!seed || !app.online) return;
    const task = new AbortController();
    void innertubeCatalog.getRadio(seed.id, { signal: task.signal, k: 20 }).then(result => {
      if (!task.signal.aborted) setRecommendations(relatedSongs(result.items, [seed]).slice(0, 10).map(songFrom));
    }).catch(() => {});
    return () => task.abort();
  }, [seed?.id, app.online]);

  return <section className="tv-page" aria-label="Home">
    {featured ? <section className="tv-feature" aria-label="Featured new release">
      <div><p className="tv-kicker">New release</p><h1>{featured.title}</h1><p>{featured.artists.map(artist => artist.name).join(', ')}</p>
        <button className="tv-button tv-primary" data-tv-key="featured" data-tv-autofocus
          onClick={() => app.openRoute({ kind: 'catalog', type: 'album', id: featured.id })}><Icon name="album" size={21} />View release</button>
      </div>
      <Cover song={{ title: featured.title, cover: featured.cover?.url }} large />
    </section> : <header className="tv-page-title"><h1>Home</h1>
      {!app.online ? <p>Connect to Wi-Fi to stream music.</p> : feed.loading ? <p role="status">Loading new releases…</p> : feed.error && <button className="tv-button" onClick={feed.retry}>Retry new releases</button>}
    </header>}
    {showResume && <section className="tv-resume"><h2>Continue Listening</h2>
      <button className="tv-track" data-tv-key="resume" onClick={() => void app.playback.play(checkpoint.song, checkpoint.queue, checkpoint.context, checkpoint.positionMs)}>
        <Cover song={checkpoint.song} /><span><strong>{displaySongTitle(checkpoint.song.title, checkpoint.song.artist)}</strong><small>{checkpoint.song.artist} · {formatTime(checkpoint.positionMs)}</small></span><Icon name="play" size={24} />
      </button>
    </section>}
    {!!recommendations.length && <TvShelf title="Made for You">{recommendations.map((song, index) =>
      <TvCard key={song.id} id={`radio-${song.id}`} title={displaySongTitle(song.title, song.artist)} subtitle={song.artist} art={song.cover}
        action={() => { app.playback.setShuffle('off'); app.playback.setRepeat('off'); void app.playback.play(song, recommendations.slice(index), 'Made for You'); }} />)}</TvShelf>}
    {!!feed.items.length && <TvShelf title="New Releases">{feed.items.slice(0, 14).map(item =>
      <TvCard key={item.id} id={item.id} title={item.title} subtitle={item.artists.map(artist => artist.name).join(', ')} art={item.cover?.url}
        action={() => app.openRoute({ kind: 'catalog', type: 'album', id: item.id })} />)}</TvShelf>}
    {!!recent.length && <TvShelf title="Recently Played">{recent.slice(0, 10).map(song =>
      <TvCard key={song.id} id={`recent-${song.id}`} title={displaySongTitle(song.title, song.artist)} subtitle={song.artist} art={song.cover} action={() => void app.playback.play(song, [song], 'Recently Played')} />)}</TvShelf>}
    {!!artists.length && <TvShelf title="Your Artists">{artists.slice(0, 12).map(artist =>
      <TvCard key={artist.id} id={artist.id} kind="artist" title={artist.name} art={artist.cover} action={() => app.openRoute({ kind: 'catalog', type: 'artist', id: artist.id })} />)}</TvShelf>}
  </section>;
}

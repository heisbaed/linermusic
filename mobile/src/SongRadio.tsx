import { useEffect, useState } from 'react';
import { useApp } from './AppContext';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { relatedSongs } from './catalogQuality';
import { Cover, Notice, Sheet, SongRows } from './ui';
import { Icon } from './Icons';
import { loadSaved } from './library';
import type { Song } from './types';
import { personalizeSongs, type RadioMode } from './smartFeatures';

export function SongRadio({ song, onClose }: { song: Song; onClose: () => void }) {
  const app = useApp();
  const [mode, setMode] = useState<RadioMode>('balanced');
  const [songs, setSongs] = useState<Song[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(''); setSongs([]);
    void innertubeCatalog.getRadio(song.id, { signal: abort.signal, k: 40 }).then(result => {
      if (abort.signal.aborted) return;
      setSongs(relatedSongs(result.items, [song]).map(track => ({ id: track.id, title: track.title, artist: track.artists.map(a => a.name).join(', '), artistId: track.artists[0]?.id, albumId: track.album?.id, cover: track.cover?.url, durationMs: track.durationMs })));
    }).catch(() => { if (!abort.signal.aborted) setError('Could not load this radio. Check your connection and try again.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [song.id, retry]);
  const recommended = personalizeSongs(songs, app.account.library.favorites, app.account.library.recent, app.smart.hidden, mode, loadSaved<string[]>('skipped:' + app.account.user?.localId, []));
  const queue = [song, ...recommended];
  return <Sheet full title="Song radio" onClose={onClose} className="song-radio"><div className="radio-content">
    <div className="radio-hero"><Cover large song={song} /><span className="eyebrow">SONG RADIO</span><h1>{song.title}</h1><p>{song.artist} and related tracks</p></div>
    <div className="filter-chips" aria-label="Radio discovery level">{(['balanced', 'familiar', 'discover'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'balanced' ? 'Balanced' : value === 'familiar' ? 'Familiar' : 'Discover'}</button>)}</div>
    {!loading && !error && recommended.length > 0 && <><div className="collection-actions"><button className="primary-button" onClick={() => { void app.playback.play(song, queue, song.title + ' Radio'); onClose(); }}><Icon name="play" />Play radio</button><button className="secondary-button" onClick={() => { app.playback.playAll(queue, true, song.title + ' Radio'); onClose(); }}><Icon name="shuffle" />Shuffle</button></div><h2>Recommended tracks</h2><SongRows songs={recommended} context={song.title + ' Radio'} /></>}
    {loading && <p className="load-state" role="status"><span className="spinner" />Finding related music...</p>}
    {error && <Notice title="Radio couldn't connect" action={<button className="secondary-button" onClick={() => setRetry(v => v + 1)}>Try again</button>}>{error}</Notice>}
    {!loading && !error && !recommended.length && <Notice title="No recommendations yet">The catalog has no related tracks for this song. Try another song.</Notice>}
  </div></Sheet>;
}

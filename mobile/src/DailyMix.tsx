import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { Cover } from './ui';
import { Icon } from './Icons';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { relatedSongs } from './catalogQuality';
import { isHidden, personalizeSongs } from './smartFeatures';
import { songFrom } from './Browse';
import { loadSaved, save } from './library';
import { localMixDay, rotateMixSeeds, rotateMixSongs } from './dailyMixRotation';
import { cachedSongGenres, genreCompatible } from './musicMetadata';
import { artistIdentity } from './smartFeatures';

export function DailyMix() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const task = useRef<AbortController | null>(null);
  const [day, setDay] = useState(localMixDay);
  const owner = app.account.user?.localId || 'guest';
  const scope = owner + ':' + day;
  const liveScope = useRef(scope); liveScope.current = scope;
  const attempted = useRef('');
  const date = new Date(day + 'T12:00:00');
  const id = 'daily-mix-' + day;
  const playlist = app.account.library.playlists.find(item => item.id === id);
  const seeds = [...app.account.library.recent.slice(0, 30), ...app.account.library.favorites].filter(song => !isHidden(song, app.smart.hidden));
  useEffect(() => {
    const tick = () => setDay(localMixDay());
    const timer = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  useEffect(() => { setBusy(false); return () => { task.current?.abort(); task.current = null; }; }, [scope]);
  useEffect(() => {
    if (playlist || !app.online || !seeds.length || attempted.current === scope) return;
    attempted.current = scope;
    void generate(false);
  }, [scope, app.online, !!seeds.length, playlist?.id]);
  async function generate(open = true) {
    if (task.current || !app.online) return;
    if (!seeds.length) { app.goTab('search'); app.toast('Play or favorite a song to build your Daily Mix.'); return; }
    const controller = new AbortController(); task.current = controller; setBusy(true);
    const rotationKey = 'daily-mix-rotation:' + owner;
    const history = loadSaved<{ counter: number; seeds: string[]; songs?: typeof seeds }>(rotationKey, { counter: 0, seeds: [] });
    const counter = Number.isFinite(history?.counter) ? history.counter + 1 : 1;
    const priorSeeds = Array.isArray(history?.seeds) ? history.seeds : [];
    const priorSongs = Array.isArray(history?.songs) ? history.songs : [];
    const rotation = scope + ':' + counter;
    const anchor = seeds[0];
    const cohort = seeds.filter(song => cachedSongGenres(anchor).length ? genreCompatible(anchor, song) && cachedSongGenres(song).length > 0 : artistIdentity(anchor.artist) === artistIdentity(song.artist));
    const chosen = rotateMixSeeds(cohort, rotation, priorSeeds);
    const previous = [...priorSongs, ...app.account.library.playlists.filter(item => /^daily-mix-\d{4}-\d{2}-\d{2}$/.test(item.id)).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 3).flatMap(item => item.songs)];
    try {
      const replies = await Promise.allSettled(chosen.map(song => innertubeCatalog.getRadio(song.id, { signal: controller.signal, k: 60 })));
      if (controller.signal.aborted || liveScope.current !== scope) return;
      const lists = replies.flatMap(reply => reply.status === 'fulfilled' ? [relatedSongs(reply.value.items, chosen).map(songFrom)] : []);
      const interleaved = Array.from({ length: 60 }, (_, index) => lists.flatMap(list => list[index] ? [list[index]] : [])).flat();
      const skipped = loadSaved<string[]>('skipped:' + owner, []);
      const candidates = personalizeSongs(interleaved.filter(song => genreCompatible(anchor, song)), chosen, [], app.smart.hidden, 'balanced', skipped,anchor).filter(song => !skipped.includes(song.id));
      const songs = rotateMixSongs(candidates, previous, rotation);
      save(rotationKey, { counter, seeds: [...chosen.map(song => song.id), ...priorSeeds].slice(0, 9), songs: [...songs, ...priorSongs].slice(0, 90) });
      if (!songs.length) { app.toast('No fresh recommendations were available. Your saved mixes are unchanged; try another song or refresh again.'); return; }
      app.account.setLibrary(library => ({ ...library, playlists: [{ id, name: 'Daily Mix · ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), songs, isPublic: false, cover: songs[0].cover }, ...library.playlists.filter(item => item.id !== id)] }));
      if (open) app.openRoute({ kind: 'playlist', id });
    } catch { if (!controller.signal.aborted) app.toast('Your mix could not load. Check your connection and try again.'); }
    finally { if (task.current === controller) { task.current = null; setBusy(false); } }
  }
  if (!seeds.length && !playlist) return null;
  return <section className="home-daily-mix"><button className="daily-mix-open" disabled={busy || (!playlist && !app.online)} onClick={() => playlist ? app.openRoute({ kind: 'playlist', id }) : void generate()}>
    {playlist?.songs[0] ? <Cover song={playlist.songs[0]} /> : <Icon name="sparkles" size={30} />}<span className="row-copy"><strong>Daily Mix</strong><small>{busy ? 'Finding your next favorites...' : playlist ? `${playlist.songs.length} songs · Made for you` : 'Build a mix from your favorites'}</small></span><Icon name="chevron_right" size={20} />
  </button>{playlist && <button className="text-button" disabled={busy || !app.online} onClick={() => void generate()}>{busy ? 'Refreshing...' : 'Refresh mix'}</button>}</section>;
}

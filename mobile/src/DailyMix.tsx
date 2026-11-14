import { useEffect, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { Cover } from './ui';
import { Icon } from './Icons';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { relatedSongs } from './catalogQuality';
import { artistIdentity, isHidden, personalizeSongs } from './smartFeatures';
import { songFrom } from './Browse';
import { loadSaved } from './library';

export function DailyMix() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const task = useRef<AbortController | null>(null);
  const date = new Date();
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const id = 'daily-mix-' + day;
  const playlist = app.account.library.playlists.find(item => item.id === id);
  const seeds = [...app.account.library.favorites, ...app.account.library.recent].filter(song => !isHidden(song, app.smart.hidden));
  useEffect(() => () => task.current?.abort(), [app.account.user?.localId]);
  async function generate() {
    if (busy || !app.online) return;
    if (!seeds.length) { app.goTab('search'); app.toast('Play or favorite a song to build your Daily Mix.'); return; }
    const controller = new AbortController(); task.current?.abort(); task.current = controller; setBusy(true);
    const chosen = [seeds[0], seeds.find(song => artistIdentity(song.artist) !== artistIdentity(seeds[0].artist))].filter(Boolean) as typeof seeds;
    try {
      const replies = await Promise.allSettled(chosen.map(song => innertubeCatalog.getRadio(song.id, { signal: controller.signal, k: 40 })));
      if (controller.signal.aborted) return;
      const lists = replies.flatMap(reply => reply.status === 'fulfilled' ? [relatedSongs(reply.value.items, chosen).map(songFrom)] : []);
      const interleaved = Array.from({ length: 40 }, (_, index) => lists.flatMap(list => list[index] ? [list[index]] : [])).flat();
      const songs = personalizeSongs(interleaved, app.account.library.favorites, app.account.library.recent, app.smart.hidden, 'balanced', loadSaved<string[]>('skipped:' + app.account.user?.localId, [])).slice(0, 30);
      if (!songs.length) { app.toast('No recommendations were available. Try again after playing another song.'); return; }
      app.account.setLibrary(library => ({ ...library, playlists: [{ id, name: 'Daily Mix · ' + date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), songs, isPublic: false, cover: songs[0].cover }, ...library.playlists.filter(item => item.id !== id)] }));
      app.openRoute({ kind: 'playlist', id });
    } catch { if (!controller.signal.aborted) app.toast('Your mix could not load. Check your connection and try again.'); }
    finally { if (task.current === controller) setBusy(false); }
  }
  if (!seeds.length && !playlist) return null;
  return <section className="home-daily-mix"><button className="daily-mix-open" disabled={busy || (!playlist && !app.online)} onClick={() => playlist ? app.openRoute({ kind: 'playlist', id }) : void generate()}>
    {playlist?.songs[0] ? <Cover song={playlist.songs[0]} /> : <Icon name="sparkles" size={30} />}<span className="row-copy"><strong>Daily Mix</strong><small>{busy ? 'Finding your next favorites...' : playlist ? `${playlist.songs.length} songs · Made for you` : 'Build a mix from your favorites'}</small></span><Icon name="chevron_right" size={20} />
  </button>{playlist && <button className="text-button" disabled={busy || !app.online} onClick={() => void generate()}>{busy ? 'Refreshing...' : 'Refresh mix'}</button>}</section>;
}

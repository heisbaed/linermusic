import { useEffect, useRef, useState } from 'react';
import { control, isAndroid, playNative, snapshot, subscribe, setQueue as sendQueue } from './native';
import { loadSaved, save } from './library';
import { resolveStream } from './catalog';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { PlaybackController, Preferences } from './AppContext';
import type { PlayerState, Song } from './types';
import { relatedSongs } from './catalogQuality';

function uniqueSongs(songs: Song[]): Song[] {
  const ids = new Set<string>();
  return songs.filter(song => song && typeof song.id === 'string' && !ids.has(song.id) && Boolean(ids.add(song.id)));
}

export function usePlayback({ downloads, prefs, onRecent, toast }: {
  downloads: Song[]; prefs: Preferences; onRecent: (song: Song) => void; toast: (message: string) => void;
}): PlaybackController {
  const [initial] = useState(snapshot);
  const [player, setPlayer] = useState<PlayerState>(initial);
  const [queue, setLocalQueue] = useState<Song[]>(() => uniqueSongs(initial.track ? initial.queue || [initial.track] : loadSaved<Song[]>('queue', [])));
  const [shuffle, setLocalShuffle] = useState(initial.track ? Boolean(initial.shuffle) : loadSaved('shuffle', false));
  const [repeat, setLocalRepeat] = useState<'off' | 'all' | 'one'>(initial.track ? initial.repeat || 'off' : loadSaved('repeat', 'off'));
  const [context, setContext] = useState(() => loadSaved('playback-context', 'Music'));
  const live = useRef({ player, queue, shuffle, repeat, context, downloads, prefs, onRecent, toast });
  live.current = { player, queue, shuffle, repeat, context, downloads, prefs, onRecent, toast };
  const resolving = useRef<AbortController | null>(null);
  const playedId = useRef('');
  const heard = useRef<Song[]>([]);
  const autoplayTask = useRef<ReturnType<typeof setTimeout> | undefined>();
  const autoplayController = useRef<AbortController | null>(null);

  useEffect(() => { save('queue', queue); }, [queue]);
  useEffect(() => { save('shuffle', shuffle); }, [shuffle]);
  useEffect(() => { save('repeat', repeat); }, [repeat]);
  useEffect(() => { save('playback-context', context); }, [context]);
  useEffect(() => {
    const unsubscribe = subscribe(event => {
      if (event.type === 'player') {
        const state = event.data as unknown as PlayerState;
        setPlayer(state);
        live.current.player = state;
        if (state.track && Array.isArray(state.queue)) { setLocalQueue(state.queue); live.current.queue = state.queue; }
        if (state.track && typeof state.shuffle === 'boolean') { setLocalShuffle(state.shuffle); live.current.shuffle = state.shuffle; }
        if (state.track && state.repeat) { setLocalRepeat(state.repeat); live.current.repeat = state.repeat; }
        if (state.status === 'playing' && state.track && playedId.current !== state.track.id) {
          playedId.current = state.track.id;
          heard.current = [state.track,...heard.current.filter(s=>s.id!==state.track!.id)].slice(0,50);
          live.current.onRecent(state.track);
        }
        if (state.status === 'error') live.current.toast(state.error || 'Playback could not start. Check your connection and try again.');
        clearTimeout(autoplayTask.current);
        if (state.status === 'ended') {
          // The native service advances first. Only an exhausted queue stays ended.
          autoplayTask.current = setTimeout(() => void appendRadio(), 350);
        }
      }
      if (event.type === 'transport' && !isAndroid) {
        const action = String(event.data.action);
        void browserAdvance(action === 'previous' ? -1 : 1, action === 'ended');
      }
      if (event.type === 'playerError') live.current.toast(String(event.data.message || 'Playback is unavailable.'));
    });
    window.CineAndroid?.ready?.();
    return () => { unsubscribe(); clearTimeout(autoplayTask.current); resolving.current?.abort(); autoplayController.current?.abort(); };
  }, []);

  async function play(song: Song, songs = live.current.queue, from = live.current.context) {
    resolving.current?.abort();
    autoplayController.current?.abort();
    const controller = new AbortController();
    resolving.current = controller;
    const local = live.current.downloads.find(item => item.id === song.id);
    if (!navigator.onLine && !local) { live.current.toast('This song needs a connection. Your completed downloads are available offline.'); return; }
    const track = local ? { ...song, ...local } : song;
    const items = uniqueSongs(songs.some(item => item.id === song.id) ? songs : [...songs, song]);
    setLocalQueue(items); setContext(from);
    live.current.queue = items; live.current.context = from;
    setPlayer({ track, status: 'loading', positionMs: 0, durationMs: track.durationMs });
    try {
      const url = isAndroid || local ? undefined : await resolveStream(track.id, controller.signal);
      if (controller.signal.aborted) return;
      playNative(track, url, items, live.current.shuffle, live.current.repeat);
      if(items.length===1 && live.current.prefs.autoplay) void prepareRelated(track);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'This song could not be played.';
      setPlayer({ track, status: 'error', positionMs: 0, durationMs: track.durationMs, error: message });
      live.current.toast(message);
    }
  }

  async function prepareRelated(seed:Song){
    const controller=new AbortController();autoplayController.current=controller;
    try{
      const result=await innertubeCatalog.getRadio(seed.id,{signal:controller.signal,k:25});
      if(controller.signal.aborted||!live.current.prefs.autoplay||live.current.queue.length!==1||live.current.queue[0]?.id!==seed.id)return;
      const added=relatedSongs(result.items,[seed,...heard.current]).slice(0,15).map(track=>({id:track.id,title:track.title,artist:track.artists.map(a=>a.name).join(', '),artistId:track.artists[0]?.id,albumId:track.album?.id,cover:track.cover?.url,durationMs:track.durationMs}));
      if(added.length)setQueue([seed,...added]);
    }catch{ /* Keep the selected song available if related music cannot load. */ }
  }

  async function appendRadio() {
    const current = live.current;
    if (!current.prefs.autoplay || !navigator.onLine || !current.player.track || current.player.status !== 'ended' || current.repeat !== 'off' || current.player.sleepEndOfSong || current.player.sleepDeadline) return;
    const controller = new AbortController(); autoplayController.current = controller;
    try {
      const { items: tracks } = await innertubeCatalog.getRadio(current.player.track.id, { signal: controller.signal, k: 20 });
      if (controller.signal.aborted || live.current.player.status !== 'ended') return;
      const songs: Song[] = relatedSongs(tracks,[current.player.track,...heard.current,...current.queue]).slice(0, 20).map(track => ({ id: track.id, title: track.title, artist: track.artists.map(artist => artist.name).join(', '), artistId: track.artists[0]?.id, albumId: track.album?.id, cover: track.cover?.url, durationMs: track.durationMs }));
      if (songs.length) await play(songs[0], songs, 'Autoplay');
    } catch { /* Autoplay failure leaves the completed queue available to replay. */ }
  }

  async function browserAdvance(direction: number, ended = false) {
    const { player: state, queue: items, repeat: mode, shuffle: random } = live.current;
    if (!state.track || !items.length) return;
    // Previous restarts after 3 seconds, matching PlaybackService.
    if (direction < 0 && state.positionMs > 3000) { control('seek', 0); return; }
    if (ended && mode === 'one') { control('seek', 0); control('resume'); return; }
    const at = items.findIndex(item => item.id === state.track?.id);
    let to = at + direction;
    if (direction > 0 && random && items.length > 1) { const choices = items.filter(item => item.id !== state.track?.id); to = items.indexOf(choices[Math.floor(Math.random() * choices.length)]); }
    if (to >= items.length && mode === 'all') to = 0;
    if (to >= 0 && to < items.length) await play(items[to], items);
    else if (!ended) live.current.toast('End of queue. Choose another song or turn on Repeat All.');
  }

  function setQueue(value: Song[] | ((songs: Song[]) => Song[])) {
    const items = uniqueSongs(typeof value === 'function' ? value(live.current.queue) : value);
    setLocalQueue(items); live.current.queue = items;
    sendQueue(items, live.current.shuffle, live.current.repeat);
  }
  function setShuffle(value: boolean) { setLocalShuffle(value); live.current.shuffle = value; sendQueue(live.current.queue, value, live.current.repeat); }
  function setRepeat(value: 'off' | 'all' | 'one') { setLocalRepeat(value); live.current.repeat = value; sendQueue(live.current.queue, live.current.shuffle, value); }
  function toggle() {
    const { player: state } = live.current;
    if (!state.track) return;
    if (state.status === 'error' || state.status === 'ended' || state.status === 'idle') void play(state.track);
    else control(state.status === 'playing' || state.status === 'loading' ? 'pause' : 'resume');
  }
  function playAll(songs: Song[], random = false, from = 'Music') {
    if (!songs.length) return;
    setShuffle(random);
    const first = random ? songs[Math.floor(Math.random() * songs.length)] : songs[0];
    void play(first, songs, from);
  }
  return { player, queue, context, shuffle, repeat, play, playAll, toggle, next: () => { if (isAndroid) control('next'); else void browserAdvance(1); }, previous: () => { if (isAndroid) control('previous'); else void browserAdvance(-1); }, seek: ms => control('seek', Math.max(0, Math.min(live.current.player.durationMs, ms))), setShuffle, setRepeat, setQueue };
}

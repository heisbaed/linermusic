import { useEffect, useRef, useState } from 'react';
import { control, isAndroid, playNative, snapshot, subscribe, setQueue as sendQueue } from './native';
import { isOnline } from './network';
import { loadSaved, save } from './library';
import { resolveStream } from './catalog';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { PlaybackController, Preferences, ShuffleMode } from './AppContext';
import type { PlayerState, Song } from './types';
import { displaySongTitle, relatedSongs } from './catalogQuality';
import { normalizeHidden, personalizeSongs, type HiddenMusic } from './smartFeatures';

function uniqueSongs(songs: Song[]): Song[] {
  const ids = new Set<string>();
  return songs.filter(song => song && typeof song.id === 'string' && !ids.has(song.id) && Boolean(ids.add(song.id)));
}
function savedShuffle(value: unknown): ShuffleMode {
  if (value === 'smart' || value === 'on' || value === 'off') return value;
  return value === true ? 'on' : 'off';
}
function songFromTrack(track: { id: string; title: string; artists: { id?: string; name: string }[]; album?: { id: string }; cover?: { url: string }; durationMs: number }): Song {
  return { id: track.id, title: displaySongTitle(track.title, track.artists.map(artist => artist.name).join(', ')), artist: track.artists.map(artist => artist.name).join(', '), artistId: track.artists[0]?.id, albumId: track.album?.id, cover: track.cover?.url, durationMs: track.durationMs };
}

export function usePlayback({ downloads, prefs, onRecent, toast, owner = '', favorites = [], recent = [], streamOnly = false }: {
  downloads: Song[]; prefs: Preferences; onRecent: (song: Song) => void; toast: (message: string) => void; owner?: string; favorites?: Song[]; recent?: Song[]; streamOnly?: boolean;
}): PlaybackController {
  const [initial] = useState(snapshot);
  const [player, setPlayer] = useState<PlayerState>(initial);
  const [queue, setLocalQueue] = useState<Song[]>(() => uniqueSongs(initial.track ? initial.queue || [initial.track] : loadSaved<Song[]>('queue', [])));
  const [shuffle, setLocalShuffle] = useState<ShuffleMode>(() => {
    const saved = savedShuffle(loadSaved('shuffle', 'off'));
    if (!initial.track) return saved;
    return initial.shuffle ? (saved === 'smart' ? 'smart' : 'on') : 'off';
  });
  const [repeat, setLocalRepeat] = useState<'off' | 'all' | 'one'>(initial.track ? initial.repeat || 'off' : loadSaved('repeat', 'off'));
  const [context, setContext] = useState(() => loadSaved('playback-context', 'Music'));
  const [playerLyrics, setPlayerLyricsState] = useState<{ text: string } | null>(null);
  const live = useRef({ player, queue, shuffle, repeat, context, downloads, prefs, onRecent, toast, playerLyrics, owner, favorites, recent });
  live.current = { player, queue, shuffle, repeat, context, downloads, prefs, onRecent, toast, playerLyrics, owner, favorites, recent };
  const resolving = useRef<AbortController | null>(null);
  const playedId = useRef('');
  const heard = useRef<Song[]>([]);
  const radioBusy = useRef(false);
  const radioAttempt = useRef({id:'',at:0});
  const autoplayTask = useRef<ReturnType<typeof setTimeout> | undefined>();
  const autoplayController = useRef<AbortController | null>(null);
  const smartController = useRef<AbortController | null>(null);
  const smartBusy = useRef(false);
  const smartSeed = useRef('');
  const smartAdded = useRef<Set<string>>(new Set());

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
        if (state.track && typeof state.shuffle === 'boolean') {
          const next: ShuffleMode = state.shuffle ? (live.current.shuffle === 'smart' ? 'smart' : 'on') : 'off';
          setLocalShuffle(next); live.current.shuffle = next;
        }
        if (state.track && state.repeat) { setLocalRepeat(state.repeat); live.current.repeat = state.repeat; }
        if (state.status === 'playing' && state.track && playedId.current !== state.track.id) {
          playedId.current = state.track.id;
          heard.current = [state.track,...heard.current.filter(s=>s.id!==state.track!.id)];
          live.current.onRecent(state.track);
        }
        if (state.status === 'playing' && state.track) {
          const remaining = live.current.queue.length - live.current.queue.findIndex(song=>song.id===state.track?.id);
          if (live.current.shuffle === 'smart' && !smartAdded.current.size && !smartBusy.current) void addSmartSongs(state.track);
          if (live.current.shuffle === 'smart' || remaining <= 4) void prepareRelated(state.track);
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
    return () => { unsubscribe(); clearTimeout(autoplayTask.current); resolving.current?.abort(); autoplayController.current?.abort(); smartController.current?.abort(); };
  }, []);

  async function play(song: Song, songs = live.current.queue, from = live.current.context, positionMs = 0) {
    resolving.current?.abort();
    autoplayController.current?.abort();
    const controller = new AbortController();
    resolving.current = controller;
    const local = live.current.downloads.find(item => item.id === song.id);
    if (!isOnline() && !local) { live.current.toast(streamOnly ? 'Reconnect to Wi-Fi to play this song.' : 'This song needs a connection. Your completed downloads are available offline.'); return; }
    const selected = local ? { ...song, ...local } : song;
    const track = { ...selected, title: displaySongTitle(selected.title, selected.artist) };
    const items = uniqueSongs(songs.some(item => item.id === song.id) ? songs : [...songs, song]);
    setLocalQueue(items); setContext(from);
    live.current.queue = items; live.current.context = from;
    setPlayer({ track, status: 'loading', positionMs: 0, durationMs: track.durationMs });
    try {
      const url = isAndroid || local ? undefined : await resolveStream(track.id, controller.signal);
      if (controller.signal.aborted) return;
      playNative(track, url, items, live.current.shuffle !== 'off', live.current.repeat, live.current.prefs.audioQuality, live.current.prefs.gapless, live.current.prefs.crossfadeSeconds, positionMs);
      if(items.length===1 && live.current.prefs.autoplay) void prepareRelated(track);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'This song could not be played.';
      setPlayer({ track, status: 'error', positionMs: 0, durationMs: track.durationMs, error: message });
      live.current.toast(message);
    }
  }

  async function prepareRelated(seed:Song){
    const current=live.current, smartActive=current.shuffle==='smart';
    if(radioBusy.current||(!current.prefs.autoplay&&!smartActive)||!isOnline()||(current.repeat!=='off'&&!smartActive)||(radioAttempt.current.id===seed.id&&Date.now()-radioAttempt.current.at<30000))return;
    radioBusy.current=true;radioAttempt.current={id:seed.id,at:Date.now()};
    const controller=new AbortController();autoplayController.current=controller;
    try{
      const seeds=[seed,...heard.current.filter(song=>song.id!==seed.id).slice(0,2)];
      for(const candidate of seeds){
        const result=await innertubeCatalog.getRadio(candidate.id,{signal:controller.signal,k:50});
        if(controller.signal.aborted||(!live.current.prefs.autoplay&&live.current.shuffle!=='smart'))return;
        if (live.current.player.track?.id !== seed.id && !live.current.queue.some(song => song.id === seed.id)) return;
        const added=personalize(relatedSongs(result.items,[seed,...heard.current,...live.current.queue]).map(songFromTrack)).slice(0,25);
        if(!added.length)continue;
        if(live.current.shuffle==='smart')added.forEach(song=>smartAdded.current.add(song.id));
        if(live.current.player.status==='ended')await play(added[0],added,'Autoplay');
        else setQueue([...live.current.queue,...added]);
        break;
      }
    }catch{ /* Leave existing music playable if the provider is unavailable. */ }
    finally{radioBusy.current=false;}
  }
  async function addSmartSongs(seed:Song){
    const current=live.current;
    if(current.shuffle!=='smart'||smartBusy.current||!isOnline()||(smartSeed.current===seed.id&&smartAdded.current.size))return;
    smartBusy.current=true;smartSeed.current=seed.id;
    const controller=new AbortController();smartController.current=controller;
    try{
      const result=await innertubeCatalog.getRadio(seed.id,{signal:controller.signal,k:50});
      if(controller.signal.aborted||live.current.shuffle!=='smart')return;
      if (live.current.player.track?.id !== seed.id && !live.current.queue.some(song => song.id === seed.id)) return;
      const added=personalize(relatedSongs(result.items,[seed,...heard.current,...live.current.queue]).map(songFromTrack)).slice(0,20);
      if(!added.length){live.current.toast('No smart recommendations were available for this song.');return;}
      added.forEach(song=>smartAdded.current.add(song.id));
      setQueue([...live.current.queue,...added]);
      live.current.toast(`Smart shuffle added ${added.length} similar songs.`);
    }catch{
      if(!controller.signal.aborted&&live.current.shuffle==='smart'){applyShuffle('on');live.current.toast('Smart shuffle is unavailable. Normal shuffle is on.');}
    }finally{
      smartBusy.current=false;
      if(smartController.current===controller)smartController.current=null;
    }
  }
  async function appendRadio(){
    const current=live.current;
    if(current.player.status==='ended'&&current.player.track&&!current.player.sleepEndOfSong&&!current.player.sleepDeadline)await prepareRelated(current.player.track);
  }

  function personalize(songs: Song[]) {
    const current = live.current;
    const hidden = normalizeHidden(loadSaved<{ hidden?: HiddenMusic }>('smart-music:' + current.owner, {}).hidden);
    return personalizeSongs(songs, current.favorites, current.recent, hidden, 'balanced', loadSaved<string[]>('skipped:' + current.owner, []));
  }

  async function browserAdvance(direction: number, ended = false) {
    const { player: state, queue: items, repeat: mode, shuffle: random } = live.current;
    if (!state.track || !items.length) return;
    // Previous restarts after 3 seconds, matching PlaybackService.
    if (direction < 0 && state.positionMs > 3000) { control('seek', 0); return; }
    if (ended && mode === 'one') { control('seek', 0); control('resume'); return; }
    const at = items.findIndex(item => item.id === state.track?.id);
    let to = at + direction;
    if (direction > 0 && random !== 'off' && items.length > 1) { const choices = items.filter(item => item.id !== state.track?.id && !heard.current.some(song=>song.id===item.id)); to = choices.length ? items.indexOf(choices[Math.floor(Math.random() * choices.length)]) : items.length; }
    if (to >= items.length && mode === 'all') to = 0;
    if (to >= 0 && to < items.length) await play(items[to], items);
    else if (!ended) live.current.toast('End of queue. Choose another song or turn on Repeat All.');
  }

  function setQueue(value: Song[] | ((songs: Song[]) => Song[])) {
    const items = uniqueSongs(typeof value === 'function' ? value(live.current.queue) : value);
    setLocalQueue(items); live.current.queue = items;
    sendQueue(items, live.current.shuffle !== 'off', live.current.repeat);
  }
  function setShuffle(value: ShuffleMode) { applyShuffle(value); }
  function applyShuffle(value: ShuffleMode) {
    const current = live.current;
    let items = current.queue;
    if (current.shuffle === 'smart' && value !== 'smart') {
      smartController.current?.abort();
      smartController.current = null;
      const added = smartAdded.current;
      smartAdded.current = new Set();
      if (added.size) {
        items = uniqueSongs(items.filter(song => !added.has(song.id) || song.id === current.player.track?.id));
        setLocalQueue(items); current.queue = items;
      }
    }
    setLocalShuffle(value); current.shuffle = value;
    sendQueue(items, value !== 'off', current.repeat);
    if (value === 'smart') {
      const seed = current.player.track || items[0];
      if (seed) void addSmartSongs(seed);
      else current.toast('Start a song to add smart recommendations.');
    }
  }
  function cycleShuffle() { applyShuffle(live.current.shuffle === 'off' ? 'on' : live.current.shuffle === 'on' ? 'smart' : 'off'); }
  function setRepeat(value: 'off' | 'all' | 'one') { setLocalRepeat(value); live.current.repeat = value; sendQueue(live.current.queue, live.current.shuffle !== 'off', value); }
  function toggle() {
    const { player: state } = live.current;
    if (!state.track) return;
    if (state.status === 'error' || state.status === 'ended' || state.status === 'idle') void play(state.track, live.current.queue, live.current.context, streamOnly && state.status === 'error' ? state.positionMs : 0);
    else control(state.status === 'playing' || state.status === 'loading' ? 'pause' : 'resume');
  }
  function playAll(songs: Song[], random = false, from = 'Music') {
    if (!songs.length) return;
    setShuffle(random ? 'on' : 'off');
    const first = random ? songs[Math.floor(Math.random() * songs.length)] : songs[0];
    void play(first, songs, from);
  }
  function setPlayerLyrics(lyrics: { text: string } | null) { setPlayerLyricsState(lyrics); live.current.playerLyrics = lyrics; }
  function next() {
    const current = live.current;
    if (current.owner && !current.prefs.privateListening && current.player.status === 'playing' && current.player.positionMs < 30000 && current.player.track) {
      const id = current.player.track.id;
      save('skipped:' + current.owner, [id, ...loadSaved<string[]>('skipped:' + current.owner, []).filter(item => item !== id)].slice(0, 100));
    }
    if (isAndroid) control('next'); else void browserAdvance(1);
  }
  return { player, queue, context, shuffle, repeat, play, playAll, toggle, next, previous: () => { if (isAndroid) control('previous'); else void browserAdvance(-1); }, seek: ms => control('seek', Math.max(0, Math.min(live.current.player.durationMs, ms))), setShuffle, cycleShuffle, setRepeat, setQueue, playerLyrics, setPlayerLyrics };
}

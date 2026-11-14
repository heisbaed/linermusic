import { useEffect, useRef, useState } from 'react';
import { loadSaved, save } from './library';
import { EMPTY_HIDDEN, normalizeHidden, validCheckpoint, type HiddenMusic, type ListeningCheckpoint } from './smartFeatures';
import type { PlaybackController } from './AppContext';
import type { Song } from './types';
import { firebaseFetch, freshCineUser, getFirebaseDatabaseUrl, type CineUser } from './FirebaseAuth';
import { isOnline, onConnectivityChange } from './network';
import { isTvEnvironment } from './spatialNav';

export function useSmartFeatures(user: CineUser | null, privateListening: boolean, playback: PlaybackController) {
  const owner = user?.localId || '';
  const device = isTvEnvironment() ? 'tv' : 'phone';
  const other = device === 'tv' ? 'phone' : 'tv';
  const [remote, setRemote] = useState<{ owner: string; checkpoint: ListeningCheckpoint } | null>(null);
  const key = 'smart-music:' + owner;
  const read = () => {
    const value = loadSaved<{ hidden?: HiddenMusic; checkpoint?: ListeningCheckpoint }>(key, {});
    return { owner, hidden: normalizeHidden(value.hidden), checkpoint: validCheckpoint(value.checkpoint) ? value.checkpoint : null };
  };
  const [state, setState] = useState(read);
  const current = state.owner === owner ? state : read();
  const live = useRef({ current, playback, privateListening, owner, key, user });
  live.current = { current, playback, privateListening, owner, key, user };
  useEffect(() => { setState(read()); }, [owner]);
  function persist(next: typeof state) { save(key, next); setState(next); }
  function hideSong(song: Song) { persist({ ...current, hidden: { ...current.hidden, songs: [...current.hidden.songs.filter(item => item.id !== song.id), { id: song.id, title: song.title, artist: song.artist }] } }); }
  function hideArtist(song: Song) { persist({ ...current, hidden: { ...current.hidden, artists: [...current.hidden.artists.filter(item => item.id !== song.artistId && item.name !== song.artist), { id: song.artistId || '', name: song.artist }] } }); }
  function restore(kind: 'song' | 'artist', id: string) {
    persist({ ...current, hidden: { songs: kind === 'song' ? current.hidden.songs.filter(item => item.id !== id) : current.hidden.songs,
      artists: kind === 'artist' ? current.hidden.artists.filter(item => (item.id || item.name) !== id) : current.hidden.artists } });
  }
  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    let sent = '', reading = false, writing = false, saveAt = 0;
    const { signal } = controller;
    async function address(target: string) {
      const current = live.current.user;
      if (!current || current.localId !== owner || !current.emailVerified) throw new Error('No active account');
      const [base, fresh] = await Promise.all([getFirebaseDatabaseUrl(), freshCineUser(current)]);
      return base + '/users/' + encodeURIComponent(owner) + '/resume/' + target + '.json?auth=' + encodeURIComponent(fresh.idToken);
    }
    async function readRemote() {
      if (reading || !isOnline() || signal.aborted) return;
      reading = true;
      try {
        const response = await firebaseFetch(await address(other), { signal });
        if (!response.ok) return;
        const value: unknown = await response.json();
        if (!signal.aborted) setRemote(validCheckpoint(value) ? { owner, checkpoint: value } : null);
      } catch { /* The local checkpoint stays available during a network failure. */ }
      finally { reading = false; }
    }
    async function sync(value: ListeningCheckpoint) {
      const marker = value.song.id + ':' + value.positionMs;
      if (writing || sent === marker || !isOnline() || signal.aborted || live.current.privateListening) return;
      writing = true;
      try {
        const response = await firebaseFetch(await address(device), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal,
        });
        if (response.ok) sent = marker;
      } catch { /* Retry at the next checkpoint. */ }
      finally { writing = false; }
    }
    function checkpoint() {
      if (document.hidden && signal.aborted) return;
      const { current: saved, playback: playing, privateListening: privateMode, owner: activeOwner, key: activeKey } = live.current;
      const { player, queue, context } = playing;
      if (activeOwner !== owner || privateMode || !player.track || !['playing', 'paused'].includes(player.status)) return;
      const clean = (song: Song): Song => ({
        id: song.id, title: song.title, artist: song.artist, artistId: song.artistId, albumId: song.albumId,
        durationMs: song.durationMs, cover: song.cover?.startsWith('https://') ? song.cover : undefined,
      });
      const value: ListeningCheckpoint = { song: clean(player.track), queue: queue.slice(0, 100).map(clean), context,
        positionMs: Math.floor(player.positionMs), savedAt: Date.now() };
      if (!validCheckpoint(value)) return;
      const prior = saved.checkpoint;
      if (!prior || prior.song.id !== value.song.id || Math.abs(prior.positionMs - value.positionMs) >= 2500) {
        const next = { ...saved, checkpoint: value };
        save(activeKey, next); live.current.current = next; setState(next);
        if (value.savedAt - saveAt >= 10_000 || player.status === 'paused') { saveAt = value.savedAt; void sync(value); }
      } else if (prior && value.savedAt - saveAt >= 10_000) {
        saveAt = value.savedAt; void sync(prior);
      }
    }
    function visibility() { if (document.hidden) checkpoint(); else void readRemote(); }
    void readRemote();
    const stopConnectivity = onConnectivityChange(() => { if (isOnline()) { checkpoint(); void readRemote(); } });
    const record = setInterval(checkpoint, 5000);
    const refresh = setInterval(() => { if (!document.hidden) void readRemote(); }, 15_000);
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      controller.abort(); clearInterval(record); clearInterval(refresh); stopConnectivity();
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [owner, user?.emailVerified, device]);
  const latest = remote?.owner === owner && remote.checkpoint.savedAt > (current.checkpoint?.savedAt || 0) ? remote.checkpoint : current.checkpoint;
  return { hidden: current.hidden || EMPTY_HIDDEN, checkpoint: latest, hideSong, hideArtist, restore };
}

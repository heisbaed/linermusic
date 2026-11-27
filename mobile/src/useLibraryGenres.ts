import { useEffect, useState } from 'react';
import { cachedSongGenres, resolveSongGenres } from './musicMetadata';
import type { Song } from './types';

export function useGenreWarmup(songs: Song[], enabled: boolean, online: boolean) {
  const signature = songs.map(song => song.id).join(':');
  useEffect(() => {
    if (!enabled || !online) return;
    const controller = new AbortController();
    void (async () => {
      try { for (const song of songs) { if (controller.signal.aborted) return; if (!cachedSongGenres(song).length) await resolveSongGenres(song,controller.signal); } }
      catch { /* Liked Songs offers retry; metadata never blocks playback or navigation. */ }
    })();
    return () => controller.abort();
  }, [signature, enabled, online]);
}

export function useLibraryGenres(songs: Song[], enabled: boolean, online: boolean) {
  const [state, setState] = useState({ revision: 0, loading: false, error: false });
  const [retry, setRetry] = useState(0);
  const signature = songs.map(song => song.id).join(':');
  useEffect(() => {
    if (!enabled || !online || !songs.length) return;
    const controller = new AbortController();
    setState(old => ({ ...old, loading: true, error: false }));
    void (async () => {
      try {
        for (const song of songs) {
          if (controller.signal.aborted) return;
          if (cachedSongGenres(song).length) continue;
          await resolveSongGenres(song, controller.signal);
          if (!controller.signal.aborted) setState(old => ({ ...old, revision: old.revision + 1 }));
        }
      } catch {
        if (!controller.signal.aborted) setState(old => ({ ...old, error: true }));
      } finally {
        if (!controller.signal.aborted) setState(old => ({ ...old, loading: false }));
      }
    })();
    return () => controller.abort();
  }, [signature, enabled, online, retry]);
  return { ...state, retry: () => setRetry(value => value + 1) };
}

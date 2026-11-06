import { useEffect, useRef, useState } from 'react';
import { creditedMilliseconds, LISTENING_CHANGED, readListening, writeListening, type ListeningEntry, type PlaybackSample } from './listening';
import type { PlayerState } from './types';

type Recorder = { owner: string; previous: PlaybackSample | null; entry: ListeningEntry | null; savedAt: number };
export function useListeningRecorder(owner: string, player: PlayerState, enabled: boolean) {
  const state = useRef<Recorder>({ owner: '', previous: null, entry: null, savedAt: 0 });
  useEffect(() => {
    const current = state.current;
    const now = Date.now();
    if (current.owner !== owner || !enabled || !player.track) {
      if (current.entry) writeListening(current.owner, current.entry);
      state.current = { owner, previous: null, entry: null, savedAt: now };
      return;
    }
    const sample: PlaybackSample = { id: player.track.id, positionMs: player.positionMs, status: player.status, at: now };
    const previous = current.previous;
    const credit = creditedMilliseconds(previous, sample);
    if (player.status === 'playing' && (!current.entry || current.entry.song.id !== player.track.id || previous && sample.positionMs + 1500 < previous.positionMs)) {
      if (current.entry) writeListening(owner, current.entry);
      current.entry = { id: crypto.randomUUID(), song: player.track, startedAt: now, lastAt: now, listenedMs: 0 };
    }
    if (current.entry && current.entry.song.id === player.track.id) {
      current.entry = { ...current.entry, listenedMs: current.entry.listenedMs + credit, lastAt: now };
      if (now - current.savedAt >= 5000 || player.status !== 'playing') { writeListening(owner, current.entry); current.savedAt = now; }
    }
    current.previous = sample;
  }, [owner, enabled, player.track?.id, player.positionMs, player.status]);
  useEffect(() => {
    const flush = () => { const current = state.current; if (current.entry) writeListening(current.owner, current.entry); };
    window.addEventListener('pagehide', flush);
    return () => { flush(); window.removeEventListener('pagehide', flush); };
  }, []);
}

export function useListeningHistory(owner: string) {
  const [state, setState] = useState(() => ({ owner, entries: readListening(owner) }));
  useEffect(() => {
    const refresh = () => setState({ owner, entries: readListening(owner) });
    refresh();
    window.addEventListener(LISTENING_CHANGED, refresh);
    return () => window.removeEventListener(LISTENING_CHANGED, refresh);
  }, [owner]);
  return state.owner === owner ? state.entries : readListening(owner);
}

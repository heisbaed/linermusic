import { loadSaved, save } from './library';
import type { PlayerState, Song } from './types';

export interface ListeningEntry { id: string; song: Song; startedAt: number; lastAt: number; listenedMs: number }
export interface PlaybackSample { id: string; status: PlayerState['status']; positionMs: number; at: number }
export const LISTENING_CHANGED = 'cine:listening-changed';
const key = (owner: string) => 'listening-v1:user:' + owner;

export function creditedMilliseconds(previous: PlaybackSample | null, current: PlaybackSample): number {
  if (!previous || previous.id !== current.id || previous.status !== 'playing' || !['playing', 'paused', 'ended'].includes(current.status)) return 0;
  const elapsed = current.at - previous.at, delta = current.positionMs - previous.positionMs;
  if (!Number.isFinite(elapsed) || !Number.isFinite(delta) || elapsed <= 0 || elapsed > 30_000 || delta <= 0 || delta > elapsed + 1500) return 0;
  return Math.min(delta, elapsed);
}

export function readListening(owner: string): ListeningEntry[] {
  if (!owner) return [];
  const entries = loadSaved<unknown>(key(owner), []);
  return Array.isArray(entries) ? entries.filter((entry): entry is ListeningEntry => Boolean(entry && typeof entry.id === 'string' && entry.song && typeof entry.song.id === 'string' && typeof entry.song.title === 'string' && typeof entry.song.artist === 'string' && Number.isFinite(entry.startedAt) && Number.isFinite(entry.lastAt) && Number.isFinite(entry.listenedMs) && entry.listenedMs > 0)).slice(0, 1000) : [];
}

export function writeListening(owner: string, entry: ListeningEntry): void {
  if (!owner || entry.listenedMs <= 0) return;
  try {
    const entries = readListening(owner);
    save(key(owner), [entry, ...entries.filter(item => item.id !== entry.id)].slice(0, 1000));
    window.dispatchEvent(new CustomEvent(LISTENING_CHANGED, { detail: { owner } }));
  } catch { /* Listening history must never interrupt playback when device storage is full. */ }
}

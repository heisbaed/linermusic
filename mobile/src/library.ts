import type { Playlist, Song } from './types';
export function loadSaved<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem('cine:' + key) ?? 'null');
    if (value === null) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(value) ? value as T : fallback;
    if (fallback !== null && (typeof value !== typeof fallback || (typeof fallback === 'object' && Array.isArray(value)))) return fallback;
    return value;
  }
  catch { return fallback; }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem('cine:' + key, JSON.stringify(value)); return true; }
  catch { window.dispatchEvent(new CustomEvent('cine:storage-error')); return false; }
}
export function toggleFavorite(items: Song[], song: Song): Song[] { return items.some(item => item.id === song.id) ? items.filter(item => item.id !== song.id) : [song, ...items]; }
export function addToPlaylist(list: Playlist, song: Song): Playlist { return list.songs.some(item => item.id === song.id) ? list : { ...list, songs: [...list.songs, song] }; }
export function parseLrc(text: string): { time: number; text: string }[] {
  return text.split(/\r?\n/).flatMap(line => {
    const stamps = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const words = line.replace(/\[[^\]]*\]/g, '').trim();
    return words ? stamps.map(stamp => ({ time: Number(stamp[1]) * 60 + Number(stamp[2]), text: words })) : [];
  }).sort((a, b) => a.time - b.time);
}
export function formatTime(ms: number) { const seconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

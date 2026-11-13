import type { Playlist, Song } from './types';
const BACKUP_TYPE = 'cine-music-playlists';
const BACKUP_VERSION = 1;
const MAX_BACKUP_CHARS = 4_000_000;
const MAX_BACKUP_PLAYLISTS = 200;
const MAX_BACKUP_SONGS = 5_000;
type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const backupText = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
function backupImage(value: unknown): string | undefined {
  return typeof value === 'string' && value.length < 180_000 && (/^https:\/\//.test(value) || /^\/figma\//.test(value) || /^data:image\/(jpeg|png|webp);base64,/.test(value)) ? value : undefined;
}
function backupSong(value: unknown): Song | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || value.id.length >= 256) return null;
  if (typeof value.title !== 'string' || typeof value.artist !== 'string' || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs < 0) return null;
  return {
    id: value.id, title: value.title.slice(0, 500), artist: value.artist.slice(0, 500), durationMs: value.durationMs,
    cover: backupImage(value.cover),
    artistId: typeof value.artistId === 'string' ? value.artistId.slice(0, 256) : undefined,
    albumId: typeof value.albumId === 'string' ? value.albumId.slice(0, 256) : undefined,
  };
}
function backupPlaylist(value: unknown): Playlist | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || value.id.length >= 256) return null;
  const name = backupText(value.name, 100).trim();
  if (!name) return null;
  const songs: Song[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(value.songs) ? value.songs : []) {
    const song = backupSong(item);
    if (song && !seen.has(song.id) && songs.length < MAX_BACKUP_SONGS) {
      seen.add(song.id);
      songs.push(song);
    }
  }
  return {
    id: value.id, name, songs, isPublic: false, cover: backupImage(value.cover),
    description: typeof value.description === 'string' ? value.description.slice(0, 1_000) : undefined,
  };
}
export function playlistBackupText(playlists: Playlist[], exportedAt = new Date()): string {
  const clean = playlists.flatMap(item => { const playlist = backupPlaylist(item); return playlist ? [playlist] : []; });
  return JSON.stringify({ type: BACKUP_TYPE, version: BACKUP_VERSION, exportedAt: exportedAt.toISOString(), playlists: clean }, null, 2);
}
export function parsePlaylistBackup(text: string): Playlist[] {
  if (text.length > MAX_BACKUP_CHARS) throw new Error('Choose a Cine playlist backup smaller than 4 MB.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (!isRecord(value) || value.type !== BACKUP_TYPE || value.version !== BACKUP_VERSION || !Array.isArray(value.playlists)) {
    throw new Error('This is not a Cine playlist backup.');
  }
  if (value.playlists.length > MAX_BACKUP_PLAYLISTS) throw new Error(`Restore up to ${MAX_BACKUP_PLAYLISTS} playlists at a time.`);
  const playlists = value.playlists.flatMap(item => { const playlist = backupPlaylist(item); return playlist ? [playlist] : []; });
  if (!playlists.length && value.playlists.length) throw new Error('This backup does not contain usable playlists.');
  return playlists;
}
export function playlistBackupFileName(playlists: Playlist[], exportedAt = new Date()): string {
  const date = exportedAt.toISOString().slice(0, 10);
  if (playlists.length !== 1) return `cine-playlists-${date}.json`;
  const name = playlists[0].name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `cine-playlist-${name || 'backup'}-${date}.json`;
}
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
export function playlistIsDownloaded(list: Playlist, downloads: { id: string }[], jobs: { id: string; status: string }[]): boolean {
  return list.songs.length > 0 && list.songs.every(song => downloads.some(item => item.id === song.id)
    || jobs.some(job => job.id === song.id && job.status !== 'failed'));
}
export function parseLrc(text: string): { time: number; text: string }[] {
  let offset = 0;
  const lines = text.split(/\r?\n/).flatMap(line => {
    const offsetMatch = line.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) { offset = Number(offsetMatch[1]) / 1000; return []; }
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    const words = line.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();
    return words ? stamps.map(stamp => {
      const fraction = stamp[3] ? Number('0.' + stamp[3].padEnd(3, '0')) : 0;
      return { time: Number(stamp[1]) * 60 + Number(stamp[2]) + fraction + offset, text: words };
    }) : [];
  });
  return lines.filter(line => line.time >= 0).sort((a, b) => a.time - b.time);
}
export function formatTime(ms: number) { const seconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

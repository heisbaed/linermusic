import type { Song } from './types';
export type LyricsRecord = { syncedLyrics?: string; plainLyrics?: string; instrumental?: boolean; trackName?: string; artistName?: string; duration?: number };
function normalized(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\([^)]*(?:official|audio|video|lyrics)[^)]*\)|\[[^\]]*(?:official|audio|video|lyrics)[^\]]*\]/g, '')
    .replace(/\b(?:official|audio|video|lyrics)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function lyricsScore(record: LyricsRecord, track: Song) {
  const title = normalized(record.trackName || ''), wanted = normalized(track.title);
  const artists = normalized(track.artist).split(/ feat | ft | and /);
  const artist = normalized(record.artistName || '');
  if (!title || title !== wanted || !artist || !artists.some(name => name === artist || name.startsWith(artist + ' ') || artist.startsWith(name + ' '))) return -Infinity;
  const delta = track.durationMs > 0 && typeof record.duration === 'number' ? Math.abs(record.duration - track.durationMs / 1000) : 0;
  if (delta > 15) return -Infinity;
  return 100 + (record.syncedLyrics ? 10 : 0) - delta;
}

import { searchText } from './catalogQuality';
import type { Song } from './types';

export interface HiddenMusic {
  songs: Pick<Song, 'id' | 'title' | 'artist'>[];
  artists: { id: string; name: string }[];
}
export interface ListeningCheckpoint {
  song: Song;
  queue: Song[];
  positionMs: number;
  context: string;
  savedAt: number;
}
export const EMPTY_HIDDEN: HiddenMusic = { songs: [], artists: [] };
export function normalizeHidden(value: unknown): HiddenMusic {
  const source = value as HiddenMusic | null;
  return { songs: Array.isArray(source?.songs) ? source.songs.filter(song => song && typeof song.id === 'string' && typeof song.title === 'string' && typeof song.artist === 'string').slice(0, 2000) : [],
    artists: Array.isArray(source?.artists) ? source.artists.filter(artist => artist && typeof artist.id === 'string' && typeof artist.name === 'string').slice(0, 1000) : [] };
}

export function artistIdentity(name: string): string {
  return searchText(name.replace(/\s*-\s*Topic$/i, '').split(/, | feat\.? | ft\.? /i)[0]);
}

export function isHidden(song: Song, hidden: HiddenMusic): boolean {
  return hidden.songs.some(item => item.id === song.id)
    || hidden.artists.some(item => (item.id && item.id === song.artistId) || artistIdentity(item.name) === artistIdentity(song.artist));
}

/** Keep official versions distinct. Only remove duplicate recordings by the same artist. */
export function deduplicatePlaylist(songs: Song[]): Song[] {
  const result: Song[] = [];
  for (const song of songs) {
    const title = searchText(song.title.replace(/\b(?:official\s+(?:music\s+)?(?:audio|video)|lyrics?)\b/gi, ''));
    const duplicate = result.some(item => item.id === song.id || (
      searchText(item.title.replace(/\b(?:official\s+(?:music\s+)?(?:audio|video)|lyrics?)\b/gi, '')) === title
      && artistIdentity(item.artist) === artistIdentity(song.artist)
      && item.durationMs > 0 && song.durationMs > 0 && Math.abs(item.durationMs - song.durationMs) <= 2000
    ));
    if (!duplicate) result.push(song);
  }
  return result;
}

export type RadioMode = 'balanced' | 'familiar' | 'discover';

export function personalizeSongs(songs: Song[], favorites: Song[], recent: Song[], hidden: HiddenMusic, mode: RadioMode = 'balanced', skipped: string[] = []): Song[] {
  const favoritesByArtist = new Set(favorites.map(song => artistIdentity(song.artist)));
  const recentIds = new Set(recent.slice(0, 20).map(song => song.id));
  const candidates = deduplicatePlaylist(songs.filter(song => !isHidden(song, hidden)));
  const scored = candidates.map((song, index) => ({ song, score: -index / 100
    + (favoritesByArtist.has(artistIdentity(song.artist)) ? mode === 'familiar' ? 8 : mode === 'discover' ? -4 : 2 : 0)
    - (recentIds.has(song.id) ? 6 : 0) - (skipped.includes(song.id) ? 12 : 0) })).sort((a, b) => b.score - a.score);
  const result: Song[] = [];
  while (scored.length) {
    const lastArtist = result.length ? artistIdentity(result[result.length - 1].artist) : '';
    const next = scored.findIndex(item => artistIdentity(item.song.artist) !== lastArtist);
    result.push(scored.splice(next < 0 ? 0 : next, 1)[0].song);
  }
  return result;
}

export function validCheckpoint(value: unknown): value is ListeningCheckpoint {
  const item = value as ListeningCheckpoint | null;
  return Boolean(item?.song && typeof item.song.id === 'string' && typeof item.song.title === 'string'
    && typeof item.song.artist === 'string' && Array.isArray(item.queue) && item.queue.every(song => song && typeof song.id === 'string')
    && Number.isFinite(item.positionMs) && item.positionMs >= 3000 && Number.isFinite(item.savedAt)
    && Date.now() - item.savedAt < 30 * 24 * 60 * 60 * 1000
    && (!item.song.durationMs || item.positionMs < item.song.durationMs - 3000));
}

export function lyricOffset(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(-10000, Math.min(10000, Math.round(value / 250) * 250)) : 0;
}

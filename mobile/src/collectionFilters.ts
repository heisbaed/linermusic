import type { Song } from './types';
import { cachedSongGenres } from './musicMetadata';

export const genreChoices = ['Gospel', 'Afrobeats', 'Bongo Flava', 'R&B', 'Hip-Hop', 'Pop', 'Reggae', 'Amapiano', 'Dance', 'Rock', 'Jazz', 'Classical', 'Country'];
const patterns: [string, RegExp][] = [
  ['Live', /\blive\b/i], ['Remixes', /\b(remix|remixed)\b/i],
  ['Acoustic', /\bacoustic\b/i], ['Instrumental', /\binstrumental\b/i],
];

// Genres come from matched metadata or the user's labels. Title text identifies versions only.
export function songLabels(song: Song): string[] {
  return [...new Set([...cachedSongGenres(song), ...patterns.filter(([, pattern]) => pattern.test(song.title)).map(([label]) => label)])];
}

export const songSortChoices = [
  { value: 'recent', label: 'Date added · Newest first' }, { value: 'oldest', label: 'Date added · Oldest first' },
  { value: 'az', label: 'Title A to Z' }, { value: 'za', label: 'Title Z to A' },
  { value: 'artist', label: 'Artist' }, { value: 'duration', label: 'Duration' },
];

export function sortCollectionSongs(songs: Song[], sort: string, dateField: 'likedAt' | 'addedAt' | 'downloadedAt' = 'likedAt'): Song[] {
  const result = [...songs];
  if (sort === 'recent' || sort === 'oldest') result.sort((a,b) => {
    const first = a[dateField], second = b[dateField];
    if (first && second) return sort === 'recent' ? second-first : first-second;
    return first ? -1 : second ? 1 : 0;
  });
  if (sort === 'az') result.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'za') result.sort((a, b) => b.title.localeCompare(a.title));
  if (sort === 'artist') result.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  if (sort === 'duration') result.sort((a, b) => a.durationMs - b.durationMs);
  return result;
}

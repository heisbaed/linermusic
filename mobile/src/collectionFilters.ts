import type { Song } from './types';

export const genreChoices = ['Gospel', 'Afrobeats', 'Bongo Flava', 'R&B', 'Hip-Hop', 'Pop', 'Reggae', 'Amapiano', 'Dance', 'Rock', 'Jazz', 'Classical', 'Country'];
const patterns: [string, RegExp][] = [
  ['Gospel', /\b(gospel|worship|praise)\b/i], ['Afrobeats', /\bafrobeats?\b/i],
  ['Bongo Flava', /\bbongo flava\b/i], ['R&B', /\br\s*&\s*b\b/i],
  ['Hip-Hop', /\bhip[ -]?hop\b/i], ['Pop', /\bpop\b/i], ['Reggae', /\breggae\b/i],
  ['Amapiano', /\bamapiano\b/i], ['Jazz', /\bjazz\b/i], ['Rock', /\brock\b/i],
  ['Classical', /\bclassical\b/i], ['Country', /\bcountry\b/i],
  ['Live', /\blive\b/i], ['Remixes', /\b(remix|remixed)\b/i],
  ['Acoustic', /\bacoustic\b/i], ['Instrumental', /\binstrumental\b/i],
];

// Use explicit saved tags and source titles, never guess a genre from an artist's identity.
export function songLabels(song: Song): string[] {
  return [...new Set([...(song.genres || []), ...patterns.filter(([, pattern]) => pattern.test(song.title)).map(([label]) => label)])];
}

export const songSortChoices = [
  { value: 'recent', label: 'Recently added' }, { value: 'oldest', label: 'Oldest added' },
  { value: 'az', label: 'Title A to Z' }, { value: 'za', label: 'Title Z to A' },
  { value: 'artist', label: 'Artist' }, { value: 'duration', label: 'Duration' },
];

export function sortCollectionSongs(songs: Song[], sort: string): Song[] {
  const result = [...songs];
  if (sort === 'oldest') result.reverse();
  if (sort === 'az') result.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'za') result.sort((a, b) => b.title.localeCompare(a.title));
  if (sort === 'artist') result.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  if (sort === 'duration') result.sort((a, b) => a.durationMs - b.durationMs);
  return result;
}

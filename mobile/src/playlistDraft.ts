import type { Song } from './types';

// Apply a local reorder/removal without resurrecting remote deletions or losing
// songs added by another device while this editor was open.
export function mergePlaylistSongDraft(current: Song[], original: Song[], draft: Song[]): Song[] {
  const originalIds = new Set(original.map(song => song.id));
  const latest = new Map(current.map(song => [song.id, song]));
  const ordered = draft.flatMap(song => latest.has(song.id) ? [latest.get(song.id)!] : []);
  const draftIds = new Set(ordered.map(song => song.id));
  return [...ordered, ...current.filter(song => !originalIds.has(song.id) && !draftIds.has(song.id))];
}

import type { Song } from './types';
import { artistIdentity, deduplicatePlaylist } from './smartFeatures';

export function localMixDay() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function rank(seed: string, id: string) {
  let hash = 2166136261;
  for (const letter of seed + ':' + id) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function rotateMixSeeds(songs: Song[], seed: string, previous: string[]) {
  const artists = new Set<string>();
  return deduplicatePlaylist(songs).sort((a, b) => Number(previous.includes(a.id)) - Number(previous.includes(b.id)) || rank(seed, a.id) - rank(seed, b.id))
    .filter(song => { const artist = artistIdentity(song.artist); if (artists.has(artist)) return false; artists.add(artist); return true; }).slice(0, 3);
}
export function rotateMixSongs(songs: Song[], previous: Song[], seed: string) {
  const old = deduplicatePlaylist(previous);
  const fresh = deduplicatePlaylist([...old, ...songs]).slice(old.length);
  const candidates = fresh.sort((a, b) => rank(seed, a.id) - rank(seed, b.id));
  const artists = new Map<string, number>();
  return candidates.filter(song => {
    const artist = artistIdentity(song.artist), count = artists.get(artist) || 0;
    if (count >= 3) return false;
    artists.set(artist, count + 1); return true;
  }).slice(0, 30);
}

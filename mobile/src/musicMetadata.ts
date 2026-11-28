import { loadSaved, save } from './library';
import type { Song } from './types';

type Tag = { name?: string; count?: number };
type Entry = { genres: string[]; at: number; source: 'recording' | 'artist' };
type Entity = { id: string; name?: string; title?: string; score?: number; length?: number; genres?: Tag[]; tags?: Tag[]; aliases?: { name?: string }[]; 'artist-credit'?: { name?: string; artist?: { name?: string } }[] };
const cache = loadSaved<Record<string, Entry>>('genre-metadata-v1', {});
const inFlight = new Map<string, Promise<Entry>>();
let queue: Promise<unknown> = Promise.resolve(), lastRequest = 0, appleRequest = 0, saveTimer: ReturnType<typeof setTimeout>;
const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const artistName = (name: string) => name.replace(/\s*-\s*Topic$/i, '').split(/, | feat\.? | ft\.? /i)[0].trim();
const titleName = (name: string) => name.replace(/\([^)]*(official|audio|video|lyric)[^)]*\)|\[[^\]]*(official|audio|video|lyric)[^\]]*\]/gi, '').trim();
const keyOf = (song: Song) => normalize(artistName(song.artist)) + ':' + normalize(titleName(song.title));
const fresh = (entry?: Entry) => !!entry && Date.now() - entry.at < (entry.genres.length ? 30 : 2) * 86400000;
function remember(key: string, entry: Entry) {
  cache[key] = entry;
  const keys = Object.keys(cache);
  if (keys.length > 1800) keys.sort((a,b) => cache[a].at-cache[b].at).slice(0,keys.length-1800).forEach(old => delete cache[old]);
  clearTimeout(saveTimer); saveTimer = setTimeout(() => save('genre-metadata-v1', cache), 1000);
  return entry;
}
function canonical(name: string): string {
  const text = normalize(name);
  if (/^(rhythm and blues|r b|contemporary r b)$/.test(text)) return 'R&B';
  if (/^(hip hop|hiphop|rap)$/.test(text)) return 'Hip Hop';
  if (/^(afrobeat|afrobeats|afro pop|afropop)$/.test(text)) return 'Afrobeats';
  if (/^(gospel|contemporary gospel|urban contemporary gospel)$/.test(text)) return 'Gospel';
  if (text === 'christian gospel') return 'Gospel';
  if (text === 'hip hop rap') return 'Hip Hop';
  if (text === 'r b soul') return 'R&B';
  if (text === 'bongo flava') return 'Bongo Flava';
  return text.split(' ').map(word => word[0]?.toUpperCase()+word.slice(1)).join(' ');
}
function labels(entity: Entity) { return [...new Set((entity.genres || []).filter(tag => (tag.count ?? 1) > 0 && tag.name).map(tag => canonical(tag.name!)))]; }
export async function musicBrainzMetadata(path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const operation = queue.catch(() => {}).then(async () => {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const delay = Math.max(0, 1150 - (Date.now() - lastRequest));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    lastRequest = Date.now();
    const timeout = new AbortController(), abort = () => timeout.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try {
      const headers: Record<string,string> = { Accept: 'application/json' };
      if (window.CineAndroid) headers['x-liner-user-agent'] = 'CineMusic/0.1.15 (https://github.com/heisbaed/linermusic)';
      const response = await fetch('https://musicbrainz.org/ws/2/' + path, { signal: timeout.signal, credentials: 'omit', headers });
      if (!response.ok) throw new Error('Genre information is unavailable.');
      const text = await response.text();
      if (text.length > 262144) throw new Error('Genre response was too large.');
      return JSON.parse(text) as Record<string,unknown>;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  });
  queue = operation;
  return operation;
}
const metadata=musicBrainzMetadata;
function quoted(text: string) { return '"' + text.replace(/["\\]/g, ' ').slice(0,180) + '"'; }
async function artistGenres(song: Song, signal: AbortSignal): Promise<Entry> {
  const name = artistName(song.artist), key = 'artist:' + normalize(name);
  if (fresh(cache[key])) return cache[key];
  const data = await metadata('artist/?' + new URLSearchParams({ query: 'artist:' + quoted(name), limit: '5', fmt: 'json' }), signal);
  const matches = ((data.artists || []) as Entity[]).filter(item => Number(item.score) >= 95 && [item.name, ...(item.aliases || []).map(alias => alias.name)].some(value => value && normalize(value) === normalize(name)));
  if (matches.length !== 1) return remember(key, { genres: [], at: Date.now(), source: 'artist' });
  const artist = await metadata('artist/' + encodeURIComponent(matches[0].id) + '?inc=genres&fmt=json', signal) as Entity;
  return remember(key, { genres: labels(artist), at: Date.now(), source: 'artist' });
}
export function cachedSongGenres(song: Song): string[] {
  return song.genres?.length ? song.genres.map(canonical) : cache[keyOf(song)]?.genres.length ? cache[keyOf(song)].genres : cache['artist:' + normalize(artistName(song.artist))]?.genres || [];
}
export function genreEvidence(song:Song):{genres:string[];source:'recording'|'artist'|'unknown'}{
  if(song.genres?.length)return {genres:song.genres.map(canonical),source:song.genreSource || 'unknown'};
  const track=cache[keyOf(song)];if(track?.genres.length)return {genres:track.genres,source:track.source};
  const artist=cache['artist:'+normalize(artistName(song.artist))];
  return artist?.genres.length?{genres:artist.genres,source:'artist'}:{genres:[],source:'unknown'};
}
export function genreCompatible(seed: Song, song: Song): boolean {
  const anchor=genreEvidence(seed),other=genreEvidence(song);
  // Artist-wide tags are weak evidence for an individual recording's style.
  if(anchor.source!=='recording'||other.source!=='recording')return true;
  return !anchor.genres.length||!other.genres.length||anchor.genres.some(genre=>other.genres.includes(genre));
}
async function storeGenre(song: Song, signal: AbortSignal): Promise<string[]> {
  const delay = Math.max(0, 3100-(Date.now()-appleRequest));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  appleRequest = Date.now();
  const controller = new AbortController(), abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const response = await fetch('https://itunes.apple.com/search?' + new URLSearchParams({ term: artistName(song.artist)+' '+titleName(song.title), entity: 'song', limit: '8', country: 'US' }), { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) return [];
    const data = await response.json() as { results?: { artistName: string; trackName: string; trackTimeMillis?: number; primaryGenreName?: string }[] };
    const found = data.results?.find(item => normalize(item.artistName) === normalize(artistName(song.artist)) && normalize(item.trackName) === normalize(titleName(song.title))
      && (!item.trackTimeMillis || !song.durationMs || Math.abs(item.trackTimeMillis-song.durationMs) < Math.max(15000,song.durationMs*.08)));
    return found?.primaryGenreName ? [canonical(found.primaryGenreName)] : [];
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
export async function resolveSongGenres(song: Song, signal: AbortSignal): Promise<Entry> {
  const key = keyOf(song);
  if (song.genres?.length && song.genreSource) return { genres: song.genres, at: Date.now(), source: song.genreSource };
  if (fresh(cache[key])) return cache[key];
  if (inFlight.has(key)) return inFlight.get(key)!;
  const work = (async () => {
    try { const genres = await storeGenre(song, signal); if (genres.length) return remember(key, { genres, at: Date.now(), source: 'recording' }); }
    catch { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); }
    const data = await metadata('recording/?' + new URLSearchParams({ query: 'recording:' + quoted(titleName(song.title)) + ' AND artist:' + quoted(artistName(song.artist)), limit: '5', fmt: 'json' }), signal);
    const matches = ((data.recordings || []) as Entity[]).filter(item => Number(item.score) >= 95 && normalize(item.title || '') === normalize(titleName(song.title))
      && (item['artist-credit'] || []).some(credit => normalize(credit.artist?.name || credit.name || '') === normalize(artistName(song.artist)))
      && (!item.length || !song.durationMs || Math.abs(item.length-song.durationMs) < Math.max(15000,song.durationMs*.08)));
    if (matches.length) {
      const recording = await metadata('recording/' + encodeURIComponent(matches[0].id) + '?inc=genres&fmt=json', signal) as Entity;
      const genres = labels(recording);
      if (genres.length) return remember(key, { genres, at: Date.now(), source: 'recording' });
    }
    return remember(key, await artistGenres(song, signal));
  })();
  inFlight.set(key, work);
  try { return await work; } finally { inFlight.delete(key); }
}

import { searchCatalog } from '@/shared/media/innertube/innertubeSearch';
import { toSquareArtworkUrl } from '@/shared/media/innertube/innertubeThumbnail';
import type { SearchResult } from '@/shared/contracts/catalog';
import type { SavedArtist } from './AppContext';
import { isOnline } from './network';
import { normalizeCountry } from './musicPreferences';

export interface RegionalArtist extends SavedArtist { country: string; mbid: string; matchMethod: 'unique-name'; fetchedAt: number }
export interface RegionalArtistResult { artists: RegionalArtist[]; country: string; fetchedAt: number; cached: boolean; stale: boolean }
interface CountryArtist { id: string; name: string; country: string; aliases?: { name?: string }[]; 'life-span'?: { ended?: boolean } }
const cachePrefix = 'cine:browse-cache:regional-artists-v1:';
const day = 86_400_000;
let musicBrainzQueue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
const artistName = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase();

export function matchCountryArtist(artist: CountryArtist, results: SearchResult[], country: string): SavedArtist | null {
  if (artist.country !== country || artist['life-span']?.ended === true) return null;
  const aliases = Array.isArray(artist.aliases) ? artist.aliases.flatMap(alias => typeof alias?.name === 'string' ? [alias.name] : []) : [];
  const names = new Set([artist.name, ...aliases].map(artistName).filter(Boolean));
  const matches = new Map(results.flatMap(result => result.type === 'artist' && names.has(artistName(result.name)) ? [[result.id, result] as const] : []));
  if (matches.size !== 1) return null;
  const result = [...matches.values()][0];
  return { id: result.id, name: result.name, cover: result.cover ? toSquareArtworkUrl(result.cover.url, 240) : undefined };
}

function cached(country: string): RegionalArtistResult | null {
  try {
    const value = JSON.parse(localStorage.getItem(cachePrefix + country) || 'null');
    if (!value || value.country !== country || !Number.isFinite(value.fetchedAt) || value.fetchedAt > Date.now() + 300_000 || !Array.isArray(value.artists)) return null;
    const artists = value.artists.filter((artist: RegionalArtist) => artist?.country === country && typeof artist.id === 'string' && typeof artist.name === 'string' && typeof artist.mbid === 'string' && artist.matchMethod === 'unique-name' && (!artist.cover || artist.cover.startsWith('https://'))).slice(0, 12);
    return { country, artists, fetchedAt: value.fetchedAt, cached: true, stale: Date.now() - value.fetchedAt > day };
  } catch { return null; }
}
function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
async function countryCandidates(country: string, signal: AbortSignal): Promise<CountryArtist[]> {
  const operation = musicBrainzQueue.catch(() => {}).then(async () => {
    await wait(Math.max(0, 1100 - (Date.now() - lastRequest)), signal);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      lastRequest = Date.now();
      const params = new URLSearchParams({ query: 'country:' + country, fmt: 'json', limit: '10' });
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (typeof window !== 'undefined' && window.CineAndroid) headers['x-liner-user-agent'] = 'CineMusic/0.1.0 (https://github.com/heisbaed/linermusic)';
      const response = await fetch('https://musicbrainz.org/ws/2/artist/?' + params, { signal, credentials: 'omit', headers });
      if ((response.status === 429 || response.status === 503) && attempt === 0) { await wait(Math.max(1100, Math.min(5000, Number(response.headers.get('Retry-After')) * 1000 || 1500)), signal); continue; }
      if (!response.ok) throw new Error('Regional artist information is unavailable.');
      const text = await response.text();
      if (text.length > 262_144) throw new Error('Regional artist response was too large.');
      const data: unknown = JSON.parse(text);
      const artists = (data as { artists?: unknown[] })?.artists;
      return Array.isArray(artists) ? artists.flatMap(value => {
        const artist = value as CountryArtist;
        return artist && artist.country === country && typeof artist.id === 'string' && typeof artist.name === 'string' && artist['life-span']?.ended !== true ? [artist] : [];
      }).slice(0, 8) : [];
    }
    return [];
  });
  musicBrainzQueue = operation.then(() => {}, () => {});
  return operation;
}

export async function getRegionalArtists(code: string, signal: AbortSignal): Promise<RegionalArtistResult> {
  const country = normalizeCountry(code);
  if (!country) throw new Error('Choose your listening country first.');
  const saved = cached(country);
  if (saved && !saved.stale && saved.artists.length) return saved;
  if (typeof navigator !== 'undefined' && isOnline() === false) { if (saved?.artists.length) return { ...saved, stale: true }; throw new Error('Connect to discover artists for this region.'); }
  try {
    const candidates = await countryCandidates(country, signal);
    const artists: RegionalArtist[] = [];
    let failed = 0;
    // Small batches keep the catalog bridge usable while discovery is loading.
    for (let index = 0; index < candidates.length && artists.length < 9; index += 3) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const batch = await Promise.allSettled(candidates.slice(index, index + 3).map(async candidate => {
        const results = await searchCatalog(candidate.name, 'artist', signal);
        const match = matchCountryArtist(candidate, results, country);
        return match ? { ...match, country, mbid: candidate.id, matchMethod: 'unique-name' as const, fetchedAt: Date.now() } : null;
      }));
      for (const result of batch) { if (result.status === 'rejected') failed++; else if (result.value && !artists.some(artist => artist.id === result.value?.id)) artists.push(result.value); }
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!artists.length && failed) throw new Error('The artist catalog could not be reached.');
    const result = { country, artists, fetchedAt: Date.now(), cached: false, stale: false };
    try { localStorage.setItem(cachePrefix + country, JSON.stringify(result)); } catch { /* Discovery caches are optional. */ }
    return result;
  } catch (error) {
    if (!signal.aborted && saved?.artists.length) return { ...saved, stale: true };
    throw error;
  }
}

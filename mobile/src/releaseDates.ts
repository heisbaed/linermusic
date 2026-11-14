import { searchText } from './catalogQuality';
import { loadSaved, save } from './library';
import type { SearchAlbumItem } from '@/shared/contracts';

export interface DatedRelease { title: string; artist: string; releasedAt: string }
export const releaseTitle = (title: string) => searchText(title.replace(/\s*-\s*(?:single|ep)\s*$/i, ''));

export function releasedWithin30Days(date: string | undefined, now = Date.now()): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date)) return false;
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const instant = Date.UTC(year, month - 1, day);
  const normalized = new Date(instant);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) return false;
  const today = new Date(now);
  const cutoff = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return instant <= cutoff && instant >= cutoff - 30 * 86400000;
}

export function parseDatedReleases(data: unknown, artist: string): DatedRelease[] {
  const results = (data as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap(value => {
    const row = value as Record<string, unknown> | null;
    if (!row || typeof row.artistName !== 'string' || searchText(row.artistName) !== searchText(artist)
      || typeof row.collectionName !== 'string' || typeof row.releaseDate !== 'string') return [];
    return [{ title: row.collectionName, artist: row.artistName, releasedAt: row.releaseDate }];
  });
}

export function datedAlbum(album: SearchAlbumItem, dates: DatedRelease[], now = Date.now()): (SearchAlbumItem & { releasedAt: string }) | null {
  const matching = dates.filter(item => releaseTitle(item.title) === releaseTitle(album.title)
    && album.artists.some(artist => searchText(artist.name) === searchText(item.artist)));
  // Prefer the earliest known issue of this edition so a later reissue cannot make an old release new.
  const release = matching.sort((a, b) => a.releasedAt.localeCompare(b.releasedAt))[0];
  return release && releasedWithin30Days(release.releasedAt, now) ? { ...album, releasedAt: release.releasedAt } : null;
}

export async function artistReleaseDates(artist: string, signal: AbortSignal): Promise<DatedRelease[]> {
  const key = 'release-dates-v1:' + searchText(artist);
  const cached = loadSaved<{ savedAt: number; items: DatedRelease[] } | null>(key, null);
  if (cached && Date.now() - cached.savedAt < 6 * 3600000 && Array.isArray(cached.items)) return cached.items;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 7000);
  try {
    const params = new URLSearchParams({ term: artist, entity: 'album', attribute: 'artistTerm', limit: '100', country: 'us' });
    const response = await fetch('https://itunes.apple.com/search?' + params, { signal: controller.signal });
    if (!response.ok) throw new Error('Release dates could not be checked.');
    const items = parseDatedReleases(await response.json(), artist);
    if (!signal.aborted) save(key, { savedAt: Date.now(), items });
    return items;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}

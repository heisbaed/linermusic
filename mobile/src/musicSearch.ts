import type { SearchResult, SearchType } from '@/shared/contracts';
import { searchRaw, type InnertubeSearchFilter } from '@/shared/media/innertube/innertubeSearch';
import { cleanSongResults } from './catalogQuality';

export async function searchMusicCatalog(query: string, type: SearchType = 'all', signal?: AbortSignal): Promise<SearchResult[]> {
  const value = query.trim().replace(/\s+/g, ' ');
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  if (!value) return [];
  // Mixed search supplies top hits/corrected queries that are sometimes absent
  // from Songs. Typed requests give each filter a complete first result page.
  const types: (InnertubeSearchFilter | undefined)[] = type === 'all'
    ? [undefined, 'track', 'artist', 'album', 'playlist', 'video']
    : type === 'track' ? [undefined, 'track', 'video'] : [undefined, type];
  const responses = await Promise.allSettled(types.map(kind => searchRaw(value, kind, signal)));
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  if (responses.every(result => result.status === 'rejected')) throw (responses[0] as PromiseRejectedResult).reason;
  const songIds = new Set<string>();
  const items = responses.flatMap((result, index) => {
    if (result.status !== 'fulfilled') return [];
    if (types[index] === 'track') for (const item of result.value) if (item.type === 'track') songIds.add(item.id);
    return result.value.filter(item => (types[index] === undefined || item.type === (types[index] === 'video' ? 'track' : types[index]))
      && (type === 'all' || item.type === type));
  });
  return cleanSongResults(items, value, songIds);
}

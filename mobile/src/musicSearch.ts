import type { SearchResult, SearchType } from '@/shared/contracts';
import { searchRaw, type InnertubeSearchFilter } from '@/shared/media/innertube/innertubeSearch';
import { cleanSongResults } from './catalogQuality';

export async function searchMusicCatalog(query: string, type: SearchType = 'all', signal?: AbortSignal, onPartial?: (items: SearchResult[]) => void): Promise<SearchResult[]> {
  const value = query.trim().replace(/\s+/g, ' ');
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  if (!value) return [];
  // Mixed search supplies top hits/corrected queries that are sometimes absent
  // from Songs. Typed requests give each filter a complete first result page.
  const types: (InnertubeSearchFilter | undefined)[] = type === 'all'
    ? [undefined, 'track', 'video']
    : type === 'track' ? [undefined, 'track', 'video'] : [undefined, type];
  const batches = new Map<number, SearchResult[]>();
  const partial = () => {
    const songIds = new Set((batches.get(types.indexOf('track')) || []).filter(item => item.type === 'track').map(item => item.id));
    const rows = [...batches.entries()].sort(([a],[b]) => a-b).flatMap(([,rows]) => rows).filter(item => type === 'all' || item.type === type);
    return cleanSongResults(rows, value, songIds);
  };
  const responses = await Promise.allSettled(types.map(async (kind,index) => {
    const rows = await searchRaw(value, kind, signal);
    if (!signal?.aborted) { batches.set(index,rows); onPartial?.(partial()); }
    return rows;
  }));
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

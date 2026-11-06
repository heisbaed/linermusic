import type { SearchResult, SearchType } from '@/shared/contracts';
import { searchRaw } from '@/shared/media/innertube/innertubeSearch';
import { cleanSongResults } from './catalogQuality';

export async function searchMusicCatalog(query: string,type: SearchType='all',signal?:AbortSignal):Promise<SearchResult[]> {
  const types = type==='all'?['track','artist','album'] as const:[type];
  const results=await Promise.allSettled(types.map(kind=>searchRaw(query,kind,signal)));
  if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
  if(results.every(r=>r.status==='rejected'))throw (results[0] as PromiseRejectedResult).reason;
  return cleanSongResults(results.flatMap((r,index)=>r.status==='fulfilled'?r.value.filter(item=>item.type===types[index]):[]),query);
}

import type { SearchResult, SearchType } from '@/shared/contracts';
import { searchRaw, type InnertubeSearchFilter } from '@/shared/media/innertube/innertubeSearch';
import { searchArtistVideos } from '@/shared/media/innertube/innertubeVideoSearch';
import { cleanSongResults, focusedSongQuery, hasOfficialMatch, searchText } from './catalogQuality';
import { musicQuery } from './searchIntent';
import { artistSearchNames } from './artistAliases';

export async function searchMusicCatalog(query: string, type: SearchType = 'all', signal?: AbortSignal, onPartial?: (items: SearchResult[]) => void): Promise<SearchResult[]> {
  const intent=musicQuery(query),value=intent.catalogQuery;
  const artistNames=new Set<string>(intent.artist?[searchText(intent.artist)]:[]);
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  if (!value) return [];
  // Mixed search supplies top hits/corrected queries that are sometimes absent
  // from Songs. Typed requests give each filter a complete first result page.
  const types: (InnertubeSearchFilter | 'web' | undefined)[] = type === 'all'
    ? [undefined, 'track', 'video', 'web']
    : type === 'track' ? [undefined, 'track', 'video', 'web'] : [undefined, type];
  const batches = new Map<number, SearchResult[]>();
  const partial = () => {
    const songIds = new Set((batches.get(types.indexOf('track')) || []).filter(item => item.type === 'track').map(item => item.id));
    const rows = [...batches.entries()].sort(([a],[b]) => a-b).flatMap(([,rows]) => rows).filter(item => type === 'all' || item.type === type);
    return cleanSongResults(rows, value, songIds,artistNames);
  };
  const responses = await Promise.allSettled(types.map(async (kind,index) => {
    const rows = kind==='web' ? await searchArtistVideos(value,signal) : await searchRaw(value, kind, signal);
    if (!signal?.aborted) { batches.set(index,rows); onPartial?.(partial()); }
    return rows;
  }));
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  if (responses.every(result => result.status === 'rejected')) throw (responses[0] as PromiseRejectedResult).reason;
  const songIds = new Set<string>();
  const items = responses.flatMap((result, index) => {
    if (result.status !== 'fulfilled') return [];
    if (types[index] === 'track') for (const item of result.value) if (item.type === 'track') songIds.add(item.id);
    return result.value.filter(item => (types[index] === undefined || item.type === (types[index] === 'video'||types[index]==='web' ? 'track' : types[index]))
      && (type === 'all' || item.type === type));
  });
  let result=cleanSongResults(items,value,songIds,artistNames);
  if((type==='all'||type==='track')&&intent.artist&&intent.title&&!hasOfficialMatch(result,value,artistNames)){
    const names=await artistSearchNames(intent.artist,signal);
    names.forEach(name=>artistNames.add(searchText(name)));
    const alternate=names.find(name=>searchText(name)!==searchText(intent.artist!));
    if(alternate){
      const text=intent.title+' '+alternate;
      const extra=await Promise.allSettled([searchRaw(text,'track',signal),searchArtistVideos(text,signal)]);
      if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
      extra.forEach((reply,index)=>{if(reply.status==='fulfilled'){items.push(...reply.value);if(index===0)reply.value.forEach(item=>{if(item.type==='track')songIds.add(item.id);});}});
      result=cleanSongResults(items,value,songIds,artistNames);onPartial?.(result);
    }
  }
  // Legacy artist names and renamed channels can suppress the original in a
  // full-name query. A bounded title lookup retrieves candidates without
  // inventing an artist alias or hardcoding any recording IDs.
  const title=focusedSongQuery(result,value);
  if((type==='all'||type==='track')&&title&&title!==value.toLocaleLowerCase()&&!hasOfficialMatch(result,value,artistNames)){
    const extra=await searchArtistVideos('"'+title+'"',signal).catch(()=>[]);
    if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');
    result=cleanSongResults([...result,...extra],value,songIds,artistNames);
    onPartial?.(result);
  }
  return result;
}

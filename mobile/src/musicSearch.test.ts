import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMusicCatalog } from './musicSearch';
import { searchRaw } from '@/shared/media/innertube/innertubeSearch';
import { parseSuggestions, mergeSuggestions } from './searchSuggestions';
import { cleanSongResults } from './catalogQuality';
vi.mock('@/shared/media/innertube/innertubeSearch', () => ({ searchRaw: vi.fn() }));
const song = (id:string,title:string,artist='Darassa') => ({ type:'track' as const,id,title,artists:[{id:'artist',name:artist}],durationMs:180000,musicVideoType:'MUSIC_VIDEO_TYPE_ATV' });
beforeEach(() => vi.mocked(searchRaw).mockReset());
describe('responsive music search', () => {
  it('publishes the first matches before a slower request finishes', async () => {
    let finish!: (items:ReturnType<typeof song>[])=>void;
    vi.mocked(searchRaw).mockImplementation(async (_query,type) => type==='track'?new Promise(resolve=>{finish=resolve;}):[song('one','Muziki')]);
    const partial=vi.fn(); const task=searchMusicCatalog('muz','all',undefined,partial);
    await vi.waitFor(()=>expect(partial).toHaveBeenCalledWith([expect.objectContaining({id:'one'})]));
    finish([song('two','Too Much')]); expect(await task).toHaveLength(2);
    expect(searchRaw).toHaveBeenCalledTimes(2);
  });
  it('does not publish cancelled results', async()=>{
    const abort=new AbortController();const partial=vi.fn();
    vi.mocked(searchRaw).mockImplementation(async()=>{abort.abort();return [song('one','Muziki')];});
    await expect(searchMusicCatalog('muz','all',abort.signal,partial)).rejects.toMatchObject({name:'AbortError'});
    expect(partial).not.toHaveBeenCalled();
  });
  it('parses real suggestion runs and merges history without duplicates',()=>{
    const raw={contents:[{searchSuggestionRenderer:{suggestion:{runs:[{text:'daras'},{text:'sa'}]}}},{searchSuggestionRenderer:{suggestion:{simpleText:'darassa'}}}]};
    expect(parseSuggestions(raw)).toEqual(['darassa']);
    expect(mergeSuggestions('daras',['darassa','darassa ft harmonize'],['Darassa','other'])).toEqual(['Darassa','darassa ft harmonize']);
  });
  it('ranks partial names and one-character misspellings above unrelated results',()=>{
    const rows=[song('other','Music','Another'),song('right','Muziki')];
    expect(cleanSongResults(rows,'daras muz')[0].id).toBe('right');
    expect(cleanSongResults(rows,'darasa muziki')[0].id).toBe('right');
  });
});

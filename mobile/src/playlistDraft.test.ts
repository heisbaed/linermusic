import {describe,expect,it} from 'vitest';
import {mergePlaylistSongDraft} from './playlistDraft';
import type {Song} from './types';
const song = (id:string,title=id):Song => ({id,title,artist:'Artist',durationMs:180000});
describe('playlist draft reconciliation',()=>{
  it('keeps new remote tracks and fresh metadata when a draft is reordered',()=>{
    const a=song('a'),b=song('b'),c=song('c');
    expect(mergePlaylistSongDraft([song('a','Updated title'),b,c],[a,b],[b,a])).toEqual([b,song('a','Updated title'),c]);
  });
  it('does not resurrect a remotely deleted song, and applies local removals',()=>{
    const a=song('a'),b=song('b'),c=song('c'),d=song('d');
    expect(mergePlaylistSongDraft([b,c,d],[a,b,c],[b,a])).toEqual([b,d]);
  });
});

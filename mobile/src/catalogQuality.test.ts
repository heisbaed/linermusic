import { describe,it,expect } from 'vitest';
import type { SearchResult,Track } from '@/shared/contracts';
import { cleanSongResults,relatedSongs } from './catalogQuality';
import { mapInnertubeTrack } from '@/shared/media/innertube/innertubeTrackMapper';
import { parsePlaylistCsv,confidentImportMatch } from './playlistImportData';
import { homeGreeting } from './greeting';
import { songLink } from './songLinks';
import { swipeDirection } from './playerGestures';
const track=(id:string,title='Shape of You',artist='Ed Sheeran'):Track=>({id,title,artists:[{id:artist==='Ed Sheeran'?'UC_ED':'UC_OTHER',name:artist}],durationMs:234000,musicVideoType:'MUSIC_VIDEO_TYPE_ATV'});
const result=(id:string,title='Shape of You',artist='Ed Sheeran'):Extract<SearchResult,{type:'track'}>=>({...track(id,title,artist),type:'track'});
describe('music quality and import boundaries',()=>{
 it('keeps the original and official versions while excluding unrelated artists and videos',()=>{
  const rows:SearchResult[]=[result('acoustic','Shape of You (Acoustic)'),result('studio'),result('live','Shape of You (Live)'),result('remix','Shape of You (Latin Remix)'),result('copy','Shape of You','Other'),{...result('video'),musicVideoType:'MUSIC_VIDEO_TYPE_OMV'},{type:'artist',id:'UC_ED',name:'Ed Sheeran'}];
  expect(cleanSongResults(rows,'Ed Sheeran Shape of You').map(r=>r.id)).toEqual(['studio','acoustic','live','remix','UC_ED']);
 });
 it('removes duplicates without merging different official versions',()=>{
  expect(cleanSongResults([result('one'),result('two'),result('three','Shape of You (Acoustic)')]).map(r=>r.id)).toEqual(['one','three']);
 });
 it('autoplay excludes the seed recording, alternate uploads and edited tracks',()=>{
  expect(relatedSongs([track('copy'),track('live','Shape of You (Live)'),track('next','Perfect'),track('edit','Perfect (Slowed)')],[{id:'seed',title:'Shape of You'}]).map(r=>r.id)).toEqual(['next']);
 });
 it('reads canonical song identity from menu links when source text is not linked',()=>{
  const endpoint=(id:string,type:string)=>({browseEndpoint:{browseId:id,browseEndpointContextSupportedConfigs:{browseEndpointContextMusicConfig:{pageType:type}}}});
  const column=(runs:unknown[])=>({musicResponsiveListItemFlexColumnRenderer:{text:{runs}}});
  const mapped=mapInnertubeTrack({musicResponsiveListItemRenderer:{playlistItemData:{videoId:'xTvyyoF_LZY'},flexColumns:[column([{text:'Shape of You',navigationEndpoint:{watchEndpoint:{watchEndpointMusicSupportedConfigs:{watchEndpointMusicConfig:{musicVideoType:'MUSIC_VIDEO_TYPE_ATV'}}}}}]),column([{text:'Ed Sheeran'},{text:' • '},{text:'Divide'},{text:' • '},{text:'3:54'}])],menu:{items:[endpoint('UC_ED','MUSIC_PAGE_TYPE_ARTIST'),endpoint('MPRE_album','MUSIC_PAGE_TYPE_ALBUM')]}}});
  expect(mapped?.artists).toEqual([{id:'UC_ED',name:'Ed Sheeran'}]);expect(mapped?.album?.id).toBe('MPRE_album');expect(mapped?.musicVideoType).toBe('MUSIC_VIDEO_TYPE_ATV');
 });
 it('reads quoted CSV titles and refuses files without artist identity',()=>{
  expect(parsePlaylistCsv('Track Name,Artist Name(s),Duration (ms)\n"One, two",Artist,120000').tracks[0]).toMatchObject({title:'One, two',artists:['Artist'],durationMs:120000});
  expect(()=>parsePlaylistCsv('Title\nSong')).toThrow('artist');
 });
 it('does not silently import a wrong artist, version or duration',()=>{
  const source={sourceId:'a',title:'Shape of You',artists:['Ed Sheeran'],durationMs:234000};
  expect(confidentImportMatch(source,[result('wrong','Shape of You','Other'),result('acoustic','Shape of You (Acoustic)')])).toBeUndefined();
  expect(confidentImportMatch(source,[result('right')])?.id).toBe('right');
  expect(confidentImportMatch(source,[{...result('short'),durationMs:10000}])).toBeUndefined();
 });
 it('uses an overnight greeting and validates Cine song links',()=>{
  expect(homeGreeting(0)).toBe('Welcome back');expect(homeGreeting(4)).toBe('Welcome back');expect(homeGreeting(5)).toBe('Good morning');expect(homeGreeting(15)).toBe('Good afternoon');
  expect(songLink('xTvyyoF_LZY')).toBe('cinemusic://song/xTvyyoF_LZY');expect(()=>songLink('../bad')).toThrow();
 });
 it('recognizes decisive swipes without treating taps, diagonals or slow drags as navigation',()=>{
  const start={x:100,y:100,at:0};expect(swipeDirection(start,{x:20,y:105,at:200})).toBe('left');expect(swipeDirection(start,{x:105,y:200,at:200})).toBe('down');expect(swipeDirection(start,{x:110,y:105,at:100})).toBeNull();expect(swipeDirection(start,{x:200,y:200,at:200})).toBeNull();expect(swipeDirection(start,{x:20,y:100,at:2000})).toBeNull();
 });
});

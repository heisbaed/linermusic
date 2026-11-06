import type { SearchResult, Track } from '@/shared/contracts';
import type { Song } from './types';

const edits = /\b(slowed|sped[ -]?up|speed[ -]?up|nightcore|reverb|8d|bass[ -]?boosted|karaoke|tribute|ringtone|tiktok|fan[ -]?made|cover|parody|originally performed|made famous|no guide melody|dj mix|non[ -]?stop)\b/i;
export const isEditedUpload = (title: string) => edits.test(title);
export const recordingTitle = (title: string) => title.toLocaleLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(official|audio|video|lyrics?|remastered|remaster)\b/g,' ')
  .replace(/[^\p{L}\p{N}]/gu,'');

export function isCatalogAudio(track: Track): boolean {
  if (isEditedUpload(track.title) || !track.artists.some(a=>a.id.startsWith('UC'))) return false;
  if (track.musicVideoType) return track.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV';
  // Older catalog rows omit the type: require a linked music album and artist,
  // rather than accepting a channel upload or a video-thumbnail fallback.
  return Boolean(track.album?.id && track.cover && track.cover.width === track.cover.height);
}
export function cleanSongResults(items: SearchResult[],query=''): SearchResult[] {
  const key=(text:string)=>text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const artistMatches=items.filter((item):item is Extract<SearchResult,{type:'artist'}>=>item.type==='artist'&&key(item.name).length>=3&&key(query).includes(key(item.name)));
  const preferred=new Set(artistMatches.map(a=>a.id));
  const seen = new Set<string>();
  return items.filter(item=>{
    if(item.type!=='track') return item.type==='artist'||item.type==='album'&&!isEditedUpload(item.title)&&(!preferred.size||item.artists.some(a=>preferred.has(a.id)));
    if(!isCatalogAudio(item))return false;
    if(preferred.size&&!item.artists.some(a=>preferred.has(a.id)))return false;
    const identity=key(item.title.replace(/\b(official audio|official video|lyrics)\b/gi,''))+':'+item.artists.map(a=>a.id).sort().join(',');
    if(seen.has(identity))return false;seen.add(identity);return true;
  }).sort((a,b)=>a.type==='track'&&b.type==='track'?Number(/\b(acoustic|live|remix|instrumental)\b/i.test(a.title))-Number(/\b(acoustic|live|remix|instrumental)\b/i.test(b.title)):0);
}
export function relatedSongs(tracks: Track[], previous: Pick<Song,'id'|'title'>[]): Track[] {
  const ids = new Set(previous.map(s=>s.id));
  const titles = new Set(previous.map(s=>recordingTitle(s.title)));
  return tracks.filter(track=>{
    const title=recordingTitle(track.title);
    if(!isCatalogAudio(track)||ids.has(track.id)||titles.has(title))return false;
    ids.add(track.id);titles.add(title);return true;
  });
}

import type { SearchResult, Track } from '@/shared/contracts';
import type { Song } from './types';

const edits = /\b(slowed|sped[ -]?up|speed[ -]?up|nightcore|reverb|8d|bass[ -]?boosted|karaoke|tribute|ringtone|tiktok|fan[ -]?made|cover|parody|originally performed|made famous|no guide melody|dj mix|non[ -]?stop)\b/i;
const uploadLabel = /^(?:official(?:\s+music)?\s+(?:video|audio|visuali[sz]er)|(?:official\s+)?lyric(?:s|\s+video)|music\s+video)(?:\s*(?:hd|hq|4k|1080p|720p))?$/i;

export function displaySongTitle(title: string, artist = ''): string {
  let clean = title.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (whole, round: string, square: string) =>
    uploadLabel.test((round || square).trim()) ? '' : whole);
  clean = clean.replace(/\s*(?:[-–—|]\s*)?(?:official(?:\s+music)?\s+(?:video|audio|visuali[sz]er)|official\s+lyric(?:s|\s+video))\s*(?:hd|hq|4k|1080p|720p)?\s*$/i, '');
  const prefix = artist.split(',')[0].trim();
  if (prefix && clean.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
    const remainder = clean.slice(prefix.length);
    if (/^\s*[-–—|]\s*\S/.test(remainder)) clean = remainder.replace(/^\s*[-–—|]\s*/, '');
  }
  return clean.replace(/\s+/g, ' ').replace(/\s*[-–—|]\s*$/, '').trim() || title;
}

export const isEditedUpload = (title: string) => edits.test(title);
export const recordingTitle = (title: string) => title.toLocaleLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(official|audio|video|lyrics?|remastered|remaster)\b/g,' ')
  .replace(/[^\p{L}\p{N}]/gu,'');

export function isCatalogAudio(track: Track, fromSongs = false): boolean {
  // Source classification is stronger evidence than words such as "Cover" in
  // a real song title. Artwork shape and artist-channel IDs are not guarantees.
  if (fromSongs) return true;
  if (track.musicVideoType && ['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV','MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'].includes(track.musicVideoType)) return true;
  return !isEditedUpload(track.title) && track.durationMs > 0 && track.artists.some(artist => artist.name && artist.name !== 'Unknown Artist');
}

export const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

export function tokenMatch(token: string, word: string): number {
  if (word === token) return 8;
  if (word.startsWith(token)) return 6;
  if (token.length < 4 || Math.abs(token.length-word.length)>1) return 0;
  // Bounded edit distance covers a missing/wrong character without matching unrelated short names.
  let row = Array.from({length:word.length+1},(_,i)=>i);
  for(let i=1;i<=token.length;i++) { const next=[i]; for(let j=1;j<=word.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+Number(token[i-1]!==word[j-1])); row=next; }
  return row[word.length]<=1 ? 3 : 0;
}

export function cleanSongResults(items: SearchResult[], query = '', songIds: ReadonlySet<string> = new Set()): SearchResult[] {
  // Keep every available result. Prefer matching catalog recordings over labelled
  // alternate uploads, while retaining source order for equally strong matches.
  const seen = new Set<string>();
  const unique = items.filter(item => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const wanted=searchText(query),words=wanted.split(' ').filter(Boolean);
  if(!words.length)return unique;
  const requestedVersion=/\b(cover|karaoke|instrumental|remix|live|acoustic|slowed|sped|reverb|tribute)\b/i.test(wanted);
  const tracks=unique.filter((item):item is Extract<SearchResult,{type:'track'}>=>item.type==='track');
  const artistTerms=new Set(tracks.flatMap(track=>track.artists.flatMap(artist=>{
    const name=searchText(artist.name.replace(/\s*-\s*Topic$/i,''));
    return name.length>2&&wanted.includes(name)?[name]:[];
  })));
  const requestedTitle=[...artistTerms].reduce((text,name)=>text.replace(name,' '),wanted).replace(/\bby\b/g,' ').replace(/\s+/g,' ').trim()||wanted;
  const score=(track:Extract<SearchResult,{type:'track'}>)=>{
    const title=searchText(displaySongTitle(track.title,track.artists[0]?.name||''));
    const base=searchText(track.title.replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(official|audio|video|lyrics?)\b/gi,' '));
    const artist=track.artists.map(item=>searchText(item.name.replace(/\s*-\s*Topic$/i,'')));
    const matchedArtist=!!artistTerms.size&&artist.some(name=>artistTerms.has(name));
    const titleMatch=title===wanted||title===requestedTitle||base===requestedTitle;
    const relevant=titleMatch||matchedArtist||words.every(word=>searchText(title+' '+artist.join(' ')).split(' ').includes(word));
    let rank=titleMatch?50:relevant?20:0;
    if(artistTerms.size)rank+=matchedArtist?35:-30;
    if(relevant){
      if(track.musicVideoType==='MUSIC_VIDEO_TYPE_ATV'||track.musicVideoType==='MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC')rank+=16;
      else if(track.musicVideoType==='MUSIC_VIDEO_TYPE_OMV')rank+=12;
      if(songIds.has(track.id))rank+=8;
    }
    if(!requestedVersion&&/\b(cover|karaoke|instrumental|tribute|originally performed|made famous|slowed|sped[ -]?up|reverb)\b/i.test(track.title))rank-=45;
    return rank;
  };
  const ranked=tracks.map((track,index)=>({track,index,score:score(track)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  let at=0;
  return unique.map(item=>item.type==='track'?ranked[at++].track:item);
}
export function relatedSongs(tracks: Track[], previous: Pick<Song,'id'|'title'>[]): Track[] {
  const ids = new Set(previous.map(s=>s.id));
  const titles = new Set(previous.map(s=>recordingTitle(s.title)));
  return tracks.filter(track=>{
    const title=recordingTitle(track.title);
    if(!isCatalogAudio(track)||isEditedUpload(track.title)||ids.has(track.id)||titles.has(title))return false;
    ids.add(track.id);titles.add(title);return true;
  });
}

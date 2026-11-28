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
  const divider = clean.search(/\s+[-–—|]\s+/);
  if (divider > 0 && prefix) {
    const names = searchText(prefix).split(' ').filter(word => !['x','and','the'].includes(word));
    const lead = searchText(clean.slice(0,divider)).split(' ');
    if (names.length > 1 && names.every(word => lead.includes(word))) clean = clean.slice(divider).replace(/^\s*[-–—|]\s*/, '');
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
  if (track.artists.length && track.artists.every(artist => artist.kind === 'uploader')) return false;
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

type SearchTrack = Extract<SearchResult,{type:'track'}>;
function coreSearchTitle(track: SearchTrack): string {
  return searchText(displaySongTitle(track.title,track.artists[0]?.name||'')
    .replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(?:feat\.?|ft\.?|featuring)\s+.*$/i,''));
}
export function focusedSongQuery(items: SearchResult[], query: string): string {
  const wanted=' '+searchText(query)+' ';
  return items.flatMap(item => {
    if(item.type!=='track')return [];
    const title=coreSearchTitle(item);
    return title.length>=3 && title.split(' ').length<=6 && wanted.includes(' '+title+' ') ? [title] : [];
  }).sort((a,b)=>b.length-a.length)[0] || '';
}
export function hasOfficialMatch(items: SearchResult[], query: string, requestedArtists: ReadonlySet<string> = new Set()): boolean {
  const focus=focusedSongQuery(items,query),wanted=searchText(query);
  return !!focus && items.some(item=>item.type==='track' && coreSearchTitle(item)===focus
    && (item.artists.some(artist=>artist.verifiedArtist) || ['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV','MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'].includes(item.musicVideoType||''))
    && (wanted===focus || item.artists.some(artist=> {
      const name=searchText(artist.name.replace(/\s*-\s*Topic$/i,''));
      return artist.kind!=='uploader' && name.length>2 && (requestedArtists.has(name)||(' '+wanted+' ').includes(' '+name+' '));
    })));
}
export function cleanSongResults(items: SearchResult[], query = '', songIds: ReadonlySet<string> = new Set(), requestedArtists:ReadonlySet<string>=new Set()): SearchResult[] {
  // Merge evidence for one source ID; a sparse Top Result must not erase the
  // recording classification or original title from a richer source response.
  const positions=new Map<string,number>(),unique:SearchResult[]=[];
  for(const item of items){
    const key=`${item.type}:${item.id}`,at=positions.get(key);
    if(at===undefined){positions.set(key,unique.length);unique.push(item);continue;}
    const first=unique[at];
    if(first.type==='track'&&item.type==='track'){
      const ownerTitle=item.source==='youtube'&&item.artists.some(artist=>artist.verifiedArtist);
      unique[at]={...first,title:ownerTitle?item.title:first.title,artists:ownerTitle||first.artists.every(artist=>!artist.id||artist.id==='unknown')?item.artists:first.artists,
        durationMs:first.durationMs||item.durationMs,cover:first.cover||item.cover,album:first.album||item.album,
        musicVideoType:first.musicVideoType&&first.musicVideoType!=='MUSIC_VIDEO_TYPE_UGC'?first.musicVideoType:item.musicVideoType,
        source:ownerTitle?'youtube':first.source||item.source};
    }
  }
  const wanted=searchText(query),words=wanted.split(' ').filter(Boolean);
  if(!words.length)return unique;
  const requestedVersion=/\b(cover|karaoke|instrumental|remix|live|acoustic|slowed|sped|reverb|tribute)\b/i.test(wanted);
  const tracks=unique.filter((item):item is Extract<SearchResult,{type:'track'}>=>item.type==='track');
  const artistTerms=new Set(tracks.flatMap(track=>track.artists.flatMap(artist=>{
    const name=searchText(artist.name.replace(/\s*-\s*Topic$/i,''));
    return artist.kind!=='uploader'&&name.length>2&&(requestedArtists.has(name)||(' '+wanted+' ').includes(' '+name+' '))?[name]:[];
  })));
  const requestedTitle=[...artistTerms].reduce((text,name)=>text.replace(name,' '),wanted).replace(/\bby\b/g,' ').replace(/\s+/g,' ').trim()||wanted;
  const focus=focusedSongQuery(unique,query);
  const score=(track:Extract<SearchResult,{type:'track'}>)=>{
    const title=searchText(displaySongTitle(track.title,track.artists[0]?.name||''));
    const base=coreSearchTitle(track);
    const artist=track.artists.filter(item=>item.kind!=='uploader').map(item=>searchText(item.name.replace(/\s*-\s*Topic$/i,'')));
    const matchedArtist=!!artistTerms.size&&artist.some(name=>artistTerms.has(name));
    const titleMatch=title===wanted||title===requestedTitle||base===requestedTitle||!!focus&&base===focus;
    const combined=searchText(title+' '+artist.join(' ')).split(' ');
    const coverage=words.reduce((total,word)=>total+Math.max(0,...combined.map(term=>tokenMatch(word,term)))/8,0)/words.length;
    // An exact recording comes before unrelated songs by the same artist.
    let rank=(titleMatch?220:0)+coverage*30+(matchedArtist?35:0);
    const officialOwner=track.artists.some(artist=>artist.verifiedArtist);
    const officialRecording=['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV','MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'].includes(track.musicVideoType||'');
    if(titleMatch||coverage>=.7){
      rank+=officialOwner?80:officialRecording?50:0;
      if(songIds.has(track.id))rank+=8;
    }
    if(!requestedVersion&&isEditedUpload(track.title))rank-=(officialOwner||officialRecording&&matchedArtist)?12:90;
    if(/\b(reaction|reacting|tutorial|choreography|dance practice|interview|compilation)\b/i.test(track.title)&&!requestedVersion)rank-=110;
    return rank;
  };
  const ranked=tracks.map((track,index)=>({track,index,score:score(track)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  let at=0;
  const ordered=unique.map(item=>item.type==='track'?ranked[at++].track:item);
  const exactArtist=unique.find(item=>item.type==='artist'&&searchText(item.name)===wanted);
  if(exactArtist)return [exactArtist,...ordered.filter(item=>item.type!=='artist'||item.id!==exactArtist.id)];
  if(ranked[0]?.score>=220&&ordered[0]?.id!==ranked[0].track.id)return [ranked[0].track,...ordered.filter(item=>item.type!=='track'||item.id!==ranked[0].track.id)];
  return ordered;
}
export function relatedSongs(tracks: Track[], previous: (Pick<Song,'id'|'title'>&Partial<Pick<Song,'artist'>>)[]): Track[] {
  const ids = new Set(previous.map(s=>s.id));
  const identity=(title:string,artist:string)=>recordingTitle(displaySongTitle(title,artist))+':'+searchText(artist.replace(/\s*-\s*Topic$/i,'').split(/,|\s+(?:feat\.?|ft\.?)\s+/i)[0]);
  const titles = new Set(previous.filter(song=>song.artist).map(song=>identity(song.title,song.artist!)));
  return tracks.filter(track=>{
    const title=identity(track.title,track.artists[0]?.name||'');
    const official=['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV','MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'].includes(track.musicVideoType||'');
    if(!isCatalogAudio(track)||!official&&isEditedUpload(track.title)||ids.has(track.id)||titles.has(title))return false;
    ids.add(track.id);titles.add(title);return true;
  });
}

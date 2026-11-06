import type { ImportedTrack,SearchResult } from '@/shared/contracts';
import { fetchSpotifyEmbed } from '@/features/library/services/import/sources/spotify/spotifyEmbed';
import { parseSpotifyUrl } from '@/features/library/services/import/sources/spotify/spotifyUrl';
import { importDeezer } from '@/features/library/services/import/sources/deezerSource';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
export interface ImportList { title:string; tracks:ImportedTrack[]; note?:string }
export function parsePlaylistCsv(text:string):ImportList {
 if(text.length>2_000_000)throw new Error('Choose a CSV smaller than 2 MB.');
 const first=text.split(/\r?\n/)[0];const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}else value+=c;}
 if(quoted)throw new Error('The CSV contains an unfinished quoted field.');if(value||row.length){row.push(value);rows.push(row);}
 const headers=(rows.shift()||[]).map(h=>h.replace(/^\uFEFF/,'').toLowerCase().replace(/[^a-z0-9]/g,''));
 const column=(names:string[])=>headers.findIndex(h=>names.includes(h));
 const title=column(['trackname','songname','title','name']),artist=column(['artistname','artistnames','artists','artist','creator']);
 const album=column(['albumname','album']),duration=column(['durationms','durationinms','trackdurationms']);
 if(title<0||artist<0)throw new Error('The CSV needs song title and artist columns (for example Track Name and Artist Name).');
 const tracks=rows.filter(r=>r[title]?.trim()&&r[artist]?.trim()).map((r,index)=>({sourceId:String(index),title:r[title].trim(),artists:r[artist].split(/;|\|/).map(a=>a.trim()).filter(Boolean),album:r[album]?.trim(),durationMs:duration>=0&&Number(r[duration])>0?Number(r[duration]):undefined}));
 if(!tracks.length)throw new Error('No songs were found in the CSV.');if(tracks.length>500)throw new Error('Import up to 500 songs at a time.');
 return {title:'Imported playlist',tracks};
}
export async function readPlaylistLink(input:string,signal:AbortSignal):Promise<ImportList>{
 const url=new URL(input.trim());if(url.protocol!=='https:'||url.username||url.password)throw new Error('Use a public HTTPS playlist link.');
 if(['youtube.com','www.youtube.com','music.youtube.com'].includes(url.hostname)){
  const id=url.searchParams.get('list');if(!id||!/^[\w-]+$/.test(id))throw new Error('Use a playlist link with a list ID.');
  const list=await innertubeCatalog.getPlaylist(id,signal);return {title:list.title,tracks:list.tracks.slice(0,500).map(t=>({sourceId:t.id,title:t.title,artists:t.artists.map(a=>a.name),album:t.album?.title,durationMs:t.durationMs}))};
 }
 if(url.hostname==='open.spotify.com'){
  const {type,id}=parseSpotifyUrl(url.href);const list=await fetchSpotifyEmbed(type,id,'Spotify playlist',signal);
  if(!list.tracks.length)throw new Error('Spotify did not expose this playlist. Make it public or import its CSV export.');
  return {title:list.title||'Spotify playlist',tracks:list.tracks.slice(0,500),note:'This list contains the tracks exposed by Spotify’s public page. Use a CSV export if the source limits its preview.'};
 }
 if(['deezer.com','www.deezer.com'].includes(url.hostname)){const list=await importDeezer(url.href,signal);if(list.tracks.length>500)throw new Error('Import up to 500 songs at a time.');return list;}
 if(['music.apple.com','embed.music.apple.com'].includes(url.hostname)){
  const response=await fetch('https://embed.music.apple.com'+url.pathname,{signal});if(!response.ok)throw new Error('Apple Music could not open this public playlist.');const html=await response.text();
  const doc=new DOMParser().parseFromString(html,'text/html');const tracks=new Map<string,ImportedTrack>();
  const walk=(value:unknown)=>{if(!value||typeof value!=='object')return;const r=value as Record<string,any>,a=r.attributes||r;
   if((r.type==='songs'||r.type==='song'||r['@type']==='MusicRecording')&&typeof a.name==='string'){
    const artist=a.artistName||a.byArtist?.name||a.artist?.name;if(typeof artist==='string')tracks.set(String(r.id||a.name+artist),{sourceId:String(r.id||a.name),title:a.name,artists:[artist],album:a.albumName,durationMs:a.durationInMillis});
   }Object.values(r).forEach(walk);
  };
  for(const script of doc.querySelectorAll('script[type="application/ld+json"],script[type="application/json"],script#serialized-server-data')){try{walk(JSON.parse(script.textContent||''));}catch{}}
  if(!tracks.size)throw new Error('Apple Music did not expose the song list. Import its CSV export instead.');
  return {title:doc.title.replace(/ - Apple Music.*$/,'')||'Apple Music playlist',tracks:[...tracks.values()].slice(0,500)};
 }
 throw new Error('Use a Spotify, Apple Music, Deezer, or YouTube playlist link, or upload a CSV export from your music app.');
}
const normalized=(value:string)=>value.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]/gu,'');
export function confidentImportMatch(source:ImportedTrack,candidates:SearchResult[]):Extract<SearchResult,{type:'track'}>|undefined {
 const matches=candidates.filter((c):c is Extract<SearchResult,{type:'track'}>=>c.type==='track'&&normalized(c.title)===normalized(source.title)&&c.artists.some(a=>source.artists.some(s=>normalized(a.name)===normalized(s)))&&(!source.durationMs||!c.durationMs||Math.abs(source.durationMs-c.durationMs)<=7000));
 return matches.length===1?matches[0]:undefined;
}

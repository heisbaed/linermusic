import type { Song } from './types';
import { displaySongTitle, searchText } from './catalogQuality';
import { lyricsScore, type LyricsRecord } from './lyricsMatch';

type Reply={ok:boolean;status:number;data:unknown};
type Pending={controller:AbortController;task:Promise<Reply>;clients:Set<symbol>;done:boolean};
const requests=new Map<string,Pending>(),missing=new Map<string,number>();
export const lyricsIdentity=(song:Song)=>[song.id,searchText(displaySongTitle(song.title,song.artist)),searchText(song.artist),Math.round(song.durationMs/1000)].join(':');
function request(url:string,signal:AbortSignal):Promise<Reply>{
  if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
  let entry=requests.get(url);
  if(!entry||entry.controller.signal.aborted){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    const next:Pending={controller,clients:new Set(),done:false,task:Promise.resolve({ok:false,status:0,data:null})};
    next.task=fetch(url,{signal:controller.signal}).then(async response=>{
      if(Number(response.headers.get('Content-Length'))>524288)throw new Error('Lyrics response was too large.');
      const text=await response.text();if(text.length>262144)throw new Error('Lyrics response was too large.');
      return {ok:response.ok,status:response.status,data:response.ok?JSON.parse(text):null};
    }).finally(()=>{next.done=true;clearTimeout(timer);if(requests.get(url)===next)requests.delete(url);});
    requests.set(url,next);entry=next;
  }
  const shared=entry,key=Symbol();shared.clients.add(key);
  return new Promise((resolve,reject)=>{
    let done=false;
    const release=()=>{signal.removeEventListener('abort',cancel);shared.clients.delete(key);if(!shared.clients.size&&!shared.done)shared.controller.abort();};
    const cancel=()=>{if(done)return;done=true;release();reject(new DOMException('Cancelled','AbortError'));};
    signal.addEventListener('abort',cancel,{once:true});
    shared.task.then(reply=>{if(done)return;done=true;release();resolve(reply);},error=>{if(done)return;done=true;release();reject(error);});
  });
}
export async function fetchLyrics(track:Song,signal:AbortSignal,force=false):Promise<LyricsRecord|null>{
  const identity=lyricsIdentity(track);
  if(/^Uploaded by /i.test(track.artist))return null;
  if(!force&&Date.now()-(missing.get(identity)||0)<300000)return null;
  const title=displaySongTitle(track.title,track.artist);
  const params=new URLSearchParams({artist_name:track.artist,track_name:title});
  if(track.durationMs>0)params.set('duration',String(Math.round(track.durationMs/1000)));
  const exact=await request('https://lrclib.net/api/get?'+params,signal);
  if(exact.ok){
    const record=exact.data as LyricsRecord;
    if(Number.isFinite(lyricsScore(record,track))){
      if(record.instrumental)return null;
      if(record.syncedLyrics||record.plainLyrics)return record;
    }
  }else if(exact.status!==404)throw new Error('Lyrics could not be loaded. Try again.');
  const response=await request('https://lrclib.net/api/search?'+new URLSearchParams({artist_name:track.artist,track_name:title}),signal);
  if(!response.ok)throw new Error('Lyrics could not be loaded. Try again.');
  const records=Array.isArray(response.data)?response.data as LyricsRecord[]:[];
  const record=records.filter(item=>item&&(item.syncedLyrics||item.plainLyrics)&&Number.isFinite(lyricsScore(item,track)))
    .sort((a,b)=>lyricsScore(b,track)-lyricsScore(a,track))[0]||null;
  if(!record){missing.set(identity,Date.now());while(missing.size>100)missing.delete(missing.keys().next().value!);}
  return record;
}

import { useEffect,useState } from 'react';
import { useApp,type SavedArtist } from './AppContext';
import type { SearchAlbumItem } from '@/shared/contracts';
import { searchRaw } from '@/shared/media/innertube/innertubeSearch';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { isEditedUpload } from './catalogQuality';

const cache=new Map<string,SearchAlbumItem[]>();
const nameKey=(name:string)=>name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const seeds:Record<string,string[]>={
 'afrobeats':['Burna Boy','Tems'],'bongo-flava':['Diamond Platnumz','Zuchu'],amapiano:['Tyla','Kabza De Small'],
 rnb:['SZA','The Weeknd'],pop:['Dua Lipa','Ed Sheeran'],'hip-hop':['Kendrick Lamar','J. Cole'],gospel:['CeCe Winans','Mercy Chinwo'],
 reggae:['Bob Marley & The Wailers','Chronixx'],rock:['Coldplay','Linkin Park'],jazz:['Norah Jones','Gregory Porter'],
};
function artworkWorks(url:string,signal:AbortSignal):Promise<boolean>{
 return new Promise(resolve=>{
  const image=new Image();let done=false;
  const finish=(ok:boolean)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);image.onload=null;image.onerror=null;resolve(ok);};
  const cancel=()=>finish(false);const timer=setTimeout(()=>finish(false),6000);
  image.onload=()=>finish(image.naturalWidth>0);image.onerror=cancel;signal.addEventListener('abort',cancel,{once:true});
  if(signal.aborted)finish(false);else image.src=url;
 });
}
export function useDiscovery(active:boolean, edition = Math.floor(Date.now() / 3_600_000)){
 const app=useApp();const {artists,taste}=app.account.library;
 const names=[...new Set(taste.genres.flatMap(g=>seeds[g]||[]))];
 if(!names.length)names.push(...(taste.country==='TZ'?['Diamond Platnumz','Zuchu']:['Burna Boy','Dua Lipa']));
 const listening = [...app.account.library.recent, ...app.account.library.favorites]
  .filter(song => song.artistId?.startsWith('UC'))
  .map(song => ({ id: song.artistId!, name: song.artist.split(', ')[0] }));
 const pool = [...new Map([...artists, ...listening].map(artist => [artist.id, artist])).values()];
 const rotate = <T,>(values:T[]) => { const offset = values.length ? edition % values.length : 0; return [...values.slice(offset), ...values.slice(0,offset)]; };
 const selected = rotate(pool).slice(0,4);
 const seedNames = rotate(names).slice(0,2);
 const key=JSON.stringify([app.account.user?.localId, selected.map(a=>[a.id,a.name]), seedNames, edition]);
 const [feed,setFeed]=useState({key,items:cache.get(key)||[]});const [loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!active||!app.online)return;
  const controller=new AbortController(),signal=controller.signal;setLoading(true);setError('');
  async function load(){
   if(cache.has(key)&&retry===0)return cache.get(key)!;
   const chosen:SavedArtist[]=[...selected];
   if(chosen.length<4){
    const found=await Promise.allSettled(seedNames.map(async name=>{
     const results=await searchRaw(name,'artist',signal);
     const exact=results.filter(r=>r.type==='artist'&&nameKey(r.name)===nameKey(name));
     return exact.length===1&&exact[0].type==='artist'?{id:exact[0].id,name:exact[0].name}:null;
    }));
    for(const result of found)if(result.status==='fulfilled'&&result.value&&!chosen.some(a=>a.id===result.value!.id))chosen.push(result.value);
   }
   const releases=await Promise.allSettled(chosen.slice(0,5).map(async source=>{
    const artist=await innertubeCatalog.getArtist(source.id,signal);
    if(artist.id!==source.id)return [];
    let albums:SearchAlbumItem[]=[...artist.albums,...artist.singles].map(album=>({...album,type:'album',artists:[{id:artist.id,name:artist.name}]}));
    if(!albums.length){const results=await searchRaw(artist.name,'album',signal);albums=results.filter((r):r is SearchAlbumItem=>r.type==='album'&&r.artists.some(a=>a.id===artist.id));}
    const year=new Date().getFullYear();
    return albums.filter(a=>a.cover?.url&&!isEditedUpload(a.title)&&a.year!==undefined&&a.year>=year-2&&a.year<=year)
      .sort((a,b)=>(b.year||0)-(a.year||0)).slice(0,5);
   }));
   const lists=releases.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
   const interleaved=Array.from({length:5},(_,i)=>lists.flatMap(list=>list[i]?[list[i]]:[])).flat();
   const unique=[...new Map(interleaved.map(a=>[a.id,a])).values()].sort((a,b)=>(b.year||0)-(a.year||0)).slice(0,20);
   const checked=await Promise.all(unique.map(async album=>await artworkWorks(album.cover!.url,signal)?album:null));
   const items=checked.filter((a):a is SearchAlbumItem=>a!==null);
   if(signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(!items.length)throw new Error('Artist releases could not load. Try again or choose artists in Music preferences.');
   if(cache.size>8)cache.clear();cache.set(key,items);return items;
  }
  void load().then(items=>{if(!signal.aborted)setFeed({key,items});}).catch(e=>{if(!signal.aborted)setError(e.message||'Discoveries could not load.');}).finally(()=>{if(!signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[key,active,app.online,retry]);
 return {items:feed.key===key?feed.items:cache.get(key)||[],loading,error,retry:()=>setRetry(n=>n+1)};
}

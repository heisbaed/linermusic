import { useEffect, useState } from 'react';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { toSquareArtworkUrl } from '@/shared/media/innertube/innertubeThumbnail';
import { loadSaved, save } from './library';
import type { Song } from './types';

type Artwork = { url: string; at: number };
const cache = loadSaved<Record<string,Artwork>>('tv-artwork-v1',{});
const pending = new Map<string,Promise<string>>();
const lanes: Promise<unknown>[] = [Promise.resolve(),Promise.resolve()];
let lane = 0, saveTimer: ReturnType<typeof setTimeout>;
export const isVideoArtwork = (url = '') => /(?:^|\/)i\.ytimg\.com\/vi(?:_webp)?\//i.test(url) || /\/(?:hq|mq|sd|maxres)default\.(?:jpg|webp)/i.test(url);
export const tvArtworkUrl = (url: string, large = false) => toSquareArtworkUrl(url,large?1440:512);
const fresh = (item?: Artwork) => item && Date.now()-item.at < (item.url?30*86400000:2*3600000);
function remember(key: string,url: string) {
  cache[key]={url,at:Date.now()};
  const keys=Object.keys(cache);
  if(keys.length>600)keys.sort((a,b)=>cache[a].at-cache[b].at).slice(0,keys.length-600).forEach(old=>delete cache[old]);
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>save('tv-artwork-v1',cache),600);
  return url;
}
const artKey = (song: Partial<Song>,artistOnly: boolean) => [artistOnly?'artist':'cover',song.id||song.albumId||song.artistId||'',song.artistId||'',song.cover||''].join('|');
function good(url?: string) { return !!url && url.startsWith('https://') && !isVideoArtwork(url); }
async function resolve(song: Partial<Song>,artistOnly: boolean,large: boolean): Promise<string> {
  const key=artKey(song,artistOnly);
  if(fresh(cache[key]))return cache[key].url;
  if(pending.has(key))return pending.get(key)!;
  async function lookup() {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
    let albumId=song.albumId,artistId=song.artistId;
    try {
      if(!albumId && !artistId && song.id && /^[\w-]{11}$/.test(song.id)) {
        const track=await innertubeCatalog.getTrack(song.id,controller.signal);
        albumId=track.album?.id;artistId=track.artists[0]?.id;
        if(!artistOnly&&good(track.cover?.url))return remember(key,track.cover!.url);
      }
      if(!artistOnly&&albumId){
        const cached=cache['album:'+albumId];
        if(fresh(cached)&&cached.url)return remember(key,cached.url);
        try{const album=await innertubeCatalog.getAlbum(albumId,controller.signal);if(good(album.cover?.url)){remember('album:'+albumId,album.cover!.url);return remember(key,album.cover!.url);}artistId ||= album.artists[0]?.id;}catch{/* A known artist portrait remains a valid fallback. */}
      }
      if(!artistId && song.id && /^[\w-]{11}$/.test(song.id)){
        const track=await innertubeCatalog.getTrack(song.id,controller.signal);artistId=track.artists[0]?.id;
      }
      if(artistId){
        const cached=cache['artist:'+artistId];
        if(fresh(cached)&&cached.url)return remember(key,cached.url);
        const image=await innertubeCatalog.getArtistImage(artistId,controller.signal);
        if(good(image)){remember('artist:'+artistId,image!);return remember(key,image!);}
      }
      return remember(key,'');
    }catch{return '';}
    finally{clearTimeout(timer);}
  }
  // Only visible weak covers are enriched; two background lanes keep browsing light.
  const index=lane++%lanes.length;
  const work=(large?lookup():lanes[index].catch(()=>{}).then(lookup)).finally(()=>pending.delete(key));
  if(!large)lanes[index]=work;
  pending.set(key,work);return work;
}
export function useTvArtwork(song: Partial<Song>|null|undefined,enabled: boolean,large=false,artistOnly=false) {
  const key=artKey(song||{},artistOnly);
  const [resolved,setResolved]=useState<{key:string;url:string}|null>(null);
  const needs=artistOnly||!song?.cover||isVideoArtwork(song.cover);
  useEffect(()=>{
    if(!enabled||!needs||!song||(!song.id&&!song.artistId&&!song.albumId))return;
    let active=true;
    void resolve(song,artistOnly,large).then(url=>{if(active)setResolved({key,url});});
    return()=>{active=false;};
  },[key,enabled,needs,large,artistOnly]);
  if(!enabled)return song?.cover||'';
  const cached=fresh(cache[key])?cache[key].url:'';
  const preferred=resolved?.key===key?resolved.url:cached;
  return preferred?tvArtworkUrl(preferred,large):needs?'':song?.cover?tvArtworkUrl(song.cover,large):'';
}

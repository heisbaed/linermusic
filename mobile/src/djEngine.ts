import { searchMusicCatalog } from './musicSearch';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { songFrom } from './Browse';
import { relatedSongs } from './catalogQuality';
import { deduplicatePlaylist, isHidden, personalizeSongs, type HiddenMusic, type RadioMode } from './smartFeatures';
import { cachedSongGenres } from './musicMetadata';
import { loadSaved, save } from './library';
import type { Song } from './types';

export interface DjSet { songs: Song[]; intro: string; reason: string; request: string; ai: boolean; createdAt: number; language?: 'en'|'sw' }
export interface DjInput { request: string; language: 'en'|'sw'; mode: RadioMode; ai: boolean; seed?: Song; owner: string; favorites: Song[]; recent: Song[]; hidden: HiddenMusic; signal: AbortSignal; progress: (value: string) => void }
const normalize = (value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').replace(/^(rnb|rhythmandblues|rbsoul)$/,'rb').replace(/^(christian|christiangospel|injili)$/,'gospel').replace(/^hiphoprap$/,'hiphop');
export async function createDjSet(input: DjInput): Promise<DjSet> {
  const { signal, request, seed, language, mode } = input;
  let query = request.trim() || [seed?.artist,seed?.title].filter(Boolean).join(' '), genre = '';
  if (!query) throw new Error('Tell Dj Cine a song, artist, genre or mood to begin.');
  if (input.ai) {
    input.progress(language==='sw'?'Ninaelewa ombi lako…':'Understanding your request…');
    const { planDj } = await import('./djAi');
    const plan = await planDj(query,language,mode,signal,request.trim()?undefined:seed);
    query = plan.query; genre = plan.genre;
  }
  input.progress(language==='sw'?'Ninatafuta muziki…':'Finding music…');
  const searched = request.trim() || !seed ? await searchMusicCatalog(query,'track',signal) : [];
  const direct = searched.flatMap(item=>item.type==='track'?[songFrom(item)]:[]);
  const anchor = direct[0] || seed;
  const radio = anchor ? await innertubeCatalog.getRadio(anchor.id,{signal,k:50}).then(result=>relatedSongs(result.items,[anchor]).map(songFrom)).catch(()=>[]) : [];
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  const skipped = loadSaved<string[]>('skipped:'+input.owner,[]);
  const previous = loadSaved<string[]>('dj-played:'+input.owner,[]);
  const heard = new Set([...previous,...input.recent.map(song=>song.id)]);
  const candidates = deduplicatePlaylist([...direct,...radio]).filter(song=>!isHidden(song,input.hidden)&&!skipped.includes(song.id))
    .filter(song=>{const tags=cachedSongGenres(song);const wanted=genre.split(/[,;/]/).map(normalize).filter(Boolean);return !wanted.length||!tags.length||tags.some(tag=>wanted.includes(normalize(tag)));});
  const ranked = personalizeSongs(candidates,input.favorites,input.recent,input.hidden,mode,skipped);
  const fresh = ranked.filter(song=>!heard.has(song.id));
  const pool = (mode==='discover'?fresh:mode==='familiar'?ranked:[...fresh,...ranked.filter(song=>heard.has(song.id))]).slice(0,50);
  if(!pool.length)throw new Error('No matching fresh songs were available. Try another request or choose Balanced.');
  let songs=pool.slice(0,24), intro=language==='sw'?'Huu hapa mchanganyiko wako. Furahia muziki.':'Here’s your requested mix. Enjoy the music.', reason=seed&&!request.trim()?`Started from ${seed.title} by ${seed.artist}.`:`Built from catalog results for “${query}”.`;
  if(input.ai){
    input.progress(language==='sw'?'Ninapanga seti yako…':'Curating your set…');
    const { curateDj } = await import('./djAi');
    const selection = await curateDj(request||query,pool,language,mode,signal);
    const byId=new Map(pool.map(song=>[song.id,song]));songs=selection.ids.map(id=>byId.get(id)!).filter(Boolean);
    intro=selection.intro||intro;reason=selection.reason||reason;
  }
  if(signal.aborted)throw new DOMException('Cancelled','AbortError');
  return {songs,intro,reason,request:request||query,ai:input.ai,createdAt:Date.now(),language};
}
export function rememberDjSet(owner:string,set:DjSet){save('dj-set:'+owner,set);save('dj-played:'+owner,[...new Set([...set.songs.map(song=>song.id),...loadSaved<string[]>('dj-played:'+owner,[])])].slice(0,150));}

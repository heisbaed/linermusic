export interface MusicQuery { catalogQuery:string;title?:string;artist?:string;album?:string;kind:'recording'|'artist'|'album'|'general' }
/** Keep explicit entity fields separate from the natural-language query. */
export function musicQuery(input:string):MusicQuery{
  const value=input.trim().replace(/\s+/g,' '),fields:Record<string,string>={};
  const rest=value.replace(/\b(artist|track|album):\s*("[^"]+"|.+?)(?=\s+\b(?:artist|track|album):|$)/gi,(_,key:string,text:string)=>{
    fields[key.toLowerCase()]=text.replace(/^"|"$/g,'').trim();return ' ';
  }).trim();
  if(Object.keys(fields).length){
    const title=fields.track,artist=fields.artist,album=fields.album;
    return {title,artist,album,kind:title?'recording':album?'album':artist?'artist':'general',catalogQuery:[title,artist,album,rest].filter(Boolean).join(' ')};
  }
  const by=value.match(/^(.+?)\s+by\s+(.+)$/i);
  if(by)return {title:by[1].replace(/^"|"$/g,''),artist:by[2],kind:'recording',catalogQuery:value};
  return {kind:'general',catalogQuery:value};
}

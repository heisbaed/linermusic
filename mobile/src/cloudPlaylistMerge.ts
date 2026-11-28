type RecordValue=Record<string,unknown>;
const record=(value:unknown):value is RecordValue=>!!value&&typeof value==='object'&&!Array.isArray(value);
const equal=(a:unknown,b:unknown)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const songs=(value:unknown):RecordValue[] => (Array.isArray(value)?value:record(value)?Object.values(value):[]).filter((item):item is RecordValue=>record(item)&&typeof item.id==='string');

/** Apply local edits since base while preserving unrelated changes on another device. */
export function mergeCloudPlaylist(base:unknown,local:unknown,remote:unknown):unknown{
  if(!record(local))return local;
  if(!record(base)||!record(remote))return local;
  const result:RecordValue={...remote};
  for(const key of new Set([...Object.keys(base),...Object.keys(local)])){
    if(key==='songs'||['__proto__','constructor','prototype'].includes(key)||equal(base[key],local[key]))continue;
    if(Object.hasOwn(local,key))result[key]=local[key];else delete result[key];
  }
  if(equal(base.songs,local.songs))return result;
  const before=songs(base.songs),after=songs(local.songs),latest=songs(remote.songs);
  const old=new Map(before.map(song=>[String(song.id),song])),next=new Map(after.map(song=>[String(song.id),song]));
  let merged=latest.filter(song=>!old.has(String(song.id))||next.has(String(song.id))).map(song=>{
    const id=String(song.id),prior=old.get(id),update=next.get(id);
    if(!prior||!update)return song;
    const copy={...song};
    for(const key of new Set([...Object.keys(prior),...Object.keys(update)]))if(!equal(prior[key],update[key])){
      if(Object.hasOwn(update,key))copy[key]=update[key];else delete copy[key];
    }
    return copy;
  });
  for(let at=0;at<after.length;at++){
    const song=after[at],id=String(song.id);
    if(old.has(id)||merged.some(item=>item.id===id))continue;
    const following=after.slice(at+1).find(item=>merged.some(candidate=>candidate.id===item.id));
    const position=following?merged.findIndex(item=>item.id===following.id):merged.length;
    merged.splice(position,0,song);
  }
  const was=before.filter(song=>next.has(String(song.id))).map(song=>song.id);
  const now=after.filter(song=>old.has(String(song.id))).map(song=>song.id);
  if(!equal(was,now)){
    const ids=after.map(song=>String(song.id)),byId=new Map(merged.map(song=>[String(song.id),song]));
    merged=[...ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]),...merged.filter(song=>!next.has(String(song.id)))];
  }
  result.songs=merged;return result;
}

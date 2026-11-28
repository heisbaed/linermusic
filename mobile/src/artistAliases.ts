import { loadSaved,save } from './library';
import { searchText } from './catalogQuality';
import { musicBrainzMetadata } from './musicMetadata';
type Entry={names:string[];at:number};
const cache=loadSaved<Record<string,Entry>>('artist-aliases-v1',{}),pending=new Map<string,Promise<string[]>>();
export async function artistSearchNames(input:string,signal?:AbortSignal):Promise<string[]>{
  const name=input.split(/\s+(?:ft\.?|feat\.?|featuring)\s+/i)[0].trim().slice(0,80),key=searchText(name);
  if(key.length<3||signal?.aborted)return [];
  const saved=cache[key];if(saved&&Date.now()-saved.at<(saved.names.length?30:2)*86400000)return saved.names;
  let task=pending.get(key);
  if(!task){
    if(pending.size>=3)return [];
    task=(async()=>{
      const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
      const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Artist metadata timed out'));},6000);});
      try{
        const data=await Promise.race([musicBrainzMetadata('artist/?'+new URLSearchParams({query:'"'+name.replace(/["\\]/g,' ')+'"',limit:'5',fmt:'json'}),controller.signal),timeout]);
        const rows=Array.isArray(data.artists)?data.artists as {name?:string;score?:number;aliases?:{name?:string}[]}[]:[];
        const matches=rows.filter(row=>Number(row.score)>=95&&[row.name,...(row.aliases||[]).map(alias=>alias.name)].some(value=>typeof value==='string'&&searchText(value)===key));
        const names=matches.length===1?[...new Set([matches[0].name,...(matches[0].aliases||[]).map(alias=>alias.name)].filter((value):value is string=>typeof value==='string'&&value.length>0&&value.length<=80))].slice(0,12):[];
        cache[key]={names,at:Date.now()};const keys=Object.keys(cache);if(keys.length>200)keys.sort((a,b)=>cache[a].at-cache[b].at).slice(0,keys.length-200).forEach(old=>delete cache[old]);
        save('artist-aliases-v1',cache);return names;
      }catch{return [];}finally{clearTimeout(timer!);controller.abort();pending.delete(key);}
    })();pending.set(key,task);
  }
  const names=await task;if(signal?.aborted)throw new DOMException('Search cancelled','AbortError');return names;
}

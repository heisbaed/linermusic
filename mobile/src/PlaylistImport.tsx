import { useEffect,useRef,useState,type ChangeEvent } from 'react';
import { useApp } from './AppContext';
import { PageHeader,Notice } from './ui';
import { parsePlaylistCsv,readPlaylistLink,confidentImportMatch,type ImportList } from './playlistImportData';
import { searchMusicCatalog } from './musicSearch';
import { songFrom } from './Browse';
import type { Song } from './types';
type Review={source:ImportList['tracks'][number];candidates:Song[];selected:string;error?:string};
export function PlaylistImport(){
 const app=useApp();const [url,setUrl]=useState(''),[name,setName]=useState(''),[list,setList]=useState<ImportList|null>(null),[rows,setRows]=useState<Review[]>([]);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');const task=useRef<AbortController|null>(null),owner=useRef(app.account.user?.localId);
 useEffect(()=>()=>task.current?.abort(),[]);
 async function review(read:(signal:AbortSignal)=>Promise<ImportList>){
  task.current?.abort();const controller=new AbortController();task.current=controller;setBusy(true);setError('');setList(null);setRows([]);setProgress('Reading playlist...');
  try{const loaded=await read(controller.signal);if(controller.signal.aborted)return;setList(loaded);setName(loaded.title);const result:Review[]=loaded.tracks.map(source=>({source,candidates:[],selected:''}));setRows([...result]);let cursor=0,done=0;
   async function worker(){while(cursor<result.length&&!controller.signal.aborted){const index=cursor++;const row=result[index];try{const candidates=await searchMusicCatalog(row.source.title+' '+row.source.artists.join(' '),'track',controller.signal);const match=confidentImportMatch(row.source,candidates);result[index]={source:row.source,candidates:candidates.filter(c=>c.type==='track').slice(0,5).map(c=>songFrom(c as Extract<typeof c,{type:'track'}>)),selected:match?.id||''};}catch(e){if(controller.signal.aborted)return;result[index]={...row,error:'Could not match this song.'};}done++;setRows([...result]);setProgress(`Matched ${done} of ${result.length}`);}}
   await Promise.all([worker(),worker()]);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Import could not complete.');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 function cancel(){task.current?.abort();setBusy(false);setProgress('Matching stopped. Review the songs already matched.');}
 async function file(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;if(file.size>2_000_000){setError('Choose a CSV smaller than 2 MB.');return;}await review(async()=>({...parsePlaylistCsv(await file.text()),title:file.name.replace(/\.csv$/i,'')}));event.target.value='';}
 const selected=[...new Map(rows.flatMap(row=>{const song=row.candidates.find(c=>c.id===row.selected);return song?[[song.id,song] as const]:[];})).values()];
 function save(){if(!selected.length||!name.trim()||owner.current!==app.account.user?.localId)return;const id=crypto.randomUUID();app.account.setLibrary(old=>({...old,playlists:[...old.playlists,{id,name:name.trim().slice(0,80),description:'Imported playlist',songs:selected,isPublic:false}]}));app.openRoute({kind:'playlist',id});app.toast(`Imported ${selected.length} songs.`);}
 return <section className="screen playlist-import"><PageHeader title="Import playlist"/><p className="design-page-description">Bring your playlists into Cine. Review song matches before saving.</p>
  <form onSubmit={e=>{e.preventDefault();void review(signal=>readPlaylistLink(url,signal));}}><label className="account-field">Public playlist link<input type="url" required value={url} onChange={e=>setUrl(e.target.value)} placeholder="Spotify, Apple Music, Deezer or YouTube" disabled={busy}/></label><button className="primary-button full-button" disabled={busy}>Find playlist</button></form>
  <label className="import-file secondary-button">Import CSV from a music app<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void file(e)}/></label><p className="account-help">Private playlists can be imported using a CSV export with song title and artist columns. Up to 500 songs.</p>
  {error&&<p role="alert" className="form-error">{error}</p>}{progress&&<p role="status">{progress}</p>}{busy&&<button className="secondary-button" onClick={cancel}>Stop matching</button>}
  {list&&<><label className="account-field">Playlist name<input maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>{list.note&&<p className="account-help">{list.note}</p>}<div className="section-heading"><h2>Review matches</h2><span>{selected.length} selected</span></div>
   {rows.map((row,index)=><div className="import-review-row" key={index}><strong>{row.source.title}</strong><small>{row.source.artists.join(', ')}</small><select aria-label={'Match for '+row.source.title} disabled={busy} value={row.selected} onChange={e=>setRows(items=>items.map((item,at)=>at===index?{...item,selected:e.target.value}:item))}><option value="">{row.candidates.length?'Skip this song':'No match — skip'}</option>{row.candidates.map(song=><option key={song.id} value={song.id}>{song.title} — {song.artist}</option>)}</select>{row.error&&<small>{row.error}</small>}</div>)}
   {!busy&&<button className="primary-button full-button" disabled={!selected.length||!name.trim()} onClick={save}>Import {selected.length} selected songs</button>}
   {!busy&&!selected.length&&<Notice title="No songs selected">Choose matches above, or try a CSV with more precise song and artist names.</Notice>}
  </>}
 </section>;
}

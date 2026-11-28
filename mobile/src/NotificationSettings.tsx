import { useEffect, useState } from 'react';
import { useApp } from './AppContext';
import { subscribe } from './native';
import { requestMusicSearch } from './searchNavigation';
type Activity={title:string;detail:string;query:string;at:number};
type State={releases:boolean;updates:boolean;downloads:boolean;allowed:boolean;history:Activity[];lastCheck:number;error:string};
function read():State {
  try { return JSON.parse(window.CineAndroid?.musicNotificationState?.() || '{}'); } catch { return {} as State; }
}
export function NotificationSettings() {
  const app=useApp(),[state,setState]=useState(read),[busy,setBusy]=useState(false);
  const native=!!window.CineAndroid?.configureMusicNotification;
  useEffect(()=>{
    const refresh=()=>setState(read()); window.addEventListener('focus',refresh);
    const close=subscribe(event=>{if(event.type==='musicNotifications'){refresh();setBusy(false);}else if(event.type==='downloads')refresh();});
    return ()=>{window.removeEventListener('focus',refresh);close();};
  },[]);
  useEffect(()=>{if(!busy)return;const timer=setTimeout(()=>{setBusy(false);setState(read());},90000);return()=>clearTimeout(timer);},[busy]);
  function toggle(key:'downloads'|'releases'|'updates',enabled:boolean) {
    window.CineAndroid?.configureMusicNotification?.(key,enabled);setState(read());
    if(enabled&&!state.allowed)app.toast('Allow Cine music notifications in the Android permission prompt or system settings.');
  }
  return <>
    <p className="design-page-description">Choose the updates you want. Background delivery follows Android’s battery and notification settings.</p>
    {!native&&<p role="status">Notification preferences are available in the Android app.</p>}
    {native&&!state.allowed&&<p role="status">System notifications are blocked. Your preferences are saved; allow notifications in system settings to receive alerts.</p>}
    {([['releases','New releases','Checks followed artists daily while connected. Catalog coverage varies.'],['downloads','Completed downloads','Know when a song is ready offline.'],['updates','App updates','Checks for a new version; downloading remains your choice.']] as const).map(([key,title,detail])=><label className="design-setting-row switch-row" key={key}><span className="row-copy"><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" role="switch" checked={!!state[key]} disabled={!native} onChange={event=>toggle(key,event.target.checked)}/></label>)}
    <button className="design-setting-row" onClick={()=>window.CineAndroid?.openNotificationSettings()} disabled={!native}>System notification settings</button>
    <div className="section-heading"><h2>Activity</h2><button className="text-button" disabled={!native||busy||(!state.releases&&!state.updates)} onClick={()=>{setBusy(true);window.CineAndroid?.refreshMusicNotifications?.();}}>{busy?'Checking…':'Refresh'}</button></div>
    {state.error&&<p role="status">{state.error}</p>}
    {!!state.lastCheck&&<p className="design-quiet-copy">Last checked {new Date(state.lastCheck).toLocaleString()}</p>}
    {state.history?.length?state.history.map((entry,index)=><button className="design-setting-row" key={entry.at+':'+index} onClick={()=>{
      if(entry.query==='@update'){window.CineAndroid?.checkForUpdates?.();return;}
      app.goTab('search');requestMusicSearch(entry.query);
    }}><span className="row-copy"><strong>{entry.title}</strong><small>{entry.detail}</small><small>{new Date(entry.at).toLocaleDateString()}</small></span></button>):<p className="design-quiet-copy">No new activity.</p>}
  </>;
}

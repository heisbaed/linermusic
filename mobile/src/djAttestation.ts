import { subscribe } from './native';
export function requestDjAttestation(): Promise<{token:string;expireTimeMillis:number}> {
  return new Promise((resolve,reject)=>{
    const native=window.CineAndroid;
    if(!native?.requestDjAttestation){reject(new Error('DJ_UPDATE: Install the latest Cine music app to use AI requests.'));return;}
    const id=crypto.randomUUID();let finished=false;
    const clean=()=>{finished=true;clearTimeout(timer);stop();};
    const timer=setTimeout(()=>{if(!finished){clean();reject(new Error('DJ_VERIFY: App verification timed out. Try again with Google Play services available.'));}},30000);
    const stop=subscribe(event=>{
      if(finished||event.type!=='djAttestation'||event.data.id!==id)return;
      clean();
      if(event.data.error){reject(new Error(String(event.data.error)));return;}
      const token=String(event.data.token||''),expireTimeMillis=Number(event.data.expireTimeMillis);
      if(!token||!Number.isFinite(expireTimeMillis)||expireTimeMillis<=Date.now()){reject(new Error('DJ_VERIFY: App verification returned an expired token.'));return;}
      resolve({token,expireTimeMillis});
    });
    try{native.requestDjAttestation(id);}catch(error){clean();reject(error);}
  });
}

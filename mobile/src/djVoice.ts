import { subscribe } from './native';

export function speakDjIntro(text: string, language: string): Promise<void> {
  return new Promise((resolve,reject)=>{
    if(!window.CineAndroid?.speakDj){reject(new Error('Spoken introductions need the latest Android app.'));return;}
    const id=crypto.randomUUID();let done=false;
    const cleanup=()=>{if(done)return;done=true;clearTimeout(timer);stop();};
    const timer=setTimeout(()=>{cleanup();window.CineAndroid?.stopDjVoice?.();reject(new Error('The spoken introduction timed out.'));},45000);
    const stop=subscribe(event=>{
      if(event.type!=='djSpeech'||event.data.id!==id||done)return;
      const status=String(event.data.status);
      if(status==='done'){cleanup();resolve();}
      if(status==='cancelled'){cleanup();reject(new DOMException('Introduction stopped','AbortError'));}
      if(status==='error'){cleanup();reject(new Error(String(event.data.message||'The device voice is unavailable.')));}
    });
    try{window.CineAndroid.speakDj(id,text,language);}catch(error){cleanup();reject(error);}
  });
}

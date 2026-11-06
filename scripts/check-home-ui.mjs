import fs from 'node:fs/promises';
import { installFixture } from './ui-fixture.mjs';

// Real rendered app, isolated localhost fixture data; no real users or audio.
const base = 'http://127.0.0.1:5178';
const output = new URL('../.device-test/design-review/', import.meta.url);
await fs.mkdir(output,{recursive:true});
const report={checks:[],failures:[],errors:[],screenshots:[],fixture:true};
async function connect(url){
 const socket=new WebSocket(url); await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0; const calls=new Map(),listeners=new Map();
 socket.onmessage=e=>{const message=JSON.parse(e.data);if(message.id){const call=calls.get(message.id);calls.delete(message.id);if(call){clearTimeout(call.timer);message.error?call.reject(message.error):call.resolve(message.result);}}else for(const listener of listeners.get(message.method)||[])listener(message.params);};
 return {cdp(method,params={}){return new Promise((resolve,reject)=>{const next=++id;const timer=setTimeout(()=>{calls.delete(next);reject(new Error('CDP timeout: '+method));},20000);calls.set(next,{resolve,reject,timer});socket.send(JSON.stringify({id:next,method,params}));});},on(name,fn){listeners.set(name,[...listeners.get(name)||[],fn]);},close(){socket.close();}};
}
const version=await(await fetch('http://127.0.0.1:9228/json/version')).json();
const browser=await connect(version.webSocketDebuggerUrl);
const {browserContextId}=await browser.cdp('Target.createBrowserContext');
const {targetId}=await browser.cdp('Target.createTarget',{url:'about:blank',browserContextId});
const targets=await(await fetch('http://127.0.0.1:9228/json/list')).json();
const page=await connect(targets.find(item=>item.id===targetId).webSocketDebuggerUrl);
const evaluate=async expression=>{const r=await page.cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(100);}throw new Error('Not ready: '+expression);}
async function click(selector){const ok=await evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length&&!e.disabled);if(!e)return false;e.click();return true;})()`);if(!ok)throw new Error('Missing control '+selector);await delay(70);}
async function textClick(text){const ok=await evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&!e.disabled&&(e.textContent.trim()===${JSON.stringify(text)}||e.querySelector('strong')?.textContent.trim()===${JSON.stringify(text)}));if(!e)return false;e.click();return true;})()`);if(!ok)throw new Error('Missing button '+text);await delay(70);}
async function input(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(40);}
const back=async()=>{await evaluate("window.dispatchEvent(new Event('cine:back',{cancelable:true}))");await delay(80);};
const assert=(value,message)=>{if(!value)throw new Error(message);};
async function navigate(mode='app'){await page.cdp('Page.navigate',{url:base+'/?ui-fixture='+mode});await wait(mode==='app'?"!!document.querySelector('.home-spotlight')":"!!document.querySelector('.auth-panel,.music-onboarding')");}
async function shot(name){await delay(150);const result=await page.cdp('Page.captureScreenshot',{format:'png'});await fs.writeFile(new URL(name+'.png',output),Buffer.from(result.data,'base64'));report.screenshots.push(name+'.png');}
async function check(name,fn){try{await fn();report.checks.push(name);console.log('PASS '+name);}catch(e){report.failures.push({name,error:e.message});console.error('FAIL '+name+': '+e.message);await shot('failure-'+report.failures.length);await navigate();}}
async function layout(){const result=await evaluate(`(()=>{const visible=e=>e.getClientRects().length&&!e.closest('[hidden]');return {broken:[...document.images].filter(e=>visible(e)&&e.complete&&!e.naturalWidth).map(e=>e.getAttribute('src')),overflow:[...document.querySelectorAll('.screen,.modal-sheet,.app-viewport')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)};})()`);assert(!result.broken.length,'Broken images '+result.broken.join(','));assert(!result.overflow.length,'Horizontal overflow '+result.overflow.join(','));}
page.on('Runtime.exceptionThrown',e=>report.errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
page.on('Fetch.requestPaused',async e=>{
 if(new URL(e.request.url).origin===base)await page.cdp('Fetch.continueRequest',{requestId:e.requestId});
 else if(new URL(e.request.url).hostname==='cine-art-fixture.invalid'){const index=Number(e.request.url.match(/genre-(\d)/)?.[1]||0);const body=await evaluate(`window.__cineUi.covers[${index}].split(',')[1]`);await page.cdp('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'content-type',value:'image/jpeg'}],body});}
 else await page.cdp('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:503,body:''});
});
await page.cdp('Runtime.enable');await page.cdp('Page.enable');await page.cdp('Fetch.enable',{patterns:[{urlPattern:'http://*'},{urlPattern:'https://*'}]});
await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(${installFixture.toString().replace("regionalNames.includes(query) ? [catalogRow(query, regionalId(query), 'ARTIST', 'https://cine-art-fixture.invalid/genre-' + regionalNames.indexOf(query) % 4 + '.jpg')]", "regionalNames.includes(query) ? [catalogRow(query, regionalId(query), 'ARTIST', 'https://cine-art-fixture.invalid/genre-' + regionalNames.indexOf(query) % 4 + '.jpg'),catalogRow('Quiet motion', 'MPRE_UI_ALBUM', 'ALBUM', covers[1]), catalogRow('Soft focus', 'MPRE_UI_SECOND', 'ALBUM', covers[2])]")})();`});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:402,height:874,deviceScaleFactor:1,mobile:true});
try {
 await navigate();
 for (const name of ['Dark blue','Dark green','Smoke white','Dark']) {
  await click('.theme-edition'); await textClick(name); await layout(); await shot('new-home-'+name.replaceAll(' ','-'));
 }
 await check('Playlist filter and import entry work',async()=>{
  await textClick('Playlists'); assert(!await evaluate("!!document.querySelector('.home-spotlight')"),'Spotlight remained in playlists filter');
  await textClick('Import'); await wait("document.body.innerText.includes('Import playlist')"); await back();
 });
 await textClick('For you');
 await check('Refresh returns a rendered release feed',async()=>{await click('.home-refresh');await wait("!!document.querySelector('.home-spotlight') && !document.querySelector('.home-refresh').disabled");await layout();});
 await shot('new-home-refreshed');
 console.log(JSON.stringify(report,null,2));
 if(report.failures.length || report.errors.length) process.exitCode=1;
} catch(e) { console.log(await evaluate("document.body.innerText")); await shot("home-debug"); throw e; } finally { page.close(); await browser.cdp('Target.disposeBrowserContext',{browserContextId});browser.close(); }

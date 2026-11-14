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
 await check('Autocomplete completes a partial query and preserves recent history',async()=>{
  await click('.tab-bar button:nth-child(2)');await input('.browse-search input','Quiet');
  await wait("!!document.querySelector('.search-suggestion')");
  const queryHistory=await evaluate("window.__cineUi.library().history.length");
  await click('.search-suggestion>button:first-child');
  await wait("!!document.querySelector('.browse-search .song-row')&&!document.querySelector('.search-suggestions')");
  assert(await evaluate("document.querySelector('.browse-search input').value.toLowerCase().includes('quiet')"),'Suggestion did not submit');
  assert(await evaluate("window.__cineUi.library().history.length")>=queryHistory,'Search history lost');
  await click('.browse-search .search-field button[aria-label^="Clear"]');
 });
 await check('Search input accepts text, stays visible during scroll, submits typed results',async()=>{
  await click('.tab-bar button:nth-child(2)');
  await input('.browse-search input','Quiet motion');
  await wait("document.querySelectorAll('.browse-search .song-row').length>0");
  await evaluate("document.querySelector('.browse-search').scrollTop=600");
  const geometry=await evaluate("(()=>{const e=document.querySelector('.browse-search input'),r=e.getBoundingClientRect();return {value:e.value,y:r.y,h:r.height}})()");
  assert(geometry.value==='Quiet motion'&&geometry.y>=0&&geometry.h>=40,'Search input lost state or moved out of view');
  assert(await evaluate("getComputedStyle(document.querySelector('.browse-search-input')).backgroundColor==='rgba(0, 0, 0, 0)'"),'Search sticky wrapper paints a rectangular box');
  await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("document.querySelector('.browse-search input').focus()");
  await page.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  assert(await evaluate("getComputedStyle(document.querySelector('.browse-search input')).outlineStyle==='none'"),'TV focus rectangle leaked onto the phone search input');
  await shot('audit-search');await layout();
  await click('.browse-search .search-field button[aria-label^="Clear"]');
  await wait("!!document.querySelector('.search-radios .shelf-item')");
 });
 await check('Song radio loads related tracks and starts a real queue',async()=>{
  await click('.search-radios .shelf-item');
  await wait("!!document.querySelector('.song-radio .primary-button')");
  await layout();await shot('audit-song-radio');
  await click('.song-radio .primary-button');
  assert(await evaluate("window.__cineUi.plays.at(-1)?.queue?.length>1"),'Radio did not start a related playback queue');
 });
 await check('Library and saved destinations open without crashes',async()=>{
  await click('.tab-bar button:last-child'); await layout();await shot('audit-library');
  const buttons=await evaluate("[...document.querySelectorAll('.browse-destination')].map(e=>e.textContent)");
  assert(buttons.length>=5,'Library destinations missing');
  await click('.browse-destination');await layout();await shot('audit-favorites');await back();
  await click('.browse-download-destination');await textClick('Resume all');
  assert(await evaluate("JSON.parse(window.CineAndroid.downloadJobs()).every(job=>!['paused','failed'].includes(job.status))"),'Resume all left paused/failed jobs behind');
  await back();
 });
 await check('Player opens lyrics, scrolls current line, respects manual browsing, and returns',async()=>{
  await click('.mini-open');await wait("!!document.querySelector('.player-control-card')");
  await click('.player-lyrics-button');
  await wait("!!document.querySelector('.lyrics-lines')");
  await delay(500);
  const lyricsGeometry=await evaluate("(()=>{const root=document.querySelector('.lyrics-lines'),selected=root.querySelector('.lyric-current'),footer=document.querySelector('.lyrics-transport');return {hasCurrent:!!selected,scroll:root.scrollTop,footer:footer.getBoundingClientRect().bottom,height:innerHeight}})()");
  assert(lyricsGeometry.hasCurrent,'Current lyric line is missing');
  assert(lyricsGeometry.footer<=lyricsGeometry.height+1,'Lyrics transport is clipped below the viewport');
  await evaluate("document.querySelector('.lyrics-lines').dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:80}))");
  await wait("!!document.querySelector('.follow-lyrics')");await click('.follow-lyrics');
  await evaluate("window.CineAndroid.control('seek',50000)");await delay(400);
  assert(await evaluate("document.querySelector('.lyric-current')?.textContent.includes('further')"),'Lyric highlighting did not follow actual seeking');
  await layout();await shot('audit-lyrics');
  await click('[aria-label="Back to player"]');
  assert(await evaluate("document.querySelector('.player-swipe-page').getAttribute('aria-hidden')==='false'"),'Lyrics did not close');
  await click('[aria-label="Collapse player"]');
 });
 await check('All four themes preserve the player and avoid overflow',async()=>{
  await click('.mini-open');
  for(let i=0;i<4;i++){
   await click('.player-scrim .theme-edition');
   await evaluate(`document.querySelectorAll('.theme-picker button')[${i}].click()`);await delay(80);await layout();
   const stateCheck=await evaluate("(()=>{const heart=document.querySelector('.player-scrim .track-heading [data-control=heart]'),repeat=document.querySelector('.player-scrim .transport [data-control^=repeat]');return [heart,repeat].every(e=>!!e&&e.hasAttribute('aria-pressed'));})()");
   assert(stateCheck,'Playback state semantics missing');
   for(const kind of ['heart','repeat']){
    const selector=kind==='heart'?'.player-scrim .track-heading [data-control=heart]':'.player-scrim .transport [data-control^=repeat]';
    const result=await evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(e.getAttribute('aria-pressed')==='true'){e.click();await new Promise(r=>setTimeout(r,30));if(e.dataset.control==='repeat_one'){e.click();await new Promise(r=>setTimeout(r,30));}}const off=getComputedStyle(e).backgroundColor;e.click();await new Promise(r=>setTimeout(r,70));return {off,on:getComputedStyle(e).backgroundColor,pressed:e.getAttribute('aria-pressed')};})()`);
    assert(result.pressed==='true'&&result.off!==result.on,'Selected '+kind+' is not distinguishable in theme '+i);
   }
   await shot('audit-selected-controls-theme-'+i);
  }
  await shot('audit-player');await click('[aria-label="Collapse player"]');
 });
 await check('Profile, settings, appearance, playback, storage, privacy, notifications and help routes render',async()=>{
  await click('[aria-label="Open profile"]');await layout();await shot('audit-profile');
  await textClick('Settings');await layout();await shot('audit-settings');
  for(const title of ['Theme','Audio & playback','Storage','Notifications','Privacy & account','Help & about']){
   await textClick(title);await delay(120);await layout();await back();
  }
  await back();await back();
 });
 await check('Narrow phone layout retains navigation and controls',async()=>{
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
  await delay(120);await layout();await shot('audit-narrow');
 });
}finally{
 await fs.writeFile(new URL('audit-report.json',output),JSON.stringify(report,null,2));
 page.close();await browser.cdp('Target.disposeBrowserContext',{browserContextId});browser.close();
}
console.log(JSON.stringify(report,null,2));
if(report.failures.length||report.errors.length)process.exitCode=1;

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
async function navigate(mode='app'){await page.cdp('Page.navigate',{url:base+'/?ui-fixture='+mode});await wait(mode==='app'?"!!document.querySelector('.discovery-feature')":"!!document.querySelector('.auth-panel,.music-onboarding')");}
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
await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(${installFixture.toString()})();`});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:402,height:874,deviceScaleFactor:1,mobile:true});
try{
 await check('Verification distinguishes a failed email request from accepted delivery request',async()=>{
  await navigate('unverified');await wait("!!document.querySelector('[data-auth-view=verify]')");
  assert(!await evaluate("document.body.innerText.includes('link sent to')"),'Premature email success claim');
  await evaluate('window.__cineUi.authSuccess=false');await textClick('Send verification link');await wait("!!document.querySelector('[role=alert]')");
  assert(await evaluate("document.activeElement.getAttribute('role')==='alert'"),'Error did not receive focus');
  await evaluate('window.__cineUi.authSuccess=true');await textClick('Send verification link');await wait("document.body.innerText.includes('Resend in')");await shot('verification');
 });
 await check('Country artists genres onboarding reaches the real app state',async()=>{
  await navigate('no-region');await wait("!!document.querySelector('[data-onboarding-step=\"0\"]')");
  await input('[aria-label="Search countries and regions"]','Kenya');await click('input[name="music-country"][value="KE"]');await textClick('Continue');
  await wait("!!document.querySelector('[data-onboarding-step=\"1\"]')");await shot('onboarding-artists');await textClick('Continue');
  await wait("!!document.querySelector('[data-onboarding-step=\"2\"]')");await textClick('Afrobeats');await shot('onboarding-genres');await textClick('Start listening');await wait("!!document.querySelector('.discovery-feature')");
 });
 for(const theme of ['default','green','light','dark'])await check('Four-theme review: '+theme,async()=>{
  await navigate();await evaluate(`localStorage.setItem('cine:cine-theme-v2',JSON.stringify(${JSON.stringify(theme)}))`);await navigate();
  await layout();await shot(theme+'-home');
  for(const [label,selector] of [['Search','.browse-search'],['Explore','.design-explore'],['Library','.browse-library']]){await textClick(label);await wait(`!!document.querySelector(${JSON.stringify(selector)})`);await delay(200);await layout();if(label==='Library')assert(await evaluate("[...document.querySelectorAll('.browse-destination-icon')].every(e=>getComputedStyle(e).color!==getComputedStyle(e).backgroundColor)"),'Library icons disappear into their background');await shot(theme+'-'+label.toLowerCase());}
  await click('.mini-open');await wait("!!document.querySelector('.full-player-body')");await layout();await shot(theme+'-player');await click('[aria-label="Open queue"]');await shot(theme+'-queue');await back();await click('.lyric-preview');await shot(theme+'-lyrics');await back();await back();
  await click('[aria-label="Open profile"]');await layout();await shot(theme+'-profile');await textClick('Settings');await shot(theme+'-settings');await textClick('Theme');await layout();await shot(theme+'-appearance');
 });
 await check('Creating a playlist from a song retains it and its selected cover after reload',async()=>{
  await navigate();await click('[aria-label="Options for Night drive"]');await textClick('Add to playlist');await textClick('Create playlist');
  await wait("!!document.querySelector('.browse-playlist-form')");assert(await evaluate("!!document.querySelector('.playlist-draft-row')"),'Selected song was dropped');
  await click('[aria-label="Use solstice artwork"]');await input('#browse-playlist-name','Review playlist');await shot('create-playlist');await textClick('Create playlist');
  await wait("!!document.querySelector('.browse-playlist h1')&&document.querySelector('.browse-playlist h1').textContent==='Playlist'");
  const saved=await evaluate("JSON.parse(localStorage.getItem('cine:library-v3:user:ui-verified-user')).playlists.find(p=>p.name==='Review playlist')");assert(saved?.songs[0]?.title==='Night drive','Song missing from saved playlist');assert(saved?.cover==='/figma/05df4.png','Artwork missing from saved playlist');
  await navigate();await textClick('Library');await textClick('Review playlist');await shot('playlist');
 });
 await check('Playlist draft reorder can be discarded and saved without changing playback',async()=>{
  await navigate();await textClick('Library');await textClick('After hours');await textClick('Edit details');await wait("!!document.querySelector('.playlist-draft-songs')");
  const before=await evaluate("JSON.parse(localStorage.getItem('cine:library-v3:user:ui-verified-user')).playlists.find(p=>p.id==='ui-owned').songs.map(s=>s.id)");
  await click('[aria-label="Move Night drive down"]');await shot('edit-playlist');await textClick('Cancel');await textClick('Discard changes');
  assert(JSON.stringify(await evaluate("JSON.parse(localStorage.getItem('cine:library-v3:user:ui-verified-user')).playlists.find(p=>p.id==='ui-owned').songs.map(s=>s.id)"))===JSON.stringify(before),'Cancel saved the reorder');
  await textClick('Edit details');await click('[aria-label="Move Night drive down"]');await textClick('Save changes');
  assert(await evaluate("JSON.parse(localStorage.getItem('cine:library-v3:user:ui-verified-user')).playlists.find(p=>p.id==='ui-owned').songs[1].title==='Night drive'"),'Save did not commit reorder');assert(await evaluate('window.__cineUi.plays.length===0'),'Editing changed playback');
 });
 await check('Profile save persists and unsaved changes can be discarded',async()=>{
  await navigate();await click('[aria-label="Open profile"]');await textClick('Edit profile');await input('input[name="name"]','Review listener');await textClick('Save changes');await wait("document.body.innerText.includes('Profile saved.')");
  assert(await evaluate("window.__cineUi.library().profile.name==='Review listener'"),'Profile name was not saved');
  await input('input[name="name"]','Unsaved name');await back();await textClick('Discard');await navigate();await click('[aria-label="Open profile"]');
  assert(await evaluate("document.querySelector('.design-profile-hero h1').textContent==='Review listener'"),'Discard changed saved profile');await shot('profile-saved');
 });
 await check('Search handles results, empty state, failure and retry',async()=>{
  await navigate();await textClick('Search');await input('[aria-label="Search music"]','fixture results');await evaluate("document.querySelector('.browse-search form').requestSubmit()");await wait("!!document.querySelector('.browse-results')");await shot('search-results');
  await input('[aria-label="Search music"]','fixture nothing');await evaluate("document.querySelector('.browse-search form').requestSubmit()");await wait("document.body.innerText.includes('No results for')");await shot('search-empty');
  await evaluate('window.__cineUi.failSearch=true');await input('[aria-label="Search music"]','fixture retry');await evaluate("document.querySelector('.browse-search form').requestSubmit()");await wait("document.body.innerText.includes('Search could not connect')");await shot('search-error');
  await evaluate('window.__cineUi.failSearch=false');await textClick('Try again');await wait("!!document.querySelector('.browse-results')");
 });
 await check('Download jobs pause, resume and cancel through the bridge',async()=>{
  await navigate();await textClick('Library');await textClick('Downloaded music');await wait("!!document.querySelector('.browse-download-job')");await click('[aria-label="Pause download of Soft focus"]');
  assert(await evaluate("[...document.querySelectorAll('.browse-download-job')].find(e=>e.innerText.includes('Soft focus')).innerText.includes('Paused')"),'Download did not pause');
  await evaluate("[...document.querySelectorAll('.browse-download-job')].find(e=>e.innerText.includes('Soft focus')).querySelector('.text-button').click()");await wait("!!document.querySelector('[aria-label=\"Pause download of Soft focus\"]')");
  await click('[aria-label="Cancel download of Soft focus"]');assert(!await evaluate("!!document.querySelector('[aria-label=\"Cancel download of Soft focus\"]')"),'Cancelled job remains');await layout();await shot('downloads');
 });
 await check('Player seek, play, pause and queue removal update service state',async()=>{
  await navigate();await click('.mini-open');await click('.large-play');await wait("document.querySelector('.large-play').getAttribute('aria-label')==='Pause'");await input('[aria-label="Seek position"]','60000');
  assert(await evaluate("JSON.parse(window.CineAndroid.snapshot()).positionMs===60000"),'Seek did not reach native bridge');await click('.large-play');
  assert(await evaluate("JSON.parse(window.CineAndroid.snapshot()).status==='paused'"),'Pause did not reach native bridge');
  await click('[aria-label="Open queue"]');await textClick('Edit');await click('[aria-label="Remove Quiet motion from queue"]');
  assert(await evaluate("!JSON.parse(window.CineAndroid.snapshot()).queue.some(s=>s.title==='Quiet motion')"),'Queue removal did not reach native bridge');await shot('queue-edited');
 });
 for(const width of [320,360,720])await check('Responsive layout '+width,async()=>{await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:874,deviceScaleFactor:1,mobile:true});await navigate();await layout();await textClick('Library');await layout();await shot('library-'+width);});
}finally{
 await fs.writeFile(new URL('report.json',output),JSON.stringify(report,null,2));
 await browser.cdp('Target.disposeBrowserContext',{browserContextId});page.close();browser.close();
}
console.log(JSON.stringify({passed:report.checks.length,failed:report.failures.length,errors:report.errors.length}));
if(report.failures.length||report.errors.length)process.exitCode=1;

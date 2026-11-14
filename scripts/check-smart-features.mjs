import fs from 'node:fs/promises';
import { installFixture } from './ui-fixture.mjs';

// Real rendered app, isolated localhost fixture data; no real users or audio.
const base = 'http://127.0.0.1:5178';
const output = new URL('../.device-test/smart-review/', import.meta.url);
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
 await check('Daily Mix saves real recommendation IDs as a private playlist',async()=>{
  await click('.daily-mix-open');await wait("!!document.querySelector('.browse-playlist h1')");
  const mix=await evaluate("window.__cineUi.library().playlists.find(p=>p.id.startsWith('daily-mix-'))");
  assert(mix?.songs.length>0&&!mix.isPublic,'Daily Mix did not save private recommendations');
  await shot('daily-mix');await back();
 });
 await check('Bulk selection sorts songs and creates a playlist',async()=>{
  await click('.tab-bar button:nth-child(4)');await textClick('Your playlists');
  await textClick('After hours');await textClick('Select songs');await textClick('Select all');
  assert(await evaluate("[...document.querySelectorAll('.selection-song input')].every(e=>e.checked)"),'Select all missed songs');
  await textClick('Add to playlist');await input('.bulk-playlist-options input','Bulk selection check');
  await evaluate("document.querySelector('.bulk-playlist-options form').requestSubmit()");await delay(100);
  assert(await evaluate("window.__cineUi.library().playlists.some(p=>p.name==='Bulk selection check'&&p.songs.length===4)"),'Bulk playlist lost songs');
  await shot('bulk-library');await back();await back();
 });
 await check('Pause all, Resume all, and download priority change native queue state',async()=>{
  await textClick('Downloaded music');await textClick('Pause all');
  assert(await evaluate("JSON.parse(window.CineAndroid.downloadJobs()).every(j=>!['queued','downloading'].includes(j.status))"),'Pause all left active transfers');
  await textClick('Resume all');assert(await evaluate("JSON.parse(window.CineAndroid.downloadJobs()).every(j=>j.status==='queued')"),'Resume all missed a job');
  const id=await evaluate("JSON.parse(window.CineAndroid.downloadJobs())[0].id");
  await textClick('Download next');assert(await evaluate("JSON.parse(window.CineAndroid.downloadJobs())[0].id")===id,'Queue priority failed');
  await shot('bulk-downloads');await back();
 });
 await check('Hide and Restore tune recommendations without deleting Favorites',async()=>{
  const count=await evaluate("window.__cineUi.library().favorites.length");
  await click('.mini-open');await click('[aria-label="Player options"]');await textClick('Hide song from recommendations');
  assert(await evaluate("JSON.parse(localStorage.getItem('cine:smart-music:ui-verified-user')).hidden.songs.length===1"),'Hidden song was not saved');
  await click('[aria-label="Collapse player"]');await click('[aria-label="Open profile"]');await textClick('Settings');await textClick('Hidden music');
  await textClick('Restore');
  assert(await evaluate("JSON.parse(localStorage.getItem('cine:smart-music:ui-verified-user')).hidden.songs.length===0"),'Restore failed');
  assert(await evaluate("window.__cineUi.library().favorites.length")===count,'Hide changed Favorites');
  await back();await textClick('Home-screen widget');assert(await evaluate("window.__cineUi.widgetRequested"),'Widget pin request did not reach Android');
  await back();await back();
 });
 await check('Lyric timing persists and timed-line seeking includes the offset',async()=>{
  await click('.mini-open');await click('[aria-label="Open lyrics"]');await wait("!!document.querySelector('.lyrics-timing')");
  await click('[aria-label="Show lyrics 250 milliseconds later"]');
  assert(await evaluate("document.querySelector('.lyrics-timing').textContent.includes('+0.25s')"),'Timing label not updated');
  const id=await evaluate("JSON.parse(window.CineAndroid.snapshot()).track.id");
  assert(await evaluate(`JSON.parse(localStorage.getItem('cine:lyric-offset:'+${JSON.stringify(id)}))`)===250,'Timing not persisted');
  await click('.lyric-line');
  assert(await evaluate("JSON.parse(window.CineAndroid.snapshot()).positionMs")===250,'Lyric seek ignored offset');
  await shot('timed-lyrics');await click('[aria-label="Back to player"]');await click('[aria-label="Collapse player"]');
 });
 await check('Resume listening restores saved queue, context and position',async()=>{
  await evaluate("(()=>{const p=JSON.parse(window.CineAndroid.snapshot());localStorage.setItem('cine:smart-music:ui-verified-user',JSON.stringify({hidden:{songs:[],artists:[]},checkpoint:{song:p.track,queue:p.queue,context:'Resume check',positionMs:12345,savedAt:Date.now()}}))})()");
  await navigate();await evaluate("window.CineAndroid.control('stop',0)");await wait("!!document.querySelector('.home-resume')");
  await click('.home-resume');
  assert(await evaluate("window.__cineUi.plays.at(-1).startPositionMs")===12345,'Resume position did not reach native player');
 });

 await check('Bulk playlist downloads remain responsive and progress avoids synchronous storage reads',async()=>{
  await click('.tab-bar button:nth-child(4)');await textClick('Your playlists');await textClick('After hours');
  await evaluate("(()=>{const read=window.CineAndroid.downloads;window.__cineUi.storageReads=0;window.CineAndroid.downloads=()=>{window.__cineUi.storageReads++;return read()}})()");
  await click('[aria-label="Download songs from After hours"]');await textClick('Download 2');
  await wait("window.__cineUi.batchCalls?.length>0");
  assert(await evaluate("window.__cineUi.batchCalls.every(n=>n<=20)"),'Bulk download did not use bounded batches');
  const before=await evaluate("window.__cineUi.storageReads");
  await evaluate("(()=>{const jobs=JSON.parse(window.CineAndroid.downloadJobs());for(let i=0;i<100;i++){const job=jobs[i%jobs.length];window.__cineChunk('progress-'+i,JSON.stringify({type:'downloadProgress',data:{...job,status:'downloading',progress:i%100}}),true)}})()");
  await delay(250);
  assert(await evaluate("window.__cineUi.storageReads")===before,'Progress scanned saved-download files');
  await back();await back();await click('.tab-bar button:nth-child(2)');
  assert(await evaluate("document.querySelector('.browse-search input').getClientRects().length>0"),'Download progress froze navigation');
 });

 await check('Liked Songs and Albums expose Sort by and reorder actual rows',async()=>{
  await click('.tab-bar button:nth-child(4)');await textClick('Liked Songs');
  await wait("!!document.querySelector('.browse-collection-favorites .sort-trigger')");
  await click('.browse-collection-favorites .sort-trigger');await click('.sort-options [data-sort=az]');
  const titles=await evaluate("[...document.querySelectorAll('.browse-collection-favorites .song-main strong')].map(e=>e.textContent)");
  assert(JSON.stringify(titles)===JSON.stringify([...titles].sort((a,b)=>a.localeCompare(b))),'Liked Songs did not sort by title');
  await back();await textClick('Saved albums');
  await click('.browse-collection-albums .sort-trigger');assert(await evaluate("!!document.querySelector('.sort-options [data-sort=artist]')"),'Albums artist sorting missing');
  await shot('themed-sort-sheet');await click('.sort-options [data-sort=artist]');
  await layout();await shot('album-sort');await back();
 });
 await check('Genre art is bundled and long top-result titles remain inside their card',async()=>{
  await click('.tab-bar button:nth-child(2)');await wait("document.querySelectorAll('.browse-genre img').length===4");
  assert(await evaluate("[...document.querySelectorAll('.browse-genre img')].every(img=>new URL(img.src).origin===location.origin)"),'Genre art waits for a remote source');
  assert(await evaluate("getComputedStyle(document.querySelector('.browse-genres')).gridTemplateColumns.split(' ').length===2"),'Genre grid lost its two-column composition');
  assert(await evaluate("(()=>{const card=document.querySelector('.browse-genre').getBoundingClientRect(), art=document.querySelector('.browse-genre img').getBoundingClientRect();return Math.abs(card.width-art.width)<2&&Math.abs(card.height-art.height)<2})()"),'Genre artwork does not fill its tile');
  await evaluate("document.querySelector('.browse-genres').scrollIntoView({block:'center'})");await shot('instant-genres');
  await evaluate("document.querySelector('.browse-search').scrollTop=0");
  await evaluate("window.__cineUi.songs[0].title='Very long song title with an unbroken word '+ 'LongTitle'.repeat(30)");
  await input('.browse-search input','Very long song title');await wait("!!document.querySelector('.browse-top-result .row-copy strong')");
  const valid=await evaluate("(()=>{const card=document.querySelector('.browse-top-result').getBoundingClientRect();return [...document.querySelectorAll('.browse-top-result .row-copy,.browse-top-result .icon-action')].every(e=>{const r=e.getBoundingClientRect();return r.left>=card.left&&r.right<=card.right+1})})()");
  assert(valid,'Top result content exceeded its card');await shot('long-top-result');await layout();
 });
 await check('Four mini-player controls retain separate 48dp targets on narrow screens in every theme',async()=>{
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
  for(let i=0;i<4;i++){
   await click('.app-header .theme-edition');await click('.theme-picker>button:nth-child('+(i+1)+')');
   assert(await evaluate("(()=>{const p=document.querySelector('.mini-player').getBoundingClientRect(),controls=[...document.querySelectorAll('.mini-controls button')];return controls.length===4&&controls.every(e=>{const r=e.getBoundingClientRect();return r.width>=48&&r.height>=48&&r.bottom<=p.bottom&&r.right<=p.right})})()"),'Mini-player targets clipped in theme '+i);
   await layout();
  }
  await shot('narrow-mini-player');
 });
} finally {
 await fs.writeFile(new URL('audit-report.json',output),JSON.stringify(report,null,2));
 page.close();await browser.cdp('Target.disposeBrowserContext',{browserContextId});browser.close();
}
console.log(JSON.stringify(report,null,2));
if(report.failures.length||report.errors.length)process.exitCode=1;

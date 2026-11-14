import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const serial = process.env.CINE_DEVICE || 'R58M34PT7SN';
const endpoint = process.env.CINE_DEVICE_CDP || 'http://127.0.0.1:9229';
const adb = async (...args) => (await execute('adb', ['-s', serial, ...args], { timeout: 20_000 })).stdout;
if (!process.argv.includes('--inspect-auth')) await adb('shell', 'am', 'start', '-W', '-n', 'com.heisbaed.cinemusic/.MainActivity');
const pid = (await adb('shell', 'pidof', 'com.heisbaed.cinemusic')).trim().split(/\s+/)[0];
if (!pid) throw new Error('Launch Cine music before the phone UI check.');
await adb('forward', 'tcp:' + new URL(endpoint).port, 'localabstract:webview_devtools_remote_' + pid);
let pages = [];
for (let attempt = 0; attempt < 10; attempt++) {
  try { pages = await (await fetch(endpoint + '/json/list')).json(); if (pages.length) break; } catch { /* The debug socket appears after WebView startup. */ }
  await new Promise(resolve => setTimeout(resolve, 200));
}
const page = pages.find(page => page.url.startsWith('https://appassets.androidplatform.net'));
if (!page) throw new Error('The debug Cine music WebView is not available.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map();
const report = { checks: [], failures: [], screenshots: [], uncaughtErrors: [], googleUserSignedIn: false };
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) { const request = pending.get(message.id); if (!request) return; clearTimeout(request.timer); pending.delete(message.id); message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result); }
  else if (message.method === 'Runtime.exceptionThrown') report.uncaughtErrors.push(message.params.exceptionDetails.text);
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timed out: ' + method)); }, 15_000); pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params })); });
async function evaluate(expression) { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
async function wait(expression, timeout = 8000) { const until = Date.now() + timeout; while (Date.now() < until) { if (await evaluate(expression)) return true; await new Promise(resolve => setTimeout(resolve, 80)); } throw new Error('Timed out: ' + expression); }
async function check(name, run) { try { const detail = await run(); report.checks.push({ name, ...(detail ? { detail } : {}) }); } catch (error) { report.failures.push({ name, error: error.message }); } }
async function capture(name) { const image = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(new URL('../.device-test/' + name + '.png', import.meta.url), Buffer.from(image.data, 'base64')); report.screenshots.push(name + '.png'); }
const visible = selector => `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(el=>el.getClientRects().length)`;
async function click(selector) { const success = await evaluate(`(()=>{const el=${visible(selector)};if(!el)return false;el.click();return true})()`); if (!success) throw new Error('Control not visible: ' + selector); }
async function row(title) { const done = await evaluate(`(()=>{const row=Array.from(document.querySelectorAll('.account-row')).find(el=>el.getClientRects().length&&el.querySelector('strong')?.textContent===${JSON.stringify(title)});if(!row)return false;row.click();return true})()`); if (!done) throw new Error('Account row unavailable: ' + title); }
async function setInput(selector, value) { await evaluate(`(()=>{const el=${visible(selector)};if(!el)throw new Error('Input not visible');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`); }
async function resumedActivity() { const state = await adb('shell', 'dumpsys', 'activity', 'activities'); const line = state.split('\n').find(line => line.includes('mResumedActivity')); return line?.match(/([\w.]+\/[\w.$]+)/)?.[1] || ''; }
await cdp('Runtime.enable'); await cdp('Page.enable');

const result={query:'Umenipendelea Neema Gospel Choir'};
try {
 for(let i=0;i<8;i++){
  if(await evaluate("!!document.querySelector('.tab-bar')?.getClientRects().length && !document.querySelector('.route-layer:not([hidden])') && !document.querySelector('.player-scrim')"))break;
  await evaluate("window.dispatchEvent(new Event('cine:back',{cancelable:true}))");await new Promise(r=>setTimeout(r,120));
 }
 await click('.tab-bar button:nth-child(2)');await setInput('.browse-search input',result.query);
 await wait("[...document.querySelectorAll('.browse-search .song-main')].some(e=>/umenipendelea/i.test(e.querySelector('strong')?.textContent||'')&&/neema gospel/i.test(e.querySelector('small')?.textContent||''))",50000);
 result.rows=await evaluate("[...document.querySelectorAll('.browse-search .song-main')].slice(0,6).map(e=>({title:e.querySelector('strong')?.textContent,artist:e.querySelector('small')?.textContent}))");
 await capture('phone-neema-search');
 await evaluate("[...document.querySelectorAll('.browse-search .song-main')].find(e=>/umenipendelea/i.test(e.querySelector('strong')?.textContent||'')&&/neema gospel/i.test(e.querySelector('small')?.textContent||''))?.click()");
 await wait("['playing','error'].includes(JSON.parse(window.CineAndroid.snapshot()).status)",60000);
 result.playback=await evaluate("(()=>{const p=JSON.parse(window.CineAndroid.snapshot());return {status:p.status,id:p.track?.id,title:p.track?.title,artist:p.track?.artist,durationMs:p.durationMs,sourceResolvedMs:p.sourceResolvedMs,preparedMs:p.preparedMs,error:p.error}})()");
 await capture('phone-neema-playback');
 await writeFile(new URL('../.device-test/neema-live-verification.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 if(result.playback.id!=='eafzURCG1X0'||result.playback.status!=='playing')process.exitCode=1;
}finally{await evaluate("window.CineAndroid.control('pause',0)");socket.close();}

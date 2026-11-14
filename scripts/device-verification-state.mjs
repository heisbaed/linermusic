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

const {readFile}=await import('node:fs/promises');
const path=new URL('../.device-test/before-feature-verification.json',import.meta.url);
try {
 if(process.argv.includes('--backup')){
  const saved=await evaluate(`(()=>{const preferences=localStorage.getItem('cine:preferences-v3');const player=JSON.parse(window.CineAndroid.snapshot());localStorage.setItem('cine:preferences-v3',JSON.stringify({...JSON.parse(preferences||'{}'),privateListening:true}));return {preferences,player}})()`);
  await writeFile(path,JSON.stringify(saved));console.log(JSON.stringify({saved:true,status:saved.player.status}));
 }else if(process.argv.includes('--restore')){
  const saved=JSON.parse(await readFile(path,'utf8'));
  await evaluate(`(()=>{const saved=${JSON.stringify(saved)};if(saved.preferences===null)localStorage.removeItem('cine:preferences-v3');else localStorage.setItem('cine:preferences-v3',saved.preferences);if(saved.player.track){const prefs=JSON.parse(saved.preferences||'{}');window.CineAndroid.play(JSON.stringify({...saved.player.track,queue:saved.player.queue,shuffle:saved.player.shuffle,repeat:saved.player.repeat,quality:prefs.audioQuality||'auto',gapless:prefs.gapless??true,crossfadeSeconds:prefs.crossfadeSeconds||0,startPositionMs:saved.player.positionMs}));if(saved.player.status!=='playing')window.CineAndroid.control('pause',0);}location.reload();})()`);
  console.log('Restored playback context and listening preferences.');
 }
}finally{socket.close();}

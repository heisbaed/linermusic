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
if (process.argv.includes('--inspect-auth')) {
  const state = await evaluate(`(()=>{const panel=Array.from(document.querySelectorAll('.account-auth')).find(el=>el.getClientRects().length);return{view:panel?.dataset.authView||null,busy:panel?.getAttribute('aria-busy'),googleDisabled:panel?.querySelector('.google-signin')?.disabled,error:panel?.querySelector('.account-error')?.textContent?.replace(/[\\w.+-]+@[\\w.-]+/g,'[redacted]')||'',notice:panel?.querySelector('.account-notice')?.textContent?.replace(/[\\w.+-]+@[\\w.-]+/g,'[redacted]')||'',focused:document.hasFocus()}})()`);
  console.log(JSON.stringify({ ...state, foregroundActivity: await resumedActivity(), cineWebViews: pages.filter(page => page.url.startsWith('https://appassets.androidplatform.net')).length }, null, 2)); socket.close(); process.exit(0);
}
if (process.argv.includes('--inspect-player')) {
  const state = await evaluate(`(()=>{const p=JSON.parse(window.CineAndroid.snapshot());let signedIn=false;try{const user=JSON.parse(window.CineAndroid.authTokens());signedIn=Boolean(user?.localId&&user?.idToken)}catch{}return{status:p.status,trackId:p.track?.id||null,error:String(p.error||'').replace(/https?:\\/\\/\\S+/g,'[media source URL]').replace(/[\\w.+-]+@[\\w.-]+/g,'[redacted]'),cineAccountSignedIn:signedIn}})()`);
  console.log(JSON.stringify(state, null, 2)); socket.close(); process.exit(0);
}
try {
  await wait('Boolean(document.querySelector(".cine-app"))');
  if (!process.argv.includes('--google-only')) {
  await check('Instrumentation fixture data is removed without clearing app data', async () => {
    const removed = await evaluate(`(()=>{const ids=new Set(['vault-play-one','vault-play-two','vault-roundtrip','vault-tamper','vault-interrupted','vault-job-check','vault-cancel-commit']);let removed=0;const clean=songs=>Array.isArray(songs)?songs.filter(song=>{if(ids.has(song?.id)){removed++;return false}return true}):songs;for(const key of Object.keys(localStorage)){if(key.startsWith('cine:library-v3:')){try{const data=JSON.parse(localStorage.getItem(key));data.favorites=clean(data.favorites);data.recent=clean(data.recent);if(Array.isArray(data.playlists))data.playlists=data.playlists.map(list=>({...list,songs:clean(list.songs)}));localStorage.setItem(key,JSON.stringify(data))}catch{}}else if(['cine:queue','cine:recent','cine:favorites'].includes(key)){try{localStorage.setItem(key,JSON.stringify(clean(JSON.parse(localStorage.getItem(key)))))}catch{}}}return removed})()`);
    if (removed) { await cdp('Page.reload', { ignoreCache: true }); await wait('Boolean(document.querySelector(".app-header"))'); }
    return { removedTestRows: removed, clearedUserData: false };
  });
  await check('Physical WebView layout and initial player visibility', async () => {
    const info = await evaluate(`(()=>{const app=document.querySelector('.cine-app');const state=JSON.parse(window.CineAndroid.snapshot());return{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,fontScaleApplied:document.querySelector('h1')&&getComputedStyle(document.querySelector('h1')).fontSize,horizontalOverflow:document.documentElement.scrollWidth>innerWidth,hasActiveTrack:Boolean(state.track),miniVisible:Boolean(document.querySelector('.mini-player')?.getClientRects().length)}})()`);
    if (info.horizontalOverflow || info.hasActiveTrack !== info.miniVisible) throw new Error('Initial player/viewport layout is inconsistent.');
    await capture('phone-home'); return info;
  });
  await check('Phone keyboard resizes Search and the query survives tab changes', async () => {
    await evaluate(`Array.from(document.querySelectorAll('.tab-bar button')).find(el=>el.textContent.includes('Search')).click()`);
    await wait(`Boolean(${visible('.search-field input')})`);
    const original = await evaluate(`${visible('.search-field input')}.value`);
    const before = await evaluate('innerHeight');
    const box = await evaluate(`(()=>{const el=${visible('.search-field input')};const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y }] });
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await wait(`innerHeight < ${before * .85}`);
    await cdp('Input.insertText', { text: 'layout check' });
    await wait('document.querySelector(".bottom-dock").hidden');
    await capture('phone-search-keyboard');
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await wait(`innerHeight >= ${before * .95}`);
    const query = await evaluate(`${visible('.search-field input')}.value`);
    await evaluate(`document.querySelector('.tab-bar button').click()`);
    await evaluate(`Array.from(document.querySelectorAll('.tab-bar button')).find(el=>el.textContent.includes('Search')).click()`);
    if (!await evaluate(`${visible('.search-field input')}.value===${JSON.stringify(query)}`)) throw new Error('Search query was discarded.');
    await setInput('.search-field input', original);
    return { keyboardResized: true, queryPreserved: true };
  });
  await check('Native Back protects unsaved profile input and dismisses only the top dialog', async () => {
    await click('.avatar-button'); await wait('Boolean(document.querySelector(".profile-identity"))');
    await click('.profile-edit-button'); await wait('Boolean(document.querySelector(".edit-profile-screen"))');
    await setInput('.profile-form input[name="name"]', 'Cine UI layout check');
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await wait('Boolean(document.querySelector(".confirmation-scrim"))');
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await wait('!document.querySelector(".confirmation-scrim")');
    if (!await evaluate(`${visible('.profile-form input[name="name"]')}.value==='Cine UI layout check'`)) throw new Error('Unsaved input was lost.');
    await click('.edit-profile-screen .page-header button'); await wait('Boolean(document.querySelector(".confirmation-scrim"))');
    await click('.confirmation-actions .danger-button'); await wait('!document.querySelector(".confirmation-scrim")');
    await wait(`Boolean(${visible('.profile-identity')})`);
  });
  await check('All four themes apply on the physical phone without changing the route', async () => {
    await row('Settings'); await wait(`Boolean(${visible('.account-settings')})`); await row('Theme');
    await wait(`Boolean(${visible('.appearance-options')})`);
    const original = await evaluate('document.querySelector(".cine-app").dataset.theme');
    const themes = ['default', 'dark', 'green', 'light'];
    for (let index = 0; index < themes.length; index++) {
      await evaluate(`document.querySelectorAll('.appearance-options input')[${index}].click()`);
      await wait(`document.querySelector('.cine-app').dataset.theme===${JSON.stringify(themes[index])}`);
      if (!await evaluate('document.querySelectorAll(".appearance-options input:checked").length===1')) throw new Error('More than one theme is selected.');
    }
    await capture('phone-appearance-light');
    await evaluate(`document.querySelectorAll('.appearance-options input')[${themes.indexOf(original)}].click()`);
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK'); await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  });
  }
  if (process.argv.includes('--skip-google')) report.googleProviderDeferred = true;
  else await check('Google provider opens on Android 12 and cancellation returns to a usable form', async () => {
    await evaluate(`(()=>{try{window.__cineGooglePreviousUser=JSON.parse(window.CineAndroid.authTokens()||'null')?.localId||null}catch{window.__cineGooglePreviousUser=null}window.dispatchEvent(new Event('cine:open-auth'))})()`);
    await wait(`Boolean(${visible('.google-signin')})`);
    if (!(await resumedActivity()).startsWith('com.heisbaed.cinemusic/')) throw new Error('Cine music is not the foreground app. Provider interaction was not attempted.');
    await click('.google-signin');
    let provider = '', error = false;
    const until = Date.now() + 12_000;
    while (Date.now() < until) {
      provider = await resumedActivity();
      error = await evaluate('Boolean(Array.from(document.querySelectorAll(".account-error")).find(el=>el.getClientRects().length))');
      if ((provider && !provider.startsWith('com.heisbaed.cinemusic/')) || error) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!provider || !provider.startsWith('com.google.android.gms/') || !/auth\.api\.identity|credential/i.test(provider)) {
      const message = await evaluate('Array.from(document.querySelectorAll(".account-error")).find(el=>el.getClientRects().length)?.textContent || "Provider did not open"');
      throw new Error(String(message).replace(/[\w.+-]+@[\w.-]+/g, '[redacted]'));
    }
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await wait(`Boolean(${visible('.google-signin')}) && !(${visible('.google-signin')}).disabled`);
    const cancelled = await evaluate('Array.from(document.querySelectorAll(".account-notice")).some(el=>el.getClientRects().length&&/cancelled/i.test(el.textContent))');
    await capture('phone-google-cancelled');
    if (!cancelled) throw new Error('Provider closed without the expected cancellation state.');
    const preserved = await evaluate(`(()=>{let id=null;try{id=JSON.parse(window.CineAndroid.authTokens()||'null')?.localId||null}catch{}const same=id===window.__cineGooglePreviousUser;delete window.__cineGooglePreviousUser;return same})()`);
    if (!preserved) throw new Error('Cancelling Google sign-in changed the existing Cine session.');
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    return { providerActivity: provider, accountSelected: false, cancelled: true, existingSessionPreserved: true };
  });
} finally {
  socket.close();
  await writeFile(new URL('../.device-test/phone-ui-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
if (report.failures.length || report.uncaughtErrors.length) process.exitCode = 1;

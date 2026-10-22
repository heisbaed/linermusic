import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TEST ONLY: isolated localhost Chrome context, mocked verified auth/RTDB/catalog, no real accounts/audio/network.
const base = process.env.CINE_UI_URL || 'http://127.0.0.1:5178';
const debug = process.env.CINE_CDP_URL || 'http://127.0.0.1:9228';
const output = fileURLToPath(new URL('../.device-test/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const report = { fixtures: 'TEST ONLY: locally authored Innertube renderers and in-memory native bridge', base, checks: [], failures: [], uncaughtErrors: [], blockedExternalRequests: [], screenshots: [] };

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map(), listeners = new Map();
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id) {
      const request = pending.get(data.id); if (!request) return;
      pending.delete(data.id); clearTimeout(request.timer);
      data.error ? request.reject(new Error(JSON.stringify(data.error))) : request.resolve(data.result);
    } else for (const listener of listeners.get(data.method) || []) listener(data.params);
  };
  return {
    cdp(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; const timer = setTimeout(() => { pending.delete(next); reject(new Error(`CDP timed out: ${method}`)); }, 20_000); pending.set(next, { resolve, reject, timer }); socket.send(JSON.stringify({ id: next, method, params })); }); },
    on(method, listener) { listeners.set(method, [...listeners.get(method) || [], listener]); },
    close() { for (const request of pending.values()) clearTimeout(request.timer); socket.close(); },
  };
}

function installFixture() {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost):/.test(location.origin)) return;
  const art = (first, last, label) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 320;
    const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 280, 320);
    gradient.addColorStop(0, first); gradient.addColorStop(1, last); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 320, 320);
    ctx.strokeStyle = '#ffffff60'; ctx.lineWidth = 2;
    for (let index = 0; index < 10; index++) { ctx.beginPath(); ctx.ellipse(210, 88, 38 + index * 13, 150, .65, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#ffffffd9'; ctx.font = '500 13px sans-serif'; ctx.fillText('CINE / UI TEST FIXTURE', 22, 30); ctx.font = '500 30px sans-serif'; ctx.fillText(label, 22, 281);
    return canvas.toDataURL('image/jpeg', .7);
  };
  const covers = [art('#315360', '#152133', 'AFTER HOURS'), art('#896b4f', '#292238', 'QUIET MOTION'), art('#456d66', '#152d39', 'SOFT FOCUS'), art('#5b4287', '#171b32', 'SLOW CIRCLES')];
  const songs = ['Night drive', 'Quiet motion', 'Soft focus', 'Slow circles', 'Blue hour', 'Morning light'].map((title, index) => ({ id: `UITEST0000${index + 1}`, title, artist: index % 2 ? 'Mira West' : 'The Night Current', artistId: 'UC_UI_ARTIST', albumId: 'MPRE_UI_ALBUM', durationMs: 183_000 + index * 7_000, cover: covers[index % 4] }));
  const saved = { favorites: songs.slice(1, 3), recent: songs.slice(0, 3), playlists: [{ id: 'ui-owned', name: 'After hours', description: 'A private listening space. Test-only tracks, no audio.', cover: covers[0], songs: songs.slice(0, 4), isPublic: false }], artists: [{ id: 'UC_UI_ARTIST', name: 'The Night Current', cover: covers[0] }], albums: [{ id: 'MPRE_UI_ALBUM', title: 'Quiet motion', artist: 'Mira West', cover: covers[1] }, { id: 'MPRE_UI_SECOND', title: 'Soft focus', artist: 'The Night Current', cover: covers[2] }], history: [{ query: 'Quiet motion' }], profile: { name: 'Cine listener', username: 'test_listener' }, taste: { country: 'TZ', genres: ['afrobeats'], completed: true } };
  const user = (id = 'ui-verified-user', verified = true) => ({ localId: id, email: 'ui-test@example.invalid', displayName: 'Cine listener', idToken: 'fixture-token-' + id, refreshToken: 'fixture-refresh-' + id, expiresAt: Date.now() + 3_600_000, emailVerified: verified });
  const mode = new URL(location.href).searchParams.get('ui-fixture');
  if (mode === 'signed-out') sessionStorage.setItem('cine-ui-auth', 'null');
  else if (mode === 'no-region') sessionStorage.setItem('cine-ui-auth', JSON.stringify(user('ui-no-region-user')));
  else if (mode === 'app' || !sessionStorage.getItem('cine-ui-auth')) sessionStorage.setItem('cine-ui-auth', JSON.stringify(user()));
  else if (mode === 'unverified') sessionStorage.setItem('cine-ui-auth', JSON.stringify(user('ui-unverified-user', false)));
  if (!localStorage.getItem('cine:ui-fixture-seeded')) {
    localStorage.setItem('cine:library-v3:user:ui-verified-user', JSON.stringify(saved));
    const wire = { ...saved };
    for (const field of ['favorites', 'playlists', 'artists', 'albums']) wire[field] = Object.fromEntries(saved[field].map(item => [encodeURIComponent(item.id), item]));
    localStorage.setItem('cine:ui-cloud:ui-verified-user', JSON.stringify(wire));
    // Legacy keys are intentionally also present to catch accidental data resets.
    for (const key of ['favorites', 'recent', 'playlists']) localStorage.setItem('cine:' + key, JSON.stringify(saved[key]));
    localStorage.setItem('cine:cine-theme-v2', JSON.stringify('default'));
    localStorage.setItem('cine:lyrics:' + songs[0].id, JSON.stringify('[00:00.00]The city settles into quiet\n[00:12.00]We find a rhythm of our own\n[00:30.00]The light is changing slowly\n[00:50.00]A little further from the noise'));
    localStorage.setItem('cine:ui-fixture-seeded', 'true');
  }
  const thumb = url => ({ musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url, width: 320, height: 320 }] } } });
  const endpoint = (id, type) => ({ browseEndpoint: { browseId: id, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: `MUSIC_PAGE_TYPE_${type}` } } } });
  const run = (text, id, type) => ({ text, navigationEndpoint: endpoint(id, type) });
  const column = runs => ({ musicResponsiveListItemFlexColumnRenderer: { text: { runs } } });
  const track = song => ({ musicResponsiveListItemRenderer: { playlistItemData: { videoId: song.id }, flexColumns: [column([{ text: song.title }]), column([run(song.artist, song.artistId, 'ARTIST'), { text: ' · ' }, run('Quiet motion', song.albumId, 'ALBUM'), { text: ' · ' }, { text: '3:12' }])], thumbnail: thumb(song.cover) } });
  const catalogRow = (title, id, type, cover) => ({ musicResponsiveListItemRenderer: { navigationEndpoint: endpoint(id, type), flexColumns: [column([{ text: title }]), column(type === 'ALBUM' ? [run('Mira West', 'UC_UI_ARTIST', 'ARTIST'), { text: '2026' }] : [{ text: type === 'PLAYLIST' ? 'Cine editorial fixture' : 'Artist' }])], thumbnail: thumb(cover) } });
  const genreArtists = ['Burna Boy', 'SZA', 'Dua Lipa', 'Kendrick Lamar'];
  const regionalNames = ['The Night Current', 'Mira West', 'Aya Stone', 'Kito', 'Nia Coast', 'Juniper'];
  const regionalId = name => name === regionalNames[0] ? 'UC_UI_ARTIST' : 'UC_UI_REGIONAL_' + regionalNames.indexOf(name);
  const searchBody = query => ({ contents: { tabbedSearchResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ musicShelfRenderer: { contents: /fixture nothing/i.test(query) ? [] : regionalNames.includes(query) ? [catalogRow(query, regionalId(query), 'ARTIST', 'https://cine-art-fixture.invalid/genre-' + regionalNames.indexOf(query) % 4 + '.jpg')] : genreArtists.includes(query) ? [catalogRow(query, 'UC_UI_GENRE_' + genreArtists.indexOf(query), 'ARTIST', 'https://cine-art-fixture.invalid/genre-' + genreArtists.indexOf(query) + '.jpg')] : [catalogRow('After hours', 'PL_UI_EDITORIAL', 'PLAYLIST', covers[0]), catalogRow('The Night Current', 'UC_UI_ARTIST', 'ARTIST', 'https://cine-art-fixture.invalid/genre-0.jpg'), ...songs.slice(0, 4).map(track), catalogRow('Quiet motion', 'MPRE_UI_ALBUM', 'ALBUM', covers[1]), catalogRow('Soft focus', 'MPRE_UI_SECOND', 'ALBUM', covers[2])] } }] } } } }] } } });
  const browseBody = id => id.startsWith('UC') ? { header: { musicImmersiveHeaderRenderer: { title: { simpleText: 'The Night Current' }, thumbnail: thumb(covers[0]), monthlyListenerCount: { simpleText: '12,345' } } }, contents: songs.slice(0, 4).map(track) } : { header: { musicResponsiveHeaderRenderer: { title: { simpleText: id.startsWith('VL') ? 'After hours' : 'Quiet motion' }, straplineTextOne: { runs: [run('Mira West', 'UC_UI_ARTIST', 'ARTIST')] }, subtitle: { runs: [{ text: '2026' }] }, secondSubtitle: { simpleText: '4 tracks' }, thumbnail: thumb(id.startsWith('VL') ? covers[0] : covers[1]), description: { simpleText: 'Test-only local catalog response. No external data or audio.' } } }, contents: songs.slice(0, 4).map(track) };
  let player = { track: songs[0], status: 'paused', positionMs: 23_000, durationMs: songs[0].durationMs, queue: songs.slice(0, 4), shuffle: false, repeat: 'off', output: 'UI fixture (no audio)' };
  let jobs = songs.slice(2).map((song, index) => ({ id: song.id, track: song, status: ['downloading', 'paused', 'queued', 'failed'][index], progress: [37, 18, 0, 9][index], bytes: 0, totalBytes: 0, restartOnResume: true, ...(index === 3 ? { error: 'Test-only interrupted connection' } : {}) }));
  const requests = new Map(); let eventId = 0;
  const streams = new Set();
  const cloud = id => JSON.parse(localStorage.getItem('cine:ui-cloud:' + id) || 'null');
  if (mode === 'no-region') { Object.defineProperty(navigator, 'languages', { value: ['en'], configurable: true }); Object.defineProperty(navigator, 'language', { value: 'en', configurable: true }); }
  const fixture = window.__cineUi = { songs, covers, requests: [], plays: [], controls: [], downloads: [], cancellations: [], failSearch: false, failRegional: false, authSuccess: true, loginId: 'ui-new-user', backgrounded: 0, onboardingSeen: false, library: () => JSON.parse(localStorage.getItem('cine:library-v3:user:' + JSON.parse(sessionStorage.getItem('cine-ui-auth')).localId)), cloud };
  new MutationObserver(() => { if (document.querySelector('.music-onboarding')) fixture.onboardingSeen = true; }).observe(document, { childList: true, subtree: true });
  window.EventSource = class {
    constructor(url) { this.url = url; this.handlers = new Map(); streams.add(this); setTimeout(() => { if (!streams.has(this)) return; this.onopen?.(); this.emit('put', { path: '/', data: cloud(this.owner()) }); }, 15); }
    owner() { return new URL(this.url).pathname.split('/')[2]; }
    addEventListener(type, listener) { this.handlers.set(type, [...this.handlers.get(type) || [], listener]); }
    emit(type, data) { for (const listener of this.handlers.get(type) || []) listener(new MessageEvent(type, { data: JSON.stringify(data) })); }
    close() { streams.delete(this); }
  };
  const publish = (type, data) => window.__cineChunk?.('ui-fixture-' + ++eventId, JSON.stringify({ type, data }), true);
  const emitPlayer = () => publish('player', player), emitJobs = () => publish('downloadJobs', { items: jobs });
  window.CineAndroid = {
    snapshot: () => JSON.stringify(player), ready: () => queueMicrotask(emitPlayer), background() { fixture.backgrounded++; }, setSystemBars() {}, countryCode: () => mode === 'no-region' ? '' : 'TZ', authTokens: () => sessionStorage.getItem('cine-ui-auth') || 'null', saveAuthTokens(encoded) { sessionStorage.setItem('cine-ui-auth', encoded); }, clearAuthTokens() { sessionStorage.setItem('cine-ui-auth', 'null'); }, configureDownloads() {}, isWifiConnected: () => true,
    downloads: () => '[]', downloadJobs: () => JSON.stringify(jobs),
    request(id, encoded) {
      const options = JSON.parse(encoded), body = JSON.parse(options.body || '{}'); fixture.requests.push({ url: options.url, body });
      let data = {}, status = 200;
      if (options.url.includes('/youtubei/v1/search')) { data = searchBody(body.query || ''); if (fixture.failSearch || /fixture failure/i.test(body.query || '')) status = 503; }
      else if (options.url.includes('/youtubei/v1/browse')) data = browseBody(body.browseId);
      else if (options.url.startsWith('https://musicbrainz.org/ws/2/artist/')) {
        if (fixture.failRegional) status = 503;
        const region = new URL(options.url).searchParams.get('query')?.match(/country:([A-Z]{2})/)?.[1];
        data = { artists: region ? regionalNames.map((name, index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`, name, country: region, 'life-span': { ended: false } })) : [] };
      }
      else if (options.url.includes('/library.json')) {
        const owner = new URL(options.url).pathname.split('/')[2]; data = cloud(owner);
        if (options.method === 'PATCH') {
          data ||= {};
          for (const [key, value] of Object.entries(body)) { const keys = key.split('/'); let parent = data; for (const part of keys.slice(0, -1)) parent = parent[part] ||= {}; if (value === null) delete parent[keys.at(-1)]; else parent[keys.at(-1)] = value; }
          localStorage.setItem('cine:ui-cloud:' + owner, JSON.stringify(data));
          for (const stream of streams) if (stream.owner() === owner) stream.emit('patch', { path: '/', data: body });
        }
      }
      else if (options.url.includes('accounts:signInWithPassword')) data = { ...user(fixture.loginId), expiresIn: '3600' };
      else if (options.url.includes('accounts:lookup')) { const id = String(body.idToken).replace('fixture-token-', ''); data = { users: [user(id, id !== 'ui-unverified-user')] }; }
      else if (options.url.includes('accounts:signUp')) data = { localId: 'ui-signup-user', email: body.email, idToken: 'fixture-id-token', refreshToken: 'fixture-refresh-token', expiresIn: '3600' };
      else if (options.url.includes('accounts:update')) data = { localId: 'ui-signup-user', email: 'ui-test@example.invalid', idToken: 'fixture-updated-token', refreshToken: 'fixture-refresh-token', expiresIn: '3600', displayName: body.displayName };
      else if (options.url.includes('accounts:sendOobCode')) { status = fixture.authSuccess ? 200 : 503; data = status === 200 ? { email: body.email } : { error: { message: 'INTERNAL_ERROR' } }; }
      else status = 503;
      const timer = setTimeout(() => { requests.delete(id); const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data)))); publish('http', { id, status, headers: { 'content-type': 'application/json' }, body: payload }); }, options.url.includes('/library.json') && options.method !== 'PATCH' ? 400 : /fixture stale/i.test(body.query || '') ? 500 : 30);
      requests.set(id, timer);
    },
    cancel(id) { fixture.cancellations.push(id); clearTimeout(requests.get(id)); requests.delete(id); },
    queue(encoded, shuffle, repeat) { player = { ...player, queue: JSON.parse(encoded), shuffle, repeat }; emitPlayer(); },
    play(encoded) { const song = JSON.parse(encoded); fixture.plays.push(song); player = { ...player, track: song, queue: song.queue || player.queue, status: 'paused', durationMs: song.durationMs, positionMs: 0 }; emitPlayer(); },
    control(action, value) { fixture.controls.push(action); if (action === 'seek') player.positionMs = value; if (action === 'pause') player.status = 'paused'; if (action === 'resume') player.status = 'playing'; if (action === 'stop') player = { ...player, track: null, status: 'idle', positionMs: 0 }; emitPlayer(); },
    download(encoded) { fixture.downloads.push(JSON.parse(encoded)); }, removeDownload() {},
    pauseDownload(id) { jobs = jobs.map(job => job.id === id ? { ...job, status: 'paused' } : job); emitJobs(); },
    resumeDownload(id) { jobs = jobs.map(job => job.id === id ? { ...job, status: 'queued', progress: 0 } : job); emitJobs(); },
    cancelDownload(id) { jobs = jobs.filter(job => job.id !== id); emitJobs(); },
    sleepTimer() {}, configureEqualizer: () => false, openMediaOutputPanel() {}, openNotificationSettings() {}, openExternal() {}, share() {},
  };
}

const version = await (await fetch(debug + '/json/version')).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { browserContextId } = await browser.cdp('Target.createBrowserContext');
const { targetId } = await browser.cdp('Target.createTarget', { url: 'about:blank', browserContextId });
const targets = await (await fetch(debug + '/json')).json();
const page = await connect(targets.find(tab => tab.id === targetId).webSocketDebuggerUrl);
page.on('Runtime.exceptionThrown', event => report.uncaughtErrors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
page.on('Fetch.requestPaused', async event => {
  if (new URL(event.request.url).origin === new URL(base).origin) void page.cdp('Fetch.continueRequest', { requestId: event.requestId });
  else if (new URL(event.request.url).hostname === 'cine-art-fixture.invalid') {
    const index = Number(event.request.url.match(/genre-(\d)/)?.[1] || 0);
    const body = await evaluate(`window.__cineUi.covers[${index}].split(',')[1]`);
    await page.cdp('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'image/jpeg' }], body });
  }
  else { report.blockedExternalRequests.push(event.request.url); void page.cdp('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 503, body: '' }); }
});
await page.cdp('Runtime.enable'); await page.cdp('Page.enable');
await page.cdp('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixture.toString()})();` });

async function evaluate(expression) {
  const result = await page.cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function wait(expression) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 80)); }
  throw new Error('UI did not reach: ' + expression);
}
async function screenshot(name) {
  await evaluate(`Promise.all(document.getAnimations().filter(animation=>Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation=>animation.finished.catch(()=>{})))`);
  const result = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(output, name + '.png'), Buffer.from(result.data, 'base64')); report.screenshots.push(name + '.png');
}
async function check(name, action) {
  try { const detail = await action(); report.checks.push({ name, ...(detail ? { detail } : {}) }); console.log('PASS ' + name); }
  catch (error) { report.failures.push({ name, error: error.message }); console.error('FAIL ' + name + ': ' + error.message); await screenshot('FAIL-' + name.replace(/[^a-z0-9]+/gi, '-').slice(0, 80)); await reload('app'); }
}
function assert(value, text) { if (!value) throw new Error(text); }
async function click(selector) { const clicked = await evaluate(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(el=>el.getClientRects().length && !el.disabled); if(!el)return false; el.click(); return true; })()`); assert(clicked, 'Missing visible control ' + selector); }
async function textClick(text, within = 'body') { const clicked = await evaluate(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(within + ' button')})].find(el=>el.getClientRects().length&&!el.disabled&&(el.textContent.trim()===${JSON.stringify(text)}||el.querySelector('strong')?.textContent.trim()===${JSON.stringify(text)})); if(!el)return false; el.click(); return true; })()`); assert(clicked, 'Missing button ' + text); }
async function input(selector, value) { await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw Error('Missing input'); Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`); }
async function back() { await evaluate(`window.dispatchEvent(new Event('cine:back',{cancelable:true}))`); }
async function tab(index) { await click(`.tab-bar button:nth-child(${index + 1})`); }
async function navigate(mode) { await page.cdp('Page.navigate', { url: base + (mode ? '?ui-fixture=' + mode : '') }); }
async function reload(mode) { await navigate(mode); await wait(`!!document.querySelector('.mini-player')&&!!document.querySelector('.browse-feature')`); }
async function login() { await textClick('Log in with email', '.auth-screen'); await input('#auth-email', 'ui-test@example.invalid'); await input('#auth-password', 'Fixture-password-42'); await evaluate(`document.querySelector('.auth-screen form').requestSubmit()`); }

// Checks are appended below; this footer always records partial failures.
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await check('Signed-out root gates all music screens and Back never reveals Home', async () => {
    await navigate('signed-out'); await wait(`!!document.querySelector('.auth-gate [data-auth-view="welcome"]')`);
    assert(await evaluate(`!document.querySelector('.browse-home,.browse-search,.browse-library,.tab-bar,.mini-player')`), 'Music screens mounted behind the auth gate');
    assert(await evaluate(`window.__cineUi.requests.every(request=>!request.url.includes('/youtubei/'))`), 'Guest requested catalog data');
    await textClick('Log in with email', '.auth-gate'); await input('#auth-email', 'retained@example.invalid'); await back();
    await wait(`!!document.querySelector('[data-auth-view="welcome"]')`); await back();
    assert(await evaluate(`window.__cineUi.backgrounded===1&&!document.querySelector('.browse-home')`), 'Welcome Back bypassed the gate');
    await textClick('Log in with email', '.auth-gate'); assert(await evaluate(`document.querySelector('#auth-email').value==='retained@example.invalid'`), 'Auth Back lost the email draft');
    await back(); await screenshot('auth-gate-393x852');
  });
  await check('Verified new user waits for cloud then completes country genre and real artist onboarding', async () => {
    await login(); await wait(`!!document.querySelector('.account-hydration')`);
    assert(await evaluate(`!document.querySelector('.music-onboarding,.browse-home')`), 'Home or onboarding flashed before the first cloud snapshot');
    await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='welcome'`);
    assert(await evaluate(`getComputedStyle(document.querySelector('.music-onboarding')).backgroundColor==='rgb(6, 17, 38)'&&getComputedStyle(document.querySelector('.onboarding-footer .primary-button')).backgroundColor==='rgb(0, 217, 242)'`), 'Intro does not use the default APK palette');
    await screenshot('onboarding-welcome-393x852'); await textClick('Make it mine', '.onboarding-footer');
    await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='1'`);
    assert(await evaluate(`document.querySelector('.onboarding-region strong').textContent==='Tanzania'`), 'Optional native country suggestion was not used');
    assert(await evaluate(`!document.querySelector('.tab-bar,.mini-player,.browse-home,.browse-search,.browse-library')`), 'Music UI mounted during onboarding');
    await input('[aria-label="Search countries and regions"]', 'Kenya'); await click('.onboarding-countries label'); await screenshot('onboarding-country-393x852');
    await input('[aria-label="Search countries and regions"]', 'No such region');
    assert(await evaluate(`document.querySelector('.onboarding-region strong').textContent==='Kenya'&&document.querySelectorAll('.onboarding-countries label').length===0`), 'Country search text overwrote the selected ISO country');
    await input('[aria-label="Search countries and regions"]', '');
    await textClick('Continue', '.onboarding-footer'); await textClick('Afrobeats', '.onboarding-genres'); await textClick('Jazz', '.onboarding-genres');
    await back(); await wait(`document.querySelector('.music-onboarding').dataset.onboardingStep==='1'`);
    assert(await evaluate(`document.querySelector('.onboarding-region strong').textContent==='Kenya'`), 'Step Back lost the selected country');
    await textClick('Continue', '.onboarding-footer'); assert(await evaluate(`document.querySelectorAll('.onboarding-genres [aria-pressed=true]').length===2`), 'Step Back lost selected genres');
    const targets = await evaluate(`Array.from(document.querySelectorAll('.onboarding-genres button')).map(button=>button.getBoundingClientRect().height)`);
    assert(targets.every(height=>height>=48), 'Genre target smaller than 48px'); await screenshot('onboarding-genres-393x852');
    await textClick('Continue', '.onboarding-footer'); await wait(`!!document.querySelector('.onboarding-artist')`); await click('[aria-label="Follow The Night Current"]');
    assert(await evaluate(`document.querySelector('.onboarding-artist').getAttribute('aria-pressed')==='true'&&document.querySelector('.onboarding-artist img').src.startsWith('https://cine-art-fixture.invalid/')`), 'Catalog artist was not visibly selected with source photo');
    assert(await evaluate(`window.__cineUi.plays.length===0`), 'Onboarding forced audio playback'); await screenshot('onboarding-artists-393x852');
    await textClick('Continue with 1 artist', '.onboarding-footer'); await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='4'`);
    assert(await evaluate(`!document.querySelector('.browse-home,.tab-bar')`), 'Ready screen bypassed saving preferences');
    await screenshot('onboarding-ready-393x852');
    await click('[aria-label="Review personalization choices"]'); await wait(`document.querySelector('.music-onboarding').dataset.onboardingStep==='1'`);
    assert(await evaluate(`document.querySelector('.onboarding-region strong').textContent==='Kenya'`), 'Ready review lost country');
    await textClick('Continue', '.onboarding-footer');
    assert(await evaluate(`document.querySelectorAll('.onboarding-genres [aria-pressed=true]').length===2`), 'Ready review lost genres');
    await textClick('Continue', '.onboarding-footer'); await wait(`!!document.querySelector('.onboarding-artist[aria-pressed=true]')`);
    await textClick('Continue with 1 artist', '.onboarding-footer'); await textClick('Start listening', '.onboarding-footer'); await wait(`!!document.querySelector('.browse-feature')&&!document.querySelector('.music-onboarding')`);
    assert(await evaluate(`JSON.stringify(window.__cineUi.library().taste)===JSON.stringify({country:'KE',genres:['afrobeats','jazz'],completed:true})`), 'Normalized account taste did not persist');
    assert(await evaluate(`window.__cineUi.library().artists[0]?.id==='UC_UI_ARTIST'&&window.__cineUi.library().favorites.length===0`), 'Follow selection was lost or another account library was imported');
    await wait(`window.__cineUi.cloud('ui-new-user')?.taste?.completed===true`);
    assert(await evaluate(`window.__cineUi.requests.some(request=>request.body.query==='Kenya Afrobeats Jazz music playlists')&&window.__cineUi.requests.some(request=>request.body.query==='Kenya The Night Current albums')`), 'Home queries did not use country, genres and actual follows');
    return 'Only localhost native-transport and RTDB/SSE mocks. Production auth still requires Firebase server lookup.';
  });
  await check('Sign-out stops playback retains library and later login does not repeat onboarding', async () => {
    await click('.browse-feature-arrow'); await wait(`window.__cineUi.plays.length===1`);
    await click('[aria-label="Open profile"]'); await textClick('Sign out', '.account-profile'); await wait(`!!document.querySelector('.auth-gate')`);
    assert(await evaluate(`window.__cineUi.controls.at(-1)==='stop'&&!document.querySelector('.mini-player,.tab-bar,.browse-home')`), 'Sign-out left playback or music content accessible');
    assert(await evaluate(`JSON.parse(localStorage.getItem('cine:library-v3:user:ui-new-user')).taste.completed===true`), 'Sign-out deleted music preferences');
    await login(); await wait(`!!document.querySelector('.browse-feature')`); assert(await evaluate(`!document.querySelector('.music-onboarding')`), 'Later login repeated onboarding');
  });
  await check('New device hydrates saved cloud taste without transient onboarding', async () => {
    await evaluate(`localStorage.removeItem('cine:library-v3:user:ui-new-user');localStorage.removeItem('cine:library-pending-v3:user:ui-new-user')`);
    await navigate(); await wait(`!!document.querySelector('.account-hydration')`);
    assert(await evaluate(`!document.querySelector('.music-onboarding,.browse-home')`), 'New device opened before remote preferences');
    await wait(`!!document.querySelector('.browse-feature')`);
    assert(await evaluate(`!window.__cineUi.onboardingSeen&&window.__cineUi.library().taste.country==='KE'`), 'Saved account taste was not hydrated before access');
  });
  await check('Unverified session cannot mount music and Skip saves the editable region default', async () => {
    await navigate('unverified'); await wait(`!!document.querySelector('.auth-gate [data-auth-view="verify"]')`);
    assert(await evaluate(`!document.querySelector('.browse-home,.tab-bar')&&window.__cineUi.requests.every(request=>!request.url.includes('/youtubei/'))`), 'Unverified session accessed music');
    await navigate('signed-out'); await wait(`!!document.querySelector('.auth-gate')`); await evaluate(`window.__cineUi.loginId='ui-skip-user'`); await login();
    await wait(`!!document.querySelector('.music-onboarding')`); await textClick('Skip for now', '.onboarding-footer'); await wait(`!!document.querySelector('.browse-feature')`);
    assert(await evaluate(`JSON.stringify(window.__cineUi.library().taste)===JSON.stringify({country:'TZ',genres:[],completed:true})`), 'Skip did not persist country and completion');
    assert(await evaluate(`window.__cineUi.requests.some(request=>request.body.query==='Tanzania music playlists')`), 'Skipped preferences did not produce regional Home');
  });
  await check('Missing device region cannot silently complete with US or a country search string', async () => {
    await navigate('no-region'); await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='welcome'`);
    await textClick('Skip for now', '.onboarding-footer'); await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='1'`);
    assert(await evaluate(`!document.querySelector('.browse-home')&&document.querySelector('.onboarding-error')&&document.querySelector('.onboarding-footer .primary-button').disabled`), 'Unknown region bypassed validation');
    await input('[aria-label="Search countries and regions"]', 'India');
    assert(await evaluate(`document.querySelector('.onboarding-footer .primary-button').disabled`), 'Typing a region name completed selection');
    await click('.onboarding-countries label:has(input[value="IN"])');
    await textClick('Skip for now', '.onboarding-footer'); await wait(`!!document.querySelector('.browse-feature')`);
    assert(await evaluate(`window.__cineUi.library().taste.country==='IN'&&window.__cineUi.library().taste.completed`), 'A valid selected region did not unlock Home');
  });
  await check('Regional data failure retries and artist search recovers without discarding choices', async () => {
    await navigate('signed-out'); await wait(`!!document.querySelector('.auth-gate')`); await evaluate(`window.__cineUi.loginId='ui-discovery-user'`); await login();
    await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='welcome'`); await textClick('Make it mine', '.onboarding-footer');
    await input('[aria-label="Search countries and regions"]', 'Australia'); await evaluate(`window.__cineUi.failRegional=true`); await click('.onboarding-countries label:has(input[value="AU"])');
    await textClick('Continue', '.onboarding-footer'); await textClick('Jazz', '.onboarding-genres'); await textClick('Continue', '.onboarding-footer');
    await wait(`document.querySelector('.onboarding-stage-artists .empty-state h2')?.textContent==='Artists could not load'`);
    assert(await evaluate(`!document.querySelector('.onboarding-footer .primary-button').disabled`), 'Optional artist failure trapped setup');
    await evaluate(`window.__cineUi.failRegional=false`); await textClick('Try again', '.onboarding-stage-artists'); await wait(`document.querySelectorAll('.onboarding-artist').length===6`);
    await input('[aria-label="Search artists"]', 'fixture nothing'); await wait(`document.querySelector('.onboarding-empty')?.textContent.includes('No matching artists')`);
    await input('[aria-label="Search artists"]', 'The Night Current'); await wait(`document.querySelectorAll('.onboarding-artist').length===1`);
    assert(await evaluate(`document.querySelector('.onboarding-stage-artists .onboarding-selection-note span').textContent==='Search results'`), 'Global results inherited an unverified country label');
    await click('[aria-label="Follow The Night Current"]'); await textClick('Continue with 1 artist', '.onboarding-footer'); await textClick('Start listening', '.onboarding-footer'); await wait(`!!document.querySelector('.browse-feature')`);
    assert(await evaluate(`JSON.stringify(window.__cineUi.library().taste)===JSON.stringify({country:'AU',genres:['jazz'],completed:true})&&window.__cineUi.library().artists.length===1`), 'Recovery lost selections or did not finish');
  });
  await check('Personalization stays usable across four themes narrow screens large text and reduced motion', async () => {
    report.personalizationLayouts = [];
    const configurations = ['default', 'dark', 'green', 'light'].flatMap(theme => [{ theme, width: 393, height: 852, font: 1 }, { theme, width: 320, height: 640, font: 1.5 }]);
    configurations.push({ theme: 'default', width: 480, height: 800, font: 1.25 });
    for (const [index, view] of configurations.entries()) {
      await page.cdp('Emulation.setDeviceMetricsOverride', { width: view.width, height: view.height, deviceScaleFactor: 1, mobile: true });
      await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: view.font > 1 ? 'reduce' : 'no-preference' }] });
      await evaluate(`localStorage.setItem('cine:cine-theme-v2',JSON.stringify(${JSON.stringify(view.theme)}));localStorage.setItem('cine:preferences-v3',JSON.stringify({reducedMotion:'system'}))`);
      await navigate('signed-out'); await wait(`!!document.querySelector('.auth-gate')`); await evaluate(`window.__cineUi.loginId=${JSON.stringify('ui-layout-' + index)}`); await login();
      await wait(`document.querySelector('.music-onboarding')?.dataset.onboardingStep==='welcome'`);
      await evaluate(`document.documentElement.style.fontSize=${JSON.stringify(16 * view.font + 'px')}`);
      const prefix = `personalization-${view.theme}-${view.width}-font${Math.round(view.font * 100)}`;
      async function checkStage(stage) {
        await screenshot(prefix + '-' + stage);
        const layout = await evaluate(`(()=>{const panel=document.querySelector('.music-onboarding'),footer=panel.querySelector('.onboarding-footer').getBoundingClientRect(),buttons=Array.from(panel.querySelectorAll('.onboarding-footer button')).map(button=>{const r=button.getBoundingClientRect();return{w:r.width,h:r.height,right:r.right,bottom:r.bottom}});return{overflow:document.documentElement.scrollWidth>innerWidth||panel.scrollWidth>innerWidth,footerBottom:footer.bottom,height:innerHeight,width:innerWidth,buttons,reduced:document.querySelector('.cine-app').dataset.reducedMotion}})()`);
        assert(!layout.overflow && layout.footerBottom <= layout.height + 1, `${prefix}/${stage} overflows viewport: ${JSON.stringify(layout)}`);
        assert(layout.buttons.every(button => button.w >= 48 && button.h >= 48 && button.right <= layout.width + 1 && button.bottom <= layout.height + 1), `${prefix}/${stage} CTA is clipped or too small`);
        if (view.font > 1) assert(layout.reduced === 'true', 'Reduced-motion system preference was not applied');
      }
      await checkStage('welcome'); await textClick('Make it mine', '.onboarding-footer'); await wait(`document.querySelector('.music-onboarding').dataset.onboardingStep==='1'`); await checkStage('country');
      await textClick('Continue', '.onboarding-footer'); await wait(`document.querySelector('.music-onboarding').dataset.onboardingStep==='2'`); await checkStage('genres');
      await textClick('Continue', '.onboarding-footer'); await wait(`document.querySelectorAll('.onboarding-artist').length===6`);
      await evaluate(`document.querySelector('.onboarding-artist-grid').scrollIntoView({block:'start'})`); await checkStage('artists');
      await evaluate(`Array.from(document.querySelectorAll('.onboarding-artist')).at(-1).scrollIntoView({block:'nearest'})`);
      const bottom = await evaluate(`(()=>{const b=document.querySelector('.onboarding-body').getBoundingClientRect(),r=Array.from(document.querySelectorAll('.onboarding-artist')).at(-1).getBoundingClientRect();return r.bottom<=b.bottom+1&&r.top>=b.top-1})()`);
      assert(bottom, `${prefix} last artist is hidden behind the footer`);
      await textClick('Continue', '.onboarding-footer'); await wait(`document.querySelector('.music-onboarding').dataset.onboardingStep==='4'`); await checkStage('ready');
      await textClick('Start listening', '.onboarding-footer'); await wait(`!!document.querySelector('.browse-feature')&&!document.querySelector('.music-onboarding')`);
      assert(await evaluate(`window.__cineUi.library().taste.completed===true`), `${prefix} did not complete`);
      report.personalizationLayouts.push({ ...view, stages: 5, finishedAtHome: true });
    }
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
    await evaluate(`localStorage.setItem('cine:cine-theme-v2',JSON.stringify('default'));localStorage.setItem('cine:preferences-v3',JSON.stringify({reducedMotion:'system'}))`);
    return '9 configurations / 45 screen captures; all finish at Home without forced playback.';
  });
  await reload('app');
  await check('Music preferences edit guards unsaved data and changes Home queries not playback', async () => {
    const before = await evaluate(`({track:document.querySelector('.mini-open strong').textContent,plays:window.__cineUi.plays.length,controls:window.__cineUi.controls.length,queue:JSON.parse(localStorage.getItem('cine:queue'))})`);
    await click('[aria-label="Open profile"]'); await textClick('Music preferences', '.account-profile'); await wait(`!!document.querySelector('.music-onboarding')`);
    assert(await evaluate(`![...document.querySelectorAll('.tab-bar,.mini-player')].some(el=>el.getClientRects().length)`), 'Dock remained visible in focused preferences');
    await input('[aria-label="Search countries and regions"]', 'Japan'); await click('.onboarding-countries label'); await click('[aria-label="Back to settings"]');
    await wait(`!!document.querySelector('[aria-label="Discard music preferences?"]')`); await textClick('Cancel', '.confirmation-scrim');
    assert(await evaluate(`document.querySelector('.onboarding-region strong').textContent==='Japan'`), 'Cancel discard lost the country draft');
    await textClick('Continue', '.onboarding-footer'); await textClick('Jazz', '.onboarding-genres'); await textClick('Continue', '.onboarding-footer');
    await textClick('Save preferences', '.onboarding-footer'); await wait(`!document.querySelector('.music-onboarding')`);
    await wait(`window.__cineUi.requests.some(request=>request.body.query==='Japan Afrobeats Jazz music playlists')`);
    const after = await evaluate(`({track:document.querySelector('.mini-open strong').textContent,plays:window.__cineUi.plays.length,controls:window.__cineUi.controls.length,queue:JSON.parse(localStorage.getItem('cine:queue'))})`);
    assert(JSON.stringify(after)===JSON.stringify(before), 'Music preference editing changed playback or queue'); await back();
  });
  await check('Home uses catalog editorial and album shelf', async () => {
    await wait(`!!document.querySelector('.browse-feature h2')&&document.querySelectorAll('.browse-album-shelf .shelf-item').length>=2`);
    assert(await evaluate(`!!document.querySelector('.browse-feature h2')&&document.querySelectorAll('.browse-album-shelf .shelf-item').length>=2`), 'Editorial or shelf missing');
    const ratio = await evaluate(`(()=>{const r=document.querySelector('.browse-feature').getBoundingClientRect();return r.width/r.height})()`);
    assert(Math.abs(ratio - 1.4) < .02, 'Editorial ratio is not 1.4'); await screenshot('home-393x852');
  });
  await check('Featured Play starts loaded playlist without opening details', async () => {
    await click('.browse-feature-arrow'); await wait(`window.__cineUi.plays.length===1`);
    assert(await evaluate(`![...document.querySelectorAll('.route-layer')].some(el=>el.getClientRects().length)`), 'Featured Play navigated instead of playing');
    assert(await evaluate(`window.__cineUi.plays[0].queue.length===4`), 'Featured Play did not use real catalog tracks');
  });
  await check('Genre cards load related catalog artist art and share the metadata cache', async () => {
    await tab(1);
    await evaluate(`document.querySelector('.browse-search .browse-genres').scrollIntoView({block:'center'})`);
    await wait(`document.querySelectorAll('.browse-search .browse-genre[data-artwork="ready"]').length===4`);
    const artists = await evaluate(`Array.from(document.querySelectorAll('.browse-search .browse-genre')).map(card=>card.dataset.artworkArtist)`);
    assert(JSON.stringify(artists) === JSON.stringify(['Burna Boy', 'SZA', 'Dua Lipa', 'Kendrick Lamar']), 'Genre art is not matched to the catalog artists');
    assert(await evaluate(`!document.querySelector('.browse-genres svg[viewBox="0 0 220 150"]')`), 'Sketch artwork remains in genre cards');
    const count = await evaluate(`window.__cineUi.requests.filter(request=>['Burna Boy','SZA','Dua Lipa','Kendrick Lamar'].includes(request.body.query)).length`);
    await screenshot('search-catalog-genre-artwork-393x852');
    await tab(0); await click('.browse-home-tabs button:nth-child(2)');
    await evaluate(`document.querySelector('.browse-home').scrollTop=0`);
    await wait(`document.querySelectorAll('.browse-home .browse-genre[data-artwork="ready"]').length===4`);
    assert(await evaluate(`window.__cineUi.requests.filter(request=>['Burna Boy','SZA','Dua Lipa','Kendrick Lamar'].includes(request.body.query)).length===${count}`), 'Home repeated the genre metadata requests');
    await click('.browse-home-tabs button:first-child');
    await wait(`Boolean(document.querySelector('.browse-feature'))`);
    return 'Catalog/HTTPS-image transport fixtures only; no external request or production sample artwork.';
  });
  for (const [width, height] of [[320, 640], [393, 852], [480, 800]]) {
    for (const scale of [100, 125, 150]) {
      await check(`Layout and mini controls ${width}x${height} font ${scale}`, async () => {
        await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
        await evaluate(`document.documentElement.style.fontSize=${JSON.stringify(16 * scale / 100 + 'px')}`);
        const layout = await evaluate(`(() => { const s=document.querySelector('.browse-home'); return { overflow:document.documentElement.scrollWidth>innerWidth||s.scrollWidth>s.clientWidth+1, controls:[...document.querySelectorAll('.mini-controls button')].map(el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label'),width:r.width,height:r.height,right:r.right,bottom:r.bottom}}) }; })()`);
        assert(!layout.overflow, 'Home has horizontal overflow'); assert(layout.controls.length === 4, 'Mini must have all four controls');
        assert(layout.controls.every(control => control.width >= 48 && control.height >= 48 && control.right <= width + 1 && control.bottom <= height + 1), 'Mini touch targets <48px or clipped: ' + JSON.stringify(layout.controls));
        await screenshot(`home-${width}x${height}-font${scale}`);
        await click('.mini-open'); await wait(`!!document.querySelector('.player-scrim')`);
        const full = await evaluate(`(() => { const sheet=document.querySelector('.player-scrim .fullscreen-sheet');return {nav:[...document.querySelectorAll('.tab-bar')].some(el=>el.getClientRects().length), mini:[...document.querySelectorAll('.mini-player')].some(el=>el.getClientRects().length),overflow:sheet.scrollWidth>sheet.clientWidth+1}; })()`);
        assert(!full.nav && !full.mini, 'Main nav or duplicate mini remains in full player'); assert(!full.overflow, 'Full player has horizontal overflow');
        await screenshot(`player-${width}x${height}-font${scale}`); await click('[aria-label="Collapse player"]');
        return layout.controls;
      });
    }
  }
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 393, height: 852, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.documentElement.style.fontSize='16px'`);
  await check('Favorite is synchronized between mini full player and library', async () => {
    await click('.mini-controls button:first-child');
    await wait(`document.querySelector('.mini-controls button:first-child').getAttribute('aria-pressed')==='true'`);
    await click('.mini-open'); await wait(`!!document.querySelector('.track-heading')`);
    assert(await evaluate(`document.querySelector('.track-heading>.icon-action').getAttribute('aria-pressed')==='true'`), 'Full player heart did not update');
    await click('.track-heading>.icon-action'); await click('[aria-label="Collapse player"]');
    await wait(`document.querySelector('.mini-controls button:first-child').getAttribute('aria-label')==='Add to Favorites'`);
    assert(await evaluate(`!window.__cineUi.library().favorites.some(song=>song.id==='UITEST00001')`), 'Favorite removal did not persist');
  });
  await check('Lyrics preview opens actual cached lines and Back restores player', async () => {
    await click('.mini-open'); await click('.lyric-preview'); await wait(`document.querySelectorAll('.lyric-line').length===4`);
    assert(await evaluate(`document.querySelectorAll('.lyric-current').length===1`), 'Lyrics must highlight exactly one current line');
    await screenshot('lyrics-393x852'); await click('[aria-label="Back to player"]'); await click('[aria-label="Collapse player"]');
  });
  await check('Queue move controls reorder actual persisted queue', async () => {
    await click('.mini-open'); await click('[aria-label="Open queue"]'); await textClick('Edit', '.queue-scrim');
    await click('[aria-label="Move Quiet motion down"]');
    await wait(`document.querySelector('.queue-item .row-copy strong')?.textContent==='Soft focus'`);
    const queue = await evaluate(`JSON.parse(localStorage.getItem('cine:queue')).map(song=>song.title)`);
    assert(queue[0] === 'Night drive' && queue[1] === 'Soft focus' && queue[2] === 'Quiet motion', 'Move did not change queue order');
    await screenshot('queue-393x852'); await click('[aria-label="Close queue"]'); await click('[aria-label="Collapse player"]');
  });
  await check('Search is explicit cancels stale requests and retains query across tabs', async () => {
    await tab(1); await wait(`!!document.querySelector('.browse-search input')`);
    const before = await evaluate(`window.__cineUi.requests.filter(r=>r.url.includes('/search')).length`);
    await input('.browse-search input', 'fixture stale');
    assert(await evaluate(`window.__cineUi.requests.filter(r=>r.url.includes('/search')).length`) === before, 'Typing performed a network search');
    await evaluate(`document.querySelector('.browse-search .search-field').requestSubmit()`);
    await wait(`window.__cineUi.requests.some(r=>r.body.query==='fixture stale')`);
    await input('.browse-search input', 'fixture nothing'); await evaluate(`document.querySelector('.browse-search .search-field').requestSubmit()`);
    await wait(`document.querySelector('.browse-search .empty-state h2')?.textContent.includes('No results')`);
    assert(await evaluate(`window.__cineUi.cancellations.length>0`), 'Stale requests were not canceled');
    await input('.browse-search input', 'Quiet motion'); await evaluate(`document.querySelector('.browse-search .search-field').requestSubmit()`);
    await wait(`document.querySelectorAll('.browse-results .song-row').length>0`);
    assert(await evaluate(`!!document.querySelector('.browse-results .browse-result-artist')&&!!document.querySelector('.browse-results .browse-result-album')&&!!document.querySelector('.browse-results .browse-result-playlist')`), 'Mixed search was not grouped with actual catalog types');
    await screenshot('search-results-393x852'); await tab(2); await tab(1);
    assert(await evaluate(`document.querySelector('.browse-search input').value==='Quiet motion'`), 'Mounted search query was lost');
    assert(await evaluate(`window.__cineUi.library().history.some(entry=>entry.query==='Quiet motion')`), 'Real submitted search not saved');
    await textClick('Artists', '.browse-search'); await wait(`!!document.querySelector('.browse-result-artist')&&!document.querySelector('.browse-results .song-row')`);
    const radius = await evaluate(`getComputedStyle(document.querySelector('.browse-result-artist .cover')).borderRadius`); assert(radius === '50%', 'Artist result artwork was not round');
    await textClick('Albums', '.browse-search'); await wait(`!!document.querySelector('.browse-result-album')&&!document.querySelector('.browse-result-artist')`);
    await textClick('All', '.browse-search'); await wait(`!!document.querySelector('.browse-results .song-row')`);
    await click('.browse-search [aria-label="Clear search music"]');
    await wait(`!document.querySelector('.browse-results')&&document.querySelector('.browse-search input').value===''`);
    await screenshot('search-browse-393x852');
  });
  await check('Search network failure has retry and cleared query removes error', async () => {
    await input('.browse-search input', 'fixture failure'); await evaluate(`document.querySelector('.browse-search .search-field').requestSubmit()`);
    await wait(`document.querySelector('.browse-search .empty-state h2')?.textContent==='Search could not connect'`);
    const before = await evaluate(`window.__cineUi.requests.length`); await textClick('Try again', '.browse-search');
    await wait(`window.__cineUi.requests.length>${before}`); await click('.browse-search [aria-label="Clear search music"]');
    assert(await evaluate(`!document.querySelector('.browse-search .empty-state')`), 'Cleared query left error state');
  });
  await check('Library directories use actual saved counts and downloads expose job controls', async () => {
    await tab(2); await screenshot('library-393x852'); await click('.browse-destination-downloads');
    await wait(`!!document.querySelector('.browse-collection-downloads')`);
    assert(await evaluate(`document.querySelector('.browse-collection-summary').textContent==='0 songs'`), 'Partial download was counted as completed');
    assert(await evaluate(`document.querySelectorAll('.browse-download-job').length===4`), 'Download job states missing');
    await click('[aria-label="Pause download of Soft focus"]'); await wait(`document.querySelector('.browse-download-job').textContent.includes('Paused')`);
    await click('[aria-label="Cancel download of Blue hour"]'); await wait(`document.querySelectorAll('.browse-download-job').length===3`);
    await screenshot('downloads-393x852'); await back();
    await click('.browse-destination-albums'); await wait(`document.querySelectorAll('.browse-directory-row').length===2`);
    await input('.browse-collection input', 'Soft focus'); await wait(`document.querySelectorAll('.browse-directory-row').length===1`);
    await screenshot('saved-albums-393x852'); await back();
  });
  await check('Playlist blank validation unsaved guard and creation persist without changing playback', async () => {
    await click('[aria-label="Create playlist"]'); await wait(`!!document.querySelector('#browse-playlist-name')`);
    await evaluate(`document.querySelector('.browse-form').requestSubmit()`); await wait(`!!document.querySelector('#browse-playlist-name-error')`);
    await input('#browse-playlist-name', 'Unfinished UI draft'); await click('.browse-playlist-form .page-header [aria-label="Back"]');
    await wait(`!!document.querySelector('[aria-label="Discard your changes?"]')`); await textClick('Cancel', '.confirmation-scrim');
    assert(await evaluate(`document.querySelector('#browse-playlist-name').value==='Unfinished UI draft'`), 'Cancel discard lost draft');
    await screenshot('playlist-form-393x852'); await click('.browse-playlist-form .page-header [aria-label="Back"]'); await textClick('Discard changes', '.confirmation-scrim');
    await wait(`!document.querySelector('.browse-playlist-form')`); await click('[aria-label="Create playlist"]'); await input('#browse-playlist-name', 'Created by offline UI check');
    await evaluate(`(()=>{const bytes=Uint8Array.from(atob(window.__cineUi.covers[2].split(',')[1]),letter=>letter.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'ui-fixture-cover.jpg',{type:'image/jpeg'}));const picker=document.querySelector('.browse-cover-picker input');picker.files=transfer.files;picker.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`!!document.querySelector('.browse-cover-picker img')&&!document.querySelector('.browse-cover-picker input').disabled`);
    assert(await evaluate(`document.querySelector('.browse-cover-picker img').naturalWidth===384`), 'Uploaded cover was not resized locally');
    await evaluate(`document.querySelector('.browse-form').requestSubmit()`); await wait(`document.querySelector('.browse-playlist .browse-detail-heading h1')?.textContent==='Created by offline UI check'`);
    assert(await evaluate(`window.__cineUi.library().playlists.some(p=>p.name==='Created by offline UI check'&&p.isPublic===false&&p.cover?.startsWith('data:image/jpeg;base64,')&&p.cover.length<180000)`), 'Created private playlist or compact cover did not persist');
    assert(await evaluate(`document.querySelector('.mini-open strong').textContent==='Night drive'`), 'Playlist creation changed active track');
    await textClick('Add songs', '.browse-playlist'); await wait(`!!document.querySelector('.browse-context')`); await input('.browse-search input', 'Night drive'); await evaluate(`document.querySelector('.browse-search .search-field').requestSubmit()`);
    await wait(`!!document.querySelector('.browse-add-result')`); await click('[aria-label="Add Night drive to Created by offline UI check"]');
    await wait(`document.querySelector('[aria-label="Night drive is in Created by offline UI check"]')?.disabled===true`);
    assert(await evaluate(`window.__cineUi.library().playlists.find(p=>p.name==='Created by offline UI check').songs.length===1`), 'Search add did not persist exactly one real song');
    await textClick('Done', '.browse-context'); await wait(`!!document.querySelector('.browse-playlist')`); await back(); await tab(2);
  });
  await check('Owned playlist reorder remove delete are real and collection download is confirmed', async () => {
    await click('.browse-playlist-rail .shelf-item:last-child'); await wait(`document.querySelector('.browse-playlist .browse-detail-heading h1')?.textContent==='After hours'`);
    const before = await evaluate(`window.__cineUi.downloads.length`); await click('[aria-label="Download songs from After hours"]');
    await wait(`!!document.querySelector('.confirmation-scrim')`); assert(await evaluate(`window.__cineUi.downloads.length`) === before, 'One tap started collection downloads');
    assert(await evaluate(`document.querySelector('.confirmation-copy').textContent.includes('data')`), 'Download confirmation omitted data warning'); await textClick('Cancel', '.confirmation-scrim');
    await textClick('Edit songs', '.browse-playlist'); await click('[aria-label="Move Night drive down"]');
    await wait(`document.querySelector('.browse-edit-song strong').textContent==='Quiet motion'`); await click('[aria-label="Remove Quiet motion from playlist"]');
    await wait(`!!document.querySelector('[aria-label="Remove from playlist?"]')`); await textClick('Remove song', '.confirmation-scrim');
    assert(await evaluate(`!window.__cineUi.library().playlists.find(p=>p.id==='ui-owned').songs.some(s=>s.title==='Quiet motion')`), 'Remove did not persist');
    await textClick('Done', '.browse-playlist'); await screenshot('playlist-393x852'); await textClick('Delete playlist', '.browse-playlist');
    await textClick('Delete playlist', '.confirmation-scrim'); await wait(`!document.querySelector('.browse-playlist')`);
    assert(await evaluate(`document.querySelector('.mini-open strong').textContent==='Night drive'`), 'Delete stopped current playback');
  });
  await check('Catalog album artist and editorial detail follow/save use real contracts', async () => {
    await tab(0); await click('.browse-feature-open'); await wait(`!!document.querySelector('.browse-catalog-playlist .song-list')`); await screenshot('catalog-playlist-393x852'); await back();
    await click('.browse-album-shelf .shelf-item:first-child'); await wait(`!!document.querySelector('.browse-catalog-album .song-list')`);
    await click('[aria-label="Remove album from library"]'); assert(await evaluate(`window.__cineUi.library().albums.length===1`), 'Album removal did not persist');
    await click('[aria-label="Save album to library"]'); assert(await evaluate(`window.__cineUi.library().albums.length===2`), 'Album save did not persist');
    await screenshot('catalog-album-393x852'); await click('.browse-artist-links button'); await wait(`!!document.querySelector('.browse-artist-hero')`);
    await click('.browse-follow'); assert(await evaluate(`!window.__cineUi.library().artists.length`), 'Unfollow did not persist');
    await click('.browse-follow'); assert(await evaluate(`window.__cineUi.library().artists.length===1`), 'Follow did not persist');
    await screenshot('catalog-artist-393x852'); await back(); await back();
  });
  await check('Appearance exposes four persisted themes without changing music', async () => {
    await click('[aria-label="Open profile"]'); await textClick('Settings', '.account-screen'); await textClick('Theme', '.account-settings');
    await wait(`document.querySelectorAll('.appearance-choice').length===4`);
    for (const [index, theme] of ['default', 'dark', 'green', 'light'].entries()) {
      await click(`.appearance-choice:nth-child(${index + 1}) input`); await wait(`document.querySelector('.cine-app').dataset.theme===${JSON.stringify(theme)}`);
      assert(await evaluate(`JSON.parse(localStorage.getItem('cine:cine-theme-v2'))===${JSON.stringify(theme)}`), 'Theme not persisted');
      await screenshot(`appearance-${theme}-393x852`);
    }
    await wait(`window.__cineUi.cloud('ui-verified-user')?.history?.some(item=>item.query==='Quiet motion')`);
    await reload(); assert(await evaluate(`document.querySelector('.cine-app').dataset.theme==='light'`), 'Reload did not restore theme');
    assert(await evaluate(`window.__cineUi.library().history.some(item=>item.query==='Quiet motion')`), 'Reload lost submitted search history');
  });
  await check('Auth recovery is distinct from service-confirmed sent state', async () => {
    await evaluate(`window.dispatchEvent(new Event('cine:open-auth'))`); await wait(`!!document.querySelector('.auth-screen')`); await textClick('Log in with email', '.auth-screen'); await textClick('Forgot password?', '.auth-screen');
    await wait(`document.querySelector('.auth-screen h1')?.textContent==='Reset your password.'`);
    assert(await evaluate(`!document.querySelector('.auth-screen').textContent.includes('Check your email.')`), 'Recovery falsely claims reset email was sent'); await screenshot('auth-recovery-initial-393x852');
    await input('#auth-email', 'ui-test@example.invalid'); await evaluate(`document.querySelector('.auth-screen form').requestSubmit()`);
    await wait(`document.querySelector('.auth-screen h1')?.textContent==='Check your email.'`); await screenshot('auth-recovery-confirmed-393x852');
    assert(await evaluate(`/spam or junk folder/i.test(document.querySelector('.auth-screen').textContent)`), 'Recovery confirmation does not mention spam/junk');
    return 'Service result is test-only native transport fixture. No real email or account was contacted.';
  });
  await check('Email verification reminds users to check spam or junk without claiming verification', async () => {
    await textClick('Return to log in', '.auth-screen');
    await wait(`document.querySelector('.auth-screen [data-auth-view="login"]')!==null`);
    await textClick('Create an account', '.account-switch');
    await wait(`document.querySelector('.auth-screen [data-auth-view="signup"]')!==null`);
    await input('#auth-name', 'Fixture listener'); await input('#auth-email', 'ui-test@example.invalid'); await input('#auth-password', 'Fixture-password-42');
    await evaluate(`document.querySelector('.auth-screen form').requestSubmit()`);
    await wait(`document.querySelector('.auth-screen [data-auth-view="verify"]')!==null`);
    assert(await evaluate(`/spam or junk folder/i.test(document.querySelector('.auth-screen').textContent)`), 'Verification screen does not mention spam/junk');
    assert(await evaluate(`document.querySelector('.auth-screen h1')?.textContent==='Verify your email.'`), 'Signup falsely claims successful verification');
    await screenshot('auth-verification-spam-393x852');
    return 'Synthetic native-transport fixture only; no real account created and no real email sent.';
  });
} finally {
  report.nativeRequests = await evaluate(`window.__cineUi?.requests.length`).catch(() => 0);
  report.audioElements = await evaluate(`document.querySelectorAll('audio,video').length`).catch(() => 0);
  if (report.uncaughtErrors.length) report.failures.push({ name: 'Uncaught runtime errors', errors: report.uncaughtErrors });
  if (report.audioElements) report.failures.push({ name: 'Unexpected audio elements', count: report.audioElements });
  await fs.writeFile(path.join(output, 'ui-report.json'), JSON.stringify(report, null, 2));
  page.close(); await browser.cdp('Target.disposeBrowserContext', { browserContextId }); browser.close();
}
if (report.failures.length) { console.error(`${report.failures.length} UI check(s) failed; see .device-test/ui-report.json`); process.exitCode = 1; }
else console.log(`${report.checks.length} offline UI checks passed; screenshots and report are in .device-test.`);

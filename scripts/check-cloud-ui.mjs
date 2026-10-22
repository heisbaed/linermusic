import { writeFile } from 'node:fs/promises';

// Runs the actual useAccount hook, isolated from every real service and account.
const base = process.env.CINE_UI_URL || 'http://127.0.0.1:5178';
const debug = process.env.CINE_CDP_URL || 'http://127.0.0.1:9228';
const report = { checks: [], failures: [], uncaughtErrors: [], externalRequests: [] };
const socket = new WebSocket((await (await fetch(debug + '/json/version')).json()).webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let serial = 0;
const requests = new Map(), listeners = new Map();
socket.onmessage = event => { const data = JSON.parse(event.data); if (data.id) { const promise = requests.get(data.id); if (!promise) return; requests.delete(data.id); clearTimeout(promise.timer); data.error ? promise.reject(new Error(JSON.stringify(data.error))) : promise.resolve(data.result); } else for (const callback of listeners.get(data.method) || []) callback(data.params, data.sessionId); };
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => { requests.delete(id); reject(new Error('CDP timed out: ' + method)); }, 20_000); requests.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
function on(method, callback) { listeners.set(method, [...listeners.get(method) || [], callback]); }

function install() {
  const owner = 'cloud-test-account';
  const a = { id: 'A', title: 'A', artist: 'Fixture', durationMs: 1000 }, b = { ...a, id: 'B', title: 'B' };
  let user = { localId: owner, email: 'fixture@example.invalid', emailVerified: true, idToken: 'old-id', refreshToken: 'old-refresh', expiresAt: Date.now() + 3_600_000 };
  let wire = { favorites: { A: a }, recent: [a, b], playlists: {}, artists: {}, albums: {}, history: [], profile: { name: 'Initial', username: '' } };
  const fixture = window.__cloudFixture = { a, b, log: [], patches: [], refreshes: [], sources: [], delayRefresh: false };
  localStorage.setItem('cine:library-v3:user:' + owner, JSON.stringify({ ...wire, favorites: [a] }));
  localStorage.setItem('cine:library-pending-v3:user:' + owner, '{}');
  let event = 0;
  const emit = (type, data) => window.__cineChunk('cloud-fixture-' + ++event, JSON.stringify({ type, data }), true);
  const response = (id, status, data) => emit('http', { id, status, headers: { 'content-type': 'application/json' }, body: btoa(JSON.stringify(data)) });
  fixture.releasePatch = (ok = true, apply = true) => {
    const next = fixture.patches.find(item => !item.done); if (!next) throw new Error('No in-flight patch'); next.done = true;
    if (ok && apply) for (const [path, value] of Object.entries(next.body)) {
      const parts = path.split('/'); let parent = wire;
      for (const key of parts.slice(0, -1)) parent = parent[key] ||= {};
      if (value === null) delete parent[parts.at(-1)]; else parent[parts.at(-1)] = value;
    }
    fixture.log.push(ok ? 'patch:ack' : 'patch:failed'); response(next.id, ok ? 200 : 503, ok ? next.body : { error: 'Fixture interruption' });
  };
  fixture.emitRemote = (name) => { wire.profile.name = name; for (const source of fixture.sources.filter(item => !item.closed)) source.emit('patch', { path: '/profile', data: { name } }); };
  fixture.releaseRefresh = () => { const id = fixture.refreshes.shift(); response(id, 400, { error: { message: 'INVALID_REFRESH_TOKEN' } }); };
  window.EventSource = class {
    listeners = new Map(); closed = false;
    constructor() { fixture.sources.push(this); queueMicrotask(() => this.onopen?.()); }
    addEventListener(name, listener) { this.listeners.set(name, [...this.listeners.get(name) || [], listener]); }
    emit(name, data) { for (const listener of this.listeners.get(name) || []) listener({ type: name, data: JSON.stringify(data) }); }
    close() { this.closed = true; }
  };
  window.CineAndroid = {
    ready() {}, downloads: () => '[]', downloadJobs: () => '[]',
    authTokens: () => JSON.stringify(user), saveAuthTokens: value => { user = JSON.parse(value); }, clearAuthTokens: () => { user = null; fixture.log.push('session:cleared'); },
    snapshot: () => JSON.stringify({ track: null, status: 'idle', positionMs: 0, durationMs: 0 }),
    request(id, encoded) {
      const options = JSON.parse(encoded); let body = {}; try { body = JSON.parse(options.body || '{}'); } catch { /* Token refresh uses form data. */ }
      if (options.url.includes('securetoken.googleapis.com')) { fixture.refreshes.push(id); if (!fixture.delayRefresh) queueMicrotask(fixture.releaseRefresh); return; }
      if (options.method === 'PATCH') { fixture.log.push('patch:sent'); fixture.patches.push({ id, body, done: false }); return; }
      if (options.method === 'DELETE') { fixture.log.push('data:delete'); wire = {}; queueMicrotask(() => response(id, 200, null)); return; }
      queueMicrotask(() => response(id, 200, wire));
    },
    cancel() {},
  };
}

const { browserContextId } = await send('Target.createBrowserContext');
const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const cdp = (method, params) => send(method, params, sessionId);
async function evaluate(expression) { const value = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.text + ': ' + value.exceptionDetails.exception?.description); return value.result.value; }
async function wait(expression, timeout = 8000) { const until = Date.now() + timeout; while (Date.now() < until) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 30)); } throw new Error('Timed out: ' + expression); }
async function test(name, run) { try { await run(); report.checks.push(name); } catch (error) { report.failures.push({ name, error: error.message }); } }
on('Runtime.exceptionThrown', (event, session) => { if (session === sessionId) report.uncaughtErrors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text); });
on('Fetch.requestPaused', async (event, session) => {
  if (session !== sessionId) return;
  if (event.request.url.startsWith(base + '/') || /^(data|blob):/.test(event.request.url)) await cdp('Fetch.continueRequest', { requestId: event.requestId });
  else { report.externalRequests.push(new URL(event.request.url).origin); await cdp('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); }
});
await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${install.toString()})()` });
async function reset(expired = false) {
  const marker = 'case=' + Math.random().toString(36).slice(2);
  await cdp('Page.navigate', { url: base + '/cloud-check.html?' + marker });
  await wait(`location.search === ${JSON.stringify('?' + marker)} && Boolean(window.__cloudHarness && window.__cloudFixture.sources.length)`);
  if (expired) await evaluate(`window.__cloudFixture.delayRefresh=true; window.__cloudHarness.setSession({...window.__cloudHarness.account.user, expiresAt:1}); window.__cloudHarness.account.retrySync()`);
}
try {
  await test('A queued addition is sent after an in-flight null deletion', async () => {
    await reset();
    await evaluate('window.__cloudHarness.account.setLibrary(old=>({...old,favorites:[]}))');
    await wait('window.__cloudFixture.patches.length===1');
    await evaluate('window.__cloudHarness.account.setLibrary(old=>({...old,favorites:[window.__cloudFixture.b]}))');
    await new Promise(resolve => setTimeout(resolve, 1100));
    await evaluate('window.__cloudFixture.releasePatch()');
    await wait('window.__cloudFixture.patches.length===2');
    if (!await evaluate('Boolean(window.__cloudFixture.patches[1].body["favorites/B"])')) throw new Error('The second change was not sent.');
    await evaluate('window.__cloudFixture.releasePatch()');
  });
  await test('A newer realtime update survives a delayed older PATCH response', async () => {
    await reset();
    await evaluate('window.__cloudHarness.account.setLibrary(old=>({...old,profile:{...old.profile,name:"Local"}}))');
    await wait('window.__cloudFixture.patches.length===1');
    await evaluate('window.__cloudFixture.emitRemote("Local");window.__cloudFixture.emitRemote("Newer remote");window.__cloudFixture.releasePatch(true,false)');
    await wait('window.__cloudHarness.account.library.profile.name==="Newer remote"');
  });
  await test('Nested realtime array updates preserve sibling songs', async () => {
    await reset();
    await evaluate('window.__cloudFixture.sources[0].emit("put",{path:"/recent/0/title",data:"Updated A"})');
    await wait('window.__cloudHarness.account.library.recent[0]?.title==="Updated A"');
    if (!await evaluate('window.__cloudHarness.account.library.recent[1]?.id==="B"')) throw new Error('The sibling song was lost.');
  });
  await test('Deletion suspends mutations and waits for confirmed in-flight writes', async () => {
    await reset();
    await evaluate('window.__cloudHarness.account.setLibrary(old=>({...old,favorites:[]}))');
    await wait('window.__cloudFixture.patches.length===1');
    await evaluate('window.__cloudSuspended=false;void window.__cloudHarness.account.suspendSync().then(resume=>{window.__cloudSuspended=true;window.__cloudResume=resume});window.__cloudHarness.account.setLibrary(old=>({...old,favorites:[window.__cloudFixture.b]}))');
    if (await evaluate('window.__cloudSuspended')) throw new Error('Deletion crossed an outstanding write.');
    await evaluate('window.__cloudFixture.releasePatch()');
    await wait('window.__cloudSuspended===true');
    if (!await evaluate('window.__cloudHarness.account.library.favorites.length===0&&window.__cloudFixture.patches.length===1')) throw new Error('A suspended mutation entered the library.');
  });
  await test('An ambiguous failed in-flight write prevents destructive deletion', async () => {
    await reset();
    await evaluate('window.__cloudHarness.account.setLibrary(old=>({...old,favorites:[]}))');
    await wait('window.__cloudFixture.patches.length===1');
    await evaluate('window.__cloudDeletionError="";void window.__cloudHarness.account.suspendSync().catch(error=>window.__cloudDeletionError=error.message);window.__cloudFixture.releasePatch(false)');
    await wait('window.__cloudDeletionError.includes("Nothing was deleted")');
  });
  await test('An old failed refresh cannot clear a newer session for the same user', async () => {
    await reset(true);
    await wait('window.__cloudFixture.refreshes.length===1');
    await evaluate('window.__cloudHarness.setSession({...window.__cloudHarness.account.user,idToken:"new-id",refreshToken:"new-refresh",expiresAt:Date.now()+3600000});window.__cloudFixture.releaseRefresh()');
    await wait('window.__cloudHarness.account.user?.idToken==="new-id"');
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!await evaluate('window.__cloudHarness.account.user?.idToken==="new-id"&&!window.__cloudFixture.log.includes("session:cleared")')) throw new Error('The newer session was cleared.');
  });
} finally {
  await send('Target.disposeBrowserContext', { browserContextId }); socket.close();
  await writeFile(new URL('../.device-test/cloud-ui-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
if (report.failures.length || report.uncaughtErrors.length || report.externalRequests.length) process.exitCode = 1;

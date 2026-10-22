import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Bounded, opt-in endpoint checks. Never logs keys, tokens, OAuth URLs or emails.
const configPath = new URL('../mobile/public/firebase-config.json', import.meta.url);
const config = JSON.parse((await readFile(configPath, 'utf8')).replace(/^\uFEFF/, ''));
const report = { checkedAt: new Date().toISOString(), project: config.projectId, responseBytes: 0, checks: [], configurationChanged: false };
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).toLowerCase();
if (only) {
  try { const previous = JSON.parse(await readFile(new URL('../.device-test/online-report.json', import.meta.url), 'utf8')); report.checks = previous.checks.map(check => ({ checkedAt: previous.checkedAt, ...check })); } catch { /* A first targeted run has no previous report. */ }
}
const allowed = new Set(['identitytoolkit.googleapis.com', new URL(`https://${config.authDomain}`).hostname, new URL(config.databaseURL).hostname]);

async function request(url, body) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !allowed.has(parsed.hostname)) throw new Error('Endpoint is outside the configured trusted services.');
  const signal = AbortSignal.timeout(15_000);
  const response = await fetch(url, { signal, redirect: 'manual', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const reader = response.body?.getReader();
  const chunks = []; let bytes = 0;
  for (;;) {
    if (!reader) break;
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 262_144) { await reader.cancel(); throw new Error('Response exceeded the 256 KiB verification cap.'); }
    chunks.push(value);
  }
  report.responseBytes += bytes;
  let data = {}; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* Only status is reported for non-JSON responses. */ }
  let redirectOrigin;
  try { const location = response.headers.get('location'); if (location) redirectOrigin = new URL(location, url).origin; } catch { /* No untrusted redirect is followed. */ }
  return { status: response.status, ok: response.ok, data, redirectOrigin };
}
async function check(name, run) {
  if (only && !name.toLowerCase().includes(only)) return;
  report.checks = report.checks.filter(check => check.name !== name);
  try { report.checks.push({ name, checkedAt: report.checkedAt, ...await run() }); }
  catch (error) { report.checks.push({ name, checkedAt: report.checkedAt, passed: false, error: error.cause?.code || error.code || error.name || 'NetworkError' }); }
}
function serviceCode(data) { const value = typeof data?.error === 'string' ? data.error : data?.error?.message; return typeof value === 'string' ? value.split(' : ')[0].slice(0, 160) : undefined; }

await check('Firebase hosted public configuration', async () => {
  const { status, ok, data } = await request(`https://${config.authDomain}/__/firebase/init.json`);
  const matchesProject = data.projectId === config.projectId && data.apiKey === config.apiKey;
  if (ok && matchesProject && typeof data.databaseURL === 'string' && data.databaseURL !== config.databaseURL) {
    const database = new URL(data.databaseURL);
    if (database.protocol === 'https:' && (database.hostname.endsWith('.firebaseio.com') || database.hostname.endsWith('.firebasedatabase.app'))) { config.databaseURL = database.origin; allowed.add(database.hostname); report.configurationChanged = true; }
  }
  return { status, passed: ok && matchesProject, optional: true, matchesSuppliedProject: matchesProject, databaseAdvertised: Boolean(data.databaseURL) };
});
await check('Firebase Authentication public project configuration', async () => {
  const { status, ok, data } = await request(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(config.apiKey)}`);
  return { status, passed: ok, error: serviceCode(data), authorizedDomainCount: Array.isArray(data.authorizedDomains) ? data.authorizedDomains.length : undefined };
});
await check('Email/password service rejects reserved invalid credentials', async () => {
  const { status, data } = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`, { email: `cine-check-${randomUUID()}@example.invalid`, password: randomUUID() + randomUUID(), returnSecureToken: true });
  const code = serviceCode(data);
  return { status, passed: ['INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD'].includes(code), error: code, scope: 'Endpoint/provider availability only, not successful user authentication. No account is created and no email is sent.' };
});
await check('Google provider creates a real OAuth authorization request', async () => {
  const { status, ok, data } = await request(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(config.apiKey)}`, { providerId: 'google.com', continueUri: `https://${config.authDomain}/__/auth/handler` });
  let client = '';
  if (ok && typeof data.authUri === 'string') {
    const uri = new URL(data.authUri);
    if (uri.protocol === 'https:' && uri.hostname === 'accounts.google.com') client = uri.searchParams.get('client_id') || '';
  }
  const validClient = /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(client);
  if (validClient && config.googleWebClientId !== client) { config.googleWebClientId = client; report.configurationChanged = true; }
  return { status, passed: ok && validClient, error: serviceCode(data), configuredWebClientDiscovered: validClient, scope: 'Authorization setup only. No Google user session is opened or signed in.' };
});
await check('Realtime Database exists and rejects unauthenticated reads', async () => {
  const { status, data, redirectOrigin } = await request(`${config.databaseURL}/users.json?shallow=true`);
  const code = serviceCode(data);
  return { status, passed: status === 401 && Boolean(code?.match(/permission denied/i)), error: code, publicRead: status === 200, redirectOrigin, scope: 'No database writes or authenticated user-data reads are performed.' };
});
if (report.configurationChanged) await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
await writeFile(new URL('../.device-test/online-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.checks.some(check => !check.passed && !check.optional)) process.exitCode = 1;

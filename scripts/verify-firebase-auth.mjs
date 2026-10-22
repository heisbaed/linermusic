import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Live, destructive only inside two fresh synthetic identities. Never log payloads.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = new URL('../.device-test/firebase-auth-online.json', import.meta.url);
const timeoutMs = 15_000;
const responseCap = 16_384;
const report = {
  checkedAt: new Date().toISOString(), status: 'blocked', adminAuthorized: false,
  httpRequests: 0, requestBytes: 0, responseBytes: 0, checks: [],
  temporaryUsers: { attempted: 0, created: 0, deleted: 0, absenceVerified: 0 },
  cleanup: { required: false, passed: true, databasePathsAbsent: 0, authUsersAbsent: 0 },
  limits: { requestTimeoutMs: timeoutMs, responseCapBytes: responseCap, maxRequests: 64 },
  cliAuthTransferExcluded: true,
  scope: { existingUserDataAccessed: false, emailsSent: false, rulesChanged: false, googleUserSignInTested: false },
};
const users = Array.from({ length: 2 }, () => {
  const nonce = randomUUID();
  return { uid: `cine-online-${nonce}`, email: `cine-online-${nonce}@example.invalid`, password: `Cine!7aA-${randomBytes(30).toString('base64url')}`, attempted: false };
});
let config, accessToken, allowed;

class VerificationError extends Error {
  constructor(code, status) { super(code); this.safeCode = code; this.status = status; }
}
function serviceCode(data) {
  const raw = typeof data?.error === 'string' ? data.error : data?.error?.message;
  if (/permission denied/i.test(raw || '')) return 'PERMISSION_DENIED';
  const code = typeof raw === 'string' ? raw.split(/[ :]/)[0] : '';
  return /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : 'SERVICE_ERROR';
}
function assert(condition, code, status) { if (!condition) throw new VerificationError(code, status); }
async function timed(task) {
  let timer;
  try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(new VerificationError('AUTH_TIMEOUT')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function open(url, { method = 'GET', body, headers = {} } = {}) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:' && allowed.has(parsed.hostname), 'UNTRUSTED_ENDPOINT');
  assert(report.httpRequests < report.limits.maxRequests, 'REQUEST_BUDGET_EXCEEDED');
  report.httpRequests++;
  const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  report.requestBytes += Buffer.byteLength(payload || '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, headers: { ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: payload, redirect: 'manual', signal: controller.signal });
    return { response, controller, timer };
  } catch { clearTimeout(timer); throw new VerificationError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'); }
}
async function request(url, options) {
  const { response, controller, timer } = await open(url, options);
  const reader = response.body?.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength; report.responseBytes += value.byteLength;
      assert(bytes <= responseCap, 'RESPONSE_LIMIT', response.status);
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new VerificationError('NON_JSON_RESPONSE', response.status); }
    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    throw error instanceof VerificationError ? error : new VerificationError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR', response.status);
  } finally { clearTimeout(timer); controller.abort(); reader?.releaseLock(); }
}
function admin(path, body) {
  return request(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/${path}`, { method: 'POST', body, headers: { Authorization: `Bearer ${accessToken}` } });
}
function client(method, body) {
  return request(`https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(config.apiKey)}`, { method: 'POST', body });
}
function database(user, { adminAuth = false, suffix = '/library', ...options } = {}) {
  assert(users.includes(user), 'NON_SYNTHETIC_PATH');
  const url = `${config.databaseURL}/users/${encodeURIComponent(user.uid)}${suffix}.json`;
  return request(adminAuth ? url : `${url}?auth=${encodeURIComponent(user.idToken)}`, { ...options, headers: adminAuth ? { Authorization: `Bearer ${accessToken}` } : {} });
}
function success(result) { assert(result.ok, serviceCode(result.data), result.status); return result.data; }
async function check(name, task) {
  try { const detail = await task(); report.checks.push({ name, passed: true, ...detail }); }
  catch (error) {
    report.checks.push({ name, passed: false, status: error.status, error: error.safeCode || 'VERIFICATION_ERROR' });
    throw error;
  }
}

async function verifyStream(user) {
  const { response, controller, timer } = await open(`${config.databaseURL}/users/${encodeURIComponent(user.uid)}/library.json?auth=${encodeURIComponent(user.idToken)}`, { headers: { Accept: 'text/event-stream' } });
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '', bytes = 0;
  async function event(types, predicate) {
    for (;;) {
      let at;
      while ((at = buffer.indexOf('\n\n')) !== -1) {
        const packet = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        const name = packet.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = packet.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
        if (name === 'cancel' || name === 'auth_revoked') throw new VerificationError('STREAM_ACCESS_DENIED', response.status);
        if (types.includes(name) && data && predicate(JSON.parse(data))) return name;
      }
      const part = await reader.read();
      assert(!part.done, 'STREAM_ENDED', response.status);
      bytes += part.value.byteLength; report.responseBytes += part.value.byteLength;
      assert(bytes <= responseCap, 'STREAM_LIMIT', response.status);
      buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
    }
  }
  try {
    assert(response.ok && reader && response.headers.get('content-type')?.includes('text/event-stream'), 'STREAM_UNAVAILABLE', response.status);
    await event(['put'], data => data.path === '/' && data.data?.profile?.username === 'probe');
    const result = await database(user, { method: 'PATCH', body: { 'profile/username': 'probe_updated' } });
    success(result);
    // Firebase may encode a leaf changed by REST PATCH as an SSE put.
    const deltaEvent = await event(['put', 'patch'], data => JSON.stringify(data).includes('probe_updated'));
    return { status: response.status, initialPut: true, liveDelta: true, deltaEvent };
  } catch (error) {
    throw error instanceof VerificationError ? error : new VerificationError(controller.signal.aborted ? 'STREAM_TIMEOUT' : 'STREAM_ERROR', response.status);
  } finally { clearTimeout(timer); controller.abort(); await reader?.cancel().catch(() => {}); }
}

async function cleanup() {
  if (!report.cleanup.required) return;
  report.cleanup.passed = false;
  for (const user of users.filter(item => item.attempted)) {
    // UIDs were checked absent before creation, including ambiguous create failures.
    let dataAbsent = false, userAbsent = false;
    for (let attempt = 0; attempt < 2 && (!dataAbsent || !userAbsent); attempt++) {
      if (!dataAbsent) {
        try {
          success(await database(user, { adminAuth: true, suffix: '', method: 'DELETE' }));
          dataAbsent = success(await database(user, { adminAuth: true, suffix: '' })) === null;
        } catch { /* Retry only this run's exact synthetic path. */ }
      }
      if (!userAbsent) {
        try {
          const deleted = await admin('accounts:delete', { localId: user.uid });
          assert(deleted.ok || serviceCode(deleted.data) === 'USER_NOT_FOUND', 'AUTH_CLEANUP_FAILED', deleted.status);
          const found = success(await admin('accounts:lookup', { localId: [user.uid] }));
          userAbsent = !found?.users?.length;
        } catch { /* Never print an admin response or credentials. */ }
      }
    }
    report.cleanup.databasePathsAbsent += Number(dataAbsent);
    report.cleanup.authUsersAbsent += Number(userAbsent);
    report.temporaryUsers.deleted += Number(userAbsent);
    report.temporaryUsers.absenceVerified += Number(userAbsent && dataAbsent);
  }
  report.cleanup.passed = report.temporaryUsers.absenceVerified === report.temporaryUsers.attempted;
}

try {
  config = JSON.parse((await readFile(new URL('../mobile/public/firebase-config.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
  assert(config.projectId === 'cinemusic-1' && typeof config.apiKey === 'string', 'UNEXPECTED_PROJECT');
  const db = new URL(config.databaseURL);
  assert(db.protocol === 'https:' && db.hostname === 'cinemusic-1-default-rtdb.firebaseio.com' && db.pathname === '/' && !db.search && !db.hash && !db.username && !db.password, 'UNEXPECTED_DATABASE');
  config.databaseURL = db.origin;
  allowed = new Set(['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'cloudresourcemanager.googleapis.com', db.hostname]);

  await check('Existing CLI authorization and cleanup permissions', async () => {
    const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm root --global'] : ['root', '--global'];
    const globalModules = execFileSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const cli = createRequire(join(globalModules, 'firebase-tools', 'package.json'));
    cli('./lib/logger.js').logger.silent = true;
    const auth = cli('./lib/auth.js');
    const options = { project: config.projectId, projectRoot: root, nonInteractive: true };
    const account = auth.getProjectDefaultAccount(root);
    if (account) auth.setActiveAccount(options, account);
    await timed(cli('./lib/requireAuth.js').requireAuth(options));
    accessToken = await timed(cli('./lib/apiv2.js').getAccessToken());
    assert(typeof accessToken === 'string' && accessToken.length > 20, 'CLI_AUTH_UNAVAILABLE');
    const permissions = ['firebaseauth.users.create', 'firebaseauth.users.get', 'firebaseauth.users.update', 'firebaseauth.users.delete', 'firebasedatabase.instances.get', 'firebasedatabase.instances.update'];
    const response = await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${config.projectId}:testIamPermissions`, { method: 'POST', body: { permissions }, headers: { Authorization: `Bearer ${accessToken}` } });
    const granted = success(response)?.permissions || [];
    assert(permissions.every(permission => granted.includes(permission)), 'ADMIN_CLEANUP_NOT_AUTHORIZED', response.status);
    const found = success(await admin('accounts:lookup', { localId: users.map(user => user.uid) }));
    assert(!found?.users?.length, 'SYNTHETIC_UID_COLLISION');
    for (const user of users) assert(success(await database(user, { adminAuth: true, suffix: '' })) === null, 'SYNTHETIC_DATA_COLLISION');
    const absentDeletion = await admin('accounts:delete', { localId: users[0].uid });
    assert(absentDeletion.ok || serviceCode(absentDeletion.data) === 'USER_NOT_FOUND', 'ADMIN_AUTH_DELETE_UNAVAILABLE', absentDeletion.status);
    success(await database(users[0], { adminAuth: true, suffix: '', method: 'DELETE' }));
    report.adminAuthorized = true;
    return { status: response.status, cleanupAccessConfirmed: true };
  });

  report.status = 'failed';
  await check('Create two verified synthetic users', async () => {
    for (const user of users) {
      user.attempted = true; report.temporaryUsers.attempted++; report.cleanup.required = true;
      const result = await admin('accounts', { localId: user.uid, email: user.email, password: user.password, emailVerified: true });
      const created = success(result);
      assert(created.localId === user.uid, 'UNEXPECTED_CREATED_UID', result.status);
      report.temporaryUsers.created++;
    }
    return { status: 200, created: report.temporaryUsers.created };
  });
  await check('Real password sign-in and verified account lookup', async () => {
    for (const user of users) {
      const signed = success(await client('accounts:signInWithPassword', { email: user.email, password: user.password, returnSecureToken: true }));
      assert(signed.localId === user.uid && signed.idToken && signed.refreshToken, 'SIGN_IN_MISMATCH');
      user.idToken = signed.idToken; user.refreshToken = signed.refreshToken;
      const looked = success(await client('accounts:lookup', { idToken: user.idToken }));
      assert(looked.users?.length === 1 && looked.users[0].localId === user.uid && looked.users[0].emailVerified === true, 'VERIFIED_LOOKUP_FAILED');
    }
    return { status: 200, verifiedUsers: 2 };
  });
  await check('Real refresh-token exchange', async () => {
    for (const user of users) {
      const result = await request(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: user.refreshToken }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const refreshed = success(result);
      assert(refreshed.user_id === user.uid && refreshed.id_token && refreshed.refresh_token && Number(refreshed.expires_in) > 0, 'REFRESH_MISMATCH', result.status);
      user.idToken = refreshed.id_token; user.refreshToken = refreshed.refresh_token;
    }
    return { status: 200, refreshedUsers: 2 };
  });
  await check('Owner-only RTDB write and read', async () => {
    for (const user of users) {
      success(await database(user, { method: 'PUT', body: { profile: { name: 'Temporary verification', username: 'probe' }, favorites: {} } }));
      const data = success(await database(user));
      assert(data?.profile?.username === 'probe', 'OWNER_DATA_MISMATCH');
    }
    return { status: 200, ownersVerified: 2 };
  });
  await check('Cross-account read and write denied in both directions', async () => {
    for (const [owner, other] of [[users[0], users[1]], [users[1], users[0]]]) {
      const url = `${config.databaseURL}/users/${encodeURIComponent(owner.uid)}/library.json?auth=${encodeURIComponent(other.idToken)}`;
      for (const options of [{}, { method: 'PATCH', body: { unauthorizedProbe: true } }]) {
        const denied = await request(url, options);
        assert([401, 403].includes(denied.status) && serviceCode(denied.data) === 'PERMISSION_DENIED', 'CROSS_ACCOUNT_ACCESS_ALLOWED', denied.status);
      }
      const intact = success(await database(owner));
      assert(intact?.unauthorizedProbe === undefined, 'CROSS_ACCOUNT_WRITE_PERSISTED');
    }
    return { readDenied: true, writeDenied: true, directionsVerified: 2 };
  });
  await check('Live RTDB SSE initial put and subsequent delta', () => verifyStream(users[0]));
  await check('Unverified synthetic user cannot read or write its own data', async () => {
    const user = users[1];
    success(await admin('accounts:update', { localId: user.uid, emailVerified: false }));
    const signed = success(await client('accounts:signInWithPassword', { email: user.email, password: user.password, returnSecureToken: true }));
    assert(signed.localId === user.uid && signed.idToken, 'UNVERIFIED_SIGN_IN_MISMATCH');
    user.idToken = signed.idToken;
    for (const options of [{}, { method: 'PATCH', body: { unverifiedProbe: true } }]) {
      const denied = await database(user, options);
      assert([401, 403].includes(denied.status) && serviceCode(denied.data) === 'PERMISSION_DENIED', 'UNVERIFIED_ACCESS_ALLOWED', denied.status);
    }
    return { readDenied: true, writeDenied: true };
  });
  report.status = 'passed';
} catch (error) {
  report.error = error.safeCode || 'CLI_AUTH_OR_VERIFICATION_UNAVAILABLE';
} finally {
  try { await cleanup(); } catch { report.cleanup.passed = false; }
  if (!report.cleanup.passed) report.status = 'cleanup_failed';
  report.finishedAt = new Date().toISOString();
  try { await writeFile(output, JSON.stringify(report, null, 2) + '\n'); }
  catch { report.status = 'report_write_failed'; }
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exitCode = 1;
}

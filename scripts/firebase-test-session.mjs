import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const timeoutMs = 15_000;

class SessionError extends Error {
  constructor(code, status) { super(code); this.name = 'FirebaseTestSessionError'; this.code = code; if (status) this.status = status; }
}
function requireCheck(condition, code, status) { if (!condition) throw new SessionError(code, status); }
async function timed(task) {
  let timer;
  try { return await Promise.race([task, new Promise((_, reject) => { timer = setTimeout(() => reject(new SessionError('CLI_AUTH_TIMEOUT')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
function requireSafeResult(value, secrets, seen = new WeakSet()) {
  if (typeof value === 'string') requireCheck(!secrets.some(secret => secret && value.includes(secret)), 'CALLBACK_RESULT_CONTAINS_SESSION_DATA');
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    requireCheck(!/^(localId|uid|email|displayName|idToken|refreshToken|password|accessToken|authorization)$/i.test(key), 'CALLBACK_RESULT_CONTAINS_SESSION_DATA');
    requireSafeResult(item, secrets, seen);
  }
}

// The callback must stop QA activity and clear only its QA device session before resolving.
// No device access, logging, or account creation occurs merely by importing this module.
export async function withFirebaseTestSession(callback) {
  requireCheck(typeof callback === 'function', 'CALLBACK_REQUIRED');
  const nonce = randomUUID();
  const uid = `cine-device-qa-${nonce}`;
  const email = `cine-device-qa-${nonce}@example.invalid`;
  const password = `Cine!7Aa-${randomBytes(30).toString('base64url')}`;
  const displayName = 'Cine QA';
  const cleanup = { authUserAbsent: false, databasePathAbsent: false };
  const metrics = { requests: 0, requestBytes: 0, responseBytes: 0, cliAuthTransferExcluded: true };
  let config, cliApi, accessToken, databaseURL, attempted = false, callbackStarted = false, result, failure;

  async function request(url, { body, method = 'POST', headers = {} } = {}) {
    const parsed = new URL(url);
    requireCheck(parsed.protocol === 'https:' && ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'cloudresourcemanager.googleapis.com', 'cinemusic-1-default-rtdb.firebaseio.com'].includes(parsed.hostname), 'UNTRUSTED_ENDPOINT');
    const payload = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
    metrics.requests++; metrics.requestBytes += Buffer.byteLength(payload || '');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    let reader;
    try {
      const response = await fetch(url, { method, body: payload, headers: { ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, signal: controller.signal, redirect: 'manual' });
      reader = response.body?.getReader();
      const chunks = []; let size = 0;
      while (reader) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength; metrics.responseBytes += part.value.byteLength;
        requireCheck(size <= 16_384, 'RESPONSE_LIMIT', response.status); chunks.push(part.value);
      }
      let data;
      try { const text = Buffer.concat(chunks).toString('utf8'); data = text ? JSON.parse(text) : null; }
      catch { throw new SessionError('INVALID_SERVICE_RESPONSE', response.status); }
      return { data, status: response.status, ok: response.ok };
    } catch (error) {
      throw error instanceof SessionError ? error : new SessionError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR');
    } finally { clearTimeout(timer); controller.abort(); reader?.releaseLock(); }
  }
  function ok(response) { requireCheck(response.ok, 'FIREBASE_REQUEST_FAILED', response.status); return response.data; }
  function admin(path, body) { return request(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/${path}`, { body, headers: { Authorization: `Bearer ${accessToken}` } }); }
  function client(method, body) { return request(`https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(config.apiKey)}`, { body }); }
  function data(method) { return request(`${databaseURL}/users/${encodeURIComponent(uid)}.json`, { method, headers: { Authorization: `Bearer ${accessToken}` } }); }
  function absentUser(response) { return response.ok || response.status === 400 && response.data?.error?.message === 'USER_NOT_FOUND'; }

  async function removeSyntheticUser() {
    for (let attempt = 0; attempt < 3 && (!cleanup.authUserAbsent || !cleanup.databasePathAbsent); attempt++) {
      try { accessToken = await timed(cliApi.getAccessToken()); } catch { /* Retry configured CLI authorization without a login prompt. */ }
      if (!cleanup.authUserAbsent) {
        try {
          requireCheck(absentUser(await admin('accounts:delete', { localId: uid })), 'AUTH_DELETE_FAILED');
          cleanup.authUserAbsent = !ok(await admin('accounts:lookup', { localId: [uid] }))?.users?.length;
        } catch { /* All retries remain scoped to the UID checked absent before creation. */ }
      }
      if (!cleanup.databasePathAbsent) {
        try { ok(await data('DELETE')); cleanup.databasePathAbsent = ok(await data('GET')) === null; }
        catch { /* Never include a response, path, or original error in cleanup failures. */ }
      }
    }
    requireCheck(cleanup.authUserAbsent && cleanup.databasePathAbsent, 'SYNTHETIC_SESSION_CLEANUP_FAILED');
  }

  try {
    config = JSON.parse((await readFile(new URL('../mobile/public/firebase-config.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    requireCheck(config.projectId === 'cinemusic-1' && typeof config.apiKey === 'string' && config.apiKey, 'UNEXPECTED_PROJECT');
    requireCheck(new URL(config.databaseURL).href === 'https://cinemusic-1-default-rtdb.firebaseio.com/', 'UNEXPECTED_DATABASE');
    databaseURL = new URL(config.databaseURL).origin;
    const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm root --global'] : ['root', '--global'];
    const globalModules = execFileSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const cli = createRequire(join(globalModules, 'firebase-tools', 'package.json'));
    cli('./lib/logger.js').logger.silent = true;
    const auth = cli('./lib/auth.js'), options = { project: config.projectId, projectRoot: root, nonInteractive: true };
    const account = auth.getProjectDefaultAccount(root);
    if (account) auth.setActiveAccount(options, account);
    await timed(cli('./lib/requireAuth.js').requireAuth(options));
    cliApi = cli('./lib/apiv2.js'); accessToken = await timed(cliApi.getAccessToken());
    requireCheck(typeof accessToken === 'string' && accessToken.length > 20, 'CLI_AUTH_UNAVAILABLE');

    const permissions = ['firebaseauth.users.create', 'firebaseauth.users.get', 'firebaseauth.users.delete', 'firebasedatabase.instances.get', 'firebasedatabase.instances.update'];
    const granted = ok(await request(`https://cloudresourcemanager.googleapis.com/v1/projects/${config.projectId}:testIamPermissions`, { body: { permissions }, headers: { Authorization: `Bearer ${accessToken}` } }))?.permissions || [];
    requireCheck(permissions.every(permission => granted.includes(permission)), 'CLEANUP_NOT_AUTHORIZED');
    requireCheck(!ok(await admin('accounts:lookup', { localId: [uid] }))?.users?.length, 'SYNTHETIC_UID_COLLISION');
    requireCheck(ok(await data('GET')) === null, 'SYNTHETIC_PATH_COLLISION');
    requireCheck(absentUser(await admin('accounts:delete', { localId: uid })), 'AUTH_CLEANUP_UNAVAILABLE');
    ok(await data('DELETE'));

    attempted = true;
    const created = ok(await admin('accounts', { localId: uid, email, password, displayName, emailVerified: true }));
    requireCheck(created?.localId === uid, 'UNEXPECTED_CREATED_USER');
    const signed = ok(await client('accounts:signInWithPassword', { email, password, returnSecureToken: true }));
    requireCheck(signed?.localId === uid && typeof signed.refreshToken === 'string', 'SIGN_IN_MISMATCH');
    const refreshed = ok(await request(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, { body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: signed.refreshToken }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
    requireCheck(refreshed?.user_id === uid && typeof refreshed.id_token === 'string' && typeof refreshed.refresh_token === 'string', 'REFRESH_MISMATCH');
    const looked = ok(await client('accounts:lookup', { idToken: refreshed.id_token }));
    const verified = looked?.users?.[0];
    requireCheck(looked?.users?.length === 1 && verified.localId === uid && verified.email === email && verified.emailVerified === true && verified.displayName === displayName, 'VERIFIED_LOOKUP_FAILED');
    const claims = JSON.parse(Buffer.from(refreshed.id_token.split('.')[1], 'base64url').toString('utf8'));
    const expiresAt = Number(claims.exp) * 1000;
    requireCheck(claims.sub === uid && claims.email_verified === true && Number.isFinite(expiresAt) && expiresAt > Date.now() + 120_000, 'SESSION_NOT_FRESH');
    const user = Object.freeze({ localId: uid, email: verified.email, displayName: verified.displayName, idToken: refreshed.id_token, refreshToken: refreshed.refresh_token, expiresAt, emailVerified: true });
    callbackStarted = true;
    result = await callback(user);
    requireSafeResult(result, [uid, email, displayName, password, accessToken, signed.idToken, signed.refreshToken, user.idToken, user.refreshToken]);
  } catch (error) {
    failure = error instanceof SessionError ? error : new SessionError(callbackStarted ? 'QA_CALLBACK_FAILED' : 'QA_SESSION_SETUP_FAILED');
  } finally {
    if (attempted) {
      try { await removeSyntheticUser(); }
      catch { failure = new SessionError('SYNTHETIC_SESSION_CLEANUP_FAILED'); }
    }
  }
  const cleanupVerified = !attempted || cleanup.authUserAbsent && cleanup.databasePathAbsent;
  if (failure) { failure.cleanupVerified = cleanupVerified; failure.cleanup = { ...cleanup }; throw failure; }
  return { result, cleanupVerified, cleanup: { ...cleanup }, metrics };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = { checkedAt: new Date().toISOString(), passed: false, emailDeliveryTested: false, deviceTouched: false };
  try {
    requireCheck(process.argv.includes('--self-test'), 'SELF_TEST_FLAG_REQUIRED');
    const outcome = await withFirebaseTestSession(user => ({ verified: user.emailVerified, freshExpiry: user.expiresAt > Date.now() + 120_000, exactFields: Object.keys(user).sort().join(',') === 'displayName,email,emailVerified,expiresAt,idToken,localId,refreshToken' }));
    Object.assign(report, outcome, { passed: outcome.cleanupVerified && Object.values(outcome.result).every(value => value === true) });
  } catch (error) { report.error = error instanceof SessionError ? error.code : 'SELF_TEST_FAILED'; report.cleanupVerified = error.cleanupVerified === true; if (error.cleanup) report.cleanup = error.cleanup; }
  if (process.argv.includes('--self-test')) await writeFile(new URL('../.device-test/device-auth-helper-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

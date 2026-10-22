import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ googleSignIn: vi.fn() }));
vi.mock('./native', () => ({ ...native, subscribe: () => () => {} }));
let auth: typeof import('./FirebaseAuth');
let vault = '';
let storage: Map<string, string>;
const tokens = { localId: 'account-a', email: 'listener@example.test', idToken: 'test-id-token', refreshToken: 'test-refresh-token', expiresAt: Date.now() + 3_600_000 };
function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }

beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); vault = ''; storage = new Map();
  const target = new EventTarget();
  vi.stubGlobal('window', Object.assign(target, {
    setTimeout, clearTimeout, setInterval, clearInterval,
    location: { origin: 'https://appassets.androidplatform.net' },
    CineAndroid: { authTokens: () => vault, saveAuthTokens: vi.fn((value: string) => { vault = value; }), clearAuthTokens: vi.fn(() => { vault = ''; }) },
  }));
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  auth = await import('./FirebaseAuth');
});

describe('Firebase authentication contract', () => {
  it('looks up verification after real sign-in and trims only the email', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === '/firebase-config.json') return response({ apiKey: 'test-key' });
      if (url.includes('signInWithPassword')) return response({ ...tokens, expiresIn: '3600' });
      return response({ users: [{ ...tokens, emailVerified: true, displayName: 'Listener' }] });
    }));
    const user = await auth.signInCineUser('  listener@example.test  ', '  unchanged password  ');
    expect(user.emailVerified).toBe(true);
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({ email: tokens.email, password: '  unchanged password  ' });
    expect(requests[2].url).toContain('accounts:lookup');
    expect(vault).toBe('');
    expect(storage.size).toBe(0);
  });

  it('does not infer verification from a password-sign-in response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/firebase-config.json' ? response({ apiKey: 'test-key' }) : url.includes('lookup') ? response({ users: [{ ...tokens, emailVerified: false }] }) : response({ ...tokens, expiresIn: '3600', emailVerified: true })));
    expect((await auth.signInCineUser(tokens.email, 'password')).emailVerified).toBe(false);
  });

  it('uses fresh reauthentication credentials instead of an older saved ID token', async () => {
    auth.storeCineUser(tokens);
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === '/firebase-config.json') return response({ apiKey: 'test-key' });
      if (url.includes('signInWithPassword')) return response({ ...tokens, idToken: 'fresh-authentication', refreshToken: 'fresh-refresh', expiresIn: '3600' });
      return response({ users: [{ ...tokens, emailVerified: true }] });
    }));
    const result = await auth.reauthenticateCineUser(tokens, 'correct-current-password');
    expect(JSON.parse(String(requests.find(request => request.url.includes('lookup'))?.init?.body))).toEqual({ idToken: 'fresh-authentication' });
    expect(result.idToken).toBe('fresh-authentication');
    expect(auth.loadCineUser()?.idToken).toBe('fresh-authentication');
  });

  it('retains the secure session after a transient refresh failure', async () => {
    auth.storeCineUser(tokens);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { if (url === '/firebase-config.json') return response({ apiKey: 'test-key' }); throw new TypeError('offline'); }));
    await expect(auth.refreshCineUser(tokens)).rejects.toMatchObject({ code: 'NETWORK', invalidSession: false });
    expect(auth.loadCineUser()?.localId).toBe(tokens.localId);
    expect(window.CineAndroid?.clearAuthTokens).not.toHaveBeenCalled();
  });

  it('distinguishes revoked credentials from an ordinary network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/firebase-config.json' ? response({ apiKey: 'test-key' }) : response({ error: { message: 'INVALID_REFRESH_TOKEN' } }, 400)));
    await expect(auth.refreshCineUser(tokens)).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN', invalidSession: true });
  });

  it('deduplicates concurrent token refresh requests', async () => {
    const fetcher = vi.fn(async (url: string) => url === '/firebase-config.json' ? response({ apiKey: 'test-key' }) : response({ id_token: 'fresh-token', refresh_token: 'new-refresh', user_id: tokens.localId, expires_in: '3600' }));
    vi.stubGlobal('fetch', fetcher); auth.storeCineUser(tokens);
    const [a, b] = await Promise.all([auth.refreshCineUser(tokens), auth.refreshCineUser(tokens)]);
    expect(a).toEqual(b);
    expect(fetcher.mock.calls.filter(([url]) => url.includes('securetoken'))).toHaveLength(1);
    expect(auth.loadCineUser()?.idToken).toBe('fresh-token');
  });

  it('retries configuration after a recoverable configuration failure', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response({ apiKey: 'test-key', databaseURL: 'https://test-project-default-rtdb.firebaseio.com' }));
    vi.stubGlobal('fetch', fetcher);
    await expect(auth.getFirebaseDatabaseUrl()).rejects.toMatchObject({ code: 'CONFIG' });
    await expect(auth.getFirebaseDatabaseUrl()).resolves.toBe('https://test-project-default-rtdb.firebaseio.com');
  });

  it('keeps recovery neutral without hiding connection errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/firebase-config.json' ? response({ apiKey: 'test-key' }) : response({ error: { message: 'EMAIL_NOT_FOUND' } }, 400)));
    await expect(auth.requestCinePasswordReset(tokens.email)).resolves.toBeUndefined();
  });

  it('does not claim an expired password reset link succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/firebase-config.json' ? response({ apiKey: 'test-key' }) : response({ error: { message: 'EXPIRED_OOB_CODE' } }, 400)));
    await expect(auth.resetCinePassword({ mode: 'resetPassword', oobCode: 'expired-test-code' }, 'a sufficiently long password')).rejects.toMatchObject({ code: 'EXPIRED_OOB_CODE' });
  });

  it('requires real Google OAuth configuration instead of simulating login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ apiKey: 'test-key', googleWebClientId: '' })));
    await expect(auth.signInCineGoogle()).rejects.toMatchObject({ code: 'GOOGLE_CONFIG' });
    expect(native.googleSignIn).not.toHaveBeenCalled();
  });

  it('exchanges a Google provider token with Firebase and verifies the account', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    native.googleSignIn.mockResolvedValue('provider-id-token');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      if (url === '/firebase-config.json') return response({ apiKey: 'test-key', googleWebClientId: 'test-client.apps.googleusercontent.com' });
      if (url.includes('signInWithIdp')) return response({ ...tokens, expiresIn: '3600' });
      return response({ users: [{ ...tokens, emailVerified: true }] });
    }));
    expect((await auth.signInCineGoogle()).emailVerified).toBe(true);
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({ postBody: 'id_token=provider-id-token&providerId=google.com', returnSecureToken: true });
    expect(vault).toBe('');
  });

  it('validates the client password minimum before creating an account', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(auth.createCineUser(tokens.email, 'short')).rejects.toMatchObject({ code: 'PASSWORD' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('parses full and nested email-action links without inventing numeric codes', () => {
    expect(auth.parseAuthActionLink('https://test.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=test-code')).toEqual({ mode: 'verifyEmail', oobCode: 'test-code' });
    expect(auth.parseAuthActionLink('https://test.example/?link=' + encodeURIComponent('https://test.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=reset-code'))).toEqual({ mode: 'resetPassword', oobCode: 'reset-code' });
    expect(auth.parseAuthActionLink({ mode: 'unsupported', oobCode: '123456' })).toBeNull();
  });
});

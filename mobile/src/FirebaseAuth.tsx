import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from './Icons';
import { googleSignIn, subscribe } from './native';
import { Brand, ThemeEdition } from './ui';
import './account.css';

export interface CineUser {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  emailVerified?: boolean;
  expiresAt?: number;
}

interface FirebaseConfig { apiKey: string; databaseURL?: string; authDomain?: string; projectId?: string; googleWebClientId?: string }
type Json = Record<string, unknown>;
export type AuthAction = { mode: 'verifyEmail' | 'resetPassword' | 'verifyAndChangeEmail'; oobCode: string };
export const PASSWORD_MINIMUM = 12;
export const EMAIL_COOLDOWN_MS = 60_000;
const SESSION_EVENT = 'cine:session-changed';
let configTask: Promise<FirebaseConfig> | undefined;
let memoryUser: CineUser | null = null;
const refreshTasks = new Map<string, Promise<CineUser>>();

export class FirebaseError extends Error {
  constructor(public code: string, message: string, public invalidSession = false) { super(message); this.name = 'FirebaseError'; }
}

const serviceMessages: Record<string, string> = {
  EMAIL_EXISTS: 'This email is already in use. Log in or reset your password.',
  INVALID_LOGIN_CREDENTIALS: 'The email or password is incorrect.',
  INVALID_PASSWORD: 'The email or password is incorrect.',
  EMAIL_NOT_FOUND: 'The email or password is incorrect.',
  INVALID_EMAIL: 'Enter a valid email address.',
  MISSING_PASSWORD: 'Enter your password.',
  WEAK_PASSWORD: 'Firebase rejected this password. Choose a stronger password.',
  PASSWORD_DOES_NOT_MEET_REQUIREMENTS: 'This password does not meet the Firebase project policy. Use a longer password with upper and lower case letters, a number, and a symbol.',
  OPERATION_NOT_ALLOWED: 'This sign-in provider is not enabled in Firebase Authentication. Enable it in the project console.',
  INVALID_IDP_RESPONSE: 'Google could not verify this sign-in. Check the Google OAuth client and Firebase provider configuration.',
  FEDERATED_USER_ID_ALREADY_LINKED: 'This Google account is already linked to another account.',
  NEED_CONFIRMATION: 'An account already uses this email with another sign-in method. Log in with that method first.',
  PASSWORD_LOGIN_DISABLED: 'Password sign-in is disabled for this Firebase project.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a while before trying again.',
  QUOTA_EXCEEDED: 'Firebase has reached its email quota. Try again later.',
  USER_DISABLED: 'This account has been disabled. Log in with another account.',
  USER_NOT_FOUND: 'This account no longer exists. Log in again.',
  INVALID_REFRESH_TOKEN: 'Your session was revoked. Log in again.',
  TOKEN_EXPIRED: 'Your session was revoked or expired. Log in again.',
  INVALID_GRANT: 'Your session was revoked. Log in again.',
  INVALID_ID_TOKEN: 'Your session needs to be refreshed. Try again.',
  ID_TOKEN_EXPIRED: 'Your session needs to be refreshed. Try again.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Confirm your current password to continue.',
  REQUIRES_RECENT_LOGIN: 'Confirm your current password to continue.',
  EXPIRED_OOB_CODE: 'This email link has expired. Request a new link.',
  INVALID_OOB_CODE: 'This email link is invalid or has already been used. Request a new link.',
  API_KEY_INVALID: 'The Firebase API key is not valid. Check the project configuration.',
  INVALID_API_KEY: 'The Firebase API key is not valid. Check the project configuration.',
  PROJECT_NOT_FOUND: 'The configured Firebase project was not found.',
  UNAUTHORIZED_DOMAIN: 'This app domain is not authorized in Firebase Authentication.',
};

export async function firebaseFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', cancel, { once: true });
  const timer = window.setTimeout(cancel, 20_000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch { throw new FirebaseError('NETWORK', 'Could not reach Firebase. Check your connection and try again. Your saved session and local changes are kept.'); }
  finally { window.clearTimeout(timer); init?.signal?.removeEventListener('abort', cancel); }
}

async function firebaseConfig(): Promise<FirebaseConfig> {
  if (!configTask) {
    configTask = (async () => {
      const response = await firebaseFetch('/firebase-config.json', { cache: 'no-cache' });
      if (!response.ok) throw new FirebaseError('CONFIG', 'Firebase configuration is unavailable in this build.');
      let config: FirebaseConfig;
      try { config = await response.json() as FirebaseConfig; }
      catch { throw new FirebaseError('CONFIG', 'Firebase configuration is not valid JSON.'); }
      if (typeof config.apiKey !== 'string' || !config.apiKey) throw new FirebaseError('CONFIG', 'The Firebase API key is missing.');
      return config;
    })().catch(error => { configTask = undefined; throw error; });
  }
  return configTask;
}

export async function getFirebaseDatabaseUrl(): Promise<string> {
  const { databaseURL } = await firebaseConfig();
  if (!databaseURL) throw new FirebaseError('CONFIG', 'No Realtime Database URL is configured. Your library is saved on this device.');
  try {
    const url = new URL(databaseURL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !/\.(firebaseio\.com|firebasedatabase\.app)$/.test(url.hostname) || !['', '/'].includes(url.pathname)) throw new Error();
    return url.origin;
  } catch { throw new FirebaseError('CONFIG', 'The configured Realtime Database URL is invalid. No database location has been assumed.'); }
}

function validUser(value: unknown): value is CineUser {
  const user = value as Partial<CineUser> | null;
  return Boolean(user && typeof user.localId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(user.localId) && typeof user.idToken === 'string' && user.idToken && typeof user.refreshToken === 'string' && user.refreshToken && typeof user.email === 'string');
}

export function loadCineUser(): CineUser | null {
  if (!window.CineAndroid) return memoryUser;
  try {
    const stored: unknown = JSON.parse(window.CineAndroid.authTokens() || 'null');
    memoryUser = validUser(stored) ? stored : null;
  } catch { /* A temporarily unavailable vault must not invalidate an in-memory session. */ }
  return memoryUser;
}

export function storeCineUser(user: CineUser | null): void {
  if (user && !validUser(user)) throw new FirebaseError('SESSION', 'Firebase returned an incomplete session. Please log in again.');
  try {
    if (window.CineAndroid) {
      if (user) window.CineAndroid.saveAuthTokens(JSON.stringify(user));
      else window.CineAndroid.clearAuthTokens();
    }
  } catch { throw new FirebaseError('VAULT', 'The secure Android session store is unavailable. Try again.'); }
  memoryUser = user;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

async function readServiceResponse<T>(response: Response, refresh = false): Promise<T> {
  let result: Json;
  try { result = await response.json() as Json; }
  catch { throw new FirebaseError('RESPONSE', 'Firebase returned an unreadable response. Try again.'); }
  if (!response.ok) {
    const detail = result.error as { message?: string } | undefined;
    const raw = typeof detail?.message === 'string' ? detail.message : 'REQUEST_FAILED';
    const code = raw.split(/[ :]/, 1)[0];
    const invalid = ['USER_DISABLED', 'USER_NOT_FOUND', 'INVALID_REFRESH_TOKEN', 'TOKEN_EXPIRED', 'INVALID_GRANT'].includes(code);
    const message = serviceMessages[code] || (response.status === 403 ? 'Firebase denied this request. Check the API restrictions and enabled services.' : 'Firebase could not complete this request. Please try again.');
    throw new FirebaseError(code, message, invalid && (refresh || ['USER_DISABLED', 'USER_NOT_FOUND'].includes(code)));
  }
  return result as T;
}

export async function firebaseCall<T = Json>(method: string, data: Json): Promise<T> {
  const config = await firebaseConfig();
  const response = await firebaseFetch(`https://identitytoolkit.googleapis.com/v1/${method}?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  return readServiceResponse<T>(response);
}

function sessionFrom(result: Json, previous?: CineUser): CineUser {
  const seconds = Number(result.expiresIn ?? result.expires_in);
  const user: CineUser = {
    ...previous,
    idToken: String(result.idToken ?? result.id_token ?? previous?.idToken ?? ''),
    refreshToken: String(result.refreshToken ?? result.refresh_token ?? previous?.refreshToken ?? ''),
    localId: String(result.localId ?? result.user_id ?? previous?.localId ?? ''),
    email: String(result.email ?? previous?.email ?? ''),
    displayName: typeof result.displayName === 'string' ? result.displayName : previous?.displayName,
    expiresAt: Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : previous?.expiresAt,
  };
  if (!validUser(user)) throw new FirebaseError('RESPONSE', 'Firebase returned an incomplete session. Please try again.');
  return user;
}

function persistIfCurrent(previous: CineUser, fresh: CineUser): void {
  const current = loadCineUser();
  if (current?.localId === previous.localId && current.refreshToken === previous.refreshToken) storeCineUser(fresh);
}

export async function refreshCineUser(user: CineUser): Promise<CineUser> {
  const existing = refreshTasks.get(user.refreshToken);
  if (existing) return existing;
  const task = (async () => {
    const config = await firebaseConfig();
    const response = await firebaseFetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: user.refreshToken }).toString(),
    });
    const result = await readServiceResponse<Json>(response, true);
    const fresh = sessionFrom(result, user);
    if (fresh.localId !== user.localId) throw new FirebaseError('SESSION', 'The refreshed session does not match this account.', true);
    persistIfCurrent(user, fresh);
    return fresh;
  })();
  refreshTasks.set(user.refreshToken, task);
  try { return await task; } finally { refreshTasks.delete(user.refreshToken); }
}

export async function freshCineUser(user: CineUser): Promise<CineUser> {
  const stored = loadCineUser();
  const latest = stored?.localId === user.localId ? stored : user;
  return !latest.expiresAt || latest.expiresAt <= Date.now() + 120_000 ? refreshCineUser(latest) : latest;
}

export async function withCineSession<T>(user: CineUser, action: (fresh: CineUser) => Promise<T>): Promise<T> {
  let fresh = await freshCineUser(user);
  try { return await action(fresh); }
  catch (error) {
    if (!(error instanceof FirebaseError) || !['ID_TOKEN_EXPIRED', 'INVALID_ID_TOKEN'].includes(error.code)) throw error;
    fresh = await refreshCineUser(fresh);
    return action(fresh);
  }
}

export async function lookupCineUser(user: CineUser, useSavedSession = true): Promise<CineUser> {
  const lookup = async (fresh: CineUser) => {
    const result = await firebaseCall<{ users?: Json[] }>('accounts:lookup', { idToken: fresh.idToken });
    const record = result.users?.[0];
    if (!record || record.localId !== user.localId) throw new FirebaseError('USER_NOT_FOUND', 'This account no longer exists. Log in again.', true);
    const verified: CineUser = { ...fresh, email: String(record.email || fresh.email), displayName: String(record.displayName || ''), photoUrl: typeof record.photoUrl === 'string' ? record.photoUrl : undefined, emailVerified: record.emailVerified === true };
    persistIfCurrent(fresh, verified);
    return verified;
  };
  return useSavedSession ? withCineSession(user, lookup) : lookup(user);
}

export async function signInCineUser(email: string, password: string): Promise<CineUser> {
  const result = await firebaseCall('accounts:signInWithPassword', { email: email.trim(), password, returnSecureToken: true });
  // signInWithPassword does not report emailVerified. Only lookup can establish it.
  return lookupCineUser(sessionFrom(result), false);
}

export async function createCineUser(email: string, password: string): Promise<CineUser> {
  if (password.length < PASSWORD_MINIMUM) throw new FirebaseError('PASSWORD', `Use at least ${PASSWORD_MINIMUM} characters.`);
  return { ...sessionFrom(await firebaseCall('accounts:signUp', { email: email.trim(), password, returnSecureToken: true })), emailVerified: false };
}

export async function updateCineDisplayName(user: CineUser, displayName: string): Promise<CineUser> {
  const name = displayName.trim();
  if (!name || name.length > 60 || /[\u0000-\u001f]/.test(name)) throw new FirebaseError('PROFILE', 'Use a display name between 1 and 60 characters.');
  return withCineSession(user, async fresh => {
    const result = await firebaseCall('accounts:update', { idToken: fresh.idToken, displayName: name, returnSecureToken: true });
    const updated = { ...sessionFrom(result, fresh), displayName: name };
    persistIfCurrent(fresh, updated);
    return updated;
  });
}

export async function sendCineVerification(user: CineUser): Promise<void> {
  await withCineSession(user, fresh => firebaseCall('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: fresh.idToken }));
}

export async function requestCinePasswordReset(email: string): Promise<void> {
  try { await firebaseCall('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email: email.trim() }); }
  catch (error) { if (!(error instanceof FirebaseError && error.code === 'EMAIL_NOT_FOUND')) throw error; }
}

export async function signInCineGoogle(): Promise<CineUser> {
  const config = await firebaseConfig();
  if (!config.googleWebClientId || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(config.googleWebClientId)) throw new FirebaseError('GOOGLE_CONFIG', 'Google sign-in needs the Google provider enabled in Firebase and its Web OAuth client ID in firebase-config.json. The supplied Android configuration does not contain an OAuth client.');
  let idToken: string;
  try { idToken = await googleSignIn(config.googleWebClientId); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new FirebaseError('GOOGLE', error instanceof Error ? error.message : 'Google sign-in is not available on this device.'); }
  const result = await firebaseCall('accounts:signInWithIdp', { requestUri: 'http://localhost', postBody: new URLSearchParams({ id_token: idToken, providerId: 'google.com' }).toString(), returnSecureToken: true, returnIdpCredential: true });
  if (result.needConfirmation) throw new FirebaseError('NEED_CONFIRMATION', serviceMessages.NEED_CONFIRMATION);
  return lookupCineUser(sessionFrom(result), false);
}

export async function reauthenticateCineUser(user: CineUser, password: string): Promise<CineUser> {
  const result = await signInCineUser(user.email, password);
  if (result.localId !== user.localId) throw new FirebaseError('SESSION', 'The credentials do not match the current account.');
  if (loadCineUser()?.localId === user.localId) storeCineUser(result);
  return result;
}

export async function changeCineEmail(user: CineUser, password: string, newEmail: string): Promise<void> {
  const fresh = await reauthenticateCineUser(user, password);
  await firebaseCall('accounts:sendOobCode', { requestType: 'VERIFY_AND_CHANGE_EMAIL', idToken: fresh.idToken, newEmail: newEmail.trim() });
}

export async function changeCinePassword(user: CineUser, password: string, newPassword: string): Promise<void> {
  if (newPassword.length < PASSWORD_MINIMUM) throw new FirebaseError('PASSWORD', `Use at least ${PASSWORD_MINIMUM} characters for your new password.`);
  const fresh = await reauthenticateCineUser(user, password);
  const result = await firebaseCall('accounts:update', { idToken: fresh.idToken, password: newPassword, returnSecureToken: true });
  persistIfCurrent(fresh, sessionFrom(result, fresh));
}

export function parseAuthActionLink(input: string | Record<string, unknown>): AuthAction | null {
  try {
    let params: URLSearchParams;
    if (typeof input === 'string') {
      let url = new URL(input, window.location.origin);
      const nested = url.searchParams.get('link');
      if (nested) url = new URL(nested);
      params = url.searchParams;
    } else if (typeof input.url === 'string') return parseAuthActionLink(input.url);
    else params = new URLSearchParams({ mode: String(input.mode || ''), oobCode: String(input.oobCode || '') });
    const mode = params.get('mode'), oobCode = params.get('oobCode');
    if (!['verifyEmail', 'resetPassword', 'verifyAndChangeEmail'].includes(mode || '') || !oobCode || oobCode.length > 2048) return null;
    return { mode: mode as AuthAction['mode'], oobCode };
  } catch { return null; }
}

export async function applyCineEmailAction(action: AuthAction): Promise<string> {
  if (action.mode === 'resetPassword') throw new FirebaseError('ACTION', 'Use the new-password form for this reset link.');
  const result = await firebaseCall<{ email?: string }>('accounts:update', { oobCode: action.oobCode });
  return result.email || '';
}

export async function resetCinePassword(action: AuthAction, password: string): Promise<string> {
  if (action.mode !== 'resetPassword') throw new FirebaseError('ACTION', 'This is not a password reset link.');
  if (password.length < PASSWORD_MINIMUM) throw new FirebaseError('PASSWORD', `Use at least ${PASSWORD_MINIMUM} characters.`);
  const result = await firebaseCall<{ email?: string }>('accounts:resetPassword', { oobCode: action.oobCode, newPassword: password });
  return result.email || '';
}

export function useEmailCooldown(): [number, () => void] {
  const [until, setUntil] = useState(0), [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return [Math.max(0, Math.ceil((until - now) / 1000)), () => { setNow(Date.now()); setUntil(Date.now() + EMAIL_COOLDOWN_MS); }];
}

type View = 'welcome' | 'login' | 'signup' | 'recovery' | 'sent' | 'verify' | 'action' | 'reset' | 'link';

export function FirebaseAuth({ onClose, onSuccess, initialUser }: { onClose: () => void; onSuccess: (user: CineUser) => void; initialUser?: CineUser | null }) {
  const [action, setAction] = useState<AuthAction | null>(() => parseAuthActionLink(window.location.href));
  const [view, setView] = useState<View>(action ? action.mode === 'resetPassword' ? 'reset' : 'action' : initialUser ? 'verify' : 'welcome');
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [link, setLink] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [googlePending, setGooglePending] = useState(false);
  const [pending, setPending] = useState<CineUser | null>(initialUser || null);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [cooldown, startCooldown] = useEmailCooldown();
  const inFlight = useRef(false), consumed = useRef('');
  const mounted = useRef(true);
  const panel = useRef<HTMLElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const nativeGoogleAvailable = typeof window.CineAndroid?.googleSignIn === 'function';

  useEffect(() => {
    if (error) {
      feedback.current?.focus({ preventScroll: true });
      feedback.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [error]);

  function goBack() {
    if (inFlight.current) return;
    if (view === 'welcome') onClose();
    else navigate(view === 'recovery' || view === 'sent' || view === 'signup' ? 'login' : 'welcome');
  }
  const backRef = useRef(goBack); backRef.current = goBack;
  useEffect(() => {
    function back(event: Event) {
      if (event.defaultPrevented || !panel.current?.getClientRects().length) return;
      event.preventDefault(); event.stopImmediatePropagation(); backRef.current();
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') back(event); }
    window.addEventListener('cine:back', back, true); window.addEventListener('keydown', escape, true);
    return () => { window.removeEventListener('cine:back', back, true); window.removeEventListener('keydown', escape, true); };
  }, []);

  useEffect(() => {
    mounted.current = true;
    const receive = (input: string | Record<string, unknown>) => {
      const incoming = parseAuthActionLink(input);
      if (!incoming || incoming.oobCode === consumed.current) return;
      consumed.current = incoming.oobCode;
      setAction(incoming); setError(''); setNotice(''); setView(incoming.mode === 'resetPassword' ? 'reset' : 'action');
    };
    const listener = (event: Event) => receive((event as CustomEvent<Record<string, unknown>>).detail || {});
    const unsubscribe = subscribe(event => { if (event.type === 'authLink') receive(event.data); });
    window.addEventListener('cine:auth-link', listener);
    const url = new URL(window.location.href);
    if (url.searchParams.has('oobCode')) {
      ['mode', 'oobCode', 'apiKey', 'continueUrl', 'lang'].forEach(key => url.searchParams.delete(key));
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    return () => { mounted.current = false; unsubscribe(); window.removeEventListener('cine:auth-link', listener); };
  }, []);

  function navigate(next: View) { if (inFlight.current) return; setView(next); setError(''); setNotice(''); }
  async function run(task: () => Promise<void>, event?: FormEvent) {
    event?.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try { await task(); }
    catch (reason) { if (mounted.current) { if (reason instanceof DOMException && reason.name === 'AbortError') setNotice('Google sign-in was cancelled. Your form is ready to use.'); else setError(reason instanceof FirebaseError ? reason.message : 'This request could not be completed. Please try again.'); } }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  function finish(user: CineUser) {
    if (!mounted.current) return;
    if (!user.emailVerified) throw new FirebaseError('VERIFY', 'Verify your email before opening your music library.');
    storeCineUser(user); setPassword(''); setConfirm(''); onSuccess(user);
  }
  async function signIn() {
    const user = await signInCineUser(email, password);
    if (!mounted.current) return;
    if (!user.emailVerified) { setPending(user); setVerificationRequested(false); setView('verify'); setNotice('Your password was accepted. Verify your email to finish signing in.'); return; }
    finish(user);
  }
  async function signInGoogle() {
    setGooglePending(true);
    try {
      const user = await signInCineGoogle();
      if (!mounted.current) return;
      if (!user.emailVerified) { setPending(user); setView('verify'); setNotice('Verify your account email to finish signing in.'); return; }
      finish(user);
    } finally { if (mounted.current) setGooglePending(false); }
  }
  async function signUp() {
    const displayName = name.trim() || email.split('@')[0].slice(0, 60);
    let user = await createCineUser(email, password);
    if (!mounted.current) return;
    setPending(user); setVerificationRequested(false); setView('verify'); setPassword('');
    try { user = await updateCineDisplayName(user, displayName); setPending(user); }
    catch { setNotice('Account created. You can add your display name in Edit profile after verifying your email.'); }
    await sendCineVerification(user);
    if (mounted.current) { setVerificationRequested(true); startCooldown(); setNotice('Verification email requested. Open the link in your inbox, then check verification here. If you cannot find it, check your spam or junk folder.'); }
  }
  async function checkVerified() {
    if (!pending) throw new FirebaseError('SESSION', 'Log in first, then check your email verification.');
    const verified = await lookupCineUser(pending);
    if (!verified.emailVerified) throw new FirebaseError('VERIFY', 'Verification is not complete. Open the email link first, then check again.');
    // Refresh so the database receives the updated email_verified claim.
    finish({ ...await refreshCineUser(verified), emailVerified: true });
  }
  async function resend() {
    if (!pending || cooldown) return;
    await sendCineVerification(pending); setVerificationRequested(true); startCooldown(); setNotice('A verification email was requested. Check your inbox, spam, or junk folder.');
  }
  async function recover() {
    if (cooldown) return;
    await requestCinePasswordReset(email); startCooldown(); setView('sent');
  }
  async function applyAction() {
    if (!action) throw new FirebaseError('ACTION', 'Open a valid Firebase email link first.');
    const confirmedEmail = await applyCineEmailAction(action);
    if (confirmedEmail) setEmail(confirmedEmail);
    if (pending && action.mode === 'verifyEmail') {
      const verified = await lookupCineUser(pending);
      if (verified.emailVerified) { finish({ ...await refreshCineUser(verified), emailVerified: true }); return; }
    }
    const current = loadCineUser();
    if (current) {
      const updated = await lookupCineUser(await refreshCineUser(current));
      storeCineUser(updated);
    }
    setAction(null); setView('login'); setNotice('Your email link was confirmed by Firebase. You can now log in.');
  }
  async function reset() {
    if (!action) throw new FirebaseError('ACTION', 'Open a valid password reset link first.');
    if (password !== confirm) throw new FirebaseError('PASSWORD', 'The passwords do not match.');
    const resetEmail = await resetCinePassword(action, password);
    if (resetEmail) setEmail(resetEmail);
    setPassword(''); setConfirm(''); setAction(null); setView('login'); setNotice('Firebase updated your password. Log in with your new password.');
  }
  const headings: Record<View, string> = {
    welcome: 'Hear beyond the ordinary.', login: 'Good to hear\nyou again.', signup: 'Your next chapter\nsounds like you.', recovery: 'Reset your password.', sent: 'Check your email.', verify: 'Verify your email.', action: action?.mode === 'verifyAndChangeEmail' ? 'Confirm your new email.' : 'Confirm your email.', reset: 'Choose a new password.', link: 'Open your email link.',
  };
  const passwordField = (confirmation = false) => <label className="account-field" htmlFor={confirmation ? 'auth-confirm-password' : 'auth-password'}>{confirmation ? 'Confirm new password' : view === 'reset' ? 'New password' : 'Password'}<span className="account-password"><input id={confirmation ? 'auth-confirm-password' : 'auth-password'} name={confirmation ? 'confirmPassword' : 'password'} type={showPassword ? 'text' : 'password'} autoComplete={view === 'login' ? 'current-password' : 'new-password'} value={confirmation ? confirm : password} onChange={event => confirmation ? setConfirm(event.target.value) : setPassword(event.target.value)} minLength={view === 'login' ? undefined : PASSWORD_MINIMUM} required aria-describedby={view === 'login' ? undefined : 'password-policy'} /><button type="button" aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>;
  const emailField = <label className="account-field" htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>;
  const policy = <p className="account-help" id="password-policy">Cine music asks for at least {PASSWORD_MINIMUM} characters. Firebase may require additional complexity; its policy is checked when you submit.</p>;
  const submitButton = (label: string, working: string) => <button className="account-primary auth-submit" type="submit" disabled={busy}><span>{busy ? working : label}</span><Icon name="arrow_right" size={20} /></button>;

  if (view === 'welcome') return <section className="auth-panel account-auth design-welcome" data-auth-view="welcome" aria-busy={busy} ref={panel}>
    <header className="welcome-brand"><Brand /><ThemeEdition /></header>
    <div className="welcome-sculpture"><div className="welcome-logo"><Brand compact /></div><span className="welcome-signature"><Icon name="lyrics" size={14} />FEEL EVERY FREQUENCY</span></div>
    <div className="welcome-message"><h1>Hear beyond<br />the ordinary.</h1><p>A world of sound, tuned to you.<br />Find your next feeling.</p></div>
    <div className="welcome-actions"><button className="account-primary auth-submit" type="button" onClick={() => navigate('signup')}><span>Get started</span><Icon name="arrow_right" size={20} /></button><p>Already have an account? <button type="button" onClick={() => navigate('login')}>Log in</button></p></div>
  </section>;

  return <section className="auth-panel account-auth" data-auth-view={view} aria-busy={busy} ref={panel}>
    <button className="account-back" type="button" aria-label="Back" disabled={busy} onClick={goBack}><Icon name="back" size={18} /></button>
    <div className="auth-brand"><Brand /></div>
    <h1>{headings[view]}</h1>
    {(view === 'login' || view === 'signup') && <><p className="auth-description">{view === 'login' ? 'Log in to your own little universe.' : 'Create an account. Make yourself at home.'}</p>{view === 'login' && <div className="listening-signature"><span>THE WORLD OFF. THE MUSIC ON.</span><span aria-hidden="true">▂▅▇▃▆▂▅</span></div>}{nativeGoogleAvailable ? <><GoogleButton busy={busy} onClick={() => void run(signInGoogle)} /><div className="auth-divider">or with email</div></> : <p className="account-help">Use your email and password in this browser preview. Google sign-in is available in the Android app.</p>}</>}
    {error && <p className="account-error" role="alert" ref={feedback} tabIndex={-1}>{error}</p>}{notice && <p className="account-notice" role="status">{notice}</p>}
    {googlePending && window.CineAndroid?.cancelGoogleSignIn && <button type="button" className="account-secondary" onClick={() => window.CineAndroid?.cancelGoogleSignIn?.()}>Cancel Google sign-in</button>}
    {view === 'login' && <form onSubmit={event => void run(signIn, event)}><fieldset disabled={busy}>{emailField}{passwordField()}<button className="account-text" type="button" onClick={() => navigate('recovery')}>Forgot password?</button>{submitButton('Log in', 'Logging in...')}<p className="account-switch">New here? <button type="button" onClick={() => navigate('signup')}>Create an account</button></p></fieldset></form>}
    {view === 'signup' && <form onSubmit={event => void run(signUp, event)}><fieldset disabled={busy}>{emailField}{passwordField()}{policy}{submitButton('Create account', 'Creating account...')}<p className="account-switch">Already have an account? <button type="button" onClick={() => navigate('login')}>Log in</button></p></fieldset></form>}
    {view === 'recovery' && <form onSubmit={event => void run(recover, event)}><fieldset disabled={busy}><p className="account-intro">Request a real password reset link from Firebase. This screen will confirm only after the service accepts the request.</p>{emailField}<button className="account-primary" disabled={busy || cooldown > 0}>{busy ? 'Requesting link...' : cooldown ? `Try again in ${cooldown}s` : 'Send reset link'}</button><button className="account-text" type="button" onClick={() => navigate('link')}>Use an existing reset link</button></fieldset></form>}
    {view === 'sent' && <><p className="account-intro">If an eligible account uses that email, a password reset link will arrive. If it is not in your inbox, check your spam or junk folder.</p><button className="account-primary" onClick={() => navigate('login')}>Return to log in</button><button className="account-secondary" disabled={busy || cooldown > 0} onClick={() => void run(recover)}>{cooldown ? `Request another in ${cooldown}s` : 'Request another link'}</button><button className="account-text" onClick={() => navigate('link')}>Open the link here</button></>}
    {view === 'verify' && <>
      <p className="account-intro">{verificationRequested ? 'A verification email was requested for ' : 'Verify your email to finish signing in: '}<strong>{pending?.email || email}</strong>.</p>
      <p className="account-help">{verificationRequested ? 'Open the link in your inbox, then check verification below. If it has not arrived, check spam or junk, or request another link.' : 'Send a verification link below. If you already opened a verification email, choose Check email verification.'}</p>
      <button className={verificationRequested ? 'account-secondary' : 'account-primary'} disabled={busy || cooldown > 0} onClick={() => void run(resend)}>{cooldown ? `Resend in ${cooldown}s` : verificationRequested ? 'Resend verification link' : 'Send verification link'}</button>
      <button className={verificationRequested ? 'account-primary' : 'account-secondary'} disabled={busy} onClick={() => void run(checkVerified)}>Check email verification</button>
      <button className="account-text" disabled={busy} onClick={() => navigate('link')}>Open verification link here</button>
      <button className="account-text" disabled={busy} onClick={() => { setPending(null); setVerificationRequested(false); navigate('login'); }}>Use another account</button>
    </>}
    {view === 'action' && <><p className="account-intro">Confirm this email action with Firebase. An expired or previously used link will show an error instead of a success message.</p><button className="account-primary" disabled={busy} onClick={() => void run(applyAction)}>{busy ? 'Confirming...' : action?.mode === 'verifyAndChangeEmail' ? 'Confirm email change' : 'Verify email'}</button><button className="account-text" disabled={busy} onClick={() => navigate('link')}>Use a different link</button></>}
    {view === 'reset' && <form onSubmit={event => void run(reset, event)}><fieldset disabled={busy}><p className="account-intro">Set a new password using the reset link you opened.</p>{passwordField()}{passwordField(true)}{policy}{submitButton('Save new password', 'Saving password...')}<button className="account-text" type="button" onClick={() => navigate('recovery')}>Request a new reset link</button></fieldset></form>}
    {view === 'link' && <form onSubmit={event => { event.preventDefault(); const parsed = parseAuthActionLink(link); if (!parsed) { setError('Paste the complete verification or password reset URL from your Firebase email.'); return; } setAction(parsed); setError(''); setView(parsed.mode === 'resetPassword' ? 'reset' : 'action'); }}><label className="account-field" htmlFor="auth-action-link">Email action link<input id="auth-action-link" name="actionLink" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" autoComplete="off" value={link} onChange={event => setLink(event.target.value)} placeholder="https://.../__/auth/action?..." required /></label><p className="account-help">Only Firebase verification, email-change, and password-reset links are supported. The service validates the link.</p>{submitButton('Continue with link', 'Checking...')}</form>}
  </section>;
}

function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return <button className="account-secondary google-signin" type="button" disabled={busy} onClick={onClick}><svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11c-.5 2.8-2 5.1-4.3 6.7v5.6h7c4.1-3.8 5.9-9.4 5.9-16.3Z"/><path fill="#34A853" d="M24 44c5.9 0 10.8-2 14.4-5.3l-7-5.4c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.6v5.6A21.7 21.7 0 0 0 24 44Z"/><path fill="#FBBC05" d="M11.8 26.4a13 13 0 0 1 0-8.8V12H4.6a21.7 21.7 0 0 0 0 20l7.2-5.6Z"/><path fill="#EA4335" d="M24 13c3.2 0 6 1.1 8.2 3.2l6.1-6.1A20.7 20.7 0 0 0 24 4 21.7 21.7 0 0 0 4.6 16l7.2 5.6A12.9 12.9 0 0 1 24 13Z"/></svg><span>Continue with Google</span></button>;
}

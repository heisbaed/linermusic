import { isAnalyticsEvent, type AnalyticsEvent, type AnalyticsSurface } from './analytics';

export interface FirebaseAppConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  databaseURL: string;
}

export interface DashboardAuth {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  localId: string;
}

export class AuthError extends Error {}

let configPromise: Promise<FirebaseAppConfig> | null = null;

async function request(url: string, options: RequestInit = {}): Promise<Response> {
  const controller=new AbortController(),parent=options.signal;
  const cancel=()=>controller.abort();
  parent?.addEventListener('abort',cancel,{once:true});
  if(parent?.aborted)cancel();
  const timer=setTimeout(cancel,15000);
  try { return await fetch(url,{...options,signal:controller.signal}); }
  catch(error) {
    if(parent?.aborted)throw error;
    throw new Error('Could not connect. Check your connection and try again.');
  } finally { clearTimeout(timer);parent?.removeEventListener('abort',cancel); }
}

export function loadFirebaseAppConfig(): Promise<FirebaseAppConfig> {
  if (!configPromise) {
    configPromise = request('/firebase-config.json', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Firebase configuration could not be loaded.');
      const data = await response.json() as Partial<FirebaseAppConfig>;
      if (!data.apiKey || !data.databaseURL) throw new Error('Firebase configuration is incomplete.');
      return data as FirebaseAppConfig;
    }).catch(error => { configPromise = null; throw error; });
  }
  return configPromise;
}

function authMessage(code: string | undefined): string {
  switch (code) {
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'That email and password do not match an account.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'USER_DISABLED':
      return 'This account has been disabled.';
    default:
      return 'Sign in failed. Check your connection and try again.';
  }
}

async function identityRequest(path: string, body: unknown): Promise<Record<string, unknown>> {
  const config = await loadFirebaseAppConfig();
  const response = await request(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new AuthError(authMessage(data.error?.message));
  return data;
}

function toAuth(data: Record<string, unknown>): DashboardAuth {
  return {
    idToken: String(data.idToken || ''),
    refreshToken: String(data.refreshToken || ''),
    expiresAt: Date.now() + Math.max(60, Number(data.expiresIn) || 3600) * 1000,
    email: String(data.email || ''),
    localId: String(data.localId || data.userId || ''),
  };
}

export async function signInWithPassword(email: string, password: string): Promise<DashboardAuth> {
  const data = await identityRequest('accounts:signInWithPassword', { email, password, returnSecureToken: true });
  return toAuth(data);
}

export async function refreshDashboardAuth(auth: DashboardAuth): Promise<DashboardAuth> {
  const config = await loadFirebaseAppConfig();
  const response = await request(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refreshToken }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new AuthError(data.error?.message || 'Your session expired. Sign in again.');
  return {
    idToken: String(data.id_token || ''),
    refreshToken: String(data.refresh_token || auth.refreshToken),
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000,
    email: auth.email,
    localId: String(data.user_id || auth.localId),
  };
}

export async function fetchAnalyticsEvents(
  surface: AnalyticsSurface,
  since: number,
  auth: DashboardAuth,
  signal?: AbortSignal,
): Promise<AnalyticsEvent[]> {
  const config = await loadFirebaseAppConfig();
  const params = new URLSearchParams({
    auth: auth.idToken,
    orderBy: '"timestamp"',
    startAt: String(Math.max(0, Math.floor(since))),
    limitToLast: '50000',
  });
  const response = await request(`${config.databaseURL}/analytics/${surface}/events.json?${params.toString()}`, { signal });
  if (response.status === 401 || response.status === 403) throw new AuthError('The analytics feed rejected this account.');
  if (!response.ok) throw new Error('Analytics data could not be loaded.');
  const data = await response.json() as Record<string, unknown> | null;
  if (!data) return [];
  return Object.entries(data).flatMap(([id,value]) => isAnalyticsEvent(value) && value.surface === surface && value.id === id ? [value] : []);
}

export function adminEmails(): string[] {
  const configured = String(import.meta.env.VITE_DASHBOARD_ADMINS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return configured.length ? configured : ['charlesbabuu0@gmail.com'];
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

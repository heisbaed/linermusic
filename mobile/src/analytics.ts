export type AnalyticsSurface = 'mobile' | 'tv';
export type AnalyticsPlatform = 'android' | 'android-tv' | 'web';
export type AnalyticsEventName =
  | 'app_open'
  | 'app_install'
  | 'session_start'
  | 'session_heartbeat'
  | 'session_end'
  | 'page_view'
  | 'search'
  | 'play'
  | 'pause'
  | 'resume'
  | 'skip'
  | 'complete'
  | 'download_start'
  | 'download_complete'
  | 'download_failed'
  | 'playlist_add'
  | 'lyrics_view'
  | 'radio_open'
  | 'radio_play'
  | 'connect_pair'
  | 'connect_select'
  | 'theme_change'
  | 'sign_in'
  | 'sign_out'
  | 'ota_check';

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  surface: AnalyticsSurface;
  path: string;
  timestamp: number;
  sessionId: string;
  device: 'mobile' | 'tablet' | 'desktop';
  platform: AnalyticsPlatform;
  schemaVersion: 2;
  installId: string;
  version?: string;
  label?: string;
  durationMs?: number;
  mediaPositionMs?: number;
}

interface AnalyticsConfig {
  databaseURL?: string;
}

interface AnalyticsHealth {
  successes: number;
  failures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureError: string | null;
}

const EVENTS_KEY = 'cine-signal-events-v1';
const PENDING_KEY = 'cine-signal-pending-v1';
const HEALTH_KEY = 'cine-signal-health-v1';
const INSTALL_KEY = 'cine-signal-install-v1';
const VERSION_KEY = 'cine-signal-version-v1';
const MAX_EVENTS = 400;
const MAX_PENDING = 60;
const MAX_DURATION = 30_000;
const MAX_MEDIA_POSITION = 21_600_000;

let ready = false;
let surface: AnalyticsSurface = 'mobile';
let platform: AnalyticsPlatform = 'android';
let currentVersion = '';
let currentSessionId = '';
let configPromise: Promise<AnalyticsConfig | null> | null = null;
let flushing = false;
let stopSession: (() => void) | null = null;

function readStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* Storage can be unavailable in WebView wrappers. */ }
}

function randomId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}

function installId(): string {
  const existing = readStorage(INSTALL_KEY);
  if (existing) return existing;
  const value = randomId();
  writeStorage(INSTALL_KEY, value);
  return value;
}

function sessionId(): string {
  if (!currentSessionId) currentSessionId = randomId();
  return currentSessionId;
}

function deviceType(): AnalyticsEvent['device'] {
  const width = typeof window === 'undefined' ? 1024 : window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function readHealth(): AnalyticsHealth {
  const empty: AnalyticsHealth = { successes: 0, failures: 0, lastSuccessAt: null, lastFailureAt: null, lastFailureError: null };
  try {
    const parsed = JSON.parse(readStorage(HEALTH_KEY) || 'null') as Partial<AnalyticsHealth> | null;
    if (!parsed || typeof parsed !== 'object') return empty;
    return {
      successes: Number(parsed.successes) || 0,
      failures: Number(parsed.failures) || 0,
      lastSuccessAt: typeof parsed.lastSuccessAt === 'number' ? parsed.lastSuccessAt : null,
      lastFailureAt: typeof parsed.lastFailureAt === 'number' ? parsed.lastFailureAt : null,
      lastFailureError: typeof parsed.lastFailureError === 'string' ? parsed.lastFailureError.slice(0, 120) : null,
    };
  } catch { return empty; }
}

function writeHealth(health: AnalyticsHealth): void {
  try { window.localStorage.setItem(HEALTH_KEY, JSON.stringify(health)); } catch { /* Health bookkeeping must never break tracking. */ }
}

function recordSuccess(): void {
  const health = readHealth();
  writeHealth({ ...health, successes: health.successes + 1, lastSuccessAt: Date.now() });
}

function recordFailure(error: unknown): void {
  const health = readHealth();
  writeHealth({
    ...health,
    failures: health.failures + 1,
    lastFailureAt: Date.now(),
    lastFailureError: (error instanceof Error ? error.message : 'Unknown error').slice(0, 120),
  });
}

function readEvents(): AnalyticsEvent[] {
  try {
    const parsed = JSON.parse(readStorage(EVENTS_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsEvent) : [];
  } catch { return []; }
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AnalyticsEvent>;
  return typeof event.id === 'string' && typeof event.name === 'string'
    && (event.surface === 'mobile' || event.surface === 'tv')
    && typeof event.path === 'string' && typeof event.timestamp === 'number'
    && typeof event.sessionId === 'string';
}

function readPending(): AnalyticsEvent[] {
  try {
    const parsed = JSON.parse(readStorage(PENDING_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsEvent) : [];
  } catch { return []; }
}

function writePending(events: AnalyticsEvent[]): void {
  writeStorage(PENDING_KEY, JSON.stringify(events.slice(-MAX_PENDING)));
}

function loadConfig(): Promise<AnalyticsConfig | null> {
  configPromise ??= fetch('/firebase-config.json', { cache: 'no-cache' })
    .then(response => response.ok ? response.json() as Promise<AnalyticsConfig> : null)
    .catch(() => null);
  return configPromise;
}

function eventUrl(config: AnalyticsConfig, event: AnalyticsEvent): string | null {
  if (!config.databaseURL) return null;
  return `${config.databaseURL.replace(/\/$/, '')}/analytics/${event.surface}/events/${encodeURIComponent(event.id)}.json`;
}

async function deliver(event: AnalyticsEvent): Promise<void> {
  const config = await loadConfig();
  const url = eventUrl(config || {}, event);
  if (!url) throw new Error('Analytics is not configured');
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, timestamp: { '.sv': 'timestamp' } }),
  });
  if (!response.ok) throw new Error(`Analytics write failed (${response.status})`);
}

function queuePending(event: AnalyticsEvent): void {
  const pending = readPending().filter(item => item.id !== event.id);
  writePending([...pending, event]);
}

async function send(event: AnalyticsEvent): Promise<void> {
  try {
    await deliver(event);
    recordSuccess();
  } catch (error) {
    recordFailure(error);
    queuePending(event);
  }
}

export async function flushPendingAnalytics(): Promise<void> {
  if (!ready || flushing) return;
  const pending = readPending();
  if (!pending.length) return;
  flushing = true;
  const remaining: AnalyticsEvent[] = [];
  for (const event of pending) {
    try {
      await deliver(event);
      recordSuccess();
    } catch (error) {
      recordFailure(error);
      remaining.push(event);
    }
  }
  writePending(remaining);
  flushing = false;
}

export function detectAnalyticsSurface(): AnalyticsSurface {
  const configured = import.meta.env.VITE_CINE_PLATFORM;
  if (configured === 'tv' || configured === 'mobile') return configured;
  try { if (window.CineAndroid?.isTv?.()) return 'tv'; } catch { /* The bridge is optional. */ }
  return 'mobile';
}

export function initAnalytics(nextSurface = detectAnalyticsSurface(), appVersion = ''): void {
  if (ready || typeof window === 'undefined') return;
  surface = nextSurface;
  platform = nextSurface === 'tv' ? 'android-tv' : 'android';
  currentVersion = (appVersion || window.CineAndroid?.appVersion?.() || '').slice(0, 32);
  currentSessionId = randomId();
  ready = true;
  const previousVersion = readStorage(VERSION_KEY);
  if (currentVersion && previousVersion !== currentVersion) {
    writeStorage(VERSION_KEY, currentVersion);
    trackEvent('app_install', { label: currentVersion });
  }
  trackEvent('app_open', { label: currentVersion || platform });
  startSessionTracking();
  window.addEventListener('online', () => { void flushPendingAnalytics(); });
  setTimeout(() => { void flushPendingAnalytics(); }, 1200);
  window.setInterval(() => { if (readPending().length) void flushPendingAnalytics(); }, 30_000);
}

export function trackEvent(name: AnalyticsEventName, details: {
  path?: string;
  label?: string;
  durationMs?: number;
  mediaPositionMs?: number;
} = {}): void {
  if (!ready || typeof window === 'undefined') return;
  const rawPath = details.path || window.location.pathname || '/';
  const path = rawPath.split(/[?#]/)[0].slice(0, 80) || '/';
  const event: AnalyticsEvent = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    surface,
    path,
    timestamp: Date.now(),
    sessionId: sessionId(),
    device: deviceType(),
    platform,
    schemaVersion: 2,
    installId: installId(),
    ...(currentVersion ? { version: currentVersion } : {}),
    ...(details.label ? { label: details.label.slice(0, 80) } : {}),
    ...(typeof details.durationMs === 'number' && Number.isFinite(details.durationMs)
      ? { durationMs: Math.min(MAX_DURATION, Math.max(0, Math.round(details.durationMs))) }
      : {}),
    ...(typeof details.mediaPositionMs === 'number' && Number.isFinite(details.mediaPositionMs)
      ? { mediaPositionMs: Math.min(MAX_MEDIA_POSITION, Math.max(0, Math.round(details.mediaPositionMs))) }
      : {}),
  };
  writeStorage(EVENTS_KEY, JSON.stringify([...readEvents(), event].slice(-MAX_EVENTS)));
  void send(event);
}

export function trackPageView(path: string): void {
  const events = readEvents();
  const recent = events[events.length - 1];
  if (recent?.name === 'page_view' && recent.path === path && Date.now() - recent.timestamp < 1200) return;
  trackEvent('page_view', { path });
}

export function startSessionTracking(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  if (stopSession) return stopSession;
  trackEvent('session_start');
  let lastPulseAt = Date.now();
  const flush = (name: 'session_heartbeat' | 'session_end') => {
    const now = Date.now();
    const durationMs = Math.min(Math.max(0, now - lastPulseAt), MAX_DURATION);
    if (document.visibilityState === 'visible' || name === 'session_end') {
      trackEvent(name, { durationMs });
    }
    lastPulseAt = now;
  };
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') flush('session_heartbeat');
  }, 15_000);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      lastPulseAt = Date.now();
      trackEvent('session_start');
    } else {
      flush('session_end');
    }
  };
  const onPageHide = () => flush('session_end');
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  const cleanup = () => {
    flush('session_end');
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    if (stopSession === cleanup) stopSession = null;
  };
  stopSession = cleanup;
  return cleanup;
}

export function analyticsContextLabel(context: string): string {
  const value = String(context || '').toLowerCase();
  if (value.includes('radio')) return 'radio';
  if (value.includes('autoplay')) return 'autoplay';
  if (value.includes('daily mix')) return 'daily-mix';
  if (value.includes('shared')) return 'shared';
  if (value.includes('playlist')) return 'playlist';
  return 'library';
}

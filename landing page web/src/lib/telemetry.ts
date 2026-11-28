import type { AnalyticsEvent, AnalyticsEventName, AnalyticsSurface, AnalyticsPlatform } from './analytics';

interface FirebaseConfig {
  apiKey: string;
  databaseURL: string;
}

interface EventDetails {
  path?: string;
  label?: string;
  durationMs?: number;
  mediaPositionMs?: number;
}

const SURFACE: AnalyticsSurface = 'landing';
const EVENTS_KEY = 'cine-landing-events-v1';
const PENDING_KEY = 'cine-landing-pending-v1';
const SESSION_KEY = 'cine-landing-session-v1';
const INSTALL_KEY = 'cine-landing-install-v1';
const VERSION_KEY = 'cine-landing-version-v1';
const MAX_BUFFER = 30;
const FLUSH_INTERVAL = 20_000;

let configPromise: Promise<FirebaseConfig | null> | null = null;
let ready = false;
let sessionId = '';
let installId = '';
let lastFlush = 0;
let heartbeat: number | undefined;
let flushing = false;

function storage(): Storage | null {
  try {
    const test = '__cine_test__';
    window.localStorage.setItem(test, test);
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

function readList<T>(key: string): T[] {
  try { const value = JSON.parse(storage()?.getItem(key) || '[]'); return Array.isArray(value) ? value as T[] : []; } catch { return []; }
}

function writeList<T>(key: string, value: T[]) {
  try { storage()?.setItem(key, JSON.stringify(value.slice(-200))); } catch { /* storage unavailable */ }
}

function randomId(prefix: string): string {
  try { return `${prefix}-${crypto.randomUUID()}`; } catch { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

function loadConfig(): Promise<FirebaseConfig | null> {
  if (!configPromise) {
    configPromise = fetch('/firebase-config.json', { cache: 'no-store' })
      .then(response => { if(!response.ok)throw new Error('Configuration unavailable'); return response.json() as Promise<FirebaseConfig>; })
      .then(data => { if(!data?.apiKey || !data?.databaseURL)throw new Error('Configuration incomplete'); return data; })
      .catch(() => { configPromise = null; return null; });
  }
  return configPromise;
}

function endpoint(config: FirebaseConfig, id: string): string {
  return `${config.databaseURL}/analytics/${SURFACE}/events/${encodeURIComponent(id)}.json`;
}

async function writeEvent(config: FirebaseConfig, event: AnalyticsEvent): Promise<boolean> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(endpoint(config,event.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),keepalive:true,signal:controller.signal});
    // An existing ID is immutable. Permanent rejections should not retry forever.
    return response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429);
  } catch { return false; } finally { clearTimeout(timer); }
}

function queue(event: AnalyticsEvent, immediate = false) {
  if (!ready) return;
  writeList(EVENTS_KEY, [...readList<AnalyticsEvent>(EVENTS_KEY), event]);
  if (immediate) void flush();
  else if (Date.now() - lastFlush > 2_000) void flush();
}

async function flush() {
  if (!ready || flushing) return;
  flushing=true;
  try {
    const config=await loadConfig();if(!config)return;
    lastFlush=Date.now();
    const events=[...new Map([...readList<AnalyticsEvent>(PENDING_KEY),...readList<AnalyticsEvent>(EVENTS_KEY)].map(event=>[event.id,event])).values()].slice(0,8);
    if(!events.length)return;
    const sent=new Set<string>();
    for(const event of events)if(await writeEvent(config,event))sent.add(event.id);
    const remaining=[...new Map([...readList<AnalyticsEvent>(PENDING_KEY),...readList<AnalyticsEvent>(EVENTS_KEY)].map(event=>[event.id,event])).values()].filter(event=>!sent.has(event.id));
    writeList(PENDING_KEY,remaining.slice(-MAX_BUFFER));writeList(EVENTS_KEY,[]);
  } finally { flushing=false; }
}

export function trackLandingEvent(name: AnalyticsEventName, details: EventDetails = {}) {
  if (!ready) return;
  const event: AnalyticsEvent = {
    id: randomId('landing'),
    name,
    surface: SURFACE,
    path: details.path || window.location.pathname,
    timestamp: Date.now(),
    sessionId,
    device: window.matchMedia('(max-width: 720px)').matches ? 'mobile' : 'desktop',
    platform: 'web' as AnalyticsPlatform,
    schemaVersion: 2,
    installId,
    version: (() => { try { return storage()?.getItem(VERSION_KEY) || 'web'; } catch { return 'web'; } })(),
    label: details.label,
    durationMs: details.durationMs,
    mediaPositionMs: details.mediaPositionMs,
  };
  queue(event, name === 'session_end' || name === 'apk_download' || name === 'app_open');
}

export function trackLandingPageView(path: string) {
  trackLandingEvent('page_view', { path });
}

export function trackApkDownload(kind: 'mobile' | 'tv') {
  trackLandingEvent('apk_download', { path: '/download', label: kind });
}

export function initLandingAnalytics() {
  if (ready) return;
  ready = true;
  try {
    installId = storage()?.getItem(INSTALL_KEY) || randomId('landing-device');
    storage()?.setItem(INSTALL_KEY, installId);
    sessionId = randomId('landing-session');
    storage()?.setItem(SESSION_KEY, sessionId);
    storage()?.setItem(VERSION_KEY, 'web');
  } catch {
    installId = installId || randomId('landing-device');
    sessionId = sessionId || randomId('landing-session');
  }

  void loadConfig().then(config => { if (config) void flush(); });

  trackLandingEvent('app_open', { path: window.location.pathname, label: 'landing' });
  if(document.visibilityState === 'visible') trackLandingEvent('session_start', { path: window.location.pathname });
  window.setInterval(() => void flush(), FLUSH_INTERVAL);
  let active=document.visibilityState === 'visible',last=performance.now();
  function finish() {
    if(!active)return;
    const now=performance.now();trackLandingEvent('session_end',{durationMs:Math.min(60000,Math.max(0,now-last))});last=now;active=false;
  }
  function resume() {
    if(active || document.visibilityState !== 'visible')return;
    sessionId=randomId('landing-session');active=true;last=performance.now();trackLandingEvent('session_start');
  }
  heartbeat=window.setInterval(()=>{
    if(!active || document.visibilityState !== 'visible')return;
    const now=performance.now();trackLandingEvent('session_heartbeat',{durationMs:Math.min(60000,Math.max(0,now-last))});last=now;
  },30000);
  window.addEventListener('online',()=>void flush());
  window.addEventListener('pagehide',()=>{finish();void flush();});
  window.addEventListener('pageshow',resume);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState === 'hidden')finish();else resume();void flush();});
}

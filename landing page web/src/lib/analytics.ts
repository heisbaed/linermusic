export type AnalyticsSurface = 'mobile' | 'tv' | 'landing';
export type AnalyticsPlatform = 'android' | 'android-tv' | 'web';
export type AnalyticsPeriod = 'today' | '7d' | '30d';
export type AnalyticsSurfaceFilter = 'all' | AnalyticsSurface;
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
  | 'ota_check'
  | 'apk_download';

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

export const SURFACES: AnalyticsSurface[] = ['mobile', 'tv', 'landing'];
export const SURFACE_LABELS: Record<AnalyticsSurface, string> = {
  mobile: 'Mobile app',
  tv: 'Android TV',
  landing: 'Landing page',
};

export const EVENT_LABELS: Record<AnalyticsEventName, string> = {
  app_open: 'App opened',
  app_install: 'App installed',
  session_start: 'Session started',
  session_heartbeat: 'Session heartbeat',
  session_end: 'Session ended',
  page_view: 'Page view',
  search: 'Search',
  play: 'Play',
  pause: 'Pause',
  resume: 'Resume',
  skip: 'Skip',
  complete: 'Track complete',
  download_start: 'Download started',
  download_complete: 'Download finished',
  download_failed: 'Download failed',
  playlist_add: 'Added to playlist',
  lyrics_view: 'Lyrics opened',
  radio_open: 'Radio opened',
  radio_play: 'Radio play',
  connect_pair: 'Device paired',
  connect_select: 'Device selected',
  theme_change: 'Theme changed',
  sign_in: 'Signed in',
  sign_out: 'Signed out',
  ota_check: 'Update check',
  apk_download: 'APK download',
};

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<AnalyticsEvent>;
  return typeof event.id === 'string'
    && typeof event.name === 'string'
    && (event.surface === 'mobile' || event.surface === 'tv' || event.surface === 'landing')
    && typeof event.path === 'string'
    && typeof event.timestamp === 'number'
    && Number.isFinite(event.timestamp)
    && typeof event.sessionId === 'string';
}

export function periodStart(period: AnalyticsPeriod, now = Date.now()): number {
  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  if (period === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  return now - 30 * 24 * 60 * 60 * 1000;
}

export interface AnalyticsMetrics {
  totalEvents: number;
  sessions: number;
  activeMs: number;
  views: number;
  searches: number;
  plays: number;
  pauses: number;
  resumes: number;
  skips: number;
  completes: number;
  downloadStarts: number;
  downloadCompletes: number;
  downloadFailures: number;
  lyricsViews: number;
  radioOpens: number;
  radioPlays: number;
  connectPairs: number;
  connectSelects: number;
  otaChecks: number;
  appInstalls: number;
  signIns: number;
  topPaths: { path: string; count: number }[];
  versions: { version: string; count: number }[];
  recent: AnalyticsEvent[];
}

export function buildMetrics(
  events: AnalyticsEvent[],
  since: number,
  surface: AnalyticsSurfaceFilter,
  now = Date.now(),
): AnalyticsMetrics {
  const scoped = events.filter(event =>
    event.timestamp >= since
    && event.timestamp <= now + 60_000
    && (surface === 'all' || event.surface === surface));

  const metric = (name: AnalyticsEventName) => scoped.reduce((count, event) => count + (event.name === name ? 1 : 0), 0);
  const sessions = new Set(scoped.map(event => event.sessionId)).size;
  const activeMs = scoped.reduce((total, event) => total
    + (event.name === 'session_heartbeat' || event.name === 'session_end' ? Math.min(65_000, Math.max(0, event.durationMs || 0)) : 0), 0);

  const pathCounts = new Map<string, number>();
  for (const event of scoped) {
    if (event.name !== 'page_view') continue;
    pathCounts.set(event.path, (pathCounts.get(event.path) || 0) + 1);
  }

  const versionCounts = new Map<string, Set<string>>();
  for (const event of scoped) {
    if (event.name !== 'app_open' && event.name !== 'app_install') continue;
    const version = event.version || event.label || 'unknown';
    const installs = versionCounts.get(version) || new Set<string>();
    installs.add(event.installId || event.sessionId);
    versionCounts.set(version, installs);
  }

  return {
    totalEvents: scoped.length,
    sessions,
    activeMs,
    views: metric('page_view'),
    searches: metric('search'),
    plays: metric('play'),
    pauses: metric('pause'),
    resumes: metric('resume'),
    skips: metric('skip'),
    completes: metric('complete'),
    downloadStarts: metric('download_start'),
    downloadCompletes: metric('download_complete'),
    downloadFailures: metric('download_failed'),
    lyricsViews: metric('lyrics_view'),
    radioOpens: metric('radio_open'),
    radioPlays: metric('radio_play'),
    connectPairs: metric('connect_pair'),
    connectSelects: metric('connect_select'),
    otaChecks: metric('ota_check'),
    appInstalls: metric('app_install'),
    signIns: metric('sign_in'),
    topPaths: [...pathCounts.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    versions: [...versionCounts.entries()]
      .map(([version, installs]) => ({ version, count: installs.size }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    recent: [...scoped].sort((left, right) => right.timestamp - left.timestamp).slice(0, 60),
  };
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatCount(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString() : '—';
}

export function formatRelative(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

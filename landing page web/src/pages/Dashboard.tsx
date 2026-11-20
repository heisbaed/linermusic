import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  LogOut,
  Music2,
  Radio,
  RefreshCw,
  Search,
  Signal,
  SkipForward,
  Smartphone,
  Tv,
  Users,
} from 'lucide-react';
import {
  buildMetrics,
  EVENT_LABELS,
  formatCount,
  formatDuration,
  formatRelative,
  periodStart,
  SURFACES,
  SURFACE_LABELS,
  type AnalyticsEvent,
  type AnalyticsPeriod,
  type AnalyticsSurface,
  type AnalyticsSurfaceFilter,
} from '../lib/analytics';
import {
  AuthError,
  fetchAnalyticsEvents,
  isAdminEmail,
  refreshDashboardAuth,
  signInWithPassword,
  type DashboardAuth,
} from '../lib/firebase';
import '../dashboard.css';

const AUTH_KEY = 'cine-signal-dashboard-auth-v1';

const EMPTY_EVENTS: Record<AnalyticsSurface, AnalyticsEvent[]> = { mobile: [], tv: [], landing: [] };

function readAuth(): DashboardAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardAuth;
    return parsed.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

function storeAuth(auth: DashboardAuth | null) {
  try {
    if (auth) window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else window.localStorage.removeItem(AUTH_KEY);
  } catch {
    /* storage unavailable */
  }
}

function errorMessage(value: unknown): string {
  return value instanceof Error && value.message ? value.message : 'Something went wrong.';
}

export function Dashboard() {
  const [auth, setAuth] = useState<DashboardAuth | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const [surface, setSurface] = useState<AnalyticsSurfaceFilter>('all');
  const [data, setData] = useState<Record<AnalyticsSurface, AnalyticsEvent[]>>(EMPTY_EVENTS);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const stored = readAuth();
    if (!stored) { setRestoring(false); return; }
    if (!isAdminEmail(stored.email)) { storeAuth(null); setAuthError('This account does not have dashboard access.'); setRestoring(false); return; }
    refreshDashboardAuth(stored)
      .then(next => {
        if (!isAdminEmail(next.email)) throw new AuthError('This account does not have dashboard access.');
        storeAuth(next);
        setAuth(next);
      })
      .catch(() => storeAuth(null))
      .finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const controller = new AbortController();
    const since = periodStart(period);

    const load = async () => {
      setLoading(true);
      try {
        let active = auth;
        if (active.expiresAt < Date.now() + 60_000) {
          active = await refreshDashboardAuth(active);
          if (cancelled) return;
          storeAuth(active);
          setAuth(active);
        }
        const results = await Promise.all(SURFACES.map(item => fetchAnalyticsEvents(item, since, active, controller.signal)));
        if (cancelled) return;
        setData({ mobile: results[0], tv: results[1], landing: results[2] });
        setFeedError('');
        setLastUpdated(Date.now());
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        if (error instanceof AuthError) {
          storeAuth(null);
          setAuth(null);
          setAuthError('Your session expired. Sign in again.');
        } else {
          setFeedError(errorMessage(error));
        }
      } finally {
        if (!cancelled) { setLoading(false); setLoadedOnce(true); }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15_000);
    return () => { cancelled = true; controller.abort(); window.clearInterval(timer); };
  }, [auth, period, nonce]);

  const allEvents = useMemo(() => [...data.mobile, ...data.tv, ...data.landing], [data]);
  const since = useMemo(() => periodStart(period), [period]);

  const metrics = useMemo(() => {
    if (surface === 'all') return buildMetrics(allEvents, since, 'all');
    return buildMetrics(data[surface], since, surface);
  }, [allEvents, data, since, surface]);

  const surfaceMetrics = useMemo(() => SURFACES.map(item => ({
    surface: item,
    metrics: buildMetrics(data[item], since, item),
  })), [data, since]);

  const completionRate = metrics.plays ? Math.min(100, Math.round((metrics.completes / metrics.plays) * 100)) : 0;
  const downloadRate = metrics.downloadStarts ? Math.min(100, Math.round((metrics.downloadCompletes / metrics.downloadStarts) * 100)) : 0;
  const maxSurfaceSessions = Math.max(1, ...surfaceMetrics.map(item => item.metrics.sessions));

  const heartbeat = useMemo(() => {
    const now = Date.now();
    const sessionKey = (event: AnalyticsEvent) => `${event.surface}:${event.sessionId}`;
    const presence = allEvents
      .filter(event => (surface === 'all' || event.surface === surface)
        && (event.name === 'session_start' || event.name === 'session_heartbeat' || event.name === 'session_end')
        && event.timestamp >= now - 31.5 * 60_000
        && event.timestamp <= now)
      .sort((left, right) => left.timestamp - right.timestamp);
    const live = new Map<string, AnalyticsEvent>();
    let cursor = 0;
    const values: number[] = [];
    const times: number[] = [];
    const activeAt = (time: number) => Array.from(live.values()).filter(event =>
      event.name !== 'session_end' && event.timestamp > time - 90_000 && event.timestamp <= time).length;
    for (let index = 29; index >= 0; index--) {
      const time = now - index * 60_000;
      while (cursor < presence.length && presence[cursor].timestamp <= time) {
        const event = presence[cursor++];
        live.set(sessionKey(event), event);
      }
      values.push(activeAt(time));
      times.push(time);
    }
    const peak = Math.max(1, ...values);
    const x = (index: number) => 44 + (index / 29) * 650;
    const y = (value: number) => 154 - (value / peak) * 124;
    const line = values.map((value, index) => `${index ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ');
    const area = `${line} L${x(29)},154 L${x(0)},154 Z`;
    return {
      values,
      times,
      peak,
      line,
      area,
      lastY: y(values[values.length - 1]),
      activeNow: activeAt(now),
      latest: presence.length ? presence[presence.length - 1].timestamp : 0,
    };
  }, [allEvents, surface, lastUpdated]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const next = await signInWithPassword(email.trim(), password);
      if (!isAdminEmail(next.email)) throw new AuthError('This account does not have dashboard access.');
      storeAuth(next);
      setPassword('');
      setAuth(next);
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    storeAuth(null);
    setAuth(null);
    setData(EMPTY_EVENTS);
    setLoadedOnce(false);
    setEmail('');
    setPassword('');
  }

  if (restoring) {
    return (
      <main className="dash dash-center">
        <div className="dash-loader"><Signal size={20} /> Restoring secure session…</div>
      </main>
    );
  }

  if (!auth) {
    return (
      <main className="dash dash-center">
        <form className="dash-login" onSubmit={submit}>
          <div className="dash-login-brand"><Signal size={18} /> Signalroom</div>
          <h1>Cine music analytics</h1>
          <p>Private listener signals for the mobile app, Android TV, and landing page. Sign in with the admin account to open the feed.</p>
          <label>
            <span>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          </label>
          {authError && <div className="dash-alert">{authError}</div>}
          <button className="dash-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Open dashboard'}</button>
          <a className="dash-back" href="/">Back to Cine music</a>
        </form>
      </main>
    );
  }

  return (
    <main className="dash">
      <header className="dash-header">
        <div>
          <div className="dash-eyebrow"><Signal size={14} /> Signalroom</div>
          <h1>Cine music analytics</h1>
          <p>{auth.email} · private first-party signals · no search text or song titles are stored</p>
        </div>
        <div className="dash-header-actions">
          <button className="dash-ghost" type="button" onClick={() => setNonce(value => value + 1)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'dash-spin' : ''} /> {loading ? 'Syncing' : 'Refresh'}
          </button>
          <button className="dash-ghost" type="button" onClick={signOut}><LogOut size={14} /> Sign out</button>
        </div>
      </header>

      <div className="dash-toolbar">
        <div className="dash-segment" role="group" aria-label="Time range">
          {(['today', '7d', '30d'] as const).map(item => (
            <button key={item} type="button" className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>
              {item === 'today' ? 'Today' : item === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
        </div>
        <div className="dash-segment" role="group" aria-label="Surface">
          <button type="button" className={surface === 'all' ? 'active' : ''} onClick={() => setSurface('all')}>All</button>
          {SURFACES.map(item => (
            <button key={item} type="button" className={surface === item ? 'active' : ''} onClick={() => setSurface(item)}>
              {SURFACE_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="dash-updated">
          {feedError ? <span className="dash-feed-error">{feedError}</span> : <>Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}</>}
        </div>
      </div>

      <section className="dash-kpis">
        <Kpi icon={<Users size={16} />} label="Sessions" value={formatCount(metrics.sessions)} hint={`${formatCount(metrics.totalEvents)} events`} />
        <Kpi icon={<Activity size={16} />} label="Active time" value={formatDuration(metrics.activeMs)} hint="Foreground heartbeats" />
        <Kpi icon={<Music2 size={16} />} label="Plays" value={formatCount(metrics.plays)} hint={`${formatCount(metrics.resumes)} resumes`} />
        <Kpi icon={<CheckCircle2 size={16} />} label="Completion" value={`${completionRate}%`} hint={`${formatCount(metrics.completes)} completed`} />
        <Kpi icon={<Search size={16} />} label="Searches" value={formatCount(metrics.searches)} hint="Counts only" />
        <Kpi icon={<SkipForward size={16} />} label="Skips" value={formatCount(metrics.skips)} hint="User-initiated" />
        <Kpi icon={<Download size={16} />} label="Downloads" value={formatCount(metrics.downloadCompletes)} hint={`${formatCount(metrics.downloadStarts)} started · ${downloadRate}% finished`} />
        <Kpi icon={<Eye size={16} />} label="Page views" value={formatCount(metrics.views)} hint={`${formatCount(metrics.lyricsViews)} lyrics opens`} />
      </section>

      <section className="dash-panel dash-heartbeat">
        <div className="dash-panel-head">
          <div><h2>Live heartbeatometer</h2><p>Active sessions over the last 30 minutes · 90-second presence window</p></div>
          <div className="dash-heartbeat-live" data-live={heartbeat.activeNow > 0}>
            <span />{heartbeat.activeNow > 0 ? 'Live' : 'Waiting'}
          </div>
        </div>
        <div className="dash-heartbeat-body">
          <div className="dash-heartbeat-readout">
            <div><span>Active now</span><strong>{loadedOnce ? formatCount(heartbeat.activeNow) : '—'}</strong></div>
            <div><span>30-minute peak</span><strong>{loadedOnce ? formatCount(heartbeat.peak) : '—'}</strong></div>
            <div><span>Latest signal</span><strong>{heartbeat.latest ? formatRelative(heartbeat.latest) : '—'}</strong></div>
          </div>
          <svg className="dash-heartbeat-chart" viewBox="0 0 720 190" role="img" aria-label={`Active sessions over the last 30 minutes. Currently ${heartbeat.activeNow}.`}>
            <defs>
              <linearGradient id="dash-heartbeat-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--dash-rose)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--dash-rose)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map(ratio => (
              <g key={ratio}>
                <line className="dash-heartbeat-grid" x1="44" x2="694" y1={154 - ratio * 124} y2={154 - ratio * 124} />
                <text x="32" y={158 - ratio * 124} textAnchor="end">{Number((heartbeat.peak * ratio).toFixed(1))}</text>
              </g>
            ))}
            {loadedOnce && <path d={heartbeat.area} fill="url(#dash-heartbeat-fill)" />}
            {loadedOnce && <path d={heartbeat.line} className="dash-heartbeat-line" />}
            {loadedOnce && <circle className="dash-heartbeat-dot" cx="694" cy={heartbeat.lastY} r="4" />}
            {[0, 14, 29].map(index => (
              <text key={index} x={44 + (index / 29) * 650} y="179" textAnchor={index === 0 ? 'start' : index === 29 ? 'end' : 'middle'}>
                {new Date(heartbeat.times[index]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </text>
            ))}
          </svg>
        </div>
      </section>

      <section className="dash-grid">
        <article className="dash-panel dash-surface-panel">
          <div className="dash-panel-head">
            <div><h2>Surfaces</h2><p>Sessions in the selected window</p></div>
            <BarChart3 size={16} />
          </div>
          <div className="dash-bars">
            {surfaceMetrics.map(item => (
              <div className="dash-bar-row" key={item.surface}>
                <span className="dash-bar-label">{SURFACE_LABELS[item.surface]}</span>
                <div className="dash-bar-track">
                  <div className="dash-bar-fill" style={{ width: `${Math.round((item.metrics.sessions / maxSurfaceSessions) * 100)}%` }} />
                </div>
                <span className="dash-bar-value">{formatCount(item.metrics.sessions)}</span>
                <span className="dash-bar-meta">{formatCount(item.metrics.plays)} plays · {formatCount(item.metrics.searches)} searches</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dash-panel">
          <div className="dash-panel-head">
            <div><h2>Engagement</h2><p>Listening and retention signals</p></div>
            <Activity size={16} />
          </div>
          <dl className="dash-facts">
            <Fact label="Pauses" value={formatCount(metrics.pauses)} />
            <Fact label="Radio opens" value={formatCount(metrics.radioOpens)} />
            <Fact label="Radio plays" value={formatCount(metrics.radioPlays)} />
            <Fact label="Downloads finished" value={formatCount(metrics.downloadCompletes)} />
            <Fact label="Download failures" value={formatCount(metrics.downloadFailures)} />
            <Fact label="Device pairs" value={formatCount(metrics.connectPairs)} />
            <Fact label="Signed in" value={formatCount(metrics.signIns)} />
            <Fact label="Update checks" value={formatCount(metrics.otaChecks)} />
          </dl>
        </article>

        <article className="dash-panel">
          <div className="dash-panel-head">
            <div><h2>Top destinations</h2><p>Coarse screen labels only</p></div>
            <Eye size={16} />
          </div>
          {metrics.topPaths.length ? (
            <ol className="dash-list">
              {metrics.topPaths.map(item => (
                <li key={item.path}><span>{item.path}</span><strong>{formatCount(item.count)}</strong></li>
              ))}
            </ol>
          ) : <Empty text="No page views yet." />}
        </article>

        <article className="dash-panel">
          <div className="dash-panel-head">
            <div><h2>Versions</h2><p>Unique installs by release</p></div>
            <Smartphone size={16} />
          </div>
          {metrics.versions.length ? (
            <ol className="dash-list">
              {metrics.versions.map(item => (
                <li key={item.version}><span>{item.version}</span><strong>{formatCount(item.count)}</strong></li>
              ))}
            </ol>
          ) : <Empty text="No version signals yet." />}
        </article>
      </section>

      <section className="dash-panel dash-feed">
        <div className="dash-panel-head">
          <div><h2>Live feed</h2><p>Latest 60 privacy-safe events</p></div>
          <Radio size={16} />
        </div>
        {!loadedOnce && loading ? <Empty text="Loading the first feed…" /> : metrics.recent.length ? (
          <div className="dash-table-wrap">
            <table>
              <thead><tr><th>Event</th><th>Surface</th><th>Screen</th><th>Version</th><th>When</th></tr></thead>
              <tbody>
                {metrics.recent.map(event => (
                  <tr key={event.id}>
                    <td><span className={`dash-dot dash-dot-${event.surface}`} /> {EVENT_LABELS[event.name] || event.name}{event.label ? <em> · {event.label}</em> : null}</td>
                    <td><span className="dash-badge">{SURFACE_LABELS[event.surface]}</span></td>
                    <td className="dash-mono">{event.path}</td>
                    <td className="dash-mono">{event.version || '—'}</td>
                    <td title={new Date(event.timestamp).toLocaleString()}>{formatRelative(event.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text={feedError ? 'The feed is unavailable right now.' : 'No events in this window yet. Open the app or landing page to send the first signal.'} />}
      </section>

      <footer className="dash-footer">
        <span><Tv size={13} /> Android TV</span>
        <span><Smartphone size={13} /> Mobile</span>
        <span><Signal size={13} /> Landing</span>
        <span>Search text, song titles, and device identifiers are never uploaded.</span>
      </footer>
    </main>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <article className="dash-kpi">
      <div className="dash-kpi-top">{icon}<span>{label}</span></div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="dash-empty">{text}</p>;
}

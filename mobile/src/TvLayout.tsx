import { useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { Brand } from './ui';
import { useApp, type Tab } from './AppContext';
import { TvHomeScreen } from './TvHomeScreen';
import { TvSearchScreen } from './TvSearchScreen';
import { TvExploreScreen } from './TvExploreScreen';
import { TvLibraryScreen } from './TvLibraryScreen';
import { focusFirstActionable } from './spatialNav';

// Spec rail: Search, Home, Library, Settings. Map Settings -> account/profile.
const NAV: { id: Tab | 'settings'; label: string; icon: 'search' | 'home' | 'library' | 'settings'; tab?: Tab }[] = [
  { id: 'search', label: 'Search', icon: 'search', tab: 'search' },
  { id: 'home', label: 'Home', icon: 'home', tab: 'home' },
  { id: 'library', label: 'Library', icon: 'library', tab: 'library' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function TvSidebar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const app = useApp();
  return (
    <aside className="tv-sidebar" aria-label="Navigation" data-tv-region="rail">
      <button
        type="button"
        className="tv-rail-brand"
        onClick={() => onTab('home')}
        aria-label="Cine Music home"
      >
        <Brand />
        <span className="tv-rail-brand-text">Cine Music</span>
      </button>
      <nav className="tv-nav" aria-label="Primary">
        {NAV.map(item => {
          const active = item.tab ? tab === item.tab : false;
          return (
            <button
              key={item.id}
              type="button"
              className={`tv-nav-item ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              data-tv-rail-default={item.id === 'home' ? 'true' : undefined}
              onClick={() => {
                if (item.tab) onTab(item.tab);
                else app.openRoute({ kind: 'account', page: 'profile' });
              }}
            >
              <span className="tv-nav-icon"><Icon name={item.icon} active={active} size={26} /></span>
              <span className="tv-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      {app.playback.player.track && (
        <button type="button" className="tv-nav-item tv-nav-nowplaying" onClick={app.openPlayer} aria-label="Open Now Playing">
          <span className="tv-nav-icon"><Icon name="play" size={24} /></span>
          <span className="tv-nav-label">Now Playing</span>
        </button>
      )}
    </aside>
  );
}

export function TvShell({ tab, routes, renderRoute, onMenu: _onMenu }: {
  tab: Tab; routes: { key: string; route: unknown }[]; renderRoute: (route: any) => any; onMenu: (song: any) => void;
}) {
  const app = useApp();
  const main = useRef<HTMLElement>(null);
  const routeKey = routes.at(-1)?.key || tab;

  useEffect(() => {
    // Screen transitions must auto-focus the first actionable item.
    const t = setTimeout(() => focusFirstActionable(main.current), 60);
    return () => clearTimeout(t);
  }, [routeKey]);

  const content = routes.length
    ? renderRoute(routes.at(-1)!.route)
    : tab === 'home' ? <TvHomeScreen />
    : tab === 'search' ? <TvSearchScreen />
    : tab === 'explore' ? <TvExploreScreen />
    : <TvLibraryScreen />;

  return (
    <div className="tv-shell">
      <TvSidebar tab={tab} onTab={app.goTab} />
      <div className="tv-stage">
        <main className="tv-main" ref={main} aria-label="Content">
          <div key={routeKey} className="tv-screen-transition">
            {content}
          </div>
        </main>
      </div>
    </div>
  );
}

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';
import { Brand, Cover } from './ui';
import { useApp, type Route, type Tab } from './AppContext';
import { focusElement, focusFirstActionable } from './spatialNav';
import { displaySongTitle } from './catalogQuality';
import type { Song } from './types';

export type TvRoute = Exclude<Route, { kind: 'playlist-form' | 'playlist-import' }>;
export type TvEntry = { key: string; route: TvRoute };
const NAV: { id: Tab | 'settings'; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'search', label: 'Search', icon: 'search' },
  { id: 'library', label: 'Library', icon: 'library' }, { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function TvShell({ page, main, settings, overlay, children }: {
  page: string; main: boolean; settings: boolean; overlay: boolean; children: ReactNode;
}) {
  const app = useApp();
  const content = useRef<HTMLElement>(null);
  const scroll = useRef(new Map<string, { top: number; focus?: string }>());
  useLayoutEffect(() => {
    const viewport = content.current;
    if (!viewport) return;
    const saved = scroll.current.get(page);
    viewport.scrollTop = saved?.top || 0;
    const target = saved?.focus && viewport.querySelector<HTMLElement>(`[data-tv-key="${CSS.escape(saved.focus)}"]`);
    if (target && target.getClientRects().length) focusElement(target, { preventScroll: true });
    else if (main) focusElement(document.querySelector('.tv-nav-item[aria-current="page"]'), { preventScroll: true });
    else focusFirstActionable(viewport);
    function remember() {
      if (!viewport) return;
      const active = document.activeElement as HTMLElement | null;
      const focus = viewport.contains(active) ? active?.dataset.tvKey : scroll.current.get(page)?.focus;
      scroll.current.set(page, { top: viewport.scrollTop, focus });
      if (scroll.current.size > 30) scroll.current.delete(scroll.current.keys().next().value!);
    }
    viewport.addEventListener('scroll', remember, { passive: true });
    viewport.addEventListener('focusin', remember);
    return () => {
      viewport.removeEventListener('scroll', remember);
      viewport.removeEventListener('focusin', remember);
    };
  }, [page]);

  const { track, status } = app.playback.player;
  const playing = status === 'playing' || status === 'loading';
  return <div className="tv-shell" aria-hidden={overlay || undefined} ref={element => { element?.toggleAttribute('inert', overlay); }}>
    <header className="tv-header">
      <Brand />
      <nav className="tv-nav" aria-label="Main navigation">
        {NAV.map(item => <button type="button" key={item.id} className="tv-nav-item"
          aria-current={(item.id === 'settings' ? settings : main && app.tab === item.id) ? 'page' : undefined}
          onClick={() => item.id === 'settings' ? app.openRoute({ kind: 'account', page: 'profile' }) : app.goTab(item.id)}>
          <Icon name={item.icon} size={21} />{item.label}
        </button>)}
        {track && <button type="button" className="tv-nav-item" onClick={app.openPlayer}><Icon name="music" size={21} />Now Playing</button>}
      </nav>
    </header>
    <main className="tv-main" ref={content}>{children}</main>
    {track && <footer className="tv-dock" aria-label="Mini-player">
      <button type="button" className="tv-mini" onClick={app.openPlayer} aria-label={`Open Now Playing: ${displaySongTitle(track.title, track.artist)}`}>
        <Cover song={track} /><span><strong>{displaySongTitle(track.title, track.artist)}</strong><small>{status === 'loading' ? 'Connecting…' : status === 'error' ? 'Playback interrupted' : track.artist}</small></span>
      </button>
      <button type="button" className="tv-icon-button" onClick={app.playback.toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={23} /></button>
      <button type="button" className="tv-icon-button" onClick={app.playback.next} aria-label="Next"><Icon name="next" size={23} /></button>
    </footer>}
  </div>;
}

export function TvShelf({ title, children }: { title: string; children: ReactNode }) {
  return <section className="tv-shelf"><h2>{title}</h2><div className="tv-shelf-row" data-tv-shelf-id={title}>{children}</div></section>;
}

export function TvCard({ title, subtitle, art, kind, id, action }: {
  title: string; subtitle?: string; art?: string; kind?: 'album' | 'artist' | 'playlist'; id: string; action: () => void;
}) {
  return <button type="button" className="tv-card" data-tv-key={id} onClick={action} aria-label={subtitle ? `${title}, ${subtitle}` : title}>
    <Cover song={{ title, cover: art }} kind={kind} /><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}
  </button>;
}

export function TvSongs({ songs, title }: { songs: Song[]; title: string }) {
  const app = useApp();
  const [limit, setLimit] = useState(36);
  return <section className="tv-tracks" aria-label={title}><div data-tv-shelf-id={title}>
    {songs.slice(0, limit).map((song, index) => <button type="button" key={song.id + index} data-tv-key={`${song.id}-${index}`}
      className="tv-track" aria-label={`Play ${displaySongTitle(song.title, song.artist)} by ${song.artist}`} onClick={() => {
        app.playback.setShuffle('off');
        app.playback.setRepeat('off');
        void app.playback.play(song, songs.slice(index), title);
      }}>
      <Cover song={song} /><span><strong>{displaySongTitle(song.title, song.artist)}</strong><small>{song.artist}</small></span><Icon name={app.playback.player.track?.id === song.id ? 'equalizer' : 'play'} size={19} />
    </button>)}
  </div>
  {songs.length > limit && <button type="button" className="tv-button" onClick={() => setLimit(value => value + 36)}>Show more songs</button>}</section>;
}

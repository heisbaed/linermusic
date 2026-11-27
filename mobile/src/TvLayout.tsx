import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';
import { Brand, Cover } from './ui';
import { useApp, type Route, type Tab } from './AppContext';
import { focusElement, focusFirstActionable } from './spatialNav';
import { displaySongTitle } from './catalogQuality';
import type { Song } from './types';
import { formatTime } from './library';

export type TvRoute = Exclude<Route, { kind: 'playlist-form' | 'playlist-import' }>;
export type TvEntry = { key: string; route: TvRoute };
const NAV: { id: Tab | 'settings'; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' }, { id: 'search', label: 'Search', icon: 'search' },
  { id: 'library', label: 'Library', icon: 'library' }, { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function TvShell({ page, main, settings, overlay, onQueue, children }: {
  page: string; main: boolean; settings: boolean; overlay: boolean; onQueue: () => void; children: ReactNode;
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

  const { track, status, positionMs, durationMs } = app.playback.player;
  const [wash, setWash] = useState('');
  useEffect(() => {
    let cancelled = false; setWash('');
    if (!track?.cover) return;
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8; canvas.getContext('2d')?.drawImage(image, 0, 0, 8, 8); setWash(canvas.toDataURL('image/png')); } catch { /* Theme lighting remains when a cover cannot be sampled. */ }
    };
    image.src = track.cover;
    return () => { cancelled = true; };
  }, [track?.cover]);
  const playing = status === 'playing' || status === 'loading';
  return <div className="tv-shell" aria-hidden={overlay || undefined} ref={element => { element?.toggleAttribute('inert', overlay); }}>
    <div className="tv-ambient" aria-hidden="true">{wash && <img src={wash} alt="" />}</div>
    <header className="tv-header">
      <Brand />
      <nav className="tv-nav" aria-label="Main navigation">
        {NAV.map(item => <button type="button" key={item.id} className="tv-nav-item"
          aria-current={(item.id === 'settings' ? settings : main && app.tab === item.id) ? 'page' : undefined}
          onClick={() => item.id === 'settings' ? app.openRoute({ kind: 'account', page: 'profile' }) : app.goTab(item.id)}>
          <Icon name={item.icon} size={21} /><span>{item.label}</span>
        </button>)}
        {track && <button type="button" className="tv-nav-item" onClick={app.openPlayer}><Icon name="music" size={21} /><span>Now Playing</span></button>}
      </nav>
    </header>
    <main className="tv-main" ref={content}>{children}</main>
    {track && <footer className="tv-dock" aria-label="Mini-player">
      <button type="button" className="tv-mini" onClick={app.openPlayer} aria-label={`Open Now Playing: ${displaySongTitle(track.title, track.artist)}`}>
        <Cover song={track} /><span><strong>{displaySongTitle(track.title, track.artist)}</strong><small>{status === 'loading' ? 'Connecting…' : status === 'error' ? 'Playback interrupted' : track.artist}</small></span>
      </button>
      <div className="tv-mini-actions" role="group" aria-label="Quick playback controls">
        <button type="button" className="tv-icon-button" aria-label={app.isFavorite(track.id) ? 'Unlike song' : 'Like song'} aria-pressed={app.isFavorite(track.id)} onClick={() => app.toggleFavorite(track)}><Icon name="heart" size={21} filled={app.isFavorite(track.id)} /></button>
        <button type="button" className="tv-icon-button" aria-label={app.playback.shuffle === 'smart' ? 'Smart shuffle on' : app.playback.shuffle === 'on' ? 'Shuffle on' : 'Shuffle off'} aria-pressed={app.playback.shuffle !== 'off'} onClick={app.playback.cycleShuffle}><Icon name={app.playback.shuffle === 'smart' ? 'sparkles' : 'shuffle'} size={20} /></button>
        <button type="button" className="tv-icon-button" onClick={app.playback.previous} aria-label="Previous"><Icon name="previous" size={23} /></button>
        <button type="button" className="tv-icon-button tv-mini-play" onClick={app.playback.toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={23} /></button>
        <button type="button" className="tv-icon-button" onClick={app.playback.next} aria-label="Next"><Icon name="next" size={23} /></button>
        <button type="button" className="tv-icon-button" aria-label={`Repeat ${app.playback.repeat}`} aria-pressed={app.playback.repeat !== 'off'} onClick={() => app.playback.setRepeat(app.playback.repeat === 'off' ? 'all' : app.playback.repeat === 'all' ? 'one' : 'off')}><Icon name={app.playback.repeat === 'one' ? 'repeat_one' : 'repeat'} size={20} /></button>
        <button type="button" className="tv-icon-button" onClick={onQueue} aria-label="Open queue"><Icon name="queue" size={22} /></button>
      </div>
      <div className="tv-mini-progress" aria-hidden="true"><span style={{ width: Math.max(0, Math.min(100, positionMs / (durationMs || track.durationMs || 1) * 100)) + '%' }} /></div>
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
      className={`tv-track ${app.playback.player.track?.id === song.id ? 'is-current' : ''}`} aria-current={app.playback.player.track?.id === song.id ? 'true' : undefined} aria-label={`Play ${displaySongTitle(song.title, song.artist)} by ${song.artist}`} onClick={() => {
        app.playback.setShuffle('off');
        app.playback.setRepeat('off');
        void app.playback.play(song, songs, title);
      }}>
      <span className="tv-track-number" aria-hidden="true">{index + 1}</span><Cover song={song} /><span className="tv-track-copy"><strong>{displaySongTitle(song.title, song.artist)}</strong><small>{song.artist}</small></span><span className="tv-track-duration">{song.durationMs > 0 ? formatTime(song.durationMs) : ''}</span><Icon name={app.playback.player.track?.id === song.id ? 'equalizer' : 'play'} size={19} />
    </button>)}
  </div>
  {songs.length > limit && <button type="button" className="tv-button" onClick={() => setLimit(value => value + 36)}>Show more songs</button>}</section>;
}

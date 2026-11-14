import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';
import { figmaAssets } from './figmaAssets';
import { THEMES, TV_THEMES, useApp } from './AppContext';
import { formatTime } from './library';
import { isTvEnvironment } from './spatialNav';
import type { Song } from './types';
import albumDark from '../../Cine_Music_Android_Asset_Pack/source_svg/cine_placeholder_album_dark.svg';
import albumLight from '../../Cine_Music_Android_Asset_Pack/source_svg/cine_placeholder_album_light.svg';
import artistDark from '../../Cine_Music_Android_Asset_Pack/source_svg/cine_placeholder_artist_dark.svg';
import artistLight from '../../Cine_Music_Android_Asset_Pack/source_svg/cine_placeholder_artist_light.svg';
import playlistDark from '../../Cine_Music_Android_Asset_Pack/source_svg/cine_placeholder_playlist_dark.svg';
import playlistLight from '../../Cine_Music_Android_Asset_Pack/source_svg/cine_placeholder_playlist_light.svg';

const activeSheets: HTMLElement[] = [];

export function Brand({ compact = false }: { compact?: boolean }) {
  const { theme } = useApp();
  const src = isTvEnvironment() ? '/cine-tv-logo.png' : figmaAssets[theme].logo;
  return compact ? <img className="brand-symbol" src={src} alt="Cine music" draggable={false} />
    : <span className="brand-wordmark"><img src={src} alt="" draggable={false} /><span>Cine music</span></span>;
}

export function ThemeEdition({ changeLabel = false }: { changeLabel?: boolean }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const isTv = isTvEnvironment();
  const themes = isTv ? TV_THEMES : THEMES;
  const selected = themes.find(item => item.id === app.theme) || themes[0];
  return <><button type="button" className="theme-edition" aria-label={`Change theme, currently ${selected.name}`} onClick={() => setOpen(true)}>{changeLabel && <i />}{selected.name}{changeLabel && <span>Change theme</span>}</button>
    {open && <Sheet title="Choose your look" onClose={() => setOpen(false)}><div className="theme-picker" role="radiogroup" aria-label="App theme">{themes.map(item => <button type="button" role="radio" aria-checked={app.theme === item.id} key={item.id} onClick={() => { app.setTheme(item.id); setOpen(false); }}><img src={figmaAssets[item.id].logo} alt="" /><span><strong>{item.name}</strong><small>{item.description}</small></span>{app.theme === item.id && <Icon name="check" size={18} />}</button>)}</div></Sheet>}
  </>; }

export function Cover({ song, large = false, kind = 'album', className = '' }: {
  song?: Partial<Song> | null; large?: boolean; kind?: 'album' | 'artist' | 'playlist' | 'song'; className?: string;
}) {
  const { theme } = useApp();
  const [failed, setFailed] = useState('');
  const light = theme === 'light' || theme === 'default';
  const placeholder = kind === 'artist' ? (light ? artistLight : artistDark) : kind === 'playlist' ? (light ? playlistLight : playlistDark) : light ? albumLight : albumDark;
  const src = song?.cover && failed !== song.cover ? song.cover : placeholder;
  return <span className={`cover ${large ? 'cover-large' : ''} ${kind === 'artist' ? 'cover-round' : ''} ${className}`}>
    <img src={src} alt="" loading={large ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => { if (song?.cover) setFailed(song.cover); }} />
  </span>;
}

export function Action({ icon, label, onClick, active = false, disabled = false, className = '' }: {
  icon: IconName; label: string; onClick: () => void; active?: boolean; disabled?: boolean; className?: string;
}) {
  return <button type="button" data-control={icon} className={`icon-action ${active ? 'active' : ''} ${className}`} aria-label={label} title={label} aria-pressed={['heart', 'shuffle', 'sparkles', 'repeat', 'repeat_one'].includes(icon) ? active : undefined} disabled={disabled} onClick={onClick}>
    <Icon name={icon} filled={icon === 'heart' && active} />
  </button>;
}

export function Notice({ title, children, action, icon = 'music' }: { title: string; children: ReactNode; action?: ReactNode; icon?: IconName }) {
  return <div className="empty-state"><span className="empty-mark"><Icon name={icon} size={26} /></span><h2>{title}</h2><div className="empty-copy">{children}</div>{action && <div className="empty-action">{action}</div>}</div>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { back } = useApp();
  return <header className="page-header"><div className="design-brand-row"><button className="brand-back" type="button" aria-label="Back" onClick={back}><Icon name="back" size={16} /><Brand /></button><ThemeEdition /></div>{title && <div className="design-title-row"><h1 tabIndex={-1}>{title}</h1>{action}</div>}</header>;
}

export function SearchField({ value, onChange, onSubmit, placeholder = 'Songs, artists, albums', label = 'Search music' }: {
  value: string; onChange: (value: string) => void; onSubmit?: () => void; placeholder?: string; label?: string;
}) {
  function submit(event: FormEvent) { event.preventDefault(); onSubmit?.(); (event.currentTarget as HTMLFormElement).querySelector('input')?.blur(); }
  return <form className="search-field" role="search" onSubmit={submit}><Icon name="search" /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} type="search" enterKeyHint="search" autoComplete="off" autoCapitalize="none" spellCheck={false} />{value && <Action icon="close" label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')} />}</form>;
}

export function SortControl({ value, onChange, options, label = 'Sort music' }: {
  value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value) || options[0];
  return <><div className="sort-control"><span>Sort by</span><button type="button" className="sort-trigger" aria-label={`${label}, ${current.label}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><strong>{current.label}</strong><Icon name="chevron_down" size={18} /></button></div>
    {open && <Sheet title="Sort by" onClose={() => setOpen(false)} className="sort-sheet"><div className="sort-options" role="radiogroup" aria-label={label}>{options.map(option => <button type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'sort-option selected' : 'sort-option'} data-sort={option.value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span><span className="sort-indicator" aria-hidden="true">{value === option.value && <Icon name="check" size={18} />}</span></button>)}</div></Sheet>}
  </>;
}

export function SongRows({ songs, context = 'Music', editablePlaylistId, showHearts = false, onPlay, singleTrack = false, queueSongs }: {
  songs: Song[]; context?: string; editablePlaylistId?: string; showHearts?: boolean; onPlay?: (song: Song) => void; singleTrack?: boolean; queueSongs?: Song[];
}) {
  const app = useApp();
  function move(id: string, offset: number) {
    app.account.setLibrary(old => ({ ...old, playlists: old.playlists.map(list => {
      if (list.id !== editablePlaylistId) return list;
      const at = list.songs.findIndex(song => song.id === id), to = at + offset;
      if (at < 0 || to < 0 || to >= list.songs.length) return list;
      const items = [...list.songs]; [items[at], items[to]] = [items[to], items[at]];
      return { ...list, songs: items };
    }) }));
  }
  return <div className="song-list">{songs.map((song, index) => {
    const current = app.playback.player.track?.id === song.id;
    const saved = app.isFavorite(song.id), downloaded = app.downloads.some(item => item.id === song.id);
    return <div className={`song-row ${current ? 'is-current' : ''} ${editablePlaylistId ? 'editable-song' : ''}`} key={song.id}>
      <button className="song-main" onClick={() => { onPlay?.(song); void app.playback.play(song, singleTrack ? [song] : queueSongs || songs, context); }} aria-label={`Play ${song.title} by ${song.artist}`}>
        <Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{downloaded && <Icon name="download" size={12} />}{song.artist}</small></span>
      </button>
      {showHearts ? <Action icon="heart" label={`${saved ? 'Remove' : 'Save'} ${song.title} ${saved ? 'from' : 'to'} Favorites`} active={saved} onClick={() => app.toggleFavorite(song)} /> : <span className="song-duration">{formatTime(song.durationMs)}</span>}
      <Action icon="more" label={`Options for ${song.title}`} onClick={() => app.openMenu(song)} />
      {editablePlaylistId && <div className="song-edit-actions"><span className="muted">Track {index + 1}</span><Action icon="chevron_up" label={`Move ${song.title} up`} disabled={index === 0} onClick={() => move(song.id, -1)} /><Action icon="chevron_down" label={`Move ${song.title} down`} disabled={index === songs.length - 1} onClick={() => move(song.id, 1)} /><Action icon="close" label={`Remove ${song.title} from playlist`} onClick={() => app.account.setLibrary(old => ({ ...old, playlists: old.playlists.map(list => list.id === editablePlaylistId ? { ...list, songs: list.songs.filter(item => item.id !== song.id) } : list) }))} /></div>}
    </div>;
  })}</div>;
}

export function Sheet({ title, children, onClose, full = false, active = true, className = '', header = true }: {
  title: string; children: ReactNode; onClose: () => void; full?: boolean; active?: boolean; className?: string; header?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { panel.current?.toggleAttribute('inert', !active); }, [active]);
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement;
    return () => { if (previous.current?.isConnected) previous.current.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const node = panel.current;
    if (!node || !active) return;
    activeSheets.push(node);
    const first = node.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]');
    if (!node.contains(document.activeElement)) (first || node).focus({ preventScroll: true });
    function nativeBack(event: Event) {
      if (activeSheets.at(-1) !== node) return;
      event.preventDefault(); event.stopImmediatePropagation(); close.current();
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab' || !node) return;
      const controls = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    node.addEventListener('keydown', keydown);
    window.addEventListener('cine:back', nativeBack, true);
    return () => { node.removeEventListener('keydown', keydown); window.removeEventListener('cine:back', nativeBack, true); const at = activeSheets.indexOf(node); if (at >= 0) activeSheets.splice(at, 1); };
  }, [active]);
  return <div className={`modal-scrim ${full ? 'fullscreen-scrim' : ''} ${className}`} onClick={event => { if (active && event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} className={`modal-sheet ${full ? 'fullscreen-sheet' : ''}`} role="dialog" aria-modal={active ? 'true' : undefined} aria-hidden={!active ? true : undefined} aria-label={title} tabIndex={-1}>
      {header && <header className="sheet-header"><h2>{title}</h2><Action icon={full ? 'chevron_down' : 'close'} label={full ? `Collapse ${title.toLowerCase()}` : `Close ${title.toLowerCase()}`} onClick={onClose} /></header>}{children}
    </section>
  </div>;
}

export function ConfirmDialog({ title, children, onConfirm, onClose, confirmLabel = 'Confirm', destructive = false }: {
  title: string; children: ReactNode; onConfirm: () => void | Promise<void>; onClose: () => void; confirmLabel?: string; destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function confirm() { if (busy) return; setBusy(true); try { await onConfirm(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'This action could not be completed.'); } finally { setBusy(false); } }
  return <Sheet title={title} className="confirmation-scrim" onClose={() => { if (!busy) onClose(); }}><div className="confirmation-copy">{children}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="confirmation-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button className={`primary-button ${destructive ? 'danger-button' : ''}`} onClick={() => void confirm()} disabled={busy}>{busy ? 'Please wait...' : confirmLabel}</button></div></Sheet>;
}

import { useContext } from 'react';
import { AppContext } from './AppContext';
import { figmaAssets } from './figmaAssets';
export type IconName = 'home' | 'search' | 'explore' | 'library' | 'download' | 'account' | 'check' | 'play' | 'pause' | 'next' | 'previous' | 'heart' | 'close' | 'back' | 'queue' | 'plus' | 'shuffle' | 'repeat' | 'repeat_one' | 'settings' | 'music' | 'trash' | 'wifi' | 'lyrics' | 'more' | 'chevron_down' | 'lock' | 'headphones' | 'chevron_up' | 'chevron_right' | 'album' | 'artist' | 'playlist' | 'equalizer' | 'timer' | 'share' | 'bell' | 'info' | 'edit' | 'logout' | 'eye' | 'drag' | 'sort' | 'arrow_right' | 'refresh' | 'mail' | 'shield' | 'eye_off' | 'tag' | 'camera' | 'folder';
const paths: Partial<Record<IconName, React.ReactNode>> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></>,
  library: <><rect x="3" y="4" width="5" height="16" rx="1" /><path d="M12 4v16m5-16 4 15" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  play: <path d="m8 4 13 8-13 8z" fill="currentColor" stroke="none" />,
  pause: <><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none" /></>,
  next: <><path d="m5 4 12 8L5 20z" fill="currentColor" stroke="none" /><path d="M19 4v16" /></>,
  previous: <><path d="M19 4 7 12l12 8z" fill="currentColor" stroke="none" /><path d="M5 4v16" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  back: <path d="m15 5-7 7 7 7" />,
  queue: <><path d="M4 5h16M4 10h16M4 15h7M4 20h7" /><path d="m16 14 5 3-5 3z" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  shuffle: <><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 5-5m2-3c2-3 3-4 5-4h3m-4-4 4 4-4 4" /></>,
  repeat: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /></>,
  repeat_one: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3" /><path d="M12 10v5m-1.5-3.5L12 10l1.5 1.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3z" /></>,
  music: <><path d="M9 17V5l11-2v12M9 9l11-2" /><ellipse cx="6" cy="18" rx="3" ry="3" /><ellipse cx="17" cy="16" rx="3" ry="3" /></>,
  trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
  wifi: <><path d="M2 8a17 17 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a5 5 0 0 1 8 0" /><circle cx="12" cy="20" r="1" /></>,
  chevron_up: <path d="m6 15 6-6 6 6"/>,
  chevron_right: <path d="m9 18 6-6-6-6"/>,
  headphones: <><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="13" width="5" height="8" rx="2"/><rect x="17" y="13" width="5" height="8" rx="2"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  chevron_down: <path d="m6 9 6 6 6-6"/>,
  lyrics: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 8h10M7 12h10m-10 4h6" /></>,
  album: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  artist: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  playlist: <><path d="M3 5h12M3 10h10M3 15h7M17 19V6l4 2"/><circle cx="14" cy="19" r="3"/></>,
  equalizer: <><path d="M4 5v14M12 3v18M20 5v14M1 9h6M9 15h6M17 9h6"/></>,
  timer: <><circle cx="12" cy="14" r="8"/><path d="M12 6V3M9 2h6m3 5 2-2m-8 5v5l3 2"/></>,
  share: <><circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m8 11 8-5M8 13l8 5"/></>,
  bell: <><path d="M5 9a7 7 0 0 1 14 0v6l2 3H3l2-3zM9 21h6"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
  edit: <><path d="m15 4 5 5M4 20l2-6L16 4a3 3 0 0 1 4 4L10 18z"/></>,
  logout: <><path d="M10 3H4v18h6M8 12h13m-5-5 5 5-5 5"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  drag: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  sort: <><path d="M4 5h16M4 12h10M4 19h5m8-6v8m-3-3 3 3 3-3"/></>,
};
export function Icon({ name, filled = false, size = 22, active = false }: { name: IconName; filled?: boolean; size?: number; active?: boolean }) {
  const app = useContext(AppContext);
  const skin = figmaAssets[app?.theme || 'default'];
  const src = active ? skin.nav[name] || skin.icons[name] : skin.icons[name];
  if (src && !(name === 'heart' && filled) && name !== 'repeat_one') {
    return <span className="cine-icon-mask figma-icon" data-icon={name} style={{ width: size, height: size, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} aria-hidden="true" />;
  }
  const assetName = name === 'plus' ? 'add' : name === 'heart' && filled ? 'heart_filled' : name;
  if (['home', 'search', 'library', 'download', 'play', 'pause', 'next', 'previous', 'heart', 'heart_filled', 'close', 'back', 'queue', 'add', 'shuffle', 'repeat', 'repeat_one', 'settings', 'music', 'more', 'chevron_down', 'headphones', 'album', 'artist', 'playlist', 'equalizer', 'timer', 'share'].includes(assetName)) {
    const url = `url("/cine-icons/cine_${assetName}.svg")`;
    return <span className="cine-icon-mask" data-icon={assetName} style={{ width: size, height: size, maskImage: url, WebkitMaskImage: url }} aria-hidden="true" />;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

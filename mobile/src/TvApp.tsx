import { useEffect, useRef, useState } from 'react';
import { AppContext, TV_THEMES, tvThemeId, type AppState, type Preferences, type Tab, type Theme } from './AppContext';
import { TvAuth } from './TvAuth';
import { TvShell, type TvEntry } from './TvLayout';
import { TvHomeScreen } from './TvHomeScreen';
import { TvSearchScreen } from './TvSearchScreen';
import { TvRouteScreen, TvLibraryScreen } from './TvRoutes';
import { TvPlayer } from './TvPlayer';
import { useAccount } from './useAccount';
import { useGenreWarmup } from './useLibraryGenres';
import { usePlayback } from './usePlayback';
import { useSmartFeatures } from './useSmartFeatures';
import { control, subscribe } from './native';
import { isOnline, onConnectivityChange } from './network';
import { loadSaved, save, toggleFavorite } from './library';
import { focusElement } from './spatialNav';
import { Brand } from './ui';
import { syncThemeIcon } from './themeIcons';
import { trackEvent, trackPageView } from './analytics';
import './tv.css';
import './tv-browse-polish.css';
import './tv-refinement.css';
import './interaction-system.css';

const noop = () => {};
const defaults: Preferences = { autoplay: true, wifiOnly: true, reducedMotion: 'system', haptics: false,
  privateListening: false, equalizerOn: false, eqBands: [0, 0, 0, 0, 0], eqPreset: 'Flat',
  audioQuality: 'auto', gapless: false, crossfadeSeconds: 0 };
export type TvOverlay = 'player' | 'lyrics' | 'queue';

export default function TvApp() {
  const account = useAccount();
  const followedArtistNames = account.library.artists.map(artist => artist.name).join('\n');
  useEffect(() => {
    if (!account.ready || !account.user?.emailVerified) return;
    window.CineAndroid?.notificationArtists?.(JSON.stringify(account.library.artists.map(artist => artist.name)));
  }, [account.ready,account.user?.localId,account.user?.emailVerified,followedArtistNames]);
  const [theme, setTheme] = useState<Theme>(() => tvThemeId(loadSaved('cine-tv-theme-v2', 'default')));
  const [prefs, setPrefs] = useState<Preferences>(() => ({ ...defaults, ...loadSaved('tv-preferences', {}) }));
  const [tab, setTab] = useState<Tab>('home');
  const [routes, setRoutes] = useState<TvEntry[]>([]);
  const [searchStarted, setSearchStarted] = useState(false);
  const [overlay, setOverlay] = useState<TvOverlay | null>(null);
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(isOnline);
  useGenreWarmup(account.library.favorites, account.user?.emailVerified === true && account.ready, online);
  const toast = setMessage;
  const playback = usePlayback({ downloads: [], prefs, toast, streamOnly: true,
    owner: account.user?.localId || '', favorites: account.library.favorites, recent: account.library.recent,
    onRecent: song => {
      if (!account.user?.emailVerified || prefs.privateListening) return;
      account.setLibrary(old => ({ ...old, recent: [song, ...old.recent.filter(item => item.id !== song.id)].slice(0, 40) }));
    } });
  const smart = useSmartFeatures(account.user, prefs.privateListening, playback);
  const verified = account.user?.emailVerified === true;
  const returnFocus = useRef<HTMLElement | null>(null);
  const queueFromBrowsing = useRef(false);
  const pendingSystemPlayer = useRef(false);
  const previousVerified = useRef(verified);
  const state = useRef({ overlay, routes, tab, playback, verified });
  state.current = { overlay, routes, tab, playback, verified };
  const page = routes.at(-1);

  function closeOverlay() {
    const restoreQueue = queueFromBrowsing.current;
    queueFromBrowsing.current = false;
    setOverlay(null);
    window.setTimeout(() => {
      const target = returnFocus.current?.isConnected ? returnFocus.current
        : restoreQueue ? document.querySelector<HTMLButtonElement>('button[aria-label="Open queue"]') : null;
      if (target) focusElement(target);
    }, 80);
  }
  function back() {
    const current = state.current;
    if (current.overlay === 'queue' && queueFromBrowsing.current) { closeOverlay(); return true; }
    if (current.overlay === 'lyrics' || current.overlay === 'queue') { setOverlay('player'); return true; }
    if (current.overlay) { closeOverlay(); return true; }
    if (current.routes.length) { setRoutes(old => old.slice(0, -1)); return true; }
    if (current.tab !== 'home') { setTab('home'); return true; }
    return false;
  }
  useEffect(() => onConnectivityChange(() => setOnline(isOnline())), []);
  useEffect(()=>{
    pendingSystemPlayer.current=!!window.CineAndroid?.consumePlayerOpen?.();
    return subscribe(event=>{if(event.type==='widgetError'||event.type==='systemSettingsError')setMessage(String(event.data.message||'This system action is unavailable.'));if(event.type==='openPlayer'){
      window.CineAndroid?.consumePlayerOpen?.();pendingSystemPlayer.current=true;
      if(state.current.verified&&state.current.playback.player.track){pendingSystemPlayer.current=false;setOverlay('player');}
    }});
  },[]);
  useEffect(() => {
    save('cine-tv-theme-v2', theme);
    if (!syncThemeIcon(theme)) toast('The theme changed, but the launcher icon could not update. Try again in Settings.');
    const background = TV_THEMES.find(item => item.id === theme)?.background || TV_THEMES[0].background;
    window.CineAndroid?.setSystemBars(background, theme === 'default');
  }, [theme]);
  useEffect(() => { save('tv-preferences', prefs); }, [prefs]);
  useEffect(() => {
    if (!verified) { control('stop'); window.CineAndroid?.stopDjVoice?.(); }
    setTab('home'); setRoutes([]); setOverlay(null);
  }, [verified, account.user?.localId]);
  useEffect(()=>{if(verified&&playback.player.track&&pendingSystemPlayer.current){pendingSystemPlayer.current=false;setOverlay('player');}},[verified,playback.player.track?.id]);
  useEffect(() => {
    if (verified === previousVerified.current) return;
    previousVerified.current = verified;
    trackEvent(verified ? 'sign_in' : 'sign_out', { path: 'account' });
  }, [verified]);
  useEffect(() => {
    if (!verified) return;
    const route = routes.at(-1)?.route;
    trackPageView(`tv/${overlay ? 'overlay-' + overlay : route ? route.kind : tab}`);
  }, [tab, routes.at(-1)?.key, overlay, verified]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    function nativeBack(event: Event) { if (back()) event.preventDefault(); }
    function transport(event: Event) {
      const action = (event as CustomEvent<{ action: string }>).detail.action;
      const current = state.current;
      if (!current.verified) return;
      if (action === 'play_pause') current.playback.toggle();
      if (action === 'play') control('resume');
      if (action === 'pause') control('pause');
      if (action === 'next') current.playback.next();
      if (action === 'previous') current.playback.previous();
    }
    window.addEventListener('cine:back', nativeBack);
    window.addEventListener('cine:remote-transport', transport);
    return () => {
      window.removeEventListener('cine:back', nativeBack);
      window.removeEventListener('cine:remote-transport', transport);
    };
  }, []);
  const playing = verified && ['playing', 'loading'].includes(playback.player.status);
  useEffect(() => {
    window.CineAndroid?.keepTvScreenOn?.(playing);
    return () => window.CineAndroid?.keepTvScreenOn?.(false);
  }, [playing]);

  const app: AppState = {
    account, playback, smart, theme, setTheme: value => setTheme(tvThemeId(value)), prefs, updatePrefs: patch => setPrefs(old => ({ ...old, ...patch })), tab,
    goTab: next => { if (next === 'search') setSearchStarted(true); setTab(next); setRoutes([]); },
    openRoute: route => {
      if (route.kind === 'playlist-form' || route.kind === 'playlist-import') return;
      setRoutes(old => [...old.slice(-12), { key: crypto.randomUUID(), route }]);
    },
    back,
    openPlayer: () => {
      if (!playback.player.track) return;
      queueFromBrowsing.current = false;
      returnFocus.current = document.activeElement as HTMLElement;
      setOverlay('player');
    },
    openMenu: noop, openUtility: noop, toast, online, downloads: [], jobs: [], download: noop, removeDownload: noop,
    downloadMany: async () => { toast('Protected downloads are available in the phone app.'); },
    refreshDownloads: noop, toggleFavorite: song => account.setLibrary(old => ({ ...old, favorites: toggleFavorite(old.favorites, song) })),
    isFavorite: id => account.library.favorites.some(song => song.id === id),
    setAddToPlaylist: noop, addToPlaylist: null, checkForUpdates: noop,
  };

  return <AppContext.Provider value={app}><div className="tv-app" data-theme={theme} data-reduced-motion={prefs.reducedMotion==='on'||prefs.reducedMotion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches}>
    {!verified ? <TvAuth onSuccess={account.signIn} /> : !account.ready ? <main className="tv-wait">
      <Brand /><h1>Opening your library</h1><p role="status">{account.syncStatus}</p>
      <div className="tv-actions"><button className="tv-button" onClick={account.retrySync}>Retry sync</button><button className="tv-button" onClick={account.signOut}>Sign out</button></div>
    </main> : <>
      <TvShell page={page?.key || tab} main={!page} settings={page?.route.kind === 'account'} overlay={Boolean(overlay)} onQueue={() => { returnFocus.current = document.activeElement as HTMLElement; queueFromBrowsing.current = true; setOverlay('queue'); }}>
        {searchStarted && <div hidden={Boolean(page) || tab !== 'search'}><TvSearchScreen active={!page && tab === 'search'} /></div>}
        {page ? <TvRouteScreen key={page.key} route={page.route} /> : tab === 'library' ? <TvLibraryScreen /> : tab === 'home' ? <TvHomeScreen /> : null}
      </TvShell>
      {overlay && playback.player.track && <TvPlayer mode={overlay} onMode={setOverlay} onBack={back} />}
    </>}
    {message && <div role="status" className="tv-toast">{message}</div>}
  </div></AppContext.Provider>;
}

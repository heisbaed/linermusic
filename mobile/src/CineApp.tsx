import { useEffect, useRef, useState } from 'react';
import { AppContext, THEMES, type AppState, type Preferences, type Route, type Tab, type Theme, type Utility } from './AppContext';
import { Icon } from './Icons';
import { Brand, Action, ThemeEdition } from './ui';
import { ExploreScreen } from './Explore';
import { PlaylistImport } from './PlaylistImport';
import { useListeningRecorder } from './useListening';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { songFrom } from './Browse';
import { loadSaved, save, toggleFavorite } from './library';
import { useAccount } from './useAccount';
import { usePlayback } from './usePlayback';
import { useDownloads } from './useDownloads';
import { HomeScreen, SearchScreen, LibraryScreen, CollectionScreen, CatalogScreen, PlaylistScreen, PlaylistForm } from './Browse';
import { AccountScreen } from './Account';
import { FirebaseAuth } from './FirebaseAuth';
import { OnboardingScreen } from './Onboarding';
import { MiniPlayer, FullPlayer, QueueSheet, SongMenu, UtilitySheet, useLyrics } from './Player';
import type { Song } from './types';
import { control, subscribe } from './native';

type RouteEntry = { key: string; route: Route };
type SheetState = { kind: 'queue' } | { kind: 'menu'; song: Song } | { kind: Utility };

function initialPreferences(): Preferences {
  const stored = loadSaved<Partial<Preferences>>('preferences-v3', {});
  return {
    autoplay: Boolean(stored.autoplay ?? loadSaved('autoplay', false)),
    wifiOnly: Boolean(stored.wifiOnly ?? loadSaved('wifi-only-downloads', true)),
    reducedMotion: ['system', 'on', 'off'].includes(stored.reducedMotion || '') ? stored.reducedMotion! : loadSaved('reduced-motion', false) ? 'on' : 'system',
    haptics: Boolean(stored.haptics ?? false),
    privateListening: Boolean(stored.privateListening ?? false),
    equalizerOn: Boolean(stored.equalizerOn ?? loadSaved('equalizer-on', false)),
    eqBands: Array.isArray(stored.eqBands) && stored.eqBands.length === 5 ? stored.eqBands : loadSaved('eq-bands', [0, 0, 0, 0, 0]),
    eqPreset: stored.eqPreset || loadSaved('eq-preset', 'Flat'),
  };
}

export default function CineApp() {
  const account = useAccount();
  const [theme, setTheme] = useState<Theme>(() => { const value = loadSaved<Theme>('cine-theme-v2', 'default'); return THEMES.some(item => item.id === value) ? value : 'default'; });
  const [prefs, setPrefs] = useState(initialPreferences);
  const [tab, setTab] = useState<Tab>('home');
  const [routes, setRoutes] = useState<RouteEntry[]>(() => new URLSearchParams(location.search).has('oobCode') ? [{ key: crypto.randomUUID(), route: { kind: 'account', page: 'auth' } }] : []);
  const [playerOpen, setPlayerOpen] = useState(false), [lyricsOpen, setLyricsOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [message, setMessage] = useState<{ text: string; at: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [deviceReducedMotion, setDeviceReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [keyboard, setKeyboard] = useState(false);
  const [addToPlaylist, setAddToPlaylist] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const toast = (text: string) => setMessage({ text, at: Date.now() });
  const downloads = useDownloads(prefs, toast);
  const playback = usePlayback({ downloads: downloads.downloads, prefs, toast, onRecent: song => { if (account.user?.emailVerified && !prefs.privateListening) account.setLibrary(old => ({ ...old, recent: [song, ...old.recent.filter(item => item.id !== song.id)].slice(0, 40) })); } });
  useLyrics(playback.player.track, true);
  const verified = account.user?.emailVerified === true;
  useListeningRecorder(account.user?.localId || '', playback.player, verified && !prefs.privateListening);
  const canAccess = verified && account.ready && account.library.taste.completed;
  const access = useRef(canAccess); access.current = canAccess;
  const previousAccount = useRef(account.user?.localId);
  const live = useRef({ routes, tab, sheet, playerOpen, lyricsOpen });
  live.current = { routes, tab, sheet, playerOpen, lyricsOpen };
  const currentRoute = routes.at(-1)?.route;
  const accountRoute = currentRoute?.kind === 'account';
  const focusedForm = currentRoute?.kind === 'playlist-form' || currentRoute?.kind === 'playlist-import' || (accountRoute && ['auth', 'music-preferences', 'edit-profile', 'change-email', 'change-password', 'delete-account'].includes(currentRoute.page));
  const reduced = prefs.reducedMotion === 'on' || (prefs.reducedMotion === 'system' && deviceReducedMotion);
  const songLinkTask=useRef<AbortController|null>(null);
  useEffect(()=>{
    if(!canAccess)return;
    async function openSong(){
      const id=window.CineAndroid?.consumeSongLink?.();
      if(!id||!/^[a-zA-Z0-9_-]{11}$/.test(id))return;
      songLinkTask.current?.abort();const controller=new AbortController();songLinkTask.current=controller;
      try{
        const track=await innertubeCatalog.getTrack(id,controller.signal);
        if(controller.signal.aborted||!access.current)return;
        const song=songFrom(track);await playback.play(song,[song],'Shared song');
        setSheet(null);setLyricsOpen(false);setPlayerOpen(true);
      }catch(e){if(!controller.signal.aborted)toast(e instanceof Error?e.message:'This song could not be opened.');}
    }
    void openSong();const unsubscribe=subscribe(event=>{if(event.type==='songLink')void openSong();});
    return()=>{unsubscribe();songLinkTask.current?.abort();};
  },[canAccess,account.user?.localId]);

  function guardedNavigation(action: () => void) {
    if (!access.current) return;
    const event = new CustomEvent('cine:before-navigate', { cancelable: true, detail: { proceed: action } });
    if (window.dispatchEvent(event)) action();
  }
  function goTab(next: Tab) { guardedNavigation(() => { setTab(next); setRoutes([]); setSheet(null); setPlayerOpen(false); setLyricsOpen(false); }); }
  function openRoute(route: Route) { guardedNavigation(() => { setSheet(null); setPlayerOpen(false); setLyricsOpen(false); setRoutes(items => [...items, { key: crypto.randomUUID(), route }]); }); }
  function back(): boolean {
    if (!access.current) return false;
    const state = live.current;
    if (state.sheet) { setSheet(null); return true; }
    if (state.lyricsOpen) { setLyricsOpen(false); return true; }
    if (state.playerOpen) { setPlayerOpen(false); return true; }
    if (state.routes.length) { guardedNavigation(() => setRoutes(items => items.slice(0, -1))); return true; }
    if (state.tab !== 'home') { setTab('home'); return true; }
    return false;
  }

  useEffect(() => {
    function openAuth() {
      setSheet(null); setPlayerOpen(false); setLyricsOpen(false);
      setRoutes(items => items.at(-1)?.route.kind === 'account' && (items.at(-1)?.route as { page: string }).page === 'auth' ? items : [...items, { key: crypto.randomUUID(), route: { kind: 'account', page: 'auth' } }]);
    }
    const unsubscribe = subscribe(event => { if (event.type === 'authLink') openAuth(); });
    window.addEventListener('cine:open-auth', openAuth);
    return () => { unsubscribe(); window.removeEventListener('cine:open-auth', openAuth); };
  }, []);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setDeviceReducedMotion(motion.matches);
    const connectivity = () => setOnline(navigator.onLine);
    const nativeBack = (event: Event) => { if (!event.defaultPrevented && back()) event.preventDefault(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented && back()) event.preventDefault(); };
    const storageError = () => toast('Device storage is full. Your latest change may not survive a restart. Free space and try again.');
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
    window.addEventListener('cine:back', nativeBack); window.addEventListener('keydown', escape); window.addEventListener('cine:storage-error', storageError);
    motion.addEventListener('change', updateMotion);
    let fullHeight = innerHeight, width = innerWidth;
    function resized() {
      if (innerWidth !== width) { fullHeight = innerHeight; width = innerWidth; }
      fullHeight = Math.max(fullHeight, innerHeight);
      const formFocused = document.activeElement?.matches('input,textarea,select') || false;
      setKeyboard(formFocused && (window.visualViewport?.height || innerHeight) < fullHeight * 0.76);
    }
    window.visualViewport?.addEventListener('resize', resized); window.addEventListener('resize', resized); window.addEventListener('focusout', resized);
    return () => {
      window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity);
      window.removeEventListener('cine:back', nativeBack); window.removeEventListener('keydown', escape); window.removeEventListener('cine:storage-error', storageError);
      motion.removeEventListener('change', updateMotion); window.visualViewport?.removeEventListener('resize', resized); window.removeEventListener('resize', resized); window.removeEventListener('focusout', resized);
    };
  }, []);
  useEffect(() => {
    // A valid offline session is still authenticated. Only losing authentication stops audio.
    if (!verified) control('stop');
  }, [verified]);
  useEffect(() => {
    if (previousAccount.current !== account.user?.localId) {
      previousAccount.current = account.user?.localId;
      setRoutes([]); setTab('home'); setSheet(null); setPlayerOpen(false); setLyricsOpen(false); setAddToPlaylist(null);
    }
  }, [account.user?.localId]);
  useEffect(() => {
    save('cine-theme-v2', theme);
    const background = THEMES.find(item => item.id === theme)!.background;
    document.body.style.backgroundColor = background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
    window.CineAndroid?.setSystemBars(background, theme === 'light');
  }, [theme]);
  useEffect(() => { save('preferences-v3', prefs); save('wifi-only-downloads', prefs.wifiOnly); }, [prefs]);
  useEffect(() => { if (!message) return; const timeout = setTimeout(() => setMessage(null), 6500); return () => clearTimeout(timeout); }, [message]);
  useEffect(() => { viewport.current?.toggleAttribute('inert', playerOpen || Boolean(sheet)); }, [playerOpen, sheet]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { const heading = viewport.current?.querySelector<HTMLElement>('.route-layer:not([hidden]) h1, .tab-screen:not([hidden]) h1'); if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); } });
    return () => cancelAnimationFrame(frame);
  }, [routes.at(-1)?.key, tab, canAccess]);

  const app: AppState = {
    account, playback, theme, setTheme, prefs, updatePrefs: patch => setPrefs(old => ({ ...old, ...patch })), tab, goTab, openRoute, back,
    openPlayer: () => { if (playback.player.track) { setLyricsOpen(false); setPlayerOpen(true); } },
    openMenu: song => setSheet({ kind: 'menu', song }), openUtility: utility => setSheet({ kind: utility }), toast, online, ...downloads,
    toggleFavorite: song => { account.setLibrary(old => ({ ...old, favorites: toggleFavorite(old.favorites, song) })); if (prefs.haptics && navigator.vibrate) { try { navigator.vibrate(9); } catch { /* Haptics are optional on this device. */ } } toast(account.library.favorites.some(item => item.id === song.id) ? 'Removed from Favorites.' : 'Saved to Favorites.'); },
    isFavorite: id => account.library.favorites.some(song => song.id === id), addToPlaylist, setAddToPlaylist,
  };
  const profileName = account.library.profile.name || account.user?.displayName || 'Guest';
  return <AppContext.Provider value={app}><div className="cine-app" data-theme={theme} data-reduced-motion={reduced} data-native={Boolean(window.CineAndroid)}>
    {!verified ? <main className="screen account-screen auth-screen auth-gate" aria-label="Sign in to Cine music"><FirebaseAuth initialUser={account.user} onClose={() => window.CineAndroid?.background()} onSuccess={user => { account.signIn(user); setRoutes([]); setTab('home'); setSheet(null); setPlayerOpen(false); setLyricsOpen(false); }} /></main>
      : !account.ready ? <main className="screen account-hydration" aria-label="Opening account library"><Brand /><span className="spinner" aria-hidden="true" /><h1>Bringing your music home.</h1><p role="status">{account.syncStatus}</p><p>We are checking your saved preferences before opening Home. Your account stays signed in if the connection drops.</p><button className="account-primary" onClick={account.retrySync}>Retry connection</button><button className="text-button" onClick={account.signOut}>Use another account</button></main>
      : !account.library.taste.completed ? <OnboardingScreen key={account.user!.localId} /> : <>
    <div className="app-viewport" ref={viewport} aria-hidden={playerOpen || Boolean(sheet) ? true : undefined}>
      {!routes.length && <header className="app-header"><button className="brand-profile" aria-label="Open profile" onClick={() => openRoute({ kind: 'account', page: 'profile' })}><Brand /></button><div className="header-end">{!online && <button className="offline-tag" onClick={() => openRoute({ kind: 'account', page: 'offline' })}>Offline</button>}<ThemeEdition /></div></header>}
      <main className="app-main" aria-label="Music content">
        <div className="tab-screen" hidden={tab !== 'home' || routes.length > 0}><HomeScreen /></div>
        <div className="tab-screen" hidden={tab !== 'search' || routes.length > 0}><SearchScreen /></div>
        <div className="tab-screen" hidden={tab !== 'explore' || routes.length > 0}><ExploreScreen /></div>
        <div className="tab-screen" hidden={tab !== 'library' || routes.length > 0}><LibraryScreen /></div>
        {routes.map((entry, at) => <div className="route-layer" key={entry.key} hidden={at !== routes.length - 1}>{renderRoute(entry.route)}</div>)}
      </main>
      <footer className="bottom-dock" hidden={playerOpen || focusedForm || keyboard}><MiniPlayer /><nav className="tab-bar" aria-label="Main navigation">{(['home', 'search', 'explore', 'library'] as const).map(id => <button key={id} className={tab === id ? 'selected' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => goTab(id)}><Icon name={id} active={tab === id} size={18} /><span>{id[0].toUpperCase() + id.slice(1)}</span></button>)}</nav></footer>
    </div>
    {playerOpen && playback.player.track && <FullPlayer lyricsOpen={lyricsOpen} onLyrics={() => setLyricsOpen(true)} onCloseLyrics={() => setLyricsOpen(false)} onClose={() => setPlayerOpen(false)} onQueue={() => setSheet({ kind: 'queue' })} onMenu={() => setSheet({ kind: 'menu', song: playback.player.track! })} active={!sheet} />}
    {sheet?.kind === 'queue' ? <QueueSheet onClose={() => setSheet(null)} /> : sheet?.kind === 'menu' ? <SongMenu song={sheet.song} onClose={() => setSheet(null)} openUtility={utility => setSheet({ kind: utility })} /> : sheet && <UtilitySheet utility={sheet.kind} onClose={() => setSheet(null)} />}
    </>}
    <div className="announcements" style={canAccess && (playerOpen || sheet) ? { top: 'calc(76px + env(safe-area-inset-top))', bottom: 'auto' } : { bottom: `calc(${!canAccess || focusedForm || keyboard ? 20 : accountRoute ? playback.player.track ? 100 : 20 : playback.player.track ? 172 : 92}px + env(safe-area-inset-bottom))` }} aria-live="polite" aria-atomic="true">{message && <div className="toast" key={message.at}><span>{message.text}</span><Action icon="close" label="Dismiss notification" onClick={() => setMessage(null)} /></div>}</div>
  </div></AppContext.Provider>;
}

function renderRoute(route: Route) {
  if (route.kind === 'collection') return <CollectionScreen collection={route.collection} />;
  if (route.kind === 'catalog') return <CatalogScreen type={route.type} id={route.id} />;
  if (route.kind === 'playlist') return <PlaylistScreen id={route.id} />;
  if (route.kind === 'playlist-form') return <PlaylistForm id={route.id} initialSong={route.initialSong} />;
  if (route.kind === 'playlist-import') return <PlaylistImport />;
  return <AccountScreen page={route.page} />;
}

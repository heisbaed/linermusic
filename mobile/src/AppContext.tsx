import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { CineUser } from './FirebaseAuth';
import type { PlayerState, Playlist, Song } from './types';
import type { MusicTaste } from './musicPreferences';
import type { useSmartFeatures } from './useSmartFeatures';

export type Theme = 'default' | 'dark' | 'green' | 'light';
export type Tab = 'home' | 'search' | 'explore' | 'library';
export type Collection = 'favorites' | 'recent' | 'downloads' | 'playlists' | 'albums' | 'artists';
export type ShuffleMode = 'off' | 'on' | 'smart';
export type Utility = 'sound' | 'devices' | 'timer';
export type Route =
  | { kind: 'collection'; collection: Collection }
  | { kind: 'playlist'; id: string }
  | { kind: 'catalog'; type: 'album' | 'artist' | 'playlist'; id: string }
  | { kind: 'playlist-form'; id?: string; initialSong?: Song }
  | { kind: 'playlist-import' }
  | { kind: 'account'; page: string };

export const TV_THEMES: { id: Theme; name: string; description: string; background: string; surface: string; accent: string }[] = [
  { id: 'default', name: 'Pink Liquid Glass', description: 'Liquid pink glass with rose highlights.', background: '#FFF3F7', surface: '#FFFAFD', accent: '#A82D65' },
  { id: 'dark', name: 'Dark cinema', description: 'Dark surfaces with rose highlights.', background: '#170F17', surface: '#3C2637', accent: '#FFA5CB' },
];

export interface SavedArtist { id: string; name: string; cover?: string }
export interface SavedAlbum { id: string; title: string; artist: string; cover?: string }
export interface SearchHistory { query: string; type?: 'artist' | 'album' | 'playlist'; id?: string; title?: string; subtitle?: string; cover?: string }
export interface Profile { name: string; username: string; photo?: string }
export interface LibraryData {
  favorites: Song[];
  playlists: Playlist[];
  recent: Song[];
  artists: SavedArtist[];
  albums: SavedAlbum[];
  history: SearchHistory[];
  profile: Profile;
  taste: MusicTaste;
}
export interface AccountState {
  user: CineUser | null;
  ready: boolean;
  library: LibraryData;
  setLibrary: Dispatch<SetStateAction<LibraryData>>;
  signIn: (user: CineUser) => void;
  signOut: () => void;
  syncStatus: string;
  retrySync: () => void;
  updateProfile: (profile: Profile) => Promise<void>;
  suspendSync: () => Promise<() => void>;
}
export interface Preferences {
  autoplay: boolean;
  wifiOnly: boolean;
  reducedMotion: 'system' | 'on' | 'off';
  haptics: boolean;
  privateListening: boolean;
  equalizerOn: boolean;
  eqBands: number[];
  eqPreset: string;
  audioQuality: 'auto' | 'low' | 'normal' | 'high';
  gapless: boolean;
  crossfadeSeconds: number;
}
export interface DownloadJob {
  id: string;
  song: Song;
  status: 'queued' | 'downloading' | 'paused' | 'failed';
  progress: number;
  error?: string;
  bytes?: number;
  totalBytes?: number;
  bytesPerSecond?: number;
}
export interface PlaybackController {
  player: PlayerState;
  queue: Song[];
  context: string;
  shuffle: ShuffleMode;
  repeat: 'off' | 'all' | 'one';
  play: (song: Song, list?: Song[], context?: string, positionMs?: number) => Promise<void>;
  playAll: (songs: Song[], random?: boolean, context?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setShuffle: (value: ShuffleMode) => void;
  cycleShuffle: () => void;
  setRepeat: (value: 'off' | 'all' | 'one') => void;
  setQueue: (value: Song[] | ((songs: Song[]) => Song[])) => void;
  playerLyrics: { text: string } | null;
  setPlayerLyrics?: (lyrics: { text: string } | null) => void;
}
export interface AppState {
  smart: ReturnType<typeof useSmartFeatures>;
  account: AccountState;
  playback: PlaybackController;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  prefs: Preferences;
  updatePrefs: (patch: Partial<Preferences>) => void;
  tab: Tab;
  goTab: (tab: Tab) => void;
  openRoute: (route: Route) => void;
  back: () => void;
  openPlayer: () => void;
  openMenu: (song: Song) => void;
  openUtility: (utility: Utility) => void;
  toast: (message: string) => void;
  online: boolean;
  downloads: Song[];
  jobs: DownloadJob[];
  download: (song: Song) => void;
  downloadMany: (songs: Song[]) => Promise<void>;
  removeDownload: (id: string) => void;
  refreshDownloads: () => void;
  toggleFavorite: (song: Song) => void;
  isFavorite: (id: string) => boolean;
  addToPlaylist: string | null;
  setAddToPlaylist: (id: string | null) => void;
  checkForUpdates: () => void;
}

export const THEMES: { id: Theme; name: string; description: string; background: string; surface: string; accent: string }[] = [
  { id: 'default', name: 'Pink glass', description: 'Soft pink, luminous white glass, and rose accents.', background: '#FFF3F7', surface: '#FFFAFD', accent: '#A82D65' },
  { id: 'green', name: 'Dark green', description: 'Forest-inspired depth with deep green surfaces and lime highlights.', background: '#071F19', surface: '#12392E', accent: '#CBF595' },
  { id: 'light', name: 'Smoke white', description: 'Light, airy surfaces with soft charcoal and olive accents.', background: '#F2F0EC', surface: '#FFFFFF', accent: '#555F48' },
  { id: 'dark', name: 'Dark', description: 'Minimal charcoal surfaces with soft silver accents.', background: '#101112', surface: '#202224', accent: '#DADCD6' },
];

export function tvThemeId(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'default';
}

export const AppContext = createContext<AppState | null>(null);
export function useApp(): AppState {
  const app = useContext(AppContext);
  if (!app) throw new Error('Cine music screen requires the application provider.');
  return app;
}

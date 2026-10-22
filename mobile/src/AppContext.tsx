import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { CineUser } from './FirebaseAuth';
import type { PlayerState, Playlist, Song } from './types';
import type { MusicTaste } from './musicPreferences';

export type Theme = 'default' | 'dark' | 'green' | 'light';
export type Tab = 'home' | 'search' | 'library';
export type Collection = 'favorites' | 'downloads' | 'playlists' | 'albums' | 'artists';
export type Utility = 'sound' | 'devices' | 'timer';
export type Route =
  | { kind: 'collection'; collection: Collection }
  | { kind: 'playlist'; id: string }
  | { kind: 'catalog'; type: 'album' | 'artist' | 'playlist'; id: string }
  | { kind: 'playlist-form'; id?: string }
  | { kind: 'account'; page: string };

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
}
export interface DownloadJob {
  id: string;
  song: Song;
  status: 'queued' | 'downloading' | 'paused' | 'failed';
  progress: number;
  error?: string;
}
export interface PlaybackController {
  player: PlayerState;
  queue: Song[];
  context: string;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  play: (song: Song, list?: Song[], context?: string) => Promise<void>;
  playAll: (songs: Song[], random?: boolean, context?: string) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setShuffle: (value: boolean) => void;
  setRepeat: (value: 'off' | 'all' | 'one') => void;
  setQueue: (value: Song[] | ((songs: Song[]) => Song[])) => void;
}
export interface AppState {
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
  removeDownload: (id: string) => void;
  refreshDownloads: () => void;
  toggleFavorite: (song: Song) => void;
  isFavorite: (id: string) => boolean;
  addToPlaylist: string | null;
  setAddToPlaylist: (id: string | null) => void;
}

export const THEMES: { id: Theme; name: string; description: string; background: string; surface: string; accent: string }[] = [
  { id: 'default', name: 'Default', description: 'Midnight navy', background: '#061126', surface: '#0D1B30', accent: '#00D9F2' },
  { id: 'dark', name: 'Dark', description: 'Soft charcoal', background: '#101214', surface: '#1B1E22', accent: '#00D9F2' },
  { id: 'green', name: 'Dark Green', description: 'Deep forest', background: '#08231E', surface: '#10372F', accent: '#73DAC2' },
  { id: 'light', name: 'Light', description: 'Smoke white', background: '#F3F4F1', surface: '#E8EBE7', accent: '#006C75' },
];

export const AppContext = createContext<AppState | null>(null);
export function useApp(): AppState {
  const app = useContext(AppContext);
  if (!app) throw new Error('Cine music screen requires the application provider.');
  return app;
}

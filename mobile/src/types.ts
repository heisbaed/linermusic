export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  albumId?: string;
  cover?: string;
  durationMs: number;
  offline?: boolean;
  downloadBytes?: number;
  storageBytes?: number;
  downloadedAt?: number;
}
export interface PlayerState {
  track: Song | null;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  positionMs: number;
  durationMs: number;
  error?: string;
  queue?: Song[];
  shuffle?: boolean;
  repeat?: 'off' | 'all' | 'one';
  output?: string;
  sleepDeadline?: number;
  sleepEndOfSong?: boolean;
  equalizer?: { ready: boolean; available: boolean; bandCount?: number; frequencies?: number[]; minDb?: number; maxDb?: number };
}
export interface DownloadJob {
  id: string;
  track: Song;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  progress: number;
  bytes: number;
  totalBytes: number;
  error?: string;
  restartOnResume: true;
}
export interface Playlist { id: string; name: string; songs: Song[]; description?: string; isPublic?: boolean; cover?: string }
export interface NativeApi {
  countryCode?(): string;
  cancelGoogleSignIn?(): void;
  background(): void;
  ready(): void;
  snapshot(): string;
  queue(songs: string, shuffle: boolean, repeat: 'off' | 'all' | 'one'): void;
  sleepTimer(minutes: number, endOfSong: boolean): void;
  request(id: string, options: string): void;
  cancel(id: string): void;
  play(track: string): void;
  control(action: string, value: number): void;
  downloads(): string;
  downloadJobs(): string;
  download(track: string): void;
  downloadMany?(tracks: string): void;
  resumeDownloads?(ids: string): void;
  pauseAllDownloads?(): void;
  cancelDownload(id: string): void;
  pauseDownload(id: string): void;
  prioritizeDownload?(id: string): void;
  requestMusicWidget?(): boolean;
  resumeDownload(id: string): void;
  configureDownloads(wifiOnly: boolean): void;
  removeDownload(id: string): void;
  setSystemBars(background: string, lightIcons: boolean): void;
  isWifiConnected(): boolean;
  openNotificationSettings(): void;
  authTokens(): string;
  consumeSongLink?(): string;
  consumePlayerOpen?(): boolean;
  saveAuthTokens(json: string): void;
  clearAuthTokens(): void;
  googleSignIn(requestId: string, webClientId: string, nonce: string): void;
  configureEqualizer(enabled: boolean, bandsJson: string): boolean;
  openMediaOutputPanel(): void;
  openExternal(url: string): void;
  share(text: string): void;
  saveTextFile?(requestId: string, fileName: string, mimeType: string, text: string): void;
  getAppShareLink?(): string;
  getSongShareLink?(songId: string): string;
  isAppInstalled?(): boolean;
  checkForUpdates?(): void;
  setCrossfade?(enabled: boolean, durationSeconds: number): void;
  setGapless?(enabled: boolean): void;
  isTv?(): boolean;
  consumeTvLink?(): string;
  hasTvVoice?(): boolean;
  startTvVoice?(): void;
  showTvKeyboard?(): void;
  hideTvKeyboard?(): void;
  keepTvScreenOn?(enabled: boolean): void;
}
declare global {
  interface Window {
    CineAndroid?: NativeApi;
    __cineChunk?: (id: string, chunk: string, last: boolean) => void;
  }
}

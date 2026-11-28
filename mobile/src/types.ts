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
  genres?: string[];
  genreSource?: 'recording' | 'artist';
  likedAt?: number;
  addedAt?: number;
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
  remoteDeviceId?: string;
  remoteDeviceName?: string;
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
  requestDjAttestation?(id: string): void;
  djFirebaseOptions?(): string;
  djVoiceInfo?(): string;
  speakDj?(id: string, text: string, language: string): void;
  stopDjVoice?(): void;
  hasDjVoiceInput?(): boolean;
  listenDj?(language: string): void;
  appIcon?(): string;
  setAppIcon?(name: string): boolean;
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
  musicNotificationState?(): string;
  configureMusicNotification?(name: string, enabled: boolean): void;
  notificationArtists?(json: string): void;
  refreshMusicNotifications?(): void;
  consumeNotificationOpen?(): boolean;
  openScreensaverSettings?(): void;
  isNetworkConnected?(): boolean;
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
  appReady?(): void;
  isAppInstalled?(): boolean;
  checkForUpdates?(): void;
  autoCheckForUpdates?(): void;
  setCrossfade?(enabled: boolean, durationSeconds: number): void;
  setGapless?(enabled: boolean): void;
  isTv?(): boolean;
  appVersion?(): string;
  consumeTvLink?(): string;
  hasTvVoice?(): boolean;
  startTvVoice?(): void;
  showTvKeyboard?(): void;
  hideTvKeyboard?(): void;
  keepTvScreenOn?(enabled: boolean): void;
  connectSnapshot?(): string;
  selectPlaybackDevice?(id: string): void;
}
declare global {
  interface Window {
    CineAndroid?: NativeApi;
    __cineChunk?: (id: string, chunk: string, last: boolean) => void;
  }
}

import type { DownloadJob, PlayerState, Song } from './types';

type Envelope = { type: string; data: Record<string, unknown> };
const listeners = new Set<(event: Envelope) => void>();
const stateEvents = new Map<string, Envelope>();
export const isAndroid = Boolean(window.CineAndroid);
export const PREVIOUS_RESTART_MS = 3000;
let playerState: PlayerState = { track: null, status: 'idle', positionMs: 0, durationMs: 0, queue: [], shuffle: false, repeat: 'off', output: 'Browser audio', sleepDeadline: 0, sleepEndOfSong: false };

function deliver(listener: (event: Envelope) => void, event: Envelope) {
  try { listener(event); } catch (error) { console.error('Could not handle a native event', error); }
}
function publish(event: Envelope) {
  if (event.type === 'player') playerState = { ...playerState, ...event.data } as PlayerState;
  if (['player', 'downloads', 'downloadJobs', 'authLink'].includes(event.type)) {
    if (event.type === 'player') event = { type: 'player', data: { ...playerState } };
    stateEvents.set(event.type, event);
  }
  for (const listener of listeners) deliver(listener, event);
}
export function snapshot(): PlayerState {
  if (window.CineAndroid) {
    try { playerState = { ...playerState, ...JSON.parse(window.CineAndroid.snapshot()) } as PlayerState; }
    catch (error) { console.error('Could not read the player snapshot', error); }
  }
  return { ...playerState, queue: [...(playerState.queue ?? [])] };
}
export function saveTextFile(fileName: string, mimeType: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const bridge = window.CineAndroid;
    if (!bridge?.saveTextFile) { reject(new Error('Saving files is supported in the Android app.')); return; }
    const id = crypto.randomUUID();
    let finished = false;
    const cleanup = () => { finished = true; clearTimeout(timer); unsubscribe(); };
    const timer = window.setTimeout(() => {
      if (finished) return;
      cleanup();
      reject(new Error('The file picker timed out. Try saving again.'));
    }, 300_000);
    const unsubscribe = subscribe(event => {
      if (event.type !== 'fileSave' || event.data.id !== id) return;
      cleanup();
      if (event.data.cancelled) { reject(new DOMException('File save cancelled', 'AbortError')); return; }
      if (event.data.error) { reject(new Error(String(event.data.error))); return; }
      resolve();
    });
    try { bridge.saveTextFile(id, fileName, mimeType, text); }
    catch (error) { cleanup(); reject(error instanceof Error ? error : new Error('The file picker could not be opened.')); }
  });
}
export function subscribe(listener: (event: Envelope) => void) {
  listeners.add(listener);
  stateEvents.set('player', { type: 'player', data: { ...snapshot() } });
  for (const event of stateEvents.values()) deliver(listener, event);
  return () => { listeners.delete(listener); };
}

const chunks = new Map<string, string[]>();
window.__cineChunk = (id, chunk, last) => {
  const buffer = chunks.get(id) ?? [];
  buffer.push(chunk);
  if (!last) { chunks.set(id, buffer); return; }
  chunks.delete(id);
  try { publish(JSON.parse(buffer.join('')) as Envelope); }
  catch (error) { console.error('Could not read a native event', error); }
};

const browserFetch = window.fetch.bind(window);
if (window.CineAndroid) {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (new URL(request.url).origin === location.origin) return browserFetch(input, init);
    const id = crypto.randomUUID();
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
    if (request.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
    return new Promise<Response>((resolve, reject) => {
      let finished = false;
      const cleanup = () => { finished = true; clearTimeout(timer); unsubscribe(); request.signal.removeEventListener('abort', abort); };
      const abort = () => { if (finished) return; window.CineAndroid!.cancel(id); cleanup(); reject(new DOMException('Request cancelled', 'AbortError')); };
      const timer = window.setTimeout(() => { if (finished) return; window.CineAndroid!.cancel(id); cleanup(); reject(new Error('The connection timed out. Please try again.')); }, 60_000);
      const unsubscribe = subscribe(event => {
        if (event.type !== 'http' || event.data.id !== id) return;
        cleanup();
        if (event.data.error) { reject(new Error(String(event.data.error))); return; }
        const bytes = Uint8Array.from(atob(String(event.data.body)), char => char.charCodeAt(0));
        const status = Number(event.data.status);
        resolve(new Response([204, 205, 304].includes(status) ? null : bytes, { status, headers: event.data.headers as Record<string, string> }));
      });
      request.signal.addEventListener('abort', abort, { once: true });
      window.CineAndroid!.request(id, JSON.stringify({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers), ...(body !== undefined ? { body } : {}) }));
    });
  };
}

let previewAudio: HTMLAudioElement | undefined;
let previewSong: Song | null = null;
let previewGeneration = 0;
let previewTimer: number | undefined;
function previewEvent(status: PlayerState['status']) {
  const data: PlayerState = { ...playerState, track: previewSong, status, positionMs: (previewAudio?.currentTime ?? 0) * 1000, durationMs: Number.isFinite(previewAudio?.duration) ? previewAudio!.duration * 1000 : previewSong?.durationMs ?? 0 };
  publish({ type: 'player', data: { ...data } });
}
function previewError(error: unknown, generation = previewGeneration) {
  if (generation !== previewGeneration) return;
  const message = error instanceof Error ? error.message : 'Audio could not be played in this browser.';
  playerState = { ...playerState, error: message };
  previewEvent('error');
  publish({ type: 'playerError', data: { message } });
}
function resumePreview() {
  const generation = previewGeneration;
  try { void previewAudio?.play().catch(error => previewError(error, generation)); }
  catch (error) { previewError(error, generation); }
}
export function playNative(song: Song, url?: string, queue: Song[] = [], shuffle = false, repeat: 'off' | 'all' | 'one' = 'off', quality: 'auto' | 'low' | 'normal' | 'high' = 'auto', gapless = true, crossfadeSeconds = 0) {
  if (window.CineAndroid) { window.CineAndroid.play(JSON.stringify({ ...song, url, queue, shuffle, repeat, quality, gapless, crossfadeSeconds })); return; }
  if (!url) throw new Error('Offline playback is available in the Android app.');
  if (!previewAudio) {
    previewAudio = new Audio();
    for (const [event, status] of [['playing', 'playing'], ['pause', 'paused'], ['waiting', 'loading']] as const) previewAudio.addEventListener(event, () => previewEvent(status));
    previewAudio.addEventListener('ended', () => {
      if (playerState.sleepEndOfSong) { sleepTimer(0, false); previewEvent('paused'); return; }
      previewEvent('ended');
      publish({ type: 'transport', data: { action: 'ended' } });
    });
    previewAudio.addEventListener('error', () => previewError(new Error(previewAudio?.error?.message || 'The audio source could not be played.')));
    previewAudio.addEventListener('timeupdate', () => { if (!previewAudio!.ended) previewEvent(previewAudio!.paused ? 'paused' : 'playing'); });
    previewAudio.addEventListener('seeked', () => previewEvent(previewAudio!.paused ? 'paused' : 'playing'));
  }
  if (previewSong?.id !== song.id && playerState.sleepEndOfSong) sleepTimer(0, false);
  previewGeneration++;
  playerState = { ...playerState, queue: [...queue], shuffle, repeat, error: undefined };
  previewSong = song;
  previewAudio.src = url;
  previewEvent('loading');
  resumePreview();
}

export function getAppShareLink(): string {
  return window.CineAndroid?.getAppShareLink?.() ?? 'https://cinemusic.web.app/download';
}

export function getSongShareLink(songId: string): string {
  if (!songId || !/^[a-zA-Z0-9_-]{11}$/.test(songId)) return '';
  return window.CineAndroid?.getSongShareLink?.(songId) ?? `https://cinemusic.web.app/song/${songId}`;
}

export function setCrossfade(enabled: boolean, durationSeconds: number = 5) {
  if (window.CineAndroid) {
    window.CineAndroid.control('setcrossfade', enabled ? durationSeconds : 0);
  }
}
export function setGapless(enabled: boolean) {
  if (window.CineAndroid) window.CineAndroid.control('setgapless', enabled ? 1 : 0);
}
export function control(action: string, value = 0) {
  if (window.CineAndroid) { window.CineAndroid.control(action, value); return; }
  if (action === 'next' || action === 'previous') {
    if (action === 'previous' && (previewAudio?.currentTime ?? playerState.positionMs / 1000) * 1000 > PREVIOUS_RESTART_MS) control('seek', 0);
    else publish({ type: 'transport', data: { action } });
    return;
  }
  try {
    if (action === 'pause') { previewAudio?.pause(); if (previewSong) previewEvent('paused'); }
    if (action === 'resume') resumePreview();
    if (action === 'seek' && previewAudio && Number.isFinite(value)) {
      previewAudio.currentTime = Math.max(0, Math.min(value / 1000, Number.isFinite(previewAudio.duration) ? previewAudio.duration : Number.MAX_SAFE_INTEGER));
      previewEvent(previewAudio.paused ? 'paused' : 'playing');
    }
    if (action === 'stop') { previewGeneration++; previewAudio?.pause(); sleepTimer(0, false); previewEvent('idle'); }
  } catch (error) { previewError(error); }
}
export function setQueue(songs: Song[], shuffle: boolean, repeat: 'off' | 'all' | 'one') {
  if (window.CineAndroid) { window.CineAndroid.queue(JSON.stringify(songs), shuffle, repeat); return; }
  playerState = { ...playerState, queue: [...songs], shuffle, repeat };
  publish({ type: 'player', data: { ...playerState } });
}
export function sleepTimer(minutes: number, endOfSong = false) {
  if (window.CineAndroid) { window.CineAndroid.sleepTimer(minutes, endOfSong); return; }
  window.clearTimeout(previewTimer);
  previewTimer = undefined;
  const active = Number.isFinite(minutes) && minutes > 0 && Boolean(previewSong);
  const delay = Math.min(minutes, 24 * 60) * 60_000;
  playerState = { ...playerState, sleepDeadline: active && !endOfSong ? Date.now() + delay : 0, sleepEndOfSong: active && endOfSong };
  if (active && !endOfSong) previewTimer = window.setTimeout(() => { sleepTimer(0, false); control('pause'); }, delay);
  publish({ type: 'player', data: { ...playerState } });
}
export function readDownloads(): Song[] {
  try { return window.CineAndroid ? JSON.parse(window.CineAndroid.downloads()) as Song[] : []; }
  catch { return []; }
}
export function readDownloadJobs(): DownloadJob[] {
  try { return window.CineAndroid ? JSON.parse(window.CineAndroid.downloadJobs()) as DownloadJob[] : []; }
  catch { return []; }
}
export function configureDownloads(wifiOnly: boolean) { window.CineAndroid?.configureDownloads(wifiOnly); }
export function cancelDownload(id: string) { window.CineAndroid?.cancelDownload(id); }
export function pauseDownload(id: string) { window.CineAndroid?.pauseDownload(id); }
export function resumeDownload(id: string) { window.CineAndroid?.resumeDownload(id); }

export async function googleSignIn(webClientId: string): Promise<string> {
  if (!webClientId || webClientId.length > 512 || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId)) {
    throw new Error('Google sign-in needs a configured Web OAuth client ID (googleWebClientId).');
  }
  const native = window.CineAndroid;
  if (!native || typeof native.googleSignIn !== 'function') throw new Error('Google sign-in requires the updated Android app and an available Google credential provider.');
  const id = crypto.randomUUID();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => { unsubscribe(); reject(new Error('Google sign-in timed out. Please try again.')); }, 120_000);
    const unsubscribe = subscribe(event => {
      if (event.type !== 'googleAuth' || event.data.id !== id) return;
      window.clearTimeout(timeout); unsubscribe();
      if (event.data.cancelled) { reject(new DOMException('Google sign-in was cancelled.', 'AbortError')); return; }
      if (event.data.error) { reject(new Error(String(event.data.error))); return; }
      if (typeof event.data.idToken !== 'string' || !event.data.idToken) { reject(new Error('Google did not return an ID token.')); return; }
      resolve(event.data.idToken);
    });
    try { native.googleSignIn(id, webClientId, nonce); }
    catch { window.clearTimeout(timeout); unsubscribe(); reject(new Error('Google sign-in could not start. Update the Android app and try again.')); }
  });
}

// The receiver is installed before asking native to replay service-owned state.
window.CineAndroid?.ready();

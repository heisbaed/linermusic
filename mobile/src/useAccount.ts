import { useEffect, useRef, useState, type SetStateAction } from 'react';
import type { AccountState, LibraryData, Profile } from './AppContext';
import type { Playlist, Song } from './types';
import { FirebaseError, firebaseFetch, freshCineUser, getFirebaseDatabaseUrl, loadCineUser, storeCineUser, updateCineDisplayName, type CineUser } from './FirebaseAuth';
import { loadSaved, save } from './library';
import { normalizeTaste } from './musicPreferences';
import { figmaArtwork } from './figmaAssets';

type Wire = Record<string, unknown>;
type Patch = Record<string, unknown>;
const fields = ['favorites', 'playlists', 'recent', 'artists', 'albums', 'history', 'profile', 'taste'] as const;
const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);

export function emptyLibrary(): LibraryData {
  return { favorites: [], playlists: [], recent: [], artists: [], albums: [], history: [], profile: { name: '', username: '' }, taste: normalizeTaste(null) };
}
function values(value: unknown): unknown[] { return Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
const bundledArtwork = new Set<string>(Object.values(figmaArtwork));
function image(value: unknown): string | undefined { return typeof value === 'string' && value.length < 180_000 && (bundledArtwork.has(value) || /^https:\/\//.test(value) || /^data:image\/(jpeg|png|webp);base64,/.test(value)) ? value : undefined; }
function text(value: unknown, max = 500): string { return typeof value === 'string' ? value.slice(0, max) : ''; }
function song(value: unknown): value is Song { return record(value) && typeof value.id === 'string' && value.id.length < 256 && typeof value.title === 'string' && typeof value.artist === 'string' && Number.isFinite(value.durationMs) && Number(value.durationMs) >= 0; }
function cleanSong(value: Song): Song { return { id: value.id, title: value.title.slice(0, 500), artist: value.artist.slice(0, 500), durationMs: value.durationMs, cover: image(value.cover), artistId: typeof value.artistId === 'string' ? value.artistId : undefined, albumId: typeof value.albumId === 'string' ? value.albumId : undefined }; }
function unique<T extends { id: string }>(items: T[]): T[] { return [...new Map(items.map(item => [item.id, item])).values()]; }

export function validateLibrary(value: unknown): LibraryData {
  const source = record(value) ? value : {};
  const profile = record(source.profile) ? source.profile : {};
  return {
    favorites: unique(values(source.favorites).filter(song).map(cleanSong)).slice(0, 10_000),
    recent: unique(values(source.recent).filter(song).map(cleanSong)).slice(0, 40),
    playlists: unique(values(source.playlists).flatMap(item => {
      if (!record(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return [];
      return [{ id: item.id, name: item.name.slice(0, 100), songs: unique(values(item.songs).filter(song).map(cleanSong)), description: text(item.description, 1000), isPublic: false, cover: image(item.cover) } as Playlist];
    })),
    artists: unique(values(source.artists).flatMap(item => record(item) && typeof item.id === 'string' && typeof item.name === 'string' ? [{ id: item.id, name: item.name, cover: image(item.cover) }] : [])),
    albums: unique(values(source.albums).flatMap(item => record(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.artist === 'string' ? [{ id: item.id, title: item.title, artist: item.artist, cover: image(item.cover) }] : [])),
    history: values(source.history).flatMap(item => {
      if (typeof item === 'string') return [{ query: item }];
      if (!record(item) || typeof item.query !== 'string') return [];
      return [{ query: item.query.slice(0, 200), title: text(item.title), subtitle: text(item.subtitle), cover: image(item.cover), id: text(item.id), type: ['artist', 'album', 'playlist'].includes(String(item.type)) ? item.type as 'artist' | 'album' | 'playlist' : undefined }];
    }).slice(0, 8),
    profile: { name: text(profile.name, 60), username: text(profile.username, 32), photo: image(profile.photo) },
    taste: normalizeTaste(source.taste),
  };
}

const keyFor = (user: CineUser | null) => user ? 'user:' + user.localId : 'guest';
export function readLibrary(owner: string): LibraryData {
  const stored = loadSaved<unknown>('library-v3:' + owner, null);
  if (stored) return validateLibrary(stored);
  if (owner !== 'guest') return emptyLibrary();
  return validateLibrary({ favorites: loadSaved('favorites', []), playlists: loadSaved('playlists', []), recent: loadSaved('recent', []), history: loadSaved('recent-searches', []), profile: { name: loadSaved('profile-name', ''), username: loadSaved('profile-username', '') } });
}

function encodedId(id: string): string { return encodeURIComponent(id).replace(/\./g, '%2E'); }
function keyed(items: { id: string }[]): Wire { return Object.fromEntries(items.map(item => [encodedId(item.id), item])); }
function toWire(library: LibraryData): Wire { return { ...library, favorites: keyed(library.favorites), playlists: keyed(library.playlists), artists: keyed(library.artists), albums: keyed(library.albums) }; }
const json = (value: unknown) => JSON.stringify(value ?? null);

export function acknowledgePatch(pending: Patch, sent: Patch): Patch {
  return Object.fromEntries(Object.entries(pending).filter(([path, value]) => !Object.hasOwn(sent, path) || json(sent[path]) !== json(value)));
}

export function sameSession(a: CineUser, b: CineUser | null): boolean {
  return b !== null && a.localId === b.localId && a.refreshToken === b.refreshToken && a.idToken === b.idToken;
}

export function acknowledgedServer(source: Wire, sent: Patch, remoteChanged: boolean): Wire {
  return remoteChanged ? source : applyCloudPatch(source, sent);
}

export function libraryPatch(before: LibraryData, after: LibraryData): Patch {
  const a = toWire(before), b = toWire(after), patch: Patch = {};
  for (const field of fields) {
    if (['favorites', 'playlists', 'artists', 'albums', 'profile', 'taste'].includes(field)) {
      const old = a[field] as Wire || {}, next = b[field] as Wire || {};
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) if (!dangerousKeys.has(key) && json(old[key]) !== json(next[key])) patch[`${field}/${key}`] = next[key] ?? null;
    } else if (json(a[field]) !== json(b[field])) patch[field] = b[field];
  }
  return JSON.parse(JSON.stringify(patch)) as Patch;
}

export function applyCloudPatch(source: Wire, patch: Patch): Wire {
  const output = JSON.parse(JSON.stringify(source || {})) as Wire;
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.replace(/^\//, '').split('/').filter(Boolean);
    if (!keys.length || keys.some(key => dangerousKeys.has(key))) continue;
    let parent = output;
    for (const key of keys.slice(0, -1)) { if (parent[key] === null || typeof parent[key] !== 'object') parent[key] = {}; parent = parent[key] as Wire; }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete parent[last]; else parent[last] = value;
  }
  return output;
}

export function useAccount(): AccountState {
  function initialSession(user: CineUser | null) {
    const owner = keyFor(user), library = readLibrary(owner);
    const cached = loadSaved<unknown>('library-v3:' + owner, null);
    return { user, owner, library, ready: !user || library.taste.completed || (!navigator.onLine && record(cached)) };
  }
  const [session, setSession] = useState(() => initialSession(loadCineUser()));
  const [syncStatus, setSyncStatus] = useState(session.user ? 'Opening your saved library...' : 'Saved on this device');
  const [retry, setRetry] = useState(0);
  const current = useRef(session); current.current = session;
  const pending = useRef<Patch>(loadSaved('library-pending-v3:' + session.owner, {}));
  const server = useRef<Wire>({});
  const flush = useRef<() => void>(() => {});
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>();
  const suspended = useRef(false);
  const settleSync = useRef<() => Promise<void>>(async () => {});

  function setLibrary(update: SetStateAction<LibraryData>) {
    if (suspended.current) return;
    const old = current.current;
    const library = validateLibrary(typeof update === 'function' ? update(old.library) : update);
    if (old.user) {
      pending.current = { ...pending.current, ...libraryPatch(old.library, library) };
      save('library-pending-v3:' + old.owner, pending.current);
    }
    save('library-v3:' + old.owner, library);
    current.current = { ...old, library }; setSession(current.current);
    if (old.user) { setSyncStatus('Changes saved on this device'); clearTimeout(debounce.current); debounce.current = setTimeout(() => flush.current(), 900); }
  }

  useEffect(() => {
    function changed() {
      const user = loadCineUser(), owner = keyFor(user), previous = current.current;
      if (owner !== previous.owner) {
        clearTimeout(debounce.current);
        suspended.current = false;
        pending.current = loadSaved('library-pending-v3:' + owner, {}); server.current = {};
        current.current = initialSession(user); setSession(current.current);
        setSyncStatus(user ? 'Opening your account library...' : 'Saved on this device');
      } else { current.current = { ...previous, user }; setSession(current.current); }
    }
    window.addEventListener('cine:session-changed', changed);
    return () => { window.removeEventListener('cine:session-changed', changed); clearTimeout(debounce.current); };
  }, []);

  useEffect(() => {
    const user = session.user;
    if (!user?.emailVerified) return;
    const owner = session.owner, controller = new AbortController();
    let source: EventSource | null = null, writing = false, reading = false, initialized = false, mounted = true, connection = 0, remoteRevision = 0, writeFailed = false;
    const drains = new Set<() => void>();
    function idle() { if (!writing && !reading) { drains.forEach(resolve => resolve()); drains.clear(); } }
    settleSync.current = async () => {
      source?.close(); source = null; clearTimeout(expiry);
      const hadWrite = writing;
      if (writing || reading) await new Promise<void>(resolve => drains.add(resolve));
      if (!valid()) throw new Error('The active account changed. Nothing was deleted.');
      if (hadWrite && writeFailed) throw new Error('Cloud sync could not finish safely. Nothing was deleted. Retry when connected.');
    };
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const valid = () => mounted && current.current.owner === owner;
    function status(message: string) { if (valid()) setSyncStatus(message); }
    function failure(error: unknown, failedSession?: CineUser) {
      if (!valid() || controller.signal.aborted) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof FirebaseError && error.invalidSession && failedSession) {
        if (sameSession(failedSession, loadCineUser())) { try { storeCineUser(null); } catch { status(error.message); } }
        return;
      }
      status(error instanceof Error ? error.message : 'Cloud sync is unavailable. Your changes are saved on this device.');
    }
    function receive(wire: Wire) {
      if (!valid() || suspended.current) return;
      server.current = record(wire) ? wire : {};
      const library = validateLibrary(applyCloudPatch(server.current, pending.current));
      current.current = { ...current.current, library, ready: true }; setSession(current.current);
      save('library-v3:' + owner, library);
    }
    async function databaseUrl() {
      const candidate = current.current.user || user!;
      let fresh: CineUser;
      try { fresh = await freshCineUser(candidate); }
      catch (error) {
        failure(error, candidate);
        if (error instanceof FirebaseError && error.invalidSession && !sameSession(candidate, loadCineUser())) throw new DOMException('A newer session replaced this request', 'AbortError');
        throw error;
      }
      if (!valid() || suspended.current) throw new DOMException('Account changed or sync suspended', 'AbortError');
      return `${await getFirebaseDatabaseUrl()}/users/${encodeURIComponent(fresh.localId)}/library.json?auth=${encodeURIComponent(fresh.idToken)}`;
    }
    async function write() {
      if (suspended.current || writing || reading || !initialized || !valid() || !navigator.onLine || !Object.keys(pending.current).length) return;
      writing = true; writeFailed = false;
      const patch = { ...pending.current };
      const revision = remoteRevision;
      let succeeded = false, dispatched = false;
      try {
        const url = await databaseUrl();
        if (suspended.current) return;
        dispatched = true;
        const response = await firebaseFetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch), signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Firebase denied library sync. Check account verification and owner-only database rules. Your changes remain on this device.' : 'Cloud sync failed. Your library is saved on this device; retry when connected.');
        if (!valid()) return;
        pending.current = acknowledgePatch(pending.current, patch);
        receive(acknowledgedServer(server.current, patch, revision !== remoteRevision));
        save('library-pending-v3:' + owner, pending.current);
        succeeded = true;
        status(Object.keys(pending.current).length ? 'Saving remaining changes...' : source ? 'Synced with your account' : 'Saved to your account');
      } catch (error) { writeFailed = dispatched; failure(error); }
      finally { writing = false; idle(); }
      if (succeeded && !suspended.current && valid() && Object.keys(pending.current).length) void write();
    }
    flush.current = () => { void write(); };
    async function connect() {
      if (suspended.current || writing || reading) return;
      const generation = ++connection;
      source?.close(); source = null;
      if (!navigator.onLine) { status('Offline. Changes are saved on this device.'); return; }
      reading = true;
      try {
        const url = await databaseUrl();
        const response = await firebaseFetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Cloud library access was denied. Enable Realtime Database and deploy owner-only rules.' : 'The cloud library could not be opened. Your local library is kept.');
        const data: unknown = await response.json();
        if (!valid() || suspended.current || generation !== connection) return;
        receive(record(data) ? data : {});
        reading = false; initialized = true;
        status('Library synced'); await write();
        // EventSource streams only library deltas, not polling or media downloads.
        if (typeof EventSource !== 'undefined' && valid() && !suspended.current) {
          source = new EventSource(url);
          const event = (message: MessageEvent<string>) => {
            if (!valid() || suspended.current) return;
            try {
              const data = JSON.parse(message.data) as { path: string; data: unknown };
              remoteRevision++;
              const path = data.path.replace(/^\//, '');
              if (!path && message.type === 'put') receive(record(data.data) ? data.data : {});
              else if (message.type === 'patch' && record(data.data)) receive(applyCloudPatch(server.current, Object.fromEntries(Object.entries(data.data).map(([key, value]) => [[path, key].filter(Boolean).join('/'), value]))));
              else receive(applyCloudPatch(server.current, { [path]: data.data }));
              status(Object.keys(pending.current).length ? 'Local changes waiting to sync' : 'Live library sync');
            } catch { source?.close(); source = null; status('Live updates paused. Reopen this screen or retry sync.'); }
          };
          source.addEventListener('put', event as EventListener); source.addEventListener('patch', event as EventListener);
          source.addEventListener('cancel', () => { source?.close(); source = null; status('Live library access was denied. Check Firebase database rules.'); });
          source.addEventListener('auth_revoked', () => { source?.close(); source = null; status('Cloud authorization expired. Retry sync to refresh your session.'); });
          source.onopen = () => status('Live library sync');
          source.onerror = () => { source?.close(); source = null; status('Live updates paused. Changes stay saved on this device; retry sync.'); };
        }
        const latest = current.current.user;
        if (latest?.expiresAt && !suspended.current) expiry = setTimeout(() => { void freshCineUser(latest).then(() => { if (valid() && !suspended.current) setRetry(value => value + 1); }).catch(error => failure(error, latest)); }, Math.max(30_000, latest.expiresAt - Date.now() - 100_000));
      } catch (error) { failure(error); }
      finally { reading = false; idle(); }
    }
    function resume() { if (document.visibilityState === 'visible') void connect(); }
    function offline() { source?.close(); source = null; status('Offline. Changes are saved on this device.'); }
    void connect();
    window.addEventListener('online', resume); window.addEventListener('offline', offline); window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    return () => { mounted = false; controller.abort(); source?.close(); clearTimeout(expiry); drains.forEach(resolve => resolve()); drains.clear(); window.removeEventListener('online', resume); window.removeEventListener('offline', offline); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, [session.owner, session.user?.emailVerified, retry]);

  async function updateProfile(profile: Profile) {
    const user = current.current.user;
    const owner = current.current.owner;
    if (!profile.name.trim() || profile.name.length > 60) throw new Error('Enter a name between 1 and 60 characters.');
    if (profile.username && !/^[a-zA-Z0-9_]{3,32}$/.test(profile.username)) throw new Error('Use 3-32 letters, numbers, or underscores for your username.');
    if (user) await updateCineDisplayName(user, profile.name);
    if (current.current.owner !== owner) throw new Error('The active account changed. Return to your profile before saving.');
    setLibrary(old => ({ ...old, profile: { ...profile, name: profile.name.trim(), username: profile.username.trim() } }));
  }
  async function suspendSync() {
    const owner = current.current.owner;
    suspended.current = true; clearTimeout(debounce.current);
    const resume = () => { if (current.current.owner === owner) { suspended.current = false; setRetry(value => value + 1); } };
    try { await settleSync.current(); return resume; }
    catch (error) { resume(); throw error; }
  }
  return { user: session.user, ready: session.ready, library: session.library, setLibrary, signIn: user => storeCineUser(user), signOut: () => storeCineUser(null), syncStatus, retrySync: () => setRetry(value => value + 1), updateProfile, suspendSync };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./native', () => ({ googleSignIn: vi.fn(), subscribe: () => () => {} }));
import { acknowledgePatch, acknowledgedServer, applyCloudPatch, emptyLibrary, libraryPatch, readLibrary, sameSession, validateLibrary } from './useAccount';

let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
const track = { id: 'test-track', title: 'Test track', artist: 'Test artist', durationMs: 120_000 };

describe('account-scoped library', () => {
  it('migrates device data only into the guest library', () => {
    stored.set('cine:favorites', JSON.stringify([track]));
    stored.set('cine:playlists', JSON.stringify([{ id: 'test-list', name: 'Test list', songs: [track] }]));
    expect(readLibrary('guest').favorites).toHaveLength(1);
    expect(readLibrary('user:account-a')).toEqual(emptyLibrary());
    expect(readLibrary('user:account-b')).toEqual(emptyLibrary());
  });
  it('keeps different signed-in account libraries separate', () => {
    stored.set('cine:library-v3:user:account-a', JSON.stringify({ ...emptyLibrary(), favorites: [track] }));
    expect(readLibrary('user:account-a').favorites).toHaveLength(1);
    expect(readLibrary('user:account-b').favorites).toHaveLength(0);
  });
  it('patches one changed record instead of overwriting every collection', () => {
    const before = { ...emptyLibrary(), favorites: [track], playlists: [{ id: 'p', name: 'Kept', songs: [] }] };
    const patch = libraryPatch(before, { ...before, favorites: [] });
    expect(patch).toEqual({ 'favorites/test-track': null });
  });
  it('merges pending local edits over a remote update and retains deletions', () => {
    const wire = { favorites: { 'test-track': track, other: { ...track, id: 'other' } } };
    const merged = applyCloudPatch(wire, { 'favorites/test-track': null, 'profile/name': 'Updated' });
    expect(validateLibrary(merged).favorites.map(song => song.id)).toEqual(['other']);
    expect(validateLibrary(merged).profile.name).toBe('Updated');
  });
  it('does not persist playback URLs, tokens, or false offline readiness into cloud songs', () => {
    const library = validateLibrary({ favorites: [{ ...track, url: 'https://media.example.test/secret', idToken: 'not-allowed', offline: true, downloadBytes: 1000 }] });
    expect(library.favorites[0]).not.toHaveProperty('url');
    expect(library.favorites[0]).not.toHaveProperty('idToken');
    expect(library.favorites[0]).not.toHaveProperty('offline');
  });
  it('rejects malformed records and does not pretend playlists are public', () => {
    const library = validateLibrary({ favorites: [null, { id: 'broken' }, track], playlists: [{ id: 'p', name: 'List', isPublic: true, songs: [track, track] }], profile: { name: 123 } });
    expect(library.favorites).toHaveLength(1);
    expect(library.playlists[0].songs).toHaveLength(1);
    expect(library.playlists[0].isPublic).toBe(false);
    expect(library.profile.name).toBe('');
  });
  it('ignores prototype-polluting cloud paths', () => {
    const result = applyCloudPatch({}, JSON.parse('{"__proto__/polluted":true,"profile/name":"Kept"}'));
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(result).toEqual({ profile: { name: 'Kept' } });
  });
  it('retains a new addition queued while a null deletion is being acknowledged', () => {
    const remaining = acknowledgePatch({ 'favorites/old': null, 'favorites/new': track }, { 'favorites/old': null });
    expect(remaining).toEqual({ 'favorites/new': track });
    expect(Object.keys(remaining)).toHaveLength(1);
  });
  it('does not clear an edit made to the same record during an in-flight write', () => {
    expect(acknowledgePatch({ 'profile/name': 'Newer edit' }, { 'profile/name': 'Older edit' })).toEqual({ 'profile/name': 'Newer edit' });
  });
  it('preserves sibling array entries when a nested realtime event updates one index', () => {
    const other = { ...track, id: 'other' }, updated = { ...track, title: 'Updated' };
    const value = applyCloudPatch({ recent: [track, other], playlists: { p: { id: 'p', name: 'List', songs: [track, other] } } }, { 'recent/0': updated, 'playlists/p/songs/0/title': 'Updated' });
    const library = validateLibrary(value);
    expect(library.recent).toEqual([updated, other]);
    expect(library.playlists[0].songs.map(song => song.title)).toEqual(['Updated', 'Test track']);
  });
  it('does not replay an acknowledged write over a newer realtime server event', () => {
    const latest = { profile: { name: 'Newer remote edit' } };
    expect(acknowledgedServer(latest, { 'profile/name': 'Older local edit' }, true)).toBe(latest);
    expect(acknowledgedServer({}, { 'profile/name': 'Confirmed local edit' }, false)).toEqual({ profile: { name: 'Confirmed local edit' } });
  });
  it('does not invalidate a newer session for the same account', () => {
    const first = { localId: 'a', email: 'a@example.test', idToken: 'old-id', refreshToken: 'old-refresh' };
    expect(sameSession(first, { ...first })).toBe(true);
    expect(sameSession(first, { ...first, idToken: 'new-id', refreshToken: 'new-refresh' })).toBe(false);
    expect(sameSession(first, null)).toBe(false);
  });
  it('migrates old accounts without discarding their music or inventing completed onboarding', () => {
    const library = validateLibrary({ favorites: [track], artists: [{ id: 'artist', name: 'Kept artist' }], profile: { name: 'Kept' } });
    expect(library.favorites).toEqual([track]);
    expect(library.artists[0].name).toBe('Kept artist');
    expect(library.profile.name).toBe('Kept');
    expect(library.taste).toEqual({ country: '', genres: [], completed: false });
  });
  it('patches account music preferences without overwriting unrelated cloud fields', () => {
    const before = emptyLibrary();
    const after = { ...before, taste: { country: 'KE', genres: ['jazz'], completed: true } };
    expect(libraryPatch(before, after)).toEqual({ 'taste/country': 'KE', 'taste/genres': ['jazz'], 'taste/completed': true });
    const wire = applyCloudPatch({ favorites: { track }, profile: { name: 'Remote' } }, libraryPatch(before, after));
    expect(validateLibrary(wire).taste).toEqual(after.taste);
    expect(validateLibrary(wire).favorites).toHaveLength(1);
    expect(validateLibrary(wire).profile.name).toBe('Remote');
  });
  it('keeps completed tastes and countries isolated between account caches', () => {
    stored.set('cine:library-v3:user:account-a', JSON.stringify({ ...emptyLibrary(), taste: { country: 'NG', genres: ['afrobeats'], completed: true } }));
    expect(readLibrary('user:account-a').taste.country).toBe('NG');
    expect(readLibrary('user:account-b').taste.completed).toBe(false);
    expect(readLibrary('guest').taste.country).toBe('');
  });
});

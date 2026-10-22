import { afterEach, describe, expect, it, vi } from 'vitest';
import { COUNTRY_CODES, applyMusicPreferences, countryName, normalizeCountry, normalizeTaste, recommendationIdentity, recommendationQueries, suggestCountry } from './musicPreferences';
import type { LibraryData } from './AppContext';

afterEach(() => vi.unstubAllGlobals());
describe('account music preferences', () => {
  it('contains the complete unique ISO country list, including small territories', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    for (const code of ['TZ', 'KE', 'US', 'AX', 'BQ', 'VA', 'PS', 'UM']) expect(COUNTRY_CODES).toContain(code);
  });
  it('normalizes countries and rejects fabricated region codes', () => {
    expect(normalizeCountry(' ke ')).toBe('KE');
    for (const code of ['USA', 'XX', 'uk', {}, null]) expect(normalizeCountry(code)).toBe('');
  });
  it('validates genres, deduplicates Firebase array objects and requires a country to complete', () => {
    expect(normalizeTaste({ country: 'ng', genres: { 0: 'JAZZ', 1: 'afrobeats', 2: 'jazz', 3: 'fake', 4: 12 }, completed: true, idToken: 'discard' }))
      .toEqual({ country: 'NG', genres: ['jazz', 'afrobeats'], completed: true });
    expect(normalizeTaste({ completed: true, genres: null })).toEqual({ country: '', genres: [], completed: false });
  });
  it('bounds selections and does not treat a string as completion', () => {
    expect(normalizeTaste({ country: 'FR', completed: 'true', genres: ['pop', 'rock', 'soul', 'rnb', 'house', 'jazz', 'latin', 'metal', 'country'] }).genres).toHaveLength(8);
    expect(normalizeTaste({ country: 'FR', completed: 'true' }).completed).toBe(false);
  });
  it('uses optional Android region before language without requesting location', () => {
    const countryCode = vi.fn(() => 'tz');
    vi.stubGlobal('window', { CineAndroid: { countryCode } });
    vi.stubGlobal('navigator', { languages: ['en-GB'], language: 'en-GB' });
    expect(suggestCountry()).toEqual({ country: 'TZ', source: 'device' });
    expect(countryCode).toHaveBeenCalledOnce();
  });
  it('uses an explicit web language region when the native bridge has none', () => {
    vi.stubGlobal('window', { CineAndroid: { countryCode: () => '' } });
    vi.stubGlobal('navigator', { languages: ['sw', 'sw-KE'], language: 'sw-KE' });
    expect(suggestCountry()).toEqual({ country: 'KE', source: 'language' });
  });
  it('does not fabricate US or another country from a regionless language', () => {
    vi.stubGlobal('window', {}); vi.stubGlobal('navigator', { languages: ['en'], language: 'en' });
    expect(suggestCountry()).toEqual({ country: '', source: 'none' });
  });
  it('builds bounded regional queries from real genre and followed artist metadata', () => {
    const taste = { country: 'KE', genres: ['afrobeats', 'jazz'], completed: true };
    const queries = recommendationQueries(taste, [{ id: 'actual-id', name: 'Actual artist' }]);
    expect(queries).toEqual(['Kenya Afrobeats Jazz music playlists', 'Kenya Actual artist albums']);
    expect(recommendationQueries({ ...taste, country: 'TZ' }, [])[0]).toContain('Tanzania');
  });
  it('keeps recommendation caches distinct by owner, region, genres and follows', () => {
    const taste = { country: 'NG', genres: ['pop'], completed: true };
    const original = recommendationIdentity('a', taste, []);
    expect(recommendationIdentity('b', taste, [])).not.toBe(original);
    expect(recommendationIdentity('a', { ...taste, country: 'JP' }, [])).not.toBe(original);
    expect(recommendationIdentity('a', { ...taste, genres: ['jazz'] }, [])).not.toBe(original);
    expect(recommendationIdentity('a', taste, [{ id: 'artist', name: 'Artist' }])).not.toBe(original);
  });
  it('uses a safe ISO label if display names are unsupported', () => {
    vi.spyOn(Intl, 'DisplayNames').mockImplementationOnce(() => { throw new Error('unsupported'); });
    expect(countryName('KE')).toBe('KE');
    vi.restoreAllMocks();
  });
  it('completes the account preference that unlocks Home and stores selected catalog artists', () => {
    const library: LibraryData = { favorites: [], playlists: [], recent: [], artists: [], albums: [], history: [], profile: { name: 'Test', username: '' }, taste: normalizeTaste(null) };
    const artist = { id: 'UC_CATALOG', name: 'Catalog artist', cover: 'https://example.test/portrait.jpg' };
    const saved = applyMusicPreferences(library, { country: 'ke', genres: ['afrobeats', 'jazz'], completed: false }, [artist], []);
    expect(saved.taste).toEqual({ country: 'KE', genres: ['afrobeats', 'jazz'], completed: true });
    expect(saved.artists).toEqual([artist]);
    expect(library.taste.completed).toBe(false);
    expect(library.artists).toEqual([]);
    expect(saved.profile).toBe(library.profile);
  });
  it('does not complete with a search string, unknown region, or invented US default', () => {
    const library: LibraryData = { favorites: [], playlists: [], recent: [], artists: [], albums: [], history: [], profile: { name: '', username: '' }, taste: normalizeTaste(null) };
    for (const country of ['', 'Kenya', 'OTHER', 'XX']) expect(() => applyMusicPreferences(library, { country, genres: [], completed: true }, [], [])).toThrow('Choose a country');
    expect(library.taste.completed).toBe(false);
  });
  it('removes explicit deselections but preserves follows added on another device', () => {
    const old = { id: 'old', name: 'Unselected' }, remote = { id: 'remote', name: 'Added elsewhere' }, selected = { id: 'new', name: 'Selected here' };
    const library: LibraryData = { favorites: [], playlists: [], recent: [], artists: [old, remote], albums: [], history: [], profile: { name: '', username: '' }, taste: normalizeTaste(null) };
    const saved = applyMusicPreferences(library, { country: 'TZ', genres: [], completed: true }, [selected, selected], [old.id]);
    expect(saved.artists).toEqual([remote, selected]);
    expect(library.artists).toEqual([old, remote]);
  });
});

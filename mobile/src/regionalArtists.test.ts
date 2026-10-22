import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/shared/media/innertube/innertubeSearch', () => ({ searchCatalog: vi.fn() }));
import { searchCatalog } from '@/shared/media/innertube/innertubeSearch';
import { getRegionalArtists, matchCountryArtist } from './regionalArtists';
const candidate = { id: 'musicbrainz-id', name: 'Catalog Artist', country: 'TZ' };
const result = { type: 'artist' as const, id: 'UC_ACTUAL_CATALOG', name: 'Catalog Artist', cover: { url: 'https://lh3.googleusercontent.com/portrait=s0', width: 1024, height: 1024 } };
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T11:00:00Z')); vi.clearAllMocks();
  vi.stubGlobal('navigator', { onLine: true }); vi.stubGlobal('window', { CineAndroid: {} });
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('regional artist provenance and real catalog artwork', () => {
  it('accepts only a unique matching catalog artist and uses card-sized source artwork', () => {
    const artist = matchCountryArtist(candidate, [result, { ...result }], 'TZ');
    expect(artist?.id).toBe(result.id);
    expect(artist?.cover).toContain('240');
    expect(artist?.cover).not.toContain('=s0');
  });
  it('does not assign country to related artists, wrong-country records, or ambiguous names', () => {
    expect(matchCountryArtist(candidate, [{ ...result, name: 'Related artist' }], 'TZ')).toBeNull();
    expect(matchCountryArtist({ ...candidate, country: 'KE' }, [result], 'TZ')).toBeNull();
    expect(matchCountryArtist(candidate, [result, { ...result, id: 'UC_OTHER_PERSON' }], 'TZ')).toBeNull();
  });
  it('respects source ended metadata and handles Unicode artist names', () => {
    expect(matchCountryArtist({ ...candidate, 'life-span': { ended: true } }, [result], 'TZ')).toBeNull();
    expect(matchCountryArtist({ ...candidate, name: '坂本龍一', country: 'JP' }, [{ ...result, name: '坂本龍一' }], 'JP')?.id).toBe(result.id);
  });
  it('loads actual country records, maps catalog IDs, and caches without sending account credentials', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ artists: [candidate] }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher); vi.mocked(searchCatalog).mockResolvedValue([result]);
    const request = getRegionalArtists('TZ', new AbortController().signal); await vi.runAllTimersAsync(); const value = await request;
    expect(value.artists[0]).toMatchObject({ id: result.id, mbid: candidate.id, country: 'TZ', matchMethod: 'unique-name' });
    expect(fetcher.mock.calls[0]?.length).toBeGreaterThan(0);
    const options = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1];
    expect(options.credentials).toBe('omit');
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.headers).toHaveProperty('x-liner-user-agent');
    const again = await getRegionalArtists('TZ', new AbortController().signal);
    expect(again.cached).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1); expect(searchCatalog).toHaveBeenCalledTimes(1);
  });
  it('labels stale offline data rather than inventing regional artists', async () => {
    storage.set('cine:browse-cache:regional-artists-v1:TZ', JSON.stringify({ country: 'TZ', fetchedAt: Date.now() - 172_800_000, artists: [{ ...result, cover: result.cover.url, mbid: candidate.id, country: 'TZ', matchMethod: 'unique-name' }] }));
    vi.stubGlobal('navigator', { onLine: false }); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await getRegionalArtists('TZ', new AbortController().signal)).stale).toBe(true); expect(fetcher).not.toHaveBeenCalled();
    await expect(getRegionalArtists('KE', new AbortController().signal)).rejects.toThrow('Connect');
  });
  it('rejects invalid or already-cancelled requests without contacting the source', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); const controller = new AbortController(); controller.abort();
    await expect(getRegionalArtists('OTHER', controller.signal)).rejects.toThrow('Choose');
    const pending = getRegionalArtists('KE', controller.signal); await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); expect(fetcher).not.toHaveBeenCalled();
  });
});

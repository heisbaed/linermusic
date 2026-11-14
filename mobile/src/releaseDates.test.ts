import { describe, expect, it } from 'vitest';
import { datedAlbum, parseDatedReleases, releasedWithin30Days } from './releaseDates';
const now = new Date(2026, 10, 14, 12).getTime();
describe('confirmed new releases', () => {
  it('accepts only precise dates from the previous 30 days including the boundary', () => {
    expect(releasedWithin30Days('2026-10-15', now)).toBe(true);
    expect(releasedWithin30Days('2026-11-14T07:00:00Z', now)).toBe(true);
    for (const value of ['2026-10-14', '2026-11-15', '2026', '2026-02-31', 'invalid']) expect(releasedWithin30Days(value, now)).toBe(false);
  });
  it('requires an exact artist and recording edition match', () => {
    const album = { type: 'album' as const, id: 'actual-catalog', title: 'New Song', artists: [{ id: 'artist', name: 'Singer' }] };
    const dates = parseDatedReleases({ results: [{ artistName: 'Other', collectionName: 'New Song', releaseDate: '2026-11-01' }, { artistName: 'Singer', collectionName: 'New Song - Single', releaseDate: '2026-11-01' }] }, 'Singer');
    expect(dates).toHaveLength(1);
    expect(datedAlbum(album, dates, now)?.releasedAt).toBe('2026-11-01');
    expect(datedAlbum({ ...album, title: 'New Song (Live)' }, dates, now)).toBeNull();
  });
  it('does not count an old edition as new because of a reissue', () => {
    const album = { type: 'album' as const, id: 'actual', title: 'Old Song', artists: [{ id: 'a', name: 'Singer' }] };
    expect(datedAlbum(album, [{ title: 'Old Song', artist: 'Singer', releasedAt: '2025-02-01' }, { title: 'Old Song', artist: 'Singer', releasedAt: '2026-11-01' }], now)).toBeNull();
  });
});

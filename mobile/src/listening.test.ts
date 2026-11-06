import { describe, expect, it } from 'vitest';
import { creditedMilliseconds, type PlaybackSample } from './listening';
const sample = (overrides: Partial<PlaybackSample> = {}): PlaybackSample => ({ id: 'test-track', status: 'playing', positionMs: 10_000, at: 100_000, ...overrides });
describe('measured listening time', () => {
  it('credits actual progress and never exceeds elapsed time', () => {
    expect(creditedMilliseconds(sample(), sample({ positionMs: 12_000, at: 102_000 }))).toBe(2000);
    expect(creditedMilliseconds(sample(), sample({ positionMs: 12_500, at: 102_000 }))).toBe(2000);
  });
  it('does not count seeks, paused time, another track, or a missing baseline', () => {
    expect(creditedMilliseconds(sample(), sample({ positionMs: 100_000, at: 102_000 }))).toBe(0);
    expect(creditedMilliseconds(sample(), sample({ positionMs: 2000, at: 102_000 }))).toBe(0);
    expect(creditedMilliseconds(sample({ status: 'paused' }), sample({ positionMs: 12_000, at: 102_000 }))).toBe(0);
    expect(creditedMilliseconds(sample(), sample({ id: 'other', positionMs: 12_000, at: 102_000 }))).toBe(0);
    expect(creditedMilliseconds(null, sample())).toBe(0);
  });
  it('includes progress up to a pause and rejects long gaps without playback evidence', () => {
    expect(creditedMilliseconds(sample(), sample({ status: 'paused', positionMs: 11_000, at: 101_000 }))).toBe(1000);
    expect(creditedMilliseconds(sample(), sample({ positionMs: 55_000, at: 145_000 }))).toBe(0);
  });
});

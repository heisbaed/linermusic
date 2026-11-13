import { describe, it, expect } from 'vitest';
import { lyricsScore } from './lyricsMatch';
const song = { id: 'fixture', title: 'Stay (Official Audio)', artist: 'Test Artist', durationMs: 180000 };
describe('lyrics identity', () => {
  it('accepts the same recording with cleaned source metadata', () => {
    expect(lyricsScore({ trackName: 'Stay', artistName: 'Test Artist', duration: 180, plainLyrics: 'provided' }, song)).toBeGreaterThan(0);
  });
  it('rejects unrelated synced lyrics even when their timing is available', () => {
    expect(lyricsScore({ trackName: 'Other song', artistName: 'Other artist', duration: 180, syncedLyrics: '[00:01]Wrong' }, song)).toBe(-Infinity);
  });
  it('rejects a different recording length', () => {
    expect(lyricsScore({ trackName: 'Stay', artistName: 'Test Artist', duration: 300 }, song)).toBe(-Infinity);
  });
});

import { describe, expect, it } from 'vitest';
import { addToPlaylist, formatTime, parseLrc, toggleFavorite } from './library';
import type { Song } from './types';
const song: Song = { id: 'abc123def45', title: 'A song', artist: 'An artist', durationMs: 180000 };
describe('personal library', () => {
  it('can add and remove a favorite without changing the original list', () => {
    const original: Song[] = [];
    const favorites = toggleFavorite(original, song);
    expect(original).toEqual([]);
    expect(favorites).toEqual([song]);
    expect(toggleFavorite(favorites, song)).toEqual([]);
  });
  it('keeps playlist order and prevents duplicate songs', () => {
    const playlist = { id: 'p', name: 'Favorites', songs: [song] };
    expect(addToPlaylist(playlist, song)).toBe(playlist);
    const next = { ...song, id: 'second' };
    expect(addToPlaylist(playlist, next).songs).toEqual([song, next]);
  });
});
describe('lyrics and playback position', () => {
  it('expands repeated timestamps, ignores metadata, and sorts lines for seeking', () => {
    expect(parseLrc('[ar:Artist]\n[00:20.50]Later\n[00:05.10][00:15.20]Refrain\n[00:00.00]')).toEqual([
      { time: 5.1, text: 'Refrain' }, { time: 15.2, text: 'Refrain' }, { time: 20.5, text: 'Later' },
    ]);
  });
  it('formats duration with zero padding and clamps negative positions', () => {
    expect(formatTime(-300)).toBe('0:00'); expect(formatTime(185500)).toBe('3:05');
  });
});

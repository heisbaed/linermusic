import { describe, expect, it } from 'vitest';
import { addToPlaylist, formatTime, parseLrc, parsePlaylistBackup, playlistBackupFileName, playlistBackupText, playlistIsDownloaded, toggleFavorite } from './library';
import type { Playlist, Song } from './types';
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
  it('treats a playlist as downloaded only when every song is saved or queued', () => {
    const playlist = { id: 'p', name: 'Offline mix', songs: [song, { ...song, id: 'second' }] };
    expect(playlistIsDownloaded(playlist, [song], [])).toBe(false);
    expect(playlistIsDownloaded(playlist, [song], [{ id: 'second', status: 'queued' }])).toBe(true);
    expect(playlistIsDownloaded(playlist, [song], [{ id: 'second', status: 'failed' }])).toBe(false);
    expect(playlistIsDownloaded({ ...playlist, songs: [] }, [], [])).toBe(false);
  });
});
describe('playlist backups', () => {
  const date = new Date('2026-11-08T10:00:00.000Z');
  const secretSong = { ...song, id: 'secretSong1', url: 'https://media.example.test/audio.m4a', offline: true, downloadBytes: 42 } as unknown as Song;
  const playlist: Playlist = { id: 'p1', name: 'Road Trip', description: 'Drive music', cover: 'https://example.test/cover.jpg', songs: [secretSong, { ...song, id: 'second' }] };
  it('exports only portable song metadata and round-trips it', () => {
    const backup = playlistBackupText([playlist], date);
    expect(backup).not.toContain('media.example.test'); expect(backup).not.toContain('downloadBytes');
    const restored = parsePlaylistBackup(backup)[0];
    expect(restored).toMatchObject({ id: 'p1', name: 'Road Trip', description: 'Drive music', cover: 'https://example.test/cover.jpg', isPublic: false });
    expect(restored.songs.map(({ id, title, artist, durationMs }) => ({ id, title, artist, durationMs }))).toEqual([
      { id: 'secretSong1', title: 'A song', artist: 'An artist', durationMs: 180000 },
      { id: 'second', title: 'A song', artist: 'An artist', durationMs: 180000 },
    ]);
    expect(restored.songs[0]).not.toHaveProperty('url'); expect(restored.songs[0]).not.toHaveProperty('offline');
  });
  it('assigns backup filenames for one playlist or the whole library', () => {
    expect(playlistBackupFileName([playlist], date)).toBe('cine-playlist-road-trip-2026-11-08.json');
    expect(playlistBackupFileName([playlist, { ...playlist, id: 'p2' }], date)).toBe('cine-playlists-2026-11-08.json');
  });
  it('rejects malformed files and deduplicates restored songs', () => {
    expect(() => parsePlaylistBackup('not json')).toThrow('not valid JSON');
    expect(() => parsePlaylistBackup('{"type":"other"}')).toThrow('not a Cine playlist backup');
    const duplicate = playlistBackupText([{ ...playlist, songs: [secretSong, secretSong] }], date);
    expect(parsePlaylistBackup(duplicate)[0].songs).toHaveLength(1);
  });
});
describe('lyrics and playback position', () => {
  it('expands repeated timestamps, ignores metadata, and sorts lines for seeking', () => {
    expect(parseLrc('[ar:Artist]\n[00:20.50]Later\n[00:05.10][00:15.20]Refrain\n[00:00.00]')).toEqual([
      { time: 5.1, text: 'Refrain' }, { time: 15.2, text: 'Refrain' }, { time: 20.5, text: 'Later' },
    ]);
  });
  it('supports colon fractions, three-digit milliseconds, enhanced tags and offsets', () => {
    expect(parseLrc('[offset:+500]\n[00:05:50]Frame\n[01:02.345]<00:05.00>Word\n[00:01.2]Short')).toEqual([
      { time: 1.7, text: 'Short' }, { time: 6, text: 'Frame' }, { time: 62.845, text: 'Word' },
    ]);
    expect(parseLrc('[offset:-250]\n[00:01.00]Earlier')).toEqual([{ time: 0.75, text: 'Earlier' }]);
  });
  it('formats duration with zero padding and clamps negative positions', () => {
    expect(formatTime(-300)).toBe('0:00'); expect(formatTime(185500)).toBe('3:05');
  });
});

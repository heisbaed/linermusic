import { describe, expect, it } from 'vitest';
import { deduplicatePlaylist, EMPTY_HIDDEN, isHidden, lyricOffset, normalizeHidden, personalizeSongs, validCheckpoint } from './smartFeatures';
import { cleanSongResults } from './catalogQuality';
import type { Song } from './types';
const song = (id: string, title = 'Title', artist = 'Artist'): Song => ({ id, title, artist, durationMs: 180000 });

describe('smart listening and playlist safeguards', () => {
  it('removes duplicate recordings while retaining versions and unrelated artists', () => {
    const first = song('one');
    expect(deduplicatePlaylist([first, first, song('copy', 'Title (Official Audio)'), song('live', 'Title (Live)'), song('other', 'Title', 'Someone else')]).map(item => item.id)).toEqual(['one', 'live', 'other']);
  });
  it('does not merge unknown-duration recordings or materially different lengths', () => {
    expect(deduplicatePlaylist([song('one'), { ...song('two'), durationMs: 0 }, { ...song('three'), durationMs: 220000 }])).toHaveLength(3);
  });
  it('matches hidden artist aliases and restores usable defaults for corrupted storage', () => {
    const hidden = { songs: [song('hidden')], artists: [{ id: 'UCArtist', name: 'Singer' }] };
    expect(isHidden(song('hidden'), hidden)).toBe(true);
    expect(isHidden(song('alias', 'Another', 'Singer - Topic'), hidden)).toBe(true);
    expect(isHidden({ ...song('same-id', 'Another', 'Changed name'), artistId: 'UCArtist' }, hidden)).toBe(true);
    expect(normalizeHidden({ songs: [null, song('valid')], artists: [null] }).songs).toHaveLength(1);
    expect(normalizeHidden(null)).toEqual(EMPTY_HIDDEN);
  });
  it('varies consecutive artists and excludes hidden music', () => {
    const songs = [song('one', 'One'), song('two', 'Two'), song('three', 'Three', 'Other'), song('hidden', 'Four')];
    expect(personalizeSongs(songs, [], [], { songs: [song('hidden')], artists: [] }).map(item => item.id)).toEqual(['one', 'three', 'two']);
  });
  it('changes radio ranking for discovery, familiar listening and skips', () => {
    const songs = [song('new', 'New', 'New artist'), song('familiar', 'Familiar')];
    expect(personalizeSongs(songs, [song('favorite')], [], EMPTY_HIDDEN, 'familiar')[0].id).toBe('familiar');
    expect(personalizeSongs(songs, [song('favorite')], [], EMPTY_HIDDEN, 'discover')[0].id).toBe('new');
    expect(personalizeSongs(songs, [], [], EMPTY_HIDDEN, 'balanced', ['new'])[0].id).toBe('familiar');
  });
  it('rejects expired, completed and invalid resume checkpoints', () => {
    const checkpoint = { song: song('one'), queue: [song('one')], positionMs: 12000, context: 'Playlist', savedAt: Date.now() };
    expect(validCheckpoint(checkpoint)).toBe(true);
    expect(validCheckpoint({ ...checkpoint, positionMs: 179000 })).toBe(false);
    expect(validCheckpoint({ ...checkpoint, positionMs: NaN })).toBe(false);
    expect(validCheckpoint({ ...checkpoint, savedAt: 0 })).toBe(false);
    expect(validCheckpoint({ ...checkpoint, queue: [null] })).toBe(false);
  });
  it('clamps and quantizes lyric timing', () => {
    expect(lyricOffset(Infinity)).toBe(0);
    expect(lyricOffset(550)).toBe(500);
    expect(lyricOffset(-12000)).toBe(-10000);
  });
  it('keeps official-source live gospel above an unrelated instrumental upload', () => {
    const original = { type: 'track' as const, id: 'eafzURCG1X0', title: 'Umenipendelea (Live)', artists: [{ id: 'choir', name: 'Neema Gospel Choir' }], durationMs: 798000, musicVideoType: 'MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC' };
    const instrumental = { ...original, id: 'beat', title: 'NEEMA GOSPEL CHOIR UMENIPENDELEA BEAT || FREE PRAISE BEAT', artists: [{ id: 'other', name: 'Masebo MUSIC' }], musicVideoType: 'MUSIC_VIDEO_TYPE_ATV' };
    const rows = cleanSongResults([instrumental, original, { type: 'artist', id: 'choir', name: 'Neema Gospel Choir' }], 'Umenipendelea Neema Gospel Choir');
    expect(rows[0].id).toBe(original.id);
    expect(rows.some(item => item.id === original.id)).toBe(true);
  });
});

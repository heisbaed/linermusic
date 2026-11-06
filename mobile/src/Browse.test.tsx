import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { AppContext, type AppState, type LibraryData } from './AppContext';
import { CatalogScreen, CollectionScreen, HomeScreen, LibraryScreen, PlaylistForm, PlaylistScreen, SearchScreen, matchingSongs, songFrom } from './Browse';
import type { Track } from '@/shared/contracts';
import type { Song } from './types';

vi.mock('@/shared/media/innertube/innertubeSearch', () => ({ searchCatalog: vi.fn().mockResolvedValue([]) }));
vi.mock('@/shared/media/innertube/innertubeCatalog', () => ({ innertubeCatalog: { getArtist: vi.fn(), getAlbum: vi.fn(), getPlaylist: vi.fn() } }));

// Fixtures exist only in tests. Production screens never create catalog content.
const first: Song = { id: 'fixture-one', title: 'First fixture', artist: 'Test artist', durationMs: 120_000 };
const second: Song = { id: 'fixture-two', title: 'Second fixture', artist: 'Another artist', durationMs: 180_000 };
function library(): LibraryData {
  return { favorites: [first], recent: [second], playlists: [{ id: 'owned', name: 'My private mix', songs: [first, second] }], albums: [], artists: [], history: [], profile: { name: '', username: '' }, taste: { country: 'TZ', genres: [], completed: true } };
}
function app(): AppState {
  const data = library();
  return {
    account: { library: data, ready: true, user: null, setLibrary: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), syncStatus: '', retrySync: vi.fn(), updateProfile: vi.fn(), suspendSync: vi.fn(async () => () => {}) },
    playback: { player: { track: null, status: 'idle', positionMs: 0, durationMs: 0 }, queue: [], context: 'Test', shuffle: false, repeat: 'off', play: vi.fn(), playAll: vi.fn(), toggle: vi.fn(), next: vi.fn(), previous: vi.fn(), seek: vi.fn(), setShuffle: vi.fn(), setRepeat: vi.fn(), setQueue: vi.fn() },
    theme: 'default', setTheme: vi.fn(), updatePrefs: vi.fn(), prefs: { autoplay: false, wifiOnly: true, reducedMotion: 'system', haptics: false, privateListening: false, equalizerOn: false, eqBands: [0, 0, 0, 0, 0], eqPreset: 'Flat' },
    tab: 'home', goTab: vi.fn(), openRoute: vi.fn(), back: vi.fn(), openPlayer: vi.fn(), openMenu: vi.fn(), openUtility: vi.fn(), toast: vi.fn(), online: false,
    downloads: [], jobs: [], download: vi.fn(), removeDownload: vi.fn(), refreshDownloads: vi.fn(), toggleFavorite: vi.fn(), isFavorite: id => data.favorites.some(song => song.id === id), addToPlaylist: null, setAddToPlaylist: vi.fn(),
  };
}
function render(screen: ReactNode, state = app()) { return renderToStaticMarkup(<AppContext.Provider value={state}>{screen}</AppContext.Provider>); }

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal('window', {});
});
afterEach(() => vi.unstubAllGlobals());

describe('browse data boundaries', () => {
  it('maps actual track metadata without discarding known navigation IDs', () => {
    const track: Track = { id: 'track', title: 'A title', durationMs: 150_000, artists: [{ id: 'artist', name: 'One' }, { id: 'another', name: 'Two' }], album: { id: 'album', title: 'Record' }, cover: { url: 'https://example.invalid/cover.jpg', width: 200, height: 200 } };
    expect(songFrom(track)).toEqual({ id: 'track', title: 'A title', artist: 'One, Two', artistId: 'artist', albumId: 'album', durationMs: 150_000, cover: track.cover?.url });
  });
  it('does not invent an artist or album ID when one was not returned', () => {
    const song = songFrom({ id: 'track', title: 'Title', durationMs: 0, artists: [{ id: '', name: 'Unknown ID' }] });
    expect(song).not.toHaveProperty('artistId');
    expect(song).not.toHaveProperty('albumId');
    expect(song.durationMs).toBe(0);
  });
  it('filters saved songs locally by title or artist and keeps playback order', () => {
    const songs = [first, second];
    expect(matchingSongs(songs, '  TEST ARTIST ')).toEqual([first]);
    expect(matchingSongs(songs, 'second')).toEqual([second]);
    expect(matchingSongs(songs, '   ')).toBe(songs);
    expect(songs).toEqual([first, second]);
  });
});

describe('browse initial and offline states', () => {
  it('renders truthful offline Home without fabricated recommendations', () => {
    const html = render(<HomeScreen />);
    expect(html).toMatch(/Good (morning|afternoon|evening)|Welcome back/);
    expect(html).toContain('You are offline');
    expect(html).toContain('Open downloads');
    expect(html).not.toContain('/reference-art');
  });
  it('renders four catalog-artwork genre categories without sketch illustrations', () => {
    const html = render(<SearchScreen />);
    for (const category of ['Afrobeats', 'R&amp;B', 'Pop', 'Hip-Hop']) expect(html).toContain(category);
    expect(html).not.toContain('viewBox="0 0 220 150"');
    for (const filter of ['All', 'Songs', 'Artists', 'Albums']) expect(html).toContain(`>${filter}</button>`);
    expect(html).not.toContain('browse-result-artist');
    expect(html).toContain('Browse genres');
  });
  it('counts actual saved albums and artists instead of inferring them from songs', () => {
    const state = app();
    state.account.library.albums = [{ id: 'album', title: 'Saved record', artist: 'Artist' }];
    const html = render(<LibraryScreen />, state);
    expect(html).toContain('1 album');
    expect(html).toContain('0 artists');
    expect(html).toContain('My private mix');
    expect(html).toContain('Create playlist');
  });
  it('exposes favorites search, play all, shuffle and saved heart controls', () => {
    const html = render(<CollectionScreen collection="favorites" />);
    expect(html).toContain('Search favorites');
    expect(html).toContain('Play all');
    expect(html).toContain('Shuffle');
    expect(html).toContain('Remove First fixture from Favorites');
  });
  it('shows active downloads separately without counting them as completed', () => {
    const state = app();
    state.jobs = [{ id: first.id, song: first, status: 'downloading', progress: 37 }, { id: second.id, song: second, status: 'failed', progress: 8, error: 'Test connection error' }];
    const html = render(<CollectionScreen collection="downloads" />, state);
    expect(html).toContain('0 songs');
    expect(html).toContain('Downloading · 37%');
    expect(html).toContain('Download failed');
    expect(html).toContain('Test connection error');
    expect(html).toContain('Cancel download of First fixture');
    expect(html).not.toContain('aria-label="Play First fixture');
  });
  it('renders saved artist directories with round art and local search/sort', () => {
    const state = app();
    state.account.library.artists = [{ id: 'artist', name: 'Saved artist' }];
    const html = render(<CollectionScreen collection="artists" />, state);
    expect(html).toContain('Saved artist');
    expect(html).toContain('browse-round');
    expect(html).toContain('Recently saved');
    expect(html).toContain('Name A to Z');
  });
  it('renders an owned playlist with duration, private status and non-playing edit actions', () => {
    const state = app(), html = render(<PlaylistScreen id="owned" />, state);
    expect(html).toContain('My private mix');
    expect(html).toContain('5 min');
    expect(html).toContain('Private playlist');
    expect(html).toContain('Edit songs');
    expect(html).toContain('Delete playlist');
    expect(state.playback.playAll).not.toHaveBeenCalled();
  });
  it('does not show a stale playlist when the requested ID is absent', () => {
    const html = render(<PlaylistScreen id="missing" />);
    expect(html).toContain('This playlist is not in your library');
    expect(html).not.toContain('My private mix');
  });
  it('offers a required name and compact local cover upload without a fake public toggle', () => {
    const html = render(<PlaylistForm />);
    expect(html).toContain('id="browse-playlist-name"');
    expect(html).toContain('required=""');
    expect(html).toContain('image/jpeg,image/png,image/webp');
    expect(html).toContain('resized before saving');
    expect(html).toContain('Public publishing is not available');
    expect(html).not.toContain('type="checkbox"');
  });
  it('shows a loading boundary instead of fabricated catalog details', () => {
    const html = render(<CatalogScreen type="artist" id="not-yet-loaded" />);
    expect(html).toContain('Opening artist...');
    expect(html).not.toContain('Popular');
    expect(html).not.toContain('monthly listeners');
  });
});

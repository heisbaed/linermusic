import { searchCatalog } from '@/shared/media/innertube/innertubeSearch';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import { postInnertube } from '@/shared/media/innertube/innertubeClient';
import { PLAYBACK_PROFILES } from '@/shared/media/innertube/playbackProfiles';
import { extractAudioFormats, playabilityError, selectBestAudioFormat } from '@/shared/media/innertube/innertubeAudioFormats';
import type { Track } from '@/shared/contracts/track';
import type { Song } from './types';

function song(track: Track): Song {
  return { id: track.id, title: track.title, artist: track.artists.map(artist => artist.name).join(', '), cover: track.cover?.url, durationMs: track.durationMs };
}
export async function search(query: string, signal?: AbortSignal): Promise<Song[]> {
  return (await searchCatalog(query, 'track', signal)).filter(item => item.type === 'track').map(item => song(item as Track));
}
export async function playlistFromUrl(input: string): Promise<{ name: string; songs: Song[] }> {
  const url = new URL(input);
  if (!['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'].includes(url.hostname) || !url.searchParams.get('list')) throw new Error('Paste a YouTube or YouTube Music playlist link.');
  const playlist = await innertubeCatalog.getPlaylist(url.searchParams.get('list')!);
  return { name: playlist.title, songs: playlist.tracks.map(song) };
}
export async function resolveStream(id: string, signal?: AbortSignal): Promise<string> {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('This track cannot be streamed.');
  const reasons: string[] = [];
  for (const profile of PLAYBACK_PROFILES) {
    try {
      const response = await postInnertube('player', { videoId: id, contentCheckOk: true, racyCheckOk: true }, { profile, signal });
      const error = playabilityError(response); if (error) throw new Error(error);
      const format = selectBestAudioFormat(extractAudioFormats(response), 'aac');
      if (!format) throw new Error('No playable audio returned.');
      const url = new URL(format.url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.googlevideo.com')) throw new Error('Unsupported audio source.');
      return format.url;
    } catch (error) { if (signal?.aborted) throw error; reasons.push(error instanceof Error ? error.message : String(error)); }
  }
  throw new Error(reasons[0] || 'This track is unavailable. Try another song.');
}

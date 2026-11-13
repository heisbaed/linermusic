import type { SearchResult, Track } from '@/shared/contracts';
import type { Song } from './types';

const edits = /\b(slowed|sped[ -]?up|speed[ -]?up|nightcore|reverb|8d|bass[ -]?boosted|karaoke|tribute|ringtone|tiktok|fan[ -]?made|cover|parody|originally performed|made famous|no guide melody|dj mix|non[ -]?stop)\b/i;
export const isEditedUpload = (title: string) => edits.test(title);
export const recordingTitle = (title: string) => title.toLocaleLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(official|audio|video|lyrics?|remastered|remaster)\b/g,' ')
  .replace(/[^\p{L}\p{N}]/gu,'');

export function isCatalogAudio(track: Track, fromSongs = false): boolean {
  // Source classification is stronger evidence than words such as "Cover" in
  // a real song title. Artwork shape and artist-channel IDs are not guarantees.
  if (track.musicVideoType) return ['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV'].includes(track.musicVideoType);
  if (fromSongs) return true;
  return !isEditedUpload(track.title) && Boolean(track.album?.id && track.artists.some(artist => artist.name && artist.name !== 'Unknown Artist'));
}

export const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const artistKey = (text: string) => searchText(text.replace(/\s*-\s*Topic$/i, ''));
const searchTitle = (text: string) => searchText(text.replace(/\b(?:official\s+(?:music\s+)?(?:audio|video|visuali[sz]er)|lyric(?:s|\s+video)?)\b/gi, ''));
const versions = /\b(acoustic|live|remix|instrumental|slowed|sped|nightcore|karaoke|reverb)\b/g;

export function cleanSongResults(items: SearchResult[], query = '', songIds: ReadonlySet<string> = new Set()): SearchResult[] {
  const normalizedQuery = searchText(query), tokens = normalizedQuery.split(' ').filter(Boolean);
  const artistMatches = items.filter((item): item is Extract<SearchResult, { type: 'artist' }> =>
    item.type === 'artist' && artistKey(item.name).length >= 3 && (` ${normalizedQuery} `).includes(` ${artistKey(item.name)} `));
  const preferredIds = new Set(artistMatches.map(artist => artist.id));
  const preferredNames = new Set(artistMatches.map(artist => artistKey(artist.name)));
  function score(item: SearchResult): number {
    const title = item.type === 'artist' ? artistKey(item.name) : searchTitle(item.title);
    const artists = item.type === 'track' || item.type === 'album' ? item.artists : [];
    const text = `${title} ${artists.map(artist => artistKey(artist.name)).join(' ')} ${item.type === 'playlist' ? searchText(item.author || '') : ''}`;
    const matched = tokens.filter(token => text.includes(token)).length;
    const preferred = artists.some(artist => preferredIds.has(artist.id) || preferredNames.has(artistKey(artist.name)));
    const alternate = (title.match(versions) || []).some(version => !tokens.includes(version));
    return matched * 6 + (tokens.length && matched === tokens.length ? 12 : 0)
      + (normalizedQuery && title === normalizedQuery ? 24 : 0) + (preferred ? 5 : 0)
      - (alternate ? 8 : 0) + (item.type === 'track' && item.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV' ? 2 : 0);
  }
  const seenIds = new Set<string>(), recordings = new Set<string>();
  return items.filter(item => item.type !== 'track' || isCatalogAudio(item, songIds.has(item.id)))
    .sort((a, b) => score(b) - score(a))
    .filter(item => {
      const id = `${item.type}:${item.id}`;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      if (item.type !== 'track') return true;
      // Keep genuine versions and same-titled songs by different artists. Topic
      // and official artist channels can have different IDs for one recording.
      const artists = item.artists.map(artist => artistKey(artist.name) || artist.id).sort().join(',');
      const identity = `${searchTitle(item.title)}:${artists || item.id}:${Boolean(item.explicit)}`;
      if (recordings.has(identity)) return false;
      recordings.add(identity);
      return true;
    });
}
export function relatedSongs(tracks: Track[], previous: Pick<Song,'id'|'title'>[]): Track[] {
  const ids = new Set(previous.map(s=>s.id));
  const titles = new Set(previous.map(s=>recordingTitle(s.title)));
  return tracks.filter(track=>{
    const title=recordingTitle(track.title);
    if(!isCatalogAudio(track)||isEditedUpload(track.title)||ids.has(track.id)||titles.has(title))return false;
    ids.add(track.id);titles.add(title);return true;
  });
}

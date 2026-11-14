import type { SearchResult, Track } from '@/shared/contracts';
import type { Song } from './types';

const edits = /\b(slowed|sped[ -]?up|speed[ -]?up|nightcore|reverb|8d|bass[ -]?boosted|karaoke|tribute|ringtone|tiktok|fan[ -]?made|cover|parody|originally performed|made famous|no guide melody|dj mix|non[ -]?stop)\b/i;
const uploadLabel = /^(?:official(?:\s+music)?\s+(?:video|audio|visuali[sz]er)|(?:official\s+)?lyric(?:s|\s+video)|music\s+video)(?:\s*(?:hd|hq|4k|1080p|720p))?$/i;

export function displaySongTitle(title: string, artist = ''): string {
  let clean = title.replace(/\(([^()]*)\)|\[([^\[\]]*)\]/g, (whole, round: string, square: string) =>
    uploadLabel.test((round || square).trim()) ? '' : whole);
  clean = clean.replace(/\s*(?:[-–—|]\s*)?(?:official(?:\s+music)?\s+(?:video|audio|visuali[sz]er)|official\s+lyric(?:s|\s+video))\s*(?:hd|hq|4k|1080p|720p)?\s*$/i, '');
  const prefix = artist.split(',')[0].trim();
  if (prefix && clean.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) {
    const remainder = clean.slice(prefix.length);
    if (/^\s*[-–—|]\s*\S/.test(remainder)) clean = remainder.replace(/^\s*[-–—|]\s*/, '');
  }
  return clean.replace(/\s+/g, ' ').replace(/\s*[-–—|]\s*$/, '').trim() || title;
}

export const isEditedUpload = (title: string) => edits.test(title);
export const recordingTitle = (title: string) => title.toLocaleLowerCase()
  .replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/\b(official|audio|video|lyrics?|remastered|remaster)\b/g,' ')
  .replace(/[^\p{L}\p{N}]/gu,'');

export function isCatalogAudio(track: Track, fromSongs = false): boolean {
  // Source classification is stronger evidence than words such as "Cover" in
  // a real song title. Artwork shape and artist-channel IDs are not guarantees.
  if (track.musicVideoType) return ['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV','MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'].includes(track.musicVideoType);
  if (fromSongs) return true;
  return !isEditedUpload(track.title) && Boolean(track.album?.id && track.artists.some(artist => artist.name && artist.name !== 'Unknown Artist'));
}

export const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const artistKey = (text: string) => searchText(text.replace(/\s*-\s*Topic$/i, ''));
const searchTitle = (text: string) => searchText(text.replace(/\b(?:official\s+(?:music\s+)?(?:audio|video|visuali[sz]er)|lyric(?:s|\s+video)?)\b/gi, ''));
const versions = /\b(acoustic|live|remix|instrumental|slowed|sped|nightcore|karaoke|reverb)\b/g;

export function tokenMatch(token: string, word: string): number {
  if (word === token) return 8;
  if (word.startsWith(token)) return 6;
  if (token.length < 4 || Math.abs(token.length-word.length)>1) return 0;
  // Bounded edit distance covers a missing/wrong character without matching unrelated short names.
  let row = Array.from({length:word.length+1},(_,i)=>i);
  for(let i=1;i<=token.length;i++) { const next=[i]; for(let j=1;j<=word.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+Number(token[i-1]!==word[j-1])); row=next; }
  return row[word.length]<=1 ? 3 : 0;
}

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
    const words = text.split(' ').filter(Boolean);
    const matches = tokens.map(token => Math.max(0,...words.map(word => tokenMatch(token, word))));
    const matched = matches.filter(Boolean).length;
    const preferred = artists.some(artist => preferredIds.has(artist.id) || preferredNames.has(artistKey(artist.name)));
    const alternate = (title.match(versions) || []).some(version => !tokens.includes(version));
    const backingTrack = /\b(instrumental|karaoke|beat|beats|backing track|free praise beat)\b/.test(title)
      && !/\b(instrumental|karaoke|beat|beats|backing)\b/.test(normalizedQuery);
    return matches.reduce((a,b)=>a+b,0) + (tokens.length && matched === tokens.length ? 12 : 0)
      + (normalizedQuery && title === normalizedQuery ? 24 : 0) + (preferred ? 18 : 0)
      - (alternate ? 8 : 0) - (backingTrack ? 32 : 0) + (item.type === 'track' && item.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV' ? 2 : 0);
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

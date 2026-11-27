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
  if (fromSongs) return true;
  if (track.musicVideoType && ['MUSIC_VIDEO_TYPE_ATV','MUSIC_VIDEO_TYPE_OMV','MUSIC_VIDEO_TYPE_OFFICIAL_SOURCE_MUSIC'].includes(track.musicVideoType)) return true;
  return !isEditedUpload(track.title) && track.durationMs > 0 && track.artists.some(artist => artist.name && artist.name !== 'Unknown Artist');
}

export const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

export function tokenMatch(token: string, word: string): number {
  if (word === token) return 8;
  if (word.startsWith(token)) return 6;
  if (token.length < 4 || Math.abs(token.length-word.length)>1) return 0;
  // Bounded edit distance covers a missing/wrong character without matching unrelated short names.
  let row = Array.from({length:word.length+1},(_,i)=>i);
  for(let i=1;i<=token.length;i++) { const next=[i]; for(let j=1;j<=word.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+Number(token[i-1]!==word[j-1])); row=next; }
  return row[word.length]<=1 ? 3 : 0;
}

export function cleanSongResults(items: SearchResult[], _query = '', _songIds: ReadonlySet<string> = new Set()): SearchResult[] {
  // Preserve the catalog's own ranking: mixed/top results, then typed song/video
  // pages in provider order. Metadata completeness is never an availability test.
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
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

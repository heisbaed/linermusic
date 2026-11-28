import type { SearchResult } from '@/shared/contracts';
import { collectByKey, asArray, asRecord } from '@/shared/utils/json';
import { postInnertube } from './innertubeClient';
import { getBrowseEndpoint, getRuns, getText } from './innertubeJson';
import { parseDurationMs } from './innertubeTrackMapper';
import { videoThumbnailCover } from './innertubeThumbnail';

/** Supplement the music catalog with the artist's original public video metadata. */
export async function searchArtistVideos(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const timeout = new AbortController(), abort = () => timeout.abort();
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const raw = await postInnertube('search', { query, params: 'EgIQAQ%3D%3D' }, {
      signal: timeout.signal,
      profile: { clientName: 'WEB', clientVersion: '2.20261126.01.00', clientIdHeader: '1', origin: 'https://www.youtube.com' },
    });
    return collectByKey(raw, 'videoRenderer').flatMap(value => {
      const row = asRecord(value), id = row?.videoId, title = getText(row?.title);
      if (typeof id !== 'string' || !title) return [];
      const owner = getRuns(row?.ownerText ?? row?.longBylineText ?? row?.shortBylineText)[0];
      const name = typeof owner?.text === 'string' ? owner.text.trim() : '';
      if (!name) return [];
      const verifiedArtist = asArray(row?.ownerBadges).some(badge => asRecord(asRecord(badge)?.metadataBadgeRenderer)?.style === 'BADGE_STYLE_TYPE_VERIFIED_ARTIST');
      return [{ type: 'track' as const, id, title, source: 'youtube' as const, musicVideoType: 'MUSIC_VIDEO_TYPE_UGC',
        artists: [{ id: String(getBrowseEndpoint(owner)?.browseId || 'unknown'), name, kind: verifiedArtist ? 'artist' as const : 'uploader' as const, verifiedArtist }],
        durationMs: parseDurationMs(getText(row?.lengthText) || '') || 0, cover: videoThumbnailCover(id) }];
    }).slice(0, 24);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

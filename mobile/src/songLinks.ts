export function songLink(id:string):string {
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error('This song does not have a shareable catalog link.');
  if (typeof window !== 'undefined' && window.CineAndroid) {
    return 'cinemusic://song/' + id;
  }
  return 'https://cinemusic.web.app/song/' + id;
}

/** Shareable song link that works whether or not the recipient has the app. */
export function shareSongLink(id:string, song?: { title: string; artist: string }):string {
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error('This song does not have a shareable catalog link.');
  const url = new URL('https://cinemusic.web.app/song/' + id);
  if (song) {
    url.searchParams.set('title', song.title.slice(0, 300));
    url.searchParams.set('artist', song.artist.slice(0, 160));
  }
  return url.toString();
}

export function appShareLink():string {
  if (typeof window !== 'undefined' && window.CineAndroid?.getAppShareLink) {
    return window.CineAndroid.getAppShareLink();
  }
  return 'https://cinemusic.web.app/download';
}

export function getShareText(song: { title: string; artist: string; id: string; durationMs?: number; cover?: string }):string {
  const url = shareSongLink(song.id, song);
  const duration = song.durationMs ? formatDuration(song.durationMs) : '';
  return [`${song.title} - ${song.artist}`, duration ? `(${duration})` : '', url].filter(Boolean).join('\n');
}

/**
 * Generate Open Graph meta tags for rich link previews (like Spotify)
 * These would be rendered on the server when someone visits the song link
 */
export function getSongOGTags(song: { title: string; artist: string; id: string; cover?: string; durationMs?: number; lyrics?: string }):Record<string, string> {
  const coverUrl = song.cover || `https://i.ytimg.com/vi/${song.id}/hqdefault.jpg`;
  const lyricsSnippet = song.lyrics ? getLyricsPreview(song.lyrics, 2).replace(/\n/g, ' ') : '';
  return {
    'og:title': `${song.title} - ${song.artist}`,
    'og:description': lyricsSnippet ? `${lyricsSnippet} ...` : `Listen to ${song.title} by ${song.artist} on Cine Music`,
    'og:image': coverUrl,
    'og:url': 'https://cinemusic.web.app/song/' + song.id,
    'og:type': 'music.song',
    'music:song': 'https://cinemusic.web.app/song/' + song.id,
    'music:artist': song.artist,
  };
}

/**
 * Get lyrics preview text for sharing (first few lines)
 */
export function getLyricsPreview(lyrics: string, maxLines: number = 4):string {
  if (!lyrics) return '';
  const lines = lyrics.split('\n').filter(l => l.trim());
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Generate a shareable lyrics card URL (would resolve to a web page with lyrics preview)
 */
export function getLyricsShareLink(songId: string, lyricsSnippet: string):string {
  shareSongLink(songId); // Validate the same catalog ID used by song sharing.
  const encoded = btoa(unescape(encodeURIComponent(lyricsSnippet.substring(0, 500)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://cinemusic.web.app/song/${songId}/lyrics?preview=${encoded}`;
}

function formatDuration(ms: number):string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function songLink(id:string):string {
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error('This song does not have a shareable catalog link.');
  if (typeof window !== 'undefined' && window.CineAndroid) {
    return 'cinemusic://song/' + id;
  }
  return 'https://cinemusic.web.app/song/' + id;
}

/** Shareable song link that works whether or not the recipient has the app. */
export function shareSongLink(id:string):string {
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error('This song does not have a shareable catalog link.');
  if (typeof window !== 'undefined' && window.CineAndroid?.getSongShareLink) {
    return window.CineAndroid.getSongShareLink(id);
  }
  return 'https://cinemusic.web.app/song/' + id;
}

export function appShareLink():string {
  if (typeof window !== 'undefined' && window.CineAndroid?.getAppShareLink) {
    return window.CineAndroid.getAppShareLink();
  }
  return 'https://cinemusic.web.app/download';
}

export function getShareText(song: { title: string; artist: string; id: string; durationMs?: number; cover?: string }):string {
  const url = shareSongLink(song.id);
  const appLink = appShareLink();
  const duration = song.durationMs ? formatDuration(song.durationMs) : '';
  return [
    `${song.title} - ${song.artist}`,
    duration ? `(${duration})` : '',
    '',
    `Listen: ${url}`,
    '',
    '— Sent from Cine Music',
    appLink
  ].filter(Boolean).join('\n');
}

/**
 * Generate Open Graph meta tags for rich link previews (like Spotify)
 * These would be rendered on the server when someone visits the song link
 */
export function getSongOGTags(song: { title: string; artist: string; id: string; cover?: string; durationMs?: number; lyrics?: string }):Record<string, string> {
  const coverUrl = song.cover || `https://music.youtube.com/oembed?url=https://music.youtube.com/watch?v=${song.id}&format=json`;
  const lyricsSnippet = song.lyrics ? getLyricsPreview(song.lyrics, 2).replace(/\n/g, ' ') : '';
  return {
    'og:title': `${song.title} - ${song.artist}`,
    'og:description': lyricsSnippet ? `${lyricsSnippet} ...` : `Listen to ${song.title} by ${song.artist} on Cine Music`,
    'og:image': coverUrl,
    'og:url': 'https://cinemusic.web.app/song/' + song.id,
    'og:type': 'music.song',
    'music:song': 'https://cinemusic.web.app/song/' + song.id,
    'music:artist': song.artist,
    'music:recording_date': new Date().toISOString().split('T')[0],
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
  // Encode lyrics snippet as base64 for URL parameter
  const encoded = btoa(unescape(encodeURIComponent(lyricsSnippet.substring(0, 500)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://cinemusic.web.app/song/${songId}/lyrics?preview=${encoded}`;
}

function formatDuration(ms: number):string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

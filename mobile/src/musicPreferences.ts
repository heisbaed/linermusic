import type { LibraryData, SavedArtist } from './AppContext';

export interface MusicTaste { country: string; genres: string[]; completed: boolean }

// ISO 3166-1 alpha-2, including territories. No country is assumed from a language alone.
export const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
const countries = new Set(COUNTRY_CODES);
export const MUSIC_GENRES = [
  { id: 'afrobeats', label: 'Afrobeats' }, { id: 'amapiano', label: 'Amapiano' },
  { id: 'bongo-flava', label: 'Bongo Flava' }, { id: 'hip-hop', label: 'Hip-Hop' },
  { id: 'rnb', label: 'R&B' }, { id: 'pop', label: 'Pop' },
  { id: 'soul', label: 'Soul' }, { id: 'gospel', label: 'Gospel' },
  { id: 'reggae', label: 'Reggae' }, { id: 'dancehall', label: 'Dancehall' },
  { id: 'electronic', label: 'Electronic' }, { id: 'house', label: 'House' },
  { id: 'rock', label: 'Rock' }, { id: 'indie', label: 'Indie' },
  { id: 'jazz', label: 'Jazz' }, { id: 'classical', label: 'Classical' },
  { id: 'country', label: 'Country' }, { id: 'folk', label: 'Folk' },
  { id: 'latin', label: 'Latin' }, { id: 'k-pop', label: 'K-Pop' },
  { id: 'j-pop', label: 'J-Pop' }, { id: 'bollywood', label: 'Bollywood' },
  { id: 'arabic', label: 'Arabic' }, { id: 'metal', label: 'Metal' },
] as const;
const genreIds = new Set<string>(MUSIC_GENRES.map(genre => genre.id));
export const genreLabel = (id: string) => MUSIC_GENRES.find(genre => genre.id === id)?.label || id;
export function normalizeCountry(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return countries.has(code) ? code : '';
}
export function normalizeTaste(value: unknown): MusicTaste {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const country = normalizeCountry(source.country);
  const input = Array.isArray(source.genres) ? source.genres : source.genres && typeof source.genres === 'object' ? Object.values(source.genres) : [];
  const genres = [...new Set(input.filter((item): item is string => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(item => genreIds.has(item)))].slice(0, 8);
  return { country, genres, completed: Boolean(country && source.completed === true) };
}

export function applyMusicPreferences(library: LibraryData, taste: MusicTaste, selectedArtists: SavedArtist[], originalArtistIds: string[]): LibraryData {
  const normalized = normalizeTaste({ ...taste, completed: true });
  if (!normalized.completed) throw new Error('Choose a country or region before continuing.');
  const selected = new Map(selectedArtists.map(artist => [artist.id, artist]));
  const original = new Set(originalArtistIds);
  // Keep follows added elsewhere while this form was open; remove only explicit deselections.
  const artists = new Map(library.artists.filter(artist => !original.has(artist.id) || selected.has(artist.id)).map(artist => [artist.id, artist]));
  selected.forEach((artist, id) => artists.set(id, artist));
  return { ...library, taste: normalized, artists: [...artists.values()] };
}
export function countryName(code: string, locale = 'en'): string {
  if (!normalizeCountry(code)) return '';
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(code) || code; }
  catch { return code; }
}
export function suggestCountry(): { country: string; source: 'device' | 'language' | 'none' } {
  try {
    const country = normalizeCountry(window.CineAndroid?.countryCode?.());
    if (country) return { country, source: 'device' };
  } catch { /* Region suggestions are optional, not an access or permission check. */ }
  const locales = typeof navigator === 'undefined' ? [] : [...navigator.languages || [], navigator.language];
  for (const locale of locales) {
    try { const country = normalizeCountry(new Intl.Locale(locale).region); if (country) return { country, source: 'language' }; }
    catch { /* Try the next device language. */ }
  }
  return { country: '', source: 'none' };
}
export function recommendationQueries(taste: MusicTaste, artists: SavedArtist[]): string[] {
  const region = countryName(normalizeCountry(taste.country) || suggestCountry().country);
  const genres = normalizeTaste(taste).genres.slice(0, 2).map(genreLabel).join(' ');
  const followed = artists.slice(0, 2).map(artist => artist.name.slice(0, 80)).join(' ');
  return [
    [region, genres, 'music playlists'].filter(Boolean).join(' '),
    [region, followed || genres, 'albums'].filter(Boolean).join(' '),
  ];
}
export function recommendationIdentity(owner: string, taste: MusicTaste, artists: SavedArtist[]): string {
  return JSON.stringify([owner, normalizeCountry(taste.country) || suggestCountry().country, normalizeTaste(taste).genres, artists.slice(0, 2).map(artist => [artist.id, artist.name])]);
}

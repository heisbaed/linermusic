import { postInnertube } from '@/shared/media/innertube/innertubeClient';
import { collectByKey, asRecord } from '@/shared/utils/json';
import { getText } from '@/shared/media/innertube/innertubeJson';
import { searchText } from './catalogQuality';

export function parseSuggestions(body: unknown): string[] {
  const seen = new Set<string>();
  return collectByKey(body, 'searchSuggestionRenderer').flatMap(raw => {
    const text = getText(asRecord(raw)?.suggestion);
    if (!text || text.length > 160 || seen.has(searchText(text))) return [];
    seen.add(searchText(text)); return [text];
  }).slice(0, 8);
}
const cache = new Map<string, string[]>();
export async function suggestMusic(query: string, signal: AbortSignal): Promise<string[]> {
  const key = searchText(query);
  if (key.length < 2) return [];
  if (cache.has(key)) return cache.get(key)!;
  const result = parseSuggestions(await postInnertube('music/get_search_suggestions', { input: query }, { signal }));
  if (signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
  cache.set(key, result); if (cache.size > 40) cache.delete(cache.keys().next().value!);
  return result;
}
export function mergeSuggestions(query: string, remote: string[], local: string[]): string[] {
  const key = searchText(query), seen = new Set([key]);
  return [...local.filter(text => searchText(text).includes(key)), ...remote].flatMap(text => {
    const normalized = searchText(text); if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized); return [text];
  }).slice(0, 6);
}

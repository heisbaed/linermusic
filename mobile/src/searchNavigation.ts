// Keep navigation requests until the destination has mounted. Events alone
// are lost when a different tab is still being rendered.
let pending = '';
export function requestMusicSearch(query: string) {
  pending = query.trim().slice(0, 160);
  window.dispatchEvent(new Event('cine:pending-search'));
}
export function consumeMusicSearch(): string {
  const query = pending;
  pending = '';
  return query;
}

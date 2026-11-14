const DATABASE = 'https://cinemusic-1-default-rtdb.firebaseio.com';
export const TV_ORIGIN = 'https://cinemusic.web.app';
const LINK_ID = /^[a-f0-9]{32}$/;
const TTL = 5 * 60 * 1000;

export interface TvLink { id: string; mode: 'link' | 'search' }
export interface TvSession {
  id: string;
  expiresAt: number;
  read: (signal?: AbortSignal) => Promise<Record<string, unknown> | null>;
  close: () => Promise<void>;
}

function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}
export function parseTvLink(input: string | URL): TvLink | null {
  try {
    const url = new URL(input);
    const mode = url.searchParams.get('mode'), id = url.searchParams.get('id');
    return id && LINK_ID.test(id) && (mode === 'link' || mode === 'search') ? { id, mode } : null;
  } catch { return null; }
}
export function tvLink({ id, mode }: TvLink) {
  return TV_ORIGIN + '/tv-connect?mode=' + mode + '&id=' + id;
}
async function request(link: TvLink, child = '', token = '', init: RequestInit = {}) {
  if (!LINK_ID.test(link.id)) throw new Error('Invalid TV link.');
  const path = link.mode === 'link' ? 'tvLinkV2' : 'tvSearchV2';
  const auth = token ? '?auth=' + encodeURIComponent(token) : '';
  const response = await fetch(`${DATABASE}/${path}/${link.id}${child}.json${auth}`, {
    ...init, cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('This TV link is unavailable. Scan a new code on your TV.');
  return response.json();
}
function change(method: 'PUT' | 'DELETE', value?: unknown, signal?: AbortSignal): RequestInit {
  return { method, body: value === undefined ? undefined : JSON.stringify(value), signal };
}
const algorithm = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
function encode(bytes: ArrayBuffer | Uint8Array) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function decode(value: string) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }

export async function openTvLink(signal: AbortSignal) {
  const pair = await crypto.subtle.generateKey({ ...algorithm, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, false, ['encrypt', 'decrypt']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const link = { mode: 'link', id: newId() } as const;
  const expiresAt = Date.now() + TTL;
  await request(link, '', '', change('PUT', { expiresAt, n: jwk.n, e: jwk.e }, signal));
  return {
    id: link.id, expiresAt,
    async receive(signal?: AbortSignal) {
      const packet = await request(link, '', '', { signal });
      const reply = packet?.reply;
      if (!reply) return null;
      const rawKey = await crypto.subtle.decrypt(algorithm, pair.privateKey, decode(reply.key));
      const aes = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
      const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(reply.iv) }, aes, decode(reply.data));
      const result = JSON.parse(new TextDecoder().decode(bytes)) as { linkId?: string; uid?: string; refreshToken?: string };
      if (result.linkId !== link.id || reply.uid !== result.uid || !result.refreshToken || !result.uid) throw new Error('TV approval could not be verified.');
      return { uid: result.uid, refreshToken: result.refreshToken };
    },
  };
}

export async function approveTvLink(link: TvLink, user: { localId: string; idToken: string; refreshToken: string }) {
  if (link.mode !== 'link') throw new Error('Invalid sign-in link.');
  const info = await request(link);
  if (!info?.n || !info.e || info.expiresAt <= Date.now() || info.reply) throw new Error('Scan a new sign-in code on your TV.');
  const pub = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: info.n, e: info.e }, algorithm, false, ['encrypt']);
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new TextEncoder().encode(JSON.stringify({ linkId: link.id, uid: user.localId, refreshToken: user.refreshToken }));
  const [wrapped, encrypted] = await Promise.all([
    crypto.subtle.exportKey('raw', aes).then(raw => crypto.subtle.encrypt(algorithm, pub, raw)),
    crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, body),
  ]);
  await request(link, '/reply', user.idToken, change('PUT', {
    uid: user.localId, key: encode(wrapped), iv: encode(iv), data: encode(encrypted),
  }));
}

export async function openTvSearch(uid: string, token: () => Promise<string>, signal: AbortSignal): Promise<TvSession> {
  const link = { id: newId(), mode: 'search' } as const;
  const expiresAt = Date.now() + TTL;
  await request(link, '', await token(), change('PUT', { expiresAt, uid }, signal));
  return {
    id: link.id, expiresAt,
    read: async signal => request(link, '/query', await token(), { signal }),
    close: async () => { await request(link, '', await token(), change('DELETE')); },
  };
}
export async function sendTvSearch(link: TvLink, token: string, value: string) {
  const text = value.trim();
  if (link.mode !== 'search' || !text || text.length > 120) throw new Error('Enter a search of up to 120 characters.');
  await request(link, '/query', token, change('PUT', { text, id: newId() }));
}

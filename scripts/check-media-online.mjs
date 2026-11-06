import assert from 'node:assert/strict';

// Public, anonymous requests only. No cookies, Firebase tokens or signed URLs are logged.
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const profiles = {
  vr: { name: 'ANDROID_VR', version: '1.65.10', header: '28', origin: 'https://www.youtube.com', ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip', extra: { osName: 'Android', osVersion: '12L', deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32 } },
  visionLegacy: { name: 'VISIONOS', version: '1.04', header: '101', origin: 'https://music.youtube.com', ua: 'com.google.visionos.youtube/1.04(RealityDevice17,1; U; CPU visionOS 26_6_0 like Mac OS X; en_US)', extra: { osName: 'visionOS', osVersion: '26.6.0.23O770', deviceMake: 'Apple', deviceModel: 'RealityDevice17,1', platform: 'MOBILE' } },
  vision: { name: 'VISIONOS', version: '1.02', header: '101', origin: 'https://www.youtube.com', ua: DESKTOP_UA, extra: { osName: 'visionOS', osVersion: '26.5.23O471', deviceMake: 'Apple', deviceModel: 'RealityDevice17,1' } },
  ios: { name: 'IOS', version: '21.26.4', header: '5', origin: 'https://www.youtube.com', ua: 'com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)', extra: { osName: 'iPhone', osVersion: '18.3.2.22D82', deviceMake: 'Apple', deviceModel: 'iPhone16,2' } },
};
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const report = { checkedAt: new Date().toISOString(), requests: 0, sentBytes: 0, receivedBytes: 0, mediaByteCap: 4096, metadataByteCap: 2_000_000, credentialsUsed: false, checks: [] };
const legacyRequest = process.argv.includes('--legacy-request');

function allowed(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
      && (['www.youtube.com', 'music.youtube.com'].includes(url.hostname) || url.hostname.endsWith('.googlevideo.com'));
  } catch { return false; }
}
function safeReason(value) { return String(value || '').replace(/https?:\/\/\S+/g, '[source URL omitted]').replace(/[\r\n\t]+/g, ' ').slice(0, 240); }
async function request(value, { body, headers = {}, cap = report.metadataByteCap, partial = false } = {}, redirects = 0) {
  const started = performance.now();
  if (!allowed(value)) throw new Error('Untrusted source address');
  const encoded = body ? JSON.stringify(body) : undefined;
  report.requests += 1; report.sentBytes += Buffer.byteLength(encoded || '');
  const response = await fetch(value, { method: body ? 'POST' : 'GET', body: encoded, headers: { 'User-Agent': DESKTOP_UA, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(15_000) });
  const firstByteMs = Math.round(performance.now() - started);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    await response.body?.cancel();
    if (body || redirects >= 3 || !response.headers.get('location')) throw new Error(`Source redirect HTTP ${response.status}`);
    return request(new URL(response.headers.get('location'), value).href, { headers, cap, partial }, redirects + 1);
  }
  const chunks = []; let size = 0;
  const reader = response.body?.getReader();
  try {
    while (reader) {
      const { value: chunk, done } = await reader.read();
      if (done) break;
      report.receivedBytes += chunk.byteLength;
      if (size + chunk.byteLength > cap && !partial) throw new Error('Source response exceeded byte cap');
      chunks.push(chunk.subarray(0, cap - size)); size += Math.min(chunk.byteLength, cap - size);
      if (size >= cap) break;
    }
  } finally { await reader?.cancel().catch(() => {}); }
  return { response, bytes: Buffer.concat(chunks), size, firstByteMs, elapsedMs: Math.round(performance.now() - started) };
}
function parseVisitor(text) {
  try {
    const parsed = JSON.parse(text.startsWith(")]}'") ? text.slice(text.indexOf('\n') + 1) : text);
    const value = parsed?.[0]?.[2]?.[0]?.[0]?.[13];
    if (typeof value === 'string' && /^Cg[s-v][A-Za-z0-9_%=-]{20,}$/.test(value)) return value;
  } catch { /* Use the upstream's fallback for minor service-worker schema changes. */ }
  return text.match(/Cg[s-v][A-Za-z0-9_-]{20,}(?:%3D|=){0,2}/)?.[0] || '';
}
async function warm() {
  const { response, bytes, size, firstByteMs, elapsedMs } = await request('https://www.youtube.com/sw.js_data');
  const visitor = response.ok ? parseVisitor(bytes.toString('utf8')) : '';
  const check = { stage: 'anonymous visitor warm', http: response.status, bytes: size, visitorPresent: Boolean(visitor), firstByteMs, elapsedMs };
  report.checks.push(check); console.log(JSON.stringify(check));
  return visitor;
}
async function searchTrack(query, visitor) {
  const { response, bytes, size } = await request('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    headers: { 'X-YouTube-Client-Name': '67', 'X-YouTube-Client-Version': '1.20260911.08.00', ...(visitor ? { 'X-Goog-Visitor-Id': visitor } : {}) },
    body: { query, params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D', context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20260911.08.00', hl: 'en', gl: 'TZ', ...(visitor ? { visitorData: visitor } : {}) } } },
  });
  if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
  const data = JSON.parse(bytes.toString('utf8'));
  const found = new Map();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    const renderer = value.musicResponsiveListItemRenderer;
    const id = renderer?.playlistItemData?.videoId;
    const title = renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(run => run.text).join('');
    if (/^[A-Za-z0-9_-]{11}$/.test(id || '') && title) found.set(id, { id, title: safeReason(title) });
    for (const child of Object.values(value)) walk(child);
  }
  walk(data);
  const tracks = [...found.values()].slice(0, 3);
  const check = { stage: 'public catalog search', query, http: response.status, bytes: size, tracks };
  report.checks.push(check); console.log(JSON.stringify(check));
  return tracks[0];
}
async function probe(id, profileKey, visitor) {
  const profile = profiles[profileKey];
  if (!profile) throw new Error('Unknown profile');
  const client = { clientName: profile.name, clientVersion: profile.version, hl: 'en', gl: option('gl', legacyRequest ? 'US' : 'TZ'), userAgent: profile.ua, ...profile.extra, ...(visitor ? { visitorData: visitor } : {}), ...(!legacyRequest && profileKey === 'vr' ? { buildId: 'SQ3A.220605.009.A1', packageName: 'com.google.android.apps.youtube.vr.oculus' } : {}) };
  const { response, bytes, size, firstByteMs, elapsedMs } = await request(`${profile.origin}/youtubei/v1/player?prettyPrint=false`, {
    headers: { 'User-Agent': profile.ua, 'X-YouTube-Client-Name': profile.header, 'X-YouTube-Client-Version': profile.version, Origin: profile.origin, Referer: profile.origin + '/', ...(visitor ? { 'X-Goog-Visitor-Id': visitor } : {}) },
    body: { videoId: id, ...(legacyRequest ? { contentCheckOk: true, racyCheckOk: true } : {}), context: { client, user: { lockedSafetyMode: false } } },
  });
  const data = JSON.parse(bytes.toString('utf8'));
  const formats = data.streamingData?.adaptiveFormats || [];
  const audio = formats.filter(format => format.mimeType?.startsWith('audio/'));
  const direct = audio.filter(format => allowed(format.url) && new URL(format.url).hostname.endsWith('.googlevideo.com') && new URL(format.url).pathname === '/videoplayback' && !format.drmFamilies?.length && !format.drmTrackType);
  const selected = direct.find(format => format.itag === 140) || direct.find(format => format.itag === 139) || direct[0];
  const check = { stage: 'player', id, profile: profileKey, version: profile.version, visitorPresent: Boolean(visitor), http: response.status, bytes: size, status: data.playabilityStatus?.status, reason: safeReason(data.playabilityStatus?.reason), videoIdMatches: data.videoDetails?.videoId === id, ageRestricted: Boolean(data.videoDetails?.isAgeRestricted), directAudio: direct.length, cipherAudio: audio.filter(format => format.signatureCipher || format.cipher).length, hlsPresent: Boolean(data.streamingData?.hlsManifestUrl), formats: audio.map(format => ({ itag: format.itag, mime: format.mimeType, direct: Boolean(format.url), cipher: Boolean(format.signatureCipher || format.cipher), drm: Boolean(format.drmFamilies?.length) })) };
  if (selected && data.playabilityStatus?.status === 'OK' && data.videoDetails?.videoId === id && !data.videoDetails?.isAgeRestricted && !data.streamingData?.licenseInfos?.length) {
    const media = new URL(selected.url);
    media.searchParams.set('range', `0-${report.mediaByteCap - 1}`);
    const sample = await request(media.href, { headers: { Range: `bytes=0-${report.mediaByteCap - 1}`, 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.youtube.com/' }, cap: report.mediaByteCap, partial: true });
    const mime = sample.response.headers.get('content-type') || '';
    const header = sample.bytes.subarray(0, 12);
    const recognizedAudio = header.subarray(4, 8).toString('ascii') === 'ftyp' || header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    check.media = { http: sample.response.status, mime, bytes: sample.size, itag: selected.itag, recognizedAudio, playableSample: sample.response.ok && mime.startsWith('audio/') && recognizedAudio, firstByteMs: sample.firstByteMs, elapsedMs: sample.elapsedMs };
  }
  check.firstByteMs = firstByteMs;
  check.elapsedMs = elapsedMs;
  if (check.media) check.elapsedMs += check.media.elapsedMs || 0;
  report.checks.push(check);
  console.log(JSON.stringify(check));
}

if (process.argv.includes('--self-test')) {
  assert(allowed('https://rr1.googlevideo.com/videoplayback'));
  for (const url of ['https://evilgooglevideo.com/a', 'http://rr1.googlevideo.com/a', 'https://rr1.googlevideo.com:444/a', 'https://u:p@rr1.googlevideo.com/a', 'https://www.youtube.com.evil/a']) assert(!allowed(url));
  const visitor = 'Cgtabcdefghijklmnopqrstuv%3D%3D';
  assert.equal(parseVisitor(`prefix ${visitor}`), visitor);
  assert.equal(parseVisitor('no visitor'), '');
  assert.equal(safeReason('failure https://example.invalid/token?a=b\nnext'), 'failure [source URL omitted] next');
  console.log('Media probe safety self-tests passed. No network requests made.');
} else {
  const ids = option('tracks', 'S0pnaaR2X3Q,JGwWNGJdvx8,dQw4w9WgXcQ').split(',');
  if (ids.length > 5 || ids.some(id => !/^[A-Za-z0-9_-]{11}$/.test(id))) throw new Error('Expected at most five public video IDs');
  const keys = option('profiles', 'vision,visionLegacy,vr').split(',');
  if (keys.length > 4 || keys.some(key => !profiles[key])) throw new Error('Expected at most four known probe profiles');
  const visitor = option('session', 'warm') === 'cold' ? '' : await warm();
  if (process.argv.includes('--search')) {
    const track = await searchTrack(option('query', 'mtu mzima'), visitor);
    if (track && !ids.includes(track.id) && ids.length < 5) ids.push(track.id);
  }
  for (const id of ids) for (const key of keys) {
    try { await probe(id, key, visitor); }
    catch (error) { const check = { stage: 'player', id, profile: key, error: error.cause?.code || error.code || safeReason(error.message) }; report.checks.push(check); console.log(JSON.stringify(check)); }
  }
  report.passed = ids.every(id => report.checks.some(check => check.id === id && check.media?.playableSample));
  const { checks, ...summary } = report;
  console.log(JSON.stringify(process.argv.includes('--json') ? report : { ...summary, playerChecks: checks.filter(check => check.stage === 'player').length, playableSamples: checks.filter(check => check.media?.playableSample).length }, null, 2));
  if (!report.passed) process.exitCode = 1;
}

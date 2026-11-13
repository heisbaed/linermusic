// Localhost-only test fixture. Never imported by the app or packaged into Android.
export function installFixture() {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost):/.test(location.origin)) return;
  const art = (first, last, label) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 320;
    const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 280, 320);
    gradient.addColorStop(0, first); gradient.addColorStop(1, last); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 320, 320);
    ctx.strokeStyle = '#ffffff60'; ctx.lineWidth = 2;
    for (let index = 0; index < 10; index++) { ctx.beginPath(); ctx.ellipse(210, 88, 38 + index * 13, 150, .65, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#ffffffd9'; ctx.font = '500 13px sans-serif'; ctx.fillText('CINE / UI TEST FIXTURE', 22, 30); ctx.font = '500 30px sans-serif'; ctx.fillText(label, 22, 281);
    return canvas.toDataURL('image/jpeg', .7);
  };
  const covers = [art('#315360', '#152133', 'AFTER HOURS'), art('#896b4f', '#292238', 'QUIET MOTION'), art('#456d66', '#152d39', 'SOFT FOCUS'), art('#5b4287', '#171b32', 'SLOW CIRCLES')];
  const songs = ['Night drive', 'Quiet motion', 'Soft focus', 'Slow circles', 'Blue hour', 'Morning light'].map((title, index) => ({ id: `UITEST0000${index + 1}`, title, artist: index % 2 ? 'Mira West' : 'The Night Current', artistId: 'UC_UI_ARTIST', albumId: 'MPRE_UI_ALBUM', durationMs: 183_000 + index * 7_000, cover: covers[index % 4] }));
  const saved = { favorites: songs.slice(1, 3), recent: songs.slice(0, 3), playlists: [{ id: 'ui-owned', name: 'After hours', description: 'A private listening space. Test-only tracks, no audio.', cover: covers[0], songs: songs.slice(0, 4), isPublic: false }], artists: [{ id: 'UC_UI_ARTIST', name: 'The Night Current', cover: covers[0] }], albums: [{ id: 'MPRE_UI_ALBUM', title: 'Quiet motion', artist: 'Mira West', cover: covers[1] }, { id: 'MPRE_UI_SECOND', title: 'Soft focus', artist: 'The Night Current', cover: covers[2] }], history: [{ query: 'Quiet motion' }], profile: { name: 'Cine listener', username: 'test_listener' }, taste: { country: 'TZ', genres: ['afrobeats'], completed: true } };
  const user = (id = 'ui-verified-user', verified = true) => ({ localId: id, email: 'ui-test@example.invalid', displayName: 'Cine listener', idToken: 'fixture-token-' + id, refreshToken: 'fixture-refresh-' + id, expiresAt: Date.now() + 3_600_000, emailVerified: verified });
  const mode = new URL(location.href).searchParams.get('ui-fixture');
  if (mode === 'signed-out') sessionStorage.setItem('cine-ui-auth', 'null');
  else if (mode === 'no-region') sessionStorage.setItem('cine-ui-auth', JSON.stringify(user('ui-no-region-user')));
  else if (mode === 'unverified') sessionStorage.setItem('cine-ui-auth', JSON.stringify(user('ui-unverified-user', false)));
  else if (mode === 'app' || !sessionStorage.getItem('cine-ui-auth')) sessionStorage.setItem('cine-ui-auth', JSON.stringify(user()));
  if (!localStorage.getItem('cine:ui-fixture-seeded')) {
    localStorage.setItem('cine:library-v3:user:ui-verified-user', JSON.stringify(saved));
    const wire = { ...saved };
    for (const field of ['favorites', 'playlists', 'artists', 'albums']) wire[field] = Object.fromEntries(saved[field].map(item => [encodeURIComponent(item.id), item]));
    localStorage.setItem('cine:ui-cloud:ui-verified-user', JSON.stringify(wire));
    // Legacy keys are intentionally also present to catch accidental data resets.
    for (const key of ['favorites', 'recent', 'playlists']) localStorage.setItem('cine:' + key, JSON.stringify(saved[key]));
    localStorage.setItem('cine:cine-theme-v2', JSON.stringify('default'));
    localStorage.setItem('cine:lyrics:' + songs[0].id, JSON.stringify('[00:00.00]The city settles into quiet\n[00:12.00]We find a rhythm of our own\n[00:30.00]The light is changing slowly\n[00:50.00]A little further from the noise'));
    localStorage.setItem('cine:ui-fixture-seeded', 'true');
  }
  const thumb = url => ({ musicThumbnailRenderer: { thumbnail: { thumbnails: [{ url, width: 320, height: 320 }] } } });
  const endpoint = (id, type) => ({ browseEndpoint: { browseId: id, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: `MUSIC_PAGE_TYPE_${type}` } } } });
  const run = (text, id, type) => ({ text, navigationEndpoint: endpoint(id, type) });
  const column = runs => ({ musicResponsiveListItemFlexColumnRenderer: { text: { runs } } });
  const track = song => ({ musicResponsiveListItemRenderer: { playlistItemData: { videoId: song.id }, flexColumns: [column([{ text: song.title }]), column([run(song.artist, song.artistId, 'ARTIST'), { text: ' · ' }, run('Quiet motion', song.albumId, 'ALBUM'), { text: ' · ' }, { text: '3:12' }])], thumbnail: thumb(song.cover) } });
  const catalogRow = (title, id, type, cover) => ({ musicResponsiveListItemRenderer: { navigationEndpoint: endpoint(id, type), flexColumns: [column([{ text: title }]), column(type === 'ALBUM' ? [run('Mira West', 'UC_UI_ARTIST', 'ARTIST'), { text: '2026' }] : [{ text: type === 'PLAYLIST' ? 'Cine editorial fixture' : 'Artist' }])], thumbnail: thumb(cover) } });
  const genreArtists = ['Burna Boy', 'SZA', 'Dua Lipa', 'Kendrick Lamar'];
  const regionalNames = ['The Night Current', 'Mira West', 'Aya Stone', 'Kito', 'Nia Coast', 'Juniper'];
  const regionalId = name => name === regionalNames[0] ? 'UC_UI_ARTIST' : 'UC_UI_REGIONAL_' + regionalNames.indexOf(name);
  const searchBody = query => ({ contents: { tabbedSearchResultsRenderer: { tabs: [{ tabRenderer: { content: { sectionListRenderer: { contents: [{ musicShelfRenderer: { contents: /fixture nothing/i.test(query) ? [] : regionalNames.includes(query) ? [catalogRow(query, regionalId(query), 'ARTIST', 'https://cine-art-fixture.invalid/genre-' + regionalNames.indexOf(query) % 4 + '.jpg')] : genreArtists.includes(query) ? [catalogRow(query, 'UC_UI_GENRE_' + genreArtists.indexOf(query), 'ARTIST', 'https://cine-art-fixture.invalid/genre-' + genreArtists.indexOf(query) + '.jpg')] : [catalogRow('After hours', 'PL_UI_EDITORIAL', 'PLAYLIST', covers[0]), catalogRow('The Night Current', 'UC_UI_ARTIST', 'ARTIST', 'https://cine-art-fixture.invalid/genre-0.jpg'), ...songs.slice(0, 4).map(track), catalogRow('Quiet motion', 'MPRE_UI_ALBUM', 'ALBUM', covers[1]), catalogRow('Soft focus', 'MPRE_UI_SECOND', 'ALBUM', covers[2])] } }] } } } }] } } });
  const browseBody = id => id.startsWith('UC') ? { header: { musicImmersiveHeaderRenderer: { title: { simpleText: 'The Night Current' }, thumbnail: thumb(covers[0]), monthlyListenerCount: { simpleText: '12,345' } } }, contents: songs.slice(0, 4).map(track) } : { header: { musicResponsiveHeaderRenderer: { title: { simpleText: id.startsWith('VL') ? 'After hours' : 'Quiet motion' }, straplineTextOne: { runs: [run('Mira West', 'UC_UI_ARTIST', 'ARTIST')] }, subtitle: { runs: [{ text: '2026' }] }, secondSubtitle: { simpleText: '4 tracks' }, thumbnail: thumb(id.startsWith('VL') ? covers[0] : covers[1]), description: { simpleText: 'Test-only local catalog response. No external data or audio.' } } }, contents: songs.slice(0, 4).map(track) };
  let player = { track: songs[0], status: 'paused', positionMs: 23_000, durationMs: songs[0].durationMs, queue: songs.slice(0, 4), shuffle: false, repeat: 'off', output: 'UI fixture (no audio)' };
  let jobs = songs.slice(2).map((song, index) => ({ id: song.id, track: song, status: ['downloading', 'paused', 'queued', 'failed'][index], progress: [37, 18, 0, 9][index], bytes: 0, totalBytes: 0, restartOnResume: true, ...(index === 3 ? { error: 'Test-only interrupted connection' } : {}) }));
  const requests = new Map(); let eventId = 0;
  const streams = new Set();
  const cloud = id => JSON.parse(localStorage.getItem('cine:ui-cloud:' + id) || 'null');
  if (mode === 'no-region') { Object.defineProperty(navigator, 'languages', { value: ['en'], configurable: true }); Object.defineProperty(navigator, 'language', { value: 'en', configurable: true }); }
  const fixture = window.__cineUi = { songs, covers, requests: [], plays: [], controls: [], downloads: [], cancellations: [], failSearch: false, failRegional: false, authSuccess: true, loginId: 'ui-new-user', backgrounded: 0, onboardingSeen: false, library: () => JSON.parse(localStorage.getItem('cine:library-v3:user:' + JSON.parse(sessionStorage.getItem('cine-ui-auth')).localId)), cloud };
  new MutationObserver(() => { if (document.querySelector('.music-onboarding')) fixture.onboardingSeen = true; }).observe(document, { childList: true, subtree: true });
  window.EventSource = class {
    constructor(url) { this.url = url; this.handlers = new Map(); streams.add(this); setTimeout(() => { if (!streams.has(this)) return; this.onopen?.(); this.emit('put', { path: '/', data: cloud(this.owner()) }); }, 15); }
    owner() { return new URL(this.url).pathname.split('/')[2]; }
    addEventListener(type, listener) { this.handlers.set(type, [...this.handlers.get(type) || [], listener]); }
    emit(type, data) { for (const listener of this.handlers.get(type) || []) listener(new MessageEvent(type, { data: JSON.stringify(data) })); }
    close() { streams.delete(this); }
  };
  const publish = (type, data) => window.__cineChunk?.('ui-fixture-' + ++eventId, JSON.stringify({ type, data }), true);
  const emitPlayer = () => publish('player', player), emitJobs = () => publish('downloadJobs', { items: jobs });
  window.CineAndroid = {
    snapshot: () => JSON.stringify(player), ready: () => queueMicrotask(emitPlayer), background() { fixture.backgrounded++; }, setSystemBars() {}, countryCode: () => mode === 'no-region' ? '' : 'TZ', authTokens: () => sessionStorage.getItem('cine-ui-auth') || 'null', saveAuthTokens(encoded) { sessionStorage.setItem('cine-ui-auth', encoded); }, clearAuthTokens() { sessionStorage.setItem('cine-ui-auth', 'null'); }, configureDownloads() {}, isWifiConnected: () => true,
    downloads: () => '[]', downloadJobs: () => JSON.stringify(jobs),
    request(id, encoded) {
      const options = JSON.parse(encoded), body = JSON.parse(options.body || '{}'); fixture.requests.push({ url: options.url, body });
      let data = {}, status = 200;
      if (options.url.includes('/youtubei/v1/search')) { data = searchBody(body.query || ''); if (fixture.failSearch || /fixture failure/i.test(body.query || '')) status = 503; }
      else if (options.url.includes('/youtubei/v1/browse')) data = browseBody(body.browseId);
      else if (options.url.startsWith('https://musicbrainz.org/ws/2/artist/')) {
        if (fixture.failRegional) status = 503;
        const region = new URL(options.url).searchParams.get('query')?.match(/country:([A-Z]{2})/)?.[1];
        data = { artists: region ? regionalNames.map((name, index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`, name, country: region, 'life-span': { ended: false } })) : [] };
      }
      else if (options.url.includes('/library.json')) {
        const owner = new URL(options.url).pathname.split('/')[2]; data = cloud(owner);
        if (options.method === 'PATCH') {
          data ||= {};
          for (const [key, value] of Object.entries(body)) { const keys = key.split('/'); let parent = data; for (const part of keys.slice(0, -1)) parent = parent[part] ||= {}; if (value === null) delete parent[keys.at(-1)]; else parent[keys.at(-1)] = value; }
          localStorage.setItem('cine:ui-cloud:' + owner, JSON.stringify(data));
          for (const stream of streams) if (stream.owner() === owner) stream.emit('patch', { path: '/', data: body });
        }
      }
      else if (options.url.includes('/youtubei/v1/next')) data = { contents: { singleColumnMusicWatchNextResultsRenderer: { playlistPanelRenderer: { contents: songs.map(song => ({ playlistPanelVideoRenderer: { videoId: song.id, title: { simpleText: song.title }, navigationEndpoint: { watchEndpoint: { watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: 'MUSIC_VIDEO_TYPE_ATV' } } } }, longBylineText: { runs: [run(song.artist, song.artistId, 'ARTIST')] }, lengthText: { simpleText: '3:12' }, thumbnail: { thumbnails: [{ url: song.cover, width: 320, height: 320 }] } } })) } } } };
      else if (options.url.includes('accounts:signInWithPassword')) data = { ...user(fixture.loginId), expiresIn: '3600' };
      else if (options.url.includes('accounts:lookup')) { const id = String(body.idToken).replace('fixture-token-', ''); data = { users: [user(id, id !== 'ui-unverified-user')] }; }
      else if (options.url.includes('accounts:signUp')) data = { localId: 'ui-signup-user', email: body.email, idToken: 'fixture-id-token', refreshToken: 'fixture-refresh-token', expiresIn: '3600' };
      else if (options.url.includes('accounts:update')) { const id = String(body.idToken).replace('fixture-token-', ''); data = { ...user(id), expiresIn: '3600', displayName: body.displayName }; }
      else if (options.url.includes('accounts:sendOobCode')) { status = fixture.authSuccess ? 200 : 503; data = status === 200 ? { email: body.email } : { error: { message: 'INTERNAL_ERROR' } }; }
      else status = 503;
      const timer = setTimeout(() => { requests.delete(id); const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data)))); publish('http', { id, status, headers: { 'content-type': 'application/json' }, body: payload }); }, options.url.includes('/library.json') && options.method !== 'PATCH' ? 400 : /fixture stale/i.test(body.query || '') ? 500 : 30);
      requests.set(id, timer);
    },
    cancel(id) { fixture.cancellations.push(id); clearTimeout(requests.get(id)); requests.delete(id); },
    queue(encoded, shuffle, repeat) { player = { ...player, queue: JSON.parse(encoded), shuffle, repeat }; emitPlayer(); },
    play(encoded) { const song = JSON.parse(encoded); fixture.plays.push(song); player = { ...player, track: song, queue: song.queue || player.queue, status: 'paused', durationMs: song.durationMs, positionMs: 0 }; emitPlayer(); },
    control(action, value) { fixture.controls.push(action); if (action === 'seek') player.positionMs = value; if (action === 'pause') player.status = 'paused'; if (action === 'resume') player.status = 'playing'; if (action === 'stop') player = { ...player, track: null, status: 'idle', positionMs: 0 }; emitPlayer(); },
    download(encoded) { fixture.downloads.push(JSON.parse(encoded)); }, removeDownload() {},
    pauseDownload(id) { jobs = jobs.map(job => job.id === id ? { ...job, status: 'paused' } : job); emitJobs(); },
    resumeDownload(id) { jobs = jobs.map(job => job.id === id ? { ...job, status: 'queued', progress: 0 } : job); emitJobs(); },
    cancelDownload(id) { jobs = jobs.filter(job => job.id !== id); emitJobs(); },
    sleepTimer() {}, configureEqualizer: () => false, openMediaOutputPanel() {}, openNotificationSettings() {}, openExternal() {}, share() {},
  };
}


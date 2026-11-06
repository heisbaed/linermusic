import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { swipeDirection,type SwipePoint } from './playerGestures';
import { useApp, type Utility } from './AppContext';
import { Icon } from './Icons';
import { Action, Brand, ConfirmDialog, Cover, Notice, Sheet, ThemeEdition } from './ui';
import { formatTime, loadSaved, parseLrc, save, addToPlaylist } from './library';
import { isAndroid, sleepTimer, snapshot, subscribe } from './native';
import { innertubeCatalog } from '@/shared/media/innertube/innertubeCatalog';
import type { Song } from './types';
import { songLink } from './songLinks';
import './player.css';

const lyricRequests = new Map<string, Promise<Response>>();
function requestLyrics(url: string): Promise<Response> {
  let pending = lyricRequests.get(url);
  if (!pending) {
    pending = fetch(url).finally(() => lyricRequests.delete(url));
    lyricRequests.set(url, pending);
  }
  return pending.then(response => response.clone());
}

export function useLyrics(track: Song | null, enabled: boolean) {
  const [result, setResult] = useState({ id: '', text: '', status: 'idle', error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!track || !enabled) return;
    const controller = new AbortController();
    const cached = loadSaved<string | { text: string; savedAt: number } | null>('lyrics:' + track.id, null);
    const text = typeof cached === 'string' ? cached : cached?.text;
    if (text) { setResult({ id: track.id, text, status: 'ready', error: '' }); return; }
    if (!navigator.onLine) { setResult({ id: track.id, text: '', status: 'offline', error: 'Connect to load lyrics for this song.' }); return; }
    setResult({ id: track.id, text: '', status: 'loading', error: '' });
    const params = new URLSearchParams({ artist_name: track.artist, track_name: track.title });
    if (track.durationMs > 0) params.set('duration', String(Math.round(track.durationMs / 1000)));
    void requestLyrics('https://lrclib.net/api/get?' + params).then(async response => {
      if (response.status === 404) return { syncedLyrics: '', plainLyrics: '' };
      if (!response.ok) throw new Error('Lyrics could not be loaded. Try again.');
      return response.json() as Promise<{ syncedLyrics?: string; plainLyrics?: string; instrumental?: boolean }>;
    }).then(data => {
      if (controller.signal.aborted) return;
      const text = data.syncedLyrics || data.plainLyrics || '';
      if (text) save('lyrics:' + track.id, { text, savedAt: Date.now() });
      setResult({ id: track.id, text, status: text ? 'ready' : 'unavailable', error: '' });
    }).catch(error => { if (!controller.signal.aborted) setResult({ id: track.id, text: '', status: 'error', error: error instanceof Error ? error.message : 'Lyrics could not be loaded.' }); });
    return () => controller.abort();
  }, [track?.id, enabled, retry]);
  const current = result.id === track?.id ? result : { text: '', status: enabled ? 'loading' : 'idle', error: '' };
  return { ...current, retry: () => setRetry(value => value + 1) };
}

export function SeekBar({ compact = false }: { compact?: boolean }) {
  const { playback } = useApp();
  const { player } = playback;
  const [draft, setDraft] = useState<number | null>(null);
  const dragging = useRef(false), pending = useRef<ReturnType<typeof setTimeout> | undefined>();
  const seekable = player.durationMs > 0 && player.status !== 'error' && player.status !== 'idle' && player.status !== 'loading';
  useEffect(() => { if (!dragging.current && draft !== null && Math.abs(player.positionMs - draft) < 1500) setDraft(null); }, [player.positionMs]);
  useEffect(() => { setDraft(null); dragging.current = false; return () => clearTimeout(pending.current); }, [player.track?.id]);
  function commit(value: number) { dragging.current = false; playback.seek(value); setDraft(value); clearTimeout(pending.current); pending.current = setTimeout(() => setDraft(null), 1800); }
  const value = Math.min(player.durationMs || 1, draft ?? player.positionMs);
  return <div className={`seek ${compact ? 'compact-seek' : ''}`}><input type="range" min={0} max={Math.max(1, player.durationMs)} step={1000} value={value} aria-label="Seek position" aria-valuetext={`${formatTime(value)} of ${formatTime(player.durationMs)}`} disabled={!seekable} style={{ '--progress': `${player.durationMs ? value / player.durationMs * 100 : 0}%` } as React.CSSProperties} onPointerDown={() => { dragging.current = true; }} onPointerUp={event => commit(Number(event.currentTarget.value))} onPointerCancel={() => { dragging.current = false; setDraft(null); }} onChange={event => { const target = Number(event.target.value); setDraft(target); if (!dragging.current) commit(target); }} onBlur={event => { if (dragging.current) commit(Number(event.target.value)); }} /><div className="seek-times"><span>{formatTime(value)}</span><span>{player.durationMs ? formatTime(player.durationMs) : 'Live / unknown duration'}</span></div></div>;
}

export function MiniPlayer() {
  const app = useApp(), { player } = app.playback;
  const track = player.track;
  const touch=useRef<SwipePoint|null>(null),suppressClick=useRef(false);
  function swipeStart(event:TouchEvent){const p=event.touches[0];touch.current=event.touches.length===1?{x:p.clientX,y:p.clientY,at:Date.now()}:null;suppressClick.current=false;}
  function swipeEnd(event:TouchEvent){const p=event.changedTouches[0],start=touch.current;touch.current=null;if(!start||!p)return;const direction=swipeDirection(start,{x:p.clientX,y:p.clientY,at:Date.now()});if(!direction)return;suppressClick.current=true;event.preventDefault();if(direction==='up')app.openPlayer();if(direction==='left')app.playback.next();if(direction==='right')app.playback.previous();}
  if (!track) return null;
  const playing = player.status === 'playing';
  return <div className="mini-player" aria-label="Mini-player"><button className="mini-open" onTouchStart={swipeStart} onTouchEnd={swipeEnd} onTouchCancel={()=>{touch.current=null;}} onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}app.openPlayer();}} aria-label={`Open player for ${track.title}`}><Cover song={track} /><span className="row-copy"><strong>{track.title}</strong><small>{player.status === 'loading' ? 'Buffering...' : player.status === 'error' ? 'Playback unavailable' : track.artist}</small></span></button><div className="mini-controls"><button className="icon-action mini-play" aria-label={playing ? 'Pause' : player.status === 'loading' ? 'Pause buffering' : 'Play'} onClick={app.playback.toggle}>{player.status === 'loading' ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={20} />}</button></div><span className="mini-progress" aria-hidden="true"><i style={{ width: `${player.durationMs ? Math.min(100, player.positionMs / player.durationMs * 100) : 0}%` }} /></span></div>;
}

export function FullPlayer({ lyricsOpen, onLyrics, onCloseLyrics, onClose, onQueue, onMenu, active }: {
  lyricsOpen: boolean; onLyrics: () => void; onCloseLyrics: () => void; onClose: () => void; onQueue: () => void; onMenu: () => void; active: boolean;
}) {
  const app = useApp(), { playback } = app, { player } = playback;
  const current = player.track;
  const lyrics = useLyrics(current, true);
  const lines = parseLrc(lyrics.text), timed = lines.length > 0;
  const index = timed ? lines.reduce((active, line, at) => line.time * 1000 <= player.positionMs ? at : active, 0) : -1;
  const currentLine = lines[index]?.text || lyrics.text.split('\n').find(line => line.trim()) || (lyrics.status === 'loading' ? 'Finding lyrics...' : lyrics.status === 'offline' ? 'Lyrics need a connection' : 'Lyrics unavailable for this song');
  const [following, setFollowing] = useState(true);
  const touch=useRef<SwipePoint|null>(null);
  function swipeStart(event:TouchEvent){const p=event.touches[0];touch.current=event.touches.length===1?{x:p.clientX,y:p.clientY,at:Date.now()}:null;}
  function swipeEnd(event:TouchEvent){const p=event.changedTouches[0],start=touch.current;touch.current=null;if(!start||!p)return;const direction=swipeDirection(start,{x:p.clientX,y:p.clientY,at:Date.now()});if(!direction)return;event.preventDefault();if(direction==='down'){if(lyricsOpen)onCloseLyrics();else onClose();}if(direction==='up'&&!lyricsOpen)onLyrics();if(direction==='left')playback.next();if(direction==='right')playback.previous();}
  const [lyricsStyle,setLyricsStyle]=useState<'scroll'|'focus'|'flow'>(()=>{const value=loadSaved<string>('lyrics-style','flow');return value==='focus'||value==='scroll'?value:'flow';});
  const highlighted = useRef<HTMLButtonElement>(null);
  useEffect(() => { setFollowing(true); }, [current?.id]);
  useEffect(() => {
    if (active && lyricsOpen && following && timed && lyricsStyle!=='focus') highlighted.current?.scrollIntoView({ block: 'center', behavior: document.querySelector('.cine-app')?.getAttribute('data-reduced-motion') === 'true' ? 'auto' : 'smooth' });
  }, [index, lyricsOpen, following, active,lyricsStyle]);
  if (!current) return null;
  const liked = app.isFavorite(current.id), playing = player.status === 'playing';
  function artist() {
    if (current?.artistId) app.openRoute({ kind: 'catalog', type: 'artist', id: current.artistId });
    else app.toast('Artist details are not available for this track. Find the artist in Search.');
  }
  return <Sheet title={lyricsOpen ? 'Lyrics' : 'Now playing'} full active={active} header={false} className="player-scrim" onClose={lyricsOpen ? onCloseLyrics : onClose}>
    <div className="player-ambient" aria-hidden="true">{current.cover && <img key={current.cover} src={current.cover} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}</div>
    <header className="player-topbar design-player-header"><button className="brand-back" aria-label={lyricsOpen ? 'Back to player' : 'Collapse player'} onClick={lyricsOpen ? onCloseLyrics : onClose}><Icon name={lyricsOpen ? 'back' : 'chevron_down'} size={18} /><Brand /></button><ThemeEdition /></header><div className="player-context-label"><span>{lyricsOpen ? 'LYRICS' : 'NOW PLAYING'}</span><div>{!lyricsOpen && <button className="player-lyrics-button" aria-label="Open lyrics" onClick={onLyrics}><Icon name="lyrics" size={16} />Lyrics</button>}<Action icon="queue" label="Open queue" onClick={onQueue} /><Action icon="more" label="Player options" onClick={onMenu} /></div></div>
    {!lyricsOpen ? <div className="full-player-body"><div className="floating-artwork" onTouchStart={swipeStart} onTouchEnd={swipeEnd} onTouchCancel={()=>{touch.current=null;}}><Cover large song={current} /></div><div className="player-control-card"><div className="track-heading"><div><h1>{current.title}</h1><button className="artist-link" onClick={artist}>{current.artist}</button></div><Action icon="heart" label={liked ? 'Remove from Favorites' : 'Add to Favorites'} active={liked} onClick={() => app.toggleFavorite(current)} /></div><SeekBar /><div className="transport"><Action icon="shuffle" label={playback.shuffle ? 'Shuffle on' : 'Shuffle off'} active={playback.shuffle} onClick={() => playback.setShuffle(!playback.shuffle)} /><Action icon="previous" label="Previous" onClick={playback.previous} /><button className="large-play" aria-label={playing ? 'Pause' : player.status === 'loading' ? 'Pause buffering' : 'Play'} onClick={playback.toggle}>{player.status === 'loading' ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={29} />}</button><Action icon="next" label="Next" onClick={playback.next} /><Action icon={playback.repeat === 'one' ? 'repeat_one' : 'repeat'} label={`Repeat ${playback.repeat === 'off' ? 'off. Turn on repeat all' : playback.repeat === 'all' ? 'all. Turn on repeat one' : 'one. Turn repeat off'}`} active={playback.repeat !== 'off'} onClick={() => playback.setRepeat(playback.repeat === 'off' ? 'all' : playback.repeat === 'all' ? 'one' : 'off')} /></div></div>{player.status === 'error' && <div className="player-error-card" role="alert"><h2>Playback stopped</h2><p>{player.error || 'Please try again, or move to the next song.'}</p><div><button className="primary-button" onClick={() => void playback.play(current, playback.queue, playback.context)}><Icon name="refresh" size={18} />Retry</button><button className="secondary-button" onClick={playback.next} disabled={playback.queue.length < 2}><Icon name="next" size={18} />Next song</button></div></div>}</div> : <><div className="lyrics-track" onTouchStart={swipeStart} onTouchEnd={swipeEnd} onTouchCancel={()=>{touch.current=null;}}><Cover song={current} /><span className="row-copy"><strong>{current.title}</strong><small>{current.artist}</small></span></div><label className="lyrics-style-picker">Lyrics style<select aria-label="Lyrics style" value={lyricsStyle} onChange={event=>{const value=event.target.value as typeof lyricsStyle;setLyricsStyle(value);save('lyrics-style',value);setFollowing(true);}}><option value="scroll">Smooth scroll</option><option value="focus">Focus</option><option value="flow">Animated flow</option></select></label><div className={`lyrics-lines lyrics-style-${lyricsStyle}`} onWheel={() => setFollowing(false)} onTouchStart={() => setFollowing(false)} onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '].includes(event.key)) setFollowing(false); }}>
      {lyrics.status === 'loading' ? <p className="load-state"><span className="spinner" />Loading lyrics...</p> : lyrics.status === 'error' || lyrics.status === 'offline' ? <Notice title="Lyrics could not load" action={<button className="secondary-button" onClick={lyrics.retry}>Try again</button>}>{lyrics.error}</Notice> : timed ? lines.map((line, at) => lyricsStyle==='focus' && Math.abs(at-index)>1 ? null : <button key={`${line.time}:${at}`} ref={at === index ? highlighted : undefined} className={`lyric-line ${at === index ? 'lyric-current' : ''}`} aria-current={at === index ? 'true' : undefined} onClick={() => { playback.seek(line.time * 1000); setFollowing(true); }}>{line.text}</button>) : lyrics.text ? <div className="plain-lyrics">{lyrics.text.split('\n').map((line, at) => <p key={at}>{line || '\u00a0'}</p>)}</div> : <Notice title="No lyrics for this song">Lyrics have not been provided for this track. The music can keep playing.</Notice>}
    </div>{timed && lyricsStyle!=='focus' && !following && <button className="follow-lyrics secondary-button" onClick={() => setFollowing(true)}>Follow current line</button>}<footer className="lyrics-transport"><SeekBar compact /><div><Action icon="previous" label="Previous" onClick={playback.previous} /><button className="large-play" aria-label={playing ? 'Pause' : 'Play'} onClick={playback.toggle}><Icon name={playing ? 'pause' : 'play'} /></button><Action icon="next" label="Next" onClick={playback.next} /></div></footer></>}
  </Sheet>;
}

export function QueueSheet({ onClose }: { onClose: () => void }) {
  const app = useApp(), { playback } = app;
  const current = playback.player.track;
  const currentIndex = playback.queue.findIndex(song => song.id === current?.id);
  const upcoming = playback.queue.slice(Math.max(0, currentIndex + 1));
  const [confirm, setConfirm] = useState(false), [editing, setEditing] = useState(false);
  const dragged = useRef<number | null>(null);
  function move(from: number, to: number) { if (to < 0 || to >= upcoming.length) return; playback.setQueue(items => { const changed = [...items]; const start = Math.max(0, currentIndex + 1); const [song] = changed.splice(start + from, 1); changed.splice(start + to, 0, song); return changed; }); }
  return <Sheet title="Queue" onClose={onClose} className="queue-scrim"><div className="queue-content"><p className="eyebrow">NOW PLAYING</p>{current ? <div className="queue-current"><Cover song={current} /><span className="row-copy"><strong>{current.title}</strong><small>{current.artist}</small></span><Icon name="music" /></div> : <p className="muted">Choose a song to begin.</p>}<div className="section-heading"><h2>Up next</h2><div><button className="text-button" onClick={() => setEditing(value => !value)} disabled={!upcoming.length}>{editing ? 'Done' : 'Edit'}</button><button className="text-button" onClick={() => setConfirm(true)} disabled={!upcoming.length}>Clear</button></div></div>{!upcoming.length && <p className="muted queue-empty">The queue is clear. Find something you love in Search.</p>}{upcoming.map((song, at) => <div key={song.id} className="queue-item" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragged.current !== null) move(dragged.current, at); dragged.current = null; }}><button className="song-main" onClick={() => void playback.play(song, playback.queue)}><Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{song.artist}</small></span></button><button className="icon-action drag-handle" draggable aria-label={`Reorder ${song.title}. Use Edit for move controls.`} onDragStart={event => { dragged.current = at; event.dataTransfer.setData('text/plain', song.id); }} onClick={() => setEditing(true)}><Icon name="drag" /></button>{editing && <div className="queue-edit"><span className="muted">{at + 1}</span><Action icon="chevron_up" label={`Move ${song.title} up`} disabled={at === 0} onClick={() => move(at, at - 1)} /><Action icon="chevron_down" label={`Move ${song.title} down`} disabled={at === upcoming.length - 1} onClick={() => move(at, at + 1)} /><Action icon="close" label={`Remove ${song.title} from queue`} onClick={() => playback.setQueue(items => items.filter(item => item.id !== song.id))} /></div>}</div>)}<label className="switch-row"><span><strong>Autoplay</strong><small>Continue with related music when the queue ends. Uses data.</small></span><input type="checkbox" checked={app.prefs.autoplay} onChange={event => app.updatePrefs({ autoplay: event.target.checked })} /></label></div>{confirm && <ConfirmDialog title="Clear upcoming songs?" confirmLabel="Clear queue" onClose={() => setConfirm(false)} onConfirm={() => playback.setQueue(items => items.slice(0, Math.max(0, currentIndex + 1)))}>The current song will keep playing.</ConfirmDialog>}</Sheet>;
}

export function SongMenu({ song, onClose, openUtility }: { song: Song; onClose: () => void; openUtility: (utility: Utility) => void }) {
  const app = useApp();
  const [adding, setAdding] = useState(false), [busy, setBusy] = useState(false);
  const downloaded = app.downloads.some(item => item.id === song.id), liked = app.isFavorite(song.id);
  async function view(type: 'artist' | 'album') {
    if (busy) return; setBusy(true);
    try {
      let id = type === 'artist' ? song.artistId : song.albumId;
      if (!id) { const track = await innertubeCatalog.getTrack(song.id); id = type === 'artist' ? track.artists[0]?.id : track.album?.id; }
      if (!id) throw new Error(`The source has not provided an ${type} page for this song.`);
      onClose(); app.openRoute({ kind: 'catalog', type, id });
    } catch (error) { app.toast(error instanceof Error ? error.message : 'Details are unavailable.'); } finally { setBusy(false); }
  }
  async function share() {
    const url = songLink(song.id);
    try { if (window.CineAndroid?.share) window.CineAndroid.share(`${song.title} - ${song.artist}\n${url}`); else if (navigator.share) await navigator.share({ title: song.title, text: song.artist, url }); else { await navigator.clipboard.writeText(url); app.toast('Song link copied.'); } }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) app.toast('Sharing is unavailable on this device.'); }
  }
  return <Sheet title={adding ? 'Add to playlist' : 'Song options'} onClose={onClose} className="song-menu-scrim"><div className="menu-song"><Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{song.artist}</small></span></div>{adding ? <><button className="list-link" onClick={() => { onClose(); app.setAddToPlaylist(null); app.openRoute({ kind: 'playlist-form', initialSong: song }); }}><Icon name="plus" /><span>Create playlist</span><Icon name="chevron_right" /></button>{app.account.library.playlists.map(list => <button className="list-link" key={list.id} onClick={() => { app.account.setLibrary(old => ({ ...old, playlists: old.playlists.map(item => item.id === list.id ? addToPlaylist(item, song) : item) })); app.toast(`Saved to ${list.name}.`); onClose(); }}><Cover kind="playlist" song={{ cover: list.cover || list.songs[0]?.cover }} /><span className="row-copy"><strong>{list.name}</strong><small>{list.songs.length} songs</small></span><Icon name={list.songs.some(item => item.id === song.id) ? 'check' : 'plus'} /></button>)}</> : <div className="menu-actions"><button className="list-link" onClick={() => { app.toggleFavorite(song); onClose(); }}><Icon name="heart" filled={liked} /><span>{liked ? 'Remove from Favorites' : 'Add to Favorites'}</span></button><button className="list-link" onClick={() => setAdding(true)}><Icon name="playlist" /><span>Add to playlist</span></button><button className="list-link" onClick={() => { app.playback.setQueue(items => items.some(item => item.id === song.id) ? items : [...items, song]); app.toast('Added to queue.'); onClose(); }}><Icon name="queue" /><span>Add to queue</span></button><button className="list-link" onClick={() => { app.playback.setQueue(items => { const next = items.filter(item => item.id !== song.id || item.id === app.playback.player.track?.id); if (song.id === app.playback.player.track?.id) return next; const at = next.findIndex(item => item.id === app.playback.player.track?.id); next.splice(at + 1, 0, song); return next; }); app.toast('Added to play next.'); onClose(); }}><Icon name="next" /><span>Play next</span></button><button className="list-link" onClick={() => { if (downloaded) app.removeDownload(song.id); else app.download(song); onClose(); }}><Icon name="download" /><span>{downloaded ? 'Remove download' : 'Download for Cine music'}</span>{downloaded && <Icon name="lock" size={16} />}</button><button className="list-link" disabled={busy} onClick={() => void view('album')}><Icon name="album" /><span>View album</span><Icon name="chevron_right" /></button><button className="list-link" disabled={busy} onClick={() => void view('artist')}><Icon name="artist" /><span>View artist</span><Icon name="chevron_right" /></button><button className="list-link" onClick={() => openUtility('sound')}><Icon name="equalizer" /><span>Sound &amp; equalizer</span><Icon name="chevron_right" /></button><button className="list-link" onClick={() => openUtility('devices')}><Icon name="headphones" /><span>Connect a device</span><Icon name="chevron_right" /></button><button className="list-link" onClick={() => openUtility('timer')}><Icon name="timer" /><span>Sleep timer</span><Icon name="chevron_right" /></button><button className="list-link" onClick={() => void share()}><Icon name="share" /><span>Share song link</span></button></div>}</Sheet>;
}

export function UtilitySheet({ utility, onClose }: { utility: Utility; onClose: () => void }) {
  return <Sheet title={utility === 'sound' ? 'Sound & equalizer' : utility === 'devices' ? 'Connect a device' : 'Sleep timer'} onClose={onClose}><div className="utility-content">{utility === 'sound' ? <SoundControls /> : utility === 'devices' ? <DeviceControls /> : <SleepControls />}</div></Sheet>;
}

function SoundControls() {
  const app = useApp(), { prefs, updatePrefs } = app;
  const caps = app.playback.player.equalizer;
  const bridge = Boolean(window.CineAndroid?.configureEqualizer);
  const supported = bridge && Boolean(caps?.ready && caps.available && app.playback.player.track && ['playing', 'paused', 'ended'].includes(app.playback.player.status));
  function change(enabled: boolean, bands: number[], preset = 'Custom') {
    try {
      if (!window.CineAndroid?.configureEqualizer(enabled, JSON.stringify(bands))) { app.toast('An equalizer is not available for this audio session. Start playback and try again.'); return; }
      updatePrefs({ equalizerOn: enabled, eqBands: bands, eqPreset: preset });
    } catch { app.toast('This device could not apply the equalizer.'); }
  }
  const presets: Record<string, number[]> = { Flat: [0, 0, 0, 0, 0], Balanced: [2, 1, 0, 1, 2], Bass: [6, 3, 0, -1, 0], Vocal: [-2, 1, 4, 2, -1], Treble: [-1, 0, 1, 3, 5] };
  const frequencies = supported ? caps?.frequencies?.slice(0, 5) || [] : [];
  return <><p className="muted">Shape the sound, keep the music yours.</p>{!supported && <p className="settings-info">{!bridge ? 'The equalizer requires the Android app.' : !app.playback.player.track || !caps?.ready ? 'Start playback to check equalizer support for this audio session.' : 'This audio session does not provide a supported equalizer.'}</p>}<label className="switch-row"><span><strong>Equalizer</strong><small>Applied to Cine music playback</small></span><input type="checkbox" disabled={!supported} checked={supported && prefs.equalizerOn} onChange={event => change(event.target.checked, prefs.eqBands, prefs.eqPreset)} /></label><label className="field-label">Preset<select value={prefs.eqPreset} disabled={!supported || !prefs.equalizerOn} onChange={event => change(true, presets[event.target.value] || prefs.eqBands, event.target.value)}>{[...Object.keys(presets), 'Custom'].map(preset => <option key={preset}>{preset}</option>)}</select></label><div className="equalizer-bands">{frequencies.map((frequency, index) => {
    const label = frequency >= 1000 ? `${(frequency / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kHz` : `${frequency} Hz`;
    const value = Math.max(caps?.minDb ?? -12, Math.min(caps?.maxDb ?? 12, prefs.eqBands[index] || 0));
    return <label className="eq-band" key={index}><span>{label}</span><input type="range" aria-label={`${label} band gain`} min={caps?.minDb ?? -12} max={caps?.maxDb ?? 12} step={1} value={value} disabled={!prefs.equalizerOn} onChange={event => { const bands = [...prefs.eqBands]; bands[index] = Number(event.target.value); change(true, bands); }} /><small>{value > 0 ? '+' : ''}{value} dB</small></label>;
  })}</div><p className="muted utility-note">{supported ? `Showing ${frequencies.length} of ${caps?.bandCount || frequencies.length} device bands. Bass is adjusted with the lowest-frequency band. ` : ''}Volume normalization is not supported by this playback engine.</p><button className="secondary-button full-button" disabled={!bridge} onClick={() => change(false, [0, 0, 0, 0, 0], 'Flat')}>Reset to neutral</button></>;
}

function DeviceControls() {
  const app = useApp();
  const [output, setOutput] = useState(app.playback.player.output);
  useEffect(() => subscribe(event => { if (event.type === 'player' && typeof event.data.output === 'string') setOutput(event.data.output); }), []);
  function refresh() { const state = snapshot(); setOutput(state.output); window.CineAndroid?.ready?.(); }
  return <><p className="eyebrow">PLAYBACK OUTPUT</p><div className="device-current"><Icon name="headphones" size={30} /><span><strong>{output || 'System audio output'}</strong><small>{output ? 'Current Android output' : 'Managed by your device'}</small></span></div><p className="muted">Choose available headphones or speakers in Android's audio settings. Cine music follows the system output; it does not provide casting.</p><button className="primary-button full-button" disabled={!isAndroid} onClick={() => { try { window.CineAndroid?.openMediaOutputPanel(); } catch { app.toast('Audio settings could not be opened. Open Bluetooth from Android Settings.'); } }}>Choose an audio device</button><button className="text-button" onClick={refresh} disabled={!isAndroid}>Refresh current output</button>{!isAndroid && <p className="settings-info">Device switching requires the Android app.</p>}</>;
}

function SleepControls() {
  const app = useApp();
  const [choice, setChoice] = useState(() => loadSaved('sleep-timer-choice', '30'));
  const [now, setNow] = useState(Date.now());
  const { sleepDeadline = 0, sleepEndOfSong = false } = app.playback.player;
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, []);
  const enabled = Boolean(window.CineAndroid?.sleepTimer), active = sleepDeadline > 0 || sleepEndOfSong;
  function start() { save('sleep-timer-choice', choice); sleepTimer(choice === 'off' ? 0 : choice === 'song' ? 1 : Number(choice), choice === 'song'); app.toast(choice === 'off' ? 'Sleep timer cancelled.' : 'Sleep timer started.'); }
  return <><p className="muted">A little music before the quiet.</p>{active && <p className="timer-countdown" role="status">{sleepEndOfSong ? 'Stops at the end of this song' : formatTime(Math.max(0, sleepDeadline - now)) + ' remaining'}</p>}<div className="timer-options" role="radiogroup" aria-label="Sleep timer duration">{[['off', 'Off'], ['15', '15 minutes'], ['30', '30 minutes'], ['45', '45 minutes'], ['60', '60 minutes'], ['song', 'End of current song']].map(([value, label]) => <label className="timer-option" key={value}><input type="radio" name="sleep-duration" value={value} checked={choice === value} disabled={!enabled} onChange={() => setChoice(value)} /><span>{label}</span></label>)}</div><button className="primary-button full-button" disabled={!enabled || (choice === 'off' && !active) || !app.playback.player.track} onClick={start}>{active ? 'Update timer' : 'Start timer'}</button>{active && <button className="text-button full-button" onClick={() => { sleepTimer(0, false); app.toast('Sleep timer cancelled.'); }}>Cancel timer</button>}<p className="muted utility-note">{enabled ? 'Runs in the Android playback service, including while you browse or lock your phone.' : 'A reliable sleep timer requires the Android app.'}</p></>;
}

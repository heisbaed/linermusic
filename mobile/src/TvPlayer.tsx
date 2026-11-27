import { ConnectControls, ConnectLabel } from './ConnectControls';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useApp } from './AppContext';
import { Icon } from './Icons';
import { Cover, Sheet } from './ui';
import { formatTime } from './library';
import { useLyrics, useLivePosition } from './Player';
import { focusElement, focusFirstActionable } from './spatialNav';
import { parseTvLyrics, type TvLyricLine } from './tvLyrics';
import { displaySongTitle } from './catalogQuality';
import type { TvOverlay } from './TvApp';
import './tv-player.css';
import { toSquareArtworkUrl } from '@/shared/media/innertube/innertubeThumbnail';
import { useTvArtwork } from './tvArtwork';

const LyricLine = memo(function LyricLine({ line, current, wordIndex, activeRef }: {
  line: TvLyricLine; current: boolean; wordIndex: number; activeRef?: Ref<HTMLParagraphElement>;
}) {
  return <p ref={activeRef} aria-current={current ? 'true' : undefined} className={`tv-lyric ${current ? 'current' : ''}`}>
    {current && line.words.length ? line.words.map((word, i) => <span key={i} className={i <= wordIndex ? 'sung' : ''}>{word.text}</span>) : line.text}
  </p>;
});

export function TvPlayer({ mode, onMode, onBack }: {
  mode: TvOverlay; onMode: (mode: TvOverlay) => void; onBack: () => void;
}) {
  const app = useApp();
  const root = useRef<HTMLElement>(null);
  const activeLine = useRef<HTMLParagraphElement>(null);
  const lyricViewport = useRef<HTMLDivElement>(null);
  const lyricColumn = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLButtonElement>(null);
  const [wash, setWash] = useState('');
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [utilitiesVisible, setUtilitiesVisible] = useState(true);
  const controlsShown = useRef(true);
  const lastControl = useRef<HTMLElement | null>(null);
  const { player, queue, seek, previous, next, toggle } = app.playback;
  const { track, status, durationMs } = player;
  const preferredArtwork = useTvArtwork(track,true,true);
  const lyrics = useLyrics(track, mode !== 'queue');
  const lines = useMemo(() => parseTvLyrics(lyrics.text), [lyrics.text]);
  const wordTimed = useMemo(() => lines.some(line => line.words.length > 0), [lines]);
  const position = useLivePosition(player, true, mode === 'lyrics' && wordTimed ? 100 : 500);
  const live = useRef({ position, seek });
  live.current = { position, seek };
  const active = lines.reduce((index, line, i) => line.time * 1000 <= position ? i : index, -1);
  const playing = status === 'playing' || status === 'loading';
  const split = mode !== 'player';

  useEffect(() => {
    if (mode !== 'player') { controlsShown.current = true; setUtilitiesVisible(true); return; }
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0;
    function scheduleHide() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (devicesOpen) { scheduleHide(); return; }
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && root.current?.contains(focused)) {
          lastControl.current = focused;
          focused.blur();
        }
        controlsShown.current = false;
        setUtilitiesVisible(false);
      }, 5000);
    }
    function reveal() { controlsShown.current = true; setUtilitiesVisible(true); scheduleHide(); }
    function remote(event: Event) {
      const key = (event as CustomEvent<{ key: string }>).detail.key;
      const hidden = !controlsShown.current;
      reveal();
      if (hidden && ['left','right','up','down','enter'].includes(key)) {
        event.preventDefault();
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const target = lastControl.current?.isConnected ? lastControl.current : root.current?.querySelector<HTMLElement>('.tv-main-play');
          if (target) focusElement(target);
        });
      }
    }
    reveal();
    window.addEventListener('cine:tv-input', remote);
    window.addEventListener('pointermove', reveal);
    window.addEventListener('pointerdown', reveal);
    window.addEventListener('cine:remote-transport', reveal);
    root.current?.addEventListener('focusin', reveal);
    const element = root.current;
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('cine:tv-input', remote);
      window.removeEventListener('pointermove', reveal);
      window.removeEventListener('pointerdown', reveal);
      window.removeEventListener('cine:remote-transport', reveal);
      element?.removeEventListener('focusin', reveal);
    };
  }, [mode, devicesOpen]);

  useEffect(() => {
    let cancelled = false;
    setWash('');
    if (!preferredArtwork) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8; canvas.height = 8;
        canvas.getContext('2d')?.drawImage(image, 0, 0, 8, 8);
        setWash(canvas.toDataURL('image/png'));
      } catch { /* Keep the theme gradient when artwork cannot be sampled. */ }
    };
    image.src = preferredArtwork;
    return () => { cancelled = true; };
  }, [preferredArtwork]);
  useLayoutEffect(() => { focusFirstActionable(root.current); }, [mode]);
  useEffect(() => {
    const element = slider.current;
    function move(event: Event) { live.current.seek(live.current.position + (event as CustomEvent<number>).detail); }
    element?.addEventListener('cine:seek', move);
    return () => element?.removeEventListener('cine:seek', move);
  }, [mode]);
  useLayoutEffect(() => {
    if (mode !== 'lyrics') return;
    const viewport = lyricViewport.current, line = activeLine.current, column = lyricColumn.current;
    if (!viewport || !line || !column) return;
    function center() {
      if (!viewport || !line || !column) return;
      const offset = viewport.clientHeight / 2 - line.offsetTop - line.clientHeight / 2;
      column.style.transform = 'translate3d(0,' + offset + 'px,0)';
    }
    center();
    const resize = new ResizeObserver(center);
    resize.observe(viewport);
    let mounted = true;
    void document.fonts.ready.then(() => { if (mounted) center(); });
    return () => { mounted = false; resize.disconnect(); };
  }, [mode, active, lines, track?.id]);
  if (!track) return null;

  const title = displaySongTitle(track.title, track.artist);
  const percent = Math.max(0, Math.min(100, position / (durationMs || 1) * 100));
  const at = queue.findIndex(song => song.id === track.id);
  const upcoming = queue.slice(at + 1);

  return <section className="tv-overlay tv-listener" data-view={mode} data-controls-visible={mode !== 'player' || utilitiesVisible} ref={root} role="dialog" aria-modal="true"
    aria-label={mode === 'lyrics' ? 'Lyrics' : mode === 'queue' ? 'Up Next' : 'Now Playing'}>
    {mode === 'player' && <div className="tv-cinematic-cover" aria-hidden="true"><Cover song={{ ...track, cover: track.cover ? toSquareArtworkUrl(track.cover, 1440) : undefined }} large /></div>}
    <div className="tv-art-wash" aria-hidden="true" style={wash || preferredArtwork ? { backgroundImage: `url("${wash || preferredArtwork}")` } : undefined} />
    <div className="tv-art-shade" aria-hidden="true" />
    <header className="tv-listener-header" aria-hidden={mode === 'player' && !utilitiesVisible}>
      <button className="tv-icon-button tv-glass-back" onClick={onBack} aria-hidden={mode === 'player' && !utilitiesVisible} aria-label={split ? 'Back to artwork' : 'Back to browsing'}><Icon name="back" size={24} /></button>
      <span>{split ? title : 'Now Playing'}</span>
      <div className="tv-player-utilities" data-visible={mode !== 'player' || utilitiesVisible} aria-hidden={mode === 'player' && !utilitiesVisible}>
      <ConnectLabel onClick={() => setDevicesOpen(true)} />
      <nav className="tv-player-tabs" aria-label="Player views">
        <button onClick={() => onMode('player')} aria-pressed={mode === 'player'}><Icon name="album" size={21} /><span>Artwork</span></button>
        <button onClick={() => onMode('lyrics')} aria-pressed={mode === 'lyrics'}><Icon name="lyrics" size={21} /><span>Lyrics</span></button>
        <button onClick={() => onMode('queue')} aria-pressed={mode === 'queue'}><Icon name="queue" size={21} /><span>Up Next</span></button>
      </nav>
      </div>
    </header>
    <div className="tv-listening-layout">
      <div className="tv-record-layout">
        <div className="tv-artwork-frame"><Cover song={track} large /></div>
        <section className="tv-playback-card" aria-label="Playback controls">
          <div className="tv-track-heading">
            <div><h1 title={title}>{title}</h1><p>{track.artist}</p></div>
            {split && <button className="tv-icon-button tv-like" aria-label={app.isFavorite(track.id) ? 'Unlike song' : 'Like song'}
              aria-pressed={app.isFavorite(track.id)} onClick={() => app.toggleFavorite(track)}>
              <Icon name="heart" size={24} filled={app.isFavorite(track.id)} />
            </button>}
          </div>
          <div className="tv-transport-chrome" aria-hidden={mode === 'player' && !utilitiesVisible}>
          <button className="tv-progress-control" ref={slider} role="slider" aria-label="Playback position"
            aria-valuemin={0} aria-valuemax={Math.round(durationMs / 1000)} aria-valuenow={Math.round(position / 1000)}
            aria-valuetext={formatTime(position)} onClick={() => seek(position + 10000)}>
            <span className="tv-progress-track"><span style={{ width: percent + '%' }} /><i style={{ left: percent + '%' }} /></span>
          </button>
          <div className="tv-time"><span>{formatTime(position)}</span><span>−{formatTime(Math.max(0, durationMs - position))}</span></div>
          <div className="tv-player-controls">
            {!split && <button className="tv-icon-button tv-like" aria-label={app.isFavorite(track.id) ? 'Unlike song' : 'Like song'}
              aria-pressed={app.isFavorite(track.id)} onClick={() => app.toggleFavorite(track)}><Icon name="heart" size={24} filled={app.isFavorite(track.id)} /></button>}
            <button className="tv-icon-button" aria-label={app.playback.shuffle === 'smart' ? 'Smart shuffle on' : app.playback.shuffle === 'on' ? 'Shuffle on' : 'Shuffle off'} aria-pressed={app.playback.shuffle !== 'off'}
              onClick={app.playback.cycleShuffle}><Icon name={app.playback.shuffle === 'smart' ? 'sparkles' : 'shuffle'} size={22} /></button>
            <button className="tv-icon-button" onClick={previous} aria-label="Previous"><Icon name="previous" size={29} /></button>
            <button className="tv-main-play" onClick={toggle} data-tv-autofocus aria-label={status === 'error' ? 'Retry playback' : playing ? 'Pause' : 'Play'}>
              <Icon name={status === 'error' ? 'refresh' : playing ? 'pause' : 'play'} size={31} />
            </button>
            <button className="tv-icon-button" onClick={next} aria-label="Next"><Icon name="next" size={29} /></button>
            <button className="tv-icon-button" aria-label={`Repeat ${app.playback.repeat}`} aria-pressed={app.playback.repeat !== 'off'}
              onClick={() => app.playback.setRepeat(app.playback.repeat === 'off' ? 'all' : app.playback.repeat === 'all' ? 'one' : 'off')}>
              <Icon name={app.playback.repeat === 'one' ? 'repeat_one' : 'repeat'} size={22} />
            </button>
          </div>
          </div>
          {(status === 'loading' || status === 'error') && <p className="tv-buffer-status" role="status">{status === 'loading' ? 'Buffering…' : player.error || 'Playback interrupted. Choose Retry.'}</p>}
        </section>
      </div>
      {mode === 'lyrics' && <section className="tv-lyrics-card" aria-label="Synced lyrics">
        <header><h2>Lyrics</h2></header>
        <div className="tv-lyrics-viewport" ref={lyricViewport}><div className="tv-lyrics-column" ref={lyricColumn}>
          {lines.length ? lines.map((line, index) => <LyricLine key={index} line={line} current={index === Math.max(0, active)}
            activeRef={index === Math.max(0, active) ? activeLine : undefined}
            wordIndex={index === Math.max(0, active) ? line.words.reduce((last, word, i) => word.time * 1000 <= position ? i : last, -1) : -1} />) : lyrics.text ? <p className="tv-unsynced">{lyrics.text}</p>
            : <div className="tv-lyrics-message"><Icon name="lyrics" size={42} /><p role="status">{lyrics.status === 'loading' ? 'Finding lyrics…' : lyrics.error || 'Lyrics are unavailable for this song.'}</p>
            </div>}
        </div></div>
      </section>}
      {mode === 'queue' && <section className="tv-queue-card"><header><h2>Up Next</h2><small>{upcoming.length} songs</small></header>
        <div className="tv-next-viewport">
          <p className="tv-queue-label">Now Playing</p>
          <div className="tv-track tv-queue-current" aria-current="true"><Cover song={track} /><span><strong>{title}</strong><small>{track.artist}</small></span><Icon name="equalizer" size={20} /></div>
          <p className="tv-queue-label">Next in queue</p>
          {upcoming.length ? upcoming.slice(0, 100).map(song => <button className="tv-track" key={song.id}
          onClick={() => void app.playback.play(song, queue, app.playback.context)}>
          <Cover song={song} /><span><strong>{displaySongTitle(song.title, song.artist)}</strong><small>{song.artist}</small></span>
          <span className="tv-queue-duration">{song.durationMs ? formatTime(song.durationMs) : ''}</span>
          <Icon name="play" size={20} />
        </button>) : <p className="tv-queue-empty">Your upcoming queue is empty. Choose music to keep listening.</p>}
        </div>
      </section>}
    </div>
    {devicesOpen && <Sheet title="Listen on" onClose={() => setDevicesOpen(false)}><ConnectControls /></Sheet>}
  </section>;
}

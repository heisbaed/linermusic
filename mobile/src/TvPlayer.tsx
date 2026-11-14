import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { Icon } from './Icons';
import { Cover } from './ui';
import { formatTime } from './library';
import { useLyrics, useLivePosition } from './Player';
import { focusFirstActionable } from './spatialNav';
import { parseTvLyrics } from './tvLyrics';
import { displaySongTitle } from './catalogQuality';
import type { TvOverlay } from './TvApp';
import './tv-player.css';

export function TvPlayer({ mode, onMode, onBack }: {
  mode: Exclude<TvOverlay, 'ambient'>; onMode: (mode: TvOverlay) => void; onBack: () => void;
}) {
  const app = useApp();
  const root = useRef<HTMLElement>(null);
  const activeLine = useRef<HTMLParagraphElement>(null);
  const lyricViewport = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLButtonElement>(null);
  const [wash, setWash] = useState('');
  const { player, queue, seek, previous, next, toggle } = app.playback;
  const { track, status, durationMs } = player;
  const lyrics = useLyrics(track, mode === 'lyrics');
  const position = useLivePosition(player, true);
  const live = useRef({ position, seek });
  live.current = { position, seek };
  const lines = useMemo(() => parseTvLyrics(lyrics.text), [lyrics.text]);
  const active = lines.reduce((index, line, i) => line.time * 1000 <= position ? i : index, -1);
  const playing = status === 'playing' || status === 'loading';
  const split = mode !== 'player';

  useEffect(() => {
    let cancelled = false;
    setWash('');
    if (!track?.cover) return;
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
    image.src = track.cover;
    return () => { cancelled = true; };
  }, [track?.cover]);
  useLayoutEffect(() => { focusFirstActionable(root.current); }, [mode]);
  useEffect(() => {
    const element = slider.current;
    function move(event: Event) { live.current.seek(live.current.position + (event as CustomEvent<number>).detail); }
    element?.addEventListener('cine:seek', move);
    return () => element?.removeEventListener('cine:seek', move);
  }, [mode]);
  useLayoutEffect(() => {
    if (mode !== 'lyrics') return;
    const viewport = lyricViewport.current, line = activeLine.current;
    if (!viewport || !line) return;
    const target = viewport.scrollTop + line.getBoundingClientRect().top - viewport.getBoundingClientRect().top
      - (viewport.clientHeight - line.clientHeight) / 2;
    viewport.scrollTo({ top: Math.max(0, target),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [mode, active]);
  if (!track) return null;

  const title = displaySongTitle(track.title, track.artist);
  const percent = Math.max(0, Math.min(100, position / (durationMs || 1) * 100));
  const at = Math.max(0, queue.findIndex(song => song.id === track.id));

  return <section className="tv-overlay tv-listener" data-view={mode} ref={root} role="dialog" aria-modal="true"
    aria-label={mode === 'lyrics' ? 'Lyrics' : mode === 'queue' ? 'Up Next' : 'Now Playing'}>
    <div className="tv-art-wash" aria-hidden="true" style={wash ? { backgroundImage: `url("${wash}")` } : undefined} />
    <div className="tv-art-shade" aria-hidden="true" />
    <header className="tv-listener-header">
      <button className="tv-icon-button tv-glass-back" onClick={onBack} aria-label={split ? 'Back to artwork' : 'Back to browsing'}><Icon name="back" size={24} /></button>
      <span>{split ? title : 'Now Playing'}</span>
      <nav className="tv-player-tabs" aria-label="Player views">
        <button onClick={() => onMode('player')} aria-pressed={mode === 'player'}><Icon name="album" size={21} /><span>Artwork</span></button>
        <button onClick={() => onMode('lyrics')} aria-pressed={mode === 'lyrics'}><Icon name="lyrics" size={21} /><span>Lyrics</span></button>
        <button onClick={() => onMode('queue')} aria-pressed={mode === 'queue'}><Icon name="queue" size={21} /><span>Up Next</span></button>
      </nav>
    </header>
    <div className="tv-listening-layout">
      <div className="tv-record-layout">
        <div className="tv-artwork-frame"><Cover song={track} large /></div>
        <section className="tv-playback-card" aria-label="Playback controls">
          <div className="tv-track-heading">
            <div><h1 title={title}>{title}</h1><p>{track.artist}</p></div>
            <button className="tv-icon-button tv-like" aria-label={app.isFavorite(track.id) ? 'Unlike song' : 'Like song'}
              aria-pressed={app.isFavorite(track.id)} onClick={() => app.toggleFavorite(track)}>
              <Icon name="heart" size={24} filled={app.isFavorite(track.id)} />
            </button>
          </div>
          <button className="tv-progress-control" ref={slider} role="slider" aria-label="Playback position"
            aria-valuemin={0} aria-valuemax={Math.round(durationMs / 1000)} aria-valuenow={Math.round(position / 1000)}
            aria-valuetext={formatTime(position)} onClick={() => seek(position + 10000)}>
            <span className="tv-progress-track"><span style={{ width: percent + '%' }} /><i style={{ left: percent + '%' }} /></span>
          </button>
          <div className="tv-time"><span>{formatTime(position)}</span><span>−{formatTime(Math.max(0, durationMs - position))}</span></div>
          <div className="tv-player-controls">
            <button className="tv-icon-button" aria-label="Shuffle" aria-pressed={app.playback.shuffle !== 'off'}
              onClick={() => app.playback.setShuffle(app.playback.shuffle === 'off' ? 'on' : 'off')}><Icon name="shuffle" size={22} /></button>
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
          {(status === 'loading' || status === 'error') && <p className="tv-buffer-status" role="status">{status === 'loading' ? 'Buffering…' : player.error || 'Playback interrupted. Choose Retry.'}</p>}
        </section>
      </div>
      {mode === 'lyrics' && <section className="tv-lyrics-card" aria-label="Synced lyrics">
        <header><h2>Lyrics</h2></header>
        <div className="tv-lyrics-viewport" ref={lyricViewport}>
          {lines.length ? lines.map((line, index) => <p key={index} ref={index === active ? activeLine : undefined}
            aria-current={index === active ? 'true' : undefined} className={`tv-lyric ${index === active ? 'current' : ''}`}
>
            {index === active && line.words.length ? line.words.map((word, i) =>
              <span key={i} className={word.time * 1000 <= position ? 'sung' : ''}>{word.text}</span>) : line.text}
          </p>) : lyrics.text ? <p className="tv-unsynced">{lyrics.text}</p>
            : <div className="tv-lyrics-message"><Icon name="lyrics" size={42} /><p role="status">{lyrics.status === 'loading' ? 'Finding lyrics…' : lyrics.error || 'Lyrics are unavailable for this song.'}</p>
              {lyrics.status === 'error' && <button className="tv-button" onClick={lyrics.retry}>Try again</button>}</div>}
        </div>
      </section>}
      {mode === 'queue' && <section className="tv-queue-card"><header><h2>Up Next</h2><small>{queue.length - at} songs</small></header>
        <div className="tv-next-viewport">{queue.slice(at, at + 60).map(song => <button className="tv-track" key={song.id}
          aria-current={song.id === track.id ? 'true' : undefined} onClick={() => void app.playback.play(song, queue, app.playback.context)}>
          <Cover song={song} /><span><strong>{displaySongTitle(song.title, song.artist)}</strong><small>{song.artist}</small></span>
          <Icon name={song.id === track.id ? 'equalizer' : 'play'} size={20} />
        </button>)}</div>
      </section>}
    </div>
  </section>;
}

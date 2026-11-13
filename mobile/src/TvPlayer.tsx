import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { Icon } from './Icons';
import { formatTime, parseLrc } from './library';
import { useLyrics } from './Player';
import { focusFirstActionable } from './spatialNav';

type RGB = [number, number, number];

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

function rgbToCss([r, g, b]: RGB, a = 1) { return a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`; }

function luminance([r, g, b]: RGB) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

async function extractPalette(url?: string): Promise<RGB[]> {
  const fallback: RGB[] = [[255, 45, 85], [91, 44, 255], [0, 194, 255]];
  if (!url || typeof document === 'undefined') return fallback;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('img'));
      img.src = url;
    });
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<string, { rgb: RGB; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 120) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const q = 32; // quantize
      const key = `${Math.round(r / q)},${Math.round(g / q)},${Math.round(b / q)}`;
      const cur = buckets.get(key);
      if (cur) { cur.n += 1; cur.rgb = [Math.round((cur.rgb[0] + r) / 2), Math.round((cur.rgb[1] + g) / 2), Math.round((cur.rgb[2] + b) / 2)]; }
      else buckets.set(key, { rgb: [r, g, b], n: 1 });
    }
    const colors = [...buckets.values()]
      .filter(b => luminance(b.rgb) > 0.06 && luminance(b.rgb) < 0.92)
      .sort((a, b) => b.n - a.n)
      .map(b => b.rgb as RGB);
    const picked = colors.slice(0, 3);
    while (picked.length < 3) picked.push(fallback[picked.length]);
    return picked;
  } catch {
    return fallback;
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TvPlayer() {
  const app = useApp();
  const track = app.playback.player.track;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(0);
  const [mesh, setMesh] = useState<RGB[]>([[255, 45, 85], [91, 44, 255], [0, 194, 255]]);
  const lyrics = useLyrics(track ? { id: track.id, title: track.title, artist: track.artist, durationMs: track.durationMs || 0 } as any : null, open && !!track);
  const lines = useMemo(() => parseLrc(lyrics.text || ''), [lyrics.text]);
  const timed = lines.length > 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('cine:tv-player-open', onOpen);
    window.addEventListener('cine:tv-player-close', onClose);
    return () => { window.removeEventListener('cine:tv-player-open', onOpen); window.removeEventListener('cine:tv-player-close', onClose); };
  }, []);

  useEffect(() => { if (!track) setOpen(false); }, [track?.id]);

  useEffect(() => {
    if (!open || !track) return;
    let live = true;
    extractPalette(track.cover).then(p => { if (live) setMesh(p); });
    return () => { live = false; };
  }, [open, track?.cover, track?.id]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const nativePos = (window as any).CineAndroid?.getPlayerPositionMs?.();
      setPos(typeof nativePos === 'number' ? nativePos : (app.playback.player.positionMs ?? 0));
    };
    update();
    const id = setInterval(update, 250);
    const t = setTimeout(() => focusFirstActionable(rootRef.current), 80);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [open, app.playback.player.status, track?.id]);

  useEffect(() => {
    if (!open) return;
    const close = (e?: Event) => {
      e?.preventDefault?.();
      (e as any)?.stopImmediatePropagation?.();
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
        close(e);
      }
    };
    const onBack = (e: Event) => close(e);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('cine:back', onBack, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('cine:back', onBack, true);
    };
  }, [open]);

  const duration = app.playback.player.durationMs || track?.durationMs || 0;
  const progress = duration ? clamp((pos / duration) * 100, 0, 100) : 0;
  const buffered = (app.playback.player as any).bufferedMs && duration
    ? clamp((((app.playback.player as any).bufferedMs as number) / duration) * 100, 0, 100)
    : progress; // fallback: show progress as buffered when unavailable

  const activeIndex = timed ? lines.reduce((active, line, i) => (line.time * 1000 <= pos ? i : active), -1) : -1;

  useEffect(() => {
    if (!open || !timed || activeIndex < 0) return;
    const box = scrollRef.current;
    const line = activeRef.current;
    if (!box || !line) return;
    const reduced = document.querySelector('.cine-app')?.getAttribute('data-reduced-motion') === 'true'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Active line auto-centers at ~35% container height.
    const target = Math.max(0, line.offsetTop - box.clientHeight * 0.35 + line.clientHeight / 2);
    box.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
  }, [open, activeIndex, timed]);

  if (!open) return null;
  if (!track) return <div className="tv-player tv-player-loading" role="dialog" aria-label="Now Playing" aria-live="polite"><div className="tv-loading-copy"><span className="spinner" aria-hidden="true" /><h2>Starting playback…</h2><p>Connecting to the player.</p><button type="button" className="tv-btn-secondary" style={{ marginTop: 20 }} onClick={() => setOpen(false)}>Close</button></div></div>;

  const liked = app.isFavorite(track.id);
  const playing = app.playback.player.status === 'playing' || app.playback.player.status === 'loading';
  const albumYear = (track as any).year || (track as any).releaseYear || '';
  const meshStyle = {
    ['--tv-mesh-a' as any]: rgbToCss(mesh[0]),
    ['--tv-mesh-b' as any]: rgbToCss(mesh[1]),
    ['--tv-mesh-c' as any]: rgbToCss(mesh[2]),
    ['--tv-art-glow' as any]: `radial-gradient(circle, ${rgbToCss(mesh[0], 0.42)}, transparent 65%)`,
  } as React.CSSProperties;

  return (
    <div className="tv-player" role="dialog" aria-label="Now playing" aria-modal="true" ref={rootRef} style={meshStyle}>
      <div className="tv-ambient-mesh" aria-hidden="true">
        <div className="tv-ambient-layer a" />
        <div className="tv-ambient-layer b" />
        <div className="tv-ambient-layer c" />
      </div>
      <div className="tv-player-vignette" aria-hidden="true" />

      <section className="tv-player-left" aria-label="Playback">
        <div className="tv-player-left-inner">
          <div className="tv-player-artwork" aria-hidden="true">
            {track.cover ? <img src={track.cover} alt="" /> : <div className="tv-card-media" style={{ width: '100%', height: '100%' }} />}
          </div>
          <h1 className="tv-player-title">{track.title}</h1>
          <p className="tv-player-artist">{track.artist}</p>
          {albumYear ? <p className="tv-player-album">{albumYear}</p> : <p className="tv-player-album" style={{ visibility: 'hidden' }}> </p>}

          <div className="tv-seek" aria-label="Seek">
            <div className="tv-seek-track">
              <div className="tv-seek-buffer" style={{ ['--tv-buffer' as any]: `${buffered}%`, width: `${buffered}%` } as any} />
              <div className="tv-seek-progress" style={{ ['--tv-progress' as any]: `${progress}%`, width: `${progress}%` } as any} />
            </div>
            <div className="tv-seek-times">
              <span aria-label="Elapsed time">{formatClock(pos)}</span>
              <span aria-label="Duration">{formatClock(duration)}</span>
            </div>
          </div>

          <div className="tv-transport" role="group" aria-label="Playback controls">
            <button
              type="button"
              className={`tv-transport-btn ${app.playback.shuffle !== 'off' ? 'active' : ''}`}
              aria-label={app.playback.shuffle === 'off' ? 'Shuffle off' : app.playback.shuffle === 'smart' ? 'Smart shuffle on' : 'Shuffle on'}
              aria-pressed={app.playback.shuffle !== 'off'}
              onClick={app.playback.cycleShuffle}
            >
              <Icon name={app.playback.shuffle === 'smart' ? 'sparkles' : 'shuffle'} filled={app.playback.shuffle !== 'off'} size={22} />
            </button>
            <button type="button" className="tv-transport-btn" aria-label="Previous" onClick={app.playback.previous}>
              <Icon name="previous" size={24} />
            </button>
            <button
              type="button"
              className="tv-transport-btn play"
              aria-label={playing ? 'Pause' : 'Play'}
              data-tv-autofocus="true"
              onClick={app.playback.toggle}
            >
              <Icon name={playing ? 'pause' : 'play'} size={30} />
            </button>
            <button type="button" className="tv-transport-btn" aria-label="Next" onClick={app.playback.next}>
              <Icon name="next" size={24} />
            </button>
            <button
              type="button"
              className={`tv-transport-btn ${app.playback.repeat !== 'off' ? 'active' : ''}`}
              aria-label={`Repeat ${app.playback.repeat}`}
              aria-pressed={app.playback.repeat !== 'off'}
              onClick={() => app.playback.setRepeat(app.playback.repeat === 'off' ? 'all' : app.playback.repeat === 'all' ? 'one' : 'off')}
            >
              <Icon name={app.playback.repeat === 'one' ? 'repeat_one' : 'repeat'} filled={app.playback.repeat !== 'off'} size={22} />
            </button>
            <button
              type="button"
              className={`tv-transport-btn ${liked ? 'active' : ''}`}
              aria-label={liked ? 'Remove from Favorites' : 'Add to Favorites'}
              aria-pressed={liked}
              onClick={() => app.toggleFavorite(track)}
            >
              <Icon name="heart" filled={liked} size={22} />
            </button>
          </div>
        </div>
      </section>

      <section className="tv-player-right" aria-label="Lyrics">
        <div className="tv-lyrics-viewport">
          <div className="tv-lyrics-label">LYRICS</div>
          {timed ? (
            <div className="tv-lyrics-scroll" ref={scrollRef} role="list" aria-label="Synced lyrics">
              {lines.map((line, i) => {
                const isActive = i === activeIndex;
                const isPast = i < activeIndex;
                return (
                  <button
                    key={`${line.time}-${i}`}
                    ref={isActive ? activeRef : undefined}
                    type="button"
                    role="listitem"
                    className={`tv-lyric-line ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                    tabIndex={0}
                    onClick={() => app.playback.seek(line.time * 1000)}
                  >
                    {line.text}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="tv-lyrics-status" role="status">
              {lyrics.status === 'loading' ? 'Finding lyrics…'
                : lyrics.status === 'offline' ? 'Connect to load lyrics for this song.'
                : lyrics.status === 'error' ? (lyrics.error || 'Lyrics could not be loaded.')
                : lyrics.text ? (
                  <div style={{ fontSize: 22, lineHeight: 1.5, color: 'rgba(255,255,255,.72)', whiteSpace: 'pre-wrap' }}>
                    {lyrics.text}
                  </div>
                ) : 'Lyrics unavailable for this song.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

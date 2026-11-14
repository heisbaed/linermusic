import { useEffect, useRef, useState } from 'react';
import { openTvSearch, type TvLink } from '@/shared/tvSession';
import type { SearchResult } from '@/shared/contracts';
import { useApp } from './AppContext';
import { freshCineUser } from './FirebaseAuth';
import { Icon } from './Icons';
import { TvCard, TvShelf, TvSongs } from './TvLayout';
import { TvQr } from './TvAuth';
import { searchMusicCatalog } from './musicSearch';
import { songFrom } from './Browse';
import { subscribe } from './native';

export function TvSearchScreen({ active = true }: { active?: boolean }) {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [phone, setPhone] = useState(false);
  const [link, setLink] = useState<TvLink>();
  const [phoneError, setPhoneError] = useState('');
  const request = useRef<AbortController>();
  const input = useRef<HTMLInputElement>(null);
  const user = app.account.user;

  async function run(value: string) {
    const text = value.trim().slice(0, 120);
    if (!text) return;
    request.current?.abort();
    const task = new AbortController();
    request.current = task;
    setQuery(text); setSubmitted(text); setResults([]); setStatus('loading');
    try {
      if (!app.online) throw new Error('Offline');
      const found = await searchMusicCatalog(text, 'all', task.signal);
      if (!task.signal.aborted) { setResults(found); setStatus('ready'); }
    } catch { if (!task.signal.aborted) setStatus('error'); }
  }
  const search = useRef(run);
  search.current = run;

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!active) return;
    return subscribe(event => {
      if (event.type === 'tvVoiceResult' && typeof event.data.text === 'string') void search.current(event.data.text);
    });
  }, [active]);
  useEffect(() => {
    if (!phone || !user || !active) return;
    const task = new AbortController();
    let timer: ReturnType<typeof setTimeout>, close: (() => Promise<void>) | undefined, last = '';
    setLink(undefined);
    setPhoneError('');
    const token = async () => (await freshCineUser(user)).idToken;
    void openTvSearch(user.localId, token, task.signal).then(session => {
      if (task.signal.aborted) { void session.close().catch(() => {}); return; }
      close = session.close;
      setLink({ mode: 'search', id: session.id });
      async function poll() {
        if (task.signal.aborted) return;
        if (Date.now() >= session.expiresAt) {
          setLink(undefined);
          setPhoneError('This code expired. Reopen phone search for a new code.');
          return;
        }
        try {
          const next = await session.read(task.signal);
          if (!task.signal.aborted && typeof next?.id === 'string' && next.id !== last && typeof next.text === 'string') {
            last = next.id;
            void search.current(next.text);
          }
        } catch { /* Retry transient connection failures while the link is active. */ }
        if (!task.signal.aborted) timer = setTimeout(poll, 1400);
      }
      timer = setTimeout(poll, 1400);
    }).catch(() => { if (!task.signal.aborted) setPhoneError('Could not start phone search. Try opening it again.'); });
    return () => { task.abort(); clearTimeout(timer); if (close) void close().catch(() => {}); };
  }, [phone, user?.localId, active]);

  const tracks = results.flatMap(result => result.type === 'track' ? [songFrom(result)] : []);
  const categories = [['artist', 'Artists'], ['album', 'Albums'], ['playlist', 'Playlists']] as const;
  return <section className="tv-page" aria-label="Search">
    <header className="tv-page-title"><h1>Search</h1>
      <form className="tv-search-form" onSubmit={event => {
        event.preventDefault(); window.CineAndroid?.hideTvKeyboard?.(); input.current?.blur(); void run(query);
      }}>
        <label><Icon name="search" size={25} /><input ref={input} placeholder="Songs, artists, albums" aria-label="Search music" value={query} maxLength={120}
          onClick={() => window.CineAndroid?.showTvKeyboard?.()} onChange={event => setQuery(event.target.value)} /></label>
        <button type="submit" className="tv-button tv-primary" data-tv-key="search-submit" data-tv-autofocus>Search</button>
        {window.CineAndroid?.hasTvVoice?.() && <button type="button" className="tv-button" onClick={() => window.CineAndroid?.startTvVoice?.()}>Voice</button>}
        <button type="button" className="tv-button" aria-expanded={phone} onClick={() => setPhone(value => !value)}>{phone ? 'Close phone search' : 'Type on phone'}</button>
      </form>
    </header>
    {phone && <div className="tv-phone-search">{link && <TvQr link={link} />}<p role="status">{phoneError || (link ? 'Scan, then use the same Cine Music account to search from your phone.' : 'Creating a code…')}</p></div>}
    {status === 'loading' && <p role="status">Searching for “{submitted}”…</p>}
    {status === 'error' && <div className="tv-actions"><p>Search could not connect.</p><button className="tv-button" onClick={() => void run(submitted)}>Retry</button></div>}
    {status === 'ready' && !results.length && <p>No results for “{submitted}”.</p>}
    {!!tracks.length && <><h2>Songs</h2><TvSongs songs={tracks} title={submitted} /></>}
    {categories.map(([type, label]) => {
      const items = results.filter(result => result.type === type).slice(0, 14);
      return !!items.length && <TvShelf key={type} title={label}>{items.map(item => {
        if (item.type === 'track') return null;
        return <TvCard key={item.id} id={item.id} title={item.type === 'artist' ? item.name : item.title} kind={item.type}
          subtitle={item.type === 'album' ? item.artists.map(artist => artist.name).join(', ') : item.type === 'playlist' ? item.author : undefined}
          art={item.cover?.url} action={() => app.openRoute({ kind: 'catalog', type: item.type, id: item.id })} />;
      })}</TvShelf>;
    })}
  </section>;
}

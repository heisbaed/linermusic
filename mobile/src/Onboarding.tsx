import { useEffect, useRef, useState } from 'react';
import { searchCatalog } from '@/shared/media/innertube/innertubeSearch';
import { useApp, type SavedArtist } from './AppContext';
import { Action, Brand, ConfirmDialog, Cover, Notice, SearchField, Sheet, ThemeEdition } from './ui';
import { Icon } from './Icons';
import { COUNTRY_CODES, MUSIC_GENRES, applyMusicPreferences, countryName, normalizeCountry, suggestCountry } from './musicPreferences';
import { getRegionalArtists, type RegionalArtistResult } from './regionalArtists';
import { PersonalizationArtwork } from './PersonalizationArtwork';
import './onboarding.css';

type Step = 'welcome' | 'country' | 'genres' | 'artists' | 'ready';
const steps: Step[] = ['country', 'artists', 'genres'];
const artistCache = new Map<string, { savedAt: number; artists: SavedArtist[] }>();

function countryChoices() {
  const locale = typeof navigator === 'undefined' ? 'en' : navigator.language || 'en';
  let display: Intl.DisplayNames | undefined;
  let english: Intl.DisplayNames | undefined;
  try { display = new Intl.DisplayNames([locale], { type: 'region' }); english = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* ISO codes remain readable without DisplayNames. */ }
  return COUNTRY_CODES.map(code => ({ code, name: display?.of(code) || countryName(code), english: english?.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

function WelcomeScene({ country, artists }: { country: string; artists: SavedArtist[] }) {
  function tilt(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || document.querySelector('.cine-app')?.getAttribute('data-reduced-motion') === 'true') return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--tilt-x', `${(event.clientX - box.left - box.width / 2) / box.width * 7}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${(event.clientY - box.top - box.height / 2) / box.height * -5}deg`);
  }
  return <div className="onboarding-scene" aria-hidden="true" onPointerMove={tilt} onPointerLeave={event => { event.currentTarget.style.setProperty('--tilt-x', '0deg'); event.currentTarget.style.setProperty('--tilt-y', '0deg'); }}>
    <div className="onboarding-scene-light" /><div className="onboarding-scene-object"><PersonalizationArtwork kind="headphones" /></div>
    <div className="onboarding-scene-region"><Icon name="headphones" size={16} /><span>{country ? `Discover ${countryName(country)}` : 'Your music. Your way.'}</span></div>
    <div className="onboarding-scene-portraits">{artists.filter(artist => artist.cover).slice(0, 3).map((artist, index) => <Cover key={artist.id} song={{ cover: artist.cover }} kind="artist" className={`scene-portrait-${index}`} />)}</div>
  </div>;
}

export function OnboardingScreen({ editing = false, onDone }: { editing?: boolean; onDone?: () => void }) {
  const app = useApp(), { account } = app;
  const [suggestion] = useState(suggestCountry);
  const [countries] = useState(countryChoices);
  const [step, setStep] = useState<Step>('country');
  const [direction, setDirection] = useState('forward');
  const [country, setCountry] = useState(() => normalizeCountry(account.library.taste.country) || suggestion.country);
  const [countryQuery, setCountryQuery] = useState('');
  const [genres, setGenres] = useState<string[]>(() => [...account.library.taste.genres]);
  const [genreQuery, setGenreQuery] = useState('');
  const [artists, setArtists] = useState<SavedArtist[]>(() => [...account.library.artists]);
  const [artistQuery, setArtistQuery] = useState('');
  const [results, setResults] = useState<SavedArtist[]>([]);
  const [loading, setLoading] = useState(false), [artistError, setArtistError] = useState('');
  const [regional, setRegional] = useState<RegionalArtistResult | null>(null);
  const [regionalLoading, setRegionalLoading] = useState(false), [regionalError, setRegionalError] = useState('');
  const [retry, setRetry] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const root = useRef<HTMLDivElement>(null), submitting = useRef(false), allowNavigation = useRef(false);
  const original = useRef({ taste: { ...account.library.taste }, artists: [...account.library.artists] });
  const dirty = country !== original.current.taste.country || JSON.stringify(genres) !== JSON.stringify(original.current.taste.genres) || JSON.stringify(artists.map(item => item.id)) !== JSON.stringify(original.current.artists.map(item => item.id));
  const searching = step === 'artists' && Boolean(artistQuery.trim());
  const selectedCountry = countries.find(item => item.code === country);
  const filteredCountries = countries.filter(item => fold(`${item.name} ${item.english} ${item.code} ${item.code === 'GB' ? 'UK' : item.code === 'US' ? 'USA' : ''}`).includes(fold(countryQuery.trim())));
  const shownCountries = countryQuery.trim() || !selectedCountry ? filteredCountries : [selectedCountry, ...filteredCountries.filter(item => item.code !== country)];
  const shownGenres = MUSIC_GENRES.filter(item => fold(item.label).includes(fold(genreQuery.trim())));
  const artistResults = artistQuery.trim() ? results : regional?.artists || [];
  const artistLoading = artistQuery.trim() ? loading : regionalLoading;
  const discoveryError = artistQuery.trim() ? artistError : regionalError;

  useEffect(() => {
    const frame = requestAnimationFrame(() => { root.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); root.current?.querySelector('.onboarding-body')?.scrollTo(0, 0); });
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    function leaving(event: Event) {
      if (!editing || !dirty || allowNavigation.current || !root.current?.getClientRects().length) return;
      const proceed = (event as CustomEvent<{ proceed: () => void }>).detail?.proceed;
      if (!proceed) return;
      event.preventDefault(); setDiscard(() => proceed);
    }
    window.addEventListener('cine:before-navigate', leaving);
    return () => window.removeEventListener('cine:before-navigate', leaving);
  }, [editing, dirty]);
  useEffect(() => {
    if (!normalizeCountry(country) || searching) return;
    const controller = new AbortController();
    let active = true;
    setRegional(null); setRegionalLoading(true); setRegionalError('');
    const timeout = setTimeout(() => controller.abort(), 30_000);
    void getRegionalArtists(country, controller.signal).then(data => { if (active) setRegional(data); }).catch(() => {
      if (active) setRegionalError('Regional artists could not load. Try again or search for an artist you love.');
    }).finally(() => { clearTimeout(timeout); if (active) setRegionalLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [country, searching, retry, app.online]);
  useEffect(() => {
    if (step !== 'artists' || !artistQuery.trim()) return;
    const query = artistQuery.trim();
    const key = query.toLocaleLowerCase();
    const cached = artistCache.get(key);
    if (cached && Date.now() - cached.savedAt < 300_000) { setResults(cached.artists); setArtistError(''); setLoading(false); return; }
    const controller = new AbortController();
    let active = true, timedOut = false;
    setResults([]); setArtistError(''); setLoading(true);
    const timer = setTimeout(async () => {
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 18_000);
      try {
        if (!app.online) throw new Error('offline');
        const responses = await Promise.allSettled([searchCatalog(query, 'artist', controller.signal)]);
        if (!active || controller.signal.aborted) { if (timedOut) throw new Error('timeout'); return; }
        const found = responses.flatMap(response => response.status === 'fulfilled' ? response.value.flatMap(item => item.type === 'artist' ? [{ id: item.id, name: item.name, cover: item.cover?.url }] : []) : []);
        if (!found.length && responses.some(response => response.status === 'rejected')) throw new Error('connection');
        const unique = [...new Map(found.map(item => [item.id, item])).values()].slice(0, 18);
        artistCache.set(key, { savedAt: Date.now(), artists: unique });
        if (artistCache.size > 24) artistCache.delete(artistCache.keys().next().value!);
        setResults(unique);
      } catch {
        if (active) setArtistError(timedOut ? 'The connection is taking a little longer. Try again when you are ready.' : 'We could not load artists. Check your connection and try again.');
      } finally { clearTimeout(timeout); if (active) setLoading(false); }
    }, query ? 300 : 0);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [step, artistQuery, retry, app.online]);

  function move(next: Step) { setDirection(steps.indexOf(next) < steps.indexOf(step) ? 'back' : 'forward'); setError(''); setStep(next); }
  function leave() { if (onDone) onDone(); else app.back(); }
  function back() {
    if (submitting.current) return;
    if (step === 'welcome') { window.CineAndroid?.background(); return; }
    if (step === 'country') { if (editing) leave(); else window.CineAndroid?.background(); return; }
    move(steps[steps.indexOf(step) - 1]);
  }
  function toggleArtist(artist: SavedArtist) { setArtists(items => items.some(item => item.id === artist.id) ? items.filter(item => item.id !== artist.id) : [...items, artist]); }
  function savePreferences() {
    if (submitting.current) return;
    if (!normalizeCountry(country)) { move('country'); setError('Choose your country or region before continuing.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      let applied = false;
      account.setLibrary(library => { applied = true; return applyMusicPreferences(library, { country, genres, completed: true }, artists, original.current.artists.map(artist => artist.id)); });
      if (!applied) throw new Error('Your account is busy. Try again in a moment.');
      allowNavigation.current = true;
      if (editing) leave();
      // The account-scoped completed flag opens Home. No guarded navigation or second completion screen is needed.
      app.toast(editing ? 'Music preferences updated.' : 'Your music space is ready.');
    } catch (reason) { submitting.current = false; setBusy(false); setError(reason instanceof Error ? reason.message : 'Your choices could not be saved. Please try again.'); }
  }
  function next() { if (step === 'country') { if (normalizeCountry(country)) move('artists'); else setError('Choose your country or region.'); } else if (step === 'artists') move('genres'); else savePreferences(); }
  const stepNumber = steps.indexOf(step);
  const primary = step === 'genres' ? editing ? 'Save preferences' : 'Start listening' : 'Continue';
  return <Sheet title={editing ? 'Music preferences' : 'Personalize your music'} full header={false} onClose={back} className="personalization-modal">
    <div className="music-onboarding" data-onboarding-step={step === 'welcome' ? 'welcome' : String(stepNumber)} data-direction={direction} ref={root}>
      <header className="onboarding-header"><Action icon="back" label={editing && step === 'country' ? 'Back to settings' : 'Previous step'} disabled={busy} onClick={back} /><Brand compact /><span className="onboarding-step-count">{`${String(stepNumber + 1).padStart(2, '0')} / 03`}</span></header>
      <ol className="onboarding-progress" aria-label="Setup progress">{['Your region', 'Your artists', 'Your genres'].map((label, index) => <li key={label} aria-current={index === stepNumber ? 'step' : undefined} aria-label={label} data-state={index === stepNumber ? 'current' : index < stepNumber ? 'done' : 'next'}><i /></li>)}</ol>
      <div className="onboarding-body">
        <section className={`onboarding-stage onboarding-stage-${step}`} key={step}>
          {step === 'welcome' ? <><WelcomeScene country={country} artists={regional?.artists || []} /><div className="onboarding-intro-copy"><p className="onboarding-eyebrow">Your taste. Center stage.</p><h1 tabIndex={-1}>A world of music.<br /><span>Your kind of rhythm.</span></h1><p>From familiar voices to your next discovery.<br />Let's make Cine music feel like you.</p></div></> : step === 'ready' ? <><div className="onboarding-ready-art"><PersonalizationArtwork kind="record" cover={artists.find(artist => artist.cover)?.cover} /><span className="onboarding-ready-mark"><Icon name="check" size={19} /></span></div><div className="onboarding-intro-copy"><p className="onboarding-eyebrow">Your next favorite is out there.</p><h1 tabIndex={-1}>Your music.<br /><span>Ready to discover.</span></h1><p>Save your choices and step into a Home shaped around your region, your sound, and real artists.</p></div><div className="onboarding-summary"><span className="onboarding-summary-symbol"><Brand compact /></span><span><strong>{selectedCountry?.name || countryName(country)}</strong><small>{genres.length} {genres.length === 1 ? 'genre' : 'genres'} / {artists.length} {artists.length === 1 ? 'artist' : 'artists'} selected</small></span><Action icon="edit" label="Review personalization choices" onClick={() => move('country')} /></div></> : <>
            <div className="onboarding-heading"><p className="onboarding-eyebrow">{step === 'country' ? 'A little closer to you' : step === 'genres' ? 'The sounds that move you' : 'Find your people'}</p><h1 tabIndex={-1}>{step === 'country' ? 'Where are you\ntuning in from?' : step === 'genres' ? 'What moves\nyour soul?' : 'Who do you\nlove listening to?'}</h1>{step === 'country' && <div className="onboarding-country-art"><PersonalizationArtwork kind="world" /></div>}<p>{step === 'country' ? 'Your location shapes your charts and recommendations.' : step === 'genres' ? 'Pick genres that resonate. Mix freely.' : 'Choose the artists that make your world sound better.'}</p></div>
            {step === 'country' && <><div className="onboarding-region"><span><small>{!editing && country === suggestion.country && suggestion.source !== 'none' ? 'Suggested from your device region' : 'Your listening region'}</small><strong>{selectedCountry?.name || 'Choose your region'}</strong></span>{selectedCountry && <span className="onboarding-region-code">{country}</span>}</div><SearchField value={countryQuery} onChange={setCountryQuery} placeholder="Search countries and regions" label="Search countries and regions" /><div className="onboarding-countries" role="radiogroup" aria-label="Listening country or region">{shownCountries.map(item => <label className="onboarding-country-option" key={item.code} data-selected={country === item.code}><input type="radio" name="music-country" value={item.code} checked={country === item.code} onChange={() => { setCountry(item.code); setError(''); }} /><span className="onboarding-country-code">{String.fromCodePoint(...item.code.split('').map(letter => 127397 + letter.charCodeAt(0)))}</span><span className="onboarding-country-name">{item.name}</span><span className="onboarding-radio-mark">{country === item.code && <Icon name="check" size={16} />}</span></label>)}{!shownCountries.length && <p className="onboarding-empty">No matching regions. Try another name or country code.</p>}</div><p className="onboarding-optional">We suggest a device or network region, not a precise GPS location.</p></>}
            {step === 'genres' && <><div className="onboarding-selection-note"><span>Your mix, your way.</span><strong>{genres.length} / 8 selected</strong></div><SearchField value={genreQuery} onChange={setGenreQuery} placeholder="Find a genre" label="Filter music genres" /><div className="onboarding-genres" aria-label="Preferred music genres">{shownGenres.map((genre, index) => { const selected = genres.includes(genre.id); return <button type="button" key={genre.id} aria-pressed={selected} disabled={!selected && genres.length >= 8} style={{ '--genre-tone': ['#00d9f2', '#a598e5', '#83cbb3', '#d5ad8b'][index % 4] } as React.CSSProperties} onClick={() => setGenres(items => selected ? items.filter(item => item !== genre.id) : [...items, genre.id])}><span className="onboarding-genre-tone" /><span>{genre.label}</span><span className="onboarding-genre-check"><Icon name={selected ? 'check' : 'plus'} size={16} /></span></button>; })}</div>{!shownGenres.length && <p className="onboarding-empty">No matching genres. Try a different name.</p>}<p className="onboarding-optional">Not sure yet? You can continue without picking a genre.</p></>}
            {step === 'artists' && <>
              {artists.length > 0 && <div className="onboarding-selected-artists" aria-label="Selected artists">{artists.map(artist => <button type="button" key={artist.id} aria-label={`Remove ${artist.name} from selection`} onClick={() => toggleArtist(artist)}><Cover song={{ cover: artist.cover }} kind="artist" /><span>{artist.name}</span><Icon name="close" size={14} /></button>)}</div>}
              <SearchField value={artistQuery} onChange={value => { setArtistQuery(value); setLoading(Boolean(value.trim())); }} placeholder="Search artists you love" label="Search artists" />
              <div className="onboarding-selection-note"><span>{artistQuery.trim() ? 'Search results' : `Artists associated with ${selectedCountry?.name || countryName(country)}`}</span><strong>{artists.length} selected</strong></div>
              {!artistQuery.trim() && regional?.stale && <p className="onboarding-source-note" role="status">Previously loaded suggestions. Reconnect to refresh them.</p>}
              {artistLoading ? <><p className="onboarding-loading" role="status">Finding your next favorites...</p><div className="onboarding-artist-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="onboarding-artist-skeleton" key={index}><i /><span /></div>)}</div></> : discoveryError ? <Notice icon="artist" title="Artists could not load" action={<button type="button" className="secondary-button" onClick={() => setRetry(value => value + 1)}>Try again</button>}>{discoveryError} You can also finish setup and discover artists later.</Notice> : <div className="onboarding-artist-grid">{artistResults.map(artist => { const selected = artists.some(item => item.id === artist.id); return <button type="button" className="onboarding-artist" key={artist.id} aria-pressed={selected} aria-label={`${selected ? 'Unfollow' : 'Follow'} ${artist.name}`} onClick={() => toggleArtist(artist)}><span className="onboarding-portrait"><Cover song={{ cover: artist.cover }} kind="artist" /><span className="onboarding-artist-check"><Icon name={selected ? 'check' : 'plus'} size={16} /></span></span><strong>{artist.name}</strong><small>{selected ? 'Selected' : 'Artist'}</small></button>; })}</div>}
              {!artistLoading && !discoveryError && !artistResults.length && <p className="onboarding-empty">{artistQuery.trim() ? 'No matching artists. Try another name.' : 'No country-matched artists are available yet. Search for an artist from anywhere, or continue.'}</p>}
              <p className="onboarding-source-note">{artistQuery.trim() ? 'Names and artwork come from the music catalog.' : 'Country associations: MusicBrainz. Artist artwork: music catalog.'}</p>
              <p className="onboarding-optional">Your choices are saved when you {editing ? 'save preferences' : 'start listening'}. No music plays during setup.</p>
            </>}
          </>}
        </section>
      </div>
      <footer className="onboarding-footer" data-final={step === 'genres'}><div className="onboarding-theme"><ThemeEdition changeLabel /></div>{error && <p className="onboarding-error" role="alert">{error}</p>}<div>{step !== 'ready' && <button type="button" className="onboarding-skip" disabled={busy} onClick={editing ? leave : savePreferences}>{editing ? 'Cancel' : 'Skip for now'}</button>}<button type="button" className="primary-button" disabled={busy || step === 'country' && !normalizeCountry(country)} onClick={next}>{busy ? <><span className="spinner" />Saving...</> : <>{primary}<Icon name="chevron_right" size={19} /></>}</button></div><p>{step === 'welcome' ? 'Personal by choice. Private by default.' : 'You can change these preferences any time.'}</p></footer>
    </div>
    {discard && <ConfirmDialog title="Discard music preferences?" confirmLabel="Discard" destructive onClose={() => setDiscard(null)} onConfirm={() => { allowNavigation.current = true; const proceed = discard; setDiscard(null); proceed(); }}>Your saved preferences will stay unchanged.</ConfirmDialog>}
  </Sheet>;
}

import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { approveTvLink, openTvLink, parseTvLink, sendTvSearch, tvLink, type TvLink } from '@/shared/tvSession';
import { freshCineUser, lookupCineUser, refreshCineUser, type CineUser } from './FirebaseAuth';
import { Brand } from './ui';

export function TvQr({ link }: { link: TvLink }) {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(tvLink(link));
    qr.make();
    return qr.createDataURL(8, 32);
  }, [link.mode, link.id]);
  return <img className="tv-qr" src={src} alt="Scan with your phone camera" />;
}

export function TvAuth({ onSuccess }: { onSuccess: (user: CineUser) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [link, setLink] = useState<TvLink>();
  const [status, setStatus] = useState('Creating a sign-in code…');
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer: ReturnType<typeof setTimeout>;
    setLink(undefined);
    setStatus('Creating a sign-in code…');
    void openTvLink(signal).then(session => {
      if (signal.aborted) return;
      setLink({ mode: 'link', id: session.id });
      setStatus('Scan with your phone camera, then approve from your Cine Music account.');
      async function poll() {
        if (signal.aborted) return;
        if (Date.now() >= session.expiresAt) {
          setLink(undefined);
          setStatus('This code expired. Get a new code to continue.');
          return;
        }
        try {
          const approval = await session.receive(signal);
          if (approval && !signal.aborted) {
            const session = await refreshCineUser({ localId: approval.uid, refreshToken: approval.refreshToken, idToken: '', email: '', expiresAt: 0 });
            const user = await lookupCineUser(session, false);
            if (!user.emailVerified) throw new Error('Verify your account email first.');
            if (!signal.aborted) onSuccess(user);
            return;
          }
        } catch {
          if (!signal.aborted) setStatus('Waiting for approval. Check your connection if this takes a while.');
        }
        if (!signal.aborted) timer = setTimeout(poll, 2200);
      }
      timer = setTimeout(poll, 1600);
    }).catch(() => {
      if (!signal.aborted) setStatus('Could not connect. Check Wi-Fi and get a new code.');
    });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [attempt]);
  return <main className="tv-auth">
    <div className="tv-auth-copy">
      <Brand />
      <h1>Sign in on your TV</h1>
      <p role="status">{status}</p>
      <button type="button" className="tv-button tv-primary" data-tv-autofocus onClick={() => setAttempt(value => value + 1)}>Get a new code</button>
    </div>
    <div className="tv-auth-code">{link ? <TvQr link={link} /> : <span className="tv-spinner" aria-hidden="true" />}</div>
  </main>;
}

export function PhoneTvLink({ link, user, onClose }: { link: TvLink; user: CineUser; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const pairing = link.mode === 'link';
  async function submit() {
    setBusy(true);
    setMessage('');
    try {
      const fresh = await freshCineUser(user);
      if (pairing) { await approveTvLink(link, fresh); setLinked(true); }
      else await sendTvSearch(link, fresh.idToken, value);
      setMessage(pairing ? 'Your TV is linked.' : 'Search sent to your TV.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not reach your TV.'); }
    finally { setBusy(false); }
  }
  return <main className="screen account-screen auth-screen auth-gate">
    <form className="auth-panel account-auth" aria-label={pairing ? 'Link your TV' : 'Search on your TV'} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <Brand />
      <h1>{pairing ? 'Link your TV' : 'Search on your TV'}</h1>
      {pairing ? <p>Approve sign-in for {user.email}. Only approve a code you scanned from your TV.</p>
        : <label className="account-field">Song, artist, or album<input value={value} maxLength={120} onChange={event => setValue(event.target.value)} /></label>}
      {message && <p role="status">{message}</p>}
      {!linked && <button className="account-primary" disabled={busy || (!pairing && !value.trim())}>{busy ? 'Connecting…' : pairing ? 'Approve sign-in' : 'Send search'}</button>}
      <button className="account-secondary" type="button" onClick={onClose}>{linked ? 'Done' : 'Close'}</button>
    </form>
  </main>;
}
export function consumePhoneTvLink() { return parseTvLink(window.CineAndroid?.consumeTvLink?.() || location.href); }

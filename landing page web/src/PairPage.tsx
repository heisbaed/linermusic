import { useState, type FormEvent } from 'react';
import { approveTvLink, parseTvLink, sendTvSearch } from '../../src/shared/tvSession';

interface BrowserUser { email: string; localId: string; idToken: string; refreshToken: string }
const apiKey = 'AIzaSyDoF0hqFQOBiHtfnNcmytced4BaMt74dZQ';

async function authCall(method: string, body: object) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + method + '?key=' + apiKey, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Sign-in failed. Check your email and password or use the Cine Music app.');
  return response.json();
}

export function PairPage() {
  const [link] = useState(() => parseTvLink(window.location.href));
  const [user, setUser] = useState<BrowserUser>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const search = link?.mode === 'search';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!link || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!user) {
        const session: BrowserUser = await authCall('signInWithPassword', { email, password, returnSecureToken: true });
        const account = await authCall('lookup', { idToken: session.idToken });
        if (account.users?.[0]?.emailVerified !== true) throw new Error('Verify your Cine Music email before connecting your TV.');
        setPassword('');
        setUser(session);
      } else if (link.mode === 'search') {
        await sendTvSearch(link, user.idToken, query);
        setMessage('Search sent to your TV.');
      } else {
        await approveTvLink(link, user);
        setLinked(true);
        setMessage('Your TV is linked. You can close this page.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not reach your TV.'); }
    finally { setBusy(false); }
  }
  return <main className="download-page" style={{ minHeight: '78vh', padding: '52px 20px' }}>
    <form className="section-shell" style={{ maxWidth: 490, margin: '0 auto', display: 'grid', gap: 18 }} onSubmit={submit} autoComplete="on">
      <h1>{search ? 'Search on your TV' : 'Link your Cine Music TV'}</h1>
      {!link ? <p>Open Cine Music on your TV and scan the new QR code to continue.</p> : !linked && <>
        {!user ? <>
          <a className="button primary" href={'cinemusic://pair?mode=' + link.mode + '&id=' + link.id}>Open Cine Music</a>
          <p>Sign in here with your Cine Music email and password.</p>
          <label>Email<input className="tv-connect-input" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>Password<input className="tv-connect-input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        </> : search ? <label>Song, artist, or album<input className="tv-connect-input" required maxLength={120} value={query} onChange={event => setQuery(event.target.value)} /></label>
          : <p>Approve sign-in for {user.email}. Only approve a code you scanned from your TV.</p>}
        <button className="button secondary" disabled={busy}>{busy ? 'Connecting…' : !user ? 'Sign in' : search ? 'Send search' : 'Approve sign-in'}</button>
      </>}
      {message && <p role="status">{message}</p>}
    </form>
  </main>;
}

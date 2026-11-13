import type { CineUser } from './FirebaseAuth';

const RTDB_URL = 'https://cinemusic-1-default-rtdb.firebaseio.com';

export interface TvPairingData {
  status: 'pending' | 'approved' | 'expired';
  createdAt: number;
  expiresAt: number;
  approvedAt?: number;
  user?: CineUser;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createRandomPairingCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

export async function createTvPairing(code: string): Promise<void> {
  const payload: TvPairingData = {
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
  };

  const res = await fetch(`${RTDB_URL}/tvPairings/${encodeURIComponent(code)}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error('Failed to register TV pairing code in Firebase.');
  }
}

export function listenToTvPairing(
  code: string,
  onApproved: (user: CineUser) => void,
  onExpired: () => void,
): () => void {
  let active = true;

  const check = async () => {
    if (!active) return;
    try {
      const res = await fetch(`${RTDB_URL}/tvPairings/${encodeURIComponent(code)}.json?ts=${Date.now()}`);
      if (!res.ok) return;
      const data = (await res.json()) as TvPairingData | null;
      if (!data) return;

      if (data.status === 'approved' && data.user) {
        active = false;
        // Clean up from database
        fetch(`${RTDB_URL}/tvPairings/${encodeURIComponent(code)}.json`, { method: 'DELETE' }).catch(() => {});
        onApproved(data.user);
        return;
      }

      if (data.expiresAt && Date.now() > data.expiresAt) {
        active = false;
        onExpired();
        return;
      }
    } catch {
      // transient network hiccup, retry next interval
    }
  };

  const interval = setInterval(check, 2000);
  check();

  return () => {
    active = false;
    clearInterval(interval);
  };
}

export async function approveTvPairingSession(code: string, user: CineUser): Promise<boolean> {
  const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanCode.length !== 6) throw new Error('Pairing code must be 6 characters.');

  // Check if session exists
  const checkRes = await fetch(`${RTDB_URL}/tvPairings/${encodeURIComponent(cleanCode)}.json`);
  if (!checkRes.ok) throw new Error('Could not reach pairing database.');
  const data = (await checkRes.json()) as TvPairingData | null;
  if (!data || data.status !== 'pending' || (data.expiresAt && Date.now() > data.expiresAt)) {
    throw new Error('This TV pairing code has expired or is invalid. Check the code on your TV screen.');
  }

  const payload: Partial<TvPairingData> = {
    status: 'approved',
    approvedAt: Date.now(),
    user: {
      localId: user.localId,
      email: user.email,
      idToken: user.idToken,
      refreshToken: user.refreshToken,
      displayName: user.displayName || user.email.split('@')[0],
      expiresAt: user.expiresAt,
      emailVerified: true,
    },
  };

  const res = await fetch(`${RTDB_URL}/tvPairings/${encodeURIComponent(cleanCode)}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

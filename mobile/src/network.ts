type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function networkInfo(): NetworkInformationLike | undefined {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

/** Android WebView can leave navigator.onLine stuck at false while the link is live. */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (navigator.onLine) return true;
  const info = networkInfo();
  if (!info) return false;
  const type = info.effectiveType;
  if (!type || type === 'none') return false;
  if (typeof info.downlink === 'number' && info.downlink > 0) return true;
  return type === '3g' || type === '4g';
}

export function onConnectivityChange(handler: () => void): () => void {
  const info = networkInfo();
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('focus', handler);
  info?.addEventListener?.('change', handler);
  const poll = window.setInterval(handler, 15_000);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
    document.removeEventListener('visibilitychange', handler);
    window.removeEventListener('focus', handler);
    info?.removeEventListener?.('change', handler);
    window.clearInterval(poll);
  };
}

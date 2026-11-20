import './native';
import './startup.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initTvSpatialNav, isTvEnvironment } from './spatialNav';
import { initAnalytics } from './analytics';

if (isTvEnvironment()) {
  document.documentElement.classList.add('is-tv');
  document.body.classList.add('is-tv');
}
if (isTvEnvironment()) initTvSpatialNav();
initAnalytics();
window.setTimeout(() => { try { window.CineAndroid?.autoCheckForUpdates?.(); } catch {} }, 5000);

const App = React.lazy(() => import.meta.env.VITE_CINE_PLATFORM === 'tv' ? import('./TvApp')
  : import.meta.env.VITE_CINE_PLATFORM === 'mobile' ? import('./CineApp')
  : isTvEnvironment() ? import('./TvApp') : import('./CineApp'));

class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { window.CineAndroid?.appReady?.(); }
  render() {
    return this.state.failed ? <main className="recovery"><h1>Cine music</h1><p>Something interrupted this screen. Try opening Cine Music again.</p><button className="primary" onClick={() => location.reload()}>Open again</button></main> : this.props.children;
  }
}
const startup = window.CineAndroid ? null : <div className="cine-startup" role="status" aria-label="Opening Cine Music">
  <div className="cine-startup-brand"><div className="cine-startup-logo"><img src="/cine-brand.svg" alt="" /></div><span>Cine music</span></div>
  <p>By Osborne's Digital Solutions</p>
</div>;
function StartupReady() {
  React.useEffect(() => { window.CineAndroid?.appReady?.(); }, []);
  return null;
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><React.Suspense fallback={startup}><App /><StartupReady /></React.Suspense></ErrorBoundary>);

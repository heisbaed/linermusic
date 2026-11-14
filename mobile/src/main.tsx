import './native';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { initTvSpatialNav, isTvEnvironment } from './spatialNav';

if (isTvEnvironment()) {
  document.documentElement.classList.add('is-tv');
  document.body.classList.add('is-tv');
}
if (isTvEnvironment()) initTvSpatialNav();

const App = React.lazy(() => isTvEnvironment() ? import('./TvApp') : import('./CineApp'));

class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="recovery"><h1>Cine music</h1><p>Something interrupted this screen. Try opening Cine Music again.</p><button className="primary" onClick={() => location.reload()}>Open again</button></main> : this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><React.Suspense fallback={null}><App /></React.Suspense></ErrorBoundary>);

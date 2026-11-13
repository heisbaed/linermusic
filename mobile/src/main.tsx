import './native';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './CineApp';
import './cine.css';
import './design.css';
import './liquid.css';
import './tv.css';
import './tv-redesign.css';
import { initTvSpatialNav, isTvEnvironment } from './spatialNav';

if (isTvEnvironment()) {
  const vp = document.querySelector('meta[name="viewport"]');
  // 1080p canvas (1920x1080) per 10-foot spec; 720p WebViews scale the fixed layout.
  if (vp) vp.setAttribute('content', 'width=1920,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
  document.documentElement.classList.add('is-tv');
  document.body.classList.add('is-tv');
}
initTvSpatialNav();

class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="recovery"><h1>Cine music</h1><p>Something interrupted this screen. Your downloads are still saved.</p><button className="primary" onClick={() => location.reload()}>Open again</button></main> : this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);

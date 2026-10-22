import './native';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './CineApp';
import './cine.css';

class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="recovery"><h1>Cine music</h1><p>Something interrupted this screen. Your downloads are still saved.</p><button className="primary" onClick={() => location.reload()}>Open again</button></main> : this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);

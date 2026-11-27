import { useState } from 'react';
import { useApp } from './AppContext';
import './app-icons.css';

const icons = [
  { id: 'forest', name: 'Forest Original' }, { id: 'mint', name: 'Forest Mint' },
  { id: 'rose', name: 'Midnight Rose' }, { id: 'ivory', name: 'Charcoal Ivory' },
];
export function AppIconSettings() {
  const app = useApp();
  const [selected, setSelected] = useState(() => window.CineAndroid?.appIcon?.() || 'forest');
  const supported = !!window.CineAndroid?.setAppIcon;
  return <section className="app-icon-settings"><h2>App icon</h2><p>Choose the icon shown on your home screen.</p>
    <div className="app-icon-options" role="radiogroup" aria-label="App icon">{icons.map(icon => <button type="button" key={icon.id} role="radio" aria-checked={selected === icon.id} disabled={!supported} onClick={() => {
      try {
        if (!window.CineAndroid?.setAppIcon?.(icon.id)) { app.toast('The icon could not be changed. Please try again.'); return; }
        setSelected(icon.id); app.toast('App icon changed. Your launcher may take a moment to refresh.');
      } catch { app.toast('The icon could not be changed. Please try again.'); }
    }}><img src={`/app-icons/${icon.id}.png`} alt=""/><span>{icon.name}</span>{selected === icon.id && <small>Selected</small>}</button>)}</div>
    {!supported && <p>Install the latest Android app to change your launcher icon.</p>}
  </section>;
}

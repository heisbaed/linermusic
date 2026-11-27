import { useEffect, useState } from 'react';
import { useApp } from './AppContext';
import './app-icons.css';
import { iconThemes, themeIcons } from './themeIcons';

const icons = [
  { id: 'forest', name: 'Dark green' }, { id: 'mint', name: 'Smoke white' },
  { id: 'rose', name: 'Pink glass' }, { id: 'ivory', name: 'Dark' },
];
export function AppIconSettings() {
  const app = useApp();
  const [selected, setSelected] = useState(() => window.CineAndroid?.appIcon?.() || 'forest');
  const supported = !!window.CineAndroid?.setAppIcon;
  useEffect(()=>setSelected(themeIcons[app.theme]),[app.theme]);
  return <section className="app-icon-settings"><h2>Theme & app icon</h2><p>Your app icon follows your theme. Choose either to change both.</p>
    <div className="app-icon-options" role="radiogroup" aria-label="App icon">{icons.map(icon => <button type="button" key={icon.id} role="radio" aria-checked={selected === icon.id} disabled={!supported} onClick={() => {
      try {
        if (!window.CineAndroid?.setAppIcon?.(icon.id)) { app.toast('The icon could not be changed. Please try again.'); return; }
        setSelected(icon.id); app.setTheme(iconThemes[icon.id]); app.toast('Theme and app icon changed. Your launcher may take a moment to refresh.');
      } catch { app.toast('The icon could not be changed. Please try again.'); }
    }}><img src={`/app-icons/${icon.id}.png`} alt=""/><span>{icon.name}</span>{selected === icon.id && <small>Selected</small>}</button>)}</div>
    {!supported && <p>Install the latest Android app to change your launcher icon.</p>}
  </section>;
}

import { useState } from 'react';
import { useApp } from './AppContext';
import { ConfirmDialog, Cover, Sheet, SongRows, SortControl } from './ui';
import type { Song } from './types';

export function CollectionSongs({ songs, context, hearts = false, onRemove, hideSort = false }: {
  songs: Song[]; context: string; hearts?: boolean; onRemove?: (ids: Set<string>) => void; hideSort?: boolean;
}) {
  const app = useApp();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState('saved');
  const [action, setAction] = useState<'playlist' | 'remove' | 'download' | null>(null);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState(40);
  const visible = [...songs];
  if (sort === 'title') visible.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'artist') visible.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  if (sort === 'duration') visible.sort((a, b) => a.durationMs - b.durationMs);
  const picked = songs.filter(song => selected.has(song.id));
  function finish() { setAction(null); setSelecting(false); setSelected(new Set()); }
  return <>
    <div className="collection-tools">{!hideSort && <SortControl label={`Sort ${context} songs`} value={sort} onChange={setSort} options={[{value:'saved',label:'Saved order'},{value:'title',label:'Title'},{value:'artist',label:'Artist'},{value:'duration',label:'Duration'}]} />}<button className="text-button" onClick={() => { setSelecting(value => !value); setSelected(new Set()); }}>{selecting ? 'Done' : 'Select songs'}</button></div>
    {selecting ? <>
      <div className="collection-selection" role="group" aria-label="Selected song actions"><span role="status">{picked.length} selected</span><button className="text-button" onClick={() => setSelected(picked.length === songs.length ? new Set() : new Set(songs.map(song => song.id)))}>{picked.length === songs.length ? 'Deselect all' : 'Select all'}</button><button className="text-button" disabled={!picked.length} onClick={() => setAction('playlist')}>Add to playlist</button><button className="text-button" disabled={!picked.length} onClick={() => {
        app.account.setLibrary(library => ({ ...library, favorites: [...picked.filter(song => !library.favorites.some(item => item.id === song.id)), ...library.favorites] }));
        app.toast('Selected songs saved to Favorites.'); finish();
      }}>Favorite</button><button className="text-button" disabled={!picked.length} onClick={() => setAction('download')}>Download</button>{onRemove && <button className="text-button" disabled={!picked.length} onClick={() => setAction('remove')}>Remove</button>}</div>
      <div className="selection-songs">{visible.slice(0, limit).map(song => <label className="selection-song" key={song.id}><input type="checkbox" aria-label={`Select ${song.title}`} checked={selected.has(song.id)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(song.id); else next.delete(song.id); return next; })} /><Cover song={song} /><span className="row-copy"><strong>{song.title}</strong><small>{song.artist}</small></span></label>)}</div>
    </> : <SongRows songs={visible.slice(0, limit)} queueSongs={visible} context={context} showHearts={hearts} />}
    {visible.length > limit && <button className="secondary-button" onClick={() => setLimit(value => value + 40)}>Show more songs</button>}
    {action === 'playlist' && <Sheet title="Add selected songs" onClose={() => setAction(null)}><div className="bulk-playlist-options">{app.account.library.playlists.map(playlist => <button className="list-link" key={playlist.id} onClick={() => {
      app.account.setLibrary(library => ({ ...library, playlists: library.playlists.map(item => item.id === playlist.id ? { ...item, songs: [...item.songs, ...picked.filter(song => !item.songs.some(old => old.id === song.id))] } : item) }));
      app.toast(`Songs added to ${playlist.name}.`); finish();
    }}><Cover kind="playlist" song={{ title: playlist.name, cover: playlist.cover || playlist.songs[0]?.cover }} /><span>{playlist.name}</span></button>)}<form onSubmit={event => {
      event.preventDefault(); if (!name.trim() || !picked.length) return;
      const playlist = { id: crypto.randomUUID(), name: name.trim(), songs: picked, isPublic: false };
      app.account.setLibrary(library => ({ ...library, playlists: [playlist, ...library.playlists] }));
      app.toast('Private playlist created.'); setName(''); finish();
    }}><label className="field-label">New playlist name<input value={name} required maxLength={80} onChange={event => setName(event.target.value)} /></label><button className="primary-button" type="submit" disabled={!name.trim()}>Create playlist</button></form></div></Sheet>}
    {action === 'download' && <ConfirmDialog title={`Download ${picked.length} songs?`} confirmLabel="Download songs" onClose={() => setAction(null)} onConfirm={() => {
      if (!app.online) { app.toast('Connect to the internet to download songs.'); return; }
      if (app.prefs.wifiOnly && !window.CineAndroid?.isWifiConnected()) { app.toast('Connect to Wi-Fi or change your download preference.'); return; }
      void app.downloadMany(picked);
      finish();
    }}><p>Completed songs stay inside Cine music. {app.prefs.wifiOnly ? 'Wi-Fi-only downloads are enabled.' : 'Mobile data may be used.'}</p></ConfirmDialog>}
    {action === 'remove' && <ConfirmDialog title={`Remove ${picked.length} songs?`} confirmLabel="Remove selected" destructive onClose={() => setAction(null)} onConfirm={() => { onRemove?.(new Set(picked.map(song => song.id))); finish(); }}><p>The selected songs will be removed from {context}.</p></ConfirmDialog>}
  </>;
}

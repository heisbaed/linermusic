import { useEffect, useRef, useState } from 'react';
import { isAndroid, readDownloads, readDownloadJobs, subscribe, configureDownloads } from './native';
import { isOnline } from './network';
import type { DownloadJob, Preferences } from './AppContext';
import type { Song } from './types';

function jobsFrom(value: unknown): DownloadJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const song = item?.track || item?.song;
    return song?.id && ['queued', 'downloading', 'paused', 'failed'].includes(item.status)
      ? [{ id: song.id, song, status: item.status, progress: Number(item.progress) || 0, error: item.error, bytes: Number(item.bytes) || 0, totalBytes: Number(item.totalBytes) || 0, bytesPerSecond: Number(item.bytesPerSecond) || 0 } as DownloadJob] : [];
  });
}

/** Native service owns the persistent queue. UI navigation must never own a transfer. */
export function useDownloads(prefs: Preferences, toast: (message: string) => void, disabled = false) {
  const [downloads, setDownloads] = useState<Song[]>(() => disabled ? [] : readDownloads());
  const [jobs, setJobs] = useState<DownloadJob[]>(() => disabled ? [] : jobsFrom(readDownloadJobs()));
  const current = useRef({ downloads, jobs, prefs, toast, disabled });
  current.current = { downloads, jobs, prefs, toast, disabled };
  function refreshDownloads() {
    if (current.current.disabled) { setDownloads([]); setJobs([]); return; }
    setDownloads(readDownloads()); setJobs(jobsFrom(readDownloadJobs()));
  }
  useEffect(() => { if (!disabled) configureDownloads(prefs.wifiOnly); }, [prefs.wifiOnly, disabled]);
  useEffect(() => {
    if (disabled) { setDownloads([]); setJobs([]); return; }
    return subscribe(event => {
      if (event.type === 'downloads') {
        const complete = Array.isArray(event.data.items) ? event.data.items as Song[] : readDownloads();
        const added = complete.find(song => !current.current.downloads.some(item => item.id === song.id));
        current.current.downloads = complete; setDownloads(complete);
        setJobs(items => items.filter(item => !complete.some(song => song.id === item.id)));
        if (added) current.current.toast(`${added.title} is ready to play offline in Cine music.`);
      }
      if (event.type === 'downloadJobs') { const next = jobsFrom(event.data.items); current.current.jobs = next; setJobs(next); }
      if (event.type === 'downloadProgress') {
        const next = jobsFrom([event.data])[0];
        const jobs = current.current.jobs.filter(job => job.id !== event.data.id);
        if (next) {
          const index = current.current.jobs.findIndex(job => job.id === next.id);
          jobs.splice(index < 0 ? jobs.length : index, 0, next);
        }
        current.current.jobs = jobs; setJobs(jobs);
      }
      if (event.type === 'downloadError') current.current.toast(String(event.data.message || 'Download failed. Retry from Downloads.'));
    });
  }, [disabled]);
  function download(song: Song) {
    if (current.current.disabled) return;
    if (!isAndroid) { toast('Protected offline downloads are available in the Android app.'); return; }
    if (current.current.downloads.some(item => item.id === song.id)) { toast('This song is already ready offline.'); return; }
    const existing = current.current.jobs.find(item => item.id === song.id);
    if (existing && existing.status !== 'failed') { toast(existing.status === 'paused' ? 'Resume this download from Library > Downloads.' : 'This song is already in the download queue.'); return; }
    if (!isOnline()) { toast('Connect to the internet to download this song.'); return; }
    if (current.current.prefs.wifiOnly && !window.CineAndroid?.isWifiConnected()) { toast('Downloads are set to Wi-Fi only.'); return; }
    const next: DownloadJob[] = [...current.current.jobs.filter(item => item.id !== song.id), { id: song.id, song, status: 'queued', progress: 0 }];
    current.current.jobs = next; setJobs(next);
    try { window.CineAndroid!.download(JSON.stringify(song)); }
    catch (error) { refreshDownloads(); toast(error instanceof Error ? error.message : 'Download could not start.'); }
  }
  function removeDownload(id: string) {
    if (current.current.disabled) return;
    try { window.CineAndroid?.cancelDownload?.(id); window.CineAndroid?.removeDownload(id); refreshDownloads(); toast('Local download removed.'); }
    catch { toast('The download could not be removed. Try again.'); }
  }
  async function downloadMany(songs: Song[]) {
    if (current.current.disabled) return;
    const native = window.CineAndroid;
    if (!native) { toast('Protected downloads require the Android app.'); return; }
    if (!isOnline()) { toast('Connect to the internet to download songs.'); return; }
    if (current.current.prefs.wifiOnly && !native.isWifiConnected()) { toast('Connect to Wi-Fi to start downloads.'); return; }
    const pending = [...new Map(songs.map(song => [song.id, song])).values()].filter(song =>
      !current.current.downloads.some(item => item.id === song.id)
      && !current.current.jobs.some(job => job.id === song.id && job.status !== 'failed'));
    for (let at = 0; at < pending.length; at += 20) {
      const batch = pending.slice(at, at + 20);
      current.current.jobs = [...current.current.jobs.filter(job => !batch.some(song => song.id === job.id)), ...batch.map(song => ({ id: song.id, song, status: 'queued' as const, progress: 0 }))];
      setJobs(current.current.jobs);
      await new Promise(resolve => setTimeout(resolve, 16));
      try {
        if (native.downloadMany) native.downloadMany(JSON.stringify(batch));
        else for (const song of batch) native.download(JSON.stringify(song));
      } catch { refreshDownloads(); toast('Some songs could not be queued. Retry from Downloads.'); return; }
    }
    if (pending.length) toast(`${pending.length} songs submitted to the download queue.`);
  }
  return { downloads: disabled ? [] : downloads, jobs: disabled ? [] : jobs, download, downloadMany, removeDownload, refreshDownloads };
}

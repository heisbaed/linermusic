import { useEffect, useRef, useState } from 'react';
import { isAndroid, readDownloads, readDownloadJobs, subscribe, configureDownloads } from './native';
import type { DownloadJob, Preferences } from './AppContext';
import type { Song } from './types';

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 30_000; // 30 seconds
const MAX_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

function jobsFrom(value: unknown): DownloadJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const song = item?.track || item?.song;
    if (!song?.id || !['queued', 'downloading', 'paused', 'failed'].includes(item.status)) return [];
    return [{ id: song.id, song, status: item.status, progress: Number(item.progress) || 0, error: item.error } as DownloadJob];
  });
}

export function useDownloads(prefs: Preferences, toast: (message: string) => void) {
  const [downloads, setDownloads] = useState<Song[]>(readDownloads);
  const [jobs, setJobs] = useState<DownloadJob[]>(() => jobsFrom(readDownloadJobs()));
  const current = useRef({ downloads, jobs, prefs, toast });
  current.current = { downloads, jobs, prefs, toast };
  const retryTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const retryCounts = useRef<Map<string, number>>(new Map());

  function refreshDownloads() { setDownloads(readDownloads()); setJobs(jobsFrom(readDownloadJobs())); }
  useEffect(() => configureDownloads(prefs.wifiOnly), [prefs.wifiOnly]);
  useEffect(() => subscribe(event => {
    if (event.type === 'downloads') {
      const complete = Array.isArray(event.data.items) ? event.data.items as Song[] : readDownloads();
      const newDownload = complete.find(song => !current.current.downloads.some(item => item.id === song.id));
      setDownloads(complete);
      setJobs(items => items.filter(item => !complete.some(song => song.id === item.id)));
      if (newDownload) current.current.toast(`${newDownload.title} is ready to play offline in Cine music.`);
    }
    if (event.type === 'downloadJobs') setJobs(jobsFrom(event.data.items));
    if (event.type === 'downloadProgress') {
      const id = String(event.data.id);
      if (event.data.track) {
        const updates = jobsFrom([{ ...event.data, status: event.data.status || 'downloading' }]);
        if (updates[0]) setJobs(items => [...items.filter(item => item.id !== id), updates[0]]);
      } else setJobs(items => items.map(item => item.id === id ? { ...item, progress: Number(event.data.progress), status: 'downloading' } : item));
      if (Number(event.data.progress) === 100) refreshDownloads();
    }
    if (event.type === 'downloadError') {
      const id = String(event.data.id), error = String(event.data.message || 'Download failed. Check your connection and try again.');
      setJobs(items => items.map(item => item.id === id ? { ...item, status: 'failed', error } : item));
      current.current.toast(error);
      // Schedule auto-retry for failed downloads
      scheduleRetry(id);
    }
  }), []);

  function scheduleRetry(id: string) {
    const count = retryCounts.current.get(id) || 0;
    if (count >= MAX_RETRY_ATTEMPTS) {
      retryCounts.current.delete(id);
      return;
    }
    const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, count), MAX_RETRY_DELAY);
    const timeout = setTimeout(() => {
      retryCounts.current.set(id, count + 1);
      const job = current.current.jobs.find(j => j.id === id);
      if (job && navigator.onLine) {
        if (current.current.prefs.wifiOnly && !window.CineAndroid?.isWifiConnected()) {
          // Re-schedule for later if Wi-Fi only and not on Wi-Fi
          scheduleRetry(id);
          return;
        }
        current.current.toast(`Retrying download for ${job.song.title}...`);
        window.CineAndroid!.download(JSON.stringify(job.song));
      }
    }, delay);
    retryTimeouts.current.set(id, timeout);
  }

  function clearRetry(id: string) {
    const timeout = retryTimeouts.current.get(id);
    if (timeout) { clearTimeout(timeout); retryTimeouts.current.delete(id); }
    retryCounts.current.delete(id);
  }

  function download(song: Song) {
    if (!isAndroid) { toast('Protected offline downloads are available in the Android app.'); return; }
    if (current.current.downloads.some(item => item.id === song.id)) { toast('This song is already ready offline.'); return; }
    const existing = current.current.jobs.find(item => item.id === song.id);
    if (existing && existing.status !== 'failed') { toast(existing.status === 'paused' ? 'Resume this download from Library > Downloads.' : 'This song is already in the download queue.'); return; }
    clearRetry(song.id);
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet to download this song.');
      if (current.current.prefs.wifiOnly && !window.CineAndroid?.isWifiConnected()) throw new Error('Downloads are set to Wi-Fi only. Connect to Wi-Fi or change Downloads & Storage in Settings.');
      setJobs(items => [...items.filter(item => item.id !== song.id), { id: song.id, song, status: 'queued', progress: 0 }]);
      window.CineAndroid!.download(JSON.stringify(song));
      toast('Added to downloads. Songs stay encrypted inside Cine music.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The download could not be started.';
      setJobs(items => items.filter(item => item.id !== song.id)); toast(message);
    }
  }
  function removeDownload(id: string) {
    clearRetry(id);
    try { window.CineAndroid?.cancelDownload?.(id); window.CineAndroid?.removeDownload(id); refreshDownloads(); toast('Local download removed. Favorites and playlists are unchanged.'); }
    catch { toast('The download could not be removed. Try again.'); }
  }
  return { downloads, jobs, download, removeDownload, refreshDownloads };
}

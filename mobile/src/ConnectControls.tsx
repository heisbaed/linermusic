import { useEffect, useState } from 'react';
import { subscribe } from './native';
import { Icon } from './Icons';
import './connect.css';

interface PlaybackDevice { id: string; name: string; kind: 'phone' | 'tv'; thisDevice: boolean }
interface ConnectState {
  deviceId: string;
  devices: PlaybackDevice[];
  activeDeviceId: string;
  activeDeviceName: string;
  online: boolean;
  message?: string;
}
const empty: ConnectState = { deviceId: '', devices: [], activeDeviceId: '', activeDeviceName: '', online: false };

function readState(): ConnectState {
  try { return { ...empty, ...JSON.parse(window.CineAndroid?.connectSnapshot?.() || '{}') }; }
  catch { return empty; }
}

export function useConnectState() {
  const [state, setState] = useState(readState);
  useEffect(() => {
    setState(readState());
    return subscribe(event => {
      if (event.type === 'connect') setState({ ...empty, ...event.data } as unknown as ConnectState);
    });
  }, []);
  return state;
}

export function ConnectControls() {
  const state = useConnectState();
  if (!window.CineAndroid?.selectPlaybackDevice) return <p className="connect-hint">Update Cine Music on both devices to share playback.</p>;
  return <div className="connect-controls">
    <p className="connect-hint" role="status">{state.online
      ? state.activeDeviceName ? 'Sound is playing on ' + state.activeDeviceName : 'Choose where to listen.'
      : 'Offline listening is available on this phone.'}</p>
    <div className="connect-devices" role="group" aria-label="Playback devices">
      {state.devices.map(device => <button type="button" className="connect-device" key={device.id}
        aria-pressed={state.activeDeviceId === device.id} disabled={!state.online}
        onClick={() => window.CineAndroid?.selectPlaybackDevice?.(device.id)}>
        <Icon name={device.kind === 'tv' ? 'tv' : 'phone'} size={24} />
        <span><strong>{device.name}</strong><small>{device.thisDevice ? 'This device' : device.kind === 'tv' ? 'TV' : 'Phone'}</small></span>
        {state.activeDeviceId === device.id && <Icon name="check" size={20} />}
      </button>)}
    </div>
    {state.message && <p className="connect-hint" role="status">{state.message}</p>}
  </div>;
}

export function ConnectLabel({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  const state = useConnectState();
  return <button type="button" className={`connect-output${compact ? ' connect-output-compact' : ''}`} onClick={onClick} aria-label={state.activeDeviceName ? `Playback device: ${state.activeDeviceName}. Choose a device` : 'Choose playback device'}>
    <Icon name="headphones" size={19} />{!compact && <><span>{state.activeDeviceName || 'Playback devices'}</span><Icon name="chevron_down" size={15} /></>}
  </button>;
}


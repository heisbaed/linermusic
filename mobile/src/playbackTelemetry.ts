export type PlaybackTelemetryEvent = 'play' | 'resume' | 'pause' | 'complete' | null;

export interface PlaybackMarker {
  status: string;
  id: string;
}

export interface PlaybackTelemetryState {
  startedId: string;
  resumePending: boolean;
}

export function nextPlaybackTelemetry(previous: PlaybackMarker, current: PlaybackMarker, state: PlaybackTelemetryState): {
  event: PlaybackTelemetryEvent;
  state: PlaybackTelemetryState;
} {
  const next = { ...state };
  let event: PlaybackTelemetryEvent = null;
  if (current.id && current.status === 'playing') {
    if (next.resumePending && previous.status === 'paused' && previous.id === current.id) {
      event = 'resume';
      next.resumePending = false;
    } else if (next.startedId !== current.id) {
      event = 'play';
      next.startedId = current.id;
      next.resumePending = false;
    }
  } else if (current.status === 'paused' && previous.status === 'playing') {
    event = 'pause';
    next.resumePending = true;
  } else if (current.status === 'ended' && previous.status !== 'ended') {
    event = 'complete';
    next.startedId = '';
    next.resumePending = false;
  }
  return { event, state: next };
}

import { describe, expect, it } from 'vitest';
import { nextPlaybackTelemetry, type PlaybackMarker, type PlaybackTelemetryState } from './playbackTelemetry';

function run(states: PlaybackMarker[], initial: PlaybackTelemetryState = { startedId: '', resumePending: false }) {
  let previous: PlaybackMarker = { status: '', id: '' };
  let marker = initial;
  const events: string[] = [];
  for (const state of states) {
    const result = nextPlaybackTelemetry(previous, state, marker);
    if (result.event) events.push(result.event);
    marker = result.state;
    previous = state;
  }
  return { events, marker };
}

describe('nextPlaybackTelemetry', () => {
  it('counts the prepared-then-playing sequence as a single play', () => {
    expect(run([
      { status: 'loading', id: 'one' },
      { status: 'paused', id: 'one' },
      { status: 'playing', id: 'one' },
      { status: 'playing', id: 'one' },
    ]).events).toEqual(['play']);
  });

  it('counts pause and user resume separately', () => {
    expect(run([
      { status: 'playing', id: 'one' },
      { status: 'paused', id: 'one' },
      { status: 'playing', id: 'one' },
    ]).events).toEqual(['play', 'pause', 'resume']);
  });

  it('counts each new track after native auto-advance', () => {
    expect(run([
      { status: 'playing', id: 'one' },
      { status: 'ended', id: 'one' },
      { status: 'loading', id: 'two' },
      { status: 'paused', id: 'two' },
      { status: 'playing', id: 'two' },
    ]).events).toEqual(['play', 'complete', 'play']);
  });

  it('does not count a transient loading pause as a pause', () => {
    expect(run([
      { status: 'loading', id: 'one' },
      { status: 'paused', id: 'one' },
    ]).events).toEqual([]);
  });
});

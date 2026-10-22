import test from 'node:test';
import assert from 'node:assert/strict';

class PreviewAudio extends EventTarget {
  static current;
  currentTime = 0;
  duration = 60;
  paused = true;
  ended = false;
  rejectPlay = false;
  constructor() { super(); PreviewAudio.current = this; }
  play() {
    if (this.rejectPlay) return Promise.reject(new Error('Playback was blocked'));
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}

globalThis.Audio = PreviewAudio;
globalThis.window = { fetch: async () => { throw new Error('Network must not be used by these checks'); }, setTimeout, clearTimeout };
const bridge = await import('../../mobile/src/native.ts');
const first = { id: 'preview-one', title: 'One', artist: 'Local check', durationMs: 60_000 };
const second = { ...first, id: 'preview-two', title: 'Two' };

test('browser snapshots preserve queue modes and replay state to late subscribers', () => {
  bridge.playNative(first, 'https://example.invalid/local-audio', [first, second], true, 'all');
  assert.equal(bridge.snapshot().status, 'playing');
  assert.equal(bridge.snapshot().queue.length, 2);
  assert.equal(bridge.snapshot().shuffle, true);
  assert.equal(bridge.snapshot().repeat, 'all');
  const events = [];
  const unsubscribe = bridge.subscribe(event => events.push(event));
  assert.equal(events[0].type, 'player');
  assert.equal(events[0].data.track.id, first.id);
  unsubscribe();
});

test('browser next, previous and completion emit transport with a 3000ms restart boundary', () => {
  const events = [];
  const unsubscribe = bridge.subscribe(event => { if (event.type === 'transport') events.push(event.data.action); });
  bridge.control('next');
  PreviewAudio.current.currentTime = 3;
  bridge.control('previous');
  PreviewAudio.current.currentTime = 3.001;
  bridge.control('previous');
  assert.equal(PreviewAudio.current.currentTime, 0);
  PreviewAudio.current.dispatchEvent(new Event('ended'));
  assert.deepEqual(events, ['next', 'previous', 'ended']);
  unsubscribe();
});

test('browser current-song and timed sleep cancel cleanly', async () => {
  let advances = 0;
  const unsubscribe = bridge.subscribe(event => { if (event.type === 'transport') advances++; });
  bridge.sleepTimer(1, true);
  assert.equal(bridge.snapshot().sleepEndOfSong, true);
  PreviewAudio.current.dispatchEvent(new Event('ended'));
  assert.equal(bridge.snapshot().status, 'paused');
  assert.equal(bridge.snapshot().sleepEndOfSong, false);
  assert.equal(advances, 0);
  bridge.sleepTimer(.0001, false);
  assert.ok(bridge.snapshot().sleepDeadline > 0);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(bridge.snapshot().sleepDeadline, 0);
  assert.equal(bridge.snapshot().status, 'paused');
  bridge.sleepTimer(1, true);
  bridge.sleepTimer(0, true);
  assert.equal(bridge.snapshot().sleepEndOfSong, false);
  unsubscribe();
});

test('browser play and resume rejections become player errors, not unhandled promises', async () => {
  PreviewAudio.current.rejectPlay = true;
  bridge.control('resume');
  await Promise.resolve();
  assert.equal(bridge.snapshot().status, 'error');
  assert.equal(bridge.snapshot().error, 'Playback was blocked');
  bridge.playNative(second, 'https://example.invalid/local-audio', [first, second]);
  await Promise.resolve();
  assert.equal(bridge.snapshot().status, 'error');
  PreviewAudio.current.rejectPlay = false;
});

test('native ready and chunk events preserve service-owned state across subscription changes', async () => {
  let state = { track: first, status: 'playing', positionMs: 10_000, durationMs: 60_000, queue: [first, second], shuffle: true, repeat: 'one', sleepDeadline: 12_345, sleepEndOfSong: false, output: 'Test route' };
  let readyCalls = 0;
  window.CineAndroid = { snapshot: () => JSON.stringify(state), ready: () => { readyCalls++; }, control: action => assert.equal(action, 'next') };
  const native = await import('../../mobile/src/native.ts?android');
  assert.equal(readyCalls, 1);
  const firstEvents = [];
  const unsubscribe = native.subscribe(event => firstEvents.push(event));
  assert.deepEqual(firstEvents[0].data.queue, [first, second]);
  state = { ...state, positionMs: 20_000 };
  const envelope = JSON.stringify({ type: 'player', data: state });
  window.__cineChunk('state', envelope.slice(0, 20), false);
  window.__cineChunk('state', envelope.slice(20), true);
  assert.equal(native.snapshot().positionMs, 20_000);
  unsubscribe();
  const secondEvents = [];
  const stop = native.subscribe(event => secondEvents.push(event));
  assert.equal(secondEvents[0].data.repeat, 'one');
  assert.equal(secondEvents[0].data.shuffle, true);
  assert.equal(secondEvents[0].data.sleepDeadline, 12_345);
  native.control('next');
  assert.equal(secondEvents.filter(event => event.type === 'transport').length, 0);
  stop();
  delete window.CineAndroid;
});

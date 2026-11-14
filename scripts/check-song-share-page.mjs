import { writeFile } from 'node:fs/promises';
const target = await (await fetch('http://127.0.0.1:9228/json/new?' + encodeURIComponent('http://127.0.0.1:5182/song/eafzURCG1X0?title=Umenipendelea&artist=Neema%20Gospel%20Choir'), { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id) { const call = pending.get(message.id); pending.delete(message.id); message.error ? call.reject(message.error) : call.resolve(message.result); }
};
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
try {
  await cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  let result;
  for (let attempt = 0; attempt < 40; attempt++) {
    result = await cdp('Runtime.evaluate', { expression: `(()=>{const heading=document.querySelector('h1');const image=document.querySelector('.shared-song-art img');return {title:heading?.textContent,artist:document.body.textContent.includes('Neema Gospel Choir'),image:image?.src,imageLoaded:!!image?.naturalWidth,open:document.querySelector('a[href^="cinemusic://song/"]')?.href,overflow:document.documentElement.scrollWidth>innerWidth}})()`, returnByValue: true });
    if (result.result.value?.imageLoaded && result.result.value?.title === 'Umenipendelea') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const value = result.result.value;
  if (value.title !== 'Umenipendelea' || !value.artist || !value.imageLoaded || value.overflow || value.open !== 'cinemusic://song/eafzURCG1X0') throw new Error(JSON.stringify(value));
  await cdp('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  await new Promise(resolve => setTimeout(resolve, 1200));
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile('.device-test/song-share-page.png', Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify(value));
} finally { socket.close(); await fetch('http://127.0.0.1:9228/json/close/' + target.id); }

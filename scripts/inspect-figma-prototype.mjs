import { writeFile } from 'node:fs/promises';

const url = process.argv.find(value => value.startsWith('https://www.figma.com/')) || 'https://www.figma.com/proto/rwe4PpMspkRr7MHoa3Yjcb/Untitled?node-id=2-1192';
if (new URL(url).hostname !== 'www.figma.com') throw new Error('Expected the supplied Figma URL.');
const port = process.argv.find(value => value.startsWith('--port='))?.slice(7) || '9228';
const browser = await (await fetch(`http://127.0.0.1:${Number(port)}/json/version`)).json();
const socket = new WebSocket(browser.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let serial = 0;
const pending = new Map();
socket.onmessage = message => {
  const data = JSON.parse(message.data);
  if (!data.id) return;
  const request = pending.get(data.id); if (!request) return;
  pending.delete(data.id); clearTimeout(request.timer);
  data.error ? request.reject(new Error(data.error.message)) : request.resolve(data.result);
};
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser operation timed out: ' + method)); }, 25_000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const { browserContextId } = await send('Target.createBrowserContext');
const { targetId } = await send('Target.createTarget', { browserContextId, url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const cdp = (method, params) => send(method, params, sessionId);
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
const report = { requestedUrl: url, authenticatedBrowser: false };
try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  const until = Date.now() + 55_000;
  while (Date.now() < until) {
    report.page = await evaluate(`({url:location.href,title:document.title,ready:document.readyState,canvas:document.querySelectorAll('canvas').length,text:document.body?.innerText?.slice(0,2000)||'',buttons:Array.from(document.querySelectorAll('button')).map(button=>button.innerText||button.getAttribute('aria-label')).filter(Boolean).slice(0,30)})`);
    if (/request access|you need access|ask to join|file is not available|unsupported browser/i.test(report.page.text)) break;
    if (report.page.ready === 'complete' && report.page.canvas > 0) { await new Promise(resolve => setTimeout(resolve, 5000)); break; }
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  report.page = await evaluate(`({url:location.href,title:document.title,canvas:document.querySelectorAll('canvas').length,text:document.body?.innerText?.slice(0,3000)||'',buttons:Array.from(document.querySelectorAll('button')).map(button=>({text:button.innerText||button.getAttribute('aria-label'),rect:(()=>{const r=button.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()})).filter(button=>button.text).slice(0,35)})`);
  const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL('../.device-test/figma-prototype-browser.png', import.meta.url), Buffer.from(screenshot.data, 'base64'));
  try {
    const response = await fetch('https://www.figma.com/file/rwe4PpMspkRr7MHoa3Yjcb/thumbnail?node-id=2-1192', { signal: AbortSignal.timeout(20_000) });
    report.thumbnail = { status: response.status, contentType: response.headers.get('content-type') };
    if (response.ok && /^image\//.test(report.thumbnail.contentType || '')) {
      const image = await response.arrayBuffer();
      if (image.byteLength < 12_000_000) { await writeFile(new URL('../.device-test/figma-frame-preview.png', import.meta.url), Buffer.from(image)); report.thumbnail.bytes = image.byteLength; }
    }
  } catch { report.thumbnail = { error: 'Public thumbnail was not available.' }; }
} finally {
  await send('Target.disposeBrowserContext', { browserContextId }); socket.close();
  await writeFile(new URL('../.device-test/figma-inspection.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));

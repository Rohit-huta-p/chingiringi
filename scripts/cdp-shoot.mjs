// 2x screenshot capture over Chrome DevTools Protocol.
// Requires a headless Chrome running on the logged-in `chrome-cap` profile with
// --remote-debugging-port=9222 --remote-allow-origins=*. No tokens handled here;
// the session lives in that profile's localStorage. Node 22 globals: fetch, WebSocket.
import { writeFileSync } from 'node:fs';

const PID  = '6a74733ed75a9845cee35c7f';            // NutriPro Juicer
const OUT  = '/Users/rohithutagonna/Documents/Rohit/Chingiringi/screenshots';
const BASE = 'http://localhost:8083';

const shots = [
  ['home-desktop',           `${BASE}/home`,           1440, 900, false],
  ['product-desktop',        `${BASE}/product/${PID}`, 1440, 900, false],
  ['wallet-desktop',         `${BASE}/wallet`,         1440, 900, false],
  ['offline-stores-desktop', `${BASE}/offline-stores`, 1440, 900, false],
  ['home-mobile',            `${BASE}/app`,            390, 844, true],
  ['product-mobile',         `${BASE}/product/${PID}`, 390, 844, true],
  ['wallet-mobile',          `${BASE}/app/wallet`,     390, 844, true],
  ['stores-mobile',          `${BASE}/app/stores`,     390, 844, true],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = list.find((t) => t.type === 'page');
if (!page) { console.error('no page target'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let _id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const id = ++_id; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

await send('Page.enable');
await send('Runtime.enable');

async function waitForContent() {
  // Splash screen has ~no text; a rendered screen has plenty. Poll until real content, max ~22s.
  for (let i = 0; i < 55; i++) {
    const r = await send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText.replace(/\\s/g,"").length : 0',
      returnByValue: true,
    });
    if ((r.result?.result?.value ?? 0) > 150) return true;
    await sleep(400);
  }
  return false;
}

for (const [name, url, w, h, mobile] of shots) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile });
  await send('Page.navigate', { url });
  await sleep(1200);
  const ok = await waitForContent();
  await sleep(1800); // let images paint
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (shot.result?.data) {
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(shot.result.data, 'base64'));
    console.log(ok ? 'saved' : 'saved(timeout)', name);
  } else {
    console.log('FAILED', name, JSON.stringify(shot).slice(0, 160));
  }
}
ws.close();
console.log('all done');
process.exit(0);

// Gerçek cihaz emülasyonlu ekran görüntüsü + taşma (overflow) denetimi (Edge/Chrome, CDP).
// Kullanım: node tools/shot.mjs <url> <out.png> [--w 390] [--h 844] [--dpr 2] [--full] [--js "kod"] [--wait 600] [--dark]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[0], out = args[1];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 ? args[i + 1] : d; };
const W = +opt('w', 390), H = +opt('h', 844), DPR = +opt('dpr', 2), FULL = args.includes('--full');
const JS = opt('js', ''), WAIT = +opt('wait', 700);
const mobile = W < 900;

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const port = 9300 + Math.floor(Math.random() * 500);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opia-shot-'));
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {}
  await sleep(150);
}
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile });
if (mobile) await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
if (args.includes('--dark')) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.navigate', { url });
await sleep(WAIT + 800);
await evalJS('document.fonts.ready.then(()=>1)');
// çerez banner'ını gizle (--keepcc ile bırakılabilir)
if (!args.includes('--keepcc')) await evalJS("(()=>{const c=document.getElementById('cc');if(c)c.hidden=true;return 1})()");
if (JS) { await evalJS(JS); await sleep(WAIT); }

const metrics = await evalJS(`(()=>{
  const de=document.documentElement, vw=de.clientWidth, bad=[];
  document.querySelectorAll('body *').forEach(el=>{
    const r=el.getBoundingClientRect(); if(!r.width) return;
    if(r.right>vw+1 || r.left<-1){ let p=el, hidden=false; while((p=p.parentElement)&&p!==document.body){const o=getComputedStyle(p); if(['hidden','clip','auto','scroll'].includes(o.overflowX)){hidden=true;break;}}
      if(!hidden && getComputedStyle(el).position!=='fixed') bad.push(el.tagName.toLowerCase()+'.'+(el.className&&el.className.baseVal===undefined?el.className:'')+' '+Math.round(r.left)+'→'+Math.round(r.right)); }
  });
  return JSON.stringify({vw, scrollW:de.scrollWidth, bodyScrollW:document.body.scrollWidth, scrollH:de.scrollHeight, overflowing:bad.slice(0,8)});
})()`);

let clip;
if (FULL) {
  const h = JSON.parse(metrics).scrollH;
  clip = { x: 0, y: 0, width: W, height: Math.min(h, 12000), scale: 1 };
}
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!FULL, ...(clip ? { clip } : {}) });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log(metrics);
ws.close(); proc.kill();
try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}

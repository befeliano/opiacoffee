// Tüm sayfalarda, birden çok genişlikte yatay taşma / bozuk yerleşim taraması.
// Kullanım: node tools/check-layout.mjs [http://127.0.0.1:8080]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:8080';
const sitemap = await (await fetch(base + '/sitemap.xml')).text();
const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(m => m[1]);
paths.push('/404.html');
const widths = [320, 360, 390, 430, 768, 1024, 1440];

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(fs.existsSync);
const port = 9800 + Math.floor(Math.random() * 100);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opia-chk-'));
const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {} await sleep(150); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;

const probe = `(()=>{
  const de=document.documentElement, vw=de.clientWidth, bad=[];
  document.querySelectorAll('body *').forEach(el=>{
    const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
    if(r.right>vw+1||r.left<-1){ let p=el,hid=false; while((p=p.parentElement)&&p!==document.body){const o=getComputedStyle(p); if(['hidden','clip','auto','scroll'].includes(o.overflowX)){hid=true;break;}}
      const cs=getComputedStyle(el); if(!hid&&!el.closest('.field--hp')&&cs.position!=='fixed'&&cs.visibility!=='hidden') bad.push(el.tagName.toLowerCase()+'.'+String(el.className&&el.className.baseVal===undefined?el.className:'').split(' ')[0]+' '+Math.round(r.left)+'→'+Math.round(r.right)); } });
  const imgs=[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src);
  return JSON.stringify({vw,sw:de.scrollWidth,bad:bad.slice(0,5),broken:imgs});
})()`;

await send('Page.enable');
let problems = 0, n = 0;
for (const w of widths) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 800, deviceScaleFactor: 1, mobile: w < 900 });
  for (const p of paths) {
    await send('Page.navigate', { url: base + p });
    await sleep(450);
    await ev('document.fonts.ready.then(()=>1)');
    const r = JSON.parse(await ev(probe)); n++;
    if (r.sw > r.vw || r.bad.length || r.broken.length) { problems++; console.log(`✗ ${w}px ${p}`, JSON.stringify(r)); }
  }
}
console.log(`${n} kontrol, ${problems} sorun.`);
ws.close(); proc.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
process.exit(problems ? 1 : 0);

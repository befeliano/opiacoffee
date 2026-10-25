// Google Fonts -> self-hosted (latin + latin-ext). Usage: node tools/get-fonts.mjs
import fs from 'node:fs';
const css = fs.readFileSync(new URL('./fonts.css', import.meta.url), 'utf8');
const out = new URL('../site/assets/fonts/', import.meta.url);
const blocks = css.split(/(?=\/\* [a-z-]+ \*\/)/).filter(b => /^\/\* (latin|latin-ext) \*\//.test(b));
let result = '';
for (const b of blocks) {
  const subset = b.match(/^\/\* ([a-z-]+) \*\//)[1];
  const fam = b.match(/font-family: '([^']+)'/)[1];
  const style = b.match(/font-style: (\w+)/)[1];
  const url = b.match(/url\(([^)]+)\)/)[1];
  const wt = b.match(/font-weight: ([0-9 ]+);/)[1].replace(' ', '-'); const file = `${fam.toLowerCase().replace(/ /g, '-')}-${style}-${wt}-${subset}.woff2`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(new URL(file, out), buf);
  result += b.replace(/\/\* [a-z-]+ \*\/\s*/, '').replace(/src: url\([^)]+\) format\('woff2'\);/, `src: url(/assets/fonts/${file}) format('woff2');`).replace(/^/, `/* ${subset} */\n`);
  console.log(file, buf.length);
}
fs.writeFileSync(new URL('../site/assets/css/fonts.css', import.meta.url), result);

// Metinlerde uzun çizgi (em/en dash), orta nokta ve süs karakterlerini temizler.
// Kullanım: node tools/clean-typography.mjs   (_src, admin, assets/js, main.css ve .htaccess üzerinde çalışır)
import fs from 'node:fs';
import path from 'node:path';
const root = 'D:/Opia/site';
const files = [];
const walk = (d, ok) => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (!['uploads', '_private', 'placeholders', 'fonts'].includes(e.name)) walk(p, ok); }
  else if (ok(p)) files.push(p);
});
walk(root + '/_src', p => p.endsWith('.php'));
walk(root + '/admin', p => /\.(php|js|css)$/.test(p));
walk(root + '/assets/js', p => p.endsWith('.js'));
files.push(root + '/assets/css/main.css', root + '/.htaccess');

const special = [
  ['Opia Coffee Co. - ', 'Opia Coffee Co.: '],
  ["'Şimdi açık / 00:00’a kadar'", "'Şimdi açık, 00:00’a kadar'"],
  ["'Şimdi kapalı / 09:00’da açılıyoruz'", "'Şimdi kapalı, 09:00’da açılıyoruz'"],
  ['Giriş / Opia Yönetim', 'Giriş | Opia Yönetim'],
  ['<?= h($title) ?> / Opia Yönetim', '<?= h($title) ?> | Opia Yönetim'],
  ["<?= e($s['label']) ?> / <?= e($s['subtitle']) ?>", "<?= e($s['label']) ?>: <?= e($s['subtitle']) ?>"],
  ["'Gönderiliyor…'", "'Gönderiliyor'"],
  ["content: '✦ '; font-size: .7em; vertical-align: .12em;", "content: ''; display: inline-block; width: .32em; height: .32em; background: currentColor; margin-right: .35em; vertical-align: .22em;"],
  ["content: '–'", "content: '-'"],
  ['<i>✦</i>', '<i></i>'],
  ["Sezonluk / ", "Sezonluk / "], ["join(' / ')", "join(' / ')"],
];
let changed = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8'), o = s;
  for (const [a, b] of special) s = s.split(a).join(b);
  s = s.split('\n').map(l => {
    const t = l.trim(), comment = /^(\/\/|\/\*|\*|#|<!--)/.test(t) || /^\s*\/\//.test(l);
    l = l.replace(/ - /g, comment ? ' - ' : ', ').replace(/—/g, '-');
    l = l.replace(/ - /g, ' - ').replace(/–/g, '-');
    l = l.replace(/ / /g, ' / ');
    return l;
  }).join('\n');
  if (s !== o) { fs.writeFileSync(f, s); changed++; }
}
console.log('güncellenen dosya:', changed);

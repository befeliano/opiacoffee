// "yeni fotolar" klasöründeki fotoğrafları sitenin görsel yerlerine (public/assets/img/<yer>.webp) yerleştirir.
//   node scripts/site-fotolari.mjs ["D:/Opia/yeni fotolar"]
// Her yer kendi oranında, en dikkat çekici bölge korunarak kırpılır; WEBP, kalite 80.
// Sonradan değiştirmek için panel › Web sitesi › Fotoğraflar daha kolaydır (bu betik yalnızca varsayılanları üretir).

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const src = process.argv[2] ?? path.resolve(process.cwd(), "..", "yeni fotolar");
const out = path.resolve(process.cwd(), "public", "assets", "img");
const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
const pick = (n) => path.join(src, files[n - 1]);

// yer: [fotoğraf sırası (adına göre), genişlik, yükseklik]
const SLOTS = {
  hero: [2, 1000, 1250],
  "galeri-1": [12, 900, 900],
  "galeri-2": [5, 900, 900],
  "galeri-3": [1, 900, 900],
  "galeri-4": [17, 900, 900],
  "galeri-5": [19, 900, 900],
  "galeri-6": [18, 900, 900],
  "hakkimizda-1": [14, 1000, 1250],
  "hakkimizda-2": [7, 1200, 900],
  "blog-flat-white-latte-cappuccino-cortado-farki": [3, 1200, 750],
  "blog-matcha-latte-nedir-kafein": [13, 1200, 750],
  "blog-nitelikli-kahve-nedir": [4, 1200, 750],
  "blog-red-eye-black-eye-nedir": [20, 1200, 750],
  "blog-salep-nedir": [18, 1200, 750],
  "blog-yenibaglar-bir-gun-havacilik-parki-kahve": [6, 1200, 750],
  "yerel-nitelikli-kahve": [8, 1200, 900],
  "yerel-yenibaglar": [6, 1200, 900],
  "yerel-tepebasi": [9, 1200, 900],
  "yerel-anadolu-universitesi": [10, 1200, 900],
  "yerel-hava-muzesi": [16, 1200, 900],
  "yerel-casaba-modern": [21, 1200, 900],
  "yerel-tren-gari": [15, 1200, 900],
};

if (files.length < 21) throw new Error(`${src} içinde 21 fotoğraf bekleniyordu, ${files.length} var.`);
let total = 0;
for (const [slot, [n, w, h]] of Object.entries(SLOTS)) {
  const file = path.join(out, `${slot}.webp`);
  await sharp(pick(n)).rotate().resize({ width: w, height: h, fit: "cover", position: sharp.strategy.attention }).webp({ quality: 80, effort: 6 }).toFile(file);
  const size = fs.statSync(file).size;
  total += size;
  console.log(`${slot.padEnd(48)} ← ${String(n).padStart(2)}  ${Math.round(size / 1024)} KB`);
}
console.log(`Toplam ${Math.round(total / 1024)} KB`);

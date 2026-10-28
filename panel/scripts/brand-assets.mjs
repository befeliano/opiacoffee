// Uygulama ikonlarını (favicon, Apple ve PWA ikonları) üretir: marka
// renginde daire içinde kahve fincanı (lucide "coffee", ISC lisanslı).
// Kafeye özel ikon için COLOR'ı değiştir ya da ICON yerine logo kullan.
// Çalıştırma: node scripts/brand-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const COLOR = "#8c5531"; // "coffee" paletinin 600 tonu
const CUP = `<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>`;

/** size: kare tuval; round: daire mi tam kare mi; scale: fincanın tuvale oranı */
function svg(size, { round = true, scale = 0.5 } = {}) {
  const icon = size * scale;
  const offset = (size - icon) / 2;
  const bg = round
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${COLOR}"/>`
    : `<rect width="${size}" height="${size}" fill="${COLOR}"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${offset + icon * 0.02} ${offset + icon * 0.04}) scale(${icon / 24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CUP}</g>
</svg>`);
}

const png = (input, out) => sharp(input).png({ compressionLevel: 9 }).toFile(out);

await mkdir("public/icons", { recursive: true });
// Favicon ve Apple ikonu (Next.js dosya kuralları: src/app/icon.png, apple-icon.png)
await png(svg(64), "src/app/icon.png");
await png(svg(180, { round: false, scale: 0.52 }), "src/app/apple-icon.png");
// PWA ikonları
await png(svg(192), "public/icons/icon-192.png");
await png(svg(512), "public/icons/icon-512.png");
// Maskable: tam kare zemin, güvenli alan için küçük fincan
await png(svg(512, { round: false, scale: 0.42 }), "public/icons/maskable-512.png");

console.log("İkonlar üretildi.");

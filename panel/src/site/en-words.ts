// Türkçe sayfada büyük harfe çevrilen başlıklarda İngilizce sözcükler "İ" ile yazılmasın diye (WİNTER yerine WINTER)
// lang="en" ile sarılacak sözcükler: sabit liste + menüdeki ve mağazadaki İngilizce adlar.

import { SITE } from "./config";
import menu from "./content/menu.json";
import shop from "./content/shop.json";

const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;
// Türkçe de olan ya da Türkçe adlarda geçen sözcükler: İngilizce sayılmaz
const SHARED = new Set(["bar", "kenya", "peru", "salep"]);

function words(text: string): string[] {
  return text.split(/[\s&/,()+-]+/).filter((w) => w.length > 1 && !TURKISH.test(w) && !/^\d/.test(w));
}

const names: string[] = [
  ...menu.products.filter((p) => p.lang === "en").map((p) => p.name),
  ...menu.categories.filter((c) => c.name === c.name_en).map((c) => c.name),
  menu.season.title,
  ...shop.items.filter((i) => i.name === i.name_en).map((i) => i.name),
];

const set = new Set<string>(SITE.enWords);
for (const n of names) {
  set.add(n.trim());
  for (const w of words(n)) {
    if (SHARED.has(w.toLowerCase())) continue;
    set.add(w);
    // Menüde büyük yazılmış adlar (RED EYE) da olduğu gibi ve baş harfi büyük hâliyle tanınsın
    set.add(w[0].toUpperCase() + w.slice(1).toLowerCase());
    set.add(w.toUpperCase());
  }
}
set.add("Fall");
set.add("Winter");

export const EN_WORDS = [...set].filter(Boolean);

/** Menüde olmayan (sonradan eklenmiş) bir ürün adı İngilizce mi? Bütün sözcükleri İngilizce listesindeyse evet */
export function looksEnglish(name: string): boolean {
  if (TURKISH.test(name)) return false;
  const ws = words(name);
  return ws.length > 0 && ws.every((w) => set.has(w) || set.has(w[0].toUpperCase() + w.slice(1).toLowerCase()));
}

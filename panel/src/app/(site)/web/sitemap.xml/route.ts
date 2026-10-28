// Site haritası: sayfalar, yerel sayfalar ve blog yazıları kendiliğinden eklenir.

import { PAGE_PAIRS, url } from "@/site/config";
import { LOCALS } from "@/site/content/locals";
import { POSTS } from "@/site/content/posts";
import { imgSrc } from "@/site/ui";

const STARTED = "2026-10-28";

export function GET() {
  const entries: { path: string; lastmod: string; freq: string; prio: string; img?: string }[] = [];
  for (const [tr, en] of Object.entries(PAGE_PAIRS)) {
    const legal = /kvkk|gizlilik|cerez|kullanim/.test(tr);
    const prio = tr === "/" ? "1.0" : tr === "/menu" || tr === "/iletisim" ? "0.9" : legal ? "0.3" : "0.8";
    const freq = tr === "/" || tr === "/menu" ? "weekly" : "monthly";
    const hero = imgSrc("hero", 1000, 1250);
    entries.push({ path: tr, lastmod: STARTED, freq, prio, img: tr === "/" && hero.real ? hero.src : undefined });
    entries.push({ path: en, lastmod: STARTED, freq, prio });
  }
  for (const d of LOCALS) entries.push({ path: `/${d.slug}`, lastmod: STARTED, freq: "monthly", prio: "0.7" });
  entries.push({ path: "/blog", lastmod: STARTED, freq: "weekly", prio: "0.7" });
  for (const p of POSTS) entries.push({ path: `/blog/${p.slug}`, lastmod: p.updated, freq: "monthly", prio: "0.6" });

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>${esc(url(e.path))}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.freq}</changefreq>\n    <priority>${e.prio}</priority>\n` +
        (e.img ? `    <image:image><image:loc>${esc(url(e.img))}</image:loc></image:image>\n` : "") +
        "  </url>",
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

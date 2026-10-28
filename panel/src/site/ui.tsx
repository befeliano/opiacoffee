/** @jsxImportSource @/site/jsx */
// Sitenin küçük yapı taşları: ikonlar, görsel slotları, JSON-LD, SSS ve dil etiketleme.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { SITE, type Lang } from "./config";

const ICONS: Record<string, string> = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-ur": '<path d="M7 17 17 7M8 7h9v9"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  cup: '<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1.2 1.5 1.2 3M12 3c0 1.5 1.2 1.5 1.2 3"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c2-4 5-7 9-9"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>',
  plane: '<path d="M10.5 13.5 3 11l1-2 8 1.5 4-5.5 2 .5-2 6.5 4.5 4-1 1.5-5-1.5-3 4-1.5-.5.5-5z"/>',
  school: '<path d="m3 9 9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
};

export type IconName = keyof typeof ICONS;

export function iconSvg(name: string): string {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] ?? ""}</svg>`;
}

export function Icon({ name }: { name: IconName | string }) {
  return (
    <svg
      className="ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }}
    />
  );
}

export const ICON_NAMES = Object.keys(ICONS);
export const iconInner = (name: string) => ICONS[name];

// ---------------------------------------------------------------------
// Görsel slotları: public/assets/img/<slot>.(webp|jpg|jpeg|png|avif) varsa o, yoksa yer tutucu
// ---------------------------------------------------------------------
const IMG_DIR = path.join(process.cwd(), "public", "assets", "img");

export function imgSrc(slot: string, w = 1200, h = 900) {
  for (const ext of ["webp", "jpg", "jpeg", "png", "avif"]) {
    const file = path.join(IMG_DIR, `${slot}.${ext}`);
    if (existsSync(file)) {
      return { src: `/assets/img/${slot}.${ext}?v=${Math.round(statSync(file).mtimeMs).toString(36)}`, w, h, real: true };
    }
  }
  return { src: `/assets/img/placeholders/${slot}.svg`, w, h, real: false };
}

export function Img({ slot, alt, w = 1200, h = 900, eager, className }: { slot: string; alt: string; w?: number; h?: number; eager?: boolean; className?: string }) {
  const i = imgSrc(slot, w, h);
  return (
    <img
      src={i.src}
      alt={alt}
      width={i.w}
      height={i.h}
      className={className}
      loading={eager ? "eager" : "lazy"}
      {...(eager ? { fetchPriority: "high" as const } : { decoding: "async" as const })}
    />
  );
}

// ---------------------------------------------------------------------
// JSON-LD ve SSS
// ---------------------------------------------------------------------
export function JsonLd({ data, nonce }: { data: unknown; nonce?: string }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: json }} />;
}

export type Faq = [question: string, answer: string][];

export function FaqList({ faq, lang = "tr" }: { faq: Faq; lang?: Lang }) {
  return (
    <div className="faq">
      {faq.map(([q, a]) => (
        <details key={q}>
          <summary><Lw lang={lang}>{q}</Lw></summary>
          <p><Lw lang={lang}>{a}</Lw></p>
        </details>
      ))}
    </div>
  );
}

export function faqSchema(faq: Faq) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

export function breadcrumbSchema(trail: [name: string, path: string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE.url + p })),
  };
}

// ---------------------------------------------------------------------
// Dil etiketleme: büyük harfe çevrilen başlıklarda "FLAT WHİTE" olmasın diye
// Türkçe sayfada İngilizce sözcükler lang="en", İngilizce sayfada yer adları lang="tr" ile sarılır.
// ---------------------------------------------------------------------
const reCache = new Map<Lang, RegExp>();
function wordRe(lang: Lang) {
  let re = reCache.get(lang);
  if (!re) {
    const words = [...(lang === "en" ? SITE.trWords : SITE.enWords)].sort((a, b) => b.length - a.length);
    re = new RegExp(`(?<![\\p{L}])(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`, "gu");
    reCache.set(lang, re);
  }
  return re;
}

/** HTML metnindeki (etiketler hariç) sözcükleri sarar */
export function langWrapHtml(html: string, lang: Lang): string {
  const tag = lang === "en" ? "tr" : "en";
  return html
    .split(/(<script[ >][\s\S]*?<\/script>|<style[ >][\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]+>)/)
    .map((part) => (part === "" || part.startsWith("<") ? part : part.replace(wordRe(lang), `<span lang="${tag}">$1</span>`)))
    .join("");
}

/** Düz metindeki sözcükleri <span lang> ile sarar */
export function Lw({ children, lang }: { children: string; lang: Lang }) {
  const tag = lang === "en" ? "tr" : "en";
  const parts = children.split(wordRe(lang));
  return <>{parts.map((p, i) => (i % 2 === 1 ? <span lang={tag}>{p}</span> : p))}</>;
}

/** Hazır HTML içeriği (blog yazısı, yerel sayfa bölümleri) */
export function Html({ html, lang, className }: { html: string; lang: Lang; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: langWrapHtml(html, lang) }} />;
}

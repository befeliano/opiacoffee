/** @jsxImportSource @/site/jsx */
// Her sayfanın ortak iskeleti: üst menü, mobil menü, alt bölüm, ürün penceresi, çerez bildirimi ve betikler.
// renderPage() tam HTML belgesini üretir: <head> etiketleri, iskelet ve sayfa içeriği.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SITE, addressLine, altPath, lp, mapsDirUrl, url, type Lang } from "./config";
import { t } from "./i18n";
import type { Child } from "./jsx/jsx-runtime";
import { Icon, JsonLd, Lw, breadcrumbSchema } from "./ui";

export interface PageMeta {
  path: string;
  lang: Lang;
  title: string;
  description: string;
  ogImage?: string;
  ogType?: "website" | "article";
  robots?: string;
  /** Diğer dildeki eş sayfa; verilmezse PAGE_PAIRS'ten bulunur */
  alt?: string | null;
}

/** Statik dosyaya içerik özetiyle sürüm ekler (tarayıcı önbelleği güncel kalsın) */
const versions = new Map<string, string>();
export function asset(p: string) {
  let v = versions.get(p);
  if (v === undefined) {
    try {
      v = createHash("md5").update(readFileSync(path.join(process.cwd(), "public", p))).digest("hex").slice(0, 8);
    } catch {
      v = "";
    }
    versions.set(p, v);
  }
  return v ? `${p}?v=${v}` : p;
}

/** <head> etiketleri: başlık, açıklama, kanonik adres, dil eşleri, Open Graph, konum */
function Head({ meta, graph, nonce }: { meta: PageMeta; graph: unknown[]; nonce?: string }) {
  const alt = meta.alt === undefined ? altPath(meta.path) : meta.alt;
  const en = meta.lang === "en";
  const canonical = url(meta.path);
  const trUrl = en ? (alt ? url(alt) : null) : canonical;
  const enUrl = en ? canonical : alt ? url(alt) : null;
  const og = url(meta.ogImage ?? "/assets/img/og-image.png");
  const { lat, lng } = SITE.geo;
  return (
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content={meta.robots ?? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      <meta name="theme-color" content={SITE.themeColor} />
      <meta name="color-scheme" content="light" />
      <meta name="format-detection" content="telephone=no" />
      {SITE.gscVerify && <meta name="google-site-verification" content={SITE.gscVerify} />}
      <meta name="geo.region" content="TR-26" />
      <meta name="geo.placename" content="Yenibağlar, Tepebaşı, Eskişehir" />
      <meta name="geo.position" content={`${lat};${lng}`} />
      <meta name="ICBM" content={`${lat}, ${lng}`} />
      <meta property="og:type" content={meta.ogType ?? "website"} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={en ? "en_US" : "tr_TR"} />
      {alt && <meta property="og:locale:alternate" content={en ? "tr_TR" : "en_US"} />}
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={og} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={t(meta.lang, "og_alt")} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      <meta name="twitter:image" content={og} />
      {trUrl && <link rel="alternate" hrefLang="tr-TR" href={trUrl} />}
      {enUrl && <link rel="alternate" hrefLang="en" href={enUrl} />}
      <link rel="alternate" hrefLang="x-default" href={trUrl ?? canonical} />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="icon" href="/assets/img/logo-opia.png" type="image/png" sizes="225x225" />
      <link rel="apple-touch-icon" href="/assets/img/logo-opia.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="preload" href="/assets/fonts/oswald-normal-200-700-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/assets/fonts/barlow-normal-400-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="stylesheet" href={asset("/assets/css/fonts.css")} />
      <link rel="stylesheet" href={asset("/assets/css/main.css")} />
      <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} nonce={nonce} />
    </head>
  );
}

export function businessSchema(lang: Lang) {
  const a = SITE.address;
  const b: Record<string, unknown> = {
    "@type": ["CafeOrCoffeeShop", "LocalBusiness"],
    "@id": url("/#cafe"),
    name: SITE.name,
    alternateName: ["Opia Coffee", "Opia Coffee Co Eskişehir", "Opia Kahve"],
    url: url("/"),
    image: [url("/assets/img/og-image.png")],
    logo: url("/assets/img/logo-opia.png"),
    description: t(lang, "biz_desc"),
    servesCuisine: lang === "en" ? ["Coffee", "Desserts", "Matcha", "Hot chocolate"] : ["Kahve", "Tatlı", "Matcha", "Sıcak çikolata"],
    priceRange: "₺₺",
    address: {
      "@type": "PostalAddress",
      streetAddress: `${a.hood} ${a.street}`,
      addressLocality: a.district,
      addressRegion: a.city,
      postalCode: a.zip,
      addressCountry: a.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    hasMap: SITE.mapsUrl,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: SITE.hours.open,
        closes: "23:59",
      },
    ],
    sameAs: [`https://www.instagram.com/${SITE.instagram}/`],
    areaServed: ["Yenibağlar", "Tepebaşı", "Eskişehir"],
    currenciesAccepted: "TRY",
    paymentAccepted: "Nakit, Kredi Kartı",
    menu: url(lp("/menu", lang)),
  };
  if (SITE.phone) b.telephone = SITE.phone;
  if (SITE.email) b.email = SITE.email;
  return b;
}

export interface PageOptions {
  meta: PageMeta;
  content: Child;
  business?: boolean;
  breadcrumb?: [name: string, path: string][];
  schema?: unknown[];
  menuJs?: boolean;
  mainClass?: string;
  status?: number;
}

/** Sayfanın tam HTML yanıtı (proxy isteğe nonce ekler; betikler onunla çalışır) */
export function renderPage(request: Request, { meta, content, business, breadcrumb, schema = [], menuJs, mainClass, status = 200 }: PageOptions): Response {
  const nonce = request.headers.get("x-nonce") ?? undefined;
  const { lang, path: current } = meta;
  const en = lang === "en";
  const alt = meta.alt === undefined ? altPath(current) : meta.alt;
  const toggle = alt ?? (en ? "/" : "/en");
  const canonical = url(current);
  const tx = (k: Parameters<typeof t>[1]) => t(lang, k);
  const active = (href: string) => (href === current ? { "aria-current": "page" as const } : {});

  const nav: [string, string][] = [
    [lp("/", lang), tx("nav_home")],
    [lp("/menu", lang), tx("nav_menu")],
    ["/blog", tx("nav_blog") + (en ? " (TR)" : "")],
    [lp("/hakkimizda", lang), tx("nav_about")],
    [lp("/iletisim", lang), tx("nav_contact")],
  ];

  const graph: unknown[] = [
    {
      "@type": "WebSite",
      "@id": url("/#website"),
      url: url("/"),
      name: SITE.name,
      inLanguage: ["tr-TR", "en"],
      publisher: { "@id": url("/#cafe") },
    },
    {
      "@type": "WebPage",
      "@id": `${canonical}#webpage`,
      url: canonical,
      name: meta.title,
      description: meta.description,
      isPartOf: { "@id": url("/#website") },
      inLanguage: en ? "en" : "tr-TR",
      about: { "@id": url("/#cafe") },
      primaryImageOfPage: { "@type": "ImageObject", url: url(meta.ogImage ?? "/assets/img/og-image.png") },
    },
  ];
  if (business) graph.push(businessSchema(lang));
  if (breadcrumb) graph.push(breadcrumbSchema(breadcrumb));
  graph.push(...schema);

  const langSwitch = { href: toggle, hrefLang: en ? "tr" : "en", lang: en ? "tr" : "en", "data-lang-switch": "" };
  const insta = `https://www.instagram.com/${SITE.instagram}/`;
  const a = SITE.address;

  const doc = (
    <html lang={lang}>
      <Head meta={meta} graph={graph} nonce={nonce} />
      <body data-ga={SITE.gaId}>
      <a className="skip" href="#icerik">{tx("skip")}</a>

      <header className="hdr" id="top">
        <div className="hdr__in">
          <button className="burger" type="button" aria-label={tx("menu_open")} aria-expanded="false" aria-controls="drawer">
            <span></span>
            <span></span>
          </button>
          <nav className="nav nav--l" aria-label={tx("nav_main")}>
            <a href={lp("/menu", lang)} {...active(lp("/menu", lang))}>{tx("nav_menu")}</a>
            {en ? (
              <a href={lp("/hakkimizda", lang)} {...active(lp("/hakkimizda", lang))}>{tx("nav_about")}</a>
            ) : (
              <a href="/blog" {...(current.startsWith("/blog") ? { "aria-current": "page" as const } : {})}>{tx("nav_blog")}</a>
            )}
          </nav>
          <a className="logo" href={lp("/", lang)} aria-label={tx("home_aria")}>
            <span className="logo__a">OPIA</span>
            <span className="logo__b">COFFEE CO</span>
          </a>
          <nav className="nav nav--r" aria-label={tx("nav_second")}>
            {!en && <a href="/hakkimizda" {...active("/hakkimizda")}>{tx("nav_about")}</a>}
            <a href={lp("/iletisim", lang)} {...active(lp("/iletisim", lang))}>{tx("nav_contact")}</a>
          </nav>
          <div className="hdr__r">
            <a className="hdr__lang" {...langSwitch} aria-label={tx("lang_aria")}>{tx("lang_code")}</a>
            <a className="hdr__go" href={mapsDirUrl()} target="_blank" rel="noopener" aria-label={tx("directions")}>
              <Icon name="pin" />
            </a>
          </div>
        </div>
      </header>

      <div className="drawer" id="drawer" hidden>
        <nav aria-label={tx("nav_mobile")}>
          {nav.map(([href, label], i) => (
            <a key={href} href={href} {...active(href)} style={{ ["--i" as string]: i }}>
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="drawer__foot">
          <p><Lw lang={lang}>{addressLine()}</Lw></p>
          <p>{tx("everyday")} {SITE.hours.open} - 00:00</p>
          <a href={insta} target="_blank" rel="noopener me">@{SITE.instagram}</a>
          <a {...langSwitch}>{tx("lang_other")}</a>
        </div>
      </div>

      <main id="icerik" className={mainClass}>{content}</main>

      <footer className="ftr">
        <div className="wrap ftr__grid">
          <div className="ftr__brand">
            <a className="logo logo--lg" href={lp("/", lang)} aria-label="Opia Coffee Co.">
              <span className="logo__a">OPIA</span>
              <span className="logo__b">COFFEE CO</span>
            </a>
            <p><Lw lang={lang}>{tx("tagline") + "."}</Lw></p>
            <p className="ftr__open" data-open-status>{tx("everyday")} {SITE.hours.open} - 00:00</p>
          </div>
          <div>
            <h2 className="ftr__h">{tx("f_address")}</h2>
            <address>
              <Lw lang={lang}>{a.hood}</Lw>
              <br />
              <Lw lang={lang}>{a.street}</Lw>
              <br />
              <Lw lang={lang}>{`${a.district} / ${a.city} ${a.zip}`}</Lw>
            </address>
            <p><a className="ulink" href={mapsDirUrl()} target="_blank" rel="noopener">{tx("directions")}</a></p>
            {SITE.phone && <p><a className="ulink" href={`tel:${SITE.phone.replace(/\s+/g, "")}`}>{SITE.phone}</a></p>}
            {SITE.email && <p><a className="ulink" href={`mailto:${SITE.email}`}>{SITE.email}</a></p>}
          </div>
          <div>
            <h2 className="ftr__h">{tx("f_explore")}</h2>
            <ul className="ftr__list">
              <li><a href={lp("/menu", lang)}>{tx("nav_menu")}</a></li>
              <li><a href={lp("/hakkimizda", lang)}>{tx("nav_about")}</a></li>
              <li><a href={lp("/iletisim", lang)}>{tx("nav_contact")}</a></li>
              {en ? (
                <li><a href="/" hrefLang="tr" lang="tr">Türkçe</a></li>
              ) : (
                <>
                  <li><a href="/blog">Blog</a></li>
                  <li><a href="/eskisehir-nitelikli-kahve">{tx("local_1")}</a></li>
                  <li><a href="/yenibaglar-kafe">{tx("local_2")}</a></li>
                  <li><a href="/anadolu-universitesi-yakini-kafe">{tx("local_3")}</a></li>
                  <li><a href="/hava-muzesi-yakini-kafe">{tx("local_4")}</a></li>
                  <li><a href="/en" hrefLang="en" lang="en">English</a></li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h2 className="ftr__h">{tx("f_legal")}</h2>
            <ul className="ftr__list">
              <li><a href={lp("/kvkk-aydinlatma-metni", lang)}>{tx("l_kvkk")}</a></li>
              <li><a href={lp("/gizlilik-politikasi", lang)}>{tx("l_privacy")}</a></li>
              <li><a href={lp("/cerez-politikasi", lang)}>{tx("l_cookies")}</a></li>
              <li><a href={lp("/kullanim-kosullari", lang)}>{tx("l_terms")}</a></li>
              <li><button type="button" className="linkbtn" data-consent-open>{tx("l_prefs")}</button></li>
            </ul>
            <p className="ftr__social">
              <a href={insta} target="_blank" rel="noopener me"><Icon name="insta" /> @{SITE.instagram}</a>
            </p>
          </div>
        </div>
        <div className="wrap ftr__bar">
          <span>© {new Date().getFullYear()} <Lw lang={lang}>{SITE.name}</Lw> {tx("rights")}</span>
          <span><Lw lang={lang}>{tx("f_loc")}</Lw></span>
        </div>
      </footer>

      <dialog className="pm" id="product-modal" aria-labelledby="pm-title">
        <div className="pm__sheet" data-modal-sheet>
          <button className="pm__x" type="button" data-close aria-label={tx("close")}><Icon name="close" /></button>
          <div className="pm__img" data-pm-img></div>
          <div className="pm__body">
            <p className="pm__eyebrow" data-pm-eyebrow></p>
            <h2 className="pm__title" id="pm-title" data-pm-title></h2>
            <p className="pm__desc" data-pm-desc></p>
            <p className="pm__price" data-pm-price></p>
            <div className="pm__order" data-pm-order hidden></div>
            <div className="pm__blk">
              <h3>{tx("allergens")}</h3>
              <ul className="chips" data-pm-allergens></ul>
            </div>
            <div className="pm__blk">
              <div className="pm__nutr-head">
                <h3>{tx("nutrition")}</h3>
                <label className="sel">
                  <span className="sr">{tx("serving")}</span>
                  <select data-pm-serving></select>
                </label>
              </div>
              <table className="nutr" data-pm-nutr>
                <tbody></tbody>
              </table>
              <p className="pm__note">{tx("nutr_note")}</p>
            </div>
          </div>
        </div>
      </dialog>

      <div className="cc" id="cc" role="dialog" aria-modal="false" aria-labelledby="cc-t" hidden>
        <div className="cc__in">
          <h2 id="cc-t">{tx("cc_t")}</h2>
          <p>{tx("cc_text")} <a href={lp("/cerez-politikasi", lang)}>{tx("l_cookies")}</a>.</p>
          <div className="cc__btns">
            <button type="button" className="btn btn--line" data-cc="reject">{tx("cc_reject")}</button>
            <button type="button" className="btn btn--line" data-cc="prefs">{tx("cc_prefs")}</button>
            <button type="button" className="btn" data-cc="accept">{tx("cc_accept")}</button>
          </div>
        </div>
      </div>

      <dialog className="ccp" id="ccp" aria-labelledby="ccp-t">
        <form method="dialog" className="ccp__in">
          <h2 id="ccp-t">{tx("ccp_t")}</h2>
          <div className="ccp__row">
            <div><strong>{tx("ccp_nec")}</strong><p>{tx("ccp_nec_d")}</p></div>
            <input type="checkbox" defaultChecked disabled aria-label={tx("ccp_nec")} />
          </div>
          <div className="ccp__row">
            <div><strong>{tx("ccp_an")}</strong><p>{tx("ccp_an_d")}</p></div>
            <label className="sw"><input type="checkbox" id="cc-an" /><i></i><span className="sr">{tx("ccp_an")}</span></label>
          </div>
          <div className="ccp__row">
            <div><strong>{tx("ccp_tp")}</strong><p>{tx("ccp_tp_d")}</p></div>
            <label className="sw"><input type="checkbox" id="cc-tp" /><i></i><span className="sr">{tx("ccp_tp")}</span></label>
          </div>
          <div className="cc__btns">
            <button type="button" className="btn btn--line" data-ccp="reject">{tx("cc_reject")}</button>
            <button type="button" className="btn" data-ccp="save">{tx("ccp_save")}</button>
          </div>
        </form>
      </dialog>

      <script src={asset("/assets/js/consent.js")} defer nonce={nonce}></script>
      <script src={asset("/assets/js/main.js")} defer nonce={nonce}></script>
      {menuJs && <script src={asset("/assets/js/menu.js")} defer nonce={nonce}></script>}
      </body>
    </html>
  );
  return new Response(`<!doctype html>
${doc}`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

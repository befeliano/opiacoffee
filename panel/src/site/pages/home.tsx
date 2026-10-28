/** @jsxImportSource @/site/jsx */
// Ana sayfa (Türkçe ve İngilizce). Sezon kartları adisyondaki menüden gelir.

import { SITE, mapsDirUrl, type Lang } from "../config";
import { POSTS } from "../content/posts";
import { seasonTxt, seasonal, type SiteMenu } from "../menu-data";
import { MenuEmbed, ProductCard } from "../products";
import { Icon, Img, Lw } from "../ui";
import { PostCard } from "./blog";

const TXT = {
  tr: {
    open: "Her gün 09:00 - 00:00",
    h1a: "Nitelikli kahve,",
    h1b: "Bağlar’da.",
    lead: "Tepebaşı’nın sakin bir köşesinde, her fincanı özenle hazırlanan bir kahve dükkânı. Filtre kahve, espresso bazlı içecekler, matcha ve vitrinden günlük tatlılar. 2019’dan beri Yenibağlar’dayız.",
    menuCta: "Menüyü keşfet",
    dir: "Yol tarifi",
    heroAlt: "Opia Coffee Co. Yenibağlar Eskişehir, barda filtre kahve",
    marquee: ["Nitelikli Kahve", "Filtre", "Espresso", "Matcha Bar", "Günlük Tatlılar", "Awaken the senses", "09:00 - 00:00", "Yenibağlar / Eskişehir"],
    fullMenu: "Tüm menüyü gör",
    statement: "2019’dan beri Yenibağlar’da, Eti Caddesi’nde: ders arası, yürüyüş sonrası ya da gece yarısına doğru uğranacak bir kahve durağı.",
    story: "Hikâyemiz",
    findUs: "Bizi bul",
    street: "Eti Caddesi",
    days: "Pazartesi - Pazar",
    dirLong: "Yol tarifi al",
    contact: "İletişim",
    loadMap: "Haritayı yükle",
    mapNote: "Harita OpenStreetMap’ten yüklenir.",
    nearLabel: "Çevrede",
    nearH: ["Şehrin ", "kalbinde", " bir mola"],
    nearSub: "Yenibağlar’daki konumumuz, Eskişehir’de gezilecek ve görülecek birçok noktaya yakın.",
    blogH: ["Kahve ", "rehberi"],
    allPosts: "Tüm yazılar",
    follow: "Takip et",
    gallery: ["Opia Coffee Co. tatlı vitrini", "Opia Coffee Co. iç mekân", "Filtre kahve demleme", "Kahve çekirdekleri", "Espresso barı", "Opia Coffee Co. Yenibağlar dış cephe"],
    gallerySuffix: ", Eskişehir Yenibağlar",
  },
  en: {
    open: "Every day 09:00 - 00:00",
    h1a: "Specialty coffee,",
    h1b: "in Bağlar.",
    lead: "A coffee shop on a quiet corner of Tepebaşı where every cup is made with care. Filter coffee, espresso drinks, matcha and daily desserts from our counter. In Yenibağlar since 2019.",
    menuCta: "See the menu",
    dir: "Directions",
    heroAlt: "Opia Coffee Co. in Yenibağlar, Eskişehir: filter coffee at the bar",
    marquee: ["Specialty Coffee", "Filter", "Espresso", "Matcha Bar", "Daily Desserts", "Awaken the senses", "09:00 - 00:00", "Yenibağlar / Eskişehir"],
    fullMenu: "See the full menu",
    statement: "On Eti Street in Yenibağlar since 2019: a coffee stop between classes, after a walk or late into the evening.",
    story: "Our story",
    findUs: "Find us",
    street: "Eti Street",
    days: "Monday - Sunday",
    dirLong: "Get directions",
    contact: "Contact",
    loadMap: "Load map",
    mapNote: "The map is loaded from OpenStreetMap.",
    nearLabel: "Nearby",
    nearH: ["A break in the ", "heart", " of the city"],
    nearSub: "Our spot in Yenibağlar is close to several places worth seeing in Eskişehir.",
    blogH: ["", ""],
    allPosts: "",
    follow: "Follow",
    gallery: ["Opia Coffee Co. dessert counter", "Opia Coffee Co. interior", "Brewing filter coffee", "Coffee beans", "Espresso bar", "Opia Coffee Co. storefront in Yenibağlar"],
    gallerySuffix: ", Eskişehir",
  },
};

const NEAR_TR: [string, string, string, string][] = [
  ["/anadolu-universitesi-yakini-kafe", "school", "Anadolu Üniversitesi", "Yunusemre Kampüsü yakını"],
  ["/hava-muzesi-yakini-kafe", "plane", "Hava Müzesi", "Vecihi Hürkuş Havacılık Parkı"],
  ["/casaba-modern-yakini-kafe", "bag", "Cassaba Modern", "Hoşnudiye, alışveriş molası"],
  ["/eskisehir-tren-gari-yakini-kafe", "train", "Eskişehir Tren Garı", "Tren öncesi / sonrası kahve"],
  ["/yenibaglar-kafe", "cup", "Yenibağlar", "Mahalle kafesi"],
  ["/tepebasi-kafe", "sun", "Tepebaşı", "Eskişehir’in modern yüzü"],
];
const NEAR_EN: [string, string, string][] = [
  ["school", "Anadolu University", "Close to Yunusemre Campus"],
  ["plane", "Aviation Museum", "Vecihi Hürkuş Aviation Park"],
  ["bag", "Cassaba Modern", "Shopping centre in Hoşnudiye"],
  ["train", "Eskişehir Train Station", "About 1 km as the crow flies"],
  ["cup", "Yenibağlar", "Our neighbourhood"],
  ["sun", "Tepebaşı", "The modern side of Eskişehir"],
];

export default function Home({ lang, menu }: { lang: Lang; menu: SiteMenu }) {
  const x = TXT[lang];
  const en = lang === "en";
  const season = seasonal(menu);
  const a = SITE.address;
  const insta = `https://www.instagram.com/${SITE.instagram}/`;
  const L = (s: string) => <Lw lang={lang}>{s}</Lw>;
  const posts = [...POSTS].sort((p, q) => q.date.localeCompare(p.date)).slice(0, 3);

  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__txt">
            <p className="eyebrow">
              <span className="dot" aria-hidden="true"></span>
              <span data-open-status>{x.open}</span>
              <span className="sep" aria-hidden="true">/</span>
              <span className="eyebrow__loc">{L("Yenibağlar, Eskişehir")}</span>
            </p>
            <h1 className="hero__h">
              <span className="sr">{L("Opia Coffee Co.: ")}</span>
              {x.h1a}
              <br />
              <em>{L(x.h1b)}</em>
            </h1>
            <p className="lead">{L(x.lead)}</p>
            <div className="hero__cta">
              <a className="btn" href={en ? "/en/menu" : "/menu"}>{x.menuCta} <Icon name="arrow" /></a>
              <a className="btn btn--line" href={mapsDirUrl()} target="_blank" rel="noopener"><Icon name="pin" /> {x.dir}</a>
            </div>
          </div>
          <figure className="hero__fig">
            <Img slot="hero" alt={x.heroAlt} w={1000} h={1250} eager />
            <figcaption>
              <span>{L(a.street)}</span>
              <span>{L("Yenibağlar")}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__t">
          {[0, 1].map((r) =>
            x.marquee.map((m, i) => [<span key={`${r}${i}`}>{L(m)}</span>, <i key={`${r}${i}i`}></i>]),
          )}
        </div>
      </div>

      {season.length > 0 && (
        <>
          <section className="sec" id="mevsim" aria-labelledby="mevsim-h">
            <div className="wrap">
              <header className="sec__head">
                <p className="label"><Icon name="leaf" /> {L(seasonTxt(menu, "label", lang))}</p>
                <h2 id="mevsim-h" className="h2">{L(seasonTxt(menu, "title", lang))}</h2>
                <p className="sec__sub">{L(seasonTxt(menu, "subtitle", lang))}</p>
              </header>
              <ul className="cards">
                {season.map((p) => <ProductCard key={p.id} p={p} lang={lang} />)}
              </ul>
              <p className="sec__more"><a className="ulink" href={en ? "/en/menu" : "/menu"}>{x.fullMenu} <Icon name="arrow" /></a></p>
            </div>
          </section>
          <MenuEmbed products={season} menu={menu} lang={lang} />
        </>
      )}

      <section className="sec sec--ink statement">
        <div className="wrap">
          <p className="label label--inv">{L("Opia Coffee Co.")}</p>
          <p className="statement__t"><em>{L("Awaken the senses.")}</em> {L(x.statement)}</p>
          <a className="btn btn--inv" href={en ? "/en/about" : "/hakkimizda"}>{x.story} <Icon name="arrow" /></a>
        </div>
      </section>

      <section className="sec" aria-labelledby="ziyaret-h">
        <div className="wrap visit">
          <div className="visit__info">
            <p className="label"><Icon name="pin" /> {x.findUs}</p>
            <h2 id="ziyaret-h" className="h2">{L("Yenibağlar")}, <em>{L(x.street)}</em></h2>
            <address className="visit__addr">
              {L(`${a.hood} ${a.street}`)}
              <br />
              {L(`${a.district} / ${a.city}${en ? ", Türkiye" : ""}`)}
            </address>
            <dl className="hours">
              <div><dt>{x.days}</dt><dd>09:00 - 00:00</dd></div>
            </dl>
            <div className="visit__cta">
              <a className="btn" href={mapsDirUrl()} target="_blank" rel="noopener"><Icon name="pin" /> {x.dirLong}</a>
              <a className="btn btn--line" href={en ? "/en/contact" : "/iletisim"}>{x.contact}</a>
            </div>
          </div>
          <div className="mapbox" data-map data-lat={SITE.geo.lat} data-lng={SITE.geo.lng}>
            <div className="mapbox__ph">
              <Icon name="pin" />
              <p>{L("Opia Coffee Co.")}<br /><small>{L("Yenibağlar, Tepebaşı / Eskişehir")}</small></p>
              <button type="button" className="btn btn--line" data-map-load>{x.loadMap}</button>
              <small className="mapbox__n">{x.mapNote}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec--tint" aria-labelledby="cevre-h">
        <div className="wrap">
          <header className="sec__head">
            <p className="label"><Icon name="pin" /> {x.nearLabel}</p>
            <h2 id="cevre-h" className="h2">{x.nearH[0]}<em>{x.nearH[1]}</em>{x.nearH[2]}</h2>
            <p className="sec__sub">{L(x.nearSub)}</p>
          </header>
          {en ? (
            <ul className="near near--info">
              {NEAR_EN.map(([icon, b, s]) => (
                <li key={b}><div><Icon name={icon} /><span><b>{L(b)}</b><small>{L(s)}</small></span></div></li>
              ))}
            </ul>
          ) : (
            <ul className="near">
              {NEAR_TR.map(([href, icon, b, s]) => (
                <li key={href}><a href={href}><Icon name={icon} /><span><b>{L(b)}</b><small>{L(s)}</small></span><Icon name="arrow-ur" /></a></li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {!en && (
        <section className="sec" aria-labelledby="blog-h">
          <div className="wrap">
            <header className="sec__head sec__head--row">
              <div>
                <p className="label">Blog</p>
                <h2 id="blog-h" className="h2">{x.blogH[0]}<em>{x.blogH[1]}</em></h2>
              </div>
              <a className="btn btn--line" href="/blog">{x.allPosts} <Icon name="arrow" /></a>
            </header>
            <ul className="posts posts--3">
              {posts.map((p) => <PostCard key={p.slug} p={p} />)}
            </ul>
          </div>
        </section>
      )}

      <section className={`sec${en ? "" : " sec--tint"}`} aria-labelledby="galeri-h">
        <div className="wrap">
          <header className="sec__head sec__head--row">
            <div>
              <p className="label"><Icon name="insta" /> {L("Instagram")}</p>
              <h2 id="galeri-h" className="h2">@{L(SITE.instagram)}</h2>
            </div>
            <a className="btn btn--line" href={insta} target="_blank" rel="noopener me">{x.follow} <Icon name="arrow-ur" /></a>
          </header>
          <div className="gal">
            {x.gallery.map((alt, i) => (
              <a key={alt} className={en ? "gal__i" : `gal__i gal__i--${i + 1}`} href={insta} target="_blank" rel="noopener me" aria-label={`Instagram: ${alt}`}>
                <Img slot={`galeri-${i + 1}`} alt={alt + x.gallerySuffix} w={800} h={800} />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

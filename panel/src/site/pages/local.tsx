/** @jsxImportSource @/site/jsx */
// Yerel SEO sayfası şablonu (/<slug>). İçerikler src/site/content/locals.ts içinde.

import { mapsDirUrl } from "../config";
import { LOCALS, type LocalPage } from "../content/locals";
import type { SiteMenu } from "../menu-data";
import { MenuEmbed, ProductCard } from "../products";
import { FaqList, Html, Icon, Img, Lw } from "../ui";

export function Local({ d, menu }: { d: LocalPage; menu: SiteMenu }) {
  const featured = menu.products.filter((p) => p.featured).slice(0, 3);
  const L = (s: string) => <Lw lang="tr">{s}</Lw>;
  return (
    <>
      <section className="phead phead--local">
        <div className="wrap phead__grid">
          <div>
            <nav className="crumbs" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a><span aria-hidden="true">/</span><span>{L(d.h1)}</span></nav>
            <p className="eyebrow"><Icon name={d.icon} /> {L("Opia Coffee Co. / Yenibağlar, Eskişehir")}</p>
            <h1 className="phead__h phead__h--sm">{L(d.h1)}</h1>
            <p className="lead">{L(d.lead)}</p>
            <div className="hero__cta">
              <a className="btn" href="/menu">Menüyü gör <Icon name="arrow" /></a>
              <a className="btn btn--line" href={mapsDirUrl()} target="_blank" rel="noopener"><Icon name="pin" /> Yol tarifi</a>
            </div>
          </div>
          <figure className="phead__fig"><Img slot={d.image} alt={`${d.h1}, Opia Coffee Co. Eskişehir`} w={1200} h={900} eager /></figure>
        </div>
      </section>

      <section className="sec sec--tight">
        <Html
          className="wrap narrow prose"
          lang="tr"
          html={d.sections.map(([h, html]) => `<h2>${h.replace(/</g, "&lt;")}</h2>${html}`).join("")}
        />
      </section>

      {featured.length > 0 && (
        <>
          <section className="sec sec--tint sec--tight" aria-labelledby="oner-h">
            <div className="wrap">
              <header className="sec__head"><p className="label">Menüden</p><h2 id="oner-h" className="h2">Sevilenler</h2></header>
              <ul className="cards cards--3">{featured.map((p) => <ProductCard key={p.id} p={p} lang="tr" />)}</ul>
              <p className="sec__more"><a className="ulink" href="/menu">Tüm menüyü gör <Icon name="arrow" /></a></p>
            </div>
          </section>
          <MenuEmbed products={featured} menu={menu} lang="tr" />
        </>
      )}

      <section className="sec sec--tight" aria-labelledby="sss-h">
        <div className="wrap narrow">
          <h2 id="sss-h" className="h2">Sık sorulanlar</h2>
          <FaqList faq={d.faq} />
        </div>
      </section>

      <section className="sec sec--ink sec--tight">
        <div className="wrap">
          <p className="label label--inv">Diğer yerel rehberler</p>
          <ul className="related">
            {LOCALS.filter((o) => o.slug !== d.slug).map((o) => (
              <li key={o.slug}><a href={`/${o.slug}`}>{L(o.h1)} <Icon name="arrow-ur" /></a></li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

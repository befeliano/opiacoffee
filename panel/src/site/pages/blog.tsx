/** @jsxImportSource @/site/jsx */
// Blog: liste (/blog) ve yazı (/blog/<slug>). Yazılar src/site/content/posts.ts içinde.

import { SITE, url } from "../config";
import { POSTS, type Post } from "../content/posts";
import type { SiteMenu } from "../menu-data";
import { MenuEmbed, ProductCard } from "../products";
import { FaqList, Html, Icon, Img, Lw, imgSrc } from "../ui";

const MONTHS = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export const sortedPosts = () => [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

const words = (p: Post) => p.body.replace(/<[^>]+>/g, " ").split(/[^\p{L}’]+/u).filter(Boolean).length;
export const postMinutes = (p: Post) => Math.max(2, Math.ceil(words(p) / 200));

export function postDate(d: string) {
  const [y, m, g] = d.split("-").map(Number);
  return `${g} ${MONTHS[m]} ${y}`;
}

export function PostCard({ p }: { p: Post }) {
  return (
    <li className="pcard">
      <a href={`/blog/${p.slug}`}>
        <span className="pcard__img"><Img slot={`blog-${p.slug}`} alt={p.h1} w={1200} h={750} /></span>
        <span className="pcard__meta">{p.section} / {postMinutes(p)} dk</span>
        <span className="pcard__t"><Lw lang="tr">{p.h1}</Lw></span>
        <span className="pcard__d"><Lw lang="tr">{p.description}</Lw></span>
      </a>
    </li>
  );
}

export function blogIndexSchema(posts: Post[]) {
  return {
    "@type": "Blog",
    "@id": url("/blog#blog"),
    url: url("/blog"),
    name: "Opia Coffee Co. Blog",
    inLanguage: "tr-TR",
    publisher: { "@id": url("/#cafe") },
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.h1, url: url(`/blog/${p.slug}`), datePublished: p.date })),
  };
}

export function BlogIndex() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow"><span lang="en">Opia</span> Coffee Co.</p>
          <h1 className="phead__h">Blog</h1>
          <p className="lead">Kahve, demleme, kış içecekleri ve Eskişehir üzerine kısa yazılar. Menüde gördüğün bir içeceği merak ediyorsan buradan başlayabilirsin.</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap">
          <ul className="posts">
            {sortedPosts().map((p) => <PostCard key={p.slug} p={p} />)}
          </ul>
        </div>
      </section>
    </>
  );
}

export function postSchema(p: Post) {
  const u = url(`/blog/${p.slug}`);
  const img = imgSrc(`blog-${p.slug}`, 1200, 750);
  return {
    "@type": "BlogPosting",
    "@id": `${u}#post`,
    mainEntityOfPage: u,
    url: u,
    headline: p.h1,
    description: p.description,
    inLanguage: "tr-TR",
    datePublished: `${p.date}T09:00:00+03:00`,
    dateModified: `${p.updated}T09:00:00+03:00`,
    image: [img.real ? url(img.src) : url("/assets/img/og-image.png")],
    author: { "@type": "Organization", name: SITE.name, url: url("/") },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: url("/assets/img/logo-opia.png") } },
    articleSection: p.section,
    keywords: p.keywords.join(", "),
    wordCount: words(p),
    about: { "@id": url("/#cafe") },
  };
}

export function BlogPost({ p, menu }: { p: Post; menu: SiteMenu }) {
  const prods = p.products.map((id) => menu.products.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x);
  const others = sortedPosts().filter((o) => o.slug !== p.slug).slice(0, 4);
  return (
    <>
      <article className="post">
        <header className="phead">
          <div className="wrap narrow">
            <nav className="crumbs" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a><span aria-hidden="true">/</span><a href="/blog">Blog</a></nav>
            <p className="eyebrow">
              {p.section} <span className="sep" aria-hidden="true">/</span> <time dateTime={p.date}>{postDate(p.date)}</time>{" "}
              <span className="sep" aria-hidden="true">/</span> {postMinutes(p)} dk okuma
            </p>
            <h1 className="phead__h phead__h--sm"><Lw lang="tr">{p.h1}</Lw></h1>
            <p className="lead"><Lw lang="tr">{p.lead}</Lw></p>
          </div>
        </header>
        <figure className="wrap narrow post__fig"><Img slot={`blog-${p.slug}`} alt={`${p.h1}, Opia Coffee Co. Eskişehir`} w={1200} h={750} eager /></figure>
        <div className="sec sec--tight">
          <Html html={p.body} lang="tr" className="wrap narrow prose post__body" />
        </div>
      </article>

      {prods.length > 0 && (
        <>
          <section className="sec sec--tint sec--tight" aria-labelledby="menude-h">
            <div className="wrap">
              <header className="sec__head"><p className="label">Menüde</p><h2 id="menude-h" className="h2">Bu yazıdakiler</h2></header>
              <ul className="cards">{prods.map((x) => <ProductCard key={x.id} p={x} lang="tr" />)}</ul>
            </div>
          </section>
          <MenuEmbed products={prods} menu={menu} lang="tr" />
        </>
      )}

      {p.faq.length > 0 && (
        <section className="sec sec--tight" aria-labelledby="sss-h">
          <div className="wrap narrow"><h2 id="sss-h" className="h2">Sık sorulanlar</h2><FaqList faq={p.faq} /></div>
        </section>
      )}

      <section className="sec sec--ink sec--tight">
        <div className="wrap">
          <p className="label label--inv">Diğer yazılar</p>
          <ul className="related">
            {others.map((o) => <li key={o.slug}><a href={`/blog/${o.slug}`}><Lw lang="tr">{o.h1}</Lw> <Icon name="arrow-ur" /></a></li>)}
          </ul>
        </div>
      </section>
    </>
  );
}

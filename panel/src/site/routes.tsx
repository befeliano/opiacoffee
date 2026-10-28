/** @jsxImportSource @/site/jsx */
// Menüye bağlı sayfaların rota işleyicileri (src/app/(site)/web/** buradan içe aktarır).

import type { Lang } from "./config";
import { LOCALS } from "./content/locals";
import { POSTS } from "./content/posts";
import { getSiteMenu } from "./menu-data";
import { BlogIndex, BlogPost, blogIndexSchema, postSchema, sortedPosts } from "./pages/blog";
import Home from "./pages/home";
import { Local } from "./pages/local";
import MenuPage from "./pages/menu";
import { menuSchema } from "./products";
import { renderPage, type PageMeta } from "./shell";
import { faqSchema } from "./ui";

const HOME: Record<Lang, PageMeta> = {
  tr: {
    path: "/",
    lang: "tr",
    title: "Opia Coffee Co. | Yenibağlar, Eskişehir’de Nitelikli Kahve",
    description: "Opia Coffee Co.: Yenibağlar, Eskişehir’de nitelikli kahve, filtre, espresso, matcha ve günlük tatlılar. Her gün 09:00 - 00:00, Anadolu Üniversitesi yakını.",
  },
  en: {
    path: "/en",
    lang: "en",
    title: "Opia Coffee Co. | Specialty Coffee in Eskişehir, Turkey",
    description: "Opia Coffee Co. in Yenibağlar, Eskişehir: specialty coffee, espresso drinks, matcha and daily desserts. Open daily 09:00 - 00:00, near Anadolu University.",
  },
};

const MENU: Record<Lang, PageMeta> = {
  tr: {
    path: "/menu",
    lang: "tr",
    title: "Menü | Opia Coffee Co. Yenibağlar Eskişehir",
    description: "Opia Coffee Co. menüsü: espresso bazlı içecekler, filtre kahve, Matcha Bar, sıcak çikolata, kışa özel içecekler ve tatlılar. Alerjen ve kalori bilgili.",
  },
  en: {
    path: "/en/menu",
    lang: "en",
    title: "Menu | Opia Coffee Co. Eskişehir",
    description: "Opia Coffee Co. menu: espresso drinks, filter coffee, Matcha Bar, hot chocolate, winter specials and desserts, with allergens and calories.",
  },
};

export const homeRoute = (lang: Lang) => async (request: Request) =>
  renderPage(request, { meta: HOME[lang], business: true, menuJs: true, content: <Home lang={lang} menu={await getSiteMenu()} /> });

export const menuRoute = (lang: Lang) => async (request: Request) => {
  const menu = await getSiteMenu();
  const crumbs: [string, string][] = lang === "en" ? [["Home", "/en"], ["Menu", "/en/menu"]] : [["Ana Sayfa", "/"], ["Menü", "/menu"]];
  return renderPage(request, {
    meta: MENU[lang],
    menuJs: true,
    breadcrumb: crumbs,
    schema: [menuSchema(menu, lang)],
    content: <MenuPage lang={lang} menu={menu} />,
  });
};

export function blogIndexRoute(request: Request) {
  return renderPage(request, {
    meta: {
      path: "/blog",
      lang: "tr",
      alt: null,
      title: "Blog: Kahve Rehberi ve Eskişehir | Opia Coffee Co.",
      description: "Opia Coffee Co. blogu: flat white ve latte farkı, nitelikli kahve, matcha, salep ve Eskişehir Yenibağlar üzerine kısa ve faydalı yazılar.",
    },
    breadcrumb: [["Ana Sayfa", "/"], ["Blog", "/blog"]],
    schema: [blogIndexSchema(sortedPosts())],
    content: <BlogIndex />,
  });
}

export async function blogPostRoute(request: Request, slug: string) {
  const p = POSTS.find((x) => x.slug === slug);
  if (!p) return notFound(request);
  const path = `/blog/${p.slug}`;
  const schema: unknown[] = [postSchema(p)];
  if (p.faq.length) schema.push(faqSchema(p.faq));
  return renderPage(request, {
    meta: { path, lang: "tr", alt: null, title: `${p.title} | Opia`, description: p.description, ogType: "article" },
    menuJs: p.products.length > 0,
    breadcrumb: [["Ana Sayfa", "/"], ["Blog", "/blog"], [p.h1, path]],
    schema,
    content: <BlogPost p={p} menu={await getSiteMenu()} />,
  });
}

/** Yerel SEO sayfaları (/<slug>); eşleşmeyen her yol 404 */
export async function localRoute(request: Request, segments: string[]) {
  const d = segments.length === 1 ? LOCALS.find((x) => x.slug === segments[0]) : undefined;
  if (!d) return notFound(request);
  return renderPage(request, {
    meta: { path: `/${d.slug}`, lang: "tr", alt: null, title: d.title, description: d.description },
    business: true,
    menuJs: true,
    breadcrumb: [["Ana Sayfa", "/"], [d.h1, `/${d.slug}`]],
    schema: [faqSchema(d.faq)],
    content: <Local d={d} menu={await getSiteMenu()} />,
  });
}

export function notFound(request: Request) {
  return renderPage(request, {
    status: 404,
    mainClass: "page-404",
    meta: {
      path: "/404",
      lang: "tr",
      alt: null,
      robots: "noindex, follow",
      title: "Sayfa bulunamadı | Opia Coffee Co.",
      description: "Aradığın sayfa bulunamadı. Opia Coffee Co. ana sayfasına ya da menüye dönebilir, Yenibağlar’daki kahve dükkânımızı keşfedebilirsin.",
    },
    content: (
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">404</p>
          <h1 className="phead__h">Sayfa <em>bulunamadı</em></h1>
          <p className="lead">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir. Bir fincan kahveyle yeniden başlayalım.</p>
          <div className="hero__cta">
            <a className="btn" href="/">Ana sayfa</a>
            <a className="btn btn--line" href="/menu">Menü</a>
          </div>
        </div>
      </section>
    ),
  });
}
